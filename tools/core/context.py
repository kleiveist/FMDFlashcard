"""One portable source of truth for tooling and project filesystem paths."""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path

from tools.core.filesystem import (
    FilesystemSafetyError,
    read_regular_text,
    validate_root,
)
from tools.core.project_config import (
    ProjectConfig,
    ProjectConfigError,
    default_project_config,
    load_project_config,
)

TOOLS_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = TOOLS_ROOT.parent
RESOURCES_ROOT = TOOLS_ROOT / "resources"
DOCS_ROOT = PROJECT_ROOT / "docs" / "toolingdocs"
STATE_ROOT = PROJECT_ROOT / ".tooling-state"
PROJECT_CONFIG = PROJECT_ROOT / "project-tooling.toml"


@dataclass(frozen=True)
class ResourcePaths:
    root: Path
    profiles: Path
    config: Path
    examples: Path


@dataclass(frozen=True)
class ProjectPaths:
    frontend: Path
    backend: Path | None
    tauri: Path
    docs: Path


@dataclass(frozen=True)
class ProjectContext:
    """Resolved paths and persistent configuration for one target project."""

    tools_root: Path
    project_root: Path
    resources: ResourcePaths
    docs_root: Path
    state_root: Path
    project_config: Path
    runtime_root: Path
    venv_root: Path
    paths: ProjectPaths
    config: ProjectConfig
    config_exists: bool

    @property
    def tooling_version(self) -> str:
        return self.config.tooling_version

    def with_config(
        self, config: ProjectConfig, *, exists: bool | None = None
    ) -> ProjectContext:
        """Return the same filesystem context resolved against another safe config."""

        resolved = _project_paths(self.project_root, config)
        return replace(
            self,
            config=config,
            paths=resolved,
            docs_root=resolved.docs / "toolingdocs",
            config_exists=self.config_exists if exists is None else exists,
        )


def _read_tooling_version(tools_root: Path) -> str:
    version_path = tools_root / "VERSION"
    try:
        value = read_regular_text(
            version_path,
            root=tools_root,
            label="Tooling version",
        ).strip()
    except (FilesystemSafetyError, OSError) as exc:
        raise ProjectConfigError(
            f"Could not read tooling version: {version_path}"
        ) from exc
    if not value:
        raise ProjectConfigError(f"Tooling version is empty: {version_path}")
    return value


def _within_project(project_root: Path, relative: str) -> Path:
    candidate = project_root / relative
    resolved = candidate.resolve(strict=False)
    try:
        resolved.relative_to(project_root)
    except ValueError as exc:
        raise ProjectConfigError(
            f"Configured path escapes project root: {relative!r}"
        ) from exc
    return candidate


def _project_paths(project_root: Path, config: ProjectConfig) -> ProjectPaths:
    path_config = config.paths
    return ProjectPaths(
        frontend=_within_project(project_root, path_config.frontend),
        backend=_within_project(project_root, path_config.backend)
        if path_config.backend
        else None,
        tauri=_within_project(project_root, path_config.tauri),
        docs=_within_project(project_root, path_config.docs),
    )


def _validate_state_path(project_root: Path, path: Path, *, label: str) -> None:
    """Reject state locations that could redirect writes outside the project."""

    if path.is_symlink():
        raise ProjectConfigError(f"Refusing symlinked {label}: {path}")
    if not path.exists():
        return
    try:
        path.resolve(strict=True).relative_to(project_root)
    except (OSError, ValueError) as exc:
        raise ProjectConfigError(f"{label} escapes project root: {path}") from exc


def load_context(
    project_root: Path | None = None,
    *,
    tools_root: Path | None = None,
    config: ProjectConfig | None = None,
) -> ProjectContext:
    """Resolve a context without creating configuration, state, logs, or caches."""

    try:
        resolved_tools = validate_root(Path(tools_root or TOOLS_ROOT).absolute())
        resolved_project = validate_root(
            Path(project_root or resolved_tools.parent).absolute()
        )
    except FilesystemSafetyError as exc:
        raise ProjectConfigError(str(exc)) from exc
    config_path = resolved_project / "project-tooling.toml"
    try:
        config_path.lstat()
    except FileNotFoundError:
        config_exists = False
    except OSError as exc:
        raise ProjectConfigError(
            f"Could not inspect project configuration: {config_path}"
        ) from exc
    else:
        config_exists = True
    if config is None:
        config = (
            load_project_config(config_path)
            if config_exists
            else default_project_config(
                resolved_project,
                tooling_version=_read_tooling_version(resolved_tools),
            )
        )
    paths = _project_paths(resolved_project, config)
    resources_root = resolved_tools / "resources"
    resources = ResourcePaths(
        root=resources_root,
        profiles=resources_root / "profiles",
        config=resources_root / "config",
        examples=resources_root / "examples",
    )
    state_root = resolved_project / ".tooling-state"
    runtime_root = state_root / "runtime"
    venv_root = state_root / "venv"
    _validate_state_path(resolved_project, state_root, label="tooling state root")
    _validate_state_path(resolved_project, runtime_root, label="tooling runtime root")
    _validate_state_path(
        resolved_project, venv_root, label="tooling virtual environment"
    )
    return ProjectContext(
        tools_root=resolved_tools,
        project_root=resolved_project,
        resources=resources,
        docs_root=paths.docs / "toolingdocs",
        state_root=state_root,
        project_config=config_path,
        runtime_root=runtime_root,
        venv_root=venv_root,
        paths=paths,
        config=config,
        config_exists=config_exists,
    )


def default_context() -> ProjectContext:
    """Return the context of the project containing this copied ``tools/`` directory."""

    return load_context()
