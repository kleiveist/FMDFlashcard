from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from tools.core import portable_payload as payload_module
from tools.core.portable_payload import (
    PAYLOAD_MANIFEST_NAME,
    PortablePayloadError,
    load_portable_payload_manifest,
    validate_portable_payload,
    write_portable_payload_manifest,
)


def _payload(tmp_path: Path, version: str = "0.2.0") -> tuple[Path, Path, Path]:
    root = tmp_path / "project"
    tools = root / "tools"
    docs = root / "docs" / "toolingdocs"
    tools.mkdir(parents=True)
    docs.mkdir(parents=True)
    (tools / "VERSION").write_text(f"{version}\n", encoding="utf-8")
    (tools / "control.py").write_text("raise SystemExit(0)\n", encoding="utf-8")
    (docs / "index.md").write_text("# Portable tooling\n", encoding="utf-8")
    return root, tools, docs


def _write(root: Path, tools: Path, docs: Path, version: str = "0.2.0") -> None:
    write_portable_payload_manifest(
        project_root=root,
        tools_root=tools,
        docs_root=docs,
        tooling_version=version,
    )


def test_manifest_round_trip_is_deterministic_and_relocation_independent(
    tmp_path: Path,
) -> None:
    root, tools, docs = _payload(tmp_path)
    _write(root, tools, docs)
    first = (tools / PAYLOAD_MANIFEST_NAME).read_bytes()

    loaded = validate_portable_payload(
        project_root=root,
        tools_root=tools,
        docs_root=docs,
        tooling_version="0.2.0",
    )
    _write(root, tools, docs)

    assert loaded is not None
    assert first == (tools / PAYLOAD_MANIFEST_NAME).read_bytes()
    assert tuple(entry.path for entry in loaded.files) == (
        "docs/toolingdocs/index.md",
        "tools/VERSION",
        "tools/control.py",
    )


def test_manifest_identity_is_independent_of_posix_execute_bits(
    tmp_path: Path,
) -> None:
    root, tools, docs = _payload(tmp_path)
    control = tools / "control.py"
    control.chmod(0o755)
    _write(root, tools, docs)
    executable = (tools / PAYLOAD_MANIFEST_NAME).read_bytes()

    control.chmod(0o644)
    _write(root, tools, docs)
    copied_through_windows = (tools / PAYLOAD_MANIFEST_NAME).read_bytes()
    loaded = validate_portable_payload(
        project_root=root,
        tools_root=tools,
        docs_root=docs,
        tooling_version="0.2.0",
    )

    assert copied_through_windows == executable
    assert loaded is not None
    entry = next(item for item in loaded.files if item.path == "tools/control.py")
    assert entry.executable is True


@pytest.mark.parametrize("mutation", ["change", "delete", "add"])
def test_manifest_rejects_changed_missing_and_extra_payload_files(
    tmp_path: Path,
    mutation: str,
) -> None:
    root, tools, docs = _payload(tmp_path)
    _write(root, tools, docs)
    if mutation == "change":
        (docs / "index.md").write_text("tampered\n", encoding="utf-8")
    elif mutation == "delete":
        (tools / "control.py").unlink()
    else:
        (tools / "extra.py").write_text("EXTRA = True\n", encoding="utf-8")

    with pytest.raises(
        PortablePayloadError, match="differs from its consistency manifest"
    ):
        validate_portable_payload(
            project_root=root,
            tools_root=tools,
            docs_root=docs,
            tooling_version="0.2.0",
        )


def test_current_release_requires_manifest_but_legacy_release_does_not(
    tmp_path: Path,
) -> None:
    root, tools, docs = _payload(tmp_path)
    with pytest.raises(PortablePayloadError, match="requires PORTABLE-PAYLOAD.json"):
        validate_portable_payload(
            project_root=root,
            tools_root=tools,
            docs_root=docs,
            tooling_version="0.2.0",
        )

    (tools / "VERSION").write_text("0.1.0\n", encoding="utf-8")
    assert (
        validate_portable_payload(
            project_root=root,
            tools_root=tools,
            docs_root=docs,
            tooling_version="0.1.0",
        )
        is None
    )


def test_manifest_loader_rejects_duplicate_keys_and_version_mismatch(
    tmp_path: Path,
) -> None:
    root, tools, docs = _payload(tmp_path)
    _write(root, tools, docs)
    manifest = tools / PAYLOAD_MANIFEST_NAME
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    rendered = json.dumps(payload)
    manifest.write_text(
        rendered[:-1] + ',"digest":"sha256:' + "0" * 64 + '"}',
        encoding="utf-8",
    )

    with pytest.raises(PortablePayloadError, match="duplicate key"):
        load_portable_payload_manifest(manifest, tools_root=tools)

    _write(root, tools, docs)
    with pytest.raises(PortablePayloadError, match="does not match tools/VERSION"):
        validate_portable_payload(
            project_root=root,
            tools_root=tools,
            docs_root=docs,
            tooling_version="0.3.0",
        )


def test_generator_rejects_symlinks_and_protected_artifacts(
    tmp_path: Path,
) -> None:
    root, tools, docs = _payload(tmp_path)
    outside = tmp_path / "outside.txt"
    outside.write_text("outside\n", encoding="utf-8")
    try:
        os.symlink(outside, tools / "linked.py")
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are unavailable")
    with pytest.raises(PortablePayloadError, match="regular file"):
        _write(root, tools, docs)
    (tools / "linked.py").unlink()

    (tools / "__pycache__").mkdir()
    with pytest.raises(PortablePayloadError, match="protected directory"):
        _write(root, tools, docs)
    (tools / "__pycache__").rmdir()


def test_generator_rejects_case_collisions(
    tmp_path: Path,
    case_sensitive_filesystem: None,
) -> None:
    root, tools, docs = _payload(tmp_path)

    (tools / "Demo.py").write_text("A = 1\n", encoding="utf-8")
    (tools / "demo.py").write_text("A = 2\n", encoding="utf-8")
    with pytest.raises(PortablePayloadError, match="case-folding collision"):
        _write(root, tools, docs)


@pytest.mark.parametrize(
    ("relative", "is_directory"),
    (
        ("docs/toolingdocs/case-study/main.bbl", False),
        ("docs/toolingdocs/case-study/main.bcf", False),
        ("docs/toolingdocs/case-study/main.blg", False),
        ("docs/toolingdocs/case-study/main.lof", False),
        ("docs/toolingdocs/case-study/main.lot", False),
        ("docs/toolingdocs/case-study/main.run.xml", False),
        ("docs/toolingdocs/case-study/output", True),
        ("docs/toolingdocs/case-study/generated", True),
    ),
)
def test_generator_rejects_latex_outputs_and_generated_directories(
    tmp_path: Path,
    relative: str,
    is_directory: bool,
) -> None:
    root, tools, _docs = _payload(tmp_path)
    path = root / relative
    if is_directory:
        path.mkdir(parents=True)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("generated\n", encoding="utf-8")

    with pytest.raises(PortablePayloadError, match="protected"):
        _write(root, tools, _docs)


@pytest.mark.parametrize("relative", ["extra.txt", "nested/payload.bin"])
def test_runtime_dist_allows_only_the_canonical_wasm(
    tmp_path: Path,
    relative: str,
) -> None:
    root, tools, docs = _payload(tmp_path)
    runtime = tools / "quality" / "rust_analyzer" / "dist"
    runtime.mkdir(parents=True)
    (runtime / "rust_quality_analyzer.wasm").write_bytes(b"\x00asm")
    extra = runtime / relative
    extra.parent.mkdir(parents=True, exist_ok=True)
    extra.write_bytes(b"unapproved")

    with pytest.raises(PortablePayloadError, match="unapproved dist object"):
        _write(root, tools, docs)


def test_generator_fails_closed_when_a_subtree_cannot_be_walked(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root, tools, docs = _payload(tmp_path)

    def denied_walk(_root: Path, *, followlinks: bool, onerror):
        assert not followlinks
        onerror(PermissionError(13, "denied", str(tools / "hidden")))
        return ()

    monkeypatch.setattr(payload_module.os, "walk", denied_walk)

    with pytest.raises(PortablePayloadError, match="Could not traverse"):
        _write(root, tools, docs)
