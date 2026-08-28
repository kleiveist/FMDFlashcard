"""Transactional application of safe, profile-driven integration plans."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import os
import re
import shutil
import stat
import sys
import tempfile
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any

import tomllib

from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write,
    ensure_directory,
    read_regular_bytes,
    safe_join,
    safe_relative_path,
    validate_root,
)
from tools.core.manifest import is_protected_relative_path
from tools.core.project_config import (
    SUPPORTED_SCHEMA_VERSION,
    ProjectConfig,
    ProjectPathConfig,
    render_project_config,
)
from tools.integration.model import (
    UNSET,
    FindingStatus,
    IntegrationError,
    IntegrationPlan,
    IntegrationResult,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)
from tools.integration.sanitize import sanitize_text

DEFAULT_MANAGED_ROOTS = ("tools", "docs/toolingdocs", ".tooling-state")
DEFAULT_REPORT_RELATIVE = ".tooling-state/reports"
_STATE_PREFIX = ".tooling-state/"
_SHA256 = re.compile(r"(?:sha256:)?([0-9a-f]{64})")
_STRUCTURED_FILE_NAMES = {
    "Cargo.toml",
    "package.json",
    "project-tooling.toml",
    "pyproject.toml",
    "tauri.conf.json",
}
_WORKFLOW_SUFFIXES = {".yaml", ".yml"}
_PROJECT_CONFIG_RELATIVE = "project-tooling.toml"
_PROJECT_CONFIG_KEYS = {
    "schema_version",
    "tooling.version",
    "project.name",
    "project.profile",
    "paths.frontend",
    "paths.backend",
    "paths.tauri",
    "paths.docs",
    "features.optional",
}
_DATA_DIRECTORIES = {
    ".data",
    "data",
    "storage",
    "uploads",
    "user-data",
    "user_data",
    "userdata",
}
_PRODUCT_SOURCE_PREFIXES = {
    ("frontend", "src"),
    ("backend", "app"),
    ("src-tauri", "src"),
}
_PROTECTED_ROOTS = {".git"}
_RESERVED_STATE_DIRECTORIES = {"backups", "reports", "runtime", "venv"}
_SENSITIVE_DIRECTORIES = {".secrets", "credentials", "secrets"}
_SENSITIVE_NAMES = {
    ".env",
    ".netrc",
    ".npmrc",
    ".pypirc",
    "credentials.json",
    "credentials.toml",
    "credentials.yaml",
    "credentials.yml",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
    "service-account.json",
    "service_account.json",
    "secrets.json",
    "secrets.toml",
    "secrets.yaml",
    "secrets.yml",
}
_SENSITIVE_SUFFIXES = {
    ".db",
    ".key",
    ".p12",
    ".pem",
    ".pfx",
    ".sqlite",
    ".sqlite3",
}
_STAGING_IGNORED_DIRECTORIES = {
    ".git",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "coverage",
    "dist",
    "node_modules",
    "playwright-report",
    "target",
    "test-results",
}
_TEST_FAILPOINT_ENV = "TOOLING_TEST_FAILPOINT"

Verifier = Callable[[Path], VerificationResult]
ReportFinalizer = Callable[[VerificationResult, str], None]
PostApply = Callable[[Path], VerificationResult | None]
StagedAction = Callable[[Path], VerificationResult]


@dataclass(frozen=True, slots=True)
class TransactionRequest:
    """Inputs required to apply one immutable integration plan."""

    project_root: Path
    plan: IntegrationPlan
    verifier: Verifier
    report_directory: Path | None = None
    report_finalizer: ReportFinalizer | None = None
    managed_roots: tuple[str, ...] = DEFAULT_MANAGED_ROOTS
    post_apply: PostApply | None = None
    staged_action: StagedAction | None = None
    structured_key_allowlist: Mapping[str, frozenset[str]] = field(default_factory=dict)
    staging_snapshot_paths: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class _PreparedOperation:
    operation: Operation
    path: str
    source_path: str | None


@dataclass(frozen=True, slots=True)
class _BackupEntry:
    path: str
    kind: str
    mode: int | None = None


@dataclass(frozen=True, slots=True)
class _StagedOutput:
    kind: str | None
    sha256: str | None
    mode: int | None


@dataclass(frozen=True, slots=True)
class _FrozenOutput:
    kind: str | None
    content: bytes | None
    sha256: str | None
    mode: int | None


class _ConcurrentCreationError(IntegrationError):
    """A planned exclusive creation lost a race to another filesystem writer."""

    def __init__(self, path: str) -> None:
        super().__init__(f"Integration creation target appeared during commit: {path}.")
        self.path = path


def trigger_test_failpoint(name: str) -> None:
    """Raise a deterministic failure only while an in-process pytest test runs.

    The failpoint switch deliberately has no effect for normal CLI invocations.
    It exists solely so rollback tests can exercise otherwise hard-to-reproduce
    commit and verification failures without adding production-only branches.
    """

    if not _test_failpoints_enabled():
        return
    selected = os.environ.get(_TEST_FAILPOINT_ENV, "").strip()
    if selected != name:
        return
    raise IntegrationError(f"Deterministic test failpoint triggered: {name}.")


def _test_failpoints_enabled() -> bool:
    """Return whether pytest, rather than a normal process, enabled injection."""

    return bool(os.environ.get("PYTEST_CURRENT_TEST")) and "pytest" in sys.modules


def apply_transaction(request: TransactionRequest) -> IntegrationResult:
    """Stage, verify, apply, verify again, and roll back every failed apply."""

    root = _safe_project_root(request.project_root)
    if request.plan.conflicts:
        raise IntegrationError(
            "Integration plan contains conflicts; no project files were changed."
        )
    managed_roots = _normalize_managed_roots(request.managed_roots)
    structured_key_allowlist = _normalize_structured_key_allowlist(
        request.structured_key_allowlist
    )
    staging_snapshot_paths = _normalize_staging_snapshot_paths(
        request.staging_snapshot_paths,
        managed_roots,
    )
    prepared = _prepare_operations(
        root,
        request.plan.operations,
        managed_roots,
        structured_key_allowlist,
    )
    if not prepared:
        result = _run_verifier(request.verifier, root)
        if not result.ok:
            raise IntegrationError("No-op integration verification failed.")
        return IntegrationResult("INTEGRATED", request.plan, result, ())

    report_directory = _safe_report_directory(root, request.report_directory)
    with tempfile.TemporaryDirectory(
        prefix=f".{root.name}.tooling-integration-", dir=root.parent
    ) as temporary:
        scratch = Path(temporary)
        staging = scratch / "staging"
        backup = scratch / "backup"
        _copy_staging_tree(root, staging, staging_snapshot_paths)
        _apply_to_staging(staging, prepared)
        staged_outputs = _snapshot_staged_outputs(staging, prepared)
        staged_action_result = _run_staged_action(request.staged_action, staging)
        _validate_staged_outputs(staging, prepared, staged_outputs)
        if staged_action_result is not None and not staged_action_result.ok:
            _finalize_report(
                request.report_finalizer,
                staged_action_result,
                "FAILED",
            )
            detail = _verification_failure_detail(staged_action_result, staging)
            suffix = f" Details: {detail}" if detail else ""
            raise IntegrationError(
                f"Staged action verification failed; target remains unchanged.{suffix}"
            )
        staged_result = _run_verifier(request.verifier, staging)
        if not staged_result.ok:
            failed_result = _combine_verification_results(
                staged_action_result,
                staged_result,
            )
            _finalize_report(request.report_finalizer, failed_result, "FAILED")
            raise IntegrationError(
                "Staged integration verification failed; target remains unchanged."
            )
        frozen_outputs = _freeze_staged_outputs(staging, prepared, staged_outputs)

        affected = _affected_paths(prepared)
        journal_path = _write_journal(
            report_directory,
            request.plan,
            root,
            prepared,
            affected,
            frozen_outputs,
        )
        backups = _backup_paths(root, backup, affected)
        _validate_preimages(root, prepared)
        try:
            _apply_from_staging(root, prepared, frozen_outputs)
            post_apply_result = _run_post_apply(request.post_apply, root)
            if post_apply_result is not None and not post_apply_result.ok:
                _finalize_report(
                    request.report_finalizer,
                    post_apply_result,
                    "FAILED",
                )
                raise IntegrationError("Post-apply action verification failed.")
            result = _run_verifier(request.verifier, root)
            trigger_test_failpoint("post_verify")
            result = _combine_verification_results(
                staged_action_result,
                post_apply_result,
                result,
            )
            if not result.ok:
                _finalize_report(request.report_finalizer, result, "FAILED")
                raise IntegrationError("Post-integration verification failed.")
            _finalize_report(request.report_finalizer, result, "INTEGRATED")
            return IntegrationResult(
                "INTEGRATED",
                request.plan,
                result,
                tuple(item.operation for item in prepared),
                journal_path,
            )
        except BaseException as exc:
            preserve_missing = (
                (exc.path,) if isinstance(exc, _ConcurrentCreationError) else ()
            )
            try:
                _restore_paths(
                    root,
                    backup,
                    affected,
                    backups,
                    preserve_missing=preserve_missing,
                )
            except (OSError, IntegrationError) as rollback_exc:
                raise IntegrationError(
                    f"Integration failed and rollback could not complete: {rollback_exc}."
                ) from exc
            if isinstance(exc, (KeyboardInterrupt, SystemExit)) or not isinstance(
                exc, Exception
            ):
                raise
            if isinstance(exc, IntegrationError):
                raise
            raise IntegrationError(
                f"Integration failed and was rolled back: {exc}."
            ) from exc


def apply_plan(
    project_root: Path,
    plan: IntegrationPlan,
    *,
    verifier: Verifier,
    report_directory: Path | None = None,
    report_finalizer: ReportFinalizer | None = None,
    managed_roots: tuple[str, ...] = DEFAULT_MANAGED_ROOTS,
    post_apply: PostApply | None = None,
    staged_action: StagedAction | None = None,
    structured_key_allowlist: Mapping[str, frozenset[str]] | None = None,
    staging_snapshot_paths: tuple[str, ...] = (),
) -> IntegrationResult:
    """Convenience entry point for callers that do not need a request object."""

    return apply_transaction(
        TransactionRequest(
            project_root=project_root,
            plan=plan,
            verifier=verifier,
            report_directory=report_directory,
            report_finalizer=report_finalizer,
            managed_roots=managed_roots,
            post_apply=post_apply,
            staged_action=staged_action,
            structured_key_allowlist=structured_key_allowlist or {},
            staging_snapshot_paths=staging_snapshot_paths,
        )
    )


def _safe_project_root(project_root: Path) -> Path:
    try:
        return validate_root(project_root)
    except FilesystemSafetyError as exc:
        raise IntegrationError(str(exc)) from exc


def _normalize_managed_roots(values: Iterable[str]) -> tuple[str, ...]:
    normalized = tuple(_safe_relative(value, label="Managed root") for value in values)
    if not normalized:
        raise IntegrationError("At least one tooling-managed root is required.")
    if len(normalized) != len({value.casefold() for value in normalized}):
        raise IntegrationError("Tooling-managed roots must be unique.")
    return normalized


def _normalize_staging_snapshot_paths(
    values: Iterable[str],
    managed_roots: tuple[str, ...],
) -> tuple[str, ...]:
    normalized = tuple(
        _safe_relative(value, label="Staging snapshot path") for value in values
    )
    if len(normalized) != len({value.casefold() for value in normalized}):
        raise IntegrationError("Staging snapshot paths must be unique.")
    if any(not _under_managed_root(value, managed_roots) for value in normalized):
        raise IntegrationError("Staging snapshot path is outside managed roots.")
    return normalized


def _normalize_structured_key_allowlist(
    values: Mapping[str, frozenset[str]],
) -> dict[str, frozenset[str]]:
    if not isinstance(values, Mapping):
        raise IntegrationError("Structured key allowlist must be a path mapping.")
    normalized: dict[str, frozenset[str]] = {}
    claimed: set[str] = set()
    for raw_path, raw_keys in values.items():
        path = _safe_relative(raw_path, label="Structured allowlist path")
        collision_key = path.casefold()
        if collision_key in claimed:
            raise IntegrationError(
                f"Structured allowlist repeats a path with ambiguous casing: {path}."
            )
        claimed.add(collision_key)
        if not _is_supported_structured_target(path):
            raise IntegrationError(
                f"Structured allowlist targets an unsupported file: {path}."
            )
        if isinstance(raw_keys, (str, bytes)):
            raise IntegrationError(
                f"Structured allowlist keys must be a collection at {path}."
            )
        try:
            keys = frozenset(raw_keys)
        except TypeError as exc:
            raise IntegrationError(
                f"Structured allowlist keys are invalid at {path}."
            ) from exc
        if not keys or any(
            not isinstance(key, str)
            or not key
            or any(not part for part in key.split("."))
            for key in keys
        ):
            raise IntegrationError(f"Structured allowlist keys are invalid at {path}.")
        overlap = _overlapping_dotted_keys(keys)
        if overlap is not None:
            raise IntegrationError(
                f"Structured allowlist keys overlap at {path}: "
                f"{overlap[0]!r} and {overlap[1]!r}."
            )
        normalized[path] = keys
    return normalized


def _is_supported_structured_target(path: str) -> bool:
    relative = PurePosixPath(path)
    if relative.name in _STRUCTURED_FILE_NAMES:
        return True
    return (
        len(relative.parts) == 3
        and relative.parts[:2] == (".github", "workflows")
        and relative.suffix.casefold() in _WORKFLOW_SUFFIXES
    )


def _validate_declared_structured_changes(
    path: str,
    changes: tuple[StructuredChange, ...],
    allowlist: Mapping[str, frozenset[str]],
) -> None:
    overlap = _overlapping_dotted_keys(change.key for change in changes)
    if overlap is not None:
        raise IntegrationError(
            f"Structured PATCH keys overlap at {path}: "
            f"{overlap[0]!r} and {overlap[1]!r}."
        )
    allowed = allowlist.get(path)
    if allowed is None:
        raise IntegrationError(
            f"Structured PATCH has no known-key allowlist for {path}."
        )
    unknown = sorted(change.key for change in changes if change.key not in allowed)
    if unknown:
        raise IntegrationError(
            f"Structured PATCH uses undeclared keys at {path}: {', '.join(unknown)}."
        )


def _prepare_operations(
    root: Path,
    operations: tuple[Operation, ...],
    managed_roots: tuple[str, ...],
    structured_key_allowlist: Mapping[str, frozenset[str]],
) -> tuple[_PreparedOperation, ...]:
    prepared: list[_PreparedOperation] = []
    claimed: dict[str, str] = {}
    for operation in operations:
        path = _safe_relative(operation.path, label="Integration operation path")
        source = (
            _safe_relative(operation.source_path, label="Integration move source")
            if operation.source_path is not None
            else None
        )
        _validate_operation_contract(
            operation,
            path,
            source,
            managed_roots,
            structured_key_allowlist,
        )
        for claimed_path in (path, source):
            if claimed_path is None:
                continue
            collision_key = claimed_path.casefold()
            if collision_key in claimed:
                raise IntegrationError(
                    "Integration plan targets a path more than once or with "
                    f"ambiguous casing: {claimed_path}."
                )
            claimed[collision_key] = claimed_path
        prepared.append(_PreparedOperation(operation, path, source))
    _validate_overlaps(prepared)
    result = tuple(prepared)
    _validate_preimages(root, result)
    return result


def _validate_operation_contract(
    operation: Operation,
    path: str,
    source: str | None,
    managed_roots: tuple[str, ...],
    structured_key_allowlist: Mapping[str, frozenset[str]],
) -> None:
    kind = operation.kind
    if not isinstance(kind, OperationKind):
        raise IntegrationError(f"Unsupported integration operation kind: {kind!r}.")
    if operation.ownership is Ownership.PROJECT:
        raise IntegrationError(
            f"Refusing automatic write to project-owned path: {path}."
        )
    _reject_protected_path(path)
    if source is not None:
        _reject_protected_path(source)

    if operation.ownership is Ownership.TOOLING:
        if not _under_managed_root(path, managed_roots):
            raise IntegrationError(
                f"Tooling operation is outside managed roots: {path}."
            )
        if source is not None and not _under_managed_root(source, managed_roots):
            raise IntegrationError(
                f"Tooling move source is outside managed roots: {source}."
            )
        if kind is OperationKind.PATCH:
            raise IntegrationError(
                "Structured PATCH operations require structured ownership."
            )
    elif operation.ownership is Ownership.STRUCTURED:
        is_project_config_add = (
            kind is OperationKind.ADD and path == _PROJECT_CONFIG_RELATIVE
        )
        if kind is not OperationKind.PATCH and not is_project_config_add:
            raise IntegrationError(
                f"Structured path {path} may only be changed through a key-level "
                "PATCH operation; only the missing root project-tooling.toml may "
                "be created from canonical content."
            )
        if not _is_supported_structured_target(path):
            raise IntegrationError(
                f"Unsupported structured configuration target: {path}."
            )
    else:  # model validation normally prevents reaching this branch
        raise IntegrationError(f"Unsupported ownership for integration path: {path}.")

    content = operation.content
    changes = operation.structured_changes
    if kind in {OperationKind.ADD, OperationKind.UPDATE}:
        if content is None:
            raise IntegrationError(
                f"{kind.value} operation lacks file content: {path}."
            )
        if changes:
            raise IntegrationError(
                f"{kind.value} operation must not contain structured changes: {path}."
            )
    elif kind is OperationKind.PATCH:
        if content is not None:
            raise IntegrationError(
                f"Structured PATCH must not replace the complete file: {path}."
            )
        if not changes:
            raise IntegrationError(f"Structured PATCH has no key changes: {path}.")
    elif kind in {OperationKind.DELETE, OperationKind.ENSURE_DIRECTORY}:
        if content is not None or changes:
            raise IntegrationError(
                f"{kind.value} operation has an unexpected payload: {path}."
            )
    elif kind is OperationKind.MOVE:
        if source is None:
            raise IntegrationError(f"MOVE operation lacks a source path: {path}.")
        if changes:
            raise IntegrationError(
                f"MOVE operation must not contain structured changes: {path}."
            )
        if _is_state_path(path) != _is_state_path(source):
            raise IntegrationError(
                "MOVE operations must not cross the tooling-state boundary."
            )
    if kind is not OperationKind.MOVE and source is not None:
        raise IntegrationError(f"Only MOVE operations may define source_path: {path}.")

    if operation.ownership is Ownership.STRUCTURED and kind is OperationKind.ADD:
        assert content is not None
        _validate_canonical_project_config(content)
    elif (
        operation.ownership is Ownership.STRUCTURED
        and kind is OperationKind.PATCH
        and path == _PROJECT_CONFIG_RELATIVE
    ):
        _validate_project_config_changes(changes)
    elif operation.ownership is Ownership.STRUCTURED and kind is OperationKind.PATCH:
        _validate_declared_structured_changes(
            path,
            changes,
            structured_key_allowlist,
        )

    if kind in {
        OperationKind.UPDATE,
        OperationKind.DELETE,
        OperationKind.MOVE,
        OperationKind.PATCH,
    }:
        _expected_digest(operation, required=True)
    elif operation.expected_sha256 is not None:
        raise IntegrationError(
            f"{kind.value} operation must not define an expected preimage: {path}."
        )


def _validate_overlaps(
    prepared: tuple[_PreparedOperation, ...] | list[_PreparedOperation],
) -> None:
    paths: list[tuple[str, OperationKind | str]] = []
    for item in prepared:
        paths.append((item.path, item.operation.kind))
        if item.source_path is not None:
            paths.append((item.source_path, item.operation.kind))
    for index, (left, left_kind) in enumerate(paths):
        left_parts = tuple(part.casefold() for part in PurePosixPath(left).parts)
        for right, right_kind in paths[index + 1 :]:
            right_parts = tuple(part.casefold() for part in PurePosixPath(right).parts)
            if len(left_parts) == len(right_parts):
                continue
            shorter, longer = (
                (left_parts, right_parts)
                if len(left_parts) < len(right_parts)
                else (right_parts, left_parts)
            )
            if longer[: len(shorter)] != shorter:
                continue
            parent_kind = (
                left_kind if len(left_parts) < len(right_parts) else right_kind
            )
            if parent_kind is not OperationKind.ENSURE_DIRECTORY:
                raise IntegrationError(
                    f"Integration operations overlap: {left} and {right}."
                )


def _overlapping_dotted_keys(values: Iterable[str]) -> tuple[str, str] | None:
    keys = tuple(sorted(values))
    for index, parent in enumerate(keys):
        prefix = f"{parent}."
        for child in keys[index + 1 :]:
            if child.startswith(prefix):
                return parent, child
    return None


def _validate_preimages(root: Path, prepared: tuple[_PreparedOperation, ...]) -> None:
    for item in prepared:
        operation = item.operation
        kind = operation.kind
        target = _safe_target(root, item.path)
        if kind is OperationKind.ADD:
            if _path_exists(target):
                raise IntegrationError(
                    f"Integration path appeared after planning: {item.path}."
                )
            continue
        if kind is OperationKind.ENSURE_DIRECTORY:
            if target.is_symlink() or (target.exists() and not target.is_dir()):
                raise IntegrationError(
                    f"Managed directory path is not a safe directory: {item.path}."
                )
            continue
        preimage_path = item.source_path if kind is OperationKind.MOVE else item.path
        assert preimage_path is not None
        preimage = _safe_target(root, preimage_path)
        if not preimage.exists() or preimage.is_symlink() or not preimage.is_file():
            raise IntegrationError(
                f"Planned integration preimage is missing or unsafe: {preimage_path}."
            )
        actual = _file_digest(preimage)
        expected = _expected_digest(operation, required=True)
        if actual != expected:
            raise IntegrationError(
                f"Integration path changed after planning: {preimage_path}."
            )
        if kind is OperationKind.MOVE and _path_exists(target):
            raise IntegrationError(
                f"Integration move destination appeared after planning: {item.path}."
            )


def _apply_to_staging(staging: Path, prepared: tuple[_PreparedOperation, ...]) -> None:
    for item in _ordered_operations(prepared):
        operation = item.operation
        path = _safe_target(staging, item.path)
        if operation.kind is OperationKind.ENSURE_DIRECTORY:
            _create_directory(path, staging)
        elif operation.kind in {OperationKind.ADD, OperationKind.UPDATE}:
            assert operation.content is not None
            mode = 0o644 if operation.kind is OperationKind.ADD else _file_mode(path)
            _atomic_write_bytes(path, operation.content, root=staging, mode=mode)
        elif operation.kind is OperationKind.DELETE:
            _delete_file(path, staging)
        elif operation.kind is OperationKind.MOVE:
            assert item.source_path is not None
            source = _safe_target(staging, item.source_path)
            mode = _file_mode(source)
            content = (
                operation.content
                if operation.content is not None
                else source.read_bytes()
            )
            _delete_file(source, staging)
            _atomic_write_bytes(path, content, root=staging, mode=mode)
        elif operation.kind is OperationKind.PATCH:
            _apply_structured_patch(path, operation, root=staging)
        else:  # pragma: no cover - contract validation handles unknown kinds
            raise IntegrationError(f"Unsupported staged operation: {operation.kind!r}.")


def _apply_from_staging(
    root: Path,
    prepared: tuple[_PreparedOperation, ...],
    frozen_outputs: Mapping[str, _FrozenOutput],
) -> None:
    state_commit_pending = True
    for index, item in enumerate(_ordered_operations(prepared), start=1):
        trigger_test_failpoint(f"before_operation_{index}")
        if state_commit_pending and _is_state_path(item.path):
            trigger_test_failpoint("state_commit")
            state_commit_pending = False
        operation = item.operation
        if operation.kind is OperationKind.ENSURE_DIRECTORY:
            _create_directory(_safe_target(root, item.path), root)
        elif operation.kind is OperationKind.MOVE:
            assert item.source_path is not None
            _delete_file(_safe_target(root, item.source_path), root)
            _replace_from_frozen(root, item.path, frozen_outputs[item.path])
        elif operation.kind is OperationKind.DELETE:
            _delete_file(_safe_target(root, item.path), root)
        elif (
            operation.kind is OperationKind.ADD
            and operation.ownership is Ownership.STRUCTURED
            and item.path == _PROJECT_CONFIG_RELATIVE
        ):
            _create_from_frozen(root, item.path, frozen_outputs[item.path])
        else:
            _replace_from_frozen(root, item.path, frozen_outputs[item.path])
        trigger_test_failpoint(f"after_operation_{index}")


def _ordered_operations(
    prepared: tuple[_PreparedOperation, ...],
) -> tuple[_PreparedOperation, ...]:
    directories = [
        item
        for item in prepared
        if item.operation.kind is OperationKind.ENSURE_DIRECTORY
    ]
    files = [
        item
        for item in prepared
        if item.operation.kind is not OperationKind.ENSURE_DIRECTORY
    ]
    directories.sort(key=lambda item: (len(PurePosixPath(item.path).parts), item.path))
    non_state = [
        item for item in (*directories, *files) if not _is_state_path(item.path)
    ]
    state = [item for item in (*directories, *files) if _is_state_path(item.path)]
    return (*non_state, *state)


def _apply_structured_patch(path: Path, operation: Operation, *, root: Path) -> None:
    mode = _file_mode(path)
    try:
        payload = path.read_bytes()
        text = payload.decode("utf-8")
    except (OSError, UnicodeError) as exc:
        raise IntegrationError(
            f"Structured configuration is unreadable: {operation.path}."
        ) from exc
    try:
        if path.suffix == ".json":
            document = json.loads(text)
            if not isinstance(document, dict):
                raise IntegrationError(
                    f"Structured JSON must contain an object: {operation.path}."
                )
            _apply_structured_changes(
                document, operation.structured_changes, operation.path
            )
            rendered = (
                json.dumps(document, indent=2, ensure_ascii=False) + "\n"
            ).encode("utf-8")
        elif path.suffix == ".toml":
            document = tomllib.loads(text)
            rendered = _patch_toml_text(
                text,
                document,
                operation.structured_changes,
                operation.path,
            ).encode("utf-8")
        elif path.suffix.casefold() in _WORKFLOW_SUFFIXES:
            rendered = _patch_yaml_text(
                text,
                operation.structured_changes,
                operation.path,
            ).encode("utf-8")
        else:
            raise IntegrationError(
                f"Unsupported structured configuration format: {operation.path}."
            )
    except (json.JSONDecodeError, tomllib.TOMLDecodeError) as exc:
        raise IntegrationError(
            f"Structured configuration is invalid: {operation.path}."
        ) from exc
    _atomic_write_bytes(path, rendered, root=root, mode=mode)


def _apply_structured_changes(
    document: dict[str, Any],
    changes: tuple[StructuredChange, ...],
    relative: str,
) -> None:
    seen: set[str] = set()
    missing = object()
    for change in changes:
        if change.key in seen:
            raise IntegrationError(
                f"Structured key is patched more than once: {change.key}."
            )
        seen.add(change.key)
        parts = change.key.split(".")
        cursor: dict[str, Any] = document
        for part in parts[:-1]:
            current = cursor.get(part, missing)
            if current is missing:
                nested: dict[str, Any] = {}
                cursor[part] = nested
                cursor = nested
            elif isinstance(current, dict):
                cursor = current
            else:
                raise IntegrationError(
                    f"Structured key crosses a non-table value in {relative}: {change.key}."
                )
        key = parts[-1]
        current = cursor.get(key, missing)
        if change.expected is not UNSET and (
            current is missing or current != change.expected
        ):
            raise IntegrationError(
                f"Structured value changed after planning in {relative}: {change.key}."
            )
        cursor[key] = change.value


def _validate_canonical_project_config(content: bytes) -> None:
    """Accept only the exact deterministic rendering of the supported schema."""

    try:
        text = content.decode("utf-8")
        document = tomllib.loads(text)
    except (UnicodeError, tomllib.TOMLDecodeError) as exc:
        raise IntegrationError(
            "New project-tooling.toml content must be valid canonical UTF-8 TOML."
        ) from exc

    expected_top_level = {
        "schema_version",
        "tooling",
        "project",
        "paths",
        "features",
    }
    if set(document) != expected_top_level:
        raise IntegrationError(
            "New project-tooling.toml content must contain only the supported schema keys."
        )
    schema_version = document["schema_version"]
    if isinstance(schema_version, bool) or schema_version != SUPPORTED_SCHEMA_VERSION:
        raise IntegrationError(
            "New project-tooling.toml content has an unsupported schema version."
        )

    tooling = _project_config_table(document, "tooling", {"version"})
    project = _project_config_table(document, "project", {"name", "profile"})
    paths = _project_config_table(
        document,
        "paths",
        {"frontend", "backend", "tauri", "docs"},
    )
    features = _project_config_table(document, "features", {"optional"})
    config = ProjectConfig(
        schema_version=SUPPORTED_SCHEMA_VERSION,
        tooling_version=_project_config_string(tooling["version"], "tooling.version"),
        project_name=_project_config_string(project["name"], "project.name"),
        profile=_project_config_string(project["profile"], "project.profile"),
        paths=ProjectPathConfig(
            frontend=_project_config_path(paths["frontend"], "paths.frontend"),
            backend=_project_config_path(
                paths["backend"], "paths.backend", allow_empty=True
            ),
            tauri=_project_config_path(paths["tauri"], "paths.tauri"),
            docs=_project_config_path(paths["docs"], "paths.docs"),
        ),
        optional_features=_project_config_features(features["optional"]),
    )
    canonical = render_project_config(config).encode("utf-8")
    if content != canonical:
        raise IntegrationError(
            "New project-tooling.toml content must use the canonical project configuration rendering."
        )


def _project_config_table(
    document: Mapping[str, Any], name: str, keys: set[str]
) -> dict[str, Any]:
    value = document.get(name)
    if not isinstance(value, dict) or set(value) != keys:
        raise IntegrationError(
            f"New project-tooling.toml [{name}] must contain only supported keys."
        )
    return value


def _project_config_string(value: Any, key: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str) or value != value.strip():
        raise IntegrationError(
            f"New project-tooling.toml {key} must be a normalized string."
        )
    if not value and not allow_empty:
        raise IntegrationError(f"New project-tooling.toml {key} must not be empty.")
    return value


def _project_config_path(value: Any, key: str, *, allow_empty: bool = False) -> str:
    normalized = _project_config_string(value, key, allow_empty=allow_empty)
    if not normalized:
        return ""
    if normalized == ".":
        return normalized
    try:
        return safe_relative_path(normalized)
    except FilesystemSafetyError as exc:
        raise IntegrationError(
            f"New project-tooling.toml {key} must be a safe project-relative path."
        ) from exc


def _project_config_features(value: Any) -> tuple[str, ...]:
    if not isinstance(value, (list, tuple)):
        raise IntegrationError(
            "New project-tooling.toml features.optional must be a list of strings."
        )
    features: list[str] = []
    for feature in value:
        normalized = _project_config_string(feature, "features.optional item")
        if normalized in features:
            raise IntegrationError(
                "New project-tooling.toml features.optional must not contain duplicates."
            )
        features.append(normalized)
    return tuple(features)


def _validate_project_config_changes(
    changes: tuple[StructuredChange, ...],
) -> None:
    seen: set[str] = set()
    for change in changes:
        if change.key in seen:
            raise IntegrationError(
                f"Structured key is patched more than once: {change.key}."
            )
        seen.add(change.key)
        if change.key not in _PROJECT_CONFIG_KEYS:
            raise IntegrationError(
                "project-tooling.toml PATCH may change only supported schema keys: "
                f"{change.key}."
            )
        if change.key == "schema_version":
            if (
                isinstance(change.value, bool)
                or change.value != SUPPORTED_SCHEMA_VERSION
            ):
                raise IntegrationError(
                    "project-tooling.toml PATCH cannot select an unsupported schema version."
                )
        elif change.key in {
            "paths.frontend",
            "paths.backend",
            "paths.tauri",
            "paths.docs",
        }:
            _project_config_path(
                change.value,
                change.key,
                allow_empty=change.key == "paths.backend",
            )
        elif change.key == "features.optional":
            _project_config_features(change.value)
        else:
            _project_config_string(change.value, change.key)


def _patch_toml_text(
    text: str,
    document: dict[str, Any],
    changes: tuple[StructuredChange, ...],
    relative: str,
) -> str:
    """Patch allowlisted TOML scalars while preserving unrelated source bytes.

    Existing assignments are rewritten in place. A missing, allowlisted scalar
    is appended to its existing table, or a new bare-key table is appended at
    EOF. Implicit and inline tables are refused because changing them would
    require reserializing customer-owned TOML.
    """

    if '"""' in text or "'''" in text:
        raise IntegrationError(
            f"TOML PATCH does not rewrite files with multiline strings: {relative}."
        )
    change_by_path: dict[tuple[str, ...], StructuredChange] = {}
    additions: dict[tuple[str, ...], list[StructuredChange]] = {}
    seen_paths: set[tuple[str, ...]] = set()
    for change in changes:
        path = tuple(change.key.split("."))
        if path in seen_paths:
            raise IntegrationError(
                f"Structured key is patched more than once: {change.key}."
            )
        seen_paths.add(path)
        found, current = _mapping_value(document, path)
        if found:
            if change.expected is not UNSET and current != change.expected:
                raise IntegrationError(
                    f"Structured value changed after planning in {relative}: {change.key}."
                )
            change_by_path[path] = change
            continue
        if change.expected is not UNSET:
            raise IntegrationError(
                f"Structured value changed after planning in {relative}: {change.key}."
            )
        if _toml_bare_path(".".join(path)) is None:
            raise IntegrationError(
                f"TOML PATCH cannot safely add a non-bare key in {relative}: {change.key}."
            )
        additions.setdefault(path[:-1], []).append(change)

    lines = text.splitlines(keepends=True)
    table_ranges = _toml_table_ranges(lines)
    current_table: tuple[str, ...] | None = ()
    replacements: dict[int, str] = {}
    matched: set[tuple[str, ...]] = set()
    for index, line in enumerate(lines):
        body, newline = _split_newline(line)
        raw_code = _toml_code_before_comment(body)
        code = raw_code.strip()
        if not code:
            continue
        if code.startswith("[[") and code.endswith("]]"):
            current_table = None  # array-of-table entries are intentionally not patched
            continue
        if code.startswith("[") and code.endswith("]"):
            current_table = _toml_bare_path(code[1:-1])
            continue
        if current_table is None:
            continue
        equals = raw_code.find("=")
        if equals < 0:
            continue
        key_path = _toml_bare_path(raw_code[:equals])
        if key_path is None:
            continue
        full_path = (*current_table, *key_path)
        change = change_by_path.get(full_path)
        if change is None:
            continue
        rhs = body[equals + 1 :]
        comment = _toml_comment_index(rhs)
        value_region = rhs if comment is None else rhs[:comment]
        suffix = "" if comment is None else rhs[comment:]
        leading = value_region[: len(value_region) - len(value_region.lstrip())]
        trailing = value_region[len(value_region.rstrip()) :]
        old_expression = value_region.strip()
        if not old_expression or not _is_complete_toml_value(old_expression):
            raise IntegrationError(
                f"TOML PATCH only supports existing one-line values in {relative}: {change.key}."
            )
        replacements[index] = (
            body[: equals + 1]
            + leading
            + _toml_value(change.value)
            + trailing
            + suffix
            + newline
        )
        matched.add(full_path)

    missing = [".".join(path) for path in change_by_path if path not in matched]
    if missing:
        raise IntegrationError(
            f"TOML PATCH could not locate a safe scalar assignment in {relative}: {missing[0]}."
        )

    insertions: dict[int, list[str]] = {}
    newline = _toml_preferred_newline(lines)
    for table, table_changes in sorted(additions.items()):
        _validate_toml_addition_table(document, table, table_ranges, relative)
        rendered = _toml_assignment_block(table_changes, newline)
        table_range = table_ranges.get(table)
        if table_range is None:
            continue
        start, end = table_range
        insertion_index = _toml_table_insert_index(lines, start, end)
        if (
            insertion_index == len(lines)
            and lines
            and not lines[-1].endswith(("\n", "\r"))
        ):
            rendered = newline + rendered
        insertions.setdefault(insertion_index, []).append(rendered)

    new_tables = tuple(
        sorted(table for table in additions if table not in table_ranges)
    )
    if new_tables:
        appended = _toml_new_table_block(text, new_tables, additions, newline)
        insertions.setdefault(len(lines), []).append(appended)

    rendered = "".join(
        "".join(insertions.get(index, ())) + replacements.get(index, line)
        for index, line in enumerate(lines)
    ) + "".join(insertions.get(len(lines), ()))
    _validate_rendered_toml_changes(rendered, changes, relative)
    return rendered


def _toml_table_ranges(
    lines: list[str],
) -> dict[tuple[str, ...], tuple[int, int]]:
    """Map safely parseable TOML tables to their body line ranges."""

    headers: list[tuple[tuple[str, ...], int]] = []
    for index, line in enumerate(lines):
        body, _newline = _split_newline(line)
        code = _toml_code_before_comment(body).strip()
        if code.startswith("[[") and code.endswith("]]"):
            headers.append(((), index))
            continue
        if not (code.startswith("[") and code.endswith("]")):
            continue
        path = _toml_bare_path(code[1:-1])
        if path is not None:
            headers.append((path, index))
        else:
            # Quoted tables are valid TOML, but this byte-preserving editor
            # cannot safely target them or treat them as an insertion table.
            headers.append(((), index))

    first_header = headers[0][1] if headers else len(lines)
    ranges: dict[tuple[str, ...], tuple[int, int]] = {(): (0, first_header)}
    for offset, (path, header_index) in enumerate(headers):
        if not path:
            continue
        next_header = (
            headers[offset + 1][1] if offset + 1 < len(headers) else len(lines)
        )
        ranges[path] = (header_index + 1, next_header)
    return ranges


def _validate_toml_addition_table(
    document: Mapping[str, Any],
    table: tuple[str, ...],
    table_ranges: Mapping[tuple[str, ...], tuple[int, int]],
    relative: str,
) -> None:
    """Ensure a missing scalar can be added without rewriting a foreign shape."""

    if table in table_ranges:
        return
    current: Any = document
    for part in table:
        if not isinstance(current, Mapping):
            raise IntegrationError(
                f"TOML PATCH cannot add below a scalar value in {relative}: {'.'.join(table)}."
            )
        if part not in current:
            return
        current = current[part]
    if isinstance(current, Mapping):
        raise IntegrationError(
            "TOML PATCH cannot safely add to an implicit or inline table in "
            f"{relative}: {'.'.join(table)}."
        )
    raise IntegrationError(
        f"TOML PATCH cannot add below a scalar value in {relative}: {'.'.join(table)}."
    )


def _toml_preferred_newline(lines: list[str]) -> str:
    return "\r\n" if any(line.endswith("\r\n") for line in lines) else "\n"


def _toml_table_insert_index(lines: list[str], start: int, end: int) -> int:
    """Insert before a table's trailing blank lines and next table header."""

    insertion_index = end
    while insertion_index > start:
        body, _newline = _split_newline(lines[insertion_index - 1])
        if body.strip():
            break
        insertion_index -= 1
    return insertion_index


def _toml_assignment_block(changes: list[StructuredChange], newline: str) -> str:
    return "".join(
        f"{change.key.rsplit('.', 1)[-1]} = {_toml_value(change.value)}{newline}"
        for change in sorted(changes, key=lambda item: item.key)
    )


def _toml_new_table_block(
    text: str,
    tables: tuple[tuple[str, ...], ...],
    additions: Mapping[tuple[str, ...], list[StructuredChange]],
    newline: str,
) -> str:
    """Render deterministic new TOML tables after preserving the original text."""

    prefix = ""
    if text:
        if not text.endswith(("\n", "\r")):
            prefix += newline
        if not (text + prefix).endswith(newline * 2):
            prefix += newline
    blocks = [prefix]
    for index, table in enumerate(tables):
        if index:
            blocks.append(newline)
        blocks.append(f"[{'.'.join(table)}]{newline}")
        blocks.append(_toml_assignment_block(additions[table], newline))
    return "".join(blocks)


def _validate_rendered_toml_changes(
    rendered: str,
    changes: tuple[StructuredChange, ...],
    relative: str,
) -> None:
    try:
        document = tomllib.loads(rendered)
    except tomllib.TOMLDecodeError as exc:  # pragma: no cover - defensive invariant
        raise IntegrationError(
            f"TOML PATCH produced invalid TOML in {relative}."
        ) from exc
    for change in changes:
        found, value = _mapping_value(document, tuple(change.key.split(".")))
        if not found or value != change.value:
            raise IntegrationError(
                f"TOML PATCH could not validate rendered value in {relative}: {change.key}."
            )


def _patch_yaml_text(
    text: str,
    changes: tuple[StructuredChange, ...],
    relative: str,
) -> str:
    """Patch existing scalar mapping keys in a GitHub workflow byte-conservatively."""

    change_by_path = {tuple(change.key.split(".")): change for change in changes}
    if len(change_by_path) != len(changes):
        raise IntegrationError("Structured workflow key is patched more than once.")
    lines = text.splitlines(keepends=True)
    stack: list[tuple[int, str]] = []
    replacements: dict[int, str] = {}
    matched: set[tuple[str, ...]] = set()
    seen_paths: set[tuple[str, ...]] = set()
    mapping_line = re.compile(
        r"^(?P<indent> *)(?P<key>[A-Za-z_][A-Za-z0-9_-]*):(?P<rhs>.*)$"
    )

    for index, line in enumerate(lines):
        body, newline = _split_newline(line)
        if body.startswith("\t") or "\t" in body[: len(body) - len(body.lstrip())]:
            raise IntegrationError(
                f"Workflow YAML must use spaces for indentation: {relative}."
            )
        comment = _toml_comment_index(body)
        code = body if comment is None else body[:comment]
        match = mapping_line.fullmatch(code)
        if match is None:
            continue
        indent = len(match.group("indent"))
        while stack and stack[-1][0] >= indent:
            stack.pop()
        key = match.group("key")
        path = (*tuple(item[1] for item in stack), key)
        if path in seen_paths:
            raise IntegrationError(
                f"Workflow YAML repeats a mapping key in {relative}: {'.'.join(path)}."
            )
        seen_paths.add(path)
        rhs = match.group("rhs")
        if not rhs.strip():
            stack.append((indent, key))
            continue
        change = change_by_path.get(path)
        if change is None:
            continue
        expression = rhs.strip()
        if expression.startswith(("|", ">", "&", "*")):
            raise IntegrationError(
                f"Workflow PATCH supports only existing scalar values in {relative}: {change.key}."
            )
        if change.expected is not UNSET:
            current = _yaml_scalar(expression)
            if current != change.expected:
                raise IntegrationError(
                    f"Structured value changed after planning in {relative}: {change.key}."
                )
        prefix = body[: match.start("rhs")]
        leading = rhs[: len(rhs) - len(rhs.lstrip())]
        trailing = rhs[len(rhs.rstrip()) :]
        rendered_comment = "" if comment is None else body[comment:]
        replacements[index] = (
            prefix
            + leading
            + _yaml_value(change.value)
            + trailing
            + rendered_comment
            + newline
        )
        matched.add(path)

    missing = [".".join(path) for path in change_by_path if path not in matched]
    if missing:
        raise IntegrationError(
            f"Workflow PATCH could not locate a safe existing scalar in {relative}: {missing[0]}."
        )
    return "".join(replacements.get(index, line) for index, line in enumerate(lines))


def _yaml_scalar(expression: str) -> Any:
    try:
        return json.loads(expression)
    except json.JSONDecodeError:
        pass
    lowered = expression.casefold()
    if lowered in {"true", "false"}:
        return lowered == "true"
    if lowered in {"null", "~"}:
        return None
    if re.fullmatch(r"-?(?:0|[1-9]\d*)", expression):
        return int(expression)
    if re.fullmatch(r"-?(?:0|[1-9]\d*)\.\d+(?:[eE][+-]?\d+)?", expression):
        return float(expression)
    if len(expression) >= 2 and expression.startswith("'") and expression.endswith("'"):
        return expression[1:-1].replace("''", "'")
    return expression


def _yaml_value(value: Any) -> str:
    if value is not None and not isinstance(value, (str, bool, int, float)):
        raise IntegrationError(
            f"Unsupported workflow scalar type: {type(value).__name__}."
        )
    try:
        return json.dumps(value, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise IntegrationError(
            f"Unsupported workflow scalar type: {type(value).__name__}."
        ) from exc


def _mapping_value(
    document: Mapping[str, Any], path: tuple[str, ...]
) -> tuple[bool, Any]:
    current: Any = document
    for part in path:
        if not isinstance(current, Mapping) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _toml_bare_path(expression: str) -> tuple[str, ...] | None:
    parts = tuple(part.strip() for part in expression.strip().split("."))
    return (
        parts
        if parts and all(re.fullmatch(r"[A-Za-z0-9_-]+", part) for part in parts)
        else None
    )


def _split_newline(line: str) -> tuple[str, str]:
    if line.endswith("\r\n"):
        return line[:-2], "\r\n"
    if line.endswith("\n"):
        return line[:-1], "\n"
    return line, ""


def _toml_comment_index(value: str) -> int | None:
    quote: str | None = None
    escaped = False
    depth = 0
    for index, character in enumerate(value):
        if quote is not None:
            if quote == '"' and character == "\\" and not escaped:
                escaped = True
                continue
            if character == quote and not escaped:
                quote = None
            escaped = False
            continue
        if character in {'"', "'"}:
            quote = character
        elif character in "[{(":
            depth += 1
        elif character in "]})":
            depth = max(0, depth - 1)
        elif character == "#" and depth == 0:
            return index
    return None


def _toml_code_before_comment(line: str) -> str:
    index = _toml_comment_index(line)
    return line if index is None else line[:index]


def _is_complete_toml_value(expression: str) -> bool:
    try:
        tomllib.loads(f"value = {expression}\n")
    except tomllib.TOMLDecodeError:
        return False
    return True


def _toml_value(value: Any) -> str:
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if math.isnan(value):
            return "nan"
        if math.isinf(value):
            return "inf" if value > 0 else "-inf"
        return repr(value)
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_toml_value(item) for item in value) + "]"
    if isinstance(value, Mapping):
        pairs = (
            f"{_toml_inline_key(key)} = {_toml_value(item)}"
            for key, item in value.items()
        )
        return "{ " + ", ".join(pairs) + " }"
    raise IntegrationError(f"Unsupported TOML value type: {type(value).__name__}.")


def _toml_inline_key(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise IntegrationError("TOML PATCH value contains an invalid inline-table key.")
    return (
        value
        if re.fullmatch(r"[A-Za-z0-9_-]+", value)
        else json.dumps(value, ensure_ascii=False)
    )


def _copy_staging_tree(
    root: Path,
    staging: Path,
    snapshot_paths: tuple[str, ...],
) -> None:
    def ignored(directory: str, names: list[str]) -> set[str]:
        excluded = {
            name
            for name in names
            if (Path(directory) / name).is_symlink()
            or name.casefold() in _STAGING_IGNORED_DIRECTORIES
            or name.casefold() in _DATA_DIRECTORIES
            or name.casefold() in _SENSITIVE_DIRECTORIES
            or name.casefold() in _SENSITIVE_NAMES
            or (
                name.casefold().startswith(".env.")
                and name.casefold() != ".env.example"
            )
            or Path(name.casefold()).suffix in _SENSITIVE_SUFFIXES
        }
        current = Path(directory)
        if current.name.casefold() == ".tooling-state":
            excluded.update(
                name for name in names if name.casefold() in _RESERVED_STATE_DIRECTORIES
            )
        excluded.update(
            name for name in names if name.casefold().endswith((".pyc", ".pyo"))
        )
        return excluded

    try:
        shutil.copytree(root, staging, symlinks=True, ignore=ignored)
    except OSError as exc:
        raise IntegrationError(
            f"Could not create isolated integration staging: {exc}."
        ) from exc
    for relative in snapshot_paths:
        try:
            source = safe_join(root, relative)
            try:
                metadata = source.lstat()
            except FileNotFoundError:
                continue
            except OSError as exc:
                raise FilesystemSafetyError(
                    f"Could not inspect staging snapshot path: {relative}."
                ) from exc
            content = read_regular_bytes(
                source,
                root=root,
                label=f"Staging snapshot path {relative}",
            )
            parent = PurePosixPath(relative).parent.as_posix()
            if parent != ".":
                ensure_directory(staging, parent)
            target = safe_join(staging, relative)
            atomic_write(
                target,
                content,
                mode=stat.S_IMODE(metadata.st_mode),
                root=staging,
            )
        except FilesystemSafetyError as exc:
            raise IntegrationError(
                f"Could not preserve staging snapshot path: {exc}"
            ) from exc


def _affected_paths(prepared: tuple[_PreparedOperation, ...]) -> tuple[str, ...]:
    directories = sorted(
        {
            item.path
            for item in prepared
            if item.operation.kind is OperationKind.ENSURE_DIRECTORY
        },
        key=lambda value: (len(PurePosixPath(value).parts), value),
    )
    files: list[str] = []
    for item in prepared:
        if item.operation.kind is OperationKind.ENSURE_DIRECTORY:
            continue
        if item.source_path is not None and item.source_path not in files:
            files.append(item.source_path)
        if item.path not in files:
            files.append(item.path)
    return (*directories, *files)


def _backup_paths(
    root: Path,
    backup: Path,
    affected: tuple[str, ...],
) -> tuple[_BackupEntry, ...]:
    backup.mkdir(mode=0o700)
    entries: list[_BackupEntry] = []
    for relative in affected:
        source = _safe_target(root, relative)
        if not _path_exists(source):
            entries.append(_BackupEntry(relative, "missing"))
        elif source.is_symlink():
            raise IntegrationError(f"Refusing to back up symbolic link: {relative}.")
        elif source.is_file():
            destination = backup / Path(relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            entries.append(_BackupEntry(relative, "file", _file_mode(source)))
        elif source.is_dir():
            entries.append(_BackupEntry(relative, "directory"))
        else:
            raise IntegrationError(
                f"Affected path is neither a regular file nor directory: {relative}."
            )
    inventory = [
        {"path": item.path, "kind": item.kind, "mode": item.mode} for item in entries
    ]
    _atomic_write_bytes(
        backup / "inventory.json",
        (json.dumps(inventory, sort_keys=True) + "\n").encode("utf-8"),
        root=backup,
    )
    return tuple(entries)


def _restore_paths(
    root: Path,
    backup: Path,
    affected: tuple[str, ...],
    backups: tuple[_BackupEntry, ...],
    *,
    preserve_missing: tuple[str, ...] = (),
) -> None:
    by_path = {item.path: item for item in backups}
    if set(by_path) != set(affected):
        raise IntegrationError(
            "Rollback inventory does not match affected integration paths."
        )
    for relative in reversed(affected):
        entry = by_path[relative]
        if entry.kind == "missing" and relative in preserve_missing:
            continue
        target = _safe_target(root, relative)
        if entry.kind == "missing":
            _delete_for_rollback(target, root)
        elif entry.kind == "file":
            if target.is_dir() and not target.is_symlink():
                try:
                    target.rmdir()
                except OSError as exc:
                    raise IntegrationError(
                        f"Rollback target directory is not empty: {relative}."
                    ) from exc
            elif _path_exists(target):
                target.unlink()
            _atomic_write_bytes(
                target,
                (backup / Path(relative)).read_bytes(),
                root=root,
                mode=0o644 if entry.mode is None else entry.mode,
            )
        elif entry.kind == "directory":
            if target.is_symlink() or (target.exists() and not target.is_dir()):
                raise IntegrationError(
                    f"Rollback directory changed unexpectedly: {relative}."
                )
            _create_directory(target, root)
        else:
            raise IntegrationError(f"Unknown rollback inventory kind: {entry.kind}.")


def _replace_from_frozen(
    root: Path,
    relative: str,
    frozen: _FrozenOutput,
) -> None:
    if frozen.kind != "file" or frozen.content is None or frozen.mode is None:
        raise IntegrationError(
            f"Verified staged file is missing or unsafe: {relative}."
        )
    _atomic_write_bytes(
        _safe_target(root, relative),
        frozen.content,
        root=root,
        mode=frozen.mode,
    )


def _create_from_frozen(
    root: Path,
    relative: str,
    frozen: _FrozenOutput,
) -> None:
    """Atomically create one verified staged file without replacing a late arrival."""

    if frozen.kind != "file" or frozen.content is None or frozen.mode is None:
        raise IntegrationError(
            f"Verified staged file is missing or unsafe: {relative}."
        )
    content = frozen.content
    mode = frozen.mode

    try:
        target = _safe_target(root, relative)
    except IntegrationError as exc:
        candidate = root / Path(relative)
        if _path_exists(candidate):
            raise _ConcurrentCreationError(relative) from exc
        raise
    if _path_exists(target):
        raise _ConcurrentCreationError(relative)

    descriptor: int | None = None
    temporary: Path | None = None
    try:
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{target.name}.", dir=target.parent
        )
        temporary = Path(temporary_name)
        if hasattr(os, "fchmod"):
            os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "wb") as handle:
            descriptor = None
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if not hasattr(os, "fchmod"):
            os.chmod(temporary, mode)
        try:
            os.link(temporary, target)
        except FileExistsError as exc:
            raise _ConcurrentCreationError(relative) from exc
        except OSError as exc:
            if _path_exists(target):
                raise _ConcurrentCreationError(relative) from exc
            raise IntegrationError(
                f"Could not create integration target exclusively: {relative}."
            ) from exc
        _fsync_directory(target.parent)
    except _ConcurrentCreationError:
        raise
    except OSError as exc:
        raise IntegrationError(
            f"Could not create integration target exclusively: {relative}."
        ) from exc
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def _fsync_directory(directory: Path) -> None:
    descriptor: int | None = None
    try:
        descriptor = os.open(
            directory,
            os.O_RDONLY | getattr(os, "O_DIRECTORY", 0),
        )
        os.fsync(descriptor)
    except OSError:
        return
    finally:
        if descriptor is not None:
            os.close(descriptor)


def _write_journal(
    report_directory: Path,
    plan: IntegrationPlan,
    root: Path,
    prepared: tuple[_PreparedOperation, ...],
    affected: tuple[str, ...],
    frozen_outputs: Mapping[str, _FrozenOutput],
) -> Path:
    operation_by_path: dict[str, _PreparedOperation] = {}
    for item in prepared:
        operation_by_path[item.path] = item
        if item.source_path is not None:
            operation_by_path[item.source_path] = item
    files = []
    for relative in affected:
        item = operation_by_path[relative]
        before_sha, before_kind = _snapshot(root, relative)
        frozen = frozen_outputs[relative]
        after_sha, after_kind = frozen.sha256, frozen.kind
        files.append(
            {
                "path": sanitize_text(relative, root),
                "operation": str(item.operation.kind.value),
                "ownership": item.operation.ownership.value,
                "before_sha256": before_sha,
                "after_sha256": after_sha,
                "before_kind": before_kind,
                "after_kind": after_kind,
                "rollback": "backup" if before_kind is not None else "remove",
            }
        )
    payload = {
        "schema_version": 1,
        "profile": sanitize_text(plan.profile, root),
        "desired_features": [
            sanitize_text(feature, root) for feature in plan.desired_features
        ],
        "files": files,
    }
    _ensure_safe_directory(report_directory, root)
    journal_path = report_directory / "journal.json"
    if journal_path.is_symlink():
        raise IntegrationError("Integration journal must not be a symbolic link.")
    _atomic_write_bytes(
        journal_path,
        (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8"),
        root=root,
    )
    return journal_path


def _snapshot(root: Path, relative: str) -> tuple[str | None, str | None]:
    target = _safe_target(root, relative)
    if not _path_exists(target):
        return None, None
    if target.is_symlink():
        raise IntegrationError(f"Refusing to journal a symbolic link: {relative}.")
    if target.is_dir():
        return None, "directory"
    if target.is_file():
        return _file_digest(target), "file"
    raise IntegrationError(f"Cannot journal unsupported filesystem object: {relative}.")


def _safe_report_directory(root: Path, requested: Path | None) -> Path:
    directory = requested or (root / DEFAULT_REPORT_RELATIVE)
    candidate = directory if directory.is_absolute() else root / directory
    try:
        relative = candidate.absolute().relative_to(root).as_posix()
    except ValueError as exc:
        raise IntegrationError(
            "Integration reports must remain inside the project tooling state."
        ) from exc
    if relative != DEFAULT_REPORT_RELATIVE and not relative.startswith(
        f"{DEFAULT_REPORT_RELATIVE}/"
    ):
        raise IntegrationError(
            "Integration reports must be written below .tooling-state/reports."
        )
    _safe_target(root, relative)
    return root / Path(relative)


def _ensure_safe_directory(directory: Path, root: Path) -> None:
    try:
        relative = directory.relative_to(root).as_posix()
        ensure_directory(root, relative)
    except (ValueError, FilesystemSafetyError) as exc:
        raise IntegrationError(
            f"Could not create safe directory: {directory}."
        ) from exc


def _safe_relative(value: str | None, *, label: str) -> str:
    if value is None:
        raise IntegrationError(f"{label} is missing.")
    try:
        return safe_relative_path(value)
    except FilesystemSafetyError as exc:
        raise IntegrationError(
            f"{label} must be a safe project-relative path: {value!r}."
        ) from exc


def _safe_target(root: Path, relative: str) -> Path:
    try:
        return safe_join(root, relative)
    except FilesystemSafetyError as exc:
        raise IntegrationError(str(exc)) from exc


def _reject_protected_path(relative: str) -> None:
    parts = tuple(PurePosixPath(relative).parts)
    lowered = tuple(part.lower() for part in parts)
    if lowered[0] in _PROTECTED_ROOTS:
        raise IntegrationError(
            f"Integration operation targets protected metadata: {relative}."
        )
    if any(part in _DATA_DIRECTORIES for part in lowered):
        raise IntegrationError(
            f"Integration operation targets product data: {relative}."
        )
    if any(part in _SENSITIVE_DIRECTORIES for part in lowered):
        raise IntegrationError(
            f"Integration operation targets a sensitive directory: {relative}."
        )
    if any(lowered[: len(prefix)] == prefix for prefix in _PRODUCT_SOURCE_PREFIXES):
        raise IntegrationError(
            f"Integration operation targets project source: {relative}."
        )
    if (
        lowered[0] == ".tooling-state"
        and len(lowered) > 1
        and lowered[1] in _RESERVED_STATE_DIRECTORIES
    ):
        raise IntegrationError(
            f"Integration operation targets reserved runtime state: {relative}."
        )
    name = lowered[-1]
    if (
        name in _SENSITIVE_NAMES
        or (name.startswith(".env.") and name != ".env.example")
        or Path(name).suffix in _SENSITIVE_SUFFIXES
    ):
        raise IntegrationError(
            f"Integration operation targets a sensitive file: {relative}."
        )
    if not _is_state_path(relative) and is_protected_relative_path(relative):
        raise IntegrationError(
            "Integration operation targets protected generated or sensitive "
            f"material: {relative}."
        )


def _under_managed_root(relative: str, roots: tuple[str, ...]) -> bool:
    return any(relative == root or relative.startswith(f"{root}/") for root in roots)


def _is_state_path(relative: str) -> bool:
    return relative == ".tooling-state" or relative.startswith(_STATE_PREFIX)


def _expected_digest(operation: Operation, *, required: bool) -> str | None:
    value = operation.expected_sha256
    if value is None:
        if required:
            raise IntegrationError(
                f"{operation.kind.value} operation lacks a preimage SHA-256: {operation.path}."
            )
        return None
    match = _SHA256.fullmatch(value)
    if match is None:
        raise IntegrationError(
            f"Operation has an invalid expected SHA-256: {operation.path}."
        )
    return match.group(1)


def _file_digest(path: Path) -> str:
    descriptor: int | None = None
    try:
        before = path.lstat()
        if stat.S_ISLNK(before.st_mode) or not stat.S_ISREG(before.st_mode):
            raise IntegrationError(
                f"Integration preimage must be a regular file: {path.name}."
            )
        descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        opened = os.fstat(descriptor)
        if opened.st_dev != before.st_dev or opened.st_ino != before.st_ino:
            raise IntegrationError(
                f"Integration preimage changed while being opened: {path.name}."
            )
        digest = hashlib.sha256()
        with os.fdopen(descriptor, "rb") as handle:
            descriptor = None
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except IntegrationError:
        raise
    except OSError as exc:
        raise IntegrationError(
            f"Could not read integration preimage: {path.name}."
        ) from exc
    finally:
        if descriptor is not None:
            os.close(descriptor)


def _atomic_write_bytes(
    path: Path, content: bytes, *, root: Path, mode: int = 0o644
) -> None:
    try:
        atomic_write(path, content, root=root, mode=mode)
    except FilesystemSafetyError as exc:
        raise IntegrationError(
            f"Could not write integration target: {path.relative_to(root)}."
        ) from exc


def _file_mode(path: Path) -> int:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise IntegrationError(
            f"Could not inspect integration file mode: {path.name}."
        ) from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        raise IntegrationError(
            f"Integration mode source must be a regular file: {path.name}."
        )
    return stat.S_IMODE(metadata.st_mode)


def _create_directory(path: Path, root: Path) -> None:
    try:
        ensure_directory(root, path.relative_to(root).as_posix())
    except (ValueError, FilesystemSafetyError) as exc:
        raise IntegrationError(f"Managed directory path is unsafe: {path}.") from exc


def _delete_file(path: Path, root: Path) -> None:
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise IntegrationError(
            f"Integration delete target is not a regular file: {path.relative_to(root)}."
        )
    path.unlink(missing_ok=True)


def _delete_for_rollback(path: Path, root: Path) -> None:
    if path.is_symlink():
        raise IntegrationError(
            f"Rollback refuses symbolic link: {path.relative_to(root)}."
        )
    if path.is_file():
        path.unlink()
    elif path.is_dir():
        try:
            path.rmdir()
        except OSError as exc:
            raise IntegrationError(
                f"Rollback refuses non-empty directory: {path.relative_to(root)}."
            ) from exc
    _remove_empty_parents(path.parent, root)


def _remove_empty_parents(directory: Path, root: Path) -> None:
    current = directory
    while current != root:
        if current.is_symlink():
            raise IntegrationError(
                f"Rollback parent became a symbolic link: {current.relative_to(root)}."
            )
        try:
            current.rmdir()
        except OSError:
            return
        current = current.parent


def _path_exists(path: Path) -> bool:
    return path.exists() or path.is_symlink()


def _run_verifier(verifier: Verifier, root: Path) -> VerificationResult:
    result = verifier(root)
    if not isinstance(result, VerificationResult):
        raise IntegrationError("Integration verifier returned an invalid result.")
    return result


def _run_post_apply(
    post_apply: PostApply | None,
    root: Path,
) -> VerificationResult | None:
    if post_apply is None:
        return None
    result = post_apply(root)
    if result is not None and not isinstance(result, VerificationResult):
        raise IntegrationError("Post-apply action returned an invalid result.")
    return result


def _run_staged_action(
    staged_action: StagedAction | None,
    staging: Path,
) -> VerificationResult | None:
    if staged_action is None:
        return None
    try:
        result = staged_action(staging)
    except BaseException as exc:
        if isinstance(exc, (KeyboardInterrupt, SystemExit)) or not isinstance(
            exc, Exception
        ):
            raise
        if isinstance(exc, IntegrationError):
            raise
        raise IntegrationError(
            "Staged action execution failed; target remains unchanged."
        ) from exc
    if not isinstance(result, VerificationResult):
        raise IntegrationError("Staged action returned an invalid result.")
    return result


def _verification_failure_detail(result: VerificationResult, root: Path) -> str:
    """Return bounded, redacted details for a failed staged action."""

    failures = tuple(
        f"{finding.check}: {finding.message}"
        for finding in result.findings
        if finding.status is FindingStatus.FAIL
    )
    if not failures:
        return ""
    detail = sanitize_text("; ".join(failures), root).strip()
    if not detail:
        return ""
    return " ".join(detail.splitlines())[:1200]


def _snapshot_staged_outputs(
    staging: Path,
    prepared: tuple[_PreparedOperation, ...],
) -> dict[str, _StagedOutput]:
    return {
        relative: _staged_output(staging, relative)
        for relative in _affected_paths(prepared)
    }


def _staged_output(staging: Path, relative: str) -> _StagedOutput:
    target = _safe_target(staging, relative)
    if not _path_exists(target):
        return _StagedOutput(None, None, None)
    try:
        metadata = target.lstat()
    except OSError as exc:
        raise IntegrationError(
            f"Could not inspect planned staged output: {relative}."
        ) from exc
    if stat.S_ISLNK(metadata.st_mode):
        raise IntegrationError(f"Planned staged output became a symlink: {relative}.")
    mode = stat.S_IMODE(metadata.st_mode)
    if stat.S_ISDIR(metadata.st_mode):
        return _StagedOutput("directory", None, mode)
    if stat.S_ISREG(metadata.st_mode):
        return _StagedOutput("file", _file_digest(target), mode)
    raise IntegrationError(
        f"Planned staged output has an unsupported type: {relative}."
    )


def _validate_staged_outputs(
    staging: Path,
    prepared: tuple[_PreparedOperation, ...],
    expected: Mapping[str, _StagedOutput],
) -> None:
    actual = _snapshot_staged_outputs(staging, prepared)
    if actual.keys() != expected.keys():  # pragma: no cover - internal invariant
        raise IntegrationError("Planned staged output inventory changed unexpectedly.")
    changed = tuple(path for path in expected if actual[path] != expected[path])
    if changed:
        raise IntegrationError(
            "Staged action or verifier modified a planned integration output; target remains "
            f"unchanged: {changed[0]}."
        )


def _freeze_staged_outputs(
    staging: Path,
    prepared: tuple[_PreparedOperation, ...],
    expected: Mapping[str, _StagedOutput],
) -> dict[str, _FrozenOutput]:
    """Freeze verified bytes so later staging races cannot alter live output."""

    _validate_staged_outputs(staging, prepared, expected)
    frozen: dict[str, _FrozenOutput] = {}
    for relative, snapshot in expected.items():
        if snapshot.kind != "file":
            frozen[relative] = _FrozenOutput(
                snapshot.kind,
                None,
                snapshot.sha256,
                snapshot.mode,
            )
            continue
        try:
            content = read_regular_bytes(
                _safe_target(staging, relative),
                root=staging,
                label=f"Verified staged output {relative}",
            )
        except FilesystemSafetyError as exc:
            raise IntegrationError(
                f"Verified staged file is missing or unsafe: {relative}."
            ) from exc
        digest = hashlib.sha256(content).hexdigest()
        if digest != snapshot.sha256:
            raise IntegrationError(
                "Verified staged output changed while being frozen; target remains "
                f"unchanged: {relative}."
            )
        frozen[relative] = _FrozenOutput(
            "file",
            content,
            digest,
            snapshot.mode,
        )
    return frozen


def _combine_verification_results(
    *results: VerificationResult | None,
) -> VerificationResult:
    return VerificationResult(
        tuple(
            finding
            for result in results
            if result is not None
            for finding in result.findings
        )
    )


def _finalize_report(
    finalizer: ReportFinalizer | None,
    result: VerificationResult,
    outcome: str,
) -> None:
    if finalizer is not None:
        finalizer(result, outcome)
