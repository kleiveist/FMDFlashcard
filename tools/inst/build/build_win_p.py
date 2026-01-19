#!/usr/bin/env python3
"""
Windows PORTABLE build runner for the Tauri desktop app.

control.py entry:
  python3 tools/control.py --build-win -p

Behavior:
  - pnpm install
  - pnpm tauri build --bundles none   (skip installer bundling)
  - find the produced .exe in src-tauri/target/release/
  - create a portable zip at: src-tauri/target/release/bundle/portable/<exe>-portable.zip

Env toggles:
  - CLEAN_PORTABLE=0  -> skip cleaning old portable output
  - ALLOW_CROSS=1     -> allow running on non-Windows hosts (may fail)
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path

from console import (
    bundle,
    cleanup,
    err,
    info,
    kv,
    section,
    warn,
    ok,
    cmd as console_cmd,
)


def _repo_root_from_tools_inst_build() -> Path:
    # tools/inst/build/build_win_p.py -> repo root is parents[3] (build -> inst -> tools -> repo)
    return Path(__file__).resolve().parents[3]


def _which_pnpm() -> str:
    exe = shutil.which("pnpm")
    if exe:
        return exe
    if os.name == "nt":
        exe = shutil.which("pnpm.cmd") or shutil.which("pnpm.exe")
        if exe:
            return exe
    raise SystemExit("pnpm not found in PATH. Install pnpm (or enable corepack) and retry.")


def _format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"


def _run(cmd: list[str], cwd: Path, env: dict[str, str], dry_run: bool) -> tuple[int, float]:
    console_cmd(cwd, cmd)
    start = time.perf_counter()
    if dry_run:
        warn("Dry run: command not executed.")
        return 0, time.perf_counter() - start
    process = subprocess.Popen(cmd, cwd=str(cwd), env=env)
    rc = process.wait()
    return rc, time.perf_counter() - start


def _confirm_allow_cross() -> bool:
    if not sys.stdin.isatty():
        err("Nicht-interaktives Terminal: setze ALLOW_CROSS=1, um fortzufahren.")
        return False
    while True:
        try:
            answer = input("Nicht-Windows Host erkannt. ALLOW_CROSS=1 setzen und weiterbauen? (j/n) ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print()
            return False
        if answer in {"j", "ja", "y", "yes"}:
            return True
        if answer in {"n", "nein", "no"}:
            return False
        warn("Bitte mit j/n antworten.")


def _clean_old_portable(app_dir: Path, dry_run: bool) -> float:
    portable_dir = app_dir / "src-tauri" / "target" / "release" / "bundle" / "portable"
    start = time.perf_counter()
    if portable_dir.exists():
        cleanup(f"Cleaning old portable output: {portable_dir}")
        if not dry_run:
            shutil.rmtree(portable_dir, ignore_errors=True)
    else:
        info(f"No old portable output found at: {portable_dir}")
    return time.perf_counter() - start


def _find_portable_exe(release_dir: Path) -> Path | None:
    """
    Try to pick the primary app .exe from src-tauri/target/release.
    Excludes common installer/uninstaller patterns.
    If multiple candidates exist, picks newest by mtime.
    """
    if not release_dir.exists():
        return None

    candidates: list[Path] = []
    for p in sorted(release_dir.glob("*.exe")):
        name = p.name.lower()
        if name.endswith("-setup.exe") or name.endswith("setup.exe"):
            continue
        if "uninstall" in name:
            continue
        candidates.append(p)

    if not candidates:
        return None
    return max(candidates, key=lambda x: x.stat().st_mtime)


def run_install(dry_run: bool = False) -> int:
    repo_root = _repo_root_from_tools_inst_build()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    allow_cross_env = os.environ.get("ALLOW_CROSS", "0")
    allow_cross_enabled = allow_cross_env.lower() in ("1", "true", "yes")
    if platform.system().lower() != "windows":
        if not allow_cross_enabled:
            if not _confirm_allow_cross():
                err("Windows build requires a Windows host (set ALLOW_CROSS=1 to override).")
                return 1
            allow_cross_enabled = True
            allow_cross_env = "1"
            os.environ["ALLOW_CROSS"] = "1"
        if allow_cross_enabled:
            warn("ALLOW_CROSS=1 -> running Windows build on a non-Windows host (may fail).")

    pnpm = _which_pnpm()
    env = os.environ.copy()

    clean_portable_env = os.environ.get("CLEAN_PORTABLE")
    clean_portable_value = clean_portable_env if clean_portable_env is not None else "1"
    clean_portable_enabled = clean_portable_value.lower() not in ("0", "false", "no")

    release_dir = app_dir / "src-tauri" / "target" / "release"
    portable_dir = release_dir / "bundle" / "portable"

    section("Run Context")
    info(f"Repo root: {repo_root}")
    info(f"App dir:   {app_dir}")

    section("Settings")
    kv("PORTABLE", "1 (no installer bundling)")
    kv("ALLOW_CROSS", f"{allow_cross_env} ({'allow' if allow_cross_enabled else 'strict'})")
    kv("CLEAN_PORTABLE", f"{clean_portable_value} ({'cleanup' if clean_portable_enabled else 'skip'})")
    if dry_run:
        warn("Dry run mode enabled: commands will not execute.")

    step_times: dict[str, float] = {}
    overall_start = time.perf_counter()

    if clean_portable_enabled:
        section("Portable Cleanup")
        step_times["cleanup"] = _clean_old_portable(app_dir, dry_run)

    section("Install")
    install_rc, install_time = _run([pnpm, "install"], cwd=app_dir, env=env, dry_run=dry_run)
    step_times["install"] = install_time
    if install_rc != 0:
        err("pnpm install failed.")
        return install_rc

    section("Tauri Build (portable)")
    # Skip bundling installers; only produce the main binary.
    build_cmd = [pnpm, "tauri", "build", "--bundles", "none"]
    build_rc, build_time = _run(build_cmd, cwd=app_dir, env=env, dry_run=dry_run)
    step_times["build"] = build_time
    if build_rc != 0:
        err("pnpm tauri build failed.")
        return build_rc

    if dry_run:
        section("Result")
        ok("Dry run completed (no artifacts were produced).")
        return 0

    section("Package Portable ZIP")
    exe = _find_portable_exe(release_dir)
    if not exe:
        err(f"No portable .exe found in: {release_dir}")
        err("Expected the app binary in src-tauri/target/release after a successful build.")
        return 1

    portable_dir.mkdir(parents=True, exist_ok=True)
    zip_path = portable_dir / f"{exe.stem}-portable.zip"

    readme = (
        "PORTABLE BUILD\n\n"
        f"- Run: {exe.name}\n"
        "- This ZIP is provided without an installer.\n"
        "- Depending on the target machine, Microsoft Edge WebView2 Runtime may be required.\n"
    )

    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe, arcname=exe.name)
        zf.writestr("README_PORTABLE.txt", readme)

    total_time = time.perf_counter() - overall_start

    section("Result")
    ok("Windows portable build completed.")
    kv("Install time", _format_duration(step_times.get("install", 0.0)))
    kv("Build time", _format_duration(step_times.get("build", 0.0)))
    if "cleanup" in step_times:
        kv("Cleanup time", _format_duration(step_times["cleanup"]))
    kv("Total time", _format_duration(total_time))

    bundle(f"exe: {exe}")
    bundle(f"zip: {zip_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
