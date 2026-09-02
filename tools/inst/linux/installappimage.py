#!/usr/bin/env python3
"""
Project-specific local AppImage installer for FMDFlashcard.

This script installs the most suitable AppImage build artifact from this
repository into a stable user-local location and creates/updates a desktop
entry for Linux desktop integration.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
import sys
from pathlib import Path, PurePath
from typing import Iterable

APP_NAME = "FMDFlashcard"
DESKTOP_FILE_NAME = "fmdflashcard.desktop"
STABLE_APPIMAGE_NAME = "FMDFlashcard.AppImage"
STABLE_ICON_BASENAME = "fmdflashcard"
NAME_PREFERENCE_TOKEN = "fmdflashcard"

BUILD_APPIMAGE_REL = Path(".dist/desktop/linux-x86_64/linux")
ICON_SOURCE_REL = Path("apps/fmd-desktop/src-tauri/icons")

TARGET_APPIMAGE_PATH = Path.home() / "Applications" / STABLE_APPIMAGE_NAME
TARGET_DESKTOP_PATH = Path.home() / ".local" / "share" / "applications" / DESKTOP_FILE_NAME
TARGET_ICON_DIR = Path.home() / ".local" / "share" / "icons"

APPIMAGE_PATTERNS = ("*.AppImage", "*.appimage")
PNG_PATTERNS = ("*.png", "*.PNG")
SVG_PATTERNS = ("*.svg", "*.SVG")
PRIORITY_PNG_NAMES = ("icon.png", "128x128@2x.png", "128x128.png")
ICON_EXTENSIONS = (".png", ".svg")

UNICODE_ICONS = {
    "info": "ℹ️",
    "ok": "✅",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}

ASCII_ICONS = {
    "info": "[INFO]",
    "ok": "[OK]",
    "warn": "[WARN]",
    "err": "[ERR]",
    "run": "[RUN]",
}


def _stdout_supports_unicode() -> bool:
    encoding = (sys.stdout.encoding or "").lower()
    return "utf" in encoding


ICONS = UNICODE_ICONS if _stdout_supports_unicode() else ASCII_ICONS


class InstallError(RuntimeError):
    """Raised for expected installation errors with user-facing messages."""


def info(msg: str) -> None:
    print(f"{ICONS['info']} {msg}")


def success(msg: str) -> None:
    print(f"{ICONS['ok']} {msg}")


def warn(msg: str) -> None:
    print(f"{ICONS['warn']} {msg}")


def error(msg: str) -> None:
    print(f"{ICONS['err']} {msg}")


def action(msg: str) -> None:
    print(f"{ICONS['run']} {msg}")


def _repo_root(project_root: str | None) -> Path:
    if project_root:
        return Path(project_root).expanduser().resolve()
    # tools/inst/linux/installappimage.py -> parents[3] is repo root
    return Path(__file__).resolve().parents[3]


def _normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _collect_files(directory: Path, patterns: Iterable[str]) -> list[Path]:
    files: list[Path] = []
    seen: set[Path] = set()
    for pattern in patterns:
        for path in sorted(directory.glob(pattern)):
            if not path.is_file() or path in seen:
                continue
            files.append(path)
            seen.add(path)
    return files


def _select_appimage(appimage_dir: Path) -> Path:
    candidates = _collect_files(appimage_dir, APPIMAGE_PATTERNS)
    if not candidates:
        raise InstallError(f"No AppImage found in build directory: {appimage_dir}")

    preferred = [path for path in candidates if NAME_PREFERENCE_TOKEN in _normalize_name(path.name)]
    pool = preferred if preferred else candidates

    if len(candidates) > 1:
        if preferred:
            info(
                f"Found {len(candidates)} AppImages, using preferred subset "
                f"({len(preferred)}) containing '{NAME_PREFERENCE_TOKEN}'."
            )
        else:
            warn(
                "Multiple AppImages found without name preference token; "
                "using newest by modification time."
            )

    newest_mtime = max(path.stat().st_mtime_ns for path in pool)
    newest = [path for path in pool if path.stat().st_mtime_ns == newest_mtime]
    if len(newest) > 1:
        lines = "\n".join(f"  - {path.name}" for path in newest)
        raise InstallError(
            f"Ambiguous AppImage selection: multiple equally recent candidates:\n{lines}"
        )
    return newest[0]


def _extract_size_hint(path: Path) -> int:
    match = re.search(r"(\d+)\s*x\s*(\d+)", path.stem.lower())
    if match:
        return max(int(match.group(1)), int(match.group(2)))
    values = re.findall(r"\d+", path.stem)
    return max((int(v) for v in values), default=0)


def _select_icon(icon_dir: Path) -> Path:
    png_files = _collect_files(icon_dir, PNG_PATTERNS)
    if png_files:
        by_lower_name = {p.name.lower(): p for p in png_files}
        for name in PRIORITY_PNG_NAMES:
            candidate = by_lower_name.get(name)
            if candidate:
                info(f"Selected icon by priority: {candidate.name}")
                return candidate

        ranked_pngs = sorted(
            png_files,
            key=lambda p: (_extract_size_hint(p), p.stat().st_mtime_ns, p.name.lower()),
            reverse=True,
        )
        selected = ranked_pngs[0]
        info(
            f"Selected icon by detected size: {selected.name} "
            f"(size hint: {_extract_size_hint(selected)})"
        )
        return selected

    svg_files = _collect_files(icon_dir, SVG_PATTERNS)
    if svg_files:
        preferred_svg = next((p for p in svg_files if p.name.lower() == "icon.svg"), None)
        selected = preferred_svg or sorted(svg_files, key=lambda p: p.name.lower())[0]
        warn(f"No PNG icon found, using SVG fallback: {selected.name}")
        return selected

    raise InstallError(f"Icon missing: no PNG or SVG files found in {icon_dir}")


def _ensure_dir(path: Path, dry_run: bool) -> None:
    action(f"mkdir -p {path}")
    if dry_run:
        return
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise InstallError(f"Could not create directory '{path}': {exc}") from exc


def _copy_file(src: Path, dst: Path, dry_run: bool) -> None:
    op = "overwrite" if dst.exists() else "copy"
    action(f"{op} {src} -> {dst}")
    if dry_run:
        return
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    except OSError as exc:
        raise InstallError(f"Copy failed: '{src}' -> '{dst}': {exc}") from exc


def _set_executable(path: Path, dry_run: bool) -> None:
    action(f"chmod +x {path}")
    if dry_run:
        return
    try:
        mode = path.stat().st_mode
        new_mode = mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
        if new_mode != mode:
            os.chmod(path, new_mode)
    except OSError as exc:
        raise InstallError(f"Failed to set executable permission on '{path}': {exc}") from exc


def _cleanup_stale_icons(keep_path: Path, dry_run: bool) -> None:
    for ext in ICON_EXTENSIONS:
        candidate = TARGET_ICON_DIR / f"{STABLE_ICON_BASENAME}{ext}"
        if candidate == keep_path or not candidate.exists():
            continue
        action(f"remove stale icon {candidate}")
        if dry_run:
            continue
        try:
            candidate.unlink()
        except OSError as exc:
            raise InstallError(f"Failed to remove stale icon '{candidate}': {exc}") from exc


def _desktop_exec_argument(path: PurePath) -> str:
    """Quote a path as one Desktop Entry Exec argument."""
    value = str(path)
    if "\n" in value or "\r" in value or "\0" in value:
        raise InstallError("Desktop entry paths must not contain control characters")
    escaped = "".join(f"\\{char}" if char in {"\\", '"', "`", "$"} else char for char in value)
    return f'"{escaped}"'


def _desktop_file_content(appimage_path: PurePath, icon_path: PurePath) -> str:
    lines = [
        "[Desktop Entry]",
        "Type=Application",
        f"Name={APP_NAME}",
        f"Comment={APP_NAME}",
        f"Exec={_desktop_exec_argument(appimage_path)}",
        f"TryExec={appimage_path}",
        f"Icon={icon_path}",
        "Terminal=false",
        "Categories=Education;Utility;",
    ]
    return "\n".join(lines) + "\n"


def _write_desktop_file(path: Path, content: str, dry_run: bool) -> None:
    action(f"write desktop entry {path}")
    if dry_run:
        return
    try:
        if path.exists():
            existing = path.read_text(encoding="utf-8")
            if existing == content:
                info("Desktop entry is already up to date.")
                return
        path.write_text(content, encoding="utf-8")
    except OSError as exc:
        raise InstallError(f"Failed to write desktop file '{path}': {exc}") from exc


def run_install(dry_run: bool = False, project_root: str | None = None) -> int:
    try:
        repo_root = _repo_root(project_root)
        appimage_dir = repo_root / BUILD_APPIMAGE_REL
        icon_source_dir = repo_root / ICON_SOURCE_REL

        info(f"Repo root: {repo_root}")
        info(f"AppImage source dir: {appimage_dir}")
        info(f"Icon source dir: {icon_source_dir}")
        info(f"Target AppImage: {TARGET_APPIMAGE_PATH}")
        info(f"Target desktop file: {TARGET_DESKTOP_PATH}")
        if dry_run:
            warn("Dry run enabled: no files will be modified.")

        if not appimage_dir.is_dir() and not dry_run:
            raise InstallError(f"Verified build folder does not exist: {appimage_dir}")
        if not icon_source_dir.is_dir():
            raise InstallError(f"Icon folder does not exist: {icon_source_dir}")

        try:
            source_appimage = _select_appimage(appimage_dir)
        except InstallError:
            if not dry_run:
                raise
            source_appimage = appimage_dir / "<verified-FMDFlashcard.AppImage>"
            warn("No verified AppImage is present yet; the dry-run shows the future install plan.")
        source_icon = _select_icon(icon_source_dir)
        target_icon = TARGET_ICON_DIR / f"{STABLE_ICON_BASENAME}{source_icon.suffix.lower()}"

        info(f"Selected AppImage: {source_appimage.name}")
        info(f"Selected icon: {source_icon.name}")

        _ensure_dir(TARGET_APPIMAGE_PATH.parent, dry_run=dry_run)
        _ensure_dir(TARGET_DESKTOP_PATH.parent, dry_run=dry_run)
        _ensure_dir(TARGET_ICON_DIR, dry_run=dry_run)

        _copy_file(source_appimage, TARGET_APPIMAGE_PATH, dry_run=dry_run)
        _set_executable(TARGET_APPIMAGE_PATH, dry_run=dry_run)

        _copy_file(source_icon, target_icon, dry_run=dry_run)
        _cleanup_stale_icons(target_icon, dry_run=dry_run)

        desktop_content = _desktop_file_content(TARGET_APPIMAGE_PATH, target_icon)
        _write_desktop_file(TARGET_DESKTOP_PATH, desktop_content, dry_run=dry_run)

        success("FMDFlashcard AppImage local install completed.")
        info("Summary:")
        info(f"  Source AppImage: {source_appimage}")
        info(f"  Installed AppImage: {TARGET_APPIMAGE_PATH}")
        info(f"  Installed icon: {target_icon}")
        info(f"  Desktop entry: {TARGET_DESKTOP_PATH}")
        return 0
    except InstallError as exc:
        error(str(exc))
        return 1
    except Exception as exc:  # defensive fallback
        error(f"Unexpected error: {exc}")
        return 1


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Install the local FMDFlashcard AppImage into a stable user path."
    )
    parser.add_argument(
        "--project-root",
        default=None,
        help="Optional explicit project root path (defaults to repository root).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned actions without writing files.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    return run_install(dry_run=args.dry_run, project_root=args.project_root)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
