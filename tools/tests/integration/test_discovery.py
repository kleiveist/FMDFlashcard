from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.integration import discovery
from tools.integration.discovery import (
    Confidence,
    DiscoveryError,
    discover_project,
    infer_profile,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _vite(root: Path, *, config: str | None = None) -> None:
    _write(
        root / "package.json",
        json.dumps({"devDependencies": {"vite": "^7.0.0"}}) + "\n",
    )
    if config is not None:
        _write(root / config, "export default {}\n")


def _fastapi(root: Path, *, source: str = "app/main.py") -> None:
    _write(
        root / source,
        "from fastapi import FastAPI\n\napplication = FastAPI()\n",
    )
    _write(
        root / "pyproject.toml",
        '[project]\nname = "api"\ndependencies = ["fastapi>=0.116"]\n',
    )


def _tauri(root: Path) -> None:
    _write(root / "Cargo.toml", '[package]\nname = "desktop"\n')
    _write(root / "tauri.conf.json", "{}\n")


def _snapshot(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file() and not path.is_symlink()
    }


def test_empty_and_unknown_projects_remain_unmodified(tmp_path: Path) -> None:
    _write(tmp_path / "customer-data.txt", "must stay untouched\n")
    before = _snapshot(tmp_path)

    result = discover_project(tmp_path)

    assert result.project_name == tmp_path.name
    assert result.paths.frontend is None
    assert result.paths.backend is None
    assert result.paths.tauri is None
    assert result.paths.container is None
    assert result.suggested_profile is None
    assert result.confidence is Confidence.NONE
    assert not result.has_product_evidence
    assert _snapshot(tmp_path) == before


def test_discovers_custom_paths_and_conservatively_avoids_full_platform(
    tmp_path: Path,
) -> None:
    _vite(tmp_path / "apps/client", config="vite.config.mts")
    _fastapi(tmp_path / "services/catalog")
    _tauri(tmp_path / "desktop/native")
    _write(
        tmp_path / "infra/local/docker-compose.yml",
        "services:\n  api:\n    image: customer/api\n",
    )
    # Discovery is evidence-only: this persisted choice is left for the
    # orchestrator to load and give precedence.
    _write(
        tmp_path / "project-tooling.toml",
        '[project]\nprofile = "full-platform"\n',
    )

    result = discover_project(tmp_path)

    assert result.paths.frontend == "apps/client"
    assert result.paths.backend == "services/catalog"
    assert result.paths.tauri == "desktop/native"
    assert result.paths.container == "infra/local"
    assert result.suggested_profile == "desktop-cloud"
    assert result.confidence is Confidence.MEDIUM
    assert result.suggested_profile != "full-platform"
    assert [item.technology for item in result.evidence] == [
        "frontend",
        "backend",
        "tauri",
        "container",
    ]


@pytest.mark.parametrize(
    ("package", "config"),
    [
        ({"dependencies": {"vite": "7.0.0"}}, None),
        ({"devDependencies": {"vite": "^7"}}, None),
        ({"scripts": {"dev": "vite --host 127.0.0.1"}}, None),
        ({}, "vite.config.cjs"),
        ({}, "vite.config.cts"),
        ({}, "vite.config.js"),
        ({}, "vite.config.mjs"),
        ({}, "vite.config.mts"),
        ({}, "vite.config.ts"),
    ],
)
def test_vite_requires_conservative_package_or_config_evidence(
    tmp_path: Path,
    package: dict[str, object],
    config: str | None,
) -> None:
    _write(tmp_path / "ui/package.json", json.dumps(package))
    if config is not None:
        _write(tmp_path / "ui" / config, "export default {}\n")

    result = discover_project(tmp_path)

    assert result.paths.frontend == "ui"


@pytest.mark.parametrize(
    "package",
    [
        {},
        {"scripts": {"test": "echo vite"}},
        {"scripts": {"dev": "npm run vite"}},
        {"dependencies": {"vite": False}},
        {"description": "built with vite someday"},
    ],
)
def test_arbitrary_vite_mentions_are_not_evidence(
    tmp_path: Path,
    package: dict[str, object],
) -> None:
    _write(tmp_path / "ui/package.json", json.dumps(package))

    assert discover_project(tmp_path).frontend is None


def test_fastapi_requires_import_constructor_and_dependency(tmp_path: Path) -> None:
    backend = tmp_path / "custom/api"
    _write(
        backend / "app/main.py",
        "from fastapi import FastAPI\napplication = FastAPI()\n",
    )
    assert discover_project(tmp_path).backend is None

    _write(backend / "requirements-dev.txt", "fastapi_helpers\n")
    assert discover_project(tmp_path).backend is None

    _write(backend / "requirements-dev.txt", "FastAPI[standard] >= 0.116\n")
    result = discover_project(tmp_path)
    assert result.paths.backend == "custom/api"
    assert result.backend is not None
    assert result.backend.confidence is Confidence.HIGH

    _write(backend / "app/main.py", "# from fastapi import FastAPI\napp = object()\n")
    assert discover_project(tmp_path).backend is None


def test_fastapi_main_at_custom_backend_root_is_supported(tmp_path: Path) -> None:
    _fastapi(tmp_path / "services/public-api", source="main.py")

    result = discover_project(tmp_path)

    assert result.paths.backend == "services/public-api"
    assert set(result.backend.markers if result.backend else ()) == {
        "services/public-api/main.py",
        "services/public-api/pyproject.toml",
    }


def test_tauri_requires_both_configuration_and_cargo_manifest(tmp_path: Path) -> None:
    shell = tmp_path / "desktop/shell"
    _write(shell / "tauri.conf.json", "{}\n")
    assert discover_project(tmp_path).tauri is None

    _write(shell / "Cargo.toml", '[package]\nname = "shell"\n')
    assert discover_project(tmp_path).paths.tauri == "desktop/shell"

    (shell / "tauri.conf.json").unlink()
    assert discover_project(tmp_path).tauri is None


def test_symlinked_markers_and_directories_are_never_followed(tmp_path: Path) -> None:
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    _vite(outside / "stolen")
    (tmp_path / "linked-app").symlink_to(outside / "stolen", target_is_directory=True)
    (tmp_path / "package.json").symlink_to(outside / "stolen/package.json")

    result = discover_project(tmp_path)

    assert result.frontend is None
    assert result.scanned_entries == 2


def test_symlinked_project_root_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "target-project"
    target.mkdir()
    link = tmp_path / "project-link"
    link.symlink_to(target, target_is_directory=True)

    with pytest.raises(DiscoveryError, match="must not be a symbolic link"):
        discover_project(link)


def test_scan_uses_safe_path_fallback_without_directory_file_descriptors(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _vite(tmp_path / "client")
    monkeypatch.setattr(discovery, "_SUPPORTS_DIRECTORY_FILE_DESCRIPTORS", False)
    original_open = discovery.os.open

    def forbid_descriptor_open(path: object, flags: int, *args: object, **kwargs: object) -> int:
        if flags & getattr(discovery.os, "O_DIRECTORY", 0):
            raise AssertionError("directory descriptor fallback should not call os.open")
        return original_open(path, flags, *args, **kwargs)

    monkeypatch.setattr(discovery.os, "open", forbid_descriptor_open)

    result = discover_project(tmp_path)

    assert result.paths.frontend == "client"


def test_scan_is_bounded_and_skips_generated_or_documentation_trees(
    tmp_path: Path,
) -> None:
    _vite(tmp_path / "docs/example")
    _vite(tmp_path / "node_modules/example")
    _vite(tmp_path / "too/deep/app")

    result = discover_project(tmp_path, max_depth=1)

    assert result.frontend is None
    with pytest.raises(DiscoveryError, match="entry safety limit"):
        discover_project(tmp_path, max_entries=1)


def test_ambiguous_roots_are_deterministic_and_lower_confidence(tmp_path: Path) -> None:
    _vite(tmp_path / "z-client")
    _vite(tmp_path / "a-client")

    first = discover_project(tmp_path)
    second = discover_project(tmp_path)

    assert first == second
    assert first.paths.frontend == "a-client"
    assert first.frontend is not None
    assert first.frontend.alternatives == ("z-client",)
    assert first.frontend.confidence is Confidence.LOW


@pytest.mark.parametrize(
    ("frontend", "backend", "tauri", "container", "profile", "confidence"),
    [
        (True, False, False, False, "web-only", Confidence.HIGH),
        (True, True, False, True, "web-cloud", Confidence.HIGH),
        (True, False, True, False, "desktop-local", Confidence.HIGH),
        (True, True, True, True, "desktop-cloud", Confidence.MEDIUM),
        (False, False, False, False, None, Confidence.NONE),
    ],
)
def test_profile_inference_uses_only_supported_conservative_mappings(
    frontend: bool,
    backend: bool,
    tauri: bool,
    container: bool,
    profile: str | None,
    confidence: Confidence,
) -> None:
    inference = infer_profile(
        frontend=frontend,
        backend=backend,
        tauri=tauri,
        container=container,
    )

    assert inference.profile_id == profile
    assert inference.confidence is confidence
    assert inference.profile_id != "full-platform"
