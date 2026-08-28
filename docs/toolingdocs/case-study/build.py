"""Compatibility entry point; the audited builder lives in ``scripts/build.py``."""

from __future__ import annotations

from scripts.build import BuildResult, CaseStudyError, build, main

__all__ = ["BuildResult", "CaseStudyError", "build", "main"]


if __name__ == "__main__":
    raise SystemExit(main())
