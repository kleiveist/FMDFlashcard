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


def run(cmd: List[str], *, cwd: Optional[Path] = None, check: bool = True) -> int:
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")
    if _DRY_RUN:
        return 0
    p = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and p.returncode != 0:
        raise RuntimeError(f"Command failed (exit {p.returncode}): {' '.join(cmd)}")
    return p.returncode


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
        print(f"{ICONS['info']} This keeps running until you stop it (Ctrl+C).")
        dev_cmd = ["pnpm", "tauri", "dev"]
        if platform.system().lower() == "linux" and not display_available():
            xvfb_run = which("xvfb-run")
            if xvfb_run:
                print(f"{ICONS['info']} No display detected; using xvfb-run.")
                dev_cmd = [xvfb_run, "-a", *dev_cmd]
            else:
                print(f"{ICONS['err']} No display detected and xvfb-run not found.")
                if which("apt-get"):
                    hint = "sudo apt-get install -y xvfb"
                elif which("pacman"):
                    hint = "sudo pacman -S --needed xvfb"
                else:
                    hint = "Install xvfb with your package manager"
                print(f"{ICONS['info']} Fix with: {hint}")
                print(f"{ICONS['info']} Then run: python3 tools/control.py --start")
                return 1
        run(dev_cmd, cwd=target_dir, check=True)

        return 0
    except Exception as ex:
        print(f"{ICONS['err']} {ex}")
        return 1


if __name__ == "__main__":
    raise SystemExit(run_install(False))
