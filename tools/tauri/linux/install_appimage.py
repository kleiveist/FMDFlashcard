from __future__ import annotations

from tools import logger
from tools.tauri import paths


def describe() -> int:
    logger.info(
        f"AppImage artifacts are collected from {paths.TAURI_DIR / 'target' / 'release' / 'bundle' / 'appimage'}"
    )
    logger.info("Use 'python tools/control.py tauri copy' to copy generated AppImage bundles.")
    return 0
