from __future__ import annotations

import re
from collections.abc import Iterable

from tools.profiles.model import FeatureDefinition, ProfileCatalog, ProfileDefinition


class ProfileError(RuntimeError):
    """Base error for profile loading and runtime validation."""


class CatalogValidationError(ProfileError):
    """Raised when a feature or profile catalog is internally inconsistent."""


class ProfileLookupError(ProfileError):
    """Raised when a requested profile id does not exist."""


ID_PATTERN = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")


def _validate_id(value: str, *, kind: str) -> str | None:
    if ID_PATTERN.fullmatch(value):
        return None
    return f"{kind} id '{value}' must use lowercase kebab-case."


def _duplicates(values: Iterable[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    repeated: list[str] = []
    for value in values:
        if value in seen and value not in repeated:
            repeated.append(value)
        seen.add(value)
    return tuple(repeated)


def _dependency_cycle(catalog: ProfileCatalog) -> tuple[str, ...] | None:
    visited: set[str] = set()
    active: list[str] = []
    active_set: set[str] = set()

    def visit(feature_id: str) -> tuple[str, ...] | None:
        if feature_id in active_set:
            start = active.index(feature_id)
            return tuple(active[start:] + [feature_id])
        if feature_id in visited:
            return None

        active.append(feature_id)
        active_set.add(feature_id)
        for dependency in catalog.features[feature_id].requires:
            if dependency in catalog.features:
                cycle = visit(dependency)
                if cycle is not None:
                    return cycle
        active.pop()
        active_set.remove(feature_id)
        visited.add(feature_id)
        return None

    for feature_id in catalog.features:
        cycle = visit(feature_id)
        if cycle is not None:
            return cycle
    return None


def validate_feature_selection(
    feature_ids: Iterable[str], catalog: ProfileCatalog
) -> tuple[str, ...]:
    selected = tuple(feature_ids)
    errors: list[str] = []
    enabled = set(selected)

    duplicates = _duplicates(selected)
    if duplicates:
        errors.append(
            f"Feature selection contains duplicates: {', '.join(duplicates)}."
        )

    for feature_id in selected:
        if feature_id not in catalog.features:
            errors.append(f"Unknown feature '{feature_id}'.")

    if errors:
        raise CatalogValidationError("\n".join(errors))

    for feature_id in selected:
        feature = catalog.features[feature_id]
        for dependency in feature.requires:
            if dependency not in enabled:
                errors.append(
                    f"Feature '{feature_id}' requires feature '{dependency}'."
                )

    if errors:
        raise CatalogValidationError("\n".join(errors))

    return selected


def resolve_optional_features(
    base_feature_ids: Iterable[str],
    requested_feature_ids: Iterable[str],
    catalog: ProfileCatalog,
) -> tuple[str, ...]:
    selected = list(dict.fromkeys(base_feature_ids))
    enabled = set(selected)
    requested = tuple(dict.fromkeys(requested_feature_ids))

    unknown = [
        feature_id for feature_id in requested if feature_id not in catalog.features
    ]
    if unknown:
        raise CatalogValidationError(
            "\n".join(f"Unknown optional feature '{item}'." for item in unknown)
        )

    non_optional = [
        feature_id
        for feature_id in requested
        if not catalog.features[feature_id].optional
    ]
    if non_optional:
        raise CatalogValidationError(
            "\n".join(
                f"Feature '{item}' is provided by project profiles and cannot be selected with '--with'."
                for item in non_optional
            )
        )

    non_selectable = [
        feature_id
        for feature_id in requested
        if not catalog.features[feature_id].selectable
    ]
    if non_selectable:
        raise CatalogValidationError(
            "\n".join(
                f"Optional feature '{item}' cannot be selected directly."
                for item in non_selectable
            )
        )

    resolving: set[str] = set()

    def add(feature_id: str, *, requested_by: str) -> None:
        if feature_id in enabled:
            return
        if feature_id in resolving:
            raise CatalogValidationError(
                f"Feature dependency cycle encountered while resolving '{feature_id}'."
            )

        feature = catalog.features[feature_id]
        resolving.add(feature_id)
        for dependency in feature.requires:
            if dependency in enabled:
                continue
            dependency_feature = catalog.features[dependency]
            if not dependency_feature.optional:
                raise CatalogValidationError(
                    f"Optional feature '{requested_by}' requires feature '{dependency}', "
                    "which is not enabled by the selected project profile."
                )
            add(dependency, requested_by=requested_by)
        resolving.remove(feature_id)
        selected.append(feature_id)
        enabled.add(feature_id)

    for feature_id in requested:
        add(feature_id, requested_by=feature_id)

    return validate_feature_selection(selected, catalog)


def _core_errors(catalog: ProfileCatalog) -> list[str]:
    errors: list[str] = []
    if not catalog.core_adapters:
        errors.append("Profile catalog must define at least one core adapter.")
    duplicates = _duplicates(catalog.core_adapters)
    if duplicates:
        errors.append(
            f"Core adapter list contains duplicates: {', '.join(duplicates)}."
        )
    for adapter in catalog.core_adapters:
        error = _validate_id(adapter, kind="Adapter")
        if error:
            errors.append(error)
    return errors


def _feature_errors(
    feature: FeatureDefinition,
    catalog: ProfileCatalog,
) -> list[str]:
    errors: list[str] = []
    id_error = _validate_id(feature.id, kind="Feature")
    if id_error:
        errors.append(id_error)
    adapter_error = _validate_id(feature.adapter, kind="Adapter")
    if adapter_error:
        errors.append(adapter_error)
    duplicates = _duplicates(feature.requires)
    if duplicates:
        errors.append(
            f"Feature '{feature.id}' dependency list contains duplicates: {', '.join(duplicates)}."
        )
    errors.extend(
        f"Feature '{feature.id}' requires unknown feature '{dependency}'."
        for dependency in feature.requires
        if dependency not in catalog.features
    )
    if feature.selectable and not feature.optional:
        errors.append(
            f"Feature '{feature.id}' is selectable but is not marked optional."
        )
    return errors


def _profile_errors(profile: ProfileDefinition, catalog: ProfileCatalog) -> list[str]:
    errors: list[str] = []
    id_error = _validate_id(profile.id, kind="Profile")
    if id_error:
        errors.append(id_error)
    if profile.schema_version != catalog.schema_version:
        errors.append(
            f"Profile '{profile.id}' uses schema version {profile.schema_version}; "
            f"catalog version is {catalog.schema_version}."
        )
    try:
        validate_feature_selection(profile.features, catalog)
    except CatalogValidationError as exc:
        errors.append(f"Profile '{profile.id}' is invalid: {exc}")
    optional = [
        feature_id
        for feature_id in profile.features
        if catalog.features.get(feature_id) is not None
        and catalog.features[feature_id].optional
    ]
    if optional:
        errors.append(
            f"Profile '{profile.id}' must not hardcode optional feature(s): {', '.join(optional)}."
        )
    return errors


def validate_catalog(
    catalog: ProfileCatalog,
) -> None:
    errors = _core_errors(catalog)
    if not catalog.features:
        errors.append("Profile catalog must define at least one feature.")
    if not catalog.profiles:
        errors.append("Profile catalog must define at least one profile.")
    for feature in catalog.features.values():
        errors.extend(_feature_errors(feature, catalog))
    cycle = _dependency_cycle(catalog)
    if cycle is not None:
        errors.append(f"Feature dependency cycle detected: {' -> '.join(cycle)}.")
    for profile in catalog.profiles.values():
        errors.extend(_profile_errors(profile, catalog))
    if errors:
        raise CatalogValidationError("\n".join(errors))
