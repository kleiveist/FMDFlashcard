"""Black-box acceptance matrix for the copied portable tooling runtime."""

from __future__ import annotations

import copy
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
import tomllib

from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    render_project_config,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SOURCE_TOOLS = REPOSITORY_ROOT / "tools"
SOURCE_DOCS = REPOSITORY_ROOT / "docs"
TOOLING_VERSION = (SOURCE_TOOLS / "VERSION").read_text(encoding="utf-8").strip()
RUST_ANALYZER_WASM = Path("tools/quality/rust_analyzer/dist/rust_quality_analyzer.wasm")
# The complete copied suite is materially slower on hosted Windows runners.
_COPIED_RUNTIME_TIMEOUT_SECONDS = 360 if os.name == "nt" else 240

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
_IGNORED_FILES = frozenset({".coverage", ".DS_Store"})
_IGNORED_FILE_NAMES = frozenset(name.casefold() for name in _IGNORED_FILES)
_IGNORED_SUFFIXES = frozenset(
    {".gz", ".log", ".pdf", ".pyc", ".pyo", ".tar", ".tgz", ".tmp", ".whl", ".zip"}
)
_DEFAULT_CONFIG_PATHS = (
    ("frontend", "frontend"),
    ("backend", ""),
    ("tauri", "src-tauri"),
    ("docs", "docs"),
)

pytestmark = pytest.mark.skipif(
    os.environ.get("TEMPLATE_TOOLING_NESTED_TEST") == "1",
    reason="avoid recursively starting the copy-matrix from a copied tools suite",
)


@dataclass(frozen=True, slots=True)
class CopyCase:
    name: str
    expected_profile: str
    expected_detection: tuple[tuple[str, str], ...] = ()
    expected_config_paths: tuple[tuple[str, str], ...] = _DEFAULT_CONFIG_PATHS


@dataclass(frozen=True, slots=True)
class TreeEntry:
    kind: str
    mode: int
    modified_ns: int
    payload: bytes | str | None


CASES = (
    CopyCase("empty", "web-only"),
    CopyCase("vite", "web-only", (("frontend", "frontend"),)),
    CopyCase(
        "fastapi",
        "web-cloud",
        (("backend", "backend"),),
        (
            ("frontend", "frontend"),
            ("backend", "backend"),
            ("tauri", "src-tauri"),
            ("docs", "docs"),
        ),
    ),
    CopyCase("tauri", "desktop-local", (("tauri", "src-tauri"),)),
    CopyCase(
        "persisted-desktop-local",
        "desktop-local",
        (("frontend", "frontend"), ("tauri", "src-tauri")),
    ),
    CopyCase(
        "persisted-web-cloud",
        "web-cloud",
        (("frontend", "frontend"), ("backend", "backend")),
        (
            ("frontend", "frontend"),
            ("backend", "backend"),
            ("tauri", "src-tauri"),
            ("docs", "docs"),
        ),
    ),
    CopyCase(
        "persisted-full-platform",
        "full-platform",
        (
            ("frontend", "frontend"),
            ("backend", "backend"),
            ("tauri", "src-tauri"),
        ),
        (
            ("frontend", "frontend"),
            ("backend", "backend"),
            ("tauri", "src-tauri"),
            ("docs", "docs"),
        ),
    ),
    CopyCase(
        "custom-paths-desktop-cloud",
        "desktop-cloud",
        (
            ("frontend", "client-app"),
            ("backend", "services/api"),
            ("tauri", "desktop/native"),
            ("container", "infra/local"),
        ),
        (
            ("frontend", "client-app"),
            ("backend", "services/api"),
            ("tauri", "desktop/native"),
            ("docs", "handbook"),
        ),
    ),
    CopyCase("unknown-extra-files", "web-only"),
)


def test_portable_artifact_filter_covers_case_and_python_builds() -> None:
    blocked = (
        Path("tools/example.egg-info"),
        Path("tools/.PYTEST_CACHE"),
        Path("docs/toolingdocs/BUILD"),
        Path("tools/generated/DIST"),
        Path("docs/toolingdocs/case-study/OUTPUT"),
        Path("docs/toolingdocs/case-study/generated"),
        Path("tools/quality/rust_analyzer/DIST"),
        Path("tools/tauri/BUILD"),
    )
    allowed = (
        Path("tools/quality/rust_analyzer/dist"),
        Path("tools/tauri/build"),
    )

    assert all(_is_portable_artifact(path) for path in blocked)
    assert all(not _is_portable_artifact(path) for path in allowed)


@pytest.mark.parametrize("case", CASES, ids=lambda case: case.name)
def test_copied_tooling_matrix_is_read_only_integrated_and_idempotent(
    tmp_path: Path,
    case: CopyCase,
) -> None:
    root = tmp_path / case.name
    root.mkdir()
    product_paths = _seed_product(root, case.name)
    _copy_portable_runtime(root, case)
    _assert_portable_copy_is_clean(root)
    clean_git_repository = _initialize_clean_git(root, case)
    package_before = _package_payloads(root, case)
    structured_paths = frozenset(package_before)
    protected_before = _product_digests(
        root,
        product_paths,
        excluded=structured_paths,
    )
    product_tree_before = _project_owned_digests(root, case)
    before_check = _snapshot_tree(root)

    first_check = _run_json(
        root,
        "integrate",
        "--check",
        "--json",
        expected_returncode=1,
    )

    assert _snapshot_tree(root) == before_check
    assert first_check.get("status") == "FIX_REQUIRED", first_check
    assert first_check["plan"]["conflicts"] == []
    assert first_check["plan"]["required_changes"] > 0
    assert first_check["profile"]["id"] == case.expected_profile
    for technology, expected_path in case.expected_detection:
        evidence = first_check["detection"][technology]
        assert evidence is not None
        assert evidence["path"] == expected_path

    first_fix = _run_json(
        root,
        "integrate",
        "--full-fix",
        "--json",
        expected_returncode=0,
        timeout=_COPIED_RUNTIME_TIMEOUT_SECONDS,
    )

    assert first_fix["status"] == "INTEGRATED"
    assert first_fix["report_path"] is not None
    assert first_fix["actions"] == (
        [
            "Staged quality action passed.",
            "Staged tests action passed.",
            "Staged build action passed for 1 declared target(s).",
        ]
        if package_before
        else []
    )
    if clean_git_repository:
        assert "Git preflight: worktree is clean." in first_fix["notices"]
    _assert_persisted_config(root, case)
    _assert_package_integration(root, package_before)
    package_integrated = _package_payloads(root, case)
    assert (
        _product_digests(
            root,
            product_paths,
            excluded=structured_paths,
        )
        == protected_before
    )
    assert _project_owned_digests(root, case) == product_tree_before

    before_integrated_check = _snapshot_tree(root)
    integrated = _run_json(
        root,
        "integrate",
        "--check",
        "--json",
        expected_returncode=0,
    )
    _assert_integrated(integrated, expected_profile=case.expected_profile)
    assert _snapshot_tree(root) == before_integrated_check
    assert (
        _product_digests(
            root,
            product_paths,
            excluded=structured_paths,
        )
        == protected_before
    )
    assert _project_owned_digests(root, case) == product_tree_before
    assert _package_payloads(root, case) == package_integrated

    before_verify = _snapshot_tree(root)
    verified = _run_json(
        root,
        "tooling",
        "verify",
        "--json",
        expected_returncode=0,
    )
    _assert_integrated(verified, expected_profile=case.expected_profile)
    assert _snapshot_tree(root) == before_verify
    assert (
        _product_digests(
            root,
            product_paths,
            excluded=structured_paths,
        )
        == protected_before
    )
    assert _project_owned_digests(root, case) == product_tree_before
    assert _package_payloads(root, case) == package_integrated

    before_complete_test = _snapshot_tree(root)
    complete_test = _run_command(
        root,
        "test",
        "--suite",
        "all",
        expected_returncode=0,
        timeout=_COPIED_RUNTIME_TIMEOUT_SECONDS,
    )
    assert "suite:tools" in complete_test.stdout
    assert "Overall test status: OK" in complete_test.stdout
    assert _snapshot_tree(root) == before_complete_test
    assert (
        _product_digests(
            root,
            product_paths,
            excluded=structured_paths,
        )
        == protected_before
    )
    assert _project_owned_digests(root, case) == product_tree_before
    assert _package_payloads(root, case) == package_integrated

    before_second_fix = _snapshot_tree(root)
    reports_before = _report_directories(root)
    second_fix = _run_json(
        root,
        "integrate",
        "--full-fix",
        "--json",
        expected_returncode=0,
    )

    _assert_integrated(second_fix, expected_profile=case.expected_profile)
    assert second_fix["actions"] == []
    assert second_fix["report_path"] is None
    assert _report_directories(root) == reports_before
    assert _snapshot_tree(root) == before_second_fix
    assert (
        _product_digests(
            root,
            product_paths,
            excluded=structured_paths,
        )
        == protected_before
    )
    assert _project_owned_digests(root, case) == product_tree_before
    assert _package_payloads(root, case) == package_integrated


def _seed_product(root: Path, name: str) -> tuple[str, ...]:
    paths: list[str] = []

    def write(relative: str, content: bytes | str) -> None:
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, bytes):
            target.write_bytes(content)
        else:
            target.write_text(content, encoding="utf-8")
        paths.append(relative)

    def vite(frontend: str = "frontend") -> None:
        write(
            f"{frontend}/package.json",
            '{"scripts":{"build":"node -e \\"process.exit(0)\\"",'
            '"dev":"vite","test":"node -e \\"process.exit(0)\\""},'
            '"devDependencies":{"typescript":"^5.0.0","vite":"^7.0.0"}}\n',
        )
        write(f"{frontend}/src/main.ts", "export const productOwned = true;\n")

    def fastapi(backend: str = "backend") -> None:
        write(
            f"{backend}/app/main.py",
            "from fastapi import FastAPI\n\napp = FastAPI()\n",
        )
        write(f"{backend}/requirements.txt", "fastapi>=0.116\n")
        write(
            f"{backend}/requirements-production.lock",
            "customer-runtime==1.2.3\n",
        )

    def tauri(tauri_root: str = "src-tauri") -> None:
        write(
            f"{tauri_root}/Cargo.toml",
            '[package]\nname = "copied-acceptance"\nversion = "0.1.0"\n',
        )
        write(f"{tauri_root}/tauri.conf.json", '{"productName":"Acceptance"}\n')
        write(
            f"{tauri_root}/src/lib.rs",
            'pub const CUSTOMER_DOMAIN: &str = "com.fmd.flashcard";\n',
        )
        write(
            f"{tauri_root}/capabilities/default.json",
            '{"identifier":"customer-policy","permissions":["customer:read"],'
            '"remote":{"urls":["https://customer.invalid"]}}\n',
        )

    def config(
        profile: str,
        *,
        frontend: str = "frontend",
        backend: str = "",
        tauri_root: str = "src-tauri",
        docs: str = "docs",
    ) -> None:
        rendered = render_project_config(
            ProjectConfig(
                tooling_version=TOOLING_VERSION,
                project_name=f"Acceptance {name}",
                profile=profile,
                paths=ProjectPathConfig(
                    frontend=frontend,
                    backend=backend,
                    tauri=tauri_root,
                    docs=docs,
                ),
            )
        )
        write("project-tooling.toml", rendered)

    if name == "empty":
        return ()
    if name == "vite":
        vite()
    elif name == "fastapi":
        fastapi()
    elif name == "tauri":
        tauri()
    elif name == "persisted-desktop-local":
        vite()
        tauri()
        config("desktop-local")
    elif name == "persisted-web-cloud":
        vite()
        fastapi()
        write("compose.yaml", "services:\n  api:\n    image: acceptance-api\n")
        config("web-cloud", backend="backend")
    elif name == "persisted-full-platform":
        vite()
        fastapi()
        tauri()
        write("compose.yaml", "services:\n  app:\n    image: acceptance-app\n")
        config("full-platform", backend="backend")
    elif name == "custom-paths-desktop-cloud":
        vite("client-app")
        fastapi("services/api")
        tauri("desktop/native")
        write("infra/local/compose.yaml", "services:\n  api:\n    image: custom-api\n")
        config(
            "desktop-cloud",
            frontend="client-app",
            backend="services/api",
            tauri_root="desktop/native",
            docs="handbook",
        )
    elif name == "unknown-extra-files":
        write(".gitignore", "dist/\ncustomer-cache/\n")
        write("customer-data/opaque.bin", b"\x00customer\xffpayload")
        write("notes/decisions.txt", "This is product-owned and unknown.\n")
        write("assets/raw.dat", b"\x10\x20\x30\x40")
        write(
            ".github/workflows/customer.yml",
            "name: Customer workflow\non: [push]\njobs:\n"
            "  custom:\n    runs-on: ubuntu-latest\n"
            "    steps:\n      - run: echo customer-owned\n",
        )
    else:  # pragma: no cover - CASES is the closed fixture registry
        raise AssertionError(f"Unknown copy fixture: {name}")
    return tuple(paths)


def _copy_portable_runtime(root: Path, case: CopyCase) -> None:
    shutil.copytree(
        SOURCE_TOOLS,
        root / "tools",
        symlinks=True,
        ignore=_portable_ignore,
    )
    docs_parent = root / (
        "handbook" if case.name == "custom-paths-desktop-cloud" else "docs"
    )
    shutil.copytree(
        SOURCE_DOCS,
        docs_parent,
        symlinks=True,
        ignore=_portable_ignore,
    )


def _portable_ignore(directory: str, names: list[str]) -> set[str]:
    parent = Path(directory)
    relative_parent = parent.relative_to(REPOSITORY_ROOT)
    ignored: set[str] = set()
    for name in names:
        relative = relative_parent / name
        if _is_portable_artifact(relative):
            ignored.add(name)
    return ignored


def _is_portable_artifact(relative: Path) -> bool:
    original_relative = PurePosixPath(relative.as_posix())
    folded_relative = PurePosixPath(
        *(part.casefold() for part in original_relative.parts)
    )
    name = folded_relative.name
    return (
        name in _CACHE_OR_RUNTIME_DIRECTORIES
        or name.endswith(".egg-info")
        or (
            name == "dist"
            and original_relative != PurePosixPath("tools/quality/rust_analyzer/dist")
        )
        or (name == "build" and original_relative != PurePosixPath("tools/tauri/build"))
        or name in {"generated", "output"}
        or name in _IGNORED_FILE_NAMES
        or relative.suffix.casefold() in _IGNORED_SUFFIXES
        or name.startswith(".coverage.")
    )


def _assert_portable_copy_is_clean(root: Path) -> None:
    copied_wasm = root / RUST_ANALYZER_WASM
    assert (
        copied_wasm.read_bytes() == (REPOSITORY_ROOT / RUST_ANALYZER_WASM).read_bytes()
    )
    assert tuple(sorted(path.name for path in copied_wasm.parent.iterdir())) == (
        copied_wasm.name,
    )
    artifacts: list[str] = []
    for top_level in (root / "tools", root / "docs", root / "handbook"):
        if not top_level.exists():
            continue
        for directory, names, files in os.walk(top_level, followlinks=False):
            parent = Path(directory)
            for name in (*names, *files):
                relative = (parent / name).relative_to(root)
                if _is_portable_artifact(relative):
                    artifacts.append(relative.as_posix())
    assert artifacts == []


def _run_command(
    root: Path,
    *arguments: str,
    expected_returncode: int,
    timeout: int = 60,
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment.pop("PYTHONPYCACHEPREFIX", None)
    for key in tuple(environment):
        if key.startswith("GIT_"):
            environment.pop(key)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    environment["PYTHONHASHSEED"] = "0"
    environment["PYTHONNOUSERSITE"] = "1"
    completed = subprocess.run(
        [sys.executable, "tools/control.py", *arguments],
        cwd=root,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    assert completed.returncode == expected_returncode, (
        f"command {arguments!r} returned {completed.returncode}\n"
        f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
    )
    return completed


def _initialize_clean_git(root: Path, case: CopyCase) -> bool:
    git = shutil.which("git")
    if case.name != "persisted-desktop-local":
        return False
    assert git is not None, "git is required to exercise the clean-worktree preflight"
    environment = os.environ.copy()
    for key in tuple(environment):
        if key.startswith("GIT_"):
            environment.pop(key)
    environment["GIT_CONFIG_NOSYSTEM"] = "1"
    environment["GIT_CONFIG_GLOBAL"] = os.devnull
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    base = (
        git,
        "-c",
        "commit.gpgSign=false",
        "-c",
        "tag.gpgSign=false",
        "-c",
        f"core.hooksPath={os.devnull}",
        "-c",
        "user.email=acceptance@example.invalid",
        "-c",
        "user.name=Acceptance Test",
    )
    commands = (
        (*base, "init", "-q"),
        (*base, "add", "-A"),
        (*base, "commit", "-qm", "acceptance baseline"),
    )
    for command in commands:
        completed = subprocess.run(
            command,
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
            env=environment,
        )
        assert completed.returncode == 0, (
            f"git setup failed: {command!r}\n"
            f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        )
    status = subprocess.run(
        [*base, "status", "--porcelain", "--untracked-files=all"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
        env=environment,
    )
    assert status.returncode == 0 and status.stdout == ""
    return True


def _run_json(
    root: Path,
    *arguments: str,
    expected_returncode: int,
    timeout: int = 60,
) -> dict[str, Any]:
    completed = _run_command(
        root,
        *arguments,
        expected_returncode=expected_returncode,
        timeout=timeout,
    )
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"command {arguments!r} did not emit JSON\n"
            f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        ) from exc
    assert isinstance(payload, dict)
    return payload


def _assert_integrated(payload: dict[str, Any], *, expected_profile: str) -> None:
    assert payload["status"] == "INTEGRATED"
    assert payload["profile"]["id"] == expected_profile
    assert payload["plan"]["status"] == "INTEGRATED"
    assert payload["plan"]["required_changes"] == 0
    assert payload["plan"]["conflicts"] == []
    assert payload["verification"]["ok"] is True


def _assert_persisted_config(root: Path, case: CopyCase) -> None:
    payload = tomllib.loads((root / "project-tooling.toml").read_text(encoding="utf-8"))
    state = tomllib.loads(
        (root / ".tooling-state" / "state.toml").read_text(encoding="utf-8")
    )
    assert payload["tooling"]["version"] == TOOLING_VERSION
    assert payload["project"]["profile"] == case.expected_profile
    assert payload["paths"] == dict(case.expected_config_paths)
    assert state["tooling_version"] == TOOLING_VERSION
    assert state["applied_migrations"] == []


def _product_digests(
    root: Path,
    paths: tuple[str, ...],
    *,
    excluded: frozenset[str] = frozenset(),
) -> dict[str, str]:
    return {
        relative: hashlib.sha256((root / relative).read_bytes()).hexdigest()
        for relative in sorted(paths)
        if relative not in excluded
    }


def _project_owned_digests(root: Path, case: CopyCase) -> dict[str, str]:
    documentation_root = (
        "handbook" if case.name == "custom-paths-desktop-cloud" else "docs"
    )
    excluded_roots = {".git", ".tooling-state", "tools", documentation_root}
    structured_paths = frozenset(_package_payloads(root, case))
    return {
        relative: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
        and not path.is_symlink()
        and (relative := path.relative_to(root).as_posix()) != "project-tooling.toml"
        and relative not in structured_paths
        and relative.split("/", maxsplit=1)[0] not in excluded_roots
    }


def _package_payloads(root: Path, case: CopyCase) -> dict[str, dict[str, Any]]:
    frontend = dict(case.expected_config_paths)["frontend"]
    relative = (
        "package.json"
        if frontend == "."
        else (PurePosixPath(frontend) / "package.json").as_posix()
    )
    target = root / relative
    if not target.is_file() or target.is_symlink():
        return {}
    payload = json.loads(target.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return {relative: payload}


def _assert_package_integration(
    root: Path,
    before: dict[str, dict[str, Any]],
) -> None:
    after = {
        relative: json.loads((root / relative).read_text(encoding="utf-8"))
        for relative in before
    }
    for relative, original in before.items():
        expected = copy.deepcopy(original)
        dependencies = {
            **(
                expected.get("dependencies", {})
                if isinstance(expected.get("dependencies"), dict)
                else {}
            ),
            **(
                expected.get("devDependencies", {})
                if isinstance(expected.get("devDependencies"), dict)
                else {}
            ),
        }
        scripts = expected.setdefault("scripts", {})
        assert isinstance(scripts, dict)
        if "vite" in dependencies:
            scripts.setdefault("dev", "vite")
            scripts.setdefault("build", "vite build")
        conditional = {
            "eslint": ("lint", "eslint ."),
            "prettier": ("format:check", "prettier --check ."),
            "typescript": ("typecheck", "tsc --noEmit"),
            "vitest": ("test", "vitest run"),
            "@playwright/test": ("test:e2e", "playwright test"),
            "@tauri-apps/cli": ("tauri", "tauri"),
        }
        for dependency, (name, command) in conditional.items():
            if dependency in dependencies:
                scripts.setdefault(name, command)
        assert after[relative] == expected, relative


def _snapshot_tree(root: Path) -> dict[str, TreeEntry]:
    entries: dict[str, TreeEntry] = {}

    def record(path: Path) -> None:
        metadata = path.lstat()
        relative = "." if path == root else path.relative_to(root).as_posix()
        mode = stat.S_IMODE(metadata.st_mode)
        if stat.S_ISLNK(metadata.st_mode):
            entries[relative] = TreeEntry(
                "symlink",
                mode,
                metadata.st_mtime_ns,
                os.readlink(path),
            )
        elif stat.S_ISREG(metadata.st_mode):
            entries[relative] = TreeEntry(
                "file",
                mode,
                metadata.st_mtime_ns,
                path.read_bytes(),
            )
        elif stat.S_ISDIR(metadata.st_mode):
            entries[relative] = TreeEntry(
                "directory",
                mode,
                metadata.st_mtime_ns,
                None,
            )
        else:
            entries[relative] = TreeEntry(
                "other",
                mode,
                metadata.st_mtime_ns,
                None,
            )

    record(root)
    for directory, names, files in os.walk(root, followlinks=False):
        names.sort()
        files.sort()
        parent = Path(directory)
        for name in (*names, *files):
            record(parent / name)
    return entries


def _report_directories(root: Path) -> tuple[str, ...]:
    reports = root / ".tooling-state" / "reports"
    if not reports.exists():
        return ()
    return tuple(
        path.name
        for path in sorted(reports.iterdir())
        if path.is_dir() and not path.is_symlink()
    )
