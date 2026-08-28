from __future__ import annotations

import hashlib
import os
from pathlib import Path

import pytest

from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    load_project_config,
    render_project_config,
)
from tools.integration import transaction as transaction_module
from tools.integration.model import (
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
                "project-config-transaction",
                FindingStatus.PASS if passing else FindingStatus.FAIL,
                "fixture verification",
            ),
        )
    )


def _config() -> ProjectConfig:
    return ProjectConfig(
        tooling_version="0.1.0",
        project_name="Portable Example",
        profile="web-cloud",
        paths=ProjectPathConfig(
            frontend="apps/web",
            backend="services/api",
            tauri="desktop/src-tauri",
            docs="handbook",
        ),
        optional_features=("postgres", "ci"),
    )


def _operation(content: bytes) -> Operation:
    return Operation(
        OperationKind.ADD,
        "project-tooling.toml",
        Ownership.STRUCTURED,
        content,
    )


def _apply(
    root: Path,
    operation: Operation,
    verifier=lambda _root: _verification(),
    *,
    finalizer=None,
    post_apply=None,
):
    return apply_transaction(
        TransactionRequest(
            project_root=root,
            plan=IntegrationPlan(
                profile="web-cloud",
                operations=(operation,),
            ),
            verifier=verifier,
            report_finalizer=finalizer,
            post_apply=post_apply,
        )
    )


def test_canonical_root_project_config_is_created_transactionally(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    unknown = root / "user-notes.txt"
    unknown.write_bytes(b"keep me\n")
    expected = render_project_config(_config()).encode("utf-8")
    verification_roots: list[Path] = []

    def verifier(target: Path) -> VerificationResult:
        verification_roots.append(target)
        assert load_project_config(target / "project-tooling.toml") == _config()
        return _verification()

    result = _apply(root, _operation(expected), verifier)

    assert result.ok
    assert (root / "project-tooling.toml").read_bytes() == expected
    assert unknown.read_bytes() == b"keep me\n"
    assert verification_roots[-1] == root
    assert len(verification_roots) == 2


@pytest.mark.parametrize(
    "invalid_content",
    (
        render_project_config(_config()).encode("utf-8") + b"# noncanonical\n",
        render_project_config(_config())
        .replace('frontend = "apps/web"', 'frontend = "../outside"')
        .encode("utf-8"),
        render_project_config(_config()).encode("utf-8")
        + b"\n[unknown]\nvalue = true\n",
        b"schema_version = [\n",
    ),
)
def test_noncanonical_or_unsafe_project_config_creation_is_refused(
    tmp_path: Path,
    invalid_content: bytes,
) -> None:
    root = tmp_path / "project"
    root.mkdir()

    with pytest.raises(IntegrationError, match="project-tooling.toml"):
        _apply(root, _operation(invalid_content))

    assert not (root / "project-tooling.toml").exists()
    assert not (root / ".tooling-state").exists()


@pytest.mark.parametrize(
    "path",
    (
        "nested/project-tooling.toml",
        "package.json",
        "pyproject.toml",
    ),
)
def test_no_other_structured_file_can_be_created_wholesale(
    tmp_path: Path,
    path: str,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    operation = Operation(
        OperationKind.ADD,
        path,
        Ownership.STRUCTURED,
        render_project_config(_config()),
    )

    with pytest.raises(IntegrationError, match="only the missing root"):
        _apply(root, operation)

    assert tuple(root.iterdir()) == ()


@pytest.mark.parametrize("existing_kind", ("directory", "symlink"))
def test_existing_wrong_kind_project_config_is_refused_without_following(
    tmp_path: Path,
    existing_kind: str,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    outside = tmp_path / "outside.toml"
    outside.write_bytes(b"outside\n")
    target = root / "project-tooling.toml"
    if existing_kind == "directory":
        target.mkdir()
    else:
        try:
            os.symlink(outside, target)
        except (OSError, NotImplementedError):
            pytest.skip("symbolic links are not available")

    with pytest.raises(IntegrationError):
        _apply(root, _operation(render_project_config(_config()).encode("utf-8")))

    assert outside.read_bytes() == b"outside\n"
    assert not (root / ".tooling-state").exists()


def test_project_config_creation_is_removed_on_failed_post_verification(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    unknown = root / "unknown.bin"
    unknown.write_bytes(b"unchanged")

    def verifier(target: Path) -> VerificationResult:
        return _verification(target != root)

    with pytest.raises(IntegrationError, match="Post-integration verification failed"):
        _apply(
            root,
            _operation(render_project_config(_config()).encode("utf-8")),
            verifier,
        )

    assert not (root / "project-tooling.toml").exists()
    assert unknown.read_bytes() == b"unchanged"
    assert (root / ".tooling-state/reports/journal.json").is_file()


def test_project_config_that_appears_during_commit_is_preserved(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    target = root / "project-tooling.toml"
    original_apply = transaction_module._apply_from_staging

    def racing_apply(
        project_root: Path,
        staging: Path,
        prepared: tuple[transaction_module._PreparedOperation, ...],
    ) -> None:
        target.write_bytes(b"user-created-during-commit\n")
        original_apply(project_root, staging, prepared)

    monkeypatch.setattr(transaction_module, "_apply_from_staging", racing_apply)

    with pytest.raises(IntegrationError, match="appeared during commit"):
        _apply(root, _operation(render_project_config(_config()).encode("utf-8")))

    assert target.read_bytes() == b"user-created-during-commit\n"


def test_project_config_patch_is_limited_to_known_safe_keys(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    config = root / "project-tooling.toml"
    before = (
        render_project_config(_config()) + '[custom]\nkeep = "untouched"\n'
    ).encode("utf-8")
    config.write_bytes(before)

    unknown_key = Operation(
        OperationKind.PATCH,
        "project-tooling.toml",
        Ownership.STRUCTURED,
        expected_sha256=_digest(before),
        structured_changes=(StructuredChange("custom.keep", "changed"),),
    )
    with pytest.raises(IntegrationError, match="supported schema keys"):
        _apply(root, unknown_key)
    assert config.read_bytes() == before

    unsafe_path = Operation(
        OperationKind.PATCH,
        "project-tooling.toml",
        Ownership.STRUCTURED,
        expected_sha256=_digest(before),
        structured_changes=(
            StructuredChange("paths.frontend", "../outside", "apps/web"),
        ),
    )
    with pytest.raises(IntegrationError, match="safe project-relative"):
        _apply(root, unsafe_path)
    assert config.read_bytes() == before

    known_key = Operation(
        OperationKind.PATCH,
        "project-tooling.toml",
        Ownership.STRUCTURED,
        expected_sha256=_digest(before),
        structured_changes=(
            StructuredChange("project.profile", "full-platform", "web-cloud"),
        ),
    )
    _apply(root, known_key)
    assert b'profile = "full-platform"' in config.read_bytes()
    assert b'[custom]\nkeep = "untouched"\n' in config.read_bytes()


def test_noop_transaction_never_finalizes_a_report_or_runs_post_apply(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    calls: list[str] = []

    def finalizer(_result: VerificationResult, _outcome: str) -> None:
        calls.append("report")

    def post_apply(_root: Path) -> None:
        calls.append("post-apply")

    request = TransactionRequest(
        project_root=root,
        plan=IntegrationPlan(),
        verifier=lambda _root: _verification(),
        report_finalizer=finalizer,
        post_apply=post_apply,
    )
    result = apply_transaction(request)

    assert result.ok
    assert calls == []

    failing = TransactionRequest(
        project_root=root,
        plan=IntegrationPlan(),
        verifier=lambda _root: _verification(False),
        report_finalizer=finalizer,
        post_apply=post_apply,
    )
    with pytest.raises(IntegrationError, match="No-op integration verification failed"):
        apply_transaction(failing)
    assert calls == []


def test_post_apply_runs_on_real_target_before_final_verification(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    events: list[str] = []
    operation = Operation(
        OperationKind.UPDATE,
        "tools/managed.txt",
        Ownership.TOOLING,
        b"after\n",
        _digest(before),
    )

    def verifier(target: Path) -> VerificationResult:
        events.append("verify-real" if target == root else "verify-staging")
        return _verification()

    def post_apply(target: Path) -> VerificationResult:
        assert target == root
        assert managed.read_bytes() == b"after\n"
        events.append("post-apply")
        return VerificationResult(
            (
                Finding(
                    "post-apply",
                    FindingStatus.PASS,
                    "action completed",
                ),
            )
        )

    result = _apply(root, operation, verifier, post_apply=post_apply)

    assert events == ["verify-staging", "post-apply", "verify-real"]
    assert tuple(item.check for item in result.verification.findings) == (
        "post-apply",
        "project-config-transaction",
    )


def test_failed_post_apply_result_rolls_back_and_skips_final_verifier(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    verification_roots: list[Path] = []
    finalized: list[tuple[str, bool]] = []
    operation = Operation(
        OperationKind.UPDATE,
        "tools/managed.txt",
        Ownership.TOOLING,
        b"after\n",
        _digest(before),
    )

    def verifier(target: Path) -> VerificationResult:
        verification_roots.append(target)
        return _verification()

    def post_apply(target: Path) -> VerificationResult:
        assert target == root
        assert managed.read_bytes() == b"after\n"
        return _verification(False)

    def finalizer(result: VerificationResult, outcome: str) -> None:
        finalized.append((outcome, result.ok))

    with pytest.raises(IntegrationError, match="Post-apply action verification failed"):
        _apply(
            root,
            operation,
            verifier,
            finalizer=finalizer,
            post_apply=post_apply,
        )

    assert managed.read_bytes() == before
    assert len(verification_roots) == 1
    assert verification_roots[0] != root
    assert finalized == [("FAILED", False)]


def test_invalid_post_apply_result_rolls_back(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    (root / "tools").mkdir()
    managed = root / "tools/managed.txt"
    before = b"before\n"
    managed.write_bytes(before)
    operation = Operation(
        OperationKind.UPDATE,
        "tools/managed.txt",
        Ownership.TOOLING,
        b"after\n",
        _digest(before),
    )

    with pytest.raises(IntegrationError, match="returned an invalid result"):
        _apply(root, operation, post_apply=lambda _root: object())

    assert managed.read_bytes() == before
