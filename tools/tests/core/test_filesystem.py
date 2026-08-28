from __future__ import annotations

import os
from pathlib import Path

import pytest

from tools.core import filesystem as filesystem_module
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write,
    atomic_write_text,
    ensure_directory,
    read_regular_bytes,
    read_regular_text,
    safe_join,
    safe_relative_path,
)


@pytest.mark.parametrize(
    "value",
    (
        "",
        ".",
        "..",
        "../outside",
        "nested/../outside",
        "/absolute",
        "C:/outside",
        "C:\\outside",
        "\\\\server\\share",
        "nested\\windows.txt",
        "nested//empty.txt",
        "trailing/",
        "file:stream",
        'tools/bad"name.py',
        "tools/bad<name.py",
        "tools/bad>name.py",
        "tools/bad|name.py",
        "tools/bad?name.py",
        "tools/bad*name.py",
        "tools/control\x01name.py",
        "tools/cafe\u0301.py",
        "NUL.txt",
        "CON .txt",
    ),
)
def test_safe_relative_path_rejects_cross_platform_escapes(value: str) -> None:
    with pytest.raises(FilesystemSafetyError):
        safe_relative_path(value)


def test_safe_relative_path_preserves_canonical_unicode_paths() -> None:
    assert safe_relative_path("tools/über/config.toml") == "tools/über/config.toml"


def test_safe_join_rejects_symlink_ancestors_and_outside_absolute_paths(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    external = tmp_path / "external"
    root.mkdir()
    external.mkdir()
    try:
        (root / "linked").symlink_to(external, target_is_directory=True)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(FilesystemSafetyError, match="symbolic link"):
        safe_join(root, "linked/secret.txt")
    with pytest.raises(FilesystemSafetyError, match="Unsafe relative path"):
        safe_join(root, str(external / "secret.txt"))


def test_ensure_directory_never_traverses_a_symlink(tmp_path: Path) -> None:
    root = tmp_path / "project"
    external = tmp_path / "external"
    root.mkdir()
    external.mkdir()
    try:
        (root / "state").symlink_to(external, target_is_directory=True)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(FilesystemSafetyError, match="symbolic link"):
        ensure_directory(root, "state/nested")
    assert not (external / "nested").exists()


def test_regular_file_reads_never_follow_the_final_symlink(tmp_path: Path) -> None:
    external = tmp_path / "external.txt"
    external.write_text("secret\n", encoding="utf-8")
    linked = tmp_path / "linked.txt"
    try:
        linked.symlink_to(external)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(FilesystemSafetyError, match="symbolic link"):
        read_regular_bytes(linked)
    with pytest.raises(FilesystemSafetyError, match="symbolic link"):
        read_regular_text(linked)


def test_regular_file_read_with_root_rejects_a_symlink_parent(tmp_path: Path) -> None:
    root = tmp_path / "project"
    external = tmp_path / "external"
    root.mkdir()
    external.mkdir()
    (external / "secret.txt").write_text("secret\n", encoding="utf-8")
    try:
        (root / "linked").symlink_to(external, target_is_directory=True)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(FilesystemSafetyError, match="symbolic link"):
        read_regular_text(root / "linked/secret.txt", root=root)


def test_atomic_write_creates_parents_replaces_content_and_fsyncs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    path = root / ".tooling-state" / "state.toml"
    fsync_calls: list[int] = []
    directory_fsync_calls: list[Path] = []
    real_fsync = os.fsync
    real_fsync_directory = filesystem_module._fsync_directory

    def recording_fsync(descriptor: int) -> None:
        fsync_calls.append(descriptor)
        real_fsync(descriptor)

    def recording_directory_fsync(directory: Path) -> None:
        directory_fsync_calls.append(directory)
        real_fsync_directory(directory)

    monkeypatch.setattr(os, "fsync", recording_fsync)
    monkeypatch.setattr(
        filesystem_module,
        "_fsync_directory",
        recording_directory_fsync,
    )
    atomic_write_text(path, "first\n", root=root)
    atomic_write(path, b"second\n", root=root)

    assert path.read_bytes() == b"second\n"
    assert len(fsync_calls) >= 2
    assert root in directory_fsync_calls
    assert directory_fsync_calls.count(path.parent) == 2
    assert not tuple(path.parent.glob(f".{path.name}.*"))


def test_atomic_write_rejects_symlink_destination_without_touching_target(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    external = tmp_path / "external.txt"
    external.write_text("unchanged\n", encoding="utf-8")
    destination = root / "state.toml"
    try:
        destination.symlink_to(external)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(FilesystemSafetyError, match="symbolic link"):
        atomic_write_text(destination, "replacement\n", root=root)
    assert external.read_text(encoding="utf-8") == "unchanged\n"
