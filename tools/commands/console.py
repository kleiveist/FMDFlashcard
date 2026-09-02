"""Optional interactive front end over canonical control commands."""

from __future__ import annotations

import argparse
import sys

from tools import logger

CHOICES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Doctor", ("doctor",)),
    ("Quality", ("quality",)),
    ("Frontend tests", ("test", "--suite", "frontend")),
    ("Rust tests", ("test", "--suite", "rust")),
    ("Tooling tests", ("test", "--suite", "tooling")),
    ("Tauri guide", ("tauri",)),
    ("Build guide", ("build",)),
    ("Release check", ("release", "check")),
)


def _print_menu() -> None:
    print("FMDFlashcard command console")
    for index, (label, command) in enumerate(CHOICES, start=1):
        print(f"  {index}. {label:<18} python tools/control.py {' '.join(command)}")
    print("  0. Exit")


def handle(_args: argparse.Namespace) -> int:
    """Select one fixed canonical command; never duplicate command business logic."""

    _print_menu()
    if not sys.stdin.isatty():
        logger.info("Non-interactive input detected; no command was selected")
        return 0
    try:
        raw = input("Select a command: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return 130
    if raw == "0":
        return 0
    try:
        _label, command = CHOICES[int(raw) - 1]
    except (ValueError, IndexError):
        logger.error("Select a number shown in the menu")
        return 2

    from tools.control import main

    return main(list(command))
