"""Tauri desktop-shell feature adapter."""

from collections.abc import Mapping

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
from tools.integration.model import Ownership, StructuredChange
from tools.integration.planner import ObservedResource

_PROFILE_METADATA_TABLE = "package.metadata.template_tooling"
_PROFILE_METADATA_KEY = f"{_PROFILE_METADATA_TABLE}.profile"
_LEGACY_PROFILE_VALUE = "legacy"
_BUILD_COMMAND_KEY = "build.beforeBuildCommand"
_LEGACY_BUILD_COMMAND = "vite build"
_BUILD_COMMAND = "npm run build"


class TauriAdapter(BaseAdapter):
    name = "tauri"
    feature_ids = ("tauri",)
    capabilities = frozenset(AdapterCapability)

    def install(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.INSTALL)

    def run(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.RUN)

    def stop(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.STOP)

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def build(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.BUILD)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        root = context.paths.tauri
        requirements = []
        if root != context.project_root:
            requirements.append(
                PathRequirement(
                    path=project_relative_path(context, root),
                    ownership=Ownership.PROJECT,
                    kind="directory",
                    required=False,
                    reason="Tauri feature root",
                )
            )
        requirements.extend(
            (
                PathRequirement(
                    path=project_relative_path(context, root / "Cargo.toml"),
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
                    path=project_relative_path(context, root / "tauri.conf.json"),
                    ownership=Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    reason="add or normalize the known Tauri build command",
                    marker=True,
                    structured_changes=(
                        StructuredChange(_BUILD_COMMAND_KEY, _BUILD_COMMAND),
                    ),
                    structured_object_keys=("build",),
                ),
            )
        )
        return tuple(requirements)

    def desired_structured_changes(
        self,
        context: ProjectContext,
        desired_state: AdapterDesiredState,
        requirement: PathRequirement,
        observed: ObservedResource,
        detection: AdapterDetection,
    ) -> tuple[StructuredChange, ...]:
        """Add or migrate explicit Tauri metadata and build commands."""

        del context
        if not detection.detected:
            return ()
        if requirement.path.endswith("Cargo.toml"):
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
                    return (
                        StructuredChange(_PROFILE_METADATA_KEY, desired_state.profile),
                    )
                return ()
            if found and current == _LEGACY_PROFILE_VALUE:
                return (
                    StructuredChange(
                        _PROFILE_METADATA_KEY,
                        desired_state.profile,
                        expected=_LEGACY_PROFILE_VALUE,
                    ),
                )
            return ()
        if requirement.path.endswith("tauri.conf.json"):
            found, current = structured_value(
                observed.structured_values,
                _BUILD_COMMAND_KEY,
            )
            if not found:
                table_found, table = structured_value(
                    observed.structured_values,
                    "build",
                )
                if table_found and isinstance(table, Mapping):
                    return (StructuredChange(_BUILD_COMMAND_KEY, _BUILD_COMMAND),)
                return ()
            if found and current == _LEGACY_BUILD_COMMAND:
                return (
                    StructuredChange(
                        _BUILD_COMMAND_KEY,
                        _BUILD_COMMAND,
                        expected=_LEGACY_BUILD_COMMAND,
                    ),
                )
        return ()


__all__ = ["TauriAdapter"]
