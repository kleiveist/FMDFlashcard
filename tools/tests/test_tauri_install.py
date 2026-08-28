from __future__ import annotations

from pathlib import Path

import pytest

from tools import control
from tools.profiles.model import ProjectProfile
from tools.tauri import common, doctor
from tools.tauri import control as tauri_control
from tools.tauri import install as tauri_install
from tools.tauri.linux import install as linux_install
from tools.tauri.linux import install_debian


def _profile(*features: str) -> ProjectProfile:
    return ProjectProfile(
        schema_version=1,
        profile_id="test-profile",
        name="Test profile",
        description="Tauri installation test profile",
        features=features,
    )


def test_ubuntu_release_detection_preserves_version_for_dependency_mapping(tmp_path: Path) -> None:
    os_release = tmp_path / "os-release"
    os_release.write_text('ID=ubuntu\nVERSION_ID="24.04"\n', encoding="utf-8")

    distribution = linux_install._distribution_from_os_release(os_release)

    assert distribution == linux_install.LinuxDistribution("ubuntu", "24.04")


@pytest.mark.parametrize(
    ("distro_id", "version_id", "expected_fuse"),
    [
        ("ubuntu", "22.04", "libfuse2"),
        ("ubuntu", "24.04", "libfuse2t64"),
        ("ubuntu", "26.04", "libfuse2t64"),
        ("debian", "12", "libfuse2"),
        ("debian", "13", "libfuse2t64"),
    ],
)
def test_debian_family_packages_match_supported_release_names(
    distro_id: str,
    version_id: str,
    expected_fuse: str,
) -> None:
    packages = install_debian.dependency_packages(
        distro_id=distro_id,
        version_id=version_id,
    )

    assert expected_fuse in packages
    assert {"libwebkit2gtk-4.1-dev", "libgtk-3-dev", "libayatana-appindicator3-dev", "librsvg2-dev"} <= set(packages)
    assert {"build-essential", "libxdo-dev", "patchelf"} <= set(packages)
    assert {"file", "patchelf", "squashfs-tools", "desktop-file-utils", expected_fuse} <= set(packages)
    assert {"rpm", "rpmbuild"}.isdisjoint(packages)


def test_debian_family_install_updates_metadata_and_is_noninteractive(monkeypatch) -> None:
    commands: list[list[str]] = []

    def fake_run(command: list[str], **_kwargs) -> common.CommandResult:
        commands.append(command)
        return common.CommandResult(command=command, cwd=Path.cwd(), returncode=0)

    monkeypatch.setattr(common, "run_command", fake_run)

    code = install_debian.install(
        dry_run=False,
        distro_id="ubuntu",
        version_id="24.04",
    )

    assert code == 0
    assert commands[0] == ["sudo", "apt-get", "update"]
    assert commands[1][:7] == [
        "sudo",
        "env",
        "DEBIAN_FRONTEND=noninteractive",
        "apt-get",
        "install",
        "-y",
        "--no-install-recommends",
    ]
    assert "libfuse2t64" in commands[1]


@pytest.mark.parametrize("failed_command", ["update", "install"])
def test_debian_family_package_manager_failure_is_nonzero(
    monkeypatch,
    failed_command: str,
) -> None:
    call_count = 0
    errors: list[str] = []

    def fake_run(command: list[str], **_kwargs) -> common.CommandResult:
        nonlocal call_count
        call_count += 1
        fails = failed_command == "update" or call_count == 2
        return common.CommandResult(
            command=command,
            cwd=Path.cwd(),
            returncode=100 if fails else 0,
            stderr="fixture package manager failure" if fails else "",
        )

    monkeypatch.setattr(common, "run_command", fake_run)
    monkeypatch.setattr(common.logger, "fail", errors.append)

    code = install_debian.install(
        dry_run=False,
        distro_id="ubuntu",
        version_id="24.04",
    )

    assert code == 1
    assert any("fixture package manager failure" in message for message in errors)
    assert any("Failed to" in message for message in errors)


def test_tauri_install_skip_flags_do_not_invoke_skipped_installers(monkeypatch) -> None:
    monkeypatch.setattr(tauri_install.linux_install, "install_system_dependencies", lambda **_kwargs: 0)
    monkeypatch.setattr(
        tauri_install,
        "_ensure_rust",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("Rust installer should be skipped")),
    )
    monkeypatch.setattr(
        tauri_install,
        "_ensure_node",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("Node check should be skipped")),
    )
    monkeypatch.setattr(
        tauri_install,
        "_install_frontend_dependencies",
        lambda **_kwargs: (_ for _ in ()).throw(AssertionError("Frontend install should be skipped")),
    )
    monkeypatch.setattr(tauri_install, "_check_tauri_scaffold", lambda: 0)

    args = control._build_parser().parse_args(["tauri", "install", "--skip-rust", "--skip-node", "--skip-frontend"])

    assert tauri_install.main(args) == 0


@pytest.mark.parametrize("command", ["doctor", "install", "test"])
def test_inactive_tauri_diagnostics_skip_cleanly(monkeypatch, command: str) -> None:
    messages: list[str] = []
    monkeypatch.setattr(tauri_control.profile_runtime, "active_profile", lambda _root: _profile("frontend"))
    monkeypatch.setattr(tauri_control.logger, "info", messages.append)

    assert control.main(["tauri", command]) == 0
    assert any("skipped because the feature is disabled" in message for message in messages)


def test_required_and_optional_pkg_config_checks_have_distinct_status(monkeypatch) -> None:
    monkeypatch.setattr(doctor.shutil, "which", lambda _name: "/usr/bin/pkg-config")
    monkeypatch.setattr(doctor.common, "command_output", lambda _command: (False, "missing"))

    required = doctor._check_pkg_config("webkitgtk", ["webkit2gtk-4.1"], required=True)
    optional = doctor._check_pkg_config("optional", ["fixture-1.0"])

    assert required.status == "FAIL"
    assert optional.status == "WARN"
