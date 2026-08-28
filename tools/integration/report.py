"""Sanitized, project-local evidence for mutating integration runs."""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tools.core.context import ProjectContext
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    ensure_directory,
    safe_join,
    validate_root,
)
from tools.core.state import StateError, validate_state_directory
from tools.integration.model import (
    Finding,
    IntegrationPlan,
    OperationKind,
    ReportError,
    VerificationResult,
)
from tools.integration.sanitize import sanitize_text

REPORT_SCHEMA_VERSION = 1
REPORT_DIRECTORY = ".tooling-state/reports"
_REPORT_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")


def write_report(
    context: ProjectContext,
    *,
    plan: IntegrationPlan | None,
    verification: VerificationResult | None,
    outcome: str,
    notices: tuple[str, ...] = (),
    report_id: str | None = None,
    check: bool = False,
) -> Path | None:
    """Atomically publish one report directory below ``context.state_root``.

    Read-only checks deliberately return before inspecting or creating state.
    """

    if check or outcome.strip().upper() in {"CHECK", "CHECK_ONLY"}:
        return None
    identifier = report_id or datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    if not _REPORT_ID.fullmatch(identifier) or identifier in {".", ".."}:
        raise ReportError(f"Invalid integration report id: {identifier!r}.")
    root = context.project_root
    expected_state = root / ".tooling-state"
    if context.state_root != expected_state:
        raise ReportError(
            "Integration reports require the canonical project-local state root."
        )
    try:
        validate_root(root)
        validate_state_directory(context, create=True)
        reports = ensure_directory(root, REPORT_DIRECTORY)
        destination = safe_join(root, f"{REPORT_DIRECTORY}/{identifier}")
        if destination.exists() or destination.is_symlink():
            raise ReportError(f"Integration report already exists: {identifier}.")
        staging = Path(tempfile.mkdtemp(prefix=".pending-", dir=reports))
    except (FilesystemSafetyError, StateError, OSError) as exc:
        if isinstance(exc, ReportError):
            raise
        raise ReportError(
            f"Could not prepare integration report directory: {exc}"
        ) from exc

    try:
        payload = report_to_dict(
            context,
            plan=plan,
            verification=verification,
            outcome=outcome,
            notices=notices,
        )
        atomic_write_text(
            staging / "integration.json",
            json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            root=root,
        )
        atomic_write_text(
            staging / "summary.md",
            _summary(payload),
            root=root,
        )
        os.rename(staging, destination)
        return destination
    except (FilesystemSafetyError, OSError, TypeError, ValueError) as exc:
        _discard_staging(staging, reports)
        raise ReportError(f"Could not publish integration report: {exc}") from exc


def report_to_dict(
    context: ProjectContext,
    *,
    plan: IntegrationPlan | None,
    verification: VerificationResult | None,
    outcome: str,
    notices: tuple[str, ...] = (),
) -> dict[str, Any]:
    root = context.project_root
    return {
        "schema_version": REPORT_SCHEMA_VERSION,
        "outcome": sanitize_text(outcome, root),
        "plan": None if plan is None else plan_to_dict(plan, project_root=root),
        "verification": (
            {"status": "NOT_RUN", "ok": None, "findings": []}
            if verification is None
            else verification_to_dict(verification, project_root=root)
        ),
        "notices": [sanitize_text(notice, root) for notice in notices],
    }


def plan_to_dict(
    plan: IntegrationPlan, *, project_root: Path | None = None
) -> dict[str, Any]:
    root = project_root or Path.cwd()
    return {
        "profile": sanitize_text(plan.profile, root),
        "desired_features": [
            sanitize_text(feature, root) for feature in plan.desired_features
        ],
        "status": plan.status,
        "required_changes": plan.required_changes,
        "operations": [
            {
                "kind": sanitize_text(
                    operation.kind.value
                    if isinstance(operation.kind, OperationKind)
                    else str(operation.kind),
                    root,
                ),
                "path": sanitize_text(operation.path, root),
                "source_path": (
                    None
                    if operation.source_path is None
                    else sanitize_text(operation.source_path, root)
                ),
                "ownership": operation.ownership.value,
                "expected_sha256": (
                    None
                    if operation.expected_sha256 is None
                    else sanitize_text(operation.expected_sha256, root)
                ),
                "reason": sanitize_text(operation.reason, root),
                # Values and replacement payloads are intentionally excluded.
                "structured_keys": [
                    sanitize_text(change.key, root)
                    for change in operation.structured_changes
                ],
            }
            for operation in plan.operations
        ],
        "conflicts": [
            {
                "path": sanitize_text(conflict.path, root),
                "ownership": conflict.ownership.value,
                "code": sanitize_text(conflict.code, root),
                "reason": sanitize_text(conflict.reason, root),
            }
            for conflict in plan.conflicts
        ],
    }


def verification_to_dict(
    result: VerificationResult, *, project_root: Path | None = None
) -> dict[str, Any]:
    root = project_root or Path.cwd()
    return {
        "status": "PASS" if result.ok else "FAIL",
        "ok": result.ok,
        "findings": [_finding_to_dict(finding, root) for finding in result.findings],
    }


def _finding_to_dict(finding: Finding, root: Path) -> dict[str, Any]:
    return {
        "check": sanitize_text(finding.check, root),
        "status": finding.status.value,
        "message": sanitize_text(finding.message, root),
        "adapter": None
        if finding.adapter is None
        else sanitize_text(finding.adapter, root),
        "path": None if finding.path is None else sanitize_text(finding.path, root),
    }


def _summary(payload: dict[str, Any]) -> str:
    plan = payload["plan"]
    verification = payload["verification"]
    lines = [
        "# Tooling integration report",
        "",
        f"- Outcome: `{payload['outcome']}`",
        f"- Plan: `{('NOT_AVAILABLE' if plan is None else plan['status'])}`",
        f"- Verification: `{verification['status']}`",
        f"- Required changes: `{0 if plan is None else plan['required_changes']}`",
        f"- Conflicts: `{0 if plan is None else len(plan['conflicts'])}`",
        "",
    ]
    if plan is not None and plan["operations"]:
        lines.extend(["## Operations", ""])
        for operation in plan["operations"]:
            lines.append(
                f"- `{operation['kind']}` `{operation['path']}` ({operation['ownership']})"
            )
        lines.append("")
    if payload["notices"]:
        lines.extend(["## Notices", ""])
        lines.extend(f"- {notice}" for notice in payload["notices"])
        lines.append("")
    return "\n".join(lines)


def _discard_staging(staging: Path, reports: Path) -> None:
    try:
        if (
            staging.parent == reports
            and staging.name.startswith(".pending-")
            and not staging.is_symlink()
        ):
            shutil.rmtree(staging)
    except OSError:
        return


write_integration_report = write_report
