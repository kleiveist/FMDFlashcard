from __future__ import annotations

import json
from collections import Counter
from typing import Any

from tools.quality.model import CheckResult, Finding, Severity


def _active_findings(results: list[CheckResult]) -> list[Finding]:
    return [finding for result in results for finding in result.findings if not finding.suppressed]


def _suppressed_findings(results: list[CheckResult]) -> list[Finding]:
    return [finding for result in results for finding in result.findings if finding.suppressed]


def summary_payload(results: list[CheckResult]) -> dict[str, Any]:
    findings = _active_findings(results)
    counts = Counter(finding.severity.label for finding in findings)
    return {
        "files_checked": max((result.files_checked for result in results), default=0),
        "errors": counts[Severity.ERROR.label],
        "strong_warnings": counts[Severity.STRONG_WARNING.label],
        "warnings": counts[Severity.WARNING.label],
        "info": counts[Severity.INFO.label],
        "suppressed": len(_suppressed_findings(results)),
        "checks_failed": sum(result.status == "FAIL" for result in results),
        "status": "PASS" if all(result.status == "PASS" for result in results) else "FAIL",
    }


def report_payload(results: list[CheckResult]) -> dict[str, Any]:
    return {
        "summary": summary_payload(results),
        "checks": [
            {
                "name": result.name,
                "status": result.status,
                "detail": result.detail,
                "files_checked": result.files_checked,
                "findings": [finding.to_dict() for finding in result.findings],
                "output": result.output,
            }
            for result in results
        ],
    }


def _print_finding(finding: Finding) -> None:
    status = "SUPPRESSED" if finding.suppressed else finding.severity.label.replace("_", " ")
    print(f"\nCODE QUALITY {status}")
    print("")
    print(f"File: {finding.path}" + (f":{finding.line}" if finding.line else ""))
    print(f"Rule: {finding.rule.rule_id} {finding.rule.name}")
    if finding.symbol:
        print(f"Symbol: {finding.symbol}")
    if finding.actual is not None:
        print(f"Actual: {finding.actual}")
    if finding.threshold is not None:
        label = "Maximum" if finding.severity is Severity.ERROR else "Threshold"
        print(f"{label}: {finding.threshold}")
    print(f"Detail: {finding.message}")
    action_label = "Recommendation" if finding.severity < Severity.ERROR else "Required action"
    print(f"{action_label}: {finding.action or finding.rule.default_action}")
    if finding.suppressed_reason:
        print(f"Exception: {finding.suppressed_reason}")


def _print_failed_check(result: CheckResult) -> None:
    if result.status != "FAIL" or result.errors:
        return
    print(f"\nQUALITY TOOL ERROR: {result.name}")
    if result.detail:
        print(f"Detail: {result.detail}")
    if result.output:
        print("Output:")
        print(result.output.rstrip())


def print_text_report(results: list[CheckResult]) -> None:
    for result in results:
        for finding in result.findings:
            _print_finding(finding)
        _print_failed_check(result)

    summary = summary_payload(results)
    print("\nCode Quality Summary")
    print("")
    print(f"Files checked: {summary['files_checked']}")
    print(f"Errors: {summary['errors']}")
    print(f"Strong warnings: {summary['strong_warnings']}")
    print(f"Warnings: {summary['warnings']}")
    print(f"Suppressed findings: {summary['suppressed']}")
    print("")
    for result in results:
        detail = f" — {result.detail}" if result.detail else ""
        print(f"{result.name}: {result.status}{detail}")
    print(f"\nQuality gate: {summary['status']}")


def print_report(results: list[CheckResult], output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(report_payload(results), indent=2, sort_keys=True))
        return
    print_text_report(results)
