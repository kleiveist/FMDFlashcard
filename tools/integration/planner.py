"""Deterministic observed-state to desired-profile planning."""

from __future__ import annotations

import hashlib
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any

from tools.core.filesystem import FilesystemSafetyError
from tools.core.filesystem import safe_relative_path as core_safe_relative_path
from tools.integration.model import (
    UNSET,
    Conflict,
    IntegrationPlan,
    Operation,
    OperationKind,
    Ownership,
    PlanningError,
    StructuredChange,
)


@dataclass(frozen=True, slots=True)
class ObservedResource:
    """Read-only detection result supplied by an integration adapter."""

    path: str
    ownership: Ownership | str | None = None
    exists: bool = True
    sha256: str | None = None
    kind: str = "file"
    is_symlink: bool = False
    structured_values: Mapping[str, Any] = field(
        default_factory=dict, compare=False, repr=False
    )

    def __post_init__(self) -> None:
        object.__setattr__(self, "path", safe_relative_path(self.path))
        if self.ownership is not None and not isinstance(self.ownership, Ownership):
            try:
                object.__setattr__(
                    self, "ownership", Ownership(str(self.ownership).strip().lower())
                )
            except ValueError as exc:
                raise PlanningError(
                    f"Unsupported observed ownership at {self.path}: {self.ownership!r}."
                ) from exc
        if self.kind not in {"file", "directory"}:
            raise PlanningError(
                f"Unsupported observed resource kind at {self.path}: {self.kind!r}."
            )
        object.__setattr__(self, "structured_values", dict(self.structured_values))


@dataclass(frozen=True, slots=True)
class DesiredResource:
    """One path-level requirement contributed by the selected profile/adapters."""

    path: str
    ownership: Ownership | str
    content: bytes | str | None = field(default=None, repr=False)
    sha256: str | None = None
    structured_changes: tuple[StructuredChange, ...] = ()
    remove: bool = False
    required: bool = True
    reason: str = "required by the desired profile"
    kind: str = "file"

    def __post_init__(self) -> None:
        object.__setattr__(self, "path", safe_relative_path(self.path))
        if not isinstance(self.ownership, Ownership):
            try:
                object.__setattr__(
                    self, "ownership", Ownership(str(self.ownership).strip().lower())
                )
            except ValueError as exc:
                raise PlanningError(
                    f"Unsupported desired ownership at {self.path}: {self.ownership!r}."
                ) from exc
        content = (
            self.content.encode("utf-8")
            if isinstance(self.content, str)
            else self.content
        )
        if content is not None and not isinstance(content, bytes):
            raise PlanningError(
                f"Desired content must be bytes or text at {self.path}."
            )
        object.__setattr__(self, "content", content)
        changes = tuple(sorted(self.structured_changes, key=lambda change: change.key))
        duplicate = _duplicate(change.key for change in changes)
        if duplicate is not None:
            raise PlanningError(
                f"Duplicate structured key at {self.path}: {duplicate}."
            )
        object.__setattr__(self, "structured_changes", changes)
        if self.kind not in {"file", "directory"}:
            raise PlanningError(
                f"Unsupported desired resource kind at {self.path}: {self.kind!r}."
            )
        digest = hashlib.sha256(content).hexdigest() if content is not None else None
        if digest is not None and self.sha256 is not None and digest != self.sha256:
            raise PlanningError(
                f"Desired content digest does not match declared sha256 at {self.path}."
            )
        if digest is not None and self.sha256 is None:
            object.__setattr__(self, "sha256", digest)


@dataclass(frozen=True, slots=True)
class DesiredProfile:
    profile: str
    resources: tuple[DesiredResource, ...]
    features: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        profile = self.profile.strip()
        if not profile:
            raise PlanningError("Desired profile id must not be empty.")
        object.__setattr__(self, "profile", profile)
        object.__setattr__(self, "resources", tuple(self.resources))
        object.__setattr__(
            self, "features", tuple(sorted(dict.fromkeys(self.features)))
        )


def create_plan(
    observed: Iterable[ObservedResource],
    desired: DesiredProfile,
) -> IntegrationPlan:
    """Compare adapter observations with desired profile inputs without I/O."""

    observed_by_path = _unique_by_path(observed, label="observed")
    desired_by_path = _unique_by_path(desired.resources, label="desired")
    operations: list[Operation] = []
    conflicts: list[Conflict] = []
    for path in sorted(desired_by_path):
        requirement = desired_by_path[path]
        actual = observed_by_path.get(path)
        if actual is not None and not actual.exists:
            actual = None
        if requirement.ownership is Ownership.PROJECT:
            _plan_project(requirement, actual, conflicts)
        elif requirement.ownership is Ownership.STRUCTURED:
            _plan_structured(requirement, actual, operations, conflicts)
        else:
            _plan_tooling(requirement, actual, operations, conflicts)

    operations.sort(
        key=lambda operation: (
            operation.path,
            str(operation.kind),
            operation.source_path or "",
        )
    )
    conflicts.sort(key=lambda conflict: (conflict.path, conflict.code, conflict.reason))
    if any(operation.ownership is Ownership.PROJECT for operation in operations):
        raise PlanningError(
            "Planner invariant violated: a project-owned write was emitted."
        )
    return IntegrationPlan(
        profile=desired.profile,
        desired_features=desired.features,
        operations=tuple(operations),
        conflicts=tuple(conflicts),
    )


def _plan_project(
    desired: DesiredResource,
    observed: ObservedResource | None,
    conflicts: list[Conflict],
) -> None:
    requested_change = (
        desired.remove
        or desired.content is not None
        or bool(desired.structured_changes)
    )
    if requested_change:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.PROJECT,
                "project-owned content cannot be changed automatically",
                "project-owned-write",
            )
        )
        return
    if desired.required and observed is None:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.PROJECT,
                "required project-owned path is missing",
                "project-path-missing",
            )
        )
        return
    if (
        desired.sha256 is not None
        and observed is not None
        and observed.sha256 != desired.sha256
    ):
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.PROJECT,
                "project-owned content differs from the required state",
                "project-content-mismatch",
            )
        )


def _plan_tooling(
    desired: DesiredResource,
    observed: ObservedResource | None,
    operations: list[Operation],
    conflicts: list[Conflict],
) -> None:
    if desired.structured_changes:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.TOOLING,
                "tooling files cannot use structured patch input",
                "invalid-input",
            )
        )
        return
    if observed is not None and observed.ownership not in {None, Ownership.TOOLING}:
        conflicts.append(
            Conflict(
                desired.path,
                observed.ownership or Ownership.PROJECT,
                "existing path is not tooling-owned",
                "ownership-mismatch",
            )
        )
        return
    if observed is not None and observed.is_symlink:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.TOOLING,
                "managed writes do not follow symbolic links",
                "symlink-path",
            )
        )
        return
    if desired.remove:
        if observed is not None:
            if observed.kind != "file":
                conflicts.append(
                    Conflict(
                        desired.path,
                        Ownership.TOOLING,
                        "recursive tooling directory deletion is not a path-level operation",
                        "tooling-directory-delete",
                    )
                )
                return
            if observed.sha256 is None:
                conflicts.append(
                    Conflict(
                        desired.path,
                        Ownership.TOOLING,
                        "tooling target has no verified preimage digest",
                        "tooling-preimage-missing",
                    )
                )
                return
            operations.append(
                Operation(
                    OperationKind.DELETE,
                    desired.path,
                    Ownership.TOOLING,
                    expected_sha256=observed.sha256,
                    reason=desired.reason,
                )
            )
        return
    if observed is not None and observed.kind != desired.kind:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.TOOLING,
                "existing path has the wrong filesystem kind",
                "kind-mismatch",
            )
        )
        return
    if desired.kind == "directory":
        if observed is None:
            operations.append(
                Operation(
                    OperationKind.ENSURE_DIRECTORY,
                    desired.path,
                    Ownership.TOOLING,
                    reason=desired.reason,
                )
            )
        return
    if observed is not None and observed.sha256 is None:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.TOOLING,
                "tooling target has no verified preimage digest",
                "tooling-preimage-missing",
            )
        )
        return
    if (
        observed is not None
        and desired.sha256 is not None
        and observed.sha256 == desired.sha256
    ):
        return
    if desired.content is None:
        if observed is None and not desired.required:
            return
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.TOOLING,
                "desired tooling file has no materialized content",
                "missing-content",
            )
        )
        return
    operations.append(
        Operation(
            OperationKind.ADD if observed is None else OperationKind.UPDATE,
            desired.path,
            Ownership.TOOLING,
            content=desired.content,
            expected_sha256=None if observed is None else observed.sha256,
            reason=desired.reason,
        )
    )


def _plan_structured(
    desired: DesiredResource,
    observed: ObservedResource | None,
    operations: list[Operation],
    conflicts: list[Conflict],
) -> None:
    if desired.remove or desired.content is not None or desired.sha256 is not None:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.STRUCTURED,
                "structured files may only receive known-key patches, never full replacement",
                "structured-full-replacement",
            )
        )
        return
    if observed is not None and observed.ownership not in {None, Ownership.STRUCTURED}:
        conflicts.append(
            Conflict(
                desired.path,
                observed.ownership or Ownership.PROJECT,
                "existing path is not structured-managed",
                "ownership-mismatch",
            )
        )
        return
    if observed is not None and (observed.is_symlink or observed.kind != "file"):
        code = "symlink-path" if observed.is_symlink else "kind-mismatch"
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.STRUCTURED,
                "structured target is not a safe regular file",
                code,
            )
        )
        return
    if observed is None:
        if not desired.required:
            return
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.STRUCTURED,
                "structured target is missing; creation requires a dedicated owned-file operation",
                "structured-path-missing",
            )
        )
        return
    if observed.sha256 is None:
        conflicts.append(
            Conflict(
                desired.path,
                Ownership.STRUCTURED,
                "structured target has no verified preimage digest",
                "structured-preimage-missing",
            )
        )
        return
    if not desired.structured_changes:
        return

    pending: list[StructuredChange] = []
    values = {} if observed is None else observed.structured_values
    for change in desired.structured_changes:
        found, actual = _structured_value(values, change.key)
        if change.expected is not UNSET and (not found or actual != change.expected):
            conflicts.append(
                Conflict(
                    desired.path,
                    Ownership.STRUCTURED,
                    f"structured precondition failed for key {change.key}",
                    "structured-precondition",
                )
            )
            continue
        if not found or actual != change.value:
            pending.append(change)
    if pending and not any(conflict.path == desired.path for conflict in conflicts):
        operations.append(
            Operation(
                OperationKind.PATCH,
                desired.path,
                Ownership.STRUCTURED,
                expected_sha256=observed.sha256,
                reason=desired.reason,
                structured_changes=tuple(pending),
            )
        )


def safe_relative_path(value: str) -> str:
    """Return one canonical portable relative path or raise ``PlanningError``."""

    if not isinstance(value, str):
        raise PlanningError(f"Integration path must be a text path: {value!r}.")
    try:
        return core_safe_relative_path(value)
    except FilesystemSafetyError as exc:
        raise PlanningError(str(exc)) from exc


def _structured_value(payload: Mapping[str, Any], dotted: str) -> tuple[bool, Any]:
    if dotted in payload:
        return True, payload[dotted]
    current: Any = payload
    for part in dotted.split("."):
        if not isinstance(current, Mapping) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _unique_by_path(items: Iterable[Any], *, label: str) -> dict[str, Any]:
    mapped: dict[str, Any] = {}
    portable_paths: dict[str, str] = {}
    for item in items:
        collision_key = item.path.casefold()
        if collision_key in portable_paths:
            raise PlanningError(
                f"Duplicate or case-colliding {label} integration path: {item.path}."
            )
        portable_paths[collision_key] = item.path
        mapped[item.path] = item
    return mapped


def _duplicate(values: Iterable[str]) -> str | None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None


# More explicit names for callers that prefer them.
ObservedPath = ObservedResource
DesiredPath = DesiredResource
ProfileInputs = DesiredProfile
plan_integration = create_plan
