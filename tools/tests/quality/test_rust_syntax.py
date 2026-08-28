from __future__ import annotations

from pathlib import Path

import pytest

from tools.quality.scanner import SourceScanError, scan_file


@pytest.mark.parametrize(
    "source",
    [
        "pub struct S; macro_rules! make { () => ($ crate :: S); }\n",
        "fn measured() -> (u8, u8) { (#[allow(unused)] 1, 2) }\n",
        ("struct S { a: u8, b: u8 }\nfn measured(value: S) { let S { #[allow(unused)] a: _, b: _ } = value; }\n"),
        "struct S<const N: i8>; fn measured(_: S<-5>) {}\n",
        "fn measured() { let _ = Option::<[Option::<u8>; 2]>::None; }\n",
        "struct R<T> { a: T } fn measured(value: R<u8>) { let R::<u8> { a: _ } = value; }\n",
        "trait A {} impl A for u8 {} struct S where u8: A; fn measured() {}\n",
        "fn measured<T>() where T: {}\n",
        "trait A {} impl A for () {} fn measured() where (): A {}\n",
        "fn measured() -> char { '\\u{2_FFFF}' }\n",
        "macro_rules! str { ([$value:expr]) => { $value } } fn measured() { let _ = str![[1]]; }\n",
        (
            'unsafe extern "C" { safe fn measured(value: f64) -> f64; '
            "safe static VALUE: i32; safe static mut COUNTER: i32; }\n"
        ),
        'type safe = (); unsafe extern "C" { safe fn safe() -> safe; }\n',
        'type safe = (); unsafe extern "C" { safe static safe: safe; }\n',
        'type safe = (); unsafe extern "C" { pub safe fn safe(safe: safe) -> safe; }\n',
    ],
)
def test_rustc_valid_parser_regressions_are_analyzed(tmp_path: Path, source: str) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(source, encoding="utf-8")

    metric = scan_file(path, tmp_path)

    assert metric.relative_path == "measured.rs"


def test_at_binding_in_match_preserves_match_arm_complexity(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "enum Value { One, Two }\nfn measured(value: Value) { match value { raw @ Value::One => {}, _ => {} } }\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 3


def test_at_binding_in_let_else_preserves_control_metrics(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "fn measured(value: Option<u8>) { let raw @ Some(_) = value else { return }; }\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 2
    assert function.nesting == 1


def test_or_pattern_at_binding_is_analyzed(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "enum Value { U8, U16, U32 }\n"
        "fn measured(value: Value) { match value { raw @ (Value::U8 | Value::U16) => {}, _ => {} } }\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 3


def test_unicode_before_impl_and_foreign_items_preserves_symbols(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        'mod café {\r\n    pub struct Δ;\r\n    impl Δ { pub fn f(&self) {} }\r\n}\r\nmod αβγ{extern "C"{fn g();}}\r\n',
        encoding="utf-8",
        newline="",
    )

    metric = scan_file(path, tmp_path)

    class_symbols = [scope.symbol for scope in metric.scopes if scope.kind == "class"]
    function_symbols = [function.symbol for function in metric.rust_functions]
    assert class_symbols == ["café::Δ", "café::impl Δ"]
    assert function_symbols == ["café::impl Δ::f", 'αβγ::extern "C"::g']


def test_subprocess_transport_is_utf8_when_child_text_stdio_is_cp1252(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("PYTHONIOENCODING", "cp1252")
    path = tmp_path / "measured.rs"
    escaped_newline = "\\" + "\n"
    path.write_text(
        f'mod café {{ struct Δ; impl Δ {{ fn λ(&self) {{ let _ = "a{escaped_newline}b"; }} }} }}\n',
        encoding="utf-8",
        newline="",
    )

    metric = scan_file(path, tmp_path)

    assert [scope.symbol for scope in metric.scopes if scope.kind == "class"] == ["café::Δ", "café::impl Δ"]
    assert [function.symbol for function in metric.rust_functions] == ["café::impl Δ::λ"]


@pytest.mark.parametrize(
    "source",
    [
        "fn measured() {\n",
        "fn measured() { let value = (1 + 2; }\n",
        "struct Measured { value: u8,\n",
        'unsafe extern "C" { safe type Value; }\n',
        "safe fn measured() {}\n",
        "fn measured() { let closure = |#[allow(unused)]| true; }\n",
    ],
)
def test_invalid_rust_remains_fail_closed(tmp_path: Path, source: str) -> None:
    path = tmp_path / "invalid.rs"
    path.write_text(source, encoding="utf-8")

    with pytest.raises(SourceScanError, match="invalid Rust syntax"):
        scan_file(path, tmp_path)
