from __future__ import annotations

from pathlib import Path

import pytest

from tools.core.context import ProjectContext, load_context
from tools.core.project_config import ProjectConfig, ProjectPathConfig


@pytest.fixture
def adapter_context(tmp_path: Path) -> ProjectContext:
    tools_root = tmp_path / "tools"
    (tools_root / "quality").mkdir(parents=True)
    (tools_root / "tests").mkdir()
    (tools_root / "VERSION").write_text("0.1.0\n", encoding="utf-8")
    (tmp_path / "handbook" / "toolingdocs").mkdir(parents=True)
    config = ProjectConfig(
        tooling_version="0.1.0",
        project_name="Adapter Fixture",
        profile="web-only",
        paths=ProjectPathConfig(
            frontend="ui",
            backend="services/api",
            tauri="desktop/shell",
            docs="handbook",
        ),
    )
    return load_context(tmp_path, tools_root=tools_root, config=config)
