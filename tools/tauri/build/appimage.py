from __future__ import annotations

import argparse
import os
import re
import shutil
import stat
from collections.abc import Iterable
from pathlib import Path

import tomllib

from tools import logger
from tools.tauri import common, paths
from tools.tauri.linux import install as linux_install

APPIMAGE_PATTERNS = ("*.AppImage", "*.appimage")
PNG_PATTERNS = ("*.png", "*.PNG")
SVG_PATTERNS = ("*.svg", "*.SVG")
PRIORITY_ICON_NAMES = ("icon.png", "128x128@2x.png", "128x128.png")
ICON_EXTENSIONS = (".png", ".svg")


class AppImageInstallError(RuntimeError):
    """Raised for expected local AppImage install failures."""


def _app_name() -> str:
    return paths.app_name()


def _app_slug() -> str:
    return paths.app_slug()


def main(args: argparse.Namespace) -> int:
    dry_run = bool(getattr(args, "dry_run", False))
    if common.host_os() != "linux" and not dry_run:
        logger.fail("AppImage build and install is supported on Linux hosts only.")
        return 1

    if not dry_run and not common.frontend_dependencies_ready():
        missing = ", ".join(
            str(path.relative_to(paths.ROOT))
            for path in common.missing_frontend_dependency_paths()
        )
        logger.fail(
            "Frontend dependencies are incomplete. "
            f"Missing: {missing}. "
            "Run 'python tools/control.py tauri install --skip-system-deps --skip-rust' first."
        )
        return 1

    if (
        not dry_run
        and not getattr(args, "skip_appimage_preflight", False)
        and not _appimage_prerequisites_ready()
    ):
        return 1
    if not dry_run and getattr(args, "skip_appimage_preflight", False):
        logger.warn(
            "Skipping AppImage prerequisite checks; linuxdeploy may still fail."
        )

    command = common.tauri_cli_command("build", "--bundles", "appimage")
    common.print_build_plan(
        "linux-appimage", command, dry_run=dry_run, bundles="appimage"
    )
    appimage_snapshot = _appimage_snapshot()
    result = common.run_command(
        command, cwd=paths.ROOT, dry_run=dry_run, env=appimage_build_env()
    )
    code = result.returncode
    if code != 0:
        if not is_linuxdeploy_failure(result):
            common.print_result(
                result, "Linux AppImage build completed", "Linux AppImage build failed"
            )
            logger.fail(
                "AppImage fallback skipped: Tauri failed before linuxdeploy. "
                "Fix the build error above; no AppDir/AppImage fallback was installed."
            )
            return code
        fresh_appimage = _fresh_appimage_from_snapshot(appimage_snapshot)
        if fresh_appimage is not None:
            logger.warn(
                f"Tauri linuxdeploy failed, but it produced {fresh_appimage.name}; continuing with that AppImage."
            )
        else:
            fallback_code = package_existing_appdir(dry_run=dry_run)
            if fallback_code != 0:
                common.print_result(
                    result,
                    "Linux AppImage build completed",
                    "Linux AppImage build failed",
                )
                return code
            logger.warn(
                "Tauri linuxdeploy failed, but AppImage was packaged from the generated AppDir."
            )
    else:
        common.print_result(
            result, "Linux AppImage build completed", "Linux AppImage build failed"
        )

    if dry_run:
        _print_install_plan()
        logger.info("📁 Dry-run finished; no AppImage was built or installed.")
        return 0

    common.print_build_artifacts()
    return install_latest()


def appimage_build_env() -> dict[str, str]:
    env = {"APPIMAGE_EXTRACT_AND_RUN": "1"}
    host_bin = Path("/run/host/usr/bin")
    if host_bin.exists():
        env["PATH"] = f"{host_bin}{os.pathsep}{os.environ.get('PATH', '')}"
    return env


def is_linuxdeploy_failure(result: common.CommandResult) -> bool:
    output = f"{result.stdout}\n{result.stderr}".lower()
    before_build_failed = re.search(
        r"beforebuildcommand\s+`[^`]+`\s+failed(?:\s+with\s+exit\s+code\s+\d+)?",
        output,
    )
    frontend_build_failed = (
        "npm run build` failed" in output or "npm run build failed" in output
    )
    typescript_failed = "error ts" in output
    if before_build_failed or frontend_build_failed or typescript_failed:
        return False
    return (
        "failed to run linuxdeploy" in output
        or "appimage bundler" in output
        or "appimage bundle" in output
        or ("linuxdeploy" in output and ("failed" in output or "error" in output))
    )


def package_existing_appdir(*, dry_run: bool = False) -> int:
    appdir = _appdir()
    plugin = _appimage_plugin()
    if not appdir.is_dir():
        logger.fail(f"AppDir missing: {appdir}")
        return 1
    if not plugin.exists():
        logger.fail(f"linuxdeploy AppImage plugin missing: {plugin}")
        return 1

    if dry_run:
        logger.info(f"DRY-RUN repair AppDir icon metadata in {appdir}")
        logger.info(f"DRY-RUN {plugin} --appdir {appdir}")
        return 0

    try:
        _repair_appdir_icon(appdir)
    except AppImageInstallError as exc:
        logger.fail(str(exc))
        return 1

    result = common.run_command(
        [str(plugin), "--appdir", str(appdir)],
        cwd=_appimage_dir(),
        env=appimage_build_env(),
    )
    code = common.print_result(
        result,
        "Fallback AppImage packaging completed",
        "Fallback AppImage packaging failed",
    )
    if code != 0:
        return code

    _normalize_fallback_appimage_name()
    return 0


def _appimage_snapshot() -> dict[Path, tuple[int, int]]:
    appimage_dir = _appimage_dir()
    if not appimage_dir.is_dir():
        return {}
    snapshot: dict[Path, tuple[int, int]] = {}
    for path in _collect_files(appimage_dir, APPIMAGE_PATTERNS):
        try:
            stat_result = path.stat()
        except OSError:
            continue
        snapshot[path] = (stat_result.st_mtime_ns, stat_result.st_size)
    return snapshot


def _fresh_appimage_from_snapshot(snapshot: dict[Path, tuple[int, int]]) -> Path | None:
    appimage_dir = _appimage_dir()
    if not appimage_dir.is_dir():
        return None

    changed: list[Path] = []
    for path in _collect_files(appimage_dir, APPIMAGE_PATTERNS):
        try:
            stat_result = path.stat()
        except OSError:
            continue
        if snapshot.get(path) != (stat_result.st_mtime_ns, stat_result.st_size):
            changed.append(path)

    if not changed:
        return None

    preference = _normalize_name(_app_slug())
    preferred = [path for path in changed if preference in _normalize_name(path.name)]
    pool = preferred if preferred else changed
    return max(pool, key=lambda path: (path.stat().st_mtime_ns, path.name.lower()))


def _appimage_prerequisites_ready(
    rerun_command: str = "python tools/control.py tauri build --appimage",
) -> bool:
    problems = _appimage_prerequisite_problems()
    if not problems:
        return True

    logger.fail("AppImage build prerequisites are missing.")
    for problem in problems:
        logger.info(f"- {problem}")
    logger.info(f"Install them with: {linux_install.appimage_install_hint()}")
    logger.info(f"After installation, rerun: {rerun_command}")
    return False


def _appimage_prerequisite_problems() -> list[str]:
    required_commands = {
        "desktop-file-validate": "desktop-file-utils",
        "file": "file",
        "mksquashfs": "squashfs-tools",
        "patchelf": "patchelf",
    }
    problems = [
        f"{binary} not found (package: {package})"
        for binary, package in required_commands.items()
        if not _command_available(binary)
    ]
    if not _libfuse2_available():
        problems.append("libfuse.so.2 not found (package: libfuse2/fuse2)")
    return problems


def _libfuse2_available() -> bool:
    if _library_file_exists("libfuse.so.2*"):
        return True
    if _command_output_contains(["ldconfig", "-p"], "libfuse.so.2"):
        return True
    return _command_output_contains(
        ["flatpak-spawn", "--host", "ldconfig", "-p"],
        "libfuse.so.2",
    )


def _command_output_contains(command: list[str], expected: str) -> bool:
    result = common.run_command(command)
    return result.returncode == 0 and expected in f"{result.stdout}\n{result.stderr}"


def _command_available(binary: str) -> bool:
    if shutil.which(binary):
        return True
    if _host_file_exists(f"usr/bin/{binary}"):
        return True
    ok, output = common.command_output(
        ["flatpak-spawn", "--host", "sh", "-lc", f"command -v {binary}"]
    )
    return ok and bool(output.strip())


def _host_file_exists(relative_path: str) -> bool:
    return (Path("/run/host") / relative_path).exists()


def _library_file_exists(pattern: str) -> bool:
    return any(
        root.exists() and (any(root.glob(pattern)) or any(root.glob(f"*/{pattern}")))
        for root in _library_search_roots()
    )


def _library_search_roots() -> tuple[Path, ...]:
    return (
        Path("/usr/lib"),
        Path("/usr/lib64"),
        Path("/lib"),
        Path("/lib64"),
        Path("/run/host/usr/lib"),
        Path("/run/host/usr/lib64"),
        Path("/run/host/lib"),
        Path("/run/host/lib64"),
    )


def install_latest(*, dry_run: bool = False) -> int:
    try:
        appimage_dir = _appimage_dir()
        icon_dir = paths.TAURI_DIR / "icons"
        logger.info(f"🧩 AppImage source directory: {appimage_dir}")
        logger.info(f"🎨 Icon source directory: {icon_dir}")
        logger.info(f"📌 Target AppImage: {_target_appimage_path()}")
        logger.info(f"📌 Target desktop file: {_target_desktop_path()}")

        if dry_run:
            _print_install_plan()
            return 0

        if not appimage_dir.is_dir():
            raise AppImageInstallError(
                f"AppImage build folder does not exist: {appimage_dir}"
            )
        if not icon_dir.is_dir():
            raise AppImageInstallError(f"Icon folder does not exist: {icon_dir}")
        if not _collect_files(appimage_dir, APPIMAGE_PATTERNS) and _appdir().is_dir():
            logger.warn(
                "No final AppImage found; packaging the existing AppDir before install."
            )
            code = package_existing_appdir(dry_run=dry_run)
            if code != 0:
                return code

        source_appimage = _select_appimage(appimage_dir)
        source_icon = _select_icon(icon_dir)
        target_icon = _target_icon_dir() / f"{_app_slug()}{source_icon.suffix.lower()}"

        logger.info(f"🧩 Selected AppImage: {source_appimage.name}")
        logger.info(f"🎨 Selected icon: {source_icon.name}")

        _ensure_dir(_target_appimage_path().parent, dry_run=dry_run)
        _ensure_dir(_target_desktop_path().parent, dry_run=dry_run)
        _ensure_dir(_target_icon_dir(), dry_run=dry_run)

        _copy_file(source_appimage, _target_appimage_path(), dry_run=dry_run)
        _set_executable(_target_appimage_path(), dry_run=dry_run)

        _copy_file(source_icon, target_icon, dry_run=dry_run)
        _cleanup_stale_icons(target_icon, dry_run=dry_run)

        _write_desktop_file(
            _target_desktop_path(),
            _desktop_file_content(_target_appimage_path(), target_icon),
            dry_run=dry_run,
        )

        logger.ok(f"{_app_name()} AppImage installed locally")
        logger.info(f"🧩 Installed AppImage: {_target_appimage_path()}")
        logger.info(f"🎨 Installed icon: {target_icon}")
        logger.info(f"🧾 Desktop entry: {_target_desktop_path()}")
        return 0
    except AppImageInstallError as exc:
        logger.fail(str(exc))
        return 1
    except OSError as exc:
        logger.fail(f"AppImage local install failed: {exc}")
        return 1


def _print_install_plan() -> None:
    logger.info("🧩 AppImage install plan:")
    logger.info(
        f"▶️ copy newest AppImage from {_appimage_dir()} to {_target_appimage_path()}"
    )
    logger.info(f"▶️ chmod +x {_target_appimage_path()}")
    logger.info(
        f"▶️ copy best icon from {paths.TAURI_DIR / 'icons'} to {_target_icon_dir()}"
    )
    logger.info(f"▶️ write desktop entry {_target_desktop_path()}")


def _appimage_dir() -> Path:
    return paths.TAURI_DIR / "target" / "release" / "bundle" / "appimage"


def _appdir() -> Path:
    return _appimage_dir() / f"{_app_name()}.AppDir"


def _appimage_plugin() -> Path:
    return Path.home() / ".cache" / "tauri" / "linuxdeploy-plugin-appimage.AppImage"


def _repair_appdir_icon(appdir: Path) -> None:
    desktop_file = next(appdir.glob("*.desktop"), None)
    if desktop_file is None:
        raise AppImageInstallError(f"No desktop file found in AppDir: {appdir}")

    icon_name = _desktop_icon_name(desktop_file)
    if not icon_name:
        raise AppImageInstallError(
            f"No Icon entry found in desktop file: {desktop_file}"
        )

    for extension in ICON_EXTENSIONS:
        expected = appdir / f"{icon_name}{extension}"
        if expected.exists():
            return

    source = _find_appdir_icon_source(appdir)
    if source is None:
        raise AppImageInstallError(f"No icon source found for AppDir: {appdir}")

    target = appdir / f"{icon_name}{source.suffix.lower()}"
    logger.info(f"▶️ repair AppDir icon {source.name} -> {target.name}")
    shutil.copy2(source, target)


def _desktop_icon_name(desktop_file: Path) -> str | None:
    for line in desktop_file.read_text(encoding="utf-8").splitlines():
        if not line.startswith("Icon="):
            continue
        value = line.split("=", 1)[1].strip()
        if not value:
            return None
        return Path(value).stem
    return None


def _find_appdir_icon_source(appdir: Path) -> Path | None:
    preferred_names = [f"{_app_name()}.png", "icon.png", "128x128.png"]
    by_lower_name = {
        path.name.lower(): path for path in _collect_files(appdir, PNG_PATTERNS)
    }
    for name in preferred_names:
        candidate = by_lower_name.get(name.lower())
        if candidate:
            return candidate

    candidates = _collect_files(appdir, PNG_PATTERNS)
    if candidates:
        return max(
            candidates,
            key=lambda path: (_extract_size_hint(path), path.name.lower()),
        )
    return None


def _normalize_fallback_appimage_name() -> None:
    candidates = _collect_files(_appimage_dir(), APPIMAGE_PATTERNS)
    if not candidates:
        return

    newest = max(candidates, key=lambda path: path.stat().st_mtime_ns)
    target = _appimage_dir() / _expected_appimage_name()
    if newest == target:
        return
    logger.info(f"▶️ normalize AppImage name {newest.name} -> {target.name}")
    if target.exists():
        target.unlink()
    newest.rename(target)


def _expected_appimage_name() -> str:
    version = _tauri_version()
    return f"{_app_name()}_{version}_amd64.AppImage"


def _tauri_version() -> str:
    cargo_toml = paths.TAURI_DIR / "Cargo.toml"
    try:
        with cargo_toml.open("rb") as handle:
            payload = tomllib.load(handle)
        version = payload.get("package", {}).get("version")
        if isinstance(version, str) and version:
            return version
    except (OSError, tomllib.TOMLDecodeError):
        pass
    for version_path in (paths.ROOT / "VERSION", paths.TOOLS_DIR / "VERSION"):
        try:
            version = version_path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if version:
            return version
    raise AppImageInstallError(
        "Could not determine the AppImage version from Cargo.toml or VERSION"
    )


def _data_home() -> Path:
    return _home() / ".local" / "share"


def _home() -> Path:
    return Path.home()


def _target_appimage_path() -> Path:
    return _home() / "Applications" / f"{_app_name()}.AppImage"


def _target_desktop_path() -> Path:
    return _data_home() / "applications" / f"{_app_slug()}.desktop"


def _target_icon_dir() -> Path:
    return _data_home() / "icons"


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
        raise AppImageInstallError(
            f"No AppImage found in build directory: {appimage_dir}"
        )

    preference = _normalize_name(_app_slug())
    preferred = [
        path for path in candidates if preference in _normalize_name(path.name)
    ]
    pool = preferred if preferred else candidates
    if len(candidates) > 1:
        detail = (
            f"preferred {_app_name()} candidates: {len(preferred)}"
            if preferred
            else "using newest by modification time"
        )
        logger.warn(f"Multiple AppImages found ({len(candidates)}); {detail}.")

    newest_mtime = max(path.stat().st_mtime_ns for path in pool)
    newest = [path for path in pool if path.stat().st_mtime_ns == newest_mtime]
    if len(newest) > 1:
        lines = "\n".join(f"  - {path.name}" for path in newest)
        raise AppImageInstallError(f"Ambiguous AppImage selection:\n{lines}")
    return newest[0]


def _select_icon(icon_dir: Path) -> Path:
    png_files = _collect_files(icon_dir, PNG_PATTERNS)
    if png_files:
        by_name = {path.name.lower(): path for path in png_files}
        for name in PRIORITY_ICON_NAMES:
            candidate = by_name.get(name)
            if candidate:
                return candidate
        return max(
            png_files,
            key=lambda path: (
                _extract_size_hint(path),
                path.stat().st_mtime_ns,
                path.name.lower(),
            ),
        )

    svg_files = _collect_files(icon_dir, SVG_PATTERNS)
    if svg_files:
        preferred = next(
            (path for path in svg_files if path.name.lower() == "icon.svg"), None
        )
        return preferred or min(svg_files, key=lambda path: path.name.lower())

    raise AppImageInstallError(f"Icon missing: no PNG or SVG files found in {icon_dir}")


def _extract_size_hint(path: Path) -> int:
    match = re.search(r"(\d+)\s*x\s*(\d+)", path.stem.lower())
    if match:
        return max(int(match.group(1)), int(match.group(2)))
    values = re.findall(r"\d+", path.stem)
    return max((int(value) for value in values), default=0)


def _ensure_dir(path: Path, *, dry_run: bool) -> None:
    logger.info(f"▶️ mkdir -p {path}")
    if not dry_run:
        path.mkdir(parents=True, exist_ok=True)


def _copy_file(source: Path, destination: Path, *, dry_run: bool) -> None:
    action = "overwrite" if destination.exists() else "copy"
    logger.info(f"▶️ {action} {source} -> {destination}")
    if not dry_run:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def _set_executable(path: Path, *, dry_run: bool) -> None:
    logger.info(f"▶️ chmod +x {path}")
    if dry_run:
        return
    mode = path.stat().st_mode
    os.chmod(path, mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _cleanup_stale_icons(keep_path: Path, *, dry_run: bool) -> None:
    for extension in ICON_EXTENSIONS:
        candidate = _target_icon_dir() / f"{_app_slug()}{extension}"
        if candidate == keep_path or not candidate.exists():
            continue
        logger.info(f"▶️ remove stale icon {candidate}")
        if not dry_run:
            candidate.unlink()


def _desktop_file_content(appimage_path: Path, icon_path: Path) -> str:
    lines = [
        "[Desktop Entry]",
        "Type=Application",
        f"Name={_app_name()}",
        f"Comment={_app_name()} desktop app",
        f"Exec={appimage_path}",
        f"TryExec={appimage_path}",
        f"Icon={icon_path}",
        "Terminal=false",
        "Categories=Development;Utility;",
    ]
    return "\n".join(lines) + "\n"


def _write_desktop_file(path: Path, content: str, *, dry_run: bool) -> None:
    logger.info(f"▶️ write desktop entry {path}")
    if dry_run:
        return
    if path.exists() and path.read_text(encoding="utf-8") == content:
        logger.info("Desktop entry is already up to date.")
        return
    path.write_text(content, encoding="utf-8")
