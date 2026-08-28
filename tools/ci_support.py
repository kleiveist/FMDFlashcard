"""Read the single supported-runtime contract for local and hosted CI.

GitHub Actions cannot natively read TOML.  Keeping this tiny, dependency-free
adapter in the portable payload prevents runner, language, and tool versions
from being copied into every workflow file.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tomllib

_VERSION = re.compile(r"\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$")
_REQUIRED_TABLES = frozenset({"python", "node", "rust", "tex", "runners", "upgrade"})
_OS_KEYS = ("linux", "windows", "macos")


class SupportMatrixError(ValueError):
    """Raised when the support matrix is not a complete, safe CI contract."""


@dataclass(frozen=True, slots=True)
class SupportMatrix:
    """Validated values consumed by workflows and their contract tests."""

    schema_version: int
    python_minimum: str
    python_primary: str
    python_maximum: str
    node_primary: str
    rust_channel: str
    tex_distribution: str
    tex_release: str
    tex_compiler: str
    runners: dict[str, str]
    upgrade_baseline_ref: str

    @property
    def python_versions(self) -> tuple[str, ...]:
        return tuple(
            dict.fromkeys(
                (self.python_minimum, self.python_primary, self.python_maximum)
            )
        )

    @property
    def os_matrix(self) -> tuple[dict[str, str], ...]:
        return tuple({"name": name, "runner": self.runners[name]} for name in _OS_KEYS)

    def workflow_outputs(self) -> dict[str, str]:
        """Return values that are safe to append to ``GITHUB_OUTPUT``."""

        return {
            "python_minimum": self.python_minimum,
            "python_primary": self.python_primary,
            "python_maximum": self.python_maximum,
            "python_versions": json.dumps(self.python_versions),
            "node_primary": self.node_primary,
            "rust_channel": self.rust_channel,
            "tex_distribution": self.tex_distribution,
            "tex_release": self.tex_release,
            "tex_compiler": self.tex_compiler,
            "os_matrix": json.dumps(self.os_matrix),
            "linux_runner": self.runners["linux"],
            "windows_runner": self.runners["windows"],
            "macos_runner": self.runners["macos"],
            "upgrade_baseline_ref": self.upgrade_baseline_ref,
        }


def default_matrix_path() -> Path:
    return (
        Path(__file__).resolve().parent / "resources" / "config" / "support-matrix.toml"
    )


def load_support_matrix(path: Path | None = None) -> SupportMatrix:
    """Load one strict central CI support matrix without side effects."""

    matrix_path = Path(path or default_matrix_path())
    try:
        payload = tomllib.loads(matrix_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise SupportMatrixError(
            f"Could not read CI support matrix: {matrix_path}."
        ) from exc
    except tomllib.TOMLDecodeError as exc:
        raise SupportMatrixError(f"CI support matrix is invalid TOML: {exc}.") from exc
    if not isinstance(payload, dict):
        raise SupportMatrixError("CI support matrix must be a TOML document table.")
    missing = _REQUIRED_TABLES.difference(payload)
    if missing:
        raise SupportMatrixError(
            "CI support matrix is missing table(s): " + ", ".join(sorted(missing))
        )
    schema_version = payload.get("schema_version")
    if schema_version != 1 or isinstance(schema_version, bool):
        raise SupportMatrixError("CI support matrix must use schema_version = 1.")
    python = _table(payload, "python")
    node = _table(payload, "node")
    rust = _table(payload, "rust")
    tex = _table(payload, "tex")
    runners = _table(payload, "runners")
    upgrade = _table(payload, "upgrade")
    matrix = SupportMatrix(
        schema_version=schema_version,
        python_minimum=_version(python, "minimum"),
        python_primary=_version(python, "primary"),
        python_maximum=_version(python, "maximum"),
        node_primary=_version(node, "primary"),
        rust_channel=_version(rust, "channel"),
        tex_distribution=_identifier(tex, "distribution"),
        tex_release=_identifier(tex, "release"),
        tex_compiler=_identifier(tex, "compiler"),
        runners={name: _runner(runners, name) for name in _OS_KEYS},
        upgrade_baseline_ref=_git_ref(upgrade, "baseline_ref"),
    )
    _validate_version_order(matrix)
    return matrix


def _table(payload: dict[str, Any], name: str) -> dict[str, Any]:
    value = payload.get(name)
    if not isinstance(value, dict):
        raise SupportMatrixError(f"CI support matrix [{name}] must be a table.")
    return value


def _version(table: dict[str, Any], key: str) -> str:
    value = table.get(key)
    if not isinstance(value, str) or not _VERSION.fullmatch(value):
        raise SupportMatrixError(f"CI support matrix value {key!r} must be a version.")
    return value


def _identifier(table: dict[str, Any], key: str) -> str:
    value = table.get(key)
    if not isinstance(value, str) or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9._-]*", value
    ):
        raise SupportMatrixError(
            f"CI support matrix value {key!r} must be a safe identifier."
        )
    return value


def _runner(table: dict[str, Any], key: str) -> str:
    value = table.get(key)
    if not isinstance(value, str) or not re.fullmatch(
        r"[A-Za-z0-9][A-Za-z0-9._-]*", value
    ):
        raise SupportMatrixError(
            f"CI support matrix runner {key!r} must be a safe runner label."
        )
    return value


def _git_ref(table: dict[str, Any], key: str) -> str:
    value = table.get(key)
    if not isinstance(value, str) or not re.fullmatch(
        r"[0-9a-f]{40}|[A-Za-z0-9][A-Za-z0-9._/-]*", value
    ):
        raise SupportMatrixError(
            f"CI support matrix value {key!r} must be a safe immutable Git ref."
        )
    return value


def _version_tuple(value: str) -> tuple[int, ...]:
    return tuple(
        int(part) for part in value.split("-", 1)[0].split("+", 1)[0].split(".")
    )


def _validate_version_order(matrix: SupportMatrix) -> None:
    minimum = _version_tuple(matrix.python_minimum)
    primary = _version_tuple(matrix.python_primary)
    maximum = _version_tuple(matrix.python_maximum)
    if not minimum <= primary <= maximum:
        raise SupportMatrixError(
            "Python support matrix must satisfy minimum <= primary <= maximum."
        )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Read Template Tooling CI support values"
    )
    parser.add_argument("--matrix", type=Path, default=default_matrix_path())
    parser.add_argument(
        "--github-output",
        action="store_true",
        help="append validated values to the GITHUB_OUTPUT file",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        outputs = load_support_matrix(args.matrix).workflow_outputs()
    except SupportMatrixError as exc:
        print(f"CI support matrix error: {exc}", file=sys.stderr)
        return 2
    if args.github_output:
        destination = os.environ.get("GITHUB_OUTPUT")
        if not destination:
            print("CI support matrix error: GITHUB_OUTPUT is not set.", file=sys.stderr)
            return 2
        with Path(destination).open("a", encoding="utf-8") as handle:
            handle.writelines(f"{key}={value}\n" for key, value in outputs.items())
    else:
        print(json.dumps(outputs, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
