#!/usr/bin/env python3
"""Build or verify the pinned WASI analyzer and its provenance.

The source digest iterates the sorted POSIX-relative paths build.py, Cargo.toml,
Cargo.lock, rust-toolchain.toml, and src/**/*.rs. For every input it hashes
`path + NUL + file bytes + NUL`. Both build and --check call source_sha256().
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tomllib

ROOT = Path(__file__).resolve().parent
TARGET = "wasm32-wasip1"
BINARY = "rust_quality_analyzer.wasm"
ARTIFACT = ROOT / "dist" / BINARY
PROVENANCE = ROOT / "provenance.json"
SYN_VERSION = "2.0.119"
PROC_MACRO2_VERSION = "1.0.107"
RUSTC_VERSION = "rustc 1.97.1 (8bab26f4f 2026-07-14)"
ENCODED_RUSTFLAGS_SEPARATOR = "\x1f"
VIRTUAL_SOURCE_ROOT = "/workspace/rust-quality-analyzer"
VIRTUAL_CARGO_HOME = "/cargo-home"
VIRTUAL_CARGO_TARGET = "/cargo-target"
VIRTUAL_RUST_SYSROOT = "/rust-toolchain"
VIRTUAL_DEPENDENCY_ROOT = "/cargo-sources"
PATH_REMAP_CONTRACT: dict[str, Any] = {
    "version": 1,
    "transport": "CARGO_ENCODED_RUSTFLAGS",
    "precedence": "broad-roots-first-specific-roots-last",
    "user_home": "/user-home",
    "source_root": VIRTUAL_SOURCE_ROOT,
    "cargo_home": VIRTUAL_CARGO_HOME,
    "cargo_target": VIRTUAL_CARGO_TARGET,
    "rust_sysroot": VIRTUAL_RUST_SYSROOT,
    "dependency_root_template": f"{VIRTUAL_DEPENDENCY_ROOT}/<name>-<version>-<source-sha256-12>",
}


@dataclass(frozen=True, slots=True)
class PathRemapping:
    source: Path
    destination: str


def source_inputs() -> tuple[Path, ...]:
    paths = [
        ROOT / "build.py",
        ROOT / "Cargo.toml",
        ROOT / "Cargo.lock",
        ROOT / "rust-toolchain.toml",
    ]
    paths.extend((ROOT / "src").rglob("*.rs"))
    return tuple(sorted(paths, key=lambda path: path.relative_to(ROOT).as_posix()))


def source_sha256() -> str:
    digest = hashlib.sha256()
    for path in source_inputs():
        relative = path.relative_to(ROOT).as_posix().encode("utf-8")
        digest.update(relative)
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def command_path(name: str) -> str:
    configured = os.environ.get(name.upper())
    candidates = [
        Path(configured) if configured else None,
        Path(path) if (path := shutil.which(name)) else None,
        Path.home() / ".cargo" / "bin" / name,
    ]
    match = next((path for path in candidates if path is not None and path.is_file()), None)
    if match is None:
        raise RuntimeError(f"required command is unavailable: {name}")
    return str(match)


def run(command: list[str], *, environment: dict[str, str] | None = None) -> str:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(detail or f"command failed with exit {completed.returncode}")
    return completed.stdout.strip()


def dependency_version(name: str) -> str:
    lock = tomllib.loads((ROOT / "Cargo.lock").read_text(encoding="utf-8"))
    versions = sorted(package["version"] for package in lock.get("package", []) if package.get("name") == name)
    if len(versions) != 1:
        raise RuntimeError(f"Cargo.lock must contain exactly one {name} package")
    return versions[0]


def target_directory(environment: dict[str, str]) -> Path:
    configured = environment.get("CARGO_TARGET_DIR")
    if configured is None:
        return ROOT / "target"
    path = Path(configured)
    return (path if path.is_absolute() else ROOT / path).resolve()


def environment_path(environment: dict[str, str], name: str, default: Path) -> Path:
    configured = environment.get(name)
    path = Path(configured).expanduser() if configured else default
    return (path if path.is_absolute() else ROOT / path).resolve()


def clean_build_environment(rustc: str) -> dict[str, str]:
    environment = os.environ.copy()
    for name in tuple(environment):
        if name.startswith(("CARGO_PROFILE_RELEASE_", "CARGO_TARGET_WASM32_WASIP1_")):
            environment.pop(name)
    for name in (
        "RUSTFLAGS",
        "CARGO_ENCODED_RUSTFLAGS",
        "CARGO_BUILD_RUSTC",
        "CARGO_BUILD_RUSTC_WRAPPER",
        "CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER",
        "CARGO_BUILD_RUSTFLAGS",
        "RUSTC_BOOTSTRAP",
        "RUSTC_CODEGEN_BACKEND",
        "RUSTUP_TOOLCHAIN",
    ):
        environment.pop(name, None)
    environment["RUSTC"] = rustc
    environment["RUSTC_WRAPPER"] = ""
    environment["RUSTC_WORKSPACE_WRAPPER"] = ""
    environment["CARGO_INCREMENTAL"] = "0"
    environment["CARGO_PROFILE_RELEASE_CODEGEN_UNITS"] = "1"
    environment["CARGO_PROFILE_RELEASE_DEBUG"] = "0"
    environment["CARGO_PROFILE_RELEASE_DEBUG_ASSERTIONS"] = "false"
    environment["CARGO_PROFILE_RELEASE_INCREMENTAL"] = "false"
    environment["CARGO_PROFILE_RELEASE_LTO"] = "true"
    environment["CARGO_PROFILE_RELEASE_OPT_LEVEL"] = "s"
    environment["CARGO_PROFILE_RELEASE_OVERFLOW_CHECKS"] = "false"
    environment["CARGO_PROFILE_RELEASE_PANIC"] = "abort"
    environment["CARGO_PROFILE_RELEASE_RPATH"] = "false"
    environment["CARGO_PROFILE_RELEASE_SPLIT_DEBUGINFO"] = "off"
    environment["CARGO_PROFILE_RELEASE_STRIP"] = "symbols"
    return environment


def cargo_metadata(cargo: str, environment: dict[str, str]) -> dict[str, Any]:
    output = run(
        [
            cargo,
            "metadata",
            "--locked",
            "--format-version",
            "1",
            "--manifest-path",
            str(ROOT / "Cargo.toml"),
        ],
        environment=environment,
    )
    value = json.loads(output)
    if not isinstance(value, dict) or not isinstance(value.get("packages"), list):
        raise TypeError("Cargo returned invalid package metadata")
    return value


def dependency_remappings(metadata: dict[str, Any]) -> tuple[PathRemapping, ...]:
    workspace_members = metadata.get("workspace_members")
    if not isinstance(workspace_members, list) or not all(isinstance(item, str) for item in workspace_members):
        raise TypeError("Cargo workspace metadata is invalid")
    workspace_member_ids = frozenset(workspace_members)
    remappings: list[PathRemapping] = []
    destinations: set[str] = set()
    for package in metadata["packages"]:
        if not isinstance(package, dict):
            raise TypeError("Cargo package metadata is invalid")
        try:
            package_root = Path(package["manifest_path"]).resolve().parent
            package_id = package["id"]
            if not isinstance(package_id, str):
                raise TypeError("Cargo package identity is invalid")
            if package_id in workspace_member_ids:
                package_root.relative_to(ROOT)
                continue
            source = package.get("source")
            if not isinstance(source, str) or not source:
                raise RuntimeError("external path dependencies are not supported by the remapping contract")
            name = package.get("name")
            version = package.get("version")
            if not isinstance(name, str) or not isinstance(version, str):
                raise TypeError("Cargo package identity is invalid")
            source_hash = hashlib.sha256(source.encode("utf-8")).hexdigest()[:12]
            destination = f"{VIRTUAL_DEPENDENCY_ROOT}/{name}-{version}-{source_hash}"
            if destination in destinations:
                raise RuntimeError(f"duplicate stable dependency path: {destination}")
            destinations.add(destination)
            remappings.append(PathRemapping(package_root, destination))
        except ValueError as error:
            raise RuntimeError("workspace packages must remain inside the analyzer source root") from error
        except (KeyError, OSError) as error:
            raise RuntimeError("Cargo package metadata is invalid") from error
    return tuple(remappings)


def path_remappings(metadata: dict[str, Any], environment: dict[str, str], rustc: str) -> tuple[PathRemapping, ...]:
    cargo_home = environment_path(environment, "CARGO_HOME", Path.home() / ".cargo")
    rust_sysroot = Path(run([rustc, "--print", "sysroot"], environment=environment)).resolve()
    candidates = [
        PathRemapping(Path.home().resolve(), "/user-home"),
        PathRemapping(cargo_home, VIRTUAL_CARGO_HOME),
        PathRemapping(target_directory(environment), VIRTUAL_CARGO_TARGET),
        PathRemapping(rust_sysroot, VIRTUAL_RUST_SYSROOT),
        PathRemapping(ROOT, VIRTUAL_SOURCE_ROOT),
        *dependency_remappings(metadata),
    ]
    by_source: dict[Path, str] = {}
    # Later roles have higher semantic priority when physical roots are equal.
    # Sorting below still makes nested (more specific) roots win in rustc.
    for mapping in candidates:
        by_source[mapping.source] = mapping.destination
    remappings = tuple(
        PathRemapping(source, destination)
        for source, destination in sorted(by_source.items(), key=lambda item: (len(str(item[0])), str(item[0])))
    )
    for mapping in remappings:
        source = str(mapping.source)
        if "\0" in source or ENCODED_RUSTFLAGS_SEPARATOR in source:
            raise RuntimeError(f"build path cannot be encoded safely: {source}")
    return remappings


def encoded_rustflags(remappings: tuple[PathRemapping, ...]) -> str:
    return ENCODED_RUSTFLAGS_SEPARATOR.join(
        f"--remap-path-prefix={mapping.source}={mapping.destination}" for mapping in remappings
    )


def validate_private_paths_absent(artifact: Path, remappings: tuple[PathRemapping, ...]) -> None:
    content = artifact.read_bytes()
    private_roots = {mapping.source for mapping in remappings}
    private_roots.add(Path.home().resolve())
    for root in sorted(private_roots, key=str):
        native = str(root).encode("utf-8")
        slash = str(root).replace("\\", "/").encode("utf-8")
        if native in content or slash in content:
            raise RuntimeError(f"WASI artifact contains an unremapped private build path: {root}")


def build_artifact() -> tuple[Path, str]:
    if dependency_version("syn") != SYN_VERSION:
        raise RuntimeError(f"Cargo.lock must pin syn {SYN_VERSION}")
    if dependency_version("proc-macro2") != PROC_MACRO2_VERSION:
        raise RuntimeError(f"Cargo.lock must pin proc-macro2 {PROC_MACRO2_VERSION}")
    cargo = command_path("cargo")
    rustc_command = command_path("rustc")
    environment = clean_build_environment(rustc_command)
    rustc = run([rustc_command, "--version"], environment=environment)
    if rustc != RUSTC_VERSION:
        raise RuntimeError(f"unexpected rustc version: {rustc}")
    metadata = cargo_metadata(cargo, environment)
    remappings = path_remappings(metadata, environment, rustc_command)
    environment["CARGO_ENCODED_RUSTFLAGS"] = encoded_rustflags(remappings)
    run(
        [
            cargo,
            "build",
            "--locked",
            "--release",
            "--target",
            TARGET,
            "--manifest-path",
            str(ROOT / "Cargo.toml"),
        ],
        environment=environment,
    )
    built = target_directory(environment) / TARGET / "release" / BINARY
    if not built.is_file():
        raise RuntimeError(f"Cargo did not produce {built}")
    validate_private_paths_absent(built, remappings)
    return built, rustc


def provenance_payload(artifact_sha256: str, rustc: str) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "analyzer": {
            "name": "rust-quality-analyzer",
            "version": "1.0.0",
            "abi_version": 1,
        },
        "artifact": {
            "path": "dist/rust_quality_analyzer.wasm",
            "sha256": artifact_sha256,
            "target": TARGET,
        },
        "build": {
            "rustc": rustc,
            "syn": SYN_VERSION,
            "proc_macro2": PROC_MACRO2_VERSION,
            "cargo_lock_sha256": file_sha256(ROOT / "Cargo.lock"),
            "source_sha256": source_sha256(),
            "path_remapping": PATH_REMAP_CONTRACT,
        },
    }


def write_outputs(built: Path, rustc: str) -> None:
    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    temporary_artifact = ARTIFACT.with_suffix(".wasm.tmp")
    shutil.copyfile(built, temporary_artifact)
    temporary_artifact.replace(ARTIFACT)
    payload = provenance_payload(file_sha256(ARTIFACT), rustc)
    temporary_provenance = PROVENANCE.with_suffix(".json.tmp")
    temporary_provenance.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary_provenance.replace(PROVENANCE)


def check_outputs(built: Path, rustc: str) -> None:
    if not ARTIFACT.is_file() or not PROVENANCE.is_file():
        raise RuntimeError("artifact or provenance is missing; run build.py first")
    built_hash = file_sha256(built)
    artifact_hash = file_sha256(ARTIFACT)
    if built_hash != artifact_hash:
        raise RuntimeError("rebuilt WASI artifact differs from dist artifact")
    expected = provenance_payload(artifact_hash, rustc)
    actual = json.loads(PROVENANCE.read_text(encoding="utf-8"))
    if actual != expected:
        raise RuntimeError("provenance.json does not match artifact, sources, or toolchain")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="rebuild and verify the existing artifact and provenance without rewriting them",
    )
    arguments = parser.parse_args()
    try:
        built, rustc = build_artifact()
        if arguments.check:
            check_outputs(built, rustc)
        else:
            write_outputs(built, rustc)
    except (OSError, RuntimeError, TypeError, ValueError) as error:
        print(f"rust analyzer build failed: {error}", file=sys.stderr)
        return 1
    action = "verified" if arguments.check else "built"
    print(f"{action}: {ARTIFACT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
