from __future__ import annotations

from tools.inst import console


def _answers(monkeypatch, values: list[str]) -> None:
    iterator = iter(values)
    monkeypatch.setattr("builtins.input", lambda _prompt="": next(iterator))


def test_console_can_exit_from_main_menu(monkeypatch, capsys) -> None:
    _answers(monkeypatch, ["q"])

    assert console.main() == 0
    assert "Project Tooling Console" in capsys.readouterr().out


def test_console_can_exit_from_a_nested_menu(monkeypatch) -> None:
    _answers(monkeypatch, ["3", "q"])

    assert console.main() == 0


def test_quick_test_runs_api_frontend_and_tooling(monkeypatch) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(console, "_run_control", lambda args: calls.append(args) or 0)
    _answers(monkeypatch, ["1", "b"])

    console._tests_menu()

    assert calls == [
        ["test", "--suite", "api"],
        ["test", "--suite", "frontend"],
        ["test", "--suite", "tools"],
    ]


def test_build_menu_offers_safe_desktop_preview(monkeypatch) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(console, "_run_control", lambda args: calls.append(args) or 0)
    _answers(monkeypatch, ["2", "b"])

    console._builds_menu()

    assert calls == [["build", "desktop", "--dry-run", "--no-clean"]]


def test_build_menu_confirms_real_selected_target(monkeypatch) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(console, "_run_control", lambda args: calls.append(args) or 0)
    _answers(monkeypatch, ["3", "windows-portable", "y", "b"])

    console._builds_menu()

    assert calls == [["build", "desktop", "--target", "windows-portable"]]


def test_documentation_menu_previews_pygitindex(monkeypatch) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(console, "_run_control", lambda args: calls.append(args) or 0)
    _answers(monkeypatch, ["1", "b"])

    console._documentation_menu()

    assert calls == [["docs", "index", "--dry-run"]]
