"""Bootstrap and run the case-study build in project-local isolation."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
import venv
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

try:  # Supports both ``python scripts/environment.py`` and package imports.
    from ._shared import (
        CASE_STUDY_ROOT,
        REPOSITORY_ROOT,
        CaseStudyError,
        load_config,
        require_audited_config,
    )
except ImportError:  # pragma: no cover - command-line entry point.
    from _shared import (
        CASE_STUDY_ROOT,
        REPOSITORY_ROOT,
        CaseStudyError,
        load_config,
        require_audited_config,
    )


ENVIRONMENT_SCHEMA = 1
REQUIREMENTS = CASE_STUDY_ROOT / "requirements.txt"
DOWNLOAD_BASE = "https://github.com/rstudio/tinytex-releases/releases/download"
SUPPORTED_PLATFORM = ("Linux", "x86_64")


@dataclass(frozen=True, slots=True)
class EnvironmentPaths:
    root: Path
    downloads: Path

    @property
    def venv(self) -> Path:
        return self.root / "venv"

    @property
    def tinytex(self) -> Path:
        return self.root / "tinytex"

    @property
    def marker(self) -> Path:
        return self.root / "environment.json"

    @property
    def python(self) -> Path:
        return self.venv / "bin" / "python"

    @property
    def tex_bin(self) -> Path:
        return self.tinytex / "bin" / "x86_64-linux"


@dataclass(frozen=True, slots=True)
class TinyTeXSpec:
    release: str
    archive: str
    sha256: str
    repository: str
    packages: tuple[str, ...]

    @property
    def url(self) -> str:
        return f"{DOWNLOAD_BASE}/{self.release}/{self.archive}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _toolchain_spec() -> TinyTeXSpec:
    config = load_config()
    require_audited_config(config)
    toolchain = config["toolchain"]
    packages = toolchain["tinytex_packages"]
    if (
        not isinstance(packages, list)
        or not packages
        or not all(
            isinstance(item, str) and re.fullmatch(r"[a-z0-9][a-z0-9.-]*", item)
            for item in packages
        )
    ):
        raise CaseStudyError("TinyTeX packages must be a non-empty safe-name list.")
    spec = TinyTeXSpec(
        release=str(toolchain["tinytex_release"]),
        archive=str(toolchain["tinytex_archive"]),
        sha256=str(toolchain["tinytex_sha256"]),
        repository=str(toolchain["tinytex_repository"]),
        packages=tuple(packages),
    )
    if not re.fullmatch(r"v[0-9]{4}\.[0-9]{2}", spec.release):
        raise CaseStudyError("TinyTeX release must be a pinned monthly release.")
    if spec.archive != f"TinyTeX-linux-x86_64-{spec.release}.tar.xz":
        raise CaseStudyError("TinyTeX archive name does not match its pinned release.")
    if not re.fullmatch(r"[0-9a-f]{64}", spec.sha256):
        raise CaseStudyError("TinyTeX archive SHA-256 is invalid.")
    if spec.repository != "https://tlnet.yihui.org":
        raise CaseStudyError(
            "TinyTeX package repository is not the audited HTTPS source."
        )
    if len(set(spec.packages)) != len(spec.packages):
        raise CaseStudyError("TinyTeX package names must not contain duplicates.")
    return spec


def _platform_check() -> None:
    system = platform.system()
    machine = platform.machine().casefold()
    if system != SUPPORTED_PLATFORM[0] or machine not in {"x86_64", "amd64"}:
        raise CaseStudyError(
            "The pinned case-study environment currently supports Linux x86_64; "
            f"observed {system} {platform.machine()}."
        )


def _paths(state_dir: Path | None, download_cache: Path | None) -> EnvironmentPaths:
    root = (
        (state_dir or REPOSITORY_ROOT / ".tooling-state" / "docs" / "environment")
        .expanduser()
        .resolve()
    )
    downloads = (download_cache or root / "downloads").expanduser().resolve()
    for label, path in (("Environment root", root), ("Download cache", downloads)):
        if path == Path(path.anchor):
            raise CaseStudyError(f"{label} must not be a filesystem root: {path}")
        if path.exists() and path.is_symlink():
            raise CaseStudyError(f"{label} must not be a symbolic link: {path}")
        if path.exists() and not path.is_dir():
            raise CaseStudyError(f"{label} must be a directory: {path}")
    return EnvironmentPaths(root=root, downloads=downloads)


def _confined_environment(paths: EnvironmentPaths) -> dict[str, str]:
    home = paths.root / "home"
    cache = paths.root / "cache"
    config = paths.root / "config"
    for directory in (home, cache, config):
        directory.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment.update(
        {
            "HOME": str(home),
            "USERPROFILE": str(home),
            "XDG_CACHE_HOME": str(cache),
            "XDG_CONFIG_HOME": str(config),
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONHASHSEED": "0",
            "PYTHONNOUSERSITE": "1",
            "PIP_CONFIG_FILE": os.devnull,
        }
    )
    return environment


def _run(
    command: Sequence[str],
    *,
    environment: dict[str, str],
    cwd: Path = REPOSITORY_ROOT,
    timeout: int = 600,
) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=environment,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=timeout,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CaseStudyError(f"Could not run {' '.join(command)}: {exc}") from exc
    output = "\n".join(
        part.strip() for part in (completed.stdout, completed.stderr) if part.strip()
    )
    if completed.returncode != 0:
        raise CaseStudyError(
            f"Command failed with exit code {completed.returncode}: "
            f"{' '.join(command)}\n{output[-6000:]}"
        )
    return output


def _download(spec: TinyTeXSpec, paths: EnvironmentPaths) -> Path:
    paths.downloads.mkdir(parents=True, exist_ok=True)
    archive = paths.downloads / spec.archive
    if archive.is_file() and _sha256(archive) == spec.sha256:
        return archive
    archive.unlink(missing_ok=True)
    temporary = archive.with_suffix(archive.suffix + ".part")
    temporary.unlink(missing_ok=True)
    request = urllib.request.Request(
        spec.url,
        headers={"User-Agent": "Template-Tooling-case-study-bootstrap/1"},
    )
    try:
        with (
            urllib.request.urlopen(request, timeout=60) as response,
            temporary.open("wb") as stream,
        ):
            shutil.copyfileobj(response, stream, length=1024 * 1024)
    except (OSError, urllib.error.URLError) as exc:
        temporary.unlink(missing_ok=True)
        raise CaseStudyError(
            f"Could not download pinned TinyTeX archive: {exc}"
        ) from exc
    observed = _sha256(temporary)
    if observed != spec.sha256:
        temporary.unlink(missing_ok=True)
        raise CaseStudyError(
            "TinyTeX archive checksum mismatch: "
            f"expected {spec.sha256}, observed {observed}."
        )
    os.replace(temporary, archive)
    return archive


def _normalized_link_target(member: PurePosixPath, target: str) -> PurePosixPath:
    raw = PurePosixPath(target)
    if raw.is_absolute():
        raise CaseStudyError(f"TinyTeX archive has an absolute link: {member}")
    parts: list[str] = []
    for part in (*member.parent.parts, *raw.parts):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                raise CaseStudyError(f"TinyTeX archive link escapes its root: {member}")
            parts.pop()
        else:
            parts.append(part)
    return PurePosixPath(*parts)


def _validated_members(archive: tarfile.TarFile) -> tuple[tarfile.TarInfo, ...]:
    members = tuple(archive.getmembers())
    names: set[PurePosixPath] = set()
    symlinks: set[PurePosixPath] = set()
    for member in members:
        name = PurePosixPath(member.name)
        if name.is_absolute() or not name.parts or name.parts[0] != ".TinyTeX":
            raise CaseStudyError(f"TinyTeX archive path is outside .TinyTeX: {name}")
        if any(part in ("", ".", "..") for part in name.parts):
            raise CaseStudyError(f"TinyTeX archive path is unsafe: {name}")
        if name in names:
            raise CaseStudyError(f"TinyTeX archive path is duplicated: {name}")
        names.add(name)
        if not (member.isfile() or member.isdir() or member.issym()):
            raise CaseStudyError(f"TinyTeX archive object is unsupported: {name}")
        if member.isfile():
            mode = (member.mode & 0o755) | 0o600
            if not mode & 0o100:
                mode &= ~0o111
            member.mode = mode
        elif member.isdir():
            member.mode = (member.mode & 0o755) | 0o700
        if member.issym():
            target = _normalized_link_target(name, member.linkname)
            if not target.parts or target.parts[0] != ".TinyTeX":
                raise CaseStudyError(f"TinyTeX archive link escapes .TinyTeX: {name}")
            symlinks.add(name)
    for name in names:
        if any(parent in symlinks for parent in name.parents):
            raise CaseStudyError(
                f"TinyTeX archive path descends through a symbolic link: {name}"
            )
    return members


def _extract(archive_path: Path, destination: Path) -> Path:
    try:
        with tarfile.open(archive_path, mode="r:xz") as archive:
            members = _validated_members(archive)
            # Every path and symlink target is validated before extraction.
            # The data filter also removes unsafe permission bits and guarantees
            # owner read/write access for regular files.  This matters when an
            # archive records mode 000 and the bootstrap runs as a non-root user.
            if hasattr(tarfile, "data_filter"):
                archive.extractall(destination, members=members, filter="data")
            else:  # Python versions predating extraction filters.
                archive.extractall(destination, members=members)
    except (OSError, tarfile.TarError) as exc:
        raise CaseStudyError(f"Could not extract TinyTeX archive: {exc}") from exc
    extracted = destination / ".TinyTeX"
    if not extracted.is_dir() or extracted.is_symlink():
        raise CaseStudyError("TinyTeX archive did not produce a safe .TinyTeX root.")
    return extracted


def _remove_generated(path: Path, root: Path) -> None:
    if path.parent != root or path.name not in {"venv", "tinytex"}:
        raise CaseStudyError(f"Refusing to replace an unexpected path: {path}")
    if path.exists() or path.is_symlink():
        if path.is_symlink() or not path.is_dir():
            raise CaseStudyError(f"Generated environment path is unsafe: {path}")
        shutil.rmtree(path)


def _install_venv(paths: EnvironmentPaths) -> None:
    _remove_generated(paths.venv, paths.root)
    try:
        venv.EnvBuilder(with_pip=True).create(paths.venv)
        _run(
            (
                str(paths.python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-cache-dir",
                "--no-deps",
                "--requirement",
                str(REQUIREMENTS),
            ),
            environment=_confined_environment(paths),
        )
    except Exception:
        _remove_generated(paths.venv, paths.root)
        raise


def _install_tinytex(spec: TinyTeXSpec, paths: EnvironmentPaths, archive: Path) -> None:
    staging = Path(tempfile.mkdtemp(prefix=".tinytex-", dir=paths.root))
    try:
        extracted = _extract(archive, staging)
        tex_bin = extracted / "bin" / "x86_64-linux"
        tlmgr = tex_bin / "tlmgr"
        if not tlmgr.is_file():
            raise CaseStudyError("Pinned TinyTeX archive does not contain tlmgr.")
        environment = _confined_environment(paths)
        environment["PATH"] = f"{tex_bin}{os.pathsep}{environment.get('PATH', '')}"
        _run(
            (str(tlmgr), "option", "repository", spec.repository),
            environment=environment,
        )
        _run((str(tlmgr), "update", "--self"), environment=environment)
        _run((str(tlmgr), "install", *spec.packages), environment=environment)
        for command in ("pdflatex", "biber", "tlmgr"):
            if not (tex_bin / command).is_file():
                raise CaseStudyError(
                    f"Pinned TinyTeX environment is missing executable: {command}"
                )
        _remove_generated(paths.tinytex, paths.root)
        os.replace(extracted, paths.tinytex)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _expected_identity(spec: TinyTeXSpec) -> dict[str, Any]:
    return {
        "schema_version": ENVIRONMENT_SCHEMA,
        "python": platform.python_version(),
        "requirements_sha256": _sha256(REQUIREMENTS),
        "tinytex_release": spec.release,
        "tinytex_archive": spec.archive,
        "tinytex_sha256": spec.sha256,
        "tinytex_repository": spec.repository,
        "tinytex_packages": list(spec.packages),
    }


def _load_marker(paths: EnvironmentPaths) -> dict[str, Any] | None:
    try:
        payload = json.loads(paths.marker.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


def _ready(spec: TinyTeXSpec, paths: EnvironmentPaths) -> bool:
    marker = _load_marker(paths)
    expected = _expected_identity(spec)
    return bool(
        marker
        and all(marker.get(key) == value for key, value in expected.items())
        and paths.python.is_file()
        and all(
            (paths.tex_bin / command).is_file()
            for command in ("pdflatex", "biber", "tlmgr")
        )
    )


def _runtime_info(spec: TinyTeXSpec, paths: EnvironmentPaths) -> dict[str, Any]:
    environment = _confined_environment(paths)
    environment["PATH"] = f"{paths.tex_bin}{os.pathsep}{environment.get('PATH', '')}"
    return {
        **_expected_identity(spec),
        "state_dir": str(paths.root),
        "python_executable": str(paths.python),
        "tex_bin": str(paths.tex_bin),
        "python_packages": _run(
            (str(paths.python), "-m", "pip", "freeze", "--all"),
            environment=environment,
        ).splitlines(),
        "pdflatex_version": _run(
            (str(paths.tex_bin / "pdflatex"), "--version"),
            environment=environment,
        ).splitlines()[0],
        "biber_version": _run(
            (str(paths.tex_bin / "biber"), "--version"),
            environment=environment,
        ).splitlines()[0],
        "tlmgr_version": _run(
            (str(paths.tex_bin / "tlmgr"), "--version"),
            environment=environment,
        ).splitlines(),
        "tex_package_evidence": _run(
            (
                str(paths.tex_bin / "tlmgr"),
                "info",
                "--only-installed",
                *spec.packages,
            ),
            environment=environment,
        ).splitlines(),
    }


def setup_environment(
    *,
    state_dir: Path | None = None,
    download_cache: Path | None = None,
    refresh: bool = False,
) -> dict[str, Any]:
    """Create or validate the isolated venv and pinned TinyTeX tree."""

    _platform_check()
    spec = _toolchain_spec()
    paths = _paths(state_dir, download_cache)
    paths.root.mkdir(parents=True, exist_ok=True)
    if refresh or not _ready(spec, paths):
        paths.marker.unlink(missing_ok=True)
        archive = _download(spec, paths)
        _install_venv(paths)
        _install_tinytex(spec, paths, archive)
        info = _runtime_info(spec, paths)
        temporary = paths.marker.with_suffix(".json.tmp")
        temporary.unlink(missing_ok=True)
        temporary.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, paths.marker)
    return _runtime_info(spec, paths)


def environment_info(
    *, state_dir: Path | None = None, download_cache: Path | None = None
) -> dict[str, Any]:
    _platform_check()
    spec = _toolchain_spec()
    paths = _paths(state_dir, download_cache)
    if not _ready(spec, paths):
        raise CaseStudyError(
            "The isolated case-study environment is not ready; run environment.py setup."
        )
    return _runtime_info(spec, paths)


def _isolated_environment(paths: EnvironmentPaths) -> dict[str, str]:
    environment = _confined_environment(paths)
    environment["PATH"] = (
        f"{paths.tex_bin}{os.pathsep}{paths.python.parent}{os.pathsep}"
        f"{environment.get('PATH', '')}"
    )
    return environment


def _run_isolated_script(
    script: str,
    arguments: Sequence[str],
    *,
    state_dir: Path | None,
    download_cache: Path | None,
) -> int:
    setup_environment(state_dir=state_dir, download_cache=download_cache)
    paths = _paths(state_dir, download_cache)
    completed = subprocess.run(
        (str(paths.python), str(CASE_STUDY_ROOT / "scripts" / script), *arguments),
        cwd=REPOSITORY_ROOT,
        env=_isolated_environment(paths),
        stdin=subprocess.DEVNULL,
        check=False,
        shell=False,
    )
    return completed.returncode


def _run_isolated_tests(
    arguments: Sequence[str],
    *,
    state_dir: Path | None,
    download_cache: Path | None,
) -> int:
    setup_environment(state_dir=state_dir, download_cache=download_cache)
    paths = _paths(state_dir, download_cache)
    completed = subprocess.run(
        (
            str(paths.python),
            "-m",
            "pytest",
            "-q",
            "-p",
            "no:cacheprovider",
            str(CASE_STUDY_ROOT / "tests"),
            *arguments,
        ),
        cwd=REPOSITORY_ROOT,
        env=_isolated_environment(paths),
        stdin=subprocess.DEVNULL,
        check=False,
        shell=False,
    )
    return completed.returncode


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create and use the isolated case-study build environment."
    )
    parser.add_argument("--state-dir", type=Path, help="generated environment root")
    parser.add_argument("--download-cache", type=Path, help="TinyTeX archive cache")
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("setup", help="install or validate the environment")
    setup.add_argument("--refresh", action="store_true", help="replace generated tools")
    setup.add_argument("--json", action="store_true", help="emit runtime JSON")
    info = commands.add_parser("info", help="report exact installed versions")
    info.add_argument("--json", action="store_true", help="emit runtime JSON")
    for name in ("build", "verify"):
        command = commands.add_parser(name, help=f"run {name}.py in isolation")
        command.add_argument("arguments", nargs=argparse.REMAINDER)
    test = commands.add_parser("test", help="run all case-study tests in isolation")
    test.add_argument("arguments", nargs=argparse.REMAINDER)
    return parser


def _print_info(info: dict[str, Any], *, as_json: bool) -> None:
    if as_json:
        print(json.dumps(info, indent=2))
        return
    print(f"environment: {info['state_dir']}")
    print(f"python: {info['python_executable']}")
    print(f"TeX: {info['pdflatex_version']}")
    print(f"Biber: {info['biber_version']}")


def main(argv: Sequence[str] | None = None) -> int:
    raw_arguments = list(sys.argv[1:] if argv is None else argv)
    passthrough_commands = {"build", "verify", "test"}
    command_index = next(
        (
            index
            for index, value in enumerate(raw_arguments)
            if value in passthrough_commands
        ),
        None,
    )
    if command_index is None:
        args = _parser().parse_args(raw_arguments)
    else:
        args = _parser().parse_args(raw_arguments[: command_index + 1])
        args.arguments = raw_arguments[command_index + 1 :]
    try:
        if args.command == "setup":
            info = setup_environment(
                state_dir=args.state_dir,
                download_cache=args.download_cache,
                refresh=args.refresh,
            )
            _print_info(info, as_json=args.json)
            return 0
        if args.command == "info":
            info = environment_info(
                state_dir=args.state_dir, download_cache=args.download_cache
            )
            _print_info(info, as_json=args.json)
            return 0
        if args.command == "test":
            return _run_isolated_tests(
                args.arguments,
                state_dir=args.state_dir,
                download_cache=args.download_cache,
            )
        return _run_isolated_script(
            f"{args.command}.py",
            args.arguments,
            state_dir=args.state_dir,
            download_cache=args.download_cache,
        )
    except CaseStudyError as exc:
        print(f"case-study environment failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
