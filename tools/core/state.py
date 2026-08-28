"""Persistent project-owned state for portable tooling integration."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tomllib

from tools.core.context import ProjectContext
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    ensure_directory,
    read_regular_text,
    safe_join,
    validate_root,
)

STATE_SCHEMA_VERSION = 1
STATE_DIRECTORY = ".tooling-state"
STATE_RELATIVE_PATH = f"{STATE_DIRECTORY}/state.toml"
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}")
_SEMVER = re.compile(
    r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?"
)
_STATE_FIELDS = {
    "schema_version",
    "tooling_version",
    "profile",
    "optional_features",
    "applied_migrations",
    "integration_digest",
}


class StateError(RuntimeError):
    """Raised when persistent tooling state is missing, malformed, or unsafe."""


@dataclass(frozen=True, slots=True)
class ToolingState:
    schema_version: int
    tooling_version: str
    profile: str
    optional_features: tuple[str, ...]
    applied_migrations: tuple[str, ...]
    integration_digest: str


def load_state(project: Path | ProjectContext) -> ToolingState:
    root = _project_root(project)
    try:
        validate_state_directory(root, create=False)
        path = safe_join(root, STATE_RELATIVE_PATH, require_exists=True)
        payload = tomllib.loads(
            read_regular_text(path, root=root, label="Tooling state")
        )
    except FilesystemSafetyError as exc:
        raise StateError(str(exc)) from exc
    except tomllib.TOMLDecodeError as exc:
        raise StateError(f"Tooling state is invalid TOML: {exc}.") from exc
    if not isinstance(payload, dict):
        raise StateError("Tooling state must contain a TOML document table.")
    return _parse_state(payload)


def render_state(state: ToolingState) -> str:
    validate_state(state)
    optional = ", ".join(_quote(item) for item in state.optional_features)
    migrations = ", ".join(_quote(item) for item in state.applied_migrations)
    return "\n".join(
        [
            f"schema_version = {state.schema_version}",
            f"tooling_version = {_quote(state.tooling_version)}",
            f"profile = {_quote(state.profile)}",
            f"optional_features = [{optional}]",
            f"applied_migrations = [{migrations}]",
            f"integration_digest = {_quote(state.integration_digest)}",
            "",
        ]
    )


def state_digest(state: ToolingState) -> str:
    return "sha256:" + hashlib.sha256(render_state(state).encode("utf-8")).hexdigest()


def write_state(project: Path | ProjectContext, state: ToolingState) -> Path:
    validate_state(state)
    root = _project_root(project)
    try:
        validate_state_directory(root, create=True)
        path = safe_join(root, STATE_RELATIVE_PATH)
        atomic_write_text(path, render_state(state), root=root)
    except FilesystemSafetyError as exc:
        raise StateError(str(exc)) from exc
    return path


def validate_state(state: ToolingState) -> None:
    if state.schema_version != STATE_SCHEMA_VERSION or isinstance(
        state.schema_version, bool
    ):
        raise StateError(
            f"Unsupported tooling state schema {state.schema_version}; expected {STATE_SCHEMA_VERSION}."
        )
    if not isinstance(state.tooling_version, str) or not _SEMVER.fullmatch(
        state.tooling_version
    ):
        raise StateError(f"Tooling version is not SemVer: {state.tooling_version!r}.")
    _nonempty_string(state.profile, field="profile")
    _validate_string_tuple(state.optional_features, field="optional_features")
    _validate_string_tuple(state.applied_migrations, field="applied_migrations")
    if not isinstance(state.integration_digest, str) or not _DIGEST.fullmatch(
        state.integration_digest
    ):
        raise StateError(
            "Tooling state integration_digest must be a lowercase SHA-256 digest."
        )


def validate_state_directory(
    project: Path | ProjectContext, *, create: bool = True
) -> Path:
    """Return the project-local, non-symlink ``.tooling-state`` directory."""

    root = _project_root(project)
    try:
        resolved_root = validate_root(root)
        state_directory = safe_join(resolved_root, STATE_DIRECTORY)
        if not state_directory.exists():
            if not create:
                return state_directory
            return ensure_directory(resolved_root, STATE_DIRECTORY)
        state_directory = safe_join(resolved_root, STATE_DIRECTORY, require_exists=True)
        if not state_directory.is_dir():
            raise StateError(
                f"Tooling state path {STATE_DIRECTORY} must be a directory."
            )
        return state_directory
    except FilesystemSafetyError as exc:
        raise StateError(str(exc)) from exc


def _parse_state(payload: dict[str, Any]) -> ToolingState:
    _require_exact_fields(payload)
    schema_version = payload["schema_version"]
    tooling_version = payload["tooling_version"]
    profile = payload["profile"]
    optional_features = payload["optional_features"]
    applied_migrations = payload["applied_migrations"]
    integration_digest = payload["integration_digest"]
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise StateError("Tooling state schema_version must be an integer.")
    if (
        not isinstance(tooling_version, str)
        or not isinstance(profile, str)
        or not isinstance(integration_digest, str)
    ):
        raise StateError(
            "Tooling state version, profile, and integration_digest must be strings."
        )
    state = ToolingState(
        schema_version=schema_version,
        tooling_version=tooling_version,
        profile=profile,
        optional_features=_parse_strings(optional_features, field="optional_features"),
        applied_migrations=_parse_strings(
            applied_migrations, field="applied_migrations"
        ),
        integration_digest=integration_digest,
    )
    validate_state(state)
    return state


def _project_root(project: Path | ProjectContext) -> Path:
    if isinstance(project, ProjectContext):
        return project.project_root
    return Path(project)


def _nonempty_string(value: object, *, field: str) -> None:
    if not isinstance(value, str) or not value or value.strip() != value:
        raise StateError(
            f"Tooling state field '{field}' must be a non-empty, trimmed string."
        )


def _validate_string_tuple(values: object, *, field: str) -> None:
    if not isinstance(values, tuple):
        raise StateError(f"Tooling state field '{field}' must be a tuple of strings.")
    for value in values:
        _nonempty_string(value, field=field)
    if len(values) != len(set(values)):
        raise StateError(f"Tooling state field '{field}' must not contain duplicates.")


def _parse_strings(value: object, *, field: str) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise StateError(f"Tooling state field '{field}' must be a list of strings.")
    return tuple(value)


def _require_exact_fields(payload: dict[str, Any]) -> None:
    actual = set(payload)
    if actual == _STATE_FIELDS:
        return
    missing = sorted(_STATE_FIELDS - actual)
    unknown = sorted(actual - _STATE_FIELDS)
    detail = []
    if missing:
        detail.append(f"missing {', '.join(missing)}")
    if unknown:
        detail.append(f"unknown {', '.join(unknown)}")
    raise StateError(f"Invalid tooling state fields: {'; '.join(detail)}.")


def _quote(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)
