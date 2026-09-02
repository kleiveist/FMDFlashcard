"""Web and native Tauri build planning/execution."""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import stat
from dataclasses import dataclass
from pathlib import Path

from tools.artifacts import (
    ArtifactError,
    collect_experimental_windows_cross_artifact,
    collect_local_build_artifacts,
    create_deterministic_zip,
    verify_fresh_windows_executable,
)
from tools.paths import ProjectPaths, project_paths, require_within
from tools.process import CommandRunner, run_command
from tools.project_config import ConfigError, application_version, normalize_bundles


class BuildError(RuntimeError):
    """Raised for invalid or unsupported build requests."""


@dataclass(frozen=True, slots=True)
class DesktopBuildPlan:
    target: str
    bundles: tuple[str, ...]
    command: tuple[str, ...]
    cwd: Path
    marker: Path
    clean_paths: tuple[Path, ...]


def _pnpm_prefix() -> list[str]:
    if executable := shutil.which("pnpm"):
        return [executable]
    if executable := shutil.which("corepack"):
        return [executable, "pnpm"]
    # Planning and dry-runs must work before dependencies are installed. Real
    # execution returns 127 through the central process boundary.
    return ["pnpm"]


def _host_allowed(target: str) -> bool:
    host = platform.system().lower()
    return {
        "linux": host == "linux",
        "windows": host == "windows",
        "windows-portable": host == "windows",
        "windows-cross-linux": host == "linux",
        "macos": host == "darwin",
    }[target]


def _default_rust_target(target: str) -> str:
    if target == "linux":
        return "x86_64-unknown-linux-gnu"
    if target in {"windows", "windows-portable", "windows-cross-linux"}:
        return "x86_64-pc-windows-msvc"
    machine = platform.machine().lower()
    return "aarch64-apple-darwin" if machine in {"arm64", "aarch64"} else "x86_64-apple-darwin"


def _validated_rust_target(value: str) -> str:
    if value != value.strip() or not re.fullmatch(r"[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+){2,4}", value):
        raise BuildError(f"invalid Rust target triple: {value!r}")
    return value


def _target_rust_compatible(target: str, rust_target: str) -> bool:
    allowed = {
        "linux": {"x86_64-unknown-linux-gnu"},
        "windows": {"x86_64-pc-windows-msvc"},
        "windows-portable": {"x86_64-pc-windows-msvc"},
        "windows-cross-linux": {"x86_64-pc-windows-msvc"},
        "macos": {"aarch64-apple-darwin", "x86_64-apple-darwin"},
    }
    return rust_target in allowed[target]


def _windows_signing_config(target: str) -> Path | None:
    raw = os.environ.get("FMD_TAURI_SIGNING_CONFIG_PATH", "").strip()
    if not raw:
        return None
    if target not in {"windows", "windows-portable"}:
        raise BuildError("Windows signing config is set for a non-Windows build")
    path = Path(raw)
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise BuildError("Windows signing config must be an absolute regular non-symlink file")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        windows = payload["bundle"]["windows"]
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise BuildError("Windows signing config is not valid Tauri JSON") from exc
    if (
        not isinstance(windows, dict)
        or not isinstance(windows.get("certificateThumbprint"), str)
        or not windows["certificateThumbprint"].strip()
        or windows.get("digestAlgorithm") != "sha256"
    ):
        raise BuildError("Windows signing config lacks a thumbprint or SHA-256 digest policy")
    return path


def desktop_plan(
    target: str,
    *,
    bundles: str | None = None,
    rust_target: str | None = None,
    paths: ProjectPaths | None = None,
) -> DesktopBuildPlan:
    project = paths or project_paths()
    normalized = normalize_bundles(target, bundles)
    selected_rust_target = _validated_rust_target(rust_target or _default_rust_target(target))
    if not _target_rust_compatible(target, selected_rust_target):
        raise BuildError(f"Rust target {selected_rust_target!r} is incompatible with {target}")
    prefix = _pnpm_prefix()
    command = [*prefix, "tauri", "build"]
    if target == "windows-portable":
        command.extend(["--target", selected_rust_target, "--no-bundle"])
    elif target == "windows-cross-linux":
        command.extend(
            [
                "--runner",
                "cargo-xwin",
                "--target",
                selected_rust_target,
                "--no-bundle",
            ]
        )
    else:
        command.extend(["--target", selected_rust_target])
        if normalized:
            tauri_bundles = ["appimage" if item == "appimage" else item for item in normalized]
            command.extend(["--bundles", ",".join(tauri_bundles)])
    if signing_config := _windows_signing_config(target):
        command.extend(["--config", str(signing_config)])
    target_root = project.tauri / "target"
    target_root = target_root / selected_rust_target
    release_root = target_root / "release"
    clean_paths: list[Path] = []
    if target == "windows-portable":
        clean_paths.extend(
            [
                release_root / "fmd-flashcard-desktop.exe",
                release_root / "bundle" / "portable",
            ]
        )
    elif target == "windows-cross-linux":
        clean_paths.append(
            project.tauri
            / "target"
            / selected_rust_target
            / "release"
            / "fmd-flashcard-desktop.exe"
        )
    else:
        bundle_root = release_root / "bundle"
        directory_names = {
            "deb": "deb",
            "rpm": "rpm",
            "appimage": "appimage",
            "msi": "msi",
            "nsis": "nsis",
            "app": "macos",
            "dmg": "dmg",
        }
        clean_paths.extend(bundle_root / directory_names[item] for item in normalized)
    marker = project.state / "build-markers" / f"{target}.started"
    return DesktopBuildPlan(
        target=target,
        bundles=normalized,
        command=tuple(command),
        cwd=project.desktop,
        marker=marker,
        clean_paths=tuple(clean_paths),
    )


def _clean_build_outputs(plan: DesktopBuildPlan, project: ProjectPaths) -> None:
    for path in plan.clean_paths:
        try:
            require_within(project.tauri, path, label="Tauri build output")
        except ValueError as exc:
            raise BuildError(str(exc)) from exc
        if path.is_symlink():
            raise BuildError(f"refusing to clean symlinked build output: {path}")
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()


def _sign_windows_portable(executable: Path, project: ProjectPaths) -> None:
    configured = os.environ.get("FMD_WINDOWS_SIGNING_CONFIGURED", "false").lower()
    if configured not in {"true", "false"}:
        raise BuildError("FMD_WINDOWS_SIGNING_CONFIGURED must be true or false")
    if configured == "false":
        return
    if platform.system() != "Windows":
        raise BuildError("configured Windows portable signing requires a Windows host")
    if not os.environ.get("FMD_WINDOWS_CERTIFICATE_THUMBPRINT", "").strip():
        raise BuildError("configured Windows portable signing has no certificate thumbprint")
    script = project.root / ".github" / "scripts" / "sign_windows_portable.ps1"
    if not script.is_file():
        raise BuildError(f"Windows portable signing helper is missing: {script}")
    powershell = shutil.which("pwsh") or shutil.which("powershell.exe")
    if not powershell:
        raise BuildError("PowerShell is required for Windows portable signing")
    result = run_command(
        [powershell, "-NoProfile", "-NonInteractive", "-File", str(script), str(executable)],
        cwd=project.root,
        env=os.environ.copy(),
        capture_output=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise BuildError(
            "Windows portable Authenticode signing failed" + (f": {detail}" if detail else "")
        )
    print("[OK] Windows portable executable Authenticode signature verified")


def run_desktop_build(
    target: str,
    *,
    bundles: str | None = None,
    rust_target: str | None = None,
    dry_run: bool = False,
    no_clean: bool = False,
) -> int:
    project = project_paths()
    try:
        plan = desktop_plan(target, bundles=bundles, rust_target=rust_target, paths=project)
        print(f"Target: {plan.target}")
        print(f"Bundles: {','.join(plan.bundles) if plan.bundles else 'none'}")
        print(f"Build marker: {plan.marker}")
        if dry_run:
            return CommandRunner(dry_run=True).run(list(plan.command), cwd=plan.cwd)
        if not _host_allowed(target):
            raise BuildError(
                f"{target} requires its native host; current host is {platform.system()}"
            )
        if not no_clean:
            _clean_build_outputs(plan, project)
        plan.marker.parent.mkdir(parents=True, exist_ok=True)
        plan.marker.write_text("build-started\n", encoding="utf-8", newline="\n")
        result = CommandRunner().run(list(plan.command), cwd=plan.cwd)
        if result != 0:
            return result
        if target == "windows-portable":
            selected_rust_target = rust_target or _default_rust_target(target)
            portable_root = project.tauri / "target" / selected_rust_target / "release"
            executable = portable_root / "fmd-flashcard-desktop.exe"
            verify_fresh_windows_executable(executable, built_after=plan.marker, paths=project)
            _sign_windows_portable(executable, project)
            portable = portable_root / "bundle" / "portable"
            archive = portable / "FMDFlashcard-portable.zip"
            create_deterministic_zip(executable, archive)
            print(f"[OK] portable archive: {archive}")
        if target == "windows-cross-linux":
            selected_rust_target = rust_target or _default_rust_target(target)
            manifest = collect_experimental_windows_cross_artifact(
                rust_target=selected_rust_target,
                built_after=plan.marker,
                paths=project,
            )
            print(f"[OK] collected experimental cross-build evidence: {manifest.parent}")
        else:
            selected_rust_target = rust_target or _default_rust_target(target)
            package_types = {
                "app-archive" if bundle == "app" else bundle for bundle in plan.bundles
            }
            if target == "windows-portable":
                package_types = {"portable-zip"}
            manifest = collect_local_build_artifacts(
                target,
                rust_target=selected_rust_target,
                built_after=plan.marker,
                package_types=package_types,
                paths=project,
            )
            print(f"[OK] collected local desktop artifacts: {manifest.parent}")
        return 0
    except (ArtifactError, BuildError, ConfigError, OSError) as exc:
        print(f"[FAIL] desktop build: {exc}")
        return 1


def build_web(*, dry_run: bool = False) -> int:
    project = project_paths()
    try:
        command = [*_pnpm_prefix(), "run", "build"]
        result = CommandRunner(dry_run=dry_run).run(command, cwd=project.desktop)
        if result != 0 or dry_run:
            return result
        source = project.desktop / "dist"
        if not source.is_dir() or not any(source.rglob("*")):
            raise BuildError("Vite build output is missing or empty")
        require_within(project.desktop, source, label="Vite build output")
        if source.is_symlink():
            raise BuildError(f"Vite build output cannot be a symlink: {source}")
        web_root = project.dist / "web"
        require_within(project.root, web_root, label="web artifact output")
        if web_root.is_symlink():
            raise BuildError(f"web artifact output cannot be a symlink: {web_root}")
        if web_root.exists():
            shutil.rmtree(web_root)
        archive = web_root / f"FMDFlashcard-v{application_version(project)}-web.zip"
        create_deterministic_zip(source, archive)
        archive.chmod(archive.stat().st_mode & ~(stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH))
        print(f"[OK] web archive: {archive}")
        return 0
    except (BuildError, ConfigError, ArtifactError, OSError) as exc:
        print(f"[FAIL] web build: {exc}")
        return 1


def handle(args: argparse.Namespace) -> int:
    command = getattr(args, "build_command", None)
    if command is None:
        args.build_parser.print_help()
        return 0
    if command == "web":
        return build_web(dry_run=args.dry_run)
    if command == "desktop":
        if getattr(args, "target", None) is None:
            args.desktop_parser.print_help()
            return 0
        return run_desktop_build(
            args.target,
            bundles=getattr(args, "bundles", None),
            rust_target=getattr(args, "rust_target", None),
            dry_run=args.dry_run,
            no_clean=getattr(args, "no_clean", False),
        )
    return 2
