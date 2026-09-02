"""Repository-owned documentation indexing and strict validation."""

from __future__ import annotations

import argparse
import difflib
import importlib.util
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote

from tools.paths import ProjectPaths, project_paths

START = "<!-- AUTO-GENERATED:docs-index START -->"
END = "<!-- AUTO-GENERATED:docs-index END -->"
LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$", re.MULTILINE)


class DocsError(RuntimeError):
    """Raised when documentation sources violate the repository contract."""


def _title(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem.replace("-", " ").replace("_", " ").title()


def _root_index(paths: ProjectPaths) -> str:
    top_level = [
        path
        for path in (
            paths.root / "CHANGELOG.md",
            paths.root / "CONTRIBUTING.md",
            paths.root / "SECURITY.md",
        )
        if path.is_file()
    ]
    docs = sorted(paths.docs.rglob("*.md"))
    preferred = [
        path
        for path in docs
        if path.relative_to(paths.docs).parts[0] in {"dev", "tools", "usr"}
        and len(path.relative_to(paths.docs).parts) <= 2
    ]
    lines = [START, "", "## Project documentation", ""]
    for path in top_level:
        lines.append(f"- [{_title(path)}]({path.name})")
    for path in preferred:
        relative = path.relative_to(paths.root).as_posix()
        lines.append(f"- [{_title(path)}]({relative})")
    lines.extend(["", END])
    return "\n".join(lines)


def _tools_index(paths: ProjectPaths) -> str:
    tool_root = paths.docs / "tools"
    pages = sorted(path for path in tool_root.rglob("*.md") if path != tool_root / "tools.md")
    lines = [START, "", "## Tooling documentation", ""]
    for path in pages:
        lines.append(f"- [{_title(path)}]({path.relative_to(tool_root).as_posix()})")
    lines.extend(["", END])
    return "\n".join(lines)


def _replace_generated(text: str, generated: str, path: Path) -> str:
    starts = [match.start() for match in re.finditer(re.escape(START), text)]
    ends = [match.end() for match in re.finditer(re.escape(END), text)]
    if len(starts) != 1 or len(ends) != 1 or starts[0] >= ends[0]:
        raise DocsError(f"{path} must contain exactly one ordered docs-index marker pair")
    return text[: starts[0]] + generated + text[ends[0] :]


def proposed_indexes(paths: ProjectPaths | None = None) -> dict[Path, str]:
    project = paths or project_paths()
    result: dict[Path, str] = {}
    for path, generated in (
        (project.root / "README.md", _root_index(project)),
        (project.docs / "tools" / "tools.md", _tools_index(project)),
    ):
        original = path.read_text(encoding="utf-8")
        result[path] = _replace_generated(original, generated, path)
    return result


def update_indexes(*, dry_run: bool, paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    try:
        proposals = proposed_indexes(project)
    except (OSError, DocsError) as exc:
        print(f"[FAIL] docs index: {exc}")
        return 1
    changed = False
    for path, proposed in proposals.items():
        original = path.read_text(encoding="utf-8")
        if proposed == original:
            continue
        changed = True
        if dry_run:
            print(
                "".join(
                    difflib.unified_diff(
                        original.splitlines(keepends=True),
                        proposed.splitlines(keepends=True),
                        fromfile=str(path.relative_to(project.root)),
                        tofile=str(path.relative_to(project.root)),
                    )
                ),
                end="",
            )
        else:
            path.write_text(proposed, encoding="utf-8", newline="\n")
            print(f"[OK] updated {path.relative_to(project.root)}")
    if not changed:
        print("[OK] documentation indexes are current")
    return 0


def _slug(value: str) -> str:
    text = re.sub(r"[`*_~]", "", value.strip().lower())
    text = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE)
    return re.sub(r"[\s-]+", "-", text).strip("-")


def _anchors(path: Path) -> set[str]:
    seen: dict[str, int] = {}
    anchors: set[str] = set()
    for heading in HEADING.findall(path.read_text(encoding="utf-8")):
        base = _slug(heading)
        count = seen.get(base, 0)
        anchors.add(base if count == 0 else f"{base}-{count}")
        seen[base] = count + 1
    return anchors


def _link_errors(paths: ProjectPaths) -> list[str]:
    errors: list[str] = []
    markdown_files = [
        paths.root / "README.md",
        *sorted(path for path in paths.docs.rglob("*.md") if ".archive" not in path.parts),
    ]
    for source in markdown_files:
        text = source.read_text(encoding="utf-8")
        # Markdown examples frequently teach link syntax. Code is not a navigable
        # repository reference and is deliberately excluded from link checks.
        visible_text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
        visible_text = re.sub(r"`[^`\n]*`", "", visible_text)
        for raw_target in LINK.findall(visible_text):
            target = raw_target.strip().strip("<>")
            if not target or target.startswith(("http://", "https://", "mailto:", "data:")):
                continue
            path_text, _, anchor = target.partition("#")
            if not path_text:
                destination = source
            else:
                destination = (source.parent / unquote(path_text)).resolve(strict=False)
            try:
                destination.relative_to(paths.root.resolve())
            except ValueError:
                errors.append(
                    f"{source.relative_to(paths.root)}: link escapes repository: {target}"
                )
                continue
            if not destination.exists():
                errors.append(f"{source.relative_to(paths.root)}: missing link target: {target}")
                continue
            if anchor and destination.is_file() and destination.suffix.lower() == ".md":
                if unquote(anchor).lower() not in _anchors(destination):
                    errors.append(f"{source.relative_to(paths.root)}: missing anchor: {target}")
    return errors


def _nav_errors(paths: ProjectPaths) -> list[str]:
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return ["PyYAML is required for MkDocs navigation validation"]
    payload = yaml.safe_load(paths.mkdocs.read_text(encoding="utf-8"))
    nav = payload.get("nav", []) if isinstance(payload, dict) else []
    values: list[str] = []

    def visit(item: object) -> None:
        if isinstance(item, str):
            values.append(item)
        elif isinstance(item, list):
            for child in item:
                visit(child)
        elif isinstance(item, dict):
            for child in item.values():
                visit(child)

    visit(nav)
    return [
        f"mkdocs nav target is missing: {value}"
        for value in values
        if not (paths.docs / value).is_file()
    ]


def _marker_errors(paths: ProjectPaths) -> list[str]:
    errors: list[str] = []
    for path in [paths.root / "README.md", *paths.docs.rglob("*.md")]:
        text = path.read_text(encoding="utf-8")
        if text.count("<!-- AUTO-GENERATED:") and text.count(" START -->") != text.count(
            " END -->"
        ):
            errors.append(f"{path.relative_to(paths.root)}: generated marker pairs are unbalanced")
    try:
        for path, proposed in proposed_indexes(paths).items():
            if path.read_text(encoding="utf-8") != proposed:
                errors.append(f"{path.relative_to(paths.root)}: generated docs index is stale")
    except DocsError as exc:
        errors.append(str(exc))
    return errors


def check_docs(paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    errors = [*_nav_errors(project), *_link_errors(project), *_marker_errors(project)]
    for error in errors:
        print(f"[FAIL] {error}")
    if errors:
        return 1
    if importlib.util.find_spec("mkdocs") is None:
        print("[FAIL] mkdocs is unavailable; install tools/requirements-dev.txt")
        return 1
    with tempfile.TemporaryDirectory(prefix="fmd-mkdocs-") as output:
        result = subprocess.run(
            [sys.executable, "-m", "mkdocs", "build", "--strict", "--site-dir", output],
            cwd=project.root,
            check=False,
        )
    if result.returncode != 0:
        return result.returncode
    print("[OK] navigation, links, generated indexes, and strict MkDocs build passed")
    return 0


def handle(args: argparse.Namespace) -> int:
    command = getattr(args, "docs_command", None)
    if command is None:
        args.docs_parser.print_help()
        return 0
    if command == "check":
        return check_docs()
    if command == "index":
        return update_indexes(dry_run=args.dry_run)
    return 2
