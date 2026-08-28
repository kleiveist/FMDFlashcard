"""Typed, filesystem-safe contracts shared by all feature adapters.

Adapters observe and describe project state.  They never own a filesystem
write boundary: applying their operations means submitting one immutable plan
to the transaction boundary supplied by the integration service.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import tempfile
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from types import MappingProxyType
from typing import TYPE_CHECKING, Protocol, runtime_checkable

import tomllib

from tools.core.context import ProjectContext
from tools.core.filesystem import (
    FilesystemSafetyError,
    read_regular_bytes,
    safe_join,
    safe_relative_path,
    validate_root,
)
from tools.integration.model import (
    Conflict,
    Finding,
    FindingStatus,
    IntegrationPlan,
    IntegrationResult,
    Operation,
    Ownership,
    StructuredChange,
    VerificationResult,
)
from tools.integration.planner import (
    DesiredProfile,
    DesiredResource,
    ObservedResource,
    create_plan,
)
from tools.integration.sanitize import sanitize_text
from tools.process import run_bounded, safe_platform_environment

if TYPE_CHECKING:
    from tools.profiles.model import ProjectProfile


_IDENTIFIER = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")


class AdapterError(RuntimeError):
    """Base class for adapter contract and orchestration failures."""


class AdapterContractError(AdapterError):
    """Raised when an adapter returns unsafe or contradictory data."""


class AdapterApplyError(AdapterError):
    """Raised when operations cannot be submitted to a transaction boundary."""


class AdapterCapability(str, Enum):
    """Explicit user actions, never implicit integration or Full-Fix steps."""

    INSTALL = "install"
    RUN = "run"
    STOP = "stop"
    TEST = "test"
    BUILD = "build"


_CONTROL_ACTION_TIMEOUT_SECONDS = 900
_CONTROL_ACTION_OUTPUT_LIMIT = 1200
_CONTROL_ACTION_ARGUMENTS: Mapping[tuple[str, AdapterCapability], tuple[str, ...]] = (
    MappingProxyType(
        {
            ("backend", AdapterCapability.INSTALL): (
                "install",
                "--skip-frontend",
                "--skip-tooling",
                "--skip-playwright",
            ),
            ("backend", AdapterCapability.TEST): ("test", "--suite", "api"),
            ("container", AdapterCapability.BUILD): ("build", "container"),
            ("container", AdapterCapability.TEST): ("container", "validate"),
            ("database", AdapterCapability.TEST): ("test", "--suite", "database"),
            ("documentation", AdapterCapability.TEST): ("docs", "check"),
            ("frontend", AdapterCapability.BUILD): ("build", "web"),
            ("frontend", AdapterCapability.INSTALL): (
                "install",
                "--skip-backend",
                "--skip-tooling",
                "--skip-playwright",
            ),
            ("frontend", AdapterCapability.TEST): ("test", "--suite", "frontend"),
            ("quality", AdapterCapability.TEST): ("quality",),
            ("release", AdapterCapability.TEST): ("release", "check"),
            ("tauri", AdapterCapability.BUILD): ("tauri", "build"),
            ("tauri", AdapterCapability.INSTALL): ("tauri", "install"),
            ("tauri", AdapterCapability.RUN): ("tauri", "run", "--no-follow"),
            ("tauri", AdapterCapability.STOP): ("tauri", "stop"),
            ("tauri", AdapterCapability.TEST): ("tauri", "test"),
            ("testing", AdapterCapability.TEST): ("test", "--suite", "tools"),
        }
    )
)


@dataclass(frozen=True, slots=True)
class AdapterActionResult:
    """Typed result returned by an optional technology action."""

    adapter: str
    capability: AdapterCapability
    ok: bool
    message: str = ""

    def __post_init__(self) -> None:
        if not isinstance(self.adapter, str) or not _IDENTIFIER.fullmatch(self.adapter):
            raise AdapterContractError(
                f"Adapter action name must use lowercase kebab-case: {self.adapter!r}."
            )
        if not isinstance(self.capability, AdapterCapability):
            raise AdapterContractError(
                "Adapter action capability must be an AdapterCapability value."
            )
        if not isinstance(self.ok, bool):
            raise AdapterContractError("Adapter action result ok flag must be boolean.")
        if not isinstance(self.message, str):
            raise AdapterContractError("Adapter action result message must be text.")


@runtime_checkable
class InstallCapability(Protocol):
    def install(self, context: ProjectContext) -> AdapterActionResult: ...


@runtime_checkable
class RunCapability(Protocol):
    def run(self, context: ProjectContext) -> AdapterActionResult: ...


@runtime_checkable
class StopCapability(Protocol):
    def stop(self, context: ProjectContext) -> AdapterActionResult: ...


@runtime_checkable
class TestCapability(Protocol):
    def test(self, context: ProjectContext) -> AdapterActionResult: ...


@runtime_checkable
class BuildCapability(Protocol):
    def build(self, context: ProjectContext) -> AdapterActionResult: ...


@dataclass(frozen=True, slots=True)
class AdapterDesiredState:
    """The profile identity and expanded feature set seen by adapters."""

    profile: str
    features: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        profile = self.profile.strip()
        if not profile:
            raise AdapterContractError("Adapter desired profile must not be empty.")
        features = _normalized_identifiers(self.features, label="feature")
        object.__setattr__(self, "profile", profile)
        object.__setattr__(self, "features", features)

    @classmethod
    def from_profile(
        cls,
        value: AdapterDesiredState | DesiredProfile | ProjectProfile,
    ) -> AdapterDesiredState:
        """Normalize integration and profile-layer desired-state objects."""

        if isinstance(value, cls):
            return value
        profile = getattr(value, "profile", None)
        if profile is None:
            profile = getattr(value, "profile_id", None)
        features = getattr(value, "features", None)
        if not isinstance(profile, str) or not isinstance(features, tuple):
            raise AdapterContractError(
                "Desired state must expose a profile id and a tuple of features."
            )
        return cls(profile=profile, features=features)


@dataclass(frozen=True, slots=True)
class PathRequirement:
    """One conservative path requirement contributed by an adapter.

    ``content`` is permitted only for tooling-owned files.  Omitting content
    makes an existing path a presence requirement, not permission to invent or
    replace its payload.  ``create_if_missing`` must be explicit even when
    content is present.  Structured JSON and TOML files may declare only exact
    dotted keys. JSON files may additionally declare object-shape guards; every
    structured file is observed before any PATCH is planned.
    """

    path: str
    ownership: Ownership
    kind: str = "directory"
    required: bool = True
    reason: str = "required by the selected adapter"
    content: bytes | str | None = field(default=None, repr=False)
    create_if_missing: bool = False
    marker: bool = False
    marker_json_keys: tuple[str, ...] = ()
    marker_script_commands: tuple[str, ...] = ()
    structured_changes: tuple[StructuredChange, ...] = ()
    structured_object_keys: tuple[str, ...] = ()
    structured_string_map_keys: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        try:
            path = safe_relative_path(self.path)
        except FilesystemSafetyError as exc:
            raise AdapterContractError(str(exc)) from exc
        if not isinstance(self.ownership, Ownership):
            raise AdapterContractError(
                f"Adapter path ownership must be an Ownership value: {self.path}."
            )
        if self.kind not in {"file", "directory"}:
            raise AdapterContractError(
                f"Unsupported adapter path kind at {self.path}: {self.kind!r}."
            )
        content = (
            self.content.encode("utf-8")
            if isinstance(self.content, str)
            else self.content
        )
        if content is not None and not isinstance(content, bytes):
            raise AdapterContractError(
                f"Adapter content must be bytes or text at {self.path}."
            )
        if content is not None and self.kind != "file":
            raise AdapterContractError(
                f"Directory requirement cannot carry content: {self.path}."
            )
        if content is not None and self.ownership is not Ownership.TOOLING:
            raise AdapterContractError(
                f"Only tooling-owned requirements may carry full content: {self.path}."
            )
        if self.create_if_missing and self.ownership is Ownership.PROJECT:
            raise AdapterContractError(
                f"Project-owned paths cannot be auto-created: {self.path}."
            )
        if self.create_if_missing and self.kind == "file" and content is None:
            raise AdapterContractError(
                f"A created tooling file requires materialized content: {self.path}."
            )
        if not isinstance(self.marker, bool):
            raise AdapterContractError(
                f"Adapter marker flag must be boolean: {self.path}."
            )
        if not isinstance(self.marker_json_keys, tuple) or not isinstance(
            self.marker_script_commands, tuple
        ):
            raise AdapterContractError(
                f"Adapter JSON marker selectors must be tuples: {self.path}."
            )
        marker_json_keys = tuple(self.marker_json_keys)
        marker_script_commands = tuple(self.marker_script_commands)
        if not isinstance(self.structured_changes, tuple) or any(
            not isinstance(change, StructuredChange)
            for change in self.structured_changes
        ):
            raise AdapterContractError(
                f"Structured changes must be a tuple of StructuredChange values: "
                f"{self.path}."
            )
        if not isinstance(self.structured_object_keys, tuple):
            raise AdapterContractError(
                f"Structured object selectors must be a tuple: {self.path}."
            )
        if not isinstance(self.structured_string_map_keys, tuple):
            raise AdapterContractError(
                f"Structured string-map selectors must be a tuple: {self.path}."
            )
        structured_changes = tuple(
            sorted(self.structured_changes, key=lambda change: change.key)
        )
        structured_object_keys = tuple(sorted(self.structured_object_keys))
        structured_string_map_keys = tuple(sorted(self.structured_string_map_keys))
        if any(
            not isinstance(selector, str)
            or not selector
            or any(not part for part in selector.split("."))
            for selector in marker_json_keys
        ) or any(
            not isinstance(command, str) or not command
            for command in marker_script_commands
        ):
            raise AdapterContractError(
                f"Adapter JSON marker selectors must be non-empty text: {self.path}."
            )
        if (marker_json_keys or marker_script_commands) and (
            not self.marker
            or self.kind != "file"
            or not self.path.casefold().endswith(".json")
        ):
            raise AdapterContractError(
                f"JSON marker selectors require a marked JSON file: {self.path}."
            )
        duplicate_change = _duplicate(change.key for change in structured_changes)
        if duplicate_change is not None:
            raise AdapterContractError(
                f"Structured key is declared more than once at {self.path}: "
                f"{duplicate_change}."
            )
        overlapping_changes = _overlapping_dotted_keys(
            change.key for change in structured_changes
        )
        if overlapping_changes is not None:
            parent, child = overlapping_changes
            raise AdapterContractError(
                f"Structured keys overlap at {self.path}: {parent!r} and {child!r}."
            )
        if any(
            not isinstance(key, str)
            or not key
            or any(not part for part in key.split("."))
            for key in structured_object_keys
        ):
            raise AdapterContractError(
                f"Structured object selectors must be non-empty dotted keys: {self.path}."
            )
        if len(structured_object_keys) != len(set(structured_object_keys)):
            raise AdapterContractError(
                f"Structured object selectors must be unique: {self.path}."
            )
        if any(
            not isinstance(key, str)
            or not key
            or any(not part for part in key.split("."))
            for key in structured_string_map_keys
        ) or len(structured_string_map_keys) != len(set(structured_string_map_keys)):
            raise AdapterContractError(
                f"Structured string-map selectors must be unique dotted keys: {self.path}."
            )
        if not set(structured_string_map_keys).issubset(structured_object_keys):
            raise AdapterContractError(
                "Structured string-map selectors must also be declared as object "
                f"selectors: {self.path}."
            )
        if (
            structured_object_keys or structured_string_map_keys
        ) and not self.path.casefold().endswith(".json"):
            raise AdapterContractError(
                "Structured object selectors are supported only for JSON files: "
                f"{self.path}."
            )
        if self.ownership is Ownership.STRUCTURED and (
            self.kind != "file"
            or not self.path.casefold().endswith((".json", ".toml"))
            or content is not None
            or self.create_if_missing
        ):
            raise AdapterContractError(
                "Structured configuration requirements must target an existing, "
                f"structured-owned JSON or TOML file: {self.path}."
            )
        if (
            structured_changes or structured_object_keys or structured_string_map_keys
        ) and (self.ownership is not Ownership.STRUCTURED):
            raise AdapterContractError(
                "Structured configuration policy requires structured ownership: "
                f"{self.path}."
            )
        object.__setattr__(self, "path", path)
        object.__setattr__(self, "content", content)
        object.__setattr__(self, "marker_json_keys", marker_json_keys)
        object.__setattr__(self, "marker_script_commands", marker_script_commands)
        object.__setattr__(self, "structured_changes", structured_changes)
        object.__setattr__(self, "structured_object_keys", structured_object_keys)
        object.__setattr__(
            self, "structured_string_map_keys", structured_string_map_keys
        )


@dataclass(frozen=True, slots=True)
class AdapterDetection:
    """Deterministic read-only observations and detection diagnostics."""

    adapter: str
    resources: tuple[ObservedResource, ...] = ()
    findings: tuple[Finding, ...] = ()
    detected: bool = False

    def __post_init__(self) -> None:
        resources = tuple(sorted(self.resources, key=lambda item: item.path))
        findings = tuple(sorted(self.findings, key=_finding_key))
        if len(resources) != len({item.path.casefold() for item in resources}):
            raise AdapterContractError(
                f"Adapter {self.adapter!r} detected the same path more than once."
            )
        object.__setattr__(self, "resources", resources)
        object.__setattr__(self, "findings", findings)
        if not isinstance(self.detected, bool):
            raise AdapterContractError("Adapter detected flag must be boolean.")


@runtime_checkable
class TransactionBoundary(Protocol):
    """The only gateway through which adapters may request filesystem changes."""

    def submit(
        self,
        context: ProjectContext,
        plan: IntegrationPlan,
        *,
        source: str,
    ) -> IntegrationResult: ...


@runtime_checkable
class Adapter(Protocol):
    """Minimum profile-adapter surface consumed by orchestration."""

    name: str
    feature_ids: tuple[str, ...]
    core: bool
    capabilities: frozenset[AdapterCapability]

    def detect(self, context: ProjectContext) -> AdapterDetection: ...

    def plan(
        self,
        context: ProjectContext,
        desired_state: AdapterDesiredState | DesiredProfile | ProjectProfile,
    ) -> IntegrationPlan: ...

    def apply(
        self,
        context: ProjectContext,
        operations: Iterable[Operation],
    ) -> IntegrationResult: ...

    def verify(self, context: ProjectContext) -> VerificationResult: ...

    def structured_key_allowlist(
        self,
        context: ProjectContext,
    ) -> dict[str, frozenset[str]]: ...


class BaseAdapter:
    """Safe default implementation for declarative path adapters."""

    name = "adapter"
    feature_ids: tuple[str, ...] = ()
    core = False
    capabilities: frozenset[AdapterCapability] = frozenset()

    def __init__(self, transaction_boundary: TransactionBoundary | None = None) -> None:
        self._transaction_boundary = transaction_boundary
        self._validate_identity()

    def supports(self, desired_state: AdapterDesiredState) -> bool:
        return self.core or bool(
            set(self.feature_ids).intersection(desired_state.features)
        )

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        """Return adapter-owned requirements without reading or writing files."""

        del context
        return ()

    def configuration_findings(self, context: ProjectContext) -> tuple[Finding, ...]:
        """Return configuration-only diagnostics before path observation."""

        del context
        return ()

    def desired_structured_changes(
        self,
        context: ProjectContext,
        desired_state: AdapterDesiredState,
        requirement: PathRequirement,
        observed: ObservedResource,
        detection: AdapterDetection,
    ) -> tuple[StructuredChange, ...]:
        """Select declared known-key changes for one observed configuration."""

        del context, desired_state, observed, detection
        return requirement.structured_changes

    def structured_key_allowlist(
        self,
        context: ProjectContext,
    ) -> dict[str, frozenset[str]]:
        """Return this adapter's complete declared structured-write policy."""

        policies: dict[str, frozenset[str]] = {}
        for requirement in self._requirements(context):
            keys = frozenset(change.key for change in requirement.structured_changes)
            if keys:
                policies[requirement.path] = keys
        return {path: policies[path] for path in sorted(policies)}

    def _run_control_action(
        self,
        context: ProjectContext,
        capability: AdapterCapability,
    ) -> AdapterActionResult:
        """Execute one built-in, explicitly requested control action."""

        if capability not in self.capabilities:
            raise AdapterContractError(
                f"Adapter {self.name!r} does not declare {capability.value!r}."
            )
        return run_control_action(
            context,
            adapter=self.name,
            capability=capability,
        )

    def detect(self, context: ProjectContext) -> AdapterDetection:
        findings = list(self.configuration_findings(context))
        resources: list[ObservedResource] = []
        requirements = self._requirements(context)
        for requirement in requirements:
            try:
                observation, observation_issues = _observe(context, requirement)
                resources.append(observation)
                findings.extend(
                    Finding(
                        check=check,
                        status=FindingStatus.FAIL,
                        message=message,
                        adapter=self.name,
                        path=requirement.path,
                    )
                    for check, message in observation_issues
                )
                if (
                    observation.exists
                    and not observation.is_symlink
                    and observation.kind != requirement.kind
                ):
                    findings.append(
                        Finding(
                            check="path-kind",
                            status=FindingStatus.FAIL,
                            message=f"adapter path must be a {requirement.kind}",
                            adapter=self.name,
                            path=requirement.path,
                        )
                    )
            except FilesystemSafetyError as exc:
                resources.append(
                    ObservedResource(
                        path=requirement.path,
                        ownership=requirement.ownership,
                        exists=True,
                        kind=requirement.kind,
                        is_symlink=True,
                    )
                )
                findings.append(
                    Finding(
                        check="path-safety",
                        status=FindingStatus.FAIL,
                        message=str(exc),
                        adapter=self.name,
                        path=requirement.path,
                    )
                )
        resource_by_path = {item.path: item for item in resources}
        markers = tuple(item for item in requirements if item.marker)
        detection_requirements = markers or requirements
        detected = any(
            _matches_detection_marker(
                context,
                requirement,
                resource_by_path[requirement.path],
            )
            for requirement in detection_requirements
        )
        return AdapterDetection(
            adapter=self.name,
            resources=tuple(resources),
            findings=tuple(findings),
            detected=detected,
        )

    def plan(
        self,
        context: ProjectContext,
        desired_state: AdapterDesiredState | DesiredProfile | ProjectProfile,
    ) -> IntegrationPlan:
        desired = AdapterDesiredState.from_profile(desired_state)
        if not self.supports(desired):
            return IntegrationPlan(
                profile=desired.profile,
                desired_features=desired.features,
            )

        detection = self.detect(context)
        observed = {item.path: item for item in detection.resources}
        blocked_paths = {
            finding.path
            for finding in detection.findings
            if finding.status is FindingStatus.FAIL
            and finding.check
            in {
                "path-kind",
                "path-safety",
                "structured-json",
                "structured-toml",
                "structured-shape",
            }
        }
        desired_resources: list[DesiredResource] = []
        conflicts: list[Conflict] = []
        for requirement in self._requirements(context):
            actual = observed[requirement.path]
            if requirement.path in blocked_paths:
                continue
            if (
                not actual.exists
                and not requirement.required
                and requirement.ownership is Ownership.STRUCTURED
            ):
                continue
            if (
                not actual.exists
                and requirement.ownership is Ownership.TOOLING
                and not requirement.create_if_missing
            ):
                if requirement.required:
                    conflicts.append(
                        Conflict(
                            path=requirement.path,
                            ownership=Ownership.TOOLING,
                            reason=(
                                "required tooling path is missing and this adapter "
                                "has no materialized repair payload"
                            ),
                            code="adapter-resource-missing",
                        )
                    )
                continue
            desired_resources.append(
                _desired_requirement(
                    requirement,
                    actual,
                    structured_changes=self.desired_structured_changes(
                        context,
                        desired,
                        requirement,
                        actual,
                        detection,
                    ),
                )
            )

        plan = create_plan(
            detection.resources,
            DesiredProfile(
                profile=desired.profile,
                resources=tuple(desired_resources),
                features=desired.features,
            ),
        )
        detection_conflicts = tuple(
            Conflict(
                path=finding.path or "project-tooling.toml",
                ownership=(
                    observed[finding.path].ownership
                    if finding.check in {"path-kind", "path-safety"}
                    and finding.path in observed
                    and observed[finding.path].ownership is not None
                    else Ownership.STRUCTURED
                ),
                reason=finding.message,
                code={
                    "path-safety": "adapter-path-safety",
                    "path-kind": "adapter-path-kind",
                    "structured-json": "adapter-structured-json",
                    "structured-toml": "adapter-structured-toml",
                    "structured-shape": "adapter-structured-shape",
                }.get(finding.check, "adapter-configuration"),
            )
            for finding in detection.findings
            if finding.status is FindingStatus.FAIL
            and finding.check
            in {
                "configured-path",
                "path-kind",
                "path-safety",
                "structured-json",
                "structured-toml",
                "structured-shape",
            }
        )
        return IntegrationPlan(
            profile=plan.profile,
            desired_features=plan.desired_features,
            operations=plan.operations,
            conflicts=tuple(
                sorted(
                    (*plan.conflicts, *conflicts, *detection_conflicts),
                    key=lambda item: (item.path, item.code, item.reason),
                )
            ),
        )

    def apply(
        self,
        context: ProjectContext,
        operations: Iterable[Operation],
    ) -> IntegrationResult:
        """Submit operations atomically; never perform an adapter-local write."""

        if self._transaction_boundary is None:
            raise AdapterApplyError(
                f"Adapter {self.name!r} has no shared transaction boundary."
            )
        normalized = _normalized_operations(operations)
        if any(item.ownership is Ownership.PROJECT for item in normalized):
            raise AdapterApplyError(
                f"Adapter {self.name!r} refused a project-owned write."
            )
        plan = IntegrationPlan(
            profile=context.config.profile,
            desired_features=tuple(sorted(self.feature_ids)),
            operations=normalized,
        )
        return self._transaction_boundary.submit(context, plan, source=self.name)

    def verify(self, context: ProjectContext) -> VerificationResult:
        detection = self.detect(context)
        requirements = {item.path: item for item in self._requirements(context)}
        findings = list(detection.findings)
        unsafe_paths = {
            item.path
            for item in findings
            if item.check == "path-safety" and item.status is FindingStatus.FAIL
        }
        wrong_kind_paths = {
            item.path
            for item in findings
            if item.check == "path-kind" and item.status is FindingStatus.FAIL
        }
        invalid_paths = {
            item.path
            for item in findings
            if item.status is FindingStatus.FAIL
            and item.check in {"structured-json", "structured-toml", "structured-shape"}
        }
        for actual in detection.resources:
            requirement = requirements[actual.path]
            if actual.path in unsafe_paths or actual.path in invalid_paths:
                continue
            if not actual.exists:
                findings.append(
                    Finding(
                        check="required-path"
                        if requirement.required
                        else "optional-path",
                        status=(
                            FindingStatus.FAIL
                            if requirement.required
                            else FindingStatus.INFO
                        ),
                        message=(
                            "required adapter path is missing"
                            if requirement.required
                            else "optional adapter path is not present"
                        ),
                        adapter=self.name,
                        path=requirement.path,
                    )
                )
            elif actual.is_symlink:
                findings.append(
                    Finding(
                        check="path-safety",
                        status=FindingStatus.FAIL,
                        message="adapter path must not be a symbolic link",
                        adapter=self.name,
                        path=requirement.path,
                    )
                )
            elif actual.kind != requirement.kind:
                if actual.path not in wrong_kind_paths:
                    findings.append(
                        Finding(
                            check="path-kind",
                            status=FindingStatus.FAIL,
                            message=f"adapter path must be a {requirement.kind}",
                            adapter=self.name,
                            path=requirement.path,
                        )
                    )
            else:
                findings.append(
                    Finding(
                        check="required-path"
                        if requirement.required
                        else "optional-path",
                        status=FindingStatus.PASS,
                        message="adapter path is present and safe",
                        adapter=self.name,
                        path=requirement.path,
                    )
                )
        return VerificationResult(tuple(sorted(findings, key=_finding_key)))

    def _requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        requirements = tuple(
            sorted(self.requirements(context), key=lambda item: item.path)
        )
        duplicate = _duplicate(item.path.casefold() for item in requirements)
        if duplicate is not None:
            raise AdapterContractError(
                f"Adapter {self.name!r} declares a path more than once: {duplicate}."
            )
        return requirements

    def _validate_identity(self) -> None:
        if not _IDENTIFIER.fullmatch(self.name):
            raise AdapterContractError(
                f"Adapter name must use lowercase kebab-case: {self.name!r}."
            )
        normalized = _normalized_identifiers(self.feature_ids, label="feature")
        if normalized != self.feature_ids:
            raise AdapterContractError(
                f"Adapter {self.name!r} feature ids must be unique and sorted."
            )
        if not isinstance(self.core, bool):
            raise AdapterContractError(
                f"Adapter {self.name!r} core flag must be boolean."
            )
        if not isinstance(self.capabilities, frozenset) or any(
            not isinstance(item, AdapterCapability) for item in self.capabilities
        ):
            raise AdapterContractError(
                f"Adapter {self.name!r} capabilities must be AdapterCapability values."
            )
        control_capabilities = frozenset(
            capability
            for adapter, capability in _CONTROL_ACTION_ARGUMENTS
            if adapter == self.name
        )
        if control_capabilities and self.capabilities != control_capabilities:
            raise AdapterContractError(
                f"Built-in adapter {self.name!r} capabilities do not match its "
                "fixed control-action policy."
            )
        for capability in self.capabilities:
            implementation = getattr(type(self), capability.value, None)
            if not callable(implementation):
                raise AdapterContractError(
                    f"Adapter {self.name!r} declares {capability.value!r} without implementing it."
                )


def project_relative_path(context: ProjectContext, path: Path) -> str:
    """Return a configured context path as a canonical project-relative path."""

    try:
        relative = path.absolute().relative_to(context.project_root).as_posix()
        return safe_relative_path(relative)
    except (ValueError, FilesystemSafetyError) as exc:
        raise AdapterContractError(
            "Configured adapter path is not a safe project-relative path."
        ) from exc


def run_control_action(
    context: ProjectContext,
    *,
    adapter: str,
    capability: AdapterCapability,
) -> AdapterActionResult:
    """Run one fixed built-in action through the copied control entry point.

    These actions are explicit user requests.  They are deliberately separate
    from integration planning and staged Full-Fix verification.
    """

    arguments = _CONTROL_ACTION_ARGUMENTS.get((adapter, capability))
    if arguments is None:
        return _action_result(
            adapter,
            capability,
            ok=False,
            message="Control action is not allowlisted for this adapter.",
        )
    try:
        project_root, control = _validated_control_target(context)
    except (FilesystemSafetyError, OSError) as exc:
        return _action_result(
            adapter,
            capability,
            ok=False,
            message=(
                "Control action refused because its entry point is unsafe: "
                f"{_safe_action_detail(exc, context.project_root)}"
            ),
        )

    command = (sys.executable, str(control), *arguments)
    try:
        with tempfile.TemporaryDirectory(prefix="tooling-adapter-action-") as temporary:
            environment = _control_action_environment(
                Path(temporary),
                project_root,
            )
            completed = run_bounded(
                command,
                cwd=project_root,
                env=environment,
                check=False,
                capture_output=True,
                text=True,
                timeout=_CONTROL_ACTION_TIMEOUT_SECONDS,
                shell=False,
                stdin=subprocess.DEVNULL,
            )
    except subprocess.TimeoutExpired as exc:
        detail = _safe_action_detail(
            "\n".join(
                str(value)
                for value in (exc.stdout, exc.stderr)
                if value not in {None, "", b""}
            ),
            project_root,
        )
        return _action_result(
            adapter,
            capability,
            ok=False,
            message=(
                f"Control action timed out after {_CONTROL_ACTION_TIMEOUT_SECONDS} "
                f"seconds: {detail}"
            ),
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return _action_result(
            adapter,
            capability,
            ok=False,
            message=(
                "Control action could not run: "
                f"{_safe_action_detail(exc, project_root)}"
            ),
        )

    detail = _safe_action_detail(
        "\n".join(
            part for part in (completed.stdout or "", completed.stderr or "") if part
        ),
        project_root,
    )
    if completed.returncode == 0:
        return _action_result(
            adapter,
            capability,
            ok=True,
            message=f"Control action completed successfully: {detail}",
        )
    return _action_result(
        adapter,
        capability,
        ok=False,
        message=(
            f"Control action failed with exit code {completed.returncode}: {detail}"
        ),
    )


def _validated_control_target(context: ProjectContext) -> tuple[Path, Path]:
    project_root = validate_root(context.project_root)
    tools_root = validate_root(context.tools_root)
    if tools_root.parent != project_root:
        raise FilesystemSafetyError(
            "Tooling root must be the direct tools directory of the project root."
        )
    control = safe_join(tools_root, "control.py", require_exists=True)
    try:
        metadata = control.lstat()
    except OSError as exc:
        raise FilesystemSafetyError(
            "Could not inspect the tooling control entry point."
        ) from exc
    if not stat.S_ISREG(metadata.st_mode):
        raise FilesystemSafetyError(
            "Tooling control entry point must be a regular file."
        )
    return project_root, control


def _control_action_environment(temporary: Path, root: Path) -> dict[str, str]:
    home = temporary / "home"
    cache = temporary / "cache"
    config = temporary / "config"
    data = temporary / "data"
    pycache = temporary / "pycache"
    for directory in (home, cache, config, data, pycache):
        directory.mkdir(mode=0o700)

    environment = safe_platform_environment(os.environ)
    environment.update(
        {
            "PATH": _control_action_search_path(os.environ.get("PATH"), root),
            "HOME": str(home),
            "USERPROFILE": str(home),
            "TMP": str(temporary),
            "TEMP": str(temporary),
            "TMPDIR": str(temporary),
            "XDG_CACHE_HOME": str(cache),
            "XDG_CONFIG_HOME": str(config),
            "XDG_DATA_HOME": str(data),
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONNOUSERSITE": "1",
            "PYTHONPYCACHEPREFIX": str(pycache),
            "PIP_CONFIG_FILE": os.devnull,
            "PIP_DISABLE_PIP_VERSION_CHECK": "1",
            "NPM_CONFIG_USERCONFIG": os.devnull,
            "NPM_CONFIG_CACHE": str(cache / "npm"),
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_OPTIONAL_LOCKS": "0",
            "GIT_TERMINAL_PROMPT": "0",
            "NO_COLOR": "1",
        }
    )
    return environment


def _control_action_search_path(value: str | None, root: Path) -> str:
    candidates = (value or os.defpath).split(os.pathsep)
    accepted: list[str] = []
    for candidate in candidates:
        path = Path(candidate)
        if not candidate or not path.is_absolute():
            continue
        try:
            resolved = path.resolve(strict=False)
        except OSError:
            continue
        if resolved == root or resolved.is_relative_to(root):
            continue
        rendered = str(resolved)
        if rendered not in accepted:
            accepted.append(rendered)
    return os.pathsep.join(accepted) if accepted else os.defpath


def _action_result(
    adapter: str,
    capability: AdapterCapability,
    *,
    ok: bool,
    message: str,
) -> AdapterActionResult:
    return AdapterActionResult(
        adapter=adapter,
        capability=capability,
        ok=ok,
        message=message,
    )


def _safe_action_detail(value: object, project_root: Path) -> str:
    sanitized = sanitize_text(value, project_root).strip()
    if not sanitized:
        return "no diagnostic output"
    if len(sanitized) > _CONTROL_ACTION_OUTPUT_LIMIT:
        sanitized = sanitized[-_CONTROL_ACTION_OUTPUT_LIMIT:]
    return " | ".join(line.strip() for line in sanitized.splitlines() if line.strip())


def _observe(
    context: ProjectContext,
    requirement: PathRequirement,
) -> tuple[ObservedResource, tuple[tuple[str, str], ...]]:
    target = safe_join(
        context.project_root,
        requirement.path,
        allow_final_symlink=True,
    )
    try:
        metadata = target.lstat()
    except FileNotFoundError:
        return (
            ObservedResource(
                path=requirement.path,
                ownership=requirement.ownership,
                exists=False,
                kind=requirement.kind,
            ),
            (),
        )
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Could not inspect adapter path safely: {requirement.path}."
        ) from exc

    is_symlink = stat.S_ISLNK(metadata.st_mode)
    if is_symlink:
        return (
            ObservedResource(
                path=requirement.path,
                ownership=requirement.ownership,
                exists=True,
                kind=requirement.kind,
                is_symlink=True,
            ),
            (("path-safety", "adapter path must not be a symbolic link"),),
        )
    if stat.S_ISDIR(metadata.st_mode):
        kind = "directory"
    elif stat.S_ISREG(metadata.st_mode):
        kind = "file"
    else:
        raise FilesystemSafetyError(
            f"Adapter path is not a regular file or directory: {requirement.path}."
        )
    digest: str | None = None
    structured_values: dict[str, object] = {}
    issues: list[tuple[str, str]] = []
    if kind == "file" and stat.S_ISREG(metadata.st_mode):
        payload = read_regular_bytes(
            target,
            root=context.project_root,
            label=f"Adapter path {requirement.path}",
        )
        digest = hashlib.sha256(payload).hexdigest()
        if requirement.ownership is Ownership.STRUCTURED:
            is_json = requirement.path.casefold().endswith(".json")
            try:
                text = payload.decode("utf-8")
                document = (
                    json.loads(
                        text,
                        object_pairs_hook=_unique_json_object,
                        parse_constant=_reject_json_constant,
                    )
                    if is_json
                    else tomllib.loads(text)
                )
            except (
                UnicodeError,
                json.JSONDecodeError,
                tomllib.TOMLDecodeError,
                ValueError,
            ):
                issues.append(
                    (
                        "structured-json" if is_json else "structured-toml",
                        (
                            "structured JSON must be strict, duplicate-free UTF-8 JSON"
                            if is_json
                            else "structured TOML must be valid UTF-8 TOML"
                        ),
                    )
                )
            else:
                if not isinstance(document, dict):
                    issues.append(
                        (
                            "structured-shape",
                            (
                                "structured JSON must contain an object"
                                if is_json
                                else "structured TOML must contain a table"
                            ),
                        )
                    )
                else:
                    structured_values = document
                    for key in requirement.structured_object_keys:
                        found, value = structured_value(document, key)
                        if found and not isinstance(value, dict):
                            issues.append(
                                (
                                    "structured-shape",
                                    f"structured JSON key {key} must contain an object",
                                )
                            )
                    for key in requirement.structured_string_map_keys:
                        found, value = structured_value(document, key)
                        if (
                            found
                            and isinstance(value, dict)
                            and any(
                                not isinstance(item_key, str)
                                or not item_key
                                or not isinstance(item_value, str)
                                or not item_value.strip()
                                for item_key, item_value in value.items()
                            )
                        ):
                            issues.append(
                                (
                                    "structured-shape",
                                    (
                                        f"structured JSON key {key} must map non-empty "
                                        "strings to non-empty strings"
                                    ),
                                )
                            )
    return (
        ObservedResource(
            path=requirement.path,
            ownership=requirement.ownership,
            exists=True,
            sha256=digest,
            kind=kind,
            is_symlink=False,
            structured_values=structured_values,
        ),
        tuple(issues),
    )


def _desired_requirement(
    requirement: PathRequirement,
    observed: ObservedResource,
    *,
    structured_changes: tuple[StructuredChange, ...],
) -> DesiredResource:
    digest = None
    if (
        requirement.kind == "file"
        and requirement.content is None
        and requirement.ownership is not Ownership.STRUCTURED
        and observed.exists
        and not observed.is_symlink
    ):
        digest = observed.sha256
    return DesiredResource(
        path=requirement.path,
        ownership=requirement.ownership,
        content=requirement.content,
        sha256=digest,
        structured_changes=structured_changes,
        required=requirement.required,
        reason=requirement.reason,
        kind=requirement.kind,
    )


def _matches_detection_marker(
    context: ProjectContext,
    requirement: PathRequirement,
    observed: ObservedResource,
) -> bool:
    if not observed.exists or observed.is_symlink or observed.kind != requirement.kind:
        return False
    if not requirement.marker_json_keys and not requirement.marker_script_commands:
        return True
    if requirement.ownership is Ownership.STRUCTURED:
        payload = observed.structured_values
    else:
        try:
            target = safe_join(
                context.project_root,
                requirement.path,
                require_exists=True,
            )
            raw = read_regular_bytes(
                target,
                root=context.project_root,
                label=f"Adapter marker {requirement.path}",
            ).decode("utf-8")
            payload = json.loads(raw)
        except (FilesystemSafetyError, UnicodeError, json.JSONDecodeError):
            return False
        if not isinstance(payload, dict):
            return False
    if any(_json_has_path(payload, key) for key in requirement.marker_json_keys):
        return True
    scripts = payload.get("scripts")
    if not isinstance(scripts, dict):
        return False
    return any(
        isinstance(script, str)
        and _script_runs_any(script, requirement.marker_script_commands)
        for script in scripts.values()
    )


def _json_has_path(payload: dict[str, object], dotted: str) -> bool:
    found, _value = structured_value(payload, dotted)
    return found


def structured_value(payload: Mapping[str, object], dotted: str) -> tuple[bool, object]:
    """Read one exact dotted key from a parsed structured configuration."""

    if dotted in payload:
        return True, payload[dotted]
    current: object = payload
    for part in dotted.split("."):
        if not isinstance(current, Mapping) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _unique_json_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    document: dict[str, object] = {}
    for key, value in pairs:
        if key in document:
            raise ValueError(f"duplicate JSON object key: {key}")
        document[key] = value
    return document


def _reject_json_constant(value: str) -> object:
    raise ValueError(f"non-standard JSON constant: {value}")


def _script_runs_any(script: str, commands: tuple[str, ...]) -> bool:
    # A technology name buried in an arbitrary shell script is not evidence
    # that the script launches that technology (for example ``echo vite``).
    # Keep detection deliberately conservative and require the command to be
    # the first executable token.
    return any(
        re.search(
            rf"^\s*{re.escape(command)}(?:$|\s)",
            script,
        )
        is not None
        for command in commands
    )


def _normalized_operations(operations: Iterable[Operation]) -> tuple[Operation, ...]:
    items = tuple(operations)
    if any(not isinstance(item, Operation) for item in items):
        raise AdapterApplyError("Adapters may submit only typed Operation objects.")
    paths = [item.path.casefold() for item in items]
    if len(paths) != len(set(paths)):
        raise AdapterApplyError("Adapter operations must target unique paths.")
    return tuple(
        sorted(
            items, key=lambda item: (item.path, str(item.kind), item.source_path or "")
        )
    )


def _normalized_identifiers(values: Iterable[str], *, label: str) -> tuple[str, ...]:
    items = tuple(values)
    if any(
        not isinstance(item, str) or not _IDENTIFIER.fullmatch(item) for item in items
    ):
        raise AdapterContractError(
            f"Adapter {label} ids must use lowercase kebab-case."
        )
    return tuple(sorted(dict.fromkeys(items)))


def _duplicate(values: Iterable[str]) -> str | None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None


def _overlapping_dotted_keys(values: Iterable[str]) -> tuple[str, str] | None:
    keys = tuple(sorted(values))
    for index, parent in enumerate(keys):
        prefix = f"{parent}."
        for child in keys[index + 1 :]:
            if child.startswith(prefix):
                return parent, child
    return None


def _finding_key(finding: Finding) -> tuple[str, str, str, str, str]:
    return (
        finding.adapter or "",
        finding.check,
        finding.path or "",
        finding.status.value,
        finding.message,
    )


__all__ = [
    "Adapter",
    "AdapterActionResult",
    "AdapterApplyError",
    "AdapterCapability",
    "AdapterContractError",
    "AdapterDesiredState",
    "AdapterDetection",
    "AdapterError",
    "BaseAdapter",
    "BuildCapability",
    "InstallCapability",
    "PathRequirement",
    "RunCapability",
    "StopCapability",
    "TestCapability",
    "TransactionBoundary",
    "project_relative_path",
    "run_control_action",
]
