use std::collections::HashMap;

use proc_macro2::{LineColumn, Span, TokenStream};
use syn::spanned::Spanned;
use syn::visit::Visit;
use syn::{
    Expr, ExprAsync, ExprClosure, FnArg, ForeignItem, ForeignItemFn, ForeignItemStatic, ImplItem,
    ImplItemFn, Item, ItemEnum, ItemFn, ItemForeignMod, ItemImpl, ItemMod, ItemStruct, ItemTrait,
    ItemUnion, Pat, Signature, TraitItem, TraitItemFn, Type, TypeParamBound, Visibility,
};

use crate::error::AnalyzeError;
use crate::foreign::{SafeForeignItem, parse_safe_foreign};
use crate::metrics::{block_metrics, expression_metrics};
use crate::model::{Analysis, FunctionMetric, Scope};

pub fn analyze(source: &str) -> Result<Analysis, AnalyzeError> {
    let file = syn::parse_file(source).map_err(AnalyzeError::from_syn)?;
    let mut collector = Collector::new(source);
    collector.visit_file(&file);
    if let Some(error) = collector.error {
        return Err(error);
    }
    Ok(Analysis {
        scopes: finish_scopes(collector.classes, collector.functions.as_slice()),
        functions: finish_functions(collector.functions),
    })
}

struct RawScope {
    symbol: String,
    start_line: usize,
    end_line: usize,
    start_column: usize,
}

struct RawFunction {
    symbol: String,
    start_line: usize,
    end_line: usize,
    start_column: usize,
    complexity: Option<usize>,
    nesting: Option<usize>,
    parameters: usize,
}

struct SourceMap<'source> {
    text: &'source str,
    line_starts: Vec<usize>,
}

impl<'source> SourceMap<'source> {
    fn new(text: &'source str) -> Self {
        let mut line_starts = vec![0];
        line_starts.extend(
            text.bytes()
                .enumerate()
                .filter_map(|(index, byte)| (byte == b'\n').then_some(index + 1)),
        );
        Self { text, line_starts }
    }

    fn normalized_between(&self, start: LineColumn, end: LineColumn) -> Option<String> {
        let start = self.offset(start)?;
        let end = self.offset(end)?;
        let fragment = self.text.get(start..end)?;
        Some(fragment.split_whitespace().collect::<Vec<_>>().join(" "))
    }

    fn offset(&self, location: LineColumn) -> Option<usize> {
        let line_index = location.line.checked_sub(1)?;
        let line_start = *self.line_starts.get(line_index)?;
        let line_end = self
            .line_starts
            .get(line_index + 1)
            .copied()
            .unwrap_or(self.text.len());
        let line = self.text.get(line_start..line_end)?;
        let byte_column = line
            .char_indices()
            .map(|(index, _)| index)
            .chain(std::iter::once(line.len()))
            .nth(location.column)?;
        line_start.checked_add(byte_column)
    }
}

struct Collector<'source> {
    source: SourceMap<'source>,
    parents: Vec<String>,
    foreign_unsafety: Vec<bool>,
    classes: Vec<RawScope>,
    functions: Vec<RawFunction>,
    error: Option<AnalyzeError>,
}

impl<'source> Collector<'source> {
    fn new(source: &'source str) -> Self {
        Self {
            source: SourceMap::new(source),
            parents: Vec::new(),
            foreign_unsafety: Vec::new(),
            classes: Vec::new(),
            functions: Vec::new(),
            error: None,
        }
    }

    fn qualify(&self, segment: &str) -> String {
        if self.parents.is_empty() {
            segment.to_owned()
        } else {
            format!("{}::{segment}", self.parents.join("::"))
        }
    }

    fn with_parent(&mut self, segment: String, visit: impl FnOnce(&mut Self)) {
        self.parents.push(segment);
        visit(self);
        self.parents.pop();
    }

    fn add_class(&mut self, segment: &str, start: Span, end: Span) {
        let start = start.start();
        self.classes.push(RawScope {
            symbol: self.qualify(segment),
            start_line: start.line,
            end_line: end.end().line,
            start_column: start.column + 1,
        });
    }

    fn add_function(
        &mut self,
        segment: &str,
        start: Span,
        end: Span,
        metrics: Option<(usize, usize)>,
        parameters: usize,
    ) {
        let start = start.start();
        let (complexity, nesting) = metrics
            .map(|(complexity, nesting)| (Some(complexity), Some(nesting)))
            .unwrap_or((None, None));
        self.functions.push(RawFunction {
            symbol: self.qualify(segment),
            start_line: start.line,
            end_line: end.end().line,
            start_column: start.column + 1,
            complexity,
            nesting,
            parameters,
        });
    }

    fn add_signature(
        &mut self,
        signature: &Signature,
        visibility: Option<&Visibility>,
        end: Span,
        metrics: Option<(usize, usize)>,
    ) {
        let segment = signature.ident.to_string();
        let start = visibility
            .and_then(visibility_span)
            .unwrap_or_else(|| signature_start(signature));
        self.add_function(&segment, start, end, metrics, parameter_count(signature));
    }

    fn add_foreign_function(&mut self, function: &ForeignItemFn, qualifier: Option<Span>) {
        let segment = function.sig.ident.to_string();
        let start = visibility_span(&function.vis)
            .or(qualifier)
            .unwrap_or_else(|| signature_start(&function.sig));
        self.add_function(
            &segment,
            start,
            function.span(),
            None,
            parameter_count(&function.sig),
        );
    }

    fn visit_foreign_function_children(&mut self, function: &ForeignItemFn) {
        let segment = function.sig.ident.to_string();
        self.with_parent(segment, |collector| {
            syn::visit::visit_foreign_item_fn(collector, function)
        });
    }

    fn visit_foreign_static_children(&mut self, item: &ForeignItemStatic) {
        let segment = item.ident.to_string();
        self.with_parent(segment, |collector| {
            syn::visit::visit_foreign_item_static(collector, item)
        });
    }

    fn reject(&mut self, tokens: &TokenStream) {
        if self.error.is_none() {
            let span = tokens
                .clone()
                .into_iter()
                .next()
                .map_or_else(Span::call_site, |token| token.span());
            self.error = Some(AnalyzeError::unsupported(span));
        }
    }

    fn impl_segment(&self, item: &ItemImpl) -> String {
        let start = item
            .defaultness
            .as_ref()
            .map(Spanned::span)
            .or_else(|| item.unsafety.as_ref().map(Spanned::span))
            .unwrap_or_else(|| item.impl_token.span());
        self.source
            .normalized_between(start.start(), item.brace_token.span.open().start())
            .filter(|segment| !segment.is_empty())
            .unwrap_or_else(|| "impl".to_owned())
    }

    fn foreign_segment(&self, item: &ItemForeignMod) -> String {
        let start = item
            .unsafety
            .as_ref()
            .map(Spanned::span)
            .unwrap_or_else(|| item.abi.extern_token.span());
        self.source
            .normalized_between(start.start(), item.brace_token.span.open().start())
            .filter(|segment| !segment.is_empty())
            .unwrap_or_else(|| "extern".to_owned())
    }

    fn handle_safe_foreign(&mut self, tokens: &TokenStream) {
        let unsafe_block = self.foreign_unsafety.last().copied().unwrap_or(false);
        match parse_safe_foreign(tokens, unsafe_block) {
            Ok(SafeForeignItem::Function {
                function,
                safe_span,
            }) => {
                self.add_foreign_function(&function, Some(safe_span));
                self.visit_foreign_function_children(&function);
            }
            Ok(SafeForeignItem::Static(item)) => self.visit_foreign_static_children(&item),
            Err(error) if self.error.is_none() => self.error = Some(error),
            Err(_) => {}
        }
    }
}

impl<'ast> Visit<'ast> for Collector<'_> {
    fn visit_item(&mut self, node: &'ast Item) {
        if let Item::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_item(self, node);
        }
    }

    fn visit_impl_item(&mut self, node: &'ast ImplItem) {
        if let ImplItem::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_impl_item(self, node);
        }
    }

    fn visit_trait_item(&mut self, node: &'ast TraitItem) {
        if let TraitItem::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_trait_item(self, node);
        }
    }

    fn visit_foreign_item(&mut self, node: &'ast ForeignItem) {
        if let ForeignItem::Verbatim(tokens) = node {
            self.handle_safe_foreign(tokens);
        } else {
            syn::visit::visit_foreign_item(self, node);
        }
    }

    fn visit_expr(&mut self, node: &'ast Expr) {
        if let Expr::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_expr(self, node);
        }
    }

    fn visit_pat(&mut self, node: &'ast Pat) {
        if let Pat::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_pat(self, node);
        }
    }

    fn visit_type(&mut self, node: &'ast Type) {
        if let Type::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_type(self, node);
        }
    }

    fn visit_type_param_bound(&mut self, node: &'ast TypeParamBound) {
        if let TypeParamBound::Verbatim(tokens) = node {
            self.reject(tokens);
        } else {
            syn::visit::visit_type_param_bound(self, node);
        }
    }

    fn visit_item_mod(&mut self, node: &'ast ItemMod) {
        let segment = node.ident.to_string();
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_mod(collector, node)
        });
    }

    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        let segment = node.ident.to_string();
        let start = visibility_span(&node.vis).unwrap_or_else(|| node.struct_token.span());
        self.add_class(&segment, start, node.span());
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_struct(collector, node)
        });
    }

    fn visit_item_enum(&mut self, node: &'ast ItemEnum) {
        let segment = node.ident.to_string();
        let start = visibility_span(&node.vis).unwrap_or_else(|| node.enum_token.span());
        self.add_class(&segment, start, node.span());
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_enum(collector, node)
        });
    }

    fn visit_item_union(&mut self, node: &'ast ItemUnion) {
        let segment = node.ident.to_string();
        let start = visibility_span(&node.vis).unwrap_or_else(|| node.union_token.span());
        self.add_class(&segment, start, node.span());
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_union(collector, node)
        });
    }

    fn visit_item_trait(&mut self, node: &'ast ItemTrait) {
        let segment = node.ident.to_string();
        let start = visibility_span(&node.vis)
            .or_else(|| node.unsafety.as_ref().map(Spanned::span))
            .or_else(|| node.auto_token.as_ref().map(Spanned::span))
            .unwrap_or_else(|| node.trait_token.span());
        self.add_class(&segment, start, node.span());
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_trait(collector, node)
        });
    }

    fn visit_item_impl(&mut self, node: &'ast ItemImpl) {
        let segment = self.impl_segment(node);
        let start = node
            .defaultness
            .as_ref()
            .map(Spanned::span)
            .or_else(|| node.unsafety.as_ref().map(Spanned::span))
            .unwrap_or_else(|| node.impl_token.span());
        self.add_class(&segment, start, node.span());
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_impl(collector, node)
        });
    }

    fn visit_item_fn(&mut self, node: &'ast ItemFn) {
        let segment = node.sig.ident.to_string();
        self.add_signature(
            &node.sig,
            Some(&node.vis),
            node.span(),
            Some(block_metrics(&node.block)),
        );
        self.with_parent(segment, |collector| {
            syn::visit::visit_item_fn(collector, node)
        });
    }

    fn visit_impl_item_fn(&mut self, node: &'ast ImplItemFn) {
        let segment = node.sig.ident.to_string();
        let start = visibility_span(&node.vis)
            .or_else(|| node.defaultness.as_ref().map(Spanned::span))
            .unwrap_or_else(|| signature_start(&node.sig));
        self.add_function(
            &segment,
            start,
            node.span(),
            Some(block_metrics(&node.block)),
            parameter_count(&node.sig),
        );
        self.with_parent(segment, |collector| {
            syn::visit::visit_impl_item_fn(collector, node)
        });
    }

    fn visit_trait_item_fn(&mut self, node: &'ast TraitItemFn) {
        let segment = node.sig.ident.to_string();
        self.add_signature(
            &node.sig,
            None,
            node.span(),
            node.default.as_ref().map(block_metrics),
        );
        self.with_parent(segment, |collector| {
            syn::visit::visit_trait_item_fn(collector, node)
        });
    }

    fn visit_item_foreign_mod(&mut self, node: &'ast ItemForeignMod) {
        let segment = self.foreign_segment(node);
        self.parents.push(segment);
        self.foreign_unsafety.push(node.unsafety.is_some());
        for item in &node.items {
            self.visit_foreign_item(item);
        }
        self.foreign_unsafety.pop();
        self.parents.pop();
    }

    fn visit_foreign_item_fn(&mut self, node: &'ast ForeignItemFn) {
        self.add_foreign_function(node, None);
        self.visit_foreign_function_children(node);
    }

    fn visit_foreign_item_static(&mut self, node: &'ast ForeignItemStatic) {
        self.visit_foreign_static_children(node);
    }

    fn visit_expr_closure(&mut self, node: &'ast ExprClosure) {
        let start = closure_start(node);
        let location = start.start();
        let segment = format!("<closure@{}:{}>", location.line, location.column + 1);
        self.add_function(
            &segment,
            start,
            node.span(),
            Some(expression_metrics(&node.body)),
            node.inputs.len(),
        );
        self.with_parent(segment, |collector| {
            syn::visit::visit_expr_closure(collector, node)
        });
    }

    fn visit_expr_async(&mut self, node: &'ast ExprAsync) {
        let start = node.async_token.span();
        let location = start.start();
        let segment = format!("<async@{}:{}>", location.line, location.column + 1);
        self.add_function(
            &segment,
            start,
            node.span(),
            Some(block_metrics(&node.block)),
            0,
        );
        self.with_parent(segment, |collector| {
            syn::visit::visit_expr_async(collector, node)
        });
    }
}

fn visibility_span(visibility: &Visibility) -> Option<Span> {
    match visibility {
        Visibility::Inherited => None,
        _ => Some(visibility.span()),
    }
}

fn signature_start(signature: &Signature) -> Span {
    signature
        .constness
        .as_ref()
        .map(Spanned::span)
        .or_else(|| signature.asyncness.as_ref().map(Spanned::span))
        .or_else(|| signature.unsafety.as_ref().map(Spanned::span))
        .or_else(|| signature.abi.as_ref().map(|abi| abi.extern_token.span()))
        .unwrap_or_else(|| signature.fn_token.span())
}

fn closure_start(closure: &ExprClosure) -> Span {
    closure
        .lifetimes
        .as_ref()
        .map(Spanned::span)
        .or_else(|| closure.constness.as_ref().map(Spanned::span))
        .or_else(|| closure.movability.as_ref().map(Spanned::span))
        .or_else(|| closure.asyncness.as_ref().map(Spanned::span))
        .or_else(|| closure.capture.as_ref().map(Spanned::span))
        .unwrap_or_else(|| closure.or1_token.span())
}

fn parameter_count(signature: &Signature) -> usize {
    signature
        .inputs
        .iter()
        .filter(|argument| matches!(argument, FnArg::Typed(_)))
        .count()
        + usize::from(signature.variadic.is_some())
}

fn finish_scopes(classes: Vec<RawScope>, functions: &[RawFunction]) -> Vec<Scope> {
    let classes = disambiguate_scopes(classes);
    let mut scopes = classes
        .into_iter()
        .map(|scope| Scope {
            kind: "class",
            symbol: scope.symbol,
            start_line: scope.start_line,
            end_line: scope.end_line,
        })
        .collect::<Vec<_>>();
    let function_symbols = disambiguated_symbols(functions);
    scopes.extend(
        functions
            .iter()
            .zip(function_symbols)
            .map(|(function, symbol)| Scope {
                kind: "function",
                symbol,
                start_line: function.start_line,
                end_line: function.end_line,
            }),
    );
    scopes
}

fn finish_functions(functions: Vec<RawFunction>) -> Vec<FunctionMetric> {
    let symbols = disambiguated_symbols(&functions);
    functions
        .into_iter()
        .zip(symbols)
        .map(|(function, symbol)| FunctionMetric {
            symbol,
            start_line: function.start_line,
            end_line: function.end_line,
            complexity: function.complexity,
            nesting: function.nesting,
            parameters: function.parameters,
        })
        .collect()
}

fn disambiguate_scopes(scopes: Vec<RawScope>) -> Vec<RawScope> {
    let counts = symbol_counts(scopes.iter().map(|scope| scope.symbol.as_str()));
    scopes
        .into_iter()
        .map(|mut scope| {
            if counts[&scope.symbol] > 1 {
                scope.symbol = format!(
                    "{}@{}:{}",
                    scope.symbol, scope.start_line, scope.start_column
                );
            }
            scope
        })
        .collect()
}

fn disambiguated_symbols(functions: &[RawFunction]) -> Vec<String> {
    let counts = symbol_counts(functions.iter().map(|function| function.symbol.as_str()));
    functions
        .iter()
        .map(|function| {
            if counts[&function.symbol] > 1 {
                format!(
                    "{}@{}:{}",
                    function.symbol, function.start_line, function.start_column
                )
            } else {
                function.symbol.clone()
            }
        })
        .collect()
}

fn symbol_counts<'a>(symbols: impl Iterator<Item = &'a str>) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for symbol in symbols {
        *counts.entry(symbol.to_owned()).or_insert(0) += 1;
    }
    counts
}
