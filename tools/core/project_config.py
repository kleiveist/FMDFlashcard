"""Persistent, project-owned configuration for portable tooling."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path, PureWindowsPath
from typing import Any

import tomllib

from tools.core.filesystem import (
    FilesystemSafetyError,
    read_regular_text,
)
from tools.core.filesystem import safe_relative_path as filesystem_relative_path

SUPPORTED_SCHEMA_VERSION = 1


class ProjectConfigError(ValueError):
    """Raised when ``project-tooling.toml`` is malformed or unsafe."""


@dataclass(frozen=True)
class ProjectPathConfig:
    """Relative product paths stored independently from the copied tooling."""

    frontend: str = "frontend"
    backend: str = ""
    tauri: str = "src-tauri"
    docs: str = "docs"


@dataclass(frozen=True)
class ProjectConfig:
    """Versioned project decisions that survive replacement of ``tools/``."""

    tooling_version: str
    project_name: str
    profile: str
    paths: ProjectPathConfig = field(default_factory=ProjectPathConfig)
    optional_features: tuple[str, ...] = ()
    schema_version: int = SUPPORTED_SCHEMA_VERSION


def _table(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise ProjectConfigError(f"project-tooling.toml must define a [{key}] table.")
    return value


def _required_string(payload: dict[str, Any], key: str, *, table: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ProjectConfigError(f"[{table}].{key} must be a non-empty string.")
    return value.strip()


def _path_string(
    payload: dict[str, Any], key: str, *, allow_empty: bool = False
) -> str:
    value = payload.get(key, "")
    if not isinstance(value, str):
        raise ProjectConfigError(f"[paths].{key} must be a string.")
    value = value.strip()
    if not value and allow_empty:
        return ""
    if not value:
        raise ProjectConfigError(f"[paths].{key} must not be empty.")
    _validate_relative_path(value, key=key)
    return value


def _validate_relative_path(value: str, *, key: str) -> None:
    if "\x00" in value:
        raise ProjectConfigError(f"[paths].{key} contains a NUL byte.")
    posix = Path(value)
    windows = PureWindowsPath(value)
    if posix.is_absolute() or windows.is_absolute() or windows.drive:
        raise ProjectConfigError(f"[paths].{key} must be project-relative: {value!r}.")
    if "\\" in value:
        raise ProjectConfigError(
            f"[paths].{key} must use portable '/' separators: {value!r}."
        )
    if value == ".":
        return
    if value == ".." or ".." in posix.parts or ".." in windows.parts:
        raise ProjectConfigError(
            f"[paths].{key} must not escape the project root: {value!r}."
        )
    try:
        normalized = filesystem_relative_path(value)
    except FilesystemSafetyError as exc:
        raise ProjectConfigError(
            f"[paths].{key} is not a canonical portable path: {value!r}."
        ) from exc
    if normalized != value:
        raise ProjectConfigError(
            f"[paths].{key} is not a canonical portable path: {value!r}."
        )


def _features(payload: dict[str, Any]) -> tuple[str, ...]:
    value = payload.get("optional", [])
    if not isinstance(value, list):
        raise ProjectConfigError("[features].optional must be a list of strings.")
    features: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ProjectConfigError(
                "[features].optional must contain non-empty strings."
            )
        feature = item.strip()
        if feature not in features:
            features.append(feature)
    return tuple(features)


def load_project_config(path: Path) -> ProjectConfig:
    """Load and validate a project configuration without modifying the filesystem."""

    try:
        payload = tomllib.loads(
            read_regular_text(
                path,
                root=path.parent,
                label="Project tooling configuration",
            )
        )
    except (FilesystemSafetyError, OSError) as exc:
        raise ProjectConfigError(
            f"Could not read project configuration: {path}"
        ) from exc
    except tomllib.TOMLDecodeError as exc:
        raise ProjectConfigError(f"Invalid TOML in {path}: {exc}") from exc

    schema_version = payload.get("schema_version")
    if schema_version != SUPPORTED_SCHEMA_VERSION or isinstance(schema_version, bool):
        raise ProjectConfigError(
            f"Unsupported project-tooling schema {schema_version!r}; "
            f"expected {SUPPORTED_SCHEMA_VERSION}."
        )

    tooling = _table(payload, "tooling")
    project = _table(payload, "project")
    paths = _table(payload, "paths")
    features = _table(payload, "features")
    return ProjectConfig(
        schema_version=schema_version,
        tooling_version=_required_string(tooling, "version", table="tooling"),
        project_name=_required_string(project, "name", table="project"),
        profile=_required_string(project, "profile", table="project"),
        paths=ProjectPathConfig(
            frontend=_path_string(paths, "frontend"),
            backend=_path_string(paths, "backend", allow_empty=True),
            tauri=_path_string(paths, "tauri"),
            docs=_path_string(paths, "docs"),
        ),
        optional_features=_features(features),
    )


def default_project_config(
    project_root: Path,
    *,
    tooling_version: str,
    profile: str = "web-only",
    paths: ProjectPathConfig | None = None,
    optional_features: tuple[str, ...] = (),
) -> ProjectConfig:
    """Build a write-free default that detection may refine before first integration."""

    name = project_root.resolve(strict=False).name or "Project"
    return ProjectConfig(
        tooling_version=tooling_version,
        project_name=name,
        profile=profile,
        paths=paths or ProjectPathConfig(),
        optional_features=tuple(dict.fromkeys(optional_features)),
    )


def _toml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_project_config(config: ProjectConfig) -> str:
    """Render the owned schema deterministically as TOML."""

    feature_values = ", ".join(_toml_string(item) for item in config.optional_features)
    lines = [
        f"schema_version = {config.schema_version}",
        "",
        "[tooling]",
        f"version = {_toml_string(config.tooling_version)}",
        "",
        "[project]",
        f"name = {_toml_string(config.project_name)}",
        f"profile = {_toml_string(config.profile)}",
        "",
        "[paths]",
        f"frontend = {_toml_string(config.paths.frontend)}",
        f"backend = {_toml_string(config.paths.backend)}",
        f"tauri = {_toml_string(config.paths.tauri)}",
        f"docs = {_toml_string(config.paths.docs)}",
        "",
        "[features]",
        f"optional = [{feature_values}]",
        "",
    ]
    return "\n".join(lines)


def create_project_config(path: Path, config: ProjectConfig) -> None:
    """Create a configuration exactly once; never overwrite project decisions."""

    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        descriptor = os.open(path, flags, 0o644)
    except FileExistsError as exc:
        raise ProjectConfigError(
            f"Refusing to overwrite existing project configuration: {path}"
        ) from exc
    try:
        payload = render_project_config(config).encode("utf-8")
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    except BaseException:
        try:
            path.unlink()
        except OSError:
            pass
        raise
