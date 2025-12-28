#!/usr/bin/env python3
"""
Environment doctor/check script used by `tools/control.py`.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


@dataclass
class Check:
    name: str
    ok: bool
    details: str
    category: str


ICONS = {
    "ok": "✅",
    "miss": "❌",
    "info": "ℹ️",
    "warn": "⚠️",
    "dot": "•",
}

CRITICAL_CATEGORIES = (
    "Core Tools",
    "Rust",
    "Node",
    "Tauri System Libs",
)


def run_cmd(cmd: List[str]) -> Optional[str]:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
        return out.strip()
    except Exception:
        return None


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def header(title: str) -> None:
    line = "═" * (len(title) + 2)
    print(f"\n{line}\n {title}\n{line}")


def print_checks(checks: List[Check]) -> None:
    cats: Dict[str, List[Check]] = {}
    for c in checks:
        cats.setdefault(c.category, []).append(c)

    for cat in cats:
        print(f"\n{ICONS['dot']} {cat}")
        for c in cats[cat]:
            icon = ICONS["ok"] if c.ok else ICONS["miss"]
            print(f"  {icon} {c.name:<18} {c.details}")


def collect_checks() -> List[Check]:
    checks: List[Check] = []

    system = platform.system().lower()

    shell = os.environ.get("SHELL", "unknown")
    checks.append(Check("SHELL", True, shell, "Shell"))

    path = os.environ.get("PATH", "")
    path_entries = path.split(os.pathsep) if path else []
    top = path_entries[:8]
    checks.append(
        Check(
            "PATH (Top 8)",
            True,
            "\n" + "\n".join([f"    {i+1}. {p}" for i, p in enumerate(top)]),
            "Shell",
        )
    )

    for tool in ["git", "curl", "file", "pkg-config", "cmake", "make", "gcc", "g++"]:
        p = which(tool)
        if p:
            checks.append(Check(tool, True, f"{p}", "Core Tools"))
        else:
            checks.append(Check(tool, False, "not found", "Core Tools"))

    rustup = which("rustup")
    rustc = which("rustc")
    cargo = which("cargo")

    if rustup:
        v = run_cmd(["rustup", "--version"]) or "version unavailable"
        active = run_cmd(["rustup", "show", "active-toolchain"]) or "(active toolchain unknown)"
        checks.append(Check("rustup", True, v, "Rust"))
        checks.append(Check("toolchain", True, active, "Rust"))
    else:
        checks.append(Check("rustup", False, "not found", "Rust"))

    if rustc:
        v = run_cmd(["rustc", "-V"]) or "version unavailable"
        checks.append(Check("rustc", True, v, "Rust"))
    else:
        checks.append(Check("rustc", False, "not found", "Rust"))

    if cargo:
        v = run_cmd(["cargo", "-V"]) or "version unavailable"
        checks.append(Check("cargo", True, v, "Rust"))
    else:
        checks.append(Check("cargo", False, "not found", "Rust"))

    node = which("node")
    npm = which("npm")
    pnpm = which("pnpm")

    if node:
        checks.append(Check("node", True, run_cmd(["node", "-v"]) or node, "Node"))
    else:
        checks.append(Check("node", False, "not found", "Node"))

    if npm:
        checks.append(Check("npm", True, run_cmd(["npm", "-v"]) or npm, "Node"))
    else:
        checks.append(Check("npm", False, "not found", "Node"))

    if pnpm:
        checks.append(Check("pnpm", True, run_cmd(["pnpm", "-v"]) or pnpm, "Node"))
    else:
        checks.append(Check("pnpm", True, "not installed (optional)", "Node"))

    # Tauri / WebView dependencies are OS + distro specific.
    # We check them only on Linux, using the available package manager.
    deps = ["gtk3", "webkit2gtk", "libappindicator-gtk3", "librsvg", "openssl"]
    pacman = which("pacman")
    dpkg_query = which("dpkg-query")

    # Debian/Ubuntu package names for the above logical deps.
    debian_pkg = {
        "gtk3": ["libgtk-3-dev"],
        "webkit2gtk": ["libwebkit2gtk-4.1-dev", "libwebkit2gtk-4.0-dev"],
        "libappindicator-gtk3": ["libayatana-appindicator3-dev", "libappindicator3-dev"],
        "librsvg": ["librsvg2-dev"],
        "openssl": ["libssl-dev"],
    }

    if system == "linux" and pacman:
        for d in deps:
            q = run_cmd(["pacman", "-Q", d])
            if q:
                checks.append(Check(d, True, q, "Tauri System Libs"))
            else:
                checks.append(Check(d, False, "not installed", "Tauri System Libs"))
    elif system == "linux" and dpkg_query:
        for d in deps:
            pkgs = debian_pkg[d]
            found_pkg = None
            found_status = None
            for pkg in pkgs:
                q = run_cmd(["dpkg-query", "-W", "-f=${Status} ${Version}", pkg])
                if q and "install ok installed" in q:
                    found_pkg = pkg
                    found_status = q
                    break
            if found_pkg:
                checks.append(Check(d, True, f"{found_pkg}: {found_status}", "Tauri System Libs"))
            else:
                checks.append(
                    Check(d, False, f"{'/'.join(pkgs)}: not installed", "Tauri System Libs")
                )
    else:
        # Non-Linux systems or unknown Linux distros: don't fail the doctor on these.
        for d in deps:
            checks.append(Check(d, True, "skipped (Linux package check only)", "Tauri System Libs"))

    sqlite = which("sqlite3")
    if sqlite:
        checks.append(Check("sqlite3", True, run_cmd(["sqlite3", "--version"]) or sqlite, "Optional"))
    else:
        checks.append(Check("sqlite3", True, "not installed (optional)", "Optional"))

    return checks


def summarize(checks: List[Check]) -> None:
    header("Summary")
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    if not missing:
        print(f"{ICONS['ok']} All required tools are present.")
    else:
        print(f"{ICONS['warn']} Missing / required for Tauri:")
        for c in missing:
            print(f"  {ICONS['miss']} {c.name}  ({c.category})")


def run(want_json: bool = False) -> int:
    checks = collect_checks()
    header("Terminal Checkup")
    print_checks(checks)
    summarize(checks)

    if want_json:
        print("\nJSON:")
        payload = [asdict(c) for c in checks]
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    return 0


def missing_checks(
    checks: List[Check], categories: Optional[List[str] | tuple[str, ...]] = None
) -> List[Check]:
    wanted = categories or CRITICAL_CATEGORIES
    return [c for c in checks if (not c.ok) and (c.category in wanted)]


if __name__ == "__main__":
    raise SystemExit(run())
