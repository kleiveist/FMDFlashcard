from __future__ import annotations

import shutil
from pathlib import Path

import build
import pytest
import render_check


def _require_toolchain() -> None:
    required = ("pdflatex", "biber")
    if (
        not all(shutil.which(command) for command in required)
        or not render_check.pdf_backend_available()
    ):
        pytest.skip("full TeX/PDF toolchain is unavailable")


def test_built_german_pdf_is_structurally_valid_when_toolchain_is_available(
    tmp_path: Path,
) -> None:
    _require_toolchain()
    config = build.load_config()
    pdf = build.build(("de",), output_directory=tmp_path)[0]
    pages, text, rendered = render_check.validate_case_study_pdf(
        pdf,
        title=config["languages"]["de"]["pdf_title"],
        language=config["languages"]["de"]["pdf_language"],
        tooling_version=config["build"]["tooling_version"],
    )
    assert pages > 0
    assert "Portable Toolingarchitektur" in text
    assert len(rendered) == pages


def test_built_english_pdf_is_structurally_valid_when_toolchain_is_available(
    tmp_path: Path,
) -> None:
    _require_toolchain()
    config = build.load_config()
    pdf = build.build(("en",), output_directory=tmp_path)[0]
    pages, text, rendered = render_check.validate_case_study_pdf(
        pdf,
        title=config["languages"]["en"]["pdf_title"],
        language=config["languages"]["en"]["pdf_language"],
        tooling_version=config["build"]["tooling_version"],
    )
    assert pages > 0
    assert "Portable Tooling Architecture" in text
    assert len(rendered) == pages
