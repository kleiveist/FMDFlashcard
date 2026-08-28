"""Validate auditable source, evidence, parity, and optional PDF artifacts."""

from __future__ import annotations

import argparse
import os
import re
import shlex
import subprocess
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

import tomllib

try:  # Supports both direct execution and package imports in tests.
    from ._shared import (
        CASE_STUDY_ROOT,
        LANGUAGES,
        REPOSITORY_ROOT,
        CaseStudyError,
        default_output_directory,
        load_config,
        require_audited_config,
    )
    from .render_check import validate_case_study_pdf
except ImportError:  # pragma: no cover - command-line entry point.
    from _shared import (
        CASE_STUDY_ROOT,
        LANGUAGES,
        REPOSITORY_ROOT,
        CaseStudyError,
        default_output_directory,
        load_config,
        require_audited_config,
    )
    from render_check import validate_case_study_pdf

CHAPTERS = (
    "00-abstract.tex",
    "01-introduction.tex",
    "02-problem-and-initial-state.tex",
    "03-requirements-and-quality-goals.tex",
    "04-architecture.tex",
    "05-profile-and-adapter-model.tex",
    "06-integration-and-transactions.tex",
    "07-ownership-state-and-security.tex",
    "08-ci-and-system-testing.tex",
    "09-versioned-migration-case.tex",
    "10-evaluation.tex",
    "11-limitations-and-validity.tex",
    "12-conclusion-and-outlook.tex",
)
APPENDICES = (
    "a-cli-reference.tex",
    "b-profile-matrix.tex",
    "c-test-matrix.tex",
    "d-migration-evidence.tex",
    "e-reproducibility.tex",
)
DIAGRAMS = (
    "system-context.tex",
    "project-context-paths.tex",
    "profile-feature-resolution.tex",
    "adapter-orchestration.tex",
    "check-sequence.tex",
    "full-fix-transaction.tex",
    "backup-rollback.tex",
    "ownership-boundaries.tex",
    "tooling-migration.tex",
    "export-boundary.tex",
    "ci-test-pyramid.tex",
    "os-fixture-matrix.tex",
)
GENERATED_SUFFIXES = (
    ".aux",
    ".bcf",
    ".bbl",
    ".blg",
    ".fdb_latexmk",
    ".fls",
    ".lof",
    ".log",
    ".lot",
    ".out",
    ".pdf",
    ".run.xml",
    ".synctex.gz",
    ".toc",
    ".pyc",
)
LABEL = re.compile(r"\\label\{([^}]+)\}")
EVIDENCE = re.compile(r"\\evidence\{(EV-[A-Z0-9-]+)\}")
CITATION = re.compile(r"\\(?:parencite|textcite|cite)\{([^}]+)\}")
BIB_KEY = re.compile(r"^@[A-Za-z]+\{([^,]+),", re.MULTILINE)
MARKDOWN_LINK = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
TEXTTT = re.compile(r"\\texttt\{([^}]*)\}", re.DOTALL)


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def language_files(language: str) -> tuple[Path, ...]:
    root = CASE_STUDY_ROOT / "source" / language
    return (
        root / "main.tex",
        root / "metadata.tex",
        *(root / "chapters" / name for name in CHAPTERS),
        *(root / "appendices" / name for name in APPENDICES),
    )


def source_text(language: str) -> str:
    return "\n".join(_text(path) for path in language_files(language))


def _issues_for_missing(paths: Iterable[Path]) -> list[str]:
    return [
        f"missing required source: {path.relative_to(CASE_STUDY_ROOT)}"
        for path in paths
        if not path.is_file()
    ]


def verify_source_structure() -> list[str]:
    config = load_config()
    require_audited_config(config)
    required = [
        CASE_STUDY_ROOT / "README.md",
        CASE_STUDY_ROOT / "CASE-STUDY-GUIDELINES.md",
        CASE_STUDY_ROOT / "TEMPLATE-COMPATIBILITY.md",
        CASE_STUDY_ROOT / "build-config.toml",
        CASE_STUDY_ROOT / "requirements.txt",
        CASE_STUDY_ROOT / "source/common/template/NOTICE.txt",
        CASE_STUDY_ROOT / "source/common/preamble/packages.tex",
        CASE_STUDY_ROOT / "source/common/preamble/typography.tex",
        CASE_STUDY_ROOT / "source/common/preamble/pdf-metadata.tex",
        CASE_STUDY_ROOT / "source/common/macros/terminology.tex",
        CASE_STUDY_ROOT / "source/common/macros/evidence.tex",
        CASE_STUDY_ROOT / "source/common/macros/formatting.tex",
        CASE_STUDY_ROOT / "source/common/bibliography/references.bib",
        CASE_STUDY_ROOT / "source/common/shared/acronyms.tex",
        CASE_STUDY_ROOT / "source/common/shared/glossary.tex",
        CASE_STUDY_ROOT / "evidence/claims.toml",
        CASE_STUDY_ROOT / "evidence/metrics-schema.json",
        CASE_STUDY_ROOT / "evidence/releases/README.md",
        CASE_STUDY_ROOT / "assets/diagrams/README.md",
        CASE_STUDY_ROOT / "assets/images/README.md",
        CASE_STUDY_ROOT / "scripts/build.py",
        CASE_STUDY_ROOT / "scripts/clean.py",
        CASE_STUDY_ROOT / "scripts/environment.py",
        CASE_STUDY_ROOT / "scripts/verify.py",
        CASE_STUDY_ROOT / "scripts/render_check.py",
        *(CASE_STUDY_ROOT / "assets/diagrams/source" / name for name in DIAGRAMS),
        *(path for language in LANGUAGES for path in language_files(language)),
    ]
    issues = _issues_for_missing(required)
    for language in LANGUAGES:
        main = _text(CASE_STUDY_ROOT / "source" / language / "main.tex")
        metadata = _text(CASE_STUDY_ROOT / "source" / language / "metadata.tex")
        if "\\section{" in main:
            issues.append(
                f"{language} main.tex contains chapter prose instead of only orchestration"
            )
        if "\\input{metadata}" not in main or "\\printbibliography" not in main:
            issues.append(f"{language} main.tex is missing required orchestration")
        language_config = config["languages"][language]
        if str(language_config["pdf_title"]) not in metadata:
            issues.append(
                f"{language} metadata does not contain its configured PDF title"
            )
        if str(config["build"]["tooling_version"]) not in metadata:
            issues.append(
                f"{language} metadata does not contain the configured tooling version"
            )
    return issues


def _set(pattern: re.Pattern[str], text: str) -> tuple[str, ...]:
    return tuple(sorted(set(pattern.findall(text))))


def _citations(text: str) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                key.strip()
                for block in CITATION.findall(text)
                for key in block.split(",")
                if key.strip()
            }
        )
    )


def _braced_argument(text: str, position: int) -> tuple[str, int] | None:
    """Read one balanced TeX braced argument without interpreting its content."""

    cursor = position
    while cursor < len(text) and text[cursor].isspace():
        cursor += 1
    if cursor >= len(text) or text[cursor] != "{":
        return None
    start = cursor + 1
    depth = 0
    while cursor < len(text):
        character = text[cursor]
        if character == "\\":
            cursor += 2
            continue
        if character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return text[start:cursor], cursor + 1
        cursor += 1
    return None


def macro_arguments(
    text: str, name: str, count: int = 3
) -> tuple[tuple[str, ...], ...]:
    """Return balanced arguments for local case-study formatting macros."""

    marker = f"\\{name}"
    cursor = 0
    calls: list[tuple[str, ...]] = []
    while (start := text.find(marker, cursor)) >= 0:
        after_marker = start + len(marker)
        if after_marker < len(text) and text[after_marker].isalpha():
            cursor = after_marker
            continue
        arguments: list[str] = []
        position = after_marker
        for _ in range(count):
            parsed = _braced_argument(text, position)
            if parsed is None:
                break
            value, position = parsed
            arguments.append(value)
        if len(arguments) == count:
            calls.append(tuple(arguments))
            cursor = position
        else:
            cursor = after_marker
    return tuple(calls)


def _macro_labels(text: str) -> tuple[str, ...]:
    return tuple(
        call[2]
        for name in ("CaseDiagram", "CaseTable")
        for call in macro_arguments(text, name)
    )


def _references(text: str, prefix: str) -> tuple[str, ...]:
    return tuple(
        sorted(
            {
                label
                for label in re.findall(r"\\(?:ref|autoref)\{([^}]+)\}", text)
                if label.startswith(prefix)
            }
        )
    )


def verify_language_parity() -> list[str]:
    german = source_text("de")
    english = source_text("en")
    issues: list[str] = []
    parity_facts = (
        (
            "labels",
            lambda value: tuple(
                sorted(set(LABEL.findall(value)) | set(_macro_labels(value)))
            ),
        ),
        (
            "diagram sources and labels",
            lambda value: tuple(
                sorted(
                    (call[0], call[2]) for call in macro_arguments(value, "CaseDiagram")
                )
            ),
        ),
        (
            "table labels",
            lambda value: tuple(
                sorted(call[2] for call in macro_arguments(value, "CaseTable"))
            ),
        ),
        ("figure references", lambda value: _references(value, "fig:")),
        ("table references", lambda value: _references(value, "tab:")),
        ("evidence IDs", lambda value: _set(EVIDENCE, value)),
        ("bibliography keys", _citations),
    )
    for label, extractor in parity_facts:
        if extractor(german) != extractor(english):
            issues.append(f"German and English {label} differ")
    for name in CHAPTERS:
        if (
            not (CASE_STUDY_ROOT / "source/de/chapters" / name).is_file()
            or not (CASE_STUDY_ROOT / "source/en/chapters" / name).is_file()
        ):
            issues.append(f"chapter parity is incomplete: {name}")
    for name in APPENDICES:
        if (
            not (CASE_STUDY_ROOT / "source/de/appendices" / name).is_file()
            or not (CASE_STUDY_ROOT / "source/en/appendices" / name).is_file()
        ):
            issues.append(f"appendix parity is incomplete: {name}")
    return issues


def verify_cross_references() -> list[str]:
    issues: list[str] = []
    for language in LANGUAGES:
        current = source_text(language)
        labels = (*LABEL.findall(current), *_macro_labels(current))
        duplicates = sorted({label for label in labels if labels.count(label) > 1})
        issues.extend(
            f"{language} defines a duplicate label: {label}" for label in duplicates
        )
        language_labels = set(labels)
        references = set(re.findall(r"\\(?:ref|autoref)\{([^}]+)\}", current))
        missing = sorted(references - language_labels)
        issues.extend(
            f"{language} references an undefined label: {label}" for label in missing
        )
        unreferenced_figures = sorted(
            label
            for label in language_labels
            if label.startswith("fig:") and label not in references
        )
        issues.extend(
            f"{language} defines an unreferenced diagram label: {label}"
            for label in unreferenced_figures
        )
        if "undefined" in current.casefold():
            issues.append(f"{language} source contains an unresolved-reference marker")
    bibliography = _text(CASE_STUDY_ROOT / "source/common/bibliography/references.bib")
    keys = set(BIB_KEY.findall(bibliography))
    cited_keys: set[str] = set()
    for language in LANGUAGES:
        citations = set(_citations(source_text(language)))
        cited_keys.update(citations)
        missing_keys = citations - keys
        issues.extend(
            f"{language} cites an unknown bibliography key: {key}"
            for key in sorted(missing_keys)
        )
    issues.extend(
        f"bibliography key is unused: {key}" for key in sorted(keys - cited_keys)
    )
    return issues


def verify_evidence() -> list[str]:
    with (CASE_STUDY_ROOT / "evidence/claims.toml").open("rb") as stream:
        payload = tomllib.load(stream)
    claims = payload.get("claims")
    statuses = {"IMPLEMENTED", "VERIFIED", "MEASURED", "PLANNED", "LIMITATION"}
    commit_states = {"committed", "pending-next-commit"}
    issues: list[str] = []
    if not isinstance(claims, list) or not claims:
        return ["evidence claims are missing"]
    ids: list[str] = []
    for claim in claims:
        if not isinstance(claim, dict):
            issues.append("evidence claim is not a table")
            continue
        identifier = claim.get("id")
        ids.append(identifier if isinstance(identifier, str) else "")
        if not isinstance(identifier, str) or not re.fullmatch(
            r"EV-[A-Z0-9-]+", identifier
        ):
            issues.append("evidence ID is invalid")
        if claim.get("status") not in statuses:
            issues.append(f"evidence status is invalid: {identifier}")
        test_file = claim.get("test_file")
        test_name = claim.get("test_name")
        path = _evidence_test_path(test_file) if isinstance(test_file, str) else None
        if path is None or not path.is_file():
            issues.append(f"evidence test file is missing: {identifier}")
        elif not isinstance(test_name, str) or f"def {test_name}" not in _text(path):
            issues.append(f"evidence test name is missing: {identifier}")
        if claim.get("tooling_version") != payload.get("tooling_version"):
            issues.append(f"evidence tooling version is inconsistent: {identifier}")
        commit = claim.get("commit_sha")
        if not isinstance(commit, str) or not re.fullmatch(r"[0-9a-f]{40}", commit):
            issues.append(f"evidence commit SHA is invalid: {identifier}")
        commit_state = claim.get("commit_state")
        if commit_state not in commit_states:
            issues.append(f"evidence commit state is invalid: {identifier}")
        elif (
            claim.get("status") in {"VERIFIED", "MEASURED"}
            and commit_state != "committed"
        ):
            issues.append(f"completed evidence needs an immutable commit: {identifier}")
        elif claim.get("status") == "PLANNED" and commit_state != "pending-next-commit":
            issues.append(
                f"planned evidence must remain pending a commit: {identifier}"
            )
        if claim.get("status") == "MEASURED" and not claim.get("artifacts"):
            issues.append(f"measured evidence needs artifacts: {identifier}")
    if len(ids) != len(set(ids)):
        issues.append("evidence IDs are not unique")
    cited = set(EVIDENCE.findall(source_text("de"))) | set(
        EVIDENCE.findall(source_text("en"))
    )
    unknown = cited - set(ids)
    issues.extend(
        f"source cites an unknown evidence ID: {identifier}"
        for identifier in sorted(unknown)
    )
    return issues


def _evidence_test_path(test_file: str) -> Path:
    """Resolve standard evidence paths after a configured docs-directory move."""

    candidate = REPOSITORY_ROOT / test_file
    if candidate.is_file():
        return candidate
    declared = Path(test_file)
    try:
        relative = declared.relative_to("docs/toolingdocs")
    except ValueError:
        return candidate
    return CASE_STUDY_ROOT.parent / relative


def verify_no_generated_artifacts() -> list[str]:
    issues: list[str] = []
    allowed_template_files = {"NOTICE.txt", "template.md"}
    for path in CASE_STUDY_ROOT.rglob("*"):
        relative = path.relative_to(CASE_STUDY_ROOT)
        folded = relative.as_posix().casefold()
        if path.is_dir() and path.name.casefold() in {
            ".pytest_cache",
            "__pycache__",
            "build",
            "output",
            "generated",
        }:
            issues.append(f"generated directory is present: {relative}")
        if path.is_file() and (
            path.name.casefold().endswith(GENERATED_SUFFIXES)
            or path.name.casefold().startswith("_minted-")
        ):
            issues.append(f"generated artifact is present: {relative}")
        if (
            folded.startswith("source/common/template/")
            and path.is_file()
            and path.name not in allowed_template_files
        ):
            issues.append(f"unlicensed upstream template file is present: {relative}")
    return issues


def verify_markdown_links() -> list[str]:
    docs_root = CASE_STUDY_ROOT.parent
    issues: list[str] = []
    for page in docs_root.rglob("*.md"):
        text = _text(page)
        for raw in MARKDOWN_LINK.findall(text):
            target = raw.split("#", maxsplit=1)[0].strip()
            if not target or "://" in target or target.startswith(("mailto:", "#")):
                continue
            resolved = (page.parent / target).resolve()
            try:
                resolved.relative_to(REPOSITORY_ROOT)
            except ValueError:
                issues.append(
                    f"markdown link escapes the repository: {page.relative_to(REPOSITORY_ROOT)} -> {raw}"
                )
                continue
            if not resolved.exists():
                issues.append(
                    f"markdown link is missing: {page.relative_to(REPOSITORY_ROOT)} -> {raw}"
                )
    return issues


def _tex_cli_commands() -> tuple[str, ...]:
    commands = {
        " ".join(snippet.split())
        for language in LANGUAGES
        for snippet in TEXTTT.findall(source_text(language))
        if " ".join(snippet.split()).startswith("python tools/control.py")
    }
    return tuple(sorted(commands))


def verify_tex_cli_examples() -> list[str]:
    """Validate TeX appendix CLI examples against the real control entry point."""

    if str(REPOSITORY_ROOT) not in sys.path:
        sys.path.insert(0, str(REPOSITORY_ROOT))
    try:
        from tools.control_parser import build_parser
    except (
        ImportError
    ) as exc:  # pragma: no cover - indicates a broken portable payload.
        return [f"could not import the real control CLI parser: {exc}"]

    commands = _tex_cli_commands()
    if not commands:
        return ["case-study TeX sources do not document any control CLI examples"]
    parser = build_parser()
    control = REPOSITORY_ROOT / "tools/control.py"
    environment = os.environ.copy()
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    issues: list[str] = []
    for command in commands:
        try:
            arguments = shlex.split(command)
        except ValueError as exc:
            issues.append(f"TeX CLI example cannot be parsed: {command}: {exc}")
            continue
        if arguments[:2] != ["python", "tools/control.py"]:
            issues.append(f"TeX CLI example has an unexpected entry point: {command}")
            continue
        try:
            parser.parse_args(arguments[2:])
        except SystemExit as exc:
            issues.append(
                f"TeX CLI example is rejected by the parser: {command}: {exc}"
            )
            continue
        try:
            completed = subprocess.run(
                (
                    sys.executable,
                    str(control),
                    *arguments[2:],
                    "--help",
                ),
                cwd=REPOSITORY_ROOT,
                env=environment,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=20,
                shell=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            issues.append(f"TeX CLI example could not run: {command}: {exc}")
            continue
        output = f"{completed.stdout}\n{completed.stderr}".casefold()
        if completed.returncode != 0 or "usage:" not in output:
            issues.append(
                f"TeX CLI example has no live help output: {command}: exit {completed.returncode}"
            )
    return issues


def verify_published_pdfs() -> list[str]:
    config = load_config()
    output = default_output_directory(config)
    prefix = str(config["build"]["pdf_prefix"])
    published = [output / f"{prefix}-{language}.pdf" for language in LANGUAGES]
    existing = [path for path in published if path.is_file()]
    if not existing:
        return []
    issues: list[str] = []
    for language, pdf in zip(LANGUAGES, published, strict=True):
        if not pdf.is_file():
            issues.append(f"published {language} PDF is missing")
            continue
        try:
            _pages, _text_output, _renders = validate_case_study_pdf(
                pdf,
                title=str(config["languages"][language]["pdf_title"]),
                language=str(config["languages"][language]["pdf_language"]),
                tooling_version=str(config["build"]["tooling_version"]),
            )
        except CaseStudyError as exc:
            issues.append(str(exc))
            continue
    return issues


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify portable-tooling case-study sources and available PDFs."
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="validate all source and optional published-PDF checks",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    _parser().parse_args(argv)
    checks = (
        verify_source_structure,
        verify_language_parity,
        verify_cross_references,
        verify_evidence,
        verify_no_generated_artifacts,
        verify_markdown_links,
        verify_tex_cli_examples,
        verify_published_pdfs,
    )
    issues: list[str] = []
    try:
        for check in checks:
            issues.extend(check())
    except (CaseStudyError, OSError, tomllib.TOMLDecodeError) as exc:
        issues.append(str(exc))
    if issues:
        for issue in issues:
            print(f"case-study verification failed: {issue}", file=sys.stderr)
        return 1
    print("case-study source and available PDF verification passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
