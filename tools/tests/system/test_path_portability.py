"""Project configuration rejects platform-specific or escaping path forms."""

from __future__ import annotations

from pathlib import Path

import pytest

from tools.core.context import load_context
from tools.core.project_config import ProjectConfigError


@pytest.mark.parametrize(
    "frontend",
    ("../outside", "C:/outside", "folder\\child", "folder/../../outside"),
)
def test_portable_context_rejects_nonportable_configured_paths(
    tmp_path: Path,
    frontend: str,
) -> None:
    tools = tmp_path / "tools"
    tools.mkdir()
    (tools / "VERSION").write_text("0.4.0\n", encoding="utf-8")
    escaped_frontend = frontend.replace("\\", "\\\\")
    (tmp_path / "project-tooling.toml").write_text(
        "\n".join(
            (
                "schema_version = 1",
                "",
                "[tooling]",
                'version = "0.4.0"',
                "",
                "[project]",
                'name = "Portable path fixture"',
                'profile = "web-only"',
                "",
                "[paths]",
                f'frontend = "{escaped_frontend}"',
                'backend = ""',
                'tauri = "src-tauri"',
                'docs = "docs"',
                "",
                "[features]",
                "optional = []",
                "",
            )
        ),
        encoding="utf-8",
    )

    with pytest.raises(ProjectConfigError):
        load_context(tmp_path, tools_root=tools)
