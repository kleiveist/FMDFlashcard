from __future__ import annotations

import argparse

from tools.tauri.build import appimage


def main(args: argparse.Namespace) -> int:
    return appimage.install_latest(dry_run=bool(getattr(args, "dry_run", False)))
