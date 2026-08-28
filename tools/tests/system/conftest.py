"""Reusable black-box fixtures for portable operating-system checks."""

from __future__ import annotations

import hashlib
import os
import shutil
import stat
import subprocess
import sys
from collections.abc import Iterator, Mapping
from pathlib import Path

import pytest

from tools.core.context import load_context

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
TOOLS_SOURCE = REPOSITORY_ROOT / "tools"


def _documentation_source() -> Path:
    """Resolve the source docs through the copied project's declared paths."""

    return load_context(REPOSITORY_ROOT, tools_root=TOOLS_SOURCE).docs_root


DOCS_SOURCE = _documentation_source()
_IGNORED_DIRECTORIES = frozenset(
    {
        ".git",
        ".pytest_cache",
        ".ruff_cache",
        ".runtime",
        ".tooling-state",
        ".venv",
        "__pycache__",
        "node_modules",
        "target",
    }
)


def _copy_ignore(_directory: str, names: list[str]) -> set[str]:
    return {
        name
        for name in names
        if name.casefold() in _IGNORED_DIRECTORIES or name.endswith(".pyc")
    }


@pytest.fixture
def copied_project(tmp_path: Path) -> Iterator[Path]:
    """Copy the payload to a path that exercises spaces and Unicode safely."""

    root = tmp_path / "Kunden Projekt Ünicode"
    root.mkdir()
    shutil.copytree(TOOLS_SOURCE, root / "tools", ignore=_copy_ignore)
    (root / "docs").mkdir()
    shutil.copytree(DOCS_SOURCE, root / "docs" / "toolingdocs", ignore=_copy_ignore)
    yield root


def snapshot(root: Path) -> dict[str, tuple[str, str | None]]:
    """Return a byte-level snapshot and reject unsafe filesystem objects."""

    result: dict[str, tuple[str, str | None]] = {}
    for candidate in sorted(root.rglob("*")):
        relative = candidate.relative_to(root).as_posix()
        metadata = candidate.lstat()
        if stat.S_ISDIR(metadata.st_mode):
            result[relative] = ("directory", None)
        elif stat.S_ISREG(metadata.st_mode):
            result[relative] = (
                "file",
                hashlib.sha256(candidate.read_bytes()).hexdigest(),
            )
        elif stat.S_ISLNK(metadata.st_mode):
            result[relative] = ("symlink", os.readlink(candidate))
        else:
            raise AssertionError(f"unsupported fixture object: {relative}")
    return result


def safe_environment(extra: Mapping[str, str] | None = None) -> dict[str, str]:
    """Create a command environment independent of inherited Git/Python state."""

    environment = os.environ.copy()
    for key in tuple(environment):
        if key.startswith("GIT_"):
            environment.pop(key)
    environment.pop("PYTHONPATH", None)
    environment.pop("PYTHONPYCACHEPREFIX", None)
    environment.update(
        {
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONHASHSEED": "0",
            "PYTHONIOENCODING": "utf-8",
            "PYTHONNOUSERSITE": "1",
            "PYTHONUTF8": "1",
        }
    )
    if extra:
        environment.update(extra)
    return environment


def run_control(
    root: Path,
    *arguments: str,
    cwd: Path | None = None,
    environment: Mapping[str, str] | None = None,
    timeout: int = 60,
) -> subprocess.CompletedProcess[str]:
    """Run the copied entry point without a shell or ambient import state."""

    command = (sys.executable, str(root / "tools" / "control.py"), *arguments)
    return subprocess.run(
        command,
        cwd=cwd or root,
        env=safe_environment(environment),
        stdin=subprocess.DEVNULL,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        shell=False,
    )
