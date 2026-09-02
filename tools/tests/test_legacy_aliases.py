from __future__ import annotations

import pytest

from tools import control
from tools.control_parser import LegacySyntaxError, normalize_argv


@pytest.mark.parametrize(
    ("legacy", "canonical"),
    [
        (["--doctor"], ["doctor"]),
        (["--check"], ["doctor"]),
        (["--doctor", "--json"], ["doctor", "--json"]),
        (["--install"], ["install"]),
        (["--run"], ["run"]),
        (["--start"], ["run"]),
        (["--test"], ["test", "--suite", "frontend"]),
        (["--tauri"], ["tauri", "install"]),
        (["--install-appimage"], ["tauri", "install-appimage"]),
        (["--appimage"], ["tauri", "install-appimage"]),
        (["--build"], ["build"]),
        (["--build-lin"], ["build", "desktop", "--target", "linux"]),
        (["--build-win"], ["build", "desktop", "--target", "windows"]),
        (["--build-win", "-p"], ["build", "desktop", "--target", "windows-portable"]),
        (["--build-win", "--portable"], ["build", "desktop", "--target", "windows-portable"]),
        (["--build-mac"], ["build", "desktop", "--target", "macos"]),
        (["--build", "--winlinux"], ["build", "desktop", "--target", "windows-cross-linux"]),
        (["--build", "--copy"], ["tauri", "copy"]),
        (["--install", "--dry-run"], ["install", "--dry-run"]),
        (["--VScode"], ["install", "--vscode"]),
        (["--vscode"], ["install", "--vscode"]),
        (["tauri", "--doctor", "--json"], ["tauri", "doctor", "--json"]),
    ],
)
def test_every_legacy_mapping(legacy: list[str], canonical: list[str]) -> None:
    assert list(normalize_argv(legacy).argv) == canonical


@pytest.mark.parametrize(
    ("legacy", "canonical"),
    [
        (["--doctor", "--dry-run"], ["doctor", "--dry-run"]),
        (["--run", "--dry-run"], ["run", "--dry-run"]),
        (["--test", "--dry-run"], ["test", "--suite", "frontend", "--dry-run"]),
        (["--tauri", "--dry-run"], ["tauri", "install", "--dry-run"]),
        (["--appimage", "--dry-run"], ["tauri", "install-appimage", "--dry-run"]),
        (
            ["--build-lin", "--dry-run"],
            ["build", "desktop", "--target", "linux", "--dry-run"],
        ),
        (
            ["--build", "--winlinux", "--dry-run"],
            ["build", "desktop", "--target", "windows-cross-linux", "--dry-run"],
        ),
        (["--build", "--copy", "--dry-run"], ["tauri", "copy", "--dry-run"]),
        (["--VScode", "--dry-run"], ["install", "--vscode", "--dry-run"]),
    ],
)
def test_legacy_dry_run_is_propagated(legacy: list[str], canonical: list[str]) -> None:
    assert list(normalize_argv(legacy).argv) == canonical


@pytest.mark.parametrize(
    "argv",
    [
        ["--doctor", "--install"],
        ["--install", "--json"],
        ["--build", "--winlinux", "--copy"],
        ["--build-lin", "--portable"],
        ["--dry-run"],
    ],
)
def test_invalid_legacy_combinations_are_rejected(argv: list[str]) -> None:
    with pytest.raises(LegacySyntaxError):
        normalize_argv(argv)


def test_deprecation_notice_is_stderr(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(control, "dispatch", lambda _args: 0)
    assert control.main(["--install", "--dry-run"]) == 0
    captured = capsys.readouterr()
    assert "Deprecated command form" in captured.err


def test_legacy_doctor_json_suppresses_notice(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(control, "dispatch", lambda _args: 0)
    assert control.main(["--doctor", "--json"]) == 0
    captured = capsys.readouterr()
    assert captured.err == ""


def test_unknown_legacy_argument_is_not_ignored() -> None:
    with pytest.raises(SystemExit) as caught:
        control.main(["--doctor", "--unknown"])
    assert caught.value.code == 2
