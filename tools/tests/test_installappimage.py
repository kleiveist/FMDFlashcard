from __future__ import annotations

import importlib.util
from pathlib import Path, PurePosixPath

import pytest

INSTALLER_PATH = Path(__file__).resolve().parents[1] / "inst" / "linux" / "installappimage.py"
SPEC = importlib.util.spec_from_file_location("fmd_installappimage", INSTALLER_PATH)
assert SPEC is not None and SPEC.loader is not None
INSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALLER)


def test_desktop_exec_path_is_one_quoted_argument() -> None:
    content = INSTALLER._desktop_file_content(
        PurePosixPath('/home/Test User/$Apps/An "App".AppImage'),
        PurePosixPath("/home/Test User/.local/share/icons/fmdflashcard.png"),
    )

    assert 'Exec="/home/Test User/\\$Apps/An \\"App\\".AppImage"' in content
    assert 'TryExec=/home/Test User/$Apps/An "App".AppImage' in content


@pytest.mark.parametrize("control", ["\n", "\r", "\0"])
def test_desktop_exec_path_rejects_control_characters(control: str) -> None:
    with pytest.raises(INSTALLER.InstallError, match="control characters"):
        INSTALLER._desktop_exec_argument(PurePosixPath(f"/tmp/FMD{control}Flashcard.AppImage"))
