from __future__ import annotations

from pathlib import Path

import verify

CASE_STUDY = Path(__file__).resolve().parents[1]


def test_audited_template_contract_is_complete_and_no_unlicensed_source_is_imported() -> (
    None
):
    config = verify.load_config()
    verify.require_audited_config(config)
    audit = (CASE_STUDY / "TEMPLATE-COMPATIBILITY.md").read_text(encoding="utf-8")
    assert "76b8efe19662a378eda568eddcdd4c96a5e649de" in audit
    assert "no upstream file is vendored" in audit
    assert "no `LICENSE`" in audit
    assert "pdflatex" in audit
    assert "biber" in audit
    assert "Shell escape" in audit
    template = CASE_STUDY / "source/common/template"
    assert {path.name for path in template.iterdir()} == {"NOTICE.txt", "template.md"}
    navigation = (template / "template.md").read_text(encoding="utf-8")
    assert navigation == (
        "<!-- AUTO-GENERATED:backlink START -->\n"
        "[← Back](../common.md)\n"
        "<!-- AUTO-GENERATED:backlink END -->\n"
        "# Template\n\n"
        "<!-- AUTO-GENERATED:docs-index START -->\n\n"
        "## 📄 Pages\n"
        "- ⏭️ (no pages)\n\n"
        "<!-- AUTO-GENERATED:docs-index END -->\n"
    )
    assert verify.verify_source_structure() == []


def test_audit_records_current_source_contract_and_explicit_deviations() -> None:
    audit = (CASE_STUDY / "TEMPLATE-COMPATIBILITY.md").read_text(encoding="utf-8")
    for phrase in (
        "Document class",
        "Bibliography",
        "Fonts",
        "Generated files",
        "Necessary, documented deviations",
    ):
        assert phrase in audit
    assert "Template-Projekte" not in (CASE_STUDY / "source/de/main.tex").read_text(
        encoding="utf-8"
    )
    assert "Template-Projekte" not in (CASE_STUDY / "source/en/main.tex").read_text(
        encoding="utf-8"
    )
