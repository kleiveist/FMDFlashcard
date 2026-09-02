#!/usr/bin/env python3
"""Generate SPDX JSON with a checksum-pinned Syft release binary."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath

SYFT_VERSION = "1.33.0"
SYFT_LINUX_AMD64_SHA256 = "adc1b944a827ed3432bcd9f1dbdbc8fa3c0dca7d3d449e7084c90248c2c6cb50"
SYFT_LINUX_AMD64_URL = (
    "https://github.com/anchore/syft/releases/download/"
    f"v{SYFT_VERSION}/syft_{SYFT_VERSION}_linux_amd64.tar.gz"
)
MAX_ARCHIVE_BYTES = 200 * 1024 * 1024
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _download(destination: Path) -> None:
    request = urllib.request.Request(
        SYFT_LINUX_AMD64_URL,
        headers={"User-Agent": "FMDFlashcard-release-tooling"},
    )
    digest = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(request, timeout=60) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_ARCHIVE_BYTES:
                raise RuntimeError("Syft archive exceeds the configured size limit")
            digest.update(chunk)
            output.write(chunk)
    if digest.hexdigest() != SYFT_LINUX_AMD64_SHA256:
        raise RuntimeError("Syft release archive SHA-256 does not match the pinned checksum")


def _extract_binary(archive: Path, destination: Path) -> None:
    with tarfile.open(archive, mode="r:gz") as package:
        candidates = [
            member
            for member in package.getmembers()
            if member.isfile()
            and PurePosixPath(member.name).name == "syft"
            and ".." not in PurePosixPath(member.name).parts
        ]
        if len(candidates) != 1:
            raise RuntimeError("Syft archive does not contain exactly one regular binary")
        source = package.extractfile(candidates[0])
        if source is None:
            raise RuntimeError("Syft binary could not be read from its archive")
        with source, destination.open("wb") as output:
            shutil.copyfileobj(source, output)
    destination.chmod(0o700)


def _validate_output(path: Path) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not str(payload.get("spdxVersion", "")).startswith("SPDX-"):
        raise RuntimeError("Syft output is not SPDX JSON")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()

    if platform.system() != "Linux" or platform.machine().lower() not in {"amd64", "x86_64"}:
        raise SystemExit("the pinned SBOM generator supports only Linux x86_64 CI")
    output = arguments.output.resolve(strict=False)
    try:
        output.relative_to(REPOSITORY_ROOT)
    except ValueError as error:
        raise SystemExit("SBOM output must remain inside the repository") from error
    if output.is_symlink() or any(parent.is_symlink() for parent in output.parents):
        raise SystemExit("SBOM output path must not contain symlinks")

    output.parent.mkdir(parents=True, exist_ok=True)
    application_version = (REPOSITORY_ROOT / "VERSION").read_text(encoding="utf-8").strip()
    with tempfile.TemporaryDirectory(prefix="fmd-syft-") as temporary:
        temporary_root = Path(temporary)
        archive = temporary_root / "syft.tar.gz"
        binary = temporary_root / "syft"
        temporary_output = temporary_root / "SBOM.spdx.json"
        _download(archive)
        _extract_binary(archive, binary)
        version = subprocess.run(
            [str(binary), "version"],
            check=True,
            capture_output=True,
            text=True,
        )
        if SYFT_VERSION not in version.stdout:
            raise RuntimeError("downloaded Syft binary reports an unexpected version")
        subprocess.run(
            [
                str(binary),
                "scan",
                "dir:.",
                "--source-name",
                "FMDFlashcard",
                "--source-version",
                application_version,
                "--output",
                f"spdx-json={temporary_output}",
            ],
            cwd=REPOSITORY_ROOT,
            check=True,
            env={**os.environ, "SYFT_CHECK_FOR_APP_UPDATE": "false"},
        )
        _validate_output(temporary_output)
        with (
            temporary_output.open("rb") as source,
            tempfile.NamedTemporaryFile("wb", dir=output.parent, delete=False) as staged,
        ):
            shutil.copyfileobj(source, staged)
            staged.flush()
            os.fsync(staged.fileno())
            staged_path = Path(staged.name)
        staged_path.replace(output)
        output.chmod(0o644)
    print(f"generated SPDX JSON with checksum-pinned Syft {SYFT_VERSION}: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
