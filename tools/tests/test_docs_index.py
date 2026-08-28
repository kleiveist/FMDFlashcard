from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import pytest

from tools.core.context import ProjectContext, load_context
from tools.core.filesystem import FilesystemSafetyError
from tools.core.project_config import ProjectConfig, ProjectPathConfig
from tools.inst import docs_index


def _args(script: Path, **overrides) -> argparse.Namespace:
    values = {
        "script": str(script),
        "docs_dir": None,
        "dry_run": False,
        "force": False,
        "compact": False,
        "no_backlinks": False,
        "no_readme": False,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def _page(title: str, backlink: str, index: str | None = None) -> str:
    text = f"{docs_index.BACKLINK_START}\n[← Back]({backlink})\n{docs_index.BACKLINK_END}\n# {title}\n"
    if index is not None:
        text += f"\n{docs_index.INDEX_START}\n{index}\n{docs_index.INDEX_END}\n"
    return text


def _project_context(root: Path, *, docs: str = "docs") -> ProjectContext:
    tools_root = root / "tools"
    tools_root.mkdir(parents=True, exist_ok=True)
    (tools_root / "VERSION").write_text("0.1.0\n", encoding="utf-8")
    config = ProjectConfig(
        tooling_version="0.1.0",
        project_name="Docs Fixture",
        profile="web-only",
        paths=ProjectPathConfig(docs=docs),
    )
    return load_context(root, tools_root=tools_root, config=config)


def test_generated_empty_labels_are_translated_but_authored_text_is_preserved(
    tmp_path,
) -> None:
    root = tmp_path / "project"
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    readme = root / "README.md"
    readme.write_text(
        "<!-- AUTO-GENERATED:docs-index START -->\n"
        "- ⏭️ (keine Markdown-Dateien im Projekt-Root)\n"
        "<!-- AUTO-GENERATED:docs-index END -->\n"
        "Authored phrase: keine Seiten\n",
        encoding="utf-8",
    )
    index = docs / "index.md"
    index.write_text(
        "<!-- AUTO-GENERATED:docs-index START -->\n- ⏭️ (keine Seiten)\n<!-- AUTO-GENERATED:docs-index END -->\n",
        encoding="utf-8",
    )

    assert docs_index.normalize_generated_english(root) == 1
    assert "(keine Markdown-Dateien im Projekt-Root)" in readme.read_text(
        encoding="utf-8"
    )
    assert "Authored phrase: keine Seiten" in readme.read_text(encoding="utf-8")
    assert "(no pages)" in index.read_text(encoding="utf-8")


def test_normalize_uses_explicit_repository_documentation_scope(tmp_path) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    tooling_docs = docs / "toolingdocs"
    tooling_docs.mkdir(parents=True)
    readme = root / "README.md"
    readme.write_text(
        f"{docs_index.INDEX_START}\n- ⏭️ (keine Seiten)\n{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    for path in (docs / "index.md", tooling_docs / "index.md"):
        path.write_text(
            f"{docs_index.INDEX_START}\n- ⏭️ (keine Seiten)\n{docs_index.INDEX_END}\n",
            encoding="utf-8",
        )

    assert docs_index.normalize_generated_english(root, docs_dir="docs") == 2
    assert "(no pages)" in (docs / "index.md").read_text(encoding="utf-8")
    assert "(no pages)" in (tooling_docs / "index.md").read_text(encoding="utf-8")
    assert "(keine Seiten)" in readme.read_text(encoding="utf-8")


def test_normalize_rejects_symlinked_tooling_document(tmp_path: Path) -> None:
    root = tmp_path / "project"
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    external = tmp_path / "external.md"
    original = (
        "<!-- AUTO-GENERATED:docs-index START -->\n"
        "- ⏭️ (keine Seiten)\n"
        "<!-- AUTO-GENERATED:docs-index END -->\n"
    )
    external.write_text(original, encoding="utf-8")
    (docs / "linked.md").symlink_to(external)

    with pytest.raises(FilesystemSafetyError):
        docs_index.normalize_generated_english(root)

    assert external.read_text(encoding="utf-8") == original


def test_index_command_uses_explicit_pygitindex_and_normalizes_output(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    script = tmp_path / "PyGitIndex.py"
    script.write_text("# fake", encoding="utf-8")
    (root / "README.md").write_text("# Project\n", encoding="utf-8")
    calls: list[tuple[list[str], Path]] = []

    def fake_run(
        command: list[str], cwd: Path, check: bool
    ) -> subprocess.CompletedProcess[str]:
        calls.append((command, cwd))
        (docs / "index.md").write_text(
            "<!-- AUTO-GENERATED:docs-index START -->\n- ⏭️ (keine Seiten)\n<!-- AUTO-GENERATED:docs-index END -->\n",
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(docs_index, "ROOT", root)
    monkeypatch.setattr(docs_index.subprocess, "run", fake_run)

    assert docs_index.main(_args(script)) == 0
    assert calls[0][1] == root
    assert calls[0][0][1] == str(script.resolve())
    assert calls[0][0][2:4] == ["--docs-dir", "docs/toolingdocs"]
    assert "--no-readme" in calls[0][0]
    assert "--no-root-backlinks" in calls[0][0]
    assert (root / "README.md").read_text(encoding="utf-8") == "# Project\n"
    assert "(no pages)" in (docs / "index.md").read_text(encoding="utf-8")


def test_index_dry_run_does_not_normalize_files(monkeypatch, tmp_path) -> None:
    root = tmp_path / "project"
    (root / "docs" / "toolingdocs").mkdir(parents=True)
    script = tmp_path / "PyGitIndex.py"
    script.write_text("# fake", encoding="utf-8")
    monkeypatch.setattr(docs_index, "ROOT", root)
    monkeypatch.setattr(
        docs_index.subprocess,
        "run",
        lambda command, cwd, check: subprocess.CompletedProcess(command, 0),
    )
    normalized: list[Path] = []
    monkeypatch.setattr(
        docs_index,
        "normalize_generated_english",
        lambda path: normalized.append(path) or 0,
    )

    assert docs_index.main(_args(script, dry_run=True)) == 0
    assert normalized == []


def test_navigation_check_accepts_complete_indices_and_backlinks(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    section = docs / "guide"
    section.mkdir(parents=True)
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n"
        "[Docs](docs/index.md)\n[Page](docs/page.md)\n[Guide](docs/guide/guide.md)\n"
        f"{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Page](page.md)\n[Guide](guide/guide.md)"),
        encoding="utf-8",
    )
    (docs / "page.md").write_text(_page("Page", "index.md"), encoding="utf-8")
    (section / "guide.md").write_text(
        _page("Guide", "../index.md", "- (no pages)"),
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 0


def test_repository_navigation_does_not_index_nested_index_pages(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    tooling_docs = docs / "toolingdocs"
    tooling_docs.mkdir(parents=True)
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Tooling](toolingdocs/toolingdocs.md)"),
        encoding="utf-8",
    )
    (tooling_docs / "toolingdocs.md").write_text(
        _page("Tooling", "../index.md", "- (no pages)"),
        encoding="utf-8",
    )
    (tooling_docs / "index.md").write_text(
        _page("Portable docs", "toolingdocs.md"),
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 0


def test_portable_navigation_uses_named_overview_when_present(tmp_path) -> None:
    root = tmp_path / "project"
    docs = root / "handbook" / "toolingdocs"
    section = docs / "guide"
    section.mkdir(parents=True)
    context = _project_context(root, docs="handbook")
    (docs / "toolingdocs.md").write_text(
        _page("Tooling", "index.md", "[Guide](guide/guide.md)"),
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Portable docs", "toolingdocs.md"),
        encoding="utf-8",
    )
    (section / "guide.md").write_text(
        _page("Guide", "../toolingdocs.md", "- (no pages)"),
        encoding="utf-8",
    )

    assert docs_index.check(argparse.Namespace(docs_dir=None), context=context) == 0


def test_repository_index_preserves_portable_root_backlink(tmp_path) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    tooling_docs = docs / "toolingdocs"
    tooling_docs.mkdir(parents=True)
    context = _project_context(root)
    (docs / "index.md").write_text("# Docs\n", encoding="utf-8")
    (tooling_docs / "index.md").write_text("# Portable docs\n", encoding="utf-8")
    script = tmp_path / "PyGitIndex.py"
    script.write_text("# fake", encoding="utf-8")

    def fake_run(
        command: list[str], cwd: Path, check: bool
    ) -> subprocess.CompletedProcess[str]:
        (tooling_docs / "toolingdocs.md").write_text(
            _page("Tooling", "../index.md", "- (no pages)"),
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0)

    original_run = docs_index.subprocess.run
    docs_index.subprocess.run = fake_run
    try:
        assert (
            docs_index.main(
                _args(script, docs_dir="docs"),
                context=context,
            )
            == 0
        )
    finally:
        docs_index.subprocess.run = original_run

    overview = (tooling_docs / "toolingdocs.md").read_text(encoding="utf-8")
    assert "[← Back](index.md)" in overview
    assert "[← Back](../index.md)" not in overview


def test_navigation_check_accepts_url_encoded_unicode_targets(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    page_name = "release–process.md"
    encoded_name = "release%E2%80%93process.md"
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n"
        f"[Docs](docs/index.md)\n[Release](docs/{encoded_name})\n"
        f"{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", f"[Release]({encoded_name})"),
        encoding="utf-8",
    )
    (docs / page_name).write_text(_page("Release", "index.md"), encoding="utf-8")
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 0


def test_navigation_check_reports_invalid_url_encoded_targets(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n[Docs](docs/index.md)\n[Invalid](docs/%00.md)\n{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Invalid](%00.md)"),
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_index, "ROOT", root)
    messages: list[str] = []
    monkeypatch.setattr(docs_index.logger, "fail", messages.append)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 1
    assert "generated link target is invalid: %00.md" in "\n".join(messages)


def test_navigation_check_accepts_child_pages_in_a_nested_section_index(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    section = docs / "section"
    child = section / "active"
    child.mkdir(parents=True)
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n[Docs](docs/index.md)\n"
        "[Section](docs/section/section.md)\n"
        f"{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Section](section/section.md)"),
        encoding="utf-8",
    )
    (section / "section.md").write_text(
        _page(
            "Section",
            "../index.md",
            "[Active](active/active.md)\n[ATP](active/ATP-0001.md)",
        ),
        encoding="utf-8",
    )
    (child / "active.md").write_text(
        _page("Active", "../section.md", "[ATP](ATP-0001.md)"), encoding="utf-8"
    )
    (child / "ATP-0001.md").write_text(_page("ATP", "active.md"), encoding="utf-8")
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 0


def test_navigation_check_excludes_root_markdown_pages(monkeypatch, tmp_path) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (root / "README.md").write_text("invalid generated markers", encoding="utf-8")
    (root / "AGENTS.md").write_text("also outside docs scope", encoding="utf-8")
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "- (no pages)"),
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 0


def test_navigation_check_reports_missing_and_stale_index_entries(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n[Docs](docs/index.md)\n{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Missing](missing.md)"),
        encoding="utf-8",
    )
    (docs / "page.md").write_text(_page("Page", "index.md"), encoding="utf-8")
    monkeypatch.setattr(docs_index, "ROOT", root)
    messages: list[str] = []
    monkeypatch.setattr(docs_index.logger, "fail", messages.append)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 1
    output = "\n".join(messages)
    assert "generated link target does not exist" in output
    assert "index is missing docs/page.md" in output
    assert "index has stale entries docs/missing.md" in output


def test_navigation_check_rejects_wrong_backlink(monkeypatch, tmp_path) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n[Docs](docs/index.md)\n[Page](docs/page.md)\n{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Page](page.md)"),
        encoding="utf-8",
    )
    (docs / "page.md").write_text(_page("Page", "../README.md"), encoding="utf-8")
    monkeypatch.setattr(docs_index, "ROOT", root)
    messages: list[str] = []
    monkeypatch.setattr(docs_index.logger, "fail", messages.append)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 1
    assert "backlink must target docs/index.md" in "\n".join(messages)


def test_navigation_check_ignores_escaping_link_in_root_readme(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (root / "README.md").write_text(
        f"# Project\n{docs_index.INDEX_START}\n"
        "[Docs](docs/index.md)\n[Escape](../outside.md)\n"
        f"{docs_index.INDEX_END}\n",
        encoding="utf-8",
    )
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "- (no pages)"),
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_index, "ROOT", root)
    messages: list[str] = []
    monkeypatch.setattr(docs_index.logger, "fail", messages.append)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 0
    assert messages == []


def test_navigation_check_rejects_escaping_link_inside_docs(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs"
    docs.mkdir(parents=True)
    (docs / "index.md").write_text(
        _page("Docs", "../README.md", "[Escape](../../outside.md)"),
        encoding="utf-8",
    )
    monkeypatch.setattr(docs_index, "ROOT", root)
    messages: list[str] = []
    monkeypatch.setattr(docs_index.logger, "fail", messages.append)

    assert docs_index.check(argparse.Namespace(docs_dir="docs")) == 1
    assert "generated link escapes the project root" in "\n".join(messages)


def test_default_check_is_read_only_and_ignores_root_markdown(
    monkeypatch, tmp_path
) -> None:
    root = tmp_path / "project"
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    (root / "README.md").write_text("# Product README\n", encoding="utf-8")
    (root / "NOTES.md").write_text("product notes\n", encoding="utf-8")
    (docs / "index.md").write_text(
        _page("Tooling docs", "../../README.md", "- (no pages)"),
        encoding="utf-8",
    )
    before = {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir=None)) == 0

    after = {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }
    assert after == before


def test_documentation_files_ignore_local_readmes(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    assets = docs / "assets"
    assets.mkdir(parents=True)
    (docs / "index.md").write_text("# Documentation\n", encoding="utf-8")
    (assets / "README.md").write_text("# Asset notes\n", encoding="utf-8")
    (assets / "diagram.md").write_text("# Diagram\n", encoding="utf-8")

    documents = {
        path.relative_to(docs).as_posix()
        for path in docs_index._documentation_files(docs)
    }

    assert documents == {"assets/diagram.md", "index.md"}


def test_index_uses_custom_configured_docs_root_without_touching_readme(
    tmp_path,
) -> None:
    root = tmp_path / "project"
    docs = root / "handbook" / "toolingdocs"
    docs.mkdir(parents=True)
    readme = root / "README.md"
    readme.write_text("# Product-owned\n", encoding="utf-8")
    script = tmp_path / "PyGitIndex.py"
    script.write_text("# fake", encoding="utf-8")
    context = _project_context(root, docs="handbook")
    calls: list[tuple[list[str], Path]] = []

    def fake_run(
        command: list[str], cwd: Path, check: bool
    ) -> subprocess.CompletedProcess[str]:
        calls.append((command, cwd))
        (docs / "index.md").write_text(
            f"{docs_index.INDEX_START}\n- (no pages)\n{docs_index.INDEX_END}\n",
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0)

    original_run = docs_index.subprocess.run
    docs_index.subprocess.run = fake_run
    try:
        assert docs_index.main(_args(script), context=context) == 0
    finally:
        docs_index.subprocess.run = original_run

    assert calls[0][1] == root
    assert calls[0][0][2:4] == ["--docs-dir", "handbook/toolingdocs"]
    assert "--no-readme" in calls[0][0]
    assert "--no-root-backlinks" in calls[0][0]
    assert readme.read_text(encoding="utf-8") == "# Product-owned\n"


def test_docs_scope_rejects_escape_before_invoking_index(monkeypatch, tmp_path) -> None:
    root = tmp_path / "project"
    (root / "docs" / "toolingdocs").mkdir(parents=True)
    script = tmp_path / "PyGitIndex.py"
    script.write_text("# fake", encoding="utf-8")
    monkeypatch.setattr(docs_index, "ROOT", root)
    invoked: list[bool] = []
    monkeypatch.setattr(
        docs_index.subprocess,
        "run",
        lambda *args, **kwargs: invoked.append(True),
    )

    assert docs_index.check(argparse.Namespace(docs_dir="../outside")) == 1
    assert docs_index.main(_args(script, docs_dir="../outside")) == 1
    assert invoked == []


def test_docs_scope_rejects_configured_symlink(tmp_path) -> None:
    root = tmp_path / "project"
    real_docs = root / "real-handbook" / "toolingdocs"
    real_docs.mkdir(parents=True)
    (root / "handbook").symlink_to(root / "real-handbook", target_is_directory=True)
    context = _project_context(root, docs="handbook")

    assert docs_index.check(argparse.Namespace(docs_dir=None), context=context) == 1


def test_navigation_check_rejects_nested_symlink(monkeypatch, tmp_path) -> None:
    root = tmp_path / "project"
    docs = root / "docs" / "toolingdocs"
    docs.mkdir(parents=True)
    (docs / "index.md").write_text(
        _page("Tooling docs", "../../README.md", "- (no pages)"),
        encoding="utf-8",
    )
    external = tmp_path / "external.md"
    external.write_text("secret\n", encoding="utf-8")
    (docs / "linked.md").symlink_to(external)
    monkeypatch.setattr(docs_index, "ROOT", root)

    assert docs_index.check(argparse.Namespace(docs_dir=None)) == 1
    assert external.read_text(encoding="utf-8") == "secret\n"


def test_index_command_always_disables_root_writes(tmp_path) -> None:
    script = tmp_path / "PyGitIndex.py"
    command = docs_index._command_for(
        script,
        _args(script, compact=True, no_readme=False, no_backlinks=True),
        docs_dir="docs/toolingdocs",
    )

    assert "--readme-compact-docs" not in command
    assert command.count("--no-readme") == 1
    assert command.count("--no-root-backlinks") == 1
    assert command.count("--no-docs-backlinks") == 1
