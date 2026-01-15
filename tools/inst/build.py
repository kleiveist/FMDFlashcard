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
from pathlib import Path


def _repo_root_from_tools_inst() -> Path:
    # tools/inst/build.py -> repo root is parents[2] (inst -> tools -> repo)
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


def _run(cmd: list[str], cwd: Path, env: dict[str, str], dry_run: bool) -> int:
    print(f"[build] cwd={cwd}")
    print(f"[build] $ {' '.join(cmd)}")
    if dry_run:
        return 0
    return subprocess.call(cmd, cwd=str(cwd), env=env)


def _clean_old_bundles(app_dir: Path, dry_run: bool) -> None:
    bundle_dir = app_dir / "src-tauri" / "target" / "release" / "bundle"
    if bundle_dir.exists():
        print(f"[build] Cleaning old bundles: {bundle_dir}")
        if not dry_run:
            shutil.rmtree(bundle_dir, ignore_errors=True)
    else:
        print(f"[build] No old bundles found at: {bundle_dir}")


def run_install(dry_run: bool = False) -> int:
    """
    Entry point used by control.py.
    """
    repo_root = _repo_root_from_tools_inst()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    _which_pnpm()

    env = os.environ.copy()
    env.setdefault("NO_STRIP", "true")

    clean_bundle = env.get("CLEAN_BUNDLE", "1").lower() not in ("0", "false", "no")
    if clean_bundle:
        _clean_old_bundles(app_dir, dry_run)

    rc = _run(["pnpm", "install"], cwd=app_dir, env=env, dry_run=dry_run)
    if rc != 0:
        return rc

    return _run(["pnpm", "tauri", "build"], cwd=app_dir, env=env, dry_run=dry_run)


if __name__ == "__main__":
    raise SystemExit(run_install(False))
