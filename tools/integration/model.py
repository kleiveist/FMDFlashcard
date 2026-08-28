"""Data contracts for profile-driven tooling integration.

The integration model deliberately describes only the current project and the
desired profile state.  It carries no source-repository provenance or product
baseline information.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class IntegrationError(RuntimeError):
    """A safe integration failure suitable for presentation by a CLI."""


class PlanningError(IntegrationError):
    """Raised when observed or desired planner input is invalid."""


class MigrationError(IntegrationError):
    """Raised for an invalid or unsatisfied tooling migration."""


class VerificationError(IntegrationError):
    """Raised when a verifier violates the integration verification contract."""


class ReportError(IntegrationError):
    """Raised when integration evidence cannot be written safely."""


class Ownership(str, Enum):
    """Filesystem ownership boundaries enforced by planning and application."""

    TOOLING = "tooling"
    PROJECT = "project"
    STRUCTURED = "structured"


class OperationKind(str, Enum):
    """Declarative, shell-free filesystem operation kinds."""

    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MOVE = "MOVE"
    PATCH = "PATCH"
    ENSURE_DIRECTORY = "ENSURE_DIRECTORY"


class FindingStatus(str, Enum):
    PASS = "PASS"
    WARN = "WARN"
    FAIL = "FAIL"
    INFO = "INFO"


class _UnsetType:
    __slots__ = ()

    def __repr__(self) -> str:
        return "UNSET"


UNSET = _UnsetType()


def _ownership(value: Ownership | str) -> Ownership:
    if isinstance(value, Ownership):
        return value
    normalized = str(value).strip().lower()
    try:
        return Ownership(normalized)
    except ValueError as exc:
        raise ValueError(f"Unsupported ownership: {value!r}.") from exc


def _operation_kind(value: OperationKind | str) -> OperationKind | str:
    if isinstance(value, OperationKind):
        return value
    normalized = str(value).strip().upper()
    try:
        return OperationKind(normalized)
    except ValueError:
        # Keeping an unknown value representable lets safety boundaries reject
        # it explicitly instead of silently coercing it to a write operation.
        return normalized


def _finding_status(value: FindingStatus | str) -> FindingStatus:
    if isinstance(value, FindingStatus):
        return value
    try:
        return FindingStatus(str(value).strip().upper())
    except ValueError as exc:
        raise ValueError(f"Unsupported finding status: {value!r}.") from exc


@dataclass(frozen=True, slots=True)
class StructuredChange:
    """One known dotted key update that preserves all unmentioned keys."""

    key: str
    value: Any = field(repr=False)
    expected: Any = field(default=UNSET, repr=False)

    def __post_init__(self) -> None:
        normalized = self.key.strip()
        if not normalized or any(not part for part in normalized.split(".")):
            raise ValueError(f"Invalid structured key: {self.key!r}.")
        object.__setattr__(self, "key", normalized)

    @property
    def has_expected_value(self) -> bool:
        return self.expected is not UNSET


@dataclass(frozen=True, slots=True)
class Operation:
    """A proposed change; payloads are intentionally omitted from repr output."""

    kind: OperationKind | str
    path: str
    ownership: Ownership | str
    content: bytes | str | None = field(default=None, repr=False)
    expected_sha256: str | None = None
    reason: str = ""
    source_path: str | None = None
    structured_changes: tuple[StructuredChange, ...] = field(default=(), repr=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "kind", _operation_kind(self.kind))
        object.__setattr__(self, "ownership", _ownership(self.ownership))
        if isinstance(self.content, str):
            object.__setattr__(self, "content", self.content.encode("utf-8"))
        elif self.content is not None and not isinstance(self.content, bytes):
            raise TypeError("Operation content must be bytes, text, or None.")
        object.__setattr__(self, "structured_changes", tuple(self.structured_changes))

    @property
    def changes_filesystem(self) -> bool:
        return self.kind in {
            OperationKind.ADD,
            OperationKind.UPDATE,
            OperationKind.DELETE,
            OperationKind.MOVE,
            OperationKind.PATCH,
            OperationKind.ENSURE_DIRECTORY,
        }


@dataclass(frozen=True, slots=True)
class Conflict:
    path: str
    ownership: Ownership | str
    reason: str
    code: str = "unsafe-operation"

    def __post_init__(self) -> None:
        object.__setattr__(self, "ownership", _ownership(self.ownership))


@dataclass(frozen=True, slots=True)
class IntegrationPlan:
    """Deterministic comparison of observed state and one desired profile."""

    profile: str = ""
    desired_features: tuple[str, ...] = ()
    operations: tuple[Operation, ...] = ()
    conflicts: tuple[Conflict, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "desired_features", tuple(self.desired_features))
        object.__setattr__(self, "operations", tuple(self.operations))
        object.__setattr__(self, "conflicts", tuple(self.conflicts))

    @property
    def required_changes(self) -> int:
        return len(self.operations)

    @property
    def can_apply(self) -> bool:
        return not self.conflicts and all(
            operation.ownership is not Ownership.PROJECT
            for operation in self.operations
        )

    @property
    def ok(self) -> bool:
        return self.can_apply

    @property
    def is_noop(self) -> bool:
        return not self.operations and not self.conflicts

    @property
    def status(self) -> str:
        if self.conflicts:
            return "CONFLICT"
        return "INTEGRATED" if not self.operations else "FIX_REQUIRED"


@dataclass(frozen=True, slots=True)
class Finding:
    check: str
    status: FindingStatus | str
    message: str
    adapter: str | None = None
    path: str | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "status", _finding_status(self.status))


@dataclass(frozen=True, slots=True)
class VerificationResult:
    findings: tuple[Finding, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "findings", tuple(self.findings))

    @property
    def ok(self) -> bool:
        return all(
            finding.status is not FindingStatus.FAIL for finding in self.findings
        )

    @property
    def failures(self) -> tuple[Finding, ...]:
        return tuple(
            finding for finding in self.findings if finding.status is FindingStatus.FAIL
        )

    @property
    def warnings(self) -> tuple[Finding, ...]:
        return tuple(
            finding for finding in self.findings if finding.status is FindingStatus.WARN
        )


@dataclass(frozen=True, slots=True)
class IntegrationResult:
    outcome: str
    plan: IntegrationPlan
    verification: VerificationResult | None = None
    applied_operations: tuple[Operation, ...] = ()
    report_path: Path | None = None

    @property
    def ok(self) -> bool:
        return self.plan.can_apply and (
            self.verification is None or self.verification.ok
        )


# Compatibility-friendly descriptive aliases for adapter authors.
PlanOperation = Operation
PlanConflict = Conflict
VerificationFinding = Finding
