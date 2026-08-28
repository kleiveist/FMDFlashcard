from __future__ import annotations

import argparse
import json
import os
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO

from tools import logger
from tools.config import (
    ConfigLoadError,
    is_server_only_name,
    resolve_configuration,
    validate_configuration,
)
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    ensure_directory,
    read_regular_text,
    safe_join,
    safe_relative_path,
)
from tools.process import prepare_command, process_start_token
from tools.profiles import runtime as profile_runtime
from tools.tauri import cache, common, paths

_STATE_SCHEMA_VERSION = 1


def _runtime_dir() -> Path:
    return Path(os.fspath(paths.RUNTIME_DIR))


def _log_dir() -> Path:
    return _runtime_dir() / "logs"


def _state_file() -> Path:
    return _runtime_dir() / "tauri_run_state.json"


def _ensure_runtime_dir() -> Path:
    return ensure_directory(paths.ROOT, ".tooling-state/runtime/tauri")


def _ensure_log_dir() -> Path:
    return ensure_directory(paths.ROOT, ".tooling-state/runtime/tauri/logs")


def _open_log(path: Path, *, append: bool) -> TextIO:
    relative = path.relative_to(paths.ROOT).as_posix()
    guarded = safe_join(paths.ROOT, relative)
    write_mode = os.O_APPEND if append else os.O_TRUNC
    flags = os.O_WRONLY | os.O_CREAT | write_mode | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(guarded, flags, 0o644)
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise FilesystemSafetyError(f"Tauri log must be a regular file: {relative}.")
    return os.fdopen(descriptor, "a" if append else "w", encoding="utf-8")


def _read_root(path: Path) -> tuple[Path, Path]:
    """Return a no-follow read root and path relative to that root."""

    absolute = path.absolute()
    project_root = Path(paths.ROOT).absolute()
    try:
        return project_root, absolute.relative_to(project_root)
    except ValueError:
        # Unit-level callers may pass a temporary log outside the configured
        # project. Treat its direct parent as the safety boundary.
        return absolute.parent, Path(absolute.name)


def _open_log_reader(path: Path) -> TextIO:
    root, relative = _read_root(path)
    guarded = safe_join(root, relative.as_posix(), require_exists=True)
    descriptor = os.open(guarded, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise FilesystemSafetyError("Tauri log must be a regular file.")
    return os.fdopen(descriptor, "r", encoding="utf-8", errors="replace")


@dataclass(frozen=True, slots=True)
class _DevSettings:
    frontend_host: str
    frontend_port: int
    frontend_environment: dict[str, str]
    secret_environment: set[str]


def main(args: argparse.Namespace) -> int:
    settings = _resolve_dev_settings(args)
    if settings is None:
        return 1
    if not cache.prepare_dev_cache():
        return 1
    command = common.tauri_cli_command(
        "dev",
        "--config",
        _dev_config_override(settings.frontend_port, settings.frontend_host),
    )

    if getattr(args, "foreground", False):
        return _run_foreground(
            command, settings.frontend_environment, settings.secret_environment
        )

    try:
        return _run_detached(
            command,
            follow=not bool(getattr(args, "no_follow", False)),
            env=settings.frontend_environment,
            remove_env=settings.secret_environment,
        )
    except FilesystemSafetyError as exc:
        logger.fail(f"Refusing unsafe Tauri runtime path: {exc}")
        return 1


def _resolve_dev_settings(args: argparse.Namespace) -> _DevSettings | None:
    profile = profile_runtime.active_profile(paths.ROOT)
    try:
        resolved = resolve_configuration(
            profile,
            project_root=paths.ROOT,
            cli_overrides={
                "FRONTEND_HOST": getattr(args, "frontend_host", None),
                "FRONTEND_PORT": getattr(args, "frontend_port", None),
            },
        )
    except ConfigLoadError as exc:
        logger.fail(f"Could not load frontend configuration: {exc}")
        return None
    relevant = {"FRONTEND_HOST", "FRONTEND_PORT"}
    issues = [
        issue for issue in validate_configuration(resolved) if issue.name in relevant
    ]
    if issues:
        for issue in issues:
            logger.fail(f"{issue.name}: {issue.message}")
        return None
    frontend_host = resolved.value("FRONTEND_HOST")
    frontend_port_value = resolved.value("FRONTEND_PORT")
    assert frontend_host is not None and frontend_port_value is not None
    frontend_names = {
        "FRONTEND_HOST",
        "FRONTEND_PORT",
        "BACKEND_HOST",
        "BACKEND_PORT",
        "VITE_API_BASE_URL",
    }
    frontend_environment = {
        name: value
        for name, value in resolved.values.items()
        if value is not None and name in frontend_names
    }
    secret_environment = {name for name in os.environ if is_server_only_name(name)}
    return _DevSettings(
        frontend_host=frontend_host,
        frontend_port=int(frontend_port_value),
        frontend_environment=frontend_environment,
        secret_environment=secret_environment,
    )


def _run_foreground(
    command: list[str],
    environment: dict[str, str],
    secret_environment: set[str],
) -> int:
    result = common.run_command(
        command,
        cwd=paths.ROOT,
        env=environment,
        remove_env=secret_environment,
    )
    if result.returncode != 0 and _recover_failed_dev_session(
        result.stdout + "\n" + result.stderr
    ):
        logger.info("Retrying Tauri development once after cache recovery.")
        result = common.run_command(
            command,
            cwd=paths.ROOT,
            env=environment,
            remove_env=secret_environment,
        )
    return common.print_result(result, "Tauri dev session finished", "Tauri dev failed")


def _dev_config_override(frontend_port: int, frontend_host: str = "127.0.0.1") -> str:
    client_host = (
        "127.0.0.1" if frontend_host in {"0.0.0.0", "::", "[::]"} else frontend_host
    )
    frontend_directory = Path(
        os.path.relpath(paths.FRONTEND_DIR, paths.TAURI_DIR)
    ).as_posix()
    shell_directory = _shell_argument(frontend_directory)
    shell_host = _shell_argument(frontend_host)
    return json.dumps(
        {
            "build": {
                "beforeDevCommand": (
                    f"cd {shell_directory} && npm run dev -- --host {shell_host} --port {frontend_port}"
                ),
                "devUrl": f"http://{client_host}:{frontend_port}",
            }
        }
    )


def _shell_argument(value: str) -> str:
    return subprocess.list2cmdline([value]) if os.name == "nt" else shlex.quote(value)


def _run_detached(
    command: list[str],
    *,
    follow: bool = True,
    env: dict[str, str] | None = None,
    remove_env: set[str] | None = None,
    recovery_attempted: bool = False,
) -> int:
    _ensure_runtime_dir()
    log_dir = _ensure_log_dir()
    log_path = log_dir / "tauri.log"
    log_file = _open_log(log_path, append=recovery_attempted)
    process: subprocess.Popen | None = None
    try:
        if recovery_attempted:
            log_file.write("\n--- retry after Tauri dev-cache recovery ---\n")
            log_file.flush()
        environment = {
            name: value
            for name, value in os.environ.items()
            if not is_server_only_name(name)
        }
        for name in remove_env or set():
            environment.pop(name, None)
        environment.update(env or {})
        launched_argv = prepare_command(command)
        process = subprocess.Popen(
            launched_argv,
            cwd=paths.ROOT,
            env=environment,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    finally:
        log_file.close()

    try:
        payload = _state_for_process(process, launched_argv, log_path)
        _write_detached_state(payload)
    except BaseException:
        # We own this process object even when identity collection or the
        # atomic state write fails, so it is safe and necessary to clean up.
        _terminate_process_group(process)
        raise

    logger.ok(f"Tauri dev started in background pid={process.pid} log={log_path}")
    if not follow:
        logger.info(f"Follow logs with: tail -f {log_path.relative_to(paths.ROOT)}")
        return 0

    try:
        returncode = _follow_log(log_path, process)
    finally:
        _clear_owned_state(payload)
    if returncode == 0 or recovery_attempted or not _recover_failed_log(log_path):
        return returncode

    logger.info("Retrying Tauri development once after cache recovery.")
    return _run_detached(
        command,
        follow=True,
        env=env,
        remove_env=remove_env,
        recovery_attempted=True,
    )


def _follow_log(log_path: Path, process: subprocess.Popen) -> int:
    logger.info("Streaming Tauri log. Press Ctrl+C to stop Tauri.")
    try:
        with _open_log_reader(log_path) as handle:
            return _stream_log(handle, process)
    except KeyboardInterrupt:
        return _stop_interrupted_process(process)


def _stream_log(handle: TextIO, process: subprocess.Popen) -> int:
    while True:
        line = handle.readline()
        if line:
            print(line, end="", flush=True)
            continue

        returncode = process.poll()
        if returncode is None:
            time.sleep(0.2)
            continue

        _print_remaining_log(handle)
        return _report_process_exit(int(returncode))


def _print_remaining_log(handle: TextIO) -> None:
    rest = handle.read()
    if rest:
        print(rest, end="", flush=True)


def _report_process_exit(returncode: int) -> int:
    if returncode == 0:
        logger.ok("Tauri dev process exited")
        return 0
    logger.fail(f"Tauri dev process exited with code {returncode}")
    return returncode


def _recover_failed_log(log_path: Path) -> bool:
    try:
        root, _relative = _read_root(log_path)
        output = read_regular_text(
            log_path,
            root=root,
            label="Tauri log",
        )
    except (FilesystemSafetyError, OSError):
        return False
    return _recover_failed_dev_session(output)


def _recover_failed_dev_session(output: str) -> bool:
    if not cache.is_plugin_permission_cache_failure(output):
        return False
    return cache.recover_dev_cache("Tauri reported stale generated plugin permissions.")


def _stop_interrupted_process(process: subprocess.Popen) -> int:
    print()
    stopped = _terminate_process_group(process)
    if stopped:
        logger.ok(f"Tauri dev stopped pid={process.pid}")
    else:
        logger.fail(f"Tauri dev did not stop cleanly pid={process.pid}")
    return 0


def _state_for_process(
    process: subprocess.Popen,
    argv: list[str],
    log_path: Path,
) -> dict[str, object]:
    start_token = process_start_token(process.pid)
    if start_token is None:
        raise FilesystemSafetyError(
            "Could not record a process start identity for detached Tauri."
        )
    group_id = _process_group_id(process.pid)
    if group_id is None or group_id != process.pid:
        raise FilesystemSafetyError(
            "Could not verify the isolated Tauri process group."
        )
    try:
        relative_log = log_path.absolute().relative_to(
            Path(paths.ROOT).absolute()
        ).as_posix()
    except ValueError as exc:
        raise FilesystemSafetyError(
            "Tauri runtime log is outside the project root."
        ) from exc
    return {
        "schema_version": _STATE_SCHEMA_VERSION,
        "pid": process.pid,
        "argv": list(argv),
        "process_start_token": start_token,
        "process_group_id": group_id,
        "log": safe_relative_path(relative_log),
    }


def _write_detached_state(payload: dict[str, object]) -> None:
    validation_error = _state_validation_error(payload)
    if validation_error is not None:
        raise FilesystemSafetyError(f"Invalid Tauri runtime state: {validation_error}.")
    _ensure_runtime_dir()
    atomic_write_text(
        _state_file(),
        json.dumps(payload, indent=2) + "\n",
        root=paths.ROOT,
    )


def _read_detached_state() -> dict[str, object] | None:
    state_file = _state_file()
    try:
        state_file.lstat()
    except FileNotFoundError:
        return None
    except OSError as exc:
        return {"_invalid_runtime_state": str(exc)}
    try:
        payload = json.loads(
            read_regular_text(
                state_file,
                root=paths.ROOT,
                label="Tauri runtime state",
            )
        )
    except (FilesystemSafetyError, json.JSONDecodeError, OSError) as exc:
        return {"_invalid_runtime_state": str(exc)}
    validation_error = _state_validation_error(payload)
    if validation_error is not None:
        return {"_invalid_runtime_state": validation_error}
    return payload


def _state_validation_error(payload: object) -> str | None:
    if not isinstance(payload, dict):
        return "state must be a JSON object"
    if payload.get("schema_version") != _STATE_SCHEMA_VERSION:
        return "unsupported or missing schema version"
    pid = payload.get("pid")
    argv = payload.get("argv")
    start_token = payload.get("process_start_token")
    group_id = payload.get("process_group_id")
    log = payload.get("log")
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return "pid is missing or invalid"
    if (
        not isinstance(argv, list)
        or len(argv) < 2
        or not all(isinstance(item, str) and item for item in argv)
    ):
        return "argv is missing or invalid"
    if not isinstance(start_token, str) or not start_token:
        return "process start identity is missing or invalid"
    if not isinstance(group_id, int) or isinstance(group_id, bool) or group_id <= 0:
        return "process group is missing or invalid"
    if group_id != pid:
        return "process group does not match the isolated process"
    if not isinstance(log, str):
        return "log path is missing or invalid"
    try:
        normalized_log = safe_relative_path(log)
    except FilesystemSafetyError:
        return "log path is unsafe"
    expected_prefix = ".tooling-state/runtime/tauri/logs/"
    if normalized_log != log or not normalized_log.startswith(expected_prefix):
        return "log path is outside the Tauri runtime log directory"
    return None


def _unlink_state() -> bool:
    try:
        state_file = _state_file()
        if not state_file.exists() and not state_file.is_symlink():
            return True
        relative = state_file.relative_to(paths.ROOT).as_posix()
        safe_join(paths.ROOT, relative, require_exists=True).unlink()
        return True
    except (FilesystemSafetyError, OSError):
        return False


def _clear_owned_state(expected: dict[str, object]) -> bool:
    current = _read_detached_state()
    if current is None:
        return True
    if "_invalid_runtime_state" in current:
        return False
    identity_keys = (
        "pid",
        "argv",
        "process_start_token",
        "process_group_id",
    )
    if any(current.get(key) != expected.get(key) for key in identity_keys):
        return False
    return _unlink_state()


def _process_group_id(pid: int) -> int | None:
    if os.name == "nt":
        return pid
    try:
        return os.getpgid(pid)
    except OSError:
        return None


def _is_zombie_process(pid: int) -> bool:
    if not sys.platform.startswith("linux"):
        return False
    try:
        status = (Path("/proc") / str(pid) / "stat").read_text(encoding="utf-8")
    except OSError:
        return False
    parts = status.rsplit(") ", 1)
    return len(parts) == 2 and parts[1].split(maxsplit=1)[0] == "Z"


def _is_process_alive(pid: int) -> bool:
    if pid <= 0 or _is_zombie_process(pid):
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False


def _read_proc_argv(pid: int) -> tuple[str, ...] | None:
    if not sys.platform.startswith("linux"):
        return None
    try:
        raw = (Path("/proc") / str(pid) / "cmdline").read_bytes()
    except OSError:
        return None
    tokens = tuple(part.decode(errors="replace") for part in raw.split(b"\x00") if part)
    if len(tokens) != 1:
        return tokens or None
    try:
        expanded = tuple(shlex.split(tokens[0], posix=True))
    except ValueError:
        return None
    return expanded or None


def _argv_query(pid: int) -> list[str] | None:
    if os.name == "nt":
        powershell = (
            shutil.which("powershell.exe")
            or shutil.which("powershell")
            or shutil.which("pwsh")
        )
        if powershell is None:
            return None
        script = (
            f'(Get-CimInstance Win32_Process -Filter "ProcessId = {pid}").CommandLine'
        )
        return [powershell, "-NoProfile", "-NonInteractive", "-Command", script]
    ps = shutil.which("ps")
    return [ps, "-p", str(pid), "-o", "command="] if ps is not None else None


def _read_process_argv(pid: int) -> tuple[str, ...] | None:
    proc_tokens = _read_proc_argv(pid)
    if proc_tokens is not None:
        return proc_tokens
    query = _argv_query(pid)
    if query is None:
        return None
    try:
        completed = subprocess.run(
            query,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError:
        return None
    command_line = completed.stdout.strip()
    if completed.returncode != 0 or not command_line:
        return None
    try:
        return tuple(shlex.split(command_line, posix=os.name != "nt"))
    except ValueError:
        return None


def _normalized_executable(value: str) -> str:
    name = Path(value.strip('"')).name.casefold()
    for suffix in (".cmd", ".bat", ".exe"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name


def _launcher_matches(expected: str, current: tuple[str, ...]) -> bool:
    expected_name = _normalized_executable(expected)
    current_names = {_normalized_executable(token) for token in current}
    if expected_name in current_names:
        return True
    if expected_name in {"npm", "npx"}:
        return bool({"npm-cli.js", "npx-cli.js"} & current_names)
    if expected_name == "tauri":
        return bool({"tauri.js", "tauri-cli"} & current_names)
    return False


def _contains_token_sequence(
    tokens: tuple[str, ...], expected: tuple[str, ...]
) -> bool:
    if not expected or len(expected) > len(tokens):
        return False
    return any(
        tokens[index : index + len(expected)] == expected
        for index in range(len(tokens) - len(expected) + 1)
    )


def _argv_matches(expected: tuple[str, ...], current: tuple[str, ...]) -> bool:
    if not expected or not current or not _launcher_matches(expected[0], current):
        return False
    expected_arguments = expected[1:]
    if _normalized_executable(expected[0]) in {"npm", "npx"}:
        expected_arguments = tuple(token for token in expected_arguments if token != "--")
        current = tuple(token for token in current if token != "--")
    return _contains_token_sequence(current, expected_arguments)


def _tracked_identity_matches(
    state: dict[str, object], pid: int
) -> tuple[bool, str]:
    stored_token = state.get("process_start_token")
    assert isinstance(stored_token, str)
    current_token = process_start_token(pid)
    if current_token is None:
        return False, "current process start identity is unavailable"
    if current_token != stored_token:
        return False, "process start identity does not match"

    raw_argv = state.get("argv")
    assert isinstance(raw_argv, list)
    current_argv = _read_process_argv(pid)
    if current_argv is None:
        return False, "current process arguments are unavailable"
    if not _argv_matches(tuple(raw_argv), current_argv):
        return False, "process arguments do not match"

    group_id = state.get("process_group_id")
    assert isinstance(group_id, int)
    if _process_group_id(pid) != group_id:
        return False, "process group does not match"
    return True, "process start, arguments, and group match"


def _process_group_has_live_member(group_id: int) -> bool:
    if not sys.platform.startswith("linux"):
        try:
            os.killpg(group_id, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True
        except OSError:
            return False
    try:
        process_names = os.listdir("/proc")
    except OSError:
        return True
    for name in process_names:
        if not name.isdigit():
            continue
        pid = int(name)
        try:
            if os.getpgid(pid) == group_id and not _is_zombie_process(pid):
                return True
        except OSError:
            continue
    return False


def _terminate_tracked_state(
    state: dict[str, object], *, timeout_seconds: float = 8.0
) -> tuple[bool, str]:
    pid = state.get("pid")
    group_id = state.get("process_group_id")
    assert isinstance(pid, int) and isinstance(group_id, int)

    matches, detail = _tracked_identity_matches(state, pid)
    if not matches:
        return False, detail

    if os.name == "nt":
        taskkill = shutil.which("taskkill.exe") or shutil.which("taskkill")
        if taskkill is None:
            return False, "taskkill is unavailable"
        completed = subprocess.run(
            [taskkill, "/PID", str(pid), "/T", "/F"],
            text=True,
            capture_output=True,
            check=False,
        )
        stopped = completed.returncode == 0 or not _is_process_alive(pid)
        return stopped, "terminated" if stopped else "taskkill failed"

    try:
        os.killpg(group_id, signal.SIGTERM)
    except ProcessLookupError:
        return True, "process already exited"
    except OSError as exc:
        return False, f"could not signal process group: {exc}"

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if not _process_group_has_live_member(group_id):
            return True, "terminated"
        time.sleep(0.2)

    # Revalidate the leader before escalation. If it has exited, the original
    # group may still contain children, but safety wins over an unverifiable
    # SIGKILL target.
    matches, detail = _tracked_identity_matches(state, pid)
    if not matches:
        return False, f"refusing SIGKILL because {detail}"
    try:
        os.killpg(group_id, signal.SIGKILL)
    except ProcessLookupError:
        return True, "process already exited"
    except OSError as exc:
        return False, f"could not kill process group: {exc}"
    stopped = not _process_group_has_live_member(group_id)
    return stopped, "terminated" if stopped else "process group remained alive"


def stop(_args: argparse.Namespace | None = None) -> int:
    state = _read_detached_state()
    if state is None:
        logger.ok("No tracked Tauri dev process is running")
        return 0
    invalid = state.get("_invalid_runtime_state")
    if invalid is not None:
        logger.fail(f"Tauri runtime state is unsafe or invalid: {invalid}")
        return 1

    pid = state.get("pid")
    assert isinstance(pid, int)
    if not _is_process_alive(pid):
        if not _clear_owned_state(state):
            logger.fail("The stopped Tauri process state could not be removed safely")
            return 1
        logger.ok(f"Tracked Tauri dev process is no longer running pid={pid}")
        return 0

    stopped, detail = _terminate_tracked_state(state)
    if not stopped:
        logger.fail(f"Tauri dev pid={pid} was not signaled/stopped: {detail}")
        return 1
    if not _clear_owned_state(state):
        logger.fail(f"Tauri dev stopped pid={pid}, but state cleanup was refused")
        return 1
    logger.ok(f"Tauri dev stopped pid={pid}")
    return 0


def _terminate_process_group(
    process: subprocess.Popen, *, timeout_seconds: float = 8.0
) -> bool:
    if process.poll() is not None:
        return True

    if os.name == "nt":
        taskkill = shutil.which("taskkill.exe") or shutil.which("taskkill")
        if taskkill is not None:
            completed = subprocess.run(
                [taskkill, "/PID", str(process.pid), "/T", "/F"],
                text=True,
                capture_output=True,
                check=False,
            )
            if completed.returncode == 0:
                return True
        try:
            process.terminate()
        except OSError:
            return process.poll() is not None
        try:
            process.wait(timeout=timeout_seconds)
            return True
        except subprocess.TimeoutExpired:
            try:
                process.kill()
                process.wait(timeout=2.0)
                return True
            except (OSError, subprocess.TimeoutExpired):
                return process.poll() is not None

    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return True
    except OSError:
        try:
            process.terminate()
        except OSError:
            return True

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return True
        time.sleep(0.2)

    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        return True
    except OSError:
        try:
            process.kill()
        except OSError:
            return True

    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        if process.poll() is not None:
            return True
        time.sleep(0.1)
    return process.poll() is not None
