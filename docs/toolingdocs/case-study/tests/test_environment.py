from __future__ import annotations

import copy
import io
import re
import tarfile
from pathlib import Path

import environment
import pytest


def _write_archive(path: Path, members: tuple[tarfile.TarInfo, ...]) -> None:
    with tarfile.open(path, "w:xz") as archive:
        for member in members:
            payload = b"payload" if member.isfile() else b""
            member.size = len(payload)
            archive.addfile(member, io.BytesIO(payload) if payload else None)


def test_environment_spec_is_pinned_and_project_local() -> None:
    spec = environment._toolchain_spec()
    paths = environment._paths(None, None)

    assert spec.release == "v2026.08"
    assert spec.archive == "TinyTeX-linux-x86_64-v2026.08.tar.xz"
    assert re.fullmatch(r"[0-9a-f]{64}", spec.sha256)
    assert spec.url.endswith(f"/{spec.release}/{spec.archive}")
    assert spec.packages == ("babel-german", "biblatex-apa")
    assert paths.root.is_relative_to(environment.REPOSITORY_ROOT / ".tooling-state")
    assert paths.venv.is_relative_to(paths.root)
    assert paths.tinytex.is_relative_to(paths.root)


def test_python_requirements_are_exact_and_dependency_complete() -> None:
    requirements = environment.REQUIREMENTS.read_text(encoding="utf-8").splitlines()

    assert requirements
    assert all(re.fullmatch(r"[A-Za-z0-9_-]+==[0-9.]+", line) for line in requirements)
    assert {line.split("==", 1)[0].casefold() for line in requirements} == {
        "iniconfig",
        "packaging",
        "pillow",
        "pluggy",
        "pygments",
        "pypdf",
        "pypdfium2",
        "pytest",
    }


@pytest.mark.parametrize(
    ("field", "value", "message"),
    (
        ("tinytex_release", "latest", "monthly release"),
        ("tinytex_archive", "../../outside.tar.xz", "archive name"),
        ("tinytex_repository", "http://example.invalid", "audited HTTPS"),
        ("tinytex_packages", ["../escape"], "safe-name"),
    ),
)
def test_environment_spec_rejects_unpinned_or_escaping_configuration(
    monkeypatch: pytest.MonkeyPatch, field: str, value: object, message: str
) -> None:
    config = copy.deepcopy(environment.load_config())
    config["toolchain"][field] = value
    monkeypatch.setattr(environment, "load_config", lambda: config)

    with pytest.raises(environment.CaseStudyError, match=message):
        environment._toolchain_spec()


def test_safe_tinytex_archive_extracts_internal_files_and_links(tmp_path: Path) -> None:
    archive_path = tmp_path / "safe.tar.xz"
    root = tarfile.TarInfo(".TinyTeX")
    root.type = tarfile.DIRTYPE
    binary = tarfile.TarInfo(".TinyTeX/bin")
    binary.type = tarfile.DIRTYPE
    executable = tarfile.TarInfo(".TinyTeX/tool")
    executable.type = tarfile.REGTYPE
    link = tarfile.TarInfo(".TinyTeX/bin/tool")
    link.type = tarfile.SYMTYPE
    link.linkname = "../tool"
    _write_archive(archive_path, (root, binary, executable, link))

    extracted = environment._extract(archive_path, tmp_path / "output")

    assert (extracted / "tool").read_bytes() == b"payload"
    assert (extracted / "tool").stat().st_mode & 0o600 == 0o600
    assert (extracted / "bin" / "tool").is_symlink()
    assert (extracted / "bin" / "tool").resolve() == (extracted / "tool").resolve()


@pytest.mark.parametrize(
    ("name", "linkname"),
    (
        ("../escape", None),
        (".TinyTeX/absolute-link", "/etc/passwd"),
        (".TinyTeX/escaping-link", "../../outside"),
    ),
)
def test_tinytex_archive_rejects_escaping_paths_and_links(
    tmp_path: Path, name: str, linkname: str | None
) -> None:
    archive_path = tmp_path / "unsafe.tar.xz"
    member = tarfile.TarInfo(name)
    if linkname is None:
        member.type = tarfile.REGTYPE
    else:
        member.type = tarfile.SYMTYPE
        member.linkname = linkname
    _write_archive(archive_path, (member,))

    with pytest.raises(environment.CaseStudyError, match="archive"):
        environment._extract(archive_path, tmp_path / "output")


def test_tinytex_archive_rejects_files_below_a_symlink(tmp_path: Path) -> None:
    archive_path = tmp_path / "symlink-parent.tar.xz"
    root = tarfile.TarInfo(".TinyTeX")
    root.type = tarfile.DIRTYPE
    link = tarfile.TarInfo(".TinyTeX/bin")
    link.type = tarfile.SYMTYPE
    link.linkname = "elsewhere"
    child = tarfile.TarInfo(".TinyTeX/bin/pdflatex")
    child.type = tarfile.REGTYPE
    _write_archive(archive_path, (root, link, child))

    with pytest.raises(environment.CaseStudyError, match="symbolic link"):
        environment._extract(archive_path, tmp_path / "output")
