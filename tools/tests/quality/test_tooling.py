from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from tools.quality import tooling
from tools.quality.exceptions import apply_exceptions
from tools.quality.model import CheckResult, ExceptionEntry, QualityConfig, Severity
from tools.quality.scanner import ScopeMetric, SourceMetrics, scan_file
from tools.quality.typescript import (
    TypeScriptAnalysis,
    TypeScriptClass,
    TypeScriptFunction,
    add_class_findings,
)

ROOT = Path(__file__).resolve().parents[3]


def _python_metric(tmp_path: Path) -> SourceMetrics:
    path = tmp_path / "sample.py"
    path.write_text("def measured():\n    return True\n", encoding="utf-8")
    return SourceMetrics(
        path,
        "sample.py",
        2,
        frozenset({1, 2}),
        (ScopeMetric("function", "measured", 1, 2, 2),),
    )


@pytest.mark.parametrize(
    ("code", "message", "rule_id", "expected"),
    [
        ("C901", "`measured` is too complex (21 > 10)", "CQ102", Severity.ERROR),
        ("PLR1702", "Too many nested blocks (5 > 3)", "CQ103", Severity.STRONG_WARNING),
        (
            "PLR0913",
            "Too many arguments in function definition (8 > 5)",
            "CQ104",
            Severity.WARNING,
        ),
    ],
)
def test_ruff_metrics_are_classified_from_central_limits(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
    code: str,
    message: str,
    rule_id: str,
    expected: Severity,
) -> None:
    payload = [
        {
            "code": code,
            "filename": str(tmp_path / "sample.py"),
            "location": {"row": 1, "column": 1},
            "message": message,
        }
    ]
    monkeypatch.setattr(tooling, "_ruff", lambda _root: "ruff")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["ruff"], 1, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_python_metrics(
        tmp_path, [_python_metric(tmp_path)], quality_config
    )

    assert result.status == ("FAIL" if expected is Severity.ERROR else "PASS")
    assert [
        (finding.rule.rule_id, finding.severity) for finding in result.findings
    ] == [(rule_id, expected)]


def test_duplicate_ruff_nesting_diagnostics_collapse_to_the_highest_depth(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    payload = [
        {
            "code": "PLR1702",
            "filename": str(tmp_path / "sample.py"),
            "location": {"row": 2, "column": 1},
            "message": f"Too many nested blocks ({depth} > 3)",
        }
        for depth in (4, 5)
    ]
    monkeypatch.setattr(tooling, "_ruff", lambda _root: "ruff")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["ruff"], 1, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_python_metrics(
        tmp_path, [_python_metric(tmp_path)], quality_config
    )

    assert len(result.findings) == 1
    assert result.findings[0].actual == 5
    assert result.findings[0].symbol == "measured"


def test_ruff_metrics_use_qualified_ast_symbols_as_distinct_exception_keys(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    source = tmp_path / "sample.py"
    source.write_text(
        "class Alpha:\n    def measured(self):\n        return True\n\n"
        "class Beta:\n    def measured(self):\n        return False\n",
        encoding="utf-8",
    )
    metric = scan_file(source, tmp_path)
    payload = [
        {
            "code": "C901",
            "filename": str(source),
            "location": {"row": line, "column": 5},
            "message": "`measured` is too complex (11 > 10)",
        }
        for line in (2, 6)
    ]
    monkeypatch.setattr(tooling, "_ruff", lambda _root: "ruff")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["ruff"], 1, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_python_metrics(tmp_path, [metric], quality_config)
    apply_exceptions(
        [result],
        (
            ExceptionEntry(
                "CQ102",
                "sample.py",
                "Reviewed complexity in the Alpha adapter only.",
                "2099-01-01",
                "Alpha.measured",
            ),
        ),
    )

    assert [finding.symbol for finding in result.findings] == [
        "Alpha.measured",
        "Beta.measured",
    ]
    assert [finding.suppressed for finding in result.findings] == [True, False]


def test_real_ruff_metrics_ignore_inline_noqa(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    source = tmp_path / "suppressed.py"
    branches = "\n".join(f"    if value == {index}: result += 1" for index in range(21))
    source.write_text(
        f"def measured(value):  # noqa: C901\n    result = 0\n{branches}\n    return result\n",
        encoding="utf-8",
    )
    ruff = tooling._ruff(ROOT)
    if ruff is None:
        pytest.skip("Ruff is not installed")
    monkeypatch.setattr(tooling, "_ruff", lambda _root: ruff)

    result = tooling.run_python_metrics(
        tmp_path, [scan_file(source, tmp_path)], quality_config
    )

    assert any(finding.rule.rule_id == "CQ102" for finding in result.findings)
    assert result.status == "FAIL"


@pytest.mark.parametrize(
    ("eslint_rule", "message", "rule_id", "expected"),
    [
        (
            "complexity",
            "Function has a complexity of 21. Maximum allowed is 10.",
            "CQ102",
            Severity.ERROR,
        ),
        (
            "max-depth",
            "Blocks are nested too deeply (4). Maximum allowed is 3.",
            "CQ103",
            Severity.WARNING,
        ),
        (
            "max-params",
            "Function has too many parameters (9). Maximum allowed is 5.",
            "CQ104",
            Severity.STRONG_WARNING,
        ),
        (
            "max-lines-per-function",
            "Function has too many lines (121). Maximum allowed is 50.",
            "CQ101",
            Severity.ERROR,
        ),
    ],
)
def test_eslint_metrics_are_classified_from_central_limits(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
    eslint_rule: str,
    message: str,
    rule_id: str,
    expected: Severity,
) -> None:
    frontend = tmp_path / "frontend"
    source = frontend / "src/sample.ts"
    source.parent.mkdir(parents=True)
    source.write_text("export const value = true;\n", encoding="utf-8")
    metric = SourceMetrics(source, "frontend/src/sample.ts", 1, frozenset({1}), ())
    payload = [
        {
            "filePath": str(source),
            "messages": [{"ruleId": eslint_rule, "message": message, "line": 1}],
        }
    ]
    monkeypatch.setattr(tooling, "_frontend_binary", lambda _root, _name: "eslint")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["eslint"], 0, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_typescript_metrics(tmp_path, [metric], quality_config)

    assert result.findings[0].rule.rule_id == rule_id
    assert result.findings[0].severity is expected
    assert result.status == ("FAIL" if expected is Severity.ERROR else "PASS")


def test_eslint_metric_uses_ast_function_symbol_for_narrow_exceptions(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    frontend = tmp_path / "frontend"
    source = frontend / "src/sample.ts"
    source.parent.mkdir(parents=True)
    source.write_text("export function measured() { return true; }\n", encoding="utf-8")
    metric = SourceMetrics(source, "frontend/src/sample.ts", 1, frozenset({1}), ())
    analysis = TypeScriptAnalysis(
        (),
        (),
        (TypeScriptFunction("frontend/src/sample.ts", "measured", 1, 1),),
    )
    payload = [
        {
            "filePath": str(source),
            "messages": [
                {
                    "ruleId": "max-depth",
                    "message": "Blocks are nested too deeply (4). Maximum allowed is 3.",
                    "line": 1,
                }
            ],
        }
    ]
    monkeypatch.setattr(tooling, "_frontend_binary", lambda _root, _name: "eslint")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["eslint"], 1, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_typescript_metrics(
        tmp_path, [metric], quality_config, analysis
    )

    assert result.findings[0].symbol == "measured"


def test_eslint_metrics_prefer_class_qualified_ast_symbols_for_exact_exception_scope(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    frontend = tmp_path / "frontend"
    source = frontend / "src/sample.ts"
    source.parent.mkdir(parents=True)
    source.write_text(
        "class Alpha {\n  measured() { return true; }\n}\nclass Beta {\n  measured() { return false; }\n}\n",
        encoding="utf-8",
    )
    relative = "frontend/src/sample.ts"
    metric = SourceMetrics(source, relative, 6, frozenset(range(1, 7)), ())
    analysis = TypeScriptAnalysis(
        (),
        (),
        (
            TypeScriptFunction(relative, "Alpha.measured", 2, 2),
            TypeScriptFunction(relative, "Beta.measured", 5, 5),
        ),
    )
    metric_message = "Method 'measured' has a complexity of 11. Maximum allowed is 10."
    payload = [
        {
            "filePath": str(source),
            "messages": [
                {"ruleId": "complexity", "message": metric_message, "line": line}
                for line in (2, 5)
            ],
        }
    ]
    monkeypatch.setattr(tooling, "_frontend_binary", lambda _root, _name: "eslint")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["eslint"], 1, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_typescript_metrics(
        tmp_path, [metric], quality_config, analysis
    )
    apply_exceptions(
        [result],
        (
            ExceptionEntry(
                "CQ102",
                relative,
                "Reviewed complexity in the Alpha adapter only.",
                "2099-01-01",
                "Alpha.measured",
            ),
        ),
    )

    assert [finding.symbol for finding in result.findings] == [
        "Alpha.measured",
        "Beta.measured",
    ]
    assert [finding.suppressed for finding in result.findings] == [True, False]


def test_eslint_metrics_fall_back_to_message_symbol_without_ast(
    quality_config: QualityConfig,
) -> None:
    finding, error = tooling._eslint_metric_finding(
        {
            "ruleId": "complexity",
            "message": "Method 'measured' has a complexity of 11. Maximum allowed is 10.",
            "line": 2,
        },
        "frontend/src/sample.ts",
        {"complexity": ("CQ102", quality_config.complexity)},
        None,
    )

    assert error == ""
    assert finding is not None
    assert finding.symbol == "measured"


def test_eslint_fatal_parser_error_fails_metric_analysis(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    frontend = tmp_path / "frontend"
    source = frontend / "src/invalid.ts"
    source.parent.mkdir(parents=True)
    source.write_text("export function invalid( {\n", encoding="utf-8")
    metric = SourceMetrics(source, "frontend/src/invalid.ts", 1, frozenset({1}), ())
    payload = [
        {
            "filePath": str(source),
            "messages": [{"fatal": True, "message": "Parsing error", "line": 1}],
        }
    ]
    monkeypatch.setattr(tooling, "_frontend_binary", lambda _root, _name: "eslint")
    monkeypatch.setattr(
        tooling,
        "_run",
        lambda *_args, **_kwargs: subprocess.CompletedProcess(
            ["eslint"], 1, stdout=json.dumps(payload), stderr=""
        ),
    )

    result = tooling.run_typescript_metrics(tmp_path, [metric], quality_config)

    assert result.status == "FAIL"
    assert "could not parse frontend/src/invalid.ts" in result.detail


def test_clippy_receives_central_hard_limits(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    (tmp_path / "src-tauri").mkdir()
    (tmp_path / "src-tauri/Cargo.toml").write_text(
        "[package]\nname='test'\n", encoding="utf-8"
    )
    captured: dict[str, str | list[str]] = {}

    def fake_cargo(root, arguments, name, *, env=None):
        captured["arguments"] = arguments
        captured["config"] = (Path(env["CLIPPY_CONF_DIR"]) / "clippy.toml").read_text(
            encoding="utf-8"
        )
        return CheckResult(name)

    monkeypatch.setattr(tooling, "_cargo_command", fake_cargo)

    result = tooling.run_rust_lint(tmp_path, quality_config)

    assert result.status == "PASS"
    assert "too-many-arguments-threshold = 10" in captured["config"]
    assert "too-many-lines-threshold = 120" in captured["config"]
    assert "cognitive-complexity-threshold" not in captured["config"]
    assert "clippy::too_many_lines" in captured["arguments"]
    assert "clippy::cognitive_complexity" not in captured["arguments"]
    assert "--all-targets" in captured["arguments"]
    assert "--all-features" in captured["arguments"]


@pytest.mark.parametrize("suffix", [".rs", ".RS"])
def test_valid_rust_metric_exceptions_widen_only_duplicate_clippy_thresholds(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
    suffix: str,
) -> None:
    tauri = tmp_path / "src-tauri"
    source = tauri / f"src/main{suffix}"
    source.parent.mkdir(parents=True)
    (tauri / "Cargo.toml").write_text("[package]\nname='test'\n", encoding="utf-8")
    parameters = ", ".join(f"value_{index}: usize" for index in range(11))
    statements = "\n".join(f"    let local_{index} = {index};" for index in range(119))
    source.write_text(
        f"fn measured({parameters}) {{\n{statements}\n}}\n", encoding="utf-8"
    )
    metric = scan_file(source, tmp_path)
    exceptions = (
        ExceptionEntry(
            "CQ101",
            metric.relative_path,
            "Reviewed generated adapter boundary.",
            "2099-01-01",
            "measured",
        ),
        ExceptionEntry(
            "CQ104",
            metric.relative_path,
            "Reviewed generated adapter boundary.",
            "2099-01-01",
            "measured",
        ),
    )
    captured: dict[str, str] = {}

    def fake_cargo(_root, _arguments, name, *, env=None):
        captured["config"] = (Path(env["CLIPPY_CONF_DIR"]) / "clippy.toml").read_text(
            encoding="utf-8"
        )
        return CheckResult(name)

    monkeypatch.setattr(tooling, "_cargo_command", fake_cargo)

    result = tooling.run_rust_lint(tmp_path, quality_config, [metric], exceptions)

    assert result.status == "PASS"
    assert "too-many-lines-threshold = 121" in captured["config"]
    assert "too-many-arguments-threshold = 11" in captured["config"]


def test_real_clippy_forbids_inline_allow_for_hard_limit(
    tmp_path: Path, quality_config: QualityConfig
) -> None:
    cargo = tooling.shutil.which("cargo")
    if not (ROOT / "src-tauri/Cargo.toml").is_file():
        pytest.skip("Tauri is not enabled in this project")
    if cargo is None:
        pytest.skip("Cargo is not installed")
    clippy = subprocess.run(
        [cargo, "clippy", "--version"], capture_output=True, text=True, check=False
    )
    if clippy.returncode != 0:
        pytest.skip("Clippy is not installed")
    tauri = tmp_path / "src-tauri"
    source = tauri / "src/main.rs"
    source.parent.mkdir(parents=True)
    (tauri / "Cargo.toml").write_text(
        '[package]\nname = "quality-suppression-probe"\nversion = "0.1.0"\nedition = "2021"\n',
        encoding="utf-8",
    )
    statements = "\n".join(f"    total += {index};" for index in range(121))
    source.write_text(
        f"#[allow(clippy::too_many_lines)]\nfn measured() -> usize {{\n    let mut total = 0;\n"
        f'{statements}\n    total\n}}\n\nfn main() {{ println!("{{}}", measured()); }}\n',
        encoding="utf-8",
    )
    subprocess.run(
        ["cargo", "generate-lockfile", "--manifest-path", str(tauri / "Cargo.toml")],
        check=True,
        capture_output=True,
        text=True,
    )

    result = tooling.run_rust_lint(tmp_path, quality_config)

    assert result.status == "FAIL"
    assert "allow" in result.output.lower() or "too_many_lines" in result.output


def test_rust_check_covers_all_targets_and_features(
    monkeypatch, tmp_path: Path
) -> None:
    (tmp_path / "src-tauri").mkdir()
    (tmp_path / "src-tauri/Cargo.toml").write_text(
        "[package]\nname='test'\n", encoding="utf-8"
    )
    captured: list[str] = []

    def fake_cargo(root, arguments, name, *, env=None):
        del root, env
        captured.extend(arguments)
        return CheckResult(name)

    monkeypatch.setattr(tooling, "_cargo_command", fake_cargo)

    result = tooling.run_rust_check(tmp_path)

    assert result.status == "PASS"
    assert "--all-targets" in captured
    assert "--all-features" in captured


@pytest.mark.parametrize(
    ("line_count", "expected"), [(700, Severity.STRONG_WARNING), (701, Severity.ERROR)]
)
def test_typescript_class_line_hard_boundary(
    tmp_path: Path,
    quality_config: QualityConfig,
    line_count: int,
    expected: Severity,
) -> None:
    path = tmp_path / "frontend/src/class.ts"
    metric = SourceMetrics(
        path,
        "frontend/src/class.ts",
        line_count,
        frozenset(range(1, line_count + 1)),
        (),
    )
    analysis = TypeScriptAnalysis(
        (TypeScriptClass("frontend/src/class.ts", "Measured", 1, line_count),),
        (),
    )
    result = CheckResult("Size")

    add_class_findings(result, analysis, [metric], quality_config)

    assert result.findings[0].severity is expected
    assert result.status == ("FAIL" if expected is Severity.ERROR else "PASS")


def test_qualified_typescript_class_exception_suppresses_only_one_lexical_scope(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    relative = "frontend/src/classes.ts"
    metric = SourceMetrics(
        tmp_path / relative,
        relative,
        602,
        frozenset(range(1, 603)),
        (),
    )
    analysis = TypeScriptAnalysis(
        (
            TypeScriptClass(relative, "A.Service", 1, 301),
            TypeScriptClass(relative, "B.Service", 302, 602),
        ),
        (),
    )
    result = CheckResult("Size")

    add_class_findings(result, analysis, [metric], quality_config)
    apply_exceptions(
        [result],
        (
            ExceptionEntry(
                "CQ201",
                relative,
                "Reviewed size in namespace A only.",
                "2099-01-01",
                "A.Service",
            ),
        ),
    )

    assert [finding.symbol for finding in result.findings] == ["A.Service", "B.Service"]
    assert [finding.suppressed for finding in result.findings] == [True, False]
