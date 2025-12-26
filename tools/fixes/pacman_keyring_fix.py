#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from typing import Sequence

SIG_ERR = re.compile(
    r"(Signatur von .* ist ungültig|Ungültiges oder beschädigtes Paket.*PGP|"
    r"signature from .* is invalid|invalid or corrupted package.*PGP)",
    re.IGNORECASE,
)


def should_apply(pacman_output: str) -> bool:
    return bool(SIG_ERR.search(pacman_output or ""))


def apply(dry_run: bool = False) -> int:
    cmd: Sequence[str] = [
        "sudo",
        "pacman",
        "-Syyu",
        "archlinux-keyring",
        "cachyos-keyring",
    ]
    print("▶", " ".join(cmd))
    if dry_run:
        return 0
    p = subprocess.run(cmd)
    return p.returncode


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    raise SystemExit(apply(dry_run=dry_run))
