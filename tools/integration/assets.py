"""Small, safe helpers for reading packaged integration assets.

The helpers in this module deliberately operate on one regular file at a time.
They are not a scaffold copier and never follow symbolic links.
"""

from __future__ import annotations

import hashlib
import os
import re
import stat
import tempfile
from pathlib import Path, PurePosixPath

from tools.core.filesystem import FilesystemSafetyError, safe_relative_path
from tools.core.manifest import is_protected_relative_path

DEFAULT_MAX_ASSET_BYTES = 1024 * 1024
_SHA256 = re.compile(r"(?:sha256:)?([0-9a-f]{64})")
_DATA_DIRECTORIES = {
    ".data",
    "data",
    "storage",
    "uploads",
    "user-data",
    "user_data",
    "userdata",
}
_PRODUCT_SOURCE_PREFIXES = {
    ("frontend", "src"),
    ("backend", "app"),
    ("src-tauri", "src"),
}
_MANAGED_DESTINATION_ROOTS = ("tools", "docs/toolingdocs")
_SENSITIVE_DIRECTORIES = {".secrets", "credentials", "secrets"}
_SENSITIVE_NAMES = {
    ".env",
    ".netrc",
    ".npmrc",
    ".pypirc",
    "credentials.json",
    "credentials.toml",
    "credentials.yaml",
    "credentials.yml",
    "secrets.json",
    "secrets.toml",
    "secrets.yaml",
    "secrets.yml",
    "service-account.json",
    "service_account.json",
}
_SENSITIVE_SUFFIXES = {
    ".db",
    ".key",
    ".p12",
    ".pem",
    ".pfx",
    ".sqlite",
    ".sqlite3",
}


class AssetError(RuntimeError):
    """A packaged asset could not be accessed without weakening safety."""


def read_packaged_asset(
    asset_root: Path,
    relative: str,
    *,
    expected_sha256: str | None = None,
    max_bytes: int = DEFAULT_MAX_ASSET_BYTES,
) -> bytes:
    """Read one small regular asset without following links or escaping its root."""

    if max_bytes < 0:
        raise AssetError("Packaged asset size limit must not be negative.")
    root = _safe_existing_root(asset_root, label="Packaged asset root")
    normalized = _safe_relative(relative, label="Packaged asset path")
    _reject_sensitive_path(normalized)
    if is_protected_relative_path(normalized):
        raise AssetError(f"Refusing to read a protected packaged asset: {normalized}.")
    source = _safe_target(root, normalized, create_parents=False)
    descriptor: int | None = None
    try:
        before = source.lstat()
        if stat.S_ISLNK(before.st_mode) or not stat.S_ISREG(before.st_mode):
            raise AssetError(f"Packaged asset must be a regular file: {normalized}.")
        if before.st_size > max_bytes:
            raise AssetError(
                f"Packaged asset exceeds the {max_bytes}-byte limit: {normalized}."
            )
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(source, flags)
        opened = os.fstat(descriptor)
        if (
            not stat.S_ISREG(opened.st_mode)
            or opened.st_dev != before.st_dev
            or opened.st_ino != before.st_ino
        ):
            raise AssetError(
                f"Packaged asset changed while it was opened: {normalized}."
            )
        with os.fdopen(descriptor, "rb") as handle:
            descriptor = None
            content = handle.read(max_bytes + 1)
    except AssetError:
        raise
    except OSError as exc:
        raise AssetError(
            f"Packaged asset is missing or unreadable: {normalized}."
        ) from exc
    finally:
        if descriptor is not None:
            os.close(descriptor)
    if len(content) > max_bytes:
        raise AssetError(
            f"Packaged asset exceeds the {max_bytes}-byte limit: {normalized}."
        )
    _check_digest(content, expected_sha256, label=f"Packaged asset {normalized}")
    return content


def copy_packaged_asset(
    asset_root: Path,
    asset_relative: str,
    destination_root: Path,
    destination_relative: str,
    *,
    expected_sha256: str | None = None,
    overwrite: bool = False,
    max_bytes: int = DEFAULT_MAX_ASSET_BYTES,
) -> Path:
    """Atomically copy one packaged asset to a safe non-product destination."""

    content = read_packaged_asset(
        asset_root,
        asset_relative,
        expected_sha256=expected_sha256,
        max_bytes=max_bytes,
    )
    root = _safe_existing_root(destination_root, label="Asset destination root")
    normalized = _safe_relative(destination_relative, label="Asset destination path")
    _reject_product_or_data_path(normalized)
    target = _safe_target(root, normalized, create_parents=True)
    if target.is_symlink():
        raise AssetError(
            f"Asset destination must not be a symbolic link: {normalized}."
        )
    if target.exists():
        if not target.is_file():
            raise AssetError(f"Asset destination must be a regular file: {normalized}.")
        if not overwrite:
            raise AssetError(
                f"Refusing to overwrite existing asset destination: {normalized}."
            )
    _atomic_write(target, content, overwrite=overwrite)
    return target


# Short aliases are convenient for adapters while the explicit names make the
# packaged-only boundary clear at call sites that perform filesystem changes.
read_asset = read_packaged_asset
copy_asset = copy_packaged_asset


def _safe_existing_root(root: Path, *, label: str) -> Path:
    if root.is_symlink():
        raise AssetError(f"{label} must not be a symbolic link.")
    try:
        resolved = root.resolve(strict=True)
    except OSError as exc:
        raise AssetError(f"{label} is missing or unreadable: {root}.") from exc
    if not resolved.is_dir():
        raise AssetError(f"{label} is not a directory: {root}.")
    return resolved


def _safe_relative(value: str, *, label: str) -> str:
    try:
        return safe_relative_path(value)
    except FilesystemSafetyError as exc:
        raise AssetError(
            f"{label} must be a safe project-relative path: {value!r}."
        ) from exc


def _safe_target(root: Path, relative: str, *, create_parents: bool) -> Path:
    target = root / Path(relative)
    current = root
    for part in Path(relative).parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise AssetError(f"Asset path crosses a symbolic link: {relative}.")
        if current.exists():
            if not current.is_dir():
                raise AssetError(f"Asset path parent is not a directory: {relative}.")
            continue
        if not create_parents:
            raise AssetError(f"Packaged asset is missing or unreadable: {relative}.")
        try:
            current.mkdir(mode=0o755)
        except OSError as exc:
            raise AssetError(
                f"Could not create asset destination parent: {relative}."
            ) from exc
    try:
        current.resolve(strict=True).relative_to(root)
    except (OSError, ValueError) as exc:
        raise AssetError(f"Asset path escapes its root: {relative}.") from exc
    return target


def _reject_product_or_data_path(relative: str) -> None:
    parts = tuple(PurePosixPath(relative).parts)
    lowered = tuple(part.lower() for part in parts)
    if not any(
        relative == root or relative.startswith(f"{root}/")
        for root in _MANAGED_DESTINATION_ROOTS
    ):
        raise AssetError(
            f"Refusing to copy a packaged asset outside tooling-managed paths: {relative}."
        )
    if any(part in _DATA_DIRECTORIES for part in lowered):
        raise AssetError(
            f"Refusing to copy a packaged asset into a data path: {relative}."
        )
    if any(lowered[: len(prefix)] == prefix for prefix in _PRODUCT_SOURCE_PREFIXES):
        raise AssetError(
            f"Refusing to copy a packaged asset into product source: {relative}."
        )
    _reject_sensitive_path(relative)
    if is_protected_relative_path(relative):
        raise AssetError(
            f"Refusing to copy a protected generated or sensitive asset: {relative}."
        )


def _reject_sensitive_path(relative: str) -> None:
    lowered = tuple(part.casefold() for part in PurePosixPath(relative).parts)
    name = lowered[-1]
    if (
        any(part in _SENSITIVE_DIRECTORIES for part in lowered)
        or name in _SENSITIVE_NAMES
        or (name.startswith(".env.") and name != ".env.example")
        or Path(name).suffix in _SENSITIVE_SUFFIXES
    ):
        raise AssetError(f"Refusing to access a sensitive asset path: {relative}.")


def _check_digest(content: bytes, expected: str | None, *, label: str) -> None:
    if expected is None:
        return
    match = _SHA256.fullmatch(expected)
    if match is None:
        raise AssetError(f"{label} expected SHA-256 is invalid.")
    actual = hashlib.sha256(content).hexdigest()
    if actual != match.group(1):
        raise AssetError(f"{label} SHA-256 does not match the packaged payload.")


def _atomic_write(path: Path, content: bytes, *, overwrite: bool) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.asset-", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o644)
        if overwrite:
            os.replace(temporary, path)
        else:
            try:
                os.link(temporary, path, follow_symlinks=False)
            except FileExistsError as exc:
                raise AssetError(
                    f"Refusing to overwrite existing asset destination: {path.name}."
                ) from exc
    except OSError as exc:
        raise AssetError(
            f"Could not write packaged asset destination: {path.name}."
        ) from exc
    finally:
        temporary.unlink(missing_ok=True)
