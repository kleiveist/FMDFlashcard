#!/usr/bin/env python3
"""Linux-only: cross-compile Windows Tauri build using cargo-xwin.

control.py entry:
  python3 tools/control.py --winlinux --build

Default behavior:
  - pnpm install
  - pnpm tauri build --runner cargo-xwin --target <WIN_LINUX_TARGET> --no-bundle
  - package a portable zip from the produced .exe

Env toggles:
  - WIN_LINUX_TARGET (default: x86_64-pc-windows-msvc)
  - WIN_LINUX_RUNNER (default: cargo-xwin)
  - WIN_LINUX_BUNDLES (if set, uses --bundles instead of --no-bundle)
  - WIN_LINUX_ZIP=0  -> skip portable zip
  - CLEAN_PORTABLE=0 -> skip cleanup of old portable output
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import time
import zipfile
from pathlib import Path

from console import (
    bundle,
    cleanup,
    err,
    info,
    kv,
    ok,
    section,
    warn,
    cmd as console_cmd,
)


def _repo_root_from_tools_inst_win() -> Path:
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


def _clean_old_portable(portable_dir: Path, dry_run: bool) -> float:
    start = time.perf_counter()
    if portable_dir.exists():
        cleanup(f"Cleaning old portable output: {portable_dir}")
        if not dry_run:
            shutil.rmtree(portable_dir, ignore_errors=True)
    else:
        info(f"No old portable output found at: {portable_dir}")
    return time.perf_counter() - start


def _find_portable_exe(release_dir: Path) -> Path | None:
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


def _sanitize_bundles(bundles_env: str) -> str:
    raw = bundles_env.strip()
    if not raw:
        return ""
    if raw.lower() in {"none", "no", "false", "0"}:
        return ""
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    return ",".join(parts)


def run_install(dry_run: bool = False) -> int:
    if platform.system().lower() != "linux":
        err("Windows cross-compile is Linux-only in this script.")
        return 2

    repo_root = _repo_root_from_tools_inst_win()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    using_legacy = False
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
        using_legacy = True
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    pnpm = _which_pnpm()
    runner = os.environ.get("WIN_LINUX_RUNNER", "cargo-xwin")
    target = os.environ.get("WIN_LINUX_TARGET", "x86_64-pc-windows-msvc")
    bundles = _sanitize_bundles(os.environ.get("WIN_LINUX_BUNDLES", ""))

    clean_portable_env = os.environ.get("CLEAN_PORTABLE")
    clean_portable_value = clean_portable_env if clean_portable_env is not None else "1"
    clean_portable_enabled = clean_portable_value.lower() not in ("0", "false", "no")

    zip_env = os.environ.get("WIN_LINUX_ZIP")
    zip_enabled = zip_env is None or zip_env.lower() not in ("0", "false", "no")

    if shutil.which("cargo") is None:
        err("cargo not found in PATH. Install Rust (rustup) and retry.")
        return 1
    if shutil.which(runner) is None:
        err(f"{runner} not found in PATH.")
        info("Install with: cargo install --locked cargo-xwin")
        return 1

    env = os.environ.copy()
    release_dir = app_dir / "src-tauri" / "target" / target / "release"
    portable_dir = release_dir / "bundle" / "portable"

    section("Run Context")
    info(f"Repo root: {repo_root}")
    info(f"App dir:   {app_dir}")
    if using_legacy:
        warn("Using legacy path: consider migrating to /apps/fmd-desktop")

    section("Settings")
    kv("WIN_LINUX_TARGET", target)
    kv("WIN_LINUX_RUNNER", runner)
    kv("WIN_LINUX_BUNDLES", bundles or "(none)")
    kv(
        "CLEAN_PORTABLE",
        f"{clean_portable_value} ({'cleanup' if clean_portable_enabled else 'skip'})",
    )
    kv("WIN_LINUX_ZIP", f"{'enabled' if zip_enabled else 'disabled'}")
    if dry_run:
        warn("Dry run mode enabled: commands will not execute.")

    step_times: dict[str, float] = {}
    overall_start = time.perf_counter()

    if clean_portable_enabled and zip_enabled:
        section("Portable Cleanup")
        step_times["cleanup"] = _clean_old_portable(portable_dir, dry_run)

    section("Install")
    install_rc, install_time = _run([pnpm, "install"], cwd=app_dir, env=env, dry_run=dry_run)
    step_times["install"] = install_time
    if install_rc != 0:
        err("pnpm install failed.")
        return install_rc

    section("Tauri Build (Windows cross)")
    build_cmd = [
        pnpm,
        "tauri",
        "build",
        "--runner",
        runner,
        "--target",
        target,
    ]
    if bundles:
        build_cmd.extend(["--bundles", bundles])
    else:
        build_cmd.append("--no-bundle")
    build_rc, build_time = _run(build_cmd, cwd=app_dir, env=env, dry_run=dry_run)
    step_times["build"] = build_time
    if build_rc != 0:
        err("pnpm tauri build failed.")
        return build_rc

    if dry_run:
        section("Result")
        ok("Dry run completed (no artifacts were produced).")
        return 0

    exe = _find_portable_exe(release_dir)
    if not exe:
        err(f"No portable .exe found in: {release_dir}")
        err("Expected the app binary in src-tauri/target/<target>/release after a successful build.")
        return 1

    zip_path = None
    if zip_enabled:
        section("Package Portable ZIP")
        portable_dir.mkdir(parents=True, exist_ok=True)
        zip_path = portable_dir / f"{exe.stem}-portable.zip"
        readme = (
            "PORTABLE BUILD\n\n"
            f"- Run: {exe.name}\n"
            "- This ZIP is provided without an installer.\n"
            "- WebView2 Runtime may be required on target machines.\n"
        )
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(exe, arcname=exe.name)
            zf.writestr("README_PORTABLE.txt", readme)

    total_time = time.perf_counter() - overall_start
    section("Result")
    ok("Windows cross-compile completed.")
    kv("Install time", _format_duration(step_times.get("install", 0.0)))
    kv("Build time", _format_duration(step_times.get("build", 0.0)))
    if "cleanup" in step_times:
        kv("Cleanup time", _format_duration(step_times["cleanup"]))
    kv("Total time", _format_duration(total_time))

    bundle(f"exe: {exe}")
    if zip_path:
        bundle(f"zip: {zip_path}")
    else:
        warn("Portable ZIP skipped (WIN_LINUX_ZIP=0).")

    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
