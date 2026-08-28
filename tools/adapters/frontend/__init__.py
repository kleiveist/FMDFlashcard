"""Frontend feature adapter with conservative package-script integration."""

from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    AdapterDesiredState,
    AdapterDetection,
    BaseAdapter,
    PathRequirement,
    project_relative_path,
)
from tools.core.context import ProjectContext
from tools.integration.model import Ownership, StructuredChange
from tools.integration.planner import ObservedResource

_SCRIPT_RULES = (
    ("scripts.build", "vite build", "vite"),
    ("scripts.dev", "vite", "vite"),
    ("scripts.format:check", "prettier --check .", "prettier"),
    ("scripts.lint", "eslint .", "eslint"),
    ("scripts.tauri", "tauri", "@tauri-apps/cli"),
    ("scripts.test", "vitest run", "vitest"),
    ("scripts.test:e2e", "playwright test", "@playwright/test"),
    ("scripts.typecheck", "tsc --noEmit", "typescript"),
)


class FrontendAdapter(BaseAdapter):
    name = "frontend"
    feature_ids = ("frontend",)
    capabilities = frozenset(
        {
            AdapterCapability.BUILD,
            AdapterCapability.INSTALL,
            AdapterCapability.TEST,
        }
    )

    def install(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.INSTALL)

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def build(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.BUILD)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        root = context.paths.frontend
        requirements = []
        if root != context.project_root:
            requirements.append(
                PathRequirement(
                    path=project_relative_path(context, root),
                    ownership=Ownership.PROJECT,
                    kind="directory",
                    required=False,
                    reason="frontend feature root",
                )
            )
        requirements.extend(
            (
                PathRequirement(
                    path=project_relative_path(context, root / "package.json"),
                    ownership=Ownership.STRUCTURED,
                    kind="file",
                    required=False,
                    reason="add missing scripts for declared frontend tools",
                    marker=True,
                    marker_json_keys=("dependencies.vite", "devDependencies.vite"),
                    marker_script_commands=("vite",),
                    structured_changes=tuple(
                        StructuredChange(key, value)
                        for key, value, _dependency in _SCRIPT_RULES
                    ),
                    structured_object_keys=(
                        "dependencies",
                        "devDependencies",
                        "scripts",
                    ),
                    structured_string_map_keys=(
                        "dependencies",
                        "devDependencies",
                        "scripts",
                    ),
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "vite.config.ts"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Vite configuration marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "vite.config.js"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Vite JavaScript configuration marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "vite.config.cjs"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Vite CommonJS configuration marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "vite.config.mjs"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Vite ESM configuration marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "vite.config.cts"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Vite CommonJS TypeScript configuration marker",
                    marker=True,
                ),
                PathRequirement(
                    path=project_relative_path(context, root / "vite.config.mts"),
                    ownership=Ownership.PROJECT,
                    kind="file",
                    required=False,
                    reason="Vite ESM TypeScript configuration marker",
                    marker=True,
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
        """Add only absent scripts backed by technology already in the project."""

        del context, desired_state, detection
        if not requirement.structured_changes:
            return ()
        document = observed.structured_values
        scripts = document.get("scripts", {})
        if not isinstance(scripts, dict):
            # Observation emits a fail-closed structured-shape finding.  Keep
            # planning free of speculative changes until the owner repairs it.
            return ()
        dependencies = _declared_dependencies(document)
        selected: list[StructuredChange] = []
        by_key = {change.key: change for change in requirement.structured_changes}
        for key, _value, dependency in _SCRIPT_RULES:
            script_name = key.removeprefix("scripts.")
            if script_name in scripts:
                continue
            if dependency in dependencies:
                selected.append(by_key[key])
        return tuple(selected)


def _declared_dependencies(document: dict[str, object]) -> frozenset[str]:
    names: set[str] = set()
    for section_name in ("dependencies", "devDependencies"):
        section = document.get(section_name, {})
        if isinstance(section, dict):
            names.update(
                key
                for key, value in section.items()
                if isinstance(key, str)
                and key
                and isinstance(value, str)
                and value.strip()
            )
    return frozenset(names)


__all__ = ["FrontendAdapter"]
