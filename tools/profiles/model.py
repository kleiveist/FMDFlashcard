from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class FeatureDefinition:
    id: str
    name: str
    description: str
    adapter: str
    requires: tuple[str, ...] = ()
    optional: bool = False
    selectable: bool = False


@dataclass(frozen=True, slots=True)
class ProfileDefinition:
    schema_version: int
    id: str
    name: str
    description: str
    features: tuple[str, ...]
    order: int = 1000


@dataclass(frozen=True, slots=True)
class ProfileCatalog:
    schema_version: int
    core_adapters: tuple[str, ...]
    features: dict[str, FeatureDefinition]
    profiles: dict[str, ProfileDefinition]


@dataclass(frozen=True, slots=True)
class ProjectProfile:
    schema_version: int
    profile_id: str
    name: str
    description: str
    features: tuple[str, ...]
    optional_features: tuple[str, ...] = ()

    def has_feature(self, feature_id: str) -> bool:
        return feature_id in self.features
