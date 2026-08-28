use proc_macro2::{Span, TokenStream, TokenTree};
use syn::ForeignItem;

use crate::AnalyzeError;

pub(crate) enum SafeForeignItem {
    Function {
        function: Box<syn::ForeignItemFn>,
        safe_span: Span,
    },
    Static(Box<syn::ForeignItemStatic>),
}

pub(crate) fn parse_safe_foreign(
    tokens: &TokenStream,
    unsafe_block: bool,
) -> Result<SafeForeignItem, AnalyzeError> {
    let trees = tokens.clone().into_iter().collect::<Vec<_>>();
    let span = trees
        .first()
        .map(TokenTree::span)
        .unwrap_or_else(Span::call_site);
    let safe_positions = trees
        .iter()
        .enumerate()
        .filter_map(|(index, token)| {
            (is_ident(token, "safe")
                && valid_prefix(&trees[..index])
                && matches!(
                    trees.get(index + 1),
                    Some(kind) if is_ident(kind, "fn") || is_ident(kind, "static")
                ))
            .then_some(index)
        })
        .collect::<Vec<_>>();
    if !unsafe_block || safe_positions.len() != 1 {
        return Err(AnalyzeError::unsupported(span));
    }
    let safe_index = safe_positions[0];
    let safe_span = trees[safe_index].span();
    let repaired = trees
        .into_iter()
        .enumerate()
        .filter_map(|(index, token)| (index != safe_index).then_some(token))
        .collect::<TokenStream>();
    match syn::parse2::<ForeignItem>(repaired).map_err(AnalyzeError::from_syn)? {
        ForeignItem::Fn(function) => Ok(SafeForeignItem::Function {
            function: Box::new(function),
            safe_span,
        }),
        ForeignItem::Static(item) => Ok(SafeForeignItem::Static(Box::new(item))),
        _ => Err(AnalyzeError::unsupported(span)),
    }
}

fn is_ident(token: &TokenTree, expected: &str) -> bool {
    matches!(token, TokenTree::Ident(ident) if ident == expected)
}

fn valid_prefix(tokens: &[TokenTree]) -> bool {
    let mut index = 0;
    while matches!(tokens.get(index), Some(TokenTree::Punct(punct)) if punct.as_char() == '#') {
        if !matches!(tokens.get(index + 1), Some(TokenTree::Group(_))) {
            return false;
        }
        index += 2;
    }
    if matches!(tokens.get(index), Some(token) if is_ident(token, "pub")) {
        index += 1;
        if matches!(tokens.get(index), Some(TokenTree::Group(_))) {
            index += 1;
        }
    }
    index == tokens.len()
}
