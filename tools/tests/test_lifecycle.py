from __future__ import annotations

import argparse
import json
from pathlib import Path

import pytest

from tools.commands import lifecycle
from tools.paths import project_paths


def _state(tmp_path: Path) -> tuple[object, Path]:
    paths = project_paths(tmp_path)
    paths.runtime.mkdir(parents=True)
    state = paths.runtime / lifecycle.STATE_NAME
    state.write_text(
        json.dumps(
            {
                "schema_version": lifecycle.STATE_SCHEMA_VERSION,
                "pid": 4242,
                "process_group_id": 4242,
                "process_start_token": "recorded-token",
                "expected_argv": list(lifecycle.EXPECTED_TAIL),
                "repository_root": str(paths.root),
            }
        ),
        encoding="utf-8",
    )
    return paths, state


def test_run_dry_run_creates_no_runtime_state(tmp_path: Path) -> None:
    paths = project_paths(tmp_path)
    args = argparse.Namespace(dry_run=True, foreground=False, no_follow=False)
    assert lifecycle.run(args, paths=paths) == 0
    assert not paths.state.exists()


def test_stop_refuses_reused_pid_without_signalling(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths, state = _state(tmp_path)
    monkeypatch.setattr(lifecycle, "is_process_alive", lambda _pid: True)
    monkeypatch.setattr(lifecycle, "process_start_token", lambda _pid: "different-token")
    monkeypatch.setattr(
        lifecycle,
        "_signal_process_tree",
        lambda *_args, **_kwargs: pytest.fail("must not signal"),
    )
    assert lifecycle.stop(argparse.Namespace(), paths=paths) == 1
    assert state.is_file()


def test_stop_removes_only_stale_owned_state(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    paths, state = _state(tmp_path)
    monkeypatch.setattr(lifecycle, "is_process_alive", lambda _pid: False)
    monkeypatch.setattr(
        lifecycle,
        "_signal_process_tree",
        lambda *_args, **_kwargs: pytest.fail("must not signal"),
    )
    assert lifecycle.stop(argparse.Namespace(), paths=paths) == 0
    assert not state.exists()


def test_stop_rejects_symlink_state(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    paths = project_paths(tmp_path)
    paths.runtime.mkdir(parents=True)
    outside = tmp_path / "outside.json"
    outside.write_text("{}", encoding="utf-8")
    (paths.runtime / lifecycle.STATE_NAME).symlink_to(outside)
    monkeypatch.setattr(
        lifecycle,
        "_signal_process_tree",
        lambda *_args, **_kwargs: pytest.fail("must not signal"),
    )
    assert lifecycle.stop(argparse.Namespace(), paths=paths) == 1
    assert outside.read_text(encoding="utf-8") == "{}"


def test_signal_process_tree_rejects_invalid_identity(tmp_path: Path) -> None:
    paths = project_paths(tmp_path)
    with pytest.raises(lifecycle.LifecycleError, match="invalid process identity"):
        lifecycle._signal_process_tree(0, 4242, force=False, paths=paths)


@pytest.mark.skipif(lifecycle.os.name == "nt", reason="POSIX process groups require POSIX")
def test_signal_process_tree_uses_posix_process_group(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    observed: list[tuple[int, int]] = []
    monkeypatch.setattr(
        lifecycle.os,
        "killpg",
        lambda group, sig: observed.append((group, sig)),
    )

    assert (
        lifecycle._signal_process_tree(
            4242,
            4343,
            force=True,
            paths=project_paths(tmp_path),
        )
        == 0
    )
    assert observed == [(4343, lifecycle.signal.SIGKILL)]


@pytest.mark.skipif(lifecycle.os.name != "nt", reason="taskkill requires Windows")
def test_signal_process_tree_uses_windows_taskkill(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths = project_paths(tmp_path)
    observed: list[tuple[list[str], Path]] = []

    def fake_run(command: list[str], *, cwd: Path) -> argparse.Namespace:
        observed.append((command, cwd))
        return argparse.Namespace(returncode=0)

    monkeypatch.setattr(lifecycle, "run_command", fake_run)

    assert lifecycle._signal_process_tree(4242, 4242, force=True, paths=paths) == 0
    assert observed == [(["taskkill", "/PID", "4242", "/T", "/F"], paths.root)]
