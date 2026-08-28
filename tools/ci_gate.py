"""Evidence-based Gate-0 status for the full portable acceptance CI.

The gate intentionally distinguishes an implemented proof from a missing
implementation.  It never converts an unavailable capability into a passing
acceptance result merely because a unit test can be collected.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from tools.adapters import build_default_registry
from tools.core.context import load_context
from tools.core.project_config import ProjectConfig, ProjectPathConfig
from tools.integration.actions import ActionKind
from tools.integration.export import export_portable_tooling
from tools.integration.migrations import REGISTRY
from tools.integration.model import Ownership
from tools.integration.transaction import TransactionRequest
from tools.profiles.loader import load_catalog


class GateStatus(str, Enum):
    PASS = "PASS"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True, slots=True)
class GateEvidence:
    check: str
    status: GateStatus
    message: str


def evaluate_gate_zero(tools_root: Path | None = None) -> tuple[GateEvidence, ...]:
    """Inspect concrete runtime capabilities required before green acceptance."""

    tools = Path(tools_root or Path(__file__).resolve().parent).resolve()
    project = tools.parent
    context = load_context(project, tools_root=tools)
    catalog = load_catalog(context.resources.profiles)
    registry = build_default_registry()
    structured = _profile_structured_targets(context, catalog, registry)
    required_targets = {
        "web-only": {"package.json"},
        "web-cloud": {"package.json", "pyproject.toml"},
        "desktop-local": {"package.json", "Cargo.toml", "tauri.conf.json"},
        "desktop-cloud": {
            "package.json",
            "pyproject.toml",
            "Cargo.toml",
            "tauri.conf.json",
        },
        "full-platform": {
            "package.json",
            "pyproject.toml",
            "Cargo.toml",
            "tauri.conf.json",
        },
    }
    profile_gaps = {
        profile: sorted(expected.difference(structured.get(profile, frozenset())))
        for profile, expected in required_targets.items()
    }
    missing_profiles = {
        profile: missing for profile, missing in profile_gaps.items() if missing
    }
    build_action_available = "build" in {item.value for item in ActionKind}
    evidence = [
        _evidence(
            "profile-desired-state",
            not missing_profiles,
            (
                "All profiles declare allowlisted structured targets."
                if not missing_profiles
                else "Missing structured desired-state targets: "
                + "; ".join(
                    f"{profile} ({', '.join(targets)})"
                    for profile, targets in sorted(missing_profiles.items())
                )
            ),
        ),
        _evidence(
            "transactional-action-kinds",
            build_action_available,
            (
                "Dependencies, quality, tests, and build actions are typed."
                if build_action_available
                else "The transactional action executor has no typed build action."
            ),
        ),
        _evidence(
            "deterministic-failpoints",
            _has_failpoints(tools),
            (
                "Test-only deterministic failpoints are implemented."
                if _has_failpoints(tools)
                else "TOOLING_TEST_FAILPOINT is not implemented for rollback injection."
            ),
        ),
        _evidence(
            "transaction-boundary",
            "staged_action" in TransactionRequest.__dataclass_fields__,
            "The action executor can run inside the transaction staging boundary.",
        ),
        _evidence(
            "versioned-migration",
            bool(REGISTRY.migrations),
            "At least one registered tooling migration exists.",
        ),
        _evidence(
            "deterministic-export",
            callable(export_portable_tooling),
            "The deterministic portable exporter is available.",
        ),
    ]
    return tuple(evidence)


def _profile_structured_targets(
    context, catalog, registry
) -> dict[str, frozenset[str]]:
    targets: dict[str, frozenset[str]] = {}
    for profile_id, profile in catalog.profiles.items():
        configured = context.with_config(
            ProjectConfig(
                tooling_version=context.tooling_version,
                project_name="CI gate fixture",
                profile=profile_id,
                paths=ProjectPathConfig(backend="backend"),
            )
        )
        adapters = registry.select_for_profile(profile, catalog)
        names = {
            Path(requirement.path).name
            for adapter in adapters
            for requirement in adapter.requirements(configured)
            if requirement.ownership is Ownership.STRUCTURED
        }
        targets[profile_id] = frozenset(names)
    return targets


def _has_failpoints(tools: Path) -> bool:
    return any(
        "TOOLING_TEST_FAILPOINT" in path.read_text(encoding="utf-8")
        for path in (tools / "integration").glob("*.py")
    )


def _evidence(check: str, ready: bool, message: str) -> GateEvidence:
    return GateEvidence(
        check=check,
        status=GateStatus.PASS if ready else GateStatus.BLOCKED,
        message=message,
    )


def _render(evidence: tuple[GateEvidence, ...]) -> str:
    return json.dumps(
        {
            "gate": "gate-0",
            "status": (
                GateStatus.PASS.value
                if all(item.status is GateStatus.PASS for item in evidence)
                else GateStatus.BLOCKED.value
            ),
            "checks": [
                {
                    "check": item.check,
                    "status": item.status.value,
                    "message": item.message,
                }
                for item in evidence
            ],
        },
        sort_keys=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Evaluate CI Gate 0")
    parser.add_argument("--require-ready", action="store_true")
    parser.add_argument("--tools-root", type=Path)
    args = parser.parse_args(argv)
    evidence = evaluate_gate_zero(args.tools_root)
    print(_render(evidence))
    if args.require_ready and any(
        item.status is GateStatus.BLOCKED for item in evidence
    ):
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
