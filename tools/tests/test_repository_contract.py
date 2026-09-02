from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

from tools.commands.docs import proposed_indexes, update_indexes
from tools.paths import PathSafetyError, project_paths, relative_to_root, require_within
from tools.process import run_command

ROOT = Path(__file__).resolve().parents[2]
START = "<!-- AUTO-GENERATED:docs-index START -->"
END = "<!-- AUTO-GENERATED:docs-index END -->"


def test_root_wrappers_resolve_checkout_and_forward_all_arguments() -> None:
    wrappers = {
        "control": ("tools/control.py", '"$@"'),
        "control.ps1": ("tools/control.py", "@args"),
        "control.cmd": ("tools\\control.py", "%*"),
    }
    for name, (entrypoint, forwarding) in wrappers.items():
        path = ROOT / name
        text = path.read_text(encoding="utf-8")
        assert path.is_file()
        assert entrypoint in text.replace('"$script_dir/', "").replace("$repoRoot ", "").replace(
            "%~dp0", ""
        )
        assert forwarding in text
        assert "/home/" not in text and "/Users/" not in text
    assert os.access(ROOT / "control", os.X_OK)


def test_checkout_normalizes_text_files_to_lf() -> None:
    attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()
    assert "* text=auto eol=lf" in attributes


@pytest.mark.skipif(os.name == "nt", reason="POSIX wrapper is not executable on Windows")
def test_posix_wrapper_works_from_outside_the_checkout(tmp_path: Path) -> None:
    result = subprocess.run(
        [str(ROOT / "control"), "--help"],
        cwd=tmp_path,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert "command map:" in result.stdout
    assert result.stderr == ""


@pytest.mark.skipif(os.name != "nt", reason="Windows wrappers require Windows")
@pytest.mark.parametrize("wrapper", ["control.cmd", "control.ps1"])
def test_windows_wrappers_work_from_outside_the_checkout(
    wrapper: str,
    tmp_path: Path,
) -> None:
    if wrapper == "control.cmd":
        command = [str(ROOT / wrapper), "--help"]
    else:
        powershell = shutil.which("pwsh") or shutil.which("powershell.exe")
        assert powershell is not None
        command = [
            powershell,
            "-NoProfile",
            "-NonInteractive",
            "-File",
            str(ROOT / wrapper),
            "--help",
        ]
    result = run_command(command, cwd=tmp_path)

    assert result.returncode == 0
    assert "command map:" in result.stdout
    assert result.stderr == ""


def test_project_output_paths_are_owned_and_path_escape_is_rejected(tmp_path: Path) -> None:
    root = tmp_path / "checkout"
    root.mkdir()
    paths = project_paths(root)

    for output in (paths.dist, paths.reports, paths.state, paths.runtime):
        assert require_within(paths.root, output) == output
        assert relative_to_root(output, paths).startswith(".")
    with pytest.raises(PathSafetyError):
        require_within(paths.root, tmp_path / "outside" / "artifact")

    outside = tmp_path / "outside"
    outside.mkdir()
    (root / ".dist").symlink_to(outside, target_is_directory=True)
    with pytest.raises(PathSafetyError):
        require_within(paths.root, root / ".dist" / "artifact.zip")


def _documentation_project(tmp_path: Path) -> tuple[object, dict[Path, bytes]]:
    docs = tmp_path / "docs"
    tools = docs / "tools"
    dev = docs / "dev"
    user = docs / "usr"
    tools.mkdir(parents=True)
    dev.mkdir()
    user.mkdir()
    (tmp_path / "README.md").write_text(
        f"# FMDFlashcard\n\n{START}\nold\n{END}\n",
        encoding="utf-8",
    )
    (tmp_path / "CHANGELOG.md").write_text("# Changelog\n", encoding="utf-8")
    (tmp_path / "CONTRIBUTING.md").write_text("# Contributing\n", encoding="utf-8")
    (tmp_path / "SECURITY.md").write_text("# Security\n", encoding="utf-8")
    (dev / "developer.md").write_text("# Developer guide\n", encoding="utf-8")
    (user / "user.md").write_text("# User guide\n", encoding="utf-8")
    (tools / "alpha.md").write_text("# Alpha tool\n", encoding="utf-8")
    (tools / "zeta.md").write_text("# Zeta tool\n", encoding="utf-8")
    (tools / "tools.md").write_text(
        f"# Tools\n\n{START}\nold\n{END}\n",
        encoding="utf-8",
    )
    paths = project_paths(tmp_path)
    before = {
        path.relative_to(tmp_path): path.read_bytes()
        for path in tmp_path.rglob("*")
        if path.is_file()
    }
    return paths, before


def test_docs_index_dry_run_prints_exact_diff_without_writing(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
) -> None:
    paths, before = _documentation_project(tmp_path)

    assert update_indexes(dry_run=True, paths=paths) == 0

    after = {
        path.relative_to(tmp_path): path.read_bytes()
        for path in tmp_path.rglob("*")
        if path.is_file()
    }
    output = capsys.readouterr().out
    assert after == before
    assert "--- README.md" in output and "+++ README.md" in output
    assert "Alpha tool" in output and output.index("Alpha tool") < output.index("Zeta tool")


def test_docs_index_update_is_deterministic_and_matches_proposal(tmp_path: Path) -> None:
    paths, _ = _documentation_project(tmp_path)

    assert update_indexes(dry_run=False, paths=paths) == 0
    first = {
        path: path.read_bytes()
        for path in (paths.root / "README.md", paths.docs / "tools" / "tools.md")
    }
    assert all(
        path.read_text(encoding="utf-8") == proposed
        for path, proposed in proposed_indexes(paths).items()
    )

    assert update_indexes(dry_run=False, paths=paths) == 0
    assert {path: path.read_bytes() for path in first} == first
