from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import pytest

from tools import control
from tools.control_dispatch import dispatch
from tools.control_parser import TEST_SUITES, build_parser

ROOT = Path(__file__).resolve().parents[2]


def test_parser_constructs_required_root_commands() -> None:
    parser = build_parser()
    action = next(item for item in parser._actions if isinstance(item, argparse._SubParsersAction))
    assert {"doctor", "install", "run", "stop", "test", "quality"} <= set(action.choices)
    assert TEST_SUITES == ("frontend", "rust", "tooling", "tauri", "all")


def test_root_help_works_without_project_dependencies() -> None:
    result = subprocess.run(
        [sys.executable, "-S", str(ROOT / "tools" / "control.py"), "--help"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    assert "command map:" in result.stdout
    assert result.stderr == ""


def test_bare_test_prints_guide_without_running(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(
        "tools.commands.testing.run_command", lambda *args, **kwargs: pytest.fail("must not run")
    )
    assert control.main(["test"]) == 0
    output = capsys.readouterr()
    assert "Test map" in output.out
    assert output.err == ""


@pytest.mark.parametrize("group", ["build", "docs", "tauri", "version", "release", "tooling"])
def test_bare_command_groups_print_their_guide(
    group: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    assert control.main([group]) == 0
    captured = capsys.readouterr()
    assert f"usage: python tools/control.py {group}" in captured.out
    assert captured.err == ""


def test_canonical_dispatch_preserves_handler_exit_code() -> None:
    parser = build_parser()
    parser.set_defaults(root_parser=parser)
    args = parser.parse_args(["doctor"])
    assert dispatch(args, handlers={"doctor": lambda _args: 37}) == 37


@pytest.mark.parametrize(
    "argv",
    [
        ["doctor", "--json", "--watch"],
        ["run", "--foreground", "--no-follow"],
        ["test", "--suite", "backend"],
        ["release", "collect", "--matrix-id", "linux"],
    ],
)
def test_invalid_canonical_combinations_exit_two(argv: list[str]) -> None:
    with pytest.raises(SystemExit) as caught:
        control.main(argv)
    assert caught.value.code == 2
