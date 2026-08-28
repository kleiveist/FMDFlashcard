from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from tools.core.context import load_context
from tools.quality.model import (
    RULES,
    CheckResult,
    Finding,
    QualityConfig,
    ScopeLimits,
    Severity,
)


class RustAnalysisError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class RustFunctionMetric:
    symbol: str
    start_line: int
    end_line: int
    complexity: int | None
    nesting: int | None
    parameters: int


@dataclass(frozen=True, slots=True)
class RustScope:
    kind: str
    symbol: str
    start_line: int
    end_line: int


class _RustSource(Protocol):
    relative_path: str
    rust_functions: tuple[RustFunctionMetric, ...]


_CONTEXT = load_context()
_ROOT = _CONTEXT.project_root
_ANALYZER = _CONTEXT.tools_root / "quality" / "rust_ast.py"


def _tooling_python() -> Path | None:
    candidates = (
        _CONTEXT.venv_root / "Scripts" / "python.exe",
        _CONTEXT.venv_root / "bin" / "python",
        Path(sys.executable),
    )
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def _run_analyzer(text: str) -> dict[str, Any]:
    python = _tooling_python()
    if python is None:
        raise RustAnalysisError("the Rust syntax analyzer is unavailable; run 'python tools/control.py install'")
    try:
        encoded_input = text.encode("utf-8", errors="strict")
        completed = subprocess.run(
            [str(python), str(_ANALYZER)],
            input=encoded_input,
            capture_output=True,
            check=False,
            timeout=30,
        )
        stdout = completed.stdout.decode("utf-8", errors="strict")
        stderr = completed.stderr.decode("utf-8", errors="strict")
    except (OSError, UnicodeError, subprocess.TimeoutExpired) as exc:
        raise RustAnalysisError(f"could not start the Rust syntax analyzer: {exc}") from exc
    if completed.returncode != 0:
        detail = (stderr or stdout).strip()
        raise RustAnalysisError(detail or f"Rust syntax analyzer exited with {completed.returncode}")
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RustAnalysisError("Rust syntax analyzer returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise RustAnalysisError("Rust syntax analyzer returned an invalid payload")
    return payload


def _analysis_payload(text: str) -> dict[str, Any]:
    return _run_analyzer(text)


def _integer(item: dict[str, Any], key: str, *, minimum: int = 0) -> int:
    value = item.get(key)
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise RustAnalysisError(f"Rust syntax analyzer returned invalid {key}")
    return value


def _optional_integer(item: dict[str, Any], key: str, *, minimum: int = 0) -> int | None:
    value = item.get(key)
    if value is None:
        return None
    return _integer(item, key, minimum=minimum)


def _items(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise RustAnalysisError(f"Rust syntax analyzer returned invalid {key}")
    return value


def _symbol(item: dict[str, Any]) -> str:
    value = item.get("symbol")
    if not isinstance(value, str) or not value:
        raise RustAnalysisError("Rust syntax analyzer returned an invalid symbol")
    return value


def _span(item: dict[str, Any], maximum_line: int) -> tuple[int, int]:
    start = _integer(item, "start_line", minimum=1)
    end = _integer(item, "end_line", minimum=1)
    if end < start or end > maximum_line:
        raise RustAnalysisError("Rust syntax analyzer returned an invalid line span")
    return start, end


def _scope(item: dict[str, Any], maximum_line: int) -> RustScope:
    kind = item.get("kind")
    if kind not in {"class", "function"}:
        raise RustAnalysisError("Rust syntax analyzer returned an invalid scope kind")
    start, end = _span(item, maximum_line)
    return RustScope(kind, _symbol(item), start, end)


def _function(item: dict[str, Any], maximum_line: int) -> RustFunctionMetric:
    start, end = _span(item, maximum_line)
    complexity = _optional_integer(item, "complexity", minimum=1)
    nesting = _optional_integer(item, "nesting")
    if (complexity is None) != (nesting is None):
        raise RustAnalysisError("Rust syntax analyzer returned incomplete control metrics")
    return RustFunctionMetric(
        _symbol(item),
        start,
        end,
        complexity,
        nesting,
        _integer(item, "parameters"),
    )


def _validate_unique_symbols(scopes: tuple[RustScope, ...], functions: tuple[RustFunctionMetric, ...]) -> None:
    scope_keys = [(scope.kind, scope.symbol) for scope in scopes]
    function_symbols = [function.symbol for function in functions]
    if len(scope_keys) != len(set(scope_keys)) or len(function_symbols) != len(set(function_symbols)):
        raise RustAnalysisError("Rust syntax analyzer returned duplicate symbols")
    function_scopes = {(scope.symbol, scope.start_line, scope.end_line) for scope in scopes if scope.kind == "function"}
    measured_functions = {(function.symbol, function.start_line, function.end_line) for function in functions}
    if function_scopes != measured_functions:
        raise RustAnalysisError("Rust syntax analyzer returned inconsistent function scopes")


def analyze_rust(
    text: str,
) -> tuple[tuple[RustScope, ...], tuple[RustFunctionMetric, ...]]:
    payload = _analysis_payload(text)
    scope_items = _items(payload, "scopes")
    function_items = _items(payload, "functions")
    if not text and (scope_items or function_items):
        raise RustAnalysisError("Rust syntax analyzer returned scopes for an empty source")
    maximum_line = max(1, len(text.splitlines()))
    scopes = tuple(_scope(item, maximum_line) for item in scope_items)
    functions = tuple(_function(item, maximum_line) for item in function_items)
    _validate_unique_symbols(scopes, functions)
    return scopes, functions


def _threshold(limits: ScopeLimits, severity: Severity) -> int:
    if severity is Severity.ERROR:
        return limits.maximum
    if severity is Severity.STRONG_WARNING:
        return limits.strong_warning
    return limits.warning


def _metric_finding(
    source: _RustSource,
    function: RustFunctionMetric,
    definition: tuple[str, str, str, ScopeLimits],
) -> Finding | None:
    rule_id, label, attribute, limits = definition
    actual = getattr(function, attribute)
    if actual is None:
        return None
    severity = limits.classify(actual)
    if severity is None:
        return None
    return Finding(
        RULES[rule_id],
        severity,
        source.relative_path,
        f"Function has {label} {actual}.",
        actual,
        _threshold(limits, severity),
        symbol=function.symbol,
        line=function.start_line,
    )


def _function_findings(
    source: _RustSource,
    function: RustFunctionMetric,
    definitions: tuple[tuple[str, str, str, ScopeLimits], ...],
) -> list[Finding]:
    return [
        finding for definition in definitions if (finding := _metric_finding(source, function, definition)) is not None
    ]


def rust_metrics_result(metrics: list[_RustSource], config: QualityConfig) -> CheckResult:
    sources = [source for source in metrics if Path(source.relative_path).suffix.lower() == ".rs"]
    result = CheckResult("Rust complexity", files_checked=len(sources))
    if not sources:
        result.detail = "no Rust sources present"
        return result
    definitions = (
        ("CQ102", "cyclomatic complexity", "complexity", config.complexity),
        ("CQ103", "nesting depth", "nesting", config.nesting),
        ("CQ104", "parameters", "parameters", config.parameters),
    )
    for source in sources:
        for function in source.rust_functions:
            result.findings.extend(_function_findings(source, function, definitions))
    return result
