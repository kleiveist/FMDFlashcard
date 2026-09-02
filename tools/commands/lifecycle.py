"""Safe, repository-owned lifecycle management for the Tauri dev process."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import stat
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

from tools import logger
from tools.paths import PathSafetyError, ProjectPaths, project_paths, require_within
from tools.process import (
    command_string,
    is_process_alive,
    prepare_command,
    process_group_id,
    process_start_token,
    read_process_argv,
    run_command,
)

STATE_SCHEMA_VERSION = 1
STATE_NAME = "tauri-dev.json"
LOG_NAME = "tauri-dev.log"
EXPECTED_TAIL = ("tauri", "dev")


class LifecycleError(RuntimeError):
    """Raised when tracked state cannot safely identify an owned process."""


def _dev_command() -> list[str]:
    if pnpm := shutil.which("pnpm"):
        return [pnpm, "tauri", "dev"]
    if corepack := shutil.which("corepack"):
        return [corepack, "pnpm", "tauri", "dev"]
    return ["pnpm", "tauri", "dev"]


def _owned_path(path: Path, paths: ProjectPaths) -> Path:
    guarded = require_within(paths.root, path, label="runtime path")
    if guarded.is_symlink():
        raise LifecycleError(f"runtime path must not be a symbolic link: {guarded}")
    return guarded


def _state_path(paths: ProjectPaths) -> Path:
    return _owned_path(paths.runtime / STATE_NAME, paths)


def _log_path(paths: ProjectPaths) -> Path:
    return _owned_path(paths.runtime / LOG_NAME, paths)


def _prepare_runtime(paths: ProjectPaths) -> None:
    _owned_path(paths.state, paths)
    _owned_path(paths.runtime, paths)
    paths.runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not paths.runtime.is_dir():
        raise LifecycleError(f"runtime location is not a directory: {paths.runtime}")


def _write_state(path: Path, document: dict[str, object], paths: ProjectPaths) -> None:
    _owned_path(path, paths)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".tauri-dev-", suffix=".tmp", dir=paths.runtime
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(document, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _read_state(path: Path, paths: ProjectPaths) -> dict[str, Any]:
    _owned_path(path, paths)
    try:
        metadata = path.lstat()
    except FileNotFoundError as exc:
        raise LifecycleError("no tracked Tauri development process") from exc
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > 16_384:
        raise LifecycleError("runtime state is not a small regular file")
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise LifecycleError(f"runtime state is unreadable: {exc}") from exc
    if not isinstance(document, dict):
        raise LifecycleError("runtime state must be a JSON object")
    return document


def _command_contains(current: tuple[str, ...], expected: tuple[str, ...]) -> bool:
    if len(current) < len(expected):
        return False
    folded = tuple(value.casefold() for value in current)
    wanted = tuple(value.casefold() for value in expected)
    return any(
        folded[index : index + len(wanted)] == wanted
        for index in range(len(folded) - len(wanted) + 1)
    )


def _validate_state(document: dict[str, Any], paths: ProjectPaths) -> tuple[int, int]:
    if document.get("schema_version") != STATE_SCHEMA_VERSION:
        raise LifecycleError("runtime state schema is unsupported")
    pid = document.get("pid")
    group = document.get("process_group_id")
    token = document.get("process_start_token")
    expected = document.get("expected_argv")
    root = document.get("repository_root")
    if not isinstance(pid, int) or pid <= 0:
        raise LifecycleError("runtime state has an invalid PID")
    if not isinstance(group, int) or group <= 0:
        raise LifecycleError("runtime state has an invalid process group")
    if not isinstance(token, str) or not token:
        raise LifecycleError("runtime state has no process identity token")
    if expected != list(EXPECTED_TAIL):
        raise LifecycleError("runtime state has an unexpected command identity")
    if root != str(paths.root):
        raise LifecycleError("runtime state belongs to a different repository")
    if not is_process_alive(pid):
        raise ProcessLookupError(pid)
    if process_start_token(pid) != token:
        raise LifecycleError("PID identity changed; refusing to signal an unrelated process")
    if process_group_id(pid) != group:
        raise LifecycleError("process group changed; refusing to signal it")
    current = read_process_argv(pid)
    if current is None or not _command_contains(current, EXPECTED_TAIL):
        raise LifecycleError("process command line no longer matches the tracked Tauri command")
    return pid, group


def _remove_state(path: Path, paths: ProjectPaths) -> None:
    _owned_path(path, paths)
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def run(args: argparse.Namespace, *, paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    command = _dev_command()
    logger.info(f"$ {command_string(command)}")
    if args.dry_run:
        logger.ok("Dry-run completed; no process or runtime state was created")
        return 0
    if args.foreground:
        result = run_command(command, cwd=project.desktop, capture_output=False)
        return result.returncode

    try:
        _prepare_runtime(project)
        state_path = _state_path(project)
        log_path = _log_path(project)
        if state_path.exists():
            document = _read_state(state_path, project)
            try:
                pid, _ = _validate_state(document, project)
            except ProcessLookupError:
                _remove_state(state_path, project)
            else:
                logger.error(f"Tauri development process is already running (PID {pid})")
                return 1
        with log_path.open("ab", buffering=0) as log_handle:
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
            child = subprocess.Popen(
                prepare_command(command),
                cwd=project.desktop,
                stdin=subprocess.DEVNULL,
                stdout=log_handle,
                stderr=subprocess.STDOUT,
                shell=False,
                start_new_session=os.name != "nt",
                creationflags=creationflags,
            )
        token = process_start_token(child.pid)
        group = process_group_id(child.pid)
        if token is None or group is None:
            try:
                child.terminate()
            finally:
                child.wait(timeout=5)
            raise LifecycleError("could not establish a stable process identity")
        document: dict[str, object] = {
            "schema_version": STATE_SCHEMA_VERSION,
            "pid": child.pid,
            "process_group_id": group,
            "process_start_token": token,
            "expected_argv": list(EXPECTED_TAIL),
            "command": command,
            "repository_root": str(project.root),
            "log": log_path.relative_to(project.root).as_posix(),
        }
        _write_state(state_path, document, project)
    except (LifecycleError, OSError, PathSafetyError, subprocess.SubprocessError) as exc:
        logger.error(str(exc))
        return 1

    logger.ok(f"Tauri development process started (PID {child.pid})")
    logger.info(f"Log: {log_path}")
    if not args.no_follow:
        logger.info("The process is detached; use 'stop' to end it")
    return 0


def _wait_until_stopped(pid: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not is_process_alive(pid):
            return True
        time.sleep(0.1)
    return not is_process_alive(pid)


def stop(_args: argparse.Namespace, *, paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    try:
        state_path = _state_path(project)
        document = _read_state(state_path, project)
        try:
            pid, group = _validate_state(document, project)
        except ProcessLookupError:
            _remove_state(state_path, project)
            logger.info("Tracked process is no longer running; stale state was removed")
            return 0

        if os.name == "nt":
            result = run_command(["taskkill", "/PID", str(pid), "/T"], cwd=project.root)
            if result.returncode != 0:
                return result.returncode
        else:
            os.killpg(group, signal.SIGTERM)
        if not _wait_until_stopped(pid, 5.0):
            # Revalidate every identity immediately before the destructive escalation.
            try:
                pid, group = _validate_state(document, project)
            except ProcessLookupError:
                _remove_state(state_path, project)
                logger.ok("Tracked Tauri development process stopped")
                return 0
            if os.name == "nt":
                result = run_command(["taskkill", "/PID", str(pid), "/T", "/F"], cwd=project.root)
                if result.returncode != 0:
                    return result.returncode
            else:
                os.killpg(group, signal.SIGKILL)
            if not _wait_until_stopped(pid, 2.0):
                raise LifecycleError("tracked process did not stop")
        _remove_state(state_path, project)
    except (LifecycleError, OSError, PathSafetyError) as exc:
        logger.error(str(exc))
        return 1
    logger.ok("Tracked Tauri development process stopped")
    return 0
