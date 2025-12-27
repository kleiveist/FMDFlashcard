#!/usr/bin/env python3
"""
Ubuntu installer (apt-get).

Rust is installed via official rustup script to avoid apt rustup/cargo/rustc conflicts.
Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import os
import shutil
import subprocess
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
    # rust: handled via rustup script (no apt mapping)
    "rustup": [],
    "rustc": [],
    "cargo": [],
    # node
    "node": ["nodejs"],
    "npm": ["npm"],
    # Tauri / WebView deps
    "gtk3": ["libgtk-3-dev"],
    "webkit2gtk": ["libwebkit2gtk-4.1-dev", "libwebkit2gtk-4.0-dev"],
    "libappindicator-gtk3": ["libayatana-appindicator3-dev", "libappindicator3-dev"],
    "librsvg": ["librsvg2-dev"],
    "openssl": ["libssl-dev"],
}


def _gather_missing_tool_names(checks: List[Check]) -> List[str]:
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    return [m.name for m in missing]


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
    p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.returncode, (p.stdout or "")


def _apt_pkg_exists(pkg: str, dry_run: bool) -> bool:
    # apt-cache is non-root and works for existence probing
    rc, _ = _run_capture(["apt-cache", "show", pkg], dry_run=dry_run)
    return rc == 0


def _expand_packages(tools: Iterable[str], dry_run: bool) -> tuple[list[str], list[str]]:
    pkgs: Set[str] = set()
    unknown: List[str] = []

    for tool in tools:
        entries = APT_MAP.get(tool)
        if entries is None:
            unknown.append(tool)
            continue

        # pick first existing package from alternatives
        chosen = None
        for pkg in entries:
            if not pkg:
                continue
            if _apt_pkg_exists(pkg, dry_run=dry_run):
                chosen = pkg
                break
        if chosen:
            pkgs.add(chosen)

    return (sorted(pkgs), unknown)


def _ensure_rustup(dry_run: bool) -> int:
    # If rustup already present, assume toolchain is OK.
    if shutil.which("rustup") and shutil.which("cargo") and shutil.which("rustc"):
        return 0

    # Install rustup via official script (non-apt)
    cmd = [
        "bash",
        "-lc",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    ]
    rc = _run_cmd(cmd, dry_run=dry_run)
    if rc != 0:
        return rc

    # Make it usable for subsequent commands in this same process
    cargo_bin = str(Path.home() / ".cargo" / "bin")
    os.environ["PATH"] = cargo_bin + ":" + os.environ.get("PATH", "")

    # Ensure stable toolchain (cargo/rustc)
    rustup = shutil.which("rustup") or str(Path.home() / ".cargo" / "bin" / "rustup")
    rc2 = _run_cmd([rustup, "default", "stable"], dry_run=dry_run)
    return rc2


def run_install(dry_run: bool = False) -> int:
    if not shutil.which("apt-get"):
        print(f"{ICONS['err']} apt-get not found. This installer is for Ubuntu/apt systems.")
        return 1

    checks = collect_checks()
    missing_tools = _gather_missing_tool_names(checks)

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    print(f"{ICONS['info']} Installer: Ubuntu/apt")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    packages, unknown = _expand_packages(missing_tools, dry_run=dry_run)
    if unknown:
        print(f"{ICONS['warn']} No mapping for these tools (ignored): {', '.join(unknown)}")

    # apt deps first
    if packages:
        rc = _run_cmd(["sudo", "apt-get", "update"], dry_run=dry_run)
        if rc != 0:
            return rc
        rc = _run_cmd(["sudo", "apt-get", "install", "-y", *packages], dry_run=dry_run)
        if rc != 0:
            return rc

    # rust via rustup if any rust-related tool is missing
    if any(t in set(missing_tools) for t in ("rustup", "cargo", "rustc")):
        rc = _ensure_rustup(dry_run=dry_run)
        if rc != 0:
            return rc

    return 0


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
