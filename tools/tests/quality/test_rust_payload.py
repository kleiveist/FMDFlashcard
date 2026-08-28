from __future__ import annotations

import subprocess
from copy import deepcopy
from pathlib import Path

import pytest

from tools.quality import rust

VALID_PAYLOAD = {
    "scopes": [
        {"kind": "class", "symbol": "Service", "start_line": 1, "end_line": 4},
        {"kind": "function", "symbol": "Service::run", "start_line": 2, "end_line": 3},
    ],
    "functions": [
        {
            "symbol": "Service::run",
            "start_line": 2,
            "end_line": 3,
            "complexity": 1,
            "nesting": 0,
            "parameters": 0,
        }
    ],
}


def test_rust_analyzer_subprocess_contract_is_binary_utf8(monkeypatch, tmp_path: Path) -> None:
    python = tmp_path / "python"
    python.touch()
    calls: list[tuple[list[str], dict[str, object]]] = []

    def fake_run(command: list[str], **kwargs) -> subprocess.CompletedProcess[bytes]:
        calls.append((command, kwargs))
        return subprocess.CompletedProcess(command, 0, stdout=b'{"functions":[],"scopes":[]}\n', stderr=b"")

    monkeypatch.setattr(rust, "_tooling_python", lambda: python)
    monkeypatch.setattr(rust.subprocess, "run", fake_run)

    assert rust._run_analyzer("struct Δ;\r\n") == {"functions": [], "scopes": []}
    assert len(calls) == 1
    _command, kwargs = calls[0]
    assert kwargs["input"] == "struct Δ;\r\n".encode()
    assert "text" not in kwargs
    assert "encoding" not in kwargs


def test_rust_analyzer_subprocess_rejects_non_utf8_output(monkeypatch, tmp_path: Path) -> None:
    python = tmp_path / "python"
    python.touch()
    monkeypatch.setattr(rust, "_tooling_python", lambda: python)
    monkeypatch.setattr(
        rust.subprocess,
        "run",
        lambda command, **_kwargs: subprocess.CompletedProcess(command, 0, stdout=b"\xff", stderr=b""),
    )

    with pytest.raises(rust.RustAnalysisError, match="could not start"):
        rust._run_analyzer("struct Measured;")


def test_rust_payload_contract_accepts_consistent_metrics(monkeypatch) -> None:
    monkeypatch.setattr(rust, "_analysis_payload", lambda _text: deepcopy(VALID_PAYLOAD))

    scopes, functions = rust.analyze_rust("struct Service;\nimpl Service {\n    fn run() {}\n}\n")

    assert [(scope.kind, scope.symbol) for scope in scopes] == [
        ("class", "Service"),
        ("function", "Service::run"),
    ]
    assert functions[0].complexity == 1


@pytest.mark.parametrize(
    "mutate",
    [
        lambda payload: payload["scopes"][0].update(kind="module"),
        lambda payload: payload["scopes"][0].update(start_line=0),
        lambda payload: payload["scopes"][0].update(start_line=4, end_line=3),
        lambda payload: payload["functions"][0].update(complexity=0),
        lambda payload: payload["functions"][0].update(nesting=None),
        lambda payload: payload["functions"][0].update(parameters=-1),
        lambda payload: payload["functions"].append(deepcopy(payload["functions"][0])),
        lambda payload: payload["scopes"].append(deepcopy(payload["scopes"][0])),
        lambda payload: payload["functions"][0].update(end_line=4),
    ],
    ids=[
        "unknown-kind",
        "zero-start",
        "end-before-start",
        "zero-complexity",
        "partial-control-metrics",
        "negative-parameters",
        "duplicate-function",
        "duplicate-scope",
        "inconsistent-scope",
    ],
)
def test_rust_payload_contract_rejects_invalid_or_inconsistent_data(monkeypatch, mutate) -> None:
    payload = deepcopy(VALID_PAYLOAD)
    mutate(payload)
    monkeypatch.setattr(rust, "_analysis_payload", lambda _text: payload)

    with pytest.raises(rust.RustAnalysisError):
        rust.analyze_rust("struct Service;\nimpl Service {\n    fn run() {}\n}\n")


def test_rust_payload_contract_rejects_spans_outside_input(monkeypatch) -> None:
    monkeypatch.setattr(rust, "_analysis_payload", lambda _text: deepcopy(VALID_PAYLOAD))

    with pytest.raises(rust.RustAnalysisError, match="line span"):
        rust.analyze_rust("struct Service;\n")


def test_rust_payload_contract_rejects_scopes_for_empty_input(monkeypatch) -> None:
    monkeypatch.setattr(rust, "_analysis_payload", lambda _text: deepcopy(VALID_PAYLOAD))

    with pytest.raises(rust.RustAnalysisError, match="empty source"):
        rust.analyze_rust("")
