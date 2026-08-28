from __future__ import annotations


TOOLING_RUNTIME_PROBE = (
    "import jsonschema, pytest, ruff; "
    "from tools.quality.rust_ast import analyze_tree; "
    "payload = analyze_tree('fn tooling_runtime_probe() {}\\n'); "
    "assert payload['functions']"
)
