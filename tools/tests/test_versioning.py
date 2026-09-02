from __future__ import annotations

from pathlib import Path

import pytest

from tools.commands.release import release_notes
from tools.commands.versioning import collect_version_checks, sync_versions
from tools.paths import ProjectPaths, project_paths
from tools.project_config import application_version


@pytest.fixture(autouse=True)
def _isolate_release_ref_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep temporary version projects independent of the outer CI ref."""

    for name in ("GITHUB_REF", "GITHUB_REF_NAME", "GITHUB_REF_TYPE"):
        monkeypatch.delenv(name, raising=False)


def _version_project(tmp_path: Path, *, changelog_version: str = "1.2.3-rc.1") -> ProjectPaths:
    desktop = tmp_path / "apps" / "fmd-desktop"
    tauri = desktop / "src-tauri"
    tauri.mkdir(parents=True)
    (tmp_path / "VERSION").write_text("1.2.3-rc.1\n", encoding="utf-8")
    (desktop / "package.json").write_text(
        '{\n  "name": "fmd-flashcard",\n  "version": "0.1.0",\n  "private": true\n}\n',
        encoding="utf-8",
    )
    (tauri / "Cargo.toml").write_text(
        '[package]\nname = "fmd-flashcard-desktop"\nversion = "0.1.0"\n',
        encoding="utf-8",
    )
    (tauri / "Cargo.lock").write_text(
        'version = 4\n\n[[package]]\nname = "fmd-flashcard-desktop"\nversion = "0.1.0"\n',
        encoding="utf-8",
    )
    (tauri / "tauri.conf.json").write_text(
        '{\n  "productName": "FMDFlashcard",\n  "version": "0.1.0",\n  "scope": ["**"]\n}\n',
        encoding="utf-8",
    )
    (tmp_path / "CHANGELOG.md").write_text(
        "# Changelog\n\n"
        "## [Unreleased]\n\n"
        "## Added\n\n"
        "- Work in progress.\n\n"
        f"## [{changelog_version}] - 2026-09-02\n\n"
        "### Changed\n\n"
        "- Release tooling is documented.\n",
        encoding="utf-8",
    )
    return project_paths(tmp_path)


def _owned_version_bytes(paths: ProjectPaths) -> dict[str, bytes]:
    files = (
        paths.version_file,
        paths.package_json,
        paths.cargo_manifest,
        paths.cargo_lock,
        paths.tauri_config,
        paths.changelog,
    )
    return {path.relative_to(paths.root).as_posix(): path.read_bytes() for path in files}


def test_version_check_is_read_only_and_reports_every_owned_mismatch(tmp_path: Path) -> None:
    paths = _version_project(tmp_path)
    before = _owned_version_bytes(paths)

    checks = collect_version_checks(paths)

    assert _owned_version_bytes(paths) == before
    assert application_version(paths) == "1.2.3-rc.1"
    assert {item.name for item in checks if not item.passed} == {
        "package.json",
        "Cargo.toml",
        "Cargo.lock",
        "tauri.conf.json",
    }
    assert next(item for item in checks if item.name == "CHANGELOG.md").passed


def test_version_sync_updates_owned_metadata_and_is_deterministic(tmp_path: Path) -> None:
    paths = _version_project(tmp_path)
    package_before = paths.package_json.read_text(encoding="utf-8")
    tauri_before = paths.tauri_config.read_text(encoding="utf-8")

    assert sync_versions(paths) == 0
    first = _owned_version_bytes(paths)
    assert all(item.passed for item in collect_version_checks(paths))
    assert paths.package_json.read_text(encoding="utf-8") == package_before.replace(
        '"version": "0.1.0"', '"version": "1.2.3-rc.1"'
    )
    assert paths.tauri_config.read_text(encoding="utf-8") == tauri_before.replace(
        '"version": "0.1.0"', '"version": "1.2.3-rc.1"'
    )

    assert sync_versions(paths) == 0
    assert _owned_version_bytes(paths) == first
    assert all(value.endswith(b"\n") for value in first.values())


def test_version_check_requires_current_changelog_entry(tmp_path: Path) -> None:
    paths = _version_project(tmp_path, changelog_version="1.2.2")

    check = next(item for item in collect_version_checks(paths) if item.name == "CHANGELOG.md")

    assert not check.passed
    assert "missing" in check.detail.lower()


@pytest.mark.parametrize(
    ("tag", "passed"),
    [("v1.2.3-rc.1", True), ("v1.2.3", False), ("1.2.3-rc.1", False)],
)
def test_tag_build_requires_exact_v_version(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    tag: str,
    passed: bool,
) -> None:
    paths = _version_project(tmp_path)
    assert sync_versions(paths) == 0
    monkeypatch.setenv("GITHUB_REF_TYPE", "tag")
    monkeypatch.setenv("GITHUB_REF", f"refs/tags/{tag}")
    monkeypatch.setenv("GITHUB_REF_NAME", tag)

    check = next(item for item in collect_version_checks(paths) if item.name == "release tag")

    assert check.passed is passed
    assert "v1.2.3-rc.1" in check.detail


def test_release_notes_use_only_current_changelog_content(tmp_path: Path) -> None:
    paths = _version_project(tmp_path)
    output = tmp_path / ".dist" / "RELEASE-NOTES.md"

    assert release_notes(output, paths) == 0

    assert output.read_text(encoding="utf-8") == (
        "# FMDFlashcard 1.2.3-rc.1\n\n### Changed\n\n- Release tooling is documented.\n"
    )
