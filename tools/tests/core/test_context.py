from __future__ import annotations

from pathlib import Path

import pytest

from tools.core.context import load_context
from tools.core.project_config import (
    ProjectConfig,
    ProjectConfigError,
    ProjectPathConfig,
    create_project_config,
    load_project_config,
    render_project_config,
)


def _copy_runtime_marker(project: Path, version: str = "0.1.0") -> Path:
    tools = project / "tools"
    tools.mkdir(parents=True)
    (tools / "VERSION").write_text(f"{version}\n", encoding="utf-8")
    return tools


def test_context_defaults_are_derived_from_copied_tools(tmp_path: Path) -> None:
    tools = _copy_runtime_marker(tmp_path)

    context = load_context(tools_root=tools)

    assert context.project_root == tmp_path
    assert context.tools_root == tools
    assert context.resources.profiles == tools / "resources" / "profiles"
    assert context.resources.config == tools / "resources" / "config"
    assert context.docs_root == tmp_path / "docs" / "toolingdocs"
    assert context.state_root == tmp_path / ".tooling-state"
    assert context.runtime_root == tmp_path / ".tooling-state" / "runtime"
    assert context.venv_root == tmp_path / ".tooling-state" / "venv"
    assert context.project_config == tmp_path / "project-tooling.toml"
    assert context.paths.frontend == tmp_path / "frontend"
    assert context.paths.backend is None
    assert context.paths.tauri == tmp_path / "src-tauri"
    assert not context.config_exists
    assert list(tmp_path.iterdir()) == [tools]


def test_context_loads_custom_project_paths(tmp_path: Path) -> None:
    tools = _copy_runtime_marker(tmp_path)
    config = ProjectConfig(
        tooling_version="0.1.0",
        project_name="Custom",
        profile="full-platform",
        paths=ProjectPathConfig(
            frontend="ui/client",
            backend="services/api",
            tauri="desktop/shell",
            docs="handbook",
        ),
        optional_features=("database", "postgres"),
    )
    create_project_config(tmp_path / "project-tooling.toml", config)

    context = load_context(tools_root=tools)

    assert context.config_exists
    assert context.paths.frontend == tmp_path / "ui" / "client"
    assert context.paths.backend == tmp_path / "services" / "api"
    assert context.paths.tauri == tmp_path / "desktop" / "shell"
    assert context.paths.docs == tmp_path / "handbook"
    assert context.docs_root == tmp_path / "handbook" / "toolingdocs"
    assert context.config.optional_features == ("database", "postgres")


def test_project_config_round_trips_deterministically(tmp_path: Path) -> None:
    config = ProjectConfig(
        tooling_version="0.1.0",
        project_name="Suno Documentation Manager",
        profile="desktop-local",
        paths=ProjectPathConfig(backend=""),
    )
    path = tmp_path / "project-tooling.toml"

    create_project_config(path, config)

    assert load_project_config(path) == config
    assert path.read_text(encoding="utf-8") == render_project_config(config)


def test_project_config_is_never_overwritten(tmp_path: Path) -> None:
    path = tmp_path / "project-tooling.toml"
    path.write_text("user-owned\n", encoding="utf-8")
    config = ProjectConfig("0.1.0", "Example", "web-only")

    with pytest.raises(ProjectConfigError, match="Refusing to overwrite"):
        create_project_config(path, config)

    assert path.read_text(encoding="utf-8") == "user-owned\n"


def test_project_config_reader_never_follows_a_symlink(tmp_path: Path) -> None:
    external = tmp_path.parent / f"{tmp_path.name}-external-config.toml"
    external.write_text(
        render_project_config(ProjectConfig("0.1.0", "External", "web-only")),
        encoding="utf-8",
    )
    linked = tmp_path / "project-tooling.toml"
    linked.symlink_to(external)

    with pytest.raises(ProjectConfigError, match="Could not read"):
        load_project_config(linked)


def test_context_never_follows_a_symlinked_version_file(tmp_path: Path) -> None:
    tools = tmp_path / "tools"
    tools.mkdir()
    external = tmp_path / "external-version"
    external.write_text("0.1.0\n", encoding="utf-8")
    (tools / "VERSION").symlink_to(external)

    with pytest.raises(ProjectConfigError, match="Could not read tooling version"):
        load_context(tools_root=tools)


@pytest.mark.parametrize(
    "unsafe",
    [
        "../outside",
        "/absolute",
        "C:\\outside",
        "nested/../../outside",
        "nested\\child",
    ],
)
def test_project_config_rejects_unsafe_paths(tmp_path: Path, unsafe: str) -> None:
    path = tmp_path / "project-tooling.toml"
    path.write_text(
        "\n".join(
            [
                "schema_version = 1",
                "[tooling]",
                'version = "0.1.0"',
                "[project]",
                'name = "Unsafe"',
                'profile = "web-only"',
                "[paths]",
                f'frontend = "{unsafe.replace(chr(92), chr(92) * 2)}"',
                'backend = ""',
                'tauri = "src-tauri"',
                'docs = "docs"',
                "[features]",
                "optional = []",
                "",
            ]
        ),
        encoding="utf-8",
    )

    with pytest.raises(ProjectConfigError):
        load_project_config(path)


def test_project_config_supports_product_markers_at_the_project_root(
    tmp_path: Path,
) -> None:
    tools = _copy_runtime_marker(tmp_path)
    config = ProjectConfig(
        "0.1.0",
        "Root application",
        "desktop-cloud",
        paths=ProjectPathConfig(frontend=".", backend=".", tauri="."),
    )
    create_project_config(tmp_path / "project-tooling.toml", config)

    context = load_context(tools_root=tools)

    assert context.paths.frontend == tmp_path
    assert context.paths.backend == tmp_path
    assert context.paths.tauri == tmp_path


def test_existing_symlink_path_cannot_escape_project(tmp_path: Path) -> None:
    tools = _copy_runtime_marker(tmp_path)
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (tmp_path / "frontend").symlink_to(outside, target_is_directory=True)

    with pytest.raises(ProjectConfigError, match="escapes project root"):
        load_context(tools_root=tools)


@pytest.mark.parametrize(
    "relative", [".tooling-state", ".tooling-state/runtime", ".tooling-state/venv"]
)
def test_state_and_runtime_symlinks_are_rejected(tmp_path: Path, relative: str) -> None:
    tools = _copy_runtime_marker(tmp_path)
    outside = tmp_path.parent / f"{tmp_path.name}-{relative.replace('/', '-')}"
    outside.mkdir()
    link = tmp_path / relative
    link.parent.mkdir(parents=True, exist_ok=True)
    link.symlink_to(outside, target_is_directory=True)

    with pytest.raises(ProjectConfigError, match="Refusing symlinked"):
        load_context(tools_root=tools)

    assert list(outside.iterdir()) == []
