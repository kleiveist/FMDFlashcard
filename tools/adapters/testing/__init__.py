"""Tooling test-suite adapter."""

from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    BaseAdapter,
    PathRequirement,
    project_relative_path,
)
from tools.core.context import ProjectContext
from tools.integration.model import Ownership


class TestingAdapter(BaseAdapter):
    name = "testing"
    core = True
    capabilities = frozenset({AdapterCapability.TEST})

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        return (
            PathRequirement(
                path=project_relative_path(context, context.tools_root / "tests"),
                ownership=Ownership.TOOLING,
                kind="directory",
                reason="tooling regression suite",
            ),
        )


__all__ = ["TestingAdapter"]
