"""Backend feature adapter."""

import re
from collections.abc import Mapping
from dataclasses import replace
from pathlib import Path

from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    AdapterDesiredState,
    AdapterDetection,
    BaseAdapter,
    PathRequirement,
    project_relative_path,
    structured_value,
)
from tools.core.context import ProjectContext
from tools.core.filesystem import FilesystemSafetyError, read_regular_text, safe_join
from tools.integration.model import Finding, FindingStatus, Ownership, StructuredChange
from tools.integration.planner import ObservedResource

_FASTAPI_SOURCE = re.compile(
    r"(?m)(?:^\s*(?:from\s+fastapi\b|import\s+fastapi\b)|\bFastAPI\s*\()"
)
_FASTAPI_DEPENDENCY = re.compile(r"(?i)(?:^|[^a-z0-9_-])fastapi(?:$|[^a-z0-9_-])")
_PROFILE_METADATA_TABLE = "tool.template_tooling"
_PROFILE_METADATA_KEY = "tool.template_tooling.profile"
_LEGACY_PROFILE_VALUE = "legacy"


class BackendAdapter(BaseAdapter):
    name = "backend"
    feature_ids = ("backend",)
    capabilities = frozenset({AdapterCapability.INSTALL, AdapterCapability.TEST})

    def install(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.INSTALL)

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        if context.paths.backend is None:
            return ()
        root = context.paths.backend
        requirements = []
        if root != context.project_root:
            requirements.append(
                PathRequirement(
                    path=project_relative_path(context, root),
                    ownership=Ownership.PROJECT,
                    kind="directory",
                    required=False,
                    reason="backend feature root",
                )
            )
        requirements.extend(
            (
                PathRequirement(
                    path=project_relative_path(context, root / "app" / "main.py"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="FastAPI application marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "main.py"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="FastAPI root application marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "pyproject.toml"),
                    ownership=Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    reason="normalize explicit tooling profile metadata",
                    structured_changes=(
                        StructuredChange(
                            _PROFILE_METADATA_KEY,
                            context.config.profile,
                        ),
                    ),
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "requirements.txt"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Python dependency marker",
                ),
            )
        )
        return tuple(requirements)

    def detect(self, context: ProjectContext) -> AdapterDetection:
        """Require both FastAPI source and dependency evidence."""

        detection = super().detect(context)
        if context.paths.backend is None:
            return replace(detection, detected=False)
        root = context.paths.backend
        source = any(
            _safe_contains(context, candidate, _FASTAPI_SOURCE)
            for candidate in (root / "app" / "main.py", root / "main.py")
        )
        dependency = any(
            _safe_contains(context, candidate, _FASTAPI_DEPENDENCY)
            for candidate in (root / "requirements.txt", root / "pyproject.toml")
        )
        return replace(detection, detected=source and dependency)

    def desired_structured_changes(
        self,
        context: ProjectContext,
        desired_state: AdapterDesiredState,
        requirement: PathRequirement,
        observed: ObservedResource,
        detection: AdapterDetection,
    ) -> tuple[StructuredChange, ...]:
        """Add or migrate profile metadata only in the tooling namespace."""

        del context
        if not detection.detected or not requirement.path.endswith("pyproject.toml"):
            return ()
        found, current = structured_value(
            observed.structured_values,
            _PROFILE_METADATA_KEY,
        )
        if not found:
            table_found, table = structured_value(
                observed.structured_values,
                _PROFILE_METADATA_TABLE,
            )
            if table_found and isinstance(table, Mapping):
                return (StructuredChange(_PROFILE_METADATA_KEY, desired_state.profile),)
            return ()
        if current == _LEGACY_PROFILE_VALUE:
            return (
                StructuredChange(
                    _PROFILE_METADATA_KEY,
                    desired_state.profile,
                    expected=_LEGACY_PROFILE_VALUE,
                ),
            )
        return ()

    def configuration_findings(self, context: ProjectContext) -> tuple[Finding, ...]:
        if context.paths.backend is not None:
            return ()
        return (
            Finding(
                check="configured-path",
                status=FindingStatus.WARN,
                message="backend feature requires a configured backend path",
                adapter=self.name,
                path="project-tooling.toml",
            ),
        )


def _safe_contains(
    context: ProjectContext, path: Path, pattern: re.Pattern[str]
) -> bool:
    try:
        relative = project_relative_path(context, path)
        target = safe_join(context.project_root, relative, require_exists=True)
        return (
            pattern.search(
                read_regular_text(
                    target, root=context.project_root, label="Backend marker"
                )
            )
            is not None
        )
    except (FilesystemSafetyError, OSError, UnicodeError):
        return False


__all__ = ["BackendAdapter"]
