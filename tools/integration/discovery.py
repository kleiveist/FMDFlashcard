"""Bounded, no-follow discovery of product technologies and project paths.

Discovery is deliberately independent from ``project-tooling.toml``.  It
describes filesystem evidence only; the integration service remains
responsible for giving an existing project-owned configuration precedence.
No function in this module creates, updates, or removes filesystem entries.
"""

from __future__ import annotations

import ast
import json
import os
import re
import stat
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum
from pathlib import Path, PurePosixPath

import tomllib

from tools.core.filesystem import (
    FilesystemSafetyError,
    safe_join,
    safe_relative_path,
    validate_root,
)

DEFAULT_MAX_DEPTH = 6
DEFAULT_MAX_ENTRIES = 4096
MAX_MARKER_BYTES = 1024 * 1024
_SUPPORTS_DIRECTORY_FILE_DESCRIPTORS = os.name != "nt"

_VITE_CONFIG_NAMES = frozenset(
    {
        "vite.config.cjs",
        "vite.config.cts",
        "vite.config.js",
        "vite.config.mjs",
        "vite.config.mts",
        "vite.config.ts",
    }
)
_TAURI_CONFIG_NAMES = frozenset(
    {"tauri.conf.json", "tauri.conf.json5", "tauri.conf.toml", "tauri.toml"}
)
_COMPOSE_NAMES = frozenset(
    {"compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"}
)
_EXCLUDED_DIRECTORIES = frozenset(
    {
        ".git",
        ".hg",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
        ".svn",
        ".tooling-state",
        ".venv",
        "__pycache__",
        "build",
        "coverage",
        "dist",
        "docs",
        "node_modules",
        "target",
        "tools",
        "vendor",
        "venv",
    }
)
_REQUIREMENTS_NAME = re.compile(r"requirements(?:[-_.][a-z0-9_.-]+)?\.txt\Z")
_FASTAPI_SPEC = re.compile(
    r"^fastapi(?:\[[a-z0-9_,. -]+\])?(?:\s*(?:[<>=!~^@;]|\Z))",
    re.IGNORECASE,
)
_COMPOSE_SERVICES = re.compile(r"(?m)^[ \t]*services[ \t]*:")


class DiscoveryError(RuntimeError):
    """Raised when a project cannot be inspected within the safety bounds."""


class Confidence(str, Enum):
    """Stable confidence labels suitable for human and JSON output."""

    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True, slots=True)
class DetectionEvidence:
    """Selected root and concrete marker files for one technology."""

    technology: str
    path: str
    markers: tuple[str, ...]
    confidence: Confidence
    alternatives: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class DiscoveredPaths:
    """Project-relative product roots inferred from marker evidence."""

    frontend: str | None = None
    backend: str | None = None
    tauri: str | None = None
    container: str | None = None


@dataclass(frozen=True, slots=True)
class ProfileInference:
    """One conservative built-in profile suggestion."""

    profile_id: str | None
    confidence: Confidence
    reason: str


@dataclass(frozen=True, slots=True)
class ProjectDiscovery:
    """Complete deterministic result of one read-only project scan."""

    project_root: Path
    project_name: str
    frontend: DetectionEvidence | None
    backend: DetectionEvidence | None
    tauri: DetectionEvidence | None
    container: DetectionEvidence | None
    suggested_profile: str | None
    confidence: Confidence
    profile_reason: str
    scanned_entries: int

    @property
    def paths(self) -> DiscoveredPaths:
        return DiscoveredPaths(
            frontend=self.frontend.path if self.frontend is not None else None,
            backend=self.backend.path if self.backend is not None else None,
            tauri=self.tauri.path if self.tauri is not None else None,
            container=self.container.path if self.container is not None else None,
        )

    @property
    def evidence(self) -> tuple[DetectionEvidence, ...]:
        return tuple(
            item
            for item in (self.frontend, self.backend, self.tauri, self.container)
            if item is not None
        )

    @property
    def has_product_evidence(self) -> bool:
        return bool(self.evidence)


@dataclass(frozen=True, slots=True)
class _Candidate:
    path: str
    markers: tuple[str, ...]
    score: int
    confidence: Confidence


@dataclass(frozen=True, slots=True)
class _MarkerIndex:
    paths: tuple[str, ...]
    scanned_entries: int

    def named(self, names: frozenset[str]) -> tuple[str, ...]:
        return tuple(
            path for path in self.paths if PurePosixPath(path).name.casefold() in names
        )


def discover_project(
    project_root: Path,
    *,
    max_depth: int = DEFAULT_MAX_DEPTH,
    max_entries: int = DEFAULT_MAX_ENTRIES,
) -> ProjectDiscovery:
    """Inspect a project without following symlinks or writing any state.

    The scan visits at most ``max_entries`` directory entries and descends at
    most ``max_depth`` directories beneath the project root.  Known tooling,
    documentation, dependency, cache, and build trees are excluded so their
    examples or generated manifests cannot masquerade as product evidence.
    """

    if isinstance(max_depth, bool) or not isinstance(max_depth, int) or max_depth < 0:
        raise ValueError("max_depth must be a non-negative integer")
    if (
        isinstance(max_entries, bool)
        or not isinstance(max_entries, int)
        or max_entries <= 0
    ):
        raise ValueError("max_entries must be a positive integer")

    try:
        root = validate_root(project_root)
        index = _scan_markers(
            root,
            max_depth=max_depth,
            max_entries=max_entries,
        )
    except FilesystemSafetyError as exc:
        raise DiscoveryError(str(exc)) from exc

    frontend = _discover_frontend(root, index)
    backend = _discover_backend(root, index)
    tauri = _discover_tauri(index)
    container = _discover_container(root, index)
    inference = infer_profile(
        frontend=frontend is not None,
        backend=backend is not None,
        tauri=tauri is not None,
        container=container is not None,
    )
    confidence = _minimum_confidence(
        inference.confidence,
        *(item.confidence for item in (frontend, backend, tauri, container) if item),
    )
    return ProjectDiscovery(
        project_root=root,
        project_name=root.name or "Project",
        frontend=frontend,
        backend=backend,
        tauri=tauri,
        container=container,
        suggested_profile=inference.profile_id,
        confidence=confidence,
        profile_reason=inference.reason,
        scanned_entries=index.scanned_entries,
    )


def infer_profile(
    *,
    frontend: bool,
    backend: bool,
    tauri: bool,
    container: bool,
) -> ProfileInference:
    """Map technology evidence to the closest safe built-in profile.

    ``full-platform`` intentionally is never inferred.  Its feature set is
    indistinguishable from ``desktop-cloud`` on disk, so it must remain an
    explicit, persisted project decision.
    """

    if tauri and backend:
        confidence = Confidence.MEDIUM if frontend else Confidence.LOW
        return ProfileInference(
            "desktop-cloud",
            confidence,
            (
                "Tauri and FastAPI evidence require the desktop cloud feature set; "
                "full-platform remains an explicit configuration choice."
            ),
        )
    if tauri:
        return ProfileInference(
            "desktop-local",
            Confidence.HIGH if frontend else Confidence.MEDIUM,
            "Tauri evidence maps to the local desktop profile.",
        )
    if backend:
        return ProfileInference(
            "web-cloud",
            Confidence.HIGH if frontend and container else Confidence.MEDIUM,
            "FastAPI evidence maps to the web cloud profile.",
        )
    if frontend:
        if container:
            return ProfileInference(
                "web-cloud",
                Confidence.LOW,
                "Vite and container evidence suggest cloud intent without a backend.",
            )
        return ProfileInference(
            "web-only",
            Confidence.HIGH,
            "Vite evidence maps to the browser-only profile.",
        )
    if container:
        return ProfileInference(
            "web-cloud",
            Confidence.LOW,
            "Container evidence suggests cloud intent without product markers.",
        )
    return ProfileInference(
        None,
        Confidence.NONE,
        "No supported product technology was detected.",
    )


def _scan_markers(
    root: Path,
    *,
    max_depth: int,
    max_entries: int,
) -> _MarkerIndex:
    queue: deque[tuple[tuple[str, ...], int]] = deque([((), 0)])
    marker_paths: list[str] = []
    scanned_entries = 0

    while queue:
        parts, depth = queue.popleft()
        directory = (
            root if not parts else safe_join(root, "/".join(parts), require_exists=True)
        )
        entries = _directory_entries(
            directory,
            remaining=max_entries - scanned_entries,
            total_limit=max_entries,
        )
        scanned_entries += len(entries)
        if scanned_entries > max_entries:
            raise DiscoveryError(
                f"Project discovery exceeded its {max_entries}-entry safety limit."
            )

        for name, mode in entries:
            relative_parts = (*parts, name)
            if stat.S_ISLNK(mode):
                continue
            if stat.S_ISDIR(mode):
                if depth < max_depth and not _excluded_directory(name):
                    try:
                        safe_relative_path("/".join(relative_parts))
                    except FilesystemSafetyError:
                        continue
                    queue.append((relative_parts, depth + 1))
                continue
            if not stat.S_ISREG(mode) or not _is_marker_name(name):
                continue
            relative = "/".join(relative_parts)
            try:
                marker_paths.append(safe_relative_path(relative))
            except FilesystemSafetyError:
                continue

    return _MarkerIndex(tuple(sorted(marker_paths)), scanned_entries)


def _directory_entries(
    directory: Path,
    *,
    remaining: int,
    total_limit: int,
) -> tuple[tuple[str, int], ...]:
    def collect(iterator: os.ScandirIterator[str]) -> tuple[tuple[str, int], ...]:
        entries: list[tuple[str, int]] = []
        for entry in iterator:
            if len(entries) >= remaining:
                raise DiscoveryError(
                    f"Project discovery exceeded its {total_limit}-entry safety limit."
                )
            try:
                mode = entry.stat(follow_symlinks=False).st_mode
            except OSError:
                continue
            entries.append((entry.name, mode))
        return tuple(sorted(entries, key=lambda item: (item[0].casefold(), item[0])))

    if not _SUPPORTS_DIRECTORY_FILE_DESCRIPTORS:
        try:
            metadata = directory.lstat()
            if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
                raise FilesystemSafetyError(
                    f"Could not inspect project directory safely: {directory}."
                )
            with os.scandir(directory) as iterator:
                return collect(iterator)
        except OSError as exc:
            raise FilesystemSafetyError(
                f"Could not inspect project directory safely: {directory}."
            ) from exc

    flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    descriptor: int | None = None
    try:
        descriptor = os.open(directory, flags)
        with os.scandir(descriptor) as iterator:
            return collect(iterator)
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Could not inspect project directory safely: {directory}."
        ) from exc
    finally:
        if descriptor is not None:
            os.close(descriptor)


def _excluded_directory(name: str) -> bool:
    folded = name.casefold()
    return folded.startswith(".") or folded in _EXCLUDED_DIRECTORIES


def _is_marker_name(name: str) -> bool:
    folded = name.casefold()
    return (
        folded == "package.json"
        or folded in _VITE_CONFIG_NAMES
        or folded == "main.py"
        or folded == "pyproject.toml"
        or _REQUIREMENTS_NAME.fullmatch(folded) is not None
        or folded == "cargo.toml"
        or folded in _TAURI_CONFIG_NAMES
        or folded in _COMPOSE_NAMES
    )


def _discover_frontend(root: Path, index: _MarkerIndex) -> DetectionEvidence | None:
    by_root: dict[str, list[str]] = defaultdict(list)
    package_evidence: dict[str, tuple[bool, bool]] = {}
    for path in index.named(frozenset({"package.json"})):
        text = _read_marker_text(root, path)
        dependency, script = _vite_package_evidence(text)
        if dependency or script:
            package_root = _parent(path)
            by_root[package_root].append(path)
            package_evidence[package_root] = (dependency, script)
    for path in index.named(_VITE_CONFIG_NAMES):
        by_root[_parent(path)].append(path)

    candidates: list[_Candidate] = []
    for path, markers in by_root.items():
        dependency, script = package_evidence.get(path, (False, False))
        has_config = any(
            PurePosixPath(marker).name.casefold() in _VITE_CONFIG_NAMES
            for marker in markers
        )
        score = (
            (50 if dependency else 0)
            + (40 if script else 0)
            + (30 if has_config else 0)
        )
        confidence = (
            Confidence.HIGH
            if dependency or (script and has_config)
            else Confidence.MEDIUM
        )
        candidates.append(
            _Candidate(path, tuple(sorted(set(markers))), score, confidence)
        )
    return _select("frontend", candidates)


def _vite_package_evidence(text: str | None) -> tuple[bool, bool]:
    if text is None:
        return False, False
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return False, False
    if not isinstance(payload, dict):
        return False, False
    dependency = any(
        isinstance(table, dict)
        and isinstance(table.get("vite"), str)
        and bool(table["vite"].strip())
        for table in (payload.get("dependencies"), payload.get("devDependencies"))
    )
    scripts = payload.get("scripts")
    script = isinstance(scripts, dict) and any(
        isinstance(command, str)
        and re.search(r"^\s*vite(?:\s|\Z)", command) is not None
        for command in scripts.values()
    )
    return dependency, script


def _discover_backend(root: Path, index: _MarkerIndex) -> DetectionEvidence | None:
    pyprojects = set(index.named(frozenset({"pyproject.toml"})))
    requirements = tuple(
        path
        for path in index.paths
        if _REQUIREMENTS_NAME.fullmatch(PurePosixPath(path).name.casefold())
    )
    candidates: list[_Candidate] = []
    for source_path in index.named(frozenset({"main.py"})):
        source = _read_marker_text(root, source_path)
        if source is None or not _has_fastapi_application(source):
            continue
        source_parent = _parent(source_path)
        backend_root = (
            _parent(source_parent) if _name(source_parent) == "app" else source_parent
        )
        dependency_paths: list[str] = []
        pyproject = _child(backend_root, "pyproject.toml")
        if pyproject in pyprojects and _pyproject_has_fastapi(
            _read_marker_text(root, pyproject)
        ):
            dependency_paths.append(pyproject)
        for requirement in requirements:
            requirement_parent = _parent(requirement)
            in_requirement_directory = (
                _parent(requirement_parent) == backend_root
                and _name(requirement_parent) == "requirements"
            )
            if requirement_parent != backend_root and not in_requirement_directory:
                continue
            if _requirements_has_fastapi(_read_marker_text(root, requirement)):
                dependency_paths.append(requirement)
        if not dependency_paths:
            continue
        markers = tuple(sorted({source_path, *dependency_paths}))
        score = 70 + (10 if len(dependency_paths) > 1 else 0)
        candidates.append(_Candidate(backend_root, markers, score, Confidence.HIGH))
    return _select("backend", candidates)


def _has_fastapi_application(source: str) -> bool:
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return False
    constructor_aliases: set[str] = set()
    module_aliases: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for item in node.names:
                if item.name == "fastapi":
                    module_aliases.add(item.asname or "fastapi")
        elif isinstance(node, ast.ImportFrom) and node.module == "fastapi":
            for item in node.names:
                if item.name == "FastAPI":
                    constructor_aliases.add(item.asname or "FastAPI")
    if not constructor_aliases and not module_aliases:
        return False
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if isinstance(function, ast.Name) and function.id in constructor_aliases:
            return True
        if (
            isinstance(function, ast.Attribute)
            and function.attr == "FastAPI"
            and isinstance(function.value, ast.Name)
            and function.value.id in module_aliases
        ):
            return True
    return False


def _requirements_has_fastapi(text: str | None) -> bool:
    if text is None:
        return False
    return any(
        _is_fastapi_spec(line.split("#", maxsplit=1)[0].strip())
        for line in text.splitlines()
    )


def _pyproject_has_fastapi(text: str | None) -> bool:
    if text is None:
        return False
    try:
        payload = tomllib.loads(text)
    except tomllib.TOMLDecodeError:
        return False

    project = payload.get("project")
    if isinstance(project, dict):
        if _dependency_list_has_fastapi(project.get("dependencies")):
            return True
        optional = project.get("optional-dependencies")
        if isinstance(optional, dict) and any(
            _dependency_list_has_fastapi(group) for group in optional.values()
        ):
            return True
    groups = payload.get("dependency-groups")
    if isinstance(groups, dict) and any(
        _dependency_list_has_fastapi(group) for group in groups.values()
    ):
        return True
    tool = payload.get("tool")
    if not isinstance(tool, dict):
        return False
    poetry = tool.get("poetry")
    if isinstance(poetry, dict):
        if _dependency_mapping_has_fastapi(poetry.get("dependencies")):
            return True
        poetry_groups = poetry.get("group")
        if isinstance(poetry_groups, dict) and any(
            isinstance(group, dict)
            and _dependency_mapping_has_fastapi(group.get("dependencies"))
            for group in poetry_groups.values()
        ):
            return True
    pdm = tool.get("pdm")
    return isinstance(pdm, dict) and (
        _dependency_list_has_fastapi(pdm.get("dependencies"))
        or _dependency_mapping_has_fastapi(pdm.get("dependencies"))
    )


def _dependency_list_has_fastapi(value: object) -> bool:
    return isinstance(value, list) and any(
        isinstance(item, str) and _is_fastapi_spec(item) for item in value
    )


def _dependency_mapping_has_fastapi(value: object) -> bool:
    return isinstance(value, dict) and any(
        isinstance(key, str) and key.casefold() == "fastapi" for key in value
    )


def _is_fastapi_spec(value: str) -> bool:
    return bool(value) and _FASTAPI_SPEC.match(value) is not None


def _discover_tauri(index: _MarkerIndex) -> DetectionEvidence | None:
    cargo_roots = {
        _parent(path): path for path in index.named(frozenset({"cargo.toml"}))
    }
    candidates: list[_Candidate] = []
    for config in index.named(_TAURI_CONFIG_NAMES):
        path = _parent(config)
        cargo = cargo_roots.get(path)
        if cargo is None:
            continue
        candidates.append(
            _Candidate(path, tuple(sorted((cargo, config))), 70, Confidence.HIGH)
        )
    return _select("tauri", candidates)


def _discover_container(root: Path, index: _MarkerIndex) -> DetectionEvidence | None:
    candidates: list[_Candidate] = []
    for compose in index.named(_COMPOSE_NAMES):
        text = _read_marker_text(root, compose)
        if text is None or _COMPOSE_SERVICES.search(text) is None:
            continue
        candidates.append(
            _Candidate(_parent(compose), (compose,), 40, Confidence.MEDIUM)
        )
    return _select("container", candidates)


def _select(
    technology: str,
    candidates: list[_Candidate],
) -> DetectionEvidence | None:
    if not candidates:
        return None
    by_path: dict[str, _Candidate] = {}
    for candidate in candidates:
        previous = by_path.get(candidate.path)
        if previous is None:
            by_path[candidate.path] = candidate
            continue
        preferred = candidate if candidate.score > previous.score else previous
        by_path[candidate.path] = _Candidate(
            path=candidate.path,
            markers=tuple(sorted({*previous.markers, *candidate.markers})),
            score=max(previous.score, candidate.score),
            confidence=preferred.confidence,
        )
    ordered = sorted(
        by_path.values(),
        key=lambda item: (
            -item.score,
            len(PurePosixPath(item.path).parts),
            item.path.casefold(),
            item.path,
        ),
    )
    selected = ordered[0]
    alternatives = tuple(
        sorted({item.path for item in ordered[1:] if item.path != selected.path})
    )
    confidence = selected.confidence
    if any(item.score == selected.score for item in ordered[1:]):
        confidence = Confidence.LOW
    return DetectionEvidence(
        technology=technology,
        path=selected.path,
        markers=selected.markers,
        confidence=confidence,
        alternatives=alternatives,
    )


def _minimum_confidence(first: Confidence, *rest: Confidence) -> Confidence:
    order = {
        Confidence.NONE: 0,
        Confidence.LOW: 1,
        Confidence.MEDIUM: 2,
        Confidence.HIGH: 3,
    }
    return min((first, *rest), key=order.__getitem__)


def _read_marker_text(root: Path, relative: str) -> str | None:
    descriptor: int | None = None
    try:
        target = safe_join(root, relative, require_exists=True)
        before = target.lstat()
        if not stat.S_ISREG(before.st_mode) or before.st_size > MAX_MARKER_BYTES:
            return None
        flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(target, flags)
        opened = os.fstat(descriptor)
        if (
            not stat.S_ISREG(opened.st_mode)
            or (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino)
            or opened.st_size > MAX_MARKER_BYTES
        ):
            return None
        chunks: list[bytes] = []
        remaining = MAX_MARKER_BYTES + 1
        while remaining:
            chunk = os.read(descriptor, min(65536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        payload = b"".join(chunks)
        if len(payload) > MAX_MARKER_BYTES:
            return None
        return payload.decode("utf-8")
    except (FilesystemSafetyError, OSError, UnicodeError):
        return None
    finally:
        if descriptor is not None:
            os.close(descriptor)


def _parent(path: str) -> str:
    return PurePosixPath(path).parent.as_posix()


def _name(path: str) -> str:
    return PurePosixPath(path).name.casefold()


def _child(parent: str, name: str) -> str:
    return name if parent == "." else f"{parent}/{name}"


__all__ = [
    "DEFAULT_MAX_DEPTH",
    "DEFAULT_MAX_ENTRIES",
    "Confidence",
    "DetectionEvidence",
    "DiscoveredPaths",
    "DiscoveryError",
    "ProfileInference",
    "ProjectDiscovery",
    "discover_project",
    "infer_profile",
]
