from __future__ import annotations

from pathlib import Path

import verify

CASE_STUDY = Path(__file__).resolve().parents[1]


def test_required_case_study_tree_is_complete_and_source_only() -> None:
    assert verify.verify_source_structure() == []
    assert verify.verify_no_generated_artifacts() == []
    assert not (CASE_STUDY / ".build").exists()
    assert not list(CASE_STUDY.rglob(".gitkeep"))


def test_main_files_are_orchestration_not_inline_case_study_prose() -> None:
    for language in verify.LANGUAGES:
        main = (CASE_STUDY / "source" / language / "main.tex").read_text(
            encoding="utf-8"
        )
        assert "\\documentclass[11pt,a4paper]{article}" in main
        assert "\\input{metadata}" in main
        assert "\\input{chapters/00-abstract}" in main
        assert "\\input{appendices/e-reproducibility}" in main
        assert "\\printbibliography" in main
        assert "\\section{" not in main
