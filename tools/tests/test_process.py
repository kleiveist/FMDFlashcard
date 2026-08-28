from __future__ import annotations

import io
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest

from tools import process


def test_run_bounded_retains_only_the_output_tail(tmp_path: Path) -> None:
    completed = process.run_bounded(
        (
            sys.executable,
            "-c",
            "import sys; sys.stdout.write('a'*200000); sys.stderr.write('b'*200000)",
        ),
        cwd=tmp_path,
        env=os.environ.copy(),
        timeout=10,
        output_limit=4096,
    )

    assert completed.returncode == 0
    assert completed.stdout.startswith("<output truncated;")
    assert completed.stderr.startswith("<output truncated;")
    assert completed.stdout.endswith("a" * 4096)
    assert completed.stderr.endswith("b" * 4096)


@pytest.mark.skipif(os.name == "nt", reason="POSIX process-group assertion")
def test_run_bounded_timeout_terminates_descendants(tmp_path: Path) -> None:
    marker = tmp_path / "descendant-survived"
    descendant = (
        "import pathlib,signal,time;"
        "signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(1.5);"
        f"pathlib.Path({str(marker)!r}).write_text('unsafe',encoding='utf-8')"
    )
    parent = (
        "import subprocess,sys,time;"
        f"subprocess.Popen([sys.executable,'-c',{descendant!r}]);"
        "time.sleep(10)"
    )

    with pytest.raises(subprocess.TimeoutExpired):
        process.run_bounded(
            (sys.executable, "-c", parent),
            cwd=tmp_path,
            env=os.environ.copy(),
            timeout=1,
        )
    time.sleep(1)

    assert not marker.exists()


class _FakePosixProcess:
    def __init__(self) -> None:
        self.pid = 4242
        self.returncode: int | None = None

    def wait(self, timeout: float | None = None) -> int:
        self.returncode = -signal.SIGTERM
        return self.returncode

    def poll(self) -> int | None:
        return self.returncode

    def kill(self) -> None:
        raise AssertionError("leader fallback must not run after the leader exited")


def test_posix_group_permission_error_is_ignored_after_all_members_exit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakePosixProcess()

    def fake_killpg(_group_id: int, requested_signal: int) -> None:
        if requested_signal == signal.SIGKILL:
            raise PermissionError("synthetic empty-group race")

    monkeypatch.setattr(process.os, "name", "posix")
    monkeypatch.setattr(process.signal, "SIGKILL", 9, raising=False)
    monkeypatch.setattr(process.os, "killpg", fake_killpg, raising=False)
    monkeypatch.setattr(process, "_process_group_has_live_member", lambda _group: False)

    process._terminate_process_group(fake)


def test_posix_group_permission_error_is_not_hidden_for_a_live_member(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake = _FakePosixProcess()

    def fake_killpg(_group_id: int, requested_signal: int) -> None:
        if requested_signal == signal.SIGKILL:
            raise PermissionError("synthetic live-group refusal")

    monkeypatch.setattr(process.os, "name", "posix")
    monkeypatch.setattr(process.signal, "SIGKILL", 9, raising=False)
    monkeypatch.setattr(process.os, "killpg", fake_killpg, raising=False)
    monkeypatch.setattr(process, "_process_group_has_live_member", lambda _group: True)

    with pytest.raises(PermissionError, match="live-group refusal"):
        process._terminate_process_group(fake)


def test_process_group_live_member_query_ignores_zombies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    command = ["/bin/ps", "-ax", "-o", "pgid=", "-o", "stat="]
    monkeypatch.setattr(process.shutil, "which", lambda *_args, **_kwargs: command[0])
    monkeypatch.setattr(
        process.subprocess,
        "run",
        lambda actual, **_kwargs: subprocess.CompletedProcess(
            actual,
            0,
            stdout="4242 Z+\n4243 S+\n",
            stderr="",
        ),
    )

    assert process._process_group_has_live_member(4242) is False
    assert process._process_group_has_live_member(4243) is True


@pytest.mark.skipif(sys.platform != "win32", reason="Windows Job Object assertion")
def test_run_bounded_windows_job_terminates_descendants(tmp_path: Path) -> None:
    marker = tmp_path / "windows-descendant-survived"
    descendant = (
        "import pathlib,time;time.sleep(2);"
        f"pathlib.Path({str(marker)!r}).write_text('unsafe',encoding='utf-8')"
    )
    parent = (
        f"import subprocess,sys;subprocess.Popen([sys.executable,'-c',{descendant!r}])"
    )

    completed = process.run_bounded(
        (sys.executable, "-c", parent),
        cwd=tmp_path,
        env=os.environ.copy(),
        timeout=5,
    )
    time.sleep(2)

    assert completed.returncode == 0
    assert not marker.exists()


def test_prepare_command_keeps_native_executable(monkeypatch) -> None:
    monkeypatch.setattr(process.sys, "platform", "win32")

    command = [r"C:\Python311\python.exe", "--version"]

    assert process.prepare_command(command) is command


def test_prepare_command_routes_windows_batch_launcher_through_system_cmd(
    monkeypatch,
) -> None:
    monkeypatch.setattr(process.sys, "platform", "win32")
    monkeypatch.setattr(
        process,
        "_windows_system_command_processor",
        lambda: r"C:\Windows\System32\cmd.exe",
    )

    prepared = process.prepare_command(
        [r"C:\Program Files\nodejs\npm.cmd", "ci", "--no-audit"]
    )

    assert prepared == [
        r"C:\Windows\System32\cmd.exe",
        "/d",
        "/s",
        "/c",
        "call",
        r"C:\Program Files\nodejs\npm.cmd",
        "ci",
        "--no-audit",
    ]


def test_prepare_command_rejects_windows_batch_metacharacters(monkeypatch) -> None:
    monkeypatch.setattr(process.sys, "platform", "win32")
    monkeypatch.setattr(
        process,
        "_windows_system_command_processor",
        lambda: r"C:\Windows\System32\cmd.exe",
    )

    with pytest.raises(ValueError, match="unsafe cmd.exe metacharacters"):
        process.prepare_command([r"C:\safe&whoami\npm.cmd", "ci"])


def test_prepare_command_ignores_hostile_windows_path_environment(monkeypatch) -> None:
    monkeypatch.setattr(process.sys, "platform", "win32")
    monkeypatch.setattr(
        process,
        "_windows_system_command_processor",
        lambda: r"C:\Windows\System32\cmd.exe",
    )

    prepared = process.prepare_command(
        [r"C:\Program Files\nodejs\npm.cmd", "ci"],
        environment={
            "COMSPEC": r"C:\attacker\cmd.exe",
            "SYSTEMROOT": r"C:\attacker",
        },
    )

    assert prepared[0] == r"C:\Windows\System32\cmd.exe"


def test_safe_platform_environment_replaces_hostile_windows_process_paths(
    monkeypatch,
) -> None:
    monkeypatch.setattr(process.os, "name", "nt")
    monkeypatch.setattr(
        process,
        "_windows_system_command_processor",
        lambda: r"C:\Windows\System32\cmd.exe",
    )

    environment = process.safe_platform_environment(
        {
            "COMSPEC": r"C:\attacker\cmd.exe",
            "SYSTEMROOT": r"C:\attacker",
            "WINDIR": r"C:\attacker",
            "PATHEXT": ".EVIL",
            "LANG": "C.UTF-8",
            "SECRET_TOKEN": "do-not-copy",
        }
    )

    assert environment == {
        "COMSPEC": r"C:\Windows\System32\cmd.exe",
        "SYSTEMROOT": r"C:\Windows",
        "WINDIR": r"C:\Windows",
        "PATHEXT": ".COM;.EXE;.BAT;.CMD",
        "LANG": "C.UTF-8",
    }


class _FakeWindowsProcess:
    def __init__(self, events: list[str], *, kill_fails: bool = False) -> None:
        self.events = events
        self.kill_fails = kill_fails
        self.pid = 4242
        self._handle = 84
        self.stdout = io.BytesIO()
        self.stderr = io.BytesIO()
        self.returncode: int | None = None

    def wait(self, timeout: float | None = None) -> int:
        self.events.append(f"wait:{timeout}")
        self.returncode = 0
        return 0

    def poll(self) -> int | None:
        return self.returncode

    def send_signal(self, _signal: int) -> None:
        self.events.append("signal")
        raise OSError("synthetic signal failure")

    def kill(self) -> None:
        self.events.append("kill")
        if self.kill_fails:
            raise OSError("synthetic kill failure")
        self.returncode = -9


def _mock_windows_process_start(
    monkeypatch: pytest.MonkeyPatch,
    events: list[str],
    fake: _FakeWindowsProcess,
) -> None:
    monkeypatch.setattr(process.os, "name", "nt")
    monkeypatch.setattr(
        process.subprocess, "CREATE_NEW_PROCESS_GROUP", 0x200, raising=False
    )
    monkeypatch.setattr(process.subprocess, "CREATE_SUSPENDED", 0x4, raising=False)
    monkeypatch.setattr(
        process,
        "_create_windows_kill_job",
        lambda: events.append("create-job") or 7,
    )

    def fake_popen(*_args: object, **kwargs: object) -> _FakeWindowsProcess:
        assert kwargs["creationflags"] == 0x204
        events.append("popen-suspended")
        return fake

    monkeypatch.setattr(process.subprocess, "Popen", fake_popen)
    monkeypatch.setattr(
        process,
        "_assign_windows_job",
        lambda _handle, _child: events.append("assign-job"),
    )
    monkeypatch.setattr(
        process,
        "_resume_windows_process",
        lambda _pid: events.append("resume-process"),
    )
    monkeypatch.setattr(
        process,
        "_close_windows_handle",
        lambda _handle: events.append("close-job"),
    )


def test_windows_process_is_suspended_assigned_then_resumed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    fake = _FakeWindowsProcess(events)
    _mock_windows_process_start(monkeypatch, events, fake)

    completed = process.run_bounded(
        (sys.executable, "--version"),
        cwd=tmp_path,
        env={},
        timeout=5,
    )

    assert completed.returncode == 0
    assert events[:4] == [
        "create-job",
        "popen-suspended",
        "assign-job",
        "resume-process",
    ]
    assert events.count("close-job") == 1


def test_windows_assignment_failure_closes_job_even_when_kill_fails(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    fake = _FakeWindowsProcess(events, kill_fails=True)
    _mock_windows_process_start(monkeypatch, events, fake)

    def fail_assignment(_handle: int, _child: object) -> None:
        raise RuntimeError("synthetic assignment failure")

    monkeypatch.setattr(process, "_assign_windows_job", fail_assignment)

    with pytest.raises(RuntimeError, match="assignment failure"):
        process.run_bounded(
            (sys.executable, "--version"),
            cwd=tmp_path,
            env={},
            timeout=5,
        )

    assert events.count("close-job") == 1
    assert "kill" in events
    assert fake.stdout.closed and fake.stderr.closed


def test_windows_popen_failure_still_closes_job(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    fake = _FakeWindowsProcess(events)
    _mock_windows_process_start(monkeypatch, events, fake)

    def fail_popen(*_args: object, **_kwargs: object) -> None:
        raise OSError("synthetic popen failure")

    monkeypatch.setattr(process.subprocess, "Popen", fail_popen)

    with pytest.raises(OSError, match="popen failure"):
        process.run_bounded(
            (sys.executable, "--version"),
            cwd=tmp_path,
            env={},
            timeout=5,
        )

    assert events.count("close-job") == 1


def test_windows_reader_start_failure_still_closes_job_and_process(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    fake = _FakeWindowsProcess(events)
    _mock_windows_process_start(monkeypatch, events, fake)

    class _BrokenThread:
        def __init__(self, **_kwargs: object) -> None:
            pass

        def start(self) -> None:
            raise RuntimeError("synthetic reader failure")

        def join(self, *, timeout: float) -> None:
            events.append(f"join:{timeout}")

    monkeypatch.setattr(process.threading, "Thread", _BrokenThread)

    with pytest.raises(RuntimeError, match="reader failure"):
        process.run_bounded(
            (sys.executable, "--version"),
            cwd=tmp_path,
            env={},
            timeout=5,
        )

    assert events.count("close-job") == 1
    assert fake.returncode is not None
    assert fake.stdout.closed and fake.stderr.closed


def test_windows_close_failure_does_not_skip_stream_cleanup(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    fake = _FakeWindowsProcess(events)
    _mock_windows_process_start(monkeypatch, events, fake)
    monkeypatch.setattr(
        process,
        "_close_windows_handle",
        lambda _handle: (_ for _ in ()).throw(OSError("synthetic close failure")),
    )

    with pytest.raises(OSError, match="close failure"):
        process.run_bounded(
            (sys.executable, "--version"),
            cwd=tmp_path,
            env={},
            timeout=5,
        )

    assert fake.stdout.closed and fake.stderr.closed


def test_linux_process_start_token_combines_boot_and_start_ticks(monkeypatch) -> None:
    fields = ["S", *[str(value) for value in range(4, 23)]]
    fields[19] = "987654"

    def fake_read_text(path: Path, encoding: str) -> str:
        assert encoding == "utf-8"
        if path.name == "stat":
            return f"4242 (npm worker) {' '.join(fields)}"
        if path.name == "boot_id":
            return "test-boot-id\n"
        raise AssertionError(path)

    monkeypatch.setattr(process.Path, "read_text", fake_read_text)

    assert process._linux_process_start_token(4242) == "linux:test-boot-id:987654"
    assert process._linux_process_start_token(4242) == "linux:test-boot-id:987654"


def test_process_start_token_uses_platform_query_when_proc_is_unavailable(
    monkeypatch,
) -> None:
    command = ["ps", "-p", "4242", "-o", "lstart="]
    monkeypatch.setattr(process.sys, "platform", "darwin")
    monkeypatch.setattr(
        process, "_process_start_query", lambda _pid: (command, "darwin")
    )
    monkeypatch.setattr(
        process.subprocess,
        "run",
        lambda actual, **_kwargs: subprocess.CompletedProcess(
            actual, 0, stdout="Mon Aug 24 19:50:04 2026\n", stderr=""
        ),
    )

    assert process.process_start_token(4242) == "darwin:Mon Aug 24 19:50:04 2026"


@pytest.mark.skipif(
    sys.platform != "win32", reason="requires the Windows command interpreter"
)
def test_prepare_command_executes_batch_launcher_with_spaced_path_and_arguments(
    tmp_path: Path,
) -> None:
    launcher_dir = tmp_path / "launcher path with spaces"
    launcher_dir.mkdir()
    launcher = launcher_dir / "argument probe.cmd"
    launcher.write_text(
        '@echo off\r\n<nul set /p "=[%~1]|[%~2]"\r\nexit /b 0\r\n', encoding="utf-8"
    )

    completed = subprocess.run(
        process.prepare_command([str(launcher), "first value", "second value"]),
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr
    assert completed.stdout == "[first value]|[second value]"
