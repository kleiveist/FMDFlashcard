"""Tooling code-quality adapter."""

from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    BaseAdapter,
    PathRequirement,
    project_relative_path,
)
from tools.core.context import ProjectContext
from tools.integration.model import Ownership


class QualityAdapter(BaseAdapter):
    name = "quality"
    core = True
    capabilities = frozenset({AdapterCapability.TEST})

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        return (
            PathRequirement(
                path=project_relative_path(context, context.tools_root / "quality"),
                ownership=Ownership.TOOLING,
                kind="directory",
                reason="tooling quality implementation",
            ),
        )


__all__ = ["QualityAdapter"]
