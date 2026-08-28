from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from tools.integration.migrations import (
    REGISTRY,
    ConditionKind,
    Migration,
    MigrationApplicability,
    MigrationCondition,
    MigrationRegistry,
    StructuredKeyAllowlist,
    build_migration_run,
    validate_postconditions,
    validate_preconditions,
)
from tools.integration.model import (
    MigrationError,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
)
from tools.integration.planner import ObservedResource

DIGEST = "a" * 64
CURRENT_TARGET_VERSION_DIGEST = (
    "40b8eb4000a913a7791090535f291d3d369874162a89ef3c9e3d4e887a1b9e79"
)


def _migration(
    identifier: str,
    order: int = 10,
    *,
    operation: Operation | None = None,
    structured_key_allowlist: tuple[StructuredKeyAllowlist, ...] = (),
) -> Migration:
    path = "tools/resources/config/policy.toml"
    return Migration(
        migration_id=identifier,
        description="Update portable tooling policy",
        order=order,
        applies=MigrationApplicability(
            source_tooling_versions=("0.1.0",),
            target_tooling_version="0.2.0",
            source_state_schemas=(1,),
            target_state_schema=2,
        ),
        operations=(
            operation
            or Operation(
                OperationKind.UPDATE,
                path,
                Ownership.TOOLING,
                b"updated\n",
                expected_sha256=DIGEST,
            ),
        ),
        preconditions=(
            MigrationCondition(ConditionKind.PATH_EXISTS, path, Ownership.TOOLING),
        ),
        postconditions=(
            MigrationCondition(ConditionKind.PATH_EXISTS, path, Ownership.TOOLING),
        ),
        structured_key_allowlist=structured_key_allowlist,
    )


def test_registry_order_and_applied_idempotency() -> None:
    registry = MigrationRegistry((_migration("later", 20), _migration("earlier", 10)))

    selected = registry.select(
        source_tooling_version="0.1.0",
        target_tooling_version="0.2.0",
        source_state_schema=1,
        target_state_schema=2,
        applied=("earlier",),
    )
    run = build_migration_run(
        registry,
        source_tooling_version="0.1.0",
        target_tooling_version="0.2.0",
        source_state_schema=1,
        target_state_schema=2,
        applied=("earlier",),
    )

    assert [item.migration_id for item in selected] == ["later"]
    assert run.applied_ids == ("earlier",)
    assert run.resulting_applied_ids == ("earlier", "later")
    assert build_migration_run(
        registry,
        source_tooling_version="0.1.0",
        target_tooling_version="0.2.0",
        source_state_schema=1,
        target_state_schema=2,
        applied=run.resulting_applied_ids,
    ).is_noop


def test_productive_registry_reconciles_exact_managed_payload_upgrade() -> None:
    assert (Path(__file__).resolve().parents[2] / "VERSION").read_bytes() == b"0.4.0\n"
    assert REGISTRY.ids == (
        "reconcile-managed-payload-0-1-0-to-0-2-0",
        "reconcile-managed-payload-0-1-0-to-0-3-0",
        "reconcile-managed-payload-0-2-0-to-0-3-0",
        "reconcile-managed-payload-0-1-0-to-0-4-0",
        "reconcile-managed-payload-0-2-0-to-0-4-0",
        "reconcile-managed-payload-0-3-0-to-0-4-0",
    )

    migration = REGISTRY.migrations[3]
    run = build_migration_run(
        REGISTRY,
        source_tooling_version="0.1.0",
        target_tooling_version="0.4.0",
        source_state_schema=1,
        target_state_schema=1,
    )

    assert migration.reconciles_managed_payload
    assert migration.operations == ()
    assert migration.applies.source_tooling_versions == ("0.1.0",)
    assert migration.applies.target_tooling_version == "0.4.0"
    assert migration.applies.source_state_schemas == (1,)
    assert migration.applies.target_state_schema == 1
    assert migration.preconditions == migration.postconditions
    assert migration.preconditions[0].kind is ConditionKind.SHA256_EQUALS
    assert migration.preconditions[0].path == "tools/VERSION"
    assert migration.preconditions[0].value == CURRENT_TARGET_VERSION_DIGEST
    assert migration.preconditions[1] == MigrationCondition(
        ConditionKind.PATH_EXISTS,
        "tools/PORTABLE-PAYLOAD.json",
        Ownership.TOOLING,
    )
    assert run.migrations == (migration,)
    assert run.operations == ()
    assert not run.is_noop
    assert run.reconciles_managed_payload
    assert run.resulting_applied_ids == (migration.migration_id,)

    observed = (
        ObservedResource(
            "tools/VERSION",
            Ownership.TOOLING,
            sha256=CURRENT_TARGET_VERSION_DIGEST,
        ),
        ObservedResource(
            "tools/PORTABLE-PAYLOAD.json",
            Ownership.TOOLING,
        ),
    )
    validate_preconditions(migration, observed)
    validate_postconditions(migration, observed)


def test_productive_reconciliation_is_exactly_version_and_schema_scoped() -> None:
    cases = (
        ("0.1.1", "0.4.0", 1, 1),
        ("0.1.0", "0.4.1", 1, 1),
        ("0.1.0", "0.4.0", 2, 1),
        ("0.1.0", "0.4.0", 1, 2),
    )

    for source_version, target_version, source_schema, target_schema in cases:
        assert build_migration_run(
            REGISTRY,
            source_tooling_version=source_version,
            target_tooling_version=target_version,
            source_state_schema=source_schema,
            target_state_schema=target_schema,
        ).is_noop


def test_productive_registry_has_direct_paths_to_current_payload() -> None:
    expected = {
        "0.1.0": "reconcile-managed-payload-0-1-0-to-0-4-0",
        "0.2.0": "reconcile-managed-payload-0-2-0-to-0-4-0",
        "0.3.0": "reconcile-managed-payload-0-3-0-to-0-4-0",
    }

    for source_version, migration_id in expected.items():
        run = build_migration_run(
            REGISTRY,
            source_tooling_version=source_version,
            target_tooling_version="0.4.0",
            source_state_schema=1,
            target_state_schema=1,
        )
        assert tuple(item.migration_id for item in run.migrations) == (migration_id,)


def test_only_strict_managed_payload_reconciliation_may_have_no_operations() -> None:
    ordinary = _migration("ordinary-empty")
    with pytest.raises(MigrationError, match="has no operations"):
        MigrationRegistry((replace(ordinary, operations=()),))

    reconciliation = REGISTRY.migrations[0]
    invalid_variants = (
        replace(
            reconciliation,
            operations=(
                Operation(
                    OperationKind.UPDATE,
                    "tools/VERSION",
                    Ownership.TOOLING,
                    b"0.2.0\n",
                    DIGEST,
                ),
            ),
        ),
        replace(
            reconciliation,
            applies=replace(
                reconciliation.applies,
                source_tooling_versions=("0.0.9", "0.1.0"),
            ),
        ),
        replace(
            reconciliation,
            applies=replace(reconciliation.applies, target_state_schema=2),
        ),
        replace(
            reconciliation,
            preconditions=(
                MigrationCondition(
                    ConditionKind.SHA256_EQUALS,
                    "tools/VERSION",
                    Ownership.TOOLING,
                    value=DIGEST,
                ),
            ),
        ),
        replace(
            reconciliation,
            structured_key_allowlist=(
                StructuredKeyAllowlist("package.json", ("scripts.quality",)),
            ),
        ),
    )

    for migration in invalid_variants:
        with pytest.raises(MigrationError, match="managed.payload|managed-payload"):
            MigrationRegistry((migration,))


def test_registry_rejects_duplicate_ids_and_project_writes() -> None:
    with pytest.raises(MigrationError, match="Duplicate"):
        MigrationRegistry((_migration("same", 1), _migration("same", 2)))

    unsafe = Operation(
        OperationKind.UPDATE, "frontend/src/main.ts", Ownership.PROJECT, b"x", DIGEST
    )
    with pytest.raises(MigrationError, match="project-owned"):
        MigrationRegistry((_migration("unsafe-project", operation=unsafe),))


def test_registry_rejects_shell_or_structured_replacement_operations() -> None:
    shell = Operation("SHELL", "tools/script", Ownership.TOOLING)
    replacement = Operation(
        OperationKind.UPDATE, "package.json", Ownership.STRUCTURED, b"{}", DIGEST
    )

    with pytest.raises(MigrationError, match="unsupported operation"):
        MigrationRegistry((_migration("no-shell", operation=shell),))
    with pytest.raises(MigrationError, match="only use UPDATE for tooling-owned"):
        MigrationRegistry((_migration("no-replacement", operation=replacement),))


def test_structured_patch_requires_known_keys_and_preimage() -> None:
    patch = Operation(
        OperationKind.PATCH,
        "package.json",
        Ownership.STRUCTURED,
        expected_sha256=DIGEST,
        structured_changes=(StructuredChange("scripts.quality", "quality"),),
    )

    policy = (StructuredKeyAllowlist("package.json", ("scripts.quality",)),)
    assert MigrationRegistry(
        (
            _migration(
                "structured-patch", operation=patch, structured_key_allowlist=policy
            ),
        )
    ).ids == ("structured-patch",)

    missing_preimage = Operation(
        OperationKind.PATCH,
        "package.json",
        Ownership.STRUCTURED,
        structured_changes=(StructuredChange("scripts.quality", "quality"),),
    )
    with pytest.raises(MigrationError, match="preimage"):
        MigrationRegistry(
            (
                _migration(
                    "missing-preimage",
                    operation=missing_preimage,
                    structured_key_allowlist=policy,
                ),
            )
        )


def test_structured_patch_rejects_undeclared_keys() -> None:
    patch = Operation(
        OperationKind.PATCH,
        "package.json",
        Ownership.STRUCTURED,
        expected_sha256=DIGEST,
        structured_changes=(StructuredChange("dependencies.foreign", "1.0.0"),),
    )

    with pytest.raises(MigrationError, match="undeclared structured keys"):
        MigrationRegistry(
            (
                _migration(
                    "structured-allowlist",
                    operation=patch,
                    structured_key_allowlist=(
                        StructuredKeyAllowlist("package.json", ("scripts.quality",)),
                    ),
                ),
            )
        )


def test_preconditions_and_postconditions_are_evaluated_without_shells() -> None:
    path = "tools/resources/config/policy.toml"
    migration = _migration("condition-check")
    observed = (ObservedResource(path, Ownership.TOOLING, sha256=DIGEST),)

    validate_preconditions(migration, observed)
    validate_postconditions(migration, observed)
    with pytest.raises(MigrationError, match="precondition failed"):
        validate_preconditions(migration, ())
    with pytest.raises(MigrationError, match="precondition failed"):
        validate_preconditions(
            migration,
            (ObservedResource(path, Ownership.PROJECT, sha256=DIGEST),),
        )


@pytest.mark.parametrize(
    "operation",
    (
        Operation(
            OperationKind.ADD,
            "tools/new.txt",
            Ownership.TOOLING,
            b"new",
            DIGEST,
        ),
        Operation(
            OperationKind.UPDATE,
            "tools/item.txt",
            Ownership.TOOLING,
            b"new",
            DIGEST,
            structured_changes=(StructuredChange("unsafe", True),),
        ),
        Operation(
            OperationKind.DELETE,
            "tools/item.txt",
            Ownership.TOOLING,
            expected_sha256=DIGEST,
            source_path="tools/source.txt",
        ),
    ),
)
def test_registry_rejects_operations_the_transaction_would_reject(
    operation: Operation,
) -> None:
    with pytest.raises(MigrationError):
        MigrationRegistry((_migration("contract-parity", operation=operation),))


def test_structured_condition_reads_only_declared_key() -> None:
    path = "package.json"
    condition = MigrationCondition(
        ConditionKind.STRUCTURED_EQUALS,
        path,
        Ownership.STRUCTURED,
        key="scripts.quality",
        value="quality",
    )
    migration = Migration(
        "structured-condition",
        "Check a known key",
        1,
        MigrationApplicability(source_state_schemas=(1,), target_state_schema=2),
        (
            Operation(
                OperationKind.PATCH,
                path,
                Ownership.STRUCTURED,
                expected_sha256=DIGEST,
                structured_changes=(StructuredChange("scripts.quality", "new"),),
            ),
        ),
        (condition,),
        (condition,),
        (StructuredKeyAllowlist(path, ("scripts.quality",)),),
    )

    validate_preconditions(
        migration,
        (
            ObservedResource(
                path,
                Ownership.STRUCTURED,
                sha256=DIGEST,
                structured_values={"scripts": {"quality": "quality"}},
            ),
        ),
    )
