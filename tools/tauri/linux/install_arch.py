from __future__ import annotations

from tools.tauri import common


def install(*, dry_run: bool) -> int:
    command = [
        "sudo",
        "pacman",
        "-S",
        "--needed",
        "--noconfirm",
        "webkit2gtk-4.1",
        "gtk3",
        "librsvg",
        "openssl",
        "libayatana-appindicator",
        "patchelf",
        "squashfs-tools",
        "desktop-file-utils",
        "fuse2",
        "file",
    ]
    result = common.run_command(command, dry_run=dry_run)
    return common.print_result(result, "Arch Tauri system dependencies ready", "Arch system dependency install failed")
