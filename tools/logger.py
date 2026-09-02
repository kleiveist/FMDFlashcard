"""Small, dependency-free console reporting helpers."""

from __future__ import annotations

import sys
from typing import TextIO


def _write(marker: str, message: str, *, stream: TextIO) -> None:
    print(f"[{marker}] {message}", file=stream)


def ok(message: str, *, stream: TextIO | None = None) -> None:
    _write("OK", message, stream=stream or sys.stdout)


def info(message: str, *, stream: TextIO | None = None) -> None:
    _write("INFO", message, stream=stream or sys.stdout)


def warn(message: str, *, stream: TextIO | None = None) -> None:
    _write("WARN", message, stream=stream or sys.stderr)


def error(message: str, *, stream: TextIO | None = None) -> None:
    _write("ERROR", message, stream=stream or sys.stderr)


def deprecation(original: list[str], replacement: list[str]) -> None:
    before = " ".join(original)
    after = " ".join(replacement)
    warn(f"Deprecated command form: {before}. Use: python tools/control.py {after}")
