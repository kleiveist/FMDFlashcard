from __future__ import annotations

import argparse
from pathlib import Path

from tools.commands.quality import _commands
from tools.paths import project_paths

ROOT = Path(__file__).resolve().parents[2]


def test_python_quality_covers_tooling_and_ci_release_scripts() -> None:
    arguments = argparse.Namespace(quality_command="check", fix=False, release=False)
    commands = {name: command for name, command, _ in _commands(arguments, project_paths(ROOT))}

    for name in ("python-lint", "python-format"):
        assert commands[name][-2:] == ["tools", ".github/scripts"]
