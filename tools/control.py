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
for extra_dir in (PY_DIR, PY_DIR / "linux", PY_DIR / "mac", PY_DIR / "win"):
    if extra_dir.exists() and str(extra_dir) not in sys.path:
        sys.path.insert(0, str(extra_dir))

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


def _load_run_runner() -> Callable[..., int] | None:
    """Load tools/inst/run.py (runner for pnpm tauri dev)."""
    mod_name = "run"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load run module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Run module '{mod_name}' has no run_install(dry_run=...) function.")
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
        "--run",
        "--start",
        dest="run",
        action="store_true",
        help="Runs the Tauri desktop app (pnpm tauri dev).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show which commands would run.",
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
                "Expected: tools/inst/win/installwin.py, "
                "tools/inst/linux/installuix.py, or tools/inst/mac/installmac.py"
            )
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, run_install(args.dry_run))

    if args.vscode:
        handled = True
        run_vscode = _load_vscode_run_install()
        if not run_vscode:
            print("No VS Code install routine found. Expected: tools/inst/linux/installuixvs.py")
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, run_vscode())

    if args.tauri:
        handled = True
        run_tauri = _load_tauri_run_install()
        if not run_tauri:
            print("No Tauri install routine found. Expected: tools/inst/linux/installuixtauri.py")
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

    if args.run:
        handled = True
        run_runner = _load_run_runner()
        if not run_runner:
            print("No run routine found. Expected: tools/inst/run.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_runner)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_runner())
                else:
                    exit_code = max(exit_code, run_runner(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_runner(args.dry_run))

    if args.doctor or args.check:
        handled = True
        exit_code = max(exit_code, run_doctor(args.json))

    if not handled:
        print("Please specify a command (e.g. --doctor, --install, --tauri, or --start/--run).")
        return 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
