from __future__ import annotations

from pathlib import Path
from typing import cast

import pytest

from tools.core.filesystem import FilesystemSafetyError
from tools.tauri import paths, run


def _payload(*, token: str = "linux:test-boot:100") -> dict[str, object]:
    return {
        "schema_version": 1,
        "pid": 4242,
        "argv": ["tauri", "dev", "--config", "{}"],
        "process_start_token": token,
        "process_group_id": 4242,
        "log": ".tooling-state/runtime/tauri/logs/tauri.log",
    }


def _configure_runtime(monkeypatch, tmp_path: Path) -> Path:
    runtime_dir = tmp_path / ".tooling-state" / "runtime" / "tauri"
    (runtime_dir / "logs").mkdir(parents=True)
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    return runtime_dir


def test_detached_state_captures_pid_reuse_safe_identity(
    monkeypatch, tmp_path: Path
) -> None:
    _configure_runtime(monkeypatch, tmp_path)

    class FakeProcess:
        pid = 4242

    monkeypatch.setattr(
        run, "process_start_token", lambda _pid: "linux:test-boot:100"
    )
    monkeypatch.setattr(run, "_process_group_id", lambda _pid: 4242)

    state = run._state_for_process(
        cast("run.subprocess.Popen", FakeProcess()),
        ["tauri", "dev", "--config", "{}"],
        tmp_path / ".tooling-state/runtime/tauri/logs/tauri.log",
    )

    assert state == _payload()


def test_state_write_failure_terminates_just_started_process_and_closes_log(
    monkeypatch, tmp_path: Path
) -> None:
    _configure_runtime(monkeypatch, tmp_path)
    terminated: list[int] = []

    class FakeLog:
        closed = False

        def write(self, _value: str) -> int:
            return 0

        def flush(self) -> None:
            pass

        def close(self) -> None:
            self.closed = True

    class FakeProcess:
        pid = 4242

    log = FakeLog()
    monkeypatch.setattr(run, "_ensure_runtime_dir", lambda: tmp_path)
    monkeypatch.setattr(
        run,
        "_ensure_log_dir",
        lambda: tmp_path / ".tooling-state/runtime/tauri/logs",
    )
    monkeypatch.setattr(run, "_open_log", lambda *_args, **_kwargs: log)
    monkeypatch.setattr(run.subprocess, "Popen", lambda *_args, **_kwargs: FakeProcess())
    monkeypatch.setattr(run, "_state_for_process", lambda *_args: _payload())
    monkeypatch.setattr(
        run,
        "_write_detached_state",
        lambda _state: (_ for _ in ()).throw(FilesystemSafetyError("unsafe state")),
    )
    monkeypatch.setattr(
        run,
        "_terminate_process_group",
        lambda process: terminated.append(process.pid) or True,
    )

    with pytest.raises(FilesystemSafetyError, match="unsafe state"):
        run._run_detached(["tauri", "dev"], follow=False)

    assert log.closed is True
    assert terminated == [4242]


def test_popen_failure_closes_log_handle(monkeypatch, tmp_path: Path) -> None:
    _configure_runtime(monkeypatch, tmp_path)

    class FakeLog:
        closed = False

        def write(self, _value: str) -> int:
            return 0

        def flush(self) -> None:
            pass

        def close(self) -> None:
            self.closed = True

    log = FakeLog()
    monkeypatch.setattr(run, "_ensure_runtime_dir", lambda: tmp_path)
    monkeypatch.setattr(
        run,
        "_ensure_log_dir",
        lambda: tmp_path / ".tooling-state/runtime/tauri/logs",
    )
    monkeypatch.setattr(run, "_open_log", lambda *_args, **_kwargs: log)
    monkeypatch.setattr(
        run.subprocess,
        "Popen",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(OSError("spawn failed")),
    )

    with pytest.raises(OSError, match="spawn failed"):
        run._run_detached(["tauri", "dev"], follow=False)

    assert log.closed is True


def test_stop_never_signals_reused_pid(monkeypatch, tmp_path: Path) -> None:
    runtime_dir = _configure_runtime(monkeypatch, tmp_path)
    run._write_detached_state(_payload())
    signals: list[tuple[int, int]] = []
    monkeypatch.setattr(run, "_is_process_alive", lambda _pid: True)
    monkeypatch.setattr(
        run, "process_start_token", lambda _pid: "linux:test-boot:999"
    )
    monkeypatch.setattr(
        run,
        "_read_process_argv",
        lambda _pid: (_ for _ in ()).throw(
            AssertionError("argv must not be read after token mismatch")
        ),
    )
    monkeypatch.setattr(
        run.os,
        "killpg",
        lambda group, sig: signals.append((group, sig)),
        raising=False,
    )

    assert run.stop() == 1
    assert signals == []
    assert (runtime_dir / "tauri_run_state.json").is_file()


def test_stop_never_signals_process_with_different_argv(
    monkeypatch, tmp_path: Path
) -> None:
    runtime_dir = _configure_runtime(monkeypatch, tmp_path)
    run._write_detached_state(_payload())
    signals: list[tuple[int, int]] = []
    monkeypatch.setattr(run, "_is_process_alive", lambda _pid: True)
    monkeypatch.setattr(
        run, "process_start_token", lambda _pid: "linux:test-boot:100"
    )
    monkeypatch.setattr(
        run,
        "_read_process_argv",
        lambda _pid: ("python", "unrelated-service.py", "--config", "{}"),
    )
    monkeypatch.setattr(
        run.os,
        "killpg",
        lambda group, sig: signals.append((group, sig)),
        raising=False,
    )

    assert run.stop() == 1
    assert signals == []
    assert (runtime_dir / "tauri_run_state.json").is_file()


def test_stop_refuses_symlink_state_without_signaling(
    monkeypatch, tmp_path: Path
) -> None:
    runtime_dir = _configure_runtime(monkeypatch, tmp_path)
    external = tmp_path / "external.json"
    external.write_text("{}\n", encoding="utf-8")
    (runtime_dir / "tauri_run_state.json").symlink_to(external)
    signals: list[tuple[int, int]] = []
    monkeypatch.setattr(
        run.os,
        "killpg",
        lambda group, sig: signals.append((group, sig)),
        raising=False,
    )

    assert run.stop() == 1
    assert signals == []
    assert external.read_text(encoding="utf-8") == "{}\n"


def test_successful_stop_removes_only_matching_state(
    monkeypatch, tmp_path: Path
) -> None:
    runtime_dir = _configure_runtime(monkeypatch, tmp_path)
    state = _payload()
    run._write_detached_state(state)
    monkeypatch.setattr(run, "_is_process_alive", lambda _pid: True)
    monkeypatch.setattr(
        run, "_terminate_tracked_state", lambda current: (current == state, "done")
    )

    assert run.stop() == 0
    assert not (runtime_dir / "tauri_run_state.json").exists()


def test_followed_process_exit_clears_its_state(
    monkeypatch, tmp_path: Path
) -> None:
    runtime_dir = _configure_runtime(monkeypatch, tmp_path)

    class FakeProcess:
        pid = 4242

    monkeypatch.setattr(run, "_ensure_runtime_dir", lambda: runtime_dir)
    monkeypatch.setattr(run, "_ensure_log_dir", lambda: runtime_dir / "logs")
    monkeypatch.setattr(run.subprocess, "Popen", lambda *_args, **_kwargs: FakeProcess())
    monkeypatch.setattr(
        run, "process_start_token", lambda _pid: "linux:test-boot:100"
    )
    monkeypatch.setattr(run, "_process_group_id", lambda _pid: 4242)

    def fake_follow(_log_path: Path, _process: object) -> int:
        assert (runtime_dir / "tauri_run_state.json").is_file()
        return 0

    monkeypatch.setattr(run, "_follow_log", fake_follow)

    assert run._run_detached(["tauri", "dev"], follow=True) == 0
    assert not (runtime_dir / "tauri_run_state.json").exists()


def test_follow_log_refuses_symlink(monkeypatch, tmp_path: Path) -> None:
    real_log = tmp_path / "real.log"
    real_log.write_text("secret\n", encoding="utf-8")
    linked_log = tmp_path / "tauri.log"
    linked_log.symlink_to(real_log)

    class FakeProcess:
        pid = 4242

    with pytest.raises(FilesystemSafetyError):
        run._follow_log(linked_log, cast("run.subprocess.Popen", FakeProcess()))


def test_tauri_stop_handler_is_available_when_profile_disables_tauri(
    monkeypatch,
) -> None:
    from tools.tauri import control

    class Profile:
        profile_id = "web-only"

        @staticmethod
        def has_feature(_name: str) -> bool:
            return False

    stopped: list[bool] = []
    monkeypatch.setattr(control.profile_runtime, "active_profile", lambda _root: Profile())
    monkeypatch.setattr(run, "stop", lambda _args: stopped.append(True) or 0)

    parser = pytest.importorskip("tools.control")._build_parser()
    args = parser.parse_args(["tauri", "stop"])

    assert control.main(args) == 0
    assert stopped == [True]
