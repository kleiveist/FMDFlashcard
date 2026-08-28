from __future__ import annotations

import subprocess
import zipfile
from pathlib import Path

from tools import control
from tools.inst import build


def test_build_alias_is_normalized() -> None:
    assert control._normalize_argv(["--build"]) == ["build", "web"]
    assert control._normalize_argv(["tauri", "--build", "--dry-run"]) == [
        "tauri",
        "build",
        "--dry-run",
    ]


def test_build_command_is_dispatched(monkeypatch) -> None:
    calls: list[str] = []

    def fake_build(args) -> int:
        calls.append(args.command)
        return 0

    monkeypatch.setattr(control.build, "main", fake_build)

    assert control.main(["--build"]) == 0
    assert calls == ["build"]


def test_web_build_runs_npm_build_and_reports_dist(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    frontend = root / "frontend"
    dist = frontend / "dist"
    web_artifact_dir = root / ".dist" / "web"
    web_zip_path = web_artifact_dir / "web-build.zip"
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text("{}", encoding="utf-8")
    calls: list[tuple[list[str], Path | None]] = []

    def fake_run(
        cmd: list[str], cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        calls.append((cmd, cwd))
        (dist / "assets").mkdir(parents=True)
        (dist / "index.html").write_text("<html></html>", encoding="utf-8")
        (dist / "assets" / "app.js").write_text("console.log('ok');", encoding="utf-8")
        return subprocess.CompletedProcess(cmd, 0, stdout="built", stderr="")

    monkeypatch.setattr(build, "ROOT", root)
    monkeypatch.setattr(
        build.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(build, "_run", fake_run)

    assert build.main(control._build_parser().parse_args(["build"])) == 0
    assert calls == [(["/usr/bin/npm", "run", "build"], frontend)]
    assert web_zip_path.exists()
    with zipfile.ZipFile(web_zip_path) as archive:
        assert sorted(archive.namelist()) == ["assets/app.js", "index.html"]


def test_web_build_fails_when_npm_is_missing(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    frontend = root / "frontend"
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text("{}", encoding="utf-8")

    monkeypatch.setattr(build, "ROOT", root)
    monkeypatch.setattr(build.shutil, "which", lambda name: None)

    assert build.main(control._build_parser().parse_args(["build"])) == 1


def test_web_build_fails_when_dist_is_not_created(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    frontend = root / "frontend"
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text("{}", encoding="utf-8")

    def fake_run(
        cmd: list[str], cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(cmd, 0, stdout="built", stderr="")

    monkeypatch.setattr(build, "ROOT", root)
    monkeypatch.setattr(
        build.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(build, "_run", fake_run)

    assert build.main(control._build_parser().parse_args(["build"])) == 1


def test_web_build_returns_failure_for_failed_npm_build(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    frontend = root / "frontend"
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text("{}", encoding="utf-8")

    def fake_run(
        cmd: list[str], cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            cmd, 1, stdout="type error", stderr="vite failed"
        )

    monkeypatch.setattr(build, "ROOT", root)
    monkeypatch.setattr(
        build.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(build, "_run", fake_run)

    assert build.main(control._build_parser().parse_args(["build"])) == 1


def test_web_build_fails_when_dist_is_empty(monkeypatch, tmp_path) -> None:
    root = tmp_path / "repo"
    frontend = root / "frontend"
    dist = frontend / "dist"
    frontend.mkdir(parents=True)
    (frontend / "package.json").write_text("{}", encoding="utf-8")

    def fake_run(
        cmd: list[str], cwd: Path | None = None
    ) -> subprocess.CompletedProcess[str]:
        dist.mkdir()
        return subprocess.CompletedProcess(cmd, 0, stdout="built", stderr="")

    monkeypatch.setattr(build, "ROOT", root)
    monkeypatch.setattr(
        build.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(build, "_run", fake_run)

    assert build.main(control._build_parser().parse_args(["build"])) == 1
