"""CLI invocation checks that run against a copied, independent payload."""

from __future__ import annotations

import json
from pathlib import Path

from .conftest import run_control, snapshot


def _result(completed) -> dict[str, object]:
    assert completed.stderr == ""
    payload = json.loads(completed.stdout)
    assert isinstance(payload, dict)
    return payload


def test_check_is_stable_json_and_byte_exactly_read_only(copied_project: Path) -> None:
    before = snapshot(copied_project)

    completed = run_control(copied_project, "integrate", "--check", "--json")

    assert completed.returncode == 1
    payload = _result(completed)
    assert payload["action"] == "integrate-check"
    assert payload["status"] == "FIX_REQUIRED"
    assert payload["plan"]["required_changes"] > 0
    assert snapshot(copied_project) == before


def test_entry_point_resolves_the_copied_project_when_called_from_subdirectory(
    copied_project: Path,
) -> None:
    subdirectory = copied_project / "customer files" / "unterverzeichnis"
    subdirectory.mkdir(parents=True)
    before = snapshot(copied_project)

    completed = run_control(
        copied_project,
        "integrate",
        "--check",
        "--json",
        cwd=subdirectory,
    )

    assert completed.returncode == 1
    payload = _result(completed)
    assert payload["project_root"] == str(copied_project)
    assert snapshot(copied_project) == before
