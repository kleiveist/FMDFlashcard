"""Fixed, shell-free actions for isolated integration staging trees."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

import tomllib

from tools.core.filesystem import (
    FilesystemSafetyError,
    read_regular_bytes,
    safe_join,
    safe_relative_path,
    validate_root,
)
from tools.integration.model import (
    Finding,
    FindingStatus,
    IntegrationError,
    VerificationResult,
)
from tools.integration.sanitize import sanitize_text
from tools.integration.transaction import trigger_test_failpoint
from tools.process import run_bounded, safe_platform_environment

_DEFAULT_TIMEOUT_SECONDS = 900
_MAX_TIMEOUT_SECONDS = 1800
_OUTPUT_LIMIT = 1200
_PYTEST_LAUNCHER = (
    "import importlib.util,pathlib,sys;"
    "import pytest;"
    "root=pathlib.Path(sys.argv.pop(1));"
    "spec=importlib.util.spec_from_file_location("
    "'tools',root/'__init__.py',submodule_search_locations=[str(root)]);"
    "module=importlib.util.module_from_spec(spec);"
    "sys.modules['tools']=module;"
    "spec.loader.exec_module(module);"
    "raise SystemExit(pytest.main(sys.argv[1:]))"
)
_PYTHON_COMPILE_LAUNCHER = (
    "import pathlib,sys;"
    "root=pathlib.Path(sys.argv[1]);"
    "files=sorted(path for path in root.rglob('*.py') "
    "if path.is_file() and not path.is_symlink());"
    "[compile(path.read_bytes(),str(path),'exec',dont_inherit=True) for path in files]"
)
_RUSTUP_TOOLCHAIN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+-]*")


class ActionKind(str, Enum):
    """Allowlisted action kinds; callers cannot supply commands or arguments."""

    DEPENDENCIES = "dependencies"
    QUALITY = "quality"
    TESTS = "tests"
    BUILD = "build"


_ACTION_ORDER = {
    ActionKind.DEPENDENCIES: 0,
    ActionKind.QUALITY: 1,
    ActionKind.TESTS: 2,
    ActionKind.BUILD: 3,
}


@dataclass(frozen=True, slots=True)
class ActionSpec:
    """One fixed action with bounded trigger paths and execution-time policy."""

    kind: ActionKind | str
    paths: tuple[str, ...] = ()
    timeout_seconds: int = _DEFAULT_TIMEOUT_SECONDS

    def __post_init__(self) -> None:
        kind = self.kind
        if not isinstance(kind, ActionKind):
            try:
                kind = ActionKind(str(kind).strip().lower())
            except ValueError as exc:
                raise ValueError(
                    f"Unsupported integration action kind: {self.kind!r}."
                ) from exc
        if (
            isinstance(self.timeout_seconds, bool)
            or not isinstance(self.timeout_seconds, int)
            or not 1 <= self.timeout_seconds <= _MAX_TIMEOUT_SECONDS
        ):
            raise ValueError(
                "Integration action timeout must be an integer between 1 and "
                f"{_MAX_TIMEOUT_SECONDS} seconds."
            )
        if not isinstance(self.paths, tuple):
            raise TypeError("Integration action paths must be a tuple.")
        try:
            paths = tuple(sorted({safe_relative_path(path) for path in self.paths}))
        except (FilesystemSafetyError, TypeError) as exc:
            raise ValueError(
                "Integration action paths must be safe relative paths."
            ) from exc
        if len(paths) != len(self.paths):
            raise ValueError("Integration action paths must be unique and normalized.")
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "paths", paths)


@dataclass(frozen=True, slots=True)
class _BuildCommand:
    """One fixed build invocation derived from an allowlisted manifest type."""

    command: tuple[str, ...]
    cwd: Path
    target: str


class ActionRunner:
    """Run canonical installability and verification checks in isolated staging."""

    def __init__(self, actions: Iterable[ActionSpec]) -> None:
        try:
            supplied = tuple(actions)
        except TypeError as exc:
            raise TypeError(
                "Integration actions must be an iterable of ActionSpec values."
            ) from exc
        if any(not isinstance(action, ActionSpec) for action in supplied):
            raise TypeError("Integration actions must contain only ActionSpec values.")
        kinds = tuple(action.kind for action in supplied)
        if len(kinds) != len(set(kinds)):
            raise ValueError("Integration action kinds must be unique.")
        self.actions = tuple(
            sorted(supplied, key=lambda item: _ACTION_ORDER[item.kind])
        )

    def __call__(self, project_root: Path) -> VerificationResult:
        """Make the runner directly usable as a transaction staged callback."""

        return self.run(project_root)

    def run(self, project_root: Path) -> VerificationResult:
        """Execute configured actions with a sanitized, disposable environment."""

        root = _validated_action_root(project_root)
        if not self.actions:
            return VerificationResult(())
        findings: list[Finding] = []
        with tempfile.TemporaryDirectory(prefix="tooling-actions-") as temporary:
            environment = _action_environment(Path(temporary), root)
            for action in self.actions:
                finding = _run_action(root, action, environment)
                findings.append(finding)
                if finding.status is FindingStatus.FAIL:
                    break
        return VerificationResult(tuple(findings))


def _validated_action_root(project_root: Path) -> Path:
    try:
        return validate_root(project_root)
    except FilesystemSafetyError as exc:
        raise IntegrationError(str(exc)) from exc


def _command(kind: ActionKind, root: Path) -> tuple[str, ...]:
    tools = root / "tools"
    if kind is ActionKind.QUALITY:
        return (
            sys.executable,
            "-I",
            "-B",
            "-m",
            "ruff",
            "check",
            "--isolated",
            "--no-cache",
            str(tools / "adapters"),
            str(tools / "integration"),
        )
    if kind is ActionKind.TESTS:
        return (
            sys.executable,
            "-I",
            "-B",
            "-c",
            _PYTEST_LAUNCHER,
            str(tools),
            "-c",
            os.devnull,
            "--rootdir",
            str(tools),
            "--confcutdir",
            str(tools / "tests"),
            "--import-mode=importlib",
            "-p",
            "no:cacheprovider",
            "-q",
            str(tools / "tests" / "adapters"),
            str(tools / "tests" / "integration"),
        )
    raise IntegrationError(f"Unsupported integration action kind: {kind!r}.")


def _run_action(
    root: Path,
    action: ActionSpec,
    environment: Mapping[str, str],
) -> Finding:
    check = f"transaction-action:{action.kind.value}"
    if action.kind is ActionKind.DEPENDENCIES:
        return _run_dependency_action(root, action, environment)
    if action.kind is ActionKind.BUILD:
        return _run_build_action(root, action, environment)
    if action.kind is ActionKind.QUALITY:
        try:
            trigger_test_failpoint("quality_check")
        except IntegrationError as exc:
            return _action_failure(check, action.kind, str(exc))
    command = _command(action.kind, root)
    try:
        completed = run_bounded(
            command,
            cwd=root,
            env=dict(environment),
            check=False,
            capture_output=True,
            text=True,
            timeout=action.timeout_seconds,
            shell=False,
            stdin=subprocess.DEVNULL,
        )
    except subprocess.TimeoutExpired:
        return _action_failure(
            check,
            action.kind,
            f"timed out after {action.timeout_seconds} seconds",
        )
    except (OSError, subprocess.SubprocessError) as exc:
        detail = _safe_detail(exc, root)
        return _action_failure(check, action.kind, f"could not run: {detail}")

    if completed.returncode == 0:
        return Finding(
            check,
            FindingStatus.PASS,
            f"Staged {action.kind.value} action passed.",
            adapter="transaction-actions",
        )
    output = "\n".join(
        part for part in (completed.stdout or "", completed.stderr or "") if part
    )
    detail = _safe_detail(output, root)
    return _action_failure(
        check,
        action.kind,
        f"failed with exit code {completed.returncode}: {detail}",
    )


def _action_failure(check: str, kind: ActionKind, detail: str) -> Finding:
    return Finding(
        check,
        FindingStatus.FAIL,
        f"Staged {kind.value} action {detail}.",
        adapter="transaction-actions",
    )


def _run_dependency_action(
    root: Path,
    action: ActionSpec,
    environment: Mapping[str, str],
) -> Finding:
    check = f"transaction-action:{action.kind.value}"
    if not action.paths:
        return _dependency_failure(
            check,
            "no dependency manifest trigger path was declared",
        )
    npm = shutil.which("npm", path=environment.get("PATH"))
    if npm is None:
        return _dependency_failure(check, "npm is unavailable")

    manifests: list[Path] = []
    for relative in action.paths:
        candidate = Path(relative)
        if candidate.name.casefold() != "package.json":
            return _dependency_failure(
                check,
                f"no deterministic offline installer is defined for {relative}",
            )
        try:
            manifest = safe_join(root, relative, require_exists=True)
            lock = safe_join(
                root,
                (candidate.parent / "package-lock.json").as_posix(),
                require_exists=True,
            )
        except FilesystemSafetyError:
            return _dependency_failure(
                check,
                f"a safe package-lock.json is required for {relative}",
            )
        if manifest.is_symlink() or lock.is_symlink():
            return _dependency_failure(
                check,
                f"dependency manifests must not be symbolic links at {relative}",
            )
        try:
            read_regular_bytes(
                manifest,
                root=root,
                label=f"Dependency manifest {relative}",
            )
            read_regular_bytes(
                lock,
                root=root,
                label=f"Dependency lockfile for {relative}",
            )
        except FilesystemSafetyError:
            return _dependency_failure(
                check,
                f"dependency manifest and lockfile must be regular files at {relative}",
            )
        manifests.append(manifest)

    for manifest in manifests:
        command = (
            npm,
            "ci",
            "--ignore-scripts",
            "--offline",
            "--no-audit",
            "--no-fund",
        )
        try:
            trigger_test_failpoint("dependency_install")
        except IntegrationError as exc:
            return _dependency_failure(check, str(exc))
        try:
            completed = run_bounded(
                command,
                cwd=manifest.parent,
                env=dict(environment),
                check=False,
                capture_output=True,
                text=True,
                timeout=action.timeout_seconds,
                shell=False,
                stdin=subprocess.DEVNULL,
            )
        except subprocess.TimeoutExpired:
            return _dependency_failure(
                check,
                f"offline npm ci timed out after {action.timeout_seconds} seconds",
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return _dependency_failure(
                check,
                f"offline npm ci could not run: {_safe_detail(exc, root)}",
            )
        if completed.returncode != 0:
            output = "\n".join(
                part
                for part in (completed.stdout or "", completed.stderr or "")
                if part
            )
            return _dependency_failure(
                check,
                "offline npm ci failed with exit code "
                f"{completed.returncode}: {_safe_detail(output, root)}",
            )
    return Finding(
        check,
        FindingStatus.PASS,
        "Staged locked-dependency validation passed for "
        f"{len(manifests)} npm project(s).",
        adapter="transaction-actions",
    )


def _run_build_action(
    root: Path,
    action: ActionSpec,
    environment: Mapping[str, str],
) -> Finding:
    """Execute actual, fixed build commands for declared build manifests."""

    check = f"transaction-action:{action.kind.value}"
    try:
        commands = _build_commands(root, action, environment)
    except IntegrationError as exc:
        return _action_failure(check, action.kind, f"was refused: {exc}")
    if not commands:
        return _action_failure(
            check,
            action.kind,
            "was refused: no supported build manifest trigger path was declared",
        )

    for build in commands:
        try:
            completed = run_bounded(
                build.command,
                cwd=build.cwd,
                env=dict(environment),
                check=False,
                capture_output=True,
                text=True,
                timeout=action.timeout_seconds,
                shell=False,
                stdin=subprocess.DEVNULL,
            )
        except subprocess.TimeoutExpired:
            return _action_failure(
                check,
                action.kind,
                f"timed out after {action.timeout_seconds} seconds for {build.target}",
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return _action_failure(
                check,
                action.kind,
                f"could not run for {build.target}: {_safe_detail(exc, root)}",
            )
        if completed.returncode != 0:
            output = "\n".join(
                part
                for part in (completed.stdout or "", completed.stderr or "")
                if part
            )
            return _action_failure(
                check,
                action.kind,
                "failed with exit code "
                f"{completed.returncode} for {build.target}: "
                f"{_safe_detail(output, root)}",
            )

    return Finding(
        check,
        FindingStatus.PASS,
        f"Staged build action passed for {len(commands)} declared target(s).",
        adapter="transaction-actions",
    )


def _build_commands(
    root: Path,
    action: ActionSpec,
    environment: Mapping[str, str],
) -> tuple[_BuildCommand, ...]:
    """Derive only fixed build commands from an allowlisted manifest name."""

    if not action.paths:
        return ()
    commands: list[_BuildCommand] = []
    cargo_roots: set[Path] = set()
    for relative in action.paths:
        manifest, payload = _regular_action_file(root, relative, "Build manifest")
        name = manifest.name
        if name == "package.json":
            commands.append(_npm_build_command(manifest, payload, environment))
        elif name == "pyproject.toml":
            commands.append(_python_build_command(manifest, payload, environment))
        elif name == "Cargo.toml":
            _validate_toml_manifest(manifest, payload)
            command = _cargo_build_command(manifest, environment)
            if command.cwd not in cargo_roots:
                cargo_roots.add(command.cwd)
                commands.append(command)
        elif name == "tauri.conf.json":
            _validate_json_manifest(manifest, payload)
            cargo_relative = (Path(relative).parent / "Cargo.toml").as_posix()
            cargo_manifest, cargo_payload = _regular_action_file(
                root,
                cargo_relative,
                "Tauri Cargo manifest",
            )
            _validate_toml_manifest(cargo_manifest, cargo_payload)
            command = _cargo_build_command(cargo_manifest, environment)
            if command.cwd not in cargo_roots:
                cargo_roots.add(command.cwd)
                commands.append(command)
        else:
            raise IntegrationError(f"no fixed build command is defined for {relative}")
    return tuple(commands)


def _regular_action_file(
    root: Path,
    relative: str,
    label: str,
) -> tuple[Path, bytes]:
    try:
        target = safe_join(root, relative, require_exists=True)
        if target.is_symlink():
            raise FilesystemSafetyError(f"{label} must not be a symbolic link")
        payload = read_regular_bytes(target, root=root, label=f"{label} {relative}")
    except (FilesystemSafetyError, OSError) as exc:
        raise IntegrationError(f"{label} is missing or unsafe at {relative}") from exc
    return target, payload


def _npm_build_command(
    manifest: Path,
    payload: bytes,
    environment: Mapping[str, str],
) -> _BuildCommand:
    document = _validate_json_manifest(manifest, payload)
    scripts = document.get("scripts")
    if not isinstance(scripts, dict) or not isinstance(scripts.get("build"), str):
        raise IntegrationError(
            f"package.json has no declared build script at {manifest.name}"
        )
    if not scripts["build"].strip():
        raise IntegrationError(
            f"package.json has an empty build script at {manifest.name}"
        )
    npm = shutil.which("npm", path=environment.get("PATH"))
    if npm is None:
        raise IntegrationError("npm is unavailable")
    return _BuildCommand((npm, "run", "build"), manifest.parent, "package.json")


def _python_build_command(
    manifest: Path,
    payload: bytes,
    _environment: Mapping[str, str],
) -> _BuildCommand:
    _validate_toml_manifest(manifest, payload)
    return _BuildCommand(
        (
            sys.executable,
            "-I",
            "-B",
            "-c",
            _PYTHON_COMPILE_LAUNCHER,
            str(manifest.parent),
        ),
        manifest.parent,
        "pyproject.toml",
    )


def _cargo_build_command(
    manifest: Path,
    environment: Mapping[str, str],
) -> _BuildCommand:
    cargo = shutil.which("cargo", path=environment.get("PATH"))
    if cargo is None:
        raise IntegrationError("cargo is unavailable")
    return _BuildCommand(
        (cargo, "check", "--locked"),
        manifest.parent,
        "Cargo.toml",
    )


def _validate_json_manifest(manifest: Path, payload: bytes) -> dict[str, object]:
    try:
        document = json.loads(payload.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise IntegrationError(f"invalid JSON build manifest: {manifest.name}") from exc
    if not isinstance(document, dict):
        raise IntegrationError(
            f"JSON build manifest must be an object: {manifest.name}"
        )
    return document


def _validate_toml_manifest(manifest: Path, payload: bytes) -> None:
    try:
        tomllib.loads(payload.decode("utf-8"))
    except (UnicodeError, tomllib.TOMLDecodeError) as exc:
        raise IntegrationError(f"invalid TOML build manifest: {manifest.name}") from exc


def _dependency_failure(check: str, detail: str) -> Finding:
    return Finding(
        check,
        FindingStatus.FAIL,
        "Staged locked-dependency validation was refused or failed: "
        f"{detail}. Network and lifecycle scripts remain disabled.",
        adapter="transaction-actions",
    )


def _safe_detail(value: object, root: Path) -> str:
    sanitized = sanitize_text(value, root).strip()
    if not sanitized:
        return "no diagnostic output"
    if len(sanitized) > _OUTPUT_LIMIT:
        sanitized = sanitized[-_OUTPUT_LIMIT:]
    return " | ".join(line.strip() for line in sanitized.splitlines() if line.strip())


def _action_environment(temporary: Path, root: Path) -> dict[str, str]:
    home = temporary / "home"
    cache = temporary / "cache"
    config = temporary / "config"
    data = temporary / "data"
    pycache = temporary / "pycache"
    for directory in (home, cache, config, data, pycache):
        directory.mkdir(mode=0o700)

    environment = safe_platform_environment(os.environ)
    environment.update(_rustup_runtime_environment())
    environment.update(
        {
            "PATH": _sanitized_search_path(os.environ.get("PATH"), root),
            "HOME": str(home),
            "USERPROFILE": str(home),
            "TMP": str(temporary),
            "TEMP": str(temporary),
            "TMPDIR": str(temporary),
            "XDG_CACHE_HOME": str(cache),
            "XDG_CONFIG_HOME": str(config),
            "XDG_DATA_HOME": str(data),
            "PYTHONDONTWRITEBYTECODE": "1",
            "PYTHONNOUSERSITE": "1",
            "PYTHONPYCACHEPREFIX": str(pycache),
            "PIP_CONFIG_FILE": os.devnull,
            "PIP_DISABLE_PIP_VERSION_CHECK": "1",
            "PIP_NO_INDEX": "1",
            "PIP_NO_INPUT": "1",
            "NPM_CONFIG_USERCONFIG": os.devnull,
            "NPM_CONFIG_CACHE": str(cache / "npm"),
            "NPM_CONFIG_IGNORE_SCRIPTS": "true",
            "NPM_CONFIG_OFFLINE": "true",
            "npm_config_ignore_scripts": "true",
            "npm_config_offline": "true",
            "CARGO_HOME": str(cache / "cargo"),
            "CARGO_NET_OFFLINE": "true",
            "CARGO_TARGET_DIR": str(cache / "cargo-target"),
            "UV_NO_CONFIG": "1",
            "UV_OFFLINE": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_OPTIONAL_LOCKS": "0",
            "GIT_TERMINAL_PROMPT": "0",
            "CI": "1",
            "NO_COLOR": "1",
            "TERM": "dumb",
            "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
            "TEMPLATE_TOOLING_NESTED_TEST": "1",
        }
    )
    return environment


def _rustup_runtime_environment() -> dict[str, str]:
    """Expose only the installed Rust runtime, never its Cargo cache.

    ``cargo`` is commonly a Rustup proxy.  The staging environment deliberately
    replaces ``HOME`` and ``CARGO_HOME`` so target-project builds cannot write
    into the caller's account, but the proxy still needs its pre-installed,
    read-only toolchain directory.  Hosted CI supplies ``RUSTUP_TOOLCHAIN``
    explicitly; local runs may safely use the caller's already-installed
    default toolchain.
    """

    try:
        default_home = Path.home() / ".rustup"
    except RuntimeError:  # pragma: no cover - platform home resolution failure
        return {}
    configured_home = os.environ.get("RUSTUP_HOME")
    rustup_home = Path(configured_home) if configured_home else default_home
    if not rustup_home.is_absolute() or not rustup_home.is_dir():
        return {}

    runtime = {"RUSTUP_HOME": str(rustup_home.resolve())}
    toolchain = os.environ.get("RUSTUP_TOOLCHAIN", "")
    if _RUSTUP_TOOLCHAIN.fullmatch(toolchain):
        runtime["RUSTUP_TOOLCHAIN"] = toolchain
    return runtime


def _sanitized_search_path(value: str | None, root: Path) -> str:
    candidates = (value or os.defpath).split(os.pathsep)
    accepted: list[str] = []
    for candidate in candidates:
        path = Path(candidate)
        if not candidate or not path.is_absolute():
            continue
        try:
            resolved = path.resolve(strict=False)
        except OSError:
            continue
        if resolved == root or resolved.is_relative_to(root):
            continue
        rendered = str(resolved)
        if rendered not in accepted:
            accepted.append(rendered)
    return os.pathsep.join(accepted) if accepted else os.defpath
