#!/usr/bin/env python3
"""
Environment doctor/check script used by `tools/control.py`.

OS-aware behavior
- Windows:
  - Does NOT require Unix build tools (make/gcc/pkg-config/file).
  - DOES require MSVC Build Tools (C++ workload) for Rust/Tauri builds.
  - Requires pnpm (desktop workflow uses it).
  - Skips Linux package checks for Tauri system libs.
- Linux:
  - Requires Unix build tools and Tauri system libs.

This file is intended to replace: tools/doctor.py
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
from dataclasses import dataclass, asdict
from pathlib import Path
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

SYSTEM = platform.system().lower()

# Critical categories differ by OS.
if SYSTEM == "windows":
    CRITICAL_CATEGORIES = (
        "Core Tools",
        "Rust",
        "Node",
    )
else:
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


def _cargo_home() -> Path:
    cargo_home = os.environ.get("CARGO_HOME")
    if cargo_home:
        return Path(cargo_home).expanduser()
    return Path.home() / ".cargo"


def _resolve_tool_with_cargo_bin(cmd: str, cargo_bin: Path) -> tuple[Optional[str], bool]:
    found = which(cmd)
    if found:
        return found, False
    candidate = cargo_bin / cmd
    if candidate.exists() and os.access(candidate, os.X_OK):
        return str(candidate), True
    return None, False


def _with_path_hint(details: str, from_cargo: bool, cargo_env: Path, cargo_bin: Path) -> str:
    if not from_cargo:
        return details
    if cargo_env.exists():
        return f"{details} (not in PATH; run 'source {cargo_env}')"
    return f"{details} (not in PATH; add {cargo_bin} to PATH)"


def _vswhere_path() -> Optional[str]:
    """Locate vswhere.exe (commonly not in PATH)."""
    p = which("vswhere")
    if p:
        return p

    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    cand = Path(pf86) / "Microsoft Visual Studio" / "Installer" / "vswhere.exe"
    if cand.exists():
        return str(cand)
    return None


def _check_msvc_buildtools() -> tuple[bool, str]:
    """
    Check for MSVC Build Tools / Visual Studio C++ toolchain.

    Required for Windows Rust/Tauri builds.
    """
    vswhere = _vswhere_path()
    if not vswhere:
        return (False, "vswhere.exe not found (install VS Build Tools: C++ workload)")

    out = run_cmd(
        [
            vswhere,
            "-latest",
            "-products",
            "*",
            "-requires",
            "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
            "-property",
            "installationPath",
        ]
    )
    if out:
        cl = which("cl")
        if cl:
            return (True, f"VS/BuildTools: {out} (cl: {cl})")
        return (True, f"VS/BuildTools: {out} (cl not in PATH; open 'x64 Native Tools' prompt)")
    return (False, "MSVC C++ tools not detected (install VS Build Tools: C++ workload)")


def collect_checks() -> List[Check]:
    checks: List[Check] = []

    # Shell / PATH info
    checks.append(Check("SHELL", True, os.environ.get("SHELL", "unknown"), "Shell"))
    path = os.environ.get("PATH", "")
    top = (path.split(os.pathsep) if path else [])[:8]
    checks.append(
        Check(
            "PATH (Top 8)",
            True,
            "\n" + "\n".join([f"    {i+1}. {p}" for i, p in enumerate(top)]),
            "Shell",
        )
    )

    # Core tools: OS-aware
    if SYSTEM == "windows":
        for tool in ["git", "curl", "cmake"]:
            p = which(tool)
            checks.append(Check(tool, bool(p), p or "not found", "Core Tools"))

        ok, details = _check_msvc_buildtools()
        checks.append(Check("msvc-buildtools", ok, details, "Core Tools"))

        # Unix tools: show as skipped (not required on Windows)
        for tool in ["file", "pkg-config", "make", "gcc", "g++"]:
            checks.append(Check(tool, True, "skipped (Unix tool; not required on Windows)", "Core Tools"))
    else:
        for tool in ["git", "curl", "file", "pkg-config", "cmake", "make", "gcc", "g++"]:
            p = which(tool)
            checks.append(Check(tool, bool(p), p or "not found", "Core Tools"))

    # Rust
    cargo_home = _cargo_home()
    cargo_bin = cargo_home / "bin"
    cargo_env = cargo_home / "env"
    rustup, rustup_from_cargo = _resolve_tool_with_cargo_bin("rustup", cargo_bin)
    rustc, rustc_from_cargo = _resolve_tool_with_cargo_bin("rustc", cargo_bin)
    cargo, cargo_from_cargo = _resolve_tool_with_cargo_bin("cargo", cargo_bin)

    if rustup:
        v = run_cmd([rustup, "--version"]) or "version unavailable"
        active = run_cmd([rustup, "show", "active-toolchain"]) or "(active toolchain unknown)"
        checks.append(Check("rustup", True, _with_path_hint(v, rustup_from_cargo, cargo_env, cargo_bin), "Rust"))
        checks.append(Check("toolchain", True, _with_path_hint(active, rustup_from_cargo, cargo_env, cargo_bin), "Rust"))
    else:
        checks.append(Check("rustup", False, "not found", "Rust"))

    if rustc:
        v = run_cmd([rustc, "-V"]) or "version unavailable"
        checks.append(Check("rustc", True, _with_path_hint(v, rustc_from_cargo, cargo_env, cargo_bin), "Rust"))
    else:
        checks.append(Check("rustc", False, "not found", "Rust"))

    if cargo:
        v = run_cmd([cargo, "-V"]) or "version unavailable"
        checks.append(Check("cargo", True, _with_path_hint(v, cargo_from_cargo, cargo_env, cargo_bin), "Rust"))
    else:
        checks.append(Check("cargo", False, "not found", "Rust"))

    # Node (pnpm required)
    node = which("node")
    npm = which("npm")
    pnpm = which("pnpm")
    corepack = which("corepack")

    checks.append(Check("node", bool(node), (run_cmd(["node", "-v"]) if node else "not found"), "Node"))
    checks.append(Check("npm", bool(npm), (run_cmd(["npm", "-v"]) if npm else "not found"), "Node"))

    if pnpm:
        checks.append(Check("pnpm", True, run_cmd(["pnpm", "-v"]) or pnpm, "Node"))
    else:
        hint = "not found (required)"
        if corepack:
            hint += "; install via: corepack enable && corepack prepare pnpm@latest --activate"
        checks.append(Check("pnpm", False, hint, "Node"))

    # Tauri system libs checks are Linux-only
    deps = ["gtk3", "webkit2gtk", "libappindicator-gtk3", "librsvg", "openssl"]
    pacman = which("pacman")
    dpkg_query = which("dpkg-query")

    debian_pkg = {
        "gtk3": ["libgtk-3-dev"],
        "webkit2gtk": ["libwebkit2gtk-4.1-dev", "libwebkit2gtk-4.0-dev"],
        "libappindicator-gtk3": ["libayatana-appindicator3-dev", "libappindicator3-dev"],
        "librsvg": ["librsvg2-dev"],
        "openssl": ["libssl-dev"],
    }
    arch_pkg = {
        "gtk3": ["gtk3"],
        "webkit2gtk": ["webkit2gtk-4.1", "webkit2gtk"],
        "libappindicator-gtk3": ["libappindicator", "libappindicator-gtk3"],
        "librsvg": ["librsvg"],
        "openssl": ["openssl"],
    }

    if SYSTEM == "linux" and pacman:
        for d in deps:
            found = None
            for pkg in arch_pkg.get(d, [d]):
                q = run_cmd(["pacman", "-Q", pkg])
                if q:
                    found = q
                    break
            checks.append(Check(d, bool(found), found or "not installed", "Tauri System Libs"))
    elif SYSTEM == "linux" and dpkg_query:
        for d in deps:
            pkgs = debian_pkg[d]
            found = None
            found_pkg = None
            for pkg in pkgs:
                q = run_cmd(["dpkg-query", "-W", "-f=${Status} ${Version}", pkg])
                if q and "install ok installed" in q:
                    found = q
                    found_pkg = pkg
                    break
            checks.append(Check(d, bool(found), f"{found_pkg}: {found}" if found else f"{'/'.join(pkgs)}: not installed", "Tauri System Libs"))
    else:
        for d in deps:
            checks.append(Check(d, True, "skipped (Linux package check only)", "Tauri System Libs"))

    # Optional
    sqlite = which("sqlite3")
    if sqlite:
        checks.append(Check("sqlite3", True, run_cmd(["sqlite3", "--version"]) or sqlite, "Optional"))
    else:
        checks.append(Check("sqlite3", True, "not installed (optional)", "Optional"))

    return checks


def missing_checks(checks: List[Check], categories: Optional[List[str] | tuple[str, ...]] = None) -> List[Check]:
    wanted = categories or CRITICAL_CATEGORIES
    return [c for c in checks if (not c.ok) and (c.category in wanted)]


def summarize(checks: List[Check]) -> None:
    header("Summary")
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    if not missing:
        print(f"{ICONS['ok']} All required tools are present.")
        return

    if SYSTEM == "windows":
        print(f"{ICONS['warn']} Missing / required for Windows dev/build:")
    elif SYSTEM == "linux":
        print(f"{ICONS['warn']} Missing / required for Linux dev/build (Tauri):")
    else:
        print(f"{ICONS['warn']} Missing / required tools:")

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


if __name__ == "__main__":
    raise SystemExit(run())
