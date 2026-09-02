"""Project-owned configuration and release-matrix validation."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from tools.paths import ProjectPaths, project_paths

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-(?:0|[1-9A-Za-z-][0-9A-Za-z-]*)(?:\."
    r"(?:0|[1-9A-Za-z-][0-9A-Za-z-]*))*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)

SUPPORTED_CLI_TARGETS = {
    "linux",
    "windows",
    "windows-portable",
    "windows-cross-linux",
    "macos",
}
SUPPORTED_BUNDLES = {
    "linux": ("deb", "rpm", "appimage"),
    "windows": ("msi", "nsis"),
    "windows-portable": (),
    "windows-cross-linux": (),
    "macos": ("app", "dmg"),
}
REQUIRED_MATRIX_IDS = {
    "linux-x86_64",
    "windows-x86_64",
    "macos-aarch64",
    "macos-x86_64",
}
REQUIRED_PACKAGE_TYPES = {
    "deb",
    "rpm",
    "appimage",
    "msi",
    "nsis",
    "portable-zip",
    "dmg",
    "app-archive",
}
REQUIRED_TARGET_CONTRACT = {
    "linux-x86_64": {
        "os": "linux",
        "rust_target": "x86_64-unknown-linux-gnu",
        "architecture": "x86_64",
        "packages": {"deb", "rpm", "appimage"},
    },
    "windows-x86_64": {
        "os": "windows",
        "rust_target": "x86_64-pc-windows-msvc",
        "architecture": "x86_64",
        "packages": {"msi", "nsis", "portable-zip"},
    },
    "macos-aarch64": {
        "os": "macos",
        "rust_target": "aarch64-apple-darwin",
        "architecture": "aarch64",
        "packages": {"dmg", "app-archive"},
    },
    "macos-x86_64": {
        "os": "macos",
        "rust_target": "x86_64-apple-darwin",
        "architecture": "x86_64",
        "packages": {"dmg", "app-archive"},
    },
}


class ConfigError(ValueError):
    """Raised when an owned project configuration is invalid."""


@dataclass(frozen=True, slots=True)
class BuildSpec:
    cli_target: str
    bundles: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ArtifactSpec:
    package_type: str
    source_glob: str
    filename: str
    archive: str | None = None
    executable: bool = False

    def public_name(self, version: str) -> str:
        return self.filename.format(version=version)


@dataclass(frozen=True, slots=True)
class TargetSpec:
    target_id: str
    os: str
    runner: str
    rust_target: str
    architecture: str
    builds: tuple[BuildSpec, ...]
    artifacts: tuple[ArtifactSpec, ...]


@dataclass(frozen=True, slots=True)
class ReleaseMatrix:
    schema_version: int
    product: str
    repository: str
    targets: tuple[TargetSpec, ...]

    def target(self, target_id: str) -> TargetSpec:
        matches = [target for target in self.targets if target.target_id == target_id]
        if len(matches) != 1:
            raise ConfigError(f"unknown or duplicate release matrix target: {target_id}")
        return matches[0]

    def expected_filenames(self, version: str) -> tuple[str, ...]:
        return tuple(
            artifact.public_name(version)
            for target in self.targets
            for artifact in target.artifacts
        )


@dataclass(frozen=True, slots=True)
class ToolchainContract:
    python: str
    node: str
    corepack: str
    pnpm: str
    rust: str
    pip: str


def application_version(paths: ProjectPaths | None = None) -> str:
    value = (paths or project_paths()).version_file.read_text(encoding="utf-8").strip()
    if not SEMVER_PATTERN.fullmatch(value):
        raise ConfigError(f"VERSION is not valid semantic versioning: {value or '<empty>'}")
    return value


def load_toolchain_contract(paths: ProjectPaths | None = None) -> ToolchainContract:
    project = paths or project_paths()
    config_path = project.root / ".github" / "toolchains.json"
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"could not read {config_path}: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise ConfigError("toolchain contract schema_version must be 1")
    values = {
        key: _require_string(payload, key, "toolchains")
        for key in ("python", "node", "corepack", "pnpm", "rust", "pip")
    }
    for key, value in values.items():
        if not re.fullmatch(r"\d+\.\d+(?:\.\d+)?", value):
            raise ConfigError(f"toolchains.{key} must be a numeric pinned version")
    return ToolchainContract(**values)


def normalize_bundles(cli_target: str, value: str | None) -> tuple[str, ...]:
    if cli_target not in SUPPORTED_BUNDLES:
        raise ConfigError(f"unsupported desktop target: {cli_target}")
    allowed = SUPPORTED_BUNDLES[cli_target]
    if value is None:
        return allowed
    requested: list[str] = []
    for raw in value.split(","):
        bundle = raw.strip().lower()
        if not bundle:
            raise ConfigError("bundle list contains an empty value")
        if not re.fullmatch(r"[a-z0-9-]+", bundle):
            raise ConfigError(f"unsafe bundle value: {raw!r}")
        if bundle not in allowed:
            expected = ", ".join(allowed) if allowed else "none"
            raise ConfigError(f"bundle {bundle!r} is invalid for {cli_target}; expected {expected}")
        if bundle not in requested:
            requested.append(bundle)
    return tuple(bundle for bundle in allowed if bundle in requested)


def _require_string(payload: dict[str, Any], key: str, context: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{context}.{key} must be a non-empty string")
    return value


def _parse_build(payload: Any, context: str) -> BuildSpec:
    if not isinstance(payload, dict):
        raise ConfigError(f"{context} must be an object")
    cli_target = _require_string(payload, "cli_target", context)
    if cli_target not in SUPPORTED_CLI_TARGETS:
        raise ConfigError(f"{context}.cli_target is unsupported: {cli_target}")
    raw_bundles = payload.get("bundles", [])
    if not isinstance(raw_bundles, list) or not all(isinstance(item, str) for item in raw_bundles):
        raise ConfigError(f"{context}.bundles must be a string array")
    bundles = normalize_bundles(cli_target, ",".join(raw_bundles)) if raw_bundles else ()
    return BuildSpec(cli_target=cli_target, bundles=bundles)


def _parse_artifact(payload: Any, context: str) -> ArtifactSpec:
    if not isinstance(payload, dict):
        raise ConfigError(f"{context} must be an object")
    package_type = _require_string(payload, "package_type", context)
    source_glob = _require_string(payload, "source_glob", context)
    filename = _require_string(payload, "filename", context)
    if Path(source_glob).is_absolute() or ".." in Path(source_glob).parts:
        raise ConfigError(f"{context}.source_glob must be repository-relative")
    if Path(filename).name != filename or "{version}" not in filename:
        raise ConfigError(f"{context}.filename must be a basename containing '{{version}}'")
    try:
        filename.format(version="0.0.0")
    except (IndexError, KeyError, ValueError) as exc:
        raise ConfigError(f"{context}.filename contains an unsupported placeholder") from exc
    archive = payload.get("archive")
    if archive not in (None, "zip", "tar.gz"):
        raise ConfigError(f"{context}.archive must be zip or tar.gz")
    executable = payload.get("executable", False)
    if not isinstance(executable, bool):
        raise ConfigError(f"{context}.executable must be a boolean")
    return ArtifactSpec(
        package_type=package_type,
        source_glob=source_glob,
        filename=filename,
        archive=archive,
        executable=executable,
    )


def load_release_matrix(paths: ProjectPaths | None = None) -> ReleaseMatrix:
    project = paths or project_paths()
    try:
        payload = json.loads(project.release_matrix.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ConfigError(f"could not read {project.release_matrix}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ConfigError("release matrix root must be an object")
    if payload.get("schema_version") != 1:
        raise ConfigError("release matrix schema_version must be 1")
    raw_targets = payload.get("targets")
    if not isinstance(raw_targets, list) or not raw_targets:
        raise ConfigError("release matrix targets must be a non-empty array")
    targets: list[TargetSpec] = []
    for index, raw_target in enumerate(raw_targets):
        context = f"targets[{index}]"
        if not isinstance(raw_target, dict):
            raise ConfigError(f"{context} must be an object")
        raw_builds = raw_target.get("builds")
        raw_artifacts = raw_target.get("artifacts")
        if not isinstance(raw_builds, list) or not raw_builds:
            raise ConfigError(f"{context}.builds must be a non-empty array")
        if not isinstance(raw_artifacts, list) or not raw_artifacts:
            raise ConfigError(f"{context}.artifacts must be a non-empty array")
        targets.append(
            TargetSpec(
                target_id=_require_string(raw_target, "id", context),
                os=_require_string(raw_target, "os", context),
                runner=_require_string(raw_target, "runner", context),
                rust_target=_require_string(raw_target, "rust_target", context),
                architecture=_require_string(raw_target, "architecture", context),
                builds=tuple(
                    _parse_build(item, f"{context}.builds[{item_index}]")
                    for item_index, item in enumerate(raw_builds)
                ),
                artifacts=tuple(
                    _parse_artifact(item, f"{context}.artifacts[{item_index}]")
                    for item_index, item in enumerate(raw_artifacts)
                ),
            )
        )
    matrix = ReleaseMatrix(
        schema_version=1,
        product=_require_string(payload, "product", "matrix"),
        repository=_require_string(payload, "repository", "matrix"),
        targets=tuple(targets),
    )
    _validate_release_contract(matrix)
    return matrix


def _validate_release_contract(matrix: ReleaseMatrix) -> None:
    ids = [target.target_id for target in matrix.targets]
    if len(ids) != len(set(ids)):
        raise ConfigError("release matrix target ids must be unique")
    missing_ids = REQUIRED_MATRIX_IDS - set(ids)
    if missing_ids:
        raise ConfigError(f"release matrix is missing targets: {', '.join(sorted(missing_ids))}")
    filenames = matrix.expected_filenames("0.0.0")
    if len(filenames) != len(set(name.casefold() for name in filenames)):
        raise ConfigError("release artifact filenames must be case-insensitively unique")
    package_types = {
        artifact.package_type for target in matrix.targets for artifact in target.artifacts
    }
    missing_types = REQUIRED_PACKAGE_TYPES - package_types
    if missing_types:
        raise ConfigError(
            f"release matrix is missing package types: {', '.join(sorted(missing_types))}"
        )
    package_type_list = [
        artifact.package_type for target in matrix.targets for artifact in target.artifacts
    ]
    duplicated_types = sorted(
        package_type
        for package_type in set(package_type_list)
        if package_type_list.count(package_type) > 1 and package_type not in {"dmg", "app-archive"}
    )
    if duplicated_types:
        raise ConfigError("release package types are duplicated: " + ", ".join(duplicated_types))
    for target in matrix.targets:
        contract = REQUIRED_TARGET_CONTRACT.get(target.target_id)
        if contract is not None:
            actual_packages = {artifact.package_type for artifact in target.artifacts}
            for field in ("os", "rust_target", "architecture"):
                if getattr(target, field) != contract[field]:
                    raise ConfigError(f"{target.target_id}.{field} must be {contract[field]}")
            if actual_packages != contract["packages"]:
                raise ConfigError(
                    f"{target.target_id} package contract mismatch: "
                    f"expected {sorted(contract['packages'])}, got {sorted(actual_packages)}"
                )
        if target.os == "windows" and not target.runner.startswith("windows-"):
            raise ConfigError(f"{target.target_id} must use a native Windows runner")
        if target.os == "linux" and not target.runner.startswith("ubuntu-"):
            raise ConfigError(f"{target.target_id} must use a native Linux runner")
        if target.os == "macos" and not target.runner.startswith("macos-"):
            raise ConfigError(f"{target.target_id} must use a native macOS runner")
        if any(item.package_type == "msi" for item in target.artifacts) and target.os != "windows":
            raise ConfigError("MSI artifacts must be built on Windows")
        if (
            any(item.package_type in {"dmg", "app-archive"} for item in target.artifacts)
            and target.os != "macos"
        ):
            raise ConfigError("macOS artifacts must be built on macOS")
        if (
            any(item.package_type in {"deb", "rpm", "appimage"} for item in target.artifacts)
            and target.os != "linux"
        ):
            raise ConfigError("Linux packages must be built on Linux")
        if (
            any(item.package_type in {"msi", "nsis", "portable-zip"} for item in target.artifacts)
            and target.os != "windows"
        ):
            raise ConfigError("Windows packages must be built on Windows")
        if any(build.cli_target == "windows-cross-linux" for build in target.builds):
            raise ConfigError("experimental Windows cross-builds cannot enter the release matrix")
        source_globs = [artifact.source_glob for artifact in target.artifacts]
        if len(source_globs) != len(set(source_globs)):
            raise ConfigError(f"{target.target_id} artifact source globs must be unique")
        if any(target.rust_target not in value for value in source_globs):
            raise ConfigError(
                f"{target.target_id} artifact globs must name the explicit Rust target"
            )
        for artifact in target.artifacts:
            if artifact.package_type == "app-archive" and artifact.archive != "tar.gz":
                raise ConfigError("macOS app bundles must use a permission-preserving tar.gz")
            if artifact.package_type == "appimage" and not artifact.executable:
                raise ConfigError("AppImage artifacts must require an executable bit")
