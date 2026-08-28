"""Git preflight behaviour independent of unsafe inherited Git variables."""

from __future__ import annotations

import json
from pathlib import Path

from .conftest import run_control, snapshot


def test_inherited_git_directory_does_not_redirect_read_only_assessment(
    copied_project: Path,
) -> None:
    before = snapshot(copied_project)
    invalid_git_dir = copied_project / "not-a-git-directory"

    completed = run_control(
        copied_project,
        "integrate",
        "--check",
        "--json",
        environment={"GIT_DIR": str(invalid_git_dir)},
    )

    assert completed.returncode == 1
    assert completed.stderr == ""
    payload = json.loads(completed.stdout)
    assert payload["action"] == "integrate-check"
    assert payload["plan"]["conflicts"] == []
    assert snapshot(copied_project) == before
