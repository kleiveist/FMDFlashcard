from __future__ import annotations

from pathlib import Path

from tools.core.context import TOOLS_ROOT, load_context
from tools.integration.model import Finding, VerificationResult
from tools.integration.verify import aggregate_results, verify_adapters


class _Adapter:
    def __init__(self, name: str, result: object) -> None:
        self.name = name
        self._result = result

    def verify(self, _context):
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


def test_adapter_findings_are_aggregated_deterministically(tmp_path: Path) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)
    result = verify_adapters(
        context,
        (
            _Adapter("zeta", (Finding("z", "WARN", "review"),)),
            _Adapter("alpha", VerificationResult((Finding("a", "PASS", "ready"),))),
        ),
    )

    assert result.ok
    assert [(item.adapter, item.check) for item in result.findings] == [
        ("alpha", "a"),
        ("zeta", "z"),
    ]


def test_adapter_exception_becomes_failure_and_does_not_stop_peers(
    tmp_path: Path,
) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)
    result = verify_adapters(
        context,
        (
            _Adapter("broken", ValueError("invalid configuration")),
            _Adapter("healthy", Finding("health", "PASS", "ready")),
        ),
    )

    assert not result.ok
    assert len(result.findings) == 2
    assert result.failures[0].adapter == "broken"
    assert "ValueError" in result.failures[0].message


def test_invalid_adapter_result_is_a_failure_finding(tmp_path: Path) -> None:
    context = load_context(project_root=tmp_path, tools_root=TOOLS_ROOT)

    result = verify_adapters(context, (_Adapter("invalid", "not findings"),))

    assert not result.ok
    assert result.failures[0].check == "adapter-verification"


def test_direct_results_can_be_combined() -> None:
    result = aggregate_results(
        (
            Finding("b", "WARN", "review"),
            VerificationResult((Finding("a", "PASS", "ready"),)),
        )
    )

    assert [finding.check for finding in result.findings] == ["a", "b"]
