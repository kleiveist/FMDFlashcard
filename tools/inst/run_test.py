#!/usr/bin/env python3
"""
Run the desktop app tests via pnpm.

control.py entry:
  python3 tools/control.py --test

Default behavior:
  - pnpm -C apps/fmd-desktop exec vitest run --watch=false
"""

from __future__ import annotations

import os
import signal
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


def _run(
    cmd: list[str],
    cwd: Path,
    env: dict[str, str],
    dry_run: bool,
    timeout_seconds: float | None = None,
) -> tuple[int, float]:
    action(f"{' '.join(cmd)}")
    info(f"cwd={cwd}")
    start = time.perf_counter()
    if dry_run:
        warn("Dry run: command not executed.")
        return 0, time.perf_counter() - start
    process = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env,
        start_new_session=(os.name != "nt"),
    )
    try:
        rc = process.wait(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        err(
            "Test process timed out. Terminating to avoid indefinite hang "
            f"(timeout: {timeout_seconds:.0f}s)."
        )
        if os.name != "nt":
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        else:
            process.terminate()
        try:
            rc = process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if os.name != "nt":
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            else:
                process.kill()
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
    # Ensure non-interactive CI-like behavior (no watch-mode fallbacks).
    env["CI"] = "1"
    timeout_seconds = float(env.get("FMD_TEST_TIMEOUT_SECONDS", "300"))

    section("Test suite")
    info(f"Repo root: {repo_root}")
    info(f"App dir:  {app_dir}")
    if dry_run:
        warn("Dry run mode enabled: commands will not run.")

    # Call Vitest directly with explicit non-watch flags.
    cmd = [pnpm, "-C", str(app_dir), "exec", "vitest", "run", "--watch=false"]
    rc, duration = _run(
        cmd,
        cwd=repo_root,
        env=env,
        dry_run=dry_run,
        timeout_seconds=timeout_seconds,
    )
    if rc == 0:
        ok("pnpm test succeeded.")
    else:
        err("pnpm test failed.")

    kv("Duration", _format_duration(duration))
    return rc


if __name__ == "__main__":
    raise SystemExit(run_install(False))
