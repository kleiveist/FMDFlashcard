from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping


@dataclass(frozen=True, slots=True)
class VariableDefinition:
    name: str
    section: str
    description: str
    scope: str
    kind: str
    required_features: tuple[str, ...]
    secret: bool = False
    default: str | None = None
    example: str | None = None
    derived: str | None = None

    def is_enabled(self, features: tuple[str, ...]) -> bool:
        enabled = set(features)
        return all(feature in enabled for feature in self.required_features)


@dataclass(frozen=True, slots=True)
class ConfigContract:
    schema_version: int
    variables: tuple[VariableDefinition, ...]

    def by_name(self) -> dict[str, VariableDefinition]:
        return {variable.name: variable for variable in self.variables}


@dataclass(frozen=True, slots=True)
class ResolvedConfiguration:
    contract: ConfigContract
    features: tuple[str, ...]
    values: Mapping[str, str | None]
    sources: Mapping[str, str]

    def value(self, name: str) -> str | None:
        return self.values.get(name)


@dataclass(frozen=True, slots=True)
class RuntimeConfig:
    app_env: str
    app_name: str | None
    frontend_host: str | None
    frontend_port: int | None
    vite_api_base_url: str | None
    backend_host: str | None
    backend_port: int | None
    backend_cors_origins: tuple[str, ...]
    database_url: str | None = field(default=None, repr=False)
    sources: Mapping[str, str] = field(default_factory=dict, repr=False)

    def source_for(self, name: str) -> str:
        return self.sources.get(name, "not applicable")

    def frontend_environment(self) -> dict[str, str]:
        values: dict[str, str] = {}
        if self.frontend_host is not None:
            values["FRONTEND_HOST"] = self.frontend_host
        if self.frontend_port is not None:
            values["FRONTEND_PORT"] = str(self.frontend_port)
        if self.backend_host is not None:
            values["BACKEND_HOST"] = self.backend_host
        if self.backend_port is not None:
            values["BACKEND_PORT"] = str(self.backend_port)
        if self.vite_api_base_url is not None:
            values["VITE_API_BASE_URL"] = self.vite_api_base_url
        return values

    def backend_environment(self) -> dict[str, str]:
        values = {"APP_ENV": self.app_env}
        if self.app_name is not None:
            values["APP_NAME"] = self.app_name
        if self.backend_host is not None:
            values["BACKEND_HOST"] = self.backend_host
        if self.backend_port is not None:
            values["BACKEND_PORT"] = str(self.backend_port)
        if self.backend_cors_origins:
            values["BACKEND_CORS_ORIGINS"] = ",".join(self.backend_cors_origins)
        if self.database_url is not None:
            values["DATABASE_URL"] = self.database_url
        return values
