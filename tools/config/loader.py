from __future__ import annotations

import json
import os
import re
from collections.abc import Mapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

import tomllib

from tools.config.masking import is_secret_name
from tools.config.model import (
    ConfigContract,
    ResolvedConfiguration,
    RuntimeConfig,
    VariableDefinition,
)
from tools.config.validation import to_runtime_config
from tools.core.context import ProjectContext, load_context

if TYPE_CHECKING:
    from tools.profiles.model import ProjectProfile

KEY_PATTERN = re.compile(r"[A-Z][A-Z0-9_]*")
LEGACY_ALIASES = {"BACKEND_CORS_ORIGINS": ("CORS_ORIGINS",)}
SUPPORTED_KINDS = {
    "database-url",
    "environment",
    "host",
    "origins",
    "port",
    "public-url",
    "string",
}
SUPPORTED_DERIVATIONS = {"backend-url", "frontend-origins"}


class ConfigLoadError(ValueError):
    """Raised when the configuration contract or a local dotenv file is malformed."""


def _require_string(payload: Mapping[str, Any], key: str, *, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ConfigLoadError(f"{context} must define a non-empty string '{key}'.")
    return value.strip()


def _optional_string(payload: Mapping[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ConfigLoadError(f"'{key}' must be a non-empty string when present.")
    return value.strip()


def _string_list(value: Any, *, context: str) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise ConfigLoadError(f"{context} must be a list of strings.")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ConfigLoadError(f"{context} must contain only non-empty strings.")
        result.append(item.strip())
    return tuple(dict.fromkeys(result))


def _variable_name(payload: Mapping[str, Any], *, context: str, seen: set[str]) -> str:
    name = _require_string(payload, "name", context=context)
    if not KEY_PATTERN.fullmatch(name):
        raise ConfigLoadError(f"{context} name '{name}' must use UPPER_SNAKE_CASE.")
    if name in seen:
        raise ConfigLoadError(f"Duplicate configuration variable '{name}'.")
    return name


def _secret_flag(payload: Mapping[str, Any], *, context: str) -> bool:
    secret = payload.get("secret", False)
    if not isinstance(secret, bool):
        raise ConfigLoadError(f"{context} 'secret' must be a boolean.")
    return secret


def _validate_supported_definition(
    *,
    context: str,
    kind: str,
    derived: str | None,
) -> None:
    if kind not in SUPPORTED_KINDS:
        raise ConfigLoadError(f"{context} uses unsupported kind '{kind}'.")
    if derived is not None and derived not in SUPPORTED_DERIVATIONS:
        raise ConfigLoadError(f"{context} uses unsupported derivation '{derived}'.")


def _validate_secret_definition(
    *,
    context: str,
    name: str,
    scope: str,
    secret: bool,
    default: str | None,
) -> None:
    if secret and default is not None:
        raise ConfigLoadError(f"{context} secret variables must not define runtime defaults.")
    if secret and name.startswith("VITE_"):
        raise ConfigLoadError(f"{context} secret variables must not use the public VITE_ prefix.")
    if is_secret_name(name) and not secret:
        raise ConfigLoadError(f"{context} variable '{name}' must be marked secret.")
    if scope == "public-client" and not name.startswith("VITE_"):
        raise ConfigLoadError(f"{context} public client variables must use the VITE_ prefix.")


def _parse_variable_definition(
    raw: object,
    *,
    context: str,
    seen: set[str],
) -> VariableDefinition:
    if not isinstance(raw, dict):
        raise ConfigLoadError(f"{context} must be a TOML table.")
    name = _variable_name(raw, context=context, seen=seen)
    secret = _secret_flag(raw, context=context)
    scope = _require_string(raw, "scope", context=context)
    kind = _require_string(raw, "kind", context=context)
    default = _optional_string(raw, "default")
    derived = _optional_string(raw, "derived")
    _validate_supported_definition(
        context=context,
        kind=kind,
        derived=derived,
    )
    _validate_secret_definition(
        context=context,
        name=name,
        scope=scope,
        secret=secret,
        default=default,
    )
    return VariableDefinition(
        name=name,
        section=_require_string(raw, "section", context=context),
        description=_require_string(raw, "description", context=context),
        scope=scope,
        kind=kind,
        required_features=_string_list(
            raw.get("required_features", []),
            context=f"{context} required_features",
        ),
        secret=secret,
        default=default,
        example=_optional_string(raw, "example"),
        derived=derived,
    )


def load_contract(
    path: Path | None = None,
    *,
    context: ProjectContext | None = None,
) -> ConfigContract:
    """Load an explicit contract or the contract packaged with ``tools/``."""

    contract_path = (
        path.resolve()
        if path is not None
        else (context or load_context()).resources.config.joinpath("environment.toml").resolve()
    )
    try:
        with contract_path.open("rb") as handle:
            payload = tomllib.load(handle)
    except OSError as exc:
        raise ConfigLoadError(f"Could not read configuration contract: {contract_path}") from exc
    except tomllib.TOMLDecodeError as exc:
        raise ConfigLoadError(f"Invalid TOML in configuration contract {contract_path}: {exc}") from exc

    schema_version = payload.get("schema_version")
    if schema_version != 1:
        raise ConfigLoadError(f"Configuration contract {contract_path} must use schema_version = 1.")
    raw_variables = payload.get("variables")
    if not isinstance(raw_variables, list) or not raw_variables:
        raise ConfigLoadError(f"Configuration contract {contract_path} must define [[variables]].")

    variables: list[VariableDefinition] = []
    seen: set[str] = set()
    for index, raw in enumerate(raw_variables, start=1):
        context = f"{contract_path}: variables entry {index}"
        variable = _parse_variable_definition(raw, context=context, seen=seen)
        variables.append(variable)
        seen.add(variable.name)
    return ConfigContract(schema_version=1, variables=tuple(variables))


def _parse_quoted_value(value: str, *, path: Path, line_number: int) -> str:
    if value.startswith('"'):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ConfigLoadError(f"Invalid double-quoted value in {path}:{line_number}.") from exc
        if not isinstance(parsed, str):
            raise ConfigLoadError(f"Dotenv value in {path}:{line_number} must be a string.")
        return parsed
    if value.startswith("'"):
        if len(value) < 2 or not value.endswith("'"):
            raise ConfigLoadError(f"Invalid single-quoted value in {path}:{line_number}.")
        return value[1:-1]
    return value.split(" #", 1)[0].strip()


def load_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise ConfigLoadError(f"Could not read local environment file: {path}") from exc

    values: dict[str, str] = {}
    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            raise ConfigLoadError(f"Invalid dotenv entry in {path}:{line_number}; expected NAME=value.")
        key, raw_value = line.split("=", 1)
        key = key.strip()
        if not KEY_PATTERN.fullmatch(key):
            raise ConfigLoadError(f"Invalid dotenv variable name '{key}' in {path}:{line_number}.")
        values[key] = _parse_quoted_value(raw_value.strip(), path=path, line_number=line_number)
    return values


def _client_host(host: str) -> str:
    if host in {"0.0.0.0", "::", "[::]"}:
        return "127.0.0.1"
    return f"[{host}]" if ":" in host and not host.startswith("[") else host


def resolve_configuration(
    profile: ProjectProfile,
    *,
    project_root: Path | None = None,
    context: ProjectContext | None = None,
    environ: Mapping[str, str] | None = None,
    cli_overrides: Mapping[str, object | None] | None = None,
    contract: ConfigContract | None = None,
) -> ResolvedConfiguration:
    selected_context = context or load_context(project_root=project_root)
    root = selected_context.project_root
    selected_contract = contract or load_contract(context=selected_context)
    active_variables = [variable for variable in selected_contract.variables if variable.is_enabled(profile.features)]
    values: dict[str, str | None] = {variable.name: variable.default for variable in active_variables}
    sources: dict[str, str] = {
        variable.name: "tooling default" for variable in active_variables if variable.default is not None
    }

    dotenv_values = load_dotenv(root / ".env")
    for variable in active_variables:
        if variable.name in dotenv_values:
            values[variable.name] = dotenv_values[variable.name]
            sources[variable.name] = "local .env"
            continue
        legacy_name = next(
            (name for name in LEGACY_ALIASES.get(variable.name, ()) if name in dotenv_values),
            None,
        )
        if legacy_name is not None:
            values[variable.name] = dotenv_values[legacy_name]
            sources[variable.name] = f"local .env legacy alias {legacy_name}"

    process_environment = os.environ if environ is None else environ
    for variable in active_variables:
        if variable.name in process_environment:
            values[variable.name] = process_environment[variable.name]
            sources[variable.name] = "process environment"
            continue
        legacy_name = next(
            (name for name in LEGACY_ALIASES.get(variable.name, ()) if name in process_environment),
            None,
        )
        if legacy_name is not None:
            values[variable.name] = process_environment[legacy_name]
            sources[variable.name] = f"process environment legacy alias {legacy_name}"

    for raw_name, raw_value in (cli_overrides or {}).items():
        if raw_value is None:
            continue
        name = raw_name.upper()
        if name not in values:
            continue
        values[name] = str(raw_value)
        sources[name] = "CLI override"

    by_name = selected_contract.by_name()
    api_variable = by_name.get("VITE_API_BASE_URL")
    if api_variable is not None and api_variable.is_enabled(profile.features) and not values.get(api_variable.name):
        backend_host = values.get("BACKEND_HOST")
        backend_port = values.get("BACKEND_PORT")
        if backend_host and backend_port:
            values[api_variable.name] = f"http://{_client_host(backend_host)}:{backend_port}"
            sources[api_variable.name] = "derived from backend host and port"

    cors_variable = by_name.get("BACKEND_CORS_ORIGINS")
    if cors_variable is not None and cors_variable.is_enabled(profile.features) and not values.get(cors_variable.name):
        frontend_definition = by_name.get("FRONTEND_HOST")
        port_definition = by_name.get("FRONTEND_PORT")
        frontend_host = values.get("FRONTEND_HOST") or (frontend_definition.default if frontend_definition else None)
        frontend_port = values.get("FRONTEND_PORT") or (port_definition.default if port_definition else None)
        if frontend_host and frontend_port:
            browser_host = _client_host(frontend_host)
            origins = [f"http://{browser_host}:{frontend_port}"]
            if browser_host != "localhost":
                origins.append(f"http://localhost:{frontend_port}")
            origins.extend(["http://tauri.localhost", "tauri://localhost"])
            values[cors_variable.name] = ",".join(origins)
            sources[cors_variable.name] = "derived from frontend host and port"

    return ResolvedConfiguration(
        contract=selected_contract,
        features=profile.features,
        values=values,
        sources=sources,
    )


def load_runtime_config(
    profile: ProjectProfile,
    *,
    project_root: Path | None = None,
    context: ProjectContext | None = None,
    environ: Mapping[str, str] | None = None,
    cli_overrides: Mapping[str, object | None] | None = None,
    contract: ConfigContract | None = None,
) -> RuntimeConfig:
    resolved = resolve_configuration(
        profile,
        project_root=project_root,
        context=context,
        environ=environ,
        cli_overrides=cli_overrides,
        contract=contract,
    )
    return to_runtime_config(resolved)


def render_env_example(contract: ConfigContract, features: tuple[str, ...]) -> str:
    lines: list[str] = []
    current_section: str | None = None
    for variable in contract.variables:
        if not variable.is_enabled(features):
            continue
        value = variable.example if variable.example is not None else variable.default
        if value is None:
            continue
        if variable.section != current_section:
            if lines:
                lines.append("")
            lines.extend(
                [
                    "# --------------------------------------------------",
                    f"# {variable.section}",
                    "# --------------------------------------------------",
                ]
            )
            current_section = variable.section
        lines.append(f"{variable.name}={value}")
    return "\n".join(lines) + "\n"
