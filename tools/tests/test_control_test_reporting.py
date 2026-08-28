from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

from tools import control
from tools.core.filesystem import FilesystemSafetyError
from tools.core.project_config import (
    ProjectConfig,
    ProjectPathConfig,
    create_project_config,
)
from tools.inst import report
from tools.profiles.model import ProjectProfile


def _payload() -> dict[str, object]:
    return {
        "command": "python tools/control.py --test --suite schema --report",
        "suite_selection": "schema",
        "expanded_suites": ["schema"],
        "no_start": False,
        "overall": "OK",
        "bootstrap": {
            "name": "service-bootstrap",
            "status": "SKIP",
            "message": "not required",
            "duration_seconds": 0.0,
        },
        "results": [
            {
                "name": "schema",
                "status": "OK",
                "message": "schema examples validated",
                "duration_seconds": 0.1,
                "command": None,
                "cwd": None,
                "exit_code": None,
                "stdout": "full stdout content",
                "stderr": "full stderr content",
                "stdout_tail": "",
                "stderr_tail": "",
                "detail": "Schema examples",
            }
        ],
    }


def _write_project_config(
    root: Path,
    *,
    frontend: str = "frontend",
    backend: str = "",
    docs: str = "docs",
) -> None:
    create_project_config(
        root / "project-tooling.toml",
        ProjectConfig(
            tooling_version="1.0.0",
            project_name="Test Project",
            profile="test-profile",
            paths=ProjectPathConfig(frontend=frontend, backend=backend, docs=docs),
        ),
    )


def _configure_tools_suite(run_test, monkeypatch, root: Path) -> tuple[Path, Path]:
    tools_root = root / "tools"
    (tools_root / "tests").mkdir(parents=True)
    (tools_root / "VERSION").write_text("1.0.0\n", encoding="utf-8")
    state_python = (
        root
        / ".tooling-state"
        / "venv"
        / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    )
    monkeypatch.setattr(run_test, "ROOT", root)
    monkeypatch.setattr(run_test, "TOOLS_ROOT", tools_root)
    return tools_root, state_python


def test_bare_test_alias_opens_suite_help() -> None:
    assert control._normalize_argv(["--test"]) == ["test", "--suite-help"]


def test_test_alias_with_suite_runs_requested_suite() -> None:
    assert control._normalize_argv(["--test", "--suite", "schema"]) == [
        "test",
        "--suite",
        "schema",
    ]


def test_all_suite_includes_frontend_npm_test() -> None:
    from tools.inst import run_test

    assert run_test._expand_suites("all") == [
        "tools",
        "schema",
        "api",
        "database",
        "postgres",
        "frontend",
        "e2e",
        "tauri",
    ]


def test_complete_run_skips_product_suites_without_test_assets(
    monkeypatch,
    tmp_path: Path,
) -> None:
    from tools.inst import run_test

    _configure_tools_suite(run_test, monkeypatch, tmp_path)

    for suite in ("schema", "api", "database", "postgres", "frontend", "e2e", "tauri"):
        result = run_test._run_selected_suite(
            suite,
            bootstrap_failed=False,
            skip_unconfigured=True,
        )
        assert result.status == "SKIP"
        assert "not configured" in result.message


def test_disabled_optional_suites_report_skip(monkeypatch) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(
        run_test.profile_runtime, "feature_enabled", lambda _feature, _root: False
    )

    assert run_test._run_api_suite().status == "SKIP"
    assert run_test._run_database_suite().status == "SKIP"
    assert run_test._run_postgres_suite().status == "SKIP"
    assert run_test._run_tauri_suite().status == "SKIP"


def test_subprocess_start_failure_becomes_a_ci_compatible_result(monkeypatch) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(
        run_test.subprocess,
        "run",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            FileNotFoundError("missing runtime")
        ),
    )

    completed = run_test._run(["missing-runtime"])

    assert completed.returncode == 127
    assert "missing runtime" in completed.stderr


def test_tooling_runtime_prefers_state_venv_and_never_backend_virtualenv(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    tooling_python = tmp_path / ".tooling-state" / "venv" / "bin" / "python"
    backend_python = tmp_path / "backend" / ".venv" / "bin" / "python"
    tooling_python.parent.mkdir(parents=True)
    tooling_python.touch()
    backend_python.parent.mkdir(parents=True)
    backend_python.touch()

    monkeypatch.setattr(run_test, "ROOT", tmp_path)

    assert run_test._tooling_python() == tooling_python


def test_missing_tooling_runtime_selects_state_venv_target_not_backend(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    backend_python = tmp_path / "backend" / ".venv" / "bin" / "python"
    backend_python.parent.mkdir(parents=True)
    backend_python.touch()
    monkeypatch.setattr(run_test, "ROOT", tmp_path)

    expected = (
        tmp_path
        / ".tooling-state"
        / "venv"
        / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    )
    assert run_test._tooling_python() == expected


def test_tools_suite_prefers_valid_state_runtime(monkeypatch, tmp_path) -> None:
    from tools.inst import run_test

    _tools_root, state_python = _configure_tools_suite(run_test, monkeypatch, tmp_path)
    state_python.parent.mkdir(parents=True)
    state_python.touch()
    current_python = tmp_path / "current-python"
    current_python.touch()
    monkeypatch.setattr(run_test.sys, "executable", str(current_python))
    monkeypatch.setenv("PYTHONPATH", "/host-only/imports")
    monkeypatch.setenv("PYTHONPYCACHEPREFIX", "/host-only/pycache")
    calls: list[tuple[list[str], dict[str, str] | None]] = []

    def fake_run(command, cwd=None, env=None):
        calls.append((command, env))
        return subprocess.CompletedProcess(command, 0, stdout="passed", stderr="")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "OK"
    assert [call[0] for call in calls] == [
        [str(state_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        [
            str(state_python),
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            "-q",
            str(tmp_path / "tools" / "tests"),
        ],
    ]
    assert all(call[1]["PYTHONDONTWRITEBYTECODE"] == "1" for call in calls)
    assert all(call[1]["PYTHONNOUSERSITE"] == "1" for call in calls)
    assert all("PYTHONPATH" not in call[1] for call in calls)
    assert all("PYTHONPYCACHEPREFIX" not in call[1] for call in calls)


def test_tools_suite_reuses_current_interpreter_only_after_probe(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    _tools_root, _state_python = _configure_tools_suite(run_test, monkeypatch, tmp_path)
    current_python = tmp_path / "current-python"
    current_python.touch()
    monkeypatch.setattr(run_test.sys, "executable", str(current_python))
    commands: list[list[str]] = []

    def fake_run(command, cwd=None, env=None):
        commands.append(command)
        return subprocess.CompletedProcess(command, 0, stdout="passed", stderr="")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "OK"
    assert commands == [
        [str(current_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        [
            str(current_python),
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            "-q",
            str(tmp_path / "tools" / "tests"),
        ],
    ]


def test_tools_suite_installs_tooling_only_then_reprobes_state_runtime(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    tools_root, state_python = _configure_tools_suite(run_test, monkeypatch, tmp_path)
    current_python = tmp_path / "current-python"
    current_python.touch()
    monkeypatch.setattr(run_test.sys, "executable", str(current_python))
    commands: list[list[str]] = []
    install_command = [
        str(current_python),
        str(tools_root / "control.py"),
        "install",
        "--skip-frontend",
        "--skip-backend",
        "--skip-playwright",
    ]

    def fake_run(command, cwd=None, env=None):
        commands.append(command)
        if command == [str(current_python), "-c", run_test.TOOLING_RUNTIME_PROBE]:
            return subprocess.CompletedProcess(
                command, 1, stdout="", stderr="missing ruff"
            )
        if command == install_command:
            state_python.parent.mkdir(parents=True)
            state_python.touch()
            return subprocess.CompletedProcess(
                command, 0, stdout="installed", stderr=""
            )
        return subprocess.CompletedProcess(command, 0, stdout="passed", stderr="")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "OK"
    assert commands == [
        [str(current_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        install_command,
        [str(state_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        [
            str(state_python),
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            "-q",
            str(tools_root / "tests"),
        ],
    ]


@pytest.mark.parametrize(
    ("configured_backend", "backend_relative"),
    (
        (None, "backend"),
        (None, "services/api"),
        ("backend", "backend"),
        ("services/api", "services/api"),
    ),
    ids=(
        "configless-conventional",
        "configless-custom",
        "configured-default",
        "configured-custom",
    ),
)
def test_tools_suite_never_reuses_current_backend_virtualenv(
    monkeypatch,
    tmp_path,
    configured_backend: str | None,
    backend_relative: str,
) -> None:
    from tools.inst import run_test

    tools_root, state_python = _configure_tools_suite(run_test, monkeypatch, tmp_path)
    if configured_backend is not None:
        _write_project_config(tmp_path, backend=configured_backend)
    backend_python = tmp_path / backend_relative / ".venv" / "bin" / "python"
    backend_python.parent.mkdir(parents=True)
    backend_python.touch()
    bootstrap_python = tmp_path / "system" / "python"
    bootstrap_python.parent.mkdir()
    bootstrap_python.touch()
    monkeypatch.setattr(run_test.sys, "executable", str(backend_python))
    monkeypatch.setattr(run_test.sys, "_base_executable", str(bootstrap_python))
    commands: list[list[str]] = []
    install_command = [
        str(bootstrap_python),
        str(tools_root / "control.py"),
        "install",
        "--skip-frontend",
        "--skip-backend",
        "--skip-playwright",
    ]

    def fake_run(command, cwd=None, env=None):
        commands.append(command)
        if command == install_command:
            state_python.parent.mkdir(parents=True)
            state_python.touch()
        return subprocess.CompletedProcess(command, 0, stdout="passed", stderr="")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "OK"
    assert commands == [
        install_command,
        [str(state_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        [
            str(state_python),
            "-m",
            "pytest",
            "-p",
            "no:cacheprovider",
            "-q",
            str(tools_root / "tests"),
        ],
    ]
    assert all(command[0] != str(backend_python) for command in commands)


def test_tools_suite_reports_actionable_install_failure(monkeypatch, tmp_path) -> None:
    from tools.inst import run_test

    tools_root, _state_python = _configure_tools_suite(run_test, monkeypatch, tmp_path)
    current_python = tmp_path / "current-python"
    current_python.touch()
    monkeypatch.setattr(run_test.sys, "executable", str(current_python))
    commands: list[list[str]] = []
    install_command = [
        str(current_python),
        str(tools_root / "control.py"),
        "install",
        "--skip-frontend",
        "--skip-backend",
        "--skip-playwright",
    ]

    def fake_run(command, cwd=None, env=None):
        commands.append(command)
        if command == install_command:
            return subprocess.CompletedProcess(
                command, 23, stdout="", stderr="offline index"
            )
        return subprocess.CompletedProcess(command, 1, stdout="", stderr="no ruff")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "FAIL"
    assert result.exit_code == 23
    assert result.command == install_command
    assert result.stderr == "offline index"
    assert "tooling-only runtime installation failed" in result.message
    assert "Run '" in result.detail
    assert commands == [
        [str(current_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        install_command,
    ]


def test_tools_suite_reports_actionable_post_install_probe_failure(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    tools_root, state_python = _configure_tools_suite(run_test, monkeypatch, tmp_path)
    current_python = tmp_path / "current-python"
    current_python.touch()
    monkeypatch.setattr(run_test.sys, "executable", str(current_python))
    commands: list[list[str]] = []
    install_command = [
        str(current_python),
        str(tools_root / "control.py"),
        "install",
        "--skip-frontend",
        "--skip-backend",
        "--skip-playwright",
    ]

    def fake_run(command, cwd=None, env=None):
        commands.append(command)
        if command == install_command:
            state_python.parent.mkdir(parents=True)
            state_python.touch()
            return subprocess.CompletedProcess(
                command, 0, stdout="installed", stderr=""
            )
        if command[0] == str(state_python):
            return subprocess.CompletedProcess(
                command, 7, stdout="", stderr="rust analyzer unavailable"
            )
        return subprocess.CompletedProcess(command, 1, stdout="", stderr="no ruff")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "FAIL"
    assert result.exit_code == 7
    assert result.command == [
        str(state_python),
        "-c",
        run_test.TOOLING_RUNTIME_PROBE,
    ]
    assert result.stderr == "rust analyzer unavailable"
    assert "still unavailable after installation" in result.message
    assert "post-install tooling state venv failed" in result.detail
    assert "Run '" in result.detail
    assert commands == [
        [str(current_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
        install_command,
        [str(state_python), "-c", run_test.TOOLING_RUNTIME_PROBE],
    ]


def test_tools_suite_includes_optional_tooling_docs_case_study_tests(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    tools_tests = tmp_path / "tools" / "tests"
    case_study_tests = tmp_path / "docs" / "toolingdocs" / "case-study" / "tests"
    tools_tests.mkdir(parents=True)
    case_study_tests.mkdir(parents=True)
    (tmp_path / "tools" / "VERSION").write_text("1.0.0\n", encoding="utf-8")
    python = tmp_path / "python"
    captured: list[str] = []
    captured_environment: dict[str, str] = {}

    def fake_run(
        command: list[str], cwd=None, env=None
    ) -> subprocess.CompletedProcess[str]:
        captured.extend(command)
        captured_environment.update(env or {})
        return subprocess.CompletedProcess(command, 0, stdout="passed", stderr="")

    monkeypatch.setattr(run_test, "ROOT", tmp_path)
    monkeypatch.setattr(run_test, "TOOLS_ROOT", tmp_path / "tools")
    monkeypatch.setattr(run_test, "_ensure_tools_runtime", lambda: (python, None))
    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._run_tools_suite()

    assert result.status == "OK"
    assert captured[-2:] == [str(tools_tests), str(case_study_tests)]
    assert captured_environment["PYTHONDONTWRITEBYTECODE"] == "1"
    assert captured_environment["PYTHONNOUSERSITE"] == "1"
    assert captured_environment["TEMPLATE_TOOLING_NESTED_TEST"] == "1"


DESKTOP_PROFILE_CASES = [
    (
        "desktop-local",
        {"frontend", "tauri"},
        {
            "api": "SKIP",
            "database": "SKIP",
            "postgres": "SKIP",
            "frontend": "OK",
            "tauri": "OK",
        },
    ),
    (
        "desktop-cloud",
        {"frontend", "backend", "tauri", "cloud"},
        {
            "api": "OK",
            "database": "SKIP",
            "postgres": "SKIP",
            "frontend": "OK",
            "tauri": "OK",
        },
    ),
]


@pytest.mark.parametrize(("profile_id", "features", "expected"), DESKTOP_PROFILE_CASES)
def test_desktop_profiles_select_only_enabled_feature_suites(
    monkeypatch,
    tmp_path,
    profile_id: str,
    features: set[str],
    expected: dict[str, str],
) -> None:
    from tools.inst import run_test

    (tmp_path / "frontend").mkdir()
    (tmp_path / "frontend" / "package.json").write_text("{}", encoding="utf-8")
    (tmp_path / "backend" / "tests" / "api").mkdir(parents=True)
    _write_project_config(tmp_path, backend="backend")
    profile = ProjectProfile(
        schema_version=1,
        profile_id=profile_id,
        name=profile_id,
        description="profile-aware test selection",
        features=tuple(features),
    )

    monkeypatch.setattr(run_test, "ROOT", tmp_path)
    monkeypatch.setattr(
        run_test.profile_runtime, "active_profile", lambda _root: profile
    )
    monkeypatch.setattr(
        run_test.profile_runtime,
        "feature_enabled",
        lambda feature, _root: feature in features,
    )
    monkeypatch.setattr(run_test.shutil, "which", lambda name: f"/usr/bin/{name}")
    monkeypatch.setattr(
        run_test,
        "_run",
        lambda command, cwd=None: subprocess.CompletedProcess(
            command, 0, stdout="passed", stderr=""
        ),
    )

    actual = {
        "api": run_test._run_api_suite().status,
        "database": run_test._run_database_suite().status,
        "postgres": run_test._run_postgres_suite().status,
        "frontend": run_test._run_frontend_suite().status,
        "tauri": run_test._run_tauri_suite().status,
    }

    assert actual == expected


def test_configured_postgres_suite_invokes_integration_tests(
    monkeypatch, tmp_path
) -> None:
    from tools.inst import run_test

    tests_dir = tmp_path / "backend" / "tests" / "integration"
    tests_dir.mkdir(parents=True)
    _write_project_config(tmp_path, backend="backend")
    monkeypatch.setattr(run_test, "ROOT", tmp_path)
    monkeypatch.setattr(
        run_test.profile_runtime,
        "feature_enabled",
        lambda feature, _root: feature == "postgres",
    )
    monkeypatch.setenv(
        "DATABASE_URL_TEST", "postgresql+psycopg://test:test@127.0.0.1:5432/test"
    )
    monkeypatch.setattr(run_test, "_backend_python", lambda: tmp_path / "python")
    monkeypatch.setattr(
        run_test,
        "_run",
        lambda command, cwd=None: subprocess.CompletedProcess(
            command, 0, stdout="1 passed", stderr=""
        ),
    )

    result = run_test._run_postgres_suite()

    assert result.status == "OK"
    assert result.command is not None
    assert result.command[-1] == str(tests_dir)


def test_e2e_bootstrap_runs_cleanup_before_service_start(monkeypatch) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(run_test, "_e2e_configured", lambda: True)

    calls: list[tuple[str, object]] = []

    def fake_cleanup(args) -> int:
        calls.append(
            ("cleanup", (args.frontend_port, args.backend_port, args.tracked_only))
        )
        return 0

    def fake_run(cmd: list[str], cwd=None) -> subprocess.CompletedProcess[str]:
        calls.append(("run", cmd))
        return subprocess.CompletedProcess(cmd, 0, stdout="Services started", stderr="")

    monkeypatch.setattr(run_test.service_cleanup, "main", fake_cleanup)
    monkeypatch.setattr(run_test, "_run", fake_run)

    started_by_runner, bootstrap = run_test._start_services_if_needed(
        ["e2e"], no_start=False
    )

    assert started_by_runner is True
    assert bootstrap.status == "OK"
    assert bootstrap.message == "services started by test runner"
    backend_port = (
        8000
        if run_test.profile_runtime.feature_enabled("backend", run_test.ROOT)
        else 0
    )
    assert calls == [
        ("cleanup", (5173, backend_port, True)),
        (
            "run",
            [
                run_test.sys.executable,
                str(run_test.ROOT / "tools" / "control.py"),
                "run",
                "--detach",
            ],
        ),
    ]


def test_e2e_bootstrap_cleanup_failure_skips_service_start(monkeypatch) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(run_test, "_e2e_configured", lambda: True)

    def fake_run(cmd: list[str], cwd=None) -> subprocess.CompletedProcess[str]:
        raise AssertionError(
            f"service start should not run after cleanup failure: {cmd}"
        )

    monkeypatch.setattr(run_test.service_cleanup, "main", lambda args: 1)
    monkeypatch.setattr(run_test, "_run", fake_run)

    started_by_runner, bootstrap = run_test._start_services_if_needed(
        ["e2e"], no_start=False
    )

    assert started_by_runner is False
    assert bootstrap.status == "FAIL"
    assert bootstrap.message == "cleanup failed before e2e service bootstrap"
    assert bootstrap.exit_code == 1


def test_e2e_bootstrap_preserves_untracked_listener_and_reports_conflict(
    monkeypatch,
) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(run_test, "_e2e_configured", lambda: True)
    cleanup_modes: list[bool] = []

    def fake_cleanup(args) -> int:
        cleanup_modes.append(args.tracked_only)
        return 0

    def occupied_port_failure(
        cmd: list[str], cwd=None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            cmd, 1, stdout="", stderr="Port 127.0.0.1:5173 is already occupied."
        )

    monkeypatch.setattr(run_test.service_cleanup, "main", fake_cleanup)
    monkeypatch.setattr(run_test, "_run", occupied_port_failure)

    started_by_runner, bootstrap = run_test._start_services_if_needed(
        ["e2e"], no_start=False
    )

    assert cleanup_modes == [True]
    assert started_by_runner is False
    assert bootstrap.status == "FAIL"
    assert bootstrap.stderr == "Port 127.0.0.1:5173 is already occupied."


def test_e2e_teardown_stops_only_tracked_services(monkeypatch) -> None:
    from tools.inst import run_test

    commands: list[list[str]] = []

    def fake_run(cmd: list[str], cwd=None) -> subprocess.CompletedProcess[str]:
        commands.append(cmd)
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

    monkeypatch.setattr(run_test, "_run", fake_run)

    result = run_test._stop_services_if_started(True)

    assert result.status == "OK"
    assert commands == [
        [
            run_test.sys.executable,
            str(run_test.ROOT / "tools" / "control.py"),
            "stop",
            "--tracked-only",
        ]
    ]


def test_e2e_teardown_failure_marks_overall_and_report_failed(monkeypatch) -> None:
    from tools.inst import run_test

    args = control._build_parser().parse_args(
        ["test", "--suite", "e2e", "--report", "json"]
    )
    bootstrap = run_test.SuiteResult("service-bootstrap", "OK", "started", 0.1)
    suite = run_test.SuiteResult("e2e", "OK", "passed", 0.2)
    captured_report: dict[str, object] = {}

    monkeypatch.setattr(run_test, "_ensure_backend_runtime", lambda _suites: None)
    monkeypatch.setattr(
        run_test,
        "_start_services_if_needed",
        lambda _suites, _no_start: (True, bootstrap),
    )
    monkeypatch.setattr(
        run_test,
        "_run_selected_suite",
        lambda _suite, bootstrap_failed, skip_unconfigured=False: suite,
    )
    monkeypatch.setattr(
        run_test,
        "_run",
        lambda command, cwd=None: subprocess.CompletedProcess(
            command, 1, stdout="", stderr="still running"
        ),
    )

    def capture_report(**kwargs) -> bool:
        captured_report.update(run_test._build_report_payload(**kwargs))
        return True

    monkeypatch.setattr(run_test, "_write_report_if_requested", capture_report)

    assert run_test.main(args) == 1
    assert captured_report["overall"] == "FAIL"
    report_results = captured_report["results"]
    assert isinstance(report_results, list)
    assert report_results[-1]["name"] == "service-teardown"
    assert report_results[-1]["status"] == "FAIL"


def test_e2e_bootstrap_no_start_skips_cleanup(monkeypatch) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(run_test, "_e2e_configured", lambda: True)

    monkeypatch.setattr(
        run_test.service_cleanup,
        "main",
        lambda args: (_ for _ in ()).throw(
            AssertionError("cleanup should not run with --no-start")
        ),
    )
    monkeypatch.setattr(
        run_test,
        "_run",
        lambda cmd, cwd=None: (_ for _ in ()).throw(
            AssertionError("service start should not run")
        ),
    )

    started_by_runner, bootstrap = run_test._start_services_if_needed(
        ["e2e"], no_start=True
    )

    assert started_by_runner is False
    assert bootstrap.status == "SKIP"
    assert bootstrap.message == "disabled by --no-start"


def test_all_suite_e2e_bootstrap_runs_cleanup(monkeypatch) -> None:
    from tools.inst import run_test

    monkeypatch.setattr(run_test, "_e2e_configured", lambda: True)

    cleanup_calls = 0

    def fake_cleanup(args) -> int:
        nonlocal cleanup_calls
        cleanup_calls += 1
        return 0

    def fake_run(cmd: list[str], cwd=None) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(cmd, 0, stdout="Services started", stderr="")

    monkeypatch.setattr(run_test.service_cleanup, "main", fake_cleanup)
    monkeypatch.setattr(run_test, "_run", fake_run)

    started_by_runner, bootstrap = run_test._start_services_if_needed(
        ["schema", "api", "frontend", "e2e"],
        no_start=False,
    )

    assert started_by_runner is True
    assert bootstrap.status == "OK"
    assert cleanup_calls == 1


def test_e2e_suite_uses_the_frontend_package_script(monkeypatch, tmp_path) -> None:
    from tools.inst import run_test

    e2e_tests = tmp_path / "frontend" / "tests" / "e2e"
    e2e_tests.mkdir(parents=True)
    commands: list[tuple[list[str], object, dict[str, str] | None]] = []
    environment = {"PLAYWRIGHT_BASE_URL": "http://localhost:6123"}

    monkeypatch.setattr(run_test, "ROOT", tmp_path)
    monkeypatch.setattr(
        run_test.shutil, "which", lambda name: "/usr/bin/npm" if name == "npm" else None
    )
    monkeypatch.setattr(
        run_test.e2e_runtime, "playwright_environment", lambda _root: environment
    )
    monkeypatch.setattr(
        run_test,
        "_run",
        lambda command, cwd=None, env=None: (
            commands.append((command, cwd, env))
            or subprocess.CompletedProcess(command, 0, stdout="2 passed", stderr="")
        ),
    )

    result = run_test._run_e2e_suite()

    assert result.status == "OK"
    assert commands == [
        (["/usr/bin/npm", "run", "test:e2e"], tmp_path / "frontend", environment)
    ]


def test_playwright_base_url_uses_runtime_frontend_override() -> None:
    from tools.inst import e2e as e2e_runtime
    from tools.inst import run_test

    environment = e2e_runtime.playwright_environment(
        run_test.ROOT,
        environ={
            "FRONTEND_HOST": "0.0.0.0",
            "FRONTEND_PORT": "6123",
            "PLAYWRIGHT_BASE_URL": "http://stale.example:9999",
            "DATABASE_URL": "postgresql://private.example/database",
        },
    )

    assert environment["PLAYWRIGHT_BASE_URL"] == "http://127.0.0.1:6123"
    assert "DATABASE_URL" not in environment


def test_report_writer_creates_markdown_and_json(tmp_path) -> None:
    paths = report.write_test_report(tmp_path, _payload(), "all")

    assert len(paths) == 2
    assert {path.suffix for path in paths} == {".md", ".json"}
    assert all(path.parent == tmp_path / ".report" for path in paths)
    markdown = next(path for path in paths if path.suffix == ".md").read_text(
        encoding="utf-8"
    )
    json_report = next(path for path in paths if path.suffix == ".json").read_text(
        encoding="utf-8"
    )

    assert "# 🧪 Project Tooling Test Report" in markdown
    assert "## 📋 Summary" in markdown
    assert "full stdout content" in markdown
    assert "full stderr content" in markdown
    assert '"stdout": "full stdout content"' in json_report
    assert '"stderr": "full stderr content"' in json_report


def test_report_cleanup_removes_report_directory(tmp_path) -> None:
    report.write_test_report(tmp_path, _payload(), "md")

    assert report.clean_reports(tmp_path) is True
    assert not (tmp_path / ".report").exists()
    assert report.clean_reports(tmp_path) is False


def test_report_writer_rejects_symlinked_report_directory(tmp_path) -> None:
    external = tmp_path / "external"
    state_root = tmp_path / ".tooling-state"
    external.mkdir()
    state_root.mkdir()
    (state_root / ".report").symlink_to(external, target_is_directory=True)

    with pytest.raises(FilesystemSafetyError):
        report.write_test_report(state_root, _payload(), "md")

    assert list(external.iterdir()) == []
