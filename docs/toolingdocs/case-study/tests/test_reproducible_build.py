from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

import build
import pytest
import render_check
import verify


def test_reproducibility_configuration_has_a_fixed_time_and_requires_byte_stability(
    tmp_path: Path,
) -> None:
    config = verify.load_config()
    environment = build.deterministic_environment(tmp_path, config)
    assert environment["SOURCE_DATE_EPOCH"] == str(config["build"]["source_date_epoch"])
    assert environment["FORCE_SOURCE_DATE"] == "1"
    assert environment["TZ"] == "UTC"
    assert config["build"]["byte_identical_pdfs"] is True


def test_reproducibility_comparator_rejects_any_stable_output_difference() -> None:
    first = build.BuildResult(
        "de", b"%PDF-1.7\nfirst\n%%EOF", build.PdfEvidence(2, "text", ("page",))
    )
    same = build.BuildResult(
        "de", b"%PDF-1.7\nfirst\n%%EOF", build.PdfEvidence(2, "text", ("page",))
    )
    build._compare(first, same, require_bytes=True)
    changed = build.BuildResult(
        "de", b"%PDF-1.7\nnext\n%%EOF", build.PdfEvidence(2, "text", ("page",))
    )
    with pytest.raises(build.CaseStudyError, match="PDF bytes differ"):
        build._compare(first, changed, require_bytes=True)


def test_repository_local_output_is_limited_to_the_state_directory() -> None:
    config = verify.load_config()
    assert build.selected_output_directory(
        config, None
    ) == verify.default_output_directory(config)
    with pytest.raises(build.CaseStudyError, match="Repository-local build output"):
        build.selected_output_directory(config, verify.REPOSITORY_ROOT / "build")


def test_clean_builds_are_exercised_when_the_full_toolchain_is_available(
    tmp_path: Path,
) -> None:
    if (
        not all(shutil.which(command) for command in ("pdflatex", "biber"))
        or not render_check.pdf_backend_available()
    ):
        pytest.skip("full TeX/PDF toolchain is unavailable")
    targets = build.build(("de", "en"), output_directory=tmp_path, reproducible=True)
    assert {path.name for path in targets} == {
        "portable-tooling-case-study-de.pdf",
        "portable-tooling-case-study-en.pdf",
    }
    assert all(hashlib.sha256(path.read_bytes()).hexdigest() for path in targets)
