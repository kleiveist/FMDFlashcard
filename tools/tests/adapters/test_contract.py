from __future__ import annotations

from pathlib import Path

import pytest

from tools.adapters.base import (
    AdapterActionResult,
    AdapterApplyError,
    AdapterCapability,
    AdapterContractError,
    AdapterDesiredState,
    BaseAdapter,
    PathRequirement,
)
from tools.adapters.frontend import FrontendAdapter
from tools.adapters.registry import AdapterRegistry
from tools.core.context import ProjectContext
from tools.integration.model import (
    IntegrationPlan,
    IntegrationResult,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)


class _AssetAdapter(BaseAdapter):
    name = "asset"
    feature_ids = ("asset",)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        del context
        return (
            PathRequirement(
                path="tools/generated.txt",
                ownership=Ownership.TOOLING,
                kind="file",
                content="generated\n",
                create_if_missing=True,
            ),
        )


class _BuildAdapter(BaseAdapter):
    name = "builder"
    feature_ids = ("builder",)
    capabilities = frozenset({AdapterCapability.BUILD})

    def build(self, context: ProjectContext) -> AdapterActionResult:
        del context
        return AdapterActionResult(
            adapter=self.name,
            capability=AdapterCapability.BUILD,
            ok=True,
        )


class _RecordingBoundary:
    def __init__(self) -> None:
        self.calls: list[tuple[ProjectContext, IntegrationPlan, str]] = []

    def submit(
        self,
        context: ProjectContext,
        plan: IntegrationPlan,
        *,
        source: str,
    ) -> IntegrationResult:
        self.calls.append((context, plan, source))
        return IntegrationResult(
            outcome="INTEGRATED",
            plan=plan,
            verification=VerificationResult(()),
            applied_operations=plan.operations,
        )


@pytest.mark.parametrize(
    "requirement",
    [
        lambda: PathRequirement("../escape", Ownership.TOOLING),
        lambda: PathRequirement(
            "frontend/new.txt",
            Ownership.PROJECT,
            kind="file",
            content="unsafe",
        ),
        lambda: PathRequirement(
            "frontend",
            Ownership.PROJECT,
            create_if_missing=True,
        ),
        lambda: PathRequirement(
            "frontend/package.json",
            Ownership.PROJECT,
            kind="file",
            structured_changes=(StructuredChange("scripts.test", "vitest"),),
        ),
    ],
)
def test_path_requirement_rejects_unsafe_write_contracts(requirement: object) -> None:
    with pytest.raises(AdapterContractError):
        requirement()  # type: ignore[operator]


def test_path_requirement_rejects_parent_child_structured_keys() -> None:
    with pytest.raises(AdapterContractError, match="Structured keys overlap"):
        PathRequirement(
            "frontend/package.json",
            Ownership.STRUCTURED,
            kind="file",
            structured_changes=(
                StructuredChange("scripts", {"dev": "vite"}),
                StructuredChange("scripts.test", "vitest run"),
            ),
        )


def test_adapter_plan_uses_integration_planner_contract(
    adapter_context: ProjectContext,
) -> None:
    plan = _AssetAdapter().plan(
        adapter_context,
        AdapterDesiredState("fixture", ("asset",)),
    )

    assert plan.status == "FIX_REQUIRED"
    assert [(item.kind, item.path, item.ownership) for item in plan.operations] == [
        (OperationKind.ADD, "tools/generated.txt", Ownership.TOOLING)
    ]
    assert not plan.conflicts


def test_apply_fails_closed_without_transaction_boundary(
    adapter_context: ProjectContext,
) -> None:
    operation = Operation(
        OperationKind.ADD,
        "tools/generated.txt",
        Ownership.TOOLING,
        content=b"payload",
    )

    with pytest.raises(AdapterApplyError, match="no shared transaction boundary"):
        _AssetAdapter().apply(adapter_context, (operation,))

    assert not (adapter_context.tools_root / "generated.txt").exists()


def test_apply_only_submits_to_shared_transaction_boundary(
    adapter_context: ProjectContext,
) -> None:
    boundary = _RecordingBoundary()
    adapter = _AssetAdapter(transaction_boundary=boundary)
    plan = adapter.plan(
        adapter_context,
        AdapterDesiredState("fixture", ("asset",)),
    )

    result = adapter.apply(adapter_context, plan.operations)

    assert result.ok
    assert len(boundary.calls) == 1
    called_context, called_plan, source = boundary.calls[0]
    assert called_context is adapter_context
    assert called_plan.operations == plan.operations
    assert source == "asset"
    assert not (adapter_context.tools_root / "generated.txt").exists()


def test_apply_rejects_project_owned_operations_before_submission(
    adapter_context: ProjectContext,
) -> None:
    boundary = _RecordingBoundary()
    operation = Operation(
        OperationKind.ENSURE_DIRECTORY,
        "ui",
        Ownership.PROJECT,
    )

    with pytest.raises(AdapterApplyError, match="project-owned write"):
        _AssetAdapter(transaction_boundary=boundary).apply(
            adapter_context,
            (operation,),
        )

    assert boundary.calls == []


def test_detection_does_not_follow_product_symlink(
    adapter_context: ProjectContext,
    tmp_path: Path,
) -> None:
    external = tmp_path.parent / f"{tmp_path.name}-external-ui"
    external.mkdir()
    (external / "private.txt").write_text("do not read", encoding="utf-8")
    adapter_context.paths.frontend.symlink_to(external, target_is_directory=True)

    detection = FrontendAdapter().detect(adapter_context)
    plan = FrontendAdapter().plan(
        adapter_context,
        AdapterDesiredState("fixture", ("frontend",)),
    )
    verification = FrontendAdapter().verify(adapter_context)

    assert detection.resources[0].is_symlink
    assert plan.operations == ()
    assert {item.code for item in plan.conflicts} == {"adapter-path-safety"}
    assert not verification.ok
    assert verification.failures[0].path == "ui"


def test_optional_capabilities_are_explicit_and_queryable() -> None:
    builder = _BuildAdapter()
    registry = AdapterRegistry((builder, _AssetAdapter()))

    assert registry.capable(AdapterCapability.BUILD) == (builder,)
    assert registry.capable(AdapterCapability.RUN) == ()


def test_desired_state_requires_typed_tuple_features() -> None:
    class _Invalid:
        profile = "fixture"

        def __init__(self) -> None:
            self.features = ["frontend"]

    with pytest.raises(AdapterContractError, match="tuple of features"):
        AdapterDesiredState.from_profile(_Invalid())  # type: ignore[arg-type]
