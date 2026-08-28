from __future__ import annotations

import argparse
import shlex
import shutil
import subprocess
import time
import zipfile
from pathlib import Path

from tools import logger
from tools.core.context import ProjectContext, load_context
from tools.process import prepare_command
from tools.profiles import runtime as profile_runtime

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve build paths from the current target project."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


def _build_paths() -> tuple[Path, Path, Path]:
    context = _context()
    dist_dir = context.paths.frontend / "dist"
    artifact_dir = context.project_root / ".dist" / "web"
    return dist_dir, artifact_dir, artifact_dir / "web-build.zip"


def _run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        prepare_command(cmd), cwd=cwd, text=True, capture_output=True, check=False
    )


def _tail_lines(text: str, limit: int = 12) -> list[str]:
    lines = [line for line in text.splitlines() if line.strip()]
    return lines[-limit:]


def _print_tail(label: str, text: str) -> None:
    lines = _tail_lines(text)
    if not lines:
        return
    logger.info(f"  {label}:")
    for line in lines:
        print(f"    {line}")


def _relative(path: Path) -> str:
    return path.relative_to(_context().project_root).as_posix()


def _create_web_zip() -> tuple[bool, str]:
    dist_dir, artifact_dir, zip_path = _build_paths()
    files = sorted(path for path in dist_dir.rglob("*") if path.is_file())
    if not files:
        return False, "frontend/dist contains no files to package"

    artifact_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(dist_dir).as_posix())

    return True, _relative(zip_path)


def main(args: argparse.Namespace) -> int:
    _ = args
    context = _context()
    frontend_dir = context.paths.frontend
    dist_dir, _, _ = _build_paths()
    if not profile_runtime.feature_enabled("frontend", ROOT):
        profile = profile_runtime.active_profile(ROOT)
        logger.fail(f"Web build is disabled by active profile '{profile.profile_id}'.")
        return 1

    package_json = frontend_dir / "package.json"
    if not package_json.exists():
        logger.fail("frontend/package.json missing; cannot run web build")
        return 1

    npm = shutil.which("npm")
    if npm is None:
        logger.fail("npm not found. Action: install Node.js and npm.")
        return 1

    command = [npm, "run", "build"]
    logger.info("Building frontend web release")
    logger.info(f"  command: {shlex.join(command)}")
    logger.info(f"  cwd: {frontend_dir}")

    started = time.monotonic()
    completed = _run(command, cwd=frontend_dir)
    elapsed = time.monotonic() - started
    if completed.returncode != 0:
        logger.fail(f"Web build failed ({elapsed:.2f}s)")
        logger.info(f"  exit code: {completed.returncode}")
        _print_tail("stdout tail", completed.stdout or "")
        _print_tail("stderr tail", completed.stderr or "")
        return 1

    if not dist_dir.exists():
        logger.fail("Web build completed but frontend/dist was not created")
        logger.info(f"  exit code: {completed.returncode}")
        _print_tail("stdout tail", completed.stdout or "")
        _print_tail("stderr tail", completed.stderr or "")
        return 1

    zip_ok, zip_message = _create_web_zip()
    if not zip_ok:
        logger.fail(
            f"Web build completed but release ZIP was not created: {zip_message}"
        )
        return 1

    logger.ok(f"Web build completed ({elapsed:.2f}s)")
    logger.ok(f"web artifact: {_relative(dist_dir)}")
    logger.ok(f"github release zip: {zip_message}")
    return 0
