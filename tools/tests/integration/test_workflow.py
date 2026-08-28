from __future__ import annotations

import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path

import pytest

from tools.core.portable_payload import write_portable_payload_manifest
from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    render_project_config,
)
from tools.integration import service, workflow
from tools.integration.model import (
    Finding,
    FindingStatus,
    IntegrationError,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)

TOOLS_SOURCE = Path(__file__).resolve().parents[2]
TOOLING_VERSION = (TOOLS_SOURCE / "VERSION").read_text(encoding="utf-8").strip()


@dataclass(frozen=True, slots=True)
class _TreeEntry:
    kind: str
    mode: int
    modified_ns: int
    payload: bytes | str | None


def _portable_project(
    tmp_path: Path, name: str = "target-project"
) -> tuple[Path, Path]:
    root = tmp_path / name
    tools = root / "tools"
    (tools / "quality").mkdir(parents=True)
    (tools / "tests").mkdir()
    (tools / "quality" / "__init__.py").write_text("", encoding="utf-8")
    (tools / "tests" / "__init__.py").write_text("", encoding="utf-8")
    shutil.copy2(TOOLS_SOURCE / "VERSION", tools / "VERSION")
    shutil.copytree(
        TOOLS_SOURCE / "resources" / "profiles",
        tools / "resources" / "profiles",
    )
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    (docs / "index.md").write_text("# Portable tooling\n", encoding="utf-8")
    _seal_payload(root, tools)
    return root, tools


def _copy_cli_runtime(tmp_path: Path) -> tuple[Path, Path]:
    root = tmp_path / "copied-cli-project"
    tools = root / "tools"
    tools.mkdir(parents=True)
    for name in ("__init__.py", "control.py", "process.py", "VERSION"):
        shutil.copy2(TOOLS_SOURCE / name, tools / name)
    for name in ("adapters", "core", "integration", "profiles", "resources"):
        shutil.copytree(
            TOOLS_SOURCE / name,
            tools / name,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"),
        )
    for name in ("quality", "tests"):
        directory = tools / name
        directory.mkdir()
        (directory / "__init__.py").write_text("", encoding="utf-8")
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    (docs / "index.md").write_text("# Portable tooling\n", encoding="utf-8")
    _seal_payload(root, tools)
    return root, tools


def _seal_payload(root: Path, tools: Path) -> None:
    write_portable_payload_manifest(
        project_root=root,
        tools_root=tools,
        docs_root=root / "docs" / "toolingdocs",
        tooling_version=(tools / "VERSION").read_text(encoding="utf-8").strip(),
    )


def _write(path: Path, content: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content, encoding="utf-8")


def _write_config(
    root: Path,
    *,
    profile: str = "web-only",
    tooling_version: str = TOOLING_VERSION,
    frontend: str = "frontend",
    backend: str = "",
    tauri: str = "src-tauri",
    docs: str = "docs",
) -> ProjectConfig:
    config = ProjectConfig(
        tooling_version=tooling_version,
        project_name="Persisted project",
        profile=profile,
        paths=ProjectPathConfig(
            frontend=frontend,
            backend=backend,
            tauri=tauri,
            docs=docs,
        ),
    )
    _write(root / "project-tooling.toml", render_project_config(config))
    return config


def _vite(root: Path) -> None:
    _write(
        root / "package.json",
        json.dumps({"devDependencies": {"vite": "^7.0.0"}}) + "\n",
    )


def _fastapi(root: Path) -> None:
    _write(
        root / "app" / "main.py",
        "from fastapi import FastAPI\n\napp = FastAPI()\n",
    )
    _write(root / "requirements.txt", "fastapi>=0.116\n")


def _tauri(root: Path) -> None:
    _write(root / "Cargo.toml", '[package]\nname = "desktop"\n')
    _write(root / "tauri.conf.json", "{}\n")


def _snapshot(root: Path) -> dict[str, _TreeEntry]:
    entries: dict[str, _TreeEntry] = {}

    def record(path: Path) -> None:
        metadata = path.lstat()
        relative = "." if path == root else path.relative_to(root).as_posix()
        mode = stat.S_IMODE(metadata.st_mode)
        if stat.S_ISLNK(metadata.st_mode):
            entries[relative] = _TreeEntry(
                "symlink", mode, metadata.st_mtime_ns, os.readlink(path)
            )
        elif stat.S_ISREG(metadata.st_mode):
            entries[relative] = _TreeEntry(
                "file", mode, metadata.st_mtime_ns, path.read_bytes()
            )
        elif stat.S_ISDIR(metadata.st_mode):
            # Git may update internal directory mtimes while performing a
            # read-only status check. File content and membership still catch
            # every persistent write that matters to this snapshot assertion.
            entries[relative] = _TreeEntry("directory", mode, 0, None)
        else:
            entries[relative] = _TreeEntry("other", mode, metadata.st_mtime_ns, None)

    record(root)
    for directory, names, files in os.walk(root, followlinks=False):
        names.sort()
        files.sort()
        base = Path(directory)
        for name in (*names, *files):
            record(base / name)
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


def test_configless_check_full_fix_check_and_second_full_fix_are_idempotent(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    opaque = root / "customer-data" / "opaque.bin"
    source = root / "frontend" / "src" / "main.ts"
    _write(opaque, b"\x00customer\xffpayload")
    _write(source, "export const customerOwned = true;\n")
    product_hashes = {
        path: hashlib.sha256(path.read_bytes()).hexdigest() for path in (opaque, source)
    }
    before_check = _snapshot(root)

    initial = workflow.assess_project(root, tools_root=tools)

    assert initial.config_source == "detected"
    assert initial.plan.status == "FIX_REQUIRED"
    assert {operation.path for operation in initial.plan.operations} == {
        ".tooling-state/state.toml",
        "project-tooling.toml",
    }
    assert _snapshot(root) == before_check

    first = workflow.run_full_fix(root, tools_root=tools)
    integrated = workflow.assess_project(root, tools_root=tools)

    assert first.changed is True
    assert first.actions == ()
    assert first.result.ok
    assert first.result.report_path is not None
    assert integrated.plan.is_noop
    assert integrated.verification.ok
    assert _report_directories(root)
    assert {
        path: hashlib.sha256(path.read_bytes()).hexdigest() for path in (opaque, source)
    } == product_hashes

    before_noop = _snapshot(root)
    reports_before = _report_directories(root)
    second = workflow.run_full_fix(root, tools_root=tools)

    assert second.changed is False
    assert second.actions == ()
    assert second.result.report_path is None
    assert _snapshot(root) == before_noop
    assert _report_directories(root) == reports_before


def test_full_fix_fails_closed_when_staged_tooling_actions_fail(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, tools = _portable_project(tmp_path)
    assessment = workflow.assess_project(root, tools_root=tools)
    guarded_plan = replace(
        assessment.plan,
        operations=(
            *assessment.plan.operations,
            Operation(
                OperationKind.ADD,
                "tools/generated_runtime.py",
                Ownership.TOOLING,
                b"VALUE = 1\n",
            ),
        ),
    )
    guarded = replace(assessment, plan=guarded_plan)
    monkeypatch.setattr(workflow, "assess_project", lambda *_args, **_kwargs: guarded)

    with pytest.raises(
        IntegrationError,
        match="Staged action verification failed; target remains unchanged",
    ):
        workflow.run_full_fix(root, tools_root=tools)

    assert not (root / "project-tooling.toml").exists()
    assert not (root / ".tooling-state" / "state.toml").exists()
    assert _report_directories(root)
    assert not (tools / "generated_runtime.py").exists()


def test_frontend_script_patch_plans_quality_tests_and_real_build(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    _vite(root / "frontend")

    assessment = workflow.assess_project(root, tools_root=tools)
    requirements = dict(workflow._plan_action_requirements(assessment))

    assert requirements["frontend/package.json"] == ("quality", "tests", "build")
    assert "dependencies" not in requirements["frontend/package.json"]
    assert assessment.structured_key_allowlist == {
        "frontend/package.json": frozenset(
            {
                "scripts.build",
                "scripts.dev",
                "scripts.format:check",
                "scripts.lint",
                "scripts.tauri",
                "scripts.test",
                "scripts.test:e2e",
                "scripts.typecheck",
            }
        )
    }


def test_dependency_key_patch_plans_all_transactional_action_kinds(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    assessment = workflow.assess_project(root, tools_root=tools)
    dependency_plan = replace(
        assessment.plan,
        operations=(
            Operation(
                OperationKind.PATCH,
                "frontend/package.json",
                Ownership.STRUCTURED,
                expected_sha256="a" * 64,
                structured_changes=(
                    StructuredChange("devDependencies.vitest", "^3.0.0"),
                ),
            ),
        ),
    )

    requirements = dict(
        workflow._plan_action_requirements(replace(assessment, plan=dependency_plan))
    )

    assert requirements == {
        "frontend/package.json": ("dependencies", "quality", "tests", "build")
    }


def test_invalid_initial_tooling_source_fails_before_any_mutation(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    _write(tools / "broken.py", "def broken(:\n")
    before = _snapshot(root)

    assessment = workflow.assess_project(root, tools_root=tools)

    assert any(
        finding.check == "tooling-python-syntax"
        and finding.status is FindingStatus.FAIL
        and finding.path == "tools/broken.py"
        for finding in assessment.verification.findings
    )
    with pytest.raises(
        IntegrationError,
        match="Tooling Python source validation failed before mutation",
    ):
        workflow.run_full_fix(root, tools_root=tools)

    assert _snapshot(root) == before
    assert not (root / "project-tooling.toml").exists()
    assert not (root / ".tooling-state").exists()


@pytest.mark.parametrize(
    ("relative", "content"),
    (
        ("tools/customer_change.py", "VALUE = 'changed'\n"),
        ("docs/toolingdocs/customer-change.md", "changed\n"),
    ),
)
def test_existing_state_never_rebaselines_unexplained_managed_tree_changes(
    tmp_path: Path,
    relative: str,
    content: str,
) -> None:
    root, tools = _portable_project(tmp_path)
    workflow.run_full_fix(root, tools_root=tools)
    _write(root / relative, content)
    before = _snapshot(root)
    state_before = (root / ".tooling-state" / "state.toml").read_bytes()

    assessment = workflow.assess_project(root, tools_root=tools)

    assert any(
        conflict.code == "unverified-managed-tree"
        for conflict in assessment.plan.conflicts
    )
    assert all(
        operation.path != ".tooling-state/state.toml"
        for operation in assessment.plan.operations
    )
    with pytest.raises(IntegrationError, match="Integration plan contains conflicts"):
        workflow.run_full_fix(root, tools_root=tools)

    assert _snapshot(root) == before
    assert (root / ".tooling-state" / "state.toml").read_bytes() == state_before


@pytest.mark.parametrize("change", ("mutate", "delete"))
def test_existing_state_tracks_versioned_runtime_below_protected_dist(
    tmp_path: Path,
    change: str,
) -> None:
    root, tools = _portable_project(tmp_path)
    runtime = (
        tools / "quality" / "rust_analyzer" / "dist" / "rust_quality_analyzer.wasm"
    )
    _write(runtime, b"\x00asm-version-one")
    _seal_payload(root, tools)
    workflow.run_full_fix(root, tools_root=tools)
    state = root / ".tooling-state" / "state.toml"
    state_before = state.read_bytes()
    if change == "mutate":
        _write(runtime, b"\x00asm-version-two")
    else:
        runtime.unlink()
    before = _snapshot(root)

    assessment = workflow.assess_project(root, tools_root=tools)

    assert any(
        conflict.code == "unverified-managed-tree"
        for conflict in assessment.plan.conflicts
    )
    assert not assessment.verification.ok
    assert all(
        operation.path != ".tooling-state/state.toml"
        for operation in assessment.plan.operations
    )
    with pytest.raises(IntegrationError, match="Integration plan contains conflicts"):
        workflow.run_full_fix(root, tools_root=tools)

    assert _snapshot(root) == before
    assert state.read_bytes() == state_before


def test_real_copied_cli_check_is_byte_for_byte_read_only_without_env_guard(
    tmp_path: Path,
) -> None:
    root, _tools = _copy_cli_runtime(tmp_path)
    before = _snapshot(root)
    environment = os.environ.copy()
    environment.pop("PYTHONDONTWRITEBYTECODE", None)
    environment.pop("PYTHONPYCACHEPREFIX", None)

    completed = subprocess.run(
        [sys.executable, "tools/control.py", "integrate", "--check", "--json"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        env=environment,
        timeout=30,
    )

    assert completed.returncode == 1
    assert json.loads(completed.stdout)["status"] == "FIX_REQUIRED"
    assert completed.stderr == ""
    assert _snapshot(root) == before
    assert not list(root.rglob("__pycache__"))


def test_real_copied_cli_reports_unsafe_config_without_import_traceback(
    tmp_path: Path,
) -> None:
    root, _tools = _copy_cli_runtime(tmp_path)
    external = tmp_path / "external-config.toml"
    external.write_text("secret = true\n", encoding="utf-8")
    try:
        (root / "project-tooling.toml").symlink_to(external)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"symlinks are unavailable: {exc}")
    before = _snapshot(root)

    completed = subprocess.run(
        [sys.executable, "tools/control.py", "integrate", "--check", "--json"],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )

    assert completed.returncode == 1
    assert json.loads(completed.stdout)["status"] == "FAILED"
    assert completed.stderr == ""
    assert _snapshot(root) == before
    assert external.read_text(encoding="utf-8") == "secret = true\n"


def test_persisted_full_platform_and_custom_paths_win_over_discovery(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    _vite(root / "apps" / "client")
    _fastapi(root / "services" / "catalog")
    _tauri(root / "desktop" / "native")
    _write(root / "infra" / "compose.yaml", "services: {}\n")
    (root / "handbook" / "toolingdocs").mkdir(parents=True)
    _write_config(
        root,
        profile="full-platform",
        frontend="apps/client",
        backend="services/catalog",
        tauri="desktop/native",
        docs="handbook",
    )

    assessment = workflow.assess_project(root, tools_root=tools)

    assert assessment.config_source == "persisted"
    assert assessment.profile.profile_id == "full-platform"
    assert assessment.discovery.suggested_profile == "desktop-cloud"
    assert assessment.context.paths.frontend == root / "apps" / "client"
    assert assessment.context.paths.backend == root / "services" / "catalog"
    assert assessment.context.paths.tauri == root / "desktop" / "native"
    assert assessment.context.docs_root == root / "handbook" / "toolingdocs"
    assert "takes precedence" in assessment.notices[0]


def test_configless_root_level_technologies_produce_a_safe_plan(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    _vite(root)
    _fastapi(root)
    _tauri(root)

    assessment = workflow.assess_project(root, tools_root=tools)

    assert assessment.discovery.paths.frontend == "."
    assert assessment.discovery.paths.backend == "."
    assert assessment.discovery.paths.tauri == "."
    assert assessment.profile.profile_id == "desktop-cloud"
    assert assessment.context.config.paths.frontend == "."
    assert assessment.context.config.paths.backend == "."
    assert assessment.context.config.paths.tauri == "."
    assert not assessment.plan.conflicts


def test_dirty_real_git_worktree_is_rejected_without_writes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    if shutil.which("git") is None:
        pytest.skip("git is unavailable")
    root, tools = _portable_project(tmp_path)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "add", "-A"], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(root),
            "-c",
            "user.name=Tooling Tests",
            "-c",
            "user.email=tooling@example.invalid",
            "commit",
            "-qm",
            "fixture",
        ],
        check=True,
    )
    _write(root / "uncommitted-customer-note.txt", "do not touch\n")
    monkeypatch.setenv("GIT_DIR", str(tmp_path / "redirected.git"))
    monkeypatch.setenv("GIT_WORK_TREE", str(tmp_path / "redirected-worktree"))
    monkeypatch.setenv("GIT_INDEX_FILE", str(tmp_path / "redirected.index"))
    monkeypatch.setenv("GIT_CONFIG_COUNT", "1")
    monkeypatch.setenv("GIT_CONFIG_KEY_0", "commit.gpgSign")
    monkeypatch.setenv("GIT_CONFIG_VALUE_0", "true")
    before = _snapshot(root)

    with pytest.raises(IntegrationError, match="worktree is not clean"):
        workflow.run_full_fix(root, tools_root=tools)

    assert _snapshot(root) == before
    assert not (root / "project-tooling.toml").exists()
    assert not (root / ".tooling-state").exists()


@pytest.mark.parametrize("unsafe_kind", ("malformed", "symlink"))
def test_malformed_or_symlinked_project_config_fails_without_writes(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    unsafe_kind: str,
) -> None:
    root, tools = _portable_project(tmp_path)
    external = tmp_path / "external-config.toml"
    external.write_text(
        render_project_config(ProjectConfig(TOOLING_VERSION, "External", "web-only")),
        encoding="utf-8",
    )
    config = root / "project-tooling.toml"
    if unsafe_kind == "malformed":
        config.write_text("schema_version = [\n", encoding="utf-8")
    else:
        try:
            config.symlink_to(external)
        except (NotImplementedError, OSError) as exc:
            pytest.skip(f"symlinks are unavailable: {exc}")
    before = _snapshot(root)
    external_before = external.read_bytes()

    code = service.run_check(
        json_output=True,
        project_root=root,
        tools_root=tools,
    )
    payload = json.loads(capsys.readouterr().out)

    assert code == 1
    assert payload["status"] == "FAILED"
    assert _snapshot(root) == before
    assert external.read_bytes() == external_before
    assert not (root / ".tooling-state").exists()


@pytest.mark.parametrize("unsafe_kind", ("malformed", "symlink"))
def test_malformed_or_symlinked_tooling_state_is_a_nonmutating_conflict(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    unsafe_kind: str,
) -> None:
    root, tools = _portable_project(tmp_path)
    _write_config(root)
    state_root = root / ".tooling-state"
    state_root.mkdir()
    state = state_root / "state.toml"
    external = tmp_path / "external-state.toml"
    external.write_text("outside = true\n", encoding="utf-8")
    if unsafe_kind == "malformed":
        state.write_text("schema_version = [\n", encoding="utf-8")
    else:
        try:
            state.symlink_to(external)
        except (NotImplementedError, OSError) as exc:
            pytest.skip(f"symlinks are unavailable: {exc}")
    before = _snapshot(root)
    external_before = external.read_bytes()

    code = service.run_check(
        json_output=True,
        project_root=root,
        tools_root=tools,
    )
    payload = json.loads(capsys.readouterr().out)

    assert code == 1
    assert payload["status"] == "CONFLICT"
    assert payload["plan"]["conflicts"]
    assert _snapshot(root) == before
    assert external.read_bytes() == external_before


def test_tooling_version_patch_preserves_unknown_toml_keys_and_comments(
    tmp_path: Path,
) -> None:
    root, tools = _portable_project(tmp_path)
    config = root / "project-tooling.toml"
    config.write_text(
        """schema_version = 1

[tooling]
version = "0.0.1"  # keep-version-comment
vendor_channel = "customer-owned"

[project]
name = "Persisted project"
profile = "web-only"

[paths]
frontend = "frontend"
backend = ""
tauri = "src-tauri"
docs = "docs"

[features]
optional = []

[customer]
opaque = "preserve-me"
""",
        encoding="utf-8",
    )

    applied = workflow.run_full_fix(root, tools_root=tools)
    rendered = config.read_text(encoding="utf-8")

    assert applied.changed is True
    assert f'version = "{TOOLING_VERSION}"  # keep-version-comment' in rendered
    assert 'vendor_channel = "customer-owned"' in rendered
    assert '[customer]\nopaque = "preserve-me"' in rendered
    assert workflow.assess_project(root, tools_root=tools).plan.is_noop


def test_failed_staged_action_leaves_config_and_state_unchanged(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, tools = _portable_project(tmp_path)
    unknown = root / "customer-owned.bin"
    unknown.write_bytes(b"unchanged")
    monkeypatch.setattr(
        workflow, "_planned_action_specs", lambda _assessment: (object(),)
    )

    def failing_runner(_specs: object):
        def fail(_staging: Path) -> VerificationResult:
            return VerificationResult(
                (
                    Finding(
                        "transaction-action:quality",
                        FindingStatus.FAIL,
                        "synthetic staged action failure",
                        adapter="transaction-actions",
                    ),
                )
            )

        return fail

    monkeypatch.setattr(workflow, "ActionRunner", failing_runner)

    with pytest.raises(IntegrationError, match="Staged action verification failed"):
        workflow.run_full_fix(root, tools_root=tools)

    assert unknown.read_bytes() == b"unchanged"
    assert not (root / "project-tooling.toml").exists()
    assert not (root / ".tooling-state" / "state.toml").exists()
    assert _report_directories(root)


def test_json_output_shape_and_exit_codes_cover_fix_and_integrated_states(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root, tools = _portable_project(tmp_path)

    assert (
        service.run_check(
            json_output=True,
            project_root=root,
            tools_root=tools,
        )
        == 1
    )
    fix_payload = json.loads(capsys.readouterr().out)

    assert fix_payload["schema_version"] == 1
    assert fix_payload["action"] == "integrate-check"
    assert fix_payload["status"] == "FIX_REQUIRED"
    assert fix_payload["config_source"] == "detected"
    assert fix_payload["plan"]["required_changes"] == 2
    assert fix_payload["verification"]["status"] == "FAIL"
    assert set(fix_payload) >= {
        "actions",
        "detection",
        "notices",
        "profile",
        "project_root",
        "report_path",
        "tooling_version",
    }

    assert (
        service.run_full_fix(
            json_output=True,
            project_root=root,
            tools_root=tools,
        )
        == 0
    )
    applied_payload = json.loads(capsys.readouterr().out)
    assert applied_payload["status"] == "INTEGRATED"
    assert applied_payload["report_path"] is not None
    assert applied_payload["actions"] == []

    assert (
        service.run_check(
            json_output=True,
            project_root=root,
            tools_root=tools,
        )
        == 0
    )
    integrated_payload = json.loads(capsys.readouterr().out)
    assert integrated_payload["status"] == "INTEGRATED"
    assert integrated_payload["plan"]["required_changes"] == 0
    assert integrated_payload["verification"]["status"] == "PASS"
