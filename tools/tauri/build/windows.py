from __future__ import annotations

import argparse

from tools import logger
from tools.tauri import common, paths


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    if common.host_os() != "windows":
        logger.fail("Windows build requires a Windows host. Use windows-cross-linux on Linux.")
        return 1
    command = common.tauri_cli_command("build", "--target", "x86_64-pc-windows-msvc")
    common.print_build_plan("windows", command, dry_run=dry_run)
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run)
    code = common.print_result(result, "Windows Tauri build completed", "Windows Tauri build failed")
    if code == 0 and dry_run:
        logger.info("📁 Dry-run finished; no new artifacts were created.")
    elif code == 0:
        common.print_build_artifacts()
    return code
