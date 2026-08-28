"""Aggregation of independent adapter verification findings."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import replace
from typing import Any, Protocol, runtime_checkable

from tools.core.context import ProjectContext
from tools.integration.model import (
    Finding,
    FindingStatus,
    VerificationError,
    VerificationResult,
)


@runtime_checkable
class VerificationAdapter(Protocol):
    """Minimal adapter surface consumed by the integration verifier."""

    name: str

    def verify(
        self, context: ProjectContext
    ) -> VerificationResult | Finding | Iterable[Finding]: ...


Verifier = (
    VerificationAdapter
    | Callable[[ProjectContext], VerificationResult | Finding | Iterable[Finding]]
)


def verify_adapters(
    context: ProjectContext, adapters: Iterable[Verifier]
) -> VerificationResult:
    """Run every verifier, converting one adapter failure into one FAIL finding."""

    named = sorted(
        ((_adapter_name(adapter), adapter) for adapter in adapters),
        key=lambda item: item[0],
    )
    findings: list[Finding] = []
    for name, adapter in named:
        try:
            verify = getattr(adapter, "verify", None)
            raw = verify(context) if callable(verify) else adapter(context)  # type: ignore[operator]
            findings.extend(_normalize_findings(raw, adapter=name))
        except Exception as exc:  # noqa: BLE001 - one broken adapter must not stop peer verification
            findings.append(
                Finding(
                    check="adapter-verification",
                    status=FindingStatus.FAIL,
                    message=f"{type(exc).__name__}: {exc}",
                    adapter=name,
                )
            )
    return VerificationResult(tuple(sorted(findings, key=_finding_key)))


def aggregate_results(
    results: Iterable[VerificationResult | Finding | Iterable[Finding]],
) -> VerificationResult:
    findings: list[Finding] = []
    for result in results:
        findings.extend(_normalize_findings(result, adapter=None))
    return VerificationResult(tuple(sorted(findings, key=_finding_key)))


def _normalize_findings(value: Any, *, adapter: str | None) -> list[Finding]:
    if isinstance(value, VerificationResult):
        items = value.findings
    elif isinstance(value, Finding):
        items = (value,)
    else:
        if isinstance(value, (str, bytes)):
            raise VerificationError(
                "Verifier returned text instead of Finding objects."
            )
        try:
            items = tuple(value)
        except TypeError as exc:
            raise VerificationError("Verifier returned an unsupported result.") from exc
    normalized: list[Finding] = []
    for item in items:
        if not isinstance(item, Finding):
            raise VerificationError(
                f"Verifier returned {type(item).__name__} instead of Finding."
            )
        normalized.append(
            replace(item, adapter=adapter)
            if adapter is not None and item.adapter is None
            else item
        )
    return normalized


def _adapter_name(adapter: Verifier) -> str:
    value = getattr(adapter, "name", None)
    if isinstance(value, str) and value.strip():
        return value.strip()
    function_name = getattr(adapter, "__name__", None)
    if isinstance(function_name, str) and function_name:
        return function_name
    return type(adapter).__name__


def _finding_key(finding: Finding) -> tuple[str, str, str, str, str]:
    return (
        finding.adapter or "",
        finding.check,
        finding.path or "",
        finding.status.value,
        finding.message,
    )


verify = verify_adapters
