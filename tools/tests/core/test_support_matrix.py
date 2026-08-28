from __future__ import annotations

import re
from pathlib import Path

import tomllib

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
MATRIX_PATH = REPOSITORY_ROOT / "tools" / "resources" / "config" / "support-matrix.toml"
RUST_TOOLCHAIN_PATH = (
    REPOSITORY_ROOT / "tools" / "quality" / "rust_analyzer" / "rust-toolchain.toml"
)
_SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
_PYTHON_VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")


def _python_version(value: object) -> tuple[int, int]:
    assert isinstance(value, str)
    matched = _PYTHON_VERSION.fullmatch(value)
    assert matched is not None
    return int(matched.group(1)), int(matched.group(2))


def test_support_matrix_is_versioned_and_pins_supported_toolchains() -> None:
    with MATRIX_PATH.open("rb") as handle:
        matrix = tomllib.load(handle)

    assert matrix["schema_version"] == 1

    python = matrix["python"]
    assert _python_version(python["minimum"]) == (3, 11)
    assert _python_version(python["primary"]) == (3, 13)
    assert _python_version(python["maximum"]) == (3, 13)
    assert _python_version(python["minimum"]) <= _python_version(python["primary"])
    assert _python_version(python["primary"]) <= _python_version(python["maximum"])

    node = matrix["node"]
    assert node["primary"] == "24.19.0"
    assert _SEMVER.fullmatch(node["primary"]) is not None

    rust = matrix["rust"]
    with RUST_TOOLCHAIN_PATH.open("rb") as handle:
        rust_toolchain = tomllib.load(handle)
    assert rust["channel"] == "1.97.1"
    assert rust["channel"] == rust_toolchain["toolchain"]["channel"]
    assert _SEMVER.fullmatch(rust["channel"]) is not None

    tex = matrix["tex"]
    assert tex == {
        "distribution": "texlive",
        "release": "2026",
        "compiler": "pdflatex",
    }

    assert matrix["runners"] == {
        "linux": "ubuntu-24.04",
        "windows": "windows-2025",
        "macos": "macos-15",
    }
    assert all("latest" not in runner for runner in matrix["runners"].values())

    upgrade = matrix["upgrade"]
    assert upgrade["baseline_version"] == "0.1.0"
    assert _SEMVER.fullmatch(upgrade["baseline_version"]) is not None
    assert _COMMIT.fullmatch(upgrade["baseline_ref"]) is not None
