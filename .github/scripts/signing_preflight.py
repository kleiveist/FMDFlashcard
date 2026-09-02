#!/usr/bin/env python3
"""Validate signing configuration without exposing credential values."""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def _presence(*names: str) -> tuple[bool, bool]:
    values = [bool(os.environ.get(name, "")) for name in names]
    return all(values), any(values)


def _emit(path: Path, values: dict[str, str]) -> None:
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        for key, value in values.items():
            handle.write(f"{key}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--os", choices=("linux", "windows", "macos"), required=True)
    parser.add_argument("--policy", choices=("optional", "required"), required=True)
    parser.add_argument("--github-env", type=Path, required=True)
    arguments = parser.parse_args()

    values = {
        "FMD_WINDOWS_SIGNING_CONFIGURED": "false",
        "FMD_MACOS_SIGNING_CONFIGURED": "false",
        "FMD_MACOS_NOTARIZATION_CONFIGURED": "false",
        "FMD_SIGNING_STATE": "unsigned",
        "FMD_NOTARIZATION_STATE": "not-applicable",
        "FMD_SIGNATURE_KIND": "none",
    }

    if arguments.os == "windows":
        complete, partial = _presence("WINDOWS_CERTIFICATE_BASE64", "WINDOWS_CERTIFICATE_PASSWORD")
        if partial and not complete:
            raise SystemExit("Windows signing credentials are only partially configured")
        if arguments.policy == "required" and not complete:
            raise SystemExit("Windows signing is required but credentials are absent")
        if complete:
            values.update(
                FMD_WINDOWS_SIGNING_CONFIGURED="true",
                FMD_SIGNING_STATE="pending-verification",
                FMD_SIGNATURE_KIND="authenticode",
            )
    elif arguments.os == "macos":
        signing_complete, signing_partial = _presence(
            "APPLE_CERTIFICATE",
            "APPLE_CERTIFICATE_PASSWORD",
            "APPLE_SIGNING_IDENTITY",
        )
        notarization_complete, notarization_partial = _presence(
            "APPLE_ID", "APPLE_PASSWORD", "APPLE_TEAM_ID"
        )
        if signing_partial and not signing_complete:
            raise SystemExit("macOS signing credentials are only partially configured")
        if notarization_partial and not notarization_complete:
            raise SystemExit("macOS notarization credentials are only partially configured")
        if notarization_complete and not signing_complete:
            raise SystemExit("macOS notarization requires configured code signing")
        if arguments.policy == "required" and not (signing_complete and notarization_complete):
            raise SystemExit("macOS signing/notarization is required but credentials are absent")
        values["FMD_NOTARIZATION_STATE"] = "not-notarized"
        if signing_complete:
            values.update(
                FMD_MACOS_SIGNING_CONFIGURED="true",
                FMD_SIGNING_STATE="pending-verification",
                FMD_SIGNATURE_KIND="developer-id",
            )
        else:
            # Ad-hoc signing lets unsigned Apple Silicon CI artifacts launch while
            # remaining explicitly unauthenticated in release metadata.
            values["FMD_SIGNATURE_KIND"] = "ad-hoc"
            values["APPLE_SIGNING_IDENTITY"] = "-"
        if notarization_complete:
            values.update(
                FMD_MACOS_NOTARIZATION_CONFIGURED="true",
                FMD_NOTARIZATION_STATE="pending-verification",
            )

    _emit(arguments.github_env, values)
    print(
        f"signing preflight passed: os={arguments.os}, policy={arguments.policy}, "
        f"state={values['FMD_SIGNING_STATE']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
