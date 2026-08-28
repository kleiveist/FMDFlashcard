from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from tools.core.context import ProjectContext, load_context
from tools.core.project_config import ProjectConfig, create_project_config
from tools.profiles import loader, runtime, validator

CONTEXT = load_context()
PROFILES_DIR = CONTEXT.resources.profiles
PROFILE_IDS = {
    "desktop-cloud",
    "desktop-local",
    "full-platform",
    "web-cloud",
    "web-only",
}


def _write_catalog(
    root: Path,
    *,
    features: str,
    profiles: dict[str, str],
) -> Path:
    profiles_dir = root / "profiles"
    profiles_dir.mkdir(parents=True)
    (profiles_dir / "features.toml").write_text(features, encoding="utf-8")
    for name, content in profiles.items():
        (profiles_dir / f"{name}.toml").write_text(content, encoding="utf-8")
    return profiles_dir


def _file_snapshot(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def _portable_context(tmp_path: Path, config: ProjectConfig) -> ProjectContext:
    project_root = tmp_path / "target-project"
    tools_root = project_root / "tools"
    resources = tools_root / "resources" / "profiles"
    resources.parent.mkdir(parents=True)
    shutil.copytree(PROFILES_DIR, resources)
    (tools_root / "VERSION").write_text(
        f"{CONTEXT.tooling_version}\n", encoding="utf-8"
    )
    create_project_config(project_root / "project-tooling.toml", config)
    return load_context(project_root=project_root, tools_root=tools_root)


def test_catalog_contains_exactly_five_portable_profiles() -> None:
    catalog = loader.load_catalog(context=CONTEXT)

    assert set(catalog.profiles) == PROFILE_IDS
    assert tuple(catalog.profiles) == tuple(sorted(PROFILE_IDS))
    assert {path.name for path in PROFILES_DIR.glob("*.toml")} == {
        "features.toml",
        *(f"{profile_id}.toml" for profile_id in PROFILE_IDS),
    }


def test_catalog_maps_features_to_adapters_without_product_paths() -> None:
    catalog = loader.load_catalog(context=CONTEXT)

    assert catalog.core_adapters == (
        "quality",
        "testing",
        "documentation",
        "ci",
        "release",
    )
    assert {
        feature_id: feature.adapter for feature_id, feature in catalog.features.items()
    } == {
        "frontend": "frontend",
        "backend": "backend",
        "tauri": "tauri",
        "cloud": "container",
        "database": "database",
        "postgres": "database",
    }
    source = (PROFILES_DIR / "features.toml").read_text(encoding="utf-8")
    assert "paths =" not in source


def test_active_profile_uses_only_selected_context_resources_and_config(
    tmp_path: Path,
) -> None:
    context = _portable_context(
        tmp_path,
        ProjectConfig(
            tooling_version=CONTEXT.tooling_version,
            project_name="Portable project",
            profile="web-cloud",
            optional_features=("postgres",),
        ),
    )
    before = _file_snapshot(context.project_root)

    active = loader.load_active_profile(context=context)

    assert active.profile_id == "web-cloud"
    assert active.features == ("frontend", "backend", "cloud", "database", "postgres")
    assert active.optional_features == ("postgres",)
    assert runtime.active_profile(context=context) == active
    assert runtime.feature_enabled("postgres", context=context)
    assert _file_snapshot(context.project_root) == before
    assert not context.state_root.exists()


def test_explicit_resource_directory_and_context_are_mutually_exclusive() -> None:
    with pytest.raises(ValueError, match="either profiles_dir or context"):
        loader.load_catalog(PROFILES_DIR, context=CONTEXT)


def test_catalog_never_follows_resource_or_toml_symlinks(tmp_path: Path) -> None:
    linked_directory = tmp_path / "linked-profiles"
    try:
        linked_directory.symlink_to(PROFILES_DIR, target_is_directory=True)
    except OSError:
        pytest.skip("Symbolic links are unavailable on this platform")

    with pytest.raises(OSError, match="Could not access profile resources"):
        loader.load_catalog(linked_directory)

    profiles_dir = tmp_path / "profiles"
    profiles_dir.mkdir()
    (profiles_dir / "features.toml").symlink_to(PROFILES_DIR / "features.toml")
    with pytest.raises(OSError, match="Could not read TOML file"):
        loader.load_catalog(profiles_dir)


def test_project_root_and_context_are_mutually_exclusive() -> None:
    with pytest.raises(ValueError, match="either project_root or context"):
        loader.load_active_profile(CONTEXT.project_root, context=CONTEXT)


def test_unknown_profile_reports_deterministic_choices() -> None:
    catalog = loader.load_catalog(context=CONTEXT)

    with pytest.raises(validator.ProfileLookupError) as exc_info:
        loader.resolve_profile(catalog, "unknown-profile")

    assert str(exc_info.value).endswith(
        "Available profiles: desktop-cloud, desktop-local, full-platform, web-cloud, web-only."
    )


@pytest.mark.parametrize(
    ("profile_id", "features"),
    [
        ("web-only", ("frontend",)),
        ("web-cloud", ("frontend", "backend", "cloud")),
        ("desktop-local", ("frontend", "tauri")),
        ("desktop-cloud", ("frontend", "backend", "tauri", "cloud")),
        ("full-platform", ("frontend", "backend", "tauri", "cloud")),
    ],
)
def test_each_profile_resolves_deterministically(
    profile_id: str,
    features: tuple[str, ...],
) -> None:
    resolved = loader.resolve_profile(loader.load_catalog(context=CONTEXT), profile_id)

    assert resolved.profile_id == profile_id
    assert resolved.features == features
    assert resolved.optional_features == ()


def test_postgres_resolves_transitive_database_adapter_dependency() -> None:
    catalog = loader.load_catalog(context=CONTEXT)

    resolved = loader.resolve_profile(
        catalog,
        "web-cloud",
        optional_features=("postgres", "postgres"),
    )

    assert resolved.optional_features == ("postgres",)
    assert resolved.features == ("frontend", "backend", "cloud", "database", "postgres")
    assert catalog.features["database"].selectable is False
    assert catalog.features["postgres"].selectable is True


def test_optional_feature_rejects_missing_base_dependency() -> None:
    catalog = loader.load_catalog(context=CONTEXT)

    with pytest.raises(
        validator.CatalogValidationError,
        match="not enabled by the selected project profile",
    ):
        loader.resolve_profile(catalog, "web-only", optional_features=("postgres",))


@pytest.mark.parametrize(
    ("feature", "message"),
    [
        ("unknown-db", "Unknown optional feature"),
        ("frontend", "provided by project profiles"),
        ("database", "cannot be selected directly"),
    ],
)
def test_invalid_optional_feature_selection_is_rejected(
    feature: str,
    message: str,
) -> None:
    catalog = loader.load_catalog(context=CONTEXT)

    with pytest.raises(validator.CatalogValidationError, match=message):
        loader.resolve_profile(catalog, "web-cloud", optional_features=(feature,))


def test_catalog_rejects_missing_feature_dependency(tmp_path: Path) -> None:
    profiles_dir = _write_catalog(
        tmp_path,
        features="""schema_version = 1

[core]
adapters = ["quality"]

[features.frontend]
name = "Frontend"
description = "Frontend runtime"
adapter = "frontend"

[features.tauri]
name = "Tauri"
description = "Desktop shell"
adapter = "tauri"
requires = ["frontend"]
""",
        profiles={
            "broken-profile": """schema_version = 1
id = "broken-profile"
name = "Broken profile"
description = "Missing required frontend feature"
features = ["tauri"]
"""
        },
    )

    with pytest.raises(
        validator.CatalogValidationError, match="requires feature 'frontend'"
    ):
        loader.load_catalog(profiles_dir)


def test_catalog_rejects_invalid_and_duplicate_adapter_metadata(tmp_path: Path) -> None:
    profiles_dir = _write_catalog(
        tmp_path,
        features="""schema_version = 1

[core]
adapters = ["quality", "quality"]

[features.frontend]
name = "Frontend"
description = "Frontend runtime"
adapter = "Frontend/unsafe"
""",
        profiles={
            "base": """schema_version = 1
id = "base"
name = "Base"
description = "Base profile"
features = ["frontend"]
"""
        },
    )

    with pytest.raises(validator.CatalogValidationError) as exc_info:
        loader.load_catalog(profiles_dir)

    assert "Core adapter list contains duplicates: quality" in str(exc_info.value)
    assert "Adapter id 'Frontend/unsafe' must use lowercase kebab-case" in str(
        exc_info.value
    )


def test_catalog_rejects_unknown_dependencies_cycles_and_duplicate_features(
    tmp_path: Path,
) -> None:
    profiles_dir = _write_catalog(
        tmp_path,
        features="""schema_version = 1

[core]
adapters = ["quality"]

[features.alpha]
name = "Alpha"
description = "Alpha feature"
adapter = "alpha"
requires = ["beta", "missing"]

[features.beta]
name = "Beta"
description = "Beta feature"
adapter = "beta"
requires = ["alpha"]
""",
        profiles={
            "cyclic": """schema_version = 1
id = "cyclic"
name = "Cyclic"
description = "Cyclic feature selection"
features = ["alpha", "beta", "beta"]
"""
        },
    )

    with pytest.raises(validator.CatalogValidationError) as exc_info:
        loader.load_catalog(profiles_dir)

    message = str(exc_info.value)
    assert "requires unknown feature 'missing'" in message
    assert "dependency cycle detected" in message
    assert "Feature selection contains duplicates: beta" in message


def test_catalog_ignores_forward_compatible_metadata(tmp_path: Path) -> None:
    profiles_dir = _write_catalog(
        tmp_path,
        features="""schema_version = 1

[core]
adapters = ["quality"]

[features.frontend]
name = "Frontend"
description = "Frontend runtime"
adapter = "frontend"
future_flag = "safe-to-ignore"

[features.monitoring]
name = "Monitoring"
description = "Optional monitoring integration"
adapter = "monitoring"
requires = ["frontend"]
""",
        profiles={
            "extensible": """schema_version = 1
id = "extensible"
order = 15
name = "Extensible"
description = "Allows future metadata"
features = ["frontend", "monitoring"]
notes = "ignored extension field"

[metadata]
owner = "tooling-team"
"""
        },
    )

    resolved = loader.resolve_profile(loader.load_catalog(profiles_dir), "extensible")

    assert resolved.profile_id == "extensible"
    assert resolved.features == ("frontend", "monitoring")
