from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from tools.inst import install


def test_tooling_requirements_pin_wasmtime_without_tree_sitter() -> None:
    root = Path(__file__).resolve().parents[2]
    requirements = (root / "tools" / "requirements.txt").read_text(encoding="utf-8")

    assert "wasmtime==47.0.1" in requirements.splitlines()
    assert "tree-sitter" not in requirements


def test_doctor_module_imports_in_fresh_python_process() -> None:
    root = Path(__file__).resolve().parents[2]

    completed = subprocess.run(
        [sys.executable, "-c", "import tools.inst.doctor"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )

    assert completed.returncode == 0, completed.stderr


def test_doctor_requires_dedicated_tools_virtualenv(
    monkeypatch, tmp_path: Path
) -> None:
    from tools.inst import doctor

    backend_python = tmp_path / "backend" / ".venv" / "bin" / "python"
    backend_python.parent.mkdir(parents=True)
    backend_python.touch()
    monkeypatch.setattr(doctor, "ROOT", tmp_path)

    result = doctor._check_tooling_runtime()

    assert result.status == "WARN"
    assert str(tmp_path / ".tooling-state" / "venv") in result.message


def test_doctor_checks_complete_tooling_dependency_contract(
    monkeypatch, tmp_path: Path
) -> None:
    from tools.inst import doctor

    tooling_python = tmp_path / ".tooling-state" / "venv" / "bin" / "python"
    tooling_python.parent.mkdir(parents=True)
    tooling_python.touch()
    commands: list[tuple[list[str], Path | None]] = []

    def fake_run(
        command: list[str], *, cwd: Path | None = None, **_kwargs
    ) -> subprocess.CompletedProcess[str]:
        commands.append((command, cwd))
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(doctor, "ROOT", tmp_path)
    monkeypatch.setattr(doctor.subprocess, "run", fake_run)

    result = doctor._check_tooling_runtime()

    assert result.status == "OK"
    assert len(commands) == 1
    command, cwd = commands[0]
    assert command[:2] == [str(tooling_python), "-c"]
    assert "import jsonschema, pytest, ruff" in command[2]
    assert "analyze_tree('fn tooling_runtime_probe() {}\\n')" in command[2]
    assert cwd == tmp_path


def test_doctor_reports_rust_analyzer_probe_failure(
    monkeypatch, tmp_path: Path
) -> None:
    from tools.inst import doctor

    tooling_python = tmp_path / ".tooling-state" / "venv" / "bin" / "python"
    tooling_python.parent.mkdir(parents=True)
    tooling_python.touch()
    monkeypatch.setattr(doctor, "ROOT", tmp_path)
    monkeypatch.setattr(
        doctor.subprocess,
        "run",
        lambda command, **_kwargs: subprocess.CompletedProcess(
            command, 2, stdout="", stderr="artifact verification failed"
        ),
    )

    result = doctor._check_tooling_runtime()

    assert result.status == "FAIL"
    assert "artifact verification failed" in result.message


def test_tooling_install_probe_exercises_verified_analyzer(
    monkeypatch, tmp_path: Path
) -> None:
    tooling_python = tmp_path / "tools" / ".venv" / "bin" / "python"
    tooling_python.parent.mkdir(parents=True)
    tooling_python.touch()
    commands: list[list[str]] = []

    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(
        install,
        "_run",
        lambda command, cwd=None: (
            commands.append(command)
            or subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        ),
    )

    assert install._tooling_runtime_ready(tooling_python) is True
    assert len(commands) == 1
    assert commands[0][:2] == [str(tooling_python), "-c"]
    assert "analyze_tree('fn tooling_runtime_probe() {}\\n')" in commands[0][2]


def test_windows_venv_seed_uses_setup_python_instead_of_path_alias(monkeypatch) -> None:
    monkeypatch.setattr(install.sys, "platform", "win32")
    monkeypatch.setattr(
        install.shutil,
        "which",
        lambda name: (
            r"C:\\Users\\runneradmin\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe"
        ),
    )

    assert install._select_venv_seed_python() == sys.executable


def test_frontend_install_uses_npm_ci_when_lockfile_exists(
    monkeypatch, tmp_path: Path
) -> None:
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text("{}\n", encoding="utf-8")
    (frontend / "package-lock.json").write_text("{}\n", encoding="utf-8")
    calls: list[tuple[list[str], Path | None]] = []

    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(
        install.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(
        install,
        "_run",
        lambda command, cwd=None: (
            calls.append((command, cwd))
            or subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        ),
    )

    result = install._install_frontend()

    assert result.status == "OK"
    assert calls == [(["/usr/bin/npm", "ci", "--no-audit", "--no-fund"], frontend)]


def test_frontend_install_falls_back_without_lockfile(
    monkeypatch, tmp_path: Path
) -> None:
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text("{}\n", encoding="utf-8")
    calls: list[list[str]] = []

    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(
        install.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(
        install,
        "_run",
        lambda command, cwd=None: (
            calls.append(command)
            or subprocess.CompletedProcess(command, 0, stdout="", stderr="")
        ),
    )

    assert install._install_frontend().status == "OK"
    assert calls[0][1] == "install"


def test_backend_install_rebuilds_venv_when_python_is_missing(
    monkeypatch, tmp_path: Path
) -> None:
    backend = tmp_path / "backend"
    venv = backend / ".venv"
    venv.mkdir(parents=True)
    python = venv / "bin" / "python"
    rebuild_reasons: list[str] = []

    def fake_rebuild(_venv_dir: Path, reason: str) -> tuple[bool, str]:
        rebuild_reasons.append(reason)
        python.parent.mkdir(parents=True, exist_ok=True)
        python.touch()
        return True, "venv rebuilt"

    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(install, "_venv_python", lambda _venv_dir: python)
    monkeypatch.setattr(install, "_rebuild_backend_venv", fake_rebuild)
    monkeypatch.setattr(
        install,
        "_ensure_backend_venv_consistency",
        lambda _python, _venv: (True, "ready"),
    )
    monkeypatch.setattr(
        install,
        "_run",
        lambda command, cwd=None: subprocess.CompletedProcess(
            command, 0, stdout="", stderr=""
        ),
    )

    ok, message = install._install_backend_with_pip(backend, [])

    assert ok is True
    assert message == "pip/venv backend install completed"
    assert rebuild_reasons == [f"venv python is missing at {python}"]


def test_tooling_install_rebuilds_inconsistent_existing_venv(
    monkeypatch, tmp_path: Path
) -> None:
    tools_dir = tmp_path / "tools"
    tooling_venv = tmp_path / ".tooling-state" / "venv"
    tooling_python = tooling_venv / "bin" / "python"
    tooling_venv.mkdir(parents=True)
    requirements = tools_dir / "requirements.txt"
    tools_dir.mkdir(exist_ok=True)
    requirements.write_text("pytest==8.2.2\n", encoding="utf-8")
    (tools_dir / "VERSION").write_text("1.0.0\n", encoding="utf-8")
    rebuilds: list[tuple[Path, bool]] = []

    def fake_create(venv_dir: Path, clear: bool) -> tuple[bool, str]:
        rebuilds.append((venv_dir, clear))
        tooling_python.parent.mkdir(parents=True, exist_ok=True)
        tooling_python.touch()
        return True, "venv rebuilt"

    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(install, "TOOLS_ROOT", tools_dir)
    monkeypatch.setattr(install, "_tooling_runtime_ready", lambda _python: False)
    monkeypatch.setattr(
        install,
        "_inspect_backend_venv",
        lambda _python, _venv: (False, "interpreter mismatch"),
    )
    monkeypatch.setattr(install, "_create_backend_venv", fake_create)
    monkeypatch.setattr(
        install,
        "_run",
        lambda command, cwd=None: subprocess.CompletedProcess(
            command, 0, stdout="", stderr=""
        ),
    )

    result = install._install_tooling_runtime()

    assert result.status == "OK"
    assert rebuilds == [(tooling_venv, True)]


def test_tooling_install_does_not_reuse_backend_only_runtime(
    monkeypatch, tmp_path: Path
) -> None:
    tools_dir = tmp_path / "tools"
    requirements = tools_dir / "requirements.txt"
    requirements.parent.mkdir(parents=True)
    requirements.write_text("pytest==8.2.2\nruff==0.16.4\n", encoding="utf-8")
    (tools_dir / "VERSION").write_text("1.0.0\n", encoding="utf-8")
    backend_python = tmp_path / "backend/.venv/bin/python"
    backend_python.parent.mkdir(parents=True)
    backend_python.touch()
    commands: list[list[str]] = []

    def fake_run(command, cwd=None):
        commands.append(command)
        if command[1:3] == ["-m", "venv"]:
            tooling_python = tmp_path / ".tooling-state/venv/bin/python"
            tooling_python.parent.mkdir(parents=True)
            tooling_python.touch()
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(install, "ROOT", tmp_path)
    monkeypatch.setattr(install, "TOOLS_ROOT", tools_dir)
    monkeypatch.setattr(
        install,
        "_tooling_runtime_ready",
        lambda python: python == backend_python,
    )
    monkeypatch.setattr(install, "_run", fake_run)

    result = install._install_tooling_runtime()

    assert result.status == "OK"
    assert any(command[1:3] == ["-m", "venv"] for command in commands)
    assert any(command[1:4] == ["-m", "pip", "install"] for command in commands)
