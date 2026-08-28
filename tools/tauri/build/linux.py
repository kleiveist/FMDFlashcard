from __future__ import annotations

import argparse
from pathlib import Path

from tools import logger
from tools.tauri import common, paths
from tools.tauri.build import appimage, artifacts

DEFAULT_LINUX_BUNDLES = artifacts.DEFAULT_LINUX_BUNDLES


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    requested = _requested_bundles(args)
    if requested is None:
        return 1
    if not _frontend_build_ready(dry_run=dry_run):
        return 1

    bundles = ",".join(requested)
    no_clean = bool(getattr(args, "no_clean", False))
    if not _appimage_build_ready(args, bundles=bundles, dry_run=dry_run):
        return 1

    previous_snapshot: artifacts.ArtifactSnapshot | None = None
    if not dry_run:
        try:
            previous_snapshot = _prepare_outputs(requested, no_clean=no_clean)
        except (artifacts.LinuxBundleError, OSError) as exc:
            logger.fail(f"Could not prepare Linux bundle outputs: {exc}")
            return 1

    return _run_build(requested, bundles=bundles, dry_run=dry_run, previous_snapshot=previous_snapshot)


def _requested_bundles(args: argparse.Namespace) -> tuple[str, ...] | None:
    try:
        return artifacts.normalize_linux_bundles(getattr(args, "bundles", None))
    except artifacts.LinuxBundleError as exc:
        logger.fail(str(exc))
        return None


def _frontend_build_ready(*, dry_run: bool) -> bool:
    if dry_run or common.frontend_dependencies_ready():
        return True
    missing = ", ".join(str(path.relative_to(paths.ROOT)) for path in common.missing_frontend_dependency_paths())
    logger.fail(
        "Frontend dependencies are incomplete. "
        f"Missing: {missing}. "
        "Run 'python tools/control.py tauri install --skip-system-deps --skip-rust' first."
    )
    return False


def _appimage_build_ready(args: argparse.Namespace, *, bundles: str, dry_run: bool) -> bool:
    if not _bundles_include_appimage(bundles) or dry_run:
        return True
    if getattr(args, "skip_appimage_preflight", False):
        logger.warn("Skipping AppImage prerequisite checks; linuxdeploy may still fail.")
        return True
    return appimage._appimage_prerequisites_ready("python tools/control.py tauri build --target linux")


def _prepare_outputs(
    requested: tuple[str, ...],
    *,
    no_clean: bool,
) -> artifacts.ArtifactSnapshot | None:
    artifacts.prepare_linux_bundle_outputs(
        requested,
        bundle_root=_bundle_root(),
        evidence_root=_evidence_root(),
        repository_root=paths.ROOT,
        clean_bundles=not no_clean,
    )
    if no_clean:
        return artifacts.snapshot_linux_bundle_outputs(requested, _bundle_root())
    return None


def _run_build(
    requested: tuple[str, ...],
    *,
    bundles: str,
    dry_run: bool,
    previous_snapshot: artifacts.ArtifactSnapshot | None,
) -> int:
    command = common.tauri_cli_command("build", "--bundles", bundles)
    common.print_build_plan("linux", command, dry_run=dry_run, bundles=bundles)
    env = appimage.appimage_build_env() if _bundles_include_appimage(bundles) else None
    appimage_snapshot = appimage._appimage_snapshot() if _bundles_include_appimage(bundles) else {}
    result = common.run_command(command, cwd=paths.ROOT, dry_run=dry_run, env=env)
    if result.returncode == 0:
        if dry_run:
            logger.info("📁 Dry-run finished; no new artifacts were created.")
            return 0
        return _verify_outputs(requested, previous_snapshot=previous_snapshot)
    if dry_run or not _bundles_include_appimage(bundles):
        return common.print_result(result, "Linux Tauri build completed", "Linux Tauri build failed")
    return _handle_failed_build(
        result,
        requested,
        appimage_snapshot=appimage_snapshot,
        previous_snapshot=previous_snapshot,
    )


def _handle_failed_build(
    result: common.CommandResult,
    requested: tuple[str, ...],
    *,
    appimage_snapshot: dict[Path, tuple[int, int]],
    previous_snapshot: artifacts.ArtifactSnapshot | None,
) -> int:
    if not appimage.is_linuxdeploy_failure(result):
        logger.fail(
            "AppImage fallback skipped: Tauri failed before linuxdeploy. "
            "Fix the build error above; stale AppImage artifacts were not treated as a successful build."
        )
        return common.print_result(result, "Linux Tauri build completed", "Linux Tauri build failed")

    fresh_appimage = appimage._fresh_appimage_from_snapshot(appimage_snapshot)
    if fresh_appimage is not None:
        logger.warn(f"Tauri linuxdeploy failed, but it produced {fresh_appimage.name}; continuing with that AppImage.")
        return _verify_outputs(requested, previous_snapshot=previous_snapshot)
    if appimage.package_existing_appdir() == 0:
        logger.warn("Tauri linuxdeploy failed, but AppImage was packaged from the generated AppDir.")
        return _verify_outputs(requested, previous_snapshot=previous_snapshot)
    return common.print_result(result, "Linux Tauri build completed", "Linux Tauri build failed")


def _bundles_include_appimage(bundles: str) -> bool:
    return any(item.strip().lower() == "appimage" for item in bundles.split(","))


def _verify_outputs(
    requested: tuple[str, ...],
    *,
    previous_snapshot: artifacts.ArtifactSnapshot | None = None,
) -> int:
    try:
        result, evidence = artifacts.verify_and_write_linux_bundles(
            requested,
            bundle_root=_bundle_root(),
            repository_root=paths.ROOT,
            evidence_root=_evidence_root(),
            previous_snapshot=previous_snapshot,
        )
    except (artifacts.LinuxBundleError, OSError) as exc:
        logger.fail(f"Linux bundle verification failed: {exc}")
        return 1

    artifacts.log_linux_bundle_verification(result)
    if not result.ok or evidence is None:
        return 1
    logger.ok(f"Linux bundle manifest: {evidence.manifest.relative_to(paths.ROOT)}")
    logger.ok(f"Linux bundle checksums: {evidence.checksums.relative_to(paths.ROOT)}")
    logger.ok("Linux Tauri build and bundle verification completed")
    common.print_build_artifacts()
    return 0


def _bundle_root() -> Path:
    return paths.TAURI_DIR / "target" / "release" / "bundle"


def _evidence_root() -> Path:
    return paths.DIST_DIR / "linux"
