from __future__ import annotations

import copy
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from tools.commands import tauri
from tools.commands.build import BuildError, desktop_plan
from tools.paths import project_paths
from tools.project_config import ConfigError, load_release_matrix, normalize_bundles

ROOT = Path(__file__).resolve().parents[2]

EXPECTED_TARGETS = {
    "linux-x86_64": (
        "linux",
        "ubuntu-22.04",
        "x86_64-unknown-linux-gnu",
        {"deb", "rpm", "appimage"},
    ),
    "windows-x86_64": (
        "windows",
        "windows-2022",
        "x86_64-pc-windows-msvc",
        {"msi", "nsis", "portable-zip"},
    ),
    "macos-aarch64": (
        "macos",
        "macos-15",
        "aarch64-apple-darwin",
        {"dmg", "app-archive"},
    ),
    "macos-x86_64": (
        "macos",
        "macos-15-intel",
        "x86_64-apple-darwin",
        {"dmg", "app-archive"},
    ),
}

EXPECTED_FILENAMES = {
    "FMDFlashcard-v0.2.0-linux-x86_64.deb",
    "FMDFlashcard-v0.2.0-linux-x86_64.rpm",
    "FMDFlashcard-v0.2.0-linux-x86_64.AppImage",
    "FMDFlashcard-v0.2.0-windows-x86_64.msi",
    "FMDFlashcard-v0.2.0-windows-x86_64-setup.exe",
    "FMDFlashcard-v0.2.0-windows-x86_64-portable.zip",
    "FMDFlashcard-v0.2.0-macos-aarch64.dmg",
    "FMDFlashcard-v0.2.0-macos-aarch64-app.tar.gz",
    "FMDFlashcard-v0.2.0-macos-x86_64.dmg",
    "FMDFlashcard-v0.2.0-macos-x86_64-app.tar.gz",
}


def test_release_matrix_declares_exact_supported_native_baseline() -> None:
    matrix = load_release_matrix(project_paths(ROOT))

    assert {target.target_id for target in matrix.targets} == set(EXPECTED_TARGETS)
    assert set(matrix.expected_filenames("0.2.0")) == EXPECTED_FILENAMES
    assert len(matrix.expected_filenames("0.2.0")) == len(EXPECTED_FILENAMES)

    for target in matrix.targets:
        expected_os, runner, rust_target, package_types = EXPECTED_TARGETS[target.target_id]
        assert (target.os, target.runner, target.rust_target) == (
            expected_os,
            runner,
            rust_target,
        )
        assert {artifact.package_type for artifact in target.artifacts} == package_types
        assert all(target.rust_target in artifact.source_glob for artifact in target.artifacts)
        assert all(build.cli_target != "windows-cross-linux" for build in target.builds)
        for artifact in target.artifacts:
            if artifact.package_type == "app-archive":
                assert artifact.archive == "tar.gz"


def test_every_declared_build_maps_to_the_canonical_target_specific_plan() -> None:
    paths = project_paths(ROOT)
    matrix = load_release_matrix(paths)

    for target in matrix.targets:
        for build in target.builds:
            bundles = ",".join(build.bundles) if build.bundles else None
            plan = desktop_plan(
                build.cli_target,
                bundles=bundles,
                rust_target=target.rust_target,
                paths=paths,
            )
            assert plan.cwd == paths.desktop
            assert plan.bundles == build.bundles
            assert "tauri" in plan.command and "build" in plan.command
            assert "--target" in plan.command
            assert plan.command[plan.command.index("--target") + 1] == target.rust_target
            assert all(
                str(path).startswith(str(paths.tauri / "target" / target.rust_target))
                for path in plan.clean_paths
            )
            if build.cli_target == "windows-portable":
                assert "--no-bundle" in plan.command
                assert "--bundles" not in plan.command
            elif build.bundles:
                assert plan.command[plan.command.index("--bundles") + 1] == ",".join(build.bundles)


def test_bundle_normalization_is_ordered_deduplicated_and_target_scoped() -> None:
    assert normalize_bundles("linux", "rpm,deb,rpm") == ("deb", "rpm")
    assert normalize_bundles("windows", None) == ("msi", "nsis")
    assert normalize_bundles("windows-portable", None) == ()
    with pytest.raises(ConfigError, match="invalid for windows"):
        normalize_bundles("windows", "deb")
    with pytest.raises(ConfigError, match="empty"):
        normalize_bundles("linux", "deb,")
    with pytest.raises(ConfigError, match="unsafe"):
        normalize_bundles("linux", "deb;touch")


@pytest.mark.parametrize("value", ["../../src", "x86_64/unknown/linux", " target-triple"])
def test_desktop_plan_rejects_unsafe_rust_target(value: str) -> None:
    with pytest.raises(BuildError, match="invalid Rust target triple"):
        desktop_plan("linux", rust_target=value, paths=project_paths(ROOT))


@pytest.mark.parametrize(
    ("cli_target", "bundles", "expected"),
    [
        ("windows", "msi", {"msi"}),
        ("windows-portable", None, {"portable-zip"}),
    ],
)
def test_tauri_artifact_verification_selects_the_cli_build_subset(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    cli_target: str,
    bundles: str | None,
    expected: set[str],
) -> None:
    matrix_path = tmp_path / "tools" / "release-matrix.json"
    matrix_path.parent.mkdir(parents=True)
    matrix_path.write_bytes((ROOT / "tools" / "release-matrix.json").read_bytes())
    (tmp_path / "VERSION").write_text("0.2.0\n", encoding="utf-8")
    paths = project_paths(tmp_path)
    marker = paths.state / "build-markers" / f"{cli_target}.started"
    marker.parent.mkdir(parents=True)
    marker.write_text("build-started\n", encoding="utf-8")
    calls: list[tuple[str, set[str] | None, Path | None]] = []
    monkeypatch.setattr(tauri, "project_paths", lambda: paths)
    monkeypatch.setattr(
        tauri,
        "verify_target_sources",
        lambda matrix_id, **kwargs: (
            calls.append((matrix_id, kwargs["package_types"], kwargs["built_after"])) or []
        ),
    )
    args = type(
        "Args",
        (),
        {
            "matrix_id": None,
            "directory": None,
            "target": cli_target,
            "bundles": bundles,
        },
    )()

    assert tauri._verify(args) == 0
    assert calls == [("windows-x86_64", expected, marker)]


def test_windows_signing_config_is_passed_explicitly_to_tauri(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    config = tmp_path / "signing.json"
    config.write_text(
        json.dumps(
            {
                "bundle": {
                    "windows": {
                        "certificateThumbprint": "masked-thumbprint",
                        "digestAlgorithm": "sha256",
                    }
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("FMD_TAURI_SIGNING_CONFIG_PATH", str(config))

    plan = desktop_plan(
        "windows",
        rust_target="x86_64-pc-windows-msvc",
        paths=project_paths(ROOT),
    )

    assert plan.command[plan.command.index("--config") + 1] == str(config)


def _matrix_payload() -> dict[str, Any]:
    return json.loads((ROOT / "tools" / "release-matrix.json").read_text(encoding="utf-8"))


def _load_mutated_matrix(
    tmp_path: Path,
    mutation: Callable[[dict[str, Any]], None],
) -> None:
    payload = copy.deepcopy(_matrix_payload())
    mutation(payload)
    matrix_path = tmp_path / "tools" / "release-matrix.json"
    matrix_path.parent.mkdir(parents=True)
    matrix_path.write_text(json.dumps(payload), encoding="utf-8")
    load_release_matrix(project_paths(tmp_path))


def test_matrix_rejects_non_native_windows_runner(tmp_path: Path) -> None:
    def mutate(payload: dict[str, Any]) -> None:
        next(item for item in payload["targets"] if item["id"] == "windows-x86_64")["runner"] = (
            "ubuntu-22.04"
        )

    with pytest.raises(ConfigError, match="native Windows runner"):
        _load_mutated_matrix(tmp_path, mutate)


def test_matrix_rejects_macos_packages_on_non_macos_target(tmp_path: Path) -> None:
    def mutate(payload: dict[str, Any]) -> None:
        next(item for item in payload["targets"] if item["id"] == "macos-aarch64")["os"] = "linux"

    with pytest.raises(ConfigError, match=r"macos-aarch64\.os|macOS artifacts"):
        _load_mutated_matrix(tmp_path, mutate)


def test_matrix_rejects_case_insensitive_duplicate_public_names(tmp_path: Path) -> None:
    def mutate(payload: dict[str, Any]) -> None:
        first = payload["targets"][0]["artifacts"][0]["filename"]
        payload["targets"][1]["artifacts"][0]["filename"] = first.replace(
            "FMDFlashcard", "fmdflashcard"
        )

    with pytest.raises(ConfigError, match="case-insensitively unique"):
        _load_mutated_matrix(tmp_path, mutate)


def test_matrix_rejects_unknown_package_types(tmp_path: Path) -> None:
    def mutate(payload: dict[str, Any]) -> None:
        payload["targets"][0]["artifacts"].append(
            {
                "package_type": "mystery-installer",
                "source_glob": "apps/fmd-desktop/target/*.mystery",
                "filename": "FMDFlashcard-v{version}-mystery.bin",
            }
        )

    with pytest.raises(ConfigError, match="unsupported package type|package contract mismatch"):
        _load_mutated_matrix(tmp_path, mutate)
