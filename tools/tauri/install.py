from __future__ import annotations

import argparse
import shutil

from tools import logger
from tools.tauri import common, paths
from tools.tauri.linux import install as linux_install


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    failures = 0

    if not getattr(args, "skip_system_deps", False):
        failures += linux_install.install_system_dependencies(dry_run=dry_run)

    if not getattr(args, "skip_rust", False):
        failures += _ensure_rust(dry_run=dry_run)

    if not getattr(args, "skip_node", False):
        failures += _ensure_node(dry_run=dry_run)

    if not getattr(args, "skip_frontend", False):
        failures += _install_frontend_dependencies(dry_run=dry_run)

    failures += _check_tauri_scaffold()

    if failures:
        logger.fail(f"Tauri install completed with {failures} failing step(s)")
        return 1
    logger.ok("Tauri install completed")
    return 0


def _ensure_rust(*, dry_run: bool) -> int:
    if shutil.which("rustup") and shutil.which("cargo") and shutil.which("rustc"):
        logger.ok("Rust toolchain found")
        return 0

    if shutil.which("rustup") is None:
        logger.warn("rustup not found")
        logger.info("Install Rust from https://rustup.rs/ and rerun this command.")
        return 0 if dry_run else 1

    result = common.run_command(["rustup", "toolchain", "install", "stable"], dry_run=dry_run)
    return common.print_result(result, "Rust stable toolchain ready", "Rust toolchain install failed")


def _ensure_node(*, dry_run: bool) -> int:
    if shutil.which("node") and shutil.which("npm"):
        logger.ok("Node.js and npm found")
        return 0
    logger.warn("Node.js/npm not found. Action: install Node.js LTS.")
    return 0 if dry_run else 1


def _install_frontend_dependencies(*, dry_run: bool) -> int:
    if not paths.FRONTEND_PACKAGE_JSON.exists():
        logger.fail("frontend/package.json missing")
        return 1

    command = common.package_manager_install_command()
    result = common.run_command(command, cwd=paths.FRONTEND_DIR, dry_run=dry_run)
    code = common.print_result(
        result, "Frontend dependency install command completed", "Frontend dependency install failed"
    )
    if code != 0 or dry_run:
        return code

    if not common.frontend_dependencies_ready():
        missing = ", ".join(str(path.relative_to(paths.ROOT)) for path in common.missing_frontend_dependency_paths())
        logger.fail(f"Frontend dependency install finished, but required paths are still missing: {missing}")
        return 1

    logger.ok("Frontend dependencies ready")
    return 0


def _check_tauri_scaffold() -> int:
    if not paths.TAURI_DIR.exists():
        logger.fail("src-tauri missing. The committed Tauri scaffold should be present.")
        return 1
    if not paths.TAURI_CONFIG.exists():
        logger.fail("src-tauri/tauri.conf.json missing")
        return 1
    logger.ok("Tauri scaffold found")
    return 0
