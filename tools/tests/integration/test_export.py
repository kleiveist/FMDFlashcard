from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from tools.core.filesystem import FilesystemSafetyError, safe_relative_path
from tools.core.portable_payload import PAYLOAD_MANIFEST_NAME, validate_portable_payload
from tools.integration import export as export_module
from tools.integration import service
from tools.integration.export import ExportError, ExportResult, export_portable_tooling


def _source(tmp_path: Path) -> tuple[Path, Path]:
    project = tmp_path / "source"
    tools = project / "tools"
    docs = project / "docs" / "toolingdocs"
    (tools / "integration").mkdir(parents=True)
    (tools / "resources" / "examples").mkdir(parents=True)
    (tools / "tauri" / "build").mkdir(parents=True)
    analyzer = tools / "quality" / "rust_analyzer"
    (analyzer / "dist").mkdir(parents=True)
    docs.mkdir(parents=True)
    (tools / "VERSION").write_text("0.4.0\n", encoding="utf-8")
    (tools / "control.py").write_text("raise SystemExit(0)\n", encoding="utf-8")
    (tools / PAYLOAD_MANIFEST_NAME).write_text(
        '{"stale_source_manifest":true}\n', encoding="utf-8"
    )
    (tools / "integration" / "service.py").write_text(
        "STATUS = 'portable'\n", encoding="utf-8"
    )
    (tools / "resources" / "examples" / ".env.example").write_text(
        "TOKEN=replace-me\n", encoding="utf-8"
    )
    (tools / "tauri" / "build" / "windows.py").write_text(
        "TARGET = 'windows'\n", encoding="utf-8"
    )
    (analyzer / "dist" / "rust_quality_analyzer.wasm").write_bytes(b"\x00asm")
    (docs / "index.md").write_text("# Portable tooling\n", encoding="utf-8")
    (project / "README.md").write_text("repository only\n", encoding="utf-8")
    (project / "WORKFLOW-HANDOFF.md").write_text("source only\n", encoding="utf-8")
    (project / ".template-tooling-source").write_text("source only\n", encoding="utf-8")
    return project, tools


def _file_bytes(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def test_export_is_reproducible_and_contains_only_the_portable_payload(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project, tools = _source(tmp_path)
    first_parent = tmp_path / "first"
    second_parent = tmp_path / "second"
    first_parent.mkdir()
    second_parent.mkdir()

    monkeypatch.chdir(first_parent)
    first = export_portable_tooling(tools_root=tools)
    second = export_portable_tooling(output_parent=second_parent, tools_root=tools)

    assert first.path.name == "Template-Tooling-0.4.0"
    assert first.manifest_digest == second.manifest_digest
    assert first.file_count == second.file_count
    assert _file_bytes(first.path) == _file_bytes(second.path)
    assert {path.name for path in first.path.iterdir()} == {"tools", "docs"}
    assert {path.name for path in (first.path / "docs").iterdir()} == {"toolingdocs"}
    assert not (first.path / "README.md").exists()
    assert not (first.path / "WORKFLOW-HANDOFF.md").exists()
    assert not (first.path / ".template-tooling-source").exists()
    assert (project / "README.md").read_text(encoding="utf-8") == "repository only\n"
    manifest = validate_portable_payload(
        project_root=first.path,
        tools_root=first.path / "tools",
        docs_root=first.path / "docs" / "toolingdocs",
        tooling_version="0.4.0",
    )
    assert manifest is not None
    assert manifest.digest == first.manifest_digest
    rendered = json.loads(
        (first.path / "tools" / PAYLOAD_MANIFEST_NAME).read_text(encoding="utf-8")
    )
    assert rendered["digest"] == first.manifest_digest


def test_export_resolves_a_copied_installations_configured_docs_root(
    tmp_path: Path,
) -> None:
    project, tools = _source(tmp_path)
    custom_docs = project / "handbook" / "toolingdocs"
    custom_docs.parent.mkdir()
    (project / "docs" / "toolingdocs").rename(custom_docs)
    (project / "docs").rmdir()
    (project / "project-tooling.toml").write_text(
        """schema_version = 1

[tooling]
version = "0.4.0"

[project]
name = "custom-docs"
profile = "web-only"

[paths]
frontend = "client"
backend = ""
tauri = "native"
docs = "handbook"

[features]
optional = []
""",
        encoding="utf-8",
    )
    output = tmp_path / "output"
    output.mkdir()

    result = export_portable_tooling(output_parent=output, tools_root=tools)

    assert (result.path / "docs" / "toolingdocs" / "index.md").is_file()
    assert not (result.path / "project-tooling.toml").exists()


def test_existing_destination_is_preserved_and_staging_is_cleaned(
    tmp_path: Path,
) -> None:
    _project, tools = _source(tmp_path)
    output = tmp_path / "output"
    target = output / "Template-Tooling-0.4.0"
    target.mkdir(parents=True)
    sentinel = target / "customer.txt"
    sentinel.write_text("keep\n", encoding="utf-8")

    with pytest.raises(ExportError, match="already exists"):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert sentinel.read_text(encoding="utf-8") == "keep\n"
    assert tuple(output.iterdir()) == (target,)


def test_destination_created_during_publish_is_not_replaced(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _project, tools = _source(tmp_path)
    output = tmp_path / "output"
    output.mkdir()
    target = output / "Template-Tooling-0.4.0"
    rename_no_replace = export_module._rename_no_replace

    def race(source: Path, destination: Path) -> None:
        assert destination == target
        destination.mkdir()
        (destination / "customer.txt").write_text("preserve\n", encoding="utf-8")
        rename_no_replace(source, destination)

    monkeypatch.setattr(export_module, "_rename_no_replace", race)

    with pytest.raises(ExportError, match="already exists"):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert (target / "customer.txt").read_text(encoding="utf-8") == "preserve\n"
    assert not any("staging" in path.name for path in output.iterdir())


def test_staging_swapped_during_publish_cannot_report_success(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _project, tools = _source(tmp_path)
    output = tmp_path / "output"
    output.mkdir()
    target = output / "Template-Tooling-0.4.0"
    rename_no_replace = export_module._rename_no_replace

    def swap(source: Path, destination: Path) -> None:
        original = source.with_name(f"{source.name}.moved-by-attacker")
        source.rename(original)
        source.mkdir()
        (source / "attacker.txt").write_text("not validated\n", encoding="utf-8")
        rename_no_replace(source, destination)

    monkeypatch.setattr(export_module, "_rename_no_replace", swap)

    with pytest.raises(ExportError, match="does not match the validated staging"):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert (target / "attacker.txt").read_text(encoding="utf-8") == "not validated\n"
    assert not (target / "tools" / "PORTABLE-PAYLOAD.json").exists()


def test_export_rejects_symlinks_without_publishing_a_partial_target(
    tmp_path: Path,
) -> None:
    project, tools = _source(tmp_path)
    output = tmp_path / "output"
    output.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret\n", encoding="utf-8")
    try:
        os.symlink(outside, tools / "linked.py")
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are unavailable")

    with pytest.raises(ExportError, match="regular file"):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert not (output / "Template-Tooling-0.4.0").exists()
    assert not any("staging" in path.name for path in output.iterdir())
    assert (project / "README.md").exists()


@pytest.mark.parametrize(
    ("relative", "is_directory", "message"),
    (
        ("tools/.runtime", True, "protected directory"),
        ("tools/private/.notes", False, "hidden object"),
        ("tools/config/.env.production", False, "hidden object"),
        ("tools/generated/build", True, "protected directory"),
        ("tools/cache/debug.log", False, "protected directory"),
        (
            "tools/quality/rust_analyzer/dist/extra.wasm",
            False,
            "unapproved dist object",
        ),
        ("tools/template_lifecycle", True, "old template artifact"),
        ("tools/bad?.py", False, "not portable across supported platforms"),
        ("tools/cafe\u0301.py", False, "Unsafe relative path"),
        ("tools/runtime", True, "protected directory"),
        ("tools/venv", True, "protected directory"),
        ("tools/example.egg-info", True, "protected directory"),
        ("tools/artifacts", True, "protected directory"),
        ("tools/out", True, "protected directory"),
        ("tools/generated.zip", False, "protected file"),
        ("tools/generated.whl", False, "protected file"),
        ("docs/toolingdocs/coverage.xml", False, "protected file"),
        ("docs/toolingdocs/lcov.info", False, "protected file"),
        ("docs/toolingdocs/case-study/main.bbl", False, "protected file"),
        ("docs/toolingdocs/case-study/main.bcf", False, "protected file"),
        ("docs/toolingdocs/case-study/main.blg", False, "protected file"),
        ("docs/toolingdocs/case-study/main.lof", False, "protected file"),
        ("docs/toolingdocs/case-study/main.lot", False, "protected file"),
        ("docs/toolingdocs/case-study/main.run.xml", False, "protected file"),
        ("docs/toolingdocs/case-study/output", True, "protected directory"),
        ("docs/toolingdocs/case-study/generated", True, "protected directory"),
    ),
)
def test_export_fails_closed_for_nonportable_objects(
    tmp_path: Path,
    relative: str,
    is_directory: bool,
    message: str,
) -> None:
    _project, tools = _source(tmp_path)
    output = tmp_path / "output"
    output.mkdir()
    if os.name == "nt" and relative == "tools/bad?.py":
        # NTFS refuses '?' before export can enumerate the object. Exercise the
        # exact canonical path guard used by export without weakening coverage.
        with pytest.raises(FilesystemSafetyError, match=message):
            safe_relative_path(relative)
        assert not tuple(output.iterdir())
        return
    path = tmp_path / "source" / relative
    if is_directory:
        path.mkdir(parents=True)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("not portable\n", encoding="utf-8")
    with pytest.raises(ExportError, match=message):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert not tuple(output.iterdir())


def test_export_rejects_file_and_empty_directory_case_collisions(
    tmp_path: Path,
    case_sensitive_filesystem: None,
) -> None:
    _project, tools = _source(tmp_path)
    (tools / "Demo.py").write_text("A = 1\n", encoding="utf-8")
    (tools / "demo.py").write_text("A = 2\n", encoding="utf-8")
    (tools / "Empty").mkdir()
    (tools / "empty").mkdir()
    output = tmp_path / "output"
    output.mkdir()

    with pytest.raises(ExportError, match="case-folding collision"):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert not tuple(output.iterdir())


def test_export_rejects_a_source_tree_that_changes_during_staging(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _project, tools = _source(tmp_path)
    output = tmp_path / "output"
    output.mkdir()
    copy_files = export_module._copy_manifest_files

    def copy_then_mutate(**kwargs: object) -> None:
        copy_files(**kwargs)  # type: ignore[arg-type]
        (tools / "late.py").write_text("LATE = True\n", encoding="utf-8")

    monkeypatch.setattr(export_module, "_copy_manifest_files", copy_then_mutate)

    with pytest.raises(ExportError, match="changed while the package was staged"):
        export_portable_tooling(output_parent=output, tools_root=tools)

    assert not tuple(output.iterdir())


def test_export_destination_cannot_be_nested_in_a_source_tree(tmp_path: Path) -> None:
    _project, tools = _source(tmp_path)

    with pytest.raises(ExportError, match="must not be inside"):
        export_portable_tooling(output_parent=tools, tools_root=tools)


def test_export_service_reports_success_and_failure(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    completed = ExportResult(
        path=tmp_path / "Template-Tooling-0.4.0",
        tooling_version="0.4.0",
        manifest_digest="sha256:" + "a" * 64,
        file_count=9,
    )
    monkeypatch.setattr(
        export_module, "export_portable_tooling", lambda **_kwargs: completed
    )

    assert service.run_export(output=str(tmp_path)) == 0
    success = capsys.readouterr().out
    assert "Status: EXPORTED" in success
    assert str(completed.path) in success
    assert completed.manifest_digest in success

    def fail_export(**_kwargs: object) -> ExportResult:
        raise ExportError("destination already exists")

    monkeypatch.setattr(export_module, "export_portable_tooling", fail_export)
    assert service.run_export(output=str(tmp_path)) == 1
    failure = capsys.readouterr().out
    assert "Status: FAILED" in failure
    assert "destination already exists" in failure
