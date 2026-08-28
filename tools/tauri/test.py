from __future__ import annotations

import argparse
import json
import shutil

from tools import logger
from tools.tauri import build as tauri_build
from tools.tauri import common, doctor, paths


def main(args: argparse.Namespace) -> int:
    failures = 0
    failures += _validate_structure()

    if getattr(args, "doctor", False) or getattr(args, "all", False):
        checks, overall = doctor.collect_checks()
        logger.status(overall, f"Tauri doctor overall: {overall}")
        if overall == "FAIL":
            failures += 1

    if getattr(args, "build_dry_run", False) or getattr(args, "all", False):
        dry_run_args = argparse.Namespace(target="linux", dry_run=True, no_clean=True)
        failures += 0 if tauri_build.main(dry_run_args) == 0 else 1

    if getattr(args, "cargo", False) or getattr(args, "all", False):
        failures += _run_cargo_checks()

    if failures:
        logger.fail(f"Tauri tests completed with {failures} failing check(s)")
        return 1
    logger.ok("Tauri tests completed")
    return 0


def _validate_structure() -> int:
    failures = 0
    required = [
        paths.FRONTEND_PACKAGE_JSON,
        paths.TAURI_DIR,
        paths.TAURI_CONFIG,
        paths.TAURI_DIR / "Cargo.toml",
        paths.TAURI_DIR / "src" / "main.rs",
    ]
    for item in required:
        if item.exists():
            logger.ok(f"{item.relative_to(paths.ROOT)} found")
        else:
            logger.fail(f"{item.relative_to(paths.ROOT)} missing")
            failures += 1

    if paths.TAURI_CONFIG.exists():
        try:
            json.loads(paths.TAURI_CONFIG.read_text(encoding="utf-8"))
            logger.ok("Tauri config JSON is valid")
        except json.JSONDecodeError as exc:
            logger.fail(f"Tauri config JSON invalid: {exc}")
            failures += 1

    return failures


def _run_cargo_checks() -> int:
    cargo = shutil.which("cargo")
    if cargo is None:
        logger.fail("cargo not found. Action: install the Rust stable toolchain.")
        return 1

    failures = 0
    manifest = str(paths.TAURI_DIR / "Cargo.toml")
    common_arguments = ["--locked", "--manifest-path", manifest, "--all-targets", "--all-features"]
    commands = [
        ([cargo, "check", *common_arguments], "Cargo check"),
        ([cargo, "test", *common_arguments], "Rust tests"),
    ]
    for command, label in commands:
        result = common.run_command(command, cwd=paths.ROOT)
        failures += common.print_result(result, f"{label} passed", f"{label} failed") != 0
    return failures
