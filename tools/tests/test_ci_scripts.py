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
