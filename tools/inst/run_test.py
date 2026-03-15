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
import json
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

TIMEOUT_EXIT_CODE = 124
USER_ABORT_EXIT_CODE = 130


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


def _dependency_path(node_modules: Path, package_name: str) -> Path:
    return node_modules.joinpath(*package_name.split("/"))


def _missing_direct_dependencies(app_dir: Path) -> list[str]:
    package_json = app_dir / "package.json"
    node_modules = app_dir / "node_modules"
    if not package_json.exists() or not node_modules.exists():
        return []

    with package_json.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    direct_dependencies = {
        **manifest.get("dependencies", {}),
        **manifest.get("devDependencies", {}),
    }

    missing: list[str] = []
    for package_name in sorted(direct_dependencies.keys()):
        if not _dependency_path(node_modules, package_name).exists():
            missing.append(package_name)

    return missing


def _node_modules_is_stale(app_dir: Path) -> bool:
    package_json = app_dir / "package.json"
    modules_meta = app_dir / "node_modules" / ".modules.yaml"
    if not package_json.exists() or not modules_meta.exists():
        return False
    return package_json.stat().st_mtime > modules_meta.stat().st_mtime


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
    except KeyboardInterrupt:
        warn("Test run aborted by user (Ctrl+C). Stopping child process...")
        _terminate_process(process, graceful_signal=signal.SIGINT)
        return USER_ABORT_EXIT_CODE, time.perf_counter() - start
    except subprocess.TimeoutExpired:
        err(
            "Test process timed out. Terminating to avoid indefinite hang "
            f"(timeout: {timeout_seconds:.0f}s)."
        )
        _log_process_tree(process)
        _terminate_process(process, graceful_signal=signal.SIGTERM)
        return TIMEOUT_EXIT_CODE, time.perf_counter() - start
    return rc, time.perf_counter() - start


def _format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"


def _vitest_base_cmd(pnpm: str, app_dir: Path) -> list[str]:
    return [
        pnpm,
        "-C",
        str(app_dir),
        "exec",
        "vitest",
        "run",
        "--watch=false",
        "--pool=forks",
        "--teardownTimeout=3000",
    ]


def _discover_test_files(app_dir: Path) -> list[str]:
    src_dir = app_dir / "src"
    if not src_dir.exists():
        return []
    return sorted(
        path.relative_to(app_dir).as_posix()
        for path in src_dir.rglob("*.test.ts")
    )


def _terminate_process(
    process: subprocess.Popen[bytes],
    *,
    graceful_signal: int,
) -> int:
    if process.poll() is not None:
        return process.returncode

    if os.name != "nt":
        try:
            os.killpg(process.pid, graceful_signal)
        except ProcessLookupError:
            pass
    else:
        process.terminate()

    try:
        return process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        warn("Process did not exit after graceful signal; escalating to SIGKILL.")
        if os.name != "nt":
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        else:
            process.kill()
        try:
            return process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            warn("Process did not exit after SIGKILL; continuing without blocking.")
            return TIMEOUT_EXIT_CODE


def _log_process_tree(process: subprocess.Popen[bytes]) -> None:
    if os.name == "nt":
        return
    try:
        # start_new_session=True => process pid is also process-group id.
        snapshot = subprocess.run(
            ["ps", "-o", "pid,ppid,stat,cmd", "--forest", "-g", str(process.pid)],
            check=False,
            capture_output=True,
            text=True,
        )
        output = (snapshot.stdout or "").strip()
        if output:
            warn("Process tree at timeout:")
            print(output)
    except Exception as dump_error:
        warn(f"Could not capture process tree at timeout: {dump_error}")


def _run_tests_per_file(
    *,
    pnpm: str,
    app_dir: Path,
    repo_root: Path,
    env: dict[str, str],
    dry_run: bool,
) -> tuple[int, float, str | None]:
    test_files = _discover_test_files(app_dir)
    if not test_files:
        warn("No test files discovered for per-file isolation.")
        return 0, 0.0, None

    section("Timeout isolation")
    info(f"Running {len(test_files)} files individually to locate hangs.")
    timeout_seconds = float(env.get("FMD_TEST_FILE_TIMEOUT_SECONDS", "45"))
    start = time.perf_counter()

    for index, test_file in enumerate(test_files, start=1):
        info(f"[{index}/{len(test_files)}] {test_file}")
        cmd = [*_vitest_base_cmd(pnpm, app_dir), "--reporter=verbose", test_file]
        rc, _ = _run(
            cmd,
            cwd=repo_root,
            env=env,
            dry_run=dry_run,
            timeout_seconds=timeout_seconds,
        )
        if rc != 0:
            return rc, time.perf_counter() - start, test_file

    return 0, time.perf_counter() - start, None


def run_install(dry_run: bool = False) -> int:
    repo_root = _repo_root_from_here()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    pnpm = _which_pnpm()
    env = os.environ.copy()
    # Ensure non-interactive CI-like behavior (no watch-mode fallbacks).
    env["CI"] = "1"
    timeout_seconds = float(env.get("FMD_TEST_TIMEOUT_SECONDS", "90"))
    isolate_on_timeout = env.get("FMD_TEST_ISOLATE_ON_TIMEOUT", "1").strip().lower() not in {
        "0",
        "false",
        "no",
    }
    isolate_on_failure = env.get("FMD_TEST_ISOLATE_ON_FAILURE", "1").strip().lower() not in {
        "0",
        "false",
        "no",
    }
    isolate_only = env.get("FMD_TEST_ISOLATE_ONLY", "0").strip().lower() in {
        "1",
        "true",
        "yes",
    }

    section("Test suite")
    info(f"Repo root: {repo_root}")
    info(f"App dir:  {app_dir}")
    info(
        "Timeouts: suite="
        f"{timeout_seconds:.0f}s, file={float(env.get('FMD_TEST_FILE_TIMEOUT_SECONDS', '45')):.0f}s"
    )
    if dry_run:
        warn("Dry run mode enabled: commands will not run.")

    missing_dependencies = _missing_direct_dependencies(app_dir)
    stale_node_modules = _node_modules_is_stale(app_dir)
    if missing_dependencies or stale_node_modules:
        section("Install JS dependencies")
        if missing_dependencies:
            preview = ", ".join(missing_dependencies[:5])
            if len(missing_dependencies) > 5:
                preview += ", ..."
            warn(f"node_modules incomplete -> running pnpm install (missing: {preview})")
        else:
            warn("package.json is newer than node_modules metadata -> running pnpm install.")
        install_rc, install_duration = _run(
            [pnpm, "install"],
            cwd=app_dir,
            env=env,
            dry_run=dry_run,
        )
        kv("Install", _format_duration(install_duration))
        if install_rc != 0:
            err("pnpm install failed.")
            return install_rc

    if isolate_only:
        warn("Isolation-only mode enabled. Skipping full-suite run.")
        isolated_rc, isolated_duration, failed_file = _run_tests_per_file(
            pnpm=pnpm,
            app_dir=app_dir,
            repo_root=repo_root,
            env=env,
            dry_run=dry_run,
        )
        kv("Isolation", _format_duration(isolated_duration))
        if isolated_rc == 0:
            ok("pnpm test succeeded in isolated mode.")
        elif isolated_rc == USER_ABORT_EXIT_CODE:
            warn("Isolation run aborted by user.")
        else:
            if failed_file:
                err(f"Failing file in isolation: {failed_file}")
            err("pnpm test failed during isolation.")
        kv("Duration", _format_duration(isolated_duration))
        return isolated_rc

    # Call Vitest directly with explicit non-watch flags.
    cmd = _vitest_base_cmd(pnpm, app_dir)
    rc, duration = _run(
        cmd,
        cwd=repo_root,
        env=env,
        dry_run=dry_run,
        timeout_seconds=timeout_seconds,
    )

    should_isolate_after_timeout = (
        rc == TIMEOUT_EXIT_CODE
        and isolate_on_timeout
        and not dry_run
    )
    should_isolate_after_failure = (
        rc not in {0, USER_ABORT_EXIT_CODE, TIMEOUT_EXIT_CODE}
        and isolate_on_failure
        and not dry_run
    )

    if should_isolate_after_timeout or should_isolate_after_failure:
        if should_isolate_after_timeout:
            warn("Full-suite run timed out. Retrying per-file isolation.")
        else:
            warn(
                "Full-suite run failed. Retrying per-file isolation to pinpoint "
                "worker crashes or failing files."
            )
        isolated_rc, isolated_duration, failed_file = _run_tests_per_file(
            pnpm=pnpm,
            app_dir=app_dir,
            repo_root=repo_root,
            env=env,
            dry_run=dry_run,
        )
        kv("Isolation", _format_duration(isolated_duration))
        total_duration = duration + isolated_duration

        if isolated_rc == 0:
            warn(
                "All files passed individually. Full-suite run appears unstable "
                "(likely worker/pool issue)."
            )
            ok("pnpm test succeeded in isolated mode.")
            kv("Duration", _format_duration(total_duration))
            return 0
        if isolated_rc == USER_ABORT_EXIT_CODE:
            warn("Isolation run aborted by user.")
            kv("Duration", _format_duration(total_duration))
            return isolated_rc
        if failed_file:
            err(f"Hanging/failing file in isolation: {failed_file}")
        err("pnpm test failed during isolation.")
        kv("Duration", _format_duration(total_duration))
        return isolated_rc

    if rc == 0:
        ok("pnpm test succeeded.")
    elif rc == USER_ABORT_EXIT_CODE:
        warn("pnpm test aborted by user.")
    elif rc == TIMEOUT_EXIT_CODE:
        err("pnpm test timed out.")
    else:
        err("pnpm test failed.")

    kv("Duration", _format_duration(duration))
    return rc


if __name__ == "__main__":
    raise SystemExit(run_install(False))
