from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from tools import control
from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    create_project_config,
)
from tools.inst import db, install
from tools.profiles.model import ProjectProfile


def _profile(*features: str) -> ProjectProfile:
    return ProjectProfile(
        schema_version=1,
        profile_id="test-profile",
        name="Test profile",
        description="Database command test profile",
        features=features,
    )


def test_db_parser_recognizes_commands() -> None:
    parser = control._build_parser()

    assert parser.parse_args(["db", "doctor", "--connect"]).db_command == "doctor"
    assert parser.parse_args(["db", "current"]).db_command == "current"
    assert parser.parse_args(["db", "upgrade"]).revision == "head"
    assert parser.parse_args(["db", "downgrade"]).revision == "-1"
    assert (
        parser.parse_args(["db", "revision", "--message", "add widgets"]).message
        == "add widgets"
    )


def test_db_doctor_reports_disabled_feature(monkeypatch) -> None:
    monkeypatch.setattr(
        db.profile_runtime, "active_profile", lambda _root: _profile("frontend")
    )

    checks = db._configuration_checks(connect=False)

    assert checks == [
        db.DatabaseCheck(
            "feature", "FAIL", "Database feature is not enabled for this project."
        )
    ]


def test_db_doctor_validates_postgres_driver_and_dependencies(monkeypatch) -> None:
    monkeypatch.setattr(
        db.profile_runtime,
        "active_profile",
        lambda _root: _profile("frontend", "backend", "database", "postgres"),
    )
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://app:secret@localhost:5432/app"
    )
    monkeypatch.setattr(
        db,
        "_run_probe",
        lambda _script: subprocess.CompletedProcess(["python"], 0, "", ""),
    )

    checks = db._configuration_checks(connect=False)

    assert all(check.status == "OK" for check in checks)
    assert all("secret" not in check.message for check in checks)


def test_db_doctor_rejects_non_psycopg_postgres_url(monkeypatch) -> None:
    monkeypatch.setattr(
        db.profile_runtime,
        "active_profile",
        lambda _root: _profile("backend", "database", "postgres"),
    )
    monkeypatch.setenv("DATABASE_URL", "postgresql://app:secret@localhost:5432/app")

    checks = db._configuration_checks(connect=False)

    assert checks[-1] == db.DatabaseCheck(
        "DATABASE_URL",
        "FAIL",
        "postgres feature requires the 'postgresql+psycopg' driver scheme",
    )
    assert all("secret" not in check.message for check in checks)


def test_database_url_redaction_removes_encoded_and_rendered_passwords(
    monkeypatch,
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://app:p%40ss@localhost:5432/app"
    )

    detail = db._redact_database_url(
        "connection postgresql+psycopg://app:p%40ss@localhost:5432/app failed with password p@ss"
    )

    assert "p%40ss" not in detail
    assert "p@ss" not in detail


def test_backend_requirements_follow_active_features(
    monkeypatch, tmp_path: Path
) -> None:
    create_project_config(
        tmp_path / "project-tooling.toml",
        ProjectConfig(
            tooling_version="1.0.0",
            project_name="Database Test",
            profile="test-profile",
            paths=ProjectPathConfig(backend="services/api"),
        ),
    )
    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(
        install.profile_runtime,
        "active_profile",
        lambda _root: _profile("frontend", "backend"),
    )
    assert [path.name for path in install._backend_requirements()] == [
        "requirements.txt"
    ]

    monkeypatch.setattr(
        install.profile_runtime,
        "active_profile",
        lambda _root: _profile("frontend", "backend", "database", "postgres"),
    )
    assert [path.name for path in install._backend_requirements()] == [
        "requirements.txt",
        "requirements-database.txt",
        "requirements-postgres.txt",
    ]


def test_db_migration_commands_delegate_to_alembic(monkeypatch) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(
        db, "_run_alembic", lambda arguments: calls.append(arguments) or 0
    )

    assert db.main(argparse.Namespace(db_command="current")) == 0
    assert db.main(argparse.Namespace(db_command="upgrade", revision="head")) == 0
    assert db.main(argparse.Namespace(db_command="downgrade", revision="-1")) == 0
    assert (
        db.main(argparse.Namespace(db_command="revision", message="add widgets")) == 0
    )
    assert calls == [
        ["current"],
        ["upgrade", "head"],
        ["downgrade", "-1"],
        ["revision", "--autogenerate", "-m", "add widgets"],
    ]
