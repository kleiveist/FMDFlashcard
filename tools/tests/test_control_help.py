from __future__ import annotations

from tools import control


def test_bare_control_prints_root_help(capsys) -> None:
    assert control.main([]) == 0

    output = capsys.readouterr().out
    assert "Recommended workflow after returning to the project" in output
    assert "command map" in output
    assert "console" in output
    assert "docs" in output
    assert "quality" in output


def test_bare_build_prints_target_map_without_building(capsys) -> None:
    assert control.main(["build"]) == 0

    output = capsys.readouterr().out
    assert "build targets" in output
    assert "web" in output
    assert "desktop" in output


def test_bare_test_prints_suite_map_without_running(capsys) -> None:
    assert control.main(["test"]) == 0

    output = capsys.readouterr().out
    assert "Test map" in output
    assert "api" in output
    assert "tools" in output


def test_bare_docs_prints_documentation_map(capsys) -> None:
    assert control.main(["docs"]) == 0

    output = capsys.readouterr().out
    assert "documentation actions" in output
    assert "PyGitIndex" in output
    assert "check" in output
    assert "index" in output


def test_docs_parsers_default_to_configured_tooling_docs_root() -> None:
    parser = control._build_parser()

    check_args = parser.parse_args(["docs", "check"])
    index_args = parser.parse_args(["docs", "index"])

    assert check_args.docs_dir is None
    assert index_args.docs_dir is None


def test_quality_parser_defaults_to_complete_check() -> None:
    parser = control._build_parser()

    default_args = parser.parse_args(["quality"])
    focused_args = parser.parse_args(["quality", "architecture", "--format", "json"])

    assert default_args.command == "quality"
    assert default_args.quality_command == "check"
    assert default_args.output_format == "text"
    assert focused_args.quality_command == "architecture"
    assert focused_args.output_format == "json"


def test_bare_quality_dispatches_complete_check(monkeypatch) -> None:
    actions: list[str] = []

    def fake_quality(args) -> int:
        actions.append(args.quality_command)
        return 0

    monkeypatch.setattr(control.quality_control, "main", fake_quality)

    assert control.main(["quality"]) == 0
    assert actions == ["check"]


def test_legacy_desktop_build_alias_is_normalized() -> None:
    assert control._normalize_argv(["--build", "--desktop", "--dry-run"]) == [
        "build",
        "desktop",
        "--dry-run",
    ]
