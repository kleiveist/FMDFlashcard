#!/usr/bin/env python3
"""Run the canonical desktop build commands declared for one release target."""

from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MATRIX_PATH = REPOSITORY_ROOT / "tools" / "release-matrix.json"
HOST_OS = {"Linux": "linux", "Windows": "windows", "Darwin": "macos"}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix-id", required=True)
    parser.add_argument("--expected-runner", required=True)
    parser.add_argument("--expected-rust-target", required=True)
    return parser


def _load_target(matrix_id: str) -> dict[str, Any]:
    payload = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1:
        raise RuntimeError("unsupported release matrix schema")
    targets = payload.get("targets")
    if not isinstance(targets, list):
        raise RuntimeError("release matrix targets must be a list")
    matches = [target for target in targets if target.get("id") == matrix_id]
    if len(matches) != 1:
        raise RuntimeError(f"release matrix id must resolve exactly once: {matrix_id}")
    return matches[0]


def _validate_target(
    target: dict[str, Any], expected_runner: str, expected_rust_target: str
) -> None:
    if target.get("runner") != expected_runner:
        raise RuntimeError(
            f"workflow runner {expected_runner!r} does not match release matrix "
            f"{target.get('runner')!r}"
        )
    if target.get("rust_target") != expected_rust_target:
        raise RuntimeError(
            f"workflow Rust target {expected_rust_target!r} does not match release "
            f"matrix {target.get('rust_target')!r}"
        )
    actual_os = HOST_OS.get(platform.system())
    if actual_os != target.get("os"):
        raise RuntimeError(
            f"release target {target.get('id')!r} requires {target.get('os')}, "
            f"but this host is {actual_os or platform.system()}"
        )
    builds = target.get("builds")
    if not isinstance(builds, list) or not builds:
        raise RuntimeError("release target must declare at least one build")


def _run_builds(target: dict[str, Any]) -> int:
    environment = os.environ.copy()
    environment["FMD_RELEASE_MATRIX_ID"] = str(target["id"])
    environment["FMD_RUST_TARGET"] = str(target["rust_target"])
    for build in target["builds"]:
        cli_target = build.get("cli_target")
        bundles = build.get("bundles")
        if not isinstance(cli_target, str) or not cli_target:
            raise RuntimeError("release build has no cli_target")
        if not isinstance(bundles, list) or not all(
            isinstance(bundle, str) and bundle for bundle in bundles
        ):
            raise RuntimeError(f"invalid bundle declaration for {cli_target}")
        command = [
            sys.executable,
            "tools/control.py",
            "build",
            "desktop",
            "--target",
            cli_target,
            "--rust-target",
            str(target["rust_target"]),
        ]
        if bundles:
            command.extend(["--bundles", ",".join(bundles)])
        print("+", " ".join(command), flush=True)
        result = subprocess.run(command, cwd=REPOSITORY_ROOT, env=environment)
        if result.returncode != 0:
            return result.returncode
    return 0


def main() -> int:
    arguments = _parser().parse_args()
    try:
        target = _load_target(arguments.matrix_id)
        _validate_target(target, arguments.expected_runner, arguments.expected_rust_target)
        return _run_builds(target)
    except (OSError, RuntimeError, TypeError, ValueError) as error:
        print(f"release matrix build failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
