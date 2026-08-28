from __future__ import annotations

import ast
from pathlib import Path

from tools.quality.model import RULES, CheckResult, Finding, QualityConfig, Severity
from tools.quality.python_imports import imported_modules
from tools.quality.scanner import SourceMetrics
from tools.quality.typescript import TypeScriptAnalysis, TypeScriptImport

HTTP_DECORATORS = frozenset({"delete", "get", "head", "options", "patch", "post", "put", "trace", "websocket"})
QUALITY_FORBIDDEN_TOOLING_IMPORTS = ("tools.control", "tools.control_parser")
FRONTEND_ENTRY_MODULES = frozenset({"main.js", "main.jsx", "main.ts", "main.tsx"})


def _backend_directory(path: Path, root: Path, config: QualityConfig) -> str | None:
    try:
        relative = path.relative_to(root / config.backend_architecture.root)
    except ValueError:
        return None
    if len(relative.parts) < 2:
        return None
    return relative.parts[0]


def _backend_layer(path: Path, root: Path, config: QualityConfig) -> str | None:
    directory = _backend_directory(path, root, config)
    if directory is None:
        return None
    architecture = config.backend_architecture
    if directory in architecture.api_layers:
        return "api"
    if directory in architecture.application_layers:
        return "application"
    if directory in architecture.domain_layers:
        return "domain"
    if directory in architecture.infrastructure_layers:
        return "infrastructure"
    return None


def _backend_classification_finding(path: Path, root: Path, config: QualityConfig) -> Finding | None:
    architecture = config.backend_architecture
    try:
        backend_relative = path.relative_to(root / architecture.root)
    except ValueError:
        return None
    relative = path.relative_to(root).as_posix()
    if len(backend_relative.parts) == 1:
        if backend_relative.name in architecture.composition_files:
            return None
        return Finding(
            RULES["AR001"],
            Severity.ERROR,
            relative,
            f"Backend root module '{backend_relative.name}' is not a configured composition file.",
            actual=f"unclassified-root:{backend_relative.name}",
            threshold="configured backend composition file",
            line=1,
        )
    directory = backend_relative.parts[0]
    classified = (
        architecture.api_layers
        | architecture.application_layers
        | architecture.domain_layers
        | architecture.infrastructure_layers
        | architecture.support_directories
    )
    if directory in classified:
        return None
    return Finding(
        RULES["AR001"],
        Severity.ERROR,
        relative,
        f"Backend directory '{directory}' is not a configured layer or support directory.",
        actual=f"unclassified:{directory}",
        threshold="configured backend layer or support directory",
        line=1,
    )


def _module_name(path: Path, backend_root: Path, package: str) -> tuple[str, str]:
    relative = path.relative_to(backend_root)
    parts = list(relative.with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
        is_package = True
    else:
        is_package = False
    module = ".".join((package, *parts))
    current_package = module if is_package else module.rpartition(".")[0]
    return module, current_package


def _target_backend_layer(module: str, config: QualityConfig) -> str | None:
    parts = module.split(".")
    architecture = config.backend_architecture
    package_parts = architecture.package.split(".")
    root_parts = list(Path(architecture.root).parts)
    prefixes = [package_parts]
    if root_parts != package_parts:
        prefixes.append(root_parts)
    prefix = next(
        (candidate for candidate in prefixes if parts[: len(candidate)] == candidate),
        None,
    )
    if prefix is None or len(parts) <= len(prefix):
        return None
    directory = parts[len(prefix)]
    if directory in architecture.api_layers:
        return "api"
    if directory in architecture.application_layers:
        return "application"
    if directory in architecture.domain_layers:
        return "domain"
    if directory in architecture.infrastructure_layers:
        return "infrastructure"
    return None


def _router_names(tree: ast.AST) -> frozenset[str]:
    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.Assign, ast.AnnAssign)):
            continue
        value = node.value
        if not isinstance(value, ast.Call):
            continue
        callable_name = (
            value.func.id
            if isinstance(value.func, ast.Name)
            else (value.func.attr if isinstance(value.func, ast.Attribute) else "")
        )
        if callable_name not in {"APIRouter", "FastAPI"}:
            continue
        targets = node.targets if isinstance(node, ast.Assign) else [node.target]
        names.update(target.id for target in targets if isinstance(target, ast.Name))
    return frozenset(names)


def _is_route_handler(node: ast.FunctionDef | ast.AsyncFunctionDef, router_names: frozenset[str]) -> bool:
    for decorator in node.decorator_list:
        expression = decorator.func if isinstance(decorator, ast.Call) else decorator
        if not isinstance(expression, ast.Attribute) or expression.attr not in HTTP_DECORATORS:
            continue
        if isinstance(expression.value, ast.Name) and expression.value.id in router_names:
            return True
    return False


def _backend_import_findings(
    *,
    layer: str,
    imported: str,
    line: int,
    relative: str,
    config: QualityConfig,
) -> list[Finding]:
    architecture = config.backend_architecture
    findings: list[Finding] = []
    target_layer = _target_backend_layer(imported, config)
    if target_layer is not None and (layer, target_layer) in architecture.forbidden_dependencies:
        findings.append(
            Finding(
                RULES["AR001"],
                Severity.ERROR,
                relative,
                f"The {layer} layer imports {imported} from the {target_layer} layer.",
                actual=f"{layer}->{target_layer}",
                threshold="documented dependency direction",
                line=line,
            )
        )
    root_module = imported.partition(".")[0]
    if layer == "domain" and root_module in architecture.domain_forbidden_imports:
        findings.append(
            Finding(
                RULES["AR002"],
                Severity.ERROR,
                relative,
                f"Domain code imports framework or concrete infrastructure module {imported}.",
                actual=imported,
                threshold="framework-free domain",
                line=line,
            )
        )
    business_import = root_module in architecture.router_business_imports
    if layer == "api" and (target_layer == "infrastructure" or business_import):
        findings.append(
            Finding(
                RULES["AR004"],
                Severity.ERROR,
                relative,
                f"API module directly imports database infrastructure {imported}.",
                actual=imported,
                threshold="thin HTTP adapter",
                line=line,
            )
        )
    return findings


def _backend_frontend_finding(relative: str, imported: str, line: int) -> Finding | None:
    if imported != "frontend" and not imported.startswith("frontend."):
        return None
    return Finding(
        RULES["AR001"],
        Severity.ERROR,
        relative,
        f"Backend code imports frontend implementation module {imported}.",
        actual="backend->frontend",
        threshold="backend must use shared contracts, not frontend implementation",
        line=line,
    )


def _findings_for_backend_imports(
    tree: ast.AST,
    current_package: str,
    layer: str | None,
    relative: str,
    config: QualityConfig,
) -> list[Finding]:
    findings: list[Finding] = []
    seen: set[tuple[str, int, str]] = set()
    architecture = config.backend_architecture
    package_roots = frozenset(
        {
            architecture.package,
            ".".join(architecture.root.parts),
        }
    )
    for imported, line in imported_modules(tree, current_package, expand_from_roots=package_roots):
        candidates = []
        boundary_finding = _backend_frontend_finding(relative, imported, line)
        if boundary_finding is not None:
            candidates.append(boundary_finding)
        if layer is not None:
            candidates.extend(
                _backend_import_findings(
                    layer=layer,
                    imported=imported,
                    line=line,
                    relative=relative,
                    config=config,
                )
            )
        for finding in candidates:
            key = (finding.rule.rule_id, line, imported)
            if key not in seen:
                findings.append(finding)
                seen.add(key)
    return findings


def _router_size_findings(
    tree: ast.AST,
    relative: str,
    code_lines: frozenset[int],
    maximum: int,
) -> list[Finding]:
    findings: list[Finding] = []
    routers = _router_names(tree)
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) or not _is_route_handler(node, routers):
            continue
        start = min([node.lineno, *(decorator.lineno for decorator in node.decorator_list)])
        end = node.end_lineno or node.lineno
        actual = sum(start <= line <= end for line in code_lines)
        if actual <= maximum:
            continue
        findings.append(
            Finding(
                RULES["AR004"],
                Severity.ERROR,
                relative,
                f"HTTP handler contains {actual} code lines and is no longer a thin adapter.",
                actual,
                maximum,
                symbol=node.name,
                line=start,
            )
        )
    return findings


def _check_backend(root: Path, config: QualityConfig, metrics: list[SourceMetrics], result: CheckResult) -> None:
    architecture = config.backend_architecture
    backend_root = root / architecture.root
    if not backend_root.is_dir():
        return
    metric_map = {source.path: source for source in metrics}
    backend_paths = sorted(
        source.path
        for source in metrics
        if source.path.suffix.lower() == ".py" and source.path.is_relative_to(backend_root)
    )
    for path in backend_paths:
        layer = _backend_layer(path, root, config)
        relative = path.relative_to(root).as_posix()
        classification_finding = _backend_classification_finding(path, root, config)
        if classification_finding is not None:
            result.findings.append(classification_finding)
        try:
            text = path.read_text(encoding="utf-8")
            tree = ast.parse(text)
        except (OSError, UnicodeError, SyntaxError) as exc:
            result.passed = False
            result.detail = f"backend architecture parsing failed for {relative}: {exc}"
            continue
        _, current_package = _module_name(path, backend_root, architecture.package)
        result.findings.extend(_findings_for_backend_imports(tree, current_package, layer, relative, config))
        if layer is None:
            continue
        if layer != "api":
            continue
        source_metric = metric_map.get(path)
        code_lines = source_metric.code_line_numbers if source_metric else frozenset()
        result.findings.extend(_router_size_findings(tree, relative, code_lines, architecture.router_handler_max_lines))


def _tooling_import_findings(relative: str, imported: str, line: int) -> list[Finding]:
    findings: list[Finding] = []
    quality_source = relative.startswith("tools/quality/")
    imports_dispatcher = any(
        imported == forbidden or imported.startswith(f"{forbidden}.") for forbidden in QUALITY_FORBIDDEN_TOOLING_IMPORTS
    )
    if quality_source and imports_dispatcher:
        findings.append(
            Finding(
                RULES["AR001"],
                Severity.ERROR,
                relative,
                f"Quality implementation imports the top-level CLI dispatcher {imported}.",
                actual="quality->control",
                threshold="control->command->quality",
                line=line,
            )
        )
    if imported == "frontend" or imported.startswith("frontend."):
        findings.append(
            Finding(
                RULES["AR001"],
                Severity.ERROR,
                relative,
                f"Tooling code imports frontend implementation module {imported}.",
                actual="tooling->frontend",
                threshold="tooling must use repository contracts, not frontend UI implementation",
                line=line,
            )
        )
    return findings


def _check_tooling(root: Path, metrics: list[SourceMetrics], result: CheckResult) -> None:
    tooling_root = root / "tools"
    if not tooling_root.is_dir():
        return
    tooling_paths = sorted(
        source.path
        for source in metrics
        if source.path.suffix.lower() == ".py" and source.path.is_relative_to(tooling_root)
    )
    for path in tooling_paths:
        relative_path = path.relative_to(tooling_root)
        if relative_path.parts and relative_path.parts[0] == "tests":
            continue
        relative = path.relative_to(root).as_posix()
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, SyntaxError) as exc:
            result.passed = False
            result.detail = f"tooling architecture parsing failed for {relative}: {exc}"
            continue
        _, current_package = _module_name(path, tooling_root, "tools")
        for imported, line in imported_modules(tree, current_package):
            result.findings.extend(_tooling_import_findings(relative, imported, line))


def _frontend_relative(path: str, config: QualityConfig) -> Path | None:
    source = Path(path)
    try:
        return source.relative_to(config.frontend_architecture.root)
    except ValueError:
        return None


def _resolve_frontend_import(root: Path, edge: TypeScriptImport, config: QualityConfig) -> Path | None:
    source_root = root / config.frontend_architecture.root
    source = root / edge.path
    specifier = edge.specifier
    if specifier.startswith("@/") or specifier.startswith("~/"):
        base = source_root / specifier[2:]
    elif specifier.startswith("src/"):
        base = source_root / specifier[4:]
    elif specifier.startswith("."):
        base = source.parent / specifier
    else:
        return None
    if base.suffix == ".js":
        candidates = [base.with_suffix(suffix) for suffix in (".ts", ".tsx", ".d.ts", ".js", ".jsx")]
    elif base.suffix == ".jsx":
        candidates = [base.with_suffix(suffix) for suffix in (".tsx", ".ts", ".d.ts", ".jsx", ".js")]
    else:
        candidates = [base]
    if not base.suffix:
        candidates.extend(base.with_suffix(suffix) for suffix in (".ts", ".tsx", ".js", ".jsx"))
        candidates.extend(base / name for name in config.frontend_architecture.public_module_names)
    for candidate in candidates:
        if candidate.is_file():
            try:
                return candidate.resolve().relative_to(source_root.resolve())
            except ValueError:
                return None
    return None


def _frontend_kind(path: Path, config: QualityConfig) -> tuple[str, str | None]:
    if not path.parts:
        return "app", None
    architecture = config.frontend_architecture
    first = path.parts[0]
    if first in architecture.shared_directories:
        return "shared", None
    if first in architecture.api_directories:
        return "api", None
    if first in architecture.ui_directories:
        return "ui", None
    if first in architecture.feature_directories and len(path.parts) >= 2:
        return "feature", path.parts[1]
    return "app", None


def _is_public_feature_target(path: Path, feature: str, config: QualityConfig) -> bool:
    architecture = config.frontend_architecture
    return (
        len(path.parts) == 3
        and path.parts[0] in architecture.feature_directories
        and path.parts[1] == feature
        and path.name in architecture.public_module_names
    )


def _invalid_frontend_layer(source_kind: str, target_kind: str, target_relative: Path) -> bool:
    target_is_entry = target_relative.as_posix() in FRONTEND_ENTRY_MODULES
    if source_kind == "shared":
        return target_kind in {"api", "app", "feature", "ui"}
    if source_kind == "api":
        return target_kind in {"feature", "ui"} or target_is_entry
    return source_kind == "feature" and target_is_entry


def _check_frontend(
    root: Path,
    config: QualityConfig,
    analysis: TypeScriptAnalysis | None,
    result: CheckResult,
) -> None:
    if analysis is None:
        result.passed = False
        return
    for edge in analysis.imports:
        source_relative = _frontend_relative(edge.path, config)
        if source_relative is None:
            continue
        target_relative = _resolve_frontend_import(root, edge, config)
        if target_relative is None:
            continue
        source_kind, source_feature = _frontend_kind(source_relative, config)
        target_kind, target_feature = _frontend_kind(target_relative, config)
        invalid_layer = _invalid_frontend_layer(source_kind, target_kind, target_relative)
        if invalid_layer:
            result.findings.append(
                Finding(
                    RULES["AR001"],
                    Severity.ERROR,
                    edge.path,
                    f"Frontend {source_kind} code imports disallowed {target_kind} module {target_relative.as_posix()}.",
                    actual=f"{source_kind}->{target_kind}",
                    threshold="documented frontend dependency direction",
                    line=edge.line,
                )
            )
        cross_feature = (
            source_kind == "feature"
            and target_kind == "feature"
            and source_feature != target_feature
            and target_feature is not None
        )
        if cross_feature and not _is_public_feature_target(target_relative, target_feature, config):
            result.findings.append(
                Finding(
                    RULES["AR003"],
                    Severity.ERROR,
                    edge.path,
                    f"Feature {source_feature} imports internal module {target_relative.as_posix()} from feature {target_feature}.",
                    actual=edge.specifier,
                    threshold=f"features/{target_feature}/index.*",
                    line=edge.line,
                )
            )


def architecture_result(
    root: Path,
    config: QualityConfig,
    metrics: list[SourceMetrics],
    typescript: TypeScriptAnalysis | None,
) -> CheckResult:
    result = CheckResult("Architecture")
    _check_backend(root, config, metrics, result)
    _check_tooling(root, metrics, result)
    if (root / config.frontend_architecture.root).is_dir():
        _check_frontend(root, config, typescript, result)
    return result
