"""Safely remove only the default, non-versioned case-study output directory."""

from __future__ import annotations

import argparse
import shutil
import sys
from collections.abc import Sequence
from pathlib import Path

try:  # Supports both ``python scripts/clean.py`` and package imports in tests.
    from ._shared import (
        CaseStudyError,
        default_output_directory,
        load_config,
        require_audited_config,
    )
except ImportError:  # pragma: no cover - command-line entry point.
    from _shared import (
        CaseStudyError,
        default_output_directory,
        load_config,
        require_audited_config,
    )


def clean_default_output(config: dict | None = None) -> Path:
    selected = config or load_config()
    require_audited_config(selected)
    output = default_output_directory(selected)
    state_root = output.parents[1]
    if (
        output.name != "case-study"
        or output.parent.name != "docs"
        or state_root.name != ".tooling-state"
    ):
        raise CaseStudyError(
            "Refusing to clean a path outside .tooling-state/docs/case-study."
        )
    if output.exists():
        shutil.rmtree(output)
    return output


def _parser() -> argparse.ArgumentParser:
    return argparse.ArgumentParser(
        description="Remove temporary case-study output from .tooling-state only."
    )


def main(argv: Sequence[str] | None = None) -> int:
    _parser().parse_args(argv)
    try:
        output = clean_default_output()
    except CaseStudyError as exc:
        print(f"case-study clean failed: {exc}", file=sys.stderr)
        return 1
    print(f"cleaned {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
