#!/usr/bin/env python3
"""Perform a dependency-free structural sanity check on a generated PDF."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    arguments = parser.parse_args()
    path = arguments.pdf
    if path.is_symlink() or not path.is_file():
        raise SystemExit(f"PDF is not a regular file: {path}")
    payload = path.read_bytes()
    if len(payload) < 4096:
        raise SystemExit(f"PDF is unexpectedly small ({len(payload)} bytes): {path}")
    if not payload.startswith(b"%PDF-"):
        raise SystemExit(f"PDF header is invalid: {path}")
    if b"%%EOF" not in payload[-4096:]:
        raise SystemExit(f"PDF end marker is missing: {path}")
    digest = hashlib.sha256(payload).hexdigest()
    print(f"verified PDF: {path} ({len(payload)} bytes, sha256={digest})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
