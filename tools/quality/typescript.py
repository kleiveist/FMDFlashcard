from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from tools.core.context import load_context
from tools.process import prepare_command
from tools.quality.model import RULES, CheckResult, Finding, QualityConfig, Severity
from tools.quality.scanner import SourceMetrics


@dataclass(frozen=True, slots=True)
class TypeScriptClass:
    path: str
    symbol: str
    start_line: int
    end_line: int


@dataclass(frozen=True, slots=True)
class TypeScriptImport:
    path: str
    line: int
    specifier: str


@dataclass(frozen=True, slots=True)
class TypeScriptFunction:
    path: str
    symbol: str
    start_line: int
    end_line: int


@dataclass(frozen=True, slots=True)
class TypeScriptAnalysis:
    classes: tuple[TypeScriptClass, ...]
    imports: tuple[TypeScriptImport, ...]
    functions: tuple[TypeScriptFunction, ...] = ()


def _source_paths(root: Path, metrics: list[SourceMetrics]) -> list[Path]:
    frontend = load_context(project_root=root).paths.frontend
    extensions = {".js", ".jsx", ".ts", ".tsx"}
    return [
        source.path
        for source in metrics
        if source.path.suffix.lower() in extensions and source.path.is_relative_to(frontend)
    ]


def analyze_typescript(
    root: Path,
    metrics: list[SourceMetrics],
) -> tuple[TypeScriptAnalysis | None, CheckResult]:
    result = CheckResult("TypeScript AST")
    paths = _source_paths(root, metrics)
    if not paths:
        result.detail = "no JavaScript or TypeScript sources present"
        return TypeScriptAnalysis((), ()), result
    node = shutil.which("node")
    frontend = load_context(project_root=root).paths.frontend
    script = frontend / "scripts" / "quality-ast.mjs"
    typescript = frontend / "node_modules" / "typescript"
    if node is None or not script.is_file() or not typescript.exists():
        result.passed = False
        result.detail = "TypeScript AST tooling is unavailable. Action: run 'python tools/control.py install'."
        return None, result
    try:
        completed = subprocess.run(
            prepare_command([node, str(script), *(str(path) for path in paths)]),
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as exc:
        result.passed = False
        result.detail = f"TypeScript AST analysis could not start: {exc}"
        return None, result
    if completed.returncode != 0:
        result.passed = False
        result.detail = f"TypeScript AST analysis failed with exit code {completed.returncode}"
        result.output = "\n".join(part for part in (completed.stdout, completed.stderr) if part)
        return None, result
    try:
        payload = json.loads(completed.stdout)
        classes = tuple(
            TypeScriptClass(
                Path(item["file"]).resolve().relative_to(root.resolve()).as_posix(),
                str(item["symbol"]),
                int(item["line"]),
                int(item["endLine"]),
            )
            for item in payload["classes"]
        )
        imports = tuple(
            TypeScriptImport(
                Path(item["file"]).resolve().relative_to(root.resolve()).as_posix(),
                int(item["line"]),
                str(item["specifier"]),
            )
            for item in payload["imports"]
        )
        functions = tuple(
            TypeScriptFunction(
                Path(item["file"]).resolve().relative_to(root.resolve()).as_posix(),
                str(item["symbol"]),
                int(item["line"]),
                int(item["endLine"]),
            )
            for item in payload["functions"]
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        result.passed = False
        result.detail = f"TypeScript AST output was invalid: {exc}"
        result.output = completed.stdout
        return None, result
    result.detail = f"parsed {len(paths)} source files"
    return TypeScriptAnalysis(classes, imports, functions), result


def add_class_findings(
    result: CheckResult,
    analysis: TypeScriptAnalysis,
    metrics: list[SourceMetrics],
    config: QualityConfig,
) -> None:
    code_lines = {source.relative_path: source.code_line_numbers for source in metrics}
    for class_metric in analysis.classes:
        source_lines = code_lines.get(class_metric.path, frozenset())
        actual = sum(class_metric.start_line <= line <= class_metric.end_line for line in source_lines)
        severity = config.class_.classify(actual)
        if severity is None:
            continue
        result.findings.append(
            Finding(
                RULES["CQ201"],
                severity,
                class_metric.path,
                f"Class contains {actual} code lines.",
                actual,
                config.class_.maximum
                if severity is Severity.ERROR
                else (config.class_.strong_warning if severity is Severity.STRONG_WARNING else config.class_.warning),
                symbol=class_metric.symbol,
                line=class_metric.start_line,
            )
        )
