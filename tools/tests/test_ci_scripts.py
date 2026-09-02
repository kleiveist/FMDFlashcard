from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
RUN_LOGGED_PATH = ROOT / ".github" / "scripts" / "run_logged.py"
SPEC = importlib.util.spec_from_file_location("fmd_run_logged", RUN_LOGGED_PATH)
assert SPEC is not None and SPEC.loader is not None
RUN_LOGGED = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUN_LOGGED)


def test_run_logged_resolves_windows_batch_command_from_child_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    command = ["pnpm", "-C", "apps/fmd-desktop", "audit"]
    environment = {"PATH": r"C:\hostedtoolcache\node"}

    def fake_which(name: str, *, path: str | None = None) -> str:
        assert name == "pnpm"
        assert path == environment["PATH"]
        return r"C:\hostedtoolcache\node\pnpm.CMD"

    monkeypatch.setattr(RUN_LOGGED.shutil, "which", fake_which)
    monkeypatch.setattr(RUN_LOGGED.sys, "platform", "win32")
    monkeypatch.setenv("SystemRoot", r"C:\Windows")

    assert RUN_LOGGED._resolve_command(command, environment) == [
        r"C:\Windows\System32\cmd.exe",
        "/d",
        "/s",
        "/c",
        "call",
        r"C:\hostedtoolcache\node\pnpm.CMD",
        "-C",
        "apps/fmd-desktop",
        "audit",
    ]
    assert command == ["pnpm", "-C", "apps/fmd-desktop", "audit"]


@pytest.mark.parametrize("metacharacter", list('&|<>()^%!"\r\n'))
def test_run_logged_rejects_windows_batch_metacharacters(
    monkeypatch: pytest.MonkeyPatch,
    metacharacter: str,
) -> None:
    monkeypatch.setattr(
        RUN_LOGGED.shutil,
        "which",
        lambda _name, *, path=None: r"C:\Program Files\nodejs\pnpm.cmd",
    )
    monkeypatch.setattr(RUN_LOGGED.sys, "platform", "win32")

    with pytest.raises(ValueError, match="unsafe metacharacters"):
        RUN_LOGGED._resolve_command(
            ["pnpm", f"audit{metacharacter}whoami"],
            {"PATH": r"C:\Program Files\nodejs"},
        )


def test_run_logged_redacts_sensitive_environment_from_console_and_file(tmp_path: Path) -> None:
    secret = "sensitive-value-that-must-not-leak"
    log = tmp_path / "nested" / "command.log"
    environment = os.environ.copy()
    environment["APPLE_PASSWORD"] = secret
    result = subprocess.run(
        [
            sys.executable,
            str(RUN_LOGGED_PATH),
            "--log",
            str(log),
            "--",
            sys.executable,
            "-c",
            f"print('before {secret} after')",
        ],
        cwd=ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert secret not in result.stdout
    assert secret not in log.read_text(encoding="utf-8")
    assert "before [REDACTED:APPLE_PASSWORD] after" in result.stdout
    assert "before [REDACTED:APPLE_PASSWORD] after" in log.read_text(encoding="utf-8")


def test_run_logged_preserves_unicode_when_parent_is_forced_to_cp1252(tmp_path: Path) -> None:
    log = tmp_path / "unicode.log"
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "cp1252"
    environment["PYTHONUTF8"] = "0"
    expected_log = "✓ 665 modules transformed.\n✖ one problem.\n"
    expected_console = expected_log.replace("\n", os.linesep)
    result = subprocess.run(
        [
            sys.executable,
            str(RUN_LOGGED_PATH),
            "--log",
            str(log),
            "--",
            sys.executable,
            "-c",
            "print('\\u2713 665 modules transformed.')\nprint('\\u2716 one problem.')",
        ],
        cwd=ROOT,
        env=environment,
        check=False,
        capture_output=True,
    )

    assert result.returncode == 0
    assert result.stdout.decode("utf-8") == expected_console
    assert log.read_bytes() == expected_log.encode("utf-8")


def test_run_logged_replaces_invalid_child_bytes(tmp_path: Path) -> None:
    log = tmp_path / "invalid-byte.log"
    result = subprocess.run(
        [
            sys.executable,
            str(RUN_LOGGED_PATH),
            "--log",
            str(log),
            "--",
            sys.executable,
            "-c",
            "import sys; sys.stdout.buffer.write(b'before \\x81 after\\n')",
        ],
        cwd=ROOT,
        check=False,
        capture_output=True,
    )

    assert result.returncode == 0
    assert result.stdout.decode("utf-8") == f"before � after{os.linesep}"
    assert log.read_bytes() == "before � after\n".encode("utf-8")
