from __future__ import annotations

from pathlib import Path

import pytest

from tools import control
from tools.tauri import paths
from tools.tauri.build import appimage


def test_appimage_version_falls_back_to_canonical_version(monkeypatch, tmp_path: Path) -> None:
    assert "tauri" in control._handlers()
    tauri_dir = tmp_path / "src-tauri"
    tauri_dir.mkdir()
    (tauri_dir / "Cargo.toml").write_text("not valid TOML", encoding="utf-8")
    (tmp_path / "VERSION").write_text("1.2.3\n", encoding="utf-8")
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri_dir)

    assert appimage._tauri_version() == "1.2.3"


def test_appimage_version_fails_when_all_version_sources_are_unavailable(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "TOOLS_DIR", tmp_path / "tools")
    monkeypatch.setattr(paths, "TAURI_DIR", tmp_path / "src-tauri")

    with pytest.raises(appimage.AppImageInstallError, match="Cargo.toml or VERSION"):
        appimage._tauri_version()


def test_appimage_version_uses_portable_tooling_version(monkeypatch, tmp_path: Path) -> None:
    tools_dir = tmp_path / "tools"
    tools_dir.mkdir()
    (tools_dir / "VERSION").write_text("0.1.0\n", encoding="utf-8")
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "TOOLS_DIR", tools_dir)
    monkeypatch.setattr(paths, "TAURI_DIR", tmp_path / "src-tauri")

    assert appimage._tauri_version() == "0.1.0"
