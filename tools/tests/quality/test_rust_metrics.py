from __future__ import annotations

from pathlib import Path

import pytest

from tools.quality.model import QualityConfig, Severity
from tools.quality.rust import rust_metrics_result
from tools.quality.scanner import SourceScanError, scan_file, size_result


def _finding(metric, config: QualityConfig, rule_id: str):
    result = rust_metrics_result([metric], config)
    return next((finding for finding in result.findings if finding.rule.rule_id == rule_id), None)


def _rust_function(code_lines: int) -> str:
    statements = "\n".join(f"    let value_{index} = {index};" for index in range(code_lines - 2))
    return f"fn measured() {{\n{statements}\n}}\n"


def _rust_struct(code_lines: int) -> str:
    fields = "\n".join(f"    value_{index}: usize," for index in range(code_lines - 2))
    return f"struct Measured {{\n{fields}\n}}\n"


def test_rust_metrics_accept_uppercase_source_suffix(tmp_path: Path, quality_config: QualityConfig) -> None:
    path = tmp_path / "measured.RS"
    path.write_text("fn measured() {}\n", encoding="utf-8")

    result = rust_metrics_result([scan_file(path, tmp_path)], quality_config)

    assert result.files_checked == 1
    assert result.detail == ""


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
def test_rust_function_line_boundaries_use_scanned_code_lines(
    tmp_path: Path,
    quality_config: QualityConfig,
    line_count: int,
    expected: Severity | None,
) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(_rust_function(line_count), encoding="utf-8")

    metric = scan_file(path, tmp_path)
    finding = next(
        (item for item in size_result([metric], quality_config).findings if item.rule.rule_id == "CQ101"), None
    )

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
def test_rust_struct_line_boundaries_use_scanned_code_lines(
    tmp_path: Path,
    quality_config: QualityConfig,
    line_count: int,
    expected: Severity | None,
) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(_rust_struct(line_count), encoding="utf-8")

    metric = scan_file(path, tmp_path)
    finding = next(
        (item for item in size_result([metric], quality_config).findings if item.rule.rule_id == "CQ201"), None
    )

    assert metric.scopes[0].code_lines == line_count
    assert (finding.severity if finding else None) is expected


@pytest.mark.parametrize(
    ("complexity", "expected"),
    [
        (10, None),
        (11, Severity.WARNING),
        (15, Severity.WARNING),
        (16, Severity.STRONG_WARNING),
        (20, Severity.STRONG_WARNING),
        (21, Severity.ERROR),
    ],
)
def test_rust_cyclomatic_complexity_boundaries_are_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    complexity: int,
    expected: Severity | None,
) -> None:
    branches = "\n".join("    if true { value += 1; }" for _ in range(complexity - 1))
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured() {{\n    let mut value = 0;\n{branches}\n}}\n", encoding="utf-8")

    finding = _finding(scan_file(path, tmp_path), quality_config, "CQ102")

    assert (finding.severity if finding else None) is expected
    if finding:
        assert finding.actual == complexity


@pytest.mark.parametrize(
    ("depth", "expected"),
    [
        (3, None),
        (4, Severity.WARNING),
        (5, Severity.STRONG_WARNING),
        (6, Severity.ERROR),
    ],
)
def test_rust_nesting_boundaries_are_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    depth: int,
    expected: Severity | None,
) -> None:
    openings = "\n".join(f"{'    ' * level}if true {{" for level in range(1, depth + 1))
    closings = "\n".join(f"{'    ' * level}}}" for level in reversed(range(1, depth + 1)))
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured() {{\n{openings}\n{closings}\n}}\n", encoding="utf-8")

    finding = _finding(scan_file(path, tmp_path), quality_config, "CQ103")

    assert (finding.severity if finding else None) is expected
    if finding:
        assert finding.actual == depth


@pytest.mark.parametrize(
    ("parameters", "expected"),
    [
        (5, None),
        (6, Severity.WARNING),
        (8, Severity.WARNING),
        (9, Severity.STRONG_WARNING),
        (10, Severity.STRONG_WARNING),
        (11, Severity.ERROR),
    ],
)
def test_rust_parameter_boundaries_are_exact(
    tmp_path: Path,
    quality_config: QualityConfig,
    parameters: int,
    expected: Severity | None,
) -> None:
    signature = ", ".join(f"value_{index}: usize" for index in range(parameters))
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured({signature}) {{}}\n", encoding="utf-8")

    finding = _finding(scan_file(path, tmp_path), quality_config, "CQ104")

    assert (finding.severity if finding else None) is expected
    if finding:
        assert finding.actual == parameters


def test_rust_method_receiver_is_not_counted_as_parameter(tmp_path: Path, quality_config: QualityConfig) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "struct Service;\nimpl Service {\n    fn measured(&self, one: u8, two: u8, three: u8, four: u8, five: u8) {}\n}\n",
        encoding="utf-8",
    )

    metric = scan_file(path, tmp_path)

    assert metric.rust_functions[0].parameters == 5
    assert _finding(metric, quality_config, "CQ104") is None


def test_rust_metrics_report_stable_fields_and_ignore_inline_clippy_allow(
    tmp_path: Path, quality_config: QualityConfig
) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(f"#[allow(clippy::too_many_lines)]\n{_rust_function(121)}", encoding="utf-8")

    finding = next(
        item
        for item in size_result([scan_file(path, tmp_path)], quality_config).findings
        if item.rule.rule_id == "CQ101"
    )

    assert finding.severity is Severity.ERROR
    assert finding.path == "measured.rs"
    assert finding.symbol == "measured"
    assert finding.actual == 121
    assert finding.threshold == 120


def test_rust_macro_token_trees_and_function_pointer_types_are_not_scopes(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "macro_rules! generated { () => { fn hidden(eleven: u8) { if true {} } }; }\n"
        "type Callback = fn(u8) -> u8;\n"
        "fn measured(callback: Callback) { generated!(); callback(1); }\n",
        encoding="utf-8",
    )

    metric = scan_file(path, tmp_path)

    assert [function.symbol for function in metric.rust_functions] == ["measured"]
    assert metric.rust_functions[0].complexity == 1


def test_rust_never_type_and_unary_negation_are_not_misread_as_macros(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    conjunction = " && ".join(f"value_{index}" for index in range(11))
    parameters = ", ".join(f"value_{index}: bool" for index in range(11))
    path.write_text(
        f"fn measured({parameters}) -> ! {{\n    if !({conjunction}) {{}}\n    loop {{}}\n}}\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 13
    assert function.nesting == 1


def test_rust_generic_fn_bound_does_not_replace_the_real_parameter_list(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    extra = ", ".join(f"value_{index}: u8" for index in range(10))
    path.write_text(f"fn measured<F: Fn(u8)>(callback: F, {extra}) {{}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.parameters == 11


def test_rust_self_qualified_parameter_types_are_not_receivers(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    parameters = ", ".join(f"value_{index}: self::Value" for index in range(11))
    path.write_text(f"struct Value;\nfn measured({parameters}) {{}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.parameters == 11


def test_rust_condition_blocks_do_not_hide_nested_control_bodies(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    openings = "\n".join(f"{'    ' * level}if {{ true }} {{" for level in range(1, 7))
    closings = "\n".join(f"{'    ' * level}}}" for level in reversed(range(1, 7)))
    path.write_text(f"fn measured() {{\n{openings}\n{closings}\n}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.nesting == 6


def test_rust_array_return_type_does_not_end_function_analysis(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    branches = "\n".join("    if true {}" for _ in range(20))
    path.write_text(f"fn measured() -> [u8; 1] {{\n{branches}\n    [0]\n}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 21
    assert function.end_line == 23


def test_rust_const_generic_block_does_not_replace_struct_body(tmp_path: Path, quality_config: QualityConfig) -> None:
    fields = "\n".join(f"    value_{index}: usize," for index in range(699))
    path = tmp_path / "measured.rs"
    path.write_text(
        f"struct Measured<const N: usize = {{ std::mem::size_of::<usize>() }}> {{\n{fields}\n}}\n",
        encoding="utf-8",
    )

    metric = scan_file(path, tmp_path)
    finding = next(item for item in size_result([metric], quality_config).findings if item.rule.rule_id == "CQ201")

    assert metric.scopes[0].code_lines == 701
    assert finding.severity is Severity.ERROR


def test_nested_functions_and_closures_have_isolated_complexity(tmp_path: Path) -> None:
    nested_functions = "\n".join(f"    fn inner_{index}() {{ if true {{}} }}" for index in range(20))
    closures = "\n".join(
        f"    let _closure_{index} = |value: bool| if value {{ 1 }} else {{ 0 }};" for index in range(20)
    )
    path = tmp_path / "measured.rs"
    path.write_text(f"fn outer() {{\n{nested_functions}\n{closures}\n}}\n", encoding="utf-8")

    functions = scan_file(path, tmp_path).rust_functions
    outer = next(function for function in functions if function.symbol == "outer")
    inner = [function for function in functions if "inner_" in function.symbol]
    closure_metrics = [function for function in functions if "<closure@" in function.symbol]

    assert outer.complexity == 1
    assert len(inner) == 20
    assert all(function.complexity == 2 for function in inner)
    assert len(closure_metrics) == 20
    assert all(function.complexity == 2 for function in closure_metrics)


def test_rust_type_syntax_and_reference_operators_are_not_control_flow(tmp_path: Path) -> None:
    aliases = "\n".join(f"    type Callback{index} = for<'a> fn(&'a str);" for index in range(20))
    locals_ = "\n".join(f"    struct Local{index}<T: ?Sized>(*const T);" for index in range(20))
    references = "\n".join(f"    let _value_{index}: &&u8 = &&0;" for index in range(10))
    closures = "\n".join(f"    let _closure_{index} = || true;" for index in range(20))
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured() {{\n{aliases}\n{locals_}\n{references}\n{closures}\n}}\n", encoding="utf-8")

    functions = scan_file(path, tmp_path).rust_functions
    measured = next(function for function in functions if function.symbol == "measured")

    assert measured.complexity == 1
    assert all(function.complexity == 1 for function in functions if "<closure@" in function.symbol)


@pytest.mark.parametrize("comparison", ["1 < 2", "1 << 2"])
def test_rust_const_generic_expressions_do_not_confuse_function_parameters(tmp_path: Path, comparison: str) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "trait Enabled<const VALUE: bool> {}\n"
        f"fn measured<T: Enabled<{{ {comparison} }}>>(value: T) {{ let _ = value; }}\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.symbol == "measured"
    assert function.parameters == 1


def test_rust_generic_type_commas_are_not_parameters(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    arguments = ", ".join("u8" for _ in range(11))
    path.write_text(f"fn measured(_value: Many<{arguments}>) {{}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.parameters == 1


def test_rust_self_qualified_tuple_patterns_are_not_receivers(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    parameters = ", ".join(f"self::Value(_value_{index}): self::Value" for index in range(11))
    path.write_text(f"fn measured({parameters}) {{}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.parameters == 11


def test_rust_struct_patterns_preserve_nested_control_depth(tmp_path: Path) -> None:
    openings = "\n".join(f"{'    ' * level}if let Foo {{ value: Some(_) }} = foo {{" for level in range(1, 7))
    closings = "\n".join(f"{'    ' * level}}}" for level in reversed(range(1, 7)))
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured() {{\n{openings}\n{closings}\n}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.nesting == 6


def test_rust_symbols_include_modules_and_implementations(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "mod alpha { pub fn measured() {} }\n"
        "mod beta { pub fn measured() {} }\n"
        "struct Service;\n"
        "impl Service { fn measured(&self) {} }\n",
        encoding="utf-8",
    )

    symbols = [function.symbol for function in scan_file(path, tmp_path).rust_functions]

    assert symbols == ["alpha::measured", "beta::measured", "impl Service::measured"]


def test_async_blocks_have_isolated_complexity_and_nesting(tmp_path: Path) -> None:
    branches = "\n".join("        if true {}" for _ in range(20))
    openings = "\n".join(f"{'    ' * (level + 1)}if true {{" for level in range(1, 7))
    closings = "\n".join(f"{'    ' * (level + 1)}}}" for level in reversed(range(1, 7)))
    path = tmp_path / "measured.rs"
    path.write_text(
        f"fn measured() {{\n    let _branches = async {{\n{branches}\n    }};\n"
        f"    let _nested = async {{\n{openings}\n{closings}\n    }};\n}}\n",
        encoding="utf-8",
    )

    functions = scan_file(path, tmp_path).rust_functions
    measured = next(function for function in functions if function.symbol == "measured")
    async_functions = [function for function in functions if "<async@" in function.symbol]

    assert measured.complexity == 1
    assert [function.complexity for function in async_functions] == [21, 7]
    assert [function.nesting for function in async_functions] == [1, 6]


def test_explicitly_typed_self_parameter_is_a_receiver(tmp_path: Path) -> None:
    parameters = ", ".join(f"value_{index}: u8" for index in range(10))
    path = tmp_path / "measured.rs"
    path.write_text(
        f"struct Service; impl Service {{ fn measured(self: Box<Self>, {parameters}) {{}} }}\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.parameters == 10


def test_trait_and_foreign_function_signatures_enforce_parameters(tmp_path: Path) -> None:
    parameters = ", ".join(f"value_{index}: u8" for index in range(11))
    path = tmp_path / "measured.rs"
    path.write_text(
        f'trait Api {{ fn measured(&self, {parameters}); }}\nextern "C" {{ fn foreign({parameters}); }}\n',
        encoding="utf-8",
    )

    functions = scan_file(path, tmp_path).rust_functions

    assert [(function.symbol, function.parameters) for function in functions] == [
        ("Api::measured", 11),
        ('extern "C"::foreign', 11),
    ]
    assert all(function.complexity is None and function.nesting is None for function in functions)


def test_safe_foreign_function_signature_is_supported_for_rust_2024(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        'unsafe extern "C" { safe fn sqrt(value: f64) -> f64; unsafe fn danger(value: i32); }\n',
        encoding="utf-8",
    )

    functions = scan_file(path, tmp_path).rust_functions

    assert [(function.symbol, function.parameters) for function in functions] == [
        ('unsafe extern "C"::sqrt', 1),
        ('unsafe extern "C"::danger', 1),
    ]


@pytest.mark.parametrize(
    ("attribute_count", "expected_lines", "expected_severity"),
    [
        (116, 120, Severity.STRONG_WARNING),
        (117, 121, Severity.ERROR),
    ],
)
def test_safe_foreign_function_span_enforces_exact_line_limit(
    tmp_path: Path,
    quality_config: QualityConfig,
    attribute_count: int,
    expected_lines: int,
    expected_severity: Severity,
) -> None:
    attributes = "\n".join("#[allow(unused)]" for _ in range(attribute_count))
    path = tmp_path / "measured.rs"
    path.write_text(
        f'unsafe extern "C" {{\n safe\n fn measured(\n{attributes}\n value: u8\n );\n}}\n',
        encoding="utf-8",
    )

    metric = scan_file(path, tmp_path)
    function_scope = next(scope for scope in metric.scopes if scope.kind == "function")
    finding = next(item for item in size_result([metric], quality_config).findings if item.rule.rule_id == "CQ101")

    assert function_scope.start_line == 2
    assert function_scope.code_lines == expected_lines
    assert finding.severity is expected_severity


def test_safe_foreign_declarations_preserve_nested_closure_complexity(
    tmp_path: Path,
    quality_config: QualityConfig,
) -> None:
    branches = " ".join("if true { 1 } else { 0 };" for _ in range(20))
    array_type = f"[u8; const {{ let _c = || {{ {branches} 1 }}; 1 }}]"
    path = tmp_path / "measured.rs"
    path.write_text(
        'unsafe extern "C" {\n'
        f" safe fn f(_: {array_type});\n"
        f" unsafe fn g(_: {array_type});\n"
        f" safe static X: {array_type};\n"
        f" static Y: {array_type};\n"
        "}\n",
        encoding="utf-8",
    )

    metric = scan_file(path, tmp_path)
    findings = [
        finding for finding in rust_metrics_result([metric], quality_config).findings if finding.rule.rule_id == "CQ102"
    ]
    parents = [finding.symbol.split("::<closure@", 1)[0] for finding in findings if finding.symbol]

    assert parents == [
        'unsafe extern "C"::f',
        'unsafe extern "C"::g',
        'unsafe extern "C"::X',
        'unsafe extern "C"::Y',
    ]
    assert all(finding.actual == 21 and finding.severity is Severity.ERROR for finding in findings)


def test_safe_foreign_static_items_are_supported_for_rust_2024(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        'unsafe extern "C" { safe static VALUE: i32; safe static mut COUNTER: i32; }\n',
        encoding="utf-8",
    )

    metric = scan_file(path, tmp_path)

    assert metric.rust_functions == ()


def test_parameter_attributes_are_not_counted_as_parameters(tmp_path: Path) -> None:
    parameters = ", ".join(f"#[allow(unused)] value_{index}: u8" for index in range(6))
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured({parameters}) {{}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.parameters == 6


def test_closure_parameter_attributes_are_supported_and_not_counted(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "fn measured() { let _closure = |#[allow(unused_variables)] value: u8| value; }\n",
        encoding="utf-8",
    )

    functions = scan_file(path, tmp_path).rust_functions
    closure = next(function for function in functions if "<closure@" in function.symbol)

    assert closure.parameters == 1
    assert closure.complexity == 1


def test_duplicate_local_function_symbols_receive_source_locations(tmp_path: Path) -> None:
    parameters = ", ".join(f"value_{index}: u8" for index in range(11))
    path = tmp_path / "measured.rs"
    path.write_text(
        f"fn outer() {{\n    {{ fn measured({parameters}) {{}} }}\n    {{ fn measured({parameters}) {{}} }}\n}}\n",
        encoding="utf-8",
    )

    symbols = [
        function.symbol for function in scan_file(path, tmp_path).rust_functions if "measured" in function.symbol
    ]

    assert len(symbols) == 2
    assert len(set(symbols)) == 2
    assert all(symbol.startswith("outer::measured@") for symbol in symbols)


def test_rust_2024_let_chain_logical_paths_count_toward_complexity(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "fn measured(value: Option<u8>) { if let Some(inner) = value && inner > 0 && inner < 10 {} }\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 4


def test_rust_let_else_counts_as_a_control_path_and_nested_body(tmp_path: Path) -> None:
    alternatives = "\n".join(
        f"    let Some(_value_{index}) = values[{index}] else {{ return }};" for index in range(20)
    )
    path = tmp_path / "measured.rs"
    path.write_text(f"fn measured(values: [Option<u8>; 20]) {{\n{alternatives}\n}}\n", encoding="utf-8")

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 21
    assert function.nesting == 1


def test_rust_match_guard_adds_a_control_path(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        "fn measured(value: Option<u8>) { match value { Some(inner) if inner > 0 => 1, _ => 0 }; }\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 4


def test_rust_comments_and_strings_do_not_change_control_metrics(tmp_path: Path) -> None:
    path = tmp_path / "measured.rs"
    path.write_text(
        'fn measured() {\n    let _ordinary = "if true { while false {} }";\n'
        '    let _raw = r#"match value { one => two }"#;\n'
        "    /* if true { loop {} } */\n    // while true {}\n}\n",
        encoding="utf-8",
    )

    function = scan_file(path, tmp_path).rust_functions[0]

    assert function.complexity == 1
    assert function.nesting == 0


def test_invalid_rust_syntax_fails_the_scanner(tmp_path: Path) -> None:
    path = tmp_path / "invalid.rs"
    path.write_text("fn measured() {\n", encoding="utf-8")

    with pytest.raises(SourceScanError, match="invalid Rust syntax at line 1"):
        scan_file(path, tmp_path)


def test_safe_function_outside_unsafe_extern_block_is_invalid(tmp_path: Path) -> None:
    path = tmp_path / "invalid.rs"
    path.write_text("safe fn measured() {}\n", encoding="utf-8")

    with pytest.raises(SourceScanError, match="invalid Rust syntax"):
        scan_file(path, tmp_path)


@pytest.mark.parametrize(
    "source",
    [
        "fn measured() { let value = (1 + 2; }\n",
        "struct Measured { value: u8,\n",
        'unsafe extern "C" { safe type Value; }\n',
        "fn measured() { let closure = |#[allow(unused)]| true; }\n",
    ],
)
def test_unsupported_or_missing_rust_syntax_is_not_accepted(tmp_path: Path, source: str) -> None:
    path = tmp_path / "invalid.rs"
    path.write_text(source, encoding="utf-8")

    with pytest.raises(SourceScanError, match="invalid Rust syntax"):
        scan_file(path, tmp_path)
