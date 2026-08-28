use std::fmt::Write;

#[derive(Debug, PartialEq, Eq)]
pub struct Analysis {
    pub scopes: Vec<Scope>,
    pub functions: Vec<FunctionMetric>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Scope {
    pub kind: &'static str,
    pub symbol: String,
    pub start_line: usize,
    pub end_line: usize,
}

#[derive(Debug, PartialEq, Eq)]
pub struct FunctionMetric {
    pub symbol: String,
    pub start_line: usize,
    pub end_line: usize,
    pub complexity: Option<usize>,
    pub nesting: Option<usize>,
    pub parameters: usize,
}

impl Analysis {
    pub fn to_json(&self) -> String {
        let mut output = String::from("{\"functions\":[");
        for (index, function) in self.functions.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }
            write_function(&mut output, function);
        }
        output.push_str("],\"scopes\":[");
        for (index, scope) in self.scopes.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }
            write_scope(&mut output, scope);
        }
        output.push_str("]}");
        output
    }
}

fn write_function(output: &mut String, function: &FunctionMetric) {
    output.push_str("{\"complexity\":");
    write_optional_usize(output, function.complexity);
    write!(output, ",\"end_line\":{},\"nesting\":", function.end_line)
        .expect("writing to String cannot fail");
    write_optional_usize(output, function.nesting);
    write!(
        output,
        ",\"parameters\":{},\"start_line\":{},\"symbol\":",
        function.parameters, function.start_line
    )
    .expect("writing to String cannot fail");
    write_json_string(output, &function.symbol);
    output.push('}');
}

fn write_scope(output: &mut String, scope: &Scope) {
    output.push_str("{\"end_line\":");
    write!(output, "{}", scope.end_line).expect("writing to String cannot fail");
    output.push_str(",\"kind\":");
    write_json_string(output, scope.kind);
    write!(output, ",\"start_line\":{},\"symbol\":", scope.start_line)
        .expect("writing to String cannot fail");
    write_json_string(output, &scope.symbol);
    output.push('}');
}

fn write_optional_usize(output: &mut String, value: Option<usize>) {
    match value {
        Some(value) => write!(output, "{value}").expect("writing to String cannot fail"),
        None => output.push_str("null"),
    }
}

fn write_json_string(output: &mut String, value: &str) {
    output.push('"');
    for character in value.chars() {
        if let Some(escape) = short_escape(character) {
            output.push_str(escape);
        } else if character <= '\u{1f}' {
            write!(output, "\\u{:04x}", character as u32).expect("writing to String cannot fail");
        } else {
            output.push(character);
        }
    }
    output.push('"');
}

fn short_escape(character: char) -> Option<&'static str> {
    match character {
        '"' => Some("\\\""),
        '\\' => Some("\\\\"),
        '\u{08}' => Some("\\b"),
        '\u{0c}' => Some("\\f"),
        '\n' => Some("\\n"),
        '\r' => Some("\\r"),
        '\t' => Some("\\t"),
        _ => None,
    }
}
