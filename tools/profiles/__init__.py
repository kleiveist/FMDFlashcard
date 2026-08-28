"""Portable project-profile loading, validation, and runtime helpers."""

from tools.profiles.loader import load_active_profile, load_catalog, resolve_profile
from tools.profiles.model import (
    FeatureDefinition,
    ProfileCatalog,
    ProfileDefinition,
    ProjectProfile,
)
from tools.profiles.runtime import active_profile, feature_enabled
from tools.profiles.validator import (
    CatalogValidationError,
    ProfileError,
    ProfileLookupError,
    resolve_optional_features,
    validate_catalog,
)

__all__ = [
    "CatalogValidationError",
    "FeatureDefinition",
    "ProfileCatalog",
    "ProfileDefinition",
    "ProfileError",
    "ProfileLookupError",
    "ProjectProfile",
    "active_profile",
    "feature_enabled",
    "load_active_profile",
    "load_catalog",
    "resolve_optional_features",
    "resolve_profile",
    "validate_catalog",
]
