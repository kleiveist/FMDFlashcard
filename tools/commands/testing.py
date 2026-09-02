"""Deterministic frontend, Rust, tooling, and Tauri test suites."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import asdict
from pathlib import Path

from tools import logger
from tools.paths import ProjectPaths, project_paths
from tools.process import CommandResult, command_string, run_command

SUITE_ORDER = ("frontend", "rust", "tooling", "tauri")


def _report_path(paths: ProjectPaths, suite: str) -> Path:
    return paths.reports / "tests" / f"{suite}.json"


def _write_result_report(path: Path, result: CommandResult) -> None:
    payload = asdict(result)
    payload["command"] = list(result.command)
    payload["cwd"] = str(result.cwd)
    path.write_text(json.dumps(payload, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def _run(
    command: list[str],
    *,
    cwd: Path,
    args: argparse.Namespace,
    paths: ProjectPaths,
    suite: str,
) -> int:
    logger.info(f"$ {command_string(command)}")
    environment = os.environ.copy()
    if args.ci:
        environment.update({"CI": "true", "NO_COLOR": "1"})
    result = run_command(
        command,
        cwd=cwd,
        dry_run=args.dry_run,
        env=environment,
        capture_output=True,
    )
    if result.stdout.strip():
        print(result.stdout.rstrip())
    if result.stderr.strip():
        print(result.stderr.rstrip(), file=sys.stderr)
    if args.report and not args.dry_run:
        report_path = _report_path(paths, suite)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        _write_result_report(report_path, result)
    return result.returncode


def _frontend(args: argparse.Namespace, paths: ProjectPaths) -> int:
    if not paths.pnpm_lock.is_file():
        logger.error(f"Frontend lockfile is missing: {paths.pnpm_lock}")
        return 1
    executable = shutil.which("pnpm") or "pnpm"
    script = "test:coverage" if args.coverage else "test:run"
    command = [executable, "run", script]
    if args.report:
        output = _report_path(paths, "frontend-vitest")
        command.extend(["--", "--reporter=json", f"--outputFile={output}"])
        if not args.dry_run:
            output.parent.mkdir(parents=True, exist_ok=True)
    return _run(command, cwd=paths.desktop, args=args, paths=paths, suite="frontend")


def _rust(args: argparse.Namespace, paths: ProjectPaths) -> int:
    if not paths.cargo_lock.is_file():
        logger.error(f"Rust lockfile is missing: {paths.cargo_lock}")
        return 1
    if args.coverage:
        logger.info(
            "Rust coverage skipped: no pinned repository-owned coverage backend is configured"
        )
    command = [shutil.which("cargo") or "cargo", "test", "--locked", "--all-targets"]
    return _run(command, cwd=paths.tauri, args=args, paths=paths, suite="rust")


def _tooling(args: argparse.Namespace, paths: ProjectPaths) -> int:
    if args.coverage:
        logger.info(
            "Tooling coverage skipped: --coverage is scoped to the supported frontend backend"
        )
    command = [sys.executable, "-m", "pytest", "tools/tests"]
    if args.report:
        junit_path = paths.reports / "tests" / "tooling-junit.xml"
        command.append(f"--junitxml={junit_path}")
        if not args.dry_run:
            junit_path.parent.mkdir(parents=True, exist_ok=True)
    return _run(command, cwd=paths.root, args=args, paths=paths, suite="tooling")


def _tauri(args: argparse.Namespace, paths: ProjectPaths) -> int:
    required = [paths.cargo_manifest, paths.cargo_lock, paths.tauri_config]
    missing = [path for path in required if not path.is_file()]
    if missing:
        logger.error("Tauri project files are missing: " + ", ".join(str(path) for path in missing))
        return 1
    if args.coverage:
        logger.info(
            "Tauri coverage skipped: the suite is structural validation plus locked Cargo check"
        )
    if not args.dry_run:
        from tools.commands.tauri import structure_check

        structure_status = structure_check()
        if structure_status:
            return structure_status
    command = [shutil.which("cargo") or "cargo", "check", "--locked", "--all-targets"]
    return _run(command, cwd=paths.tauri, args=args, paths=paths, suite="tauri")


_HANDLERS = {
    "frontend": _frontend,
    "rust": _rust,
    "tooling": _tooling,
    "tauri": _tauri,
}


def test(args: argparse.Namespace, *, paths: ProjectPaths | None = None) -> int:
    if args.suite is None:
        args.test_parser.print_help()
        return 0
    project = paths or project_paths()
    suites = SUITE_ORDER if args.suite == "all" else (args.suite,)
    for suite in suites:
        logger.info(f"Test suite: {suite}")
        exit_code = _HANDLERS[suite](args, project)
        if exit_code:
            logger.error(f"Suite {suite} failed with exit code {exit_code}")
            return exit_code
        logger.ok(
            f"Suite {suite} passed" if not args.dry_run else f"Suite {suite} dry-run completed"
        )
    return 0
