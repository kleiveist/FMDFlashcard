"""Shared fixtures for portable tooling tests."""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture
def case_sensitive_filesystem(tmp_path: Path) -> None:
    """Skip tests that require two paths differing only by letter case."""

    lower = tmp_path / "case-sensitivity-probe"
    upper = tmp_path / "CASE-SENSITIVITY-PROBE"
    lower.write_text("probe\n", encoding="utf-8")
    supported = not upper.exists()
    lower.unlink()
    if not supported:
        pytest.skip("filesystem does not support case-distinct paths")
