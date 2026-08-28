"""Versioned, deterministic migrations for tooling and integration state."""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable, Mapping
from collections.abc import Mapping as MappingABC
from dataclasses import dataclass
from enum import Enum
from typing import Any

from tools.integration.model import (
    UNSET,
    MigrationError,
    Operation,
    OperationKind,
    Ownership,
    PlanningError,
)
from tools.integration.planner import ObservedResource, safe_relative_path

MIGRATION_ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
_SHA256 = re.compile(r"(?:sha256:)?[0-9a-f]{64}")
_MANAGED_PAYLOAD_VERSION_PATH = "tools/VERSION"
_MANAGED_PAYLOAD_MANIFEST_PATH = "tools/PORTABLE-PAYLOAD.json"


def _duplicate(values: Iterable[str]) -> str | None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None


class ConditionKind(str, Enum):
    PATH_EXISTS = "PATH_EXISTS"
    PATH_MISSING = "PATH_MISSING"
    SHA256_EQUALS = "SHA256_EQUALS"
    STRUCTURED_EQUALS = "STRUCTURED_EQUALS"


@dataclass(frozen=True, slots=True)
class MigrationCondition:
    kind: ConditionKind | str
    path: str
    ownership: Ownership | str
    key: str | None = None
    value: Any = UNSET

    def __post_init__(self) -> None:
        try:
            kind = (
                self.kind
                if isinstance(self.kind, ConditionKind)
                else ConditionKind(str(self.kind).upper())
            )
        except ValueError as exc:
            raise MigrationError(
                f"Unsupported migration condition: {self.kind!r}."
            ) from exc
        try:
            ownership = (
                self.ownership
                if isinstance(self.ownership, Ownership)
                else Ownership(str(self.ownership).strip().lower())
            )
        except ValueError as exc:
            raise MigrationError(
                f"Unsupported migration condition ownership: {self.ownership!r}."
            ) from exc
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "ownership", ownership)
        object.__setattr__(self, "path", _migration_path(self.path))
        if kind is ConditionKind.STRUCTURED_EQUALS:
            if not self.key or any(not part for part in self.key.split(".")):
                raise MigrationError(
                    "STRUCTURED_EQUALS requires a non-empty dotted key."
                )
            if self.value is UNSET:
                raise MigrationError("STRUCTURED_EQUALS requires an expected value.")
        elif kind is ConditionKind.SHA256_EQUALS and self.value is UNSET:
            raise MigrationError("SHA256_EQUALS requires an expected digest.")
        elif kind is ConditionKind.SHA256_EQUALS:
            if not isinstance(self.value, str) or not _SHA256.fullmatch(self.value):
                raise MigrationError(
                    "SHA256_EQUALS requires a lowercase SHA-256 digest."
                )
            object.__setattr__(self, "value", self.value.removeprefix("sha256:"))


@dataclass(frozen=True, slots=True)
class MigrationApplicability:
    """Exact tooling/state versions for which a migration is applicable."""

    source_tooling_versions: tuple[str, ...] = ()
    target_tooling_version: str | None = None
    source_state_schemas: tuple[int, ...] = ()
    target_state_schema: int | None = None

    def __post_init__(self) -> None:
        if isinstance(self.source_tooling_versions, str):
            raise MigrationError(
                "Migration source tooling versions must be a sequence, not text."
            )
        source_versions = tuple(self.source_tooling_versions)
        if any(
            not isinstance(value, str) or not value.strip() for value in source_versions
        ):
            raise MigrationError(
                "Migration source tooling versions must be non-empty strings."
            )
        source_schemas = tuple(self.source_state_schemas)
        if any(
            not isinstance(schema, int) or isinstance(schema, bool)
            for schema in source_schemas
        ):
            raise MigrationError("Migration source state schemas must be integers.")
        object.__setattr__(
            self,
            "source_tooling_versions",
            tuple(sorted(set(source_versions))),
        )
        object.__setattr__(
            self, "source_state_schemas", tuple(sorted(set(source_schemas)))
        )
        if not self.source_tooling_versions and not self.source_state_schemas:
            raise MigrationError(
                "Migration applicability requires a source tooling version or state schema."
            )
        if self.target_tooling_version is None and self.target_state_schema is None:
            raise MigrationError(
                "Migration applicability requires a target tooling version or state schema."
            )
        if self.target_tooling_version is not None and (
            not isinstance(self.target_tooling_version, str)
            or not self.target_tooling_version.strip()
        ):
            raise MigrationError(
                "Migration target tooling version must be a non-empty string."
            )
        if any(schema < 1 for schema in self.source_state_schemas):
            raise MigrationError(
                "Migration source state schemas must be positive integers."
            )
        if self.target_state_schema is not None and (
            not isinstance(self.target_state_schema, int)
            or isinstance(self.target_state_schema, bool)
            or self.target_state_schema < 1
        ):
            raise MigrationError(
                "Migration target state schema must be a positive integer."
            )

    def matches(
        self,
        *,
        source_tooling_version: str,
        target_tooling_version: str,
        source_state_schema: int,
        target_state_schema: int,
    ) -> bool:
        source_tooling_matches = (
            not self.source_tooling_versions
            or source_tooling_version in self.source_tooling_versions
        )
        source_schema_matches = (
            not self.source_state_schemas
            or source_state_schema in self.source_state_schemas
        )
        target_tooling_matches = self.target_tooling_version in {
            None,
            target_tooling_version,
        }
        target_schema_matches = self.target_state_schema in {None, target_state_schema}
        return (
            source_tooling_matches
            and source_schema_matches
            and target_tooling_matches
            and target_schema_matches
        )


@dataclass(frozen=True, slots=True)
class StructuredKeyAllowlist:
    """The complete set of dotted keys one migration may patch at one path."""

    path: str
    keys: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "path", _migration_path(self.path))
        if isinstance(self.keys, str):
            raise MigrationError(
                "Structured migration allowlist keys must be a sequence, not text."
            )
        raw_keys = tuple(self.keys)
        if any(not isinstance(key, str) for key in raw_keys):
            raise MigrationError("Structured migration allowlist keys must be strings.")
        keys = tuple(sorted(set(raw_keys)))
        if not keys or any(
            not key or any(not part for part in key.split(".")) for key in keys
        ):
            raise MigrationError(
                f"Structured migration allowlist is empty or invalid at {self.path}."
            )
        object.__setattr__(self, "keys", keys)


@dataclass(frozen=True, slots=True)
class Migration:
    migration_id: str
    description: str
    order: int
    applies: MigrationApplicability
    operations: tuple[Operation, ...]
    preconditions: tuple[MigrationCondition, ...]
    postconditions: tuple[MigrationCondition, ...]
    structured_key_allowlist: (
        tuple[StructuredKeyAllowlist, ...] | Mapping[str, Iterable[str]]
    ) = ()
    reconciles_managed_payload: bool = False

    def __post_init__(self) -> None:
        object.__setattr__(self, "operations", tuple(self.operations))
        object.__setattr__(self, "preconditions", tuple(self.preconditions))
        object.__setattr__(self, "postconditions", tuple(self.postconditions))
        raw_allowlist = self.structured_key_allowlist
        if isinstance(raw_allowlist, MappingABC):
            policies = tuple(
                StructuredKeyAllowlist(path, tuple(keys))
                for path, keys in raw_allowlist.items()
            )
        else:
            policies = tuple(raw_allowlist)
            if any(
                not isinstance(policy, StructuredKeyAllowlist) for policy in policies
            ):
                raise MigrationError(
                    "Migration structured_key_allowlist contains an invalid policy."
                )
        policies = tuple(sorted(policies, key=lambda policy: policy.path))
        duplicate = _duplicate(policy.path for policy in policies)
        if duplicate is not None:
            raise MigrationError(
                f"Duplicate structured migration allowlist path: {duplicate}."
            )
        object.__setattr__(self, "structured_key_allowlist", policies)
        if not isinstance(self.reconciles_managed_payload, bool):
            raise MigrationError(
                "Migration reconciles_managed_payload flag must be boolean."
            )


@dataclass(frozen=True, slots=True)
class MigrationRun:
    migrations: tuple[Migration, ...]
    operations: tuple[Operation, ...]
    applied_ids: tuple[str, ...]
    resulting_applied_ids: tuple[str, ...]

    @property
    def is_noop(self) -> bool:
        return not self.migrations

    @property
    def reconciles_managed_payload(self) -> bool:
        return any(
            migration.reconciles_managed_payload for migration in self.migrations
        )


class MigrationRegistry:
    """Validated registry with stable order and idempotent selection."""

    def __init__(self, migrations: Iterable[Migration] = ()) -> None:
        ordered = tuple(
            sorted(migrations, key=lambda item: (item.order, item.migration_id))
        )
        identifiers = [migration.migration_id for migration in ordered]
        duplicate = _duplicate(identifiers)
        if duplicate is not None:
            raise MigrationError(f"Duplicate integration migration id: {duplicate}.")
        for migration in ordered:
            validate_migration(migration)
        self._migrations = ordered

    @property
    def migrations(self) -> tuple[Migration, ...]:
        return self._migrations

    @property
    def ids(self) -> tuple[str, ...]:
        return tuple(migration.migration_id for migration in self._migrations)

    def select(
        self,
        *,
        source_tooling_version: str,
        target_tooling_version: str,
        source_state_schema: int,
        target_state_schema: int,
        applied: Iterable[str] = (),
    ) -> tuple[Migration, ...]:
        applied_ids = frozenset(applied)
        return tuple(
            migration
            for migration in self._migrations
            if migration.migration_id not in applied_ids
            and migration.applies.matches(
                source_tooling_version=source_tooling_version,
                target_tooling_version=target_tooling_version,
                source_state_schema=source_state_schema,
                target_state_schema=target_state_schema,
            )
        )


def build_migration_run(
    registry: MigrationRegistry | None = None,
    *,
    source_tooling_version: str,
    target_tooling_version: str,
    source_state_schema: int,
    target_state_schema: int,
    applied: Iterable[str] = (),
) -> MigrationRun:
    """Build a shell-free operation sequence; execution belongs to a transaction."""

    selected_registry = REGISTRY if registry is None else registry
    already_applied = tuple(dict.fromkeys(applied))
    selected = selected_registry.select(
        source_tooling_version=source_tooling_version,
        target_tooling_version=target_tooling_version,
        source_state_schema=source_state_schema,
        target_state_schema=target_state_schema,
        applied=already_applied,
    )
    operations = tuple(
        operation for migration in selected for operation in migration.operations
    )
    resulting = (*already_applied, *(migration.migration_id for migration in selected))
    return MigrationRun(selected, operations, already_applied, resulting)


def validate_migration(migration: Migration) -> None:
    if not isinstance(migration.migration_id, str) or not MIGRATION_ID.fullmatch(
        migration.migration_id
    ):
        raise MigrationError(
            f"Invalid integration migration id: {migration.migration_id!r}."
        )
    if not isinstance(migration.description, str) or not migration.description.strip():
        raise MigrationError(f"Migration {migration.migration_id} has no description.")
    if not migration.preconditions or not migration.postconditions:
        raise MigrationError(
            f"Migration {migration.migration_id} requires preconditions and postconditions."
        )
    if not isinstance(migration.order, int) or isinstance(migration.order, bool):
        raise MigrationError(
            f"Migration {migration.migration_id} order must be an integer."
        )
    if not isinstance(migration.applies, MigrationApplicability):
        raise MigrationError(
            f"Migration {migration.migration_id} has invalid applicability."
        )
    if any(
        not isinstance(condition, MigrationCondition)
        for condition in migration.preconditions
    ):
        raise MigrationError(
            f"Migration {migration.migration_id} has invalid preconditions."
        )
    if any(
        not isinstance(condition, MigrationCondition)
        for condition in migration.postconditions
    ):
        raise MigrationError(
            f"Migration {migration.migration_id} has invalid postconditions."
        )
    if migration.reconciles_managed_payload:
        _validate_managed_payload_reconciliation(migration)
    elif not migration.operations:
        raise MigrationError(f"Migration {migration.migration_id} has no operations.")
    allowed_keys = {
        policy.path: frozenset(policy.keys)
        for policy in migration.structured_key_allowlist
    }
    for operation in migration.operations:
        _validate_operation(
            migration.migration_id, operation, allowed_keys=allowed_keys
        )


def _validate_managed_payload_reconciliation(migration: Migration) -> None:
    """Validate the one operation-free migration form used after folder replacement."""

    if migration.operations:
        raise MigrationError(
            f"Migration {migration.migration_id} reconciles a managed payload and must not define operations."
        )
    if migration.structured_key_allowlist:
        raise MigrationError(
            f"Migration {migration.migration_id} reconciles a managed payload and must not define structured keys."
        )

    applies = migration.applies
    source_versions = applies.source_tooling_versions
    target_version = applies.target_tooling_version
    source_schemas = applies.source_state_schemas
    target_schema = applies.target_state_schema
    if (
        len(source_versions) != 1
        or target_version is None
        or source_versions[0] == target_version
        or source_versions[0] != source_versions[0].strip()
        or target_version != target_version.strip()
    ):
        raise MigrationError(
            f"Migration {migration.migration_id} managed-payload reconciliation requires one exact source and one different exact target tooling version."
        )
    if (
        len(source_schemas) != 1
        or target_schema is None
        or source_schemas[0] != target_schema
    ):
        raise MigrationError(
            f"Migration {migration.migration_id} managed-payload reconciliation must preserve one exact state schema."
        )

    expected_digest = hashlib.sha256(f"{target_version}\n".encode()).hexdigest()
    expected_conditions = (
        MigrationCondition(
            ConditionKind.SHA256_EQUALS,
            _MANAGED_PAYLOAD_VERSION_PATH,
            Ownership.TOOLING,
            value=expected_digest,
        ),
        MigrationCondition(
            ConditionKind.PATH_EXISTS,
            _MANAGED_PAYLOAD_MANIFEST_PATH,
            Ownership.TOOLING,
        ),
    )
    if (
        migration.preconditions != expected_conditions
        or migration.postconditions != expected_conditions
    ):
        raise MigrationError(
            f"Migration {migration.migration_id} managed-payload reconciliation requires identical canonical tools/VERSION and payload-manifest conditions."
        )


def validate_preconditions(
    migration: Migration, observed: Iterable[ObservedResource]
) -> None:
    validate_conditions(
        migration, migration.preconditions, observed, phase="precondition"
    )


def validate_postconditions(
    migration: Migration, observed: Iterable[ObservedResource]
) -> None:
    validate_conditions(
        migration, migration.postconditions, observed, phase="postcondition"
    )


def validate_conditions(
    migration: Migration,
    conditions: Iterable[MigrationCondition],
    observed: Iterable[ObservedResource],
    *,
    phase: str,
) -> None:
    by_path = {resource.path: resource for resource in observed if resource.exists}
    for condition in conditions:
        actual = by_path.get(condition.path)
        passed = _condition_passes(condition, actual)
        if not passed:
            raise MigrationError(
                f"Migration {migration.migration_id} {phase} failed: {condition.kind.value} {condition.path}."
            )


def _condition_passes(
    condition: MigrationCondition, observed: ObservedResource | None
) -> bool:
    if condition.kind is ConditionKind.PATH_EXISTS:
        return (
            observed is not None
            and not observed.is_symlink
            and observed.ownership is condition.ownership
        )
    if condition.kind is ConditionKind.PATH_MISSING:
        return observed is None
    if (
        observed is None
        or observed.is_symlink
        or observed.ownership is not condition.ownership
    ):
        return False
    if condition.kind is ConditionKind.SHA256_EQUALS:
        return observed.sha256 == condition.value
    if condition.kind is ConditionKind.STRUCTURED_EQUALS:
        found, value = _structured_value(
            observed.structured_values, condition.key or ""
        )
        return found and value == condition.value
    return False


def _validate_operation(
    migration_id: str,
    operation: Operation,
    *,
    allowed_keys: Mapping[str, frozenset[str]],
) -> None:
    path = _migration_path(operation.path)
    if path != operation.path:
        raise MigrationError(
            f"Migration {migration_id} operation path is not canonical: {operation.path!r}."
        )
    if operation.ownership is Ownership.PROJECT:
        raise MigrationError(
            f"Migration {migration_id} cannot modify project-owned path {operation.path}."
        )
    if not isinstance(operation.kind, OperationKind):
        raise MigrationError(
            f"Migration {migration_id} uses unsupported operation {operation.kind!r}."
        )
    if operation.kind is OperationKind.MOVE:
        if not operation.source_path:
            raise MigrationError(f"Migration {migration_id} MOVE requires source_path.")
        _migration_path(operation.source_path)
    elif operation.source_path is not None:
        raise MigrationError(
            f"Migration {migration_id} only MOVE may define source_path."
        )
    if operation.kind is OperationKind.PATCH:
        if operation.ownership is not Ownership.STRUCTURED:
            raise MigrationError(
                f"Migration {migration_id} PATCH requires structured ownership."
            )
        if operation.content is not None or not operation.structured_changes:
            raise MigrationError(
                f"Migration {migration_id} PATCH must contain only known-key changes."
            )
        if operation.expected_sha256 is None:
            raise MigrationError(
                f"Migration {migration_id} PATCH requires a preimage digest."
            )
        _validate_digest(migration_id, operation)
        duplicate_key = _duplicate(
            change.key for change in operation.structured_changes
        )
        if duplicate_key is not None:
            raise MigrationError(
                f"Migration {migration_id} PATCH repeats structured key {duplicate_key}."
            )
        declared = allowed_keys.get(operation.path)
        if declared is None:
            raise MigrationError(
                f"Migration {migration_id} PATCH has no structured-key allowlist for {operation.path}."
            )
        undeclared = sorted(
            change.key
            for change in operation.structured_changes
            if change.key not in declared
        )
        if undeclared:
            raise MigrationError(
                f"Migration {migration_id} PATCH uses undeclared structured keys at {operation.path}: "
                f"{', '.join(undeclared)}."
            )
        return
    if operation.ownership is not Ownership.TOOLING:
        raise MigrationError(
            f"Migration {migration_id} may only use {operation.kind.value} for tooling-owned paths."
        )
    if (
        operation.kind in {OperationKind.ADD, OperationKind.UPDATE}
        and operation.content is None
    ):
        raise MigrationError(
            f"Migration {migration_id} {operation.kind.value} requires content."
        )
    if (
        operation.kind
        in {OperationKind.UPDATE, OperationKind.DELETE, OperationKind.MOVE}
        and operation.expected_sha256 is None
    ):
        raise MigrationError(
            f"Migration {migration_id} {operation.kind.value} requires a preimage digest."
        )
    if operation.expected_sha256 is not None:
        _validate_digest(migration_id, operation)
    if (
        operation.kind in {OperationKind.ADD, OperationKind.ENSURE_DIRECTORY}
        and operation.expected_sha256 is not None
    ):
        raise MigrationError(
            f"Migration {migration_id} {operation.kind.value} cannot define a preimage digest."
        )
    if (
        operation.kind in {OperationKind.ADD, OperationKind.UPDATE}
        and operation.structured_changes
    ):
        raise MigrationError(
            f"Migration {migration_id} {operation.kind.value} cannot carry structured changes."
        )
    if operation.kind in {
        OperationKind.DELETE,
        OperationKind.MOVE,
        OperationKind.ENSURE_DIRECTORY,
    } and (operation.content is not None or operation.structured_changes):
        raise MigrationError(
            f"Migration {migration_id} {operation.kind.value} cannot carry replacement content."
        )


def _structured_value(payload: Mapping[str, Any], dotted: str) -> tuple[bool, Any]:
    if dotted in payload:
        return True, payload[dotted]
    current: Any = payload
    for part in dotted.split("."):
        if not isinstance(current, Mapping) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _migration_path(value: str) -> str:
    try:
        return safe_relative_path(value)
    except PlanningError as exc:
        raise MigrationError(str(exc)) from exc


def _validate_digest(migration_id: str, operation: Operation) -> None:
    if not isinstance(operation.expected_sha256, str) or not _SHA256.fullmatch(
        operation.expected_sha256
    ):
        raise MigrationError(
            f"Migration {migration_id} {operation.kind} has an invalid preimage digest."
        )


MigrationRange = MigrationApplicability
select_migrations = build_migration_run


def _managed_payload_reconciliation(
    source_version: str,
    target_version: str,
    *,
    order: int,
) -> Migration:
    target_conditions = (
        MigrationCondition(
            ConditionKind.SHA256_EQUALS,
            _MANAGED_PAYLOAD_VERSION_PATH,
            Ownership.TOOLING,
            value=hashlib.sha256(f"{target_version}\n".encode()).hexdigest(),
        ),
        MigrationCondition(
            ConditionKind.PATH_EXISTS,
            _MANAGED_PAYLOAD_MANIFEST_PATH,
            Ownership.TOOLING,
        ),
    )
    source_slug = source_version.replace(".", "-")
    target_slug = target_version.replace(".", "-")
    return Migration(
        migration_id=(f"reconcile-managed-payload-{source_slug}-to-{target_slug}"),
        description=(
            "Reconcile the externally replaced managed tooling payload with "
            f"tooling {target_version}"
        ),
        order=order,
        applies=MigrationApplicability(
            source_tooling_versions=(source_version,),
            target_tooling_version=target_version,
            source_state_schemas=(1,),
            target_state_schema=1,
        ),
        operations=(),
        preconditions=target_conditions,
        postconditions=target_conditions,
        reconciles_managed_payload=True,
    )


REGISTRY = MigrationRegistry(
    (
        _managed_payload_reconciliation("0.1.0", "0.2.0", order=10),
        _managed_payload_reconciliation("0.1.0", "0.3.0", order=20),
        _managed_payload_reconciliation("0.2.0", "0.3.0", order=30),
        _managed_payload_reconciliation("0.1.0", "0.4.0", order=40),
        _managed_payload_reconciliation("0.2.0", "0.4.0", order=50),
        _managed_payload_reconciliation("0.3.0", "0.4.0", order=60),
    )
)
