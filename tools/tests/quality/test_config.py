from __future__ import annotations

from pathlib import Path

import pytest

from tools.quality.config import QualityConfigError, load_quality_config
from tools.quality.model import QualityConfig, Severity


def _load_text_config(tmp_path: Path, text: str) -> QualityConfig:
    path = tmp_path / "code-quality.toml"
    path.write_text(text, encoding="utf-8")
    return load_quality_config(path, project_root=tmp_path)


def test_repository_policy_loads_with_exact_required_limits(
    quality_config: QualityConfig,
) -> None:
    assert quality_config.file.warning == 600
    assert quality_config.file.strong_warning == 750
    assert quality_config.file.maximum == 900
    assert quality_config.file.physical_warning == 1200
    assert quality_config.function == quality_config.function.__class__(50, 80, 120)
    assert quality_config.class_ == quality_config.class_.__class__(300, 500, 700)
    assert quality_config.complexity == quality_config.complexity.__class__(10, 15, 20)
    assert quality_config.nesting.warning_inclusive is True
    assert quality_config.nesting.strong_warning_inclusive is True
    assert quality_config.parameters.warning_inclusive is True
    assert quality_config.backend_architecture.support_directories == frozenset({"config"})
    assert quality_config.backend_architecture.composition_files == frozenset({"__init__.py", "main.py"})


@pytest.mark.parametrize(
    ("scope", "actual", "expected"),
    [
        ("function", 50, None),
        ("function", 51, Severity.WARNING),
        ("function", 80, Severity.WARNING),
        ("function", 81, Severity.STRONG_WARNING),
        ("function", 120, Severity.STRONG_WARNING),
        ("function", 121, Severity.ERROR),
        ("complexity", 10, None),
        ("complexity", 11, Severity.WARNING),
        ("complexity", 15, Severity.WARNING),
        ("complexity", 16, Severity.STRONG_WARNING),
        ("complexity", 20, Severity.STRONG_WARNING),
        ("complexity", 21, Severity.ERROR),
        ("nesting", 3, None),
        ("nesting", 4, Severity.WARNING),
        ("nesting", 5, Severity.STRONG_WARNING),
        ("nesting", 6, Severity.ERROR),
        ("parameters", 5, None),
        ("parameters", 6, Severity.WARNING),
        ("parameters", 8, Severity.WARNING),
        ("parameters", 9, Severity.STRONG_WARNING),
        ("parameters", 10, Severity.STRONG_WARNING),
        ("parameters", 11, Severity.ERROR),
    ],
)
def test_scope_limit_boundaries_are_exact(
    quality_config: QualityConfig,
    scope: str,
    actual: int,
    expected: Severity | None,
) -> None:
    assert getattr(quality_config, scope).classify(actual) is expected


@pytest.mark.parametrize(
    ("old", "new", "message"),
    [
        ("schema_version = 1", "schema_version = 2", "schema_version"),
        (
            "warning = 600\nstrong_warning = 750\nmax_code_lines = 900",
            "warning = 750\nstrong_warning = 750\nmax_code_lines = 900",
            "warning < strong_warning < max_code_lines",
        ),
        (
            "max_code_lines = 900\nphysical_lines_warning = 1200",
            "max_code_lines = 900\nphysical_lines_warning = 900",
            "physical_lines_warning",
        ),
        (
            "[function]\nwarning = 50",
            "[function]\nwarning = true",
            "function.warning must be a positive integer",
        ),
        (
            'extensions = [".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs"]',
            'extensions = ["py", ".ts"]',
            "file suffixes",
        ),
        (
            'exclude_files = ["Cargo.lock", "package-lock.json"]',
            'exclude_files = ["Cargo.lock", "Cargo.lock"]',
            "must not contain duplicates",
        ),
        (
            '"infrastructure->application",',
            '"unknown->application",',
            "<layer>-><layer>",
        ),
    ],
)
def test_invalid_policy_values_are_rejected(
    tmp_path: Path,
    quality_config_text: str,
    old: str,
    new: str,
    message: str,
) -> None:
    assert old in quality_config_text
    invalid = quality_config_text.replace(old, new, 1)

    with pytest.raises(QualityConfigError, match=message):
        _load_text_config(tmp_path, invalid)


def test_missing_and_invalid_toml_are_reported(tmp_path: Path) -> None:
    with pytest.raises(QualityConfigError, match="not found"):
        load_quality_config(tmp_path / "missing.toml", project_root=tmp_path)

    invalid = tmp_path / "invalid.toml"
    invalid.write_text("[broken", encoding="utf-8")
    with pytest.raises(QualityConfigError, match="invalid TOML"):
        load_quality_config(invalid, project_root=tmp_path)


def test_backend_layer_directories_must_not_overlap(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    invalid = quality_config_text.replace(
        'application_layers = ["application", "services"]',
        'application_layers = ["application", "services", "api"]',
        1,
    )

    with pytest.raises(QualityConfigError, match="assigned to both"):
        _load_text_config(tmp_path, invalid)


def test_backend_support_directories_must_not_overlap_layers(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    invalid = quality_config_text.replace(
        'support_directories = ["config"]',
        'support_directories = ["config", "api"]',
        1,
    )

    with pytest.raises(QualityConfigError, match="assigned to both"):
        _load_text_config(tmp_path, invalid)


def test_backend_composition_files_must_be_direct_python_files(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    invalid = quality_config_text.replace(
        'composition_files = ["__init__.py", "main.py"]',
        'composition_files = ["__init__.py", "bootstrap/main.py"]',
        1,
    )

    with pytest.raises(QualityConfigError, match="direct Python file names"):
        _load_text_config(tmp_path, invalid)


def test_frontend_layer_directories_must_not_overlap(
    tmp_path: Path,
    quality_config_text: str,
) -> None:
    invalid = quality_config_text.replace(
        'shared_directories = ["shared"]',
        'shared_directories = ["shared", "api"]',
        1,
    )

    with pytest.raises(QualityConfigError, match="assigned to both"):
        _load_text_config(tmp_path, invalid)
