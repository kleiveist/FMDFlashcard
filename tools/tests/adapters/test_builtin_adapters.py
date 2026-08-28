from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.adapters import (
    BackendAdapter,
    CiAdapter,
    ContainerAdapter,
    DatabaseAdapter,
    DocumentationAdapter,
    FrontendAdapter,
    QualityAdapter,
    ReleaseAdapter,
    TauriAdapter,
)
from tools.adapters import (
    TestingAdapter as ToolingTestingAdapter,
)
from tools.core.context import ProjectContext
from tools.integration.model import FindingStatus, OperationKind, Ownership


def test_builtin_adapters_use_configured_context_paths(
    adapter_context: ProjectContext,
) -> None:
    expected = {
        "frontend": (
            "ui",
            "ui/package.json",
            "ui/vite.config.cjs",
            "ui/vite.config.cts",
            "ui/vite.config.js",
            "ui/vite.config.mjs",
            "ui/vite.config.mts",
            "ui/vite.config.ts",
        ),
        "backend": (
            "services/api",
            "services/api/app/main.py",
            "services/api/main.py",
            "services/api/pyproject.toml",
            "services/api/requirements.txt",
        ),
        "tauri": (
            "desktop/shell",
            "desktop/shell/Cargo.toml",
            "desktop/shell/tauri.conf.json",
        ),
        "database": ("services/api/alembic", "services/api/alembic.ini"),
        "documentation": ("handbook/toolingdocs",),
    }
    adapters = (
        FrontendAdapter(),
        BackendAdapter(),
        TauriAdapter(),
        DatabaseAdapter(),
        DocumentationAdapter(),
    )

    assert {
        adapter.name: tuple(
            resource.path for resource in adapter.detect(adapter_context).resources
        )
        for adapter in adapters
    } == expected


def test_technology_markers_drive_read_only_detection(
    adapter_context: ProjectContext,
) -> None:
    adapters = (
        FrontendAdapter(),
        BackendAdapter(),
        TauriAdapter(),
        DatabaseAdapter(),
        ContainerAdapter(),
    )
    assert all(not adapter.detect(adapter_context).detected for adapter in adapters)

    (adapter_context.paths.frontend).mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        "{}\n", encoding="utf-8"
    )
    assert not FrontendAdapter().detect(adapter_context).detected
    (adapter_context.paths.frontend / "vite.config.ts").write_text(
        "export default {}\n", encoding="utf-8"
    )
    assert adapter_context.paths.backend is not None
    adapter_context.paths.backend.mkdir(parents=True)
    (adapter_context.paths.backend / "requirements.txt").write_text(
        "fastapi\n", encoding="utf-8"
    )
    assert not BackendAdapter().detect(adapter_context).detected
    (adapter_context.paths.backend / "app").mkdir()
    (adapter_context.paths.backend / "app" / "main.py").write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n", encoding="utf-8"
    )
    (adapter_context.paths.backend / "alembic").mkdir()
    adapter_context.paths.tauri.mkdir(parents=True)
    (adapter_context.paths.tauri / "Cargo.toml").write_text(
        "[package]\nname = 'fixture'\n", encoding="utf-8"
    )
    assert not TauriAdapter().detect(adapter_context).detected
    (adapter_context.paths.tauri / "tauri.conf.json").write_text(
        "{}\n", encoding="utf-8"
    )
    (adapter_context.project_root / "deployment").mkdir()
    (adapter_context.project_root / "deployment" / "compose.yaml").write_text(
        "services: {}\n", encoding="utf-8"
    )

    assert all(adapter.detect(adapter_context).detected for adapter in adapters)


def test_wrong_marker_kind_is_not_detected(adapter_context: ProjectContext) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").mkdir()

    detection = FrontendAdapter().detect(adapter_context)
    plan = FrontendAdapter().plan(
        adapter_context,
        type(
            "Desired",
            (),
            {"profile": "fixture", "features": ("frontend",)},
        )(),
    )

    assert not detection.detected
    assert plan.operations == ()
    assert {item.code for item in plan.conflicts} == {"adapter-path-kind"}
    assert {item.ownership for item in plan.conflicts} == {Ownership.STRUCTURED}
    assert not FrontendAdapter().verify(adapter_context).ok


def test_configless_vite_is_detected_from_package_content(
    adapter_context: ProjectContext,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        '{"devDependencies":{"vite":"^7.0.0"}}\n',
        encoding="utf-8",
    )

    assert FrontendAdapter().detect(adapter_context).detected


def test_arbitrary_script_mention_does_not_detect_vite(
    adapter_context: ProjectContext,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        '{"scripts":{"test":"echo vite"}}\n',
        encoding="utf-8",
    )

    assert not FrontendAdapter().detect(adapter_context).detected


def test_frontend_adds_only_missing_scripts_for_declared_tools(
    adapter_context: ProjectContext,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    package = {
        "name": "customer-ui",
        "scripts": {
            "dev": "customer-dev-server",
            "foreign": "keep-me",
            "lint": "customer-lint",
        },
        "dependencies": {
            "@playwright/test": "^1.0.0",
            "typescript": "^5.0.0",
            "vite": "^7.0.0",
        },
        "devDependencies": {
            "@tauri-apps/cli": "^2.0.0",
            "eslint": "^9.0.0",
            "prettier": "^3.0.0",
            "vitest": "^3.0.0",
        },
        "x-customer": {"preserve": True},
    }
    package_path = adapter_context.paths.frontend / "package.json"
    package_path.write_text(json.dumps(package), encoding="utf-8")

    plan = FrontendAdapter().plan(
        adapter_context,
        type(
            "Desired",
            (),
            {"profile": "fixture", "features": ("frontend",)},
        )(),
    )

    assert not plan.conflicts
    assert len(plan.operations) == 1
    operation = plan.operations[0]
    assert operation.kind is OperationKind.PATCH
    assert operation.path == "ui/package.json"
    assert operation.ownership is Ownership.STRUCTURED
    assert {change.key: change.value for change in operation.structured_changes} == {
        "scripts.build": "vite build",
        "scripts.format:check": "prettier --check .",
        "scripts.tauri": "tauri",
        "scripts.test": "vitest run",
        "scripts.test:e2e": "playwright test",
        "scripts.typecheck": "tsc --noEmit",
    }
    assert all(
        change.key not in {"scripts.dev", "scripts.lint"}
        for change in operation.structured_changes
    )


def test_vite_config_without_declared_vite_never_adds_broken_scripts(
    adapter_context: ProjectContext,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        '{"name":"customer-ui"}\n', encoding="utf-8"
    )
    (adapter_context.paths.frontend / "vite.config.ts").write_text(
        "export default {}\n", encoding="utf-8"
    )

    plan = FrontendAdapter().plan(
        adapter_context,
        type(
            "Desired",
            (),
            {"profile": "fixture", "features": ("frontend",)},
        )(),
    )

    assert plan.operations == ()


def test_existing_frontend_script_values_are_never_overwritten(
    adapter_context: ProjectContext,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        json.dumps(
            {
                "scripts": {"build": "custom-build", "dev": "custom-dev"},
                "devDependencies": {"vite": "^7.0.0"},
            }
        ),
        encoding="utf-8",
    )

    plan = FrontendAdapter().plan(
        adapter_context,
        type(
            "Desired",
            (),
            {"profile": "fixture", "features": ("frontend",)},
        )(),
    )

    assert plan.is_noop


@pytest.mark.parametrize(
    ("payload", "expected_code"),
    (
        ("{not-json", "adapter-structured-json"),
        ('{"name":"first","name":"second"}', "adapter-structured-json"),
        ('{"custom":NaN}', "adapter-structured-json"),
        ("[]", "adapter-structured-shape"),
        ('{"scripts":"npm test"}', "adapter-structured-shape"),
        ('{"dependencies":[]}', "adapter-structured-shape"),
        ('{"dependencies":{"vite":false}}', "adapter-structured-shape"),
        ('{"dependencies":{"vite":null}}', "adapter-structured-shape"),
        ('{"dependencies":{"vite":{}}}', "adapter-structured-shape"),
        ('{"dependencies":{"vite":""}}', "adapter-structured-shape"),
    ),
)
def test_invalid_frontend_package_shapes_fail_closed(
    adapter_context: ProjectContext,
    payload: str,
    expected_code: str,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    (adapter_context.paths.frontend / "package.json").write_text(
        payload, encoding="utf-8"
    )

    adapter = FrontendAdapter()
    plan = adapter.plan(
        adapter_context,
        type(
            "Desired",
            (),
            {"profile": "fixture", "features": ("frontend",)},
        )(),
    )

    assert plan.operations == ()
    assert {conflict.code for conflict in plan.conflicts} == {expected_code}
    assert not adapter.verify(adapter_context).ok


def test_frontend_package_symlink_fails_closed_without_following_it(
    adapter_context: ProjectContext,
    tmp_path: Path,
) -> None:
    adapter_context.paths.frontend.mkdir(parents=True)
    external = tmp_path.parent / f"{tmp_path.name}-external-package.json"
    external.write_text(
        '{"devDependencies":{"vite":"secret-version"}}', encoding="utf-8"
    )
    (adapter_context.paths.frontend / "package.json").symlink_to(external)

    adapter = FrontendAdapter()
    detection = adapter.detect(adapter_context)
    plan = adapter.plan(
        adapter_context,
        type(
            "Desired",
            (),
            {"profile": "fixture", "features": ("frontend",)},
        )(),
    )

    package = next(
        resource
        for resource in detection.resources
        if resource.path == "ui/package.json"
    )
    assert package.is_symlink
    assert package.sha256 is None
    assert plan.operations == ()
    assert {conflict.code for conflict in plan.conflicts} == {"adapter-path-safety"}


def test_fastapi_requires_source_and_dependency_evidence(
    adapter_context: ProjectContext,
) -> None:
    assert adapter_context.paths.backend is not None
    backend = adapter_context.paths.backend
    (backend / "app").mkdir(parents=True)
    (backend / "app" / "main.py").write_text("app = object()\n", encoding="utf-8")
    (backend / "requirements.txt").write_text("fastapi\n", encoding="utf-8")
    adapter = BackendAdapter()

    assert not adapter.detect(adapter_context).detected

    (backend / "app" / "main.py").write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n",
        encoding="utf-8",
    )
    assert adapter.detect(adapter_context).detected


def test_missing_product_paths_are_informational_and_never_planned_as_fixes(
    adapter_context: ProjectContext,
) -> None:
    adapters = (
        FrontendAdapter(),
        BackendAdapter(),
        TauriAdapter(),
        DatabaseAdapter(),
        ContainerAdapter(),
    )

    for adapter in adapters:
        desired_features = adapter.feature_ids or (adapter.name,)
        plan = adapter.plan(
            adapter_context,
            type(
                "Desired",
                (),
                {"profile": "fixture", "features": tuple(desired_features)},
            )(),
        )
        result = adapter.verify(adapter_context)

        assert plan.is_noop, adapter.name
        assert result.ok, adapter.name
        assert all(
            finding.status in {FindingStatus.INFO, FindingStatus.PASS}
            for finding in result.findings
        ), adapter.name


def test_core_adapters_verify_only_their_portable_owned_paths(
    adapter_context: ProjectContext,
) -> None:
    adapters = (
        QualityAdapter(),
        ToolingTestingAdapter(),
        DocumentationAdapter(),
        CiAdapter(),
        ReleaseAdapter(),
    )

    results = {adapter.name: adapter.verify(adapter_context) for adapter in adapters}

    assert all(result.ok for result in results.values())
    assert tuple(item.path for item in results["quality"].findings) == (
        "tools/quality",
    )
    assert tuple(item.path for item in results["testing"].findings) == ("tools/tests",)
    assert tuple(item.path for item in results["documentation"].findings) == (
        "handbook/toolingdocs",
    )
    assert tuple(item.path for item in results["release"].findings) == (
        "tools/VERSION",
    )
    assert results["ci"].findings[0].status is FindingStatus.INFO
