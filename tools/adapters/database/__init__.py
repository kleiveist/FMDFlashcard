"""SQL database and PostgreSQL feature adapter."""

from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    BaseAdapter,
    PathRequirement,
    project_relative_path,
)
from tools.core.context import ProjectContext
from tools.integration.model import Finding, FindingStatus, Ownership


class DatabaseAdapter(BaseAdapter):
    name = "database"
    feature_ids = ("database", "postgres")
    capabilities = frozenset({AdapterCapability.TEST})

    def test(self, context: ProjectContext) -> AdapterActionResult:
        return self._run_control_action(context, AdapterCapability.TEST)

    def requirements(self, context: ProjectContext) -> tuple[PathRequirement, ...]:
        if context.paths.backend is None:
            return ()
        root = context.paths.backend
        return (
            PathRequirement(
                path=project_relative_path(context, root / "alembic"),
                ownership=Ownership.PROJECT,
                kind="directory",
                required=False,
                reason="database migration root",
                marker=True,
            ),
            PathRequirement(
                path=project_relative_path(context, root / "alembic.ini"),
                ownership=Ownership.PROJECT,
                kind="file",
                required=False,
                reason="database migration configuration marker",
                marker=True,
            ),
        )

    def configuration_findings(self, context: ProjectContext) -> tuple[Finding, ...]:
        if context.paths.backend is not None:
            return ()
        return (
            Finding(
                check="configured-path",
                status=FindingStatus.WARN,
                message="database feature requires a configured backend path",
                adapter=self.name,
                path="project-tooling.toml",
            ),
        )


__all__ = ["DatabaseAdapter"]
