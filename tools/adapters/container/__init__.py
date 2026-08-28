"""Cloud/container project-structure adapter."""

from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    BaseAdapter,
    PathRequirement,
)
from tools.core.context import ProjectContext
from tools.integration.model import Ownership


class ContainerAdapter(BaseAdapter):
    name = "container"
    feature_ids = ("cloud",)
    capabilities = frozenset({AdapterCapability.BUILD, AdapterCapability.TEST})

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def build(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.BUILD)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        del context
        return (
            PathRequirement(
                path=".dockerignore",
                ownership=Ownership.PROJECT,
                kind="file",
                required=False,
                reason="cloud container ignore policy",
            ),
            PathRequirement(
                path="compose.yaml",
                ownership=Ownership.PROJECT,
                kind="file",
                required=False,
                reason="container composition marker",
                marker=True,
            ),
            PathRequirement(
                path="deployment",
                ownership=Ownership.PROJECT,
                kind="directory",
                required=False,
                reason="cloud deployment configuration root",
            ),
            PathRequirement(
                path="deployment/compose.yaml",
                ownership=Ownership.PROJECT,
                kind="file",
                required=False,
                reason="tooling deployment composition marker",
                marker=True,
            ),
        )


__all__ = ["ContainerAdapter"]
