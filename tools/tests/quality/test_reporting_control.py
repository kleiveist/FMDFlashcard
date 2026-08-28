from __future__ import annotations

import argparse
import json

import pytest

from tools.quality import control
from tools.quality.config import QualityConfigError
from tools.quality.model import RULES, CheckResult, Finding, Severity
from tools.quality.reporter import print_report


def _finding(severity: Severity) -> Finding:
    return Finding(
        RULES["CQ001"],
        severity,
        "example.py",
        "File contains too many code lines.",
        actual=901 if severity is Severity.ERROR else 601,
        threshold=900 if severity is Severity.ERROR else 600,
    )


@pytest.mark.parametrize(
    ("severity", "expected_exit"),
    [(Severity.WARNING, 0), (Severity.STRONG_WARNING, 0), (Severity.ERROR, 1)],
)
def test_quality_exit_code_depends_only_on_blocking_results(
    monkeypatch,
    capsys,
    severity: Severity,
    expected_exit: int,
) -> None:
    monkeypatch.setattr(
        control,
        "_run",
        lambda _args, _root: [CheckResult("Size", findings=[_finding(severity)])],
    )
    args = argparse.Namespace(output_format="text")

    assert control.main(args) == expected_exit
    assert "Quality gate:" in capsys.readouterr().out


@pytest.mark.parametrize(
    ("severities", "expected_exit"),
    [
        ([], 0),
        ([Severity.INFO], 0),
        ([Severity.WARNING, Severity.STRONG_WARNING, Severity.WARNING], 0),
        ([Severity.WARNING, Severity.ERROR], 1),
    ],
)
def test_quality_exit_code_handles_empty_and_combined_findings(
    monkeypatch,
    capsys,
    severities: list[Severity],
    expected_exit: int,
) -> None:
    findings = [_finding(severity) for severity in severities]
    monkeypatch.setattr(
        control,
        "_run",
        lambda _args, _root: [CheckResult("Combined", findings=findings)],
    )

    assert control.main(argparse.Namespace(output_format="text")) == expected_exit
    assert "Quality gate:" in capsys.readouterr().out


def test_failed_external_tool_fails_the_gate(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        control,
        "_run",
        lambda _args, _root: [CheckResult("Python lint", passed=False, detail="Ruff failed")],
    )

    assert control.main(argparse.Namespace(output_format="text")) == 1
    assert "QUALITY TOOL ERROR" in capsys.readouterr().out


def test_release_policy_fails_on_unsuppressed_strong_warning() -> None:
    result = control._release_warning_policy([CheckResult("Size", findings=[_finding(Severity.STRONG_WARNING)])])

    assert result.status == "FAIL"
    assert "1 unsuppressed strong warning" in result.detail
    assert "example.py" in result.detail


def test_release_policy_accepts_suppressed_strong_warning() -> None:
    finding = _finding(Severity.STRONG_WARNING).suppress("Reviewed exception until 2026-09-01")

    result = control._release_warning_policy([CheckResult("Size", findings=[finding])])

    assert result.status == "PASS"


def test_json_report_contains_stable_rule_ids_and_summary(capsys) -> None:
    print_report(
        [CheckResult("Size", findings=[_finding(Severity.ERROR)], files_checked=1)],
        "json",
    )

    payload = json.loads(capsys.readouterr().out)
    assert payload["summary"]["status"] == "FAIL"
    assert payload["summary"]["errors"] == 1
    finding = payload["checks"][0]["findings"][0]
    assert finding["rule_id"] == "CQ001"
    assert finding["path"] == "example.py"
    assert finding["actual"] == 901
    assert finding["threshold"] == 900


def test_text_report_contains_rule_path_value_and_threshold(capsys) -> None:
    print_report([CheckResult("Size", findings=[_finding(Severity.ERROR)])], "text")

    output = capsys.readouterr().out
    assert "File: example.py" in output
    assert "Rule: CQ001 FILE_CODE_LINES" in output
    assert "Actual: 901" in output
    assert "Maximum: 900" in output


def test_configuration_failure_respects_json_output(monkeypatch, capsys) -> None:
    def fail(_args, _root):
        raise QualityConfigError("invalid policy")

    monkeypatch.setattr(control, "_run", fail)

    assert control.main(argparse.Namespace(output_format="json")) == 2
    payload = json.loads(capsys.readouterr().out)
    assert payload["summary"]["status"] == "FAIL"
    assert payload["summary"]["checks_failed"] == 1
    assert payload["checks"][0]["name"] == "Quality configuration"
    assert "invalid policy" in payload["checks"][0]["detail"]
