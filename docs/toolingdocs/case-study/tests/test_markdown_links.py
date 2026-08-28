from __future__ import annotations

import verify


def test_portable_documentation_links_and_tex_cli_examples_are_valid() -> None:
    assert verify.verify_markdown_links() == []
    assert verify.verify_tex_cli_examples() == []
