#!/usr/bin/env python3
"""
Simple console helpers for formatter build output.
"""

from __future__ import annotations

import shlex
from pathlib import Path
from typing import Iterable

ICONS: dict[str, str] = {
    "box": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "info": "ℹ️",
    "ok": "✅",
    "warn": "⚠️",
    "err": "❌",
    "action": "▶️",
    "cleanup": "🧹",
    "build": "🧰",
    "bundle": "📦",
}


def _format_msg(icon: str, msg: str) -> None:
    print(f"{icon} {msg}")


def section(title: str) -> None:
    print()
    print(ICONS["box"])
    print(f"{ICONS['info']} {title}")
    print(ICONS["box"])


def info(msg: str) -> None:
    _format_msg(ICONS["info"], msg)


def ok(msg: str) -> None:
    _format_msg(ICONS["ok"], msg)


def warn(msg: str) -> None:
    _format_msg(ICONS["warn"], msg)


def err(msg: str) -> None:
    _format_msg(ICONS["err"], msg)


def action(msg: str) -> None:
    _format_msg(ICONS["action"], msg)


def cleanup(msg: str) -> None:
    _format_msg(ICONS["cleanup"], msg)


def build(msg: str) -> None:
    _format_msg(ICONS["build"], msg)


def bundle(msg: str) -> None:
    _format_msg(ICONS["bundle"], msg)


def cmd(cwd: Path, argv: Iterable[str]) -> None:
    joined = shlex.join(tuple(argv))
    print(f"{ICONS['action']} {joined}")
    print(f"    cwd={cwd}")


def kv(key: str, value: str) -> None:
    print(f"{key:<16}: {value}")
