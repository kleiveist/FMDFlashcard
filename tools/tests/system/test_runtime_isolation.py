"""The copied runtime must not create Python cache state under ``tools/``."""

from __future__ import annotations

from pathlib import Path

from .conftest import run_control, snapshot


def test_cli_startup_leaves_the_portable_payload_byte_identical(
    copied_project: Path,
) -> None:
    before = snapshot(copied_project)

    help_result = run_control(copied_project, "--help")
    check_result = run_control(copied_project, "integrate", "--check", "--json")

    assert help_result.returncode == 0
    assert check_result.returncode == 1
    assert not tuple((copied_project / "tools").rglob("__pycache__"))
    assert not tuple((copied_project / "tools").rglob(".pytest_cache"))
    assert snapshot(copied_project) == before
