use rust_quality_analyzer::{Analysis, analyze};

fn function<'a>(analysis: &'a Analysis, symbol: &str) -> &'a rust_quality_analyzer::FunctionMetric {
    analysis
        .functions
        .iter()
        .find(|function| function.symbol == symbol)
        .unwrap_or_else(|| panic!("missing function {symbol}"))
}

#[test]
fn reports_qualified_scopes_and_functions() {
    let source = concat!(
        "mod api {\n",
        "    struct Service;\n",
        "    impl Service { fn measured(&self) {} }\n",
        "    trait Contract { fn required(&self, value: u8); }\n",
        "    enum Choice { One }\n",
        "    union Storage { value: u8 }\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid source");
    let class_symbols = analysis
        .scopes
        .iter()
        .filter(|scope| scope.kind == "class")
        .map(|scope| scope.symbol.as_str())
        .collect::<Vec<_>>();
    let function_symbols = analysis
        .functions
        .iter()
        .map(|function| function.symbol.as_str())
        .collect::<Vec<_>>();

    assert_eq!(
        class_symbols,
        [
            "api::Service",
            "api::impl Service",
            "api::Contract",
            "api::Choice",
            "api::Storage",
        ]
    );
    assert_eq!(
        function_symbols,
        ["api::impl Service::measured", "api::Contract::required"]
    );
}

#[test]
fn computes_control_metrics_and_structured_nesting() {
    let source = concat!(
        "fn measured(value: Option<u8>, flags: (bool, bool)) -> Option<()> {\n",
        "    if flags.0 && flags.1 {\n",
        "        while flags.0 {\n",
        "            for _ in 0..1 {\n",
        "                loop { break; }\n",
        "            }\n",
        "        }\n",
        "    }\n",
        "    match value { Some(inner) if inner > 0 => {}, _ => {} };\n",
        "    let Some(_) = value else { return None };\n",
        "    unknown()?;\n",
        "    Some(())\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid syntax");
    let measured = function(&analysis, "measured");

    assert_eq!(measured.complexity, Some(11));
    assert_eq!(measured.nesting, Some(4));
    assert_eq!(measured.parameters, 2);
}

#[test]
fn isolates_nested_callable_and_macro_bodies() {
    let source = concat!(
        "macro_rules! generated { () => { fn hidden() { if true {} } }; }\n",
        "fn outer() {\n",
        "    fn inner() { if true {} }\n",
        "    let _closure = |value: bool| if value { 1 } else { 0 };\n",
        "    let _future = async { if true {} };\n",
        "    generated!();\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid source");
    let symbols = analysis
        .functions
        .iter()
        .map(|function| function.symbol.as_str())
        .collect::<Vec<_>>();

    assert_eq!(symbols.len(), 4);
    assert_eq!(symbols[0], "outer");
    assert_eq!(symbols[1], "outer::inner");
    assert!(symbols[2].starts_with("outer::<closure@4:"));
    assert!(symbols[3].starts_with("outer::<async@5:"));
    assert_eq!(analysis.functions[0].complexity, Some(1));
    assert!(
        analysis.functions[1..]
            .iter()
            .all(|item| item.complexity == Some(2))
    );
}

#[test]
fn excludes_receivers_and_counts_variadics() {
    let source = concat!(
        "struct Service;\n",
        "impl Service { fn method(self: Box<Self>, one: u8, two: u8) {} }\n",
        "trait Api { fn required(&self, one: u8); }\n",
        "extern \"C\" { fn variadic(fixed: i32, ...); }\n",
    );
    let analysis = analyze(source).expect("valid source");

    assert_eq!(function(&analysis, "impl Service::method").parameters, 2);
    assert_eq!(function(&analysis, "Api::required").parameters, 1);
    assert_eq!(function(&analysis, "extern \"C\"::variadic").parameters, 2);
}

#[test]
fn supports_safe_foreign_functions_and_ignores_safe_statics() {
    let source = concat!(
        "unsafe extern \"C\" {\n",
        "    safe fn sqrt(value: f64) -> f64;\n",
        "    unsafe fn danger(value: i32);\n",
        "    safe static VALUE: i32;\n",
        "    safe static mut COUNTER: i32;\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid Rust 2024 foreign block");
    let functions = analysis
        .functions
        .iter()
        .map(|function| (function.symbol.as_str(), function.parameters))
        .collect::<Vec<_>>();

    assert_eq!(
        functions,
        [
            ("unsafe extern \"C\"::sqrt", 1),
            ("unsafe extern \"C\"::danger", 1),
        ]
    );
    assert!(
        analysis
            .functions
            .iter()
            .all(|item| item.complexity.is_none())
    );
}

#[test]
fn safe_foreign_spans_include_safe_and_prefer_visibility() {
    let source = concat!(
        "unsafe extern \"C\" {\n",
        "    safe\n",
        "    fn measured(\n",
        "        value: u8\n",
        "    );\n",
        "    pub\n",
        "    safe fn visible();\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid Rust 2024 foreign block");
    let measured = function(&analysis, "unsafe extern \"C\"::measured");
    let visible = function(&analysis, "unsafe extern \"C\"::visible");

    assert_eq!((measured.start_line, measured.end_line), (2, 5));
    assert_eq!(measured.parameters, 1);
    assert_eq!((visible.start_line, visible.end_line), (6, 7));
}

#[test]
fn traverses_safe_and_unsafe_foreign_signatures_symmetrically() {
    let source = concat!(
        "unsafe extern \"C\" {\n",
        "    safe fn f(_: [u8; const { let _c = || if true { 1 } else { 0 }; 1 }]);\n",
        "    unsafe fn g(_: [u8; const { let _c = || if true { 1 } else { 0 }; 1 }]);\n",
        "    safe static X: [u8; const { let _c = || if true { 1 } else { 0 }; 1 }];\n",
        "    static Y: [u8; const { let _c = || if true { 1 } else { 0 }; 1 }];\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid Rust 2024 foreign declarations");
    let symbols = analysis
        .functions
        .iter()
        .map(|function| function.symbol.as_str())
        .collect::<Vec<_>>();

    assert_eq!(symbols.len(), 6);
    assert_eq!(symbols[0], "unsafe extern \"C\"::f");
    assert!(symbols[1].starts_with("unsafe extern \"C\"::f::<closure@2:"));
    assert_eq!(symbols[2], "unsafe extern \"C\"::g");
    assert!(symbols[3].starts_with("unsafe extern \"C\"::g::<closure@3:"));
    assert!(symbols[4].starts_with("unsafe extern \"C\"::X::<closure@4:"));
    assert!(symbols[5].starts_with("unsafe extern \"C\"::Y::<closure@5:"));
    assert_eq!(analysis.functions[1].complexity, Some(2));
    assert_eq!(analysis.functions[3].complexity, Some(2));
    assert_eq!(analysis.functions[4].complexity, Some(2));
    assert_eq!(analysis.functions[5].complexity, Some(2));
}

#[test]
fn disambiguates_duplicate_local_symbols() {
    let source = concat!(
        "fn outer() {\n",
        "    { fn measured() {} }\n",
        "    { fn measured() {} }\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid source");
    let duplicates = analysis
        .functions
        .iter()
        .filter(|function| function.symbol.contains("measured"))
        .map(|function| function.symbol.as_str())
        .collect::<Vec<_>>();

    assert_eq!(duplicates, ["outer::measured@2:7", "outer::measured@3:7"]);
}

#[test]
fn excludes_outer_attributes_from_function_spans() {
    let source = concat!(
        "#[allow(dead_code)]\n",
        "pub async fn measured(#[allow(unused)] value: u8) {\n",
        "    let _ = value;\n",
        "}\n",
    );
    let analysis = analyze(source).expect("valid source");
    let measured = function(&analysis, "measured");

    assert_eq!((measured.start_line, measured.end_line), (2, 4));
    assert_eq!(measured.parameters, 1);
}

#[test]
fn preserves_unicode_symbols_before_impl_and_foreign_segments() {
    let impl_analysis =
        analyze("mod café {\r\n    pub struct Δ;\r\n    impl Δ { pub fn f(&self) {} }\r\n}\r\n")
            .expect("valid Unicode impl source");
    let impl_classes = impl_analysis
        .scopes
        .iter()
        .filter(|scope| scope.kind == "class")
        .map(|scope| scope.symbol.as_str())
        .collect::<Vec<_>>();

    assert_eq!(impl_classes, ["café::Δ", "café::impl Δ"]);
    assert_eq!(function(&impl_analysis, "café::impl Δ::f").parameters, 0);

    let foreign_analysis = analyze(
        "mod αβγ{extern \"C\"{fn f();}}\n\
         type Ω=(); unsafe extern \"C\"{safe fn g()->Ω;}\n",
    )
    .expect("valid Unicode foreign source");

    assert_eq!(
        foreign_analysis
            .functions
            .iter()
            .map(|item| item.symbol.as_str())
            .collect::<Vec<_>>(),
        ["αβγ::extern \"C\"::f", "unsafe extern \"C\"::g"]
    );
}

#[test]
fn accepts_all_reported_rustc_valid_regressions() {
    let sources = [
        "pub struct S; macro_rules! make { () => ($ crate :: S); }\n",
        "fn measured() -> (u8, u8) { (#[allow(unused)] 1, 2) }\n",
        concat!(
            "struct S { a: u8, b: u8 }\n",
            "fn measured(value: S) { let S { #[allow(unused)] a: _, b: _ } = value; }\n",
        ),
        "enum Value { One, Two } fn measured(value: Value) { match value { raw @ Value::One => {}, _ => {} } }\n",
        "fn measured(value: Option<u8>) { let raw @ Some(_) = value else { return }; }\n",
        "enum Value { U8, U16 } fn measured(value: Value) { match value { raw @ (Value::U8 | Value::U16) => {} } }\n",
        "struct S<const N: i8>; fn measured(_: S<-5>) { let _ = S::<-5>; }\n",
        "fn measured() { let _ = Option::<[Option::<u8>; 2]>::None; }\n",
        "struct R<T> { a: T } fn measured(value: R<u8>) { let R::<u8> { a: _ } = value; }\n",
        "trait A {} impl A for u8 {} struct S where u8: A; fn measured() {}\n",
        "fn measured<T>() where T: {}\n",
        "trait A {} impl A for () {} fn measured() where (): A {}\n",
        "fn measured() -> char { '\u{2_FFFF}' }\n",
        "macro_rules! str { ([$value:expr]) => { $value } } fn measured() { let _ = str![[1]]; }\n",
        concat!(
            "unsafe extern \"C\" { safe fn measured(value: f64) -> f64; ",
            "safe static VALUE: i32; safe static mut COUNTER: i32; }\n",
        ),
        "type safe = (); unsafe extern \"C\" { safe fn safe() -> safe; }\n",
        "type safe = (); unsafe extern \"C\" { safe static safe: safe; }\n",
        "type safe = (); unsafe extern \"C\" { pub safe fn safe(safe: safe) -> safe; }\n",
    ];

    for source in sources {
        analyze(source).unwrap_or_else(|error| panic!("{source}: {error}"));
    }
}

#[test]
fn rejects_invalid_and_unsupported_syntax() {
    let sources = [
        "fn measured() {\n",
        "fn measured() { let value = (1 + 2; }\n",
        "struct Measured { value: u8,\n",
        "unsafe extern \"C\" { safe type Value; }\n",
        "safe fn measured() {}\n",
        "fn measured() { let closure = |#[allow(unused)]| true; }\n",
    ];

    for source in sources {
        let error = analyze(source).expect_err("invalid source must fail closed");
        assert!(
            error
                .to_string()
                .starts_with("invalid Rust syntax at line ")
        );
    }
}

#[test]
fn serializes_only_the_stable_top_level_contract() {
    let json = analyze("fn measured() {}\n")
        .expect("valid source")
        .to_json();

    assert!(json.starts_with("{\"functions\":["));
    assert!(json.contains("],\"scopes\":["));
    assert!(json.ends_with("]}"));
    assert_eq!(json.matches("\"functions\"").count(), 1);
    assert_eq!(json.matches("\"scopes\"").count(), 1);
}
