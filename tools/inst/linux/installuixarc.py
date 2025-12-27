#!/usr/bin/env python3
"""
Arch Linux installer (pacman-based).

Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Set

from doctor import Check, CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}

PackageMap = Dict[str, Iterable[str]]

# Arch/pacman package mapping (dedup happens automatically).
PACMAN_MAP: PackageMap = {
    # Core tools
    "git": ["git"],
    "curl": ["curl"],
    "file": ["file"],
    "pkg-config": ["pkgconf"],
    "cmake": ["cmake"],
    "make": ["make"],
    "gcc": ["gcc"],
    "g++": ["gcc"],
    # Rust
    "rustup": ["rustup"],
    "rustc": ["rust"],
    "cargo": ["rust"],
    # Node
    "node": ["nodejs"],
    "npm": ["npm"],
    # Tauri / WebView deps
    "gtk3": ["gtk3"],
    "webkit2gtk": ["webkit2gtk"],
    "libappindicator-gtk3": ["libappindicator-gtk3"],
    "librsvg": ["librsvg"],
    "openssl": ["openssl"],
}

# If you want fully interactive installs, set FMD_PACMAN_NOCONFIRM=0
PACMAN_NOCONFIRM = os.environ.get("FMD_PACMAN_NOCONFIRM", "1") != "0"
# Optional: do a full sync+upgrade before installing. Set FMD_PACMAN_UPGRADE=0 to disable.
PACMAN_UPGRADE = os.environ.get("FMD_PACMAN_UPGRADE", "1") != "0"


def _gather_missing_tool_names(checks: List[Check]) -> List[str]:
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    return [m.name for m in missing]


def _expand_packages(tools: Iterable[str]) -> tuple[list[str], list[str]]:
    pkgs: Set[str] = set()
    unknown: List[str] = []

    for tool in tools:
        entries = PACMAN_MAP.get(tool)
        if entries is None:
            unknown.append(tool)
            continue
        for pkg in entries:
            if pkg:
                pkgs.add(pkg)

    return (sorted(pkgs), unknown)


def _run_cmd(cmd: list[str], dry_run: bool) -> int:
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


def _run_capture(cmd: list[str], dry_run: bool) -> tuple[int, str]:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0, ""
    try:
        p = subprocess.run(
            cmd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        return p.returncode, (p.stdout or "")
    except OSError as e:
        print(f"{ICONS['err']} Error running: {' '.join(cmd)} ({e})")
        return 1, ""


def _maybe_run_pacman_keyring_fix(pacman_output: str, dry_run: bool) -> bool:
    # tools/fixes/pacman_keyring_fix.py
    fix_script = Path(__file__).resolve().parents[2] / "fixes" / "pacman_keyring_fix.py"
    if not fix_script.exists():
        return False

    spec = importlib.util.spec_from_file_location("pacman_keyring_fix", fix_script)
    if spec is None or spec.loader is None:
        print(f"{ICONS['warn']} Unable to load pacman keyring fix module spec.")
        return False

    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        print(f"{ICONS['warn']} Unable to load pacman keyring fix: {e}")
        return False

    should_apply = getattr(module, "should_apply", None)
    if not callable(should_apply):
        print(f"{ICONS['warn']} pacman_keyring_fix missing should_apply().")
        return False

    if not should_apply(pacman_output):
        return False

    rc, _ = _run_capture([sys.executable, str(fix_script)], dry_run=dry_run)
    return rc == 0


def _install_pacman(packages: list[str], dry_run: bool) -> int:
    if not packages:
        print(f"{ICONS['ok']} Everything is already installed (per Doctor).")
        return 0

    if not shutil.which("pacman"):
        print(f"{ICONS['err']} pacman not found. This installer is for Arch/pacman systems.")
        return 1

    base_flags = ["sudo", "pacman"]
    if PACMAN_UPGRADE:
        # Keep system consistent (avoids partial upgrades / dependency weirdness)
        upgrade_cmd = [*base_flags, "-Syu"]
        if PACMAN_NOCONFIRM:
            upgrade_cmd.insert(3, "--noconfirm")
        rc = _run_cmd(upgrade_cmd, dry_run=dry_run)
        if rc != 0:
            return rc

    install_cmd = [*base_flags, "-S", "--needed"]
    if PACMAN_NOCONFIRM:
        install_cmd.append("--noconfirm")
    install_cmd.extend(packages)

    rc, out = _run_capture(install_cmd, dry_run)
    if rc == 0:
        return 0

    # Try keyring fix if it looks like a signature/key issue
    if _maybe_run_pacman_keyring_fix(out, dry_run=dry_run):
        rc2, out2 = _run_capture(install_cmd, dry_run)
        if rc2 == 0:
            return 0
        if out2:
            print(out2)
        return rc2

    if out:
        print(out)
    return rc


def run_install(dry_run: bool = False) -> int:
    checks = collect_checks()
    missing_tools = _gather_missing_tool_names(checks)
    packages, unknown = _expand_packages(missing_tools)

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    print(f"{ICONS['info']} Installer: Arch/pacman")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    if unknown:
        print(f"{ICONS['warn']} No mapping for these tools (ignored): {', '.join(unknown)}")

    print(f"{ICONS['info']} Installing packages: {', '.join(packages)}")
    return _install_pacman(packages, dry_run=dry_run)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
