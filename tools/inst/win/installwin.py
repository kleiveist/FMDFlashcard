#!/usr/bin/env python3
"""
Windows installer used by `tools/control.py --install`.

Goals
- Install ONLY what `tools/doctor.py` reports as missing/required on Windows.
- Avoid Microsoft Store (msstore) certificate issues by forcing --source winget.
- Avoid winget "already installed / no upgrade available" failures by SKIPPING packages
  detected as already installed.
- Install pnpm via Corepack (bundled with Node.js) if pnpm is missing.

This file is intended to replace: tools/inst/win/installwin.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Set, Tuple

from doctor import CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}

# Doctor tool-name -> winget package IDs (exact match)
WINGET_MAP = {
    "git": ["Git.Git"],
    "node": ["OpenJS.NodeJS.LTS"],
    "npm": ["OpenJS.NodeJS.LTS"],
    "rustup": ["Rustlang.Rustup"],
    "cmake": ["Kitware.CMake"],
    # Required for Windows Rust/Tauri builds
    "msvc-buildtools": ["Microsoft.VisualStudio.2022.BuildTools"],
    # pnpm handled via corepack
    "pnpm": [],
}

# Visual Studio Build Tools: install C++ toolchain silently
# If you do NOT want auto-install, set:
#   setx SKIP_MSVC_BUILDTOOLS 1
VS_BUILDTOOLS_OVERRIDE = (
    "--add Microsoft.VisualStudio.Workload.VCTools "
    "--includeRecommended --passive --norestart --wait"
)


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
        p = subprocess.run(cmd, check=False)
        return int(p.returncode or 0)
    except OSError as e:
        # Example: WinError 1920 ("Das System kann auf die Datei nicht zugreifen")
        print(f"{ICONS['err']} OSError while launching command: {e}")
        return 1


def _expand_winget(tools: List[str]) -> Tuple[List[str], List[str]]:
    pkgs: Set[str] = set()
    unknown: List[str] = []
    for t in tools:
        ids = WINGET_MAP.get(t)
        if ids is None:
            unknown.append(t)
            continue
        for pkg_id in ids:
            if pkg_id:
                pkgs.add(pkg_id)
    return (sorted(pkgs), unknown)


def _winget_is_installed(pkg_id: str, source: str) -> bool:
    """
    Returns True if winget believes the package is already installed.
    We parse stdout because winget exit codes for "not installed" are inconsistent.
    """
    cmd = ["winget", "list", "-e", "--id", pkg_id, "--source", source]
    try:
        p = subprocess.run(cmd, check=False, capture_output=True, text=True)
        out = (p.stdout or "") + "\n" + (p.stderr or "")
        low = out.lower()
        if "no installed package found" in low or "no package found" in low:
            return False
        # If it prints a table with the package, treat as installed
        return pkg_id.lower() in low or "installed" in low or "version" in low
    except Exception:
        return False


def _install_winget(packages: List[str], dry_run: bool) -> int:
    winget_source = os.environ.get("WINGET_SOURCE", "winget")
    skip_msvc = os.environ.get("SKIP_MSVC_BUILDTOOLS", "").strip() == "1"

    for pkg_id in packages:
        if pkg_id == "Microsoft.VisualStudio.2022.BuildTools" and skip_msvc:
            print(f"{ICONS['info']} SKIP_MSVC_BUILDTOOLS=1 set; skipping {pkg_id}")
            continue

        if not dry_run and _winget_is_installed(pkg_id, winget_source):
            print(f"{ICONS['ok']} {pkg_id} already installed; skipping.")
            continue

        cmd = [
            "winget",
            "install",
            "-e",
            "--id",
            pkg_id,
            "--source",
            winget_source,
            "--silent",
            "--disable-interactivity",
            "--accept-package-agreements",
            "--accept-source-agreements",
        ]

        if pkg_id == "Microsoft.VisualStudio.2022.BuildTools":
            cmd += ["--override", VS_BUILDTOOLS_OVERRIDE]

        rc = _run(cmd, dry_run)
        if rc != 0:
            # If install fails but package is now detected as installed, continue.
            if not dry_run and _winget_is_installed(pkg_id, winget_source):
                print(f"{ICONS['warn']} winget returned {rc}, but {pkg_id} is now installed; continuing.")
                continue
            print(f"{ICONS['err']} winget failed for {pkg_id} (exit {rc})")
            return rc

    return 0


def _find_corepack_cmd() -> str | None:
    p = shutil.which("corepack")
    if p:
        return p

    # Common Node.js install dir
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    cand = Path(pf) / "nodejs" / "corepack.cmd"
    if cand.exists():
        return str(cand)
    return None


def _install_pnpm_via_corepack(dry_run: bool) -> int:
    if shutil.which("pnpm"):
        return 0

    if not shutil.which("node"):
        print(f"{ICONS['warn']} pnpm missing but node is not installed yet.")
        return 1

    corepack = _find_corepack_cmd()
    if not corepack:
        print(
            f"{ICONS['warn']} pnpm missing and corepack not found.\n"
            f"{ICONS['info']} Close and reopen PowerShell (PATH refresh) and re-run install."
        )
        return 1

    rc = _run([corepack, "enable"], dry_run)
    if rc != 0:
        return rc
    rc = _run([corepack, "prepare", "pnpm@latest", "--activate"], dry_run)
    if rc != 0:
        return rc

    # pnpm shim may need a new shell; best-effort verify
    if shutil.which("pnpm"):
        _run(["pnpm", "-v"], dry_run)
    else:
        print(f"{ICONS['info']} pnpm activated; restart PowerShell if pnpm is still not found.")
    return 0


def run_install(dry_run: bool = False) -> int:
    manager = _detect_manager()
    if manager != "winget":
        print(f"{ICONS['err']} This Windows installer expects winget (found: {manager or 'none'}).")
        print(f"{ICONS['info']} Install winget or run installs manually.")
        return 1

    checks = collect_checks()
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    missing_tools = [c.name for c in missing]

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    packages, unknown = _expand_winget(missing_tools)

    print(f"{ICONS['info']} Detected package manager: winget")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    if unknown:
        print(f"{ICONS['warn']} These tools cannot be installed automatically by this script:")
        for t in unknown:
            print(f"{ICONS['info']} {t}")

    # Install winget packages first
    rc = _install_winget(packages, dry_run)
    if rc != 0:
        return rc

    # pnpm via corepack
    if "pnpm" in missing_tools:
        rc = _install_pnpm_via_corepack(dry_run)
        if rc != 0:
            return rc

    print(f"{ICONS['ok']} Install routine completed.")
    print(f"{ICONS['info']} Recommended: close and reopen PowerShell, then run:")
    print(rf"{ICONS['info']}   py -3 .\tools\control.py --doctor")
    return 0


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
