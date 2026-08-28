from __future__ import annotations

from tools import logger
from tools.tauri import common


def main(*, dry_run: bool = False) -> int:
    logger.warn("Pacman keyring repair is optional and should only be used after signature errors.")
    commands = [
        ["sudo", "pacman", "-Sy", "archlinux-keyring"],
        ["sudo", "pacman-key", "--populate", "archlinux"],
        ["sudo", "pacman-key", "--refresh-keys"],
    ]
    failures = 0
    for command in commands:
        result = common.run_command(command, dry_run=dry_run)
        if result.returncode != 0:
            failures += 1
            logger.fail(f"Pacman keyring command failed: {common.tail(result.stdout + result.stderr)}")
    return 1 if failures else 0
