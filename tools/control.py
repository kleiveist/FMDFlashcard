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
import inspect
import platform
import sys
from pathlib import Path
from typing import Callable, cast

SCRIPT_DIR = Path(__file__).resolve().parent
PY_DIR = SCRIPT_DIR / "inst"
if str(PY_DIR) not in sys.path:
    sys.path.insert(0, str(PY_DIR))

from doctor import run as run_doctor  # type: ignore

RunInstall = Callable[[bool], int]
RunVsCodeInstall = Callable[[], int]
run_doctor = cast(Callable[[bool], int], run_doctor)


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


def _load_installer_run_install() -> RunInstall | None:
    mod_name = _detect_installer_module()
    if not mod_name:
        return None
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load installer module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Installer module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(RunInstall, fn)


def _load_vscode_run_install() -> RunVsCodeInstall | None:
    mod_name = "installuixvs"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load VS Code installer module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"VS Code installer module '{mod_name}' has no run_install() function.")
        return None
    return cast(RunVsCodeInstall, fn)


def _load_tauri_run_install() -> Callable[..., int] | None:
    mod_name = "installuixtauri"
    if platform.system().lower() != "linux":
        print("Tauri install routine is Linux-only.")
        return None
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load Tauri installer module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(
            "Tauri installer module "
            f"'{mod_name}' has no run_install(dry_run=...) function."
        )
        return None
    return cast(Callable[..., int], fn)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Project toolbox launcher.")
    parser.add_argument(
        "--doctor",
        action="store_true",
        help="Runs the system/tooling check.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Alias for --doctor.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Additional JSON output for --doctor.",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Installs missing dependencies via the matching install script (win/uix/mac).",
    )
    parser.add_argument(
        "--VScode",
        "--vscode",
        dest="vscode",
        action="store_true",
        help="Installs Visual Studio Code (Linux).",
    )
    parser.add_argument(
        "--tauri",
        action="store_true",
        help="Installs Tauri prerequisites (Linux).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show which commands --install would run.",
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
                "No matching installation routine found. "
                "Expected: inst/installwin.py, py/installuix.py, or py/installmac.py"
            )
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, run_install(args.dry_run))

    if args.vscode:
        handled = True
        run_vscode = _load_vscode_run_install()
        if not run_vscode:
            print("No VS Code install routine found. Expected: inst/installuixvs.py")
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, run_vscode())

    if args.tauri:
        handled = True
        run_tauri = _load_tauri_run_install()
        if not run_tauri:
            print("No Tauri install routine found. Expected: inst/installuixtauri.py")
            exit_code = max(exit_code, 1)
        else:
            # Accept run_install() or run_install(dry_run)
            try:
                sig = inspect.signature(run_tauri)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_tauri())
                else:
                    exit_code = max(exit_code, run_tauri(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_tauri(args.dry_run))

    if args.doctor or args.check:
        handled = True
        exit_code = max(exit_code, run_doctor(args.json))

    if not handled:
        print("Please specify a command (e.g. --doctor or --install).")
        return 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
