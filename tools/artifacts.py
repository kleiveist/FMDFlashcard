"""Native artifact collection, verification, and deterministic release assembly."""

from __future__ import annotations

import gzip
import hashlib
import json
import os
import platform
import plistlib
import re
import shutil
import stat
import subprocess
import tarfile
import tempfile
import zipfile
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

from tools.paths import ProjectPaths, ensure_within, project_paths
from tools.project_config import (
    ArtifactSpec,
    TargetSpec,
    application_version,
    load_release_matrix,
)

MANIFEST_SCHEMA_VERSION = 1
REPOSITORY_URL = "https://github.com/kleiveist/FMDFlashcard"
REQUIRED_EXTRA_ASSETS = ("documentation", "sbom")
EXPERIMENTAL_CROSS_MATRIX_ID = "experimental-windows-cross-linux"
EXPERIMENTAL_CROSS_CLI_TARGET = "windows-cross-linux"
EXPERIMENTAL_CROSS_PACKAGE_TYPE = "experimental-cross-exe"
CLI_PACKAGE_TYPES = {
    "linux": {"deb", "rpm", "appimage"},
    "windows": {"msi", "nsis"},
    "windows-portable": {"portable-zip"},
    "macos": {"dmg", "app-archive"},
}
WINDOWS_RESERVED_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}
FORBIDDEN_ARCHIVE_COMPONENTS = {
    ".dist",
    ".git",
    ".reports",
    ".tooling-state",
    "__pycache__",
    "coverage",
    "node_modules",
}


class ArtifactError(RuntimeError):
    """Raised for release evidence that cannot be trusted."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _git_value(paths: ProjectPaths, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=paths.root,
        check=False,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else "unknown"


def _tool_version(command: list[str]) -> str:
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return "unavailable"
    output = (result.stdout or result.stderr).strip().splitlines()
    return output[0] if result.returncode == 0 and output else "unavailable"


def _toolchains() -> dict[str, str]:
    return {
        "python": platform.python_version(),
        "node": _tool_version(["node", "--version"]),
        "pnpm": _tool_version(["pnpm", "--version"]),
        "rustc": _tool_version(["rustc", "--version"]),
        "cargo": _tool_version(["cargo", "--version"]),
    }


def _runner_os_name() -> str:
    value = os.environ.get("RUNNER_OS", platform.system())
    return "macOS" if value == "Darwin" else value


def _source_date_epoch() -> int:
    raw = os.environ.get("SOURCE_DATE_EPOCH", "0")
    try:
        value = int(raw)
    except ValueError as exc:
        raise ArtifactError("SOURCE_DATE_EPOCH must be an integer") from exc
    return max(value, 0)


def _zip_timestamp() -> tuple[int, int, int, int, int, int]:
    epoch = max(_source_date_epoch(), 315532800)
    value = datetime.fromtimestamp(epoch, UTC)
    return (value.year, value.month, value.day, value.hour, value.minute, value.second)


def _path_sort_key(path: Path) -> str:
    """Return a case-sensitive path key independent of the host path flavour."""
    return path.as_posix()


def _safe_archive_name(name: str) -> PurePosixPath:
    normalized = name.replace("\\", "/")
    candidate = PurePosixPath(normalized)
    if (
        not normalized
        or candidate.is_absolute()
        or ".." in candidate.parts
        or any(part in {"", "."} for part in candidate.parts)
    ):
        raise ArtifactError(f"unsafe archive member: {name!r}")
    for part in candidate.parts:
        stem = part.rstrip(" .").split(".", 1)[0].casefold()
        if stem in WINDOWS_RESERVED_NAMES:
            raise ArtifactError(f"reserved archive member name: {name!r}")
    folded_parts = tuple(part.casefold() for part in candidate.parts)
    if any(part in FORBIDDEN_ARCHIVE_COMPONENTS for part in folded_parts):
        raise ArtifactError(f"runtime or build output is forbidden in archives: {name!r}")
    if any(
        folded_parts[index : index + 2] == ("apps", "userglobal")
        for index in range(max(len(folded_parts) - 1, 0))
    ):
        raise ArtifactError(f"user profile data is forbidden in archives: {name!r}")
    return candidate


def verify_zip(path: Path) -> None:
    seen: set[str] = set()
    try:
        with zipfile.ZipFile(path) as archive:
            if not archive.infolist():
                raise ArtifactError(f"archive is empty: {path}")
            for member in archive.infolist():
                name = _safe_archive_name(member.filename)
                folded = str(name).casefold()
                if folded in seen:
                    raise ArtifactError(
                        f"case-insensitive duplicate archive member: {member.filename}"
                    )
                seen.add(folded)
                mode = member.external_attr >> 16
                if stat.S_ISLNK(mode):
                    raise ArtifactError(f"ZIP symlink is not allowed: {member.filename}")
            bad = archive.testzip()
            if bad:
                raise ArtifactError(f"corrupt ZIP member: {bad}")
    except zipfile.BadZipFile as exc:
        raise ArtifactError(f"invalid ZIP archive: {path}") from exc


def verify_tar(path: Path) -> None:
    seen: set[str] = set()
    try:
        with tarfile.open(path, "r:gz") as archive:
            members = archive.getmembers()
            if not members:
                raise ArtifactError(f"archive is empty: {path}")
            for member in members:
                name = _safe_archive_name(member.name)
                folded = str(name).casefold()
                if folded in seen:
                    raise ArtifactError(f"case-insensitive duplicate archive member: {member.name}")
                seen.add(folded)
                if member.ischr() or member.isblk() or member.isfifo():
                    raise ArtifactError(f"special archive member is not allowed: {member.name}")
                if member.issym() or member.islnk():
                    link = PurePosixPath(member.linkname.replace("\\", "/"))
                    base = PurePosixPath(member.name).parent if member.issym() else PurePosixPath()
                    if not _archive_link_stays_inside(base, link):
                        raise ArtifactError(f"unsafe archive link: {member.name}")
    except tarfile.TarError as exc:
        raise ArtifactError(f"invalid tar archive: {path}") from exc


def _archive_link_stays_inside(base: PurePosixPath, link: PurePosixPath) -> bool:
    if link.is_absolute():
        return False
    depth = 0
    for part in (*base.parts, *link.parts):
        if part in {"", "."}:
            continue
        if part == "..":
            if depth == 0:
                return False
            depth -= 1
        else:
            depth += 1
    return depth > 0


def _write_deterministic_zip(source: Path, destination: Path) -> None:
    compression = zipfile.ZIP_DEFLATED
    with zipfile.ZipFile(destination, "w", compression=compression, compresslevel=9) as archive:
        sources = [source] if source.is_file() else sorted(source.rglob("*"), key=_path_sort_key)
        for path in sources:
            if path.is_symlink():
                raise ArtifactError(f"portable ZIP cannot contain symlinks: {path}")
            if path.is_dir():
                continue
            relative = Path(source.name) if source.is_file() else path.relative_to(source.parent)
            info = zipfile.ZipInfo(relative.as_posix(), date_time=_zip_timestamp())
            source_executable = bool(stat.S_IMODE(path.stat().st_mode) & 0o111)
            windows_executable = path.suffix.casefold() in {".bat", ".cmd", ".com", ".exe"}
            mode = 0o755 if source_executable or windows_executable else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = compression
            archive.writestr(info, path.read_bytes())


def create_deterministic_zip(source: Path, destination: Path) -> None:
    """Archive a file or directory with stable ordering and metadata."""
    if not source.exists():
        raise ArtifactError(f"archive source does not exist: {source}")
    if destination.exists():
        raise ArtifactError(f"refusing to overwrite archive: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    _write_deterministic_zip(source, destination)
    verify_zip(destination)


def _safe_symlink(source_root: Path, path: Path) -> None:
    target = Path(os.readlink(path))
    if target.is_absolute():
        raise ArtifactError(f"absolute symlink is not allowed in app archive: {path}")
    resolved = (path.parent / target).resolve(strict=False)
    ensure_within(resolved, source_root.resolve())


def _deterministic_tar_mode(source: Path, path: Path, info: tarfile.TarInfo) -> int:
    """Normalize archive modes while retaining executable application code."""
    if info.isdir():
        return 0o755
    if info.issym() or info.islnk():
        return 0o777
    if not info.isfile():
        return stat.S_IMODE(info.mode)

    relative = path.relative_to(source)
    app_executable = (
        source.suffix.casefold() == ".app"
        and len(relative.parts) >= 3
        and relative.parts[0].casefold() == "contents"
        and relative.parts[1].casefold() == "macos"
    )
    source_executable = bool(stat.S_IMODE(path.stat().st_mode) & 0o111)
    return 0o755 if app_executable or source_executable else 0o644


def _write_deterministic_tar(source: Path, destination: Path) -> None:
    epoch = _source_date_epoch()
    with destination.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=epoch) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                paths = [source, *sorted(source.rglob("*"), key=_path_sort_key)]
                for path in paths:
                    if path.is_symlink():
                        _safe_symlink(source, path)
                    arcname = path.relative_to(source.parent).as_posix()
                    info = archive.gettarinfo(str(path), arcname=arcname)
                    info.uid = 0
                    info.gid = 0
                    info.uname = ""
                    info.gname = ""
                    info.mtime = epoch
                    info.mode = _deterministic_tar_mode(source, path, info)
                    if info.isfile():
                        with path.open("rb") as handle:
                            archive.addfile(info, handle)
                    else:
                        archive.addfile(info)


def _path_has_symlink(path: Path, boundary: Path) -> bool:
    current = path
    while current != boundary:
        if current.is_symlink():
            return True
        if current.parent == current:
            break
        current = current.parent
    return boundary.is_symlink()


def _discover_source(
    paths: ProjectPaths,
    spec: ArtifactSpec,
    *,
    built_after: Path | None,
) -> Path:
    candidates = sorted(paths.root.glob(spec.source_glob), key=_path_sort_key)
    if len(candidates) != 1:
        names = ", ".join(str(item.relative_to(paths.root)) for item in candidates)
        raise ArtifactError(
            f"{spec.package_type} expected exactly one source for {spec.source_glob}; "
            f"found {len(candidates)}{f': {names}' if names else ''}"
        )
    source = candidates[0]
    ensure_within(source.resolve(strict=False), paths.root)
    if _path_has_symlink(source, paths.root):
        raise ArtifactError(f"artifact source contains a symlinked path component: {source}")
    if not source.is_file() and not (spec.archive == "tar.gz" and source.is_dir()):
        raise ArtifactError(f"artifact source has the wrong type: {source}")
    if source.is_file() and source.stat().st_size <= 0:
        raise ArtifactError(f"artifact source is empty: {source}")
    if built_after is not None:
        marker_time = built_after.stat().st_mtime_ns
        newest = max(
            (item.stat().st_mtime_ns for item in [source, *source.rglob("*")] if item.exists()),
            default=0,
        )
        if newest < marker_time:
            raise ArtifactError(f"artifact is stale (older than build marker): {source}")
    return source


def _copy_or_archive(source: Path, destination: Path, spec: ArtifactSpec) -> None:
    if destination.exists():
        raise ArtifactError(f"refusing to overwrite artifact: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if spec.archive == "zip":
        _write_deterministic_zip(source, destination)
    elif spec.archive == "tar.gz":
        _write_deterministic_tar(source, destination)
    else:
        shutil.copy2(source, destination)


def _check_magic(path: Path, package_type: str) -> None:
    with path.open("rb") as handle:
        prefix = handle.read(8)
    expected = {
        "deb": b"!<arch>\n",
        "rpm": b"\xed\xab\xee\xdb",
        "msi": b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
        "nsis": b"MZ",
        "portable-zip": b"PK",
        "appimage": b"\x7fELF",
        EXPERIMENTAL_CROSS_PACKAGE_TYPE: b"MZ",
    }.get(package_type)
    if expected and not prefix.startswith(expected):
        raise ArtifactError(f"{path.name} does not have the expected {package_type} signature")


def _verify_metadata(path: Path, package_type: str, version: str) -> None:
    _check_magic(path, package_type)
    if package_type in {"portable-zip"}:
        _verify_portable_zip(path)
    elif package_type == "app-archive":
        verify_tar(path)
        _verify_app_archive_version(path, version)
    elif package_type == "deb":
        _verify_external_version(["dpkg-deb", "-f", str(path), "Version"], version, path)
    elif package_type == "rpm":
        _verify_external_version(["rpm", "-qp", "--qf", "%{VERSION}", str(path)], version, path)
    elif package_type == "dmg" and platform.system() == "Darwin":
        _require_success(["hdiutil", "verify", str(path)], f"DMG integrity failed: {path}")


def _verify_portable_zip(path: Path) -> None:
    verify_zip(path)
    with zipfile.ZipFile(path) as archive:
        executables = [
            member
            for member in archive.infolist()
            if not member.is_dir()
            and PurePosixPath(member.filename).name.casefold() == "fmd-flashcard-desktop.exe"
        ]
        if len(executables) != 1:
            raise ArtifactError(
                f"portable ZIP must contain exactly one fmd-flashcard-desktop.exe: {path}"
            )
        with archive.open(executables[0]) as executable:
            if executable.read(2) != b"MZ":
                raise ArtifactError(f"portable ZIP executable is not a Windows PE file: {path}")


def _verify_external_version(command: list[str], version: str, path: Path) -> None:
    if shutil.which(command[0]) is None:
        raise ArtifactError(f"required native metadata tool is unavailable: {command[0]}")
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    actual = result.stdout.strip()
    if result.returncode != 0:
        raise ArtifactError(
            f"could not inspect package metadata for {path}: {result.stderr.strip()}"
        )
    if actual != version:
        raise ArtifactError(f"package version mismatch for {path}: {actual}; expected {version}")


def _require_success(command: list[str], message: str) -> None:
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise ArtifactError(f"{message}: {result.stderr.strip()}")


def _verify_app_archive_version(path: Path, version: str) -> None:
    with tarfile.open(path, "r:gz") as archive:
        candidates = [
            member
            for member in archive.getmembers()
            if member.name.endswith(".app/Contents/Info.plist") and member.isfile()
        ]
        if len(candidates) != 1:
            raise ArtifactError(f"app archive must contain exactly one Info.plist: {path}")
        handle = archive.extractfile(candidates[0])
        if handle is None:
            raise ArtifactError(f"could not read Info.plist from {path}")
        payload = plistlib.loads(handle.read())
        actual = str(payload.get("CFBundleShortVersionString", ""))
        if actual != version:
            raise ArtifactError(f"app bundle version mismatch: {actual}; expected {version}")


def verify_artifact(path: Path, spec: ArtifactSpec, version: str) -> dict[str, Any]:
    if path.is_symlink() or not path.is_file():
        raise ArtifactError(f"artifact must be a regular non-symlink file: {path}")
    before = path.stat()
    if before.st_size <= 0:
        raise ArtifactError(f"artifact is empty: {path}")
    if spec.executable and os.name != "nt" and not os.access(path, os.X_OK):
        raise ArtifactError(f"artifact is not executable: {path}")
    _verify_metadata(path, spec.package_type, version)
    digest = sha256_file(path)
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ArtifactError(f"artifact changed while it was verified: {path}")
    return {"size": after.st_size, "sha256": digest}


def _manifest_entry(
    *,
    paths: ProjectPaths,
    target: TargetSpec,
    spec: ArtifactSpec,
    path: Path,
    evidence: dict[str, Any],
) -> dict[str, Any]:
    tag = os.environ.get("GITHUB_REF_NAME", "")
    return {
        "architecture": target.architecture,
        "commit_sha": os.environ.get("GITHUB_SHA") or _git_value(paths, "rev-parse", "HEAD"),
        "file_size": evidence["size"],
        "filename": path.name,
        "git_tag": tag if tag.startswith("v") else "",
        "notarization": os.environ.get(
            "FMD_NOTARIZATION_STATE",
            "not-notarized" if target.os == "macos" else "not-applicable",
        ),
        "package_type": spec.package_type,
        "runner_os": _runner_os_name(),
        "rust_target": target.rust_target,
        "sha256": evidence["sha256"],
        "signature": os.environ.get("FMD_SIGNING_STATE", "unsigned"),
        "source_repository": os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        + "/"
        + os.environ.get("GITHUB_REPOSITORY", "kleiveist/FMDFlashcard"),
        "toolchains": _toolchains(),
    }


def collect_target_artifacts(
    matrix_id: str,
    *,
    output_dir: Path,
    built_after: Path | None = None,
    paths: ProjectPaths | None = None,
) -> Path:
    project = paths or project_paths()
    matrix = load_release_matrix(project)
    target = matrix.target(matrix_id)
    version = application_version(project)
    destination_root = Path(os.path.abspath(output_dir))
    ensure_within(destination_root, project.root, label="artifact output")
    if destination_root.is_symlink():
        raise ArtifactError(f"artifact output cannot be a symlink: {destination_root}")
    destination_root.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, Any]] = []
    for spec in target.artifacts:
        source = _discover_source(project, spec, built_after=built_after)
        destination = destination_root / spec.public_name(version)
        _copy_or_archive(source, destination, spec)
        if spec.executable and os.name != "nt":
            destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP)
        evidence = verify_artifact(destination, spec, version)
        entries.append(
            _manifest_entry(
                paths=project,
                target=target,
                spec=spec,
                path=destination,
                evidence=evidence,
            )
        )
    fragment = destination_root / "manifest-fragment.json"
    payload = {
        "application_version": version,
        "entries": sorted(entries, key=lambda item: item["filename"]),
        "matrix_id": matrix_id,
        "schema_version": MANIFEST_SCHEMA_VERSION,
    }
    _atomic_json(fragment, payload)
    return fragment


def collect_local_build_artifacts(
    cli_target: str,
    *,
    rust_target: str,
    built_after: Path,
    package_types: Iterable[str] | None = None,
    paths: ProjectPaths | None = None,
) -> Path:
    """Collect the subset produced by one local canonical native build."""

    project = paths or project_paths()
    allowed_package_types = CLI_PACKAGE_TYPES.get(cli_target)
    if allowed_package_types is None:
        raise ArtifactError(f"{cli_target} is not a supported native release build")
    selected_package_types = (
        set(package_types) if package_types is not None else set(allowed_package_types)
    )
    if not selected_package_types or not selected_package_types <= allowed_package_types:
        raise ArtifactError(f"invalid local artifact subset for {cli_target}")
    candidates = [
        target
        for target in load_release_matrix(project).targets
        if target.rust_target == rust_target
        and any(build.cli_target == cli_target for build in target.builds)
    ]
    if len(candidates) != 1:
        raise ArtifactError(
            f"could not map {cli_target}/{rust_target} to one release matrix target"
        )
    target = candidates[0]
    specs = [spec for spec in target.artifacts if spec.package_type in selected_package_types]
    if {spec.package_type for spec in specs} != selected_package_types:
        raise ArtifactError(f"release matrix has no complete artifact subset for {cli_target}")
    output = project.dist / "desktop" / target.target_id / cli_target
    ensure_within(output, project.root, label="local artifact output")
    if output.is_symlink():
        raise ArtifactError(f"local artifact output cannot be a symlink: {output}")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    version = application_version(project)
    entries: list[dict[str, Any]] = []
    for spec in specs:
        source = _discover_source(project, spec, built_after=built_after)
        destination = output / spec.public_name(version)
        _copy_or_archive(source, destination, spec)
        if spec.executable and os.name != "nt":
            destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP)
        evidence = verify_artifact(destination, spec, version)
        entries.append(
            _manifest_entry(
                paths=project,
                target=target,
                spec=spec,
                path=destination,
                evidence=evidence,
            )
        )
    manifest = output / "build-manifest.json"
    _atomic_json(
        manifest,
        {
            "application_version": version,
            "cli_target": cli_target,
            "entries": sorted(entries, key=lambda item: item["filename"]),
            "matrix_id": target.target_id,
            "package_types": sorted(selected_package_types),
            "schema_version": MANIFEST_SCHEMA_VERSION,
        },
    )
    checksums = output / "SHA256SUMS"
    checksum_targets = sorted(
        (path for path in output.iterdir() if path.is_file() and path.name != "SHA256SUMS"),
        key=lambda path: path.name,
    )
    checksums.write_text(
        "".join(f"{sha256_file(path)}  {path.name}\n" for path in checksum_targets),
        encoding="utf-8",
        newline="\n",
    )
    verify_checksums(output, checksums)
    return manifest


def verify_fresh_windows_executable(
    path: Path,
    *,
    built_after: Path,
    paths: ProjectPaths | None = None,
) -> None:
    """Verify a raw Windows executable against the current canonical build boundary."""

    project = paths or project_paths()
    ensure_within(path, project.root, label="Windows executable")
    if path.is_symlink() or not path.is_file() or path.stat().st_size <= 0:
        raise ArtifactError(f"Windows executable is missing, empty, or unsafe: {path}")
    if _path_has_symlink(path, project.root):
        raise ArtifactError(f"Windows executable contains a symlinked path component: {path}")
    if not built_after.is_file():
        raise ArtifactError(f"build marker is missing: {built_after}")
    if path.stat().st_mtime_ns < built_after.stat().st_mtime_ns:
        raise ArtifactError(f"Windows executable is stale (older than build marker): {path}")
    _check_magic(path, EXPERIMENTAL_CROSS_PACKAGE_TYPE)


def experimental_windows_cross_source(
    *,
    rust_target: str,
    built_after: Path,
    paths: ProjectPaths | None = None,
) -> Path:
    project = paths or project_paths()
    executable = project.tauri / "target" / rust_target / "release" / "fmd-flashcard-desktop.exe"
    ensure_within(executable, project.root, label="experimental cross-build executable")
    if executable.is_symlink() or not executable.is_file() or executable.stat().st_size <= 0:
        raise ArtifactError(
            f"experimental cross-build executable is missing or unsafe: {executable}"
        )
    if not built_after.is_file() or executable.stat().st_mtime_ns < built_after.stat().st_mtime_ns:
        raise ArtifactError(f"experimental cross-build executable is stale: {executable}")
    _check_magic(executable, EXPERIMENTAL_CROSS_PACKAGE_TYPE)
    return executable


def collect_experimental_windows_cross_artifact(
    *,
    rust_target: str,
    built_after: Path,
    paths: ProjectPaths | None = None,
) -> Path:
    """Collect clearly labelled non-release evidence from the cargo-xwin fallback."""

    project = paths or project_paths()
    source = experimental_windows_cross_source(
        rust_target=rust_target,
        built_after=built_after,
        paths=project,
    )
    version = application_version(project)
    output = project.dist / "desktop" / EXPERIMENTAL_CROSS_MATRIX_ID / EXPERIMENTAL_CROSS_CLI_TARGET
    ensure_within(output, project.root, label="experimental artifact output")
    if output.is_symlink():
        raise ArtifactError(f"experimental artifact output cannot be a symlink: {output}")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    destination = output / f"FMDFlashcard-v{version}-windows-x86_64-cross-experimental.exe"
    shutil.copy2(source, destination)
    evidence = verify_artifact(
        destination,
        ArtifactSpec(
            EXPERIMENTAL_CROSS_PACKAGE_TYPE,
            "unused",
            destination.name,
        ),
        version,
    )
    manifest = output / "build-manifest.json"
    _atomic_json(
        manifest,
        {
            "application_version": version,
            "cli_target": EXPERIMENTAL_CROSS_CLI_TARGET,
            "entries": [
                {
                    "architecture": "x86_64",
                    "commit_sha": _git_value(project, "rev-parse", "HEAD"),
                    "file_size": evidence["size"],
                    "filename": destination.name,
                    "git_tag": "",
                    "notarization": "not-applicable",
                    "package_type": EXPERIMENTAL_CROSS_PACKAGE_TYPE,
                    "runner_os": _runner_os_name(),
                    "rust_target": rust_target,
                    "sha256": evidence["sha256"],
                    "signature": "unsigned",
                    "source_repository": REPOSITORY_URL,
                    "support_tier": "experimental",
                    "toolchains": _toolchains(),
                }
            ],
            "matrix_id": EXPERIMENTAL_CROSS_MATRIX_ID,
            "package_types": [EXPERIMENTAL_CROSS_PACKAGE_TYPE],
            "schema_version": MANIFEST_SCHEMA_VERSION,
            "support_tier": "experimental",
        },
    )
    checksums = output / "SHA256SUMS"
    checksum_targets = sorted((destination, manifest), key=lambda path: path.name)
    checksums.write_text(
        "".join(f"{sha256_file(path)}  {path.name}\n" for path in checksum_targets),
        encoding="utf-8",
        newline="\n",
    )
    verify_experimental_windows_cross_directory(output, paths=project)
    return manifest


def verify_experimental_windows_cross_directory(
    directory: Path,
    *,
    paths: ProjectPaths | None = None,
) -> list[Path]:
    project = paths or project_paths()
    root = Path(os.path.abspath(directory))
    ensure_within(root, project.root, label="experimental artifact directory")
    if root.is_symlink() or not root.is_dir():
        raise ArtifactError(f"experimental artifact directory is missing or unsafe: {root}")
    manifest = root / "build-manifest.json"
    try:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"experimental build manifest is invalid: {manifest}") from exc
    version = application_version(project)
    expected_name = f"FMDFlashcard-v{version}-windows-x86_64-cross-experimental.exe"
    if (
        payload.get("schema_version") != MANIFEST_SCHEMA_VERSION
        or payload.get("application_version") != version
        or payload.get("matrix_id") != EXPERIMENTAL_CROSS_MATRIX_ID
        or payload.get("cli_target") != EXPERIMENTAL_CROSS_CLI_TARGET
        or payload.get("support_tier") != "experimental"
        or payload.get("package_types") != [EXPERIMENTAL_CROSS_PACKAGE_TYPE]
    ):
        raise ArtifactError("experimental build manifest metadata is invalid")
    entries = payload.get("entries")
    if not isinstance(entries, list) or len(entries) != 1 or not isinstance(entries[0], dict):
        raise ArtifactError("experimental build manifest must contain exactly one entry")
    entry = entries[0]
    artifact = root / expected_name
    evidence = verify_artifact(
        artifact,
        ArtifactSpec(EXPERIMENTAL_CROSS_PACKAGE_TYPE, "unused", expected_name),
        version,
    )
    if (
        entry.get("filename") != expected_name
        or entry.get("package_type") != EXPERIMENTAL_CROSS_PACKAGE_TYPE
        or entry.get("support_tier") != "experimental"
        or entry.get("signature") != "unsigned"
        or entry.get("file_size") != evidence["size"]
        or entry.get("sha256") != evidence["sha256"]
    ):
        raise ArtifactError("experimental build manifest evidence is invalid")
    checksums = root / "SHA256SUMS"
    verify_checksums(root, checksums)
    allowed = {expected_name, "build-manifest.json", "SHA256SUMS"}
    disk_entries = list(root.iterdir())
    if any(path.is_symlink() or not path.is_file() for path in disk_entries):
        raise ArtifactError("experimental build directory contains an unsafe entry")
    if {path.name for path in disk_entries} != allowed:
        raise ArtifactError("experimental build directory inventory is invalid")
    checksum_names = [
        line.split("  ", 1)[1] for line in checksums.read_text(encoding="utf-8").splitlines()
    ]
    if checksum_names != sorted(allowed - {"SHA256SUMS"}):
        raise ArtifactError("experimental checksum inventory is incomplete or not sorted")
    return [artifact]


def verify_target_sources(
    matrix_id: str,
    *,
    built_after: Path | None = None,
    package_types: Iterable[str] | None = None,
    paths: ProjectPaths | None = None,
) -> list[Path]:
    """Verify unnormalized native outputs before release collection."""
    project = paths or project_paths()
    target = load_release_matrix(project).target(matrix_id)
    version = application_version(project)
    requested = set(package_types) if package_types is not None else None
    available = {spec.package_type for spec in target.artifacts}
    if requested is not None and (not requested or not requested <= available):
        raise ArtifactError(f"invalid artifact subset for release target {matrix_id}")
    verified: list[Path] = []
    for spec in target.artifacts:
        if requested is not None and spec.package_type not in requested:
            continue
        source = _discover_source(project, spec, built_after=built_after)
        if spec.archive == "tar.gz" and source.is_dir():
            info_path = source / "Contents" / "Info.plist"
            executable_root = source / "Contents" / "MacOS"
            if not info_path.is_file() or not executable_root.is_dir():
                raise ArtifactError(f"macOS app bundle structure is incomplete: {source}")
            payload = plistlib.loads(info_path.read_bytes())
            actual = str(payload.get("CFBundleShortVersionString", ""))
            if actual != version:
                raise ArtifactError(
                    f"app bundle version mismatch for {source}: {actual}; expected {version}"
                )
            executables = [item for item in executable_root.iterdir() if item.is_file()]
            if not executables or not any(os.access(item, os.X_OK) for item in executables):
                raise ArtifactError(f"app bundle has no executable: {source}")
        else:
            verify_artifact(source, spec, version)
        verified.append(source)
    return verified


def verify_collected_target_directory(
    matrix_id: str,
    directory: Path,
    *,
    paths: ProjectPaths | None = None,
) -> list[Path]:
    """Re-verify one normalized target directory and its manifest evidence."""

    project = paths or project_paths()
    root = Path(os.path.abspath(directory))
    ensure_within(root, project.root, label="artifact directory")
    if root.is_symlink():
        raise ArtifactError(f"artifact directory cannot be a symlink: {root}")
    fragment = root / "manifest-fragment.json"
    if fragment.is_symlink():
        raise ArtifactError(f"manifest fragment cannot be a symlink: {fragment}")
    try:
        payload = json.loads(fragment.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"manifest fragment is invalid: {fragment}") from exc
    version = application_version(project)
    if payload.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        raise ArtifactError("manifest fragment schema is unsupported")
    if payload.get("matrix_id") != matrix_id:
        raise ArtifactError("manifest fragment matrix id does not match the requested target")
    if payload.get("application_version") != version:
        raise ArtifactError("manifest fragment version does not match VERSION")
    entries = payload.get("entries")
    if not isinstance(entries, list):
        raise ArtifactError("manifest fragment entries must be an array")
    target = load_release_matrix(project).target(matrix_id)
    expected = {spec.public_name(version): spec for spec in target.artifacts}
    actual = {str(entry.get("filename")): entry for entry in entries if isinstance(entry, dict)}
    if set(actual) != set(expected) or len(actual) != len(entries):
        raise ArtifactError("manifest fragment inventory does not match the release matrix")
    verified: list[Path] = []
    for filename, spec in sorted(expected.items()):
        path = root / filename
        evidence = verify_artifact(path, spec, version)
        entry = actual[filename]
        if entry.get("package_type") != spec.package_type:
            raise ArtifactError(f"manifest package type mismatch: {filename}")
        if evidence["size"] != entry.get("file_size"):
            raise ArtifactError(f"manifest size mismatch: {filename}")
        if evidence["sha256"] != entry.get("sha256"):
            raise ArtifactError(f"manifest checksum mismatch: {filename}")
        verified.append(path)
    allowed = set(expected) | {"manifest-fragment.json"}
    entries_on_disk = list(root.iterdir())
    if any(path.is_symlink() or not path.is_file() for path in entries_on_disk):
        raise ArtifactError("artifact directory must contain only regular non-symlink files")
    actual_files = {path.name for path in entries_on_disk}
    if actual_files != allowed:
        raise ArtifactError("artifact directory contains missing or unexpected files")
    return verified


def verify_local_build_directory(
    directory: Path,
    *,
    paths: ProjectPaths | None = None,
) -> list[Path]:
    """Re-verify one canonical local build directory before it is copied."""

    project = paths or project_paths()
    root = Path(os.path.abspath(directory))
    ensure_within(root, project.root, label="local artifact directory")
    if root.is_symlink() or not root.is_dir():
        raise ArtifactError(f"local artifact directory is missing or unsafe: {root}")
    manifest_path = root / "build-manifest.json"
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"local build manifest is invalid: {manifest_path}") from exc
    if payload.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        raise ArtifactError("local build manifest schema is unsupported")
    version = application_version(project)
    if payload.get("application_version") != version:
        raise ArtifactError("local build manifest version does not match VERSION")
    matrix_id = payload.get("matrix_id")
    cli_target = payload.get("cli_target")
    if not isinstance(matrix_id, str) or not isinstance(cli_target, str):
        raise ArtifactError("local build manifest target metadata is invalid")
    if matrix_id == EXPERIMENTAL_CROSS_MATRIX_ID:
        return verify_experimental_windows_cross_directory(root, paths=project)
    target = load_release_matrix(project).target(matrix_id)
    if not any(build.cli_target == cli_target for build in target.builds):
        raise ArtifactError("local build manifest target is not declared by the release matrix")
    package_types = CLI_PACKAGE_TYPES.get(cli_target)
    if package_types is None:
        raise ArtifactError("local build manifest uses an unsupported CLI target")
    entries = payload.get("entries")
    if not isinstance(entries, list) or any(not isinstance(entry, dict) for entry in entries):
        raise ArtifactError("local build manifest entries must be an array of objects")
    actual = {str(entry.get("filename")): entry for entry in entries}
    raw_package_types = payload.get("package_types")
    if (
        not isinstance(raw_package_types, list)
        or not raw_package_types
        or not all(isinstance(item, str) for item in raw_package_types)
    ):
        raise ArtifactError("local build manifest package_types must be a non-empty array")
    selected_package_types = set(raw_package_types)
    if (
        len(selected_package_types) != len(raw_package_types)
        or not selected_package_types <= package_types
    ):
        raise ArtifactError("local build manifest package type subset is invalid")
    specs = [spec for spec in target.artifacts if spec.package_type in selected_package_types]
    expected = {spec.public_name(version): spec for spec in specs}
    if {spec.package_type for spec in specs} != selected_package_types:
        raise ArtifactError("local build manifest has no complete artifact subset")
    if set(actual) != set(expected) or len(actual) != len(entries):
        raise ArtifactError("local build manifest inventory does not match the release matrix")

    verified: list[Path] = []
    for filename, spec in sorted(expected.items()):
        artifact = root / filename
        evidence = verify_artifact(artifact, spec, version)
        entry = actual[filename]
        if entry.get("package_type") != spec.package_type:
            raise ArtifactError(f"local build manifest package type mismatch: {filename}")
        if entry.get("file_size") != evidence["size"]:
            raise ArtifactError(f"local build manifest size mismatch: {filename}")
        if entry.get("sha256") != evidence["sha256"]:
            raise ArtifactError(f"local build manifest checksum mismatch: {filename}")
        expected_runner = {"linux": "Linux", "windows": "Windows", "macos": "macOS"}[target.os]
        if (
            entry.get("architecture") != target.architecture
            or entry.get("rust_target") != target.rust_target
            or entry.get("runner_os") != expected_runner
            or entry.get("source_repository") != REPOSITORY_URL
        ):
            raise ArtifactError(f"local build manifest target evidence is invalid: {filename}")
        commit = entry.get("commit_sha")
        if not isinstance(commit, str) or not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ArtifactError(f"local build manifest commit SHA is invalid: {filename}")
        if entry.get("git_tag") not in {"", f"v{version}"}:
            raise ArtifactError(f"local build manifest tag is invalid: {filename}")
        if entry.get("signature") not in {"signed", "unsigned"}:
            raise ArtifactError(f"local build manifest signature state is unverified: {filename}")
        expected_notarization = (
            {"notarized", "not-notarized"} if target.os == "macos" else {"not-applicable"}
        )
        if entry.get("notarization") not in expected_notarization:
            raise ArtifactError(f"local build manifest notarization state is invalid: {filename}")
        toolchains = entry.get("toolchains")
        if not isinstance(toolchains, dict) or any(
            not isinstance(toolchains.get(name), str) or toolchains.get(name) in {"", "unavailable"}
            for name in ("python", "node", "pnpm", "rustc", "cargo")
        ):
            raise ArtifactError(f"local build manifest toolchain evidence is invalid: {filename}")
        verified.append(artifact)

    checksums = root / "SHA256SUMS"
    verify_checksums(root, checksums)
    allowed = set(expected) | {"build-manifest.json", "SHA256SUMS"}
    entries_on_disk = list(root.iterdir())
    if any(path.is_symlink() or not path.is_file() for path in entries_on_disk):
        raise ArtifactError("local build directory must contain only regular non-symlink files")
    if {path.name for path in entries_on_disk} != allowed:
        raise ArtifactError("local build directory contains missing or unexpected files")
    checksum_lines = checksums.read_text(encoding="utf-8").splitlines()
    checksum_names = [line.split("  ", 1)[1] for line in checksum_lines]
    expected_checksum_names = sorted(allowed - {"SHA256SUMS"})
    if checksum_names != expected_checksum_names:
        raise ArtifactError("local checksum inventory is incomplete or not sorted")
    return verified


def verify_local_desktop_root(
    directory: Path,
    *,
    paths: ProjectPaths | None = None,
) -> list[Path]:
    """Verify the complete two-level local artifact tree used by ``tauri copy``."""

    project = paths or project_paths()
    root = Path(os.path.abspath(directory))
    ensure_within(root, project.root, label="local desktop artifact root")
    if root.is_symlink() or not root.is_dir():
        raise ArtifactError(f"desktop artifact directory is missing or unsafe: {root}")
    manifests = sorted(root.rglob("build-manifest.json"), key=_path_sort_key)
    if not manifests:
        raise ArtifactError(f"desktop artifact directory has no verified builds: {root}")
    allowed_directories = {root}
    verified_directories: set[Path] = set()
    for manifest in manifests:
        relative = manifest.relative_to(root)
        if len(relative.parts) != 3:
            raise ArtifactError(f"local build manifest has an unexpected path: {relative}")
        matrix_id, cli_target, _ = relative.parts
        try:
            payload = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ArtifactError(f"local build manifest is invalid: {manifest}") from exc
        if payload.get("matrix_id") != matrix_id or payload.get("cli_target") != cli_target:
            raise ArtifactError(
                f"local build manifest path does not match its metadata: {relative}"
            )
        build_root = manifest.parent
        verify_local_build_directory(build_root, paths=project)
        verified_directories.add(build_root)
        allowed_directories.update({build_root.parent, build_root})

    files: list[Path] = []
    for path in sorted(root.rglob("*"), key=_path_sort_key):
        if path.is_symlink():
            raise ArtifactError(f"local desktop artifact tree contains a symlink: {path}")
        if path.is_dir():
            if path not in allowed_directories:
                raise ArtifactError(
                    f"local desktop artifact tree contains an extra directory: {path}"
                )
            continue
        if path.parent not in verified_directories:
            raise ArtifactError(f"local desktop artifact tree contains an extra file: {path}")
        files.append(path)
    return files


def _atomic_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="\n", dir=path.parent, delete=False
    ) as handle:
        handle.write(encoded)
        temporary = Path(handle.name)
    temporary.replace(path)


def _build_timestamp() -> str:
    raw = os.environ.get("SOURCE_DATE_EPOCH")
    if raw:
        try:
            value = datetime.fromtimestamp(int(raw), UTC)
        except (ValueError, OSError) as exc:
            raise ArtifactError("SOURCE_DATE_EPOCH is not a valid timestamp") from exc
    else:
        value = datetime.now(UTC)
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _find_unique(input_dir: Path, filename: str) -> Path:
    matches = [path for path in input_dir.rglob(filename) if path.is_file()]
    if len(matches) != 1:
        raise ArtifactError(
            f"expected exactly one {filename} in assembly input; found {len(matches)}"
        )
    return matches[0]


def _extra_entry(
    path: Path,
    package_type: str,
    paths: ProjectPaths,
    *,
    tag: str,
) -> dict[str, Any]:
    return {
        "architecture": "any",
        "commit_sha": os.environ.get("GITHUB_SHA") or _git_value(paths, "rev-parse", "HEAD"),
        "file_size": path.stat().st_size,
        "filename": path.name,
        "git_tag": tag,
        "notarization": "not-applicable",
        "package_type": package_type,
        "runner_os": _runner_os_name(),
        "rust_target": "not-applicable",
        "sha256": sha256_file(path),
        "signature": "not-applicable",
        "source_repository": REPOSITORY_URL,
        "toolchains": _toolchains(),
    }


def _load_fragments(
    input_dir: Path,
    version: str,
    *,
    expected_targets: dict[str, TargetSpec],
    expected_commit: str,
) -> list[dict[str, Any]]:
    fragments = sorted(input_dir.rglob("manifest-fragment.json"), key=_path_sort_key)
    if len(fragments) != len(expected_targets):
        raise ArtifactError(
            f"expected {len(expected_targets)} native manifest fragments; found {len(fragments)}"
        )
    matrix_ids: set[str] = set()
    entries: list[dict[str, Any]] = []
    for fragment in fragments:
        try:
            payload = json.loads(fragment.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ArtifactError(f"manifest fragment is invalid: {fragment}") from exc
        if payload.get("schema_version") != MANIFEST_SCHEMA_VERSION:
            raise ArtifactError(f"unsupported manifest fragment schema: {fragment}")
        if payload.get("application_version") != version:
            raise ArtifactError(f"manifest fragment version mismatch: {fragment}")
        matrix_id = payload.get("matrix_id")
        if (
            not isinstance(matrix_id, str)
            or matrix_id not in expected_targets
            or matrix_id in matrix_ids
        ):
            raise ArtifactError(f"duplicate or invalid matrix id in {fragment}")
        matrix_ids.add(matrix_id)
        raw_entries = payload.get("entries")
        if not isinstance(raw_entries, list):
            raise ArtifactError(f"manifest fragment entries are invalid: {fragment}")
        target = expected_targets[matrix_id]
        expected_entries = {spec.public_name(version): spec for spec in target.artifacts}
        raw_names = [entry.get("filename") for entry in raw_entries if isinstance(entry, dict)]
        if len(raw_names) != len(raw_entries) or set(raw_names) != set(expected_entries):
            raise ArtifactError(f"manifest fragment inventory is invalid: {fragment}")
        for entry in raw_entries:
            if not isinstance(entry, dict):
                raise ArtifactError(f"manifest fragment entry is invalid: {fragment}")
            if not isinstance(entry.get("file_size"), int) or entry["file_size"] <= 0:
                raise ArtifactError(f"manifest fragment size is invalid: {fragment}")
            digest = entry.get("sha256")
            if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
                raise ArtifactError(f"manifest fragment checksum is invalid: {fragment}")
            if entry.get("signature") not in {"signed", "unsigned"}:
                raise ArtifactError(f"manifest fragment signing state is invalid: {fragment}")
            if entry.get("notarization") not in {
                "notarized",
                "not-notarized",
                "not-applicable",
            }:
                raise ArtifactError(f"manifest fragment notarization state is invalid: {fragment}")
            if target.os == "macos" and entry.get("notarization") == "not-applicable":
                raise ArtifactError(f"macOS notarization state is missing: {fragment}")
            if target.os != "macos" and entry.get("notarization") != "not-applicable":
                raise ArtifactError(f"non-macOS notarization state is invalid: {fragment}")
            expected_spec = expected_entries[entry["filename"]]
            if entry.get("package_type") != expected_spec.package_type:
                raise ArtifactError(f"manifest fragment package type is invalid: {fragment}")
            if entry.get("architecture") != target.architecture:
                raise ArtifactError(f"manifest fragment architecture is invalid: {fragment}")
            if entry.get("rust_target") != target.rust_target:
                raise ArtifactError(f"manifest fragment Rust target is invalid: {fragment}")
            expected_runner_os = {"linux": "Linux", "windows": "Windows", "macos": "macOS"}[
                target.os
            ]
            if entry.get("runner_os") != expected_runner_os:
                raise ArtifactError(f"manifest fragment runner OS is invalid: {fragment}")
            commit = entry.get("commit_sha")
            if not isinstance(commit, str) or not re.fullmatch(r"[0-9a-f]{40}", commit):
                raise ArtifactError(f"manifest fragment commit SHA is invalid: {fragment}")
            if commit != expected_commit:
                raise ArtifactError(f"manifest fragment commit SHA is stale or mixed: {fragment}")
            if entry.get("source_repository") != REPOSITORY_URL:
                raise ArtifactError(f"manifest fragment repository is invalid: {fragment}")
            toolchains = entry.get("toolchains")
            if not isinstance(toolchains, dict) or any(
                not isinstance(toolchains.get(name), str)
                or toolchains.get(name) in {"", "unavailable"}
                for name in ("python", "node", "pnpm", "rustc", "cargo")
            ):
                raise ArtifactError(f"manifest fragment toolchains are invalid: {fragment}")
        entries.extend(raw_entries)
    if matrix_ids != set(expected_targets):
        raise ArtifactError(
            f"manifest fragment matrix mismatch; expected={sorted(expected_targets)}, "
            f"actual={sorted(matrix_ids)}"
        )
    return entries


def _validate_spdx(path: Path) -> None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"SBOM is not valid JSON: {path}") from exc
    if not isinstance(payload, dict) or not str(payload.get("spdxVersion", "")).startswith("SPDX-"):
        raise ArtifactError(f"SBOM is not SPDX JSON: {path}")


def _validate_pdf(path: Path) -> None:
    if path.stat().st_size <= 8 or path.read_bytes()[:5] != b"%PDF-":
        raise ArtifactError(f"documentation asset is not a valid non-empty PDF: {path}")


def _copy_exact(source: Path, destination: Path) -> None:
    if source.is_symlink() or not source.is_file() or source.stat().st_size <= 0:
        raise ArtifactError(f"release input must be a non-empty regular file: {source}")
    if destination.exists():
        raise ArtifactError(f"duplicate release output: {destination.name}")
    shutil.copy2(source, destination)


def assemble_release(
    *,
    input_dir: Path,
    output_dir: Path,
    tag: str,
    paths: ProjectPaths | None = None,
) -> tuple[Path, Path]:
    project = paths or project_paths()
    input_path = Path(os.path.abspath(input_dir))
    output_path = Path(os.path.abspath(output_dir))
    ensure_within(input_path, project.root, label="release input")
    ensure_within(output_path, project.root, label="release output")
    if input_path.is_symlink() or output_path.is_symlink():
        raise ArtifactError("release input and output directories cannot be symlinks")
    version = application_version(project)
    expected_tag = f"v{version}"
    if tag != expected_tag:
        raise ArtifactError(f"release tag {tag!r} does not match {expected_tag!r}")
    commit_sha = os.environ.get("GITHUB_SHA") or _git_value(project, "rev-parse", "HEAD")
    if not re.fullmatch(r"[0-9a-f]{40}", commit_sha):
        raise ArtifactError("release assembly commit SHA is invalid")
    matrix = load_release_matrix(project)
    entries = _load_fragments(
        input_path,
        version,
        expected_targets={target.target_id: target for target in matrix.targets},
        expected_commit=commit_sha,
    )
    expected_names = set(matrix.expected_filenames(version))
    actual_names = [entry.get("filename") for entry in entries]
    if any(not isinstance(name, str) for name in actual_names):
        raise ArtifactError("manifest fragment contains an invalid filename")
    if len(actual_names) != len(set(name.casefold() for name in actual_names)):
        raise ArtifactError("manifest fragment filenames are duplicated")
    missing = expected_names - set(actual_names)
    unexpected = set(actual_names) - expected_names
    if missing or unexpected:
        raise ArtifactError(
            f"native asset inventory mismatch; missing={sorted(missing)}, "
            f"unexpected={sorted(unexpected)}"
        )
    output = output_path
    if output.exists() and any(output.iterdir()):
        raise ArtifactError(f"release assembly directory is not empty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        filename = str(entry["filename"])
        source = _find_unique(input_path, filename)
        if source.stat().st_size != entry.get("file_size"):
            raise ArtifactError(f"size mismatch for {filename}")
        if sha256_file(source) != entry.get("sha256"):
            raise ArtifactError(f"checksum mismatch for {filename}")
        _copy_exact(source, output / filename)

    pdf_name = f"FMDFlashcard-v{version}-documentation.pdf"
    pdf_source = _find_unique(input_path, pdf_name)
    _validate_pdf(pdf_source)
    _copy_exact(pdf_source, output / pdf_name)
    entries.append(_extra_entry(output / pdf_name, "documentation", project, tag=tag))

    sbom_source = _find_unique(input_path, "SBOM.spdx.json")
    _validate_spdx(sbom_source)
    _copy_exact(sbom_source, output / "SBOM.spdx.json")
    entries.append(_extra_entry(output / "SBOM.spdx.json", "sbom", project, tag=tag))

    _enforce_signing_policy(entries)
    manifest_path = output / "release-manifest.json"
    manifest = {
        "application_version": version,
        "build_timestamp_utc": _build_timestamp(),
        "commit_sha": commit_sha,
        "entries": sorted(entries, key=lambda item: item["filename"]),
        "git_tag": tag,
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "source_repository": matrix.repository,
    }
    _atomic_json(manifest_path, manifest)
    checksums_path = output / "SHA256SUMS"
    checksum_targets = sorted(
        (path for path in output.iterdir() if path.is_file() and path.name != "SHA256SUMS"),
        key=lambda path: path.name,
    )
    lines = [f"{sha256_file(path)}  {path.name}" for path in checksum_targets]
    checksums_path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    verify_checksums(output, checksums_path)
    return manifest_path, checksums_path


def _enforce_signing_policy(entries: Iterable[dict[str, Any]]) -> None:
    policy = os.environ.get("FMD_SIGNING_POLICY", "optional").lower()
    if policy not in {"optional", "required"}:
        raise ArtifactError("FMD_SIGNING_POLICY must be optional or required")
    if policy == "required":
        unsigned = [
            str(entry.get("filename"))
            for entry in entries
            if entry.get("package_type") in {"msi", "nsis", "portable-zip", "dmg", "app-archive"}
            and entry.get("signature") != "signed"
        ]
        if unsigned:
            raise ArtifactError(
                "signing is required but unsigned assets remain: " + ", ".join(unsigned)
            )
        unnotarized = [
            str(entry.get("filename"))
            for entry in entries
            if entry.get("package_type") in {"dmg", "app-archive"}
            and entry.get("notarization") != "notarized"
        ]
        if unnotarized:
            raise ArtifactError(
                "notarization is required but unnotarized assets remain: " + ", ".join(unnotarized)
            )


def verify_checksums(directory: Path, checksum_file: Path | None = None) -> None:
    source = checksum_file or directory / "SHA256SUMS"
    if source.is_symlink() or not source.is_file():
        raise ArtifactError(f"checksum file is missing: {source}")
    seen: set[str] = set()
    for line in source.read_text(encoding="utf-8").splitlines():
        parts = line.split("  ", 1)
        if len(parts) != 2 or not re.fullmatch(r"[0-9a-f]{64}", parts[0]):
            raise ArtifactError(f"invalid checksum line: {line!r}")
        digest, filename = parts
        if filename in seen:
            raise ArtifactError(f"duplicate checksum filename: {filename}")
        seen.add(filename)
        path = directory / filename
        ensure_within(path.resolve(strict=False), directory.resolve())
        if not path.is_file() or path.is_symlink():
            raise ArtifactError(f"checksummed file is missing or unsafe: {filename}")
        if sha256_file(path) != digest:
            raise ArtifactError(f"checksum verification failed: {filename}")


def verify_manifest_directory(directory: Path, paths: ProjectPaths | None = None) -> None:
    project = paths or project_paths()
    release_root = Path(os.path.abspath(directory))
    ensure_within(release_root, project.root, label="release directory")
    if release_root.is_symlink():
        raise ArtifactError("release directory cannot be a symlink")
    directory = release_root
    manifest_path = directory / "release-manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"release manifest is invalid: {exc}") from exc
    if manifest.get("schema_version") != MANIFEST_SCHEMA_VERSION:
        raise ArtifactError("release manifest schema is unsupported")
    version = application_version(project)
    if manifest.get("application_version") != version:
        raise ArtifactError("release manifest version does not match VERSION")
    if manifest.get("git_tag") != f"v{version}":
        raise ArtifactError("release manifest tag does not match VERSION")
    if manifest.get("source_repository") != REPOSITORY_URL:
        raise ArtifactError("release manifest repository is unexpected")
    commit_sha = manifest.get("commit_sha")
    if not isinstance(commit_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", commit_sha):
        raise ArtifactError("release manifest commit SHA is invalid")
    timestamp = manifest.get("build_timestamp_utc")
    if not isinstance(timestamp, str) or not re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", timestamp
    ):
        raise ArtifactError("release manifest UTC timestamp is invalid")
    entries = manifest.get("entries")
    if not isinstance(entries, list):
        raise ArtifactError("release manifest entries must be an array")
    if entries != sorted(entries, key=lambda item: str(item.get("filename", ""))):
        raise ArtifactError("release manifest entries are not deterministically sorted")
    names: set[str] = set()
    matrix = load_release_matrix(project)
    native_contract = {
        spec.public_name(version): (target, spec)
        for target in matrix.targets
        for spec in target.artifacts
    }
    extra_contract = {
        f"FMDFlashcard-v{version}-documentation.pdf": "documentation",
        "SBOM.spdx.json": "sbom",
    }
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("filename"), str):
            raise ArtifactError("release manifest entry is invalid")
        filename = entry["filename"]
        safe_name = _safe_archive_name(filename)
        if len(safe_name.parts) != 1:
            raise ArtifactError(f"release manifest filename is not a basename: {filename}")
        if filename.casefold() in names:
            raise ArtifactError(f"duplicate manifest filename: {filename}")
        names.add(filename.casefold())
        if entry.get("commit_sha") != commit_sha:
            raise ArtifactError(f"manifest commit verification failed: {filename}")
        if entry.get("source_repository") != REPOSITORY_URL:
            raise ArtifactError(f"manifest repository verification failed: {filename}")
        if entry.get("git_tag") not in {"", manifest["git_tag"]}:
            raise ArtifactError(f"manifest tag verification failed: {filename}")
        toolchains = entry.get("toolchains")
        if not isinstance(toolchains, dict) or any(
            not isinstance(toolchains.get(name), str) or toolchains.get(name) in {"", "unavailable"}
            for name in ("python", "node", "pnpm", "rustc", "cargo")
        ):
            raise ArtifactError(f"manifest toolchain evidence is invalid: {filename}")
        if filename in native_contract:
            target, spec = native_contract[filename]
            expected_runner = {"linux": "Linux", "windows": "Windows", "macos": "macOS"}[target.os]
            if (
                entry.get("package_type") != spec.package_type
                or entry.get("architecture") != target.architecture
                or entry.get("rust_target") != target.rust_target
                or entry.get("runner_os") != expected_runner
            ):
                raise ArtifactError(f"manifest native target evidence is invalid: {filename}")
            if entry.get("signature") not in {"signed", "unsigned"}:
                raise ArtifactError(f"manifest signature state is invalid: {filename}")
            expected_notarization = (
                {"notarized", "not-notarized"} if target.os == "macos" else {"not-applicable"}
            )
            if entry.get("notarization") not in expected_notarization:
                raise ArtifactError(f"manifest notarization state is invalid: {filename}")
        elif filename in extra_contract:
            if (
                entry.get("package_type") != extra_contract[filename]
                or entry.get("architecture") != "any"
                or entry.get("rust_target") != "not-applicable"
                or entry.get("signature") != "not-applicable"
                or entry.get("notarization") != "not-applicable"
            ):
                raise ArtifactError(f"manifest auxiliary asset evidence is invalid: {filename}")
        else:
            raise ArtifactError(f"manifest contains an undeclared asset: {filename}")
        path = directory / filename
        if not path.is_file() or path.stat().st_size != entry.get("file_size"):
            raise ArtifactError(f"manifest size verification failed: {filename}")
        if sha256_file(path) != entry.get("sha256"):
            raise ArtifactError(f"manifest checksum verification failed: {filename}")
    verify_checksums(directory)
    _enforce_signing_policy(entries)
    expected_names = set(matrix.expected_filenames(version))
    expected_names.update(
        {
            f"FMDFlashcard-v{version}-documentation.pdf",
            "SBOM.spdx.json",
        }
    )
    manifest_names = {str(entry["filename"]) for entry in entries}
    if manifest_names != expected_names:
        raise ArtifactError(
            f"release manifest inventory mismatch; expected={sorted(expected_names)}, "
            f"actual={sorted(manifest_names)}"
        )
    allowed_files = expected_names | {"release-manifest.json", "SHA256SUMS"}
    directory_entries = list(directory.iterdir())
    if any(path.is_symlink() or not path.is_file() for path in directory_entries):
        raise ArtifactError("release directory must contain only regular non-symlink files")
    actual_files = {path.name for path in directory_entries}
    if actual_files != allowed_files:
        raise ArtifactError(
            f"release directory inventory mismatch; expected={sorted(allowed_files)}, "
            f"actual={sorted(actual_files)}"
        )
    checksum_lines = (directory / "SHA256SUMS").read_text(encoding="utf-8").splitlines()
    checksum_names = {line.split("  ", 1)[1] for line in checksum_lines}
    expected_checksum_names = allowed_files - {"SHA256SUMS"}
    if checksum_names != expected_checksum_names:
        raise ArtifactError("checksum inventory does not exactly match the verified release files")
    if checksum_lines != sorted(checksum_lines, key=lambda line: line.split("  ", 1)[1]):
        raise ArtifactError("checksum lines are not deterministically sorted")
