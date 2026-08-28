from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest
import tomllib

from tools.core.context import load_context
from tools.core.state import (
    STATE_RELATIVE_PATH,
    STATE_SCHEMA_VERSION,
    StateError,
    ToolingState,
    load_state,
    render_state,
    state_digest,
    validate_state,
    validate_state_directory,
    write_state,
)

DIGEST = "sha256:" + "b" * 64


def _state() -> ToolingState:
    return ToolingState(
        schema_version=STATE_SCHEMA_VERSION,
        tooling_version="0.1.0",
        profile="desktop-local",
        optional_features=("database", "postgres"),
        applied_migrations=("001-project-config", "002-tauri-scripts"),
        integration_digest=DIGEST,
    )


def _project(tmp_path: Path) -> Path:
    root = tmp_path / "project with spaces"
    root.mkdir()
    return root


def test_state_is_deterministic_project_owned_and_template_free(tmp_path: Path) -> None:
    root = _project(tmp_path)
    state = _state()

    first_render = render_state(state)
    path = write_state(root, state)
    first_bytes = path.read_bytes()
    write_state(root, state)

    assert path == root / STATE_RELATIVE_PATH
    assert load_state(root) == state
    assert path.read_bytes() == first_bytes
    assert render_state(state) == first_render
    assert state_digest(state) == state_digest(state)
    assert state_digest(state).startswith("sha256:")
    assert str(tmp_path) not in first_render
    assert (
        not {"template_id", "template_url", "commit", "baseline"}
        & tomllib.loads(first_render).keys()
    )


def test_state_accepts_a_project_context(tmp_path: Path) -> None:
    root = _project(tmp_path)
    tools = root / "tools"
    tools.mkdir()
    (tools / "VERSION").write_text("0.1.0\n", encoding="utf-8")
    context = load_context(tools_root=tools)

    assert write_state(context, _state()) == context.state_root / "state.toml"
    assert load_state(context) == _state()


@pytest.mark.parametrize(
    "state",
    (
        replace(_state(), schema_version=STATE_SCHEMA_VERSION + 1),
        replace(_state(), tooling_version="latest"),
        replace(_state(), profile=" desktop-local"),
        replace(_state(), optional_features=("postgres", "postgres")),
        replace(_state(), applied_migrations=("",)),
        replace(_state(), integration_digest="sha256:BAD"),
    ),
)
def test_state_rejects_invalid_schema_selection_migrations_and_digest(
    state: ToolingState,
) -> None:
    with pytest.raises(StateError):
        validate_state(state)


def test_load_state_rejects_unknown_template_provenance_fields(tmp_path: Path) -> None:
    root = _project(tmp_path)
    path = write_state(root, _state())
    path.write_text(
        render_state(_state())
        + 'template_url = "https://example.invalid/template.git"\n',
        encoding="utf-8",
    )

    with pytest.raises(StateError, match="unknown template_url"):
        load_state(root)


def test_load_state_rejects_tampered_schema_and_digest(tmp_path: Path) -> None:
    root = _project(tmp_path)
    path = write_state(root, _state())
    payload = path.read_text(encoding="utf-8")
    path.write_text(
        payload.replace("schema_version = 1", "schema_version = 99", 1),
        encoding="utf-8",
    )
    with pytest.raises(StateError, match="Unsupported tooling state schema"):
        load_state(root)

    path.write_text(payload.replace(DIGEST, "sha256:" + "C" * 64), encoding="utf-8")
    with pytest.raises(StateError, match="lowercase SHA-256"):
        load_state(root)


def test_load_state_never_follows_state_file_symlink(tmp_path: Path) -> None:
    root = _project(tmp_path)
    state_path = write_state(root, _state())
    external = tmp_path / "external-state.toml"
    state_path.replace(external)
    try:
        state_path.symlink_to(external)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(StateError, match="symbolic link"):
        load_state(root)


def test_state_directory_rejects_external_symlink_and_non_directory(
    tmp_path: Path,
) -> None:
    root = _project(tmp_path)
    external = tmp_path / "external"
    external.mkdir()
    state_directory = root / ".tooling-state"
    try:
        state_directory.symlink_to(external, target_is_directory=True)
    except (NotImplementedError, OSError) as exc:
        pytest.skip(f"Symbolic links are unavailable: {exc}")

    with pytest.raises(StateError, match="symbolic link"):
        validate_state_directory(root)
    with pytest.raises(StateError, match="symbolic link"):
        write_state(root, _state())
    assert not (external / "state.toml").exists()

    state_directory.unlink()
    state_directory.write_text("not a directory\n", encoding="utf-8")
    with pytest.raises(StateError, match="directory"):
        validate_state_directory(root)


def test_missing_state_does_not_create_state_directory(tmp_path: Path) -> None:
    root = _project(tmp_path)

    with pytest.raises(StateError, match="missing"):
        load_state(root)
    assert not (root / ".tooling-state").exists()
