from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any

import tomllib

from tools.core.context import load_context
from tools.quality.model import (
    EXCEPTION_RULE_IDS,
    BackendArchitectureConfig,
    ExceptionEntry,
    FileLimits,
    FrontendArchitectureConfig,
    QualityConfig,
    ScopeLimits,
    SourceConfig,
)

DEFAULT_CONFIG_PATH = load_context().resources.config / "code-quality.toml"


class QualityConfigError(ValueError):
    """Raised when the quality policy is absent or internally inconsistent."""


def _table(payload: Mapping[str, Any], key: str, *, context: str = "configuration") -> Mapping[str, Any]:
    value = payload.get(key)
    if not isinstance(value, Mapping):
        raise QualityConfigError(f"{context}.{key} must be a TOML table")
    return value


def _positive_int(payload: Mapping[str, Any], key: str, *, context: str) -> int:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise QualityConfigError(f"{context}.{key} must be a positive integer")
    return value


def _string(payload: Mapping[str, Any], key: str, *, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise QualityConfigError(f"{context}.{key} must be a non-empty string")
    return value.strip()


def _strings(payload: Mapping[str, Any], key: str, *, context: str) -> tuple[str, ...]:
    value = payload.get(key)
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise QualityConfigError(f"{context}.{key} must be a list of non-empty strings")
    items = tuple(item.strip() for item in value)
    if len(items) != len(set(items)):
        raise QualityConfigError(f"{context}.{key} must not contain duplicates")
    return items


def _relative_path(value: str, *, context: str, allow_glob: bool = False) -> str:
    normalized = value.replace("\\", "/").strip()
    path = PurePosixPath(normalized)
    windows_path = PureWindowsPath(normalized)
    if (
        not normalized
        or path.is_absolute()
        or windows_path.is_absolute()
        or bool(windows_path.drive)
        or ".." in path.parts
    ):
        raise QualityConfigError(f"{context} must be a repository-relative path without '..'")
    if not allow_glob and any(character in normalized for character in "*?[]"):
        raise QualityConfigError(f"{context} must identify one exact path, not a glob")
    return path.as_posix()


def _scope_limits(
    payload: Mapping[str, Any],
    section: str,
    maximum_key: str,
    *,
    warning_inclusive: bool = False,
    strong_warning_inclusive: bool = False,
) -> ScopeLimits:
    values = _table(payload, section)
    warning = _positive_int(values, "warning", context=section)
    strong = _positive_int(values, "strong_warning", context=section)
    maximum = _positive_int(values, maximum_key, context=section)
    valid = warning < strong and (strong <= maximum if strong_warning_inclusive else strong < maximum)
    if not valid:
        operator = (
            "warning < strong_warning <= maximum" if strong_warning_inclusive else "warning < strong_warning < maximum"
        )
        raise QualityConfigError(f"{section} thresholds must satisfy {operator}")
    return ScopeLimits(
        warning=warning,
        strong_warning=strong,
        maximum=maximum,
        warning_inclusive=warning_inclusive,
        strong_warning_inclusive=strong_warning_inclusive,
    )


def _load_source(payload: Mapping[str, Any]) -> SourceConfig:
    values = _table(payload, "source")
    extensions = _strings(values, "extensions", context="source")
    if any(not extension.startswith(".") or "/" in extension for extension in extensions):
        raise QualityConfigError("source.extensions entries must be file suffixes beginning with '.'")
    if any(extension != extension.lower() for extension in extensions):
        raise QualityConfigError("source.extensions entries must be lowercase")
    paths = tuple(
        _relative_path(item, context="source.exclude_paths entry", allow_glob=True)
        for item in _strings(values, "exclude_paths", context="source")
    )
    return SourceConfig(
        extensions=extensions,
        exclude_directories=frozenset(_strings(values, "exclude_directories", context="source")),
        exclude_files=frozenset(_strings(values, "exclude_files", context="source")),
        exclude_paths=paths,
    )


def _load_file_limits(payload: Mapping[str, Any]) -> FileLimits:
    values = _table(payload, "file")
    warning = _positive_int(values, "warning", context="file")
    strong = _positive_int(values, "strong_warning", context="file")
    maximum = _positive_int(values, "max_code_lines", context="file")
    physical = _positive_int(values, "physical_lines_warning", context="file")
    if not warning < strong < maximum:
        raise QualityConfigError("file thresholds must satisfy warning < strong_warning < max_code_lines")
    if physical <= maximum:
        raise QualityConfigError("file.physical_lines_warning must be greater than file.max_code_lines")
    return FileLimits(warning, strong, maximum, physical)


def _layer_names(values: Mapping[str, Any], key: str) -> frozenset[str]:
    items = _strings(values, key, context="architecture.backend")
    if any("/" in item or "\\" in item for item in items):
        raise QualityConfigError(f"architecture.backend.{key} entries must be direct directory names")
    return frozenset(items)


def _composition_files(values: Mapping[str, Any]) -> frozenset[str]:
    items = _strings(values, "composition_files", context="architecture.backend")
    if any("/" in item or "\\" in item or not item.endswith(".py") for item in items):
        raise QualityConfigError("architecture.backend.composition_files entries must be direct Python file names")
    return frozenset(items)


def _ensure_disjoint(groups: Mapping[str, frozenset[str]], *, context: str) -> None:
    owners: dict[str, str] = {}
    for group, names in groups.items():
        for name in names:
            previous = owners.get(name)
            if previous is not None:
                raise QualityConfigError(f"{context} directory '{name}' is assigned to both {previous} and {group}")
            owners[name] = group


def _load_backend_architecture(payload: Mapping[str, Any]) -> BackendArchitectureConfig:
    values = _table(_table(payload, "architecture"), "backend", context="architecture")
    dependencies: set[tuple[str, str]] = set()
    known_layers = {"api", "application", "domain", "infrastructure"}
    for value in _strings(values, "forbidden_dependencies", context="architecture.backend"):
        parts = tuple(part.strip() for part in value.split("->"))
        if len(parts) != 2 or any(part not in known_layers for part in parts):
            raise QualityConfigError("architecture.backend.forbidden_dependencies entries must use '<layer>-><layer>'")
        dependencies.add((parts[0], parts[1]))
    config = BackendArchitectureConfig(
        root=Path(
            _relative_path(_string(values, "root", context="architecture.backend"), context="architecture.backend.root")
        ),
        package=_string(values, "package", context="architecture.backend"),
        api_layers=_layer_names(values, "api_layers"),
        application_layers=_layer_names(values, "application_layers"),
        domain_layers=_layer_names(values, "domain_layers"),
        infrastructure_layers=_layer_names(values, "infrastructure_layers"),
        support_directories=_layer_names(values, "support_directories"),
        composition_files=_composition_files(values),
        forbidden_dependencies=frozenset(dependencies),
        domain_forbidden_imports=_strings(values, "domain_forbidden_imports", context="architecture.backend"),
        router_business_imports=_strings(values, "router_business_imports", context="architecture.backend"),
        router_handler_max_lines=_positive_int(values, "router_handler_max_lines", context="architecture.backend"),
    )
    _ensure_disjoint(
        {
            "api": config.api_layers,
            "application": config.application_layers,
            "domain": config.domain_layers,
            "infrastructure": config.infrastructure_layers,
            "support": config.support_directories,
        },
        context="architecture.backend",
    )
    return config


def _load_frontend_architecture(payload: Mapping[str, Any]) -> FrontendArchitectureConfig:
    values = _table(_table(payload, "architecture"), "frontend", context="architecture")
    config = FrontendArchitectureConfig(
        root=Path(
            _relative_path(
                _string(values, "root", context="architecture.frontend"), context="architecture.frontend.root"
            )
        ),
        api_directories=frozenset(_strings(values, "api_directories", context="architecture.frontend")),
        feature_directories=frozenset(_strings(values, "feature_directories", context="architecture.frontend")),
        shared_directories=frozenset(_strings(values, "shared_directories", context="architecture.frontend")),
        ui_directories=frozenset(_strings(values, "ui_directories", context="architecture.frontend")),
        public_module_names=frozenset(_strings(values, "public_module_names", context="architecture.frontend")),
    )
    _ensure_disjoint(
        {
            "api": config.api_directories,
            "feature": config.feature_directories,
            "shared": config.shared_directories,
            "ui": config.ui_directories,
        },
        context="architecture.frontend",
    )
    return config


def _load_exceptions(payload: Mapping[str, Any]) -> tuple[ExceptionEntry, ...]:
    raw_entries = payload.get("exceptions", [])
    if not isinstance(raw_entries, list):
        raise QualityConfigError("[EX001 INVALID_EXCEPTION] exceptions must be an array of TOML tables")
    entries: list[ExceptionEntry] = []
    seen: set[tuple[str, str, str | None]] = set()
    for index, raw in enumerate(raw_entries, start=1):
        context = f"exceptions[{index}]"
        if not isinstance(raw, Mapping):
            raise QualityConfigError(f"[EX001 INVALID_EXCEPTION] {context} must be a TOML table")
        try:
            rule_id = _string(raw, "rule", context=context)
            path = _relative_path(_string(raw, "path", context=context), context=f"{context}.path")
            reason = _string(raw, "reason", context=context)
            expires = _string(raw, "expires", context=context)
        except QualityConfigError as exc:
            raise QualityConfigError(f"[EX001 INVALID_EXCEPTION] {exc}") from exc
        if rule_id not in EXCEPTION_RULE_IDS:
            raise QualityConfigError(f"[EX001 INVALID_EXCEPTION] {context}.rule must be a known CQ or AR rule ID")
        if len(reason) < 10:
            raise QualityConfigError(
                f"[EX001 INVALID_EXCEPTION] {context}.reason must contain a meaningful architectural reason"
            )
        symbol_value = raw.get("symbol")
        if symbol_value is not None and (not isinstance(symbol_value, str) or not symbol_value.strip()):
            raise QualityConfigError(f"[EX001 INVALID_EXCEPTION] {context}.symbol must be a non-empty string")
        symbol = symbol_value.strip() if isinstance(symbol_value, str) else None
        key = (rule_id, path, symbol)
        if key in seen:
            raise QualityConfigError(f"[EX001 INVALID_EXCEPTION] duplicate exception for {rule_id} at {path}")
        seen.add(key)
        entries.append(ExceptionEntry(rule_id, path, reason, expires, symbol))
    return tuple(entries)


def load_quality_config(path: Path, *, project_root: Path | None = None) -> QualityConfig:
    resolved_path = path if path.is_absolute() else (project_root or Path.cwd()) / path
    try:
        payload = tomllib.loads(resolved_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise QualityConfigError(f"quality configuration not found: {resolved_path}") from exc
    except OSError as exc:
        raise QualityConfigError(f"quality configuration could not be read: {exc}") from exc
    except tomllib.TOMLDecodeError as exc:
        raise QualityConfigError(f"quality configuration is invalid TOML: {exc}") from exc
    if not isinstance(payload, Mapping):
        raise QualityConfigError("quality configuration root must be a TOML table")
    if payload.get("schema_version") != 1:
        raise QualityConfigError("schema_version must be the integer 1")
    return QualityConfig(
        source=_load_source(payload),
        file=_load_file_limits(payload),
        function=_scope_limits(payload, "function", "max_lines"),
        class_=_scope_limits(payload, "class", "max_lines"),
        complexity=_scope_limits(payload, "complexity", "max"),
        nesting=_scope_limits(
            payload,
            "nesting",
            "max",
            warning_inclusive=True,
            strong_warning_inclusive=True,
        ),
        parameters=_scope_limits(payload, "parameters", "max", warning_inclusive=True),
        backend_architecture=_load_backend_architecture(payload),
        frontend_architecture=_load_frontend_architecture(payload),
        exceptions=_load_exceptions(payload),
    )
