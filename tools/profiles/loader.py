from __future__ import annotations

from pathlib import Path
from typing import Any

import tomllib

from tools.core.context import ProjectContext, load_context
from tools.core.filesystem import (
    FilesystemSafetyError,
    read_regular_text,
    validate_root,
)
from tools.profiles.model import (
    FeatureDefinition,
    ProfileCatalog,
    ProfileDefinition,
    ProjectProfile,
)
from tools.profiles.validator import (
    ProfileLookupError,
    resolve_optional_features,
    validate_catalog,
    validate_feature_selection,
)

SUPPORTED_SCHEMA_VERSION = 1


def _read_toml(path: Path, *, root: Path) -> dict[str, Any]:
    try:
        payload = tomllib.loads(
            read_regular_text(path, root=root, label="Profile resource")
        )
    except FilesystemSafetyError as exc:
        raise OSError(f"Could not read TOML file: {path}") from exc
    except tomllib.TOMLDecodeError as exc:
        raise ValueError(f"Invalid TOML in {path}: {exc}") from exc

    if not isinstance(payload, dict):
        raise TypeError(f"{path} must contain a TOML table at the document root.")
    return payload


def _require_str(payload: dict[str, Any], key: str, *, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{context} must define a non-empty string '{key}'.")
    return value.strip()


def _optional_int(payload: dict[str, Any], key: str, *, default: int) -> int:
    value = payload.get(key, default)
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"'{key}' must be an integer when present.")
    return value


def _optional_bool(payload: dict[str, Any], key: str, *, default: bool = False) -> bool:
    value = payload.get(key, default)
    if not isinstance(value, bool):
        raise TypeError(f"'{key}' must be a boolean when present.")
    return value


def _schema_version(payload: dict[str, Any], *, context: str) -> int:
    value = payload.get("schema_version", SUPPORTED_SCHEMA_VERSION)
    if not isinstance(value, int) or isinstance(value, bool):
        raise TypeError(f"{context} must define an integer 'schema_version'.")
    if value != SUPPORTED_SCHEMA_VERSION:
        raise ValueError(
            f"{context} uses unsupported schema version {value}; "
            f"this tooling supports version {SUPPORTED_SCHEMA_VERSION}."
        )
    return value


def _require_str_list(value: Any, *, context: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{context} must define a non-empty list of strings.")
    items: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"{context} must contain only non-empty strings.")
        items.append(item.strip())
    return tuple(items)


def _optional_str_list(value: Any, *, default: tuple[str, ...] = ()) -> tuple[str, ...]:
    if value is None:
        return default
    if not isinstance(value, list):
        raise TypeError("Expected a list of strings.")
    items: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError("List values must be non-empty strings.")
        items.append(item.strip())
    return tuple(items)


def load_catalog(
    profiles_dir: Path | None = None,
    *,
    context: ProjectContext | None = None,
) -> ProfileCatalog:
    """Load the portable profile catalog from the selected tooling resources."""

    if profiles_dir is not None and context is not None:
        raise ValueError("Pass either profiles_dir or context, not both.")
    if profiles_dir is None:
        selected_context = context or load_context()
        requested_directory = selected_context.resources.profiles
    else:
        requested_directory = profiles_dir
    try:
        directory = validate_root(requested_directory)
    except FilesystemSafetyError as exc:
        raise OSError(
            f"Could not access profile resources: {requested_directory}"
        ) from exc
    features_path = directory / "features.toml"
    payload = _read_toml(features_path, root=directory)

    schema_version = _schema_version(payload, context=str(features_path))

    core_section = payload.get("core")
    if not isinstance(core_section, dict):
        raise TypeError(f"{features_path} must define a [core] table.")
    core_adapters = _require_str_list(
        core_section.get("adapters"),
        context=f"{features_path}: [core].adapters",
    )

    features_section = payload.get("features")
    if not isinstance(features_section, dict) or not features_section:
        raise ValueError(f"{features_path} must define a non-empty [features] table.")

    features: dict[str, FeatureDefinition] = {}
    for feature_id, raw in features_section.items():
        if not isinstance(raw, dict):
            raise TypeError(
                f"{features_path}: [features.{feature_id}] must be a table."
            )
        features[feature_id] = FeatureDefinition(
            id=feature_id,
            name=_require_str(
                raw, "name", context=f"{features_path}: [features.{feature_id}]"
            ),
            description=_require_str(
                raw, "description", context=f"{features_path}: [features.{feature_id}]"
            ),
            adapter=_require_str(
                raw,
                "adapter",
                context=f"{features_path}: [features.{feature_id}]",
            ),
            requires=_optional_str_list(raw.get("requires")),
            optional=_optional_bool(raw, "optional"),
            selectable=_optional_bool(raw, "selectable"),
        )

    profiles: dict[str, ProfileDefinition] = {}
    for path in sorted(directory.glob("*.toml")):
        if path.name == "features.toml":
            continue
        profile = _load_profile_definition(path, root=directory)
        if profile.id in profiles:
            raise ValueError(f"Duplicate profile id '{profile.id}' in {directory}.")
        profiles[profile.id] = profile

    catalog = ProfileCatalog(
        schema_version=schema_version,
        core_adapters=core_adapters,
        features=features,
        profiles=profiles,
    )
    validate_catalog(catalog)
    return catalog


def _load_profile_definition(path: Path, *, root: Path) -> ProfileDefinition:
    payload = _read_toml(path, root=root)
    schema_version = _schema_version(payload, context=str(path))

    profile_id = _require_str(payload, "id", context=str(path))
    if path.stem != profile_id:
        raise ValueError(
            f"{path} must use the same file name and profile id ('{path.stem}' != '{profile_id}')."
        )

    return ProfileDefinition(
        schema_version=schema_version,
        id=profile_id,
        order=_optional_int(payload, "order", default=1000),
        name=_require_str(payload, "name", context=str(path)),
        description=_require_str(payload, "description", context=str(path)),
        features=_require_str_list(
            payload.get("features"), context=f"{path}: features"
        ),
    )


def resolve_profile(
    catalog: ProfileCatalog,
    profile_id: str,
    *,
    optional_features: tuple[str, ...] = (),
) -> ProjectProfile:
    profile = catalog.profiles.get(profile_id)
    if profile is None:
        known = ", ".join(sorted(catalog.profiles))
        raise ProfileLookupError(
            f"Unknown profile '{profile_id}'. Available profiles: {known}."
        )

    requested_features = tuple(dict.fromkeys(optional_features))
    base_features = validate_feature_selection(profile.features, catalog)
    features = resolve_optional_features(base_features, requested_features, catalog)
    return ProjectProfile(
        schema_version=catalog.schema_version,
        profile_id=profile.id,
        name=profile.name,
        description=profile.description,
        features=features,
        optional_features=requested_features,
    )


def load_active_profile(
    project_root: Path | None = None,
    *,
    context: ProjectContext | None = None,
) -> ProjectProfile:
    """Resolve active profile decisions from ``project-tooling.toml``."""

    if project_root is not None and context is not None:
        raise ValueError("Pass either project_root or context, not both.")
    selected_context = context or load_context(project_root=project_root)
    catalog = load_catalog(context=selected_context)
    return resolve_profile(
        catalog,
        selected_context.config.profile,
        optional_features=selected_context.config.optional_features,
    )
