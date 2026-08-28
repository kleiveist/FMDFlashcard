from __future__ import annotations

import ast
import importlib.util

_IMPORTLIB_MODULE = "importlib-module"
_IMPORT_MODULE_CALLABLE = "import-module-callable"
_OTHER_BINDING = "other"


def _static_imports(
    node: ast.AST,
    current_package: str,
    expand_from_roots: frozenset[str],
) -> list[tuple[str, int]]:
    if isinstance(node, ast.Import):
        return [(alias.name, node.lineno) for alias in node.names]
    if not isinstance(node, ast.ImportFrom):
        return []
    module = node.module or ""
    if node.level:
        try:
            base = importlib.util.resolve_name(f"{'.' * node.level}{module}", current_package)
        except (ImportError, ValueError):
            return []
    else:
        base = module
    imports = [(base, node.lineno)] if base else []
    if not module or base.partition(".")[0] == base or base in expand_from_roots:
        imports.extend((f"{base}.{alias.name}".strip("."), node.lineno) for alias in node.names if alias.name != "*")
    return imports


class _LocalBindingCollector(ast.NodeVisitor):
    def __init__(self) -> None:
        self.names: set[str] = set()
        self.global_names: set[str] = set()
        self.nonlocal_names: set[str] = set()

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self.names.add(node.id)

    def visit_Import(self, node: ast.Import) -> None:
        self.names.update(alias.asname or alias.name.partition(".")[0] for alias in node.names)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.names.update(alias.asname or alias.name for alias in node.names if alias.name != "*")

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.names.add(node.name)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.names.add(node.name)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self.names.add(node.name)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        del node

    def visit_Global(self, node: ast.Global) -> None:
        self.global_names.update(node.names)

    def visit_Nonlocal(self, node: ast.Nonlocal) -> None:
        self.nonlocal_names.update(node.names)


def _argument_names(arguments: ast.arguments) -> set[str]:
    names = {argument.arg for argument in (*arguments.posonlyargs, *arguments.args, *arguments.kwonlyargs)}
    if arguments.vararg is not None:
        names.add(arguments.vararg.arg)
    if arguments.kwarg is not None:
        names.add(arguments.kwarg.arg)
    return names


def _function_local_names(node: ast.FunctionDef | ast.AsyncFunctionDef | ast.Lambda) -> set[str]:
    collector = _LocalBindingCollector()
    body = [node.body] if isinstance(node, ast.Lambda) else node.body
    for child in body:
        collector.visit(child)
    return (_argument_names(node.args) | collector.names) - collector.global_names - collector.nonlocal_names


class _ImportCollector(ast.NodeVisitor):
    def __init__(self, current_package: str, expand_from_roots: frozenset[str]) -> None:
        self.current_package = current_package
        self.expand_from_roots = expand_from_roots
        self.imports: list[tuple[str, int]] = []
        self.scopes: list[tuple[str, dict[str, str]]] = [("module", {})]

    def _lookup(self, name: str) -> str | None:
        for _, bindings in reversed(self.scopes):
            if name in bindings:
                return bindings[name]
        return None

    def _bind(self, name: str, binding: str) -> None:
        self.scopes[-1][1][name] = binding

    def _bind_target(self, target: ast.AST, binding: str = _OTHER_BINDING) -> None:
        if isinstance(target, ast.Name):
            self._bind(target.id, binding)
        elif isinstance(target, (ast.List, ast.Tuple)):
            for element in target.elts:
                self._bind_target(element)

    def _expression_binding(self, node: ast.AST) -> str:
        if isinstance(node, ast.Name):
            return self._lookup(node.id) or _OTHER_BINDING
        if (
            isinstance(node, ast.Attribute)
            and node.attr == "import_module"
            and isinstance(node.value, ast.Name)
            and self._lookup(node.value.id) == _IMPORTLIB_MODULE
        ):
            return _IMPORT_MODULE_CALLABLE
        return _OTHER_BINDING

    def _call_binding(self, node: ast.AST) -> str | None:
        if isinstance(node, ast.Name):
            binding = self._lookup(node.id)
            if binding == _IMPORT_MODULE_CALLABLE:
                return binding
            if node.id == "__import__" and binding is None:
                return "builtin-import"
            return None
        if isinstance(node, ast.Attribute) and self._expression_binding(node) == _IMPORT_MODULE_CALLABLE:
            return _IMPORT_MODULE_CALLABLE
        return None

    def _relative_package(self, node: ast.Call) -> str | None:
        package_node = (
            node.args[1]
            if len(node.args) > 1
            else next(
                (keyword.value for keyword in node.keywords if keyword.arg == "package"),
                None,
            )
        )
        if isinstance(package_node, ast.Name) and package_node.id == "__package__":
            return self.current_package
        if isinstance(package_node, ast.Constant) and isinstance(package_node.value, str):
            return package_node.value
        return None

    def _literal_import(self, node: ast.Call) -> str | None:
        binding = self._call_binding(node.func)
        if binding is None or not node.args:
            return None
        module_node = node.args[0]
        if not isinstance(module_node, ast.Constant) or not isinstance(module_node.value, str):
            return None
        module = module_node.value
        if not module.startswith("."):
            return module
        package = self._relative_package(node) if binding == _IMPORT_MODULE_CALLABLE else None
        if package is None:
            return None
        try:
            return importlib.util.resolve_name(module, package)
        except (ImportError, ValueError):
            return None

    def visit_Call(self, node: ast.Call) -> None:
        module = self._literal_import(node)
        if module is not None:
            self.imports.append((module, node.lineno))
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        self.imports.extend(_static_imports(node, self.current_package, self.expand_from_roots))
        for alias in node.names:
            bound_name = alias.asname or alias.name.partition(".")[0]
            importlib_module = alias.name == "importlib" or (
                alias.name.startswith("importlib.") and alias.asname is None
            )
            self._bind(bound_name, _IMPORTLIB_MODULE if importlib_module else _OTHER_BINDING)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.imports.extend(_static_imports(node, self.current_package, self.expand_from_roots))
        for alias in node.names:
            if alias.name == "*":
                continue
            bound_name = alias.asname or alias.name
            import_module = node.level == 0 and node.module == "importlib" and alias.name == "import_module"
            self._bind(bound_name, _IMPORT_MODULE_CALLABLE if import_module else _OTHER_BINDING)

    def visit_Assign(self, node: ast.Assign) -> None:
        self.visit(node.value)
        binding = self._expression_binding(node.value)
        for target in node.targets:
            self._bind_target(target, binding)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        self.visit(node.annotation)
        if node.value is not None:
            self.visit(node.value)
        binding = self._expression_binding(node.value) if node.value is not None else _OTHER_BINDING
        self._bind_target(node.target, binding)

    def visit_NamedExpr(self, node: ast.NamedExpr) -> None:
        self.visit(node.value)
        self._bind_target(node.target, self._expression_binding(node.value))

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        self.visit(node.value)
        self._bind_target(node.target)

    def _visit_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        for decorator in node.decorator_list:
            self.visit(decorator)
        defaults = (*node.args.defaults, *(value for value in node.args.kw_defaults if value is not None))
        for default in defaults:
            self.visit(default)
        self._bind(node.name, _OTHER_BINDING)
        inherited = self.scopes[:-1] if self.scopes[-1][0] == "class" else self.scopes
        previous = self.scopes
        self.scopes = [*inherited, ("function", {name: _OTHER_BINDING for name in _function_local_names(node)})]
        for statement in node.body:
            self.visit(statement)
        self.scopes = previous

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._visit_function(node)

    def visit_Lambda(self, node: ast.Lambda) -> None:
        defaults = (*node.args.defaults, *(value for value in node.args.kw_defaults if value is not None))
        for default in defaults:
            self.visit(default)
        self.scopes.append(("function", {name: _OTHER_BINDING for name in _function_local_names(node)}))
        self.visit(node.body)
        self.scopes.pop()

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        for expression in (*node.decorator_list, *node.bases, *(keyword.value for keyword in node.keywords)):
            self.visit(expression)
        self._bind(node.name, _OTHER_BINDING)
        self.scopes.append(("class", {}))
        for statement in node.body:
            self.visit(statement)
        self.scopes.pop()

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self._bind(node.id, _OTHER_BINDING)


def imported_modules(
    tree: ast.AST,
    current_package: str,
    *,
    expand_from_roots: frozenset[str] = frozenset(),
) -> list[tuple[str, int]]:
    collector = _ImportCollector(current_package, expand_from_roots)
    collector.visit(tree)
    return collector.imports
