from __future__ import annotations

from pathlib import Path

from tools.core.context import ProjectContext
from tools.profiles.loader import load_active_profile
from tools.profiles.model import ProjectProfile


def active_profile(
    project_root: Path | None = None,
    *,
    context: ProjectContext | None = None,
) -> ProjectProfile:
    return load_active_profile(project_root, context=context)


def feature_enabled(
    feature_id: str,
    project_root: Path | None = None,
    *,
    context: ProjectContext | None = None,
) -> bool:
    return active_profile(project_root, context=context).has_feature(feature_id)
