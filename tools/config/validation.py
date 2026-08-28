from __future__ import annotations

import ipaddress
import re
from collections.abc import Collection
from dataclasses import dataclass
from urllib.parse import urlsplit

from tools.config.model import ResolvedConfiguration, RuntimeConfig

ENVIRONMENTS = {"development", "test", "production"}
HOST_LABEL = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?")


@dataclass(frozen=True, slots=True)
class ConfigIssue:
    name: str
    message: str


class ConfigValidationError(ValueError):
    def __init__(self, issues: tuple[ConfigIssue, ...]) -> None:
        self.issues = issues
        super().__init__("\n".join(f"{issue.name}: {issue.message}" for issue in issues))


def _valid_host(value: str) -> bool:
    candidate = value.strip().strip("[]")
    if not candidate or any(char.isspace() for char in candidate) or "://" in candidate:
        return False
    try:
        ipaddress.ip_address(candidate)
        return True
    except ValueError:
        pass
    if len(candidate) > 253:
        return False
    return all(HOST_LABEL.fullmatch(label) for label in candidate.rstrip(".").split("."))


def _valid_public_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.hostname) and not parsed.username and not parsed.password


def _valid_origin(value: str) -> bool:
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    return parsed.scheme in {"http", "https", "tauri"} and bool(parsed.hostname) and value != "*"


def _port_issue(name: str, value: str) -> ConfigIssue | None:
    try:
        port = int(value)
    except ValueError:
        return ConfigIssue(name, "must be an integer between 1 and 65535")
    if not 1 <= port <= 65535:
        return ConfigIssue(name, "must be between 1 and 65535")
    return None


def _origins_issue(name: str, value: str) -> ConfigIssue | None:
    origins = [item.strip() for item in value.split(",") if item.strip()]
    if not origins or any(not _valid_origin(origin) for origin in origins):
        return ConfigIssue(
            name,
            "must contain comma-separated explicit HTTP(S) or Tauri origins",
        )
    return None


def _database_url_issue(name: str, value: str, features: Collection[str]) -> ConfigIssue | None:
    try:
        parsed = urlsplit(value)
    except ValueError:
        parsed = None
    if parsed is None or not parsed.scheme:
        return ConfigIssue(name, "must be a database URL with a driver scheme")
    if "postgres" in features and parsed.scheme != "postgresql+psycopg":
        return ConfigIssue(name, "postgres requires the postgresql+psycopg driver scheme")
    return None


def _value_issue(
    name: str,
    kind: str,
    value: str,
    features: Collection[str],
) -> ConfigIssue | None:
    if kind == "environment" and value not in ENVIRONMENTS:
        return ConfigIssue(name, "must be development, test, or production")
    if kind == "port":
        return _port_issue(name, value)
    if kind == "host" and not _valid_host(value):
        return ConfigIssue(name, "must be a valid IP address or host name")
    if kind == "public-url" and not _valid_public_url(value):
        return ConfigIssue(name, "must be an HTTP(S) URL without credentials")
    if kind == "origins":
        return _origins_issue(name, value)
    if kind == "database-url":
        return _database_url_issue(name, value, features)
    return None


def validate_configuration(resolved: ResolvedConfiguration) -> tuple[ConfigIssue, ...]:
    issues: list[ConfigIssue] = []
    for variable in resolved.contract.variables:
        if not variable.is_enabled(resolved.features):
            continue
        value = resolved.value(variable.name)
        if value is None or not value.strip():
            issues.append(ConfigIssue(variable.name, "required by the active project features but not set"))
            continue
        issue = _value_issue(variable.name, variable.kind, value, resolved.features)
        if issue is not None:
            issues.append(issue)
    return tuple(issues)


def to_runtime_config(resolved: ResolvedConfiguration) -> RuntimeConfig:
    issues = validate_configuration(resolved)
    if issues:
        raise ConfigValidationError(issues)

    def optional_int(name: str) -> int | None:
        value = resolved.value(name)
        return int(value) if value is not None else None

    origins_value = resolved.value("BACKEND_CORS_ORIGINS")
    origins = tuple(item.strip() for item in (origins_value or "").split(",") if item.strip())
    return RuntimeConfig(
        app_env=resolved.value("APP_ENV") or "development",
        app_name=resolved.value("APP_NAME"),
        frontend_host=resolved.value("FRONTEND_HOST"),
        frontend_port=optional_int("FRONTEND_PORT"),
        vite_api_base_url=resolved.value("VITE_API_BASE_URL"),
        backend_host=resolved.value("BACKEND_HOST"),
        backend_port=optional_int("BACKEND_PORT"),
        backend_cors_origins=origins,
        database_url=resolved.value("DATABASE_URL"),
        sources=resolved.sources,
    )
