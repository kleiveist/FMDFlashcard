from __future__ import annotations

import hashlib

import pytest

from tools.integration.model import (
    OperationKind,
    Ownership,
    PlanningError,
    StructuredChange,
)
from tools.integration.planner import (
    DesiredProfile,
    DesiredResource,
    ObservedResource,
    create_plan,
)


def _digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def test_tooling_plan_is_deterministic_and_uses_preimages() -> None:
    old = b"old\n"
    desired = DesiredProfile(
        "web-only",
        (
            DesiredResource("tools/z.py", Ownership.TOOLING, b"new\n"),
            DesiredResource("tools/a.py", Ownership.TOOLING, b"added\n"),
        ),
        ("quality", "frontend"),
    )
    observed = (ObservedResource("tools/z.py", Ownership.TOOLING, sha256=_digest(old)),)

    first = create_plan(observed, desired)
    second = create_plan(
        reversed(observed),
        DesiredProfile(
            "web-only", tuple(reversed(desired.resources)), desired.features
        ),
    )

    assert first == second
    assert [item.path for item in first.operations] == ["tools/a.py", "tools/z.py"]
    assert [item.kind for item in first.operations] == [
        OperationKind.ADD,
        OperationKind.UPDATE,
    ]
    assert first.operations[1].expected_sha256 == _digest(old)
    assert first.desired_features == ("frontend", "quality")


def test_matching_tooling_content_is_a_noop() -> None:
    content = b"same\n"
    plan = create_plan(
        (ObservedResource("tools/a.py", Ownership.TOOLING, sha256=_digest(content)),),
        DesiredProfile(
            "web-only", (DesiredResource("tools/a.py", Ownership.TOOLING, content),)
        ),
    )

    assert plan.is_noop
    assert plan.status == "INTEGRATED"


def test_planner_rejects_case_colliding_paths() -> None:
    desired = DesiredProfile(
        "web-only",
        (
            DesiredResource("tools/A", Ownership.TOOLING, b"one"),
            DesiredResource("tools/a", Ownership.TOOLING, b"two"),
        ),
    )

    with pytest.raises(PlanningError, match="case-colliding"):
        create_plan((), desired)


def test_planner_never_writes_project_owned_paths() -> None:
    plan = create_plan(
        (ObservedResource("frontend/src/main.ts", Ownership.PROJECT, sha256="old"),),
        DesiredProfile(
            "web-only",
            (
                DesiredResource(
                    "frontend/src/main.ts", Ownership.PROJECT, b"replacement"
                ),
            ),
        ),
    )

    assert plan.operations == ()
    assert plan.conflicts[0].code == "project-owned-write"
    assert all(
        operation.ownership is not Ownership.PROJECT for operation in plan.operations
    )


def test_structured_file_gets_only_changed_known_keys() -> None:
    plan = create_plan(
        (
            ObservedResource(
                "package.json",
                Ownership.STRUCTURED,
                sha256="a" * 64,
                structured_values={
                    "scripts": {"quality": "old", "foreign": "preserved"}
                },
            ),
        ),
        DesiredProfile(
            "web-only",
            (
                DesiredResource(
                    "package.json",
                    Ownership.STRUCTURED,
                    structured_changes=(
                        StructuredChange("scripts.foreign", "preserved"),
                        StructuredChange(
                            "scripts.quality",
                            "python tools/control.py quality",
                            expected="old",
                        ),
                    ),
                ),
            ),
        ),
    )

    assert len(plan.operations) == 1
    operation = plan.operations[0]
    assert operation.kind is OperationKind.PATCH
    assert operation.content is None
    assert operation.expected_sha256 == "a" * 64
    assert [change.key for change in operation.structured_changes] == [
        "scripts.quality"
    ]


def test_structured_full_replacement_and_missing_target_are_conflicts() -> None:
    replacement = create_plan(
        (ObservedResource("package.json", Ownership.STRUCTURED, sha256="a" * 64),),
        DesiredProfile(
            "web-only",
            (DesiredResource("package.json", Ownership.STRUCTURED, b"{}\n"),),
        ),
    )
    missing = create_plan(
        (),
        DesiredProfile(
            "web-only",
            (
                DesiredResource(
                    "package.json",
                    Ownership.STRUCTURED,
                    structured_changes=(
                        StructuredChange("scripts.quality", "quality"),
                    ),
                ),
            ),
        ),
    )

    assert replacement.conflicts[0].code == "structured-full-replacement"
    assert missing.conflicts[0].code == "structured-path-missing"
    assert not replacement.operations and not missing.operations


def test_missing_optional_structured_target_is_a_noop() -> None:
    plan = create_plan(
        (),
        DesiredProfile(
            "web-only",
            (
                DesiredResource(
                    "package.json",
                    Ownership.STRUCTURED,
                    structured_changes=(
                        StructuredChange("scripts.quality", "quality"),
                    ),
                    required=False,
                ),
            ),
        ),
    )

    assert plan.is_noop


def test_structured_precondition_mismatch_blocks_patch() -> None:
    plan = create_plan(
        (
            ObservedResource(
                "Cargo.toml",
                Ownership.STRUCTURED,
                sha256="b" * 64,
                structured_values={"package": {"version": "2.0.0"}},
            ),
        ),
        DesiredProfile(
            "desktop-local",
            (
                DesiredResource(
                    "Cargo.toml",
                    Ownership.STRUCTURED,
                    structured_changes=(
                        StructuredChange("package.version", "3.0.0", expected="1.0.0"),
                    ),
                ),
            ),
        ),
    )

    assert not plan.operations
    assert plan.conflicts[0].code == "structured-precondition"


@pytest.mark.parametrize(
    "path",
    ["../outside", "/absolute", r"tools\\escape.py", "tools//bad.py", "CON/file"],
)
def test_unsafe_or_nonportable_paths_are_rejected(path: str) -> None:
    with pytest.raises(PlanningError):
        DesiredResource(path, Ownership.TOOLING, b"content")


def test_symlinked_tooling_target_is_a_conflict() -> None:
    plan = create_plan(
        (ObservedResource("tools/a.py", Ownership.TOOLING, is_symlink=True),),
        DesiredProfile(
            "web-only", (DesiredResource("tools/a.py", Ownership.TOOLING, b"new"),)
        ),
    )

    assert plan.conflicts[0].code == "symlink-path"
    assert not plan.operations


def test_existing_tooling_write_requires_verified_preimage() -> None:
    plan = create_plan(
        (ObservedResource("tools/a.py", Ownership.TOOLING),),
        DesiredProfile(
            "web-only", (DesiredResource("tools/a.py", Ownership.TOOLING, b"new"),)
        ),
    )

    assert plan.conflicts[0].code == "tooling-preimage-missing"
    assert not plan.operations
