from __future__ import annotations

from dataclasses import replace
from datetime import date
from pathlib import Path

from tools.quality.model import CheckResult, ExceptionEntry, Finding, RULES, Severity


def _parse_expiration(value: str) -> date:
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        raise ValueError
    if not (value[:4] + value[5:7] + value[8:]).isdigit():
        raise ValueError
    expiration = date.fromisoformat(value)
    if expiration.isoformat() != value:
        raise ValueError
    return expiration


def validate_exceptions(
    root: Path,
    entries: tuple[ExceptionEntry, ...],
    *,
    today: date | None = None,
    scanned_paths: frozenset[str] | None = None,
) -> tuple[CheckResult, tuple[ExceptionEntry, ...]]:
    result = CheckResult("Exceptions")
    current_date = today or date.today()
    valid: list[ExceptionEntry] = []
    for entry in entries:
        try:
            expiration = _parse_expiration(entry.expires)
        except ValueError:
            result.findings.append(
                Finding(
                    RULES["EX001"],
                    Severity.ERROR,
                    "config/code-quality.toml",
                    f"Exception for {entry.rule_id} at {entry.path} has an invalid ISO expiration date.",
                    actual=entry.expires,
                    threshold="YYYY-MM-DD",
                    symbol=entry.symbol,
                )
            )
            continue
        if not (root / entry.path).is_file():
            result.findings.append(
                Finding(
                    RULES["EX001"],
                    Severity.ERROR,
                    "config/code-quality.toml",
                    f"Exception for {entry.rule_id} references a file that does not exist: {entry.path}.",
                    actual=entry.path,
                    symbol=entry.symbol,
                )
            )
            continue
        if scanned_paths is not None and entry.path not in scanned_paths:
            result.findings.append(
                Finding(
                    RULES["EX001"],
                    Severity.ERROR,
                    "config/code-quality.toml",
                    f"Exception for {entry.rule_id} references a file outside the active source scan: {entry.path}.",
                    actual=entry.path,
                    threshold="included handwritten source file",
                    symbol=entry.symbol,
                )
            )
            continue
        if expiration < current_date:
            result.findings.append(
                Finding(
                    RULES["EX002"],
                    Severity.ERROR,
                    entry.path,
                    f"Exception for {entry.rule_id} expired on {entry.expires}.",
                    actual=entry.expires,
                    threshold=current_date.isoformat(),
                    symbol=entry.symbol,
                )
            )
            continue
        valid.append(entry)
    return result, tuple(valid)


def _matching_exception(finding: Finding, entries: tuple[ExceptionEntry, ...]) -> ExceptionEntry | None:
    for entry in entries:
        if entry.rule_id != finding.rule.rule_id or entry.path != finding.path:
            continue
        if entry.symbol is not None and entry.symbol != finding.symbol:
            continue
        return entry
    return None


def apply_exceptions(results: list[CheckResult], entries: tuple[ExceptionEntry, ...]) -> None:
    for result in results:
        updated: list[Finding] = []
        for finding in result.findings:
            if finding.rule.rule_id == "CQ001" and finding.severity is Severity.ERROR:
                updated.append(finding)
                continue
            exception = _matching_exception(finding, entries)
            if exception is None:
                updated.append(finding)
                continue
            explanation = f"{exception.reason} (expires {exception.expires})"
            updated.append(replace(finding, suppressed_reason=explanation))
        result.findings = updated
