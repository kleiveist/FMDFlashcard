from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from tools import logger
from tools.core.context import ProjectContext, load_context
from tools.inst.tooling_runtime import TOOLING_RUNTIME_PROBE
from tools.process import prepare_command
from tools.profiles import runtime as profile_runtime

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve paths for the current target instead of freezing them at import time."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


@dataclass(slots=True)
class StepResult:
    name: str
    status: str
    message: str


def _run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        prepare_command(cmd), cwd=cwd, text=True, capture_output=True, check=False
    )


def _tail(text: str, limit: int = 8) -> str:
    lines = [line for line in text.strip().splitlines() if line.strip()]
    if not lines:
        return "(no output)"
    return " | ".join(lines[-limit:])


def _ensure_env_file() -> StepResult:
    context = _context()
    env = context.project_root / ".env"
    example = context.resources.examples / ".env.example"

    if env.exists():
        return StepResult("env", "OK", ".env already exists (not modified)")

    if example.exists():
        return StepResult(
            "env",
            "WARN",
            ".env is absent and was not created. Copy the tooling .env example manually when overrides are needed.",
        )

    return StepResult(
        "env",
        "WARN",
        ".env and .env.example are absent; built-in defaults remain active",
    )


def _install_frontend() -> StepResult:
    frontend_dir = _context().paths.frontend
    if not (frontend_dir / "package.json").exists():
        return StepResult("frontend", "FAIL", "missing frontend/package.json")

    npm = shutil.which("npm")
    if npm is None:
        return StepResult(
            "frontend", "FAIL", "npm not found. Action: install Node.js and npm."
        )

    lockfile = frontend_dir / "package-lock.json"
    install_action = "ci" if lockfile.exists() else "install"
    command = [npm, install_action, "--no-audit", "--no-fund"]
    logger.info(f"Running frontend dependency installation ({' '.join(command[1:])})")
    started = time.monotonic()
    completed = _run(command, cwd=frontend_dir)
    elapsed = time.monotonic() - started
    if completed.returncode == 0:
        return StepResult(
            "frontend", "OK", f"npm {install_action} completed ({elapsed:.1f}s)"
        )

    details = _tail((completed.stdout or "") + "\n" + (completed.stderr or ""))
    return StepResult(
        "frontend",
        "FAIL",
        f"npm {install_action} failed after {elapsed:.1f}s: {details}",
    )


def _ensure_backend_venv_with_uv(backend_dir: Path) -> subprocess.CompletedProcess[str]:
    return _run(["uv", "venv", str(backend_dir / ".venv")], cwd=ROOT)


def _venv_python(venv_dir: Path) -> Path:
    candidates = [venv_dir / "Scripts" / "python.exe", venv_dir / "bin" / "python"]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0] if sys.platform == "win32" else candidates[1]


def _requirement_arguments(requirements: list[Path]) -> list[str]:
    arguments: list[str] = []
    for path in requirements:
        arguments.extend(["-r", str(path)])
    return arguments


def _install_backend_with_uv(
    backend_dir: Path,
    requirements: list[Path],
) -> subprocess.CompletedProcess[str]:
    python_bin = _venv_python(backend_dir / ".venv")
    return _run(
        [
            "uv",
            "pip",
            "install",
            "--python",
            str(python_bin),
            *_requirement_arguments(requirements),
        ],
        cwd=ROOT,
    )


def _select_venv_seed_python() -> str:
    if sys.platform == "win32":
        return sys.executable
    python3 = shutil.which("python3")
    if python3:
        return python3
    return sys.executable


def _create_backend_venv(venv_dir: Path, clear: bool) -> tuple[bool, str]:
    seed_python = _select_venv_seed_python()
    cmd = [seed_python, "-m", "venv"]
    if clear:
        cmd.append("--clear")
    cmd.append(str(venv_dir))

    started = time.monotonic()
    completed = _run(cmd, cwd=ROOT)
    elapsed = time.monotonic() - started
    if completed.returncode != 0:
        details = _tail((completed.stdout or "") + "\n" + (completed.stderr or ""))
        action = "venv rebuild" if clear else "venv creation"
        return False, f"{action} failed after {elapsed:.1f}s: {details}"

    if clear:
        logger.info(
            f"Backend virtualenv rebuilt in {elapsed:.1f}s (seed={seed_python})"
        )
    else:
        logger.info(
            f"Backend virtualenv created in {elapsed:.1f}s (seed={seed_python})"
        )
    return True, "venv ready"


def _read_venv_version(venv_dir: Path) -> str | None:
    cfg_path = venv_dir / "pyvenv.cfg"
    if not cfg_path.exists():
        return None

    try:
        text = cfg_path.read_text(encoding="utf-8")
    except OSError:
        return None

    for line in text.splitlines():
        if line.strip().startswith("version"):
            parts = line.split("=", 1)
            if len(parts) == 2:
                return parts[1].strip()
    return None


def _inspect_backend_venv(py: Path, venv_dir: Path) -> tuple[bool, str]:
    probe = (
        "import importlib.util, json, site, sys; "
        "payload={'runtime': f'{sys.version_info.major}.{sys.version_info.minor}', "
        "'prefix': sys.prefix, "
        "'site_packages': site.getsitepackages(), "
        "'has_pip': importlib.util.find_spec('pip') is not None}; "
        "print(json.dumps(payload))"
    )
    completed = _run([str(py), "-c", probe], cwd=ROOT)
    if completed.returncode != 0:
        details = _tail((completed.stdout or "") + "\n" + (completed.stderr or ""))
        return False, f"venv probe failed: {details}"

    try:
        state = json.loads(completed.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as exc:
        return False, f"venv probe output could not be parsed: {exc}"

    runtime = str(state.get("runtime", ""))
    site_packages = [str(item) for item in state.get("site_packages", [])]
    has_pip = bool(state.get("has_pip"))

    if not runtime:
        return False, "venv probe did not return runtime version"

    configured_version = _read_venv_version(venv_dir)
    if configured_version and not configured_version.startswith(f"{runtime}."):
        return False, (
            f"venv interpreter mismatch: pyvenv.cfg version={configured_version}, runtime={runtime}"
        )

    runtime_prefix = Path(str(state.get("prefix", ""))).resolve()
    if runtime_prefix != venv_dir.resolve():
        return False, (
            f"venv prefix mismatch: expected={venv_dir.resolve()}, runtime={runtime_prefix}"
        )

    if not site_packages:
        return False, "venv probe did not return a site-packages directory"

    if not has_pip:
        return False, "pip is missing in backend virtualenv"

    return True, "venv runtime is consistent"


def _rebuild_backend_venv(venv_dir: Path, reason: str) -> tuple[bool, str]:
    logger.info(f"Rebuilding backend virtualenv with --clear because {reason}")
    rebuilt, rebuild_msg = _create_backend_venv(venv_dir, clear=True)
    if not rebuilt:
        return False, rebuild_msg

    return True, "venv rebuilt"


def _ensure_backend_venv_consistency(py: Path, venv_dir: Path) -> tuple[bool, str]:
    logger.info("Checking backend virtualenv consistency")
    consistent, reason = _inspect_backend_venv(py, venv_dir)
    if consistent:
        return True, "venv is consistent"

    if "error while loading shared libraries" in reason:
        logger.warn(
            "venv python shared library resolution failed; attempting rebuild with system python3"
        )
        rebuilt, rebuild_msg = _rebuild_backend_venv(venv_dir, reason)
        if not rebuilt:
            return False, rebuild_msg
        consistent_after, reason_after = _inspect_backend_venv(py, venv_dir)
        if not consistent_after:
            return False, f"venv still inconsistent after rebuild: {reason_after}"
        logger.info("backend virtualenv repaired after shared library failure")
        return True, "venv repaired after shared library failure"

    if "pip is missing" in reason:
        logger.warn("pip is missing in backend virtualenv; attempting ensurepip repair")
        ensurepip = _run([str(py), "-m", "ensurepip", "--upgrade"], cwd=ROOT)
        if ensurepip.returncode == 0:
            consistent, repaired_reason = _inspect_backend_venv(py, venv_dir)
            if consistent:
                logger.info("pip successfully repaired in backend virtualenv")
                return True, "pip repaired via ensurepip"
            reason = repaired_reason
        else:
            details = _tail((ensurepip.stdout or "") + "\n" + (ensurepip.stderr or ""))
            reason = f"ensurepip repair failed: {details}"

    logger.warn(f"{reason}; attempting automatic rebuild repair")
    rebuilt, rebuild_msg = _rebuild_backend_venv(venv_dir, reason)
    if not rebuilt:
        return False, rebuild_msg

    consistent_after, reason_after = _inspect_backend_venv(py, venv_dir)
    if not consistent_after:
        return False, f"venv still inconsistent after rebuild: {reason_after}"

    logger.info("backend virtualenv consistency repaired")
    return True, "venv repaired"


def _install_backend_with_pip(
    backend_dir: Path, requirements: list[Path]
) -> tuple[bool, str]:
    venv_dir = backend_dir / ".venv"
    if not venv_dir.exists():
        logger.info("Creating backend virtualenv")
        created, create_msg = _create_backend_venv(venv_dir, clear=False)
        if not created:
            return False, create_msg

    py = _venv_python(venv_dir)
    if not py.exists():
        logger.warn(
            f"venv python not found at {py}; attempting automatic rebuild repair"
        )
        rebuilt, rebuild_msg = _rebuild_backend_venv(
            venv_dir, f"venv python is missing at {py}"
        )
        if not rebuilt:
            return False, rebuild_msg
        if not py.exists():
            return False, f"venv python still not found after rebuild at {py}"

    consistent, consistency_msg = _ensure_backend_venv_consistency(py, venv_dir)
    if not consistent:
        return False, consistency_msg

    logger.info("Upgrading pip in backend virtualenv")
    started = time.monotonic()
    pip_upgrade = _run([str(py), "-m", "pip", "install", "--upgrade", "pip"], cwd=ROOT)
    elapsed = time.monotonic() - started
    if pip_upgrade.returncode != 0:
        return (
            False,
            f"pip upgrade failed after {elapsed:.1f}s: {_tail((pip_upgrade.stdout or '') + (pip_upgrade.stderr or ''))}",
        )
    logger.info(f"pip upgrade completed in {elapsed:.1f}s")

    logger.info("Installing backend requirements")
    started = time.monotonic()
    pip_install = _run(
        [str(py), "-m", "pip", "install", *_requirement_arguments(requirements)],
        cwd=ROOT,
    )
    elapsed = time.monotonic() - started
    if pip_install.returncode != 0:
        return (
            False,
            f"pip install failed after {elapsed:.1f}s: {_tail((pip_install.stdout or '') + (pip_install.stderr or ''))}",
        )
    logger.info(f"Backend requirements installed in {elapsed:.1f}s")

    return True, "pip/venv backend install completed"


def _backend_requirements() -> list[Path]:
    profile = profile_runtime.active_profile(ROOT)
    backend_dir = _context().paths.backend
    if backend_dir is None:
        return []
    requirements = [backend_dir / "requirements.txt"]
    if profile.has_feature("database"):
        requirements.append(backend_dir / "requirements-database.txt")
    if profile.has_feature("postgres"):
        requirements.append(backend_dir / "requirements-postgres.txt")
    return requirements


def _install_backend() -> StepResult:
    backend_dir = _context().paths.backend
    if backend_dir is None:
        return StepResult(
            "backend", "FAIL", "backend path is not configured in project-tooling.toml"
        )
    requirements = _backend_requirements()

    missing = [
        path.relative_to(ROOT).as_posix() for path in requirements if not path.exists()
    ]
    if missing:
        return StepResult(
            "backend",
            "FAIL",
            f"missing backend requirement file(s): {', '.join(missing)}",
        )

    uv = shutil.which("uv")
    if uv is not None:
        logger.info("Trying backend installation via uv")
        uv_venv = _ensure_backend_venv_with_uv(backend_dir)
        if uv_venv.returncode == 0:
            logger.info("Installing backend requirements with uv")
            uv_install = _install_backend_with_uv(backend_dir, requirements)
            if uv_install.returncode == 0:
                return StepResult("backend", "OK", "installed dependencies with uv")

        logger.warn("uv path failed, switching to pip/venv fallback")
        pip_ok, pip_msg = _install_backend_with_pip(backend_dir, requirements)
        if pip_ok:
            return StepResult("backend", "WARN", "uv failed; pip fallback succeeded")
        uv_details = _tail((uv_venv.stdout or "") + "\n" + (uv_venv.stderr or ""))
        return StepResult(
            "backend",
            "FAIL",
            f"uv path failed ({uv_details}); fallback failed: {pip_msg}",
        )

    logger.info("uv not found; using pip/venv fallback for backend installation")
    pip_ok, pip_msg = _install_backend_with_pip(backend_dir, requirements)
    if pip_ok:
        return StepResult(
            "backend",
            "OK",
            "installed dependencies with the supported pip/venv fallback (uv is optional)",
        )
    return StepResult(
        "backend", "FAIL", f"backend install failed without uv: {pip_msg}"
    )


def _tooling_runtime_ready(python: Path) -> bool:
    if not python.exists():
        return False
    completed = _run([str(python), "-c", TOOLING_RUNTIME_PROBE], cwd=ROOT)
    return completed.returncode == 0


def _install_tooling_runtime() -> StepResult:
    context = _context()
    tooling_venv = context.venv_root
    tooling_requirements = context.tools_root / "requirements.txt"
    tooling_python = _venv_python(tooling_venv)
    if _tooling_runtime_ready(tooling_python):
        return StepResult(
            "tooling",
            "OK",
            f"{tooling_venv} already provides quality and test dependencies",
        )

    if not tooling_requirements.exists():
        return StepResult("tooling", "FAIL", "missing tools/requirements.txt")

    if tooling_venv.exists():
        consistent, reason = _inspect_backend_venv(tooling_python, tooling_venv)
        if not consistent:
            logger.info(f"Rebuilding shared tooling virtualenv because {reason}")
            rebuilt, rebuild_message = _create_backend_venv(tooling_venv, clear=True)
            if not rebuilt:
                return StepResult(
                    "tooling", "FAIL", f"tooling venv rebuild failed: {rebuild_message}"
                )
    else:
        logger.info("Creating shared tooling virtualenv")
        command = [_select_venv_seed_python(), "-m", "venv", str(tooling_venv)]
        created = _run(command, cwd=ROOT)
        if created.returncode != 0:
            details = _tail((created.stdout or "") + "\n" + (created.stderr or ""))
            return StepResult(
                "tooling", "FAIL", f"tooling venv creation failed: {details}"
            )

    tooling_python = _venv_python(tooling_venv)
    if not tooling_python.exists():
        return StepResult(
            "tooling", "FAIL", f"tooling venv python not found at {tooling_python}"
        )

    logger.info("Installing shared tooling test requirements")
    completed = _run(
        [str(tooling_python), "-m", "pip", "install", "-r", str(tooling_requirements)],
        cwd=ROOT,
    )
    if completed.returncode != 0:
        details = _tail((completed.stdout or "") + "\n" + (completed.stderr or ""))
        return StepResult(
            "tooling", "FAIL", f"tooling dependency install failed: {details}"
        )
    return StepResult("tooling", "OK", "installed shared tooling test requirements")


def _install_playwright() -> StepResult:
    frontend_dir = _context().paths.frontend
    if not (frontend_dir / "package.json").exists():
        return StepResult("playwright", "FAIL", "missing frontend/package.json")

    npx = shutil.which("npx")
    if npx is None:
        return StepResult(
            "playwright", "FAIL", "npx not found. Action: install Node.js and npm."
        )

    logger.info("Installing Playwright Chromium browser")
    started = time.monotonic()
    completed = _run([npx, "playwright", "install", "chromium"], cwd=frontend_dir)
    elapsed = time.monotonic() - started
    if completed.returncode == 0:
        return StepResult(
            "playwright", "OK", f"Chromium installation completed ({elapsed:.1f}s)"
        )

    details = _tail((completed.stdout or "") + "\n" + (completed.stderr or ""))
    return StepResult(
        "playwright",
        "FAIL",
        f"playwright install failed after {elapsed:.1f}s: {details}",
    )


def _playwright_configured() -> bool:
    frontend_dir = _context().paths.frontend
    if (frontend_dir / "tests" / "e2e").exists():
        return True
    if any(frontend_dir.glob("playwright.config.*")):
        return True
    package_json = frontend_dir / "package.json"
    try:
        payload = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    dependencies = {
        **payload.get("dependencies", {}),
        **payload.get("devDependencies", {}),
    }
    return "@playwright/test" in dependencies or "playwright" in dependencies


def _print_summary(results: list[StepResult]) -> str:
    overall = "OK"
    for item in results:
        logger.status(item.status, f"{item.name:<12} {item.message}")
        if item.status == "FAIL":
            overall = "FAIL"
        elif item.status == "WARN" and overall != "FAIL":
            overall = "WARN"

    logger.status(overall, f"Overall status: {overall}")
    return overall


def main(args: argparse.Namespace) -> int:
    results: list[StepResult] = [_ensure_env_file()]
    profile = profile_runtime.active_profile(ROOT)
    frontend_enabled = profile.has_feature("frontend")
    backend_enabled = profile.has_feature("backend")

    if args.skip_frontend:
        results.append(StepResult("frontend", "OK", "skipped by flag"))
    elif not frontend_enabled:
        results.append(
            StepResult(
                "frontend", "OK", f"disabled by active profile '{profile.profile_id}'"
            )
        )
    else:
        results.append(_install_frontend())

    if args.skip_backend:
        results.append(StepResult("backend", "OK", "skipped by flag"))
    elif not backend_enabled:
        results.append(
            StepResult(
                "backend", "OK", f"disabled by active profile '{profile.profile_id}'"
            )
        )
    else:
        results.append(_install_backend())

    if getattr(args, "skip_tooling", False):
        results.append(StepResult("tooling", "OK", "skipped by flag"))
    else:
        results.append(_install_tooling_runtime())

    if args.skip_playwright:
        results.append(StepResult("playwright", "OK", "skipped by flag"))
    elif not frontend_enabled:
        results.append(
            StepResult("playwright", "OK", "frontend disabled by active profile")
        )
    elif not _playwright_configured():
        results.append(
            StepResult(
                "playwright", "OK", "not configured; optional browser install skipped"
            )
        )
    else:
        # Only attempt playwright setup if frontend install did not fail hard.
        frontend_failed = any(
            item.name == "frontend" and item.status == "FAIL" for item in results
        )
        if frontend_failed:
            results.append(
                StepResult(
                    "playwright", "WARN", "skipped because frontend install failed"
                )
            )
        else:
            results.append(_install_playwright())

    overall = _print_summary(results)
    return 1 if overall == "FAIL" else 0
