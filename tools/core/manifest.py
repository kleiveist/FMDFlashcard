"""Deterministic manifests for explicitly managed tooling paths."""

from __future__ import annotations

import hashlib
import json
import os
import stat
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    read_regular_bytes,
    read_regular_text,
    safe_join,
    safe_relative_path,
    validate_root,
)

MANIFEST_SCHEMA_VERSION = 1
MANIFEST_MODES = {"paths", "scope"}
PROTECTED_DIRECTORIES = {
    ".build",
    ".cache",
    ".dist",
    ".git",
    ".generated",
    ".hypothesis",
    ".mypy_cache",
    ".nox",
    ".pytest_cache",
    ".report",
    ".ruff_cache",
    ".runtime",
    ".tooling-state",
    ".tox",
    ".venv",
    "__pycache__",
    "artifacts",
    "build",
    "cache",
    "caches",
    "coverage",
    "dist",
    "generated",
    "htmlcov",
    "log",
    "logs",
    "node_modules",
    "out",
    "output",
    "playwright-report",
    "runtime",
    "target",
    "test-results",
    "venv",
}
SENSITIVE_ROOT_DIRECTORIES = {
    ".data",
    "data",
    "storage",
    "uploads",
    "user-data",
    "user_data",
    "userdata",
}
SENSITIVE_DIRECTORIES = {".secrets", "credentials", "secrets"}
SENSITIVE_FILE_NAMES = {
    ".netrc",
    ".npmrc",
    ".pypirc",
    "credentials.json",
    "credentials.toml",
    "credentials.yaml",
    "credentials.yml",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
    "secrets.json",
    "secrets.toml",
    "secrets.yaml",
    "secrets.yml",
    "service-account.json",
    "service_account.json",
}
PROTECTED_FILE_SUFFIXES = {
    ".aux",
    ".bbl",
    ".bcf",
    ".blg",
    ".db",
    ".fdb_latexmk",
    ".fls",
    ".gz",
    ".jks",
    ".key",
    ".keystore",
    ".log",
    ".lof",
    ".lot",
    ".out",
    ".p12",
    ".pdf",
    ".pem",
    ".pfx",
    ".pyc",
    ".pyo",
    ".run.xml",
    ".sqlite",
    ".sqlite3",
    ".tar",
    ".tgz",
    ".tmp",
    ".toc",
    ".whl",
    ".zip",
}
PROTECTED_FILE_NAMES = {".coverage", ".ds_store", "coverage.xml", "lcov.info"}


class ManifestError(RuntimeError):
    """Raised when a managed-path manifest is invalid or unsafe."""


@dataclass(frozen=True, slots=True)
class ManifestEntry:
    path: str
    sha256: str
    size: int
    kind: str
    executable: bool = False


@dataclass(frozen=True, slots=True)
class ManagedManifest:
    schema_version: int
    mode: str
    managed_paths: tuple[str, ...]
    files: tuple[ManifestEntry, ...]
    digest: str

    def by_path(self) -> dict[str, ManifestEntry]:
        return {entry.path: entry for entry in self.files}


def create_manifest(
    root: Path,
    *,
    managed_paths: Iterable[str] | None = None,
    scope: str | Iterable[str] | None = None,
) -> ManagedManifest:
    """Hash explicit files or one or more explicit directory scopes.

    Exactly one selector is required. There is deliberately no whole-project
    default: callers must declare which paths the tooling manages.
    """

    if (managed_paths is None) == (scope is None):
        raise ManifestError("Provide exactly one of managed_paths or scope.")
    try:
        resolved_root = validate_root(root)
        if managed_paths is not None:
            selected = _normalized_paths(managed_paths, label="managed path")
            entries = tuple(
                _explicit_entry(resolved_root, relative) for relative in selected
            )
            mode = "paths"
        else:
            selected = _normalized_paths(_scope_values(scope), label="scope")
            _validate_nonoverlapping_scopes(selected)
            entries = tuple(_scope_entries(resolved_root, selected))
            mode = "scope"
    except FilesystemSafetyError as exc:
        raise ManifestError(str(exc)) from exc
    digest = _manifest_digest(MANIFEST_SCHEMA_VERSION, mode, selected, entries)
    manifest = ManagedManifest(MANIFEST_SCHEMA_VERSION, mode, selected, entries, digest)
    validate_manifest(manifest)
    return manifest


def recreate_manifest(root: Path, manifest: ManagedManifest) -> ManagedManifest:
    """Re-hash the same declared ownership selector as an existing manifest."""

    validate_manifest(manifest)
    if manifest.mode == "paths":
        return create_manifest(root, managed_paths=manifest.managed_paths)
    return create_manifest(root, scope=manifest.managed_paths)


def render_manifest(manifest: ManagedManifest) -> str:
    validate_manifest(manifest)
    return json.dumps(manifest_to_dict(manifest), indent=2, ensure_ascii=False) + "\n"


def manifest_to_dict(manifest: ManagedManifest) -> dict[str, Any]:
    return {
        "schema_version": manifest.schema_version,
        "mode": manifest.mode,
        "managed_paths": list(manifest.managed_paths),
        "files": [_entry_to_dict(entry) for entry in manifest.files],
        "digest": manifest.digest,
    }


def write_manifest(
    path: Path, manifest: ManagedManifest, *, root: Path | None = None
) -> None:
    validate_manifest(manifest)
    try:
        atomic_write_text(path, render_manifest(manifest), root=root)
    except FilesystemSafetyError as exc:
        raise ManifestError(str(exc)) from exc


def load_manifest(path: Path, *, root: Path | None = None) -> ManagedManifest:
    try:
        payload = json.loads(
            read_regular_text(path, root=root, label="Managed-path manifest")
        )
    except FilesystemSafetyError as exc:
        raise ManifestError(str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise ManifestError(f"Managed-path manifest is invalid JSON: {exc}.") from exc
    if not isinstance(payload, dict):
        raise ManifestError("Managed-path manifest must contain a JSON object.")
    _require_keys(
        payload,
        {"schema_version", "mode", "managed_paths", "files", "digest"},
        "manifest",
    )
    schema_version = payload["schema_version"]
    mode = payload["mode"]
    managed_paths = payload["managed_paths"]
    raw_files = payload["files"]
    digest = payload["digest"]
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise ManifestError("Manifest schema_version must be an integer.")
    if not isinstance(mode, str):
        raise ManifestError("Manifest mode must be a string.")
    if not isinstance(managed_paths, list) or any(
        not isinstance(item, str) for item in managed_paths
    ):
        raise ManifestError("Manifest managed_paths must be a list of strings.")
    if not isinstance(raw_files, list):
        raise ManifestError("Manifest files must be a list.")
    if not isinstance(digest, str):
        raise ManifestError("Manifest digest must be a string.")
    manifest = ManagedManifest(
        schema_version=schema_version,
        mode=mode,
        managed_paths=tuple(managed_paths),
        files=tuple(_parse_entry(item) for item in raw_files),
        digest=digest,
    )
    validate_manifest(manifest)
    return manifest


def validate_manifest(manifest: ManagedManifest) -> None:
    if manifest.schema_version != MANIFEST_SCHEMA_VERSION:
        raise ManifestError(
            f"Unsupported manifest schema {manifest.schema_version}; expected {MANIFEST_SCHEMA_VERSION}."
        )
    if manifest.mode not in MANIFEST_MODES:
        raise ManifestError(f"Unsupported manifest mode: {manifest.mode!r}.")
    try:
        normalized = tuple(safe_relative_path(path) for path in manifest.managed_paths)
    except FilesystemSafetyError as exc:
        raise ManifestError(str(exc)) from exc
    if normalized != manifest.managed_paths or normalized != tuple(sorted(normalized)):
        raise ManifestError("Manifest managed paths must be canonical and sorted.")
    if not normalized or len(normalized) != len(
        {path.casefold() for path in normalized}
    ):
        raise ManifestError("Manifest must contain unique, explicit managed paths.")
    protected_selection = next(
        (path for path in normalized if _is_protected_relative(path)), None
    )
    if protected_selection is not None:
        raise ManifestError(
            f"Manifest selector targets a protected path: {protected_selection}."
        )
    if manifest.mode == "scope":
        _validate_nonoverlapping_scopes(normalized)

    paths = tuple(entry.path for entry in manifest.files)
    if paths != tuple(sorted(paths)) or len(paths) != len(
        {path.casefold() for path in paths}
    ):
        raise ManifestError("Manifest file paths must be unique and sorted.")
    for entry in manifest.files:
        _validate_entry(entry)
        if _is_protected_relative(entry.path):
            raise ManifestError(f"Manifest contains a protected path: {entry.path}.")
        if manifest.mode == "paths" and entry.path not in normalized:
            raise ManifestError(
                f"Manifest contains undeclared managed file: {entry.path}."
            )
        if manifest.mode == "scope" and not any(
            _is_within(entry.path, scope) for scope in normalized
        ):
            raise ManifestError(
                f"Manifest file is outside its declared scope: {entry.path}."
            )
    if manifest.mode == "paths" and paths != normalized:
        raise ManifestError(
            "Explicit-path manifest files must exactly match managed_paths."
        )
    expected = _manifest_digest(
        manifest.schema_version,
        manifest.mode,
        manifest.managed_paths,
        manifest.files,
    )
    if manifest.digest != expected:
        raise ManifestError(
            f"Manifest digest mismatch: expected {expected}, got {manifest.digest}."
        )


def _scope_values(scope: str | Iterable[str] | None) -> Iterable[str]:
    if isinstance(scope, str):
        return (scope,)
    if scope is None:
        return ()
    return scope


def _normalized_paths(paths: Iterable[str], *, label: str) -> tuple[str, ...]:
    values = tuple(paths)
    if not values:
        raise ManifestError(f"At least one explicit {label} is required.")
    if any(not isinstance(value, str) for value in values):
        raise ManifestError(f"Every {label} must be a string.")
    normalized = tuple(sorted(safe_relative_path(value) for value in values))
    if len(normalized) != len({path.casefold() for path in normalized}):
        raise ManifestError(f"Duplicate {label}s are not allowed.")
    return normalized


def _validate_nonoverlapping_scopes(scopes: tuple[str, ...]) -> None:
    for index, scope in enumerate(scopes):
        if any(_is_within(other, scope) for other in scopes[index + 1 :]):
            raise ManifestError(f"Managed scopes must not overlap: {scope}.")


def _explicit_entry(root: Path, relative: str) -> ManifestEntry:
    if _is_protected_relative(relative):
        raise ManifestError(f"Explicit managed path is protected: {relative}.")
    path = safe_join(root, relative, allow_final_symlink=True, require_exists=True)
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise ManifestError(f"Could not inspect managed path: {relative}.") from exc
    if stat.S_ISDIR(metadata.st_mode):
        raise ManifestError(
            f"Explicit managed path must identify a file, not a directory: {relative}."
        )
    return _entry_for_path(root, path, relative, scope_root=None)


def _scope_entries(root: Path, scopes: tuple[str, ...]) -> Iterator[ManifestEntry]:
    collected: dict[str, ManifestEntry] = {}
    for relative in scopes:
        if _is_protected_relative(relative):
            raise ManifestError(f"Managed scope is protected: {relative}.")
        directory = safe_join(root, relative, require_exists=True)
        try:
            metadata = directory.lstat()
        except OSError as exc:
            raise ManifestError(
                f"Could not inspect managed scope: {relative}."
            ) from exc
        if not stat.S_ISDIR(metadata.st_mode):
            raise ManifestError(f"Managed scope must identify a directory: {relative}.")
        for entry in _walk_scope(root, directory, directory):
            collected[entry.path] = entry
    yield from (collected[path] for path in sorted(collected))


def _walk_scope(
    root: Path, scope_root: Path, directory: Path
) -> Iterator[ManifestEntry]:
    try:
        children = sorted(os.scandir(directory), key=lambda item: item.name)
    except OSError as exc:
        raise ManifestError(
            f"Could not scan managed scope: {directory.relative_to(root)}."
        ) from exc
    for child in children:
        path = Path(child.path)
        relative = path.relative_to(root).as_posix()
        if _is_protected_relative(relative):
            continue
        try:
            if child.is_symlink():
                yield _entry_for_path(root, path, relative, scope_root=scope_root)
            elif child.is_dir(follow_symlinks=False):
                yield from _walk_scope(root, scope_root, path)
            elif child.is_file(follow_symlinks=False):
                yield _entry_for_path(root, path, relative, scope_root=scope_root)
            else:
                raise ManifestError(
                    f"Unsupported filesystem entry in managed scope: {relative}."
                )
        except OSError as exc:
            raise ManifestError(
                f"Could not inspect managed scope path: {relative}."
            ) from exc


def _entry_for_path(
    root: Path, path: Path, relative: str, *, scope_root: Path | None
) -> ManifestEntry:
    try:
        metadata = path.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            _validate_symlink(root, path, relative, scope_root=scope_root)
            raw = os.fsencode(os.readlink(path))
            kind = "symlink"
            executable = False
        elif stat.S_ISREG(metadata.st_mode):
            raw = read_regular_bytes(path, root=root, label=f"Managed file {relative}")
            kind = _file_kind(raw)
            executable = bool(metadata.st_mode & 0o111)
        else:
            raise ManifestError(f"Unsupported managed filesystem entry: {relative}.")
    except FilesystemSafetyError as exc:
        raise ManifestError(str(exc)) from exc
    except OSError as exc:
        raise ManifestError(f"Could not read managed path: {relative}.") from exc
    return ManifestEntry(
        path=relative,
        sha256=hashlib.sha256(raw).hexdigest(),
        size=len(raw),
        kind=kind,
        executable=executable,
    )


def _validate_symlink(
    root: Path, path: Path, relative: str, *, scope_root: Path | None
) -> None:
    try:
        link_target = Path(os.readlink(path))
        target = (
            path.resolve(strict=True)
            if link_target.is_absolute()
            else (path.parent / link_target).resolve(strict=True)
        )
    except (OSError, RuntimeError) as exc:
        raise ManifestError(
            f"Managed path is a broken symbolic link: {relative}."
        ) from exc
    if not target.is_relative_to(root):
        raise ManifestError(
            f"Managed symbolic link points outside the project root: {relative}."
        )
    target_relative = target.relative_to(root).as_posix()
    if _is_protected_relative(target_relative):
        raise ManifestError(
            f"Managed symbolic link points to a protected path: {relative}."
        )
    if scope_root is not None and not target.is_relative_to(scope_root):
        raise ManifestError(
            f"Managed symbolic link points outside its declared scope: {relative}."
        )


def _file_kind(raw: bytes) -> str:
    if b"\0" in raw:
        return "binary"
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        return "binary"
    return "text"


def _manifest_digest(
    schema_version: int,
    mode: str,
    managed_paths: tuple[str, ...],
    entries: tuple[ManifestEntry, ...],
) -> str:
    canonical = {
        "schema_version": schema_version,
        "mode": mode,
        "managed_paths": list(managed_paths),
        "files": [_entry_to_dict(entry) for entry in entries],
    }
    encoded = json.dumps(
        canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def _entry_to_dict(entry: ManifestEntry) -> dict[str, Any]:
    return {
        "path": entry.path,
        "sha256": entry.sha256,
        "size": entry.size,
        "kind": entry.kind,
        "executable": entry.executable,
    }


def _parse_entry(value: Any) -> ManifestEntry:
    if not isinstance(value, dict):
        raise ManifestError("Every manifest file entry must be an object.")
    _require_keys(
        value, {"path", "sha256", "size", "kind", "executable"}, "manifest file"
    )
    path = value["path"]
    sha256 = value["sha256"]
    size = value["size"]
    kind = value["kind"]
    executable = value["executable"]
    if (
        not isinstance(path, str)
        or not isinstance(sha256, str)
        or not isinstance(kind, str)
    ):
        raise ManifestError("Manifest file path, sha256, and kind must be strings.")
    if not isinstance(size, int) or isinstance(size, bool):
        raise ManifestError(f"Manifest file size must be an integer for {path}.")
    if not isinstance(executable, bool):
        raise ManifestError(f"Manifest executable flag must be boolean for {path}.")
    return ManifestEntry(path, sha256, size, kind, executable)


def _validate_entry(entry: ManifestEntry) -> None:
    try:
        normalized = safe_relative_path(entry.path)
    except FilesystemSafetyError as exc:
        raise ManifestError(str(exc)) from exc
    if normalized != entry.path:
        raise ManifestError(f"Manifest path is not canonical: {entry.path}.")
    if entry.kind not in {"text", "binary", "symlink"}:
        raise ManifestError(
            f"Unsupported manifest entry kind for {entry.path}: {entry.kind}."
        )
    if not _valid_raw_sha(entry.sha256):
        raise ManifestError(f"Invalid file SHA-256 for {entry.path}.")
    if (
        not isinstance(entry.size, int)
        or isinstance(entry.size, bool)
        or entry.size < 0
    ):
        raise ManifestError(f"Invalid file size for {entry.path}.")
    if not isinstance(entry.executable, bool):
        raise ManifestError(f"Invalid executable flag for {entry.path}.")
    if entry.kind == "symlink" and entry.executable:
        raise ManifestError(
            f"Symbolic links cannot be executable manifest entries: {entry.path}."
        )


def _is_within(path: str, scope: str) -> bool:
    folded_path = path.casefold()
    folded_scope = scope.casefold()
    return folded_path == folded_scope or folded_path.startswith(f"{folded_scope}/")


def is_protected_relative_path(relative: str) -> bool:
    """Return whether a relative path is generated, state, data, or secret material."""

    try:
        normalized = safe_relative_path(relative)
    except FilesystemSafetyError:
        return True
    return _is_protected_relative(normalized)


def _is_protected_relative(relative: str) -> bool:
    parts = PurePosixPath(relative).parts
    lowered = tuple(part.casefold() for part in parts)
    # ``tools/tauri/build`` is source code, not a generated build directory.
    if lowered[:3] == ("tools", "tauri", "build"):
        return False
    if any(
        part in PROTECTED_DIRECTORIES or part.endswith(".egg-info") for part in lowered
    ):
        return True
    if any(
        part in SENSITIVE_ROOT_DIRECTORIES or part in SENSITIVE_DIRECTORIES
        for part in lowered
    ):
        return True
    name = lowered[-1]
    if name == ".env.example":
        return False
    if name.startswith(".env") or name.endswith(".env"):
        return True
    if (
        name in SENSITIVE_FILE_NAMES
        or name in PROTECTED_FILE_NAMES
        or name.startswith(".coverage.")
    ):
        return True
    return any(name.endswith(suffix) for suffix in PROTECTED_FILE_SUFFIXES)


def _valid_raw_sha(value: str) -> bool:
    return len(value) == 64 and all(
        character in "0123456789abcdef" for character in value
    )


def _require_keys(payload: dict[str, Any], expected: set[str], label: str) -> None:
    actual = set(payload)
    if actual != expected:
        missing = sorted(expected - actual)
        unknown = sorted(actual - expected)
        detail = []
        if missing:
            detail.append(f"missing {', '.join(missing)}")
        if unknown:
            detail.append(f"unknown {', '.join(unknown)}")
        raise ManifestError(f"Invalid {label} fields: {'; '.join(detail)}.")
