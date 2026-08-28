from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import pytest

from tools.quality.config import QualityConfigError, load_quality_config
from tools.quality import control
from tools.quality.exceptions import apply_exceptions, validate_exceptions
from tools.quality.model import CheckResult, ExceptionEntry, Finding, RULES, Severity


def _load_with_exception(tmp_path: Path, base: str, table: str):
    path = tmp_path / "code-quality.toml"
    path.write_text(f"{base.rstrip()}\n\n{table.strip()}\n", encoding="utf-8")
    return load_quality_config(path, project_root=tmp_path)


def _exception_table(**overrides: str) -> str:
    values = {
        "rule": "CQ001",
        "path": "legacy.py",
        "reason": "Legacy protocol split is tracked architecturally.",
        "expires": "2030-01-01",
    }
    values.update(overrides)
    lines = ["[[exceptions]]"]
    lines.extend(f'{key} = "{value}"' for key, value in values.items())
    return "\n".join(lines)


def test_valid_exception_suppresses_only_its_matching_finding(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    (tmp_path / "legacy.py").write_text("value = 1\n", encoding="utf-8")
    config = _load_with_exception(tmp_path, quality_config_text, _exception_table())
    validation, valid = validate_exceptions(tmp_path, config.exceptions, today=date(2029, 1, 1))
    matching = Finding(RULES["CQ001"], Severity.WARNING, "legacy.py", "large file")
    unrelated = Finding(RULES["CQ001"], Severity.WARNING, "other.py", "large file")
    result = CheckResult("Size", findings=[matching, unrelated])

    apply_exceptions([result], valid)

    assert validation.findings == []
    assert len(valid) == 1
    assert result.findings[0].suppressed is True
    assert "expires 2030-01-01" in (result.findings[0].suppressed_reason or "")
    assert result.findings[1].suppressed is False


@pytest.mark.parametrize("missing", ["rule", "path", "reason", "expires"])
def test_exception_missing_required_field_is_rejected(
    tmp_path: Path,
    quality_config_text: str,
    missing: str,
) -> None:
    table_lines = [line for line in _exception_table().splitlines() if not line.startswith(f"{missing} =")]

    with pytest.raises(QualityConfigError, match=r"EX001 INVALID_EXCEPTION"):
        _load_with_exception(tmp_path, quality_config_text, "\n".join(table_lines))


def test_exception_with_unknown_rule_is_rejected(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    with pytest.raises(QualityConfigError, match="known CQ or AR rule ID"):
        _load_with_exception(
            tmp_path,
            quality_config_text,
            _exception_table(rule="CQ999"),
        )


def test_exception_path_must_be_specific(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    with pytest.raises(QualityConfigError, match="exact path"):
        _load_with_exception(
            tmp_path,
            quality_config_text,
            _exception_table(path="generated/*.py"),
        )


@pytest.mark.parametrize("path", ["/tmp/legacy.py", r"C:\\tmp\\legacy.py", r"\\\\server\\share\\legacy.py"])
def test_exception_path_must_be_repository_relative(
    tmp_path: Path,
    quality_config_text: str,
    path: str,
) -> None:
    with pytest.raises(QualityConfigError, match="repository-relative path"):
        _load_with_exception(tmp_path, quality_config_text, _exception_table(path=path))


@pytest.mark.parametrize("reason", ["", "too short"])
def test_exception_reason_must_be_meaningful(
    tmp_path: Path,
    quality_config_text: str,
    reason: str,
) -> None:
    with pytest.raises(QualityConfigError, match=r"EX001 INVALID_EXCEPTION"):
        _load_with_exception(tmp_path, quality_config_text, _exception_table(reason=reason))


def test_expired_exception_is_an_ex002_error(tmp_path: Path) -> None:
    path = tmp_path / "legacy.py"
    path.write_text("value = 1\n", encoding="utf-8")
    entry = ExceptionEntry("CQ001", "legacy.py", "Documented legacy protocol debt.", "2026-01-01")

    result, valid = validate_exceptions(tmp_path, (entry,), today=date(2026, 1, 2))

    assert valid == ()
    assert len(result.findings) == 1
    assert result.findings[0].rule.rule_id == "EX002"
    assert result.findings[0].severity is Severity.ERROR


def test_exception_expiring_today_is_still_valid(tmp_path: Path) -> None:
    path = tmp_path / "legacy.py"
    path.write_text("value = 1\n", encoding="utf-8")
    entry = ExceptionEntry("CQ001", "legacy.py", "Documented legacy protocol debt.", "2026-01-02")

    result, valid = validate_exceptions(tmp_path, (entry,), today=date(2026, 1, 2))

    assert result.findings == []
    assert valid == (entry,)


@pytest.mark.parametrize(
    ("entry", "message"),
    [
        (
            ExceptionEntry("CQ001", "legacy.py", "Documented legacy protocol debt.", "01-02-2030"),
            "invalid ISO expiration date",
        ),
        (
            ExceptionEntry("CQ001", "legacy.py", "Documented legacy protocol debt.", "20300102"),
            "invalid ISO expiration date",
        ),
        (
            ExceptionEntry("CQ001", "legacy.py", "Documented legacy protocol debt.", "2030-W01-1"),
            "invalid ISO expiration date",
        ),
        (
            ExceptionEntry("CQ001", "legacy.py", "Documented legacy protocol debt.", "2030-02-30"),
            "invalid ISO expiration date",
        ),
        (
            ExceptionEntry("CQ001", "missing.py", "Documented legacy protocol debt.", "2030-01-02"),
            "does not exist",
        ),
    ],
)
def test_invalid_runtime_exception_is_an_ex001_error(
    tmp_path: Path,
    entry: ExceptionEntry,
    message: str,
) -> None:
    (tmp_path / "legacy.py").write_text("value = 1\n", encoding="utf-8")

    result, valid = validate_exceptions(tmp_path, (entry,), today=date(2026, 1, 2))

    assert valid == ()
    assert len(result.findings) == 1
    assert result.findings[0].rule.rule_id == "EX001"
    assert result.findings[0].severity is Severity.ERROR
    assert message in result.findings[0].message


def test_exception_for_excluded_file_is_an_ex001_error(tmp_path: Path) -> None:
    path = tmp_path / "generated/legacy.py"
    path.parent.mkdir()
    path.write_text("value = 1\n", encoding="utf-8")
    entry = ExceptionEntry("CQ001", "generated/legacy.py", "Documented generated source debt.", "2030-01-02")

    result, valid = validate_exceptions(
        tmp_path,
        (entry,),
        today=date(2026, 1, 2),
        scanned_paths=frozenset(),
    )

    assert valid == ()
    assert result.findings[0].rule.rule_id == "EX001"
    assert "outside the active source scan" in result.findings[0].message


def test_901_line_file_cannot_be_suppressed_and_fails_real_gate(
    monkeypatch,
    tmp_path: Path,
    quality_config_text: str,
    capsys,
) -> None:
    source = tmp_path / "legacy.py"
    source.write_text("\n".join(f"value_{index} = {index}" for index in range(901)), encoding="utf-8")
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    (config_dir / "code-quality.toml").write_text(
        f"{quality_config_text.rstrip()}\n\n{_exception_table()}\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(control, "ROOT", tmp_path)
    args = argparse.Namespace(
        quality_command="size",
        config=Path("config/code-quality.toml"),
        output_format="json",
    )

    assert control.main(args) == 1
    output = capsys.readouterr().out
    assert '"rule_id": "CQ001"' in output
    assert '"severity": "ERROR"' in output
    assert '"suppressed": false' in output


def test_duplicate_exception_is_rejected(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    duplicated = f"{_exception_table()}\n\n{_exception_table()}"

    with pytest.raises(QualityConfigError, match="duplicate exception"):
        _load_with_exception(tmp_path, quality_config_text, duplicated)
