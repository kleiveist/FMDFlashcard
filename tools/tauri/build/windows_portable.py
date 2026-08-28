from __future__ import annotations

import argparse
import os
import shutil
import stat
import subprocess
import zipfile
from pathlib import Path

from tools import logger
from tools.tauri import common, paths

WINDOWS_TARGET = "x86_64-pc-windows-msvc"


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    host = common.host_os()
    if host not in {"windows", "linux"}:
        logger.fail("Windows portable build requires a Windows or Linux host.")
        return 1

    build_env: dict[str, str] | None = None
    runner: str | None = None
    if host == "linux":
        code, runner, build_env = _ensure_cargo_xwin(dry_run=dry_run)
        if code != 0:
            return code

    command = _build_command(host, runner=runner)
    common.print_build_plan(
        "windows-portable", command, dry_run=dry_run, bundles="disabled"
    )
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run, env=build_env)
    code = common.print_result(
        result,
        "Windows portable Tauri build completed",
        "Windows portable Tauri build failed",
    )
    if code != 0:
        return code
    code = _zip_portable_binary(dry_run=dry_run)
    if code == 0 and dry_run:
        logger.info("📁 Dry-run finished; no new artifacts were created.")
    elif code == 0:
        common.print_build_artifacts()
    return code


def _ensure_cargo_xwin(*, dry_run: bool) -> tuple[int, str, dict[str, str]]:
    env = _env_with_cargo_bin()
    cargo_xwin = _find_cargo_xwin(env)
    if cargo_xwin is not None:
        logger.ok("cargo-xwin found")
        code = _ensure_windows_resource_compiler(env, dry_run=dry_run)
        return code, cargo_xwin, env

    cargo = shutil.which("cargo", path=env.get("PATH")) or (
        "cargo" if dry_run else None
    )
    if cargo is None:
        logger.fail(
            "cargo not found. Action: install Rust before building Windows portable on Linux."
        )
        return 1, "cargo-xwin", env

    logger.info("cargo-xwin not found; installing it for the Windows portable build.")
    result = common.run_command(
        [cargo, "install", "cargo-xwin"], dry_run=dry_run, env=env
    )
    code = common.print_result(result, "cargo-xwin ready", "cargo-xwin install failed")
    if code != 0:
        return code, "cargo-xwin", env

    if dry_run:
        code = _ensure_windows_resource_compiler(env, dry_run=dry_run)
        return code, str(_cargo_xwin_path()), env

    cargo_xwin = _find_cargo_xwin(env)
    if cargo_xwin is None:
        logger.fail(
            f"cargo-xwin install completed, but cargo-xwin was not found at {_cargo_xwin_path()}."
        )
        return 1, "cargo-xwin", env
    code = _ensure_windows_resource_compiler(env, dry_run=dry_run)
    return code, cargo_xwin, env


def _ensure_windows_resource_compiler(env: dict[str, str], *, dry_run: bool) -> int:
    configured_rc = _configured_resource_compiler(env)
    if configured_rc is not None:
        logger.ok(f"Windows resource compiler configured via {configured_rc}")
        return 0

    if _find_llvm_rc(env) is not None:
        logger.ok("llvm-rc found")
        return 0

    rustup = shutil.which("rustup", path=env.get("PATH")) or (
        "rustup" if dry_run else None
    )
    if rustup is None:
        logger.fail(
            "llvm-rc not found. Action: install the Rust llvm-tools-preview component "
            "or put llvm-rc on PATH before building Windows portable on Linux."
        )
        return 1

    logger.info(
        "llvm-rc not found; installing Rust llvm-tools-preview for Windows resource compilation."
    )
    result = common.run_command(
        [rustup, "component", "add", "llvm-tools-preview"], dry_run=dry_run, env=env
    )
    code = common.print_result(
        result, "llvm-tools-preview ready", "llvm-tools-preview install failed"
    )
    if code != 0 or dry_run:
        return code

    if _find_llvm_rc(env) is None:
        logger.fail(
            "llvm-rc not found after installing llvm-tools-preview. "
            "Action: install an LLVM/Clang package that provides llvm-rc, or set RC to a compatible resource compiler."
        )
        return 1
    logger.ok("llvm-rc ready")
    return 0


def _configured_resource_compiler(env: dict[str, str]) -> str | None:
    for name in (
        f"RC_{WINDOWS_TARGET}",
        f"RC_{WINDOWS_TARGET.replace('-', '_')}",
        "RC",
    ):
        if env.get(name):
            return name
    return None


def _find_llvm_rc(env: dict[str, str]) -> str | None:
    _prepend_rust_llvm_tools_dir(env)
    return shutil.which("llvm-rc", path=env.get("PATH"))


def _prepend_rust_llvm_tools_dir(env: dict[str, str]) -> None:
    rustc = shutil.which("rustc", path=env.get("PATH"))
    if rustc is None:
        return
    try:
        completed = subprocess.run(
            [rustc, "--print", "sysroot"],
            capture_output=True,
            text=True,
            check=False,
            env=env,
        )
    except OSError:
        return
    if completed.returncode != 0:
        return
    sysroot = Path((completed.stdout or "").strip())
    if not sysroot.exists():
        return
    for tools_dir in sorted((sysroot / "lib" / "rustlib").glob("*/bin")):
        if (tools_dir / "llvm-rc").exists():
            _prepend_path(env, tools_dir)
            return


def _prepend_path(env: dict[str, str], directory: Path) -> None:
    path = env.get("PATH", "")
    directory_string = str(directory)
    parts = path.split(os.pathsep) if path else []
    if directory_string not in parts:
        env["PATH"] = os.pathsep.join([directory_string, *parts])


def _env_with_cargo_bin() -> dict[str, str]:
    env = os.environ.copy()
    cargo_bin = str(_cargo_bin_dir())
    env["PATH"] = f"{cargo_bin}{os.pathsep}{env.get('PATH', '')}"
    return env


def _find_cargo_xwin(env: dict[str, str]) -> str | None:
    return shutil.which("cargo-xwin", path=env.get("PATH"))


def _cargo_xwin_path() -> Path:
    suffix = ".exe" if os.name == "nt" else ""
    return _cargo_bin_dir() / f"cargo-xwin{suffix}"


def _cargo_bin_dir() -> Path:
    root = os.environ.get("CARGO_INSTALL_ROOT") or os.environ.get("CARGO_HOME")
    return (Path(root) if root else Path.home() / ".cargo") / "bin"


def _build_command(host: str, *, runner: str | None = None) -> list[str]:
    if host == "linux":
        return common.tauri_cli_command(
            "build",
            "--runner",
            runner or "cargo-xwin",
            "--target",
            WINDOWS_TARGET,
            "--no-bundle",
        )
    return common.tauri_cli_command("build", "--target", WINDOWS_TARGET, "--no-bundle")


def _zip_portable_binary(*, dry_run: bool) -> int:
    release_dir = paths.TAURI_DIR / "target" / WINDOWS_TARGET / "release"
    zip_path = paths.DIST_DIR / f"{paths.app_name()}-windows-portable.zip"

    if dry_run:
        logger.info(f"DRY-RUN create portable ZIP {zip_path}")
        return 0

    candidates = _portable_exe_candidates(release_dir)
    if not candidates:
        logger.fail(f"No Windows executable found in {release_dir}")
        return 1

    if not _ensure_portable_output_path(zip_path):
        return 1
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for candidate in candidates:
            archive.write(candidate, arcname=candidate.name)
        archive.writestr(
            "README_PORTABLE.txt",
            "PORTABLE BUILD\n\n"
            f"- Run: {candidates[0].name}\n"
            "- This ZIP is provided without an installer.\n"
            "- Depending on the target machine, Microsoft Edge WebView2 Runtime may be required.\n",
        )
    logger.ok(f"Windows portable ZIP created at {zip_path.relative_to(paths.ROOT)}")
    return 0


def _ensure_portable_output_path(zip_path: Path) -> bool:
    try:
        zip_path.parent.mkdir(parents=True, exist_ok=True)
        _ensure_user_permissions(
            zip_path.parent, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR
        )
        if zip_path.exists():
            _ensure_user_permissions(zip_path, stat.S_IRUSR | stat.S_IWUSR)
    except OSError as exc:
        logger.fail(f"Cannot prepare portable ZIP output path {zip_path}: {exc}")
        return False
    if not os.access(zip_path.parent, os.R_OK | os.W_OK | os.X_OK):
        logger.fail(f"Portable ZIP output directory is not writable: {zip_path.parent}")
        return False
    return True


def _ensure_user_permissions(path: Path, permission_bits: int) -> None:
    current_mode = path.stat().st_mode
    next_mode = current_mode | permission_bits
    if next_mode != current_mode:
        path.chmod(next_mode)


def _portable_exe_candidates(release_dir: Path) -> list[Path]:
    candidates: list[Path] = []
    for candidate in sorted(
        path for path in release_dir.glob("*.exe") if path.is_file()
    ):
        name = candidate.name.lower()
        if name.endswith(("-setup.exe", "setup.exe")):
            continue
        if "uninstall" in name:
            continue
        candidates.append(candidate)
    return candidates
