#!/usr/bin/env python3
"""
Linux dispatcher installer.

Selects a distro-specific installer module:
- installuixarc.py (Arch/pacman)
- installuixubu.py (Ubuntu/apt)
- installuixdeb.py (Debian/apt)

Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import importlib
import shutil
from pathlib import Path
from typing import Dict


def _read_os_release() -> Dict[str, str]:
    data: Dict[str, str] = {}
    p = Path("/etc/os-release")
    if not p.exists():
        return data
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        data[k.strip()] = v
    return data


def _pick_module() -> str:
    # Prefer package manager detection first
    if shutil.which("pacman"):
        return "installuixarc"
    if shutil.which("apt-get"):
        osr = _read_os_release()
        os_id = (osr.get("ID") or "").lower()
        like = (osr.get("ID_LIKE") or "").lower()

        if os_id == "ubuntu" or "ubuntu" in like:
            return "installuixubu"
        if os_id == "debian" or "debian" in like:
            return "installuixdeb"

        # apt-based fallback: choose Debian-style defaults
        return "installuixdeb"

    # Last fallback: try Debian-style anyway (will error nicely if apt-get is absent)
    return "installuixdeb"


def run_install(dry_run: bool = False) -> int:
    mod_name = _pick_module()
    mod = importlib.import_module(mod_name)
    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        raise SystemExit(f"Installer module '{mod_name}' has no run_install(dry_run=...)")
    return int(fn(dry_run))


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))
