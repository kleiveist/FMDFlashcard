from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("TEMPLATE_TOOLING_NESTED_TEST") == "1",
    reason="replacement acceptance is not recursively run inside copied tooling",
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
TOOLS_SOURCE = REPOSITORY_ROOT / "tools"
DOCS_SOURCE = REPOSITORY_ROOT / "docs" / "toolingdocs"
_ALLOWED_RUNTIME_DIST = TOOLS_SOURCE / "quality" / "rust_analyzer" / "dist"
_ALLOWED_RUNTIME_FILE = _ALLOWED_RUNTIME_DIST / "rust_quality_analyzer.wasm"
_ALLOWED_SOURCE_BUILD = TOOLS_SOURCE / "tauri" / "build"
_IGNORED_DIRECTORIES = {
    ".build",
    ".cache",
    ".dist",
    ".git",
    ".hypothesis",
    ".mypy_cache",
    ".nox",
    ".pytest_cache",
    ".ruff_cache",
    ".runtime",
    ".tooling-state",
    ".tox",
    ".venv",
    "__pycache__",
    "artifacts",
    "cache",
    "caches",
    "coverage",
    "htmlcov",
    "log",
    "logs",
    "node_modules",
    "out",
    "playwright-report",
    "target",
    "test-results",
    "runtime",
    "venv",
}
_IGNORED_FILES = {".coverage", ".DS_Store"}
_IGNORED_FILE_NAMES = {name.casefold() for name in _IGNORED_FILES}
_IGNORED_SUFFIXES = {
    ".gz",
    ".log",
    ".pdf",
    ".pyc",
    ".pyo",
    ".tar",
    ".tgz",
    ".tmp",
    ".whl",
    ".zip",
}


@dataclass(frozen=True, slots=True)
class _TreeEntry:
    kind: str
    mode: int
    modified_ns: int
    payload: str | None


def _copy_ignore(directory: str, names: list[str]) -> set[str]:
    base = Path(directory)
    ignored: set[str] = set()
    for name in names:
        candidate = base / name
        folded = name.casefold()
        if base == _ALLOWED_RUNTIME_DIST and candidate != _ALLOWED_RUNTIME_FILE:
            ignored.add(name)
            continue
        if candidate.is_dir() and not candidate.is_symlink():
            if folded == "dist" and candidate == _ALLOWED_RUNTIME_DIST:
                continue
            if folded == "build" and candidate == _ALLOWED_SOURCE_BUILD:
                continue
            if (
                folded in {"build", "dist"}
                or folded.endswith(".egg-info")
                or folded in _IGNORED_DIRECTORIES
            ):
                ignored.add(name)
            continue
        if _is_ignored_file(candidate):
            ignored.add(name)
    return ignored


def _is_ignored_file(path: Path) -> bool:
    folded = path.name.casefold()
    return (
        folded in _IGNORED_FILE_NAMES
        or folded.startswith(".coverage.")
        or path.suffix.casefold() in _IGNORED_SUFFIXES
    )


def _copy_payload(project_root: Path) -> None:
    tools_target = project_root / "tools"
    docs_target = project_root / "docs" / "toolingdocs"
    assert not tools_target.exists() and not tools_target.is_symlink()
    assert not docs_target.exists() and not docs_target.is_symlink()
    assert not any(path.is_symlink() for path in TOOLS_SOURCE.rglob("*"))
    assert not any(path.is_symlink() for path in DOCS_SOURCE.rglob("*"))

    shutil.copytree(
        TOOLS_SOURCE,
        tools_target,
        symlinks=True,
        ignore=_copy_ignore,
    )
    docs_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        DOCS_SOURCE,
        docs_target,
        symlinks=True,
        ignore=_copy_ignore,
    )
    _assert_copied_payload_is_clean(project_root)


def _assert_copied_payload_is_clean(project_root: Path) -> None:
    runtime_dist = project_root / "tools" / "quality" / "rust_analyzer" / "dist"
    runtime_file = runtime_dist / _ALLOWED_RUNTIME_FILE.name
    assert runtime_file.is_file() and not runtime_file.is_symlink()
    assert tuple(sorted(path.name for path in runtime_dist.iterdir())) == (
        _ALLOWED_RUNTIME_FILE.name,
    )
    assert _digest(runtime_file) == _digest(_ALLOWED_RUNTIME_FILE)

    for payload_root in (
        project_root / "tools",
        project_root / "docs" / "toolingdocs",
    ):
        for path in payload_root.rglob("*"):
            relative = path.relative_to(project_root).as_posix()
            folded_parts = tuple(
                part.casefold() for part in PurePosixPath(relative).parts
            )
            if path.is_dir() and not path.is_symlink():
                if path == (
                    project_root / "tools" / "quality" / "rust_analyzer" / "dist"
                ):
                    continue
                if path == project_root / "tools" / "tauri" / "build":
                    continue
                assert not any(part in {"build", "dist"} for part in folded_parts)
                assert not any(part in _IGNORED_DIRECTORIES for part in folded_parts), (
                    relative
                )
            else:
                assert not _is_ignored_file(path), relative


def _replace_fixture_payload(project_root: Path, sandbox: Path) -> None:
    """Delete only the two explicit copied targets inside this pytest sandbox."""

    resolved_sandbox = sandbox.resolve(strict=True)
    resolved_project = project_root.resolve(strict=True)
    if resolved_project.parent != resolved_sandbox:
        raise AssertionError("replacement target is not a direct pytest sandbox child")

    explicit_targets = (
        project_root / "tools",
        project_root / "docs" / "toolingdocs",
    )
    expected_targets = {
        (resolved_project / "tools").absolute(),
        (resolved_project / "docs" / "toolingdocs").absolute(),
    }
    if {target.absolute() for target in explicit_targets} != expected_targets:
        raise AssertionError("replacement target set is not the explicit payload set")
    for target in explicit_targets:
        metadata = target.lstat()
        if stat.S_ISLNK(metadata.st_mode) or not stat.S_ISDIR(metadata.st_mode):
            raise AssertionError(
                f"replacement target is not a safe directory: {target}"
            )
        resolved_target = target.resolve(strict=True)
        if not resolved_target.is_relative_to(resolved_project):
            raise AssertionError("replacement target escapes the fixture project")

    for target in explicit_targets:
        shutil.rmtree(target)
    assert (project_root / "docs").is_dir()
    assert not (project_root / "tools").exists()
    assert not (project_root / "docs" / "toolingdocs").exists()
    _copy_payload(project_root)


def _run_json(
    project_root: Path,
    *arguments: str,
    expected_returncode: int = 0,
) -> tuple[dict[str, Any], str]:
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    environment["PYTHONHASHSEED"] = "0"
    environment["PYTHONNOUSERSITE"] = "1"
    environment.pop("PYTHONPYCACHEPREFIX", None)
    environment.pop("PYTHONPATH", None)
    for key in tuple(environment):
        if key.startswith("GIT_"):
            environment.pop(key)
    completed = subprocess.run(
        [sys.executable, "tools/control.py", *arguments],
        cwd=project_root,
        check=False,
        capture_output=True,
        text=True,
        env=environment,
        timeout=60,
    )
    assert completed.returncode == expected_returncode, (
        f"command failed: {' '.join(arguments)}\n"
        f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
    )
    assert completed.stderr == ""
    payload = json.loads(completed.stdout)
    assert isinstance(payload, dict)
    return payload, completed.stdout


def _digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _tree_snapshot(root: Path) -> dict[str, _TreeEntry]:
    entries: dict[str, _TreeEntry] = {}

    def record(path: Path) -> None:
        metadata = path.lstat()
        relative = "." if path == root else path.relative_to(root).as_posix()
        mode = stat.S_IMODE(metadata.st_mode)
        if stat.S_ISLNK(metadata.st_mode):
            entries[relative] = _TreeEntry(
                "symlink",
                mode,
                metadata.st_mtime_ns,
                os.readlink(path),
            )
        elif stat.S_ISREG(metadata.st_mode):
            entries[relative] = _TreeEntry(
                "file",
                mode,
                metadata.st_mtime_ns,
                _digest(path),
            )
        elif stat.S_ISDIR(metadata.st_mode):
            entries[relative] = _TreeEntry(
                "directory",
                mode,
                metadata.st_mtime_ns,
                None,
            )
        else:
            entries[relative] = _TreeEntry(
                "other",
                mode,
                metadata.st_mtime_ns,
                None,
            )

    record(root)
    for directory, names, files in os.walk(root, followlinks=False):
        names.sort()
        files.sort()
        base = Path(directory)
        for name in (*names, *files):
            record(base / name)
    return entries


def _product_hashes(project_root: Path) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for path in sorted(project_root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(project_root).as_posix()
        if relative in {
            "project-tooling.toml",
            ".tooling-state",
            "tools",
            "docs/toolingdocs",
        } or relative.startswith((".tooling-state/", "tools/", "docs/toolingdocs/")):
            continue
        hashes[relative] = _digest(path)
    return hashes


def _write_product_sentinels(project_root: Path) -> None:
    sentinels: dict[str, bytes] = {
        "frontend/src/main.ts": b"export const customerOwned = true;\n",
        "backend/app/main.py": b"customer_owned = True\n",
        "src-tauri/src/main.rs": b"fn customer_owned() {}\n",
        "customer-data/opaque.bin": b"\x00customer\xffpayload",
        "docs/project-guide.md": b"# Customer documentation\n",
    }
    for relative, content in sentinels.items():
        path = project_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def test_copied_tooling_and_docs_can_be_replaced_without_touching_project(
    tmp_path: Path,
) -> None:
    project_root = tmp_path / "replacement-target"
    project_root.mkdir()
    _copy_payload(project_root)
    _write_product_sentinels(project_root)
    product_before = _product_hashes(project_root)

    integrated, _ = _run_json(
        project_root,
        "integrate",
        "--full-fix",
        "--json",
    )
    assert integrated["action"] == "integrate-full-fix"
    assert integrated["status"] == "INTEGRATED"
    assert integrated["report_path"] is not None
    assert _product_hashes(project_root) == product_before

    config = project_root / "project-tooling.toml"
    state_root = project_root / ".tooling-state"
    assert config.is_file()
    assert (state_root / "state.toml").is_file()
    config_before = _tree_snapshot(config)
    state_before = _tree_snapshot(state_root)

    _replace_fixture_payload(project_root, tmp_path)

    assert _tree_snapshot(config) == config_before
    assert _tree_snapshot(state_root) == state_before
    assert _product_hashes(project_root) == product_before
    before_maintenance = _tree_snapshot(project_root)

    migrated, first_migrate_output = _run_json(
        project_root,
        "tooling",
        "migrate",
        "--json",
    )
    assert migrated["action"] == "tooling-migrate"
    assert migrated["status"] == "INTEGRATED"
    assert migrated["pending_migrations"] == []
    assert migrated["applied_migrations"] == []
    assert migrated["plan"]["required_changes"] == 0
    assert migrated["report_path"] is None
    assert _tree_snapshot(project_root) == before_maintenance

    verified, _ = _run_json(
        project_root,
        "tooling",
        "verify",
        "--json",
    )
    assert verified["action"] == "tooling-verify"
    assert verified["status"] == "INTEGRATED"
    assert verified["plan"]["required_changes"] == 0
    assert verified["plan"]["conflicts"] == []
    assert _tree_snapshot(project_root) == before_maintenance

    migrated_again, second_migrate_output = _run_json(
        project_root,
        "tooling",
        "migrate",
        "--json",
    )
    assert migrated_again == migrated
    assert second_migrate_output == first_migrate_output
    assert _tree_snapshot(project_root) == before_maintenance
    assert _tree_snapshot(config) == config_before
    assert _tree_snapshot(state_root) == state_before
    assert _product_hashes(project_root) == product_before


def test_empty_target_integration_does_not_create_product_files(tmp_path: Path) -> None:
    project_root = tmp_path / "empty-target"
    project_root.mkdir()
    _copy_payload(project_root)
    assert _product_hashes(project_root) == {}

    integrated, _ = _run_json(
        project_root,
        "integrate",
        "--full-fix",
        "--json",
    )

    assert integrated["status"] == "INTEGRATED"
    assert integrated["profile"]["id"] == "web-only"
    assert integrated["detection"]["frontend"] is None
    assert integrated["detection"]["backend"] is None
    assert integrated["detection"]["tauri"] is None
    assert _product_hashes(project_root) == {}
    assert (project_root / "project-tooling.toml").is_file()
    assert (project_root / ".tooling-state" / "state.toml").is_file()
    for relative in (
        "frontend",
        "backend",
        "src-tauri",
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "tauri.conf.json",
        "compose.yaml",
        ".github/workflows",
    ):
        path = project_root / relative
        assert not path.exists() and not path.is_symlink(), relative
