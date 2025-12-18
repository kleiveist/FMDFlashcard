#!/usr/bin/env python3
"""Linux/Unix installer.

Installs missing packages based on the Doctor results.
Supported package managers:
- pacman (Arch/CachyOS/Manjaro/...)
- apt-get (Debian/Ubuntu/...)

This module exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import shutil
import subprocess
from typing import Dict, Iterable, List, Set

from doctor import Check, CRITICAL_CATEGORIES, collect_checks, missing_checks

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
    print("→", " ".join(cmd))
    if dry_run:
        print("Dry-Run: überspringe Ausführung.")
        return 0
    try:
        subprocess.run(cmd, check=True)
        return 0
    except subprocess.CalledProcessError as e:
        print(f"Fehler beim Ausführen (Exit {e.returncode}): {' '.join(cmd)}")
        return int(e.returncode) if e.returncode is not None else 1


def _install_packages(manager: str, packages: list[str], dry_run: bool) -> int:
    if not packages:
        print("Alles ist bereits installiert (laut Doctor).")
        return 0

    if manager == "pacman":
        # NOTE: --noconfirm ist bequem, aber riskant. Wenn du interaktiv bleiben willst, entferne es.
        cmd = ["sudo", "pacman", "-S", "--needed", "--noconfirm", *packages]
        return _run_cmd(cmd, dry_run)

    # apt-get
    rc = _run_cmd(["sudo", "apt-get", "update"], dry_run)
    if rc != 0:
        return rc
    return _run_cmd(["sudo", "apt-get", "install", "-y", *packages], dry_run)


def run_install(dry_run: bool = False) -> int:
    manager = _detect_pkg_manager()
    if not manager:
        print("Keine unterstützte Paketverwaltung gefunden (pacman oder apt-get).")
        return 1

    checks = collect_checks()
    missing_tools = _gather_missing_tool_names(checks)
    packages, unknown = _expand_packages(manager, missing_tools)

    if not missing_tools:
        print("Keine fehlenden Tools laut Doctor.")
        return 0

    print(f"Gefundene Paketverwaltung: {manager}")
    print("Fehlende Tools laut Doctor:", ", ".join(missing_tools))

    if unknown:
        print("Hinweis: Für diese Tools gibt es kein Mapping (werden ignoriert):", ", ".join(unknown))

    if not packages:
        print("Keine installierbaren Pakete ermittelt.")
        return 1

    print("Installiere Pakete:", ", ".join(packages))
    return _install_packages(manager, packages, dry_run=dry_run)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
