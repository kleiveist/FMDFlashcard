from __future__ import annotations

import argparse
import json
import os
import stat
import subprocess
import tarfile
import zipfile
from pathlib import Path
from typing import Any

import pytest

from tools import artifacts, process
from tools.artifacts import (
    ArtifactError,
    _discover_source,
    _write_deterministic_tar,
    assemble_release,
    collect_local_build_artifacts,
    create_deterministic_zip,
    sha256_file,
    verify_checksums,
    verify_local_desktop_root,
    verify_manifest_directory,
    verify_tar,
    verify_zip,
)
from tools.commands import tauri
from tools.paths import PathSafetyError, ProjectPaths, project_paths
from tools.project_config import ArtifactSpec, load_release_matrix

ROOT = Path(__file__).resolve().parents[2]
REQUIRED_EVIDENCE_FIELDS = {
    "architecture",
    "commit_sha",
    "file_size",
    "filename",
    "git_tag",
    "notarization",
    "package_type",
    "runner_os",
    "rust_target",
    "sha256",
    "signature",
    "source_repository",
    "toolchains",
}


def test_tool_version_resolves_windows_batch_shim(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    observed: dict[str, object] = {}

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        observed["command"] = command
        observed.update(kwargs)
        return subprocess.CompletedProcess(command, 0, stdout="10.17.1\n", stderr="")

    monkeypatch.setattr(
        artifacts.shutil,
        "which",
        lambda _name: r"C:\hostedtoolcache\node\pnpm.CMD",
    )
    monkeypatch.setattr(artifacts.subprocess, "run", fake_run)
    monkeypatch.setattr(process.sys, "platform", "win32")
    monkeypatch.setenv("SystemRoot", r"C:\Windows")

    assert artifacts._tool_version(["pnpm", "--version"]) == "10.17.1"
    assert observed["command"] == [
        r"C:\Windows\System32\cmd.exe",
        "/d",
        "/s",
        "/c",
        "call",
        r"C:\hostedtoolcache\node\pnpm.CMD",
        "--version",
    ]
    assert observed["shell"] is False
    assert observed["encoding"] == "utf-8"
    assert observed["errors"] == "replace"


def test_artifact_discovery_requires_one_fresh_regular_source(tmp_path: Path) -> None:
    root = tmp_path / "checkout"
    root.mkdir()
    paths = project_paths(root)
    artifacts_dir = root / "native"
    artifacts_dir.mkdir()
    source = artifacts_dir / "package.bin"
    source.write_bytes(b"native-package")
    marker = root / "build.started"
    marker.write_text("started\n", encoding="utf-8")
    os.utime(source, ns=(1_000_000_000, 1_000_000_000))
    os.utime(marker, ns=(2_000_000_000, 2_000_000_000))
    spec = ArtifactSpec("test", "native/*.bin", "package-v{version}.bin")

    with pytest.raises(ArtifactError, match="stale"):
        _discover_source(paths, spec, built_after=marker)

    os.utime(source, ns=(3_000_000_000, 3_000_000_000))
    assert _discover_source(paths, spec, built_after=marker) == source

    (artifacts_dir / "second.bin").write_bytes(b"duplicate")
    with pytest.raises(ArtifactError, match="expected exactly one"):
        _discover_source(paths, spec, built_after=None)

    (artifacts_dir / "second.bin").unlink()
    source.write_bytes(b"")
    with pytest.raises(ArtifactError, match="empty"):
        _discover_source(paths, spec, built_after=None)


def test_artifact_discovery_rejects_symlinked_path_components(tmp_path: Path) -> None:
    root = tmp_path / "checkout"
    outside = tmp_path / "outside"
    root.mkdir()
    outside.mkdir()
    (outside / "package.bin").write_bytes(b"outside")
    (root / "native").symlink_to(outside, target_is_directory=True)
    spec = ArtifactSpec("test", "native/*.bin", "package-v{version}.bin")

    with pytest.raises((ArtifactError, PathSafetyError)):
        _discover_source(project_paths(root), spec, built_after=None)


def test_deterministic_portable_zip_preserves_name_mode_and_bytes(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("SOURCE_DATE_EPOCH", "1700000000")
    executable = tmp_path / "fmd-flashcard-desktop.exe"
    executable.write_bytes(b"MZ\x00portable executable")
    # Windows filesystems do not expose a meaningful POSIX executable bit.
    executable.chmod(0o644)
    first = tmp_path / "first.zip"
    second = tmp_path / "second.zip"

    create_deterministic_zip(executable, first)
    create_deterministic_zip(executable, second)

    assert first.read_bytes() == second.read_bytes()
    with zipfile.ZipFile(first) as archive:
        assert archive.namelist() == ["fmd-flashcard-desktop.exe"]
        member = archive.getinfo("fmd-flashcard-desktop.exe")
        assert stat.S_IMODE(member.external_attr >> 16) == 0o755
        assert archive.read(member) == executable.read_bytes()


def test_deterministic_tar_preserves_app_executable_permissions(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("SOURCE_DATE_EPOCH", "1700000000")
    app = tmp_path / "FMDFlashcard.app"
    executable = app / "Contents" / "MacOS" / "fmd-flashcard-desktop"
    executable.parent.mkdir(parents=True)
    executable.write_bytes(b"mach-o-placeholder")
    executable.chmod(0o755)
    # Exercise the Windows case, where the source filesystem cannot retain POSIX execute bits.
    helper = executable.parent / "fmd-helper"
    helper.write_bytes(b"mach-o-helper-placeholder")
    helper.chmod(0o644)
    (app / "Contents" / "Info.plist").write_text("plist", encoding="utf-8")
    first = tmp_path / "first.tar.gz"
    second = tmp_path / "second.tar.gz"

    _write_deterministic_tar(app, first)
    _write_deterministic_tar(app, second)

    assert first.read_bytes() == second.read_bytes()
    verify_tar(first)
    with tarfile.open(first, "r:gz") as archive:
        member = archive.getmember("FMDFlashcard.app/Contents/MacOS/fmd-flashcard-desktop")
        assert stat.S_IMODE(member.mode) == 0o755
        assert member.uid == member.gid == 0
        helper_member = archive.getmember("FMDFlashcard.app/Contents/MacOS/fmd-helper")
        assert stat.S_IMODE(helper_member.mode) == 0o755
        plist = archive.getmember("FMDFlashcard.app/Contents/Info.plist")
        assert stat.S_IMODE(plist.mode) == 0o644


def test_deterministic_archivers_reject_symlink_escape(tmp_path: Path) -> None:
    source = tmp_path / "source"
    outside = tmp_path / "outside.txt"
    source.mkdir()
    outside.write_text("private", encoding="utf-8")
    (source / "linked.txt").symlink_to(outside)

    with pytest.raises(ArtifactError, match="symlink"):
        create_deterministic_zip(source, tmp_path / "unsafe.zip")
    with pytest.raises((ArtifactError, PathSafetyError)):
        _write_deterministic_tar(source, tmp_path / "unsafe.tar.gz")


def _write_zip(path: Path, member: str) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr(member, b"data")


@pytest.mark.parametrize(
    "member",
    [
        "../escape.txt",
        "/absolute.txt",
        "apps/UserGlobal/profile.json",
        ".reports/test-results.xml",
        ".tooling-state/runtime/process.json",
    ],
)
def test_zip_verification_rejects_unsafe_or_runtime_members(
    tmp_path: Path,
    member: str,
) -> None:
    archive = tmp_path / "unsafe.zip"
    _write_zip(archive, member)

    with pytest.raises(ArtifactError):
        verify_zip(archive)


def test_tar_verification_rejects_runtime_members(tmp_path: Path) -> None:
    archive = tmp_path / "unsafe.tar.gz"
    payload = tmp_path / "payload.json"
    payload.write_text("{}", encoding="utf-8")
    with tarfile.open(archive, "w:gz") as output:
        output.add(
            payload,
            arcname=("FMDFlashcard.app/Contents/Resources/apps/UserGlobal/profile.json"),
        )

    with pytest.raises(ArtifactError, match="runtime|forbidden"):
        verify_tar(archive)


def test_checksum_verification_rejects_tampering_and_traversal(tmp_path: Path) -> None:
    artifact = tmp_path / "artifact.bin"
    artifact.write_bytes(b"trusted")
    sums = tmp_path / "SHA256SUMS"
    sums.write_text(f"{sha256_file(artifact)}  artifact.bin\n", encoding="utf-8")
    verify_checksums(tmp_path, sums)

    artifact.write_bytes(b"tampered")
    with pytest.raises(ArtifactError, match="checksum verification failed"):
        verify_checksums(tmp_path, sums)

    outside = tmp_path.parent / "outside.bin"
    outside.write_bytes(b"outside")
    sums.write_text(f"{sha256_file(outside)}  ../outside.bin\n", encoding="utf-8")
    with pytest.raises((ArtifactError, PathSafetyError)):
        verify_checksums(tmp_path, sums)


def _release_project(tmp_path: Path) -> ProjectPaths:
    root = tmp_path / "checkout"
    matrix_path = root / "tools" / "release-matrix.json"
    matrix_path.parent.mkdir(parents=True)
    matrix_path.write_bytes((ROOT / "tools" / "release-matrix.json").read_bytes())
    (root / "VERSION").write_text("0.2.0\n", encoding="utf-8")
    return project_paths(root)


def _local_portable_build(tmp_path: Path) -> tuple[ProjectPaths, Path, Path]:
    paths = _release_project(tmp_path)
    build_root = paths.dist / "desktop" / "windows-x86_64" / "windows-portable"
    build_root.mkdir(parents=True)
    executable = tmp_path / "fmd-flashcard-desktop.exe"
    executable.write_bytes(b"MZ\x00portable executable")
    artifact = build_root / "FMDFlashcard-v0.2.0-windows-x86_64-portable.zip"
    create_deterministic_zip(executable, artifact)
    manifest = build_root / "build-manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "application_version": "0.2.0",
                "cli_target": "windows-portable",
                "entries": [
                    _native_entry(
                        filename=artifact.name,
                        package_type="portable-zip",
                        target_os="windows",
                        rust_target="x86_64-pc-windows-msvc",
                        architecture="x86_64",
                        content=artifact.read_bytes(),
                    )
                ],
                "matrix_id": "windows-x86_64",
                "package_types": ["portable-zip"],
                "schema_version": 1,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    checksums = build_root / "SHA256SUMS"
    checksums.write_text(
        "".join(
            f"{sha256_file(path)}  {path.name}\n"
            for path in sorted((artifact, manifest), key=lambda path: path.name)
        ),
        encoding="utf-8",
    )
    return paths, build_root, artifact


def _collected_windows_directory(tmp_path: Path) -> tuple[ProjectPaths, Path, Path]:
    paths = _release_project(tmp_path)
    target = load_release_matrix(paths).target("windows-x86_64")
    output = paths.dist / "release-input" / target.target_id
    output.mkdir(parents=True)
    executable = paths.root / "fmd-flashcard-desktop.exe"
    executable.write_bytes(b"MZ\x00portable executable")
    entries: list[dict[str, Any]] = []
    for spec in target.artifacts:
        artifact = output / spec.public_name("0.2.0")
        if spec.package_type == "msi":
            artifact.write_bytes(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1installer")
        elif spec.package_type == "nsis":
            artifact.write_bytes(b"MZ\x00installer")
        else:
            create_deterministic_zip(executable, artifact)
        evidence = artifacts.verify_artifact(artifact, spec, "0.2.0")
        entries.append(
            {
                "filename": artifact.name,
                "file_size": evidence["size"],
                "package_type": spec.package_type,
                "sha256": evidence["sha256"],
            }
        )
    fragment = output / "manifest-fragment.json"
    fragment.write_text(
        json.dumps(
            {
                "application_version": "0.2.0",
                "entries": sorted(entries, key=lambda entry: entry["filename"]),
                "matrix_id": target.target_id,
                "schema_version": 1,
            },
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    return paths, output, fragment


def test_local_desktop_tree_is_reverified_before_copy(tmp_path: Path) -> None:
    paths, build_root, artifact = _local_portable_build(tmp_path)

    verified = verify_local_desktop_root(paths.dist / "desktop", paths=paths)

    assert set(verified) == set(build_root.iterdir())
    artifact.write_bytes(b"PK tampered")
    with pytest.raises(ArtifactError):
        verify_local_desktop_root(paths.dist / "desktop", paths=paths)


def test_tauri_copy_dry_run_rejects_a_missing_source_without_writing(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    paths = _release_project(tmp_path)
    monkeypatch.setattr(tauri, "project_paths", lambda: paths)
    args = argparse.Namespace(target_dir=None, allow_outside_repo=False, dry_run=True)

    assert tauri._copy(args) == 1
    assert "missing or unsafe" in capsys.readouterr().err
    assert not paths.dist.exists()


def test_tauri_copy_dry_run_verifies_source_without_creating_target(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths, _, _ = _local_portable_build(tmp_path)
    target = paths.dist / "export"
    monkeypatch.setattr(tauri, "project_paths", lambda: paths)
    args = argparse.Namespace(target_dir=None, allow_outside_repo=False, dry_run=True)

    assert tauri._copy(args) == 0
    assert not target.exists()


def test_tauri_verify_routes_experimental_cross_build_directory(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths = _release_project(tmp_path)
    marker = paths.state / "build-markers" / "windows-cross-linux.started"
    marker.parent.mkdir(parents=True)
    marker.write_text("build-started\n", encoding="utf-8")
    executable = (
        paths.tauri / "target" / "x86_64-pc-windows-msvc" / "release" / "fmd-flashcard-desktop.exe"
    )
    executable.parent.mkdir(parents=True)
    executable.write_bytes(b"MZ\x00experimental cross-build")
    os.utime(marker, ns=(1_000_000_000, 1_000_000_000))
    os.utime(executable, ns=(2_000_000_000, 2_000_000_000))
    monkeypatch.setattr(artifacts, "_git_value", lambda *_args: "a" * 40)
    monkeypatch.setattr(artifacts, "_runner_os_name", lambda: "Linux")
    monkeypatch.setattr(
        artifacts,
        "_toolchains",
        lambda: {
            "cargo": "cargo 1.89.0",
            "node": "v22.12.0",
            "pnpm": "10.17.1",
            "python": "3.12.11",
            "rustc": "rustc 1.89.0",
        },
    )
    manifest = artifacts.collect_experimental_windows_cross_artifact(
        rust_target="x86_64-pc-windows-msvc",
        built_after=marker,
        paths=paths,
    )
    monkeypatch.setattr(tauri, "project_paths", lambda: paths)
    args = argparse.Namespace(
        matrix_id=artifacts.EXPERIMENTAL_CROSS_MATRIX_ID,
        directory=str(manifest.parent),
        target=artifacts.EXPERIMENTAL_CROSS_CLI_TARGET,
        bundles=None,
    )

    assert tauri._verify(args) == 0
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    assert payload["package_types"] == [artifacts.EXPERIMENTAL_CROSS_PACKAGE_TYPE]
    assert {
        path.name for path in verify_local_desktop_root(paths.dist / "desktop", paths=paths)
    } == {
        "FMDFlashcard-v0.2.0-windows-x86_64-cross-experimental.exe",
        "SHA256SUMS",
        "build-manifest.json",
    }


def test_collected_target_directory_rejects_unexpected_subdirectories(tmp_path: Path) -> None:
    paths, directory, _ = _collected_windows_directory(tmp_path)
    artifacts.verify_collected_target_directory("windows-x86_64", directory, paths=paths)
    (directory / "unexpected").mkdir()

    with pytest.raises(ArtifactError, match="regular non-symlink"):
        artifacts.verify_collected_target_directory("windows-x86_64", directory, paths=paths)


def test_collected_target_directory_rejects_symlinked_manifest_fragment(
    tmp_path: Path,
) -> None:
    paths, directory, fragment = _collected_windows_directory(tmp_path)
    linked_fragment = paths.root / "linked-manifest-fragment.json"
    linked_fragment.write_bytes(fragment.read_bytes())
    fragment.unlink()
    fragment.symlink_to(linked_fragment)

    with pytest.raises(ArtifactError, match="manifest fragment cannot be a symlink"):
        artifacts.verify_collected_target_directory("windows-x86_64", directory, paths=paths)


def test_local_desktop_tree_rejects_manifest_path_mismatch(tmp_path: Path) -> None:
    paths, build_root, _ = _local_portable_build(tmp_path)
    manifest = build_root / "build-manifest.json"
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    payload["cli_target"] = "windows"
    manifest.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ArtifactError, match="path does not match"):
        verify_local_desktop_root(paths.dist / "desktop", paths=paths)


def test_local_desktop_tree_rejects_forged_provenance(tmp_path: Path) -> None:
    paths, build_root, _ = _local_portable_build(tmp_path)
    manifest = build_root / "build-manifest.json"
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    payload["entries"][0]["runner_os"] = "Linux"
    manifest.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ArtifactError, match="target evidence"):
        verify_local_desktop_root(paths.dist / "desktop", paths=paths)


def test_partial_local_build_collects_only_the_requested_bundle(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    paths = _release_project(tmp_path)
    marker = paths.root / "build.started"
    marker.write_text("started\n", encoding="utf-8")
    source = paths.root / "source.deb"
    source.write_bytes(b"source")
    monkeypatch.setattr(artifacts, "_discover_source", lambda *_args, **_kwargs: source)

    def copy_artifact(_source: Path, destination: Path, _spec: ArtifactSpec) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"verified-deb")

    monkeypatch.setattr(artifacts, "_copy_or_archive", copy_artifact)
    monkeypatch.setattr(
        artifacts,
        "verify_artifact",
        lambda path, _spec, _version: {
            "size": path.stat().st_size,
            "sha256": sha256_file(path),
        },
    )

    manifest = collect_local_build_artifacts(
        "linux",
        rust_target="x86_64-unknown-linux-gnu",
        built_after=marker,
        package_types={"deb"},
        paths=paths,
    )
    payload = json.loads(manifest.read_text(encoding="utf-8"))

    assert payload["package_types"] == ["deb"]
    assert [entry["package_type"] for entry in payload["entries"]] == ["deb"]
    assert {path.name for path in manifest.parent.iterdir()} == {
        "FMDFlashcard-v0.2.0-linux-x86_64.deb",
        "build-manifest.json",
        "SHA256SUMS",
    }


def _native_entry(
    *,
    filename: str,
    package_type: str,
    target_os: str,
    rust_target: str,
    architecture: str,
    content: bytes,
) -> dict[str, Any]:
    return {
        "architecture": architecture,
        "commit_sha": "a" * 40,
        "file_size": len(content),
        "filename": filename,
        "git_tag": "v0.2.0",
        "notarization": "not-notarized" if target_os == "macos" else "not-applicable",
        "package_type": package_type,
        "runner_os": {"linux": "Linux", "windows": "Windows", "macos": "macOS"}[target_os],
        "rust_target": rust_target,
        "sha256": artifacts.hashlib.sha256(content).hexdigest(),
        "signature": "unsigned",
        "source_repository": "https://github.com/kleiveist/FMDFlashcard",
        "toolchains": {
            "cargo": "cargo 1.89.0",
            "node": "v22.12.0",
            "pnpm": "10.17.1",
            "python": "3.12.11",
            "rustc": "rustc 1.89.0",
        },
    }


def _assembly_input(tmp_path: Path) -> tuple[ProjectPaths, Path]:
    paths = _release_project(tmp_path)
    matrix = load_release_matrix(paths)
    input_dir = paths.root / ".dist" / "release-input"
    for target in matrix.targets:
        fragment_dir = input_dir / target.target_id
        fragment_dir.mkdir(parents=True)
        entries: list[dict[str, Any]] = []
        for spec in target.artifacts:
            filename = spec.public_name("0.2.0")
            content = f"verified:{target.target_id}:{spec.package_type}\n".encode()
            (fragment_dir / filename).write_bytes(content)
            entries.append(
                _native_entry(
                    filename=filename,
                    package_type=spec.package_type,
                    target_os=target.os,
                    rust_target=target.rust_target,
                    architecture=target.architecture,
                    content=content,
                )
            )
        (fragment_dir / "manifest-fragment.json").write_text(
            json.dumps(
                {
                    "application_version": "0.2.0",
                    "entries": entries,
                    "matrix_id": target.target_id,
                    "schema_version": 1,
                }
            ),
            encoding="utf-8",
        )
    documentation = input_dir / "documentation"
    documentation.mkdir(parents=True)
    (documentation / "FMDFlashcard-v0.2.0-documentation.pdf").write_bytes(b"%PDF-1.4\n%%EOF\n")
    sbom = input_dir / "sbom"
    sbom.mkdir()
    (sbom / "SBOM.spdx.json").write_text(
        json.dumps({"spdxVersion": "SPDX-2.3", "packages": []}),
        encoding="utf-8",
    )
    return paths, input_dir


def _stable_assembly_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SOURCE_DATE_EPOCH", "1700000000")
    monkeypatch.setenv("GITHUB_SHA", "a" * 40)
    monkeypatch.setenv("FMD_SIGNING_POLICY", "optional")
    monkeypatch.setattr(
        artifacts,
        "_toolchains",
        lambda: {
            "cargo": "cargo 1.89.0",
            "node": "v22.12.0",
            "pnpm": "10.17.1",
            "python": "3.12.11",
            "rustc": "rustc 1.89.0",
        },
    )


def test_release_assembly_is_complete_sorted_and_self_verifying(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    output = paths.root / ".dist" / "release-output"

    manifest_path, checksums_path = assemble_release(
        input_dir=input_dir,
        output_dir=output,
        tag="v0.2.0",
        paths=paths,
    )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest["entries"]
    assert manifest["git_tag"] == "v0.2.0"
    assert manifest["build_timestamp_utc"] == "2023-11-14T22:13:20Z"
    assert [entry["filename"] for entry in entries] == sorted(
        entry["filename"] for entry in entries
    )
    assert len(entries) == 12
    assert all(REQUIRED_EVIDENCE_FIELDS <= set(entry) for entry in entries)

    expected = set(load_release_matrix(paths).expected_filenames("0.2.0")) | {
        "FMDFlashcard-v0.2.0-documentation.pdf",
        "SBOM.spdx.json",
        "release-manifest.json",
        "SHA256SUMS",
    }
    assert {path.name for path in output.iterdir()} == expected
    checksum_names = [
        line.split("  ", 1)[1] for line in checksums_path.read_text(encoding="utf-8").splitlines()
    ]
    assert checksum_names == sorted(expected - {"SHA256SUMS"})
    verify_manifest_directory(output, paths)


def test_assembly_rejects_fragment_without_complete_evidence(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    fragment = input_dir / "linux-x86_64" / "manifest-fragment.json"
    payload = json.loads(fragment.read_text(encoding="utf-8"))
    del payload["entries"][0]["runner_os"]
    fragment.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ArtifactError, match="manifest.*(?:field|evidence|runner OS)"):
        assemble_release(
            input_dir=input_dir,
            output_dir=paths.root / ".dist" / "output",
            tag="v0.2.0",
            paths=paths,
        )


def test_assembly_requires_exact_declared_matrix_ids(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    fragment = input_dir / "linux-x86_64" / "manifest-fragment.json"
    payload = json.loads(fragment.read_text(encoding="utf-8"))
    payload["matrix_id"] = "experimental-unknown"
    fragment.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ArtifactError, match="matrix"):
        assemble_release(
            input_dir=input_dir,
            output_dir=paths.root / ".dist" / "output",
            tag="v0.2.0",
            paths=paths,
        )


def test_assembly_rejects_mixed_commit_fragments(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    fragment = input_dir / "linux-x86_64" / "manifest-fragment.json"
    payload = json.loads(fragment.read_text(encoding="utf-8"))
    payload["entries"][0]["commit_sha"] = "b" * 40
    fragment.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(ArtifactError, match="commit SHA is stale or mixed"):
        assemble_release(
            input_dir=input_dir,
            output_dir=paths.root / ".dist" / "output",
            tag="v0.2.0",
            paths=paths,
        )


def test_required_signing_policy_requires_signing_and_notarization(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    monkeypatch.setenv("FMD_SIGNING_POLICY", "required")
    paths, input_dir = _assembly_input(tmp_path)

    with pytest.raises(ArtifactError, match="signing is required"):
        assemble_release(
            input_dir=input_dir,
            output_dir=paths.root / ".dist" / "output",
            tag="v0.2.0",
            paths=paths,
        )


def test_manifest_verification_requires_every_file_in_checksums(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    output = paths.root / ".dist" / "release-output"
    _, checksums = assemble_release(
        input_dir=input_dir,
        output_dir=output,
        tag="v0.2.0",
        paths=paths,
    )
    lines = checksums.read_text(encoding="utf-8").splitlines()
    checksums.write_text("\n".join(lines[1:]) + "\n", encoding="utf-8")

    with pytest.raises(ArtifactError, match="checksum.*missing|inventory"):
        verify_manifest_directory(output, paths)


def test_manifest_verification_rejects_unexpected_release_files(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    output = paths.root / ".dist" / "release-output"
    assemble_release(
        input_dir=input_dir,
        output_dir=output,
        tag="v0.2.0",
        paths=paths,
    )
    (output / "unexpected-private.json").write_text("{}", encoding="utf-8")

    with pytest.raises(ArtifactError, match="unexpected|inventory"):
        verify_manifest_directory(output, paths)


def test_manifest_verification_requires_matching_release_tag(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _stable_assembly_environment(monkeypatch)
    paths, input_dir = _assembly_input(tmp_path)
    output = paths.root / ".dist" / "release-output"
    manifest_path, checksums_path = assemble_release(
        input_dir=input_dir,
        output_dir=output,
        tag="v0.2.0",
        paths=paths,
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["git_tag"] = "v9.9.9"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    lines = checksums_path.read_text(encoding="utf-8").splitlines()
    updated = [
        f"{sha256_file(manifest_path)}  release-manifest.json"
        if line.endswith("  release-manifest.json")
        else line
        for line in lines
    ]
    checksums_path.write_text("\n".join(updated) + "\n", encoding="utf-8")

    with pytest.raises(ArtifactError, match="tag"):
        verify_manifest_directory(output, paths)
