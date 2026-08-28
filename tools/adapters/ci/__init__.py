"""Continuous-integration detection adapter."""

from tools.adapters.base import BaseAdapter, PathRequirement
from tools.core.context import ProjectContext
from tools.integration.model import Ownership


class CiAdapter(BaseAdapter):
    name = "ci"
    core = True

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        del context
        return (
            PathRequirement(
                path=".github/workflows",
                ownership=Ownership.PROJECT,
                kind="directory",
                required=False,
                reason="optional project CI configuration",
            ),
        )


__all__ = ["CiAdapter"]
