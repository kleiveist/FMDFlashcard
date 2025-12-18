#!/usr/bin/env python3
"""
Project control entry point.

Examples:
    ./control.py --doctor
    ./control.py --doctor --json
"""

from __future__ import annotations

import argparse
import importlib
import platform
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PY_DIR = SCRIPT_DIR / "py"
if str(PY_DIR) not in sys.path:
    sys.path.insert(0, str(PY_DIR))

from doctor import run as run_doctor  # type: ignore


def _detect_installer_module() -> str | None:
    """Return installer module name (without .py) based on the current OS."""
    sys_name = platform.system().lower()
    if sys_name == "windows":
        return "installwin"
    if sys_name == "darwin":
        return "installmac"
    if sys_name == "linux":
        return "installuix"
    return None


def _load_installer_run_install():
    mod_name = _detect_installer_module()
    if not mod_name:
        return None
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Konnte Installer-Modul nicht laden: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Installer-Modul '{mod_name}' hat keine Funktion run_install(dry_run=...).")
        return None
    return fn


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Project toolbox launcher.")
    parser.add_argument(
        "--doctor",
        action="store_true",
        help="Führt den System-/Tooling-Check aus.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Alias für --doctor.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Zusätzliche JSON-Ausgabe für --doctor.",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Installiert fehlende Abhängigkeiten über das passende Install-Skript (win/uix/mac).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur anzeigen, welche Befehle --install ausführen würde.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    exit_code = 0
    handled = False

    if args.install:
        handled = True
        run_install = _load_installer_run_install()
        if not run_install:
            print(
                "Keine passende Installationsroutine gefunden. "
                "Erwartet: py/installwin.py, py/installuix.py oder py/installmac.py"
            )
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, int(run_install(dry_run=args.dry_run)))

    if args.doctor or args.check:
        handled = True
        exit_code = max(exit_code, int(run_doctor(want_json=args.json)))

    if not handled:
        print("Bitte einen Befehl angeben (z.B. --doctor oder --install).")
        return 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
