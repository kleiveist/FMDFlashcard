"""Deterministic, fail-closed export of the portable tooling payload."""

from __future__ import annotations

import ctypes
import errno
import hashlib
import os
import shutil
import stat
import sys
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from tools.core.context import load_context
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write,
    atomic_write_text,
    ensure_directory,
    read_regular_bytes,
    read_regular_text,
    safe_relative_path,
    validate_root,
)
from tools.core.portable_payload import (
    PAYLOAD_MANIFEST_NAME,
    PortablePayloadError,
    PortablePayloadManifest,
    create_portable_payload_manifest,
    render_portable_payload_manifest,
    validate_portable_payload,
)
from tools.core.project_config import ProjectConfigError

PACKAGE_PREFIX = "Template-Tooling-"
_FIXED_TIMESTAMP = 946684800
_ALLOWED_HIDDEN_FILE = "tools/resources/examples/.env.example"
_ALLOWED_BUILD_DIRECTORY = "tools/tauri/build"
_SOURCE_ONLY_NAMES = frozenset({".template", "template_lifecycle"})
_TRANSIENT_SUFFIXES = (".bak", ".orig", ".swp", ".tmp", "~")


class ExportError(RuntimeError):
    """Raised when a portable export cannot be created safely."""


@dataclass(frozen=True, slots=True)
class ExportResult:
    """Identity of one completed export directory."""

    path: Path
    tooling_version: str
    manifest_digest: str
    file_count: int


def export_portable_tooling(
    *,
    output_parent: Path | None = None,
    tools_root: Path | None = None,
) -> ExportResult:
    """Create one reproducible ``tools/`` and ``docs/toolingdocs/`` directory.

    ``output_parent`` must already exist. Refusing to create or replace an existing
    package keeps the command from silently destroying a previous release.
    """

    try:
        tools = validate_root(
            Path(tools_root or Path(__file__).resolve().parents[1]).absolute()
        )
        project = validate_root(tools.parent)
        docs = validate_root(
            load_context(project_root=project, tools_root=tools).docs_root
        )
        parent = validate_root(Path(output_parent or Path.cwd()).absolute())
        version = read_regular_text(
            tools / "VERSION",
            root=tools,
            label="Tooling version",
        ).strip()
        manifest = create_portable_payload_manifest(
            project_root=project,
            tools_root=tools,
            docs_root=docs,
            tooling_version=version,
        )
        _audit_sources(project=project, tools=tools, docs=docs)
        target = parent / f"{PACKAGE_PREFIX}{version}"
        _validate_target(parent=parent, target=target, tools=tools, docs=docs)
        return _publish_export(
            parent=parent,
            target=target,
            project=project,
            tools=tools,
            docs=docs,
            manifest=manifest,
        )
    except ExportError:
        raise
    except (
        FilesystemSafetyError,
        PortablePayloadError,
        ProjectConfigError,
        OSError,
    ) as exc:
        raise ExportError(str(exc)) from exc


def _audit_sources(*, project: Path, tools: Path, docs: Path) -> None:
    """Reject every source object that is unsafe or release-inappropriate."""

    folded: dict[str, str] = {}
    for actual_root, logical_root in ((tools, "tools"), (docs, "docs/toolingdocs")):

        def fail_walk(error: OSError, root: Path = actual_root) -> None:
            raise ExportError(
                f"Could not traverse export source: {error.filename or root}."
            ) from error

        for directory, names, filenames in os.walk(
            actual_root,
            topdown=True,
            followlinks=False,
            onerror=fail_walk,
        ):
            names.sort()
            filenames.sort()
            current = Path(directory)
            logical_directory = Path(logical_root) / current.relative_to(actual_root)
            for name, expect_directory in (
                *((name, True) for name in names),
                *((name, False) for name in filenames),
            ):
                candidate = current / name
                logical = (logical_directory / name).as_posix()
                _validate_source_object(
                    candidate,
                    logical,
                    expect_directory=expect_directory,
                    project=project,
                )
                _validate_export_policy(logical, is_directory=expect_directory)
                normalized = safe_relative_path(logical)
                previous = folded.setdefault(normalized.casefold(), normalized)
                if previous != normalized:
                    raise ExportError(
                        "Export source contains a case-folding collision: "
                        f"{previous} and {normalized}."
                    )


def _validate_source_object(
    path: Path,
    logical: str,
    *,
    expect_directory: bool,
    project: Path,
) -> None:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise ExportError(
            f"Could not inspect export source object: {logical}."
        ) from exc
    expected = (
        stat.S_ISDIR(metadata.st_mode)
        if expect_directory
        else stat.S_ISREG(metadata.st_mode)
    )
    if stat.S_ISLNK(metadata.st_mode) or not expected:
        kind = "directory" if expect_directory else "regular file"
        raise ExportError(f"Export source object must be a {kind}: {logical}.")
    try:
        path.resolve(strict=True).relative_to(project)
    except (OSError, ValueError) as exc:
        raise ExportError(
            f"Export source object escapes the project: {logical}."
        ) from exc


def _validate_export_policy(logical: str, *, is_directory: bool) -> None:
    path = PurePosixPath(logical)
    folded_parts = tuple(part.casefold() for part in path.parts)
    folded_name = path.name.casefold()
    if any(part in _SOURCE_ONLY_NAMES for part in folded_parts):
        raise ExportError(
            f"Export source contains an old template artifact: {logical}."
        )
    if folded_name == ".template-tooling-source":
        raise ExportError(f"Export source contains the source marker: {logical}.")
    if (
        any(part.startswith(".") for part in path.parts)
        and logical != _ALLOWED_HIDDEN_FILE
    ):
        raise ExportError(f"Export source contains a hidden object: {logical}.")
    if is_directory and folded_name == "build" and logical != _ALLOWED_BUILD_DIRECTORY:
        raise ExportError(
            f"Export source contains an unapproved build directory: {logical}."
        )
    if not is_directory and (
        folded_name == ".env"
        or (folded_name.startswith(".env.") and logical != _ALLOWED_HIDDEN_FILE)
        or folded_name.endswith(_TRANSIENT_SUFFIXES)
    ):
        raise ExportError(
            f"Export source contains a transient or sensitive file: {logical}."
        )


def _validate_target(*, parent: Path, target: Path, tools: Path, docs: Path) -> None:
    if target.is_relative_to(tools) or target.is_relative_to(docs):
        raise ExportError(
            "Export destination must not be inside a portable source tree."
        )
    try:
        entries = tuple(parent.iterdir())
    except OSError as exc:
        raise ExportError(
            f"Could not inspect export output directory: {parent}."
        ) from exc
    collision = next(
        (entry for entry in entries if entry.name.casefold() == target.name.casefold()),
        None,
    )
    if collision is not None:
        raise ExportError(f"Export destination already exists: {collision}.")


def _publish_export(
    *,
    parent: Path,
    target: Path,
    project: Path,
    tools: Path,
    docs: Path,
    manifest: PortablePayloadManifest,
) -> ExportResult:
    staging: Path | None = None
    staging_identity: tuple[int, int] | None = None
    with _exclusive_export_lock(parent, target.name):
        _validate_target(parent=parent, target=target, tools=tools, docs=docs)
        try:
            staging = Path(
                tempfile.mkdtemp(prefix=f".{target.name}.staging-", dir=parent)
            )
            staging_identity = _directory_identity(
                staging,
                label="Export staging directory",
            )
            _copy_manifest_files(
                project=project,
                tools=tools,
                docs=docs,
                staging=staging,
                manifest=manifest,
            )
            atomic_write_text(
                staging / "tools" / PAYLOAD_MANIFEST_NAME,
                render_portable_payload_manifest(manifest),
                root=staging,
            )
            _normalize_metadata(staging, manifest)
            observed = validate_portable_payload(
                project_root=staging,
                tools_root=staging / "tools",
                docs_root=staging / "docs" / "toolingdocs",
                tooling_version=manifest.tooling_version,
            )
            if observed != manifest:
                raise ExportError("Staged export failed its payload-manifest check.")
            current_source = create_portable_payload_manifest(
                project_root=project,
                tools_root=tools,
                docs_root=docs,
                tooling_version=manifest.tooling_version,
            )
            _audit_sources(project=project, tools=tools, docs=docs)
            if current_source != manifest:
                raise ExportError("Export source changed while the package was staged.")
            _validate_target(parent=parent, target=target, tools=tools, docs=docs)
            _require_directory_identity(
                staging,
                staging_identity,
                label="Export staging directory changed before publication",
            )
            _rename_no_replace(staging, target)
            _require_directory_identity(
                target,
                staging_identity,
                label="Published export does not match the validated staging directory",
            )
            published = validate_portable_payload(
                project_root=target,
                tools_root=target / "tools",
                docs_root=target / "docs" / "toolingdocs",
                tooling_version=manifest.tooling_version,
            )
            if published != manifest:
                raise ExportError("Published export failed its payload-manifest check.")
            staging = None
        except ExportError:
            raise
        except (FilesystemSafetyError, PortablePayloadError, OSError) as exc:
            raise ExportError(str(exc)) from exc
        finally:
            if staging is not None and staging_identity is not None:
                _remove_staging(
                    staging,
                    parent=parent,
                    expected_identity=staging_identity,
                )
    return ExportResult(
        path=target,
        tooling_version=manifest.tooling_version,
        manifest_digest=manifest.digest,
        file_count=len(manifest.files) + 1,
    )


def _rename_no_replace(source: Path, target: Path) -> None:
    """Atomically publish a directory without replacing a concurrent target."""

    if os.name == "nt":
        try:
            os.rename(source, target)
        except FileExistsError as exc:
            raise ExportError(f"Export destination already exists: {target}.") from exc
        except OSError as exc:
            raise ExportError(
                f"Could not publish export destination: {target}."
            ) from exc
        return

    library = ctypes.CDLL(None, use_errno=True)
    if sys.platform.startswith("linux"):
        rename = getattr(library, "renameat2", None)
        if rename is None:
            raise ExportError(
                "Atomic no-replace directory publication is unavailable on this Linux runtime."
            )
        rename.argtypes = (
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_uint,
        )
        rename.restype = ctypes.c_int
        result = rename(
            -100,  # AT_FDCWD
            os.fsencode(source),
            -100,
            os.fsencode(target),
            1,  # RENAME_NOREPLACE
        )
    elif sys.platform == "darwin":
        rename = getattr(library, "renamex_np", None)
        if rename is None:
            raise ExportError(
                "Atomic no-replace directory publication is unavailable on this macOS runtime."
            )
        rename.argtypes = (ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint)
        rename.restype = ctypes.c_int
        result = rename(
            os.fsencode(source),
            os.fsencode(target),
            0x00000004,  # RENAME_EXCL
        )
    else:
        raise ExportError(
            "Atomic no-replace directory publication is unavailable on this platform."
        )

    if result == 0:
        return
    error_number = ctypes.get_errno()
    if error_number in {errno.EEXIST, errno.ENOTEMPTY}:
        raise ExportError(f"Export destination already exists: {target}.")
    detail = (
        os.strerror(error_number) if error_number else "unknown operating-system error"
    )
    raise ExportError(f"Could not publish export destination {target}: {detail}.")


def _directory_identity(path: Path, *, label: str) -> tuple[int, int]:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise ExportError(f"Could not inspect {label}: {path}.") from exc
    if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
        raise ExportError(f"{label} must be a real directory: {path}.")
    return metadata.st_dev, metadata.st_ino


def _require_directory_identity(
    path: Path,
    expected: tuple[int, int],
    *,
    label: str,
) -> None:
    observed = _directory_identity(path, label=label)
    if observed != expected:
        raise ExportError(f"{label}: {path}.")


def _copy_manifest_files(
    *,
    project: Path,
    tools: Path,
    docs: Path,
    staging: Path,
    manifest: PortablePayloadManifest,
) -> None:
    for entry in manifest.files:
        relative = PurePosixPath(entry.path)
        if relative.parts[0] == "tools":
            source = tools.joinpath(*relative.parts[1:])
        else:
            source = docs.joinpath(*relative.parts[2:])
        content = read_regular_bytes(
            source,
            root=project,
            label=f"Export source file {entry.path}",
        )
        digest = "sha256:" + hashlib.sha256(content).hexdigest()
        if len(content) != entry.size or digest != entry.sha256:
            raise ExportError(
                f"Export source changed while being copied: {entry.path}."
            )
        parent_relative = relative.parent.as_posix()
        ensure_directory(staging, parent_relative)
        atomic_write(
            staging.joinpath(*relative.parts),
            content,
            mode=0o755 if entry.executable else 0o644,
            root=staging,
        )


def _normalize_metadata(staging: Path, manifest: PortablePayloadManifest) -> None:
    manifest_path = staging / "tools" / PAYLOAD_MANIFEST_NAME
    manifest_path.chmod(0o644)
    for entry in manifest.files:
        path = staging.joinpath(*PurePosixPath(entry.path).parts)
        path.chmod(0o755 if entry.executable else 0o644)
        os.utime(path, (_FIXED_TIMESTAMP, _FIXED_TIMESTAMP))
    os.utime(manifest_path, (_FIXED_TIMESTAMP, _FIXED_TIMESTAMP))
    directories = sorted(
        (path for path in staging.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    )
    for directory in (*directories, staging):
        directory.chmod(0o755)
        os.utime(directory, (_FIXED_TIMESTAMP, _FIXED_TIMESTAMP))


@contextmanager
def _exclusive_export_lock(parent: Path, package_name: str) -> Iterator[None]:
    lock = parent / f".{package_name}.export.lock"
    descriptor: int | None = None
    identity: tuple[int, int] | None = None
    try:
        try:
            descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as exc:
            raise ExportError(
                f"Another export owns the destination lock: {lock}."
            ) from exc
        metadata = os.fstat(descriptor)
        identity = (metadata.st_dev, metadata.st_ino)
        yield
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if identity is not None:
            try:
                metadata = lock.lstat()
            except FileNotFoundError:
                pass
            except OSError:
                pass
            else:
                if (
                    not stat.S_ISLNK(metadata.st_mode)
                    and (
                        metadata.st_dev,
                        metadata.st_ino,
                    )
                    == identity
                ):
                    try:
                        lock.unlink()
                    except OSError:
                        pass


def _remove_staging(
    staging: Path,
    *,
    parent: Path,
    expected_identity: tuple[int, int],
) -> None:
    try:
        staging.absolute().relative_to(parent)
        metadata = staging.lstat()
    except (OSError, ValueError):
        return
    try:
        if (
            stat.S_ISDIR(metadata.st_mode)
            and not stat.S_ISLNK(metadata.st_mode)
            and (metadata.st_dev, metadata.st_ino) == expected_identity
        ):
            shutil.rmtree(staging)
    except OSError:
        pass


__all__ = [
    "PACKAGE_PREFIX",
    "ExportError",
    "ExportResult",
    "export_portable_tooling",
]
