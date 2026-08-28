from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path
from types import ModuleType

import pytest

ROOT = Path(__file__).resolve().parents[3]
ARTIFACT = Path("tools/quality/rust_analyzer/dist/rust_quality_analyzer.wasm")
BUILDER_PATH = ROOT / "tools" / "quality" / "rust_analyzer" / "build.py"


def _load_builder() -> ModuleType:
    name = "_rust_analyzer_build_for_tests"
    spec = importlib.util.spec_from_file_location(name, BUILDER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


BUILDER = _load_builder()


def test_artifact_and_provenance_bind_the_private_path_free_build_recipe() -> None:
    artifact = (ROOT / ARTIFACT).read_bytes()
    provenance = json.loads(
        (BUILDER.ROOT / "provenance.json").read_text(encoding="utf-8")
    )

    assert BUILDER.ROOT / "build.py" in BUILDER.source_inputs()
    assert provenance["artifact"]["sha256"] == hashlib.sha256(artifact).hexdigest()
    assert provenance["build"]["source_sha256"] == BUILDER.source_sha256()
    assert provenance["build"]["path_remapping"] == BUILDER.PATH_REMAP_CONTRACT
    assert re.search(rb"/(?:home|Users|tmp)/", artifact) is None
    assert re.search(rb"[A-Za-z]:\\\\Users\\\\", artifact) is None
    assert b"registry/src" not in artifact


def test_clean_build_environment_removes_inherited_overrides(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RUSTFLAGS", "--cfg inherited")
    monkeypatch.setenv("CARGO_ENCODED_RUSTFLAGS", "--cfg inherited_encoded")
    monkeypatch.setenv("RUSTC_WRAPPER", "/does/not/exist")
    monkeypatch.setenv("CARGO_PROFILE_RELEASE_OPT_LEVEL", "0")
    monkeypatch.setenv("CARGO_PROFILE_RELEASE_BUILD_OVERRIDE_DEBUG", "true")
    monkeypatch.setenv("CARGO_TARGET_WASM32_WASIP1_LINKER", "/does/not/exist")
    environment = BUILDER.clean_build_environment("/toolchain with spaces/rustc")

    assert "RUSTFLAGS" not in environment
    assert "CARGO_ENCODED_RUSTFLAGS" not in environment
    assert environment["RUSTC_WRAPPER"] == ""
    assert environment["RUSTC_WORKSPACE_WRAPPER"] == ""
    assert "CARGO_PROFILE_RELEASE_BUILD_OVERRIDE_DEBUG" not in environment
    assert "CARGO_TARGET_WASM32_WASIP1_LINKER" not in environment
    assert environment["CARGO_PROFILE_RELEASE_OPT_LEVEL"] == "s"


def test_dependency_remapping_is_stable_for_spaces_and_alternate_roots() -> None:
    identity = {
        "id": "registry+https://github.com/rust-lang/crates.io-index#syn@2.0.119",
        "name": "syn",
        "version": "2.0.119",
        "source": "registry+https://github.com/rust-lang/crates.io-index",
    }
    vendored_manifest = BUILDER.ROOT / "vendor = tree" / "syn" / "Cargo.toml"
    first = BUILDER.dependency_remappings(
        {
            "workspace_members": [],
            "packages": [{**identity, "manifest_path": str(vendored_manifest)}],
        }
    )
    second = BUILDER.dependency_remappings(
        {
            "workspace_members": [],
            "packages": [{**identity, "manifest_path": "/other source/syn/Cargo.toml"}],
        }
    )
    assert first[0].source != second[0].source
    assert first[0].destination == second[0].destination
    encoded = BUILDER.encoded_rustflags(first)
    assert encoded.split(BUILDER.ENCODED_RUSTFLAGS_SEPARATOR) == [
        f"--remap-path-prefix={vendored_manifest.parent.resolve()}={first[0].destination}"
    ]


def test_source_root_wins_exact_target_directory_collision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(BUILDER, "run", lambda *_args, **_kwargs: "/rust sysroot")
    overlapping = BUILDER.path_remappings(
        {"workspace_members": [], "packages": []},
        {
            "CARGO_HOME": str(BUILDER.ROOT / "cargo home"),
            "CARGO_TARGET_DIR": str(BUILDER.ROOT),
        },
        "/toolchain/rustc",
    )
    root_mapping = next(
        mapping for mapping in overlapping if mapping.source == BUILDER.ROOT
    )
    assert root_mapping.destination == BUILDER.VIRTUAL_SOURCE_ROOT
