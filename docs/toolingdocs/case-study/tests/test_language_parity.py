from __future__ import annotations

import verify


def test_german_and_english_have_equal_chapters_labels_diagrams_evidence_and_citations() -> (
    None
):
    assert verify.verify_language_parity() == []
    assert verify.verify_cross_references() == []
    for language in verify.LANGUAGES:
        text = verify.source_text(language)
        diagrams = verify.macro_arguments(text, "CaseDiagram")
        tables = verify.macro_arguments(text, "CaseTable")
        assert len(diagrams) == 12
        assert len(tables) == 4
        assert {call[2] for call in diagrams} <= set(verify._references(text, "fig:"))


def test_both_editions_keep_the_required_numeric_chapter_and_appendix_order() -> None:
    for language in verify.LANGUAGES:
        main = verify.source_text(language)
        positions = [
            main.index(f"chapters/{name.removesuffix('.tex')}")
            for name in verify.CHAPTERS
        ]
        assert positions == sorted(positions)
        appendix_positions = [
            main.index(f"appendices/{name.removesuffix('.tex')}")
            for name in verify.APPENDICES
        ]
        assert appendix_positions == sorted(appendix_positions)
