#!/usr/bin/env python3
"""
Run the desktop app tests via pnpm.

control.py entry:
  python3 tools/control.py --test

Default behavior:
  - pnpm -C apps/fmd-desktop test
"""

from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

from console import (
    action,
    err,
    info,
    kv,
    ok,
    section,
    warn,
)


def _repo_root_from_here() -> Path:
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


def _run(cmd: list[str], cwd: Path, env: dict[str, str], dry_run: bool) -> tuple[int, float]:
    action(f"{' '.join(cmd)}")
    info(f"cwd={cwd}")
    start = time.perf_counter()
    if dry_run:
        warn("Dry run: command not executed.")
        return 0, time.perf_counter() - start
    process = subprocess.Popen(cmd, cwd=str(cwd), env=env)
    rc = process.wait()
    return rc, time.perf_counter() - start


def _format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"


def run_install(dry_run: bool = False) -> int:
    repo_root = _repo_root_from_here()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    pnpm = _which_pnpm()
    env = os.environ.copy()

    section("Test suite")
    info(f"Repo root: {repo_root}")
    info(f"App dir:  {app_dir}")
    if dry_run:
        warn("Dry run mode enabled: commands will not run.")

    cmd = [pnpm, "-C", str(app_dir), "test"]
    rc, duration = _run(cmd, cwd=repo_root, env=env, dry_run=dry_run)
    if rc == 0:
        ok("pnpm test succeeded.")
    else:
        err("pnpm test failed.")

    kv("Duration", _format_duration(duration))
    return rc


if __name__ == "__main__":
    raise SystemExit(run_install(False))

