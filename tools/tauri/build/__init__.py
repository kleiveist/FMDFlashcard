from __future__ import annotations

import argparse

from tools import logger
from tools.tauri.build import appimage, linux, macos, windows, windows_cross_linux, windows_portable

TARGETS = {
    "linux": linux.main,
    "windows": windows.main,
    "windows-portable": windows_portable.main,
    "windows-cross-linux": windows_cross_linux.main,
    "macos": macos.main,
}


def main(args: argparse.Namespace) -> int:
    _normalize_raw_tauri_windows_portable_args(args)

    if getattr(args, "appimage", False):
        if getattr(args, "target", "linux") != "linux":
            logger.fail("--appimage can only be used with the Linux build target.")
            return 1
        if getattr(args, "bundles", None) and getattr(args, "bundles", None) != "appimage":
            logger.warn("--appimage always uses '--bundles appimage'; ignoring the explicit --bundles value.")
        return appimage.main(args)

    target = getattr(args, "target", "linux")
    handler = TARGETS.get(target)
    if handler is None:
        logger.fail(f"Unknown Tauri build target: {target}. Use windows-portable for a portable Windows ZIP.")
        return 1
    return handler(args)


def _normalize_raw_tauri_windows_portable_args(args: argparse.Namespace) -> None:
    if getattr(args, "target", None) != "x86_64-pc-windows-msvc":
        return
    if getattr(args, "runner", None) != "cargo-xwin":
        return
    if not getattr(args, "no_bundle", False):
        return
    logger.info("Interpreting raw Tauri Windows portable flags as --target windows-portable.")
    args.target = "windows-portable"
