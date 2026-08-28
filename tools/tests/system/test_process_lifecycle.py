"""Bounded subprocess behaviour shared by POSIX and Windows runners."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

from tools.process import run_bounded, safe_platform_environment


def test_timeout_terminates_a_real_child_process_tree(tmp_path: Path) -> None:
    marker = tmp_path / "child-survived"
    child = (
        "import pathlib,time;"
        f"pathlib.Path({str(marker)!r}).write_text('started');"
        "time.sleep(2);"
        f"pathlib.Path({str(marker)!r}).write_text('survived')"
    )
    parent = (
        "import subprocess,sys,time;"
        f"subprocess.Popen([sys.executable, '-c', {child!r}]);"
        "time.sleep(30)"
    )
    environment = safe_platform_environment(os.environ)
    environment["PATH"] = os.environ.get("PATH", os.defpath)

    with pytest.raises(subprocess.TimeoutExpired):
        run_bounded(
            (sys.executable, "-c", parent),
            cwd=tmp_path,
            env=environment,
            timeout=1,
        )

    # Let a surviving child reach its delayed write; a managed process group or
    # Windows Job Object must have removed it before then.
    time.sleep(2.5)
    assert not marker.exists() or marker.read_text(encoding="utf-8") == "started"
