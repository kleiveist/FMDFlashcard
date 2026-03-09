#!/usr/bin/env python3
"""
Copy generated build artifacts into external AppInsall directories.

control.py entry:
  python3 tools/control.py --build --copy

Sources:
  - apps/fmd-desktop/src-tauri/target/release/bundle/appimage
  - apps/fmd-desktop/src-tauri/target/release/bundle/deb
  - apps/fmd-desktop/src-tauri/target/release/bundle/rpm
  - apps/fmd-desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/portable

Destinations:
  - /mnt/T7-1TB/workspace/Blobbite/Develop/PythonLinux/AppInsall
  - /mnt/T7-2TB/workspace/Blobbite/Develop/PythonLinux/AppInsall
  - /mnt/daten/workspace/Blobbite/Develop/PythonLinux/AppInsall
"""

from __future__ import annotations

import shutil
import time
from pathlib import Path

from console import action, bundle, err, info, kv, ok, section, warn


def _repo_root_from_tools_inst_build() -> Path:
    # tools/inst/build/build_copy.py -> repo root is parents[3].
    return Path(__file__).resolve().parents[3]


def _collect_files(source_dir: Path, patterns: tuple[str, ...]) -> list[Path]:
    if not source_dir.exists():
        return []
    files: list[Path] = []
    seen: set[Path] = set()
    for pattern in patterns:
        for path in sorted(source_dir.glob(pattern)):
            if not path.is_file() or path in seen:
                continue
            files.append(path)
            seen.add(path)
    return files


def _ensure_dir(path: Path, dry_run: bool) -> bool:
    action(f"mkdir -p {path}")
    if dry_run:
        return True
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        err(f"Could not create directory: {path} ({exc})")
        return False
    return True


def _copy_file(src: Path, dst: Path, dry_run: bool) -> bool:
    exists_already = dst.exists()
    op = "overwrite" if exists_already else "copy"
    action(f"{op} {src} -> {dst}")
    if dry_run:
        return True
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    except OSError as exc:
        err(f"Copy failed: {src} -> {dst} ({exc})")
        return False
    return True


def _format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"


def _mount_root_for_path(path: Path) -> Path:
    parts = path.parts
    if len(parts) >= 3 and parts[0] == "/" and parts[1] == "mnt":
        return Path("/") / "mnt" / parts[2]
    return Path(path.anchor) if path.anchor else path


def _destination_available(destination_root: Path) -> bool:
    mount_root = _mount_root_for_path(destination_root)
    if not mount_root.exists():
        warn(f"Target skipped (storage not found): {destination_root} (missing: {mount_root})")
        return False
    if mount_root.parts[:2] == ("/", "mnt") and not mount_root.is_mount():
        warn(f"Target skipped (storage not mounted): {destination_root} (mount: {mount_root})")
        return False
    return True


def _destination_file_path(kind: str, source_dir: Path, src: Path, destination_dir: Path) -> Path:
    if kind == "appimage":
        return destination_dir / "FMDFlashcard.AppImage"
    rel = src.relative_to(source_dir)
    return destination_dir / rel


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
    win_portable_dir = (
        app_dir
        / "src-tauri"
        / "target"
        / "x86_64-pc-windows-msvc"
        / "release"
        / "bundle"
        / "portable"
    )

    source_specs: dict[str, tuple[Path, tuple[str, ...]]] = {
        "appimage": (linux_bundle_dir / "appimage", ("*.AppImage", "*.appimage")),
        "deb": (linux_bundle_dir / "deb", ("*.deb",)),
        "rpm": (linux_bundle_dir / "rpm", ("*.rpm",)),
        "portable": (win_portable_dir, ("*.zip",)),
    }
    destination_roots = (
        Path("/mnt/T7-1TB/workspace/Blobbite/Develop/P25PythonLinux/PythonLinux/AppInsall"),
        Path("/mnt/T7-2TB/workspace/Blobbite/Develop/P25PythonLinux/PythonLinux/AppInsall"),
        Path("/mnt/daten/workspace/Blobbite/Develop/P25PythonLinux/PythonLinux/AppInsall"),

    )

    section("Run Context")
    info(f"Repo root: {repo_root}")
    info(f"App dir:   {app_dir}")
    if dry_run:
        warn("Dry run mode enabled: no files or directories will be written.")

    section("Source Artifacts")
    artifacts: dict[str, list[Path]] = {}
    source_file_count = 0
    for kind, (source_dir, patterns) in source_specs.items():
        kv(kind, str(source_dir))
        files = _collect_files(source_dir, patterns)
        artifacts[kind] = files
        if not files:
            warn(f"No files found: {source_dir}")
            continue
        for file_path in files:
            bundle(f"{kind}: {file_path}")
            source_file_count += 1

    if source_file_count == 0:
        err("No source artifacts found. Build first, then run --build --copy.")
        return 1

    section("Copy Targets")
    for destination_root in destination_roots:
        info(str(destination_root))

    copied_files = 0
    failed_steps = 0
    skipped_targets = 0

    for destination_root in destination_roots:
        if not _destination_available(destination_root):
            skipped_targets += 1
            continue
        section(f"Copy -> {destination_root}")
        for kind, (source_dir, _) in source_specs.items():
            destination_dir = destination_root / kind
            if not _ensure_dir(destination_dir, dry_run=dry_run):
                failed_steps += 1
                continue

            files = artifacts[kind]
            if not files:
                warn(f"{kind}: nothing to copy.")
                continue

            for src in files:
                dst = _destination_file_path(kind, source_dir, src, destination_dir)
                if _copy_file(src, dst, dry_run=dry_run):
                    copied_files += 1
                    if not dry_run:
                        bundle(f"{kind}: {dst}")
                else:
                    failed_steps += 1

    total_time = time.perf_counter() - overall_start
    section("Result")
    kv("Source files", str(source_file_count))
    kv("Copy operations", str(copied_files))
    kv("Skipped targets", str(skipped_targets))
    if failed_steps:
        kv("Failed steps", str(failed_steps))
    kv("Total time", _format_duration(total_time))

    if failed_steps:
        err("Bundle copy completed with errors.")
        return 1

    if dry_run:
        ok("Dry run completed.")
    else:
        ok("Bundle copy completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
