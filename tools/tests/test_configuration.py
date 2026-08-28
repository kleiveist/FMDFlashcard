from __future__ import annotations

from pathlib import Path

import pytest

from tools import control
from tools.config import (
    ConfigLoadError,
    ConfigValidationError,
    load_contract,
    load_runtime_config,
    mask_config_value,
    redact_text,
    render_env_example,
    resolve_configuration,
    validate_configuration,
)
from tools.core.context import load_context
from tools.inst import configuration, install
from tools.profiles.loader import load_active_profile, load_catalog
from tools.profiles.model import ProjectProfile

CONTEXT = load_context()
CONTRACT = load_contract(context=CONTEXT)


def _profile(*features: str) -> ProjectProfile:
    return ProjectProfile(
        schema_version=1,
        profile_id="test-profile",
        name="Test profile",
        description="Configuration test profile",
        features=features,
    )


def test_runtime_config_uses_profile_aware_defaults(tmp_path: Path) -> None:
    config = load_runtime_config(
        _profile("frontend"),
        project_root=tmp_path,
        environ={},
        contract=CONTRACT,
    )

    assert config.app_env == "development"
    assert config.frontend_host == "127.0.0.1"
    assert config.frontend_port == 5173
    assert config.backend_host is None
    assert config.database_url is None


def test_contract_feature_references_exist_in_profile_catalog() -> None:
    catalog = load_catalog(context=CONTEXT)
    referenced = {feature for variable in CONTRACT.variables for feature in variable.required_features}

    assert referenced <= set(catalog.features)


def test_contract_rejects_public_secret_variable(tmp_path: Path) -> None:
    contract_path = tmp_path / "environment.toml"
    contract_path.write_text(
        """schema_version = 1

[[variables]]
name = "VITE_SECRET_KEY"
section = "Unsafe"
description = "Must be rejected"
scope = "public-client"
kind = "string"
example = "change-me"
required_features = []
secret = true
""",
        encoding="utf-8",
    )

    with pytest.raises(ConfigLoadError, match="must not use the public VITE_ prefix"):
        load_contract(contract_path)


@pytest.mark.parametrize(
    ("definition", "message"),
    [
        (
            'name = "invalid_name"\nscope = "runtime"\nkind = "string"',
            "must use UPPER_SNAKE_CASE",
        ),
        (
            'name = "APP_NAME"\nscope = "runtime"\nkind = "unsupported"',
            "unsupported kind",
        ),
        (
            'name = "APP_NAME"\nscope = "runtime"\nkind = "string"\nderived = "unsupported"',
            "unsupported derivation",
        ),
        (
            'name = "AUTH_TOKEN"\nscope = "runtime"\nkind = "string"',
            "must be marked secret",
        ),
        (
            'name = "PUBLIC_URL"\nscope = "public-client"\nkind = "string"',
            "must use the VITE_ prefix",
        ),
    ],
)
def test_contract_rejects_invalid_variable_constraints(
    tmp_path: Path,
    definition: str,
    message: str,
) -> None:
    contract_path = tmp_path / "environment.toml"
    contract_path.write_text(
        f"""schema_version = 1

[[variables]]
{definition}
section = "Test"
description = "Invalid test definition"
required_features = []
""",
        encoding="utf-8",
    )

    with pytest.raises(ConfigLoadError, match=message):
        load_contract(contract_path)


def test_dotenv_overrides_defaults(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text(
        "APP_ENV=test\nFRONTEND_HOST=localhost\nFRONTEND_PORT=5174\n",
        encoding="utf-8",
    )

    config = load_runtime_config(
        _profile("frontend"),
        project_root=tmp_path,
        environ={},
        contract=CONTRACT,
    )

    assert config.app_env == "test"
    assert config.frontend_host == "localhost"
    assert config.frontend_port == 5174
    assert config.source_for("FRONTEND_PORT") == "local .env"


def test_install_never_creates_or_overwrites_dotenv(monkeypatch, tmp_path: Path) -> None:
    (tmp_path / ".env.example").write_text("APP_ENV=development\n", encoding="utf-8")
    monkeypatch.setattr(install, "ROOT", tmp_path)

    result = install._ensure_env_file()

    assert result.status == "WARN"
    assert not (tmp_path / ".env").exists()


def test_process_environment_overrides_dotenv(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("BACKEND_PORT=8100\n", encoding="utf-8")

    config = load_runtime_config(
        _profile("frontend", "backend"),
        project_root=tmp_path,
        environ={"BACKEND_PORT": "8200"},
        contract=CONTRACT,
    )

    assert config.backend_port == 8200
    assert config.vite_api_base_url == "http://127.0.0.1:8200"
    assert config.source_for("BACKEND_PORT") == "process environment"


def test_legacy_cors_name_maps_to_canonical_setting(tmp_path: Path) -> None:
    config = load_runtime_config(
        _profile("frontend", "backend"),
        project_root=tmp_path,
        environ={"CORS_ORIGINS": "http://localhost:5174"},
        contract=CONTRACT,
    )

    assert config.backend_cors_origins == ("http://localhost:5174",)
    assert "legacy alias CORS_ORIGINS" in config.source_for("BACKEND_CORS_ORIGINS")


def test_cli_override_has_highest_priority(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("BACKEND_PORT=8100\n", encoding="utf-8")

    config = load_runtime_config(
        _profile("frontend", "backend"),
        project_root=tmp_path,
        environ={"BACKEND_PORT": "8200"},
        cli_overrides={"BACKEND_PORT": 9000},
        contract=CONTRACT,
    )

    assert config.backend_port == 9000
    assert config.vite_api_base_url == "http://127.0.0.1:9000"
    assert config.source_for("BACKEND_PORT") == "CLI override"


def test_frontend_port_override_updates_default_cors_origins(tmp_path: Path) -> None:
    config = load_runtime_config(
        _profile("frontend", "backend"),
        project_root=tmp_path,
        environ={},
        cli_overrides={"FRONTEND_PORT": 5174},
        contract=CONTRACT,
    )

    assert "http://127.0.0.1:5174" in config.backend_cors_origins
    assert "http://localhost:5174" in config.backend_cors_origins
    assert config.source_for("BACKEND_CORS_ORIGINS") == "derived from frontend host and port"


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("APP_ENV", "staging", "development, test, or production"),
        ("FRONTEND_PORT", "0", "between 1 and 65535"),
        ("BACKEND_PORT", "invalid", "must be an integer"),
    ],
)
def test_invalid_configuration_is_rejected(
    tmp_path: Path,
    name: str,
    value: str,
    message: str,
) -> None:
    profile = _profile("frontend", "backend")

    with pytest.raises(ConfigValidationError, match=message):
        load_runtime_config(
            profile,
            project_root=tmp_path,
            environ={name: value},
            contract=CONTRACT,
        )


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("BACKEND_HOST", "bad host", "valid IP address or host name"),
        ("VITE_API_BASE_URL", "ftp://example.test", "HTTP(S) URL"),
        ("BACKEND_CORS_ORIGINS", "*", "explicit HTTP(S) or Tauri origins"),
        ("DATABASE_URL", "postgresql://localhost/app", "postgresql+psycopg"),
    ],
)
def test_configuration_kind_validation_reports_the_variable(
    tmp_path: Path,
    name: str,
    value: str,
    message: str,
) -> None:
    environ = {"DATABASE_URL": "postgresql+psycopg://localhost/app", name: value}
    resolved = resolve_configuration(
        _profile("frontend", "backend", "postgres"),
        project_root=tmp_path,
        environ=environ,
        contract=CONTRACT,
    )

    issues = validate_configuration(resolved)

    assert any(issue.name == name and message in issue.message for issue in issues)


def test_postgres_requires_database_url(tmp_path: Path) -> None:
    resolved = resolve_configuration(
        _profile("frontend", "backend", "database", "postgres"),
        project_root=tmp_path,
        environ={},
        contract=CONTRACT,
    )

    issues = validate_configuration(resolved)

    assert any(issue.name == "DATABASE_URL" and "not set" in issue.message for issue in issues)


def test_secret_masking_hides_urls_and_plain_secret_values() -> None:
    database_url = "postgresql+psycopg://app:p%40ss@localhost:5432/app"

    assert mask_config_value("DATABASE_URL", database_url) == ("postgresql+psycopg://app:***@localhost:5432/app")
    assert mask_config_value("AUTH_TOKEN", "token-value") == "<redacted>"
    detail = redact_text(
        f"connection {database_url} failed with password p@ss",
        {"DATABASE_URL": database_url},
    )
    assert "p%40ss" not in detail
    assert "p@ss" not in detail


def test_frontend_environment_never_contains_database_secret(tmp_path: Path) -> None:
    config = load_runtime_config(
        _profile("frontend", "backend", "database", "postgres"),
        project_root=tmp_path,
        environ={"DATABASE_URL": "postgresql+psycopg://app:secret@localhost:5432/app"},
        contract=CONTRACT,
    )

    assert "DATABASE_URL" not in config.frontend_environment()
    assert config.backend_environment()["DATABASE_URL"].endswith("@localhost:5432/app")


@pytest.mark.parametrize(
    ("features", "included", "excluded"),
    [
        (
            ("frontend",),
            {"APP_ENV", "FRONTEND_HOST", "FRONTEND_PORT"},
            {"BACKEND_HOST", "DATABASE_URL"},
        ),
        (
            ("frontend", "backend", "cloud"),
            {"BACKEND_HOST", "BACKEND_PORT", "VITE_API_BASE_URL"},
            {"DATABASE_URL"},
        ),
        (
            ("frontend", "backend", "cloud", "database", "postgres"),
            {"BACKEND_HOST", "VITE_API_BASE_URL", "DATABASE_URL"},
            set(),
        ),
        (
            ("frontend", "tauri"),
            {"FRONTEND_HOST"},
            {"BACKEND_HOST", "VITE_API_BASE_URL", "DATABASE_URL"},
        ),
        (
            ("frontend", "backend", "tauri", "cloud"),
            {"BACKEND_HOST", "VITE_API_BASE_URL"},
            {"DATABASE_URL"},
        ),
    ],
)
def test_env_example_rendering_follows_features(
    features: tuple[str, ...],
    included: set[str],
    excluded: set[str],
) -> None:
    rendered = render_env_example(CONTRACT, features)

    assert all(f"{name}=" in rendered for name in included)
    assert all(f"{name}=" not in rendered for name in excluded)


def test_default_contract_and_active_profile_use_portable_context() -> None:
    active = load_active_profile(context=CONTEXT)

    assert CONTRACT == load_contract(CONTEXT.resources.config / "environment.toml")
    assert active.profile_id == CONTEXT.config.profile
    assert active.optional_features == CONTEXT.config.optional_features


def test_config_show_masks_database_url(monkeypatch, capsys) -> None:
    profile = _profile("frontend", "backend", "database", "postgres")
    monkeypatch.setattr(configuration.profile_runtime, "active_profile", lambda _root: profile)
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app:secret@localhost:5432/app")

    assert control.main(["config", "show"]) == 0

    output = capsys.readouterr().out
    assert "postgresql+psycopg://app:***@localhost:5432/app" in output
    assert "secret" not in output
