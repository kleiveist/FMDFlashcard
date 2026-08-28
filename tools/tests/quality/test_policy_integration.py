from __future__ import annotations

import argparse
import json
from pathlib import Path

import pytest

from tools import control as root_control
from tools.quality import control as quality_control


def _size_args() -> argparse.Namespace:
    return argparse.Namespace(
        quality_command="size",
        config=Path("config/code-quality.toml"),
        output_format="json",
    )


def _run_size_gate(
    monkeypatch,
    capsys,
    tmp_path: Path,
    quality_config_text: str,
    source: str,
) -> tuple[int, dict]:
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    (config_dir / "code-quality.toml").write_text(quality_config_text, encoding="utf-8")
    (tmp_path / "source.py").write_text(source, encoding="utf-8")
    monkeypatch.setattr(quality_control, "ROOT", tmp_path)

    exit_code = quality_control.main(_size_args())
    return exit_code, json.loads(capsys.readouterr().out)


def test_900_code_lines_are_a_nonblocking_strong_warning_in_the_real_gate(
    monkeypatch,
    capsys,
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    source = "\n".join(f"value_{index} = {index}" for index in range(900))

    exit_code, payload = _run_size_gate(monkeypatch, capsys, tmp_path, quality_config_text, source)

    finding = next(item for check in payload["checks"] for item in check["findings"] if item["rule_id"] == "CQ001")
    assert exit_code == 0
    assert payload["summary"]["status"] == "PASS"
    assert finding["severity"] == "STRONG_WARNING"
    assert finding["actual"] == 900
    assert finding["threshold"] == 750


def test_1201_physical_lines_are_a_nonblocking_warning_in_the_real_gate(
    monkeypatch,
    capsys,
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    source = "\n".join(["value = 1", *["# comment only"] * 1200])

    exit_code, payload = _run_size_gate(monkeypatch, capsys, tmp_path, quality_config_text, source)

    finding = next(item for check in payload["checks"] for item in check["findings"] if item["rule_id"] == "CQ002")
    assert exit_code == 0
    assert payload["summary"]["status"] == "PASS"
    assert finding["severity"] == "WARNING"
    assert finding["actual"] == 1201
    assert finding["threshold"] == 1200


def test_missing_quality_configuration_returns_exit_code_two(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(quality_control, "ROOT", tmp_path)

    assert quality_control.main(_size_args()) == 2


def test_quality_help_is_public_and_describes_focused_checks(capsys) -> None:
    with pytest.raises(SystemExit) as raised:
        root_control.main(["quality", "--help"])

    assert raised.value.code == 0
    output = capsys.readouterr().out
    assert "Run the repository quality gate" in output
    assert "focused check to run" in output
    assert "architecture" in output
    assert "--release" in output


def test_unknown_quality_subcommand_returns_argparse_error(capsys) -> None:
    with pytest.raises(SystemExit) as raised:
        root_control.main(["quality", "unknown-check"])

    assert raised.value.code == 2
    error = capsys.readouterr().err
    assert "invalid choice" in error
    assert "unknown-check" in error


def test_root_dispatcher_preserves_quality_failure_exit_code(monkeypatch) -> None:
    monkeypatch.setattr(root_control.quality_control, "main", lambda _args: 1)

    assert root_control.main(["quality"]) == 1
