"""Read-only assessment and transactional portable-integration workflow."""

from __future__ import annotations

import hashlib
import json
import os
import stat
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass, replace
from pathlib import Path, PurePosixPath

import tomllib

import tools.integration.migrations as migration_model
from tools.adapters import Adapter, build_default_registry
from tools.core.context import ProjectContext, load_context
from tools.core.filesystem import (
    FilesystemSafetyError,
    read_regular_bytes,
    read_regular_text,
    safe_join,
    safe_relative_path,
)
from tools.core.manifest import ManifestEntry, ManifestError, create_manifest
from tools.core.portable_payload import (
    PAYLOAD_MANIFEST_NAME,
    PortablePayloadError,
    validate_portable_payload,
    validate_portable_payload_identity,
)
from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    render_project_config,
)
from tools.core.state import (
    STATE_RELATIVE_PATH,
    STATE_SCHEMA_VERSION,
    StateError,
    ToolingState,
    load_state,
    render_state,
)
from tools.integration.actions import ActionKind, ActionRunner, ActionSpec
from tools.integration.discovery import ProjectDiscovery, discover_project
from tools.integration.model import (
    Conflict,
    Finding,
    FindingStatus,
    IntegrationError,
    IntegrationPlan,
    IntegrationResult,
    MigrationError,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)
from tools.integration.planner import ObservedResource
from tools.integration.report import write_report
from tools.integration.transaction import apply_plan
from tools.integration.verify import aggregate_results
from tools.profiles.loader import load_catalog, resolve_profile
from tools.profiles.model import ProfileCatalog, ProjectProfile

INTEGRATION_DIGEST_SCHEMA = 1
_MIGRATION_STRUCTURED_NAMES = {
    "Cargo.toml",
    "package.json",
    "project-tooling.toml",
    "pyproject.toml",
    "tauri.conf.json",
}
_ACTION_RELEVANT_STRUCTURED_NAMES = _MIGRATION_STRUCTURED_NAMES - {
    "project-tooling.toml"
}
_DEPENDENCY_MANIFEST_NAMES = {
    "cargo.lock",
    "cargo.toml",
    "package-lock.json",
    "package.json",
    "pipfile",
    "pipfile.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "pylock.toml",
    "pyproject.toml",
    "uv.lock",
    "yarn.lock",
}
_TRANSACTIONAL_ACTION_ORDER = ("dependencies", "quality", "tests", "build")
_RUST_ANALYZER_RUNTIME = PurePosixPath(
    "quality/rust_analyzer/dist/rust_quality_analyzer.wasm"
)


@dataclass(frozen=True, slots=True)
class IntegrationAssessment:
    """One immutable, completely read-only view of a target project."""

    context: ProjectContext
    actual_tooling_version: str
    config_source: str
    discovery: ProjectDiscovery
    catalog: ProfileCatalog
    profile: ProjectProfile
    adapters: tuple[Adapter, ...]
    structured_key_allowlist: Mapping[str, frozenset[str]]
    plan: IntegrationPlan
    desired_state: ToolingState
    verification: VerificationResult
    notices: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class AppliedIntegration:
    """Result of a mutating or already-idempotent full-fix run."""

    assessment: IntegrationAssessment
    result: IntegrationResult
    changed: bool
    actions: tuple[str, ...]
    notices: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class MigrationAssessment:
    """One registry-backed migration plan and its integration assessment."""

    assessment: IntegrationAssessment
    run: migration_model.MigrationRun
    source_tooling_version: str | None
    source_state_schema: int | None

    @property
    def pending_ids(self) -> tuple[str, ...]:
        return tuple(migration.migration_id for migration in self.run.migrations)


@dataclass(frozen=True, slots=True)
class AppliedMigration:
    """Result of applying every currently pending migration atomically."""

    applied: AppliedIntegration
    applied_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class _MigrationStateSource:
    tooling_version: str
    schema_version: int
    applied_migrations: tuple[str, ...]
    observation: _StateObservation


@dataclass(frozen=True, slots=True)
class GitPreflight:
    repository: bool
    clean: bool
    message: str


@dataclass(frozen=True, slots=True)
class _StateObservation:
    state: ToolingState | None
    content: bytes | None
    digest: str | None
    conflict: Conflict | None


def assess_project(
    project_root: Path | None = None,
    *,
    tools_root: Path | None = None,
    applied_migrations: tuple[str, ...] | None = None,
    _additional_operations: tuple[Operation, ...] = (),
    _state_observation_override: _StateObservation | None = None,
    _allow_registered_tooling_upgrade: bool = False,
) -> IntegrationAssessment:
    """Detect, resolve, plan, and verify without changing any filesystem entry."""

    initial = load_context(project_root=project_root, tools_root=tools_root)
    actual_version = _actual_tooling_version(initial)
    discovery = discover_project(initial.project_root)
    config, source = _desired_config(initial, discovery, actual_version)
    context = initial.with_config(config, exists=initial.config_exists)
    catalog = load_catalog(context=context)
    profile = resolve_profile(
        catalog,
        config.profile,
        optional_features=config.optional_features,
    )
    registry = build_default_registry()
    adapters = registry.select_for_profile(profile, catalog)
    adapter_plan = registry.plan(context, profile, adapters)
    structured_key_allowlist = registry.structured_key_allowlist(context, adapters)

    conflicts = [*adapter_plan.conflicts]
    if not initial.config_exists:
        conflicts.extend(_ambiguity_conflicts(discovery))
    conflicts.extend(_configuration_conflicts(context, profile))

    config_operation = _config_operation(initial, config, actual_version)
    state_observation = _state_observation_override or _observe_state(context)
    state = state_observation.state
    payload_finding = _portable_payload_finding(
        context,
        actual_version,
        require_release_match=state is None or state.tooling_version != actual_version,
    )
    if payload_finding.status is FindingStatus.FAIL:
        conflicts.append(
            Conflict(
                payload_finding.path or PAYLOAD_MANIFEST_NAME,
                Ownership.TOOLING,
                payload_finding.message,
                "invalid-portable-payload",
            )
        )
    if state_observation.conflict is not None:
        conflicts.append(state_observation.conflict)
    else:
        drift_conflict = _managed_state_drift_conflict(
            initial,
            state_observation,
            actual_version=actual_version,
            allow_registered_tooling_upgrade=_allow_registered_tooling_upgrade,
        )
        if drift_conflict is not None:
            conflicts.append(drift_conflict)
            state_observation = replace(state_observation, conflict=drift_conflict)

    migration_ids = (
        tuple(applied_migrations)
        if applied_migrations is not None
        else (
            ()
            if state_observation.state is None
            else state_observation.state.applied_migrations
        )
    )
    integration_digest = _integration_digest(
        context,
        config=config,
        applied_migrations=migration_ids,
        operations=(*adapter_plan.operations, *_additional_operations),
    )
    desired_state = ToolingState(
        schema_version=STATE_SCHEMA_VERSION,
        tooling_version=actual_version,
        profile=profile.profile_id,
        optional_features=tuple(config.optional_features),
        applied_migrations=migration_ids,
        integration_digest=integration_digest,
    )
    state_operation = _state_operation(state_observation, desired_state)

    operations = _compose_operations(
        adapter_plan.operations,
        _additional_operations,
        () if config_operation is None else (config_operation,),
        () if state_operation is None else (state_operation,),
    )
    plan = IntegrationPlan(
        profile=profile.profile_id,
        desired_features=profile.features,
        operations=operations,
        conflicts=tuple(
            sorted(conflicts, key=lambda item: (item.path, item.code, item.reason))
        ),
    )
    verification = _verification(
        context,
        adapters,
        plan,
        config_present=initial.config_exists,
        state_observation=state_observation,
        payload_finding=payload_finding,
    )
    notices = (
        "Existing project-tooling.toml takes precedence over detected suggestions."
        if initial.config_exists
        else "Profile and paths are inferred until project-tooling.toml is created.",
    )
    return IntegrationAssessment(
        context=context,
        actual_tooling_version=actual_version,
        config_source=source,
        discovery=discovery,
        catalog=catalog,
        profile=profile,
        adapters=adapters,
        structured_key_allowlist=structured_key_allowlist,
        plan=plan,
        desired_state=desired_state,
        verification=verification,
        notices=notices,
    )


def run_full_fix(
    project_root: Path | None = None,
    *,
    tools_root: Path | None = None,
) -> AppliedIntegration:
    """Replan and apply all required changes through one rollback boundary."""

    initial = assess_project(project_root, tools_root=tools_root)
    _ensure_tooling_python_sources_valid(initial)
    if initial.plan.conflicts:
        raise IntegrationError(
            "Integration plan contains conflicts; nothing was changed."
        )
    if initial.plan.is_noop:
        if not initial.verification.ok:
            raise IntegrationError("No-op integration verification failed.")
        return AppliedIntegration(
            initial,
            IntegrationResult("INTEGRATED", initial.plan, initial.verification),
            False,
            (),
            (*initial.notices, "No changes or actions were required."),
        )

    preflight = ensure_clean_git(initial.context.project_root)
    replanned = assess_project(
        initial.context.project_root,
        tools_root=initial.context.tools_root,
    )
    _ensure_tooling_python_sources_valid(replanned)
    if replanned.plan.conflicts:
        raise IntegrationError(
            "Integration plan contains conflicts after preflight; nothing was changed."
        )
    if replanned.plan.is_noop:
        if not replanned.verification.ok:
            raise IntegrationError("Replanned no-op integration verification failed.")
        return AppliedIntegration(
            replanned,
            IntegrationResult("INTEGRATED", replanned.plan, replanned.verification),
            False,
            (),
            (
                *replanned.notices,
                preflight.message,
                "No changes were required after replan.",
            ),
        )

    tools_relative = _relative_path(
        replanned.context.project_root,
        replanned.context.tools_root,
        label="Tooling root",
    )
    managed_roots = _managed_roots(replanned.context)
    published_reports: list[Path] = []
    action_specs = _planned_action_specs(replanned)

    def verifier(root: Path) -> VerificationResult:
        fresh = assess_project(root, tools_root=root / tools_relative)
        return fresh.verification

    report_context = replanned.context.with_config(
        replanned.context.config,
        exists=True,
    )

    def finalizer(verification: VerificationResult, outcome: str) -> None:
        path = write_report(
            report_context,
            plan=replanned.plan,
            verification=verification,
            outcome=outcome,
            notices=(*replanned.notices, preflight.message),
        )
        if path is not None:
            published_reports.append(path)

    result = apply_plan(
        replanned.context.project_root,
        replanned.plan,
        verifier=verifier,
        report_finalizer=finalizer,
        managed_roots=managed_roots,
        staged_action=ActionRunner(action_specs) if action_specs else None,
        structured_key_allowlist=replanned.structured_key_allowlist,
        staging_snapshot_paths=(_tooling_runtime_path(tools_relative),),
    )
    if published_reports:
        result = replace(result, report_path=published_reports[-1])
    actions = _executed_action_messages(result.verification)
    return AppliedIntegration(
        replanned,
        result,
        True,
        actions,
        (*replanned.notices, preflight.message),
    )


def assess_migrations(
    project_root: Path | None = None,
    *,
    tools_root: Path | None = None,
    registry: migration_model.MigrationRegistry | None = None,
) -> MigrationAssessment:
    """Select applicable registry migrations and build one read-only plan."""

    selected_registry = migration_model.REGISTRY if registry is None else registry
    initial = assess_project(project_root, tools_root=tools_root)
    source = _migration_state_source(initial.context)
    if source is None:
        return MigrationAssessment(
            initial,
            migration_model.MigrationRun((), (), (), ()),
            None,
            None,
        )

    run = migration_model.build_migration_run(
        selected_registry,
        source_tooling_version=source.tooling_version,
        target_tooling_version=initial.actual_tooling_version,
        source_state_schema=source.schema_version,
        target_state_schema=STATE_SCHEMA_VERSION,
        applied=source.applied_migrations,
    )
    unsupported_state = source.observation.state is None
    if unsupported_state and (
        run.is_noop
        or not any(
            migration.applies.target_state_schema == STATE_SCHEMA_VERSION
            for migration in run.migrations
        )
    ):
        raise MigrationError(
            "Existing tooling state is unsupported and no registered migration "
            "converts it to the current state schema."
        )
    for operation in run.operations:
        if operation.path == STATE_RELATIVE_PATH or operation.path.startswith(
            ".tooling-state/"
        ):
            raise MigrationError(
                "Registered migrations must leave .tooling-state updates to the "
                "migration workflow."
            )

    observations = _observe_migration_conditions(
        initial.context,
        tuple(
            condition
            for migration in run.migrations
            for condition in migration.preconditions
        ),
    )
    for migration in run.migrations:
        migration_model.validate_preconditions(migration, observations)

    state_override = (
        replace(source.observation, conflict=None) if unsupported_state else None
    )
    assessment = assess_project(
        initial.context.project_root,
        tools_root=initial.context.tools_root,
        applied_migrations=run.resulting_applied_ids,
        _additional_operations=run.operations,
        _state_observation_override=state_override,
        _allow_registered_tooling_upgrade=_migration_explains_tooling_upgrade(
            initial,
            source,
            run,
        ),
    )
    if run.migrations:
        pending = ", ".join(migration.migration_id for migration in run.migrations)
        assessment = replace(
            assessment,
            notices=(*assessment.notices, f"Pending migrations: {pending}."),
        )
    return MigrationAssessment(
        assessment,
        run,
        source.tooling_version,
        source.schema_version,
    )


def run_migrations(
    project_root: Path | None = None,
    *,
    tools_root: Path | None = None,
    registry: migration_model.MigrationRegistry | None = None,
) -> AppliedMigration:
    """Apply pending migrations, config reconciliation, and state atomically."""

    selected_registry = migration_model.REGISTRY if registry is None else registry
    initial = assess_migrations(
        project_root,
        tools_root=tools_root,
        registry=selected_registry,
    )
    assessment = initial.assessment
    _ensure_tooling_python_sources_valid(assessment)
    if assessment.plan.conflicts:
        raise IntegrationError(
            "Migration plan contains conflicts; nothing was changed."
        )
    if assessment.plan.is_noop:
        if not assessment.verification.ok:
            raise IntegrationError("No-op migration verification failed.")
        applied = AppliedIntegration(
            assessment,
            IntegrationResult("INTEGRATED", assessment.plan, assessment.verification),
            False,
            (),
            (*assessment.notices, "No migrations or changes were required."),
        )
        return AppliedMigration(applied, ())

    preflight = ensure_clean_git(assessment.context.project_root)
    replanned = assess_migrations(
        assessment.context.project_root,
        tools_root=assessment.context.tools_root,
        registry=selected_registry,
    )
    assessment = replanned.assessment
    _ensure_tooling_python_sources_valid(assessment)
    if assessment.plan.conflicts:
        raise IntegrationError(
            "Migration plan contains conflicts after preflight; nothing was changed."
        )
    if assessment.plan.is_noop:
        if not assessment.verification.ok:
            raise IntegrationError("Replanned no-op migration verification failed.")
        applied = AppliedIntegration(
            assessment,
            IntegrationResult("INTEGRATED", assessment.plan, assessment.verification),
            False,
            (),
            (
                *assessment.notices,
                preflight.message,
                "No changes were required after replan.",
            ),
        )
        return AppliedMigration(applied, ())

    tools_relative = _relative_path(
        assessment.context.project_root,
        assessment.context.tools_root,
        label="Tooling root",
    )
    published_reports: list[Path] = []
    action_specs = _planned_action_specs(assessment)

    def verifier(root: Path) -> VerificationResult:
        fresh = assess_project(root, tools_root=root / tools_relative)
        conditions = _migration_condition_findings(
            fresh.context,
            replanned.run.migrations,
            postconditions=True,
        )
        return aggregate_results((fresh.verification, conditions))

    report_context = assessment.context.with_config(
        assessment.context.config,
        exists=True,
    )

    def finalizer(verification: VerificationResult, outcome: str) -> None:
        path = write_report(
            report_context,
            plan=assessment.plan,
            verification=verification,
            outcome=outcome,
            notices=(*assessment.notices, preflight.message),
        )
        if path is not None:
            published_reports.append(path)

    result = apply_plan(
        assessment.context.project_root,
        assessment.plan,
        verifier=verifier,
        report_finalizer=finalizer,
        managed_roots=_managed_roots(assessment.context),
        staged_action=ActionRunner(action_specs) if action_specs else None,
        structured_key_allowlist=_merge_structured_key_allowlists(
            assessment.structured_key_allowlist,
            _migration_structured_allowlist(replanned.run.migrations),
        ),
        staging_snapshot_paths=(_tooling_runtime_path(tools_relative),),
    )
    if published_reports:
        result = replace(result, report_path=published_reports[-1])
    actions = _executed_action_messages(result.verification)
    applied = AppliedIntegration(
        assessment,
        result,
        True,
        actions,
        (*assessment.notices, preflight.message),
    )
    return AppliedMigration(applied, replanned.pending_ids)


def _migration_structured_allowlist(
    migrations: tuple[migration_model.Migration, ...],
) -> dict[str, frozenset[str]]:
    by_path: dict[str, set[str]] = {}
    for migration in migrations:
        for policy in migration.structured_key_allowlist:
            by_path.setdefault(policy.path, set()).update(policy.keys)
    return {path: frozenset(keys) for path, keys in sorted(by_path.items())}


def _merge_structured_key_allowlists(
    *policies: Mapping[str, frozenset[str]],
) -> dict[str, frozenset[str]]:
    by_path: dict[str, set[str]] = {}
    for policy in policies:
        for path, keys in policy.items():
            by_path.setdefault(path, set()).update(keys)
    return {path: frozenset(by_path[path]) for path in sorted(by_path)}


def verify_project(
    project_root: Path | None = None,
    *,
    tools_root: Path | None = None,
) -> IntegrationAssessment:
    """Return the same assessment used by transaction verification."""

    return assess_project(project_root, tools_root=tools_root)


def ensure_clean_git(project_root: Path) -> GitPreflight:
    """Require a clean standalone worktree before a real mutation."""

    metadata = project_root / ".git"
    try:
        mode = metadata.lstat().st_mode
    except FileNotFoundError:
        return GitPreflight(
            False, True, "Git preflight: no repository; continuing safely."
        )
    except OSError as exc:
        raise IntegrationError("Git metadata could not be inspected safely.") from exc
    if stat.S_ISLNK(mode) or not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
        raise IntegrationError(
            "Git metadata must be a regular directory or worktree file."
        )

    environment = os.environ.copy()
    for key in tuple(environment):
        if key.startswith("GIT_"):
            environment.pop(key)
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    git_command = [
        "git",
        "-c",
        "maintenance.auto=false",
        "-c",
        "core.fsmonitor=false",
        "-C",
        str(project_root),
    ]
    try:
        top = subprocess.run(
            [*git_command, "rev-parse", "--show-toplevel"],
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
            env=environment,
        )
        if top.returncode != 0:
            raise IntegrationError(
                "Git preflight could not resolve the project worktree."
            )
        if Path(top.stdout.strip()).resolve(strict=True) != project_root.resolve(
            strict=True
        ):
            raise IntegrationError("Git preflight resolved a different project root.")
        status = subprocess.run(
            [
                *git_command,
                "status",
                "--porcelain=v1",
                "--untracked-files=all",
                "--",
                ".",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
            env=environment,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise IntegrationError("Git preflight could not be executed safely.") from exc
    if status.returncode != 0:
        raise IntegrationError("Git preflight could not inspect the worktree status.")
    dirty = tuple(line for line in status.stdout.splitlines() if line.strip())
    if dirty:
        raise IntegrationError(
            f"Git worktree is not clean ({len(dirty)} changed path(s)); commit or stash them first."
        )
    return GitPreflight(True, True, "Git preflight: worktree is clean.")


def _actual_tooling_version(context: ProjectContext) -> str:
    try:
        value = read_regular_text(
            context.tools_root / "VERSION",
            root=context.tools_root,
            label="Tooling version",
        ).strip()
    except FilesystemSafetyError as exc:
        raise IntegrationError(str(exc)) from exc
    if not value:
        raise IntegrationError("Tooling VERSION must not be empty.")
    return value


def _desired_config(
    context: ProjectContext,
    discovery: ProjectDiscovery,
    actual_version: str,
) -> tuple[ProjectConfig, str]:
    if context.config_exists:
        return replace(context.config, tooling_version=actual_version), "persisted"
    paths = ProjectPathConfig(
        frontend=discovery.paths.frontend or "frontend",
        backend=discovery.paths.backend or "",
        tauri=discovery.paths.tauri or "src-tauri",
        docs="docs",
    )
    config = ProjectConfig(
        tooling_version=actual_version,
        project_name=discovery.project_name,
        profile=discovery.suggested_profile or "web-only",
        paths=paths,
    )
    return config, "detected"


def _config_operation(
    initial: ProjectContext,
    desired: ProjectConfig,
    actual_version: str,
) -> Operation | None:
    if not initial.config_exists:
        return Operation(
            OperationKind.ADD,
            "project-tooling.toml",
            Ownership.STRUCTURED,
            content=render_project_config(desired),
            reason="persist detected portable project decisions",
        )
    if initial.config.tooling_version == actual_version:
        return None
    payload = _read_project_file(
        initial, "project-tooling.toml", "Project configuration"
    )
    return Operation(
        OperationKind.PATCH,
        "project-tooling.toml",
        Ownership.STRUCTURED,
        expected_sha256=hashlib.sha256(payload).hexdigest(),
        reason="record the copied tooling version",
        structured_changes=(
            StructuredChange(
                "tooling.version",
                actual_version,
                expected=initial.config.tooling_version,
            ),
        ),
    )


def _observe_state(context: ProjectContext) -> _StateObservation:
    try:
        target = safe_join(
            context.project_root,
            STATE_RELATIVE_PATH,
            allow_final_symlink=True,
        )
        metadata = target.lstat()
    except FileNotFoundError:
        return _StateObservation(None, None, None, None)
    except FilesystemSafetyError as exc:
        raise IntegrationError(str(exc)) from exc
    except OSError as exc:
        raise IntegrationError("Tooling state could not be inspected safely.") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISREG(metadata.st_mode):
        return _StateObservation(
            None,
            None,
            None,
            Conflict(
                STATE_RELATIVE_PATH,
                Ownership.TOOLING,
                "tooling state must be a no-follow regular file",
                "unsafe-state-path",
            ),
        )
    content = _read_project_file(context, STATE_RELATIVE_PATH, "Tooling state")
    digest = hashlib.sha256(content).hexdigest()
    try:
        state = load_state(context)
    except StateError as exc:
        return _StateObservation(
            None,
            content,
            digest,
            Conflict(
                STATE_RELATIVE_PATH,
                Ownership.TOOLING,
                f"existing tooling state requires an explicit migration: {exc}",
                "invalid-tooling-state",
            ),
        )
    return _StateObservation(state, content, digest, None)


def _managed_state_drift_conflict(
    initial: ProjectContext,
    observation: _StateObservation,
    *,
    actual_version: str,
    allow_registered_tooling_upgrade: bool,
) -> Conflict | None:
    """Reject an unexplained re-baseline of the persisted managed-tree digest."""

    state = observation.state
    if state is None:
        return None
    if not initial.config_exists:
        return Conflict(
            STATE_RELATIVE_PATH,
            Ownership.TOOLING,
            "tooling state exists without its persisted project configuration",
            "unverified-managed-tree",
        )

    baseline_config = replace(
        initial.config,
        tooling_version=state.tooling_version,
        profile=state.profile,
        optional_features=state.optional_features,
    )
    baseline_context = initial.with_config(baseline_config, exists=True)
    observed_digest = _integration_digest(
        baseline_context,
        config=baseline_config,
        applied_migrations=state.applied_migrations,
        operations=(),
    )
    if observed_digest == state.integration_digest:
        return None
    if allow_registered_tooling_upgrade and state.tooling_version != actual_version:
        return None
    return Conflict(
        STATE_RELATIVE_PATH,
        Ownership.TOOLING,
        "managed tools, documentation, or configuration differ from the last "
        "verified state; restore them or run a registered tooling migration",
        "unverified-managed-tree",
    )


def _migration_state_source(
    context: ProjectContext,
) -> _MigrationStateSource | None:
    observation = _observe_state(context)
    if observation.content is None:
        if observation.conflict is not None:
            raise MigrationError(observation.conflict.reason)
        return None
    if observation.state is not None:
        state = observation.state
        return _MigrationStateSource(
            state.tooling_version,
            state.schema_version,
            state.applied_migrations,
            observation,
        )
    try:
        payload = tomllib.loads(observation.content.decode("utf-8"))
    except (UnicodeError, tomllib.TOMLDecodeError) as exc:
        raise MigrationError(
            "Unsupported tooling state is not readable migration-source TOML."
        ) from exc
    if not isinstance(payload, dict):
        raise MigrationError("Migration-source tooling state must be a TOML table.")
    schema = payload.get("schema_version")
    version = payload.get("tooling_version")
    applied = payload.get("applied_migrations", [])
    if not isinstance(schema, int) or isinstance(schema, bool) or schema < 1:
        raise MigrationError(
            "Migration-source tooling state has no valid positive schema_version."
        )
    if (
        not isinstance(version, str)
        or not version.strip()
        or version != version.strip()
    ):
        raise MigrationError(
            "Migration-source tooling state has no valid tooling_version."
        )
    if (
        not isinstance(applied, list)
        or any(
            not isinstance(item, str) or not item.strip() or item != item.strip()
            for item in applied
        )
        or len(applied) != len(set(applied))
    ):
        raise MigrationError(
            "Migration-source tooling state has invalid applied_migrations."
        )
    return _MigrationStateSource(version, schema, tuple(applied), observation)


def _migration_explains_tooling_upgrade(
    assessment: IntegrationAssessment,
    source: _MigrationStateSource,
    run: migration_model.MigrationRun,
) -> bool:
    """Allow changed copied tooling only when a managed upgrade operation is registered."""

    if (
        source.observation.state is None
        or source.tooling_version == assessment.actual_tooling_version
        or not run.migrations
    ):
        return False
    if len(run.migrations) == 1 and run.migrations[0].reconciles_managed_payload:
        return True
    managed_payload_roots = tuple(
        root for root in _managed_roots(assessment.context) if root != ".tooling-state"
    )
    return any(
        operation.ownership is Ownership.TOOLING
        and any(_path_within(operation.path, root) for root in managed_payload_roots)
        for operation in run.operations
    )


def _observe_migration_conditions(
    context: ProjectContext,
    conditions: tuple[migration_model.MigrationCondition, ...],
) -> tuple[ObservedResource, ...]:
    structured_paths = {
        condition.path
        for condition in conditions
        if condition.kind is migration_model.ConditionKind.STRUCTURED_EQUALS
    }
    observations: list[ObservedResource] = []
    for relative in sorted({condition.path for condition in conditions}):
        try:
            target = safe_join(
                context.project_root,
                relative,
                allow_final_symlink=True,
            )
            metadata = target.lstat()
        except FileNotFoundError:
            continue
        except FilesystemSafetyError as exc:
            raise MigrationError(str(exc)) from exc
        except OSError as exc:
            raise MigrationError(
                f"Could not inspect migration condition path: {relative}."
            ) from exc
        ownership = _migration_ownership(context, relative)
        if stat.S_ISLNK(metadata.st_mode):
            observations.append(
                ObservedResource(
                    relative,
                    ownership,
                    kind="file",
                    is_symlink=True,
                )
            )
            continue
        if stat.S_ISDIR(metadata.st_mode):
            observations.append(ObservedResource(relative, ownership, kind="directory"))
            continue
        if not stat.S_ISREG(metadata.st_mode):
            raise MigrationError(
                f"Migration condition path is not a regular file or directory: {relative}."
            )
        content = _read_project_file(context, relative, "Migration condition")
        structured = (
            _migration_structured_values(relative, content)
            if relative in structured_paths
            else {}
        )
        observations.append(
            ObservedResource(
                relative,
                ownership,
                sha256=hashlib.sha256(content).hexdigest(),
                structured_values=structured,
            )
        )
    return tuple(observations)


def _migration_ownership(context: ProjectContext, relative: str) -> Ownership:
    if any(_path_within(relative, root) for root in _managed_roots(context)):
        return Ownership.TOOLING
    if PurePosixPath(
        relative
    ).name in _MIGRATION_STRUCTURED_NAMES or relative.startswith(".github/workflows/"):
        return Ownership.STRUCTURED
    return Ownership.PROJECT


def _migration_structured_values(relative: str, content: bytes) -> dict[str, object]:
    try:
        text = content.decode("utf-8")
        if relative.endswith(".json"):
            payload = json.loads(text)
        elif relative.endswith(".toml") or PurePosixPath(relative).name == "Cargo.toml":
            payload = tomllib.loads(text)
        else:
            return {}
    except (UnicodeError, json.JSONDecodeError, tomllib.TOMLDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _migration_condition_findings(
    context: ProjectContext,
    migrations: tuple[migration_model.Migration, ...],
    *,
    postconditions: bool,
) -> VerificationResult:
    conditions = tuple(
        condition
        for migration in migrations
        for condition in (
            migration.postconditions if postconditions else migration.preconditions
        )
    )
    observed = _observe_migration_conditions(context, conditions)
    findings: list[Finding] = []
    for migration in migrations:
        try:
            if postconditions:
                migration_model.validate_postconditions(migration, observed)
            else:
                migration_model.validate_preconditions(migration, observed)
        except MigrationError as exc:
            findings.append(
                Finding(
                    "migration-postconditions"
                    if postconditions
                    else "migration-preconditions",
                    FindingStatus.FAIL,
                    str(exc),
                )
            )
        else:
            findings.append(
                Finding(
                    "migration-postconditions"
                    if postconditions
                    else "migration-preconditions",
                    FindingStatus.PASS,
                    f"Migration conditions passed: {migration.migration_id}.",
                )
            )
    return VerificationResult(tuple(findings))


def _state_operation(
    observed: _StateObservation,
    desired: ToolingState,
) -> Operation | None:
    if observed.conflict is not None:
        return None
    content = render_state(desired).encode("utf-8")
    if observed.content == content:
        return None
    return Operation(
        OperationKind.ADD if observed.content is None else OperationKind.UPDATE,
        STATE_RELATIVE_PATH,
        Ownership.TOOLING,
        content=content,
        expected_sha256=observed.digest,
        reason="persist verified portable tooling integration state",
    )


def _integration_digest(
    context: ProjectContext,
    *,
    config: ProjectConfig,
    applied_migrations: tuple[str, ...],
    operations: tuple[Operation, ...],
) -> str:
    managed_roots = (
        _relative_path(context.project_root, context.tools_root, label="Tooling root"),
        _relative_path(
            context.project_root, context.docs_root, label="Documentation root"
        ),
    )
    current_manifests = []
    try:
        for relative in sorted(set(managed_roots)):
            current_manifests.append(
                (relative, create_manifest(context.project_root, scope=relative))
            )
    except ManifestError as exc:
        raise IntegrationError(f"Could not inventory portable tooling: {exc}") from exc
    entries = {
        entry.path: entry
        for _, manifest in current_manifests
        for entry in manifest.files
    }
    tooling_runtime = _tooling_runtime_manifest_entry(
        context,
        tools_relative=managed_roots[0],
    )
    if tooling_runtime is not None:
        entries[tooling_runtime.path] = tooling_runtime
    _simulate_managed_operations(entries, tuple(sorted(set(managed_roots))), operations)
    manifests = [
        (
            relative,
            _managed_manifest_digest(
                manifest.schema_version,
                manifest.mode,
                manifest.managed_paths,
                tuple(
                    entries[path]
                    for path in sorted(entries)
                    if _path_within(path, relative)
                ),
            ),
        )
        for relative, manifest in current_manifests
    ]
    payload = {
        "schema_version": INTEGRATION_DIGEST_SCHEMA,
        "managed_manifests": manifests,
        "project_config": render_project_config(config),
        "applied_migrations": list(applied_migrations),
    }
    serialized = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(serialized).hexdigest()


def _tooling_runtime_manifest_entry(
    context: ProjectContext,
    *,
    tools_relative: str,
) -> ManifestEntry | None:
    """Inventory the one versioned runtime that lives below protected ``dist``."""

    relative = _tooling_runtime_path(tools_relative)
    try:
        path = safe_join(context.project_root, relative)
        try:
            metadata = path.lstat()
        except FileNotFoundError:
            return None
        except OSError as exc:
            raise FilesystemSafetyError(
                f"Could not inspect tooling runtime safely: {relative}."
            ) from exc
        content = read_regular_bytes(
            path,
            root=context.project_root,
            label=f"Tooling runtime {relative}",
        )
    except FilesystemSafetyError as exc:
        raise IntegrationError(f"Could not inventory portable tooling: {exc}") from exc
    return _manifest_entry(
        relative,
        content,
        executable=bool(metadata.st_mode & 0o111),
    )


def _tooling_runtime_path(tools_relative: str) -> str:
    return (PurePosixPath(tools_relative) / _RUST_ANALYZER_RUNTIME).as_posix()


def _simulate_managed_operations(
    entries: dict[str, ManifestEntry],
    managed_roots: tuple[str, ...],
    operations: tuple[Operation, ...],
) -> None:
    """Materialize the post-plan managed manifest without touching the project."""

    for operation in operations:
        if operation.path.startswith(".tooling-state/"):
            continue
        source = operation.source_path
        affects_managed = any(
            _path_within(path, root)
            for path in (operation.path, source)
            if path is not None
            for root in managed_roots
        )
        if not affects_managed:
            continue
        if operation.ownership is not Ownership.TOOLING:
            raise IntegrationError(
                "Integration digest cannot safely materialize a structured change "
                f"inside managed tooling: {operation.path}."
            )
        if operation.kind is OperationKind.ENSURE_DIRECTORY:
            if operation.path in entries:
                raise IntegrationError(
                    f"Managed directory path is currently a file: {operation.path}."
                )
            continue
        if operation.kind is OperationKind.ADD:
            if operation.path in entries or operation.content is None:
                raise IntegrationError(
                    f"Managed ADD cannot be materialized safely: {operation.path}."
                )
            entries[operation.path] = _manifest_entry(
                operation.path, operation.content, executable=False
            )
            continue
        if operation.kind is OperationKind.UPDATE:
            current = entries.get(operation.path)
            if (
                current is None
                or current.kind == "symlink"
                or operation.content is None
            ):
                raise IntegrationError(
                    f"Managed UPDATE cannot be materialized safely: {operation.path}."
                )
            entries[operation.path] = _manifest_entry(
                operation.path,
                operation.content,
                executable=current.executable,
            )
            continue
        if operation.kind is OperationKind.DELETE:
            if entries.pop(operation.path, None) is None:
                raise IntegrationError(
                    f"Managed DELETE cannot be materialized safely: {operation.path}."
                )
            continue
        if operation.kind is OperationKind.MOVE:
            if source is None:
                raise IntegrationError(
                    f"Managed MOVE has no source path: {operation.path}."
                )
            current = entries.pop(source, None)
            if (
                current is None
                or current.kind == "symlink"
                or operation.path in entries
            ):
                raise IntegrationError(
                    f"Managed MOVE cannot be materialized safely: {source}."
                )
            if operation.content is None:
                entries[operation.path] = replace(current, path=operation.path)
            else:
                entries[operation.path] = _manifest_entry(
                    operation.path,
                    operation.content,
                    executable=current.executable,
                )
            continue
        raise IntegrationError(
            f"Unsupported managed integration operation: {operation.kind!r}."
        )


def _manifest_entry(path: str, content: bytes, *, executable: bool) -> ManifestEntry:
    try:
        content.decode("utf-8")
    except UnicodeError:
        kind = "binary"
    else:
        kind = "binary" if b"\0" in content else "text"
    return ManifestEntry(
        path=path,
        sha256=hashlib.sha256(content).hexdigest(),
        size=len(content),
        kind=kind,
        executable=executable,
    )


def _managed_manifest_digest(
    schema_version: int,
    mode: str,
    managed_paths: tuple[str, ...],
    entries: tuple[ManifestEntry, ...],
) -> str:
    payload = {
        "schema_version": schema_version,
        "mode": mode,
        "managed_paths": list(managed_paths),
        "files": [
            {
                "path": entry.path,
                "sha256": entry.sha256,
                "size": entry.size,
                "kind": entry.kind,
                "executable": entry.executable,
            }
            for entry in entries
        ],
    }
    serialized = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(serialized).hexdigest()


def _path_within(path: str, root: str) -> bool:
    return path == root or path.startswith(f"{root}/")


def _ambiguity_conflicts(discovery: ProjectDiscovery) -> tuple[Conflict, ...]:
    return tuple(
        Conflict(
            "project-tooling.toml",
            Ownership.STRUCTURED,
            (
                f"multiple {evidence.technology} roots were detected: "
                + ", ".join((evidence.path, *evidence.alternatives))
            ),
            f"ambiguous-{evidence.technology}-path",
        )
        for evidence in discovery.evidence
        if evidence.alternatives
    )


def _configuration_conflicts(
    context: ProjectContext,
    profile: ProjectProfile,
) -> tuple[Conflict, ...]:
    conflicts: list[Conflict] = []
    if "backend" in profile.features and context.paths.backend is None:
        conflicts.append(
            Conflict(
                "project-tooling.toml",
                Ownership.STRUCTURED,
                "the selected profile requires a configured backend path",
                "configured-backend-path-missing",
            )
        )
    product_roots = [context.paths.frontend, context.paths.tauri]
    if context.paths.backend is not None:
        product_roots.append(context.paths.backend)
    reserved = (context.tools_root, context.state_root, context.docs_root)
    for product in product_roots:
        if product == context.project_root:
            continue
        if any(_paths_overlap(product, owned) for owned in reserved):
            conflicts.append(
                Conflict(
                    "project-tooling.toml",
                    Ownership.STRUCTURED,
                    "configured project and tooling ownership roots overlap",
                    "ownership-root-overlap",
                )
            )
            break
    return tuple(conflicts)


def _compose_operations(*groups: tuple[Operation, ...]) -> tuple[Operation, ...]:
    operations = tuple(operation for group in groups for operation in group)
    claimed: dict[str, str] = {}
    for operation in operations:
        key = operation.path.casefold()
        if key in claimed:
            raise IntegrationError(
                f"Integration plans target the same path twice: {operation.path}."
            )
        claimed[key] = operation.path
    return tuple(
        sorted(
            operations,
            key=lambda item: (item.path, str(item.kind), item.source_path or ""),
        )
    )


def _verification(
    context: ProjectContext,
    adapters: tuple[Adapter, ...],
    plan: IntegrationPlan,
    *,
    config_present: bool,
    state_observation: _StateObservation,
    payload_finding: Finding,
) -> VerificationResult:
    registry = build_default_registry()
    selected = registry.select_names(adapter.name for adapter in adapters)
    adapter_result = registry.verify(context, selected)
    tooling_python_result = _tooling_python_verification(context)
    state_matches = (
        state_observation.state is not None
        and state_observation.conflict is None
        and not any(
            operation.path == STATE_RELATIVE_PATH for operation in plan.operations
        )
    )
    findings: list[Finding] = [
        Finding(
            "tooling-version",
            FindingStatus.PASS,
            "tools/VERSION is present and readable",
            path="tools/VERSION",
        ),
        Finding(
            "project-configuration",
            FindingStatus.PASS if config_present else FindingStatus.FAIL,
            (
                "project-tooling.toml is present and valid"
                if config_present
                else "project-tooling.toml has not been created"
            ),
            path="project-tooling.toml",
        ),
        Finding(
            "tooling-state",
            FindingStatus.PASS if state_matches else FindingStatus.FAIL,
            (
                "tooling state matches the managed integration"
                if state_matches
                else "tooling state is missing, invalid, or stale"
            ),
            path=STATE_RELATIVE_PATH,
        ),
    ]
    findings.extend(
        Finding(
            "integration-conflict",
            FindingStatus.FAIL,
            conflict.reason,
            path=conflict.path,
        )
        for conflict in plan.conflicts
    )
    return aggregate_results(
        (adapter_result, tooling_python_result, (payload_finding,), findings)
    )


def _portable_payload_finding(
    context: ProjectContext,
    tooling_version: str,
    *,
    require_release_match: bool,
) -> Finding:
    tools_relative = _relative_path(
        context.project_root,
        context.tools_root,
        label="Tooling root",
    )
    manifest_path = f"{tools_relative}/{PAYLOAD_MANIFEST_NAME}"
    try:
        if require_release_match:
            manifest = validate_portable_payload(
                project_root=context.project_root,
                tools_root=context.tools_root,
                docs_root=context.docs_root,
                tooling_version=tooling_version,
            )
        else:
            manifest = validate_portable_payload_identity(
                tools_root=context.tools_root,
                tooling_version=tooling_version,
            )
    except PortablePayloadError as exc:
        return Finding(
            "portable-payload",
            FindingStatus.FAIL,
            str(exc),
            path=manifest_path,
        )
    if manifest is None:
        message = "Legacy tooling payload predates the consistency manifest."
    else:
        message = (
            "Portable payload matches its "
            f"{len(manifest.files)}-file consistency manifest."
            if require_release_match
            else "Portable payload identity is valid; managed state governs migrated files."
        )
    return Finding(
        "portable-payload",
        FindingStatus.PASS,
        message,
        path=manifest_path,
    )


def _tooling_python_verification(context: ProjectContext) -> VerificationResult:
    """Compile every managed Python source without imports, execution, or bytecode."""

    tools_relative = _relative_path(
        context.project_root,
        context.tools_root,
        label="Tooling root",
    )
    try:
        manifest = create_manifest(context.project_root, scope=tools_relative)
    except ManifestError as exc:
        return VerificationResult(
            (
                Finding(
                    "tooling-python-syntax",
                    FindingStatus.FAIL,
                    f"Tooling sources could not be inventoried safely: {exc}",
                    path=tools_relative,
                ),
            )
        )

    findings: list[Finding] = []
    source_count = 0
    for entry in manifest.files:
        if PurePosixPath(entry.path).suffix.casefold() != ".py":
            continue
        source_count += 1
        if entry.kind != "text":
            findings.append(
                Finding(
                    "tooling-python-syntax",
                    FindingStatus.FAIL,
                    "Tooling Python source must be a regular UTF-8 text file.",
                    path=entry.path,
                )
            )
            continue
        try:
            path = safe_join(context.project_root, entry.path, require_exists=True)
            source = read_regular_text(
                path,
                root=context.project_root,
                label=f"Tooling Python source {entry.path}",
            )
            compile(source, entry.path, "exec", dont_inherit=True, optimize=0)
        except FilesystemSafetyError as exc:
            findings.append(
                Finding(
                    "tooling-python-syntax",
                    FindingStatus.FAIL,
                    str(exc),
                    path=entry.path,
                )
            )
        except (OverflowError, SyntaxError, ValueError) as exc:
            line = getattr(exc, "lineno", None)
            location = f" at line {line}" if isinstance(line, int) else ""
            message = getattr(exc, "msg", str(exc))
            findings.append(
                Finding(
                    "tooling-python-syntax",
                    FindingStatus.FAIL,
                    f"Tooling Python source is invalid{location}: {message}",
                    path=entry.path,
                )
            )
    if findings:
        return VerificationResult(tuple(findings))
    return VerificationResult(
        (
            Finding(
                "tooling-python-syntax",
                FindingStatus.PASS,
                f"Compiled {source_count} tooling Python source file(s) read-only.",
                path=tools_relative,
            ),
        )
    )


def _ensure_tooling_python_sources_valid(
    assessment: IntegrationAssessment,
) -> None:
    failures = tuple(
        finding
        for finding in assessment.verification.findings
        if finding.check == "tooling-python-syntax"
        and finding.status is FindingStatus.FAIL
    )
    if not failures:
        return
    first = failures[0]
    location = f"{first.path}: " if first.path else ""
    remaining = f" (+{len(failures) - 1} more)" if len(failures) > 1 else ""
    raise IntegrationError(
        "Tooling Python source validation failed before mutation: "
        f"{location}{first.message}{remaining}"
    )


def _planned_action_specs(
    assessment: IntegrationAssessment,
) -> tuple[ActionSpec, ...]:
    """Collapse path-level requirements to one fixed, ordered staged action set."""

    requirements = _plan_action_requirements(assessment)
    return tuple(
        ActionSpec(
            ActionKind(action),
            paths=tuple(path for path, actions in requirements if action in actions),
        )
        for action in _TRANSACTIONAL_ACTION_ORDER
        if any(action in actions for _path, actions in requirements)
    )


def _executed_action_messages(
    verification: VerificationResult | None,
) -> tuple[str, ...]:
    if verification is None:
        return ()
    return tuple(
        finding.message
        for finding in verification.findings
        if finding.adapter == "transaction-actions"
        and finding.check.startswith("transaction-action:")
    )


def _plan_action_requirements(
    assessment: IntegrationAssessment,
) -> tuple[tuple[str, tuple[str, ...]], ...]:
    """Classify plan paths whose follow-up actions must share the rollback boundary."""

    tools_relative = _relative_path(
        assessment.context.project_root,
        assessment.context.tools_root,
        label="Tooling root",
    )
    by_path: dict[str, set[str]] = {}
    for operation in assessment.plan.operations:
        touched_paths = (operation.path,) + (
            (operation.source_path,) if operation.source_path is not None else ()
        )
        for path in touched_paths:
            required: set[str] = set()
            candidate = PurePosixPath(path)
            dependency_manifest = _is_dependency_manifest(candidate)
            if _path_within(path, tools_relative):
                if dependency_manifest:
                    required.add("dependencies")
                if operation.kind is not OperationKind.ENSURE_DIRECTORY:
                    required.update(("quality", "tests"))
            if (
                path == operation.path
                and operation.ownership is Ownership.STRUCTURED
                and (
                    candidate.name in _ACTION_RELEVANT_STRUCTURED_NAMES
                    or path.startswith(".github/workflows/")
                )
            ):
                if dependency_manifest and _structured_dependency_change(operation):
                    required.add("dependencies")
                required.update(("quality", "tests"))
                if candidate.name in _ACTION_RELEVANT_STRUCTURED_NAMES:
                    required.add("build")
            if required:
                by_path.setdefault(path, set()).update(required)
    return tuple(
        (
            path,
            tuple(
                action for action in _TRANSACTIONAL_ACTION_ORDER if action in actions
            ),
        )
        for path, actions in sorted(by_path.items())
    )


def _structured_dependency_change(operation: Operation) -> bool:
    """Return whether a key-level patch changes dependency declarations."""

    prefixes = {
        "build-dependencies",
        "dependencies",
        "dev-dependencies",
        "devDependencies",
        "optional-dependencies",
        "peerDependencies",
        "project.dependencies",
        "project.optional-dependencies",
        "tool.poetry.dependencies",
        "tool.poetry.dev-dependencies",
    }
    return any(
        change.key == prefix or change.key.startswith(f"{prefix}.")
        for change in operation.structured_changes
        for prefix in prefixes
    )


def _is_dependency_manifest(path: PurePosixPath) -> bool:
    name = path.name.casefold()
    return name in _DEPENDENCY_MANIFEST_NAMES or (
        name.startswith("requirements")
        and path.suffix.casefold() in {".in", ".lock", ".txt"}
    )


def _managed_roots(context: ProjectContext) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                _relative_path(
                    context.project_root, context.tools_root, label="Tooling root"
                ),
                _relative_path(
                    context.project_root,
                    context.docs_root,
                    label="Documentation root",
                ),
                ".tooling-state",
            }
        )
    )


def _relative_path(root: Path, path: Path, *, label: str) -> str:
    try:
        relative = path.absolute().relative_to(root).as_posix()
        return safe_relative_path(relative)
    except (ValueError, FilesystemSafetyError) as exc:
        raise IntegrationError(f"{label} is outside the project root.") from exc


def _read_project_file(context: ProjectContext, relative: str, label: str) -> bytes:
    try:
        path = safe_join(context.project_root, relative, require_exists=True)
        return read_regular_bytes(path, root=context.project_root, label=label)
    except FilesystemSafetyError as exc:
        raise IntegrationError(str(exc)) from exc


def _paths_overlap(left: Path, right: Path) -> bool:
    left_parts = PurePosixPath(left.relative_to(left.anchor).as_posix()).parts
    right_parts = PurePosixPath(right.relative_to(right.anchor).as_posix()).parts
    shorter, longer = (
        (left_parts, right_parts)
        if len(left_parts) <= len(right_parts)
        else (right_parts, left_parts)
    )
    return longer[: len(shorter)] == shorter


__all__ = [
    "AppliedIntegration",
    "AppliedMigration",
    "GitPreflight",
    "IntegrationAssessment",
    "MigrationAssessment",
    "assess_migrations",
    "assess_project",
    "ensure_clean_git",
    "run_full_fix",
    "run_migrations",
    "verify_project",
]
