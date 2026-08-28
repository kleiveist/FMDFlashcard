from __future__ import annotations

import verify


def test_evidence_ids_have_existing_tests_versions_and_commit_identifiers() -> None:
    assert verify.verify_evidence() == []
