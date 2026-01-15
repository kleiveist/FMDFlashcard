#!/usr/bin/env python3
"""
Build runner for the Tauri desktop app.

control.py entry:
  python3 tools/control.py --build

Default behavior:
  - pnpm install
  - pnpm tauri build
  - NO_STRIP=true unless already set (avoid linuxdeploy strip issues)
  - optional cleanup of old bundle artifacts (CLEAN_BUNDLE=0 to skip)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
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


def _repo_root_from_tools_inst() -> Path:
    # tools/inst/build_lin.py -> repo root is parents[2] (inst -> tools -> repo)
    return Path(__file__).resolve().parents[2]


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


def _clean_old_bundles(app_dir: Path, dry_run: bool) -> float:
    bundle_dir = app_dir / "src-tauri" / "target" / "release" / "bundle"
    start = time.perf_counter()
    if bundle_dir.exists():
        cleanup(f"Cleaning old bundles: {bundle_dir}")
        if not dry_run:
            shutil.rmtree(bundle_dir, ignore_errors=True)
    else:
        info(f"No old bundles found at: {bundle_dir}")
    return time.perf_counter() - start


def _gather_bundle_files(bundle_dir: Path) -> dict[str, list[Path]]:
    bundles: dict[str, list[Path]] = {}
    if not bundle_dir.exists():
        return bundles
    for path in sorted(bundle_dir.rglob("*")):
        if not path.is_file():
            continue
        label = path.parent.name or "bundle"
        bundles.setdefault(label, []).append(path)
    return bundles


def run_install(dry_run: bool = False) -> int:
    """
    Entry point used by control.py.
    """
    original_env = os.environ
    repo_root = _repo_root_from_tools_inst()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    using_legacy = False
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
        using_legacy = True
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    pnpm = _which_pnpm()

    env = original_env.copy()
    no_strip_defaulted = "NO_STRIP" not in original_env
    env.setdefault("NO_STRIP", "true")
    no_strip_value = env["NO_STRIP"]

    clean_bundle_env = original_env.get("CLEAN_BUNDLE")
    clean_bundle_value = clean_bundle_env if clean_bundle_env is not None else "1"
    clean_bundle_enabled = clean_bundle_value.lower() not in ("0", "false", "no")

    build_verbose_env = original_env.get("BUILD_VERBOSE")
    build_verbose_value = build_verbose_env if build_verbose_env is not None else "1"
    build_verbose_enabled = build_verbose_value.lower() not in ("0", "false", "no")

    bundle_dir = app_dir / "src-tauri" / "target" / "release" / "bundle"

    section("Run Context")
    info(f"Repo root:  {repo_root}")
    info(f"App dir:   {app_dir}")
    if using_legacy:
        warn("Using legacy path: consider migrating to /apps/fmd-desktop")

    section("Settings")
    kv("NO_STRIP", f"{no_strip_value} ({'default' if no_strip_defaulted else 'override'})")
    kv(
        "CLEAN_BUNDLE",
        f"{clean_bundle_value} ({'cleanup' if clean_bundle_enabled else 'skip'})",
    )
    kv(
        "BUILD_VERBOSE",
        f"{build_verbose_value} ({'enabled' if build_verbose_enabled else 'disabled'})",
    )
    if dry_run:
        warn("Dry run mode enabled: commands will not execute.")

    step_times: dict[str, float] = {}
    overall_start = time.perf_counter()

    if clean_bundle_enabled:
        section("Bundle Cleanup")
        step_times["cleanup"] = _clean_old_bundles(app_dir, dry_run)

    section("Install")
    install_rc, install_time = _run([pnpm, "install"], cwd=app_dir, env=env, dry_run=dry_run)
    step_times["install"] = install_time
    if install_rc != 0:
        err("pnpm install failed.")
        return install_rc

    section("Tauri Build")
    build_rc, build_time = _run(
        [pnpm, "tauri", "build"], cwd=app_dir, env=env, dry_run=dry_run
    )
    step_times["build"] = build_time
    if build_rc != 0:
        err("pnpm tauri build failed.")
        return build_rc

    total_time = time.perf_counter() - overall_start
    section("Result")
    ok("Desktop build completed.")
    kv("Install time", _format_duration(step_times.get("install", 0.0)))
    kv("Build time", _format_duration(step_times.get("build", 0.0)))
    if "cleanup" in step_times:
        kv("Cleanup time", _format_duration(step_times["cleanup"]))
    kv("Total time", _format_duration(total_time))

    bundles = _gather_bundle_files(bundle_dir)
    found = False
    for label, paths in bundles.items():
        if not paths:
            continue
        found = True
        for path in sorted(paths):
            bundle(f"{label}: {path}")
    if not found:
        warn(f"No bundles found at {bundle_dir}")
    if dry_run:
        warn("Dry run mode: no artifacts were produced.")

    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
