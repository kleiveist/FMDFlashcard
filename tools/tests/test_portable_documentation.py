from __future__ import annotations

import argparse
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

from tools.control_parser import build_parser
from tools.core.context import load_context
from tools.inst import docs_index

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = load_context(
    project_root=REPOSITORY_ROOT,
    tools_root=REPOSITORY_ROOT / "tools",
).docs_root
SECTION_NAMES = (
    "architecture",
    "integration",
    "guides",
    "reference",
    "development",
    "acceptance",
    "case-study",
)
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
INLINE_CODE = re.compile(r"`([^`\n]+)`")
BUILD_SUFFIXES = {
    ".aux",
    ".bbl",
    ".bcf",
    ".blg",
    ".fls",
    ".fdb_latexmk",
    ".lof",
    ".log",
    ".lot",
    ".out",
    ".pdf",
    ".run.xml",
    ".toc",
}


def _markdown_files() -> tuple[Path, ...]:
    return tuple(sorted(DOCS_ROOT.rglob("*.md")))


def _link_path(page: Path, raw_target: str) -> Path | None:
    target = raw_target.strip().split(maxsplit=1)[0]
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or (not parsed.path and parsed.fragment):
        return None
    decoded = unquote(parsed.path)
    if not decoded:
        return None
    return (page.parent / decoded).resolve()


def _documented_commands(page: Path) -> tuple[str, ...]:
    text = page.read_text(encoding="utf-8")
    commands = {
        snippet.strip()
        for snippet in INLINE_CODE.findall(text)
        if snippet.strip().startswith("python tools/control.py")
    }
    in_fence = False
    continued = ""
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continued = ""
            continue
        if not in_fence:
            continue
        line = stripped.removeprefix("$ ")
        if continued:
            line = f"{continued} {line}"
        if line.endswith("\\"):
            continued = line[:-1].rstrip()
            continue
        continued = ""
        if line.startswith("python tools/control.py"):
            commands.add(line)
    return tuple(sorted(commands))


def test_portable_documentation_has_complete_section_structure() -> None:
    assert (DOCS_ROOT / "index.md").is_file()
    for name in SECTION_NAMES:
        assert (DOCS_ROOT / name / f"{name}.md").is_file()

    assert (DOCS_ROOT / "case-study" / "source" / "de" / "main.tex").is_file()
    assert (DOCS_ROOT / "case-study" / "source" / "en" / "main.tex").is_file()


def test_portable_documentation_navigation_is_consistent() -> None:
    assert docs_index.check(argparse.Namespace(docs_dir=None)) == 0


def test_all_authored_markdown_links_resolve_inside_repository() -> None:
    issues: list[str] = []
    root = REPOSITORY_ROOT.resolve()
    for page in _markdown_files():
        for raw_target in MARKDOWN_LINK.findall(page.read_text(encoding="utf-8")):
            target = _link_path(page, raw_target)
            if target is None:
                continue
            try:
                target.relative_to(root)
            except ValueError:
                issues.append(f"{page.relative_to(root)} escapes root: {raw_target}")
                continue
            if not target.exists():
                issues.append(f"{page.relative_to(root)} is missing: {raw_target}")

    assert issues == []


def test_documented_control_commands_match_the_real_parser() -> None:
    parser = build_parser()
    commands = {
        command for page in _markdown_files() for command in _documented_commands(page)
    }
    assert commands

    issues: list[str] = []
    for command in sorted(commands):
        try:
            arguments = shlex.split(command)
            parser.parse_args(arguments[2:])
        except (ValueError, SystemExit) as exc:
            if isinstance(exc, SystemExit) and exc.code == 0:
                continue
            issues.append(f"{command}: {exc}")

    assert issues == []


def test_documented_control_commands_have_live_help_output() -> None:
    commands = {
        command for page in _markdown_files() for command in _documented_commands(page)
    }
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    issues: list[str] = []

    for command in sorted(commands):
        arguments = shlex.split(command)
        completed = subprocess.run(
            (
                sys.executable,
                str(REPOSITORY_ROOT / "tools" / "control.py"),
                *arguments[2:],
                "--help",
            ),
            cwd=REPOSITORY_ROOT,
            env=environment,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            check=False,
            timeout=20,
        )
        output = f"{completed.stdout}\n{completed.stderr}".casefold()
        if completed.returncode != 0 or "usage:" not in output:
            issues.append(
                f"{command}: exit {completed.returncode}; {output.strip()[-500:]}"
            )

    assert issues == []


def test_documentation_tree_contains_no_placeholders_or_build_outputs() -> None:
    placeholders = sorted(DOCS_ROOT.rglob(".gitkeep"))
    build_outputs = sorted(
        path
        for path in DOCS_ROOT.rglob("*")
        if path.is_file()
        and (
            path.suffix.casefold() in BUILD_SUFFIXES
            or path.name.casefold().endswith(".synctex.gz")
        )
    )

    assert placeholders == []
    assert build_outputs == []


@pytest.mark.parametrize("language", ("de", "en"))
def test_case_study_sources_are_new_portable_tooling_documents(language: str) -> None:
    source = (DOCS_ROOT / "case-study" / "source" / language / "main.tex").read_text(
        encoding="utf-8"
    )
    normalized = source.casefold()

    assert "portable" in normalized
    assert "tooling" in normalized
    assert "template-projekte" not in normalized
