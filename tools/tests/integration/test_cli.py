from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from tools import control
from tools.adapters import AdapterActionResult, AdapterCapability
from tools.integration import service


def test_root_help_exposes_portable_integration_commands(capsys) -> None:
    assert control.main([]) == 0

    output = capsys.readouterr().out
    assert "python tools/control.py integrate --check" in output
    assert "python tools/control.py integrate --full-fix" in output
    assert "python tools/control.py tooling verify" in output
    assert "python tools/control.py template" not in output


def test_control_dispatches_integration_and_tooling_commands() -> None:
    handlers = control._handlers()

    assert handlers["integrate"] is control.integration_cli.main
    assert handlers["tooling"] is control.integration_cli.main
    assert "template" not in handlers
    assert "init" not in handlers


def test_integrate_requires_exactly_one_mode() -> None:
    parser = control._build_parser()

    check = parser.parse_args(["integrate", "--check"])
    full_fix = parser.parse_args(["integrate", "--full-fix"])
    assert check.check and not check.full_fix
    assert full_fix.full_fix and not full_fix.check

    with pytest.raises(SystemExit) as missing:
        parser.parse_args(["integrate"])
    assert missing.value.code == 2

    with pytest.raises(SystemExit) as conflicting:
        parser.parse_args(["integrate", "--check", "--full-fix"])
    assert conflicting.value.code == 2


def test_bare_tooling_prints_maintenance_map(capsys) -> None:
    assert control.main(["tooling"]) == 0

    output = capsys.readouterr().out
    assert "migrate" in output
    assert "verify" in output
    assert "action" in output
    assert "export" in output


@pytest.mark.parametrize(
    ("arguments", "service_name"),
    (
        (["integrate", "--check"], "run_check"),
        (["integrate", "--full-fix"], "run_full_fix"),
        (["tooling", "migrate", "--check"], "run_migrate"),
        (["tooling", "verify"], "run_verify"),
        (["tooling", "action", "frontend", "test"], "run_adapter_action"),
        (["tooling", "export"], "run_export"),
    ),
)
def test_phase_five_commands_dispatch_to_the_portable_service(
    monkeypatch: pytest.MonkeyPatch,
    arguments: list[str],
    service_name: str,
) -> None:
    calls: list[dict[str, object]] = []

    def fake_service(**kwargs: object) -> int:
        calls.append(kwargs)
        return 0

    monkeypatch.setattr(service, service_name, fake_service)

    assert control.main(arguments) == 0
    assert len(calls) == 1


def test_adapter_action_dispatch_carries_only_typed_fixed_arguments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []

    def fake_service(**kwargs: object) -> int:
        calls.append(kwargs)
        return 0

    monkeypatch.setattr(service, "run_adapter_action", fake_service)

    assert control.main(["tooling", "action", "frontend", "build", "--json"]) == 0
    assert calls == [
        {
            "adapter_name": "frontend",
            "capability": "build",
            "json_output": True,
        }
    ]


def test_adapter_action_service_invokes_only_a_profile_selected_capability(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
    capsys,
) -> None:
    class _Adapter:
        name = "frontend"
        capabilities = frozenset({AdapterCapability.TEST})

        def test(self, context: object) -> AdapterActionResult:
            assert context is fake_context
            return AdapterActionResult(
                adapter=self.name,
                capability=AdapterCapability.TEST,
                ok=True,
                message="frontend tests passed",
            )

    fake_context = SimpleNamespace(project_root=tmp_path)
    assessment = SimpleNamespace(
        adapters=(_Adapter(),),
        context=fake_context,
        profile=SimpleNamespace(profile_id="web-only"),
    )
    monkeypatch.setattr(service, "assess_project", lambda *_args, **_kwargs: assessment)

    code = service.run_adapter_action(
        adapter_name="frontend",
        capability="test",
        json_output=True,
    )
    payload = json.loads(capsys.readouterr().out)

    assert code == 0
    assert payload == {
        "action": "tooling-adapter-action",
        "adapter": "frontend",
        "capability": "test",
        "message": "frontend tests passed",
        "schema_version": 1,
        "status": "OK",
    }
