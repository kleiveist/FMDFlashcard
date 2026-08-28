from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

from tools import logger
from tools.tauri import common, paths


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    target_dir = _target_dir(getattr(args, "target_dir", None))
    artifacts = common.find_build_artifacts(include_dist=False)

    if not artifacts:
        logger.warn("No Tauri bundle artifacts found")
        return 0

    common.ensure_directory(target_dir, dry_run=dry_run)
    for artifact in artifacts:
        destination = target_dir / artifact.name
        if dry_run:
            logger.info(f"DRY-RUN copy {artifact} -> {destination}")
            continue
        if artifact.is_dir():
            if destination.exists():
                shutil.rmtree(destination)
            shutil.copytree(artifact, destination)
        else:
            shutil.copy2(artifact, destination)
        logger.ok(f"Copied {artifact.relative_to(paths.ROOT)} -> {destination.relative_to(paths.ROOT)}")
    return 0


def _target_dir(value: str | None) -> Path:
    if value:
        return Path(value).expanduser().resolve()
    env_value = os.environ.get("TEMPLATE_TAURI_ARTIFACT_DIR")
    if env_value:
        return Path(env_value).expanduser().resolve()
    return paths.DIST_DIR
