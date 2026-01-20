#!/usr/bin/env python3
"""Windows installer.

Tries to install missing tools using one of:
- winget (preferred)
- choco
- scoop

This module exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import shutil
import subprocess
from typing import List, Set, Tuple

from doctor import CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}


# Tool-name -> winget package IDs (exact match)
WINGET_MAP = {
    "git": ["Git.Git"],
    "node": ["OpenJS.NodeJS.LTS"],
    "npm": ["OpenJS.NodeJS.LTS"],
    "rustup": ["Rustlang.Rustup"],
    # `curl` is usually present on modern Windows; `file`, `make`, `gcc` are not handled here.
}

# Tool-name -> Chocolatey packages
CHOCO_MAP = {
    "git": ["git"],
    "node": ["nodejs-lts"],
    "npm": ["nodejs-lts"],
    "rustup": ["rustup.install"],
}

# Tool-name -> Scoop apps
SCOOP_MAP = {
    "git": ["git"],
    "node": ["nodejs-lts"],
    "npm": ["nodejs-lts"],
    "rustup": ["rustup"],
}


def _detect_manager() -> str | None:
    if shutil.which("winget"):
        return "winget"
    if shutil.which("choco"):
        return "choco"
    if shutil.which("scoop"):
        return "scoop"
    return None


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


def _expand(manager: str, tools: List[str]) -> Tuple[List[str], List[str]]:
    mapping = {
        "winget": WINGET_MAP,
        "choco": CHOCO_MAP,
        "scoop": SCOOP_MAP,
    }[manager]

    pkgs: Set[str] = set()
    unknown: List[str] = []
    for t in tools:
        entries = mapping.get(t)
        if entries is None:
            unknown.append(t)
            continue
        for p in entries:
            if p:
                pkgs.add(p)
    return (sorted(pkgs), unknown)


def _install(manager: str, packages: List[str], dry_run: bool) -> int:
    if not packages:
        print(f"{ICONS['ok']} Everything is already installed (per Doctor) or not supported.")
        return 0

    if manager == "winget":
        # `-e` exact match, `--id` uses the package ID.
        # Agreements flags avoid prompts.
        rc = 0
        for pkg_id in packages:
            cmd = [
                "winget",
                "install",
                "-e",
                "--id",
                pkg_id,
                "--accept-package-agreements",
                "--accept-source-agreements",
            ]
            rc = _run(cmd, dry_run)
            if rc != 0:
                return rc
        return 0

    if manager == "choco":
        return _run(["choco", "install", "-y", *packages], dry_run)

    # scoop
    return _run(["scoop", "install", *packages], dry_run)


def run_install(dry_run: bool = False) -> int:
    manager = _detect_manager()
    if not manager:
        print(
            f"{ICONS['err']} No package manager found (winget/choco/scoop).\n"
            f"{ICONS['info']} winget is usually available on Windows 10/11\n"
            f"{ICONS['info']} Alternatively install Chocolatey or Scoop"
        )
        return 1

    checks = collect_checks()
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    missing_tools = [c.name for c in missing]

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    packages, unknown = _expand(manager, missing_tools)

    print(f"{ICONS['info']} Detected package manager: {manager}")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    if unknown:
        print(f"{ICONS['warn']} These tools cannot be installed automatically on Windows:")
        print("\n".join([f"{ICONS['info']} {t}" for t in unknown]))
        print(f"{ICONS['info']} (e.g. make/gcc/g++ usually come from MSVC/BuildTools or WSL)")

    if not packages:
        print(f"{ICONS['err']} No installable packages determined.")
        return 1

    print(f"{ICONS['info']} Installing packages: {', '.join(packages)}")
    return _install(manager, packages, dry_run)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
