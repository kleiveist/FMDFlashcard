from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import replace

import pytest

from tools.adapters import (
    BackendAdapter,
    CiAdapter,
    ContainerAdapter,
    DatabaseAdapter,
    DocumentationAdapter,
    FrontendAdapter,
    QualityAdapter,
    ReleaseAdapter,
    TauriAdapter,
)
from tools.adapters import (
    TestingAdapter as ToolingTestingAdapter,
)
from tools.adapters import base as adapter_base
from tools.adapters.base import (
    AdapterActionResult,
    AdapterCapability,
    BaseAdapter,
    run_control_action,
)
from tools.core.context import ProjectContext

ACTION_CASES = (
    (
        FrontendAdapter,
        "install",
        AdapterCapability.INSTALL,
        ("install", "--skip-backend", "--skip-tooling", "--skip-playwright"),
    ),
    (
        FrontendAdapter,
        "test",
        AdapterCapability.TEST,
        ("test", "--suite", "frontend"),
    ),
    (FrontendAdapter, "build", AdapterCapability.BUILD, ("build", "web")),
    (
        BackendAdapter,
        "install",
        AdapterCapability.INSTALL,
        ("install", "--skip-frontend", "--skip-tooling", "--skip-playwright"),
    ),
    (
        BackendAdapter,
        "test",
        AdapterCapability.TEST,
        ("test", "--suite", "api"),
    ),
    (TauriAdapter, "install", AdapterCapability.INSTALL, ("tauri", "install")),
    (
        TauriAdapter,
        "run",
        AdapterCapability.RUN,
        ("tauri", "run", "--no-follow"),
    ),
    (TauriAdapter, "stop", AdapterCapability.STOP, ("tauri", "stop")),
    (TauriAdapter, "test", AdapterCapability.TEST, ("tauri", "test")),
    (TauriAdapter, "build", AdapterCapability.BUILD, ("tauri", "build")),
    (
        DatabaseAdapter,
        "test",
        AdapterCapability.TEST,
        ("test", "--suite", "database"),
    ),
    (
        ContainerAdapter,
        "test",
        AdapterCapability.TEST,
        ("container", "validate"),
    ),
    (
        ContainerAdapter,
        "build",
        AdapterCapability.BUILD,
        ("build", "container"),
    ),
    (QualityAdapter, "test", AdapterCapability.TEST, ("quality",)),
    (
        ToolingTestingAdapter,
        "test",
        AdapterCapability.TEST,
        ("test", "--suite", "tools"),
    ),
    (
        DocumentationAdapter,
        "test",
        AdapterCapability.TEST,
        ("docs", "check"),
    ),
    (ReleaseAdapter, "test", AdapterCapability.TEST, ("release", "check")),
)


@pytest.mark.parametrize(
    ("adapter_type", "method_name", "capability", "arguments"),
    ACTION_CASES,
)
def test_builtin_capabilities_run_only_fixed_control_arguments(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
    adapter_type: type[BaseAdapter],
    method_name: str,
    capability: AdapterCapability,
    arguments: tuple[str, ...],
) -> None:
    control = adapter_context.tools_root / "control.py"
    control.write_text("raise SystemExit(0)\n", encoding="utf-8")
    calls: list[tuple[tuple[str, ...], dict[str, object]]] = []

    def fake_run(
        command: tuple[str, ...], **kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        calls.append((command, kwargs))
        return subprocess.CompletedProcess(
            command,
            0,
            stdout="fixed action completed\n",
            stderr="",
        )

    monkeypatch.setenv("GIT_DIR", "/untrusted/repository")
    monkeypatch.setenv("GIT_CONFIG_COUNT", "1")
    monkeypatch.setenv("PYTHONHOME", "/untrusted/python")
    monkeypatch.setenv("PYTHONPATH", "/untrusted/imports")
    monkeypatch.setenv("PYTHONPYCACHEPREFIX", "/untrusted/cache")
    for key in (
        "AWS_SECRET_ACCESS_KEY",
        "GITHUB_TOKEN",
        "HTTP_PROXY",
        "NPM_TOKEN",
        "PROJECT_API_TOKEN",
        "SSH_AUTH_SOCK",
    ):
        monkeypatch.setenv(key, "must-not-leak")
    monkeypatch.setattr(adapter_base, "run_bounded", fake_run)
    adapter = adapter_type()
    action = getattr(adapter, method_name)

    result = action(adapter_context)

    assert result == AdapterActionResult(
        adapter=adapter.name,
        capability=capability,
        ok=True,
        message="Control action completed successfully: fixed action completed",
    )
    assert len(calls) == 1
    command, kwargs = calls[0]
    assert command == (sys.executable, str(control), *arguments)
    assert kwargs["cwd"] == adapter_context.project_root
    assert kwargs["check"] is False
    assert kwargs["capture_output"] is True
    assert kwargs["text"] is True
    assert kwargs["timeout"] == 900
    assert kwargs["shell"] is False
    assert kwargs["stdin"] is subprocess.DEVNULL
    environment = kwargs["env"]
    assert isinstance(environment, dict)
    assert "GIT_DIR" not in environment
    assert "GIT_CONFIG_COUNT" not in environment
    assert environment["GIT_CONFIG_GLOBAL"] == os.devnull
    assert environment["GIT_CONFIG_NOSYSTEM"] == "1"
    assert "PYTHONHOME" not in environment
    assert "PYTHONPATH" not in environment
    assert environment["PYTHONPYCACHEPREFIX"] != "/untrusted/cache"
    assert not {
        "AWS_SECRET_ACCESS_KEY",
        "GITHUB_TOKEN",
        "HTTP_PROXY",
        "NPM_TOKEN",
        "PROJECT_API_TOKEN",
        "SSH_AUTH_SOCK",
    }.intersection(environment)
    assert environment["HOME"] != os.environ.get("HOME")
    assert environment["PYTHONDONTWRITEBYTECODE"] == "1"
    assert environment["PYTHONNOUSERSITE"] == "1"


def test_builtin_capability_declarations_match_fixed_actions() -> None:
    assert {
        adapter.name: adapter.capabilities
        for adapter in (
            FrontendAdapter(),
            BackendAdapter(),
            TauriAdapter(),
            DatabaseAdapter(),
            ContainerAdapter(),
            QualityAdapter(),
            ToolingTestingAdapter(),
            DocumentationAdapter(),
            ReleaseAdapter(),
            CiAdapter(),
        )
    } == {
        "backend": frozenset({AdapterCapability.INSTALL, AdapterCapability.TEST}),
        "ci": frozenset(),
        "container": frozenset({AdapterCapability.BUILD, AdapterCapability.TEST}),
        "database": frozenset({AdapterCapability.TEST}),
        "documentation": frozenset({AdapterCapability.TEST}),
        "frontend": frozenset(
            {
                AdapterCapability.BUILD,
                AdapterCapability.INSTALL,
                AdapterCapability.TEST,
            }
        ),
        "quality": frozenset({AdapterCapability.TEST}),
        "release": frozenset({AdapterCapability.TEST}),
        "tauri": frozenset(AdapterCapability),
        "testing": frozenset({AdapterCapability.TEST}),
    }


def test_control_action_propagates_failure_and_sanitizes_output(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    control = adapter_context.tools_root / "control.py"
    control.write_text("raise SystemExit(7)\n", encoding="utf-8")

    def fake_run(
        command: tuple[str, ...], **_kwargs: object
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(
            command,
            7,
            stdout=f"working directory: {adapter_context.project_root}/frontend\n",
            stderr="token=do-not-expose\n",
        )

    monkeypatch.setattr(adapter_base, "run_bounded", fake_run)

    result = FrontendAdapter().test(adapter_context)

    assert not result.ok
    assert result.adapter == "frontend"
    assert result.capability is AdapterCapability.TEST
    assert "exit code 7" in result.message
    assert str(adapter_context.project_root) not in result.message
    assert "do-not-expose" not in result.message
    assert "<redacted sensitive line>" in result.message


def test_missing_control_entry_point_fails_closed_without_subprocess(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("subprocess must not run")

    monkeypatch.setattr(adapter_base, "run_bounded", unexpected_run)

    result = FrontendAdapter().test(adapter_context)

    assert not result.ok
    assert "entry point is unsafe" in result.message


def test_symlinked_control_entry_point_fails_closed_without_subprocess(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    external = tmp_path.parent / f"{tmp_path.name}-external-control.py"
    external.write_text("raise SystemExit(0)\n", encoding="utf-8")
    (adapter_context.tools_root / "control.py").symlink_to(external)

    def unexpected_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("subprocess must not run")

    monkeypatch.setattr(adapter_base, "run_bounded", unexpected_run)

    result = FrontendAdapter().test(adapter_context)

    assert not result.ok
    assert "entry point is unsafe" in result.message


def test_nested_tooling_root_fails_closed_without_subprocess(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    nested = adapter_context.project_root / "vendor" / "tools"
    nested.mkdir(parents=True)
    (nested / "control.py").write_text("raise SystemExit(0)\n", encoding="utf-8")

    def unexpected_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("subprocess must not run")

    monkeypatch.setattr(adapter_base, "run_bounded", unexpected_run)

    result = FrontendAdapter().test(replace(adapter_context, tools_root=nested))

    assert not result.ok
    assert "entry point is unsafe" in result.message


def test_control_action_timeout_is_reported_as_failure(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    control = adapter_context.tools_root / "control.py"
    control.write_text("raise SystemExit(0)\n", encoding="utf-8")

    def timeout(command: tuple[str, ...], **_kwargs: object) -> None:
        raise subprocess.TimeoutExpired(
            command,
            timeout=900,
            output=f"waiting in {adapter_context.project_root}",
            stderr="password=do-not-expose",
        )

    monkeypatch.setattr(adapter_base, "run_bounded", timeout)

    result = FrontendAdapter().build(adapter_context)

    assert not result.ok
    assert "timed out after 900 seconds" in result.message
    assert str(adapter_context.project_root) not in result.message
    assert "do-not-expose" not in result.message


def test_unallowlisted_control_action_fails_without_subprocess(
    adapter_context: ProjectContext,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def unexpected_run(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("subprocess must not run")

    monkeypatch.setattr(adapter_base, "run_bounded", unexpected_run)

    result = run_control_action(
        adapter_context,
        adapter="ci",
        capability=AdapterCapability.TEST,
    )

    assert not result.ok
    assert result.message == "Control action is not allowlisted for this adapter."
