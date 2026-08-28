#!/usr/bin/env python3
"""FMDFlashcard-specific integration, update, idempotency, and rollback checks."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
TOOLING_VERSION = "0.4.0"
LEGACY_TOOLING_VERSION = "0.3.0"
LEGACY_TOOLING_SHA = "ee4d4fee50afddb96e3bf3f7d9caf4c060313d05"
UPDATE_MIGRATION_ID = "reconcile-managed-payload-0-3-0-to-0-4-0"
MANAGED_PREFIXES = ("tools/", "docs/toolingdocs/", ".tooling-state/")
GENERATED_DIRECTORY_NAMES = {
    "__pycache__",
    "node_modules",
    "reports",
    "runtime",
    "target",
    "venv",
}


class AcceptanceError(RuntimeError):
    """Raised when an acceptance invariant is not met."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AcceptanceError(message)


def _git_output(root: Path, *args: str) -> bytes:
    completed = subprocess.run(
        ["git", "-C", str(root), *args],
        check=False,
        capture_output=True,
    )
    if completed.returncode != 0:
        detail = completed.stderr.decode("utf-8", errors="replace").strip()
        raise AcceptanceError(f"git {' '.join(args)} failed: {detail}")
    return completed.stdout


def _tracked_paths() -> tuple[str, ...]:
    output = _git_output(PROJECT_ROOT, "ls-files", "-z")
    return tuple(entry.decode("utf-8") for entry in output.split(b"\0") if entry)


def _is_managed(relative: str) -> bool:
    return relative == "project-tooling.toml" or relative.startswith(MANAGED_PREFIXES)


def _copy_product_tree(destination: Path) -> None:
    destination.mkdir(parents=True)
    for relative in _tracked_paths():
        if _is_managed(relative):
            continue
        source = PROJECT_ROOT / relative
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_symlink():
            target.symlink_to(source.readlink())
        elif source.is_file():
            shutil.copy2(source, target)


def _copy_payload(source_root: Path, destination: Path) -> None:
    tools = source_root / "tools"
    tooling_docs = source_root / "docs" / "toolingdocs"
    _require(tools.is_dir(), f"missing tooling directory: {tools}")
    _require(tooling_docs.is_dir(), f"missing tooling documentation: {tooling_docs}")
    ignore_runtime = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo")
    shutil.copytree(tools, destination / "tools", ignore=ignore_runtime)
    (destination / "docs").mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        tooling_docs,
        destination / "docs" / "toolingdocs",
        ignore=ignore_runtime,
    )


def _write_project_config(destination: Path, version: str) -> None:
    source = (PROJECT_ROOT / "project-tooling.toml").read_text(encoding="utf-8")
    current = f'version = "{TOOLING_VERSION}"'
    replacement = f'version = "{version}"'
    _require(
        source.count(current) == 1, "unexpected project-tooling.toml version field"
    )
    (destination / "project-tooling.toml").write_text(
        source.replace(current, replacement),
        encoding="utf-8",
    )


def _fixture(destination: Path, payload_root: Path, version: str) -> None:
    _copy_product_tree(destination)
    _copy_payload(payload_root, destination)
    _write_project_config(destination, version)


def _run_cli(
    root: Path,
    *arguments: str,
    expected_codes: tuple[int, ...] = (0,),
) -> dict[str, Any]:
    completed = subprocess.run(
        [sys.executable, str(root / "tools" / "control.py"), *arguments],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode not in expected_codes:
        output = "\n".join(
            part for part in (completed.stdout, completed.stderr) if part
        )
        raise AcceptanceError(
            f"CLI {' '.join(arguments)} exited {completed.returncode}:\n{output[-4000:]}"
        )
    lines = [line for line in completed.stdout.splitlines() if line.strip()]
    _require(bool(lines), f"CLI {' '.join(arguments)} produced no JSON output")
    try:
        payload = json.loads(lines[-1])
    except json.JSONDecodeError as exc:
        raise AcceptanceError(
            f"CLI {' '.join(arguments)} produced invalid JSON: {lines[-1][-1000:]}"
        ) from exc
    _require(isinstance(payload, dict), "CLI JSON result is not an object")
    return payload


def _operation_paths(payload: dict[str, Any]) -> set[str]:
    plan = payload.get("plan")
    if not isinstance(plan, dict):
        return set()
    operations = plan.get("operations")
    if not isinstance(operations, list):
        return set()
    return {
        str(operation.get("path"))
        for operation in operations
        if isinstance(operation, dict) and isinstance(operation.get("path"), str)
    }


def _tree_digest(root: Path, *, product_only: bool = False) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(root)
        parts = relative.parts
        if any(part in GENERATED_DIRECTORY_NAMES for part in parts):
            continue
        relative_text = relative.as_posix()
        if product_only and _is_managed(relative_text):
            continue
        digest.update(relative_text.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _assert_integrated(payload: dict[str, Any]) -> None:
    _require(payload.get("status") == "INTEGRATED", "tooling is not integrated")
    verification = payload.get("verification")
    _require(isinstance(verification, dict), "verification result is missing")
    _require(verification.get("ok") is True, "tooling verification failed")


def run_clean_integration(*, check_idempotency: bool) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(
        prefix="fmdflashcard-clean-integration-"
    ) as temporary:
        root = Path(temporary) / "project"
        _fixture(root, PROJECT_ROOT, TOOLING_VERSION)
        product_before = _tree_digest(root, product_only=True)
        config_before = (root / "project-tooling.toml").read_bytes()

        check = _run_cli(
            root,
            "integrate",
            "--check",
            "--json",
            expected_codes=(1,),
        )
        _require(
            check.get("status") == "FIX_REQUIRED", "clean fixture needs no integration"
        )
        _require(
            _operation_paths(check) == {".tooling-state/state.toml"},
            "clean integration planned paths outside tooling state",
        )
        applied = _run_cli(root, "integrate", "--full-fix", "--json")
        _assert_integrated(applied)
        _require(
            _tree_digest(root, product_only=True) == product_before, "product drifted"
        )
        _require(
            (root / "project-tooling.toml").read_bytes() == config_before,
            "project configuration changed during clean integration",
        )

        noop = _run_cli(root, "integrate", "--check", "--json")
        _assert_integrated(noop)
        _require(not _operation_paths(noop), "second integration check is not a no-op")
        verify = _run_cli(root, "tooling", "verify", "--json")
        _assert_integrated(verify)

        if check_idempotency:
            before_repeat = _tree_digest(root)
            repeated = _run_cli(root, "integrate", "--full-fix", "--json")
            _assert_integrated(repeated)
            _require(not _operation_paths(repeated), "second Full-Fix planned changes")
            _require(
                _tree_digest(root) == before_repeat,
                "second Full-Fix changed the fixture",
            )

        return {
            "case": "idempotency" if check_idempotency else "clean-integration",
            "status": "PASS",
            "planned_paths": sorted(_operation_paths(check)),
        }


def _verify_legacy_source(source: Path) -> None:
    head = _git_output(source, "rev-parse", "HEAD").decode("ascii").strip()
    _require(head == LEGACY_TOOLING_SHA, f"unexpected legacy source SHA: {head}")
    version = (source / "tools" / "VERSION").read_text(encoding="utf-8").strip()
    _require(version == LEGACY_TOOLING_VERSION, f"unexpected legacy version: {version}")


def run_update(legacy_source: Path) -> dict[str, Any]:
    legacy_source = legacy_source.resolve()
    _verify_legacy_source(legacy_source)
    with tempfile.TemporaryDirectory(
        prefix="fmdflashcard-tooling-update-"
    ) as temporary:
        root = Path(temporary) / "project"
        _fixture(root, legacy_source, LEGACY_TOOLING_VERSION)
        initial = _run_cli(root, "integrate", "--full-fix", "--json")
        _assert_integrated(initial)
        legacy_verify = _run_cli(root, "tooling", "verify", "--json")
        _assert_integrated(legacy_verify)
        product_before = _tree_digest(root, product_only=True)

        shutil.rmtree(root / "tools")
        shutil.rmtree(root / "docs" / "toolingdocs")
        _copy_payload(PROJECT_ROOT, root)

        update_check = _run_cli(
            root,
            "tooling",
            "migrate",
            "--check",
            "--json",
            expected_codes=(1,),
        )
        encoded_check = json.dumps(update_check, sort_keys=True)
        _require(
            UPDATE_MIGRATION_ID in encoded_check,
            "registered 0.3 to 0.4 migration is absent",
        )
        _require(
            _operation_paths(update_check)
            == {".tooling-state/state.toml", "project-tooling.toml"},
            "update planned paths outside state and project configuration",
        )

        applied = _run_cli(root, "tooling", "migrate", "--json")
        _assert_integrated(applied)
        _require(
            applied.get("applied_migrations") == [UPDATE_MIGRATION_ID],
            "tooling update did not report the expected applied migration",
        )
        verify = _run_cli(root, "tooling", "verify", "--json")
        _assert_integrated(verify)
        _require(
            _tree_digest(root, product_only=True) == product_before,
            "update changed product files",
        )

        before_repeat = _tree_digest(root)
        second_check = _run_cli(root, "tooling", "migrate", "--check", "--json")
        _require(
            not _operation_paths(second_check), "second update check planned changes"
        )
        second_apply = _run_cli(root, "tooling", "migrate", "--json")
        _require(
            not _operation_paths(second_apply),
            "second update application planned changes",
        )
        _require(
            _tree_digest(root) == before_repeat,
            "second update application changed files",
        )

        config = (root / "project-tooling.toml").read_text(encoding="utf-8")
        state = (root / ".tooling-state" / "state.toml").read_text(encoding="utf-8")
        _require(f'version = "{TOOLING_VERSION}"' in config, "config version is stale")
        _require(
            f'tooling_version = "{TOOLING_VERSION}"' in state, "state version is stale"
        )
        _require(UPDATE_MIGRATION_ID in state, "applied migration ID is not persisted")

        return {
            "case": "update",
            "status": "PASS",
            "source_sha": LEGACY_TOOLING_SHA,
            "migration": UPDATE_MIGRATION_ID,
            "planned_paths": sorted(_operation_paths(update_check)),
        }


def run_rollback() -> dict[str, Any]:
    from tools.integration.model import (
        Finding,
        FindingStatus,
        IntegrationError,
        IntegrationPlan,
        Operation,
        OperationKind,
        Ownership,
        VerificationResult,
    )
    from tools.integration.transaction import TransactionRequest, apply_transaction

    with tempfile.TemporaryDirectory(
        prefix="fmdflashcard-tooling-rollback-"
    ) as temporary:
        root = Path(temporary) / "project"
        _fixture(root, PROJECT_ROOT, TOOLING_VERSION)
        _run_cli(root, "integrate", "--full-fix", "--json")
        product_before = _tree_digest(root, product_only=True)
        managed_before = _tree_digest(root)
        additions = (
            "tools/fmdflashcard-rollback-first.txt",
            "tools/fmdflashcard-rollback-second.txt",
        )
        plan = IntegrationPlan(
            profile="desktop-local",
            desired_features=("frontend", "tauri"),
            operations=tuple(
                Operation(OperationKind.ADD, path, Ownership.TOOLING, b"temporary\n")
                for path in additions
            ),
        )

        def verifier(target: Path) -> VerificationResult:
            status = (
                FindingStatus.FAIL
                if target.resolve() == root.resolve()
                else FindingStatus.PASS
            )
            return VerificationResult(
                (
                    Finding(
                        "fmd-rollback-fixture", status, "controlled post-apply result"
                    ),
                )
            )

        try:
            apply_transaction(TransactionRequest(root, plan, verifier))
        except IntegrationError as exc:
            _require(
                "Post-integration verification failed" in str(exc),
                f"unexpected rollback failure: {exc}",
            )
        else:
            raise AcceptanceError("controlled rollback fixture unexpectedly succeeded")

        _require(
            all(not (root / path).exists() for path in additions),
            "rollback left additions",
        )
        _require(
            _tree_digest(root, product_only=True) == product_before,
            "rollback changed product",
        )
        _require(
            _tree_digest(root) == managed_before,
            "rollback did not restore managed state",
        )
        journal = root / ".tooling-state" / "reports" / "journal.json"
        _require(journal.is_file(), "rollback journal is missing")
        return {"case": "rollback", "status": "PASS", "restored_paths": list(additions)}


def run_path_regression() -> dict[str, Any]:
    allowed = {
        "docs/migration/template-tooling-v2.md",
        # Pinned central regression fixture: the string is matched as a legacy
        # identifier and is not a product/build/runtime path.
        "tools/tests/test_tauri_control.py",
    }
    legacy_markers = (
        ("apps" + "/fmd-desktop").encode("utf-8"),
        ("apps" + "/UserGlobal").encode("utf-8"),
    )
    violations: list[str] = []
    tracked = _tracked_paths()
    tracked_set = set(tracked)
    for relative in tracked:
        if relative.startswith("apps/"):
            violations.append(f"tracked legacy path: {relative}")
        path = PROJECT_ROOT / relative
        if relative in allowed or not path.is_file():
            continue
        contents = path.read_bytes()
        if any(marker in contents for marker in legacy_markers):
            violations.append(f"active legacy reference: {relative}")

    manifest_path = PROJECT_ROOT / "tools" / "PORTABLE-PAYLOAD.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise AcceptanceError(
            f"portable payload manifest is unreadable: {exc}"
        ) from exc
    entries = manifest.get("files")
    _require(isinstance(entries, list), "portable payload manifest has no file list")
    manifest_paths: set[str] = set()
    for entry in entries:
        _require(
            isinstance(entry, dict), "portable payload manifest entry is not an object"
        )
        relative = entry.get("path")
        _require(
            isinstance(relative, str), "portable payload manifest entry has no path"
        )
        _require(
            relative not in manifest_paths,
            f"duplicate payload manifest path: {relative}",
        )
        manifest_paths.add(relative)
        path = PROJECT_ROOT / relative
        _require(relative in tracked_set, f"manifest file is not tracked: {relative}")
        _require(
            path.is_file() and not path.is_symlink(),
            f"manifest file is not regular: {relative}",
        )
        contents = path.read_bytes()
        _require(entry.get("kind") == "file", f"unsupported manifest kind: {relative}")
        _require(
            entry.get("size") == len(contents), f"payload size mismatch: {relative}"
        )
        actual_hash = f"sha256:{hashlib.sha256(contents).hexdigest()}"
        _require(
            entry.get("sha256") == actual_hash, f"payload hash mismatch: {relative}"
        )
        executable = bool(path.stat().st_mode & 0o111)
        _require(
            entry.get("executable") is executable, f"payload mode mismatch: {relative}"
        )

    tracked_payload = {
        relative
        for relative in tracked
        if relative.startswith(("tools/", "docs/toolingdocs/"))
    }
    expected_payload = manifest_paths | {"tools/PORTABLE-PAYLOAD.json"}
    _require(
        tracked_payload == expected_payload,
        "tracked central payload differs from its manifest: "
        f"missing={sorted(expected_payload - tracked_payload)}, "
        f"extra={sorted(tracked_payload - expected_payload)}",
    )
    _require(not violations, "\n".join(violations))
    return {
        "case": "path-regression",
        "status": "PASS",
        "tracked_files": len(tracked),
        "payload_files": len(manifest_paths),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "case",
        choices=(
            "clean-integration",
            "idempotency",
            "update",
            "rollback",
            "path-regression",
        ),
    )
    parser.add_argument("--legacy-source", type=Path)
    args = parser.parse_args()

    try:
        if args.case == "clean-integration":
            result = run_clean_integration(check_idempotency=False)
        elif args.case == "idempotency":
            result = run_clean_integration(check_idempotency=True)
        elif args.case == "update":
            _require(
                args.legacy_source is not None, "--legacy-source is required for update"
            )
            result = run_update(args.legacy_source)
        elif args.case == "rollback":
            result = run_rollback()
        else:
            result = run_path_regression()
    except (AcceptanceError, OSError, subprocess.SubprocessError) as exc:
        print(json.dumps({"case": args.case, "status": "FAIL", "error": str(exc)}))
        return 1

    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
