"""Stable CLI facade for portable integration and maintenance commands."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from tools.adapters import AdapterCapability
from tools.integration.model import VerificationResult
from tools.integration.report import plan_to_dict, verification_to_dict
from tools.integration.sanitize import sanitize_text
from tools.integration.workflow import (
    AppliedIntegration,
    IntegrationAssessment,
    assess_migrations,
    assess_project,
    run_migrations,
)
from tools.integration.workflow import run_full_fix as apply_full_fix

OUTPUT_SCHEMA_VERSION = 1


def run_check(
    *,
    json_output: bool = False,
    project_root: Path | None = None,
    tools_root: Path | None = None,
) -> int:
    """Print a deterministic plan and never mutate the target."""

    try:
        assessment = assess_project(project_root, tools_root=tools_root)
    except Exception as exc:  # noqa: BLE001 - expected CLI boundary
        return _emit_error("integrate-check", exc, json_output=json_output)
    payload = _assessment_payload("integrate-check", assessment)
    _emit(payload, json_output=json_output, title="Tooling integration check")
    return 0 if assessment.plan.is_noop and assessment.verification.ok else 1


def run_full_fix(
    *,
    json_output: bool = False,
    project_root: Path | None = None,
    tools_root: Path | None = None,
) -> int:
    """Apply the complete current plan through one transaction boundary."""

    try:
        applied = apply_full_fix(project_root, tools_root=tools_root)
    except Exception as exc:  # noqa: BLE001 - expected CLI boundary
        return _emit_error("integrate-full-fix", exc, json_output=json_output)
    payload = _applied_payload("integrate-full-fix", applied)
    _emit(payload, json_output=json_output, title="Tooling integration full-fix")
    return 0


def run_migrate(
    *,
    check_only: bool = False,
    json_output: bool = False,
    project_root: Path | None = None,
    tools_root: Path | None = None,
) -> int:
    """Check or transactionally apply applicable registry migrations."""

    action = "tooling-migrate-check" if check_only else "tooling-migrate"
    try:
        if check_only:
            migration = assess_migrations(project_root, tools_root=tools_root)
            assessment = migration.assessment
            payload = _assessment_payload(action, assessment)
            payload["pending_migrations"] = list(migration.pending_ids)
            payload["applied_migrations"] = []
            _emit(payload, json_output=json_output, title="Tooling migration check")
            return 0 if assessment.plan.is_noop and assessment.verification.ok else 1
        migration_result = run_migrations(project_root, tools_root=tools_root)
    except Exception as exc:  # noqa: BLE001 - expected CLI boundary
        return _emit_error(action, exc, json_output=json_output)
    payload = _applied_payload(action, migration_result.applied)
    payload["pending_migrations"] = []
    payload["applied_migrations"] = list(migration_result.applied_ids)
    _emit(payload, json_output=json_output, title="Tooling migration")
    return 0


def run_verify(
    *,
    json_output: bool = False,
    project_root: Path | None = None,
    tools_root: Path | None = None,
) -> int:
    """Verify profile adapters, persistent decisions, and integration state."""

    try:
        assessment = assess_project(project_root, tools_root=tools_root)
    except Exception as exc:  # noqa: BLE001 - expected CLI boundary
        return _emit_error("tooling-verify", exc, json_output=json_output)
    payload = _assessment_payload("tooling-verify", assessment)
    verified = assessment.plan.is_noop and assessment.verification.ok
    payload["status"] = "INTEGRATED" if verified else "VERIFICATION_FAILED"
    _emit(payload, json_output=json_output, title="Tooling verification")
    return 0 if verified else 1


def run_adapter_action(
    *,
    adapter_name: str,
    capability: str,
    json_output: bool = False,
    project_root: Path | None = None,
    tools_root: Path | None = None,
) -> int:
    """Dispatch one explicit technology action through the selected adapter."""

    try:
        requested = AdapterCapability(capability)
        assessment = assess_project(project_root, tools_root=tools_root)
        selected = {adapter.name: adapter for adapter in assessment.adapters}
        adapter = selected.get(adapter_name)
        if adapter is None:
            raise ValueError(
                f"Adapter {adapter_name!r} is not selected by profile "
                f"{assessment.profile.profile_id!r}."
            )
        if requested not in adapter.capabilities:
            raise ValueError(
                f"Adapter {adapter_name!r} does not support {requested.value!r}."
            )
        action = getattr(adapter, requested.value, None)
        if not callable(action):
            raise TypeError(
                f"Adapter {adapter_name!r} has no callable {requested.value!r} action."
            )
        result = action(assessment.context)
    except Exception as exc:  # noqa: BLE001 - expected CLI boundary
        return _emit_error("tooling-adapter-action", exc, json_output=json_output)

    payload = {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "action": "tooling-adapter-action",
        "status": "OK" if result.ok else "FAILED",
        "adapter": result.adapter,
        "capability": result.capability.value,
        "message": sanitize_text(
            result.message,
            assessment.context.project_root,
        )[:1000],
    }
    _emit(payload, json_output=json_output, title="Tooling adapter action")
    return 0 if result.ok else 1


def run_export(*, output: str | None = None) -> int:
    """Create one deterministic, self-validating portable tooling directory."""

    from tools.integration.export import export_portable_tooling

    try:
        result = export_portable_tooling(
            output_parent=Path(output) if output is not None else None
        )
    except Exception as exc:  # noqa: BLE001 - expected CLI boundary
        return _emit_error("tooling-export", exc, json_output=False)
    payload = {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "action": "tooling-export",
        "status": "EXPORTED",
        "message": (
            f"Created {result.path} with {result.file_count} files; "
            f"manifest {result.manifest_digest}."
        ),
    }
    _emit(payload, json_output=False, title="Tooling export")
    return 0


def _assessment_payload(
    action: str,
    assessment: IntegrationAssessment,
    *,
    status: str | None = None,
    verification: VerificationResult | None = None,
    actions: tuple[str, ...] = (),
    report_path: Path | None = None,
    notices: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    root = assessment.context.project_root
    selected_verification = verification or assessment.verification
    return {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "action": action,
        "status": status or assessment.plan.status,
        "project_root": str(root),
        "tooling_version": assessment.actual_tooling_version,
        "config_source": assessment.config_source,
        "detection": {
            "frontend": _evidence(assessment.discovery.frontend),
            "backend": _evidence(assessment.discovery.backend),
            "tauri": _evidence(assessment.discovery.tauri),
            "container": _evidence(assessment.discovery.container),
            "suggested_profile": assessment.discovery.suggested_profile,
            "confidence": assessment.discovery.confidence.value,
            "reason": assessment.discovery.profile_reason,
            "scanned_entries": assessment.discovery.scanned_entries,
        },
        "profile": {
            "id": assessment.profile.profile_id,
            "features": list(assessment.profile.features),
            "optional_features": list(assessment.profile.optional_features),
        },
        "plan": plan_to_dict(assessment.plan, project_root=root),
        "verification": verification_to_dict(
            selected_verification,
            project_root=root,
        ),
        "actions": list(actions),
        "report_path": _relative_report(root, report_path),
        "notices": list(assessment.notices if notices is None else notices),
    }


def _applied_payload(action: str, applied: AppliedIntegration) -> dict[str, Any]:
    return _assessment_payload(
        action,
        applied.assessment,
        status=applied.result.outcome,
        verification=applied.result.verification,
        actions=applied.actions,
        report_path=applied.result.report_path,
        notices=applied.notices,
    )


def _evidence(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    return {
        "technology": value.technology,
        "path": value.path,
        "markers": list(value.markers),
        "confidence": value.confidence.value,
        "alternatives": list(value.alternatives),
    }


def _relative_report(root: Path, path: Path | None) -> str | None:
    if path is None:
        return None
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return None


def _emit(payload: dict[str, Any], *, json_output: bool, title: str) -> None:
    if json_output:
        print(json.dumps(payload, sort_keys=True, ensure_ascii=False))
        return
    print(title)
    print()
    if "project_root" in payload:
        print(f"Project root: {payload['project_root']}")
        detection = payload["detection"]
        print(f"Detected frontend: {_detected_text(detection['frontend'])}")
        print(f"Detected desktop: {_detected_text(detection['tauri'])}")
        print(f"Detected backend: {_detected_text(detection['backend'])}")
        print(f"Detected container: {_detected_text(detection['container'])}")
        print(f"Suggested profile: {detection['suggested_profile'] or 'none'}")
        print(f"Active profile: {payload['profile']['id']}")
        print(f"Confidence: {detection['confidence']}")
        plan = payload["plan"]
        print()
        print(f"Required changes: {plan['required_changes']}")
        print(f"Conflicts: {len(plan['conflicts'])}")
        if plan["operations"]:
            print("Plan:")
            for operation in plan["operations"]:
                print(f"  {operation['kind']} {operation['path']}")
        if plan["conflicts"]:
            print("Conflicts:")
            for conflict in plan["conflicts"]:
                print(f"  {conflict['path']}: {conflict['reason']}")
        if payload.get("report_path"):
            print(f"Report: {payload['report_path']}")
    elif payload.get("message"):
        print(payload["message"])
    print(f"Status: {payload['status']}")


def _detected_text(value: dict[str, Any] | None) -> str:
    if value is None:
        return "none"
    names = {
        "frontend": "Vite",
        "backend": "FastAPI",
        "tauri": "Tauri",
        "container": "Compose",
    }
    name = names.get(value["technology"], value["technology"])
    return f"{name} at {value['path']}/"


def _emit_error(action: str, exc: Exception, *, json_output: bool) -> int:
    root = Path.cwd().resolve(strict=False)
    message = sanitize_text(str(exc) or type(exc).__name__, root).replace("\n", " ")
    payload = {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "action": action,
        "status": "FAILED",
        "message": message[:1000],
    }
    _emit(payload, json_output=json_output, title="Tooling integration")
    return 1


__all__ = [
    "run_adapter_action",
    "run_check",
    "run_export",
    "run_full_fix",
    "run_migrate",
    "run_verify",
]
