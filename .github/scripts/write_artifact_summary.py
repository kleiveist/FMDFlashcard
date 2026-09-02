#!/usr/bin/env python3
"""Append a verified release artifact inventory table to a GitHub step summary."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--title", default="Release artifact inventory")
    arguments = parser.parse_args()

    summary = arguments.summary
    if summary is None:
        raw_summary = os.environ.get("GITHUB_STEP_SUMMARY", "")
        if not raw_summary:
            raise SystemExit("GITHUB_STEP_SUMMARY is not configured")
        summary = Path(raw_summary)
    payload = json.loads(arguments.manifest.read_text(encoding="utf-8"))
    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        raise SystemExit("release manifest contains no artifact entries")

    rows: list[str] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise SystemExit("release manifest contains a malformed entry")
        sha256 = entry.get("sha256")
        size = entry.get("file_size")
        if not isinstance(sha256, str) or re.fullmatch(r"[0-9a-f]{64}", sha256) is None:
            raise SystemExit("release manifest entry has an invalid SHA-256")
        if not isinstance(size, int) or size <= 0:
            raise SystemExit("release manifest entry has an invalid size")
        target = f"{entry.get('runner_os', '?')}/{entry.get('architecture', '?')}"
        rows.append(
            "| "
            + " | ".join(
                _cell(value)
                for value in (
                    entry.get("filename", "?"),
                    entry.get("package_type", "?"),
                    target,
                    size,
                    sha256,
                    entry.get("signature", "?"),
                    entry.get("notarization", "?"),
                )
            )
            + " |"
        )

    summary.parent.mkdir(parents=True, exist_ok=True)
    with summary.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(f"## {_cell(arguments.title)}\n\n")
        handle.write("| File | Package | Target | Bytes | SHA-256 | Signature | Notarization |\n")
        handle.write("| --- | --- | --- | ---: | --- | --- | --- |\n")
        handle.write("\n".join(rows) + "\n\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
