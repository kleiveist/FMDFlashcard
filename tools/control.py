#!/usr/bin/env python3
"""Canonical FMDFlashcard developer-tooling entry point."""

from __future__ import annotations

import sys
from pathlib import Path

sys.dont_write_bytecode = True

# Direct execution places tools/ rather than the checkout on sys.path.
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from tools import logger  # noqa: E402
from tools.control_dispatch import dispatch  # noqa: E402
from tools.control_parser import (  # noqa: E402
    LegacySyntaxError,
    build_parser,
    normalize_argv,
)


def _build_parser():  # type: ignore[no-untyped-def]
    """Compatibility hook retained for tooling tests and thin integrations."""

    return build_parser()


def _normalize_argv(argv: list[str]) -> list[str]:
    """Return only normalized argv for legacy callers."""

    return list(normalize_argv(argv).argv)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    parser.set_defaults(root_parser=parser)
    raw = list(sys.argv[1:] if argv is None else argv)
    try:
        normalized = normalize_argv(raw)
    except LegacySyntaxError as exc:
        parser.error(str(exc))
    if normalized.legacy and not normalized.suppress_warning:
        logger.deprecation(list(normalized.original), list(normalized.argv))
    args = parser.parse_args(list(normalized.argv))
    try:
        return dispatch(args)
    except KeyboardInterrupt:
        logger.error("Interrupted")
        return 130
    except Exception as exc:  # pragma: no cover - last-resort CLI boundary
        logger.error(f"Unhandled command failure: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
