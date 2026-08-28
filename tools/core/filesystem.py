"""Filesystem primitives for safe, portable tooling mutations."""

from __future__ import annotations

import os
import stat
import tempfile
import unicodedata
from pathlib import Path, PurePosixPath, PureWindowsPath


class FilesystemSafetyError(RuntimeError):
    """Raised when a tooling path or filesystem operation is unsafe."""


_WINDOWS_RESERVED_NAMES = {
    "aux",
    "con",
    "nul",
    "prn",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}
_WINDOWS_INVALID_CHARACTERS = frozenset('<>:"|?*')


def safe_relative_path(value: str | os.PathLike[str]) -> str:
    """Return one canonical POSIX relative path safe on POSIX and Windows."""

    raw = os.fspath(value)
    if not isinstance(raw, str):
        raise FilesystemSafetyError("Tooling paths must be text paths.")
    posix = PurePosixPath(raw)
    windows = PureWindowsPath(raw)
    parts = raw.split("/")
    if (
        not raw
        or "\x00" in raw
        or unicodedata.normalize("NFC", raw) != raw
        or "\\" in raw
        or posix.is_absolute()
        or windows.is_absolute()
        or bool(windows.drive)
        or any(part in {"", ".", ".."} for part in parts)
    ):
        raise FilesystemSafetyError(f"Unsafe relative path: {raw!r}.")
    for part in parts:
        stem = part.split(".", maxsplit=1)[0].rstrip(" .").casefold()
        if (
            any(
                character in _WINDOWS_INVALID_CHARACTERS or ord(character) < 32
                for character in part
            )
            or part.endswith((" ", "."))
            or stem in _WINDOWS_RESERVED_NAMES
        ):
            raise FilesystemSafetyError(
                f"Path is not portable across supported platforms: {raw!r}."
            )
    return posix.as_posix()


def validate_root(root: Path) -> Path:
    """Return a resolved, existing directory root that is not itself a symlink."""

    path = Path(root).absolute()
    try:
        metadata = path.lstat()
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Filesystem root is missing or unreadable: {path}."
        ) from exc
    if stat.S_ISLNK(metadata.st_mode):
        raise FilesystemSafetyError(
            f"Filesystem root must not be a symbolic link: {path}."
        )
    if not stat.S_ISDIR(metadata.st_mode):
        raise FilesystemSafetyError(f"Filesystem root is not a directory: {path}.")
    try:
        return path.resolve(strict=True)
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Filesystem root could not be resolved safely: {path}."
        ) from exc


def safe_join(
    root: Path,
    relative: str | os.PathLike[str],
    *,
    allow_final_symlink: bool = False,
    require_exists: bool = False,
) -> Path:
    """Join beneath ``root`` while rejecting symlink ancestors and escapes."""

    resolved_root = validate_root(root)
    normalized = safe_relative_path(relative)
    candidate = resolved_root.joinpath(*PurePosixPath(normalized).parts)
    current = resolved_root
    parts = PurePosixPath(normalized).parts
    for index, part in enumerate(parts):
        current /= part
        try:
            metadata = current.lstat()
        except FileNotFoundError:
            if require_exists:
                raise FilesystemSafetyError(
                    f"Required path is missing: {normalized}."
                ) from None
            break
        except OSError as exc:
            raise FilesystemSafetyError(
                f"Could not inspect path safely: {normalized}."
            ) from exc
        final = index == len(parts) - 1
        if stat.S_ISLNK(metadata.st_mode):
            if final and allow_final_symlink:
                continue
            raise FilesystemSafetyError(f"Path contains a symbolic link: {normalized}.")
        if not final and not stat.S_ISDIR(metadata.st_mode):
            raise FilesystemSafetyError(
                f"Path ancestor is not a directory: {normalized}."
            )
    try:
        resolved_parent = candidate.parent.resolve(strict=False)
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Path parent could not be resolved safely: {normalized}."
        ) from exc
    if not resolved_parent.is_relative_to(resolved_root):
        raise FilesystemSafetyError(f"Path resolves outside its root: {normalized}.")
    return candidate


def ensure_directory(
    root: Path, relative: str | os.PathLike[str], *, mode: int = 0o755
) -> Path:
    """Create a directory below ``root`` without traversing symbolic links."""

    resolved_root = validate_root(root)
    normalized = safe_relative_path(relative)
    current = resolved_root
    for part in PurePosixPath(normalized).parts:
        candidate = current / part
        try:
            metadata = candidate.lstat()
        except FileNotFoundError:
            try:
                candidate.mkdir(mode=mode)
            except FileExistsError:
                pass
            except OSError as exc:
                raise FilesystemSafetyError(
                    f"Could not create directory safely: {normalized}."
                ) from exc
            _fsync_directory(current)
            try:
                metadata = candidate.lstat()
            except OSError as exc:
                raise FilesystemSafetyError(
                    f"Could not inspect created directory: {normalized}."
                ) from exc
        except OSError as exc:
            raise FilesystemSafetyError(
                f"Could not inspect directory safely: {normalized}."
            ) from exc
        if stat.S_ISLNK(metadata.st_mode):
            raise FilesystemSafetyError(
                f"Directory path contains a symbolic link: {normalized}."
            )
        if not stat.S_ISDIR(metadata.st_mode):
            raise FilesystemSafetyError(
                f"Directory path contains a non-directory: {normalized}."
            )
        current = candidate
    return current


def read_regular_bytes(
    path: Path,
    *,
    root: Path | None = None,
    label: str = "File",
) -> bytes:
    """Read a regular file without following its final path component."""

    guarded = _guard_path(path, root=root, require_exists=True)
    descriptor: int | None = None
    try:
        before = guarded.lstat()
        if stat.S_ISLNK(before.st_mode) or not stat.S_ISREG(before.st_mode):
            raise FilesystemSafetyError(
                f"{label} must be a regular file, not a symbolic link."
            )
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
        descriptor = os.open(guarded, flags)
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode) or (opened.st_dev, opened.st_ino) != (
            before.st_dev,
            before.st_ino,
        ):
            raise FilesystemSafetyError(
                f"{label} changed while it was being opened safely."
            )
        with os.fdopen(descriptor, "rb") as handle:
            descriptor = None
            return handle.read()
    except FilesystemSafetyError:
        raise
    except OSError as exc:
        raise FilesystemSafetyError(f"{label} is missing or unreadable.") from exc
    finally:
        if descriptor is not None:
            os.close(descriptor)


def read_regular_text(
    path: Path,
    *,
    root: Path | None = None,
    label: str = "File",
    encoding: str = "utf-8",
) -> str:
    """Read and decode one no-follow regular file."""

    try:
        return read_regular_bytes(path, root=root, label=label).decode(encoding)
    except UnicodeError as exc:
        raise FilesystemSafetyError(f"{label} is not valid {encoding} text.") from exc


def atomic_write(
    path: Path,
    content: bytes,
    *,
    mode: int = 0o644,
    root: Path | None = None,
) -> None:
    """Atomically replace a regular file and fsync both file and directory."""

    if not isinstance(content, bytes):
        raise TypeError("atomic_write content must be bytes")
    guarded, parent = _prepare_write_path(path, root=root)
    descriptor: int | None = None
    temporary: Path | None = None
    try:
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{guarded.name}.", dir=parent
        )
        temporary = Path(temporary_name)
        if hasattr(os, "fchmod"):
            os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "wb") as handle:
            descriptor = None
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if not hasattr(os, "fchmod"):
            os.chmod(temporary, mode)
        _reject_unsafe_destination(guarded)
        os.replace(temporary, guarded)
        temporary = None
        _fsync_directory(parent)
    except FilesystemSafetyError:
        raise
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Could not write file atomically: {guarded}."
        ) from exc
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def atomic_write_text(
    path: Path,
    content: str,
    *,
    mode: int = 0o644,
    root: Path | None = None,
    encoding: str = "utf-8",
) -> None:
    """Encode and atomically replace one text file."""

    atomic_write(path, content.encode(encoding), mode=mode, root=root)


def _guard_path(path: Path, *, root: Path | None, require_exists: bool) -> Path:
    candidate = Path(path)
    if root is None:
        if candidate.is_symlink():
            raise FilesystemSafetyError(
                f"Path must not be a symbolic link: {candidate}."
            )
        if require_exists and not candidate.exists():
            raise FilesystemSafetyError(f"Required path is missing: {candidate}.")
        return candidate
    resolved_root = validate_root(root)
    if candidate.is_absolute():
        try:
            relative = candidate.absolute().relative_to(resolved_root).as_posix()
        except ValueError as exc:
            raise FilesystemSafetyError(
                f"Path is outside its declared root: {candidate}."
            ) from exc
    else:
        relative = candidate.as_posix()
    return safe_join(resolved_root, relative, require_exists=require_exists)


def _prepare_write_path(path: Path, *, root: Path | None) -> tuple[Path, Path]:
    candidate = Path(path)
    if root is not None:
        resolved_root = validate_root(root)
        if candidate.is_absolute():
            try:
                relative = candidate.absolute().relative_to(resolved_root).as_posix()
            except ValueError as exc:
                raise FilesystemSafetyError(
                    f"Write path is outside its declared root: {candidate}."
                ) from exc
        else:
            relative = safe_relative_path(candidate)
        normalized = safe_relative_path(relative)
        parent_relative = PurePosixPath(normalized).parent.as_posix()
        parent = (
            resolved_root
            if parent_relative == "."
            else ensure_directory(resolved_root, parent_relative)
        )
        guarded = safe_join(resolved_root, normalized)
        return guarded, parent

    absolute = candidate.absolute()
    ancestor = absolute.parent
    missing: list[str] = []
    while not ancestor.exists() and not ancestor.is_symlink():
        missing.append(ancestor.name)
        ancestor = ancestor.parent
    resolved_ancestor = validate_root(ancestor)
    if missing:
        parent_relative = "/".join(reversed(missing))
        parent = ensure_directory(resolved_ancestor, parent_relative)
    else:
        parent = resolved_ancestor
    guarded = parent / absolute.name
    _reject_unsafe_destination(guarded)
    return guarded, parent


def _reject_unsafe_destination(path: Path) -> None:
    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return
    except OSError as exc:
        raise FilesystemSafetyError(
            f"Could not inspect write destination safely: {path}."
        ) from exc
    if stat.S_ISLNK(metadata.st_mode):
        raise FilesystemSafetyError(
            f"Refusing to replace symbolic-link destination: {path}."
        )
    if not stat.S_ISREG(metadata.st_mode):
        raise FilesystemSafetyError(
            f"Refusing to replace non-regular destination: {path}."
        )


def _fsync_directory(directory: Path) -> None:
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    descriptor: int | None = None
    try:
        descriptor = os.open(directory, flags)
        os.fsync(descriptor)
    except OSError:
        # Directory fsync is unavailable on some supported platforms.
        return
    finally:
        if descriptor is not None:
            os.close(descriptor)
