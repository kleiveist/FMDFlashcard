from __future__ import annotations

import verify


def test_sources_have_no_missing_references_citations_or_duplicate_labels() -> None:
    assert verify.verify_cross_references() == []
