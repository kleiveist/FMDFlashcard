from __future__ import annotations

import argparse
import os
import stat
from pathlib import Path

import pytest

from tools import control
from tools.profiles import runtime as profile_runtime
from tools.tauri import common, paths
from tools.tauri.build import appimage, installappimage, linux, windows_portable
from tools.tauri.linux import install as linux_install

pytestmark = pytest.mark.skipif(
    not profile_runtime.feature_enabled("tauri"),
    reason="Tauri feature disabled by active profile",
)


def test_tauri_build_artifacts_print_with_icons(monkeypatch, tmp_path) -> None:
    messages: list[str] = []
    monkeypatch.setattr(common.logger, "info", messages.append)

    root = tmp_path / "repo"
    bundle_dir = root / "src-tauri" / "target" / "release" / "bundle"
    dist_dir = root / ".dist" / "desktop"
    bundle_dir.mkdir(parents=True)
    dist_dir.mkdir(parents=True)
    (bundle_dir / "Template Project_1.0.0_amd64.deb").write_bytes(b"deb")
    (bundle_dir / "Template Project-1.0.0-1.x86_64.rpm").write_bytes(b"rpm")
    (dist_dir / "Template Project-windows-portable.zip").write_bytes(b"zip")

    monkeypatch.setattr(paths, "ROOT", root)
    monkeypatch.setattr(paths, "DIST_DIR", dist_dir)
    monkeypatch.setattr(paths, "bundle_roots", lambda: [bundle_dir])

    common.print_build_artifacts()

    output = "\n".join(messages)
    assert "📁 Build artifacts:" in messages
    assert "📦 src-tauri/target/release/bundle/Template Project_1.0.0_amd64.deb" in output
    assert "📦 src-tauri/target/release/bundle/Template Project-1.0.0-1.x86_64.rpm" in output
    assert "🗜️ .dist/desktop/Template Project-windows-portable.zip" in output


def test_windows_portable_output_path_repairs_owner_directory_permissions(tmp_path) -> None:
    dist_dir = tmp_path / "desktop"
    dist_dir.mkdir()
    dist_dir.chmod(stat.S_IWUSR | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)

    try:
        assert windows_portable._ensure_portable_output_path(dist_dir / "Template Project-windows-portable.zip") is True
        mode = dist_dir.stat().st_mode
        assert mode & stat.S_IRUSR
        assert mode & stat.S_IWUSR
        assert mode & stat.S_IXUSR
    finally:
        dist_dir.chmod(stat.S_IRWXU)


def test_tauri_linux_build_accepts_explicit_bundle_selection(monkeypatch) -> None:
    calls: list[list[str]] = []
    preflight: list[bool] = []

    monkeypatch.setattr(
        appimage, "_appimage_prerequisites_ready", lambda *args, **kwargs: preflight.append(True) or True
    )
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: calls.append(command) or common.CommandResult(command, paths.ROOT, 0),
    )
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(linux, "_verify_outputs", lambda requested, **_kwargs: 0)

    code = control.main(["tauri", "build", "--target", "linux", "--bundles", "appimage"])

    assert code == 0
    assert preflight == [True]
    assert calls[0][-3:] == ["build", "--bundles", "appimage"]


def test_tauri_linux_build_default_includes_appimage_preflight(monkeypatch) -> None:
    calls: list[list[str]] = []
    preflight: list[bool] = []

    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(
        appimage, "_appimage_prerequisites_ready", lambda *args, **kwargs: preflight.append(True) or True
    )
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: calls.append(command) or common.CommandResult(command, paths.ROOT, 0),
    )
    monkeypatch.setattr(linux, "_verify_outputs", lambda requested, **_kwargs: 0)

    code = control.main(["tauri", "build", "--target", "linux"])

    assert code == 0
    assert preflight == [True]
    assert calls[0][-3:] == ["build", "--bundles", "deb,rpm,appimage"]


def test_tauri_linux_build_uses_appimage_fallback_when_linuxdeploy_fails(monkeypatch) -> None:
    calls: list[list[str]] = []
    fallback: list[bool] = []

    def fake_run_command(command: list[str], **kwargs) -> common.CommandResult:
        calls.append(command)
        return common.CommandResult(command=command, cwd=paths.ROOT, returncode=1, stderr="failed to run linuxdeploy")

    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda *args, **kwargs: True)
    monkeypatch.setattr(common, "run_command", fake_run_command)
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)
    monkeypatch.setattr(linux, "_verify_outputs", lambda requested, **_kwargs: 0)

    code = control.main(["tauri", "build", "--target", "linux"])

    assert code == 0
    assert calls[0][-3:] == ["build", "--bundles", "deb,rpm,appimage"]
    assert fallback == [False]


def test_tauri_linux_build_uses_appimage_fallback_when_before_build_succeeded_then_linuxdeploy_failed(
    monkeypatch,
) -> None:
    fallback: list[bool] = []
    output = """
       Running beforeBuildCommand `cd ../frontend && npm run build`
       Bundling Template Project_1.0.0_amd64.AppImage
       failed to bundle project `failed to run linuxdeploy`
    """

    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda *args, **kwargs: True)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: common.CommandResult(command=command, cwd=paths.ROOT, returncode=1, stderr=output),
    )
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)
    monkeypatch.setattr(linux, "_verify_outputs", lambda requested, **_kwargs: 0)

    code = control.main(["tauri", "build", "--target", "linux"])

    assert code == 0
    assert fallback == [False]


def test_tauri_appimage_linuxdeploy_detection_accepts_user_failure_tail() -> None:
    output = """
       - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
       Compiling project-template v1.0.0 (/workspace/Template Project/src-tauri)
       Finished `release` profile [optimized] target(s) in 25.29s
       Built application at: /workspace/Template Project/src-tauri/target/release/Template Project
       Bundling Template Project_1.0.0_amd64.AppImage
       failed to bundle project `failed to run linuxdeploy`
       Error failed to bundle project `failed to run linuxdeploy`
    """

    result = common.CommandResult(command=[], cwd=paths.ROOT, returncode=1, stderr=output)

    assert appimage.is_linuxdeploy_failure(result) is True


def test_tauri_linux_build_accepts_fresh_appimage_when_linuxdeploy_returns_failure(monkeypatch) -> None:
    fallback: list[bool] = []
    output = """
       - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
       Running beforeBuildCommand `cd ../frontend && npm run build`
       Finished `release` profile [optimized] target(s) in 25.29s
       Bundling Template Project_1.0.0_amd64.AppImage
       failed to bundle project `failed to run linuxdeploy`
       Error failed to bundle project `failed to run linuxdeploy`
    """

    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda *args, **kwargs: True)
    monkeypatch.setattr(appimage, "_appimage_snapshot", dict)
    monkeypatch.setattr(
        appimage,
        "_fresh_appimage_from_snapshot",
        lambda snapshot: paths.ROOT / "src-tauri/target/release/bundle/appimage/Template Project_1.0.0_amd64.AppImage",
    )
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: common.CommandResult(command=command, cwd=paths.ROOT, returncode=1, stderr=output),
    )
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)
    monkeypatch.setattr(linux, "_verify_outputs", lambda requested, **_kwargs: 0)

    code = control.main(["tauri", "build", "--target", "linux", "--bundles", "appimage"])

    assert code == 0
    assert fallback == []


def test_tauri_linux_build_does_not_use_appimage_fallback_for_frontend_build_failure(monkeypatch) -> None:
    fallback: list[bool] = []

    def fake_run_command(command: list[str], **kwargs) -> common.CommandResult:
        return common.CommandResult(
            command=command,
            cwd=paths.ROOT,
            returncode=1,
            stderr="beforeBuildCommand `cd ../frontend && npm run build` failed with exit code 2",
        )

    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda *args, **kwargs: True)
    monkeypatch.setattr(common, "run_command", fake_run_command)
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)

    code = control.main(["tauri", "build", "--target", "linux"])

    assert code == 1
    assert fallback == []


def test_tauri_build_appimage_shortcut_builds_and_installs(monkeypatch) -> None:
    calls: list[tuple[list[str], bool]] = []
    installed: list[bool] = []

    def fake_run_command(command: list[str], **kwargs) -> common.CommandResult:
        calls.append((command, bool(kwargs.get("dry_run"))))
        return common.CommandResult(command=command, cwd=paths.ROOT, returncode=0)

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda: True)
    monkeypatch.setattr(common, "run_command", fake_run_command)
    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: installed.append(dry_run) or 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)

    code = control.main(["tauri", "build", "--appimage"])

    assert code == 0
    assert calls[0][0][-3:] == ["build", "--bundles", "appimage"]
    assert calls[0][1] is False
    assert installed == [False]


def test_tauri_build_appimage_shortcut_packages_appdir_on_linuxdeploy_failure(monkeypatch) -> None:
    fallback: list[bool] = []
    installed: list[bool] = []

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda: True)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: common.CommandResult(
            command=command,
            cwd=paths.ROOT,
            returncode=1,
            stderr="failed to run linuxdeploy",
        ),
    )
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)
    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: installed.append(dry_run) or 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)

    code = control.main(["tauri", "build", "--appimage"])

    assert code == 0
    assert fallback == [False]
    assert installed == [False]


def test_tauri_build_appimage_shortcut_installs_fresh_appimage_when_linuxdeploy_returns_failure(monkeypatch) -> None:
    fallback: list[bool] = []
    installed: list[bool] = []
    output = """
       Bundling Template Project_1.0.0_amd64.AppImage
       failed to bundle project `failed to run linuxdeploy`
       Error failed to bundle project `failed to run linuxdeploy`
    """

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_snapshot", dict)
    monkeypatch.setattr(
        appimage,
        "_fresh_appimage_from_snapshot",
        lambda snapshot: paths.ROOT / "src-tauri/target/release/bundle/appimage/Template Project_1.0.0_amd64.AppImage",
    )
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: common.CommandResult(
            command=command,
            cwd=paths.ROOT,
            returncode=1,
            stderr=output,
        ),
    )
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)
    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: installed.append(dry_run) or 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)

    code = control.main(["tauri", "build", "--appimage"])

    assert code == 0
    assert fallback == []
    assert installed == [False]


def test_tauri_build_appimage_shortcut_does_not_install_on_frontend_build_failure(monkeypatch) -> None:
    fallback: list[bool] = []
    installed: list[bool] = []

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda: True)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: common.CommandResult(
            command=command,
            cwd=paths.ROOT,
            returncode=1,
            stderr="beforeBuildCommand `cd ../frontend && npm run build` failed with exit code 2",
        ),
    )
    monkeypatch.setattr(appimage, "package_existing_appdir", lambda dry_run=False: fallback.append(dry_run) or 0)
    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: installed.append(dry_run) or 0)

    code = control.main(["tauri", "build", "--appimage"])

    assert code == 1
    assert fallback == []
    assert installed == []


def test_tauri_install_appimage_command_only_installs(monkeypatch) -> None:
    installed: list[bool] = []

    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: installed.append(dry_run) or 0)

    code = control.main(["tauri", "install-appimage", "--dry-run"])

    assert code == 0
    assert installed == [True]


def test_tauri_installappimage_module_delegates_to_appimage_installer(monkeypatch) -> None:
    installed: list[bool] = []

    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: installed.append(dry_run) or 0)

    code = installappimage.main(argparse.Namespace(dry_run=False))

    assert code == 0
    assert installed == [False]


def test_tauri_install_appimage_packages_existing_appdir_when_final_file_is_missing(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    home = tmp_path / "home"
    app_name = "Fixture App"
    tauri_dir = root / "src-tauri"
    appimage_dir = tauri_dir / "target" / "release" / "bundle" / "appimage"
    appdir = appimage_dir / f"{app_name}.AppDir"
    icon_dir = tauri_dir / "icons"
    appdir.mkdir(parents=True)
    icon_dir.mkdir(parents=True)
    (icon_dir / "icon.png").write_bytes(b"png")
    packaged: list[bool] = []

    def fake_package_existing_appdir(dry_run: bool = False) -> int:
        packaged.append(dry_run)
        (appimage_dir / f"{app_name}_1.0.0_amd64.AppImage").write_bytes(b"appimage")
        return 0

    monkeypatch.setattr(paths, "ROOT", root)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri_dir)
    monkeypatch.setattr(paths, "APP_NAME", app_name)
    monkeypatch.setattr(appimage, "_home", lambda: home)
    monkeypatch.setattr(appimage, "package_existing_appdir", fake_package_existing_appdir)

    code = appimage.install_latest()

    assert code == 0
    assert packaged == [False]
    assert (home / "Applications" / f"{app_name}.AppImage").read_bytes() == b"appimage"


def test_tauri_build_appimage_dry_run_does_not_install(monkeypatch) -> None:
    calls: list[tuple[list[str], bool]] = []

    def fake_run_command(command: list[str], **kwargs) -> common.CommandResult:
        calls.append((command, bool(kwargs.get("dry_run"))))
        return common.CommandResult(command=command, cwd=paths.ROOT, returncode=0, dry_run=True)

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "run_command", fake_run_command)
    monkeypatch.setattr(
        appimage, "install_latest", lambda dry_run=False: (_ for _ in ()).throw(AssertionError("should not install"))
    )

    code = control.main(["tauri", "build", "--appimage", "--dry-run"])

    assert code == 0
    assert calls[0][0][-3:] == ["build", "--bundles", "appimage"]
    assert calls[0][1] is True


def test_tauri_build_appimage_fails_when_preflight_is_missing(monkeypatch) -> None:
    calls: list[list[str]] = []

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(appimage, "_appimage_prerequisites_ready", lambda: False)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: calls.append(command) or common.CommandResult(command, paths.ROOT, 0),
    )

    code = control.main(["tauri", "build", "--appimage"])

    assert code == 1
    assert calls == []


def test_tauri_build_appimage_can_skip_preflight(monkeypatch) -> None:
    calls: list[list[str]] = []

    monkeypatch.setattr(common, "host_os", lambda: "linux")
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(
        appimage,
        "_appimage_prerequisites_ready",
        lambda: (_ for _ in ()).throw(AssertionError("should skip preflight")),
    )
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **kwargs: calls.append(command) or common.CommandResult(command, paths.ROOT, 0),
    )
    monkeypatch.setattr(appimage, "install_latest", lambda dry_run=False: 0)
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)

    code = control.main(["tauri", "build", "--appimage", "--skip-appimage-preflight"])

    assert code == 0
    assert calls[0][-3:] == ["build", "--bundles", "appimage"]


def test_tauri_appimage_command_detection_checks_host_paths(monkeypatch) -> None:
    monkeypatch.setattr(appimage.shutil, "which", lambda binary: None)
    monkeypatch.setattr(appimage, "_host_file_exists", lambda relative_path: relative_path == "usr/bin/patchelf")
    monkeypatch.setattr(
        common, "command_output", lambda command: (_ for _ in ()).throw(AssertionError("should not shell out"))
    )

    assert appimage._command_available("patchelf") is True


def test_tauri_appimage_libfuse_detection_checks_host_paths(monkeypatch) -> None:
    monkeypatch.setattr(appimage, "_library_file_exists", lambda pattern: pattern == "libfuse.so.2*")
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command: (_ for _ in ()).throw(AssertionError("should not shell out")),
    )

    assert appimage._libfuse2_available() is True


def test_tauri_appimage_libfuse_detection_accepts_versioned_library(monkeypatch, tmp_path) -> None:
    lib_dir = tmp_path / "usr" / "lib"
    lib_dir.mkdir(parents=True)
    (lib_dir / "libfuse.so.2.9.9").write_text("", encoding="utf-8")

    monkeypatch.setattr(appimage, "_library_search_roots", lambda: (lib_dir,))

    assert appimage._library_file_exists("libfuse.so.2*") is True


def test_tauri_appimage_libfuse_detection_accepts_ubuntu_multiarch_library(monkeypatch, tmp_path) -> None:
    lib_root = tmp_path / "usr" / "lib"
    multiarch_dir = lib_root / "x86_64-linux-gnu"
    multiarch_dir.mkdir(parents=True)
    (multiarch_dir / "libfuse.so.2.9.9").write_text("", encoding="utf-8")

    monkeypatch.setattr(appimage, "_library_search_roots", lambda: (lib_root,))

    assert appimage._library_file_exists("libfuse.so.2*") is True


def test_tauri_appimage_libfuse_detection_reads_complete_ldconfig_output(monkeypatch) -> None:
    monkeypatch.setattr(appimage, "_library_file_exists", lambda _pattern: False)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command: common.CommandResult(
            command=command,
            cwd=Path.cwd(),
            returncode=0,
            stdout="library cache header\nlibfuse.so.2 (libc6,x86-64) => /lib/x86_64-linux-gnu/libfuse.so.2",
        ),
    )

    assert appimage._libfuse2_available() is True


def test_tauri_appimage_libfuse_detection_rejects_unrelated_ldconfig_output(monkeypatch) -> None:
    commands: list[list[str]] = []
    monkeypatch.setattr(appimage, "_library_file_exists", lambda _pattern: False)

    def fake_run(command: list[str]) -> common.CommandResult:
        commands.append(command)
        return common.CommandResult(
            command=command,
            cwd=Path.cwd(),
            returncode=0,
            stdout="library cache header\nlibfuse3.so.3 => /lib/x86_64-linux-gnu/libfuse3.so.3",
        )

    monkeypatch.setattr(common, "run_command", fake_run)

    assert appimage._libfuse2_available() is False
    assert commands == [
        ["ldconfig", "-p"],
        ["flatpak-spawn", "--host", "ldconfig", "-p"],
    ]


def test_tauri_detects_arch_like_host_from_os_release(tmp_path) -> None:
    os_release = tmp_path / "os-release"
    os_release.write_text("ID=cachyos\nID_LIKE=arch\n", encoding="utf-8")

    assert linux_install._distro_from_os_release(os_release) == "arch"


def test_tauri_build_appimage_rejects_non_linux_target(monkeypatch) -> None:
    monkeypatch.setattr(appimage, "main", lambda args: (_ for _ in ()).throw(AssertionError("should not run")))

    code = control.main(["tauri", "build", "--target", "windows", "--appimage"])

    assert code == 1


def test_tauri_appimage_install_copies_artifact_icon_and_desktop_entry(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    home = tmp_path / "home"
    tauri_dir = root / "src-tauri"
    appimage_dir = tauri_dir / "target" / "release" / "bundle" / "appimage"
    icon_dir = tauri_dir / "icons"
    appimage_dir.mkdir(parents=True)
    icon_dir.mkdir(parents=True)
    source_appimage = appimage_dir / "Template Project_1.0.0_amd64.AppImage"
    source_icon = icon_dir / "icon.png"
    source_appimage.write_bytes(b"appimage")
    source_icon.write_bytes(b"png")

    monkeypatch.setattr(paths, "ROOT", root)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri_dir)
    monkeypatch.setattr(appimage, "_home", lambda: home)

    code = appimage.install_latest()

    installed_appimage = home / "Applications" / f"{paths.APP_NAME}.AppImage"
    installed_icon = home / ".local" / "share" / "icons" / f"{paths.APP_SLUG}.png"
    desktop_entry = home / ".local" / "share" / "applications" / f"{paths.APP_SLUG}.desktop"
    assert code == 0
    assert installed_appimage.read_bytes() == b"appimage"
    if os.name != "nt":
        assert installed_appimage.stat().st_mode & 0o111
    assert installed_icon.read_bytes() == b"png"
    assert f"Name={paths.APP_NAME}" in desktop_entry.read_text(encoding="utf-8")


def test_tauri_appimage_repair_icon_matches_desktop_icon_name(tmp_path, monkeypatch) -> None:
    appdir = tmp_path / "Template Project.AppDir"
    appdir.mkdir()
    (appdir / "Template Project.desktop").write_text("Name=Template Project\nIcon=project-template\n", encoding="utf-8")
    (appdir / "Template Project.png").write_bytes(b"png")

    monkeypatch.setattr(paths, "APP_NAME", "Template Project")

    appimage._repair_appdir_icon(appdir)

    assert (appdir / "project-template.png").read_bytes() == b"png"
