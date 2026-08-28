from __future__ import annotations

import argparse

from tools import logger
from tools.tauri import common, paths


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    if common.host_os() != "darwin" and not dry_run:
        logger.fail("macOS build requires a macOS host.")
        return 1
    command = common.tauri_cli_command("build")
    common.print_build_plan("macos", command, dry_run=dry_run)
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run)
    code = common.print_result(result, "macOS Tauri build completed", "macOS Tauri build failed")
    if code == 0 and dry_run:
        logger.info("📁 Dry-run finished; no new artifacts were created.")
    elif code == 0:
        common.print_build_artifacts()
    return code
