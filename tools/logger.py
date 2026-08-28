from __future__ import annotations

import sys
from typing import TextIO

_EMOJI = {
    "OK": "✅",
    "SKIP": "⏭️",
    "WARN": "⚠️",
    "FAIL": "❌",
    "INFO": "ℹ️",
}

_ASCII = {
    "OK": "[OK]",
    "SKIP": "[SKIP]",
    "WARN": "[WARN]",
    "FAIL": "[FAIL]",
    "INFO": "[INFO]",
}


def _normalize(status: str) -> str:
    return status.strip().upper()


def format_message(status: str, message: str) -> str:
    normalized = _normalize(status)
    emoji = _EMOJI.get(normalized, _EMOJI["INFO"])
    return f"{emoji} {message}"


def _stream_message(status_value: str, message: str, stream: TextIO) -> str:
    formatted = format_message(status_value, message)
    encoding = getattr(stream, "encoding", None)
    if not encoding:
        return formatted

    try:
        formatted.encode(encoding)
    except (LookupError, UnicodeEncodeError):
        normalized = _normalize(status_value)
        marker = _ASCII.get(normalized, _ASCII["INFO"])
        try:
            safe_message = message.encode(encoding, errors="backslashreplace").decode(encoding)
        except LookupError:
            safe_message = message.encode("ascii", errors="backslashreplace").decode("ascii")
        return f"{marker} {safe_message}"
    return formatted


def status(status_value: str, message: str, *, stream: TextIO = sys.stdout) -> None:
    print(_stream_message(status_value, message, stream), file=stream)


def ok(message: str, *, stream: TextIO = sys.stdout) -> None:
    status("OK", message, stream=stream)


def warn(message: str, *, stream: TextIO = sys.stdout) -> None:
    status("WARN", message, stream=stream)


def fail(message: str, *, stream: TextIO = sys.stderr) -> None:
    status("FAIL", message, stream=stream)


def info(message: str, *, stream: TextIO = sys.stdout) -> None:
    status("INFO", message, stream=stream)
