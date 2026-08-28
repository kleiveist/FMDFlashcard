from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.core.context import TOOLS_ROOT, load_context
from tools.integration.model import (
    Conflict,
    Finding,
    IntegrationPlan,
    Operation,
    OperationKind,
    Ownership,
    ReportError,
    StructuredChange,
    VerificationResult,
)
from tools.integration.report import write_report


def test_check_mode_never_creates_state_or_reports(tmp_path: Path) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)

    assert (
        write_report(
            context,
            plan=IntegrationPlan(),
            verification=None,
            outcome="CHECK",
            check=True,
        )
        is None
    )
    assert not (tmp_path / ".tooling-state").exists()


def test_report_is_atomic_local_and_redacted(tmp_path: Path) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)
    plan = IntegrationPlan(
        profile="web-only",
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/generated.py",
                Ownership.TOOLING,
                b"password=payload-secret",
            ),
            Operation(
                OperationKind.PATCH,
                "package.json",
                Ownership.STRUCTURED,
                expected_sha256="a" * 64,
                reason="token=reason-secret",
                structured_changes=(
                    StructuredChange("scripts.quality", "value-secret"),
                ),
            ),
        ),
    )
    verification = VerificationResult(
        (
            Finding(
                "runtime",
                "FAIL",
                (
                    f"failed below {tmp_path}/private and /opt/company/private/config.toml; "
                    "postgresql://user:db-secret@localhost/db; see https://example.test/api/v1"
                ),
            ),
        )
    )
    plan = IntegrationPlan(
        profile=plan.profile,
        operations=(
            *plan.operations,
            Operation(
                "token=kind-secret",
                "tools/generated.txt",
                Ownership.TOOLING,
                b"ignored",
                "token=digest-secret",
            ),
        ),
        conflicts=(
            Conflict(
                "package.json",
                Ownership.STRUCTURED,
                "see config:/opt/private/conflict.toml",
                "token=conflict-secret",
            ),
        ),
    )

    destination = write_report(
        context,
        plan=plan,
        verification=verification,
        outcome="FAILED",
        notices=("api_key=notice-secret",),
        report_id="run-001",
    )

    assert destination == tmp_path / ".tooling-state" / "reports" / "run-001"
    payload = json.loads((destination / "integration.json").read_text(encoding="utf-8"))
    combined = (destination / "integration.json").read_text(encoding="utf-8") + (
        destination / "summary.md"
    ).read_text(encoding="utf-8")
    assert payload["plan"]["operations"][1]["structured_keys"] == ["scripts.quality"]
    assert "payload-secret" not in combined
    assert "reason-secret" not in combined
    assert "value-secret" not in combined
    assert "notice-secret" not in combined
    assert "db-secret" not in combined
    assert "/opt/company/private/config.toml" not in combined
    assert "/opt/private/conflict.toml" not in combined
    assert "conflict-secret" not in combined
    assert "kind-secret" not in combined
    assert "digest-secret" not in combined
    assert "https://example.test/api/v1" in combined
    assert str(tmp_path) not in combined
    assert not list(destination.parent.glob(".pending-*"))


def test_report_rejects_symlinked_state_root(tmp_path: Path) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)
    outside = tmp_path.parent / f"{tmp_path.name}-outside"
    outside.mkdir()
    (tmp_path / ".tooling-state").symlink_to(outside, target_is_directory=True)

    with pytest.raises(ReportError):
        write_report(
            context, plan=None, verification=None, outcome="FAILED", report_id="unsafe"
        )
    assert not (outside / "reports").exists()


def test_report_refuses_invalid_or_existing_identifier(tmp_path: Path) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)

    with pytest.raises(ReportError, match="Invalid"):
        write_report(
            context,
            plan=None,
            verification=None,
            outcome="FAILED",
            report_id="../escape",
        )
    write_report(context, plan=None, verification=None, outcome="OK", report_id="same")
    with pytest.raises(ReportError, match="already exists"):
        write_report(
            context, plan=None, verification=None, outcome="OK", report_id="same"
        )
