"""Read-only-by-default repository quality orchestration."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from tools import logger
from tools.paths import ProjectPaths, project_paths
from tools.process import command_string, run_command


@dataclass(frozen=True, slots=True)
class QualityResult:
    name: str
    command: tuple[str, ...]
    returncode: int
    status: str
    stdout: str
    stderr: str


def _pnpm() -> str:
    return shutil.which("pnpm") or "pnpm"


def _cargo() -> str:
    return shutil.which("cargo") or "cargo"


def _commands(args: argparse.Namespace, paths: ProjectPaths) -> list[tuple[str, list[str], Path]]:
    pnpm = _pnpm()
    cargo = _cargo()
    control = [sys.executable, str(paths.tools / "control.py")]
    lint = [
        ("frontend-lint", [pnpm, "run", "lint:fix" if args.fix else "lint"], paths.desktop),
        (
            "rust-clippy",
            [
                cargo,
                "clippy",
                "--locked",
                "--all-targets",
                "--all-features",
                "--",
                "-D",
                "warnings",
            ],
            paths.tauri,
        ),
        (
            "python-lint",
            [
                sys.executable,
                "-m",
                "ruff",
                "check",
                *(["--fix"] if args.fix else []),
                "tools",
                ".github/scripts",
            ],
            paths.root,
        ),
    ]
    formatting = [
        ("frontend-format", [pnpm, "run", "format" if args.fix else "format:check"], paths.desktop),
        (
            "rust-format",
            [cargo, "fmt", "--all", *([] if args.fix else ["--", "--check"])],
            paths.tauri,
        ),
        (
            "python-format",
            [
                sys.executable,
                "-m",
                "ruff",
                "format",
                *([] if args.fix else ["--check"]),
                "tools",
                ".github/scripts",
            ],
            paths.root,
        ),
    ]
    if args.quality_command == "lint":
        return lint
    if args.quality_command == "format":
        return formatting
    return [
        *lint,
        *formatting,
        ("frontend-typecheck", [pnpm, "run", "typecheck"], paths.desktop),
        ("frontend-tests", [pnpm, "run", "test:run"], paths.desktop),
        ("rust-tests", [cargo, "test", "--locked", "--all-targets"], paths.tauri),
        ("rust-check", [cargo, "check", "--locked", "--all-targets"], paths.tauri),
        ("tooling-tests", [sys.executable, "-m", "pytest", "tools/tests"], paths.root),
        ("version-consistency", [*control, "version", "check"], paths.root),
        ("lockfile-and-wrapper-contract", [*control, "tooling", "verify"], paths.root),
        ("documentation-consistency", [*control, "docs", "check"], paths.root),
        ("generated-diff-safety", ["git", "diff", "--check"], paths.root),
        *(
            [("release-readiness", [*control, "release", "check"], paths.root)]
            if args.release
            else []
        ),
    ]


def _static_checks(paths: ProjectPaths) -> list[QualityResult]:
    required = {
        "frontend-lockfile": paths.pnpm_lock,
        "rust-lockfile": paths.cargo_lock,
        "workflow-directory": paths.workflows,
    }
    results: list[QualityResult] = []
    for name, path in required.items():
        present = path.is_file() if "lockfile" in name else path.is_dir()
        detail = str(path)
        results.append(
            QualityResult(
                name=name,
                command=(),
                returncode=0 if present else 1,
                status="ok" if present else "fail",
                stdout=detail if present else "",
                stderr="" if present else f"required path is missing: {detail}",
            )
        )
    return results


def _emit_text(results: list[QualityResult]) -> None:
    for result in results:
        detail = f": {command_string(result.command)}" if result.command else ""
        if result.returncode == 0:
            logger.ok(f"{result.name}{detail}")
        else:
            logger.error(f"{result.name} failed with exit code {result.returncode}{detail}")
        if result.stdout.strip():
            print(result.stdout.rstrip())
        if result.stderr.strip():
            print(result.stderr.rstrip(), file=sys.stderr)


def _emit_json(results: list[QualityResult]) -> None:
    payload = {
        "schema_version": 1,
        "status": "ok" if all(item.returncode == 0 for item in results) else "fail",
        "checks": [{**asdict(item), "command": list(item.command)} for item in results],
    }
    print(json.dumps(payload, sort_keys=True, separators=(",", ":")))


def quality(args: argparse.Namespace, *, paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    results = _static_checks(project) if args.quality_command == "check" else []
    environment = os.environ.copy()
    environment.update({"CI": "true", "NO_COLOR": "1"})
    for name, command, cwd in _commands(args, project):
        result = run_command(command, cwd=cwd, env=environment, capture_output=True)
        results.append(
            QualityResult(
                name=name,
                command=tuple(command),
                returncode=result.returncode,
                status="ok" if result.returncode == 0 else "fail",
                stdout=result.stdout,
                stderr=result.stderr,
            )
        )
    if args.output_format == "json":
        _emit_json(results)
    else:
        _emit_text(results)
    return next((item.returncode for item in results if item.returncode != 0), 0)
