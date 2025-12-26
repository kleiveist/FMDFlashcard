#!/usr/bin/env python3
"""Linux/Unix installer.

Installs missing packages based on the Doctor results.
Supported package managers:
- pacman (Arch/CachyOS/Manjaro/...)
- apt-get (Debian/Ubuntu/...)

This module exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import importlib.util
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

PACMAN_MAP: PackageMap = {
    "git": ["git"],
    "curl": ["curl"],
    "file": ["file"],
    "pkg-config": ["pkgconf"],
    "cmake": ["cmake"],
    "make": ["make"],
    "gcc": ["gcc"],
    "g++": ["gcc"],
    "rustup": ["rustup"],
    "rustc": ["rust"],
    "cargo": ["rust"],
    "node": ["nodejs"],
    "npm": ["npm"],
    # Tauri / WebView deps
    "gtk3": ["gtk3"],
    "webkit2gtk": ["webkit2gtk"],
    "libappindicator-gtk3": ["libappindicator-gtk3"],
    "librsvg": ["librsvg"],
    "openssl": ["openssl"],
}

APT_MAP: PackageMap = {
    "git": ["git"],
    "curl": ["curl"],
    "file": ["file"],
    "pkg-config": ["pkg-config"],
    "cmake": ["cmake"],
    # build chain
    "make": ["build-essential"],
    "gcc": ["build-essential"],
    "g++": ["build-essential"],
    # rust
    "rustup": ["rustup"],
    "rustc": ["rustc"],
    "cargo": ["cargo"],
    # node
    "node": ["nodejs"],
    "npm": ["npm"],
    # Tauri / WebView deps
    "gtk3": ["libgtk-3-dev"],
    "webkit2gtk": ["libwebkit2gtk-4.1-dev"],
    "libappindicator-gtk3": ["libappindicator3-dev"],
    "librsvg": ["librsvg2-dev"],
    "openssl": ["libssl-dev"],
}


def _detect_pkg_manager() -> str | None:
    if shutil.which("pacman"):
        return "pacman"
    if shutil.which("apt-get"):
        return "apt"
    return None


def _gather_missing_tool_names(checks: List[Check]) -> List[str]:
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    return [m.name for m in missing]


def _expand_packages(manager: str, tools: Iterable[str]) -> tuple[list[str], list[str]]:
    mapping = PACMAN_MAP if manager == "pacman" else APT_MAP
    pkgs: Set[str] = set()
    unknown: List[str] = []

    for tool in tools:
        entries = mapping.get(tool)
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
    fix_script = Path(__file__).resolve().parent.parent / "fixes" / "pacman_keyring_fix.py"
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
    # NOTE: --noconfirm is convenient but risky. Remove it to keep things interactive.
    cmd = ["sudo", "pacman", "-S", "--needed", "--noconfirm", *packages]
    rc, out = _run_capture(cmd, dry_run)
    if rc == 0:
        return 0

    if _maybe_run_pacman_keyring_fix(out, dry_run=dry_run):
        rc2, out2 = _run_capture(cmd, dry_run)
        if rc2 == 0:
            return 0
        if out2:
            print(out2)
        return rc2

    if out:
        print(out)
    return rc


def _install_packages(manager: str, packages: list[str], dry_run: bool) -> int:
    if not packages:
        print(f"{ICONS['ok']} Everything is already installed (per Doctor).")
        return 0

    if manager == "pacman":
        return _install_pacman(packages, dry_run)

    # apt-get
    rc = _run_cmd(["sudo", "apt-get", "update"], dry_run)
    if rc != 0:
        return rc
    return _run_cmd(["sudo", "apt-get", "install", "-y", *packages], dry_run)


def run_install(dry_run: bool = False) -> int:
    manager = _detect_pkg_manager()
    if not manager:
        print(f"{ICONS['err']} No supported package manager found (pacman or apt-get).")
        return 1

    checks = collect_checks()
    missing_tools = _gather_missing_tool_names(checks)
    packages, unknown = _expand_packages(manager, missing_tools)

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    print(f"{ICONS['info']} Detected package manager: {manager}")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    if unknown:
        print(f"{ICONS['warn']} No mapping for these tools (ignored): {', '.join(unknown)}")

    if not packages:
        print(f"{ICONS['err']} No installable packages determined.")
        return 1

    print(f"{ICONS['info']} Installing packages: {', '.join(packages)}")
    return _install_packages(manager, packages, dry_run=dry_run)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
