#!/usr/bin/env python3
"""Validate release event identity and expose safe workflow outputs."""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SEMVER = re.compile(
    r"(?:0|[1-9][0-9]*)\."
    r"(?:0|[1-9][0-9]*)\."
    r"(?:0|[1-9][0-9]*)"
    r"(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\."
    r"(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
)


def _boolean(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no", ""}:
        return False
    raise ValueError(f"invalid boolean value: {value!r}")


def _is_prerelease(version: str) -> bool:
    return "-" in version.split("+", 1)[0]


def _git(*arguments: str) -> str:
    result = subprocess.run(
        ["git", *arguments],
        cwd=REPOSITORY_ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def _write_outputs(path: Path, values: dict[str, str]) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        for key, value in values.items():
            if "\n" in value or "\r" in value:
                raise ValueError(f"workflow output contains a newline: {key}")
            handle.write(f"{key}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event-name", required=True)
    parser.add_argument("--ref-type", default="")
    parser.add_argument("--ref-name", default="")
    parser.add_argument("--manual-tag", default="")
    parser.add_argument("--publish", default="false")
    parser.add_argument("--sha", required=True)
    parser.add_argument("--github-output", type=Path, required=True)
    arguments = parser.parse_args()

    version = (REPOSITORY_ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if SEMVER.fullmatch(version) is None:
        raise SystemExit(f"VERSION is not exact SemVer: {version!r}")
    expected_tag = f"v{version}"
    requested_publish = _boolean(arguments.publish)
    event_sha = arguments.sha.strip().lower()
    if re.fullmatch(r"[0-9a-f]{40}", event_sha) is None:
        raise SystemExit("event SHA must be an exact 40-character lowercase commit SHA")

    try:
        head_commit = _git("rev-parse", "HEAD").lower()
    except subprocess.CalledProcessError as error:
        raise SystemExit("could not resolve the checked-out release commit") from error
    if re.fullmatch(r"[0-9a-f]{40}", head_commit) is None:
        raise SystemExit("checked-out release source did not resolve to a full commit SHA")

    if arguments.event_name == "push":
        if arguments.ref_type != "tag":
            raise SystemExit("release push must be a tag event")
        tag = arguments.ref_name
        publish = True
    elif arguments.event_name == "workflow_dispatch":
        tag = arguments.manual_tag.strip() or expected_tag
        publish = requested_publish
        if publish and not arguments.manual_tag.strip():
            raise SystemExit("manual publication requires an explicit existing tag")
    else:
        raise SystemExit(f"unsupported release event: {arguments.event_name}")

    if tag != expected_tag:
        raise SystemExit(f"release tag {tag!r} does not match VERSION ({expected_tag})")

    if arguments.event_name == "push" or arguments.manual_tag.strip():
        try:
            tag_commit = _git("rev-parse", f"refs/tags/{tag}^{{commit}}").lower()
        except subprocess.CalledProcessError as error:
            raise SystemExit(f"release tag does not exist locally: {tag}") from error
        if tag_commit != head_commit:
            raise SystemExit(
                f"release tag {tag} resolves to {tag_commit}, not checked-out {head_commit}"
            )
        if arguments.event_name == "workflow_dispatch" and publish and event_sha != tag_commit:
            raise SystemExit(
                "manual publication must be dispatched from the matching tagged commit "
                "so GitHub provenance identifies the released source"
            )
    elif event_sha != head_commit:
        raise SystemExit(
            f"checked-out release source {head_commit} does not match event SHA {event_sha}"
        )

    values = {
        "version": version,
        "tag": tag,
        "source_ref": head_commit,
        "source_sha": head_commit,
        "publish": str(publish).lower(),
        "prerelease": str(_is_prerelease(version)).lower(),
    }
    _write_outputs(arguments.github_output, values)
    print(
        f"release identity verified: version={version}, tag={tag}, publish={str(publish).lower()}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
