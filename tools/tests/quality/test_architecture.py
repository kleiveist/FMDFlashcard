from __future__ import annotations

from pathlib import Path

import pytest

from tools.quality.architecture import architecture_result
from tools.quality.model import QualityConfig
from tools.quality.scanner import scan_repository
from tools.quality.typescript import TypeScriptAnalysis, TypeScriptImport


def _write(root: Path, relative: str, text: str = "export {};\n") -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def _rule_ids(result) -> list[str]:
    return [finding.rule.rule_id for finding in result.findings]


def _backend_result(root: Path, config: QualityConfig):
    metrics = scan_repository(root, config)
    return architecture_result(root, config, metrics, TypeScriptAnalysis((), ()))


def _frontend_result(
    root: Path,
    config: QualityConfig,
    edges: list[TypeScriptImport],
):
    return architecture_result(
        root,
        config,
        scan_repository(root, config),
        TypeScriptAnalysis((), tuple(edges)),
    )


def test_backend_documented_dependency_direction_passes(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(
        tmp_path,
        "backend/app/api/orders.py",
        "from app.services.orders import list_orders\n",
    )
    _write(
        tmp_path,
        "backend/app/services/orders.py",
        "from app.domain.orders import Order\n\ndef list_orders():\n    return []\n",
    )
    _write(
        tmp_path,
        "backend/app/domain/orders.py",
        "from dataclasses import dataclass\n\n@dataclass\nclass Order:\n    name: str\n",
    )
    _write(
        tmp_path,
        "backend/app/db/orders.py",
        "from app.domain.orders import Order\n",
    )
    _write(
        tmp_path,
        "backend/app/main.py",
        "from app.api import orders\nfrom app.db import orders as order_repository\n",
    )

    result = _backend_result(tmp_path, quality_config)

    assert result.findings == []
    assert result.status == "PASS"


@pytest.mark.parametrize(
    ("relative", "source", "edge"),
    [
        (
            "backend/app/api/routes.py",
            "from app.db import repository\n",
            "api->infrastructure",
        ),
        (
            "backend/app/services/orders.py",
            "from app.db import repository\n",
            "application->infrastructure",
        ),
        ("backend/app/domain/orders.py", "from app.api import routes\n", "domain->api"),
        (
            "backend/app/domain/orders.py",
            "from app.services import orders\n",
            "domain->application",
        ),
        (
            "backend/app/domain/orders.py",
            "from app.db import repository\n",
            "domain->infrastructure",
        ),
        (
            "backend/app/db/repository.py",
            "from app.api import routes\n",
            "infrastructure->api",
        ),
        (
            "backend/app/db/repository.py",
            "from app.services import orders\n",
            "infrastructure->application",
        ),
    ],
)
def test_backend_invalid_layer_dependencies_are_ar001_errors(
    tmp_path: Path,
    quality_config: QualityConfig,
    relative: str,
    source: str,
    edge: str,
) -> None:
    _write(tmp_path, relative, source)

    result = _backend_result(tmp_path, quality_config)
    finding = next(item for item in result.findings if item.rule.rule_id == "AR001")

    assert finding.actual == edge
    assert finding.severity.name == "ERROR"


def test_relative_and_lazy_backend_imports_are_checked(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(
        tmp_path,
        "backend/app/services/orders.py",
        "def load_orders():\n    from ..db import repository\n    return repository.load()\n",
    )

    result = _backend_result(tmp_path, quality_config)

    assert "AR001" in _rule_ids(result)
    assert result.findings[0].line == 2


@pytest.mark.parametrize(
    "source",
    [
        "import backend.app.db.repository\n",
        "from backend.app import db\n",
    ],
)
def test_package_qualified_backend_imports_follow_the_same_layer_rules(
    tmp_path: Path,
    quality_config: QualityConfig,
    source: str,
) -> None:
    _write(tmp_path, "backend/app/domain/orders.py", source)

    result = _backend_result(tmp_path, quality_config)
    finding = next(item for item in result.findings if item.rule.rule_id == "AR001")

    assert finding.actual == "domain->infrastructure"
    assert finding.line == 1


def test_allowed_package_qualified_backend_import_stays_valid(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(tmp_path, "backend/app/services/orders.py", "import backend.app.domain.orders\n")

    assert _backend_result(tmp_path, quality_config).findings == []


@pytest.mark.parametrize(
    "source",
    [
        'import importlib\nrepository = importlib.import_module("app.db.repository")\n',
        'import importlib.util\nrepository = importlib.import_module("app.db.repository")\n',
        'import importlib as loader\nrepository = loader.import_module("app.db.repository")\n',
        'from importlib import import_module as load\nrepository = load("app.db.repository")\n',
        'import importlib\nload = importlib.import_module\nrepository = load("app.db.repository")\n',
        'import importlib\nrepository = importlib.import_module("..db.repository", package=__package__)\n',
        'repository = __import__("app.db.repository", fromlist=["repository"])\n',
    ],
)
def test_literal_dynamic_backend_imports_are_checked(
    tmp_path: Path,
    quality_config: QualityConfig,
    source: str,
) -> None:
    _write(tmp_path, "backend/app/domain/orders.py", source)

    result = _backend_result(tmp_path, quality_config)

    assert "AR001" in _rule_ids(result)


def test_shadowing_importlib_with_a_function_parameter_avoids_false_positive(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(
        tmp_path,
        "backend/app/domain/orders.py",
        'import importlib\n\ndef load(importlib):\n    return importlib.import_module("app.db.repository")\n',
    )

    assert _backend_result(tmp_path, quality_config).findings == []


@pytest.mark.parametrize(
    "source",
    [
        'import importlib\nmodel = importlib.import_module("app.domain.orders")\n',
        'model = __import__("app.domain.orders", fromlist=["orders"])\n',
    ],
)
def test_allowed_literal_dynamic_backend_import_stays_valid(
    tmp_path: Path,
    quality_config: QualityConfig,
    source: str,
) -> None:
    _write(tmp_path, "backend/app/services/orders.py", source)

    assert _backend_result(tmp_path, quality_config).findings == []


@pytest.mark.parametrize("module", ["fastapi", "sqlalchemy.orm", "pydantic", "psycopg"])
def test_domain_framework_dependencies_are_ar002_errors(
    tmp_path: Path,
    quality_config: QualityConfig,
    module: str,
) -> None:
    _write(
        tmp_path,
        "backend/app/domain/order.py",
        f"def framework_type():\n    import {module}\n    return {module.split('.')[0]}\n",
    )

    result = _backend_result(tmp_path, quality_config)
    finding = next(item for item in result.findings if item.rule.rule_id == "AR002")

    assert finding.actual == module
    assert finding.line == 2


def test_domain_framework_prefix_lookalike_is_not_rejected(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(tmp_path, "backend/app/domain/order.py", "import fastapi_helpers\n")

    assert _backend_result(tmp_path, quality_config).findings == []


@pytest.mark.parametrize(
    "source",
    [
        "from sqlalchemy import text\n",
        "def query():\n    from sqlalchemy import text\n    return text('SELECT 1')\n",
        "from app.db import repository\n",
    ],
)
def test_api_database_imports_are_ar004_errors(
    tmp_path: Path,
    quality_config: QualityConfig,
    source: str,
) -> None:
    _write(tmp_path, "backend/app/api/orders.py", source)

    result = _backend_result(tmp_path, quality_config)

    assert "AR004" in _rule_ids(result)


@pytest.mark.parametrize(("handler_lines", "rejected"), [(50, False), (51, True)])
def test_router_handler_line_boundary_is_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    handler_lines: int,
    rejected: bool,
) -> None:
    body_lines = handler_lines - 2
    body = "\n".join(f"    value_{index} = {index}" for index in range(body_lines))
    source = f"from fastapi import APIRouter\n\nrouter = APIRouter()\n\n@router.get('/')\ndef orders():\n{body}\n"
    _write(tmp_path, "backend/app/api/orders.py", source)

    result = _backend_result(tmp_path, quality_config)
    oversized = [
        finding for finding in result.findings if finding.rule.rule_id == "AR004" and finding.symbol == "orders"
    ]

    assert bool(oversized) is rejected
    if oversized:
        assert oversized[0].actual == handler_lines


def test_large_non_route_helper_is_not_misclassified_as_router_logic(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    body = "\n".join(f"    value_{index} = {index}" for index in range(60))
    _write(tmp_path, "backend/app/api/helpers.py", f"def helper():\n{body}\n")

    result = _backend_result(tmp_path, quality_config)

    assert "AR004" not in _rule_ids(result)


@pytest.mark.parametrize(
    "relative",
    ["backend/app/services/orders.py", "backend/app/main.py"],
)
def test_backend_cannot_import_frontend_implementation(
    tmp_path: Path,
    quality_config: QualityConfig,
    relative: str,
) -> None:
    _write(tmp_path, relative, "from frontend.src import main\n")

    result = _backend_result(tmp_path, quality_config)

    assert _rule_ids(result) == ["AR001"]
    assert result.findings[0].actual == "backend->frontend"


def test_unclassified_backend_directory_cannot_bypass_api_and_database_boundaries(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(
        tmp_path,
        "backend/app/legacy/orders.py",
        "from fastapi import APIRouter\nfrom app.db import repository\n",
    )

    result = _backend_result(tmp_path, quality_config)

    assert _rule_ids(result) == ["AR001"]
    assert result.findings[0].actual == "unclassified:legacy"
    assert result.findings[0].line == 1


def test_configured_backend_support_directory_remains_valid(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(tmp_path, "backend/app/config/settings.py", "from pydantic_settings import BaseSettings\n")

    assert _backend_result(tmp_path, quality_config).findings == []


def test_unconfigured_backend_root_module_cannot_bypass_api_and_database_boundaries(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(
        tmp_path,
        "backend/app/orders.py",
        "from fastapi import APIRouter\nfrom app.db import repository\n",
    )

    result = _backend_result(tmp_path, quality_config)

    assert _rule_ids(result) == ["AR001"]
    assert result.findings[0].actual == "unclassified-root:orders.py"
    assert result.findings[0].line == 1


def _frontend_fixture(root: Path) -> None:
    for relative in (
        "frontend/src/main.ts",
        "frontend/src/api/backend.ts",
        "frontend/src/shared/format.ts",
        "frontend/src/components/button.ts",
        "frontend/src/features/orders/index.ts",
        "frontend/src/features/orders/view.ts",
        "frontend/src/features/orders/internal/state.ts",
        "frontend/src/features/catalog/index.ts",
        "frontend/src/features/catalog/internal/state.ts",
        "frontend/src/features/catalog/internal/index.ts",
    ):
        _write(root, relative)


def test_frontend_documented_dependency_direction_passes(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _frontend_fixture(tmp_path)
    edges = [
        TypeScriptImport("frontend/src/features/orders/view.ts", 1, "./internal/state"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 2, "../catalog"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 3, "../../api/backend"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 4, "../../shared/format"),
        TypeScriptImport("frontend/src/api/backend.ts", 1, "../shared/format"),
        TypeScriptImport("frontend/src/main.ts", 1, "./features/orders"),
    ]

    result = _frontend_result(tmp_path, quality_config, edges)

    assert result.findings == []


@pytest.mark.parametrize(
    ("source", "specifier"),
    [
        ("frontend/src/shared/format.ts", "../features/orders/view"),
        ("frontend/src/shared/format.ts", "../api/backend"),
        ("frontend/src/shared/format.ts", "../components/button"),
        ("frontend/src/shared/format.ts", "../main"),
        ("frontend/src/api/backend.ts", "../features/orders/view"),
        ("frontend/src/api/backend.ts", "../components/button"),
        ("frontend/src/api/backend.ts", "../main"),
    ],
)
def test_frontend_invalid_layer_dependencies_are_ar001_errors(
    tmp_path: Path,
    quality_config: QualityConfig,
    source: str,
    specifier: str,
) -> None:
    _frontend_fixture(tmp_path)
    edge = TypeScriptImport(source, 7, specifier)

    result = _frontend_result(tmp_path, quality_config, [edge])

    assert _rule_ids(result) == ["AR001"]
    assert result.findings[0].line == 7


@pytest.mark.parametrize("entry_module", ["main.ts", "main.tsx"])
def test_feature_cannot_import_application_entry_module(
    tmp_path: Path,
    quality_config: QualityConfig,
    entry_module: str,
) -> None:
    _write(tmp_path, f"frontend/src/{entry_module}")
    _write(tmp_path, "frontend/src/features/orders/view.ts")
    edge = TypeScriptImport("frontend/src/features/orders/view.ts", 4, f"../../{entry_module}")

    result = _frontend_result(tmp_path, quality_config, [edge])

    assert _rule_ids(result) == ["AR001"]
    assert result.findings[0].actual == "feature->app"
    assert result.findings[0].line == 4


@pytest.mark.parametrize(
    "specifier",
    [
        "../catalog/internal/state",
        "../catalog/internal/state.js",
        "../catalog/internal/state.jsx",
        "../catalog/internal",
        "@/features/catalog/internal/state",
        "~/features/catalog/internal/state",
        "src/features/catalog/internal/state",
    ],
)
def test_cross_feature_internal_imports_are_ar003_errors(
    tmp_path: Path,
    quality_config: QualityConfig,
    specifier: str,
) -> None:
    _frontend_fixture(tmp_path)
    edge = TypeScriptImport("frontend/src/features/orders/view.ts", 3, specifier)

    result = _frontend_result(tmp_path, quality_config, [edge])

    assert _rule_ids(result) == ["AR003"]
    assert result.findings[0].actual == specifier


def test_cross_feature_public_root_index_is_allowed(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _frontend_fixture(tmp_path)
    edges = [
        TypeScriptImport("frontend/src/features/orders/view.ts", 1, "../catalog"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 2, "../catalog/index.ts"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 3, "../catalog/index.js"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 4, "../catalog/index.jsx"),
    ]

    assert _frontend_result(tmp_path, quality_config, edges).findings == []


def test_external_and_unresolved_frontend_imports_are_ignored(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _frontend_fixture(tmp_path)
    edges = [
        TypeScriptImport("frontend/src/features/orders/view.ts", 1, "react"),
        TypeScriptImport("frontend/src/features/orders/view.ts", 2, "./missing"),
    ]

    assert _frontend_result(tmp_path, quality_config, edges).findings == []


def test_tooling_documented_dependency_direction_passes(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(tmp_path, "tools/control.py", "from tools.inst import doctor\n")
    _write(tmp_path, "tools/inst/doctor.py", "from tools.quality import model\n")
    _write(tmp_path, "tools/quality/model.py", "from dataclasses import dataclass\n")

    result = _backend_result(tmp_path, quality_config)

    assert result.findings == []


@pytest.mark.parametrize(
    ("relative", "source", "actual"),
    [
        ("tools/quality/scanner.py", "from tools import control\n", "quality->control"),
        ("tools/quality/scanner.py", "import tools.control_parser\n", "quality->control"),
        (
            "tools/quality/scanner.py",
            'import importlib\ncontrol = importlib.import_module("tools.control")\n',
            "quality->control",
        ),
        (
            "tools/quality/scanner.py",
            'control = __import__("tools.control", fromlist=["control"])\n',
            "quality->control",
        ),
        ("tools/inst/build.py", "from frontend.src import main\n", "tooling->frontend"),
    ],
)
def test_invalid_tooling_dependencies_are_ar001_errors(
    tmp_path: Path,
    quality_config: QualityConfig,
    relative: str,
    source: str,
    actual: str,
) -> None:
    _write(tmp_path, relative, source)

    result = _backend_result(tmp_path, quality_config)

    assert _rule_ids(result) == ["AR001"]
    assert result.findings[0].actual == actual


def test_excluded_tooling_paths_are_not_architecture_inputs(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    _write(tmp_path, "tools/.venv/lib/python/site.py", "from frontend.src import main\n")
    _write(tmp_path, "tools/generated/client.py", "from frontend.src import main\n")
    _write(tmp_path, "tools/inst/build.py", "from tools.quality import model\n")

    result = _backend_result(tmp_path, quality_config)

    assert result.findings == []
