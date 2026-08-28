from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from tools.quality import tooling
from tools.quality.model import QualityConfig
from tools.quality.scanner import scan_file


def _completed(command: list[str], returncode: int) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        command,
        returncode,
        stdout="completed" if returncode == 0 else "",
        stderr="" if returncode == 0 else "adapter failed",
    )


@pytest.mark.parametrize(
    ("runner", "action"),
    [
        (tooling.run_python_lint, "check"),
        (tooling.run_python_format, "format"),
    ],
)
@pytest.mark.parametrize("returncode", [0, 1])
def test_ruff_adapters_propagate_success_and_failure(
    monkeypatch,
    tmp_path: Path,
    runner,
    action: str,
    returncode: int,
) -> None:
    source = tmp_path / "sample.py"
    source.write_text("value = 1\n", encoding="utf-8")
    calls: list[tuple[list[str], Path]] = []

    def fake_run(command: list[str], *, cwd: Path, env=None):
        calls.append((command, cwd))
        return _completed(command, returncode)

    monkeypatch.setattr(tooling, "_ruff", lambda _root: "ruff")
    monkeypatch.setattr(tooling, "_run", fake_run)

    result = runner(tmp_path, [scan_file(source, tmp_path)])

    assert result.status == ("PASS" if returncode == 0 else "FAIL")
    assert calls[0][0][0] == "ruff"
    assert calls[0][0][1] == action
    assert calls[0][1] == tmp_path


@pytest.mark.parametrize(
    ("runner", "script"),
    [
        (tooling.run_frontend_lint, "lint"),
        (tooling.run_frontend_format, "format:check"),
        (tooling.run_typescript_check, "typecheck"),
    ],
)
@pytest.mark.parametrize("returncode", [0, 1])
def test_frontend_adapters_propagate_success_and_failure(
    monkeypatch,
    tmp_path: Path,
    runner,
    script: str,
    returncode: int,
) -> None:
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text("{}\n", encoding="utf-8")
    calls: list[tuple[list[str], Path]] = []

    def fake_run(command: list[str], *, cwd: Path, env=None):
        calls.append((command, cwd))
        return _completed(command, returncode)

    monkeypatch.setattr(tooling.shutil, "which", lambda name: name)
    monkeypatch.setattr(tooling, "_run", fake_run)

    result = runner(tmp_path)

    assert result.status == ("PASS" if returncode == 0 else "FAIL")
    expected = ["npm", "run", script]
    if script == "lint":
        expected.extend(
            [
                "--",
                "--no-inline-config",
                "--report-unused-disable-directives-severity",
                "error",
            ]
        )
    assert calls == [(expected, frontend)]


@pytest.mark.parametrize(
    ("runner", "action"),
    [
        (tooling.run_rust_format, "fmt"),
        (tooling.run_rust_check, "check"),
    ],
)
@pytest.mark.parametrize("returncode", [0, 1])
def test_cargo_format_and_check_adapters_propagate_success_and_failure(
    monkeypatch,
    tmp_path: Path,
    runner,
    action: str,
    returncode: int,
) -> None:
    tauri = tmp_path / "src-tauri"
    tauri.mkdir()
    (tauri / "Cargo.toml").write_text("[package]\nname = 'adapter-test'\n", encoding="utf-8")
    calls: list[tuple[list[str], Path]] = []

    def fake_run(command: list[str], *, cwd: Path, env=None):
        calls.append((command, cwd))
        return _completed(command, returncode)

    monkeypatch.setattr(tooling.shutil, "which", lambda name: name)
    monkeypatch.setattr(tooling, "_run", fake_run)

    result = runner(tmp_path)

    assert result.status == ("PASS" if returncode == 0 else "FAIL")
    assert calls[0][0][:2] == ["cargo", action]
    assert calls[0][1] == tmp_path


@pytest.mark.parametrize("returncode", [0, 1])
def test_clippy_adapter_propagates_success_and_failure_with_central_limits(
    monkeypatch,
    tmp_path: Path,
    quality_config: QualityConfig,
    returncode: int,
) -> None:
    tauri = tmp_path / "src-tauri"
    tauri.mkdir()
    (tauri / "Cargo.toml").write_text("[package]\nname = 'adapter-test'\n", encoding="utf-8")
    captured: dict[str, str | list[str]] = {}

    def fake_run(command: list[str], *, cwd: Path, env=None):
        captured["command"] = command
        captured["config"] = (Path(env["CLIPPY_CONF_DIR"]) / "clippy.toml").read_text(encoding="utf-8")
        return _completed(command, returncode)

    monkeypatch.setattr(tooling.shutil, "which", lambda name: name)
    monkeypatch.setattr(tooling, "_run", fake_run)

    result = tooling.run_rust_lint(tmp_path, quality_config)

    command = captured["command"]
    assert isinstance(command, list)
    assert result.status == ("PASS" if returncode == 0 else "FAIL")
    assert command == [
        "cargo",
        "clippy",
        "--locked",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--all-targets",
        "--all-features",
        "--",
        "-F",
        "warnings",
        "-F",
        "clippy::too_many_lines",
        "-F",
        "clippy::too_many_arguments",
    ]
    assert "too-many-arguments-threshold = 10" in captured["config"]
    assert "too-many-lines-threshold = 120" in captured["config"]
    assert "cognitive-complexity-threshold" not in captured["config"]
