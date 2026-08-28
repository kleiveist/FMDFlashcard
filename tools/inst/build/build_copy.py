#!/usr/bin/env python3
"""
Copy generated build bundle directories to the archive USB target.

control.py entry:
  python3 tools/control.py --build --copy

Sources:
  - frontend/src-tauri/target/release/bundle/appimage
  - frontend/src-tauri/target/release/bundle/deb
  - frontend/src-tauri/target/release/bundle/rpm
  - frontend/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/portable

Destination:
  - /run/media/kleif/Samsung USB/education/.archive/bundle

Result:
  - /run/media/kleif/Samsung USB/education/.archive/bundle/appimage
  - /run/media/kleif/Samsung USB/education/.archive/bundle/deb
  - /run/media/kleif/Samsung USB/education/.archive/bundle/rpm
  - /run/media/kleif/Samsung USB/education/.archive/bundle/portable
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path

from console import action, bundle, err, info, kv, ok, section, warn


DESTINATION_ROOT = Path("/run/media/kleif/Samsung USB/education/.archive/bundle")


def _repo_root_from_tools_inst_build() -> Path:
    # tools/inst/build/build_copy.py -> repo root is parents[3].
    return Path(__file__).resolve().parents[3]


def _format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"


def _mount_root_for_path(path: Path) -> Path:
    parts = path.parts

    # /mnt/T7/... -> /mnt/T7
    if len(parts) >= 3 and parts[0] == "/" and parts[1] == "mnt":
        return Path("/") / "mnt" / parts[2]

    # /run/media/<user>/<mount-name>/... -> /run/media/<user>/<mount-name>
    if (
        len(parts) >= 5
        and parts[0] == "/"
        and parts[1] == "run"
        and parts[2] == "media"
    ):
        return Path("/") / "run" / "media" / parts[3] / parts[4]

    return Path(path.anchor) if path.anchor else path


def _destination_available(destination_root: Path) -> bool:
    mount_root = _mount_root_for_path(destination_root)
    if not mount_root.exists():
        warn(f"Target skipped (storage not found): {destination_root} (missing: {mount_root})")
        return False
    if (
        (mount_root.parts[:2] == ("/", "mnt") or mount_root.parts[:3] == ("/", "run", "media"))
        and not mount_root.is_mount()
    ):
        warn(f"Target skipped (storage not mounted): {destination_root} (mount: {mount_root})")
        return False
    return True


def _source_stats(source_dir: Path) -> tuple[int, int]:
    """Return (directory_count, file_count) for a source tree."""
    directory_count = 0
    file_count = 0
    if not source_dir.exists():
        return directory_count, file_count

    for path in source_dir.rglob("*"):
        if path.is_dir():
            directory_count += 1
        elif path.is_file():
            file_count += 1
    return directory_count, file_count


def _remove_existing(path: Path, dry_run: bool) -> bool:
    if not path.exists() and not path.is_symlink():
        return True

    action(f"remove existing {path}")
    if dry_run:
        return True

    try:
        if path.is_dir() and not path.is_symlink():
            shutil.rmtree(path)
        else:
            path.unlink()
    except OSError as exc:
        err(f"Remove failed: {path} ({exc})")
        return False
    return True


def _copy_bundle_dir(kind: str, source_dir: Path, destination_dir: Path, dry_run: bool) -> bool:
    action(f"copy directory {source_dir} -> {destination_dir}")
    if dry_run:
        return True

    try:
        destination_dir.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_dir, destination_dir, copy_function=shutil.copy2)
    except OSError as exc:
        err(f"Directory copy failed: {source_dir} -> {destination_dir} ({exc})")
        return False

    bundle(f"{kind}: {destination_dir}")
    return True


def run_install(dry_run: bool = False) -> int:
    overall_start = time.perf_counter()

    repo_root = _repo_root_from_tools_inst_build()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    linux_bundle_dir = app_dir / "src-tauri" / "target" / "release" / "bundle"
    win_bundle_dir = (
        app_dir
        / "src-tauri"
        / "target"
        / "x86_64-pc-windows-msvc"
        / "release"
        / "bundle"
    )

    source_specs: dict[str, Path] = {
        "appimage": linux_bundle_dir / "appimage",
        "deb": linux_bundle_dir / "deb",
        "rpm": linux_bundle_dir / "rpm",
        "portable": win_bundle_dir / "portable",
    }

    section("Run Context")
    info(f"Repo root: {repo_root}")
    info(f"App dir:   {app_dir}")
    info(f"Target:    {DESTINATION_ROOT}")
    if dry_run:
        warn("Dry run mode enabled: no files or directories will be written.")

    section("Source Bundle Directories")
    available_sources: dict[str, Path] = {}
    source_dir_count = 0
    source_file_count = 0

    for kind, source_dir in source_specs.items():
        kv(kind, str(source_dir))
        if not source_dir.exists():
            warn(f"No source directory found: {source_dir}")
            continue
        if not source_dir.is_dir():
            warn(f"Source is not a directory: {source_dir}")
            continue

        directory_count, file_count = _source_stats(source_dir)
        kv(f"{kind} dirs", str(directory_count))
        kv(f"{kind} files", str(file_count))
        available_sources[kind] = source_dir
        source_dir_count += directory_count
        source_file_count += file_count

    if not available_sources:
        err("No source bundle directories found. Build first, then run --build --copy.")
        return 1

    section("Copy Target")
    info(str(DESTINATION_ROOT))

    if not _destination_available(DESTINATION_ROOT):
        err("Bundle copy aborted: target storage is not available.")
        return 1

    copied_dirs = 0
    failed_steps = 0

    section(f"Copy -> {DESTINATION_ROOT}")
    for kind, source_dir in source_specs.items():
        destination_dir = DESTINATION_ROOT / kind

        if kind not in available_sources:
            warn(f"{kind}: nothing to copy.")
            continue

        if not _remove_existing(destination_dir, dry_run=dry_run):
            failed_steps += 1
            continue

        if _copy_bundle_dir(kind, source_dir, destination_dir, dry_run=dry_run):
            copied_dirs += 1
        else:
            failed_steps += 1

    total_time = time.perf_counter() - overall_start
    section("Result")
    kv("Source dirs", str(source_dir_count))
    kv("Source files", str(source_file_count))
    kv("Copied bundle dirs", str(copied_dirs))
    if failed_steps:
        kv("Failed steps", str(failed_steps))
    kv("Total time", _format_duration(total_time))

    if failed_steps:
        err("Bundle directory copy completed with errors.")
        return 1

    if dry_run:
        ok("Dry run completed.")
    else:
        ok("Bundle directory copy completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
