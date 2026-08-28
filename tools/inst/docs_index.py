from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

from tools import logger
from tools.core.context import ProjectContext, load_context
from tools.core.filesystem import (
    FilesystemSafetyError,
    atomic_write_text,
    read_regular_text,
    safe_join,
    safe_relative_path,
)
from tools.core.project_config import ProjectConfigError

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent
INDEX_START = "<!-- AUTO-GENERATED:docs-index START -->"
INDEX_END = "<!-- AUTO-GENERATED:docs-index END -->"
BACKLINK_START = "<!-- AUTO-GENERATED:backlink START -->"
BACKLINK_END = "<!-- AUTO-GENERATED:backlink END -->"
SCRIPT_ENV = "PYGITINDEX_PATH"
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")

ENGLISH_REPLACEMENTS = {
    "(keine Seiten)": "(no pages)",
    "(keine Markdown-Dateien im Projekt-Root)": "(no Markdown files in the project root)",
}


def _context(
    context: ProjectContext | None = None,
    *,
    project_root: Path | None = None,
) -> ProjectContext:
    """Resolve documentation paths for a target without import-time bindings."""

    if context is not None:
        return context
    return load_context(project_root=project_root or ROOT, tools_root=TOOLS_ROOT)


def _script_candidates(explicit: str | None = None) -> list[Path]:
    candidates: list[Path] = []
    configured = explicit or os.environ.get(SCRIPT_ENV)
    if configured:
        candidates.append(Path(configured).expanduser())

    for command_name in ("PyGitIndex", "PyGitIndex.py", "pygitindex"):
        command = shutil.which(command_name)
        if command:
            candidates.append(Path(command))

    candidates.extend(
        [
            Path.home() / "Dokumente" / "Python" / "bin" / "PyGit" / "PyGitIndex.py",
            Path.home() / "Documents" / "Python" / "bin" / "PyGit" / "PyGitIndex.py",
        ]
    )
    return candidates


def find_script(explicit: str | None = None) -> Path | None:
    if explicit:
        candidate = Path(explicit).expanduser()
        return candidate.resolve() if candidate.is_file() else None
    for candidate in _script_candidates(explicit):
        if candidate.is_file():
            return candidate.resolve()
    return None


def _translate_generated_block(text: str) -> str:
    pattern = re.compile(
        re.escape(INDEX_START) + r".*?" + re.escape(INDEX_END), re.DOTALL
    )

    def translate(match: re.Match[str]) -> str:
        block = match.group(0)
        for source, target in ENGLISH_REPLACEMENTS.items():
            block = block.replace(source, target)
        return block

    return pattern.sub(translate, text)


def normalize_generated_english(
    project_root: Path | None = None,
    *,
    context: ProjectContext | None = None,
    docs_dir: str | None = None,
) -> int:
    selected_context = _context(
        context,
        project_root=(project_root or ROOT).resolve(),
    )
    docs_root = _documentation_root(selected_context, docs_dir)
    if docs_root is None:
        raise FilesystemSafetyError("Configured tooling documentation root is unsafe.")
    documents = [
        (
            path,
            read_regular_text(
                path,
                root=docs_root,
                label="Tooling documentation page",
            ),
        )
        for path in _documentation_files(docs_root)
    ]
    changed = 0
    for path, original in documents:
        updated = _translate_generated_block(original)
        if updated == original:
            continue
        atomic_write_text(path, updated, root=docs_root)
        changed += 1
    return changed


def normalize_portable_root_backlink(
    *,
    context: ProjectContext,
    indexed_docs_root: Path,
) -> int:
    """Keep the generated repository hierarchy valid after portable copying."""

    portable_root = context.docs_root
    if portable_root == indexed_docs_root:
        return 0
    try:
        portable_root.relative_to(indexed_docs_root)
    except ValueError:
        return 0

    overview = portable_root / f"{portable_root.name}.md"
    portable_index = portable_root / "index.md"
    if not overview.is_file() or not portable_index.is_file():
        return 0
    original = read_regular_text(
        overview,
        root=indexed_docs_root,
        label="Portable documentation overview",
    )
    pattern = re.compile(
        re.escape(BACKLINK_START) + r".*?" + re.escape(BACKLINK_END),
        re.DOTALL,
    )
    replacement = f"{BACKLINK_START}\n[← Back](index.md)\n{BACKLINK_END}"
    updated, replacements = pattern.subn(replacement, original)
    if replacements != 1 or updated == original:
        return 0
    atomic_write_text(overview, updated, root=indexed_docs_root)
    return 1


def _generated_block(
    path: Path,
    start: str,
    end: str,
    issues: list[str],
    *,
    docs_root: Path,
) -> str | None:
    text = read_regular_text(
        path,
        root=docs_root,
        label="Tooling documentation page",
    )
    start_count = text.count(start)
    end_count = text.count(end)
    if start_count != 1 or end_count != 1:
        issues.append(
            f"{path}: expected exactly one '{start}' and one '{end}' marker (found {start_count} and {end_count})"
        )
        return None
    before, remainder = text.split(start, maxsplit=1)
    block, after = remainder.split(end, maxsplit=1)
    if end in before or start in after:
        issues.append(f"{path}: generated navigation markers are out of order")
        return None
    return block


def _resolve_markdown_target(
    path: Path, target: str, project_root: Path
) -> Path | None:
    encoded_target = target.split("#", maxsplit=1)[0].split("?", maxsplit=1)[0]
    clean_target = unquote(encoded_target, errors="strict")
    if any(ord(character) < 32 for character in clean_target):
        raise ValueError("decoded Markdown target contains a control character")
    if (
        not clean_target
        or "://" in clean_target
        or clean_target.startswith(("mailto:", "#"))
    ):
        return None
    candidate = (path.parent / clean_target).resolve()
    try:
        candidate.relative_to(project_root.resolve())
    except ValueError:
        return candidate
    return candidate


def _block_targets(
    path: Path, block: str, project_root: Path, issues: list[str]
) -> list[Path]:
    targets: list[Path] = []
    for raw_target in MARKDOWN_LINK.findall(block):
        try:
            target = _resolve_markdown_target(path, raw_target, project_root)
        except (OSError, ValueError):
            issues.append(f"{path}: generated link target is invalid: {raw_target}")
            continue
        if target is None:
            continue
        try:
            target.relative_to(project_root.resolve())
        except ValueError:
            issues.append(
                f"{path}: generated link escapes the project root: {raw_target}"
            )
            continue
        targets.append(target)
        if not target.is_file():
            issues.append(f"{path}: generated link target does not exist: {raw_target}")
    if len(targets) != len(set(targets)):
        issues.append(f"{path}: generated navigation contains a duplicate link target")
    return targets


def _directory_overview(directory: Path, docs_root: Path) -> Path:
    if directory == docs_root:
        named_overview = docs_root / f"{docs_root.name}.md"
        if named_overview.is_file():
            return named_overview
        return docs_root / "index.md"
    return directory / f"{directory.name}.md"


def _expected_index_targets(overview: Path, docs_root: Path) -> set[Path]:
    directory = overview.parent
    expected = {
        path.resolve()
        for path in directory.glob("*.md")
        if path.name not in {"README.md", "index.md"} and path != overview
    }
    child_directories = sorted(path for path in directory.iterdir() if path.is_dir())
    for child in child_directories:
        child_overview = _directory_overview(child, docs_root)
        if child_overview.is_file():
            expected.add(child_overview.resolve())
        expected.update(
            path.resolve()
            for path in child.glob("*.md")
            if path.name not in {"README.md", "index.md"} and path != child_overview
        )
    return expected


def _expected_backlink(path: Path, docs_root: Path) -> Path | None:
    if path == docs_root / "index.md":
        return None
    own_overview = _directory_overview(path.parent, docs_root)
    if path != own_overview:
        return own_overview
    parent_directory = path.parent.parent
    return _directory_overview(parent_directory, docs_root)


def _describe_targets(paths: set[Path], project_root: Path) -> str:
    return ", ".join(
        sorted(path.relative_to(project_root).as_posix() for path in paths)
    )


def _check_backlinks(
    docs_files: list[Path],
    docs_root: Path,
    project_root: Path,
    portable_root: Path,
) -> list[str]:
    issues: list[str] = []
    for path in docs_files:
        expected = _expected_backlink(path, docs_root)
        if expected is None:
            continue
        block = _generated_block(
            path,
            BACKLINK_START,
            BACKLINK_END,
            issues,
            docs_root=docs_root,
        )
        if block is None:
            continue
        actual = set(_block_targets(path, block, project_root, issues))
        expected_targets = {expected.resolve()}
        portable_index = path.parent / "index.md"
        if (
            path == portable_root / f"{portable_root.name}.md"
            and portable_index.is_file()
            and portable_index == portable_root / "index.md"
        ):
            expected_targets.add(portable_index.resolve())
        if actual not in ({target} for target in expected_targets):
            descriptions = " or ".join(
                sorted(
                    target.relative_to(project_root).as_posix()
                    for target in expected_targets
                )
            )
            issues.append(f"{path}: backlink must target {descriptions}")
    return issues


def _compare_index_targets(
    path: Path,
    actual: set[Path],
    expected: set[Path],
    project_root: Path,
) -> list[str]:
    issues: list[str] = []
    missing = expected - actual
    stale = actual - expected
    if missing:
        issues.append(
            f"{path}: index is missing {_describe_targets(missing, project_root)}"
        )
    if stale:
        issues.append(
            f"{path}: index has stale entries {_describe_targets(stale, project_root)}"
        )
    return issues


def _check_overview_indices(
    docs_files: list[Path],
    docs_root: Path,
    project_root: Path,
) -> list[str]:
    issues: list[str] = []
    overview_files = [
        path
        for path in docs_files
        if path == _directory_overview(path.parent, docs_root)
    ]
    for overview in overview_files:
        block = _generated_block(
            overview,
            INDEX_START,
            INDEX_END,
            issues,
            docs_root=docs_root,
        )
        if block is None:
            continue
        actual = set(_block_targets(overview, block, project_root, issues))
        expected = _expected_index_targets(overview, docs_root)
        if actual != expected:
            issues.extend(
                _compare_index_targets(overview, actual, expected, project_root)
            )
    return issues


def _documentation_root(
    context: ProjectContext,
    docs_dir: str | None,
) -> Path | None:
    project_root = context.project_root
    try:
        if docs_dir is None:
            relative = context.docs_root.relative_to(project_root).as_posix()
        else:
            relative = safe_relative_path(docs_dir)
        docs_root = safe_join(project_root, relative, require_exists=True)
    except (FilesystemSafetyError, ValueError) as exc:
        label = docs_dir or context.config.paths.docs + "/toolingdocs"
        logger.fail(f"Refusing unsafe documentation directory {label!r}: {exc}")
        return None
    if not docs_root.is_dir():
        logger.fail(f"Documentation directory is not a directory: {relative}")
        return None
    return docs_root


def _documentation_files(docs_root: Path) -> list[Path]:
    files: list[Path] = []
    for path in docs_root.rglob("*"):
        if path.is_symlink():
            raise FilesystemSafetyError(
                f"Tooling documentation contains a symbolic link: "
                f"{path.relative_to(docs_root).as_posix()}."
            )
        # README files document assets or local conventions.  They are deliberately
        # link-checked elsewhere, but they are not navigation pages and therefore
        # do not need generated backlink/index markers.
        if (
            path.is_file()
            and path.suffix.casefold() == ".md"
            and path.name != "README.md"
        ):
            files.append(path)
    return sorted(files)


def check(
    args: argparse.Namespace,
    *,
    context: ProjectContext | None = None,
) -> int:
    try:
        selected_context = _context(context, project_root=ROOT)
    except ProjectConfigError as exc:
        logger.fail(f"Refusing unsafe project documentation configuration: {exc}")
        return 1
    project_root = selected_context.project_root
    docs_root = _documentation_root(
        selected_context,
        getattr(args, "docs_dir", None),
    )
    if docs_root is None:
        return 1
    try:
        docs_files = _documentation_files(docs_root)
        issues = _check_backlinks(
            docs_files,
            docs_root,
            project_root,
            selected_context.docs_root,
        )
        issues.extend(_check_overview_indices(docs_files, docs_root, project_root))
    except FilesystemSafetyError as exc:
        logger.fail(f"Refusing unsafe tooling documentation path: {exc}")
        return 1

    if issues:
        for issue in issues:
            logger.fail(issue)
        logger.fail(
            f"Documentation navigation check failed with {len(issues)} issue(s)"
        )
        return 1
    logger.ok(
        f"Documentation navigation is consistent across {len(docs_files)} page(s)"
    )
    return 0


def _command_for(
    script: Path,
    args: argparse.Namespace,
    *,
    docs_dir: str,
) -> list[str]:
    command = [sys.executable, str(script), "--docs-dir", docs_dir]
    if getattr(args, "dry_run", False):
        command.append("--dry-run")
    if getattr(args, "force", False):
        command.append("--force")
    if getattr(args, "no_backlinks", False):
        command.append("--no-docs-backlinks")
    command.extend(["--no-readme", "--no-root-backlinks"])
    return command


def main(
    args: argparse.Namespace,
    *,
    context: ProjectContext | None = None,
) -> int:
    try:
        selected_context = _context(context, project_root=ROOT)
    except ProjectConfigError as exc:
        logger.fail(f"Refusing unsafe project documentation configuration: {exc}")
        return 1
    docs_root = _documentation_root(
        selected_context,
        getattr(args, "docs_dir", None),
    )
    if docs_root is None:
        return 1
    try:
        _documentation_files(docs_root)
    except FilesystemSafetyError as exc:
        logger.fail(f"Refusing unsafe tooling documentation path: {exc}")
        return 1

    script = find_script(args.script)
    if script is None:
        logger.fail("PyGitIndex was not found.")
        logger.info(
            "Set PYGITINDEX_PATH or pass '--script /path/to/PyGitIndex.py', then run this command again."
        )
        return 1

    docs_relative = docs_root.relative_to(selected_context.project_root).as_posix()
    command = _command_for(script, args, docs_dir=docs_relative)
    logger.info(f"Using PyGitIndex: {script}")
    logger.info(f"Project root: {selected_context.project_root}")
    sys.stdout.flush()
    completed = subprocess.run(
        command,
        cwd=selected_context.project_root,
        check=False,
    )
    if completed.returncode != 0:
        logger.fail(f"PyGitIndex failed with exit code {completed.returncode}")
        return completed.returncode

    if getattr(args, "dry_run", False):
        logger.ok(
            "Documentation index preview completed; no project files were changed"
        )
        return 0

    try:
        boundary_adjusted = normalize_portable_root_backlink(
            context=selected_context,
            indexed_docs_root=docs_root,
        )
        translated = normalize_generated_english(
            context=selected_context,
            docs_dir=docs_relative,
        )
    except FilesystemSafetyError as exc:
        logger.fail(f"Refusing unsafe tooling documentation path: {exc}")
        return 1
    if boundary_adjusted:
        logger.info("Preserved the portable documentation root backlink")
    if translated:
        logger.info(f"Normalized generated English labels in {translated} file(s)")
    logger.ok("Documentation indices and backlinks are up to date")
    return 0
