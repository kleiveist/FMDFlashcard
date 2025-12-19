#!/usr/bin/env python3
"""macOS installer.

Uses Homebrew where possible. Rust is installed via rustup (recommended).

This module exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import shutil
import subprocess
from typing import List, Set

from doctor import CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}


# Tool-name -> brew formulae.
# Notes:
# - `file` and `curl` are typically preinstalled on macOS.
# - `make`, `gcc`, `g++` on macOS usually come from Xcode Command Line Tools.
BREW_MAP = {
    "git": ["git"],
    "pkg-config": ["pkg-config"],
    "cmake": ["cmake"],
    "node": ["node"],  # includes npm
    "npm": ["node"],
}


def _run(cmd: List[str], dry_run: bool) -> int:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0
    try:
        subprocess.run(cmd, check=True)
        return 0
    except subprocess.CalledProcessError as e:
        print(f"{ICONS['err']} Error running (exit {e.returncode}): {' '.join(cmd)}")
        return int(e.returncode) if e.returncode is not None else 1


def _install_brew(formulae: List[str], dry_run: bool) -> int:
    if not formulae:
        return 0
    # brew install supports multiple formulae at once.
    return _run(["brew", "install", *formulae], dry_run)


def _install_rustup(dry_run: bool) -> int:
    # Standard rustup installer (non-interactive).
    # It will add rust toolchain to your environment (shell profile may be updated).
    cmd = [
        "bash",
        "-lc",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    ]
    return _run(cmd, dry_run)


def run_install(dry_run: bool = False) -> int:
    if not shutil.which("brew"):
        print(
            f"{ICONS['err']} Homebrew not found. Install Homebrew or install dependencies manually."
        )
        return 1

    checks = collect_checks()
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    missing_tools = [c.name for c in missing]

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    # Collect brew formulae.
    formulae: Set[str] = set()
    wants_rustup = False

    for tool in missing_tools:
        if tool in ("rustup", "rustc", "cargo"):
            wants_rustup = True
            continue
        for f in BREW_MAP.get(tool, []):
            if f:
                formulae.add(f)

    # Xcode Command Line Tools hint.
    needs_xcode = any(t in ("make", "gcc", "g++") for t in missing_tools)
    if needs_xcode:
        print(
            f"{ICONS['info']} For make/gcc/g++ you typically need Xcode Command Line Tools on macOS:"
        )
        print(f"{ICONS['run']} xcode-select --install")

    # Brew install
    rc = _install_brew(sorted(formulae), dry_run)
    if rc != 0:
        return rc

    # Rust
    if wants_rustup:
        print(f"{ICONS['info']} Installing Rust via rustup...")
        rc = _install_rustup(dry_run)
        if rc != 0:
            return rc

    print(f"{ICONS['ok']} Installation completed (as far as supported).")
    return 0


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
