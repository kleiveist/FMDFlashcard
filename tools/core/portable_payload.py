"""Self-consistency manifest for the directly copyable tooling payload.

The inventory detects incomplete, mixed, or accidentally changed copies. It
is intentionally not a signature and does not authenticate an adversarially
modified payload whose code and manifest were replaced together.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    read_regular_bytes,
    safe_relative_path,
    validate_root,
)
from tools.core.manifest import (
    PROTECTED_DIRECTORIES,
    PROTECTED_FILE_NAMES,
    PROTECTED_FILE_SUFFIXES,
    SENSITIVE_DIRECTORIES,
    SENSITIVE_FILE_NAMES,
    SENSITIVE_ROOT_DIRECTORIES,
)

PAYLOAD_MANIFEST_NAME = "PORTABLE-PAYLOAD.json"
PAYLOAD_MANIFEST_SCHEMA = 1
PAYLOAD_MANIFEST_MIN_VERSION = (0, 2, 0)
_VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
_SHA256 = re.compile(r"sha256:[0-9a-f]{64}")
_ALLOWED_BUILD_DIRECTORY = "tools/tauri/build"
_ALLOWED_DIST_DIRECTORY = "tools/quality/rust_analyzer/dist"
_ALLOWED_DIST_FILE = f"{_ALLOWED_DIST_DIRECTORY}/rust_quality_analyzer.wasm"
_LOGICAL_EXECUTABLE_FILES = frozenset({"tools/control.py", "tools/inst/run.py"})
_BUILD_SUFFIXES = {
    ".aux",
    ".bbl",
    ".bcf",
    ".blg",
    ".fdb_latexmk",
    ".fls",
    ".lof",
    ".log",
    ".lot",
    ".pdf",
    ".run.xml",
    ".synctex.gz",
    ".toc",
}


class PortablePayloadError(RuntimeError):
    """Raised when a copied payload is incomplete, mixed, or unsafe."""


@dataclass(frozen=True, slots=True)
class PortablePayloadEntry:
    path: str
    sha256: str
    size: int
    kind: str = "file"
    executable: bool = False


@dataclass(frozen=True, slots=True)
class PortablePayloadManifest:
    schema_version: int
    tooling_version: str
    files: tuple[PortablePayloadEntry, ...]
    digest: str


def manifest_required(tooling_version: str) -> bool:
    """Return whether a release version must carry the payload manifest."""

    match = _VERSION.fullmatch(tooling_version)
    if match is None:
        raise PortablePayloadError(
            f"Tooling version is not canonical semantic versioning: {tooling_version!r}."
        )
    return tuple(int(part) for part in match.groups()) >= PAYLOAD_MANIFEST_MIN_VERSION


def create_portable_payload_manifest(
    *,
    project_root: Path,
    tools_root: Path,
    docs_root: Path,
    tooling_version: str,
) -> PortablePayloadManifest:
    """Inventory the exact portable files using relocation-independent paths."""

    manifest_required(tooling_version)
    root = _validated_payload_root(project_root)
    tools = _validated_payload_subtree(root, tools_root, "Tooling root")
    docs = _validated_payload_subtree(root, docs_root, "Documentation root")
    if tools == docs or tools.is_relative_to(docs) or docs.is_relative_to(tools):
        raise PortablePayloadError("Portable payload roots must not overlap.")

    entries = tuple(
        sorted(
            (
                *_walk_payload_root(root, tools, "tools"),
                *_walk_payload_root(root, docs, "docs/toolingdocs"),
            ),
            key=lambda entry: entry.path,
        )
    )
    _validate_entry_paths(entries)
    digest = _payload_digest(
        PAYLOAD_MANIFEST_SCHEMA,
        tooling_version,
        entries,
    )
    return PortablePayloadManifest(
        PAYLOAD_MANIFEST_SCHEMA,
        tooling_version,
        entries,
        digest,
    )


def render_portable_payload_manifest(manifest: PortablePayloadManifest) -> str:
    """Render one validated manifest deterministically."""

    _validate_manifest_model(manifest)
    return (
        json.dumps(
            _manifest_payload(manifest, include_digest=True),
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )


def write_portable_payload_manifest(
    *,
    project_root: Path,
    tools_root: Path,
    docs_root: Path,
    tooling_version: str,
) -> PortablePayloadManifest:
    """Regenerate the payload-consistency manifest at its fixed path."""

    manifest = create_portable_payload_manifest(
        project_root=project_root,
        tools_root=tools_root,
        docs_root=docs_root,
        tooling_version=tooling_version,
    )
    try:
        atomic_write_text(
            tools_root / PAYLOAD_MANIFEST_NAME,
            render_portable_payload_manifest(manifest),
            root=tools_root,
        )
    except FilesystemSafetyError as exc:
        raise PortablePayloadError(str(exc)) from exc
    return manifest


def validate_portable_payload(
    *,
    project_root: Path,
    tools_root: Path,
    docs_root: Path,
    tooling_version: str,
) -> PortablePayloadManifest | None:
    """Validate copied bytes against the self-contained file inventory."""

    manifest = validate_portable_payload_identity(
        tools_root=tools_root,
        tooling_version=tooling_version,
    )
    if manifest is None:
        return None
    observed = create_portable_payload_manifest(
        project_root=project_root,
        tools_root=tools_root,
        docs_root=docs_root,
        tooling_version=tooling_version,
    )
    if observed != manifest:
        expected = {entry.path: entry for entry in manifest.files}
        actual = {entry.path: entry for entry in observed.files}
        changed = sorted(
            path
            for path in expected.keys() | actual.keys()
            if expected.get(path) != actual.get(path)
        )
        detail = changed[0] if changed else "manifest digest"
        raise PortablePayloadError(
            f"Portable payload differs from its consistency manifest: {detail}."
        )
    return manifest


def validate_portable_payload_identity(
    *,
    tools_root: Path,
    tooling_version: str,
) -> PortablePayloadManifest | None:
    """Validate manifest presence, structure, and release-version identity."""

    required = manifest_required(tooling_version)
    manifest_path = tools_root / PAYLOAD_MANIFEST_NAME
    if not manifest_path.exists() and not manifest_path.is_symlink():
        if required:
            raise PortablePayloadError(
                f"Tooling {tooling_version} requires {PAYLOAD_MANIFEST_NAME}."
            )
        return None
    manifest = load_portable_payload_manifest(manifest_path, tools_root=tools_root)
    if manifest.tooling_version != tooling_version:
        raise PortablePayloadError(
            "Portable payload manifest version does not match tools/VERSION."
        )
    return manifest


def load_portable_payload_manifest(
    path: Path,
    *,
    tools_root: Path,
) -> PortablePayloadManifest:
    """Load one strict, duplicate-free payload manifest."""

    try:
        raw = read_regular_bytes(
            path,
            root=tools_root,
            label="Portable payload manifest",
        ).decode("utf-8")
        payload = json.loads(
            raw,
            object_pairs_hook=_unique_object,
            parse_constant=_reject_json_constant,
        )
    except FilesystemSafetyError as exc:
        raise PortablePayloadError(str(exc)) from exc
    except UnicodeError as exc:
        raise PortablePayloadError(
            "Portable payload manifest is not valid UTF-8."
        ) from exc
    except json.JSONDecodeError as exc:
        raise PortablePayloadError(
            f"Portable payload manifest is invalid JSON: {exc}."
        ) from exc
    if not isinstance(payload, dict):
        raise PortablePayloadError("Portable payload manifest must be an object.")
    _require_exact_keys(
        payload,
        {"schema_version", "tooling_version", "files", "digest"},
        "manifest",
    )
    raw_files = payload["files"]
    if not isinstance(raw_files, list):
        raise PortablePayloadError("Portable payload manifest files must be a list.")
    manifest = PortablePayloadManifest(
        schema_version=payload["schema_version"],
        tooling_version=payload["tooling_version"],
        files=tuple(_parse_entry(item) for item in raw_files),
        digest=payload["digest"],
    )
    _validate_manifest_model(manifest)
    return manifest


def _validated_payload_root(path: Path) -> Path:
    try:
        return validate_root(path)
    except FilesystemSafetyError as exc:
        raise PortablePayloadError(str(exc)) from exc


def _validated_payload_subtree(root: Path, path: Path, label: str) -> Path:
    candidate = _validated_payload_root(path)
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise PortablePayloadError(f"{label} is outside the project root.") from exc
    return candidate


def _walk_payload_root(
    project_root: Path,
    actual_root: Path,
    logical_root: str,
) -> tuple[PortablePayloadEntry, ...]:
    entries: list[PortablePayloadEntry] = []

    def fail_walk(error: OSError) -> None:
        raise PortablePayloadError(
            f"Could not traverse portable payload: {error.filename or actual_root}."
        ) from error

    for directory, names, filenames in os.walk(
        actual_root,
        followlinks=False,
        onerror=fail_walk,
    ):
        current = Path(directory)
        logical_directory = Path(logical_root) / current.relative_to(actual_root)
        for name in sorted(names):
            candidate = current / name
            logical = (logical_directory / name).as_posix()
            _validate_payload_object(candidate, logical, expect_directory=True)
            _validate_payload_policy(logical, is_directory=True)
        for name in sorted(filenames):
            candidate = current / name
            logical = (logical_directory / name).as_posix()
            if logical == f"tools/{PAYLOAD_MANIFEST_NAME}":
                continue
            _validate_payload_object(
                candidate,
                logical,
                expect_directory=False,
            )
            _validate_payload_policy(logical, is_directory=False)
            try:
                content = read_regular_bytes(
                    candidate,
                    root=project_root,
                    label=f"Portable payload file {logical}",
                )
            except FilesystemSafetyError as exc:
                raise PortablePayloadError(str(exc)) from exc
            entries.append(
                PortablePayloadEntry(
                    path=logical,
                    sha256="sha256:" + hashlib.sha256(content).hexdigest(),
                    size=len(content),
                    # A logical mode keeps a Linux-authored payload valid after
                    # copies through Windows filesystems, where POSIX execute
                    # bits are not represented consistently.
                    executable=logical in _LOGICAL_EXECUTABLE_FILES,
                )
            )
    return tuple(entries)


def _validate_payload_object(
    path: Path,
    logical: str,
    *,
    expect_directory: bool,
) -> os.stat_result:
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise PortablePayloadError(
            f"Could not inspect portable payload object: {logical}."
        ) from exc
    expected = (
        stat.S_ISDIR(metadata.st_mode)
        if expect_directory
        else stat.S_ISREG(metadata.st_mode)
    )
    if stat.S_ISLNK(metadata.st_mode) or not expected:
        kind = "directory" if expect_directory else "regular file"
        raise PortablePayloadError(
            f"Portable payload object must be a {kind}: {logical}."
        )
    return metadata


def _validate_payload_policy(logical: str, *, is_directory: bool) -> None:
    try:
        safe_relative_path(logical)
    except FilesystemSafetyError as exc:
        raise PortablePayloadError(str(exc)) from exc
    path = Path(logical)
    folded_parts = tuple(part.casefold() for part in path.parts)
    folded_name = path.name.casefold()
    if logical == _ALLOWED_BUILD_DIRECTORY and is_directory:
        return
    if logical == _ALLOWED_DIST_DIRECTORY and is_directory:
        return
    if logical == _ALLOWED_DIST_FILE and not is_directory:
        return
    if logical.startswith(f"{_ALLOWED_DIST_DIRECTORY}/"):
        raise PortablePayloadError(
            f"Portable payload contains an unapproved dist object: {logical}."
        )
    if is_directory and (
        folded_name in PROTECTED_DIRECTORIES
        or folded_name == "build"
        or folded_name.endswith(".egg-info")
        or folded_name in SENSITIVE_DIRECTORIES
        or (len(folded_parts) == 2 and folded_name in SENSITIVE_ROOT_DIRECTORIES)
    ):
        raise PortablePayloadError(
            f"Portable payload contains a protected directory: {logical}."
        )
    if not is_directory and (
        folded_name in SENSITIVE_FILE_NAMES
        or folded_name in PROTECTED_FILE_NAMES
        or folded_name.startswith(".coverage.")
        or path.suffix.casefold() in PROTECTED_FILE_SUFFIXES
        or any(logical.casefold().endswith(suffix) for suffix in _BUILD_SUFFIXES)
    ):
        raise PortablePayloadError(
            f"Portable payload contains a protected file: {logical}."
        )


def _validate_entry_paths(entries: tuple[PortablePayloadEntry, ...]) -> None:
    paths = tuple(entry.path for entry in entries)
    if paths != tuple(sorted(paths)):
        raise PortablePayloadError("Portable payload entries must be sorted.")
    if len(paths) != len({path.casefold() for path in paths}):
        raise PortablePayloadError(
            "Portable payload contains a case-folding collision."
        )


def _validate_manifest_model(manifest: PortablePayloadManifest) -> None:
    if manifest.schema_version != PAYLOAD_MANIFEST_SCHEMA:
        raise PortablePayloadError(
            f"Unsupported portable payload manifest schema: {manifest.schema_version!r}."
        )
    if not isinstance(manifest.tooling_version, str):
        raise PortablePayloadError("Manifest tooling_version must be a string.")
    manifest_required(manifest.tooling_version)
    if any(not isinstance(entry, PortablePayloadEntry) for entry in manifest.files):
        raise PortablePayloadError("Manifest files contain an invalid entry.")
    _validate_entry_paths(manifest.files)
    for entry in manifest.files:
        _validate_entry(entry)
    if not isinstance(manifest.digest, str) or not _SHA256.fullmatch(manifest.digest):
        raise PortablePayloadError("Manifest digest must be a canonical SHA-256.")
    expected = _payload_digest(
        manifest.schema_version,
        manifest.tooling_version,
        manifest.files,
    )
    if manifest.digest != expected:
        raise PortablePayloadError("Portable payload manifest digest is invalid.")


def _validate_entry(entry: PortablePayloadEntry) -> None:
    if (
        not isinstance(entry.path, str)
        or not entry.path.startswith(("tools/", "docs/toolingdocs/"))
        or entry.path == f"tools/{PAYLOAD_MANIFEST_NAME}"
    ):
        raise PortablePayloadError(f"Manifest entry path is invalid: {entry.path!r}.")
    if not isinstance(entry.sha256, str) or not _SHA256.fullmatch(entry.sha256):
        raise PortablePayloadError(f"Manifest entry SHA-256 is invalid: {entry.path}.")
    if (
        not isinstance(entry.size, int)
        or isinstance(entry.size, bool)
        or entry.size < 0
    ):
        raise PortablePayloadError(f"Manifest entry size is invalid: {entry.path}.")
    if entry.kind != "file" or not isinstance(entry.executable, bool):
        raise PortablePayloadError(f"Manifest entry metadata is invalid: {entry.path}.")
    _validate_payload_policy(entry.path, is_directory=False)


def _parse_entry(payload: object) -> PortablePayloadEntry:
    if not isinstance(payload, dict):
        raise PortablePayloadError("Portable payload file entry must be an object.")
    _require_exact_keys(
        payload, {"path", "sha256", "size", "kind", "executable"}, "file"
    )
    return PortablePayloadEntry(
        path=payload["path"],
        sha256=payload["sha256"],
        size=payload["size"],
        kind=payload["kind"],
        executable=payload["executable"],
    )


def _payload_digest(
    schema_version: int,
    tooling_version: str,
    files: tuple[PortablePayloadEntry, ...],
) -> str:
    payload = {
        "schema_version": schema_version,
        "tooling_version": tooling_version,
        "files": [_entry_payload(entry) for entry in files],
    }
    serialized = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(serialized).hexdigest()


def _manifest_payload(
    manifest: PortablePayloadManifest,
    *,
    include_digest: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "schema_version": manifest.schema_version,
        "tooling_version": manifest.tooling_version,
        "files": [_entry_payload(entry) for entry in manifest.files],
    }
    if include_digest:
        payload["digest"] = manifest.digest
    return payload


def _entry_payload(entry: PortablePayloadEntry) -> dict[str, Any]:
    return {
        "path": entry.path,
        "sha256": entry.sha256,
        "size": entry.size,
        "kind": entry.kind,
        "executable": entry.executable,
    }


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for key, value in pairs:
        if key in payload:
            raise PortablePayloadError(
                f"Portable payload manifest contains duplicate key: {key!r}."
            )
        payload[key] = value
    return payload


def _reject_json_constant(value: str) -> None:
    raise PortablePayloadError(
        f"Portable payload manifest contains non-standard JSON constant: {value}."
    )


def _require_exact_keys(
    payload: dict[str, Any],
    expected: set[str],
    label: str,
) -> None:
    if set(payload) != expected:
        raise PortablePayloadError(
            f"Portable payload {label} keys must be exactly {sorted(expected)}."
        )


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Regenerate PORTABLE-PAYLOAD.json")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)
    if not args.write:
        parser.error("--write is required")
    tools_root = Path(__file__).resolve().parents[1]
    project_root = tools_root.parent
    docs_root = project_root / "docs" / "toolingdocs"
    tooling_version = (tools_root / "VERSION").read_text(encoding="utf-8").strip()
    manifest = write_portable_payload_manifest(
        project_root=project_root,
        tools_root=tools_root,
        docs_root=docs_root,
        tooling_version=tooling_version,
    )
    print(manifest.digest)
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())


__all__ = [
    "PAYLOAD_MANIFEST_NAME",
    "PortablePayloadEntry",
    "PortablePayloadError",
    "PortablePayloadManifest",
    "create_portable_payload_manifest",
    "load_portable_payload_manifest",
    "manifest_required",
    "render_portable_payload_manifest",
    "validate_portable_payload",
    "validate_portable_payload_identity",
    "write_portable_payload_manifest",
]
