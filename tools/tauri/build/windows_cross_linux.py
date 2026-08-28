from __future__ import annotations

import argparse
import shutil

from tools import logger
from tools.tauri import common, paths


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    if common.host_os() != "linux":
        logger.fail("Windows cross-build is supported from Linux hosts only.")
        return 1
    if shutil.which("cargo-xwin") is None and not dry_run:
        logger.fail("cargo-xwin not found. Action: install cargo-xwin before cross-building.")
        return 1
    command = common.tauri_cli_command("build", "--runner", "cargo-xwin", "--target", "x86_64-pc-windows-msvc")
    common.print_build_plan("windows-cross-linux", command, dry_run=dry_run)
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run)
    code = common.print_result(result, "Windows cross-build completed", "Windows cross-build failed")
    if code == 0 and dry_run:
        logger.info("📁 Dry-run finished; no new artifacts were created.")
    elif code == 0:
        common.print_build_artifacts()
    return code
