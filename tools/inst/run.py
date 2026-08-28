#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import queue
import shutil
import socket
import stat
import subprocess
import threading
import time
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO

from tools import logger
from tools.config import (
    ConfigLoadError,
    ConfigValidationError,
    RuntimeConfig,
    is_server_only_name,
    load_runtime_config,
)
from tools.core.context import ProjectContext, load_context
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    ensure_directory,
    read_regular_text,
    safe_join,
)
from tools.inst import stop as safe_stop
from tools.process import prepare_command, process_start_token
from tools.profiles import runtime as profile_runtime

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve target and runtime paths from the current project root."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


def _runtime_dir() -> Path:
    return _context().runtime_root


def _log_dir() -> Path:
    return _runtime_dir() / "logs"


def _state_file() -> Path:
    return _runtime_dir() / "run_state.json"


def _ensure_runtime_dir() -> Path:
    return ensure_directory(_context().project_root, ".tooling-state/runtime")


def _ensure_log_dir() -> Path:
    return ensure_directory(_context().project_root, ".tooling-state/runtime/logs")


def _open_log(path: Path) -> TextIO:
    context = _context()
    relative = path.relative_to(context.project_root).as_posix()
    guarded = safe_join(context.project_root, relative)
    flags = os.O_WRONLY | os.O_CREAT | os.O_APPEND | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(guarded, flags, 0o644)
    if not stat.S_ISREG(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise FilesystemSafetyError(f"Runtime log must be a regular file: {relative}.")
    return os.fdopen(descriptor, "a", encoding="utf-8")


def _venv_python(backend_dir: Path) -> Path:
    candidates = [
        backend_dir / ".venv" / "Scripts" / "python.exe",
        backend_dir / ".venv" / "bin" / "python",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0] if os.name == "nt" else candidates[1]


@dataclass(slots=True)
class ServiceDef:
    name: str
    command: list[str]
    cwd: Path
    port: int
    host: str
    env: dict[str, str]


def _port_is_free(host: str, port: int) -> bool:
    try:
        addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError:
        return False
    for family, socktype, protocol, _, address in addresses:
        with socket.socket(family, socktype, protocol) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(address)
                return True
            except OSError:
                continue
    return False


def _read_state() -> dict[str, object] | None:
    state_file = _state_file()
    try:
        state_file.lstat()
    except FileNotFoundError:
        return None
    try:
        payload = json.loads(
            read_regular_text(
                state_file,
                root=_context().project_root,
                label="Runtime state",
            )
        )
        validation_error = safe_stop._state_validation_error(payload)
        return (
            {"_invalid_runtime_state": validation_error}
            if validation_error is not None
            else payload
        )
    except (FilesystemSafetyError, json.JSONDecodeError, OSError) as exc:
        return {"_invalid_runtime_state": str(exc)}


def _write_state(payload: dict[str, object]) -> None:
    _ensure_runtime_dir()
    atomic_write_text(
        _state_file(),
        json.dumps(payload, indent=2) + "\n",
        root=_context().project_root,
    )


def _clear_state() -> None:
    try:
        state_file = _state_file()
        if not state_file.exists() and not state_file.is_symlink():
            return
        relative = state_file.relative_to(_context().project_root).as_posix()
        safe_join(_context().project_root, relative, require_exists=True).unlink()
    except (FilesystemSafetyError, OSError):
        pass


def _frontend_process_environment(config: RuntimeConfig) -> dict[str, str]:
    environment = {
        key: value for key, value in os.environ.items() if not is_server_only_name(key)
    }
    environment.update(config.frontend_environment())
    return environment


def _backend_process_environment(config: RuntimeConfig) -> dict[str, str]:
    environment = os.environ.copy()
    environment.update(config.backend_environment())
    return environment


def _frontend_service(config: RuntimeConfig) -> tuple[ServiceDef | None, list[str]]:
    errors: list[str] = []
    frontend_dir = _context().paths.frontend
    assert config.frontend_host is not None
    assert config.frontend_port is not None
    if not (frontend_dir / "package.json").exists():
        errors.append("Missing frontend/package.json")

    npm = shutil.which("npm")
    if npm is None:
        errors.append("npm not found. Action: install Node.js and npm.")
        return None, errors

    service = ServiceDef(
        name="frontend",
        command=[
            npm,
            "run",
            "dev",
            "--",
            "--host",
            config.frontend_host,
            "--port",
            str(config.frontend_port),
        ],
        cwd=frontend_dir,
        port=config.frontend_port,
        host=config.frontend_host,
        env=_frontend_process_environment(config),
    )
    return service, errors


def _backend_executable(backend_dir: Path) -> Path | None:
    backend_python = _venv_python(backend_dir)
    if backend_python.exists():
        return backend_python
    fallback = shutil.which("python3") or shutil.which("python")
    return Path(fallback) if fallback else None


def _backend_runtime_error(backend_python: Path) -> str | None:
    try:
        probe = subprocess.run(
            [str(backend_python), "-c", "import pydantic_settings, uvicorn"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        return str(exc)
    if probe.returncode == 0:
        return None
    details = ((probe.stderr or "") + "\n" + (probe.stdout or "")).strip()
    return details or f"exit code {probe.returncode}"


def _backend_service(config: RuntimeConfig) -> tuple[ServiceDef | None, list[str]]:
    errors: list[str] = []
    backend_dir = _context().paths.backend
    assert config.backend_host is not None
    assert config.backend_port is not None
    if backend_dir is None:
        return None, ["Backend path is not configured in project-tooling.toml."]
    if not (backend_dir / "app" / "main.py").exists():
        errors.append("Missing backend/app/main.py")

    backend_python = _backend_executable(backend_dir)
    if backend_python is None:
        errors.append("Python executable not found for backend service.")
        return None, errors

    runtime_error = _backend_runtime_error(backend_python)
    if runtime_error is not None:
        errors.append(
            "Backend runtime is not executable. Action: run "
            "'python tools/control.py install --skip-frontend --skip-playwright'. "
            f"Details: {runtime_error}"
        )
        return None, errors

    service = ServiceDef(
        name="backend",
        command=[
            str(backend_python),
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            config.backend_host,
            "--port",
            str(config.backend_port),
        ],
        cwd=backend_dir,
        port=config.backend_port,
        host=config.backend_host,
        env=_backend_process_environment(config),
    )
    return service, errors


def _build_service_defs(config: RuntimeConfig) -> tuple[list[ServiceDef], list[str]]:
    errors: list[str] = []
    services: list[ServiceDef] = []
    profile = profile_runtime.active_profile(ROOT)

    builders = []
    if profile.has_feature("frontend"):
        builders.append(_frontend_service)
    if profile.has_feature("backend"):
        builders.append(_backend_service)

    for builder in builders:
        service, service_errors = builder(config)
        errors.extend(service_errors)
        if service is not None:
            services.append(service)

    if errors:
        return services, errors

    if not services:
        errors.append("Active profile does not enable a runnable development service.")

    return services, errors


def _stop_from_state(print_output: bool = True) -> int:
    state = _read_state()
    if state and "_invalid_runtime_state" in state:
        if print_output:
            logger.fail(
                f"Runtime state is unsafe or invalid: {state['_invalid_runtime_state']}"
            )
        return 1
    if not state or "services" not in state:
        if print_output:
            logger.ok("No tracked services are running")
        _clear_state()
        return 0

    failures = 0
    remaining_services: list[dict[str, object]] = []
    services = state["services"]
    assert isinstance(services, list)
    for service in services:
        assert isinstance(service, dict)
        pid = int(service.get("pid", -1))
        name = str(service.get("name", "unknown"))
        if pid <= 0:
            continue
        if not safe_stop._is_process_alive(pid):
            ok = True
        else:
            identity_matches, identity_detail = safe_stop._tracked_identity_matches(
                service, pid
            )
            if not identity_matches:
                if print_output:
                    logger.status(
                        "FAIL",
                        f"stop:stale:{name:<8} pid={pid} ({identity_detail}); process was not signaled",
                    )
                failures += 1
                remaining_services.append(service)
                continue
            ok = safe_stop._terminate_tracked_service(service, pid)
            raw_port = service.get("port")
            if ok and isinstance(raw_port, int) and not isinstance(raw_port, bool):
                ok = safe_stop._port_is_free(raw_port)
        if print_output:
            status = "OK" if ok else "FAIL"
            logger.status(status, f"stop:{name:<10} pid={pid}")
        if not ok:
            failures += 1
            remaining_services.append(service)

    if remaining_services:
        retained_state = dict(state)
        retained_state["services"] = remaining_services
        try:
            _write_state(retained_state)
        except (FilesystemSafetyError, OSError) as exc:
            if print_output:
                logger.fail(f"Unable to retain failed runtime state entries: {exc}")
            failures += 1
    else:
        _clear_state()
    return 1 if failures else 0


def _state_has_live_processes() -> bool:
    state = _read_state()
    if not state:
        return False
    if "_invalid_runtime_state" in state:
        return True

    services = state["services"]
    assert isinstance(services, list)
    live_services: list[dict[str, object]] = []
    for service in services:
        assert isinstance(service, dict)
        pid = int(service.get("pid", -1))
        if pid > 0 and safe_stop._is_process_alive(pid):
            live_services.append(service)

    if not live_services:
        _clear_state()
        return False
    if len(live_services) != len(services):
        retained_state = dict(state)
        retained_state["services"] = live_services
        try:
            _write_state(retained_state)
        except (FilesystemSafetyError, OSError):
            pass
    return True


def _preflight(config: RuntimeConfig) -> list[str]:
    errors: list[str] = []
    profile = profile_runtime.active_profile(ROOT)

    if _state_has_live_processes():
        errors.append(
            "Tracked services are already running. Use 'python tools/control.py stop' first."
        )

    endpoints: list[tuple[str, int]] = []
    if profile.has_feature("frontend"):
        assert config.frontend_host is not None
        assert config.frontend_port is not None
        endpoints.append((config.frontend_host, config.frontend_port))
    if profile.has_feature("backend"):
        assert config.backend_host is not None
        assert config.backend_port is not None
        endpoints.append((config.backend_host, config.backend_port))

    for host, port in endpoints:
        if not _port_is_free(host, port):
            errors.append(f"Port {host}:{port} is already occupied.")

    return errors


def _service_state(
    service: ServiceDef, process: subprocess.Popen, log_file: str | None
) -> dict[str, object]:
    start_token = process_start_token(process.pid)
    if not start_token:
        raise RuntimeError(
            f"Could not capture process start identity for {service.name} pid={process.pid}."
        )
    return {
        "name": service.name,
        "pid": process.pid,
        "port": service.port,
        "command": service.command,
        "process_start_token": start_token,
        "process_group_id": process.pid,
        "log_file": log_file,
    }


def _rollback_started_processes(processes: list[subprocess.Popen]) -> None:
    for process in reversed(processes):
        running = True
        with suppress(BaseException):
            running = process.poll() is None

        stopped = not running
        if running:
            with suppress(BaseException):
                stopped = safe_stop._terminate_tracked_service(
                    {"process_group_id": process.pid}, process.pid
                )
        if not stopped:
            with suppress(BaseException):
                process.terminate()
                process.wait(timeout=2)
            stopped = False
            with suppress(BaseException):
                stopped = process.poll() is not None
            if not stopped:
                with suppress(BaseException):
                    process.kill()
                    process.wait(timeout=2)

        stdout = getattr(process, "stdout", None)
        if stdout is not None:
            with suppress(BaseException):
                stdout.close()


def _start_detached(
    services: list[ServiceDef],
) -> tuple[list[subprocess.Popen], dict[str, object]]:
    _ensure_runtime_dir()
    log_dir = _ensure_log_dir()

    service_states: list[dict[str, object]] = []
    payload: dict[str, object] = {
        "created_at": int(time.time()),
        "services": service_states,
    }
    processes: list[subprocess.Popen] = []

    try:
        for service in services:
            log_path = log_dir / f"{service.name}.log"
            log_file = _open_log(log_path)
            process: subprocess.Popen | None = None
            try:
                process = subprocess.Popen(
                    prepare_command(service.command),
                    cwd=service.cwd,
                    env=service.env,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    text=True,
                    start_new_session=True,
                )
                processes.append(process)
            finally:
                log_file.close()
            assert process is not None
            service_states.append(
                _service_state(service, process, str(log_path.relative_to(ROOT)))
            )

        _write_state(payload)
    except BaseException:
        _rollback_started_processes(processes)
        raise
    return processes, payload


def _start_foreground(
    services: list[ServiceDef],
) -> tuple[list[subprocess.Popen], dict[str, object]]:
    service_states: list[dict[str, object]] = []
    payload: dict[str, object] = {
        "created_at": int(time.time()),
        "services": service_states,
    }
    processes: list[subprocess.Popen] = []

    try:
        for service in services:
            process = subprocess.Popen(
                prepare_command(service.command),
                cwd=service.cwd,
                env=service.env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
            processes.append(process)
            service_states.append(_service_state(service, process, None))

        _write_state(payload)
    except BaseException:
        _rollback_started_processes(processes)
        raise
    return processes, payload


def _stream_foreground(
    payload: dict[str, object], processes: list[subprocess.Popen]
) -> int:
    q: queue.Queue[tuple[str, str]] = queue.Queue()

    services = payload["services"]
    assert isinstance(services, list)

    def reader(name: str, process: subprocess.Popen) -> None:
        assert process.stdout is not None
        for line in process.stdout:
            q.put((name, line.rstrip()))

    threads = []
    for item, process in zip(services, processes, strict=True):
        assert isinstance(item, dict)
        t = threading.Thread(target=reader, args=(item["name"], process), daemon=True)
        t.start()
        threads.append(t)

    logger.info("Services started. Press Ctrl+C to stop.")

    while True:
        try:
            name, line = q.get(timeout=0.2)
            logger.info(f"{name}: {line}")
        except queue.Empty:
            pass

        for item, process in zip(services, processes, strict=True):
            assert isinstance(item, dict)
            code = process.poll()
            if code is not None:
                if code == 0:
                    logger.warn(f"Service exited: {item['name']} (code={code})")
                else:
                    logger.fail(f"Service crashed: {item['name']} (code={code})")
                return 1


def run_command(args: argparse.Namespace) -> int:
    profile = profile_runtime.active_profile(ROOT)
    try:
        config = load_runtime_config(
            profile,
            project_root=ROOT,
            cli_overrides={
                "FRONTEND_HOST": getattr(args, "frontend_host", None),
                "FRONTEND_PORT": getattr(args, "frontend_port", None),
                "BACKEND_HOST": getattr(args, "backend_host", None),
                "BACKEND_PORT": getattr(args, "backend_port", None),
            },
        )
    except (ConfigLoadError, ConfigValidationError) as exc:
        logger.fail(f"Invalid runtime configuration: {exc}")
        return 1

    preflight_errors = _preflight(config)
    if preflight_errors:
        for err in preflight_errors:
            logger.fail(err)
        return 1

    services, errors = _build_service_defs(config)
    if errors:
        for err in errors:
            logger.fail(err)
        return 1

    if args.detach:
        try:
            processes, payload = _start_detached(services)
        except (
            FilesystemSafetyError,
            OSError,
            RuntimeError,
            ValueError,
            subprocess.SubprocessError,
        ) as exc:
            logger.fail(f"Could not start services safely: {exc}")
            return 1
        time.sleep(2)

        service_states = payload["services"]
        assert isinstance(service_states, list)
        for item, process in zip(service_states, processes, strict=True):
            assert isinstance(item, dict)
            code = process.poll()
            if code is not None:
                logger.fail(f"Service failed early: {item['name']} (code={code})")
                _stop_from_state(print_output=False)
                return 1

        logger.ok("Services started in detached mode")
        for item in service_states:
            assert isinstance(item, dict)
            logger.ok(
                f"service:{item['name']:<9} pid={item['pid']} port={item['port']} log={item['log_file']}"
            )
        return 0

    try:
        processes, payload = _start_foreground(services)
    except (
        FilesystemSafetyError,
        OSError,
        RuntimeError,
        ValueError,
        subprocess.SubprocessError,
    ) as exc:
        logger.fail(f"Could not start services safely: {exc}")
        return 1
    try:
        return _stream_foreground(payload, processes)
    except KeyboardInterrupt:
        logger.warn("Interrupted by user")
        return 0
    finally:
        _stop_from_state(print_output=True)


def stop_command(args: argparse.Namespace) -> int:
    _ = args
    return _stop_from_state(print_output=True)
