from __future__ import annotations

import io
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from tools.config import RuntimeConfig
from tools.core.filesystem import FilesystemSafetyError
from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    create_project_config,
)
from tools.inst import run
from tools.profiles.model import ProjectProfile


class _FakeProcess:
    def __init__(self, pid: int, *, stdout: io.StringIO | None = None) -> None:
        self.pid = pid
        self.stdout = stdout
        self._running = True

    def poll(self) -> int | None:
        return None if self._running else 0

    def terminate(self) -> None:
        self._running = False

    def kill(self) -> None:
        self._running = False

    def wait(self, timeout: int | None = None) -> int:
        _ = timeout
        self._running = False
        return 0


def _profile(*features: str) -> ProjectProfile:
    return ProjectProfile(
        1, "test-profile", "Test profile", "Test service profile", features
    )


def _config() -> RuntimeConfig:
    return RuntimeConfig(
        app_env="test",
        app_name="Test App",
        frontend_host="127.0.0.1",
        frontend_port=5173,
        vite_api_base_url="http://127.0.0.1:8000",
        backend_host="127.0.0.1",
        backend_port=8000,
        backend_cors_origins=("http://127.0.0.1:5173",),
    )


def _write_project_config(root: Path, *, frontend: str, backend: str) -> None:
    create_project_config(
        root / "project-tooling.toml",
        ProjectConfig(
            tooling_version="1.0.0",
            project_name="Test Project",
            profile="desktop-cloud",
            paths=ProjectPathConfig(frontend=frontend, backend=backend),
        ),
    )


def test_service_builders_preserve_frontend_and_backend_commands(
    monkeypatch, tmp_path: Path
) -> None:
    frontend = tmp_path / "client"
    backend = tmp_path / "services" / "api"
    frontend.mkdir()
    (frontend / "package.json").write_text("{}\n", encoding="utf-8")
    (backend / "app").mkdir(parents=True)
    (backend / "app" / "main.py").write_text("\n", encoding="utf-8")
    backend_python = backend / ".venv" / "bin" / "python"
    backend_python.parent.mkdir(parents=True)
    backend_python.touch()
    _write_project_config(tmp_path, frontend="client", backend="services/api")

    monkeypatch.setattr(run, "ROOT", tmp_path)
    monkeypatch.setattr(
        run.profile_runtime,
        "active_profile",
        lambda _root: _profile("frontend", "backend"),
    )
    monkeypatch.setattr(
        run.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(
        run.subprocess,
        "run",
        lambda command, **_kwargs: subprocess.CompletedProcess(
            command, 0, stdout="", stderr=""
        ),
    )

    services, errors = run._build_service_defs(_config())

    assert errors == []
    assert [service.name for service in services] == ["frontend", "backend"]
    assert services[0].command == [
        "/usr/bin/npm",
        "run",
        "dev",
        "--",
        "--host",
        "127.0.0.1",
        "--port",
        "5173",
    ]
    assert services[1].command[:4] == [
        str(backend_python),
        "-m",
        "uvicorn",
        "app.main:app",
    ]
    assert [service.cwd for service in services] == [frontend, backend]


def test_backend_builder_reports_missing_python_without_probing_directory(
    monkeypatch, tmp_path: Path
) -> None:
    (tmp_path / "backend" / "app").mkdir(parents=True)
    (tmp_path / "backend" / "app" / "main.py").write_text("\n", encoding="utf-8")
    _write_project_config(tmp_path, frontend="frontend", backend="backend")
    monkeypatch.setattr(run, "ROOT", tmp_path)
    monkeypatch.setattr(
        run.profile_runtime, "active_profile", lambda _root: _profile("backend")
    )
    monkeypatch.setattr(run.shutil, "which", lambda _name: None)
    monkeypatch.setattr(
        run.subprocess,
        "run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("runtime probe must not run")
        ),
    )

    services, errors = run._build_service_defs(_config())

    assert services == []
    assert errors == ["Python executable not found for backend service."]


def test_service_state_records_process_start_identity(
    monkeypatch, tmp_path: Path
) -> None:
    service = run.ServiceDef(
        "frontend",
        ["npm", "run", "dev", "--", "--port", "5173"],
        tmp_path,
        5173,
        "127.0.0.1",
        {},
    )
    monkeypatch.setattr(
        run, "process_start_token", lambda pid: f"linux:test-boot:{pid}"
    )

    state = run._service_state(
        service,
        SimpleNamespace(pid=4242),
        ".tooling-state/runtime/logs/frontend.log",
    )

    assert state["process_start_token"] == "linux:test-boot:4242"
    assert state["process_group_id"] == 4242


def test_runtime_state_write_rejects_symlink_destination(
    monkeypatch, tmp_path: Path
) -> None:
    runtime_dir = tmp_path / ".tooling-state" / "runtime"
    runtime_dir.mkdir(parents=True)
    external = tmp_path / "external-state.json"
    external.write_text("unchanged\n", encoding="utf-8")
    (runtime_dir / "run_state.json").symlink_to(external)
    monkeypatch.setattr(run, "ROOT", tmp_path)

    with pytest.raises(FilesystemSafetyError):
        run._write_state({"services": []})

    assert external.read_text(encoding="utf-8") == "unchanged\n"


def test_run_cleanup_refuses_stale_process_identity(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(run, "ROOT", tmp_path)
    run._write_state(
        {
            "created_at": 1_700_000_000,
            "services": [
                {
                    "name": "backend",
                    "pid": 4242,
                    "port": 8000,
                    "command": [
                        "python",
                        "-m",
                        "uvicorn",
                        "app.main:app",
                        "--port",
                        "8000",
                    ],
                    "process_start_token": "linux:old",
                    "process_group_id": 4242,
                }
            ]
        }
    )
    signals: list[int] = []
    monkeypatch.setattr(run.safe_stop, "_is_process_alive", lambda _pid: True)
    monkeypatch.setattr(
        run.safe_stop,
        "_tracked_identity_matches",
        lambda _service, _pid: (False, "process start identity does not match"),
    )
    monkeypatch.setattr(
        run.safe_stop,
        "_terminate_tracked_service",
        lambda _service, pid: signals.append(pid) or True,
    )

    assert run._stop_from_state(print_output=False) == 1
    assert signals == []
    retained = json.loads(run._state_file().read_text(encoding="utf-8"))
    assert [item["pid"] for item in retained["services"]] == [4242]


def test_runtime_state_schema_rejects_scalar_and_keeps_source(
    monkeypatch, tmp_path: Path
) -> None:
    state_file = tmp_path / ".tooling-state" / "runtime" / "run_state.json"
    state_file.parent.mkdir(parents=True)
    state_file.write_text("1\n", encoding="utf-8")
    monkeypatch.setattr(run, "ROOT", tmp_path)

    state = run._read_state()

    assert state == {"_invalid_runtime_state": "runtime state must be a JSON object"}
    assert run._state_has_live_processes() is True
    assert run._stop_from_state(print_output=False) == 1
    assert state_file.read_text(encoding="utf-8") == "1\n"


def test_detached_partial_start_rolls_back_process_and_closes_logs_on_baseexception(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(run, "ROOT", tmp_path)
    monkeypatch.setattr(run, "process_start_token", lambda pid: f"token:{pid}")
    services = [
        run.ServiceDef("one", ["python", "one.py"], tmp_path, 8101, "127.0.0.1", {}),
        run.ServiceDef("two", ["python", "two.py"], tmp_path, 8102, "127.0.0.1", {}),
    ]
    opened_logs: list[object] = []
    first = _FakeProcess(4101)
    spawn_count = 0

    def fake_popen(*_args, **kwargs):
        nonlocal spawn_count
        opened_logs.append(kwargs["stdout"])
        spawn_count += 1
        if spawn_count == 2:
            raise KeyboardInterrupt
        return first

    rolled_back: list[int] = []
    monkeypatch.setattr(run.subprocess, "Popen", fake_popen)
    monkeypatch.setattr(
        run.safe_stop,
        "_terminate_tracked_service",
        lambda _service, pid: rolled_back.append(pid) or True,
    )

    with pytest.raises(KeyboardInterrupt):
        run._start_detached(services)

    assert rolled_back == [4101]
    assert all(handle.closed for handle in opened_logs)
    assert not run._state_file().exists()


def test_foreground_state_write_baseexception_rolls_back_all_processes_and_pipes(
    monkeypatch, tmp_path: Path
) -> None:
    class StateWriteAbort(BaseException):
        pass

    monkeypatch.setattr(run, "ROOT", tmp_path)
    monkeypatch.setattr(run, "process_start_token", lambda pid: f"token:{pid}")
    services = [
        run.ServiceDef("one", ["python", "one.py"], tmp_path, 8101, "127.0.0.1", {}),
        run.ServiceDef("two", ["python", "two.py"], tmp_path, 8102, "127.0.0.1", {}),
    ]
    processes = [
        _FakeProcess(4201, stdout=io.StringIO()),
        _FakeProcess(4202, stdout=io.StringIO()),
    ]
    spawned = iter(processes)
    monkeypatch.setattr(run.subprocess, "Popen", lambda *_args, **_kwargs: next(spawned))
    monkeypatch.setattr(
        run, "_write_state", lambda _payload: (_ for _ in ()).throw(StateWriteAbort())
    )
    rolled_back: list[int] = []
    monkeypatch.setattr(
        run.safe_stop,
        "_terminate_tracked_service",
        lambda _service, pid: rolled_back.append(pid) or True,
    )

    with pytest.raises(StateWriteAbort):
        run._start_foreground(services)

    assert rolled_back == [4202, 4201]
    assert all(process.stdout is not None and process.stdout.closed for process in processes)
