from __future__ import annotations

import json
import os
import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

from tools.core.context import ProjectContext, load_context

TOOLS_DIR = Path(__file__).resolve().parents[1]
ROOT = TOOLS_DIR.parent


def context(override: ProjectContext | None = None) -> ProjectContext:
    """Resolve the current Tauri target without freezing configured paths."""

    if override is not None:
        return override
    return load_context(project_root=ROOT, tools_root=TOOLS_DIR)


class _DynamicPath(os.PathLike[str]):
    """Path-like compatibility value whose resolver runs on every use."""

    def __init__(self, resolver: Callable[[], Path]) -> None:
        self._resolver = resolver

    def current(self) -> Path:
        return self._resolver()

    def __fspath__(self) -> str:
        return os.fspath(self.current())

    def __str__(self) -> str:
        return str(self.current())

    def __repr__(self) -> str:
        return repr(self.current())

    def __truediv__(self, other: str | os.PathLike[str]) -> Path:
        return self.current() / other

    def __getattr__(self, name: str) -> Any:
        return getattr(self.current(), name)

    def __eq__(self, other: object) -> bool:
        try:
            return self.current() == Path(os.fspath(other))  # type: ignore[arg-type]
        except TypeError:
            return False

    def __hash__(self) -> int:
        return hash(self.current())


class _DynamicString:
    """String compatibility value that avoids import-time app identity binding."""

    def __init__(self, resolver: Callable[[], str]) -> None:
        self._resolver = resolver

    def current(self) -> str:
        return self._resolver()

    def __str__(self) -> str:
        return self.current()

    def __repr__(self) -> str:
        return repr(self.current())

    def __format__(self, specification: str) -> str:
        return format(self.current(), specification)

    def __getattr__(self, name: str) -> Any:
        return getattr(self.current(), name)

    def __eq__(self, other: object) -> bool:
        return self.current() == other

    def __hash__(self) -> int:
        return hash(self.current())


def _resolved_path(name: str) -> Path:
    return Path(os.fspath(globals()[name]))


def _app_identity() -> tuple[str, str]:
    current = context()
    fallback_name = current.config.project_name or "Project"
    fallback_slug = _slug(fallback_name).replace("-", ".")
    fallback = (fallback_name, f"local.{fallback_slug}")
    try:
        payload = json.loads(_resolved_path("TAURI_CONFIG").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback
    name = payload.get("productName")
    identifier = payload.get("identifier")
    return (
        name if isinstance(name, str) and name.strip() else fallback[0],
        identifier
        if isinstance(identifier, str) and identifier.strip()
        else fallback[1],
    )


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "project"


RESOURCES_DIR = _DynamicPath(lambda: context().resources.root)
STATE_DIR = _DynamicPath(lambda: context().state_root)
RUNTIME_DIR = _DynamicPath(lambda: context().runtime_root / "tauri")
VENV_DIR = _DynamicPath(lambda: context().venv_root)
FRONTEND_DIR = _DynamicPath(lambda: context().paths.frontend)
TAURI_DIR = _DynamicPath(lambda: context().paths.tauri)
DIST_DIR = _DynamicPath(lambda: context().project_root / ".dist" / "desktop")
FRONTEND_PACKAGE_JSON = _DynamicPath(
    lambda: _resolved_path("FRONTEND_DIR") / "package.json"
)
FRONTEND_PACKAGE_LOCK = _DynamicPath(
    lambda: _resolved_path("FRONTEND_DIR") / "package-lock.json"
)
FRONTEND_PNPM_LOCK = _DynamicPath(
    lambda: _resolved_path("FRONTEND_DIR") / "pnpm-lock.yaml"
)
TAURI_CONFIG = _DynamicPath(lambda: _resolved_path("TAURI_DIR") / "tauri.conf.json")


def app_name() -> str:
    current = globals().get("APP_NAME")
    if current is not None and not isinstance(current, _DynamicString):
        return str(current)
    return _app_identity()[0]


def app_id() -> str:
    current = globals().get("APP_ID")
    if current is not None and not isinstance(current, _DynamicString):
        return str(current)
    return _app_identity()[1]


def app_slug() -> str:
    current = globals().get("APP_SLUG")
    if current is not None and not isinstance(current, _DynamicString):
        return str(current)
    return _slug(app_name())


APP_NAME = _DynamicString(app_name)
APP_ID = _DynamicString(app_id)
APP_SLUG = _DynamicString(app_slug)


def local_tauri_binary() -> Path:
    binary_name = "tauri.cmd" if os.name == "nt" else "tauri"
    return _resolved_path("FRONTEND_DIR") / "node_modules" / ".bin" / binary_name


def bundle_roots() -> list[Path]:
    tauri_dir = _resolved_path("TAURI_DIR")
    roots = [tauri_dir / "target" / "release" / "bundle"]
    target_root = tauri_dir / "target"
    if target_root.exists():
        roots.extend(sorted(target_root.glob("*/release/bundle")))
    return roots
