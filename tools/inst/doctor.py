from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from tools import logger
from tools.config import ConfigLoadError, resolve_configuration, validate_configuration
from tools.core.context import ProjectContext, load_context
from tools.inst import configuration, container
from tools.inst.tooling_runtime import TOOLING_RUNTIME_PROBE
from tools.process import prepare_command
from tools.profiles import runtime as profile_runtime

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve configured target paths for the current project root."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


@dataclass(slots=True)
class CheckResult:
    name: str
    status: str
    message: str


def _status_priority(status: str) -> int:
    order = {"OK": 0, "WARN": 1, "FAIL": 2}
    return order.get(status, 2)


def _command_version(command: list[str], cwd: Path | None = None) -> tuple[bool, str]:
    try:
        completed = subprocess.run(
            prepare_command(command),
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        return False, str(exc)

    output = (completed.stdout or completed.stderr).strip()
    if completed.returncode == 0:
        return True, output.splitlines()[0] if output else "available"
    return False, output or f"exit code {completed.returncode}"


def _check_binary(name: str, help_text: str, version_cmd: list[str]) -> CheckResult:
    binary = shutil.which(name)
    if binary is None:
        return CheckResult(
            name=name,
            status="FAIL",
            message=f"not found. Action: install {help_text}.",
        )
    ok, version = _command_version(version_cmd)
    if not ok:
        return CheckResult(
            name=name,
            status="WARN",
            message=f"found at {binary}, version check failed: {version}",
        )
    return CheckResult(name=name, status="OK", message=f"{binary} ({version})")


def _check_optional_binary(
    name: str, help_text: str, version_cmd: list[str]
) -> CheckResult:
    binary = shutil.which(name)
    if binary is None:
        return CheckResult(
            name=name,
            status="OK",
            message=f"not found; optional. Install {help_text} if desired.",
        )
    ok, version = _command_version(version_cmd)
    if not ok:
        return CheckResult(
            name=name,
            status="WARN",
            message=f"found at {binary}, version check failed: {version}",
        )
    return CheckResult(name=name, status="OK", message=f"{binary} ({version})")


def _check_current_python() -> CheckResult:
    ok, version = _command_version([sys.executable, "--version"])
    if not ok:
        return CheckResult(
            "python", "FAIL", f"current interpreter is not executable: {version}"
        )
    return CheckResult("python", "OK", f"{sys.executable} ({version})")


def _backend_python() -> Path:
    context = _context()
    backend_dir = context.paths.backend
    if backend_dir is None:
        return context.state_root / "unconfigured-backend" / "python"
    candidates = [
        backend_dir / ".venv" / "Scripts" / "python.exe",
        backend_dir / ".venv" / "bin" / "python",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0] if sys.platform == "win32" else candidates[1]


def _tooling_python() -> Path:
    tooling_venv = _context().venv_root
    candidates = [
        tooling_venv / "Scripts" / "python.exe",
        tooling_venv / "bin" / "python",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0] if sys.platform == "win32" else candidates[1]


def _port_is_occupied(host: str, port: int) -> bool:
    try:
        addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError:
        return False
    for family, socktype, protocol, _, address in addresses:
        with socket.socket(family, socktype, protocol) as sock:
            sock.settimeout(0.3)
            if sock.connect_ex(address) == 0:
                return True
    return False


def _check_port(host: str, port: int) -> CheckResult:
    occupied = _port_is_occupied(host, port)
    if occupied:
        return CheckResult(
            name=f"port:{port}",
            status="WARN",
            message=f"occupied on {host} (may be expected if services are already running)",
        )
    return CheckResult(name=f"port:{port}", status="OK", message=f"free on {host}")


def _check_project_structure() -> list[CheckResult]:
    results: list[CheckResult] = []
    profile = profile_runtime.active_profile(ROOT)
    context = _context()

    frontend = context.paths.frontend
    backend = context.paths.backend
    shared = ROOT / "shared"

    if profile.has_feature("frontend"):
        if frontend.exists() and (frontend / "package.json").exists():
            results.append(
                CheckResult("frontend", "OK", "frontend scaffold is present")
            )
        else:
            results.append(
                CheckResult(
                    "frontend",
                    "FAIL",
                    "frontend scaffold missing (expected frontend/package.json)",
                )
            )

        node_modules = frontend / "node_modules"
        if node_modules.exists():
            results.append(CheckResult("frontend-deps", "OK", "node_modules found"))
        else:
            results.append(
                CheckResult(
                    "frontend-deps", "WARN", "node_modules not found (run install)"
                )
            )
    else:
        results.append(
            CheckResult(
                "frontend", "OK", f"disabled by active profile '{profile.profile_id}'"
            )
        )
        results.append(
            CheckResult(
                "frontend-deps",
                "OK",
                "frontend dependencies not required for this profile",
            )
        )

    if profile.has_feature("backend"):
        if (
            backend is not None
            and backend.exists()
            and (backend / "app" / "main.py").exists()
        ):
            results.append(CheckResult("backend", "OK", "backend scaffold is present"))
        else:
            results.append(
                CheckResult(
                    "backend",
                    "FAIL",
                    "backend scaffold missing (expected backend/app/main.py)",
                )
            )

        backend_venv = backend / ".venv" if backend is not None else None
        if backend_venv is not None and backend_venv.exists():
            results.append(CheckResult("backend-venv", "OK", "backend/.venv found"))
        else:
            fastapi_available = importlib.util.find_spec("fastapi") is not None
            if fastapi_available:
                results.append(
                    CheckResult(
                        "backend-venv",
                        "WARN",
                        "backend/.venv missing, but fastapi is importable globally",
                    )
                )
            else:
                results.append(
                    CheckResult(
                        "backend-venv", "WARN", "backend/.venv missing (run install)"
                    )
                )
    else:
        results.append(
            CheckResult(
                "backend", "OK", f"disabled by active profile '{profile.profile_id}'"
            )
        )
        results.append(
            CheckResult(
                "backend-venv", "OK", "backend virtualenv not required for this profile"
            )
        )

    if shared.exists():
        results.append(CheckResult("shared", "OK", "shared directory is present"))
    else:
        results.append(CheckResult("shared", "WARN", "shared directory missing"))

    return results


def _check_backend_runtime() -> CheckResult:
    profile = profile_runtime.active_profile(ROOT)
    if not profile.has_feature("backend"):
        return CheckResult(
            name="backend-runtime",
            status="OK",
            message=f"disabled by active profile '{profile.profile_id}'",
        )

    backend_python = _backend_python()
    if not backend_python.exists():
        return CheckResult(
            name="backend-runtime",
            status="WARN",
            message="backend venv python missing. Action: run 'python tools/control.py install'.",
        )

    check = subprocess.run(
        [
            str(backend_python),
            "-c",
            "import fastapi, jsonschema, pydantic_settings, pytest, uvicorn; print('runtime-ok')",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if check.returncode == 0:
        return CheckResult(
            name="backend-runtime",
            status="OK",
            message="fastapi/jsonschema/pydantic-settings/pytest/uvicorn importable",
        )

    details = (check.stdout or check.stderr).strip() or f"exit code {check.returncode}"
    return CheckResult(
        name="backend-runtime",
        status="FAIL",
        message=f"dependency import failed. Action: reinstall backend dependencies. Details: {details}",
    )


def _check_tooling_runtime() -> CheckResult:
    tooling_venv = _context().venv_root
    python = _tooling_python()
    if not python.exists():
        return CheckResult(
            "tooling-runtime",
            "WARN",
            f"dedicated tooling Python is missing at {tooling_venv}. Action: run 'python tools/control.py install'.",
        )

    check = subprocess.run(
        [str(python), "-c", TOOLING_RUNTIME_PROBE],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if check.returncode == 0:
        return CheckResult(
            "tooling-runtime",
            "OK",
            f"tooling dependencies and the verified Rust WASI analyzer run via {python}",
        )
    details = (check.stdout or check.stderr).strip() or f"exit code {check.returncode}"
    return CheckResult(
        "tooling-runtime",
        "FAIL",
        f"dedicated tooling runtime is incomplete. Action: run 'python tools/control.py install'. Details: {details}",
    )


def _check_playwright_browser() -> CheckResult:
    profile = profile_runtime.active_profile(ROOT)
    if not profile.has_feature("frontend"):
        return CheckResult(
            name="playwright",
            status="OK",
            message="frontend disabled by active profile",
        )

    frontend_dir = _context().paths.frontend
    if not (frontend_dir / "package.json").exists():
        return CheckResult(
            name="playwright",
            status="WARN",
            message="frontend/package.json missing; check skipped",
        )
    if not _playwright_configured():
        return CheckResult(
            name="playwright",
            status="OK",
            message="not configured; optional check skipped",
        )

    npx = shutil.which("npx")
    if npx is None:
        return CheckResult(
            name="playwright",
            status="WARN",
            message="npx not found. Action: install Node.js/npm and rerun install.",
        )

    version_ok, version = _command_version(
        [npx, "playwright", "--version"], cwd=frontend_dir
    )
    if not version_ok:
        return CheckResult(
            name="playwright",
            status="WARN",
            message="playwright cli unavailable. Action: run 'python tools/control.py install'.",
        )

    browser_cache = Path.home() / ".cache" / "ms-playwright"
    chromium_dirs = [path for path in browser_cache.glob("chromium-*") if path.is_dir()]
    if chromium_dirs:
        return CheckResult(
            name="playwright",
            status="OK",
            message=f"{version}; chromium browser cache present",
        )

    return CheckResult(
        name="playwright",
        status="WARN",
        message=f"{version}; chromium browser missing. Action: run 'python tools/control.py install'.",
    )


def _playwright_configured() -> bool:
    frontend_dir = _context().paths.frontend
    if (frontend_dir / "tests" / "e2e").exists() or any(
        frontend_dir.glob("playwright.config.*")
    ):
        return True
    try:
        payload = json.loads(
            (frontend_dir / "package.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError):
        return False
    dependencies = {
        **payload.get("dependencies", {}),
        **payload.get("devDependencies", {}),
    }
    return "@playwright/test" in dependencies or "playwright" in dependencies


def run_checks() -> tuple[list[CheckResult], str]:
    profile = profile_runtime.active_profile(ROOT)
    checks: list[CheckResult] = [
        _check_current_python(),
        _check_binary("node", "Node.js (includes npm)", ["node", "--version"]),
        _check_binary("npm", "npm", ["npm", "--version"]),
        _check_binary("npx", "npm (includes npx)", ["npx", "--version"]),
        _check_optional_binary(
            "uv", "uv for faster Python installs", ["uv", "--version"]
        ),
        CheckResult(
            "project-profile", "OK", f"active profile '{profile.profile_id}' loaded"
        ),
    ]
    checks.extend(
        CheckResult(item.name, item.status, item.message)
        for item in configuration.collect_checks()
    )
    try:
        resolved = resolve_configuration(profile, project_root=ROOT)
    except ConfigLoadError:
        resolved = None
    if resolved is not None:
        invalid_names = {issue.name for issue in validate_configuration(resolved)}
        if profile.has_feature("frontend") and not {
            "FRONTEND_HOST",
            "FRONTEND_PORT",
        }.intersection(invalid_names):
            frontend_host = resolved.value("FRONTEND_HOST")
            frontend_port = resolved.value("FRONTEND_PORT")
            assert frontend_host is not None and frontend_port is not None
            checks.append(_check_port(frontend_host, int(frontend_port)))
        if profile.has_feature("backend") and not {
            "BACKEND_HOST",
            "BACKEND_PORT",
        }.intersection(invalid_names):
            backend_host = resolved.value("BACKEND_HOST")
            backend_port = resolved.value("BACKEND_PORT")
            assert backend_host is not None and backend_port is not None
            checks.append(_check_port(backend_host, int(backend_port)))
    checks.extend(_check_project_structure())
    checks.append(_check_backend_runtime())
    checks.append(_check_tooling_runtime())
    checks.append(_check_playwright_browser())
    if profile.has_feature("cloud"):
        checks.extend(
            CheckResult(item.name, item.status, item.message)
            for item in container.collect_checks(
                validate_compose=True, require_docker=False
            )
        )

    overall = "OK"
    for item in checks:
        if _status_priority(item.status) > _status_priority(overall):
            overall = item.status
    return checks, overall


def _print_report(
    checks: list[CheckResult], overall: str, previous: dict[str, str] | None = None
) -> None:
    timestamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"Doctor report at {timestamp}")
    for item in checks:
        logger.status(item.status, f"{item.name:<14} {item.message}")

    if previous is not None:
        changed = [
            f"{item.name}: {previous[item.name]} -> {item.status}"
            for item in checks
            if previous.get(item.name) != item.status
        ]
        if changed:
            logger.info("Changes since previous run:")
            for line in changed:
                logger.info(f"- {line}")

    logger.status(overall, f"Overall status: {overall}")


def main(args: argparse.Namespace) -> int:
    interval = max(1, int(args.interval))

    if not args.watch:
        checks, overall = run_checks()
        _print_report(checks, overall)
        return 1 if overall == "FAIL" else 0

    previous_map: dict[str, str] | None = None
    logger.info(
        f"Doctor watch mode enabled (interval={interval}s). Press Ctrl+C to stop."
    )

    try:
        while True:
            checks, overall = run_checks()
            _print_report(checks, overall, previous_map)
            previous_map = {item.name: item.status for item in checks}
            time.sleep(interval)
    except KeyboardInterrupt:
        logger.info("Watch stopped by user")
        return 0
