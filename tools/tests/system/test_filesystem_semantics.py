"""Read-only filesystem guarantees exercised on a copied project tree."""

from __future__ import annotations

import json
from pathlib import Path

from .conftest import run_control, snapshot


def _json(completed) -> dict[str, object]:
    assert completed.stderr == ""
    payload = json.loads(completed.stdout)
    assert isinstance(payload, dict)
    return payload


def test_check_and_verify_never_create_state_reports_or_caches(
    copied_project: Path,
) -> None:
    before = snapshot(copied_project)

    checked = run_control(copied_project, "integrate", "--check", "--json")
    verified = run_control(copied_project, "tooling", "verify", "--json")

    assert checked.returncode == 1
    assert verified.returncode == 1
    assert _json(checked)["action"] == "integrate-check"
    assert _json(verified)["action"] == "tooling-verify"
    assert not (copied_project / ".tooling-state").exists()
    assert not tuple(copied_project.rglob("__pycache__"))
    assert not tuple(copied_project.rglob(".pytest_cache"))
    assert snapshot(copied_project) == before


def test_absolute_entry_point_works_in_a_project_path_with_spaces_and_unicode(
    copied_project: Path,
) -> None:
    before = snapshot(copied_project)

    completed = run_control(copied_project, "integrate", "--check", "--json")

    assert completed.returncode == 1
    payload = _json(completed)
    assert payload["project_root"] == str(copied_project)
    assert "Ünicode" in str(copied_project)
    assert snapshot(copied_project) == before
