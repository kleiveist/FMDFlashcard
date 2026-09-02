from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from tools import process
from tools.paths import PathSafetyError, repository_root, require_within


def test_dry_run_does_not_start_subprocess(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: pytest.fail("must not run"))
    result = process.run_command(["example", "argument"], cwd=tmp_path, dry_run=True)
    assert result.returncode == 0
    assert result.dry_run is True
    assert result.command == ("example", "argument")


def test_child_return_code_is_preserved(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    observed: dict[str, object] = {}

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        observed.update(kwargs)
        return subprocess.CompletedProcess(command, 37, stdout="out", stderr="err")

    monkeypatch.setattr(subprocess, "run", fake_run)
    result = process.run_command(["example"], cwd=tmp_path)
    assert result.returncode == 37
    assert result.stdout == "out"
    assert result.stderr == "err"
    assert observed["shell"] is False
    assert observed["encoding"] == "utf-8"
    assert observed["errors"] == "replace"


def test_command_runner_reports_nonzero_exit(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    result = process.CommandResult(("example",), tmp_path, 3221225477)
    monkeypatch.setattr(process, "run_command", lambda *_args, **_kwargs: result)

    assert process.CommandRunner().run(["example"], cwd=tmp_path) == 3221225477
    assert "[FAIL] command exited with code 3221225477" in capsys.readouterr().err


def test_missing_executable_returns_127(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    def missing(*_args: object, **_kwargs: object) -> None:
        raise FileNotFoundError("missing")

    monkeypatch.setattr(subprocess, "run", missing)
    assert process.run_command(["missing"], cwd=tmp_path).returncode == 127


def test_invalid_argv_is_rejected() -> None:
    with pytest.raises(ValueError):
        process.prepare_command([])
    with pytest.raises(ValueError):
        process.prepare_command(["valid", ""])


def test_repository_root_is_independent_of_working_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.chdir(tmp_path)
    assert repository_root() == Path(__file__).resolve().parents[2]


def test_safe_path_boundary_rejects_escape_and_symlink_ancestor(tmp_path: Path) -> None:
    root = tmp_path / "checkout"
    root.mkdir()
    assert require_within(root, root / "safe" / "file.txt") == root / "safe" / "file.txt"
    with pytest.raises(PathSafetyError):
        require_within(root, tmp_path / "outside.txt")
    outside = tmp_path / "outside"
    outside.mkdir()
    (root / "linked").symlink_to(outside, target_is_directory=True)
    with pytest.raises(PathSafetyError):
        require_within(root, root / "linked" / "file.txt")
