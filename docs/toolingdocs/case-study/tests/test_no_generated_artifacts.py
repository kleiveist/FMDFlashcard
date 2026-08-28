from __future__ import annotations

import verify


def test_case_study_source_tree_contains_no_latex_build_outputs_or_generated_directories() -> (
    None
):
    assert verify.verify_no_generated_artifacts() == []
