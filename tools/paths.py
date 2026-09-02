"""Canonical repository paths and filesystem boundary checks."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class PathSafetyError(ValueError):
    """Raised when a tooling path leaves its declared repository boundary."""


@dataclass(frozen=True, slots=True)
class ProjectPaths:
    root: Path
    tools: Path
    desktop: Path
    tauri: Path
    reports: Path
    dist: Path
    state: Path
    runtime: Path
    version_file: Path
    release_matrix: Path

    @property
    def package_json(self) -> Path:
        return self.desktop / "package.json"

    @property
    def pnpm_lock(self) -> Path:
        return self.desktop / "pnpm-lock.yaml"

    @property
    def cargo_manifest(self) -> Path:
        return self.tauri / "Cargo.toml"

    @property
    def cargo_lock(self) -> Path:
        return self.tauri / "Cargo.lock"

    @property
    def tauri_config(self) -> Path:
        return self.tauri / "tauri.conf.json"

    @property
    def docs(self) -> Path:
        return self.root / "docs"

    @property
    def workflows(self) -> Path:
        return self.root / ".github" / "workflows"

    @property
    def mkdocs(self) -> Path:
        return self.root / "mkdocs.yml"

    @property
    def changelog(self) -> Path:
        return self.root / "CHANGELOG.md"


def repository_root() -> Path:
    """Resolve the checkout from this file, independently of the current directory."""

    return Path(__file__).resolve().parents[1]


def project_paths(root: Path | None = None) -> ProjectPaths:
    selected = Path(root or repository_root()).resolve(strict=True)
    tools = selected / "tools"
    desktop = selected / "apps" / "fmd-desktop"
    state = selected / ".tooling-state"
    return ProjectPaths(
        root=selected,
        tools=tools,
        desktop=desktop,
        tauri=desktop / "src-tauri",
        reports=selected / ".reports",
        dist=selected / ".dist",
        state=state,
        runtime=state / "runtime",
        version_file=selected / "VERSION",
        release_matrix=selected / "tools" / "release-matrix.json",
    )


def require_within(root: Path, candidate: Path, *, label: str = "path") -> Path:
    """Return an absolute path beneath ``root`` without following a final symlink."""

    boundary = Path(root).resolve(strict=True)
    absolute = Path(os.path.abspath(candidate))
    try:
        relative = absolute.relative_to(boundary)
    except ValueError as exc:
        raise PathSafetyError(f"{label} is outside the repository: {candidate}") from exc

    current = boundary
    for part in relative.parts[:-1]:
        current /= part
        if current.is_symlink():
            raise PathSafetyError(f"{label} contains a symbolic-link ancestor: {current}")
    return absolute


def ensure_within(candidate: Path, root: Path, *, label: str = "path") -> Path:
    """Compatibility spelling with candidate-first argument order."""

    return require_within(root, candidate, label=label)


def relative_to_root(candidate: Path, paths: ProjectPaths | None = None) -> str:
    selected = paths or project_paths()
    guarded = require_within(selected.root, candidate)
    return guarded.relative_to(selected.root).as_posix()
