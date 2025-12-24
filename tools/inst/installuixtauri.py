#!/usr/bin/env python3
"""
Init (Linux): Tauri + React + TypeScript (pnpm) project scaffold.

What it does (defaults):
1) (Optional) Install Linux system deps if missing (Debian/Ubuntu via apt, Arch via pacman).
2) Ensure pnpm is available (prefer corepack).
3) Scaffold a new Tauri project (non-interactive): `pnpm create tauri-app <dir> --template react-ts`
4) Run `pnpm install`
5) (Optional) Run `pnpm tauri dev`

References:
- Tauri Linux prerequisites package lists: https://v2.tauri.app/start/prerequisites/
- create-tauri-app non-interactive `--template react-ts`: https://github.com/tauri-apps/create-tauri-app
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

_DRY_RUN = False


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def run(cmd: List[str], cwd: Optional[Path] = None, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    if _DRY_RUN:
        return subprocess.CompletedProcess(cmd, 0)
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed (exit {proc.returncode}): {' '.join(cmd)}")
    return proc


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def read_os_release() -> Dict[str, str]:
    data: Dict[str, str] = {}
    path = Path("/etc/os-release")
    if not path.exists():
        return data
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"')
        data[k.strip()] = v
    return data


def detect_linux_family() -> Tuple[str, Dict[str, str]]:
    """
    Returns: ("arch"|"debian"|"unknown", os_release_dict)
    """
    osr = read_os_release()
    distro_id = (osr.get("ID") or "").lower()
    like = (osr.get("ID_LIKE") or "").lower()

    def has(token: str) -> bool:
        return token in distro_id or token in like

    if has("arch") or distro_id in {"cachyos"}:
        return "arch", osr
    if has("debian") or distro_id in {"ubuntu", "debian"}:
        return "debian", osr
    # Fallback to package manager detection when ID/ID_LIKE is incomplete.
    if which("pacman"):
        return "arch", osr
    if which("apt-get"):
        return "debian", osr
    return "unknown", osr


def ensure_not_root() -> None:
    if os.geteuid() == 0:
        raise RuntimeError(
            "Please run this script as a normal user (NOT root). "
            "It will call sudo only for system package installs."
        )


def pkg_config_exists(pkg: str) -> bool:
    if not which("pkg-config"):
        return False
    return subprocess.run(["pkg-config", "--exists", pkg]).returncode == 0


def need_system_deps() -> bool:
    # Minimal checks that usually fail when prerequisites are missing
    # (covers the most common build error: missing webkit2gtk-4.1.pc).
    required_cmds = ["cc", "make", "pkg-config"]
    if any(which(c) is None for c in required_cmds):
        return True
    if not pkg_config_exists("webkit2gtk-4.1"):
        return True
    if not pkg_config_exists("openssl"):
        return True
    # librsvg provides "librsvg-2.0" on many distros; if missing, still fine for some setups,
    # but Tauri lists it as prerequisite -> treat as required.
    if not pkg_config_exists("librsvg-2.0"):
        return True
    return False


def install_system_deps(family: str) -> None:
    if family == "debian":
        pkgs = [
            "libwebkit2gtk-4.1-dev",
            "build-essential",
            "curl",
            "wget",
            "file",
            "libxdo-dev",
            "libssl-dev",
            "libayatana-appindicator3-dev",
            "librsvg2-dev",
            "pkg-config",
            "rustc",
            "cargo",
        ]
        run(["sudo", "apt", "update"])
        run(["sudo", "apt", "install", "-y", *pkgs])
        return

    if family == "arch":
        pkgs = [
            "webkit2gtk-4.1",
            "base-devel",
            "curl",
            "wget",
            "file",
            "openssl",
            "appmenu-gtk-module",
            "libappindicator-gtk3",
            "librsvg",
            "xdotool",
            "pkgconf",  # pkg-config provider on Arch
            "rustup",
        ]
        # Avoid auto full-upgrade unless user explicitly wants it (handled by caller)
        run(["sudo", "pacman", "-S", "--needed", "--noconfirm", *pkgs])
        return

    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")


def ensure_pnpm() -> None:
    if which("pnpm"):
        return
    if _DRY_RUN:
        print("pnpm not found; dry-run would install/enable pnpm.")
        return

    # Prefer corepack (recommended by Tauri docs).
    if which("corepack"):
        run(["corepack", "enable"], check=False)
        # Prepare latest pnpm; if offline or blocked, this may fail.
        run(["corepack", "prepare", "pnpm@latest", "--activate"])
        if which("pnpm"):
            return

    # Fallback: npm global install (may require sudo depending on node setup)
    if which("npm"):
        eprint("pnpm not found. Trying: npm i -g pnpm (may ask for sudo)")
        try:
            run(["npm", "i", "-g", "pnpm"])
        except RuntimeError:
            run(["sudo", "npm", "i", "-g", "pnpm"])
        if which("pnpm"):
            return

    raise RuntimeError("Could not install/enable pnpm automatically. Install pnpm and re-run.")


def ensure_rust() -> None:
    if which("rustc") and which("cargo"):
        return
    if which("rustup"):
        run(["rustup", "toolchain", "install", "stable"])
        run(["rustup", "default", "stable"])
        return
    raise RuntimeError("Rust not found. Install rustup or rustc/cargo and re-run.")


def scaffold_project(target_dir: Path, template: str) -> None:
    # `pnpm create tauri-app <dir> --template react-ts`
    # (non-interactive supported by create-tauri-app)
    run(["pnpm", "create", "tauri-app", str(target_dir), "--template", template])


def ensure_empty_target(target_dir: Path, force: bool) -> None:
    if target_dir.exists():
        if force:
            return
        # If exists but empty -> OK
        if target_dir.is_dir() and not any(target_dir.iterdir()):
            return
        raise RuntimeError(f"Target directory already exists and is not empty: {target_dir}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Init a Tauri + React + TypeScript project on Linux (pnpm, non-interactive)."
    )
    parser.add_argument(
        "--target",
        default="apps/fmd-desktop",
        help="Target directory (relative to repo root by default). Default: apps/fmd-desktop",
    )
    parser.add_argument(
        "--template",
        default="react-ts",
        help="create-tauri-app template preset. Default: react-ts",
    )
    parser.add_argument(
        "--repo-root",
        default=None,
        help="Explicit repo root. If omitted, inferred as two levels above this script (../..).",
    )
    parser.add_argument(
        "--skip-system-deps",
        action="store_true",
        help="Do not install Linux system dependencies (even if missing).",
    )
    parser.add_argument(
        "--full-upgrade-arch",
        action="store_true",
        help="Arch only: run `sudo pacman -Syu --noconfirm` before installing deps.",
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Do not run `pnpm install` after scaffolding.",
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Run `pnpm tauri dev` after install.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Allow using an existing target directory (must be empty unless you know what you're doing).",
    )
    args = parser.parse_args(argv)

    if platform.system().lower() != "linux":
        eprint("This script is Linux-only.")
        return 2

    try:
        ensure_not_root()
        family, osr = detect_linux_family()
        if family == "unknown":
            print(
                "Unknown distro; skipping automatic system dependency install. "
                f"(ID={osr.get('ID')}, ID_LIKE={osr.get('ID_LIKE')})"
            )

        repo_root = Path(args.repo_root).expanduser().resolve() if args.repo_root else Path(__file__).resolve().parents[2]
        target_dir = (repo_root / args.target).resolve()

        print(f"Detected distro family: {family} (ID={osr.get('ID')})")
        print(f"Repo root: {repo_root}")
        print(f"Target dir: {target_dir}")

        if not args.skip_system_deps and family != "unknown":
            if family == "arch" and args.full_upgrade_arch:
                run(["sudo", "pacman", "-Syu", "--noconfirm"])
            if need_system_deps():
                print("System prerequisites seem missing -> installing...")
                install_system_deps(family)
            else:
                print("System prerequisites look OK -> skipping install.")
        elif args.skip_system_deps:
            print("Skipping system dependency installation (requested).")

        ensure_pnpm()
        ensure_rust()

        # Ensure apps dir exists
        if _DRY_RUN:
            print(f"[dry-run] Would ensure parent dir exists: {target_dir.parent}")
        else:
            target_dir.parent.mkdir(parents=True, exist_ok=True)
        ensure_empty_target(target_dir, force=args.force)

        # Scaffold
        if not target_dir.exists() or (target_dir.exists() and not any(target_dir.iterdir())):
            scaffold_project(target_dir, args.template)
        else:
            print("Target directory exists; skipping scaffold (use a fresh/empty folder for best results).")

        # Install JS deps
        if not args.skip_install:
            run(["pnpm", "install"], cwd=target_dir)

        # Dev
        if args.dev:
            run(["pnpm", "tauri", "dev"], cwd=target_dir)

        print("Done.")
        print("Next manual commands (if you didn't use --dev):")
        print(f"  cd {target_dir}")
        print("  pnpm tauri dev")
        return 0

    except Exception as ex:
        eprint(f"❌ {ex}")
        return 1


def run_install(dry_run: bool = False) -> int:
    global _DRY_RUN
    _DRY_RUN = dry_run
    return main([])


if __name__ == "__main__":
    raise SystemExit(main())
