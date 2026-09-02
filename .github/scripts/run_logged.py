#!/usr/bin/env python3
"""Run a command, stream combined output, and retain the same exit code."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from collections.abc import Mapping
from pathlib import Path

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


def main() -> int:
    arguments = _parser().parse_args()
    command = arguments.command
    if command[:1] == ["--"]:
        command = command[1:]
    if not command:
        raise SystemExit("run_logged.py requires a command after --")

    replacements = _redactions(os.environ)
    arguments.log.parent.mkdir(parents=True, exist_ok=True)
    with arguments.log.open("w", encoding="utf-8", newline="\n") as log:
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        assert process.stdout is not None
        for line in process.stdout:
            line = _redact(line, replacements)
            sys.stdout.write(line)
            sys.stdout.flush()
            log.write(line)
            log.flush()
        return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
