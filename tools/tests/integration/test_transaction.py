from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pytest

from tools.integration import transaction as transaction_module
from tools.integration.actions import ActionKind, ActionRunner, ActionSpec
from tools.integration.model import (
    Conflict,
    Finding,
    FindingStatus,
    IntegrationError,
    IntegrationPlan,
    Operation,
    OperationKind,
    Ownership,
    StructuredChange,
    VerificationResult,
)
from tools.integration.transaction import TransactionRequest, apply_transaction


def _digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _verification(passing: bool = True) -> VerificationResult:
    return VerificationResult(
        (
            Finding(
                "transaction-fixture",
                FindingStatus.PASS if passing else FindingStatus.FAIL,
                "fixture verification",
            ),
        )
    )


def _project(tmp_path: Path) -> Path:
    root = tmp_path / "project"
    root.mkdir()
    return root


def _apply(
    root: Path,
    plan: IntegrationPlan,
    verifier=lambda _root: _verification(),
    *,
    finalizer=None,
    staged_action=None,
    structured_key_allowlist=None,
):
    return apply_transaction(
        TransactionRequest(
            root,
            plan,
            verifier,
            report_finalizer=finalizer,
            staged_action=staged_action,
            structured_key_allowlist=structured_key_allowlist or {},
        )
    )


def test_transaction_stages_journals_and_commits_tooling_state_last(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    old = b"old tooling\n"
    managed = root / "tools/managed.txt"
    managed.write_bytes(old)
    managed.chmod(0o755)
    original_mode = managed.stat().st_mode & 0o777
    plan = IntegrationPlan(
        profile="web-only",
        desired_features=("quality",),
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"new tooling\n",
                _digest(old),
            ),
            Operation(
                OperationKind.ADD,
                "tools/nested/new.txt",
                Ownership.TOOLING,
                b"new file\n",
                None,
            ),
            Operation(
                OperationKind.ADD,
                ".tooling-state/state.json",
                Ownership.TOOLING,
                b"{}\n",
                None,
            ),
        ),
    )
    replacements: list[str] = []
    verification_roots: list[Path] = []
    original_replace = transaction_module._replace_from_frozen

    def recording_replace(target: Path, relative: str, frozen) -> None:
        if target == root:
            replacements.append(relative)
        original_replace(target, relative, frozen)

    def verifier(target: Path) -> VerificationResult:
        verification_roots.append(target)
        return _verification()

    monkeypatch.setattr(transaction_module, "_replace_from_frozen", recording_replace)
    result = _apply(root, plan, verifier)

    assert result.ok
    assert result.applied_operations == plan.operations
    assert (root / "tools/managed.txt").read_bytes() == b"new tooling\n"
    assert (root / "tools/managed.txt").stat().st_mode & 0o777 == original_mode
    assert (root / "tools/nested/new.txt").read_bytes() == b"new file\n"
    assert (root / ".tooling-state/state.json").read_bytes() == b"{}\n"
    assert replacements[-1] == ".tooling-state/state.json"
    assert len(verification_roots) == 2
    assert verification_roots[-1] == root
    journal = json.loads(
        (root / ".tooling-state/reports/journal.json").read_text(encoding="utf-8")
    )
    assert journal["profile"] == "web-only"
    assert {entry["path"] for entry in journal["files"]} == {
        "tools/managed.txt",
        "tools/nested/new.txt",
        ".tooling-state/state.json",
    }


def test_preimage_change_is_detected_before_staging_or_reporting(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    path = root / "tools/managed.txt"
    path.write_bytes(b"changed after planning\n")
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"incoming\n",
                "0" * 64,
            ),
        )
    )

    with pytest.raises(IntegrationError, match="changed after planning"):
        _apply(root, plan)

    assert path.read_bytes() == b"changed after planning\n"
    assert not (root / ".tooling-state").exists()


def test_staged_verification_failure_leaves_target_untouched(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    old = b"old\n"
    path = root / "tools/managed.txt"
    path.write_bytes(old)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"new\n",
                _digest(old),
            ),
        )
    )

    with pytest.raises(
        IntegrationError, match="Staged integration verification failed"
    ):
        _apply(root, plan, lambda _root: _verification(False))

    assert path.read_bytes() == old
    assert not (root / ".tooling-state").exists()


def test_staged_action_runs_before_verification_and_live_mutation(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    events: list[str] = []
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"after\n",
                _digest(before),
            ),
        )
    )

    def staged_action(staging: Path) -> VerificationResult:
        assert staging != root
        assert (staging / "tools/managed.txt").read_bytes() == b"after\n"
        assert managed.read_bytes() == before
        events.append("action")
        return VerificationResult(
            (
                Finding(
                    "staged-action",
                    FindingStatus.PASS,
                    "isolated action passed",
                ),
            )
        )

    def verifier(target: Path) -> VerificationResult:
        events.append("verify-live" if target == root else "verify-staging")
        return _verification()

    result = _apply(root, plan, verifier, staged_action=staged_action)

    assert events == ["action", "verify-staging", "verify-live"]
    assert managed.read_bytes() == b"after\n"
    assert tuple(finding.check for finding in result.verification.findings) == (
        "staged-action",
        "transaction-fixture",
    )


def test_failed_staged_action_leaves_live_project_unchanged(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    verifier_calls = 0
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"after\n",
                _digest(before),
            ),
        )
    )

    def staged_action(staging: Path) -> VerificationResult:
        (staging / "action-artifact.txt").write_text("temporary\n", encoding="utf-8")
        return VerificationResult(
            (
                Finding(
                    "staged-action",
                    FindingStatus.FAIL,
                    "isolated action failed",
                ),
            )
        )

    def verifier(_target: Path) -> VerificationResult:
        nonlocal verifier_calls
        verifier_calls += 1
        return _verification()

    with pytest.raises(
        IntegrationError,
        match="staged-action: isolated action failed",
    ):
        _apply(root, plan, verifier, staged_action=staged_action)

    assert verifier_calls == 0
    assert managed.read_bytes() == before
    assert not (root / "action-artifact.txt").exists()
    assert not (root / ".tooling-state").exists()


def test_successful_staged_action_artifacts_are_never_published(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"managed\n",
            ),
        )
    )

    def staged_action(staging: Path) -> VerificationResult:
        (staging / "node_modules").mkdir()
        (staging / "node_modules/dependency.js").write_text(
            "temporary\n", encoding="utf-8"
        )
        (staging / "tools/action-cache.bin").write_bytes(b"temporary")
        return _verification()

    result = _apply(root, plan, staged_action=staged_action)

    assert result.ok
    assert (root / "tools/managed.txt").read_bytes() == b"managed\n"
    assert not (root / "node_modules").exists()
    assert not (root / "tools/action-cache.bin").exists()


def test_staged_action_cannot_modify_a_planned_output(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"planned\n",
                _digest(before),
            ),
        )
    )

    def staged_action(staging: Path) -> VerificationResult:
        (staging / "tools/managed.txt").write_bytes(b"action-overwrite\n")
        return _verification()

    with pytest.raises(
        IntegrationError,
        match="Staged action or verifier modified a planned integration output",
    ):
        _apply(root, plan, staged_action=staged_action)

    assert managed.read_bytes() == before
    assert not (root / ".tooling-state").exists()


def test_staging_verifier_cannot_modify_a_planned_output(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"planned\n",
                _digest(before),
            ),
        )
    )

    def verifier(target: Path) -> VerificationResult:
        if target != root:
            (target / "tools/managed.txt").write_bytes(b"verifier-overwrite\n")
        return _verification()

    with pytest.raises(
        IntegrationError,
        match="Staged action or verifier modified a planned integration output",
    ):
        _apply(root, plan, verifier)

    assert managed.read_bytes() == before


def test_frozen_output_is_published_even_if_staging_changes_later(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    before = b"before\n"
    managed = root / "tools/managed.txt"
    managed.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"planned\n",
                _digest(before),
            ),
        )
    )
    staged_root: Path | None = None

    def staged_action(staging: Path) -> VerificationResult:
        nonlocal staged_root
        staged_root = staging
        return _verification()

    original_write_journal = transaction_module._write_journal

    def mutate_after_freeze(*args, **kwargs):
        assert staged_root is not None
        (staged_root / "tools/managed.txt").write_bytes(b"late-overwrite\n")
        return original_write_journal(*args, **kwargs)

    monkeypatch.setattr(transaction_module, "_write_journal", mutate_after_freeze)

    result = _apply(root, plan, staged_action=staged_action)

    assert result.ok
    assert managed.read_bytes() == b"planned\n"


@pytest.mark.parametrize(
    ("staged_action", "message"),
    (
        (lambda _staging: None, "Staged action returned an invalid result"),
        (lambda _staging: object(), "Staged action returned an invalid result"),
        (
            lambda _staging: (_ for _ in ()).throw(RuntimeError("secret detail")),
            "Staged action execution failed; target remains unchanged",
        ),
    ),
)
def test_invalid_or_crashing_staged_action_leaves_live_project_unchanged(
    tmp_path: Path,
    staged_action,
    message: str,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"planned\n",
                _digest(before),
            ),
        )
    )

    with pytest.raises(IntegrationError, match=message):
        _apply(root, plan, staged_action=staged_action)

    assert managed.read_bytes() == before
    assert not (root / ".tooling-state").exists()


def test_staging_never_copies_secrets_keys_or_product_data(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    (root / "tools/original.txt").write_bytes(b"old\n")
    (root / ".env").write_text("TOKEN=secret\n", encoding="utf-8")
    (root / "private.key").write_text("secret key\n", encoding="utf-8")
    (root / "storage").mkdir()
    (root / "storage/customer.db").write_bytes(b"private data")
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/generated.txt",
                Ownership.TOOLING,
                b"safe\n",
                None,
            ),
        )
    )

    def verifier(target: Path) -> VerificationResult:
        if target != root:
            assert not (target / ".env").exists()
            assert not (target / "private.key").exists()
            assert not (target / "storage").exists()
        return _verification()

    _apply(root, plan, verifier)

    assert (root / ".env").is_file()
    assert (root / "private.key").is_file()
    assert (root / "storage/customer.db").is_file()


def test_staging_does_not_expose_project_symlinks_to_verifiers(tmp_path: Path) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("private\n", encoding="utf-8")
    try:
        os.symlink(outside, root / "unknown-link")
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are not available")
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/generated.txt",
                Ownership.TOOLING,
                b"safe\n",
            ),
        )
    )

    def verifier(target: Path) -> VerificationResult:
        if target != root:
            assert not (target / "unknown-link").exists()
            assert not (target / "unknown-link").is_symlink()
        return _verification()

    _apply(root, plan, verifier)

    assert (root / "unknown-link").is_symlink()


def test_post_verification_failure_rolls_back_every_affected_path(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    old = b"old\n"
    original = root / "tools/managed.txt"
    original.write_bytes(old)
    original.chmod(0o751)
    original_mode = original.stat().st_mode & 0o777
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"new\n",
                _digest(old),
            ),
            Operation(
                OperationKind.ADD,
                "tools/added.txt",
                Ownership.TOOLING,
                b"added\n",
                None,
            ),
            Operation(
                OperationKind.ADD,
                ".tooling-state/state.json",
                Ownership.TOOLING,
                b"state\n",
                None,
            ),
        )
    )

    def verifier(target: Path) -> VerificationResult:
        return _verification(target != root)

    with pytest.raises(IntegrationError, match="Post-integration verification failed"):
        _apply(root, plan, verifier)

    assert original.read_bytes() == old
    assert original.stat().st_mode & 0o777 == original_mode
    assert not (root / "tools/added.txt").exists()
    assert not (root / ".tooling-state/state.json").exists()
    assert (root / ".tooling-state/reports/journal.json").is_file()


@pytest.mark.parametrize(
    "failpoint",
    ("before_operation_1", "after_operation_2", "state_commit", "post_verify"),
)
def test_deterministic_failpoints_roll_back_every_committed_operation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    failpoint: str,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"after\n",
                _digest(before),
            ),
            Operation(
                OperationKind.ADD,
                "tools/added.txt",
                Ownership.TOOLING,
                b"added\n",
            ),
            Operation(
                OperationKind.ADD,
                ".tooling-state/state.json",
                Ownership.TOOLING,
                b"state\n",
            ),
        )
    )
    monkeypatch.setenv("TOOLING_TEST_FAILPOINT", failpoint)

    with pytest.raises(
        IntegrationError,
        match=f"Deterministic test failpoint triggered: {failpoint}",
    ):
        _apply(root, plan)

    assert managed.read_bytes() == before
    assert not (root / "tools/added.txt").exists()
    assert not (root / ".tooling-state/state.json").exists()
    assert (root / ".tooling-state/reports/journal.json").is_file()


def test_failed_staged_action_failpoint_never_commits_live_changes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"after\n",
                _digest(before),
            ),
        )
    )
    monkeypatch.setenv("TOOLING_TEST_FAILPOINT", "quality_check")

    with pytest.raises(IntegrationError, match="Staged action verification failed"):
        _apply(
            root,
            plan,
            staged_action=ActionRunner((ActionSpec(ActionKind.QUALITY),)),
        )

    assert managed.read_bytes() == before
    assert not (root / ".tooling-state").exists()


def test_report_failure_and_base_exception_are_both_inside_rollback_boundary(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    (root / "tools").mkdir()
    old = b"old\n"
    path = root / "tools/managed.txt"
    path.write_bytes(old)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.UPDATE,
                "tools/managed.txt",
                Ownership.TOOLING,
                b"new\n",
                _digest(old),
            ),
        )
    )

    def fail_report(_result: VerificationResult, _outcome: str) -> None:
        raise OSError("synthetic report failure")

    with pytest.raises(IntegrationError, match="rolled back"):
        _apply(root, plan, finalizer=fail_report)
    assert path.read_bytes() == old

    calls = 0

    def interrupt_after_staging(_target: Path) -> VerificationResult:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise KeyboardInterrupt
        return _verification()

    with pytest.raises(KeyboardInterrupt):
        _apply(root, plan, interrupt_after_staging)
    assert path.read_bytes() == old


def test_structured_json_patch_preserves_unknown_keys(tmp_path: Path) -> None:
    root = _project(tmp_path)
    package = root / "frontend/package.json"
    package.parent.mkdir()
    before = b'{"name":"fixture","scripts":{"custom":"keep","test":"old"},"unknown":{"value":7}}\n'
    package.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "frontend/package.json",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(StructuredChange("scripts.test", "pytest", "old"),),
            ),
        )
    )

    _apply(
        root,
        plan,
        structured_key_allowlist={"frontend/package.json": frozenset({"scripts.test"})},
    )

    payload = json.loads(package.read_text(encoding="utf-8"))
    assert payload == {
        "name": "fixture",
        "scripts": {"custom": "keep", "test": "pytest"},
        "unknown": {"value": 7},
    }


def test_structured_toml_patch_preserves_unknown_tables(tmp_path: Path) -> None:
    import tomllib

    root = _project(tmp_path)
    pyproject = root / "pyproject.toml"
    before = (
        b"# untouched leading comment\n"
        b"[project] # table comment\n"
        b'name = "fixture"\n'
        b'custom = "keep"\n'
        b"\n"
        b"[tool.demo]\n"
        b"enabled = false  # retain this comment\n"
        b"limit = 7\n"
    )
    pyproject.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "pyproject.toml",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(
                    StructuredChange("tool.demo.enabled", True, False),
                ),
            ),
        )
    )

    _apply(
        root,
        plan,
        structured_key_allowlist={"pyproject.toml": frozenset({"tool.demo.enabled"})},
    )

    expected = before.replace(b"enabled = false", b"enabled = true", 1)
    assert pyproject.read_bytes() == expected
    payload = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    assert payload["project"] == {"name": "fixture", "custom": "keep"}
    assert payload["tool"]["demo"] == {"enabled": True, "limit": 7}


def test_structured_toml_patch_adds_missing_leaf_without_rewriting_foreign_bytes(
    tmp_path: Path,
) -> None:
    import tomllib

    root = _project(tmp_path)
    pyproject = root / "pyproject.toml"
    before = (
        b"# customer header\n"
        b"[tool.template_tooling]\n"
        b'foreign = "preserve"  # retain comment\n'
        b"\n"
        b"[customer]\n"
        b'opaque = "unchanged"\n'
    )
    pyproject.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "pyproject.toml",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(
                    StructuredChange("tool.template_tooling.profile", "web-cloud"),
                ),
            ),
        )
    )

    _apply(
        root,
        plan,
        structured_key_allowlist={
            "pyproject.toml": frozenset({"tool.template_tooling.profile"})
        },
    )

    expected = before.replace(
        b"\n\n[customer]",
        b'\nprofile = "web-cloud"\n\n[customer]',
        1,
    )
    assert pyproject.read_bytes() == expected
    parsed = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    assert parsed["tool"]["template_tooling"] == {
        "foreign": "preserve",
        "profile": "web-cloud",
    }
    assert parsed["customer"] == {"opaque": "unchanged"}


def test_structured_toml_patch_creates_missing_bare_table_deterministically(
    tmp_path: Path,
) -> None:
    import tomllib

    root = _project(tmp_path)
    cargo = root / "Cargo.toml"
    before = b'[package]\nname = "fixture"\nversion = "0.1.0"\n'
    cargo.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "Cargo.toml",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(
                    StructuredChange(
                        "package.metadata.template_tooling.profile",
                        "desktop-local",
                    ),
                ),
            ),
        )
    )

    _apply(
        root,
        plan,
        structured_key_allowlist={
            "Cargo.toml": frozenset({"package.metadata.template_tooling.profile"})
        },
    )

    expected = before + (
        b'\n[package.metadata.template_tooling]\nprofile = "desktop-local"\n'
    )
    assert cargo.read_bytes() == expected
    parsed = tomllib.loads(cargo.read_text(encoding="utf-8"))
    assert parsed["package"]["metadata"]["template_tooling"] == {
        "profile": "desktop-local"
    }


def test_structured_toml_patch_preserves_indented_assignment(tmp_path: Path) -> None:
    root = _project(tmp_path)
    config = root / "project-tooling.toml"
    before = b'[paths]\n  frontend = "client"  # authored spacing\n'
    config.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "project-tooling.toml",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(
                    StructuredChange("paths.frontend", "frontend", "client"),
                ),
            ),
        )
    )

    _apply(root, plan)

    assert config.read_bytes() == before.replace(b'"client"', b'"frontend"')


def test_structured_patch_requires_an_explicit_exact_key_allowlist(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    package = root / "package.json"
    before = b'{"scripts":{"test":"old"},"foreign":"keep"}\n'
    package.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "package.json",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(StructuredChange("scripts.test", "new", "old"),),
            ),
        )
    )

    with pytest.raises(IntegrationError, match="no known-key allowlist"):
        _apply(root, plan)
    with pytest.raises(IntegrationError, match="undeclared keys"):
        _apply(
            root,
            plan,
            structured_key_allowlist={"package.json": frozenset({"scripts.quality"})},
        )

    assert package.read_bytes() == before
    assert not (root / ".tooling-state").exists()


def test_structured_patch_rejects_parent_child_key_policies(tmp_path: Path) -> None:
    root = _project(tmp_path)
    package = root / "package.json"
    before = b'{"scripts":{"test":"old","foreign":"keep"}}\n'
    package.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "package.json",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(StructuredChange("scripts.test", "new"),),
            ),
        )
    )

    with pytest.raises(IntegrationError, match="allowlist keys overlap"):
        _apply(
            root,
            plan,
            structured_key_allowlist={
                "package.json": frozenset({"scripts", "scripts.test"})
            },
        )

    assert package.read_bytes() == before


@pytest.mark.parametrize(
    ("path", "before", "change"),
    (
        (
            "desktop/tauri.conf.json",
            b'{"build":{"beforeBuildCommand":"old"},"foreign":true}\n',
            StructuredChange("build.beforeBuildCommand", "new", "old"),
        ),
        (
            "desktop/Cargo.toml",
            b'[package]\nname = "demo"\nversion = "0.1.0"\n',
            StructuredChange("package.version", "0.2.0", "0.1.0"),
        ),
    ),
)
def test_supported_structured_files_patch_only_declared_keys(
    tmp_path: Path,
    path: str,
    before: bytes,
    change: StructuredChange,
) -> None:
    root = _project(tmp_path)
    target = root / path
    target.parent.mkdir(parents=True)
    target.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                path,
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(change,),
            ),
        )
    )

    _apply(
        root,
        plan,
        structured_key_allowlist={path: frozenset({change.key})},
    )

    assert target.read_bytes() != before
    if target.suffix == ".json":
        assert json.loads(target.read_text(encoding="utf-8"))["foreign"] is True
    else:
        assert b'name = "demo"' in target.read_bytes()


def test_workflow_patch_preserves_unmentioned_bytes_and_comments(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    workflow = root / ".github/workflows/quality.yml"
    workflow.parent.mkdir(parents=True)
    before = (
        b"# authored workflow\r\n"
        b"name: Quality\r\n"
        b"on:\r\n"
        b"  push:\r\n"
        b"permissions:\r\n"
        b"  contents: read  # retain spacing and comment\r\n"
        b"jobs:\r\n"
        b"  test:\r\n"
        b"    runs-on: ubuntu-latest\r\n"
    )
    workflow.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                ".github/workflows/quality.yml",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(
                    StructuredChange("permissions.contents", "write", "read"),
                ),
            ),
        )
    )

    _apply(
        root,
        plan,
        structured_key_allowlist={
            ".github/workflows/quality.yml": frozenset({"permissions.contents"})
        },
    )

    assert workflow.read_bytes() == before.replace(
        b"contents: read  #", b'contents: "write"  #'
    )


def test_non_workflow_yaml_is_not_a_structured_target(tmp_path: Path) -> None:
    root = _project(tmp_path)
    target = root / "config.yaml"
    before = b"enabled: false\n"
    target.write_bytes(before)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.PATCH,
                "config.yaml",
                Ownership.STRUCTURED,
                expected_sha256=_digest(before),
                structured_changes=(StructuredChange("enabled", True, False),),
            ),
        )
    )

    with pytest.raises(IntegrationError, match="unsupported file"):
        _apply(
            root,
            plan,
            structured_key_allowlist={"config.yaml": frozenset({"enabled"})},
        )

    assert target.read_bytes() == before


@pytest.mark.parametrize(
    ("operation", "message"),
    (
        (
            Operation(
                OperationKind.ADD,
                "frontend/src/generated.ts",
                Ownership.PROJECT,
                b"bad",
                None,
            ),
            "project-owned",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/data/customer.db",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "product data",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/secrets/token.txt",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "sensitive directory",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/.env.production",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "sensitive file",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/.envrc",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "protected generated or sensitive",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/production.env",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "protected generated or sensitive",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/client.jks",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "protected generated or sensitive",
        ),
        (
            Operation(
                OperationKind.ADD,
                "tools/secrets.json",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
            "sensitive file",
        ),
        (
            Operation(
                OperationKind.ADD, "../escape.txt", Ownership.TOOLING, b"bad", None
            ),
            "project-relative",
        ),
        (
            Operation(
                OperationKind.UPDATE,
                "frontend/package.json",
                Ownership.STRUCTURED,
                b"{}",
                "0" * 64,
            ),
            "key-level PATCH",
        ),
    ),
)
def test_unsafe_or_full_replacement_operations_are_refused(
    tmp_path: Path,
    operation: Operation,
    message: str,
) -> None:
    root = _project(tmp_path)

    with pytest.raises(IntegrationError, match=message):
        _apply(root, IntegrationPlan(operations=(operation,)))


def test_conflicts_and_symlink_targets_are_refused_without_writes(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    conflict = IntegrationPlan(
        conflicts=(Conflict("frontend/src/app.ts", Ownership.PROJECT, "project owned"),)
    )
    with pytest.raises(IntegrationError, match="contains conflicts"):
        _apply(root, conflict)

    external = tmp_path / "external"
    external.mkdir()
    try:
        os.symlink(external, root / "tools")
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are not available")
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/generated.txt",
                Ownership.TOOLING,
                b"bad",
                None,
            ),
        )
    )
    with pytest.raises(IntegrationError, match="symbolic link"):
        _apply(root, plan)
    assert not (external / "generated.txt").exists()


def test_case_colliding_operation_paths_are_refused(tmp_path: Path) -> None:
    root = _project(tmp_path)
    plan = IntegrationPlan(
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/Generated.txt",
                Ownership.TOOLING,
                b"one",
            ),
            Operation(
                OperationKind.ADD,
                "tools/generated.txt",
                Ownership.TOOLING,
                b"two",
            ),
        )
    )

    with pytest.raises(IntegrationError, match="ambiguous casing"):
        _apply(root, plan)

    assert not (root / "tools").exists()


def test_transaction_journal_redacts_profile_metadata(tmp_path: Path) -> None:
    root = _project(tmp_path)
    plan = IntegrationPlan(
        profile="token=journal-secret",
        desired_features=("path:/home/alice/private-feature",),
        operations=(
            Operation(
                OperationKind.ADD,
                "tools/token=path-secret",
                Ownership.TOOLING,
                b"safe",
            ),
        ),
    )

    _apply(root, plan)

    journal = (root / ".tooling-state/reports/journal.json").read_text(encoding="utf-8")
    assert "journal-secret" not in journal
    assert "/home/alice" not in journal
    assert "path-secret" not in journal
