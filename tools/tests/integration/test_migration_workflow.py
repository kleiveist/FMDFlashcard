from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

import tools.integration.migrations as migration_model
from tools.core.state import STATE_SCHEMA_VERSION, load_state
from tools.integration import service, workflow
from tools.integration.migrations import (
    ConditionKind,
    Migration,
    MigrationApplicability,
    MigrationCondition,
    MigrationRegistry,
    StructuredKeyAllowlist,
)
from tools.integration.model import (
    IntegrationError,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
)
from tools.tests.integration.test_workflow import (
    TOOLING_VERSION,
    _portable_project,
    _seal_payload,
    _snapshot,
)

PAYLOAD_RECONCILIATION_IDS = {
    "0.1.0": "reconcile-managed-payload-0-1-0-to-0-4-0",
    "0.2.0": "reconcile-managed-payload-0-2-0-to-0-4-0",
    "0.3.0": "reconcile-managed-payload-0-3-0-to-0-4-0",
}


def _add_file_migration(
    identifier: str,
    *,
    source_schema: int = STATE_SCHEMA_VERSION,
    postcondition_path: str = "docs/toolingdocs/migrated.txt",
    target_version: str = TOOLING_VERSION,
) -> Migration:
    path = "docs/toolingdocs/migrated.txt"
    return Migration(
        migration_id=identifier,
        description="Add deterministic migration evidence",
        order=10,
        applies=MigrationApplicability(
            source_tooling_versions=(TOOLING_VERSION,),
            target_tooling_version=target_version,
            source_state_schemas=(source_schema,),
            target_state_schema=STATE_SCHEMA_VERSION,
        ),
        operations=(
            Operation(
                OperationKind.ADD,
                path,
                Ownership.TOOLING,
                b"migrated\n",
            ),
        ),
        preconditions=(
            MigrationCondition(ConditionKind.PATH_MISSING, path, Ownership.TOOLING),
        ),
        postconditions=(
            MigrationCondition(
                ConditionKind.PATH_EXISTS,
                postcondition_path,
                Ownership.TOOLING,
            ),
        ),
    )


def test_runtime_registry_check_apply_and_second_run_are_exactly_idempotent(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    registry = MigrationRegistry((_add_file_migration("add-migration-evidence"),))
    monkeypatch.setattr(migration_model, "REGISTRY", registry)
    before_check = _snapshot(root)

    assert (
        service.run_migrate(
            check_only=True,
            json_output=True,
            project_root=root,
            tools_root=tools,
        )
        == 1
    )
    check_payload = json.loads(capsys.readouterr().out)

    assert check_payload["pending_migrations"] == ["add-migration-evidence"]
    assert {item["path"] for item in check_payload["plan"]["operations"]} == {
        ".tooling-state/state.toml",
        "docs/toolingdocs/migrated.txt",
    }
    assert _snapshot(root) == before_check

    assert (
        service.run_migrate(
            json_output=True,
            project_root=root,
            tools_root=tools,
        )
        == 0
    )
    applied_payload = json.loads(capsys.readouterr().out)

    assert applied_payload["pending_migrations"] == []
    assert applied_payload["applied_migrations"] == ["add-migration-evidence"]
    assert (
        root / "docs" / "toolingdocs" / "migrated.txt"
    ).read_bytes() == b"migrated\n"
    assert load_state(root).applied_migrations == ("add-migration-evidence",)
    assert workflow.assess_project(root, tools_root=tools).plan.is_noop

    before_noop = _snapshot(root)
    assert (
        service.run_migrate(
            json_output=True,
            project_root=root,
            tools_root=tools,
        )
        == 0
    )
    noop_payload = json.loads(capsys.readouterr().out)
    assert noop_payload["applied_migrations"] == []
    assert noop_payload["report_path"] is None
    assert _snapshot(root) == before_noop


def test_registered_migration_can_convert_an_unsupported_old_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    state_path = root / ".tooling-state" / "state.toml"
    state_path.write_text(
        state_path.read_text(encoding="utf-8").replace(
            f"schema_version = {STATE_SCHEMA_VERSION}",
            "schema_version = 2",
            1,
        ),
        encoding="utf-8",
    )
    registry = MigrationRegistry(
        (_add_file_migration("convert-old-state", source_schema=2),)
    )
    monkeypatch.setattr(migration_model, "REGISTRY", registry)

    migration = workflow.assess_migrations(root, tools_root=tools)
    applied = workflow.run_migrations(root, tools_root=tools)

    assert migration.pending_ids == ("convert-old-state",)
    assert migration.source_state_schema == 2
    assert applied.applied_ids == ("convert-old-state",)
    state = load_state(root)
    assert state.schema_version == STATE_SCHEMA_VERSION
    assert state.applied_migrations == ("convert-old-state",)
    assert workflow.assess_project(root, tools_root=tools).plan.is_noop


def test_registered_managed_migration_can_reconcile_a_copied_tooling_upgrade(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    upgraded_version = "0.5.0"
    (tools / "VERSION").write_text(f"{upgraded_version}\n", encoding="utf-8")
    _seal_payload(root, tools)
    registry = MigrationRegistry(
        (
            _add_file_migration(
                "reconcile-copied-upgrade",
                target_version=upgraded_version,
            ),
        )
    )

    stale = workflow.assess_project(root, tools_root=tools)
    applied = workflow.run_migrations(root, tools_root=tools, registry=registry)

    assert any(
        conflict.code == "unverified-managed-tree" for conflict in stale.plan.conflicts
    )
    assert applied.applied_ids == ("reconcile-copied-upgrade",)
    state = load_state(root)
    assert state.tooling_version == upgraded_version
    assert state.applied_migrations == ("reconcile-copied-upgrade",)
    assert workflow.assess_project(root, tools_root=tools).plan.is_noop


@pytest.mark.parametrize("source_version", tuple(PAYLOAD_RECONCILIATION_IDS))
def test_productive_payload_reconciliation_updates_only_config_and_state(
    tmp_path: Path,
    source_version: str,
) -> None:
    root, tools = _portable_project(tmp_path)
    (tools / "VERSION").write_bytes(f"{source_version}\n".encode())
    if source_version == "0.1.0":
        (tools / "PORTABLE-PAYLOAD.json").unlink()
    else:
        _seal_payload(root, tools)
    workflow.run_full_fix(root, tools_root=tools)
    config = root / "project-tooling.toml"
    config_before = config.read_text(encoding="utf-8")
    (tools / "VERSION").write_bytes(b"0.4.0\n")
    _seal_payload(root, tools)
    reconciliation_id = PAYLOAD_RECONCILIATION_IDS[source_version]

    pending = workflow.assess_migrations(root, tools_root=tools)

    assert pending.pending_ids == (reconciliation_id,)
    assert pending.run.operations == ()
    assert not pending.run.is_noop
    assert {operation.path for operation in pending.assessment.plan.operations} == {
        ".tooling-state/state.toml",
        "project-tooling.toml",
    }

    applied = workflow.run_migrations(root, tools_root=tools)
    state = load_state(root)

    assert applied.applied_ids == (reconciliation_id,)
    assert state.tooling_version == "0.4.0"
    assert state.applied_migrations == (reconciliation_id,)
    assert '[project]\nname = "target-project"\nprofile = "web-only"' in (
        config.read_text(encoding="utf-8")
    )
    assert config_before.replace(
        f'version = "{source_version}"', 'version = "0.4.0"'
    ) == config.read_text(encoding="utf-8")

    before_noop = _snapshot(root)
    second = workflow.run_migrations(root, tools_root=tools)

    assert second.applied_ids == ()
    assert not second.applied.changed
    assert _snapshot(root) == before_noop


def test_unsupported_state_without_registered_conversion_fails_closed(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    state_path = root / ".tooling-state" / "state.toml"
    state_path.write_text(
        state_path.read_text(encoding="utf-8").replace(
            f"schema_version = {STATE_SCHEMA_VERSION}",
            "schema_version = 2",
            1,
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(migration_model, "REGISTRY", MigrationRegistry())
    before = _snapshot(root)

    with pytest.raises(
        migration_model.MigrationError,
        match="no registered migration",
    ):
        workflow.assess_migrations(root, tools_root=tools)

    assert _snapshot(root) == before


def test_failed_postcondition_keeps_migration_and_state_unchanged(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    state_before = (root / ".tooling-state" / "state.toml").read_bytes()
    migration = _add_file_migration(
        "failing-postcondition",
        postcondition_path="docs/toolingdocs/never-created.txt",
    )

    with pytest.raises(
        IntegrationError, match="Staged integration verification failed"
    ):
        workflow.run_migrations(
            root,
            tools_root=tools,
            registry=MigrationRegistry((migration,)),
        )

    assert not (root / "docs" / "toolingdocs" / "migrated.txt").exists()
    assert (root / ".tooling-state" / "state.toml").read_bytes() == state_before
    assert load_state(root).applied_migrations == ()


def test_structured_migration_action_failure_leaves_project_unchanged(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    package = root / "package.json"
    before = b'{"scripts":{"quality":"old"},"foreign":"keep"}\n'
    package.write_bytes(before)
    migration = Migration(
        migration_id="patch-known-structured-key",
        description="Patch one explicitly owned package key",
        order=20,
        applies=MigrationApplicability(
            source_tooling_versions=(TOOLING_VERSION,),
            target_tooling_version=TOOLING_VERSION,
            source_state_schemas=(STATE_SCHEMA_VERSION,),
            target_state_schema=STATE_SCHEMA_VERSION,
        ),
        operations=(
            Operation(
                OperationKind.PATCH,
                "package.json",
                Ownership.STRUCTURED,
                expected_sha256=hashlib.sha256(before).hexdigest(),
                structured_changes=(StructuredChange("scripts.quality", "new", "old"),),
            ),
        ),
        preconditions=(
            MigrationCondition(
                ConditionKind.STRUCTURED_EQUALS,
                "package.json",
                Ownership.STRUCTURED,
                key="scripts.quality",
                value="old",
            ),
        ),
        postconditions=(
            MigrationCondition(
                ConditionKind.STRUCTURED_EQUALS,
                "package.json",
                Ownership.STRUCTURED,
                key="scripts.quality",
                value="new",
            ),
        ),
        structured_key_allowlist=(
            StructuredKeyAllowlist("package.json", ("scripts.quality",)),
        ),
    )

    state_before = (root / ".tooling-state" / "state.toml").read_bytes()

    with pytest.raises(
        IntegrationError,
        match="Staged action verification failed; target remains unchanged",
    ):
        workflow.run_migrations(
            root,
            tools_root=tools,
            registry=MigrationRegistry((migration,)),
        )

    assert package.read_bytes() == before
    assert (root / ".tooling-state" / "state.toml").read_bytes() == state_before
    assert load_state(root).applied_migrations == ()
