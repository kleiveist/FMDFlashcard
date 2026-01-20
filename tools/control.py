#!/usr/bin/env python3
"""
Project control entry point.

Examples:
    ./control.py --doctor
    ./control.py --doctor --json

    # Windows build (installer bundles)
    ./control.py --build-win

    # Windows portable build (no installer; build script decides packaging)
    ./control.py --build-win -p
"""

from __future__ import annotations

import argparse
import importlib
import inspect
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable, cast

SCRIPT_DIR = Path(__file__).resolve().parent

# New structure:
#   tools/build/build_*.py
# Legacy (optional):
#   tools/inst/build/build_*.py
INST_DIR = SCRIPT_DIR / "inst"
BUILD_DIR = SCRIPT_DIR / "build"
LEGACY_BUILD_DIR = INST_DIR / "build"

# sys.path bootstrap for tooling modules.
# insert(0) gives higher precedence to later inserts, so we insert
# in increasing priority order (last = highest).
extra_dirs = (
    INST_DIR,
    INST_DIR / "linux",
    INST_DIR / "mac",
    INST_DIR / "win",
    LEGACY_BUILD_DIR,
    BUILD_DIR,
)
for extra_dir in extra_dirs:
    if extra_dir.exists() and str(extra_dir) not in sys.path:
        sys.path.insert(0, str(extra_dir))

from doctor import run as run_doctor  # type: ignore
from console import info, section as console_section

RunInstall = Callable[[bool], int]
RunVsCodeInstall = Callable[[], int]
run_doctor = cast(Callable[[bool], int], run_doctor)


def _which_pnpm() -> str:
    """
    Returns an executable name/path for pnpm that works on Win/macOS/Linux.
    """
    exe = shutil.which("pnpm")
    if exe:
        return exe
    if os.name == "nt":
        exe = shutil.which("pnpm.cmd") or shutil.which("pnpm.exe")
        if exe:
            return exe
    raise SystemExit("pnpm not found in PATH. Install pnpm (or enable corepack) and retry.")


def _run(cmd: list[str], cwd: Path) -> int:
    """
    Run a command with streaming stdout/stderr. Returns process returncode.
    """
    print(f"[control] cwd={cwd}")
    print(f"[control] $ {' '.join(cmd)}")
    p = subprocess.Popen(cmd, cwd=str(cwd))
    return p.wait()


def _repo_root_from_tools_control() -> Path:
    """
    tools/control.py -> repo root is one level up from tools/.
    """
    return Path(__file__).resolve().parents[1]


def cmd_build_desktop() -> int:
    """
    Build Tauri desktop app (release bundles).
    Equivalent to: cd apps/fmd-desktop && pnpm tauri build
    """
    repo_root = _repo_root_from_tools_control()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    pnpm = _which_pnpm()

    rc = _run([pnpm, "install"], cwd=app_dir)
    if rc != 0:
        return rc

    return _run([pnpm, "tauri", "build"], cwd=app_dir)


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


def _load_build_lin_runner() -> Callable[..., int] | None:
    """Load tools/build/build_lin.py (runner for pnpm tauri build)."""
    mod_name = "build_lin"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load Linux build module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Linux build module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(Callable[..., int], fn)


def _load_test_runner() -> Callable[..., int] | None:
    """Load tools/inst/run_test.py (runner for pnpm tests)."""
    mod_name = "run_test"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load test module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Test module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(Callable[..., int], fn)


def _print_build_helper() -> None:
    console_section("Build helper")
    info("Available targets:")
    info("  --build-lin  Linux release (NO_STRIP, CLEAN_BUNDLE).")
    info("  --build-win  Windows build (default bundles via WIN_BUNDLES). Use -p for portable.")
    info("  --build-mac  macOS bundles (MAC_BUNDLES=app,dmg, ALLOW_CROSS).")
    info("  --build --winlinux  Windows cross-compile on Linux (cargo-xwin, portable exe).")


def _load_build_win_runner() -> Callable[..., int] | None:
    """Load tools/build/build_win.py (runner for Windows build)."""
    mod_name = "build_win"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load Windows build module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Windows build module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(Callable[..., int], fn)


def _load_build_win_portable_runner() -> Callable[..., int] | None:
    """Load tools/build/build_win_p.py (runner for Windows portable build)."""
    mod_name = "build_win_p"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load Windows portable build module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(
            f"Windows portable build module '{mod_name}' has no run_install(dry_run=...) function."
        )
        return None
    return cast(Callable[..., int], fn)


def _load_build_mac_runner() -> Callable[..., int] | None:
    """Load tools/build/build_mac.py (runner for macOS build)."""
    mod_name = "build_mac"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load macOS build module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"macOS build module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(Callable[..., int], fn)


def _load_build_winlinux_runner() -> Callable[..., int] | None:
    """Load tools/inst/win/installwin_linux.py (runner for Windows cross build on Linux)."""
    mod_name = "installwin_linux"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load Windows Linux build module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(
            f"Windows Linux build module '{mod_name}' has no run_install(dry_run=...) function."
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
        "--run",
        "--start",
        dest="run",
        action="store_true",
        help="Runs the Tauri desktop app (pnpm tauri dev).",
    )
    parser.add_argument(
        "--build",
        action="store_true",
        help="Build helper output (prints build targets).",
    )
    parser.add_argument(
        "--winlinux",
        action="store_true",
        help="Enable Windows cross-compile on Linux (use with --build).",
    )
    parser.add_argument(
        "--build-lin",
        action="store_true",
        help="Build Linux desktop bundles (use NO_STRIP/CLEAN_BUNDLE env).",
    )
    parser.add_argument(
        "--build-win",
        action="store_true",
        help="Build Windows bundles (use WIN_BUNDLES env). Add -p for portable.",
    )
    parser.add_argument(
        "-p",
        "--portable",
        action="store_true",
        help="Portable mode for --build-win (build exe + package, no installer).",
    )
    parser.add_argument(
        "--build-mac",
        action="store_true",
        help="Build macOS bundles (MAC_BUNDLES=app,dmg).",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run pnpm tests for the desktop app.",
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

    if args.build and args.winlinux:
        handled = True
        console_section("Windows Build (Linux cross)")
        run_build_winlinux = _load_build_winlinux_runner()
        if not run_build_winlinux:
            print("No Windows cross build routine found. Expected: tools/inst/win/installwin_linux.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_build_winlinux)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_build_winlinux())
                else:
                    exit_code = max(exit_code, run_build_winlinux(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_build_winlinux(args.dry_run))
    elif args.build:
        handled = True
        _print_build_helper()

    if args.test:
        handled = True
        console_section("Test Suite")
        run_test = _load_test_runner()
        if not run_test:
            print("No test routine found. Expected: tools/inst/run_test.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_test)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_test())
                else:
                    exit_code = max(exit_code, run_test(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_test(args.dry_run))

    if args.build_lin:
        handled = True
        console_section("Linux Build")
        run_build_lin = _load_build_lin_runner()
        if not run_build_lin:
            print("No Linux build routine found. Expected: tools/build/build_lin.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_build_lin)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_build_lin())
                else:
                    exit_code = max(exit_code, run_build_lin(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_build_lin(args.dry_run))

    if args.build_win:
        handled = True
        console_section("Windows Build")
        run_build_win = (
            _load_build_win_portable_runner() if args.portable else _load_build_win_runner()
        )
        if not run_build_win:
            if args.portable:
                print("No Windows portable build routine found. Expected: tools/build/build_win_p.py")
            else:
                print("No Windows build routine found. Expected: tools/build/build_win.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_build_win)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_build_win())
                else:
                    exit_code = max(exit_code, run_build_win(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_build_win(args.dry_run))

    if args.build_mac:
        handled = True
        console_section("macOS Build")
        run_build_mac = _load_build_mac_runner()
        if not run_build_mac:
            print("No macOS build routine found. Expected: tools/build/build_mac.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_build_mac)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_build_mac())
                else:
                    exit_code = max(exit_code, run_build_mac(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_build_mac(args.dry_run))

    if args.winlinux and not args.build:
        handled = True
        print("Use --winlinux with --build (example: python3 tools/control.py --winlinux --build).")
        exit_code = max(exit_code, 1)

    if args.doctor or args.check:
        handled = True
        exit_code = max(exit_code, run_doctor(args.json))

    if not handled:
        print(
            "Please specify a command (e.g. --doctor, --install, --tauri, "
            "or --start/--run/--build)."
        )
        return 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
