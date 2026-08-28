from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from tools import control
from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    create_project_config,
)
from tools.inst import container, release
from tools.profiles.model import ProjectProfile


def _profile(*features: str) -> ProjectProfile:
    return ProjectProfile(
        schema_version=1,
        profile_id="test-profile",
        name="Test profile",
        description="Test profile",
        features=features,
    )


def test_container_build_is_rejected_for_non_cloud_profile(monkeypatch) -> None:
    monkeypatch.setattr(
        container.profile_runtime, "active_profile", lambda _root: _profile("frontend")
    )

    assert container.build(argparse.Namespace(component="all", no_cache=False)) == 1


def test_container_doctor_reports_missing_docker_as_actionable_failure(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(container, "ROOT", tmp_path)
    monkeypatch.setattr(
        container.profile_runtime,
        "active_profile",
        lambda _root: _profile("backend", "cloud"),
    )
    monkeypatch.setattr(container, "_docker", lambda: None)

    checks = container.collect_checks()

    docker = next(check for check in checks if check.name == "docker")
    assert docker.status == "FAIL"
    assert (
        docker.message == "Docker is required for container builds but was not found."
    )


def test_general_doctor_treats_missing_compose_as_optional_warning(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(container, "ROOT", tmp_path)
    monkeypatch.setattr(
        container.profile_runtime,
        "active_profile",
        lambda _root: _profile("backend", "cloud"),
    )
    monkeypatch.setattr(container, "_docker", lambda: "/usr/bin/docker")

    def fake_run(command: list[str]) -> subprocess.CompletedProcess[str]:
        if command[1:] == ["--version"]:
            return subprocess.CompletedProcess(
                command, 0, stdout="Docker version fixture", stderr=""
            )
        return subprocess.CompletedProcess(
            command, 1, stdout="", stderr="compose unavailable"
        )

    monkeypatch.setattr(container, "_run", fake_run)

    checks = container.collect_checks(require_docker=False)

    compose = next(check for check in checks if check.name == "compose")
    assert compose.status == "WARN"


def test_container_build_dispatches_profile_components(
    monkeypatch, tmp_path: Path
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(container, "ROOT", tmp_path)
    monkeypatch.setattr(
        container.profile_runtime,
        "active_profile",
        lambda _root: _profile("frontend", "backend", "cloud"),
    )
    monkeypatch.setattr(
        container,
        "_build_component",
        lambda component, no_cache=False: calls.append(component) or 0,
    )

    assert container.build(argparse.Namespace(component="all", no_cache=False)) == 0
    assert calls == ["backend", "frontend"]


def test_container_commands_are_available_from_control_parser() -> None:
    parser = control._build_parser()

    assert (
        parser.parse_args(["build", "container", "--component", "backend"]).component
        == "backend"
    )
    assert parser.parse_args(["container", "doctor"]).container_command == "doctor"
    assert parser.parse_args(["container", "validate"]).container_command == "validate"


def test_version_check_detects_inconsistent_metadata(
    monkeypatch, tmp_path: Path
) -> None:
    (tmp_path / "frontend").mkdir()
    (tmp_path / "VERSION").write_text("1.2.3\n", encoding="utf-8")
    (tmp_path / "frontend" / "package.json").write_text(
        json.dumps({"name": "customer-app-frontend", "version": "1.2.4"}),
        encoding="utf-8",
    )
    (tmp_path / "frontend" / "package-lock.json").write_text(
        json.dumps({"name": "customer-app-frontend", "version": "1.2.3"}),
        encoding="utf-8",
    )
    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setattr(
        release.profile_runtime, "active_profile", lambda _root: _profile("frontend")
    )

    checks = release.collect_version_checks()

    assert any(
        check.status == "FAIL" and "package.json=1.2.4" in check.message
        for check in checks
    )


def test_tooling_version_is_consistent(monkeypatch) -> None:
    monkeypatch.setattr(
        release.profile_runtime, "active_profile", lambda _root: _profile()
    )
    checks = release.collect_version_checks()

    assert checks
    assert not [check for check in checks if check.status == "FAIL"]


def test_version_sync_updates_frontend_metadata(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / "frontend").mkdir()
    (tmp_path / "VERSION").write_text("2.3.4\n", encoding="utf-8")
    (tmp_path / "frontend" / "package.json").write_text(
        json.dumps({"name": "customer-app-frontend", "version": "1.0.0"}),
        encoding="utf-8",
    )
    (tmp_path / "frontend" / "package-lock.json").write_text(
        json.dumps(
            {
                "name": "customer-app-frontend",
                "version": "1.0.0",
                "packages": {"": {"name": "customer-app-frontend", "version": "1.0.0"}},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setattr(
        release.profile_runtime, "active_profile", lambda _root: _profile("frontend")
    )

    assert release.sync_versions() == 0

    package = json.loads(
        (tmp_path / "frontend" / "package.json").read_text(encoding="utf-8")
    )
    package_lock = json.loads(
        (tmp_path / "frontend" / "package-lock.json").read_text(encoding="utf-8")
    )
    assert package["version"] == "2.3.4"
    assert package_lock["version"] == "2.3.4"
    assert package_lock["packages"][""]["version"] == "2.3.4"


def test_release_identity_warns_when_project_config_is_absent(
    monkeypatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(release, "ROOT", tmp_path)

    assert release._placeholder_checks() == [
        release.ReleaseCheck(
            "project-identity",
            "WARN",
            "project-tooling.toml is absent; release identity is inferred from the directory name",
        )
    ]


def test_release_identity_uses_portable_project_config(
    monkeypatch, tmp_path: Path
) -> None:
    create_project_config(
        tmp_path / "project-tooling.toml",
        ProjectConfig(
            tooling_version="1.0.0",
            project_name="Customer App",
            profile="web-only",
        ),
    )
    monkeypatch.setattr(release, "ROOT", tmp_path)

    assert release._placeholder_checks() == [
        release.ReleaseCheck(
            "project-identity",
            "OK",
            "project identity is configured as 'Customer App'",
        )
    ]


def test_version_checks_honor_configured_frontend_path(
    monkeypatch, tmp_path: Path
) -> None:
    frontend = tmp_path / "apps" / "web"
    frontend.mkdir(parents=True)
    (tmp_path / "VERSION").write_text("1.2.3\n", encoding="utf-8")
    package = {"name": "customer-web", "version": "1.2.3"}
    package_lock = {
        "name": "customer-web",
        "version": "1.2.3",
        "packages": {"": {"name": "customer-web", "version": "1.2.3"}},
    }
    (frontend / "package.json").write_text(json.dumps(package), encoding="utf-8")
    (frontend / "package-lock.json").write_text(
        json.dumps(package_lock), encoding="utf-8"
    )
    create_project_config(
        tmp_path / "project-tooling.toml",
        ProjectConfig(
            tooling_version="1.0.0",
            project_name="Customer App",
            profile="web-only",
            paths=ProjectPathConfig(frontend="apps/web"),
        ),
    )
    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setattr(
        release.profile_runtime, "active_profile", lambda _root: _profile("frontend")
    )

    assert not [
        check for check in release.collect_version_checks() if check.status == "FAIL"
    ]


def test_git_release_check_rejects_dirty_tree(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setattr(
        release.subprocess,
        "run",
        lambda *args, **kwargs: subprocess.CompletedProcess(
            args[0], 0, stdout=" M changed.txt\n", stderr=""
        ),
    )

    assert release._git_check().status == "FAIL"


def test_release_tag_must_match_source_version(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / "VERSION").write_text("1.2.3\n", encoding="utf-8")
    monkeypatch.setattr(release, "ROOT", tmp_path)
    monkeypatch.setenv("GITHUB_REF_TYPE", "tag")
    monkeypatch.setenv("GITHUB_REF_NAME", "v1.2.4")

    check = release._tag_check()

    assert check.status == "FAIL"
    assert "expected v1.2.3" in check.message
