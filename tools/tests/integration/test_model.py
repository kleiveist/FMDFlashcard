from __future__ import annotations

from tools.integration.model import (
    Conflict,
    Finding,
    IntegrationPlan,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)


def test_ownership_and_plan_contract() -> None:
    operation = Operation(
        OperationKind.ADD, "tools/new.py", Ownership.TOOLING, b"content"
    )
    plan = IntegrationPlan(profile="web-only", operations=(operation,))

    assert tuple(item.value for item in Ownership) == (
        "tooling",
        "project",
        "structured",
    )
    assert plan.required_changes == 1
    assert plan.status == "FIX_REQUIRED"
    assert plan.can_apply
    assert not plan.is_noop


def test_project_operation_makes_manually_built_plan_unapplicable() -> None:
    operation = Operation(
        OperationKind.UPDATE, "frontend/src/main.ts", Ownership.PROJECT, b"unsafe"
    )
    plan = IntegrationPlan(operations=(operation,))

    assert not plan.can_apply


def test_conflicts_and_fail_findings_drive_result_status() -> None:
    conflict = Conflict("package.json", Ownership.STRUCTURED, "unsafe replacement")
    plan = IntegrationPlan(conflicts=(conflict,))
    verification = VerificationResult((Finding("frontend", "FAIL", "missing"),))

    assert plan.status == "CONFLICT"
    assert not plan.ok
    assert not verification.ok
    assert verification.failures[0].check == "frontend"


def test_operation_repr_does_not_expose_payload() -> None:
    operation = Operation(
        OperationKind.PATCH,
        "package.json",
        Ownership.STRUCTURED,
        structured_changes=(StructuredChange("scripts.quality", "secret-value"),),
    )

    assert "secret-value" not in repr(operation)
