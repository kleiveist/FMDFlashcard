#!/usr/bin/env python3
"""Run a command, stream combined output, and retain the same exit code."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import TextIO

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from tools.process import prepare_command  # noqa: E402

SENSITIVE_ENVIRONMENT = (
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_SIGNING_IDENTITY",
    "APPLE_TEAM_ID",
    "FMD_WINDOWS_CERTIFICATE_THUMBPRINT",
    "WINDOWS_CERTIFICATE_BASE64",
    "WINDOWS_CERTIFICATE_PASSWORD",
    "WINDOWS_CERTIFICATE_THUMBPRINT",
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    return parser


def _resolve_command(command: list[str], environment: Mapping[str, str]) -> list[str]:
    executable = shutil.which(command[0], path=environment.get("PATH"))
    return prepare_command([executable or command[0], *command[1:]])


def _redactions(environment: Mapping[str, str]) -> tuple[tuple[str, str], ...]:
    replacements: dict[str, str] = {}
    for name in SENSITIVE_ENVIRONMENT:
        value = environment.get(name, "")
        if len(value) >= 4:
            replacements.setdefault(value, f"[REDACTED:{name}]")
    return tuple(sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True))


def _redact(text: str, replacements: tuple[tuple[str, str], ...]) -> str:
    for value, placeholder in replacements:
        text = text.replace(value, placeholder)
    return text


def _configure_utf8_stream(stream: TextIO) -> None:
    reconfigure = getattr(stream, "reconfigure", None)
    if callable(reconfigure):
        reconfigure(encoding="utf-8", errors="replace")


def _write_console(text: str) -> None:
    try:
        sys.stdout.write(text)
    except UnicodeEncodeError:
        encoding = sys.stdout.encoding or "ascii"
        safe_text = text.encode(encoding, errors="replace").decode(encoding)
        sys.stdout.write(safe_text)
    sys.stdout.flush()


def main() -> int:
    _configure_utf8_stream(sys.stdout)
    _configure_utf8_stream(sys.stderr)
    arguments = _parser().parse_args()
    command = arguments.command
    if command[:1] == ["--"]:
        command = command[1:]
    if not command:
        raise SystemExit("run_logged.py requires a command after --")

    replacements = _redactions(os.environ)
    child_environment = os.environ.copy()
    child_environment["PYTHONIOENCODING"] = "utf-8"
    child_environment["PYTHONUTF8"] = "1"
    command = _resolve_command(command, child_environment)
    arguments.log.parent.mkdir(parents=True, exist_ok=True)
    with arguments.log.open("w", encoding="utf-8", newline="\n") as log:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=child_environment,
            shell=False,
        )
        assert process.stdout is not None
        for line in process.stdout:
            line = _redact(line, replacements)
            log.write(line)
            log.flush()
            _write_console(line)
        return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
