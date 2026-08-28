"""Independent portable acceptance coverage for real profile integration.

The copy matrix covers broad discovery and replacement scenarios.  This module
uses deliberately incomplete, explicit profile fixtures to prove that a copied
runtime performs its structured repairs through the normal CLI and preserves
customer-owned values it does not declare.
"""

from __future__ import annotations

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
import tomllib

from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    render_project_config,
)
from tools.integration.model import IntegrationError
from tools.integration.workflow import run_full_fix

pytestmark = pytest.mark.skipif(
    os.environ.get("TEMPLATE_TOOLING_NESTED_TEST") == "1",
    reason="profile acceptance is not recursively run in staged tooling tests",
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SOURCE_TOOLS = REPOSITORY_ROOT / "tools"
SOURCE_DOCS = REPOSITORY_ROOT / "docs" / "toolingdocs"
TOOLING_VERSION = (SOURCE_TOOLS / "VERSION").read_text(encoding="utf-8").strip()

_CACHE_OR_RUNTIME_DIRECTORIES = frozenset(
    {
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
        "runtime",
        "target",
        "test-results",
        "venv",
    }
)
_IGNORED_FILE_NAMES = frozenset({".coverage", ".ds_store"})
_IGNORED_SUFFIXES = frozenset(
    {".gz", ".log", ".pdf", ".pyc", ".pyo", ".tar", ".tgz", ".tmp", ".whl", ".zip"}
)
_ALLOWED_BUILD_DIRECTORY = PurePosixPath("tools/tauri/build")
_ALLOWED_DIST_DIRECTORY = PurePosixPath("tools/quality/rust_analyzer/dist")


@dataclass(frozen=True, slots=True)
class ProfileCase:
    """One persisted profile with the optional product surfaces it needs."""

    profile: str
    has_backend: bool = False
    has_tauri: bool = False


@dataclass(frozen=True, slots=True)
class TreeEntry:
    """Portable filesystem snapshot entry that intentionally ignores atime."""

    kind: str
    mode: int
    payload: bytes | str | None


CASES = (
    ProfileCase("web-only"),
    ProfileCase("web-cloud", has_backend=True),
    ProfileCase("desktop-local", has_tauri=True),
    ProfileCase("desktop-cloud", has_backend=True, has_tauri=True),
    ProfileCase("full-platform", has_backend=True, has_tauri=True),
)


@pytest.mark.parametrize("case", CASES, ids=lambda item: item.profile)
def test_portable_profile_integration_is_read_only_transactional_and_idempotent(
    tmp_path: Path,
    case: ProfileCase,
) -> None:
    """Exercise every supported profile against intentionally incomplete files."""

    root = tmp_path / case.profile
    root.mkdir()
    _seed_profile_fixture(root, case)
    _copy_portable_runtime(root)

    product_before = _selected_snapshot(root, _product_paths(case))
    before_check = _snapshot_tree(root)
    checked = _run_json(root, "integrate", "--check", "--json", expected_returncode=1)

    assert checked["profile"]["id"] == case.profile
    assert checked["plan"]["status"] == "FIX_REQUIRED"
    assert checked["plan"]["conflicts"] == []
    assert checked["plan"]["required_changes"] > 0
    _assert_required_structured_patches(checked, case)
    assert _snapshot_tree(root) == before_check
    assert _selected_snapshot(root, _product_paths(case)) == product_before

    before_verify = _snapshot_tree(root)
    unverified = _run_json(
        root,
        "tooling",
        "verify",
        "--json",
        expected_returncode=1,
    )
    assert unverified["status"] == "VERIFICATION_FAILED"
    assert unverified["profile"]["id"] == case.profile
    assert unverified["plan"]["conflicts"] == []
    assert _snapshot_tree(root) == before_verify
    assert _selected_snapshot(root, _product_paths(case)) == product_before

    applied = _run_json(
        root,
        "integrate",
        "--full-fix",
        "--json",
        expected_returncode=0,
    )
    assert applied["status"] == "INTEGRATED"
    assert applied["profile"]["id"] == case.profile
    assert applied["plan"]["conflicts"] == []
    assert applied["verification"]["ok"] is True
    assert applied["report_path"] is not None
    assert _selected_snapshot(root, _product_paths(case)) == product_before
    _assert_structured_repairs_preserve_customer_values(root, case)

    before_integrated_check = _snapshot_tree(root)
    integrated = _run_json(
        root,
        "integrate",
        "--check",
        "--json",
        expected_returncode=0,
    )
    _assert_integrated(integrated, case.profile)
    assert _snapshot_tree(root) == before_integrated_check
    assert _selected_snapshot(root, _product_paths(case)) == product_before

    before_integrated_verify = _snapshot_tree(root)
    verified = _run_json(
        root,
        "tooling",
        "verify",
        "--json",
        expected_returncode=0,
    )
    _assert_integrated(verified, case.profile)
    assert _snapshot_tree(root) == before_integrated_verify
    assert _selected_snapshot(root, _product_paths(case)) == product_before

    before_second_fix = _snapshot_tree(root)
    repeated = _run_json(
        root,
        "integrate",
        "--full-fix",
        "--json",
        expected_returncode=0,
    )
    _assert_integrated(repeated, case.profile)
    assert repeated["actions"] == []
    assert repeated["report_path"] is None
    assert _snapshot_tree(root) == before_second_fix
    assert _selected_snapshot(root, _product_paths(case)) == product_before


def test_profile_integration_rolls_back_every_structured_repair_before_retry(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A deterministic post-verify failure cannot leave a partial profile fix."""

    case = ProfileCase("desktop-cloud", has_backend=True, has_tauri=True)
    root = tmp_path / "rollback"
    root.mkdir()
    _seed_profile_fixture(root, case)
    _copy_portable_runtime(root)
    before_failure = _selected_snapshot(root, _rollback_protected_paths(case))

    monkeypatch.setenv("TOOLING_TEST_FAILPOINT", "post_verify")
    with pytest.raises(
        IntegrationError,
        match="Deterministic test failpoint triggered: post_verify",
    ):
        run_full_fix(root, tools_root=root / "tools")
    monkeypatch.delenv("TOOLING_TEST_FAILPOINT")

    assert _selected_snapshot(root, _rollback_protected_paths(case)) == before_failure
    assert not (root / ".tooling-state" / "state.toml").exists()
    assert (root / ".tooling-state" / "reports" / "journal.json").is_file()

    retry = run_full_fix(root, tools_root=root / "tools")
    assert retry.changed is True
    assert retry.result.outcome == "INTEGRATED"
    assert run_full_fix(root, tools_root=root / "tools").changed is False
    _assert_structured_repairs_preserve_customer_values(root, case)


def _seed_profile_fixture(root: Path, case: ProfileCase) -> None:
    """Create explicit parents with one allowlisted value deliberately absent."""

    paths = ProjectPathConfig(
        frontend="frontend",
        backend="backend" if case.has_backend else "",
        tauri="src-tauri",
        docs="docs",
    )
    (root / "project-tooling.toml").write_text(
        render_project_config(
            ProjectConfig(
                tooling_version=TOOLING_VERSION,
                project_name=f"Profile acceptance {case.profile}",
                profile=case.profile,
                paths=paths,
            )
        ),
        encoding="utf-8",
    )
    _write(
        root,
        "frontend/package.json",
        json.dumps(
            {
                "name": "customer-frontend",
                "private": True,
                "scripts": {
                    "build": 'node -e "process.exit(0)"',
                    "customer:keep": "node scripts/customer.mjs",
                },
                "devDependencies": {"typescript": "^5.0.0", "vite": "^7.0.0"},
                "customer": {"releaseChannel": "internal", "keep": ["a", "b"]},
            },
            ensure_ascii=False,
        )
        + "\n",
    )
    _write(root, "frontend/src/customer.ts", "export const customerOwned = true;\n")
    _write(root, "notes/customer.txt", "This file is not owned by tooling.\n")

    if case.has_backend:
        _write(
            root,
            "backend/app/main.py",
            "from fastapi import FastAPI\n\napp = FastAPI()\n",
        )
        _write(root, "backend/app/customer.py", "CUSTOMER_API = 'keep'\n")
        _write(root, "backend/requirements.txt", "fastapi>=0.116\n")
        _write(
            root,
            "backend/pyproject.toml",
            "# customer preamble remains byte-for-byte\n"
            "[project]\n"
            'name = "customer-api"\n'
            'version = "0.1.0"\n\n'
            "[tool.customer]\n"
            'retained = "yes"\n\n'
            "[tool.template_tooling]\n"
            'customer_note = "preserve"\n',
        )

    if case.has_tauri:
        _write(
            root,
            "src-tauri/Cargo.toml",
            "# customer Cargo preamble remains byte-for-byte\n"
            "[package]\n"
            'name = "customer-desktop"\n'
            'version = "0.1.0"\n'
            'edition = "2021"\n'
            'license = "LicenseRef-Customer"\n\n'
            "[package.metadata.template_tooling]\n"
            'customer_note = "preserve"\n',
        )
        _write(
            root,
            "src-tauri/Cargo.lock",
            "# This file is automatically @generated by Cargo.\n"
            "# It is not intended for manual editing.\n"
            "version = 4\n\n"
            "[[package]]\n"
            'name = "customer-desktop"\n'
            'version = "0.1.0"\n',
        )
        _write(
            root,
            "src-tauri/tauri.conf.json",
            json.dumps(
                {
                    "productName": "Customer Desktop",
                    "customer": {"retain": "all-values"},
                    "build": {
                        "beforeDevCommand": "npm run dev",
                        "devPath": "http://localhost:5173",
                        "customerFlag": True,
                    },
                },
                ensure_ascii=False,
            )
            + "\n",
        )
        _write(root, "src-tauri/src/lib.rs", 'pub const CUSTOMER: &str = "keep";\n')


def _write(root: Path, relative: str, content: str) -> None:
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def _copy_portable_runtime(root: Path) -> None:
    shutil.copytree(
        SOURCE_TOOLS,
        root / "tools",
        symlinks=True,
        ignore=_portable_copy_ignore,
    )
    shutil.copytree(
        SOURCE_DOCS,
        root / "docs" / "toolingdocs",
        symlinks=True,
        ignore=_portable_copy_ignore,
    )


def _portable_copy_ignore(directory: str, names: list[str]) -> set[str]:
    parent = Path(directory)
    relative_parent = parent.relative_to(REPOSITORY_ROOT)
    return {name for name in names if _is_portable_artifact(relative_parent / name)}


def _is_portable_artifact(relative: Path) -> bool:
    original = PurePosixPath(relative.as_posix())
    folded = PurePosixPath(*(part.casefold() for part in original.parts))
    name = folded.name
    return (
        name in _CACHE_OR_RUNTIME_DIRECTORIES
        or name.endswith(".egg-info")
        or (name == "build" and original != _ALLOWED_BUILD_DIRECTORY)
        or (name == "dist" and original != _ALLOWED_DIST_DIRECTORY)
        or name in {"generated", "output"}
        or name in _IGNORED_FILE_NAMES
        or name.startswith(".coverage.")
        or folded.suffix in _IGNORED_SUFFIXES
    )


def _run_json(
    root: Path,
    *arguments: str,
    expected_returncode: int,
) -> dict[str, Any]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.pop("PYTHONPYCACHEPREFIX", None)
    environment.pop("TEMPLATE_TOOLING_NESTED_TEST", None)
    for key in tuple(environment):
        if key.startswith("GIT_"):
            environment.pop(key)
    environment.update(
        {
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONHASHSEED": "0",
            "PYTHONNOUSERSITE": "1",
        }
    )
    completed = subprocess.run(
        [sys.executable, "tools/control.py", *arguments],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        env=environment,
        timeout=240,
    )
    assert completed.returncode == expected_returncode, (
        f"command {' '.join(arguments)!r} returned {completed.returncode}\n"
        f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
    )
    assert completed.stderr == ""
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"command {' '.join(arguments)!r} did not emit JSON\n"
            f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        ) from exc
    assert isinstance(payload, dict)
    return payload


def _assert_required_structured_patches(
    payload: dict[str, Any], case: ProfileCase
) -> None:
    patches = {
        item["path"]: set(item["structured_keys"])
        for item in payload["plan"]["operations"]
        if item["kind"] == "PATCH"
    }
    frontend = patches["frontend/package.json"]
    assert {"scripts.dev", "scripts.typecheck"} <= frontend
    assert "scripts.build" not in frontend
    if case.has_backend:
        assert "tool.template_tooling.profile" in patches["backend/pyproject.toml"]
    if case.has_tauri:
        assert (
            "package.metadata.template_tooling.profile"
            in patches["src-tauri/Cargo.toml"]
        )
        assert "build.beforeBuildCommand" in patches["src-tauri/tauri.conf.json"]


def _assert_structured_repairs_preserve_customer_values(
    root: Path,
    case: ProfileCase,
) -> None:
    package = _load_json(root / "frontend" / "package.json")
    assert package["name"] == "customer-frontend"
    assert package["customer"] == {"releaseChannel": "internal", "keep": ["a", "b"]}
    assert package["scripts"]["customer:keep"] == "node scripts/customer.mjs"
    assert package["scripts"]["build"] == 'node -e "process.exit(0)"'
    assert package["scripts"]["dev"] == "vite"
    assert package["scripts"]["typecheck"] == "tsc --noEmit"

    if case.has_backend:
        backend_path = root / "backend" / "pyproject.toml"
        backend = tomllib.loads(backend_path.read_text(encoding="utf-8"))
        assert backend["project"] == {"name": "customer-api", "version": "0.1.0"}
        assert backend["tool"]["customer"] == {"retained": "yes"}
        assert backend["tool"]["template_tooling"] == {
            "customer_note": "preserve",
            "profile": case.profile,
        }
        assert "# customer preamble remains byte-for-byte" in backend_path.read_text(
            encoding="utf-8"
        )

    if case.has_tauri:
        cargo_path = root / "src-tauri" / "Cargo.toml"
        cargo = tomllib.loads(cargo_path.read_text(encoding="utf-8"))
        assert cargo["package"]["name"] == "customer-desktop"
        assert cargo["package"]["license"] == "LicenseRef-Customer"
        assert cargo["package"]["metadata"]["template_tooling"] == {
            "customer_note": "preserve",
            "profile": case.profile,
        }
        assert (
            "# customer Cargo preamble remains byte-for-byte"
            in cargo_path.read_text(encoding="utf-8")
        )

        tauri = _load_json(root / "src-tauri" / "tauri.conf.json")
        assert tauri["productName"] == "Customer Desktop"
        assert tauri["customer"] == {"retain": "all-values"}
        assert tauri["build"] == {
            "beforeBuildCommand": "npm run build",
            "beforeDevCommand": "npm run dev",
            "customerFlag": True,
            "devPath": "http://localhost:5173",
        }


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def _assert_integrated(payload: dict[str, Any], profile: str) -> None:
    assert payload["status"] == "INTEGRATED"
    assert payload["profile"]["id"] == profile
    assert payload["plan"]["status"] == "INTEGRATED"
    assert payload["plan"]["required_changes"] == 0
    assert payload["plan"]["conflicts"] == []
    assert payload["verification"]["ok"] is True


def _product_paths(case: ProfileCase) -> tuple[str, ...]:
    paths = [
        "project-tooling.toml",
        "frontend/src/customer.ts",
        "notes/customer.txt",
    ]
    if case.has_backend:
        paths.append("backend/app/customer.py")
    if case.has_tauri:
        paths.extend(("src-tauri/Cargo.lock", "src-tauri/src/lib.rs"))
    return tuple(paths)


def _rollback_protected_paths(case: ProfileCase) -> tuple[str, ...]:
    paths = [
        *_product_paths(case),
        "frontend/package.json",
    ]
    if case.has_backend:
        paths.append("backend/pyproject.toml")
    if case.has_tauri:
        paths.extend(("src-tauri/Cargo.toml", "src-tauri/tauri.conf.json"))
    return tuple(paths)


def _selected_snapshot(root: Path, paths: tuple[str, ...]) -> dict[str, bytes]:
    return {relative: (root / relative).read_bytes() for relative in paths}


def _snapshot_tree(root: Path) -> dict[str, TreeEntry]:
    entries: dict[str, TreeEntry] = {}

    def record(path: Path) -> None:
        metadata = path.lstat()
        relative = "." if path == root else path.relative_to(root).as_posix()
        mode = stat.S_IMODE(metadata.st_mode)
        if stat.S_ISLNK(metadata.st_mode):
            entries[relative] = TreeEntry("symlink", mode, os.readlink(path))
        elif stat.S_ISREG(metadata.st_mode):
            entries[relative] = TreeEntry("file", mode, path.read_bytes())
        elif stat.S_ISDIR(metadata.st_mode):
            entries[relative] = TreeEntry("directory", mode, None)
        else:
            entries[relative] = TreeEntry("other", mode, None)

    record(root)
    for directory, names, files in os.walk(root, followlinks=False):
        parent = Path(directory)
        for name in sorted((*names, *files)):
            record(parent / name)
    return entries
