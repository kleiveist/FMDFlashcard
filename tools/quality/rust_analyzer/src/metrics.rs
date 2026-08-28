use syn::visit::Visit;
use syn::{
    Arm, BinOp, Block, Expr, ExprBinary, ExprForLoop, ExprIf, ExprLoop, ExprMatch, ExprWhile, Item,
    Local,
};

pub(crate) fn block_metrics(block: &Block) -> (usize, usize) {
    (complexity_block(block), nesting_block(block))
}

pub(crate) fn expression_metrics(expression: &Expr) -> (usize, usize) {
    (
        complexity_expression(expression),
        nesting_expression(expression),
    )
}

fn complexity_block(block: &Block) -> usize {
    let mut visitor = Complexity { value: 1 };
    visitor.visit_block(block);
    visitor.value
}

fn complexity_expression(expression: &Expr) -> usize {
    let mut visitor = Complexity { value: 1 };
    visitor.visit_expr(expression);
    visitor.value
}

struct Complexity {
    value: usize,
}

impl<'ast> Visit<'ast> for Complexity {
    fn visit_item(&mut self, _node: &'ast Item) {}

    fn visit_expr_async(&mut self, _node: &'ast syn::ExprAsync) {}

    fn visit_expr_closure(&mut self, _node: &'ast syn::ExprClosure) {}

    fn visit_expr_macro(&mut self, _node: &'ast syn::ExprMacro) {}

    fn visit_stmt_macro(&mut self, _node: &'ast syn::StmtMacro) {}

    fn visit_expr_if(&mut self, node: &'ast ExprIf) {
        self.value += 1;
        syn::visit::visit_expr_if(self, node);
    }

    fn visit_expr_while(&mut self, node: &'ast ExprWhile) {
        self.value += 1;
        syn::visit::visit_expr_while(self, node);
    }

    fn visit_expr_for_loop(&mut self, node: &'ast ExprForLoop) {
        self.value += 1;
        syn::visit::visit_expr_for_loop(self, node);
    }

    fn visit_expr_loop(&mut self, node: &'ast ExprLoop) {
        self.value += 1;
        syn::visit::visit_expr_loop(self, node);
    }

    fn visit_expr_try(&mut self, node: &'ast syn::ExprTry) {
        self.value += 1;
        syn::visit::visit_expr_try(self, node);
    }

    fn visit_expr_try_block(&mut self, node: &'ast syn::ExprTryBlock) {
        self.value += 1;
        syn::visit::visit_expr_try_block(self, node);
    }

    fn visit_expr_binary(&mut self, node: &'ast ExprBinary) {
        if matches!(node.op, BinOp::And(_) | BinOp::Or(_)) {
            self.value += 1;
        }
        syn::visit::visit_expr_binary(self, node);
    }

    fn visit_arm(&mut self, node: &'ast Arm) {
        self.value += 1 + usize::from(node.guard.is_some());
        syn::visit::visit_arm(self, node);
    }

    fn visit_local(&mut self, node: &'ast Local) {
        if node
            .init
            .as_ref()
            .is_some_and(|init| init.diverge.is_some())
        {
            self.value += 1;
        }
        syn::visit::visit_local(self, node);
    }
}

fn nesting_block(block: &Block) -> usize {
    let mut visitor = Nesting::default();
    visitor.visit_block(block);
    visitor.maximum
}

fn nesting_expression(expression: &Expr) -> usize {
    let mut visitor = Nesting::default();
    visitor.visit_expr(expression);
    visitor.maximum
}

#[derive(Default)]
struct Nesting {
    depth: usize,
    maximum: usize,
}

impl Nesting {
    fn nested(&mut self, visit: impl FnOnce(&mut Self)) {
        self.depth += 1;
        self.maximum = self.maximum.max(self.depth);
        visit(self);
        self.depth -= 1;
    }

    fn visit_loop_parts(&mut self, expression: Option<&Expr>, body: &Block) {
        if let Some(expression) = expression {
            self.visit_expr(expression);
        }
        self.nested(|visitor| visitor.visit_block(body));
    }
}

impl<'ast> Visit<'ast> for Nesting {
    fn visit_item(&mut self, _node: &'ast Item) {}

    fn visit_expr_async(&mut self, _node: &'ast syn::ExprAsync) {}

    fn visit_expr_closure(&mut self, _node: &'ast syn::ExprClosure) {}

    fn visit_expr_macro(&mut self, _node: &'ast syn::ExprMacro) {}

    fn visit_stmt_macro(&mut self, _node: &'ast syn::StmtMacro) {}

    fn visit_expr_if(&mut self, node: &'ast ExprIf) {
        self.visit_expr(&node.cond);
        self.nested(|visitor| visitor.visit_block(&node.then_branch));
        if let Some((_, alternative)) = &node.else_branch {
            if matches!(alternative.as_ref(), Expr::If(_)) {
                self.visit_expr(alternative);
            } else {
                self.nested(|visitor| visitor.visit_expr(alternative));
            }
        }
    }

    fn visit_expr_while(&mut self, node: &'ast ExprWhile) {
        self.visit_loop_parts(Some(&node.cond), &node.body);
    }

    fn visit_expr_for_loop(&mut self, node: &'ast ExprForLoop) {
        self.visit_pat(&node.pat);
        self.visit_loop_parts(Some(&node.expr), &node.body);
    }

    fn visit_expr_loop(&mut self, node: &'ast ExprLoop) {
        self.visit_loop_parts(None, &node.body);
    }

    fn visit_expr_match(&mut self, node: &'ast ExprMatch) {
        self.visit_expr(&node.expr);
        self.nested(|visitor| {
            for arm in &node.arms {
                visitor.visit_arm(arm);
            }
        });
    }

    fn visit_arm(&mut self, node: &'ast Arm) {
        for attribute in &node.attrs {
            self.visit_attribute(attribute);
        }
        self.visit_pat(&node.pat);
        if let Some((_, guard)) = &node.guard {
            self.visit_expr(guard);
        }
        if matches!(node.body.as_ref(), Expr::Block(_)) {
            self.nested(|visitor| visitor.visit_expr(&node.body));
        } else {
            self.visit_expr(&node.body);
        }
    }

    fn visit_local(&mut self, node: &'ast Local) {
        for attribute in &node.attrs {
            self.visit_attribute(attribute);
        }
        self.visit_pat(&node.pat);
        if let Some(init) = &node.init {
            self.visit_expr(&init.expr);
            if let Some((_, alternative)) = &init.diverge {
                self.nested(|visitor| visitor.visit_expr(alternative));
            }
        }
    }
}
