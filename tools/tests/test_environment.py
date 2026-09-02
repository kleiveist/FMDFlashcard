from __future__ import annotations

import argparse
import json
from pathlib import Path

import pytest

from tools.commands import environment
from tools.paths import project_paths
from tools.process import CommandResult

ROOT = Path(__file__).resolve().parents[2]


def _project(tmp_path: Path):  # type: ignore[no-untyped-def]
    desktop = tmp_path / "apps" / "fmd-desktop"
    tauri = desktop / "src-tauri"
    tauri.mkdir(parents=True)
    files = {
        desktop / "package.json": '{"packageManager":"pnpm@10.17.1"}\n',
        desktop / "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
        tauri / "Cargo.toml": "[package]\nname='fmd'\nversion='0.2.0'\n",
        tauri / "Cargo.lock": "version = 4\n",
        tauri / "tauri.conf.json": "{}\n",
    }
    for path, content in files.items():
        path.write_text(content, encoding="utf-8")
    toolchains = tmp_path / ".github" / "toolchains.json"
    toolchains.parent.mkdir(parents=True)
    toolchains.write_bytes((ROOT / ".github" / "toolchains.json").read_bytes())
    return project_paths(tmp_path)


def test_doctor_json_has_stable_schema(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    paths = _project(tmp_path)
    monkeypatch.setattr(environment.shutil, "which", lambda name: f"/bin/{name}")
    args = argparse.Namespace(json=True, watch=False, interval=1, dry_run=False)
    assert environment.doctor(args, paths=paths) == 0
    captured = capsys.readouterr()
    document = json.loads(captured.out)
    assert list(document) == ["checks", "schema_version", "status"]
    assert document["schema_version"] == 1
    assert document["status"] == "ok"
    assert [item["name"] for item in document["checks"]][:3] == [
        "runtime:python",
        "tool:git",
        "tool:node",
    ]
    assert captured.err == ""


def test_install_dry_run_starts_nothing_and_changes_nothing(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths = _project(tmp_path)
    before = {
        path.relative_to(tmp_path): path.read_bytes()
        for path in tmp_path.rglob("*")
        if path.is_file()
    }
    calls: list[bool] = []
    original = environment.run_command

    def guarded_run(*args: object, **kwargs: object):  # type: ignore[no-untyped-def]
        calls.append(bool(kwargs.get("dry_run")))
        return original(*args, **kwargs)

    monkeypatch.setattr(environment, "run_command", guarded_run)
    monkeypatch.setattr(environment, "_system_dependency_plan", lambda: [["system", "install"]])
    monkeypatch.setattr(environment, "_rust_plan", lambda: [["rust", "install"]])
    monkeypatch.setattr(environment, "_node_plan", lambda _paths: [["node", "install"]])
    args = argparse.Namespace(
        dry_run=True,
        skip_system_deps=False,
        skip_rust=False,
        skip_node=False,
        skip_frontend=False,
        vscode=False,
    )
    assert environment.install(args, paths=paths) == 0
    after = {
        path.relative_to(tmp_path): path.read_bytes()
        for path in tmp_path.rglob("*")
        if path.is_file()
    }
    assert calls and all(calls)
    assert after == before


def test_install_skip_flags_leave_only_the_required_python_tooling_stage(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    paths = _project(tmp_path)
    calls: list[list[str]] = []

    def fake_run(command: list[str], **kwargs: object) -> CommandResult:
        calls.append(command)
        return CommandResult(tuple(command), Path(kwargs["cwd"]), 0)

    monkeypatch.setattr(environment, "run_command", fake_run)
    monkeypatch.setattr(
        environment, "_python_tooling_plan", lambda _paths: [["python-tooling", "install"]]
    )
    monkeypatch.setattr(
        environment,
        "_system_dependency_plan",
        lambda: pytest.fail("system dependencies must be skipped"),
    )
    monkeypatch.setattr(environment, "_rust_plan", lambda: pytest.fail("Rust must be skipped"))
    monkeypatch.setattr(
        environment, "_node_plan", lambda _paths: pytest.fail("Node must be skipped")
    )
    args = argparse.Namespace(
        dry_run=False,
        skip_system_deps=True,
        skip_rust=True,
        skip_node=True,
        skip_frontend=True,
        vscode=False,
    )
    assert environment.install(args, paths=paths) == 0
    assert calls == [["python-tooling", "install"]]


def test_install_dry_run_reports_unsupported_package_manager(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    paths = _project(tmp_path)
    monkeypatch.setattr(environment, "_system_dependency_plan", lambda: None)
    args = argparse.Namespace(
        dry_run=True,
        skip_system_deps=False,
        skip_rust=True,
        skip_node=True,
        skip_frontend=True,
        vscode=False,
    )

    assert environment.install(args, paths=paths) == 0
    assert "no supported package manager" in capsys.readouterr().err
