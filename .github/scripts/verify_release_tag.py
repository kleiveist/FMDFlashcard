#!/usr/bin/env python3
"""Verify that a local and remote release tag still resolve to one gated commit."""

from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
COMMIT_SHA = re.compile(r"[0-9a-f]{40}")
TAG = re.compile(
    r"v(?:0|[1-9][0-9]*)\."
    r"(?:0|[1-9][0-9]*)\."
    r"(?:0|[1-9][0-9]*)"
    r"(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\."
    r"(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
)


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


def _remote_commit(tag: str, remote: str) -> str:
    direct_ref = f"refs/tags/{tag}"
    peeled_ref = f"{direct_ref}^{{}}"
    output = _git("ls-remote", "--tags", remote, direct_ref, peeled_ref)
    refs: dict[str, str] = {}
    for line in output.splitlines():
        fields = line.split()
        if len(fields) != 2 or COMMIT_SHA.fullmatch(fields[0]) is None:
            raise ValueError("remote tag query returned malformed output")
        commit, reference = fields
        if reference not in {direct_ref, peeled_ref} or reference in refs:
            raise ValueError("remote tag query returned an unexpected or duplicate ref")
        refs[reference] = commit
    if direct_ref not in refs:
        raise ValueError(f"remote release tag does not exist: {tag}")
    return refs.get(peeled_ref, refs[direct_ref])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--remote", default="origin")
    arguments = parser.parse_args()

    tag = arguments.tag.strip()
    expected_sha = arguments.sha.strip().lower()
    if TAG.fullmatch(tag) is None:
        raise SystemExit("release tag must be exact v-prefixed SemVer")
    if COMMIT_SHA.fullmatch(expected_sha) is None:
        raise SystemExit("release SHA must be an exact lowercase 40-character commit SHA")
    version = (REPOSITORY_ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if tag != f"v{version}":
        raise SystemExit(f"release tag {tag!r} does not match VERSION ({version})")

    try:
        local_commit = _git("rev-parse", "--verify", f"refs/tags/{tag}^{{commit}}").lower()
        remote_commit = _remote_commit(tag, arguments.remote).lower()
    except (subprocess.CalledProcessError, ValueError) as error:
        raise SystemExit(f"could not verify immutable release tag: {error}") from error
    if local_commit != expected_sha:
        raise SystemExit(f"local tag {tag} resolves to {local_commit}, not {expected_sha}")
    if remote_commit != expected_sha:
        raise SystemExit(f"remote tag {tag} resolves to {remote_commit}, not {expected_sha}")

    print(f"release tag verified locally and remotely: {tag} -> {expected_sha}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
