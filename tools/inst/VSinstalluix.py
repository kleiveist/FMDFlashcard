#!/usr/bin/env python3
"""
Unified VS Code installer for Linux/Unix.

Supports:
- Arch and derivatives (pacman, optional AUR helper)
- Debian/Ubuntu (official .deb download)
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from typing import List, Optional

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}


def read_os_release() -> dict:
    data = {}
    try:
        with open("/etc/os-release", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                data[k] = v.strip().strip('"')
    except FileNotFoundError:
        pass
    return data


def is_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


def run(
    cmd: List[str],
    check: bool = True,
    env: dict | None = None,
    use_sudo: bool = True,
) -> None:
    if use_sudo and not is_root() and shutil.which("sudo"):
        cmd = ["sudo"] + cmd
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=check, env=env)


def pacman_install(pkgs: List[str]) -> None:
    run(["pacman", "-Syu", "--noconfirm"])
    run(["pacman", "-S", "--needed", "--noconfirm", *pkgs])


def aur_install(helper: str, pkg: str) -> None:
    if is_root():
        raise RuntimeError("AUR helper darf nicht als root laufen. Bitte ohne sudo ausfuehren.")
    run([helper, "-S", "--needed", "--noconfirm", pkg], use_sudo=False)


def ensure_pkg(pkg: str) -> None:
    if shutil.which(pkg):
        return
    env = dict(os.environ)
    env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["apt-get", "update"], env=env)
    run(["apt-get", "install", "-y", pkg], env=env)


def arch_to_vscode_deb_target() -> str:
    m = platform.machine().lower()
    if m in {"x86_64", "amd64"}:
        return "linux-deb-x64"
    if m in {"aarch64", "arm64"}:
        return "linux-deb-arm64"
    if m.startswith("armv7") or m in {"armhf"}:
        return "linux-deb-armhf"
    raise RuntimeError(f"Unsupported architecture for VS Code deb: {m}")


def install_arch() -> int:
    if shutil.which("code"):
        print(f"{ICONS['info']} VS Code ist bereits installiert (binary: code).")
        return 0

    # Default: Microsoft-Build (AUR) wenn moeglich, sonst OSS-build aus pacman.
    # Setze VSCODE_VARIANT=oss um immer pacman 'code' zu nehmen.
    variant = os.environ.get("VSCODE_VARIANT", "ms").lower().strip()

    if variant == "oss":
        pacman_install(["code"])
        print(f"{ICONS['ok']} Code - OSS installiert (pacman: code).")
        return 0

    helper: Optional[str] = None
    for h in ("paru", "yay"):
        if shutil.which(h):
            helper = h
            break

    if helper:
        # AUR helper muss bereits vorhanden sein; Skript installiert ihn bewusst nicht automatisch.
        aur_install(helper, "visual-studio-code-bin")
        print(
            f"{ICONS['ok']} Visual Studio Code (Microsoft build) installiert "
            "(AUR: visual-studio-code-bin)."
        )
        return 0

    pacman_install(["code"])
    print(
        f"{ICONS['warn']} Kein AUR helper (paru/yay) gefunden -> "
        "Code - OSS installiert (pacman: code)."
    )
    print(
        f"{ICONS['info']} Wenn du den Microsoft-Build willst: installiere paru/yay "
        "und dann VSCODE_VARIANT=ms ausfuehren."
    )
    return 0


def install_deb_like() -> int:
    if shutil.which("code"):
        print(f"{ICONS['info']} VS Code ist bereits installiert (binary: code).")
        return 0

    ensure_pkg("curl")

    target = arch_to_vscode_deb_target()
    url = f"https://update.code.visualstudio.com/latest/{target}/stable"
    deb_path = "/tmp/vscode-latest.deb"

    print(f"Download: {url}")
    run(["curl", "-L", "-o", deb_path, url])

    env = dict(os.environ)
    env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["apt-get", "update"], env=env)
    run(["apt", "install", "-y", deb_path], env=env)

    print(f"{ICONS['ok']} Visual Studio Code installiert.")
    return 0


def _main() -> int:
    osr = read_os_release()
    os_id = (osr.get("ID") or "").lower()
    os_like = (osr.get("ID_LIKE") or "").lower().split()
    has_pacman = shutil.which("pacman") is not None
    has_apt = shutil.which("apt-get") is not None

    if os_id in {"arch", "manjaro", "endeavouros", "cachyos"} or "arch" in os_like or has_pacman:
        return install_arch()

    if os_id in {"debian", "ubuntu"} or "debian" in os_like or "ubuntu" in os_like or has_apt:
        return install_deb_like()

    print(
        f"{ICONS['err']} Dieses Skript ist fuer Arch/Derivate, Debian oder Ubuntu gedacht. "
        f"Detected ID={os_id}, ID_LIKE={' '.join(os_like) if os_like else '-'}"
    )
    return 2


def main() -> int:
    try:
        return _main()
    except subprocess.CalledProcessError as e:
        cmd = e.cmd
        cmd_text = " ".join(str(c) for c in cmd) if isinstance(cmd, list) else str(cmd)
        code = int(e.returncode) if e.returncode is not None else 1
        print(f"{ICONS['err']} Fehler beim Ausfuehren (exit {code}): {cmd_text}")
        return code
    except Exception as e:
        print(f"{ICONS['err']} Fehler: {e}")
        return 1


def run_install() -> int:
    return main()


if __name__ == "__main__":
    sys.exit(main())
