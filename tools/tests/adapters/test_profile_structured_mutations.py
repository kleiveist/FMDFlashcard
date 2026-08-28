from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest
import tomllib

from tools.adapters import (
    DEFAULT_REGISTRY,
    Adapter,
    BackendAdapter,
    FrontendAdapter,
    TauriAdapter,
)
from tools.adapters.base import AdapterDesiredState
from tools.adapters.registry import AdapterRegistry
from tools.core.context import ProjectContext
from tools.integration.model import OperationKind, VerificationResult
from tools.integration.transaction import apply_plan
from tools.profiles.loader import load_catalog, resolve_profile

_PROFILE_POLICIES = {
    "web-only": {"ui/package.json"},
    "web-cloud": {"services/api/pyproject.toml", "ui/package.json"},
    "desktop-local": {
        "desktop/shell/Cargo.toml",
        "desktop/shell/tauri.conf.json",
        "ui/package.json",
    },
    "desktop-cloud": {
        "desktop/shell/Cargo.toml",
        "desktop/shell/tauri.conf.json",
        "services/api/pyproject.toml",
        "ui/package.json",
    },
    "full-platform": {
        "desktop/shell/Cargo.toml",
        "desktop/shell/tauri.conf.json",
        "services/api/pyproject.toml",
        "ui/package.json",
    },
}


def _profile_context(context: ProjectContext, profile: str) -> ProjectContext:
    return context.with_config(replace(context.config, profile=profile))


def _structured_adapters() -> tuple[AdapterRegistry, tuple[Adapter, ...]]:
    adapters = (BackendAdapter(), FrontendAdapter(), TauriAdapter())
    return AdapterRegistry(adapters), adapters


@pytest.mark.parametrize("profile_id", tuple(_PROFILE_POLICIES))
def test_every_profile_selects_concrete_structured_mutation_targets(
    adapter_context: ProjectContext,
    profile_id: str,
) -> None:
    profiles_root = Path(__file__).resolve().parents[2] / "resources" / "profiles"
    catalog = load_catalog(profiles_root)
    profile = resolve_profile(catalog, profile_id)
    context = _profile_context(adapter_context, profile_id)

    selected = DEFAULT_REGISTRY.select_for_profile(profile, catalog)
    policy = DEFAULT_REGISTRY.structured_key_allowlist(context, selected)

    assert set(policy) == _PROFILE_POLICIES[profile_id]
    if "services/api/pyproject.toml" in policy:
        assert policy["services/api/pyproject.toml"] == frozenset(
            {"tool.template_tooling.profile"}
        )
    if "desktop/shell/Cargo.toml" in policy:
        assert policy["desktop/shell/Cargo.toml"] == frozenset(
            {"package.metadata.template_tooling.profile"}
        )
    if "desktop/shell/tauri.conf.json" in policy:
        assert policy["desktop/shell/tauri.conf.json"] == frozenset(
            {"build.beforeBuildCommand"}
        )


@pytest.mark.parametrize("profile_id", tuple(_PROFILE_POLICIES))
def test_every_profile_plans_its_missing_structured_values(
    adapter_context: ProjectContext,
    profile_id: str,
) -> None:
    profiles_root = Path(__file__).resolve().parents[2] / "resources" / "profiles"
    catalog = load_catalog(profiles_root)
    profile = resolve_profile(catalog, profile_id)
    context = _profile_context(adapter_context, profile_id)

    context.paths.frontend.mkdir(parents=True)
    (context.paths.frontend / "package.json").write_text(
        '{"devDependencies":{"vite":"^7.0.0"}}\n',
        encoding="utf-8",
    )
    if "backend" in profile.features:
        assert context.paths.backend is not None
        backend = context.paths.backend
        (backend / "app").mkdir(parents=True)
        (backend / "app" / "main.py").write_text(
            "from fastapi import FastAPI\napp = FastAPI()\n",
            encoding="utf-8",
        )
        (backend / "requirements.txt").write_text("fastapi\n", encoding="utf-8")
        (backend / "pyproject.toml").write_text(
            "[tool.template_tooling]\nenabled = true\n",
            encoding="utf-8",
        )
    if "tauri" in profile.features:
        tauri = context.paths.tauri
        tauri.mkdir(parents=True)
        (tauri / "Cargo.toml").write_text(
            '[package.metadata.template_tooling]\nchannel = "stable"\n',
            encoding="utf-8",
        )
        (tauri / "tauri.conf.json").write_text(
            '{"build":{"frontendDist":"../ui/dist"}}\n',
            encoding="utf-8",
        )

    registry, adapters = _structured_adapters()
    plan = registry.plan(
        context,
        AdapterDesiredState(profile.profile_id, profile.features),
        adapters,
    )

    assert not plan.conflicts
    assert {operation.path for operation in plan.operations} == _PROFILE_POLICIES[
        profile_id
    ]


def test_full_profile_adds_missing_allowlisted_values_and_preserves_foreign_content(
    adapter_context: ProjectContext,
) -> None:
    context = _profile_context(adapter_context, "full-platform")
    assert context.paths.backend is not None

    frontend = context.paths.frontend
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text(
        json.dumps(
            {
                "name": "customer-ui",
                "scripts": {"customer": "customer-command"},
                "devDependencies": {"vite": "^7.0.0"},
                "x-customer": {"keep": True},
            }
        ),
        encoding="utf-8",
    )

    backend = context.paths.backend
    (backend / "app").mkdir(parents=True)
    (backend / "app" / "main.py").write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n",
        encoding="utf-8",
    )
    (backend / "requirements.txt").write_text("fastapi>=0.116\n", encoding="utf-8")
    pyproject = backend / "pyproject.toml"
    pyproject_before = (
        "# customer-maintained header\n"
        "[project]\n"
        'name = "customer-api"\n'
        "\n"
        "[tool.template_tooling]\n"
        "enabled = true  # preserve this setting\n"
        "\n"
        "[tool.ruff]\n"
        "line-length = 99\n"
    )
    pyproject.write_text(pyproject_before, encoding="utf-8")

    tauri = context.paths.tauri
    tauri.mkdir(parents=True)
    cargo = tauri / "Cargo.toml"
    cargo_before = (
        "[package]\n"
        'name = "customer-desktop"\n'
        'version = "0.1.0"\n'
        "\n"
        "[package.metadata.template_tooling]\n"
        'channel = "customer"  # keep this metadata\n'
        "\n"
        "[dependencies]\n"
        'tauri = "2"\n'
    )
    cargo.write_text(cargo_before, encoding="utf-8")
    tauri_config = tauri / "tauri.conf.json"
    tauri_config.write_text(
        json.dumps(
            {
                "build": {"frontendDist": "../ui/dist"},
                "app": {"windows": [{"title": "Customer"}]},
                "x-customer": {"keep": True},
            }
        ),
        encoding="utf-8",
    )

    registry, adapters = _structured_adapters()
    desired = AdapterDesiredState(
        "full-platform",
        ("backend", "cloud", "frontend", "tauri"),
    )
    plan = registry.plan(context, desired, adapters)

    assert not plan.conflicts
    assert [operation.path for operation in plan.operations] == [
        "desktop/shell/Cargo.toml",
        "desktop/shell/tauri.conf.json",
        "services/api/pyproject.toml",
        "ui/package.json",
    ]
    assert all(operation.kind is OperationKind.PATCH for operation in plan.operations)
    changes = {
        operation.path: {change.key: change for change in operation.structured_changes}
        for operation in plan.operations
    }
    assert set(changes["services/api/pyproject.toml"]) == {
        "tool.template_tooling.profile"
    }
    assert set(changes["desktop/shell/Cargo.toml"]) == {
        "package.metadata.template_tooling.profile"
    }
    assert set(changes["desktop/shell/tauri.conf.json"]) == {"build.beforeBuildCommand"}
    assert all(
        not change.has_expected_value
        for path in (
            "services/api/pyproject.toml",
            "desktop/shell/Cargo.toml",
            "desktop/shell/tauri.conf.json",
        )
        for change in changes[path].values()
    )

    policy = registry.structured_key_allowlist(context, adapters)
    result = apply_plan(
        context.project_root,
        plan,
        verifier=lambda _root: VerificationResult(()),
        structured_key_allowlist=policy,
    )

    assert result.ok
    package = json.loads((frontend / "package.json").read_text(encoding="utf-8"))
    assert package["x-customer"] == {"keep": True}
    assert package["scripts"] == {
        "build": "vite build",
        "customer": "customer-command",
        "dev": "vite",
    }

    pyproject_payload = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    assert pyproject_payload["tool"]["template_tooling"] == {
        "enabled": True,
        "profile": "full-platform",
    }
    assert pyproject_payload["tool"]["ruff"] == {"line-length": 99}
    assert "# customer-maintained header" in pyproject.read_text(encoding="utf-8")
    assert "# preserve this setting" in pyproject.read_text(encoding="utf-8")

    cargo_payload = tomllib.loads(cargo.read_text(encoding="utf-8"))
    assert cargo_payload["package"]["metadata"]["template_tooling"] == {
        "channel": "customer",
        "profile": "full-platform",
    }
    assert cargo_payload["dependencies"] == {"tauri": "2"}
    assert "# keep this metadata" in cargo.read_text(encoding="utf-8")

    tauri_payload = json.loads(tauri_config.read_text(encoding="utf-8"))
    assert tauri_payload["build"] == {
        "beforeBuildCommand": "npm run build",
        "frontendDist": "../ui/dist",
    }
    assert tauri_payload["app"] == {"windows": [{"title": "Customer"}]}
    assert tauri_payload["x-customer"] == {"keep": True}
    assert registry.plan(context, desired, adapters).is_noop


def test_nonlegacy_user_values_are_not_overwritten(
    adapter_context: ProjectContext,
) -> None:
    context = _profile_context(adapter_context, "desktop-cloud")
    assert context.paths.backend is not None

    frontend = context.paths.frontend
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text(
        json.dumps(
            {
                "scripts": {"build": "customer-build", "dev": "customer-dev"},
                "devDependencies": {"vite": "^7.0.0"},
            }
        ),
        encoding="utf-8",
    )

    backend = context.paths.backend
    (backend / "app").mkdir(parents=True)
    (backend / "app" / "main.py").write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n",
        encoding="utf-8",
    )
    (backend / "requirements.txt").write_text("fastapi\n", encoding="utf-8")
    (backend / "pyproject.toml").write_text(
        '[tool.template_tooling]\nprofile = "customer-profile"\n',
        encoding="utf-8",
    )

    tauri = context.paths.tauri
    tauri.mkdir(parents=True)
    (tauri / "Cargo.toml").write_text(
        '[package.metadata.template_tooling]\nprofile = "customer-profile"\n',
        encoding="utf-8",
    )
    (tauri / "tauri.conf.json").write_text(
        '{"build":{"beforeBuildCommand":"pnpm run build"},"x-customer":true}\n',
        encoding="utf-8",
    )

    registry, adapters = _structured_adapters()
    plan = registry.plan(
        context,
        AdapterDesiredState("desktop-cloud", ("backend", "frontend", "tauri")),
        adapters,
    )

    assert plan.is_noop


def test_invalid_backend_toml_fails_closed(
    adapter_context: ProjectContext,
) -> None:
    assert adapter_context.paths.backend is not None
    backend = adapter_context.paths.backend
    (backend / "app").mkdir(parents=True)
    (backend / "app" / "main.py").write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n",
        encoding="utf-8",
    )
    (backend / "requirements.txt").write_text("fastapi\n", encoding="utf-8")
    (backend / "pyproject.toml").write_text(
        '[tool.template_tooling\nprofile = "legacy"\n',
        encoding="utf-8",
    )

    adapter = BackendAdapter()
    plan = adapter.plan(
        adapter_context,
        AdapterDesiredState("web-cloud", ("backend",)),
    )

    assert plan.operations == ()
    assert {conflict.code for conflict in plan.conflicts} == {"adapter-structured-toml"}
    assert not adapter.verify(adapter_context).ok
