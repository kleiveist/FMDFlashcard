from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from tools.adapters import DEFAULT_REGISTRY, Adapter, build_default_registry
from tools.adapters.base import AdapterDesiredState, BaseAdapter, PathRequirement
from tools.adapters.registry import AdapterRegistry, AdapterRegistryError
from tools.core.context import ProjectContext
from tools.integration.model import (
    IntegrationPlan,
    IntegrationResult,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)
from tools.profiles.loader import load_catalog, resolve_profile

PROFILE_SELECTIONS = {
    "web-only": (
        "ci",
        "documentation",
        "frontend",
        "quality",
        "release",
        "testing",
    ),
    "web-cloud": (
        "backend",
        "ci",
        "container",
        "documentation",
        "frontend",
        "quality",
        "release",
        "testing",
    ),
    "desktop-local": (
        "ci",
        "documentation",
        "frontend",
        "quality",
        "release",
        "tauri",
        "testing",
    ),
    "desktop-cloud": (
        "backend",
        "ci",
        "container",
        "documentation",
        "frontend",
        "quality",
        "release",
        "tauri",
        "testing",
    ),
    "full-platform": (
        "backend",
        "ci",
        "container",
        "documentation",
        "frontend",
        "quality",
        "release",
        "tauri",
        "testing",
    ),
}


def test_default_registry_contains_all_unique_adapter_and_feature_names() -> None:
    assert DEFAULT_REGISTRY.names == (
        "backend",
        "ci",
        "container",
        "database",
        "documentation",
        "frontend",
        "quality",
        "release",
        "tauri",
        "testing",
    )
    assert DEFAULT_REGISTRY.feature_ids == (
        "backend",
        "cloud",
        "database",
        "frontend",
        "postgres",
        "tauri",
    )
    assert all(isinstance(adapter, Adapter) for adapter in DEFAULT_REGISTRY.all())


def test_registry_rejects_duplicate_names_and_feature_claims() -> None:
    class _One(BaseAdapter):
        name = "one"
        feature_ids = ("shared",)

    class _SameName(BaseAdapter):
        name = "one"
        feature_ids = ("different",)

    class _SameFeature(BaseAdapter):
        name = "two"
        feature_ids = ("shared",)

    registry = AdapterRegistry((_One(),))
    with pytest.raises(AdapterRegistryError, match="Duplicate adapter name"):
        registry.register(_SameName())
    with pytest.raises(AdapterRegistryError, match="claimed by both"):
        registry.register(_SameFeature())


def test_selection_is_deterministic_for_arbitrary_feature_order() -> None:
    first = DEFAULT_REGISTRY.select_for_features(("tauri", "frontend", "backend"))
    second = DEFAULT_REGISTRY.select_for_features(("backend", "frontend", "tauri"))

    assert tuple(item.name for item in first) == tuple(item.name for item in second)
    assert tuple(item.name for item in first) == (
        "backend",
        "ci",
        "documentation",
        "frontend",
        "quality",
        "release",
        "tauri",
        "testing",
    )


@pytest.mark.parametrize(
    ("profile_id", "expected"),
    tuple(PROFILE_SELECTIONS.items()),
)
def test_all_project_profiles_select_expected_adapters(
    profile_id: str,
    expected: tuple[str, ...],
) -> None:
    profiles_root = Path(__file__).resolve().parents[2] / "resources" / "profiles"
    catalog = load_catalog(profiles_root)
    profile = resolve_profile(catalog, profile_id)

    selected = DEFAULT_REGISTRY.select_for_profile(profile, catalog)

    assert tuple(adapter.name for adapter in selected) == expected


def test_database_and_postgres_features_share_one_adapter_without_duplicates() -> None:
    profiles_root = Path(__file__).resolve().parents[2] / "resources" / "profiles"
    catalog = load_catalog(profiles_root)
    profile = resolve_profile(
        catalog,
        "web-cloud",
        optional_features=("postgres",),
    )

    selected = DEFAULT_REGISTRY.select_for_profile(profile, catalog)

    assert tuple(adapter.name for adapter in selected).count("database") == 1


def test_registry_detect_plan_and_verify_are_sorted_and_read_only(
    adapter_context: ProjectContext,
) -> None:
    registry = build_default_registry()
    desired = AdapterDesiredState(
        "full-platform",
        ("frontend", "backend", "tauri", "cloud"),
    )
    selected = registry.select_for_features(desired.features)
    before = _tree_payloads(adapter_context.project_root)

    detections = registry.detect(adapter_context, selected)
    plan = registry.plan(adapter_context, desired, selected)
    verification = registry.verify(adapter_context, selected)

    assert tuple(item.adapter for item in detections) == tuple(
        sorted(item.name for item in selected)
    )
    assert plan.is_noop
    assert verification.ok
    assert not verification.failures
    assert _tree_payloads(adapter_context.project_root) == before


def test_default_frontend_allowlist_is_complete_exact_and_path_aware(
    adapter_context: ProjectContext,
) -> None:
    frontend = DEFAULT_REGISTRY.select_names(("frontend",))

    policy = DEFAULT_REGISTRY.structured_key_allowlist(
        adapter_context,
        frontend,
    )

    assert list(policy) == ["ui/package.json"]
    assert policy == {
        "ui/package.json": frozenset(
            {
                "scripts.build",
                "scripts.dev",
                "scripts.format:check",
                "scripts.lint",
                "scripts.tauri",
                "scripts.test",
                "scripts.test:e2e",
                "scripts.typecheck",
            }
        )
    }


def test_registry_merges_disjoint_same_path_structured_patches(
    adapter_context: ProjectContext,
) -> None:
    class _BuildScript(BaseAdapter):
        name = "build-script"
        feature_ids = ("build-script",)

        def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
            del context
            return (
                PathRequirement(
                    "ui/package.json",
                    Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    structured_changes=(
                        StructuredChange("scripts.build", "vite build"),
                    ),
                ),
            )

    class _DevScript(BaseAdapter):
        name = "dev-script"
        feature_ids = ("dev-script",)

        def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
            del context
            return (
                PathRequirement(
                    "ui/package.json",
                    Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    structured_changes=(StructuredChange("scripts.dev", "vite"),),
                ),
            )

    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        '{"name":"customer-ui"}\n', encoding="utf-8"
    )
    adapters = (_BuildScript(), _DevScript())
    registry = AdapterRegistry(adapters)

    plan = registry.plan(
        adapter_context,
        AdapterDesiredState("fixture", ("build-script", "dev-script")),
        adapters,
    )

    assert len(plan.operations) == 1
    operation = plan.operations[0]
    assert operation.kind is OperationKind.PATCH
    assert [change.key for change in operation.structured_changes] == [
        "scripts.build",
        "scripts.dev",
    ]
    assert registry.structured_key_allowlist(adapter_context, adapters) == {
        "ui/package.json": frozenset({"scripts.build", "scripts.dev"})
    }


def test_registry_rejects_overlapping_structured_key_claims(
    adapter_context: ProjectContext,
) -> None:
    class _FirstScript(BaseAdapter):
        name = "first-script"
        feature_ids = ("first-script",)

        def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
            del context
            return (
                PathRequirement(
                    "ui/package.json",
                    Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    structured_changes=(StructuredChange("scripts.dev", "first"),),
                ),
            )

    class _SecondScript(BaseAdapter):
        name = "second-script"
        feature_ids = ("second-script",)

        def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
            del context
            return (
                PathRequirement(
                    "ui/package.json",
                    Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    structured_changes=(StructuredChange("scripts.dev", "second"),),
                ),
            )

    adapters = (_FirstScript(), _SecondScript())
    registry = AdapterRegistry(adapters)

    with pytest.raises(AdapterRegistryError, match="claimed by both"):
        registry.structured_key_allowlist(adapter_context, adapters)


def test_registry_rejects_parent_child_structured_key_claims(
    adapter_context: ProjectContext,
) -> None:
    class _ScriptsTable(BaseAdapter):
        name = "scripts-table"
        feature_ids = ("scripts-table",)

        def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
            del context
            return (
                PathRequirement(
                    "ui/package.json",
                    Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    structured_changes=(StructuredChange("scripts", {}),),
                ),
            )

    class _DevScript(BaseAdapter):
        name = "nested-dev-script"
        feature_ids = ("nested-dev-script",)

        def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
            del context
            return (
                PathRequirement(
                    "ui/package.json",
                    Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    structured_changes=(StructuredChange("scripts.dev", "vite"),),
                ),
            )

    adapters = (_ScriptsTable(), _DevScript())
    registry = AdapterRegistry(adapters)

    with pytest.raises(AdapterRegistryError, match="claimed by both"):
        registry.structured_key_allowlist(adapter_context, adapters)


def test_registry_profile_plan_accepts_project_profile(
    adapter_context: ProjectContext,
) -> None:
    profiles_root = Path(__file__).resolve().parents[2] / "resources" / "profiles"
    catalog = load_catalog(profiles_root)
    profile = resolve_profile(catalog, "web-only")
    context = adapter_context.with_config(
        replace(adapter_context.config, profile=profile.profile_id)
    )
    selected = DEFAULT_REGISTRY.select_for_profile(profile, catalog)

    plan = DEFAULT_REGISTRY.plan(context, profile, selected)

    assert plan.profile == "web-only"
    assert plan.is_noop


def test_registry_apply_uses_one_shared_transaction_boundary(
    adapter_context: ProjectContext,
) -> None:
    class _Boundary:
        def __init__(self) -> None:
            self.calls: list[tuple[IntegrationPlan, str]] = []

        def submit(
            self,
            context: ProjectContext,
            plan: IntegrationPlan,
            *,
            source: str,
        ) -> IntegrationResult:
            assert context is adapter_context
            self.calls.append((plan, source))
            return IntegrationResult(
                "INTEGRATED",
                plan,
                VerificationResult(()),
                plan.operations,
            )

    boundary = _Boundary()
    registry = build_default_registry(transaction_boundary=boundary)
    plan = IntegrationPlan(profile="fixture")

    result = registry.apply(adapter_context, plan)

    assert result.ok
    assert boundary.calls == [(plan, "adapter-registry")]


def test_registry_apply_fails_closed_without_boundary(
    adapter_context: ProjectContext,
) -> None:
    with pytest.raises(AdapterRegistryError, match="no shared transaction boundary"):
        build_default_registry().apply(
            adapter_context,
            IntegrationPlan(profile="fixture"),
        )


def _tree_payloads(root: Path) -> dict[str, bytes | None]:
    payloads: dict[str, bytes | None] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            payloads[relative] = None
        elif path.is_file():
            payloads[relative] = path.read_bytes()
        elif path.is_dir():
            payloads[f"{relative}/"] = None
    return payloads
