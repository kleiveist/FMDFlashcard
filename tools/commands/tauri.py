"""Tauri-specific command map over canonical FMD handlers."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import platform
import shutil
import subprocess
from dataclasses import asdict
from pathlib import Path

from tools import logger
from tools.artifacts import (
    EXPERIMENTAL_CROSS_MATRIX_ID,
    EXPERIMENTAL_CROSS_PACKAGE_TYPE,
    ArtifactError,
    experimental_windows_cross_source,
    verify_collected_target_directory,
    verify_local_build_directory,
    verify_local_desktop_root,
    verify_manifest_directory,
    verify_target_sources,
)
from tools.commands import environment, lifecycle
from tools.commands.build import desktop_plan, run_desktop_build
from tools.paths import PathSafetyError, ensure_within, project_paths
from tools.process import run_command
from tools.project_config import ConfigError, load_release_matrix, normalize_bundles


def _platform_dependency_checks() -> list[environment.Check]:
    checks: list[environment.Check] = []
    system = platform.system()
    if system == "Linux":
        for tool in ("pkg-config", "patchelf", "file", "dpkg-deb", "rpm", "rpmbuild"):
            executable = shutil.which(tool)
            checks.append(
                environment.Check(
                    f"tauri-tool:{tool}",
                    "ok" if executable else "fail",
                    True,
                    executable or "not found on PATH",
                )
            )
        pkg_config = shutil.which("pkg-config")
        for package in (
            "webkit2gtk-4.1",
            "javascriptcoregtk-4.1",
            "gtk+-3.0",
            "openssl",
            "librsvg-2.0",
            "ayatana-appindicator3-0.1",
        ):
            present = False
            if pkg_config:
                result = subprocess.run(
                    [pkg_config, "--exists", package],
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                present = result.returncode == 0
            checks.append(
                environment.Check(
                    f"tauri-pkg-config:{package}",
                    "ok" if present else "fail",
                    True,
                    "available" if present else "not available through pkg-config",
                )
            )
    elif system == "Darwin":
        for tool in ("xcodebuild", "hdiutil", "codesign"):
            executable = shutil.which(tool)
            checks.append(
                environment.Check(
                    f"tauri-tool:{tool}",
                    "ok" if executable else "fail",
                    True,
                    executable or "not found on PATH",
                )
            )
    elif system == "Windows":
        for tool in ("cl.exe", "link.exe"):
            executable = shutil.which(tool)
            checks.append(
                environment.Check(
                    f"tauri-tool:{tool}",
                    "ok" if executable else "fail",
                    True,
                    executable or "not found on PATH",
                )
            )
    else:
        checks.append(
            environment.Check(
                "tauri-platform",
                "fail",
                True,
                f"unsupported native desktop host: {system}",
            )
        )
    return checks


def _tauri_doctor(*, json_output: bool) -> int:
    paths = project_paths()
    checks = [*environment.collect_doctor_checks(paths), *_platform_dependency_checks()]
    capability = paths.tauri / "capabilities" / "default.json"
    checks.append(
        environment.Check(
            "file:capabilities/default.json",
            "ok" if capability.is_file() else "fail",
            True,
            str(capability),
        )
    )
    passed = all(check.status == "ok" for check in checks if check.required)
    document = {
        "checks": [asdict(check) for check in checks],
        "schema_version": 1,
        "status": "ok" if passed else "fail",
    }
    if json_output:
        print(json.dumps(document, sort_keys=True, separators=(",", ":")))
    else:
        for check in checks:
            message = f"{check.name}: {check.detail}"
            (logger.ok if check.status == "ok" else logger.error)(message)
        logger.info(f"Tauri doctor status: {document['status']}")
    return 0 if passed else 1


def structure_check() -> int:
    paths = project_paths()
    required = [
        paths.desktop / "package.json",
        paths.desktop / "pnpm-lock.yaml",
        paths.tauri / "Cargo.toml",
        paths.tauri / "Cargo.lock",
        paths.tauri / "tauri.conf.json",
        paths.tauri / "capabilities" / "default.json",
    ]
    missing = [path for path in required if not path.is_file()]
    if missing:
        logger.error("Missing Tauri project files: " + ", ".join(str(path) for path in missing))
        return 1
    try:
        config = json.loads((paths.tauri / "tauri.conf.json").read_text(encoding="utf-8"))
        capabilities = json.loads(
            (paths.tauri / "capabilities" / "default.json").read_text(encoding="utf-8")
        )
        if config.get("identifier") != "com.blobbite.fmdflashcard":
            raise ValueError("the established Tauri identifier changed")
        if not isinstance(capabilities.get("permissions"), list):
            raise ValueError("Tauri capabilities permissions must be an array")
        matrix = load_release_matrix(paths)
        for target in matrix.targets:
            for build in target.builds:
                desktop_plan(
                    build.cli_target,
                    bundles=",".join(build.bundles) if build.bundles else None,
                    rust_target=target.rust_target,
                    paths=paths,
                )
    except (OSError, ValueError, json.JSONDecodeError, ConfigError) as exc:
        logger.error(f"Tauri structure check failed: {exc}")
        return 1
    logger.ok("Tauri files, capabilities, identifier, and native build plans are valid")
    return 0


def _cargo_test() -> int:
    paths = project_paths()
    result = run_command(
        ["cargo", "test", "--locked", "--all-targets"],
        cwd=paths.tauri,
        capture_output=False,
    )
    return result.returncode


def _install_appimage(dry_run: bool) -> int:
    if platform.system() != "Linux":
        logger.error("AppImage installation is supported only on Linux")
        return 1
    paths = project_paths()
    build_root = paths.dist / "desktop" / "linux-x86_64" / "linux"
    if build_root.is_dir():
        try:
            verify_local_build_directory(build_root, paths=paths)
        except (ArtifactError, ConfigError, OSError) as exc:
            logger.error(f"Refusing to install an unverified AppImage: {exc}")
            return 1
    module_path = paths.tools / "inst" / "linux" / "installappimage.py"
    spec = importlib.util.spec_from_file_location("fmd_installappimage", module_path)
    if spec is None or spec.loader is None:
        logger.error(f"Could not load AppImage installer: {module_path}")
        return 1
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    runner = getattr(module, "run_install", None)
    if not callable(runner):
        logger.error("AppImage installer has no run_install function")
        return 1
    return int(runner(dry_run=dry_run, project_root=str(paths.root)))


def _copy(args: argparse.Namespace) -> int:
    paths = project_paths()
    source = paths.dist / "desktop"
    requested_target = (
        Path(args.target_dir).expanduser() if args.target_dir else paths.dist / "export"
    )
    try:
        if requested_target.is_symlink():
            raise PathSafetyError("copy target must not be a symlink")
        target = requested_target.resolve(strict=False)
        if not args.allow_outside_repo:
            ensure_within(target, paths.root, label="copy target")
        try:
            target.relative_to(source.resolve(strict=False))
        except ValueError:
            pass
        else:
            raise PathSafetyError("copy target must not be inside the artifact source")
        files = verify_local_desktop_root(source, paths=paths)
        if target.exists() and (not target.is_dir() or any(target.iterdir())):
            raise FileExistsError(f"copy target must be an empty directory: {target}")
        if args.dry_run:
            logger.info(f"Would copy {len(files)} verified files from {source} to {target}")
            return 0
        target.mkdir(parents=True, exist_ok=True)
        for path in files:
            relative = path.relative_to(source)
            destination = target / relative
            ensure_within(destination.resolve(strict=False), target, label="copy destination")
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)
            logger.info(f"Copied {relative}")
    except (ArtifactError, OSError, PathSafetyError, json.JSONDecodeError) as exc:
        logger.error(str(exc))
        return 1
    return 0


def _verify(args: argparse.Namespace) -> int:
    paths = project_paths()
    matrix_id = args.matrix_id or os.environ.get("FMD_RELEASE_MATRIX_ID")
    if args.directory:
        candidate = Path(args.directory)
        if (candidate / "release-manifest.json").is_file():
            try:
                verify_manifest_directory(candidate, paths)
            except (ArtifactError, ConfigError, OSError) as exc:
                logger.error(str(exc))
                return 1
            logger.ok(f"Verified assembled release directory {candidate}")
            return 0
        if (candidate / "build-manifest.json").is_file():
            try:
                payload = json.loads(
                    (candidate / "build-manifest.json").read_text(encoding="utf-8")
                )
                if args.matrix_id and payload.get("matrix_id") != args.matrix_id:
                    raise ConfigError("--matrix-id does not match the local build manifest")
                if args.target and payload.get("cli_target") != args.target:
                    raise ConfigError("--target does not match the local build manifest")
                if args.bundles and not args.target:
                    raise ConfigError("--bundles requires --target")
                if args.target:
                    requested_bundles = normalize_bundles(args.target, args.bundles)
                    requested_types = {
                        "app-archive" if bundle == "app" else bundle for bundle in requested_bundles
                    }
                    if args.target == "windows-portable":
                        requested_types = {"portable-zip"}
                    elif args.target == "windows-cross-linux":
                        requested_types = {EXPERIMENTAL_CROSS_PACKAGE_TYPE}
                    if set(payload.get("package_types", [])) != requested_types:
                        raise ConfigError("--bundles do not match the local build manifest")
                verified = verify_local_build_directory(candidate, paths=paths)
            except (ArtifactError, ConfigError, OSError, json.JSONDecodeError) as exc:
                logger.error(str(exc))
                return 2 if isinstance(exc, ConfigError) else 1
            for path in verified:
                logger.ok(f"Verified {path.relative_to(paths.root)}")
            return 0
    selected_package_types: set[str] | None = None
    if args.target == "windows-cross-linux":
        if matrix_id and matrix_id != EXPERIMENTAL_CROSS_MATRIX_ID:
            logger.error("windows-cross-linux is experimental and has no release matrix target")
            return 2
        try:
            normalize_bundles(args.target, args.bundles)
            marker = paths.state / "build-markers" / "windows-cross-linux.started"
            source = experimental_windows_cross_source(
                rust_target="x86_64-pc-windows-msvc",
                built_after=marker,
                paths=paths,
            )
        except (ArtifactError, ConfigError, OSError) as exc:
            logger.error(str(exc))
            return 1
        logger.ok(f"Verified experimental cross-build {source.relative_to(paths.root)}")
        return 0
    if not matrix_id:
        if args.target:
            matches = [
                target.target_id
                for target in load_release_matrix(paths).targets
                if any(build.cli_target == args.target for build in target.builds)
            ]
            if len(matches) == 2 and args.target == "macos":
                host_id = _host_matrix_id()
                matches = [item for item in matches if item == host_id]
            if len(matches) != 1:
                logger.error("--target is not one native matrix target; use --matrix-id")
                return 2
            matrix_id = matches[0]
        else:
            matrix_id = _host_matrix_id()
            if matrix_id is None:
                logger.error("the current host has no supported native artifact target")
                return 1
    if args.target:
        try:
            selected_target = load_release_matrix(paths).target(matrix_id)
            if not any(build.cli_target == args.target for build in selected_target.builds):
                raise ConfigError(
                    f"--target {args.target} does not belong to matrix target {matrix_id}"
                )
            selected_bundles = normalize_bundles(args.target, args.bundles)
            selected_package_types = {
                "app-archive" if bundle == "app" else bundle for bundle in selected_bundles
            }
            if args.target == "windows-portable":
                selected_package_types = {"portable-zip"}
        except ConfigError as exc:
            logger.error(str(exc))
            return 2
    elif args.bundles:
        logger.error("--bundles requires --target")
        return 2
    try:
        if args.directory:
            verified = verify_collected_target_directory(
                matrix_id, Path(args.directory), paths=paths
            )
        elif args.target:
            marker = paths.state / "build-markers" / f"{args.target}.started"
            if not marker.is_file():
                raise ArtifactError(f"build marker is missing: {marker}")
            verified = verify_target_sources(
                matrix_id,
                built_after=marker,
                package_types=selected_package_types,
                paths=paths,
            )
        else:
            verified = []
            matrix_target = load_release_matrix(paths).target(matrix_id)
            for build in matrix_target.builds:
                marker = paths.state / "build-markers" / f"{build.cli_target}.started"
                if not marker.is_file():
                    raise ArtifactError(f"build marker is missing: {marker}")
                package_types = {
                    "app-archive" if bundle == "app" else bundle for bundle in build.bundles
                }
                if build.cli_target == "windows-portable":
                    package_types = {"portable-zip"}
                verified.extend(
                    verify_target_sources(
                        matrix_id,
                        built_after=marker,
                        package_types=package_types,
                        paths=paths,
                    )
                )
    except (ArtifactError, ConfigError, OSError) as exc:
        logger.error(str(exc))
        return 1
    for path in verified:
        logger.ok(f"Verified {path.relative_to(paths.root)}")
    return 0


def _host_matrix_id() -> str | None:
    system = platform.system()
    if system == "Linux":
        return "linux-x86_64" if platform.machine().lower() in {"x86_64", "amd64"} else None
    if system == "Windows":
        return "windows-x86_64" if platform.machine().lower() in {"x86_64", "amd64"} else None
    if system == "Darwin":
        machine = platform.machine().lower()
        if machine in {"arm64", "aarch64"}:
            return "macos-aarch64"
        if machine in {"x86_64", "amd64"}:
            return "macos-x86_64"
    return None


def handle(args: argparse.Namespace) -> int:
    command = getattr(args, "tauri_command", None)
    if command is None:
        args.tauri_parser.print_help()
        return 0
    if command == "doctor":
        return _tauri_doctor(json_output=args.json)
    if command == "install":
        return environment.install(args)
    if command == "install-appimage":
        return _install_appimage(args.dry_run)
    if command == "run":
        return lifecycle.run(args)
    if command == "stop":
        return lifecycle.stop(args)
    if command == "build":
        return run_desktop_build(
            args.target,
            bundles=args.bundles,
            rust_target=getattr(args, "rust_target", None),
            dry_run=args.dry_run,
            no_clean=args.no_clean,
        )
    if command == "test":
        structure = structure_check()
        if structure or not (args.cargo or args.all):
            return structure
        return _cargo_test()
    if command == "copy":
        return _copy(args)
    if command == "verify-artifacts":
        return _verify(args)
    return 2
