from __future__ import annotations

import json
import os
import shlex
import subprocess
from pathlib import Path

import pytest

from tools.core.filesystem import FilesystemSafetyError
from tools.tauri import cache, common, paths, run


def _platform_quote(value: str) -> str:
    return subprocess.list2cmdline([value]) if os.name == "nt" else shlex.quote(value)


def test_tauri_dev_command_quotes_configured_frontend_path(
    tmp_path: Path,
    monkeypatch,
) -> None:
    frontend = tmp_path / "ui; user content"
    tauri = tmp_path / "desktop shell"
    monkeypatch.setattr(paths, "FRONTEND_DIR", frontend)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri)
    relative = Path(os.path.relpath(frontend, tauri)).as_posix()

    payload = json.loads(run._dev_config_override(5173))

    assert payload["build"]["beforeDevCommand"] == (
        f"cd {_platform_quote(relative)} && npm run dev -- --host 127.0.0.1 --port 5173"
    )


def test_tauri_runtime_state_rejects_symlink_destination(
    tmp_path: Path, monkeypatch
) -> None:
    runtime_dir = tmp_path / ".tooling-state" / "runtime" / "tauri"
    runtime_dir.mkdir(parents=True)
    external = tmp_path / "external-state.json"
    external.write_text("unchanged\n", encoding="utf-8")
    (runtime_dir / "tauri_run_state.json").symlink_to(external)
    monkeypatch.setattr(paths, "ROOT", tmp_path)

    with pytest.raises(FilesystemSafetyError):
        run._write_detached_state(
            {
                "schema_version": 1,
                "pid": 4242,
                "argv": ["tauri", "dev"],
                "process_start_token": "linux:test-boot:100",
                "process_group_id": 4242,
                "log": ".tooling-state/runtime/tauri/logs/tauri.log",
            }
        )

    assert external.read_text(encoding="utf-8") == "unchanged\n"


def test_dynamic_tauri_path_override_restores_resolver(
    monkeypatch, tmp_path: Path
) -> None:
    resolver = paths.DIST_DIR

    with monkeypatch.context() as patch:
        patch.setattr(paths, "ROOT", tmp_path)
        patch.setattr(paths, "DIST_DIR", tmp_path / "custom-dist")
        assert paths.DIST_DIR == tmp_path / "custom-dist"

    assert paths.DIST_DIR is resolver
    assert Path(paths.DIST_DIR) == paths.ROOT / ".dist" / "desktop"


def test_tauri_cache_origin_rejects_symlink_destination(
    tmp_path: Path, monkeypatch
) -> None:
    tauri_dir = tmp_path / "src-tauri"
    target_dir = tauri_dir / "target"
    target_dir.mkdir(parents=True)
    (tauri_dir / "tauri.conf.json").write_text("{}\n", encoding="utf-8")
    external = tmp_path / "external-origin.txt"
    external.write_text("unchanged\n", encoding="utf-8")
    (target_dir / ".tauri-dev-cache-origin").symlink_to(external)
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri_dir)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("cargo clean must not run for unsafe cache state")
        ),
    )

    assert cache.prepare_dev_cache() is False
    assert external.read_text(encoding="utf-8") == "unchanged\n"
