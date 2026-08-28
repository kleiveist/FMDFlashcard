from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from tools.integration import actions as actions_module
from tools.integration.actions import ActionKind, ActionRunner, ActionSpec
from tools.integration.model import FindingStatus, IntegrationError

# Hosted Windows process startup can exceed the Unix budget in the nested matrix.
_REAL_NPM_TIMEOUT_SECONDS = 90 if os.name == "nt" else 30


def _staging_root(tmp_path: Path) -> Path:
    root = tmp_path / "staging"
    (root / "tools" / "adapters").mkdir(parents=True)
    (root / "tools" / "integration").mkdir()
    (root / "tools" / "tests" / "adapters").mkdir(parents=True)
    (root / "tools" / "tests" / "integration").mkdir()
    (root / "tools" / "__init__.py").write_text("", encoding="utf-8")
    return root


def test_action_specs_are_fixed_bounded_and_unique() -> None:
    assert ActionSpec(" QUALITY ").kind is ActionKind.QUALITY
    assert ActionSpec(" BUILD ").kind is ActionKind.BUILD
    assert ActionSpec(
        ActionKind.DEPENDENCIES,
        paths=("frontend/package.json",),
    ).paths == ("frontend/package.json",)
    with pytest.raises(ValueError, match="Unsupported integration action kind"):
        ActionSpec("arbitrary-command")
    with pytest.raises(ValueError, match="timeout"):
        ActionSpec(ActionKind.TESTS, timeout_seconds=0)
    with pytest.raises(ValueError, match="unique"):
        ActionRunner((ActionSpec("tests"), ActionSpec("tests")))
    with pytest.raises(TypeError, match="ActionSpec"):
        ActionRunner(("quality",))  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="safe relative"):
        ActionSpec(ActionKind.DEPENDENCIES, paths=("../package.json",))


def test_runner_uses_only_fixed_commands_in_canonical_order_and_sanitized_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    safe_bin = tmp_path / "safe-bin"
    safe_bin.mkdir()
    calls: list[tuple[tuple[str, ...], dict[str, object]]] = []
    monkeypatch.setenv("PROJECT_API_TOKEN", "must-not-leak")
    monkeypatch.setenv("PATH", f".{os.pathsep}{root}{os.pathsep}{safe_bin}")

    def fake_run(
        command: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append((command, kwargs))
        return subprocess.CompletedProcess(command, 0, stdout="ok", stderr="")

    monkeypatch.setattr(actions_module, "run_bounded", fake_run)
    runner = ActionRunner(
        (
            ActionSpec(ActionKind.TESTS, timeout_seconds=23),
            ActionSpec(ActionKind.QUALITY, timeout_seconds=22),
        )
    )

    result = runner(root)

    assert [command for command, _kwargs in calls] == [
        (
            sys.executable,
            "-I",
            "-B",
            "-m",
            "ruff",
            "check",
            "--isolated",
            "--no-cache",
            str(root / "tools" / "adapters"),
            str(root / "tools" / "integration"),
        ),
        (
            sys.executable,
            "-I",
            "-B",
            "-c",
            actions_module._PYTEST_LAUNCHER,
            str(root / "tools"),
            "-c",
            os.devnull,
            "--rootdir",
            str(root / "tools"),
            "--confcutdir",
            str(root / "tools" / "tests"),
            "--import-mode=importlib",
            "-p",
            "no:cacheprovider",
            "-q",
            str(root / "tools" / "tests" / "adapters"),
            str(root / "tools" / "tests" / "integration"),
        ),
    ]
    assert [kwargs["timeout"] for _command, kwargs in calls] == [22, 23]
    assert all(kwargs["cwd"] == root for _command, kwargs in calls)
    assert all(kwargs["shell"] is False for _command, kwargs in calls)
    environment = calls[0][1]["env"]
    assert isinstance(environment, dict)
    assert "PROJECT_API_TOKEN" not in environment
    assert environment["HOME"] != os.environ.get("HOME")
    assert environment["PYTHONDONTWRITEBYTECODE"] == "1"
    assert environment["GIT_TERMINAL_PROMPT"] == "0"
    assert environment["PIP_NO_INDEX"] == "1"
    assert environment["UV_OFFLINE"] == "1"
    assert environment["CARGO_NET_OFFLINE"] == "true"
    assert environment["npm_config_offline"] == "true"
    assert environment["npm_config_ignore_scripts"] == "true"
    assert environment["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] == "1"
    assert environment["TEMPLATE_TOOLING_NESTED_TEST"] == "1"
    assert environment["PATH"] == str(safe_bin.resolve())
    assert tuple(finding.status for finding in result.findings) == (
        FindingStatus.PASS,
        FindingStatus.PASS,
    )


def test_action_environment_uses_only_the_installed_rustup_runtime(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    temporary = tmp_path / "action-runtime"
    temporary.mkdir()
    rustup_home = tmp_path / "installed-rustup"
    rustup_home.mkdir()
    monkeypatch.setenv("RUSTUP_HOME", str(rustup_home))
    monkeypatch.setenv("RUSTUP_TOOLCHAIN", "stable-x86_64-unknown-linux-gnu")

    environment = actions_module._action_environment(temporary, root)

    assert environment["RUSTUP_HOME"] == str(rustup_home.resolve())
    assert environment["RUSTUP_TOOLCHAIN"] == "stable-x86_64-unknown-linux-gnu"
    assert environment["CARGO_HOME"].startswith(str(temporary))
    assert environment["CARGO_HOME"] != environment["RUSTUP_HOME"]


def test_build_action_runs_only_fixed_manifest_commands(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    frontend = root / "frontend"
    desktop = root / "desktop"
    frontend.mkdir()
    desktop.mkdir()
    (frontend / "package.json").write_text(
        '{"scripts":{"build":"vite build"}}\n', encoding="utf-8"
    )
    (desktop / "Cargo.toml").write_text(
        '[package]\nname = "fixture"\nversion = "0.1.0"\n', encoding="utf-8"
    )
    calls: list[tuple[tuple[str, ...], dict[str, object]]] = []

    def fake_which(name: str, **_kwargs: object) -> str | None:
        return {"npm": "/usr/bin/npm", "cargo": "/usr/bin/cargo"}.get(name)

    def fake_run(
        command: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append((command, kwargs))
        return subprocess.CompletedProcess(command, 0, stdout="built", stderr="")

    monkeypatch.setattr(actions_module.shutil, "which", fake_which)
    monkeypatch.setattr(actions_module, "run_bounded", fake_run)

    result = ActionRunner(
        (
            ActionSpec(
                ActionKind.BUILD,
                paths=("frontend/package.json", "desktop/Cargo.toml"),
            ),
        )
    )(root)

    assert result.ok
    assert [command for command, _kwargs in calls] == [
        ("/usr/bin/cargo", "check", "--locked"),
        ("/usr/bin/npm", "run", "build"),
    ]
    assert [kwargs["cwd"] for _command, kwargs in calls] == [desktop, frontend]
    assert all(kwargs["shell"] is False for _command, kwargs in calls)
    environment = calls[0][1]["env"]
    assert isinstance(environment, dict)
    assert environment["CARGO_TARGET_DIR"].startswith(environment["XDG_CACHE_HOME"])


def test_real_npm_build_action_executes_declared_build_script(tmp_path: Path) -> None:
    if shutil.which("npm") is None:
        pytest.skip("npm is unavailable; real npm build path cannot run")
    root = _staging_root(tmp_path)
    frontend = root / "frontend"
    frontend.mkdir()
    script = (
        "node -e \"const fs=require('node:fs');"
        "fs.mkdirSync('dist',{recursive:true});"
        "fs.writeFileSync('dist/proof.txt','built')\""
    )
    (frontend / "package.json").write_text(
        json.dumps({"name": "fixture", "scripts": {"build": script}}) + "\n",
        encoding="utf-8",
    )

    result = ActionRunner(
        (ActionSpec(ActionKind.BUILD, paths=("frontend/package.json",)),)
    )(root)

    assert result.ok, result.findings[0].message
    assert (frontend / "dist/proof.txt").read_text(encoding="utf-8") == "built"


def test_real_python_build_action_compiles_without_cache_artifacts(
    tmp_path: Path,
) -> None:
    root = _staging_root(tmp_path)
    (root / "pyproject.toml").write_text(
        '[project]\nname = "fixture"\nversion = "0.1.0"\n',
        encoding="utf-8",
    )
    (root / "fixture.py").write_text("VALUE = 1\n", encoding="utf-8")

    result = ActionRunner((ActionSpec(ActionKind.BUILD, paths=("pyproject.toml",)),))(
        root
    )

    assert result.ok, result.findings[0].message
    assert not list(root.rglob("__pycache__"))


@pytest.mark.parametrize(
    ("paths", "message"),
    (
        ((), "no supported build manifest trigger path"),
        (("notes.txt",), "no fixed build command"),
    ),
)
def test_build_action_refuses_unmodeled_or_missing_commands(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    paths: tuple[str, ...],
    message: str,
) -> None:
    root = _staging_root(tmp_path)
    (root / "notes.txt").write_text("customer-owned\n", encoding="utf-8")

    def forbidden_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("build action must not synthesize a process result")

    monkeypatch.setattr(actions_module, "run_bounded", forbidden_run)
    result = ActionRunner((ActionSpec(ActionKind.BUILD, paths=paths),))(root)

    assert not result.ok
    assert result.findings[0].status is FindingStatus.FAIL
    assert message in result.findings[0].message


def test_quality_failpoint_stops_before_starting_a_process(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    monkeypatch.setenv("TOOLING_TEST_FAILPOINT", "quality_check")

    def forbidden_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("quality failpoint must run before the command")

    monkeypatch.setattr(actions_module, "run_bounded", forbidden_run)
    result = ActionRunner((ActionSpec(ActionKind.QUALITY),))(root)

    assert not result.ok
    assert (
        "Deterministic test failpoint triggered: quality_check"
        in result.findings[0].message
    )


def test_dependency_failpoint_stops_before_starting_installer(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    frontend = root / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text("{}\n", encoding="utf-8")
    (frontend / "package-lock.json").write_text("{}\n", encoding="utf-8")
    monkeypatch.setenv("TOOLING_TEST_FAILPOINT", "dependency_install")
    monkeypatch.setattr(
        actions_module.shutil,
        "which",
        lambda *_args, **_kwargs: "/usr/bin/npm",
    )

    def forbidden_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("dependency failpoint must run before the installer")

    monkeypatch.setattr(actions_module, "run_bounded", forbidden_run)
    result = ActionRunner(
        (
            ActionSpec(
                ActionKind.DEPENDENCIES,
                paths=("frontend/package.json",),
            ),
        )
    )(root)

    assert not result.ok
    assert (
        "Deterministic test failpoint triggered: dependency_install"
        in result.findings[0].message
    )


def test_failpoint_environment_is_ignored_without_pytest_execution_context(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    monkeypatch.setenv("TOOLING_TEST_FAILPOINT", "quality_check")
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    def fake_run(
        command: tuple[str, ...], **_kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(actions_module, "run_bounded", fake_run)
    result = ActionRunner((ActionSpec(ActionKind.QUALITY),))(root)

    assert result.ok


def test_dependency_action_fails_closed_without_running_a_process(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)

    def forbidden_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("dependency action must not start a process")

    monkeypatch.setattr(actions_module, "run_bounded", forbidden_run)
    result = ActionRunner((ActionSpec(ActionKind.DEPENDENCIES),))(root)

    assert not result.ok
    assert result.findings[0].status is FindingStatus.FAIL
    assert "no dependency manifest trigger path" in result.findings[0].message
    assert "Network and lifecycle scripts remain disabled" in result.findings[0].message


def test_dependency_action_runs_locked_offline_npm_without_lifecycle_scripts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    frontend = root / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text(
        '{"name":"fixture","version":"1.0.0"}\n', encoding="utf-8"
    )
    (frontend / "package-lock.json").write_text(
        '{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{}}\n',
        encoding="utf-8",
    )
    calls: list[tuple[tuple[str, ...], dict[str, object]]] = []
    monkeypatch.setattr(
        actions_module.shutil,
        "which",
        lambda *_args, **_kwargs: "/usr/bin/npm",
    )

    def fake_run(
        command: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append((command, kwargs))
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr(actions_module, "run_bounded", fake_run)

    result = ActionRunner(
        (
            ActionSpec(
                ActionKind.DEPENDENCIES,
                paths=("frontend/package.json",),
            ),
        )
    )(root)

    assert result.ok
    assert result.findings[0].status is FindingStatus.PASS
    command, kwargs = calls[0]
    assert command == (
        "/usr/bin/npm",
        "ci",
        "--ignore-scripts",
        "--offline",
        "--no-audit",
        "--no-fund",
    )
    assert kwargs["cwd"] == frontend
    assert kwargs["shell"] is False
    environment = kwargs["env"]
    assert isinstance(environment, dict)
    assert environment["NPM_CONFIG_IGNORE_SCRIPTS"] == "true"
    assert environment["NPM_CONFIG_OFFLINE"] == "true"


def test_real_locked_empty_npm_project_installs_offline_in_staging(
    tmp_path: Path,
) -> None:
    if shutil.which("npm") is None:
        pytest.skip("npm is unavailable")
    root = _staging_root(tmp_path)
    frontend = root / "frontend"
    frontend.mkdir()
    (frontend / "package.json").write_text(
        '{"name":"fixture","version":"1.0.0"}\n', encoding="utf-8"
    )
    (frontend / "package-lock.json").write_text(
        '{"name":"fixture","version":"1.0.0","lockfileVersion":3,'
        '"requires":true,"packages":{"":{"name":"fixture","version":"1.0.0"}}}\n',
        encoding="utf-8",
    )

    result = ActionRunner(
        (
            ActionSpec(
                ActionKind.DEPENDENCIES,
                paths=("frontend/package.json",),
                timeout_seconds=_REAL_NPM_TIMEOUT_SECONDS,
            ),
        )
    )(root)

    assert result.ok, result.findings[0].message
    assert result.findings[0].status is FindingStatus.PASS


def test_runner_returns_sanitized_failure_finding_and_stops(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)
    calls = 0

    def fake_run(
        command: tuple[str, ...], **_kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        nonlocal calls
        calls += 1
        return subprocess.CompletedProcess(
            command,
            7,
            stdout=f"path={root}/private\n",
            stderr="api_token=top-secret\n",
        )

    monkeypatch.setattr(actions_module, "run_bounded", fake_run)
    result = ActionRunner(
        (ActionSpec(ActionKind.QUALITY), ActionSpec(ActionKind.TESTS))
    )(root)

    assert calls == 1
    assert not result.ok
    assert len(result.findings) == 1
    finding = result.findings[0]
    assert finding.status is FindingStatus.FAIL
    assert "exit code 7" in finding.message
    assert str(root) not in finding.message
    assert "top-secret" not in finding.message
    assert "<redacted sensitive line>" in finding.message


def test_runner_turns_timeout_into_a_failure_finding(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = _staging_root(tmp_path)

    def timeout(command: tuple[str, ...], **_kwargs: object) -> None:
        raise subprocess.TimeoutExpired(command, 5)

    monkeypatch.setattr(actions_module, "run_bounded", timeout)
    result = ActionRunner((ActionSpec(ActionKind.TESTS, timeout_seconds=5),))(root)

    assert not result.ok
    assert result.findings[0].status is FindingStatus.FAIL
    assert "timed out after 5 seconds" in result.findings[0].message


def test_quality_and_tests_ignore_customer_python_hijack_files(
    tmp_path: Path,
) -> None:
    root = _staging_root(tmp_path)
    for relative in (
        "tools/adapters/__init__.py",
        "tools/integration/__init__.py",
        "tools/tests/__init__.py",
        "tools/tests/adapters/test_safe.py",
        "tools/tests/integration/test_safe.py",
    ):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            "import tools\n\n\ndef test_safe():\n    assert tools is not None\n",
            encoding="utf-8",
        )
    marker = root / "customer-python-loaded"
    sentinel = (
        "from pathlib import Path\n"
        f"Path({str(marker)!r}).write_text('loaded', encoding='utf-8')\n"
        "raise RuntimeError('customer Python must not be imported')\n"
    )
    for name in ("conftest.py", "pytest.py", "ruff.py"):
        (root / name).write_text(sentinel, encoding="utf-8")

    result = ActionRunner(
        (ActionSpec(ActionKind.QUALITY), ActionSpec(ActionKind.TESTS))
    )(root)

    assert result.ok, tuple(finding.message for finding in result.findings)
    assert not marker.exists()


def test_runner_rejects_missing_or_symlinked_staging_root(tmp_path: Path) -> None:
    missing = tmp_path / "missing"
    with pytest.raises(IntegrationError, match="missing or unreadable"):
        ActionRunner((ActionSpec(ActionKind.QUALITY),))(missing)

    actual = tmp_path / "actual"
    actual.mkdir()
    linked = tmp_path / "linked"
    try:
        os.symlink(actual, linked)
    except (OSError, NotImplementedError):
        pytest.skip("symbolic links are not available")
    with pytest.raises(IntegrationError, match="must not be a symbolic link"):
        ActionRunner((ActionSpec(ActionKind.QUALITY),))(linked)
