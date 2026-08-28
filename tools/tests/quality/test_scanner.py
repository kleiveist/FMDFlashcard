from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest

from tools.quality.model import QualityConfig, Severity
from tools.quality.scanner import (
    SourceScanError,
    code_line_numbers,
    discover_source_files,
    scan_file,
    size_result,
)


def _source_with_lines(count: int) -> str:
    return "\n".join(f"value_{index} = {index}" for index in range(count))


def _finding_for(result, rule_id: str):
    return next(
        (finding for finding in result.findings if finding.rule.rule_id == rule_id),
        None,
    )


@pytest.mark.parametrize(
    ("line_count", "expected"),
    [
        (0, None),
        (599, None),
        (600, None),
        (601, Severity.WARNING),
        (749, Severity.WARNING),
        (750, Severity.WARNING),
        (751, Severity.STRONG_WARNING),
        (899, Severity.STRONG_WARNING),
        (900, Severity.STRONG_WARNING),
        (901, Severity.ERROR),
    ],
)
def test_file_code_line_boundaries_are_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    line_count: int,
    expected: Severity | None,
) -> None:
    path = tmp_path / "source.py"
    path.write_text(_source_with_lines(line_count), encoding="utf-8")
    result = size_result([scan_file(path, tmp_path)], quality_config)
    finding = _finding_for(result, "CQ001")

    assert (finding.severity if finding else None) is expected
    if finding:
        assert finding.actual == line_count


def test_python_blank_and_comment_only_lines_are_not_code(tmp_path: Path) -> None:
    path = tmp_path / "sample.py"
    text = """# First line of a consecutive multiline comment.
# Second line of the comment.

value = 1  # An inline comment follows code.
"""
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset({4})


def test_python_multiline_string_is_code_not_a_comment(tmp_path: Path) -> None:
    path = tmp_path / "sample.py"
    text = '"""A module docstring\ncontinued on another line\n"""\n'
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset({1, 2, 3})


def test_invalid_python_syntax_fails_scope_scanning(tmp_path: Path) -> None:
    path = tmp_path / "invalid.py"
    path.write_text("def incomplete(:\n    pass\n", encoding="utf-8")

    with pytest.raises(SourceScanError, match="invalid Python syntax"):
        scan_file(path, tmp_path)


@pytest.mark.parametrize("suffix", [".ts", ".tsx", ".js", ".jsx"])
def test_typescript_style_multiline_comments_are_not_code(tmp_path: Path, suffix: str) -> None:
    path = tmp_path / f"sample{suffix}"
    text = """/* A block comment starts here.
 * Its middle line is comment-only.
 */
const value = 1; // Inline comments do not hide code.
/* comment */ const second = 2;
"""
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset({4, 5})


def test_rust_multiline_and_nested_comments_are_not_code(tmp_path: Path) -> None:
    path = tmp_path / "sample.rs"
    text = """/* outer comment
   /* nested Rust comment */
   still part of the outer comment
*/
fn main() {} // Inline comments do not hide code.
"""
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset({5})


def test_rust_raw_string_comment_markers_remain_code(tmp_path: Path) -> None:
    path = tmp_path / "sample.rs"
    text = 'let value = r#"/* text, not a comment */\n// still string content"#;\n'
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset({1, 2})


@pytest.mark.parametrize(
    "prefix",
    [
        "fn borrow<'a>() { let value = ",
        "fn borrow() { let value: &'static str = ",
        "fn borrow<'ä>() { let value = ",
    ],
    ids=["named-lifetime", "static-lifetime", "unicode-lifetime"],
)
@pytest.mark.parametrize(
    ("opening", "closing"),
    [('r#"first', 'last"#; }'), ('"first', 'last"; }')],
    ids=["raw-string", "ordinary-string"],
)
def test_rust_lifetime_before_multiline_string_does_not_hide_string_lines(
    tmp_path: Path,
    prefix: str,
    opening: str,
    closing: str,
) -> None:
    path = tmp_path / "sample.rs"
    text = f"{prefix}{opening}\n// string content\n/* string content */\n{closing}\n"
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset(range(1, 5))


def test_rust_character_literal_before_multiline_string_remains_a_character(
    tmp_path: Path,
) -> None:
    path = tmp_path / "sample.rs"
    text = "fn main() { let character = 'a'; let value = \"first\n// string content\nlast\"; }\n"
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset(range(1, 4))


@pytest.mark.parametrize(
    "prefix",
    [
        "fn borrow<'a>() { ",
        "fn borrow() { let value: &'static str; ",
        "fn borrow<'ä>() { ",
    ],
    ids=["named-lifetime", "static-lifetime", "unicode-lifetime"],
)
def test_rust_lifetime_before_long_block_comment_preserves_comment_state(tmp_path: Path, prefix: str) -> None:
    path = tmp_path / "sample.rs"
    comment_lines = "\n".join("comment content" for _ in range(1_000))
    text = f"{prefix}/* start\n{comment_lines}\n*/ }}\n"
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset({1, 1_002})


def test_rust_regular_multiline_string_comment_markers_remain_code(
    tmp_path: Path,
) -> None:
    path = tmp_path / "sample.rs"
    text = """fn main() {
    let value = "first line
// string content, not a comment
/* also string content */
last line";
    println!("{value}");
}"""
    path.write_text(text, encoding="utf-8")

    assert code_line_numbers(path, text) == frozenset(range(1, 8))


def test_rust_multiline_string_cannot_hide_901_code_line_error(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    path = tmp_path / "oversized.rs"
    hidden_lines = "\n".join("// string content" for _ in range(898))
    text = f'const VALUE: &str = "start\n{hidden_lines}\nend";\nfn main() {{}}'
    path.write_text(text, encoding="utf-8")

    metric = scan_file(path, tmp_path)
    finding = _finding_for(size_result([metric], quality_config), "CQ001")

    assert metric.code_lines == 901
    assert finding is not None
    assert finding.severity is Severity.ERROR


@pytest.mark.parametrize("suffix", [".py", ".tsx", ".rs"])
def test_empty_and_blank_only_files_have_zero_code_lines(tmp_path: Path, suffix: str) -> None:
    path = tmp_path / f"empty{suffix}"

    assert code_line_numbers(path, "") == frozenset()
    assert code_line_numbers(path, "\r\n\n\r") == frozenset()


LANGUAGE_LOC_CASES = [
    (
        ".py",
        (
            "# comment only\r\n\n"
            '"""module documentation\r\ncontinued"""\n'
            "from typing import TypeAlias\r\n"
            "UserId: TypeAlias = int\n"
            "def build() -> UserId:\r\n"
            "    return 1  # trailing comment\n"
            "class User:\r\n"
            "    value = build()"
        ),
        frozenset(range(3, 11)),
    ),
    (
        ".tsx",
        (
            "/* comment only\r\n * continued\n */\r\n\n"
            'import type { User } from "./user";\r\n'
            "type UserId = string;\n"
            "interface Props { id: UserId }\r\n"
            "const label = `first\nsecond`;\r\n"
            "export function Card(props: Props) {\n"
            "  return <div>{label}</div>; // trailing comment\r\n"
            "}\n"
            "class Store {}"
        ),
        frozenset(range(5, 14)),
    ),
    (
        ".rs",
        (
            "/* comment only\r\n * continued\n */\r\n\n"
            "use std::fmt;\r\n"
            "type UserId = u64;\n"
            "struct User { id: UserId }\r\n"
            'const LABEL: &str = r#"first\nsecond"#;\r\n'
            "fn build() -> User {\n"
            "    User { id: 1 } // trailing comment\r\n"
            "}"
        ),
        frozenset(range(5, 13)),
    ),
]


@pytest.mark.parametrize(("suffix", "text", "expected"), LANGUAGE_LOC_CASES)
def test_language_code_loc_matrix_handles_declarations_strings_and_line_endings(
    tmp_path: Path,
    suffix: str,
    text: str,
    expected: frozenset[int],
) -> None:
    path = tmp_path / f"matrix{suffix}"

    assert not text.endswith(("\n", "\r"))
    assert "\r\n" in text and "\n" in text
    assert code_line_numbers(path, text) == expected


@pytest.mark.parametrize(("physical_lines", "has_warning"), [(1200, False), (1201, True)])
def test_physical_line_warning_is_strictly_above_threshold(
    tmp_path: Path,
    quality_config: QualityConfig,
    physical_lines: int,
    has_warning: bool,
) -> None:
    path = tmp_path / "physical.py"
    path.write_text(
        "\n".join(["value = 1", *["# comment"] * (physical_lines - 1)]),
        encoding="utf-8",
    )
    metric = scan_file(path, tmp_path)
    finding = _finding_for(size_result([metric], quality_config), "CQ002")

    assert metric.physical_lines == physical_lines
    assert (finding is not None) is has_warning


def test_generated_dependencies_outputs_and_lockfiles_are_excluded(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    source = replace(
        quality_config.source,
        extensions=(*quality_config.source.extensions, ".lock", ".json"),
    )
    config = replace(quality_config, source=source)
    included = ["src/kept.py", "tools/tauri/build/linux.py"]
    excluded = [
        ".cache/cache.py",
        ".dist/bundle.js",
        ".git/hooks/tool.py",
        "node_modules/library.py",
        ".generated/profile/generated.ts",
        ".pytest_cache/cache.py",
        ".venv/lib/tool.py",
        "__pycache__/module.py",
        "coverage/report.js",
        "dist/output.js",
        "generated/protocol.rs",
        "target/debug/tool.rs",
        "vendor/library.py",
        "build/output.py",
        "backend/build/output.py",
        "frontend/dist/bundle.js",
        "src-tauri/gen/commands.rs",
        "src-tauri/target/debug/build.rs",
        "Cargo.lock",
        "frontend/package-lock.json",
    ]
    for relative in [*included, *excluded]:
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("value = 1\n", encoding="utf-8")

    discovered = {path.relative_to(tmp_path).as_posix() for path in discover_source_files(tmp_path, config)}

    assert discovered == set(included)


def _python_function(code_lines: int) -> str:
    body = "\n".join(f"    value_{index} = {index}" for index in range(code_lines - 1))
    return f"def measured():\n{body}\n"


def _python_class(code_lines: int) -> str:
    body = "\n".join(f"    value_{index} = {index}" for index in range(code_lines - 1))
    return f"class Measured:\n{body}\n"


@pytest.mark.parametrize(
    ("line_count", "expected"),
    [
        (50, None),
        (51, Severity.WARNING),
        (80, Severity.WARNING),
        (81, Severity.STRONG_WARNING),
        (120, Severity.STRONG_WARNING),
        (121, Severity.ERROR),
    ],
)
def test_python_function_line_boundaries_are_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    line_count: int,
    expected: Severity | None,
) -> None:
    path = tmp_path / "function.py"
    path.write_text(_python_function(line_count), encoding="utf-8")
    metric = scan_file(path, tmp_path)
    finding = _finding_for(size_result([metric], quality_config), "CQ101")

    assert metric.scopes[0].code_lines == line_count
    assert (finding.severity if finding else None) is expected


@pytest.mark.parametrize(
    ("line_count", "expected"),
    [
        (300, None),
        (301, Severity.WARNING),
        (500, Severity.WARNING),
        (501, Severity.STRONG_WARNING),
        (700, Severity.STRONG_WARNING),
        (701, Severity.ERROR),
    ],
)
def test_python_class_line_boundaries_are_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    line_count: int,
    expected: Severity | None,
) -> None:
    path = tmp_path / "class.py"
    path.write_text(_python_class(line_count), encoding="utf-8")
    metric = scan_file(path, tmp_path)
    finding = _finding_for(size_result([metric], quality_config), "CQ201")

    assert metric.scopes[0].code_lines == line_count
    assert (finding.severity if finding else None) is expected
