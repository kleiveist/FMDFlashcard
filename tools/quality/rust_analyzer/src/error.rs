use std::fmt;

use proc_macro2::Span;

#[derive(Debug, PartialEq, Eq)]
pub struct AnalyzeError {
    line: usize,
    detail: String,
}

impl AnalyzeError {
    pub(crate) fn from_syn(error: syn::Error) -> Self {
        Self::new(error.span(), error.to_string())
    }

    pub(crate) fn unsupported(span: Span) -> Self {
        Self::new(span, "unsupported or invalid Rust syntax")
    }

    fn new(span: Span, detail: impl Into<String>) -> Self {
        Self {
            line: span.start().line.max(1),
            detail: detail.into(),
        }
    }
}

impl fmt::Display for AnalyzeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "invalid Rust syntax at line {}: {}",
            self.line, self.detail
        )
    }
}

impl std::error::Error for AnalyzeError {}
