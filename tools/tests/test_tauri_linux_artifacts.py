from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from tools import control
from tools.tauri import common, paths
from tools.tauri import control as tauri_control
from tools.tauri.build import artifacts, linux


def _bundle_root(root: Path) -> Path:
    return root / "src-tauri" / "target" / "release" / "bundle"


def _write_bundle(root: Path, bundle_type: str, name: str, content: bytes) -> Path:
    target = _bundle_root(root) / bundle_type / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return target


@pytest.fixture(autouse=True)
def _use_supported_x86_64_host(monkeypatch) -> None:
    monkeypatch.setattr(artifacts.platform, "machine", lambda: "x86_64")


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("deb", ("deb",)),
        ("rpm", ("rpm",)),
        ("appimage", ("appimage",)),
        ("deb,rpm,appimage", ("deb", "rpm", "appimage")),
        (" DEB, rpm, AppImage ", ("deb", "rpm", "appimage")),
        ("appimage,deb,deb", ("deb", "appimage")),
    ],
)
def test_linux_bundle_input_is_normalized(raw: str, expected: tuple[str, ...]) -> None:
    assert artifacts.normalize_linux_bundles(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "deb,", "deb,,rpm", "deb,flatpak", "all", "deb;echo injected"])
def test_linux_bundle_input_rejects_empty_unknown_and_shell_values(raw: str) -> None:
    with pytest.raises(artifacts.LinuxBundleError):
        artifacts.normalize_linux_bundles(raw)


def test_invalid_linux_bundle_input_fails_before_dependency_or_process_checks(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        common,
        "frontend_dependencies_ready",
        lambda: (_ for _ in ()).throw(AssertionError("dependency check must not run")),
    )
    monkeypatch.setattr(
        common,
        "run_command",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("process must not run")),
    )

    code = linux.main(argparse.Namespace(dry_run=False, bundles="deb;touch /tmp/not-allowed"))

    assert code == 1


def test_linux_bundle_verification_accepts_three_nonempty_files(tmp_path: Path) -> None:
    deb = _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"deb")
    rpm = _write_bundle(tmp_path, "rpm", "template-1.0.0-1.x86_64.rpm", b"rpm")
    appimage = _write_bundle(tmp_path, "appimage", "Template_1.0.0_amd64.AppImage", b"appimage")

    result = artifacts.verify_linux_bundles(
        ("deb", "rpm", "appimage"),
        _bundle_root(tmp_path),
        repository_root=tmp_path,
    )

    assert result.ok
    assert [item.path for item in result.artifacts] == [deb, rpm, appimage]
    assert [item.bundle_type for item in result.artifacts] == ["deb", "rpm", "appimage"]


@pytest.mark.parametrize(
    ("missing_type", "message"),
    [
        ("deb", "Requested Linux bundle 'deb' was not produced."),
        ("rpm", "Requested Linux bundle 'rpm' was not produced."),
        ("appimage", "Requested Linux bundle 'appimage' was not produced."),
    ],
)
def test_missing_requested_linux_bundle_fails(tmp_path: Path, missing_type: str, message: str) -> None:
    names = {
        "deb": "template_1.0.0_amd64.deb",
        "rpm": "template-1.0.0-1.x86_64.rpm",
        "appimage": "Template_1.0.0_amd64.AppImage",
    }
    for bundle_type, name in names.items():
        if bundle_type != missing_type:
            _write_bundle(tmp_path, bundle_type, name, bundle_type.encode())

    result = artifacts.verify_linux_bundles(
        ("deb", "rpm", "appimage"),
        _bundle_root(tmp_path),
        repository_root=tmp_path,
    )

    assert not result.ok
    assert message in result.errors


def test_empty_linux_bundle_fails(tmp_path: Path) -> None:
    _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"")

    result = artifacts.verify_linux_bundles(("deb",), _bundle_root(tmp_path), repository_root=tmp_path)

    assert not result.ok
    assert any("is empty" in error for error in result.errors)


def test_linux_bundle_symlink_outside_allowed_root_fails(tmp_path: Path) -> None:
    outside = tmp_path / "outside.deb"
    outside.write_bytes(b"outside")
    link = _bundle_root(tmp_path) / "deb" / "linked.deb"
    link.parent.mkdir(parents=True)
    try:
        link.symlink_to(outside)
    except OSError as exc:
        pytest.skip(f"symlink fixture unavailable: {exc}")

    result = artifacts.verify_linux_bundles(("deb",), _bundle_root(tmp_path), repository_root=tmp_path)

    assert not result.ok
    assert any("not a regular file" in error for error in result.errors)


def test_manifest_and_checksums_are_relative_hashed_and_deterministic(
    tmp_path: Path,
) -> None:
    source = _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"deterministic-deb")
    evidence_root = tmp_path / ".dist" / "desktop" / "linux"
    result = artifacts.verify_linux_bundles(("deb",), _bundle_root(tmp_path), repository_root=tmp_path)

    first = artifacts.write_linux_bundle_evidence(
        result,
        evidence_root=evidence_root,
        repository_root=tmp_path,
    )
    first_manifest = first.manifest.read_bytes()
    first_checksums = first.checksums.read_bytes()
    second = artifacts.write_linux_bundle_evidence(
        result,
        evidence_root=evidence_root,
        repository_root=tmp_path,
    )

    assert second.manifest.read_bytes() == first_manifest
    assert second.checksums.read_bytes() == first_checksums
    payload = json.loads(first_manifest)
    entry = payload["bundles"][0]
    expected_path = "src-tauri/target/release/bundle/deb/template_1.0.0_amd64.deb"
    assert payload == {
        "schema_version": 1,
        "platform": "linux",
        "architecture": "x86_64",
        "signed": False,
        "bundles": [
            {
                "type": "deb",
                "path": expected_path,
                "size": len(b"deterministic-deb"),
                "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            }
        ],
    }
    assert str(tmp_path) not in first_manifest.decode()
    assert first_checksums.decode() == f"{entry['sha256']}  {expected_path}\n"


def test_verify_artifacts_cli_writes_manifest_checksums_and_summary(monkeypatch, tmp_path: Path) -> None:
    tauri_dir = tmp_path / "src-tauri"
    dist_dir = tmp_path / ".dist" / "desktop"
    summary_file = tmp_path / "summary.md"
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri_dir)
    monkeypatch.setattr(paths, "DIST_DIR", dist_dir)
    monkeypatch.setattr(
        tauri_control.profile_runtime,
        "active_profile",
        lambda _root: SimpleNamespace(profile_id="fixture", has_feature=lambda _feature: True),
    )
    _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"deb")

    code = control.main(
        [
            "tauri",
            "verify-artifacts",
            "--target",
            "linux",
            "--bundles",
            "deb",
            "--summary-file",
            str(summary_file),
        ]
    )

    assert code == 0
    assert (dist_dir / "linux" / artifacts.MANIFEST_NAME).is_file()
    assert (dist_dir / "linux" / artifacts.CHECKSUMS_NAME).is_file()
    assert "| DEB | x86_64 |" in summary_file.read_text(encoding="utf-8")


def test_linux_bundle_cleanup_removes_only_bundle_and_evidence_outputs(
    tmp_path: Path,
) -> None:
    for bundle_type, suffix in (
        ("deb", ".deb"),
        ("rpm", ".rpm"),
        ("appimage", ".AppImage"),
    ):
        _write_bundle(tmp_path, bundle_type, f"stale{suffix}", b"stale")
    cargo_cache = tmp_path / "src-tauri" / "target" / "release" / "deps" / "cached.rlib"
    cargo_cache.parent.mkdir(parents=True)
    cargo_cache.write_bytes(b"cache")
    evidence_root = tmp_path / ".dist" / "desktop" / "linux"
    evidence_root.mkdir(parents=True)
    (evidence_root / artifacts.MANIFEST_NAME).write_text("stale", encoding="utf-8")

    artifacts.prepare_linux_bundle_outputs(
        ("deb",),
        bundle_root=_bundle_root(tmp_path),
        evidence_root=evidence_root,
        repository_root=tmp_path,
    )

    assert all(not (_bundle_root(tmp_path) / bundle_type).exists() for bundle_type in artifacts.LINUX_BUNDLE_ORDER)
    assert not evidence_root.exists()
    assert cargo_cache.read_bytes() == b"cache"


def test_no_clean_preserves_bundle_outputs_but_removes_stale_evidence(
    tmp_path: Path,
) -> None:
    bundle = _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"prior")
    evidence_root = tmp_path / ".dist" / "desktop" / "linux"
    evidence_root.mkdir(parents=True)
    (evidence_root / artifacts.MANIFEST_NAME).write_text("stale", encoding="utf-8")

    artifacts.prepare_linux_bundle_outputs(
        ("deb",),
        bundle_root=_bundle_root(tmp_path),
        evidence_root=evidence_root,
        repository_root=tmp_path,
        clean_bundles=False,
    )

    assert bundle.read_bytes() == b"prior"
    assert not evidence_root.exists()


def test_linux_summary_lists_unsigned_x86_64_candidates(tmp_path: Path) -> None:
    _write_bundle(tmp_path, "appimage", "Template_1.0.0_amd64.AppImage", b"appimage")
    result = artifacts.verify_linux_bundles(("appimage",), _bundle_root(tmp_path), repository_root=tmp_path)

    summary = artifacts.render_linux_bundle_summary(result)

    assert "Unsigned Linux x86_64 verification candidates" in summary
    assert "| AppImage | x86_64 |" in summary
    assert "signed" not in summary.lower().replace("unsigned", "")
    assert "published" not in summary.lower()


def test_linux_bundle_verification_rejects_non_x86_64_host(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(artifacts.platform, "machine", lambda: "aarch64")

    with pytest.raises(artifacts.LinuxBundleError, match="x86_64 hosts only"):
        artifacts.verify_linux_bundles(("deb",), _bundle_root(tmp_path), repository_root=tmp_path)


def test_real_linux_build_cleans_and_verifies_requested_outputs(monkeypatch) -> None:
    calls: list[tuple[str, tuple[str, ...]]] = []
    result = artifacts.VerificationResult(requested=("deb",), artifacts=(), errors=())
    evidence = artifacts.EvidenceFiles(
        manifest=paths.DIST_DIR / "linux" / artifacts.MANIFEST_NAME,
        checksums=paths.DIST_DIR / "linux" / artifacts.CHECKSUMS_NAME,
    )
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)

    def fake_prepare(requested: tuple[str, ...], **kwargs) -> None:
        assert kwargs["repository_root"] == paths.ROOT
        assert kwargs["clean_bundles"] is True
        calls.append(("prepare", requested))

    def fake_verify(
        requested: tuple[str, ...],
        **kwargs,
    ) -> tuple[artifacts.VerificationResult, artifacts.EvidenceFiles]:
        assert kwargs["previous_snapshot"] is None
        calls.append(("verify", requested))
        return result, evidence

    monkeypatch.setattr(artifacts, "prepare_linux_bundle_outputs", fake_prepare)
    monkeypatch.setattr(artifacts, "verify_and_write_linux_bundles", fake_verify)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **_kwargs: common.CommandResult(command=command, cwd=paths.ROOT, returncode=0),
    )
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)

    code = linux.main(argparse.Namespace(dry_run=False, bundles=" DEB,deb ", skip_appimage_preflight=False))

    assert code == 0
    assert calls == [("prepare", ("deb",)), ("verify", ("deb",))]


def test_no_clean_snapshot_rejects_unchanged_and_accepts_refreshed_bundle(
    tmp_path: Path,
) -> None:
    bundle = _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"stale")
    snapshot = artifacts.snapshot_linux_bundle_outputs(("deb",), _bundle_root(tmp_path))

    unchanged = artifacts.verify_linux_bundles(
        ("deb",),
        _bundle_root(tmp_path),
        repository_root=tmp_path,
        previous_snapshot=snapshot,
    )
    bundle.write_bytes(b"fresh-bundle")
    refreshed = artifacts.verify_linux_bundles(
        ("deb",),
        _bundle_root(tmp_path),
        repository_root=tmp_path,
        previous_snapshot=snapshot,
    )

    assert not unchanged.ok
    assert any("was not refreshed by the current build" in error for error in unchanged.errors)
    assert refreshed.ok


def test_real_no_clean_build_keeps_outputs_and_passes_snapshot_to_verifier(
    monkeypatch,
) -> None:
    snapshot = {"deb/stale.deb": artifacts.ArtifactFingerprint(5, 1, 1, hashlib.sha256(b"stale").hexdigest())}
    calls: list[tuple[str, object]] = []
    result = artifacts.VerificationResult(requested=("deb",), artifacts=(), errors=())
    evidence = artifacts.EvidenceFiles(
        manifest=paths.DIST_DIR / "linux" / artifacts.MANIFEST_NAME,
        checksums=paths.DIST_DIR / "linux" / artifacts.CHECKSUMS_NAME,
    )
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(
        artifacts,
        "snapshot_linux_bundle_outputs",
        lambda requested, bundle_root: calls.append(("snapshot", requested)) or snapshot,
    )

    def fake_prepare(requested: tuple[str, ...], **kwargs) -> None:
        calls.append(("clean_bundles", kwargs["clean_bundles"]))

    def fake_verify(
        requested: tuple[str, ...],
        **kwargs,
    ) -> tuple[artifacts.VerificationResult, artifacts.EvidenceFiles]:
        calls.append(("previous_snapshot", kwargs["previous_snapshot"]))
        return result, evidence

    monkeypatch.setattr(artifacts, "prepare_linux_bundle_outputs", fake_prepare)
    monkeypatch.setattr(artifacts, "verify_and_write_linux_bundles", fake_verify)
    monkeypatch.setattr(
        common,
        "run_command",
        lambda command, **_kwargs: common.CommandResult(command=command, cwd=paths.ROOT, returncode=0),
    )
    monkeypatch.setattr(common, "print_build_artifacts", lambda: None)

    code = linux.main(argparse.Namespace(dry_run=False, no_clean=True, bundles="deb"))

    assert code == 0
    assert calls == [
        ("clean_bundles", False),
        ("snapshot", ("deb",)),
        ("previous_snapshot", snapshot),
    ]


def test_linux_bundle_cleanup_rejects_broad_or_external_roots(tmp_path: Path) -> None:
    with pytest.raises(artifacts.LinuxBundleError, match="unsafe Linux bundle cleanup root"):
        artifacts.prepare_linux_bundle_outputs(
            ("deb",),
            bundle_root=tmp_path,
            evidence_root=tmp_path / ".dist" / "desktop" / "linux",
            repository_root=tmp_path,
        )


def test_linux_bundle_cleanup_rejects_symlinked_bundle_root(tmp_path: Path) -> None:
    real_bundle_root = tmp_path / "safe" / "target" / "release" / "bundle"
    real_bundle_root.mkdir(parents=True)
    linked_bundle_root = _bundle_root(tmp_path)
    linked_bundle_root.parent.mkdir(parents=True)
    try:
        linked_bundle_root.symlink_to(real_bundle_root, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"symlink fixture unavailable: {exc}")

    with pytest.raises(artifacts.LinuxBundleError, match="symlinked component"):
        artifacts.prepare_linux_bundle_outputs(
            ("deb",),
            bundle_root=linked_bundle_root,
            evidence_root=tmp_path / ".dist" / "desktop" / "linux",
            repository_root=tmp_path,
        )


def test_linux_bundle_cleanup_rejects_symlinked_evidence_parent(tmp_path: Path) -> None:
    real_dist = tmp_path / "safe-dist"
    real_dist.mkdir()
    linked_dist = tmp_path / ".dist"
    try:
        linked_dist.symlink_to(real_dist, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"symlink fixture unavailable: {exc}")

    with pytest.raises(artifacts.LinuxBundleError, match="symlinked component"):
        artifacts.prepare_linux_bundle_outputs(
            ("deb",),
            bundle_root=_bundle_root(tmp_path),
            evidence_root=linked_dist / "desktop" / "linux",
            repository_root=tmp_path,
        )


def test_symlinked_bundle_type_directory_is_rejected(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "outside.deb").write_bytes(b"outside")
    bundle_root = _bundle_root(tmp_path)
    bundle_root.mkdir(parents=True)
    try:
        (bundle_root / "deb").symlink_to(outside, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"symlink fixture unavailable: {exc}")

    result = artifacts.verify_linux_bundles(("deb",), bundle_root, repository_root=tmp_path)

    assert not result.ok
    assert any("unsafe output directory" in error for error in result.errors)


def test_no_clean_prepare_rejects_symlinked_bundle_type_directory(
    tmp_path: Path,
) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    bundle_root = _bundle_root(tmp_path)
    bundle_root.mkdir(parents=True)
    try:
        (bundle_root / "deb").symlink_to(outside, target_is_directory=True)
    except OSError as exc:
        pytest.skip(f"symlink fixture unavailable: {exc}")

    with pytest.raises(artifacts.LinuxBundleError, match="symlinked Linux bundle directory"):
        artifacts.prepare_linux_bundle_outputs(
            ("deb",),
            bundle_root=bundle_root,
            evidence_root=tmp_path / ".dist" / "desktop" / "linux",
            repository_root=tmp_path,
            clean_bundles=False,
        )


def test_appimage_fallback_cannot_hide_a_missing_requested_rpm(monkeypatch, tmp_path: Path) -> None:
    tauri_dir = tmp_path / "src-tauri"
    dist_dir = tmp_path / ".dist" / "desktop"
    monkeypatch.setattr(paths, "ROOT", tmp_path)
    monkeypatch.setattr(paths, "TAURI_DIR", tauri_dir)
    monkeypatch.setattr(paths, "DIST_DIR", dist_dir)
    monkeypatch.setattr(common, "frontend_dependencies_ready", lambda: True)
    monkeypatch.setattr(linux.appimage, "_appimage_prerequisites_ready", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(linux.appimage, "_fresh_appimage_from_snapshot", lambda _snapshot: None)

    def failed_linuxdeploy(command: list[str], **_kwargs) -> common.CommandResult:
        _write_bundle(tmp_path, "deb", "template_1.0.0_amd64.deb", b"deb")
        return common.CommandResult(
            command=command,
            cwd=tmp_path,
            returncode=1,
            stderr="failed to run linuxdeploy",
        )

    def appimage_fallback(*, dry_run: bool = False) -> int:
        assert dry_run is False
        _write_bundle(tmp_path, "appimage", "Template_1.0.0_amd64.AppImage", b"appimage")
        return 0

    monkeypatch.setattr(common, "run_command", failed_linuxdeploy)
    monkeypatch.setattr(linux.appimage, "package_existing_appdir", appimage_fallback)

    code = linux.main(argparse.Namespace(dry_run=False, bundles="deb,rpm,appimage"))

    assert code == 1
    assert not (dist_dir / "linux" / artifacts.MANIFEST_NAME).exists()
