from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_run_logged_redacts_sensitive_environment_from_console_and_file(tmp_path: Path) -> None:
    secret = "sensitive-value-that-must-not-leak"
    log = tmp_path / "nested" / "command.log"
    environment = os.environ.copy()
    environment["APPLE_PASSWORD"] = secret
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / ".github" / "scripts" / "run_logged.py"),
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
    expected = "✓ 665 modules transformed.\n✖ one problem.\n"
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / ".github" / "scripts" / "run_logged.py"),
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
    assert result.stdout.decode("utf-8") == expected
    assert log.read_text(encoding="utf-8") == expected


def test_run_logged_replaces_invalid_child_bytes(tmp_path: Path) -> None:
    log = tmp_path / "invalid-byte.log"
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / ".github" / "scripts" / "run_logged.py"),
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
    assert result.stdout.decode("utf-8") == "before � after\n"
    assert log.read_text(encoding="utf-8") == "before � after\n"
