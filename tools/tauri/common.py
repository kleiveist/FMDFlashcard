from __future__ import annotations

import os
import platform
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from tools import logger
from tools.config import is_server_only_name
from tools.process import prepare_command
from tools.tauri import paths

TAURI_CLI_PACKAGE = "@tauri-apps/cli@2.10.1"


@dataclass(slots=True)
class CommandResult:
    command: list[str]
    cwd: Path
    returncode: int
    stdout: str = ""
    stderr: str = ""
    dry_run: bool = False


@dataclass(slots=True)
class CheckResult:
    name: str
    status: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"name": self.name, "status": self.status, "message": self.message}


def status_priority(status: str) -> int:
    return {"OK": 0, "INFO": 0, "WARN": 1, "FAIL": 2}.get(status.upper(), 2)


def overall_status(checks: Iterable[CheckResult]) -> str:
    overall = "OK"
    for item in checks:
        if status_priority(item.status) > status_priority(overall):
            overall = item.status
    return overall


def command_to_string(command: list[str]) -> str:
    return " ".join(_quote(part) for part in command)


def print_build_plan(
    target: str,
    command: list[str],
    *,
    dry_run: bool = False,
    bundles: str | None = None,
) -> None:
    mode = "dry-run" if dry_run else "build"
    logger.info(f"🧱 Build target: {target} ({mode})")
    if bundles:
        logger.info(f"📦 Bundles: {bundles}")
    logger.info(f"🛠️ Command: {command_to_string(command)}")
    logger.info(f"📁 Working directory: {paths.ROOT}")


def find_build_artifacts(*, include_dist: bool = True) -> list[Path]:
    artifacts: list[Path] = []
    roots = paths.bundle_roots()
    if include_dist:
        roots = [*roots, paths.DIST_DIR]
    for root in roots:
        if not root.exists():
            continue
        for item in root.rglob("*"):
            if item.is_file() and item.suffix.lower() in {".appimage", ".deb", ".rpm", ".dmg", ".msi", ".exe", ".zip"}:
                artifacts.append(item)
            elif item.is_dir() and item.suffix.lower() == ".app":
                artifacts.append(item)
    return sorted(set(artifacts))


def print_build_artifacts() -> None:
    artifacts = find_build_artifacts()
    if not artifacts:
        logger.warn("📁 No Tauri build artifacts found")
        return

    logger.info("📁 Build artifacts:")
    for artifact in artifacts:
        relative = artifact.relative_to(paths.ROOT).as_posix()
        logger.info(f"{_artifact_icon(artifact)} {relative} ({_format_size(artifact)})")


def run_command(
    command: list[str],
    *,
    cwd: Path | None = None,
    dry_run: bool = False,
    env: dict[str, str] | None = None,
    remove_env: set[str] | None = None,
) -> CommandResult:
    resolved_cwd = cwd or paths.ROOT
    if dry_run:
        logger.info(f"DRY-RUN {command_to_string(command)} (cwd={resolved_cwd})")
        return CommandResult(command=command, cwd=resolved_cwd, returncode=0, dry_run=True)

    try:
        environment = {name: value for name, value in os.environ.items() if not is_server_only_name(name)}
        for name in remove_env or set():
            environment.pop(name, None)
        environment.update(env or {})
        completed = subprocess.run(
            prepare_command(command),
            cwd=resolved_cwd,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as exc:
        return CommandResult(command=command, cwd=resolved_cwd, returncode=127, stderr=str(exc))
    return CommandResult(
        command=command,
        cwd=resolved_cwd,
        returncode=completed.returncode,
        stdout=completed.stdout or "",
        stderr=completed.stderr or "",
    )


def command_output(command: list[str], *, cwd: Path | None = None) -> tuple[bool, str]:
    try:
        completed = subprocess.run(prepare_command(command), cwd=cwd, capture_output=True, text=True, check=False)
    except OSError as exc:
        return False, str(exc)
    output = (completed.stdout or completed.stderr or "").strip()
    if completed.returncode == 0:
        return True, output.splitlines()[0] if output else "available"
    return False, output or f"exit code {completed.returncode}"


def package_manager() -> str:
    if paths.FRONTEND_PNPM_LOCK.exists() and shutil.which("pnpm"):
        return "pnpm"
    return "npm"


def package_manager_install_command() -> list[str]:
    selected = package_manager()
    if selected == "pnpm":
        pnpm = shutil.which("pnpm") or "pnpm"
        return [pnpm, "install"]
    npm = shutil.which("npm") or "npm"
    action = "ci" if paths.FRONTEND_PACKAGE_LOCK.exists() else "install"
    return [npm, action, "--no-audit", "--no-fund"]


def missing_frontend_dependency_paths() -> list[Path]:
    required = [
        paths.FRONTEND_DIR / "node_modules" / "typescript",
        paths.FRONTEND_DIR / "node_modules" / "vite",
    ]
    return [path for path in required if not path.exists()]


def frontend_dependencies_ready() -> bool:
    return not missing_frontend_dependency_paths()


def tauri_cli_command(*args: str) -> list[str]:
    local_binary = paths.local_tauri_binary()
    if local_binary.exists():
        return [str(local_binary), *args]

    selected = package_manager()
    if selected == "pnpm":
        pnpm = shutil.which("pnpm") or "pnpm"
        return [pnpm, "dlx", TAURI_CLI_PACKAGE, *args]

    npm = shutil.which("npm") or "npm"
    return [npm, "exec", "--yes", "--package", TAURI_CLI_PACKAGE, "--", "tauri", *args]


def host_os() -> str:
    return platform.system().lower()


def print_result(result: CommandResult, success_message: str, failure_message: str) -> int:
    if result.returncode == 0:
        logger.ok(success_message)
        return 0

    details = tail(result.stdout + "\n" + result.stderr)
    logger.fail(f"{failure_message}: {details}")
    return result.returncode


def tail(text: str, *, limit: int = 8) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return "(no output)"
    return " | ".join(lines[-limit:])


def ensure_directory(path: Path, *, dry_run: bool = False) -> None:
    if dry_run:
        logger.info(f"DRY-RUN mkdir -p {path}")
        return
    path.mkdir(parents=True, exist_ok=True)


def _quote(part: str) -> str:
    if not part:
        return "''"
    if any(char.isspace() for char in part):
        return f"'{part}'"
    return part


def _artifact_icon(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".deb", ".rpm"}:
        return "📦"
    if suffix == ".appimage":
        return "🧩"
    if suffix == ".dmg":
        return "💿"
    if suffix in {".msi", ".exe"}:
        return "🪟"
    if suffix == ".zip":
        return "🗜️"
    if suffix == ".app":
        return "🍎"
    return "📄"


def _format_size(path: Path) -> str:
    if path.is_dir():
        size = sum(item.stat().st_size for item in path.rglob("*") if item.is_file())
    else:
        size = path.stat().st_size

    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(value)} {unit}"
            return f"{value:.1f} {unit}"
        value /= 1024
