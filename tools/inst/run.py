#!/usr/bin/env python3
"""
Run the Tauri desktop app in dev mode.

control.py entry:
  python3 tools/control.py --start (alias: --run)

What it does (default):
  cd <repo>/apps/fmd-desktop
  (optional) pnpm install (if node_modules missing)
  pnpm tauri dev
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import signal
from pathlib import Path
from typing import List, Optional

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
    "box": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
}

_DRY_RUN = False


def section(title: str) -> None:
    print(f"\n{ICONS['box']}\n{ICONS['info']} {title}\n{ICONS['box']}")


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def display_available() -> bool:
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


def ensure_xvfb() -> bool:
    if which("xvfb-run"):
        return True
    if _DRY_RUN:
        print(f"{ICONS['info']} Dry run: would install xvfb.")
        return True

    if which("apt-get"):
        run(["sudo", "apt-get", "install", "-y", "xvfb"], check=False)
        if which("xvfb-run"):
            return True

    if which("pacman"):
        for pkg in ["xorg-server-xvfb", "xvfb"]:
            run(["sudo", "pacman", "-S", "--needed", "--noconfirm", pkg], check=False)
            if which("xvfb-run"):
                return True

    return False


def run(cmd: List[str], *, cwd: Optional[Path] = None, check: bool = True) -> int:
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")
    if _DRY_RUN:
        return 0
    p = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and p.returncode != 0:
        raise RuntimeError(f"Command failed (exit {p.returncode}): {' '.join(cmd)}")
    return p.returncode


def run_with_interrupt_prompt(
    cmd: List[str],
    *,
    cwd: Optional[Path] = None,
    check: bool = True,
) -> int:
    if _DRY_RUN or not sys.stdin.isatty():
        return run(cmd, cwd=cwd, check=check)
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")

    popen_kwargs: dict = {}
    if os.name == "posix":
        popen_kwargs["start_new_session"] = True
    elif sys.platform == "win32" and hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    p = subprocess.Popen(cmd, cwd=str(cwd) if cwd else None, **popen_kwargs)
    while True:
        try:
            rc = p.wait()
            break
        except KeyboardInterrupt:
            if p.poll() is not None:
                rc = p.returncode
                break
            if _confirm_exit():
                _signal_child(p, signal.SIGINT)
                rc = p.wait()
                break
            print(f"{ICONS['info']} Weiter...")
            continue

    if check and rc != 0:
        raise RuntimeError(f"Command failed (exit {rc}): {' '.join(cmd)}")
    return rc


def _confirm_exit() -> bool:
    while True:
        try:
            answer = input("Beenden? (j/n) ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print()
            return True
        if answer in {"j", "ja", "y", "yes"}:
            return True
        if answer in {"n", "nein", ""}:
            return False
        print("Bitte 'j' oder 'n' eingeben.")


def _signal_child(proc: subprocess.Popen, sig: int) -> None:
    try:
        if os.name == "posix":
            os.killpg(proc.pid, sig)
        else:
            proc.send_signal(sig)
    except ProcessLookupError:
        return
    except Exception:
        try:
            proc.send_signal(sig)
        except Exception:
            return


def cmd_ok(cmd: List[str]) -> bool:
    if _DRY_RUN:
        return True
    try:
        return (
            subprocess.run(
                cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            ).returncode
            == 0
        )
    except Exception:
        return False


def repo_root_from_here() -> Path:
    # tools/inst/run.py -> parents[2] == repo root
    return Path(__file__).resolve().parents[2]


def run_install(dry_run: bool = False) -> int:
    """
    Entry point used by control.py.
    """
    global _DRY_RUN
    _DRY_RUN = dry_run

    if platform.system().lower() != "linux":
        print(
            f"{ICONS['warn']} --start/--run is primarily intended for Linux Tauri dev; "
            f"OS={platform.system()}."
        )
        # Still attempt to run in case pnpm/tauri is usable.
    try:
        repo_root = repo_root_from_here()
        target_dir = (repo_root / "apps" / "fmd-desktop").resolve()
        legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
        if not target_dir.exists() and legacy_dir.exists():
            print(
                f"{ICONS['warn']} Found legacy path (tools/apps). "
                "Consider re-running --tauri to scaffold into /apps."
            )
            target_dir = legacy_dir

        section("Run Context")
        print(f"{ICONS['info']} Repo root:  {repo_root}")
        print(f"{ICONS['info']} Target dir: {target_dir}")

        if not target_dir.exists():
            print(f"{ICONS['err']} Target directory not found.")
            print(f"{ICONS['info']} Create it first with: python3 tools/control.py --tauri")
            return 1

        if which("pnpm") is None:
            print(f"{ICONS['err']} pnpm not found in PATH.")
            print(f"{ICONS['info']} Fix with: python3 tools/control.py --tauri (or install pnpm)")
            return 1

        # Rust must be functional for Tauri.
        if not (cmd_ok(["rustc", "--version"]) and cmd_ok(["cargo", "--version"])):
            print(
                f"{ICONS['err']} Rust toolchain not usable "
                "(rustc/cargo missing or no active toolchain)."
            )
            print(f"{ICONS['info']} Fix with: python3 tools/control.py --tauri")
            return 1
        print(f"{ICONS['ok']} Rust toolchain OK.")

        # If node_modules missing, install deps first.
        node_modules = target_dir / "node_modules"
        if not node_modules.exists():
            section("Install JS dependencies")
            run(["pnpm", "install"], cwd=target_dir)
        else:
            print(f"{ICONS['ok']} node_modules present -> skipping pnpm install.")

        section("Start Tauri dev")
        print(f"{ICONS['info']} Stop with Ctrl+C, then confirm with j/n.")
        dev_cmd = ["pnpm", "tauri", "dev"]
        rc = run_with_interrupt_prompt(dev_cmd, cwd=target_dir, check=False)
        if rc == 0:
            return 0

        if platform.system().lower() == "linux" and not display_available():
            print(f"{ICONS['warn']} Tauri dev exited (code {rc}); trying xvfb-run.")
            if ensure_xvfb():
                xvfb_run = which("xvfb-run")
                if xvfb_run:
                    print(f"{ICONS['info']} Using xvfb-run after failure.")
                    return run([xvfb_run, "-a", *dev_cmd], cwd=target_dir, check=True)

            print(f"{ICONS['err']} No display detected and xvfb-run not available.")
            if which("apt-get"):
                hint = "sudo apt-get install -y xvfb"
            elif which("pacman"):
                hint = "sudo pacman -S --needed xorg-server-xvfb"
            else:
                hint = "Install xvfb with your package manager"
            print(f"{ICONS['info']} Fix with: {hint}")
            print(f"{ICONS['info']} Then run: python3 tools/control.py --start")
            return 1

        return rc
    except Exception as ex:
        print(f"{ICONS['err']} {ex}")
        return 1


if __name__ == "__main__":
    raise SystemExit(run_install(False))
