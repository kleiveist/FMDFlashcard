#!/usr/bin/env python3
"""Linux-only: prepare Tauri dev env + scaffold a pnpm + React/TS Tauri app.

Stages (order):
1) WASD libs (WebKit2GTK + GUI deps)
2) Build deps (cc/make/pkg-config)
3) Node tooling (node/npm + pnpm)
4) Rust toolchain (rustup + stable toolchain)
5) Scaffold (create-tauri-app) + pnpm install (+ optional dev)

Entry for tools/control.py: run_install(dry_run: bool=False) -> int
"""

from __future__ import annotations

import argparse, os, platform, shutil, subprocess, sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ICONS: Dict[str, str] = {
    "ok": "✅", "info": "ℹ️", "warn": "⚠️", "err": "❌", "run": "▶️",
    "step": "🧩", "box": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
}
_DRY_RUN = False

def eprint(*a: object) -> None: print(*a, file=sys.stderr)

def section(title: str) -> None:
    print(f"\n{ICONS['box']}\n{ICONS['step']} {title}\n{ICONS['box']}\n")

def run(cmd: List[str], *, cwd: Optional[Path]=None, env: Optional[Dict[str,str]]=None, check: bool=True) -> subprocess.CompletedProcess:
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")
    if _DRY_RUN:
        return subprocess.CompletedProcess(cmd, 0)
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, env=env, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed (exit {proc.returncode}): {' '.join(cmd)}")
    return proc

def cmd_ok(cmd: List[str]) -> bool:
    if _DRY_RUN: return True
    try: return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    except Exception: return False

def which(cmd: str) -> Optional[str]: return shutil.which(cmd)

def display_available() -> bool:
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))

def ensure_not_root() -> None:
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        raise RuntimeError("Please run as a normal user (not root).")

def read_os_release() -> Dict[str, str]:
    p = Path("/etc/os-release")
    if not p.exists(): return {}
    out: Dict[str, str] = {}
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        out[k] = v.strip().strip('"')
    return out

def detect_linux_family() -> Tuple[str, Dict[str, str]]:
    osr = read_os_release()
    os_id = (osr.get("ID") or "").lower()
    like = (osr.get("ID_LIKE") or "").lower().split()
    if os_id in {"debian","ubuntu"} or "debian" in like or "ubuntu" in like: return "debian", osr
    if os_id in {"arch","manjaro","endeavouros","cachyos"} or "arch" in like: return "arch", osr
    if which("apt-get") or which("apt"): return "debian", osr
    if which("pacman"): return "arch", osr
    return "unknown", osr

def pkg_config_exists(name: str) -> bool:
    return which("pkg-config") is not None and cmd_ok(["pkg-config","--exists",name])

def need_wasd_deps() -> bool:
    for r in ["webkit2gtk-4.1","gtk+-3.0","openssl","librsvg-2.0"]:
        if not pkg_config_exists(r): return True
    return False

def need_build_deps() -> bool:
    return any(which(c) is None for c in ["cc","make","pkg-config"])

def rust_ready() -> bool:
    # which(rustc) may be a rustup shim; we require the toolchain to be active.
    return cmd_ok(["rustc","--version"]) and cmd_ok(["cargo","--version"])

def _install_apt(pkgs: List[str]) -> None:
    env = dict(os.environ); env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["sudo","apt-get","update"], env=env)
    run(["sudo","apt-get","install","-y",*pkgs], env=env)

def _install_pacman(pkgs: List[str]) -> None:
    run(["sudo","pacman","-S","--needed","--noconfirm",*pkgs])

def install_wasd_deps(family: str) -> None:
    if family == "debian":
        pkgs = [
            "libwebkit2gtk-4.1-dev","libgtk-3-dev","libssl-dev","libxdo-dev",
            "librsvg2-dev","libayatana-appindicator3-dev","pkg-config"
        ]
        if not display_available():
            pkgs.append("xvfb")
        _install_apt(pkgs)
        return
    if family == "arch":
        _install_pacman([
            "webkit2gtk-4.1","gtk3","openssl","xdotool","librsvg",
            "appmenu-gtk-module","libappindicator-gtk3","pkgconf"
        ])
        return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def install_build_deps(family: str) -> None:
    if family == "debian": _install_apt(["build-essential","curl","wget","file","pkg-config"]); return
    if family == "arch": _install_pacman(["base-devel","curl","wget","file","pkgconf"]); return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def install_node_deps(family: str) -> None:
    if family == "debian": _install_apt(["nodejs","npm"]); return
    if family == "arch": _install_pacman(["nodejs","npm","pnpm"]); return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def install_rustup_pkg(family: str) -> None:
    if family == "debian": _install_apt(["rustup"]); return
    if family == "arch": _install_pacman(["rustup"]); return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def ensure_pnpm(family: str) -> None:
    if which("pnpm"): print(f"{ICONS['ok']} pnpm gefunden."); return
    if _DRY_RUN: print(f"{ICONS['info']} pnpm fehlt; dry-run wuerde installieren."); return

    # Arch: prefer pacman (avoids npm -g permission/EACCES).
    if family == "arch" and which("pacman"):
        try: _install_pacman(["pnpm"])
        except Exception: pass
        if which("pnpm"): print(f"{ICONS['ok']} pnpm installiert (pacman)."); return

    # Prefer corepack when available.
    if which("corepack"):
        run(["corepack","enable"], check=False)
        run(["corepack","prepare","pnpm@latest","--activate"], check=False)
        if which("pnpm"): print(f"{ICONS['ok']} pnpm aktiviert (corepack)."); return

    # Fallback: npm -g (may require sudo).
    if which("npm"):
        try: run(["npm","i","-g","pnpm"], check=True)
        except Exception: run(["sudo","npm","i","-g","pnpm"], check=True)
        if which("pnpm"): print(f"{ICONS['ok']} pnpm installiert (npm -g)."); return

    raise RuntimeError("Could not install/enable pnpm automatically.")

def ensure_rust(family: str) -> None:
    if rust_ready(): print(f"{ICONS['ok']} Rust Toolchain aktiv."); return
    if _DRY_RUN: print(f"{ICONS['info']} Rust fehlt/inaktiv; dry-run wuerde rustup+stable installieren."); return

    if which("rustup") is None:
        try: install_rustup_pkg(family)
        except Exception: pass

    if which("rustup") is None:
        # Fallback: official installer
        if which("bash") and which("curl"):
            run(["bash","-lc","curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"])
        else:
            raise RuntimeError("Rust not found. Install rustup or rustc/cargo.")

    # This fixes the log case: rustup installed but "no active toolchain".
    run(["rustup","toolchain","install","stable"], check=False)
    run(["rustup","default","stable"], check=False)

    if not rust_ready():
        raise RuntimeError("Rust installed but rustc/cargo still not usable. Open a new shell and re-run.")
    print(f"{ICONS['ok']} Rust Toolchain aktiviert (stable).")

def report_rust_status() -> None:
    section("Rust Status")
    def ver(cmd: str) -> str:
        try:
            p = subprocess.run([cmd,"--version"], capture_output=True, text=True)
            return p.stdout.strip() if p.returncode == 0 else f"{cmd} not available"
        except Exception:
            return f"{cmd} not available"
    print(f"{ICONS['info']} rustc: {which('rustc') or '-'} ({ver('rustc')})")
    print(f"{ICONS['info']} cargo: {which('cargo') or '-'} ({ver('cargo')})")
    if which("rustup"):
        p = subprocess.run(["rustup","show"], capture_output=True, text=True)
        if p.returncode == 0: print(f"{ICONS['info']} rustup show:\n{p.stdout.strip()}")
    print(f"{ICONS['ok']} Rust bereit." if rust_ready() else f"{ICONS['warn']} Rust noch nicht bereit.")

def ensure_target_dir(target_dir: Path, force: bool) -> bool:
    if target_dir.exists():
        if force or (target_dir.is_dir() and not any(target_dir.iterdir())): return True
        print(f"{ICONS['warn']} Target exists and is not empty: {target_dir}")
        print(f"{ICONS['info']} Skipping scaffold; continuing with install steps in that directory.")
        return False
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    return True

def scaffold_project(target_dir: Path, template: str, identifier: str) -> None:
    section("Scaffold (create-tauri-app)")
    # create-tauri-app supports: --manager, --template, --yes, --identifier
    run([
        "pnpm","create","tauri-app",
        "--template",template,
        "--manager","pnpm",
        "--yes",
        "--identifier",identifier,
        str(target_dir)
    ])

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Prepare Linux for Tauri (WASD libs, pnpm, rustup, scaffold).")
    ap.add_argument("--target", default="apps/fmd-desktop")
    ap.add_argument("--template", default="react-ts")
    ap.add_argument("--identifier", default="com.fmd.flashcard")
    ap.add_argument("--repo-root", default=None)
    ap.add_argument("--skip-system-deps", action="store_true")
    ap.add_argument("--full-upgrade-arch", action="store_true")
    ap.add_argument("--skip-install", action="store_true")
    ap.add_argument("--dev", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args(argv)

    if platform.system().lower() != "linux":
        eprint("This script is Linux-only."); return 2

    try:
        ensure_not_root()
        family, osr = detect_linux_family()

        # tools/inst/linux/installuixtauri.py -> parents[3] == repo root
        repo_root = (
            Path(args.repo_root).expanduser().resolve()
            if args.repo_root
            else Path(__file__).resolve().parents[3]
        )
        target_dir = (repo_root / args.target).resolve()

        section("Context")
        print(f"{ICONS['info']} Detected distro family: {family} (ID={osr.get('ID')})")
        print(f"{ICONS['info']} Repo root: {repo_root}")
        print(f"{ICONS['info']} Target dir: {target_dir}")

        if not args.skip_system_deps and family != "unknown":
            if family == "arch" and args.full_upgrade_arch:
                section("Arch: Full upgrade"); run(["sudo","pacman","-Syu","--noconfirm"])

            section("System deps: WASD libs (WebView/GUI)")
            if need_wasd_deps():
                print(f"{ICONS['warn']} Missing -> installing...")
                install_wasd_deps(family)
            else:
                print(f"{ICONS['ok']} OK -> skipping.")

            section("System deps: Build toolchain")
            if need_build_deps():
                print(f"{ICONS['warn']} Missing -> installing...")
                install_build_deps(family)
            else:
                print(f"{ICONS['ok']} OK -> skipping.")

            section("System deps: Node tooling")
            if which("node") is None or which("npm") is None:
                print(f"{ICONS['warn']} Missing -> installing...")
                install_node_deps(family)
            else:
                print(f"{ICONS['ok']} OK -> skipping.")
        else:
            section("System deps")
            print(f"{ICONS['info']} Skipped (requested or unknown distro).")

        section("Ensure pnpm"); ensure_pnpm(family)
        section("Ensure Rust toolchain"); ensure_rust(family); report_rust_status()

        if ensure_target_dir(target_dir, force=args.force):
            scaffold_project(target_dir, template=args.template, identifier=args.identifier)

        if not args.skip_install:
            section("pnpm install"); run(["pnpm","install"], cwd=target_dir)
        if args.dev:
            section("pnpm tauri dev"); run(["pnpm","tauri","dev"], cwd=target_dir)

        section("Done")
        print(f"{ICONS['ok']} Fertig.")
        if not args.dev:
            print(f"{ICONS['info']} Next:")
            print("  python3 tools/control.py --start")
            if not display_available():
                print("  (headless) xvfb-run -a pnpm tauri dev")
            print(f"  oder: cd {target_dir} && pnpm tauri dev")
        return 0
    except Exception as ex:
        eprint(f"{ICONS['err']} {ex}"); return 1

def run_install(dry_run: bool = False) -> int:
    global _DRY_RUN
    _DRY_RUN = dry_run
    return main([])

if __name__ == "__main__":
    raise SystemExit(main())
