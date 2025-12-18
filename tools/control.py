#!/usr/bin/env python3
# checkup.py — hübscher Terminal-Check (Icons + klare Ausgabe)
# Nutzung:
#   python3 checkup.py
# Optional:
#   python3 checkup.py --json   (gibt zusätzlich JSON aus)

import os
import shutil
import subprocess
import sys
import json
from dataclasses import dataclass
from typing import Optional, List, Dict

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

def run(cmd: List[str]) -> Optional[str]:
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
    # group by category
    cats: Dict[str, List[Check]] = {}
    for c in checks:
        cats.setdefault(c.category, []).append(c)

    for cat in cats:
        print(f"\n{ICONS['dot']} {cat}")
        for c in cats[cat]:
            icon = ICONS["ok"] if c.ok else ICONS["miss"]
            # Align name column
            print(f"  {icon} {c.name:<18} {c.details}")

def main() -> int:
    want_json = "--json" in sys.argv

    checks: List[Check] = []

    # Shell
    shell = os.environ.get("SHELL", "unbekannt")
    checks.append(Check("SHELL", True, shell, "Shell"))

    # PATH top entries
    path = os.environ.get("PATH", "")
    path_entries = path.split(":") if path else []
    top = path_entries[:8]
    checks.append(Check("PATH (Top 8)", True, "\n" + "\n".join([f"    {i+1}. {p}" for i, p in enumerate(top)]), "Shell"))

    # Grundtools
    for tool in ["git", "curl", "file", "pkg-config", "cmake", "make", "gcc", "g++"]:
        p = which(tool)
        if p:
            checks.append(Check(tool, True, f"{p}", "Grundtools"))
        else:
            checks.append(Check(tool, False, "nicht gefunden", "Grundtools"))

    # Rust
    rustup = which("rustup")
    rustc = which("rustc")
    cargo = which("cargo")

    if rustup:
        v = run(["rustup", "--version"]) or "Version nicht ermittelbar"
        active = run(["rustup", "show", "active-toolchain"]) or "(active-toolchain unbekannt)"
        checks.append(Check("rustup", True, v, "Rust"))
        checks.append(Check("toolchain", True, active, "Rust"))
    else:
        checks.append(Check("rustup", False, "nicht gefunden", "Rust"))

    if rustc:
        v = run(["rustc", "-V"]) or "Version nicht ermittelbar"
        checks.append(Check("rustc", True, v, "Rust"))
    else:
        checks.append(Check("rustc", False, "nicht gefunden", "Rust"))

    if cargo:
        v = run(["cargo", "-V"]) or "Version nicht ermittelbar"
        checks.append(Check("cargo", True, v, "Rust"))
    else:
        checks.append(Check("cargo", False, "nicht gefunden", "Rust"))

    # Node / npm / pnpm
    node = which("node")
    npm = which("npm")
    pnpm = which("pnpm")

    if node:
        checks.append(Check("node", True, run(["node", "-v"]) or node, "Node"))
    else:
        checks.append(Check("node", False, "nicht gefunden", "Node"))

    if npm:
        checks.append(Check("npm", True, run(["npm", "-v"]) or npm, "Node"))
    else:
        checks.append(Check("npm", False, "nicht gefunden", "Node"))

    if pnpm:
        checks.append(Check("pnpm", True, run(["pnpm", "-v"]) or pnpm, "Node"))
    else:
        checks.append(Check("pnpm", True, "nicht installiert (optional)", "Node"))

    # Tauri Dependencies (Arch/CachyOS via pacman)
    pacman = which("pacman")
    deps = ["gtk3", "webkit2gtk", "libappindicator-gtk3", "librsvg", "openssl"]

    if pacman:
        for d in deps:
            q = run(["pacman", "-Q", d])
            if q:
                checks.append(Check(d, True, q, "Tauri System-Libs (Arch)"))
            else:
                checks.append(Check(d, False, "nicht installiert", "Tauri System-Libs (Arch)"))
    else:
        # If not Arch-based, just mark as info
        for d in deps:
            checks.append(Check(d, True, "pacman nicht gefunden (nur Arch/CachyOS Check)", "Tauri System-Libs"))

    # SQLite (optional)
    sqlite = which("sqlite3")
    if sqlite:
        checks.append(Check("sqlite3", True, run(["sqlite3", "--version"]) or sqlite, "Optional"))
    else:
        checks.append(Check("sqlite3", True, "nicht installiert (optional)", "Optional"))

    # Print summary
    header("Terminal Checkup")
    print_checks(checks)

    missing = [c for c in checks if (not c.ok) and c.category in ("Grundtools", "Rust", "Node", "Tauri System-Libs (Arch)")]
    header("Zusammenfassung")
    if not missing:
        print(f"{ICONS['ok']} Alles Nötige ist vorhanden.")
    else:
        print(f"{ICONS['warn']} Fehlend / nötig für Tauri:")
        for c in missing:
            print(f"  {ICONS['miss']} {c.name}  ({c.category})")

        # Helpful install hint for Arch
        if pacman and any(c.name in ("webkit2gtk", "libappindicator-gtk3", "cmake") for c in missing):
            print("\nInstall-Hinweis (Arch/CachyOS):")
            pkgs = []
            for name in ["webkit2gtk", "libappindicator-gtk3", "cmake"]:
                if any(c.name == name for c in missing):
                    pkgs.append(name)
            if pkgs:
                print(f"  sudo pacman -Syu --needed {' '.join(pkgs)}")

    if want_json:
        data = [c.__dict__ for c in checks]
        print("\nJSON:")
        print(json.dumps(data, indent=2, ensure_ascii=False))

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
