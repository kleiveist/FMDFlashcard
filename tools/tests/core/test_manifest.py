from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pytest

from tools.core.manifest import (
    MANIFEST_SCHEMA_VERSION,
    ManagedManifest,
    ManifestError,
    create_manifest,
    load_manifest,
    manifest_to_dict,
    recreate_manifest,
    render_manifest,
    validate_manifest,
    write_manifest,
)


def _write_project(root: Path) -> None:
    (root / "tools/nested").mkdir(parents=True)
    (root / "docs/toolingdocs").mkdir(parents=True)
    (root / "frontend/src").mkdir(parents=True)
    (root / "tools/alpha.txt").write_text("alpha\n", encoding="utf-8")
    (root / "tools/nested/über.bin").write_bytes(b"\x00\xffpayload")
    executable = root / "tools/run-tool"
    executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    executable.chmod(0o755)
    (root / "docs/toolingdocs/index.md").write_text("# Tooling\n", encoding="utf-8")
    (root / "frontend/src/product.ts").write_text(
        "export const product = true;\n", encoding="utf-8"
    )


def test_manifest_requires_explicit_files_or_non_root_scope(tmp_path: Path) -> None:
    tmp_path.mkdir(exist_ok=True)

    with pytest.raises(ManifestError, match="exactly one"):
        create_manifest(tmp_path)
    with pytest.raises(ManifestError, match="Unsafe relative path"):
        create_manifest(tmp_path, scope=".")
    with pytest.raises(ManifestError, match="exactly one"):
        create_manifest(tmp_path, managed_paths=("file.txt",), scope="tools")


def test_explicit_path_manifest_never_claims_unselected_product_files(
    tmp_path: Path,
) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first.mkdir()
    second.mkdir()
    _write_project(first)
    _write_project(second)
    selected = ("docs/toolingdocs/index.md", "tools/alpha.txt", "tools/run-tool")

    manifest = create_manifest(first, managed_paths=reversed(selected))
    repeated = create_manifest(first, managed_paths=selected)
    copied = create_manifest(second, managed_paths=selected)

    assert manifest == repeated == copied
    assert manifest.mode == "paths"
    assert manifest.managed_paths == tuple(sorted(selected))
    assert tuple(manifest.by_path()) == tuple(sorted(selected))
    assert "frontend/src/product.ts" not in manifest.by_path()
    expected_executable = bool((first / "tools/run-tool").stat().st_mode & 0o111)
    assert manifest.by_path()["tools/run-tool"].executable is expected_executable
    assert "alpha\n" not in render_manifest(manifest)


def test_scoped_manifest_is_deterministic_and_limited_to_declared_directories(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    _write_project(root)

    manifest = create_manifest(root, scope=("tools", "docs/toolingdocs"))

    assert manifest.mode == "scope"
    assert manifest == recreate_manifest(root, manifest)
    assert tuple(manifest.by_path()) == (
        "docs/toolingdocs/index.md",
        "tools/alpha.txt",
        "tools/nested/über.bin",
        "tools/run-tool",
    )
    assert manifest.by_path()["tools/nested/über.bin"].kind == "binary"
    assert "frontend/src/product.ts" not in manifest.by_path()


def test_scoped_manifest_excludes_state_runtime_caches_logs_secrets_and_product_data(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    tools = root / "tools"
    tools.mkdir(parents=True)
    (tools / "source.py").write_text("value = 1\n", encoding="utf-8")
    (tools / ".env.example").write_text("TOKEN=\n", encoding="utf-8")
    protected_files = {
        ".tooling-state/state.toml": "state",
        ".git/config": "git",
        ".runtime/logs/run.log": "runtime",
        ".venv/bin/python": "venv",
        "__pycache__/source.pyc": "cache",
        ".cache/result.json": "cache",
        "logs/tooling.log": "log",
        "target/release/tool": "target",
        "data/customer.json": "product data",
        "uploads/avatar.png": "product data",
        "secrets/token.txt": "secret",
        "credentials.json": "secret",
        ".env.production": "secret",
        "private.pem": "secret",
        "customer.sqlite3": "product data",
    }
    for relative, content in protected_files.items():
        path = tools / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    manifest = create_manifest(root, scope="tools")

    assert tuple(manifest.by_path()) == ("tools/.env.example", "tools/source.py")
    assert not set(protected_files) & {
        path.removeprefix("tools/") for path in manifest.by_path()
    }


@pytest.mark.parametrize(
    "relative",
    (
        ".tooling-state/state.toml",
        "tools/.runtime/run.json",
        "tools/.venv/bin/python",
        "tools/__pycache__/module.pyc",
        "tools/target/release/app",
        "tools/logs/run.log",
        "tools/data/customer.json",
        "tools/secrets/token.txt",
        "tools/.env",
        "tools/customer.sqlite3",
    ),
)
def test_explicit_manifest_rejects_protected_paths(
    tmp_path: Path, relative: str
) -> None:
    root = tmp_path / "project"
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("protected\n", encoding="utf-8")

    with pytest.raises(ManifestError, match="protected"):
        create_manifest(root, managed_paths=(relative,))


def test_empty_scopes_are_bound_into_the_manifest_digest(tmp_path: Path) -> None:
    root = tmp_path / "project"
    (root / "tools").mkdir(parents=True)
    (root / "docs/toolingdocs").mkdir(parents=True)

    tools = create_manifest(root, scope="tools")
    docs = create_manifest(root, scope="docs/toolingdocs")

    assert not tools.files and not docs.files
    assert tools.digest != docs.digest


def test_manifest_rejects_case_colliding_paths(
    tmp_path: Path,
    case_sensitive_filesystem: None,
) -> None:
    root = tmp_path / "project"
    (root / "tools").mkdir(parents=True)
    (root / "tools/A").write_text("one\n", encoding="utf-8")
    (root / "tools/a").write_text("two\n", encoding="utf-8")

    with pytest.raises(ManifestError, match="unique"):
        create_manifest(root, scope="tools")


def test_manifest_write_load_and_tamper_detection(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    _write_project(root)
    manifest = create_manifest(root, scope="tools")
    path = root / ".tooling-state/managed.json"

    write_manifest(path, manifest, root=root)
    first = path.read_bytes()
    write_manifest(path, manifest, root=root)

    assert load_manifest(path, root=root) == manifest
    assert path.read_bytes() == first

    payload = manifest_to_dict(manifest)
    payload["digest"] = "sha256:" + "0" * 64
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ManifestError, match="digest mismatch"):
        load_manifest(path, root=root)


def test_manifest_rejects_schema_path_scope_and_file_tampering(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    _write_project(root)
    manifest = create_manifest(root, scope="tools")
    entry = manifest.files[0]

    invalid = (
        replace(manifest, schema_version=MANIFEST_SCHEMA_VERSION + 1),
        ManagedManifest(
            MANIFEST_SCHEMA_VERSION,
            "scope",
            ("tools",),
            (replace(entry, path="../outside"),),
            manifest.digest,
        ),
        replace(manifest, managed_paths=("tools", "tools/nested")),
        replace(manifest, files=(replace(entry, sha256="bad"),)),
    )
    for value in invalid:
        with pytest.raises(ManifestError):
            validate_manifest(value)


def test_manifest_rejects_directories_in_path_mode_and_files_in_scope_mode(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    _write_project(root)

    with pytest.raises(ManifestError, match="file, not a directory"):
        create_manifest(root, managed_paths=("tools",))
    with pytest.raises(ManifestError, match="must identify a directory"):
        create_manifest(root, scope="tools/alpha.txt")


def test_manifest_rejects_external_and_broken_scope_symlinks(tmp_path: Path) -> None:
    root = tmp_path / "project"
    external = tmp_path / "external"
    (root / "tools").mkdir(parents=True)
    external.mkdir()
    (external / "secret.txt").write_text("secret\n", encoding="utf-8")
    link = root / "tools/linked.txt"
    try:
        link.symlink_to(external / "secret.txt")
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(ManifestError, match="outside the project root"):
        create_manifest(root, scope="tools")

    link.unlink()
    link.symlink_to(root / "tools/missing.txt")
    with pytest.raises(ManifestError, match="broken symbolic link"):
        create_manifest(root, scope="tools")


def test_manifest_allows_internal_links_but_not_links_outside_declared_scope(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    (root / "tools").mkdir(parents=True)
    (root / "frontend").mkdir()
    (root / "tools/target.txt").write_text("managed\n", encoding="utf-8")
    (root / "frontend/product.txt").write_text("product\n", encoding="utf-8")
    internal = root / "tools/internal.txt"
    cross_scope = root / "tools/product.txt"
    try:
        internal.symlink_to("target.txt")
        cross_scope.symlink_to(root / "frontend/product.txt")
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(ManifestError, match="outside its declared scope"):
        create_manifest(root, scope="tools")

    cross_scope.unlink()
    manifest = create_manifest(root, scope="tools")
    assert manifest.by_path()["tools/internal.txt"].kind == "symlink"


def test_manifest_rejects_a_benignly_named_symlink_to_a_protected_path(
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    (root / "tools/secrets").mkdir(parents=True)
    (root / "tools/secrets/token.txt").write_text("secret\n", encoding="utf-8")
    alias = root / "tools/config.txt"
    try:
        alias.symlink_to("secrets/token.txt")
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(ManifestError, match="protected path"):
        create_manifest(root, scope="tools")


def test_manifest_load_never_follows_a_manifest_symlink(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    _write_project(root)
    manifest = create_manifest(root, scope="tools")
    external = tmp_path / "external.json"
    write_manifest(external, manifest)
    linked = root / "managed.json"
    try:
        linked.symlink_to(external)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(ManifestError, match="symbolic link"):
        load_manifest(linked, root=root)
