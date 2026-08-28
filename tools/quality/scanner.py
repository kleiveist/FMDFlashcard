from __future__ import annotations

import ast
import fnmatch
import io
import os
import re
import tokenize
from dataclasses import dataclass
from pathlib import Path

from tools.quality.model import RULES, CheckResult, Finding, QualityConfig, Severity
from tools.quality.rust import RustAnalysisError, RustFunctionMetric, analyze_rust


@dataclass(frozen=True, slots=True)
class ScopeMetric:
    kind: str
    symbol: str
    start_line: int
    end_line: int
    code_lines: int


@dataclass(frozen=True, slots=True)
class SourceMetrics:
    path: Path
    relative_path: str
    physical_lines: int
    code_line_numbers: frozenset[int]
    scopes: tuple[ScopeMetric, ...]
    rust_functions: tuple[RustFunctionMetric, ...] = ()

    @property
    def code_lines(self) -> int:
        return len(self.code_line_numbers)


class SourceScanError(ValueError):
    pass


def _excluded(relative_path: str, parts: tuple[str, ...], config: QualityConfig) -> bool:
    if any(part in config.source.exclude_directories for part in parts[:-1]):
        return True
    if parts and parts[-1] in config.source.exclude_files:
        return True
    return any(fnmatch.fnmatchcase(relative_path, pattern) for pattern in config.source.exclude_paths)


def discover_source_files(root: Path, config: QualityConfig) -> list[Path]:
    files: list[Path] = []
    for directory, names, filenames in os.walk(root):
        directory_path = Path(directory)
        relative_directory = directory_path.relative_to(root)
        names[:] = sorted(name for name in names if name not in config.source.exclude_directories)
        for filename in sorted(filenames):
            path = directory_path / filename
            if path.suffix.lower() not in config.source.extensions:
                continue
            relative = path.relative_to(root).as_posix()
            parts = (*relative_directory.parts, filename)
            if not _excluded(relative, parts, config):
                files.append(path)
    return files


def _python_code_lines(text: str) -> frozenset[int]:
    ignored = {
        tokenize.ENCODING,
        tokenize.ENDMARKER,
        tokenize.INDENT,
        tokenize.DEDENT,
        tokenize.NEWLINE,
        tokenize.NL,
        tokenize.COMMENT,
    }
    lines: set[int] = set()
    try:
        tokens = tokenize.generate_tokens(io.StringIO(text).readline)
        for token in tokens:
            if token.type in ignored or not token.string:
                continue
            lines.update(range(token.start[0], token.end[0] + 1))
    except (IndentationError, tokenize.TokenError):
        for number, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                lines.add(number)
    return frozenset(lines)


_RUST_RAW_STRING = re.compile(r"(?:br|rb|r)(?P<hashes>#{0,255})\"")


def _consume_block_comment(line: str, index: int, depth: int, *, nested: bool) -> tuple[int, int]:
    if not nested:
        end = line.find("*/", index)
        return (len(line), depth) if end < 0 else (end + 2, 0)
    while index < len(line):
        if line.startswith("/*", index):
            depth += 1
            index += 2
        elif line.startswith("*/", index):
            depth -= 1
            index += 2
            if depth == 0:
                break
        else:
            index += 1
    return index, depth


def _rust_lifetime_end(line: str, index: int) -> int | None:
    start = index + 1
    end = start + 1
    if end > len(line) or not line[start:end].isidentifier():
        return None
    while end < len(line) and line[start : end + 1].isidentifier():
        end += 1
    return end


@dataclass(slots=True)
class _LexerState:
    mode: str = "normal"
    raw_terminator: str = ""
    block_depth: int = 0


def _consume_non_normal(line: str, index: int, state: _LexerState, *, rust: bool) -> tuple[int, bool]:
    if state.mode == "block":
        index, state.block_depth = _consume_block_comment(line, index, state.block_depth, nested=rust)
        if state.block_depth == 0:
            state.mode = "normal"
        return index, False
    if state.mode == "raw":
        end = line.find(state.raw_terminator, index)
        if end < 0:
            return len(line), True
        state.mode = "normal"
        return end + len(state.raw_terminator), True
    delimiter = {"single": "'", "double": '"', "template": "`"}[state.mode]
    if line[index] == "\\":
        return index + 2, True
    if line[index] == delimiter:
        state.mode = "normal"
    return index + 1, True


def _consume_normal(line: str, index: int, state: _LexerState, *, rust: bool) -> tuple[int, bool, bool]:
    if line[index].isspace():
        return index + 1, False, False
    if line.startswith("//", index):
        return len(line), False, True
    if line.startswith("/*", index):
        state.mode = "block"
        state.block_depth = 1
        return index + 2, False, False
    raw_match = _RUST_RAW_STRING.match(line, index) if rust else None
    if raw_match:
        state.raw_terminator = '"' + raw_match.group("hashes")
        state.mode = "raw"
        return raw_match.end(), True, False
    character = line[index]
    lifetime_end = _rust_lifetime_end(line, index) if rust and character == "'" else None
    if lifetime_end is not None and (lifetime_end == len(line) or line[lifetime_end] != "'"):
        return lifetime_end, True, False
    if character in {"'", '"', "`"}:
        state.mode = {"'": "single", '"': "double", "`": "template"}[character]
    return index + 1, True, False


def _c_style_code_lines(text: str, *, rust: bool = False) -> frozenset[int]:
    code_lines: set[int] = set()
    state = _LexerState()
    for line_number, line in enumerate(text.splitlines(), start=1):
        index = 0
        has_code = state.mode in {"single", "double", "template", "raw"}
        while index < len(line):
            if state.mode != "normal":
                index, token_is_code = _consume_non_normal(line, index, state, rust=rust)
                has_code = has_code or token_is_code
                continue
            index, token_is_code, stop = _consume_normal(line, index, state, rust=rust)
            has_code = has_code or token_is_code
            if stop:
                break
        if has_code:
            code_lines.add(line_number)
        reset_single = state.mode == "single" and (not line or not line.endswith("\\"))
        reset_non_rust_double = not rust and state.mode == "double" and (not line or not line.endswith("\\"))
        if reset_single or reset_non_rust_double:
            state.mode = "normal"
    return frozenset(code_lines)


def code_line_numbers(path: Path, text: str) -> frozenset[int]:
    if path.suffix.lower() == ".py":
        return _python_code_lines(text)
    return _c_style_code_lines(text, rust=path.suffix.lower() == ".rs")


class _PythonScopeCollector(ast.NodeVisitor):
    def __init__(self, code_lines: frozenset[int]) -> None:
        self.code_lines = code_lines
        self.parents: list[str] = []
        self.metrics: list[ScopeMetric] = []

    def _record(self, node: ast.AST, kind: str, name: str) -> None:
        start = getattr(node, "lineno", 1)
        decorators = getattr(node, "decorator_list", [])
        if decorators:
            start = min(start, *(decorator.lineno for decorator in decorators))
        end = getattr(node, "end_lineno", start)
        symbol = ".".join((*self.parents, name))
        count = sum(start <= line <= end for line in self.code_lines)
        self.metrics.append(ScopeMetric(kind, symbol, start, end, count))

    def _visit_named(self, node: ast.AST, kind: str, name: str) -> None:
        self._record(node, kind, name)
        self.parents.append(name)
        self.generic_visit(node)
        self.parents.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_named(node, "function", node.name)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_named(node, "function", node.name)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self._visit_named(node, "class", node.name)


def _python_scopes(text: str, code_lines: frozenset[int]) -> tuple[ScopeMetric, ...]:
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        raise SourceScanError(f"invalid Python syntax at line {exc.lineno}: {exc.msg}") from exc
    collector = _PythonScopeCollector(code_lines)
    collector.visit(tree)
    return tuple(collector.metrics)


def scan_file(path: Path, root: Path) -> SourceMetrics:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise SourceScanError(f"could not read {path}: {exc}") from exc
    lines = code_line_numbers(path, text)
    suffix = path.suffix.lower()
    scopes = _python_scopes(text, lines) if suffix == ".py" else ()
    rust_functions: tuple[RustFunctionMetric, ...] = ()
    if suffix == ".rs":
        try:
            rust_scopes, rust_functions = analyze_rust(text)
        except RustAnalysisError as exc:
            raise SourceScanError(f"could not analyze {path}: {exc}") from exc
        scopes = tuple(
            ScopeMetric(
                scope.kind,
                scope.symbol,
                scope.start_line,
                scope.end_line,
                sum(scope.start_line <= line <= scope.end_line for line in lines),
            )
            for scope in rust_scopes
        )
    return SourceMetrics(
        path=path,
        relative_path=path.relative_to(root).as_posix(),
        physical_lines=len(text.splitlines()),
        code_line_numbers=lines,
        scopes=scopes,
        rust_functions=rust_functions,
    )


def scan_repository(root: Path, config: QualityConfig) -> list[SourceMetrics]:
    return [scan_file(path, root) for path in discover_source_files(root, config)]


def _file_severity(actual: int, config: QualityConfig) -> Severity | None:
    if actual > config.file.maximum:
        return Severity.ERROR
    if actual > config.file.strong_warning:
        return Severity.STRONG_WARNING
    if actual > config.file.warning:
        return Severity.WARNING
    return None


def size_result(metrics: list[SourceMetrics], config: QualityConfig) -> CheckResult:
    result = CheckResult("Size", files_checked=len(metrics))
    for source in metrics:
        severity = _file_severity(source.code_lines, config)
        if severity is not None:
            result.findings.append(
                Finding(
                    RULES["CQ001"],
                    severity,
                    source.relative_path,
                    f"File contains {source.code_lines} code lines.",
                    source.code_lines,
                    config.file.maximum
                    if severity is Severity.ERROR
                    else (config.file.strong_warning if severity is Severity.STRONG_WARNING else config.file.warning),
                )
            )
        if source.physical_lines > config.file.physical_warning:
            result.findings.append(
                Finding(
                    RULES["CQ002"],
                    Severity.WARNING,
                    source.relative_path,
                    f"File contains {source.physical_lines} physical lines.",
                    source.physical_lines,
                    config.file.physical_warning,
                )
            )
        for scope in source.scopes:
            limits = config.function if scope.kind == "function" else config.class_
            severity = limits.classify(scope.code_lines)
            if severity is None:
                continue
            rule_id = "CQ101" if scope.kind == "function" else "CQ201"
            result.findings.append(
                Finding(
                    RULES[rule_id],
                    severity,
                    source.relative_path,
                    f"{scope.kind.title()} contains {scope.code_lines} code lines.",
                    scope.code_lines,
                    limits.maximum
                    if severity is Severity.ERROR
                    else (limits.strong_warning if severity is Severity.STRONG_WARNING else limits.warning),
                    symbol=scope.symbol,
                    line=scope.start_line,
                )
            )
    return result
