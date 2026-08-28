from __future__ import annotations

import io
import json
import subprocess
import tarfile
import urllib.error
import zipfile
from pathlib import Path
from typing import Any

import pytest

from tools.inst import release_publish, release_publish_bundle


def _git(root: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout.strip()


def _release_repository(tmp_path: Path) -> tuple[Path, str]:
    root = tmp_path / "repository"
    root.mkdir()
    _git(root, "init", "--initial-branch=main")
    _git(root, "config", "user.name", "Release Test")
    _git(root, "config", "user.email", "release@example.invalid")
    (root / "VERSION").write_text("1.0.2\n", encoding="utf-8")
    (root / "tracked.txt").write_text("release source\n", encoding="utf-8")
    notes = root / ".github" / "release-notes"
    notes.mkdir(parents=True)
    (notes / "v1.0.2.md").write_text(
        "# Test v1.0.2\n\nReviewed notes.\n", encoding="utf-8"
    )
    _git(root, "add", ".")
    _git(root, "commit", "-m", "prepare release")
    sha = _git(root, "rev-parse", "HEAD")
    _git(root, "tag", "-a", "v1.0.2", "-m", "Test v1.0.2", sha)
    return root, sha


def _identity(root: Path, sha: str) -> release_publish.ReleaseIdentity:
    return release_publish.validate_release_identity(
        root,
        release_publish.ReleaseRequest("example/template", "v1.0.2", sha, 600, 2),
    )


def _request(
    identity: release_publish.ReleaseIdentity,
) -> release_publish.ReleaseRequest:
    return release_publish.ReleaseRequest(
        identity.repository,
        identity.tag,
        identity.sha,
        identity.release_run_id,
        identity.release_run_attempt,
    )


def _bundle(output: Path) -> release_publish.PreparedBundle:
    return release_publish.PreparedBundle(output, output.parent / "RELEASE_NOTES.md")


def _run(
    name: str, run_id: int, sha: str, *, branch: str = "main"
) -> dict[str, object]:
    paths = {
        **release_publish.REQUIRED_WORKFLOW_PATHS,
        release_publish.RELEASE_WORKFLOW: release_publish.RELEASE_WORKFLOW_PATH,
    }
    return {
        "name": name,
        "path": paths[name],
        "id": run_id,
        "run_attempt": 2,
        "event": "push",
        "status": "completed",
        "conclusion": "success",
        "head_sha": sha,
        "head_branch": branch,
        "html_url": f"https://github.com/example/template/actions/runs/{run_id}",
    }


def _workflow_evidence(sha: str) -> tuple[release_publish.WorkflowEvidence, ...]:
    names = (*release_publish.REQUIRED_WORKFLOWS, release_publish.RELEASE_WORKFLOW)
    return tuple(
        release_publish.WorkflowEvidence(
            workflow=name,
            run_id=100 + index,
            run_attempt=2,
            event="push",
            status="completed",
            conclusion="success",
            head_branch="v1.0.2"
            if name == release_publish.RELEASE_WORKFLOW
            else "main",
            head_sha=sha,
            url=f"https://github.com/example/template/actions/runs/{100 + index}/attempts/2",
        )
        for index, name in enumerate(names)
    )


def _artifact_inputs(root: Path, sha: str) -> Path:
    inputs = root / "inputs"
    web = inputs / "web-release-candidate"
    web.mkdir(parents=True)
    (web / "web-build.zip").write_bytes(b"web candidate")
    (web / f"template-tooling-{sha}.spdx.json").write_text(
        json.dumps(
            {
                "spdxVersion": "SPDX-2.3",
                "SPDXID": "SPDXRef-DOCUMENT",
                "dataLicense": "CC0-1.0",
                "creationInfo": {"creators": ["Tool: test"]},
                "packages": [],
            }
        )
        + "\n",
        encoding="utf-8",
    )
    for platform, archive_name in release_publish_bundle.DESKTOP_PREARCHIVES.items():
        platform_root = inputs / f"desktop-{platform}-unsigned"
        platform_root.mkdir(parents=True)
        archive_path = platform_root / archive_name
        member_name = f"nested/candidate-{platform}.bin"
        if platform == "windows":
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr(member_name, platform.encode())
        else:
            payload = platform.encode()
            member = tarfile.TarInfo(member_name)
            member.mode = 0o755
            member.size = len(payload)
            with tarfile.open(archive_path, "w:gz") as archive:
                archive.addfile(member, io.BytesIO(payload))
    return inputs


def _github_release_payload(
    output: Path,
    notes: Path,
    identity: release_publish.ReleaseIdentity,
    draft: bool,
    immutable: bool,
) -> dict[str, Any]:
    return {
        "tag_name": identity.tag,
        "name": f"Template-Tooling {identity.tag}",
        "draft": draft,
        "prerelease": False,
        "immutable": immutable,
        "body": notes.read_text(encoding="utf-8"),
        "assets": [
            {
                "name": path.name,
                "state": "uploaded",
                "size": path.stat().st_size,
                "digest": f"sha256:{release_publish_bundle.sha256(path)}",
            }
            for path in sorted(output.iterdir())
        ],
    }


def _mock_action_runs(
    monkeypatch: pytest.MonkeyPatch,
    runs: list[dict[str, object]],
) -> None:
    release_run = next(
        item for item in runs if item["name"] == release_publish.RELEASE_WORKFLOW
    )

    def response(url: str, _token: str) -> object:
        if f"/actions/runs/{release_run['id']}" in url:
            return release_run
        for workflow, path in release_publish.REQUIRED_WORKFLOW_PATHS.items():
            if f"/actions/workflows/{Path(path).name}/runs" in url:
                matches = [item for item in runs if item["name"] == workflow]
                return {"total_count": len(matches), "workflow_runs": matches}
        raise AssertionError(f"unexpected API URL: {url}")

    monkeypatch.setattr(release_publish, "_request_json", response)


def test_release_identity_requires_annotated_exact_version_tag(tmp_path: Path) -> None:
    root, sha = _release_repository(tmp_path)

    identity = _identity(root, sha)

    assert identity.version == "1.0.2"
    with pytest.raises(
        release_publish.ReleasePublishError, match="does not match VERSION"
    ):
        release_publish.validate_release_identity(
            root,
            release_publish.ReleaseRequest("example/template", "v1.0.3", sha, 600, 2),
        )


def test_collect_workflow_evidence_requires_every_success_on_exact_sha(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    runs = [
        _run(name, index, sha)
        for index, name in enumerate(release_publish.REQUIRED_WORKFLOWS, 1)
    ]
    runs.append(_run(release_publish.RELEASE_WORKFLOW, 600, sha, branch="v1.0.2"))
    _mock_action_runs(monkeypatch, runs)

    evidence = release_publish.collect_workflow_evidence(identity, token="test-token")

    assert [item.workflow for item in evidence] == [
        *release_publish.REQUIRED_WORKFLOWS,
        release_publish.RELEASE_WORKFLOW,
    ]
    runs[0]["conclusion"] = "failure"
    with pytest.raises(release_publish.ReleasePublishError, match="Core CI"):
        release_publish.collect_workflow_evidence(identity, token="test-token")


def test_collect_workflow_evidence_rejects_same_name_from_wrong_workflow_path(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    runs = [
        _run(name, index, sha)
        for index, name in enumerate(release_publish.REQUIRED_WORKFLOWS, 1)
    ]
    runs.append(_run(release_publish.RELEASE_WORKFLOW, 600, sha, branch="v1.0.2"))
    runs[0]["path"] = ".github/workflows/lookalike.yml"
    _mock_action_runs(monkeypatch, runs)

    with pytest.raises(release_publish.ReleasePublishError, match="Core CI"):
        release_publish.collect_workflow_evidence(identity, token="test-token")


def test_collect_workflow_evidence_rejects_cross_repository_run_url(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    runs = [
        _run(name, index, sha)
        for index, name in enumerate(release_publish.REQUIRED_WORKFLOWS, 1)
    ]
    runs.append(_run(release_publish.RELEASE_WORKFLOW, 600, sha, branch="v1.0.2"))
    runs[0]["html_url"] = "https://github.com/attacker/lookalike/actions/runs/1"
    _mock_action_runs(monkeypatch, runs)

    with pytest.raises(
        release_publish.ReleasePublishError, match="exact repository run"
    ):
        release_publish.collect_workflow_evidence(identity, token="test-token")


def test_immutable_release_setting_is_required_and_fail_closed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        release_publish, "_request_json", lambda _url, _token: {"enabled": True}
    )
    release_publish.ensure_immutable_releases_enabled(
        "example/template", token="admin-read-token"
    )

    monkeypatch.setattr(
        release_publish, "_request_json", lambda _url, _token: {"enabled": False}
    )
    with pytest.raises(release_publish.ReleasePublishError, match="does not report"):
        release_publish.ensure_immutable_releases_enabled(
            "example/template", token="admin-read-token"
        )

    forbidden = urllib.error.HTTPError(
        "https://api.example.invalid", 403, "Forbidden", {}, None
    )
    monkeypatch.setattr(
        release_publish,
        "_request_json",
        lambda _url, _token: (_ for _ in ()).throw(forbidden),
    )
    with pytest.raises(release_publish.ReleasePublishError, match="HTTP 403"):
        release_publish.ensure_immutable_releases_enabled(
            "example/template", token="admin-read-token"
        )


def test_release_tag_ruleset_must_block_updates_and_deletions_without_bypass(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    ruleset = {
        "target": "tag",
        "enforcement": "active",
        "bypass_actors": [],
        "conditions": {"ref_name": {"include": ["refs/tags/v*"], "exclude": []}},
        "rules": [{"type": "update"}, {"type": "deletion"}],
    }

    def response(url: str, _token: str) -> object:
        return [{"id": 42}] if "/rulesets?" in url else ruleset

    monkeypatch.setattr(release_publish, "_request_json", response)
    release_publish.ensure_release_tag_ruleset(identity, token="governance-token")
    ruleset["bypass_actors"] = [{"actor_type": "RepositoryRole"}]
    with pytest.raises(release_publish.ReleasePublishError, match="non-bypassable"):
        release_publish.ensure_release_tag_ruleset(identity, token="governance-token")

    forbidden = urllib.error.HTTPError(
        "https://api.example.invalid", 403, "Forbidden", {}, None
    )
    monkeypatch.setattr(
        release_publish,
        "_request_json",
        lambda _url, _token: (_ for _ in ()).throw(forbidden),
    )
    with pytest.raises(release_publish.ReleasePublishError, match="HTTP 403"):
        release_publish.ensure_release_tag_ruleset(identity, token="governance-token")


def test_build_release_bundle_packages_all_evidence_and_checksums(
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    inputs = _artifact_inputs(tmp_path, sha)
    output = tmp_path / "release-assets"
    (root / "untracked-secret.txt").write_text(
        "must not enter source archive\n", encoding="utf-8"
    )

    paths = release_publish_bundle.build_release_bundle(
        root, inputs, output, identity, _workflow_evidence(sha)
    )

    names = {path.name for path in paths}
    assert names == {
        "Template-Tooling-v1.0.2-source.zip",
        "Template-Tooling-v1.0.2-web.zip",
        "Template-Tooling-v1.0.2.spdx.json",
        "Template-Tooling-v1.0.2-linux-unsigned.tar.gz",
        "Template-Tooling-v1.0.2-macos-unsigned.tar.gz",
        "Template-Tooling-v1.0.2-windows-unsigned.zip",
        "Template-Tooling-v1.0.2-release-evidence.json",
        "SHA256SUMS.txt",
        "RELEASE_NOTES.md",
    }
    checksums = (output / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines()
    assert len(checksums) == 7
    assert all(len(line.split(maxsplit=1)[0]) == 64 for line in checksums)

    evidence = json.loads(
        (output / "Template-Tooling-v1.0.2-release-evidence.json").read_text()
    )
    assert evidence["release"]["sha"] == sha
    assert [item["workflow"] for item in evidence["workflows"]] == [
        *release_publish.REQUIRED_WORKFLOWS,
        release_publish.RELEASE_WORKFLOW,
    ]
    notes = (tmp_path / "RELEASE_NOTES.md").read_text(encoding="utf-8")
    assert sha in notes
    assert "Exact-SHA workflow evidence" in notes
    assert "actions/runs/100" in notes

    with zipfile.ZipFile(output / "Template-Tooling-v1.0.2-source.zip") as archive:
        assert "Template-Tooling-v1.0.2/tracked.txt" in archive.namelist()
        assert "Template-Tooling-v1.0.2/untracked-secret.txt" not in archive.namelist()
    with tarfile.open(
        output / "Template-Tooling-v1.0.2-linux-unsigned.tar.gz", "r:gz"
    ) as archive:
        member = archive.getmember("nested/candidate-linux.bin")
        assert member.mode & 0o111
    assert release_publish_bundle.sha256(
        output / "Template-Tooling-v1.0.2-linux-unsigned.tar.gz"
    ) == (
        release_publish_bundle.sha256(
            inputs / "desktop-linux-unsigned" / "desktop-linux-unsigned.tar.gz"
        )
    )


def test_release_bundle_rejects_symlinks_in_downloaded_artifacts(
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    inputs = _artifact_inputs(tmp_path, sha)
    target = inputs / "desktop-linux-unsigned" / "outside-link"
    try:
        target.symlink_to(tmp_path / "outside")
    except OSError:
        pytest.skip("symbolic links are unavailable on this platform")

    with pytest.raises(release_publish.ReleasePublishError, match="symbolic link"):
        release_publish_bundle.build_release_bundle(
            root,
            inputs,
            tmp_path / "release-assets",
            identity,
            _workflow_evidence(sha),
        )


def test_remote_tag_must_match_annotated_object_and_commit(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)

    def response(url: str, _token: str) -> object:
        if "/git/ref/tags/" in url:
            return {"object": {"type": "tag", "sha": identity.tag_object_sha}}
        if f"/git/tags/{identity.tag_object_sha}" in url:
            return {
                "tag": identity.tag,
                "object": {"type": "commit", "sha": identity.sha},
            }
        raise AssertionError(url)

    monkeypatch.setattr(release_publish, "_request_json", response)
    release_publish.verify_remote_tag_identity(identity, token="test-token")

    moved_sha = "0" * 40
    monkeypatch.setattr(
        release_publish,
        "_request_json",
        lambda url, _token: (
            {"object": {"type": "tag", "sha": moved_sha}}
            if "/git/ref/tags/" in url
            else {
                "tag": identity.tag,
                "object": {"type": "commit", "sha": identity.sha},
            }
        ),
    )
    with pytest.raises(
        release_publish.ReleasePublishError, match="expected annotated tag object"
    ):
        release_publish.verify_remote_tag_identity(identity, token="test-token")


def test_workflow_evidence_records_exact_rerun_attempt(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    runs = [
        _run(name, index, sha)
        for index, name in enumerate(release_publish.REQUIRED_WORKFLOWS, 1)
    ]
    runs.append(_run(release_publish.RELEASE_WORKFLOW, 600, sha, branch="v1.0.2"))
    _mock_action_runs(monkeypatch, runs)

    evidence = release_publish.collect_workflow_evidence(identity, token="test-token")

    assert all(item.run_attempt == 2 for item in evidence)
    assert all(item.url.endswith(f"/attempts/{item.run_attempt}") for item in evidence)
    runs[-1]["run_attempt"] = 3
    with pytest.raises(release_publish.ReleasePublishError, match="run_attempt"):
        release_publish.collect_workflow_evidence(identity, token="test-token")


def test_release_bundle_rejects_invalid_spdx_document(tmp_path: Path) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    inputs = _artifact_inputs(tmp_path, sha)
    (inputs / "web-release-candidate" / f"template-tooling-{sha}.spdx.json").write_text(
        '{"spdxVersion":"not-spdx"}\n',
        encoding="utf-8",
    )

    with pytest.raises(release_publish.ReleasePublishError, match="SPDX 2.x"):
        release_publish_bundle.build_release_bundle(
            root,
            inputs,
            tmp_path / "release-assets",
            identity,
            _workflow_evidence(sha),
        )


def test_release_bundle_rejects_nonportable_archive_members(tmp_path: Path) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    inputs = _artifact_inputs(tmp_path, sha)
    archive_path = inputs / "desktop-linux-unsigned" / "desktop-linux-unsigned.tar.gz"
    payload = b"unsafe"
    member = tarfile.TarInfo("bad\\name.bin")
    member.size = len(payload)
    with tarfile.open(archive_path, "w:gz") as archive:
        archive.addfile(member, io.BytesIO(payload))

    with pytest.raises(release_publish.ReleasePublishError, match="non-portable"):
        release_publish_bundle.build_release_bundle(
            root,
            inputs,
            tmp_path / "release-assets",
            identity,
            _workflow_evidence(sha),
        )


def test_release_bundle_accepts_internal_relative_tar_symlinks(tmp_path: Path) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    inputs = _artifact_inputs(tmp_path, sha)
    archive_path = inputs / "desktop-linux-unsigned" / "desktop-linux-unsigned.tar.gz"
    with tarfile.open(archive_path, "w:gz") as archive:
        payload = b"linux"
        target = tarfile.TarInfo("nested/candidate-linux.bin")
        target.size = len(payload)
        archive.addfile(target, io.BytesIO(payload))
        member = tarfile.TarInfo("nested/candidate-link.bin")
        member.type = tarfile.SYMTYPE
        member.linkname = "candidate-linux.bin"
        archive.addfile(member)

    release_publish_bundle.build_release_bundle(
        root,
        inputs,
        tmp_path / "release-assets",
        identity,
        _workflow_evidence(sha),
    )


@pytest.mark.parametrize("target", ["/etc/passwd", "../../outside", "missing.bin"])
def test_release_bundle_rejects_unsafe_tar_symlinks(
    tmp_path: Path, target: str
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    inputs = _artifact_inputs(tmp_path, sha)
    archive_path = inputs / "desktop-linux-unsigned" / "desktop-linux-unsigned.tar.gz"
    with tarfile.open(archive_path, "w:gz") as archive:
        payload = b"linux"
        regular = tarfile.TarInfo("nested/candidate-linux.bin")
        regular.size = len(payload)
        archive.addfile(regular, io.BytesIO(payload))
        member = tarfile.TarInfo("nested/candidate-link.bin")
        member.type = tarfile.SYMTYPE
        member.linkname = target
        archive.addfile(member)

    with pytest.raises(
        release_publish.ReleasePublishError, match="unsafe symbolic link"
    ):
        release_publish_bundle.build_release_bundle(
            root,
            inputs,
            tmp_path / "release-assets",
            identity,
            _workflow_evidence(sha),
        )


def test_prepared_bundle_reverification_rejects_tampering(tmp_path: Path) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    output = tmp_path / "release-assets"
    release_publish_bundle.build_release_bundle(
        root,
        _artifact_inputs(tmp_path, sha),
        output,
        identity,
        _workflow_evidence(sha),
    )
    web = output / "Template-Tooling-v1.0.2-web.zip"
    original_web = web.read_bytes()
    web.write_bytes(original_web + b"tampered")

    with pytest.raises(release_publish.ReleasePublishError, match="checksum mismatch"):
        release_publish_bundle.verify_prepared_bundle(
            _bundle(output), _request(identity)
        )
    web.write_bytes(original_web)
    notes = tmp_path / "RELEASE_NOTES.md"
    notes.write_text(notes.read_text(encoding="utf-8") + "tampered\n", encoding="utf-8")
    with pytest.raises(
        release_publish.ReleasePublishError, match="evidence-bound digest"
    ):
        release_publish_bundle.verify_prepared_bundle(
            release_publish.PreparedBundle(output, notes),
            _request(identity),
        )


def test_prepared_bundle_rejects_boolean_integer_evidence_fields(
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    output = tmp_path / "release-assets"
    release_publish_bundle.build_release_bundle(
        root,
        _artifact_inputs(tmp_path, sha),
        output,
        identity,
        _workflow_evidence(sha),
    )
    evidence_path = output / "Template-Tooling-v1.0.2-release-evidence.json"
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    evidence["schema_version"] = True
    evidence_path.write_text(json.dumps(evidence), encoding="utf-8")

    with pytest.raises(release_publish.ReleasePublishError, match="unsupported schema"):
        release_publish_bundle.verify_prepared_bundle(
            _bundle(output), _request(identity)
        )


@pytest.mark.parametrize(
    ("state", "draft", "immutable"),
    [("draft", True, False), ("published", False, True)],
)
def test_github_release_verification_requires_exact_assets_and_native_immutability(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    state: str,
    draft: bool,
    immutable: bool,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    output = tmp_path / "release-assets"
    release_publish_bundle.build_release_bundle(
        root,
        _artifact_inputs(tmp_path, sha),
        output,
        identity,
        _workflow_evidence(sha),
    )
    notes = tmp_path / "RELEASE_NOTES.md"
    payload = _github_release_payload(output, notes, identity, draft, immutable)
    requested_urls: list[str] = []

    def response(url: str, _token: str) -> object:
        requested_urls.append(url)
        return [payload] if "/releases?" in url else payload

    monkeypatch.setattr(release_publish, "_request_json", response)

    release_publish_bundle.verify_github_release(
        identity,
        _bundle(output),
        token="test-token",
        state=state,
    )
    payload["assets"][0]["digest"] = "sha256:" + "0" * 64
    with pytest.raises(release_publish.ReleasePublishError, match="digest mismatch"):
        release_publish_bundle.verify_github_release(
            identity,
            _bundle(output),
            token="test-token",
            state=state,
        )
    if state == "draft":
        assert all("/releases/tags/" not in url for url in requested_urls)
        assert any("/releases?per_page=100&page=1" in url for url in requested_urls)
    else:
        assert all("/releases/tags/v1.0.2" in url for url in requested_urls)


def test_github_release_rejects_numeric_boolean_fields(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    output = tmp_path / "release-assets"
    release_publish_bundle.build_release_bundle(
        root,
        _artifact_inputs(tmp_path, sha),
        output,
        identity,
        _workflow_evidence(sha),
    )
    payload = _github_release_payload(
        output, tmp_path / "RELEASE_NOTES.md", identity, True, False
    )
    payload["draft"] = 1
    monkeypatch.setattr(
        release_publish, "_request_json", lambda _url, _token: [payload]
    )

    with pytest.raises(release_publish.ReleasePublishError, match="invalid fields"):
        release_publish_bundle.verify_github_release(
            identity,
            _bundle(output),
            token="test-token",
            state="draft",
        )


def test_publication_state_reports_absent_only_for_not_found(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    bundle = release_publish.PreparedBundle(tmp_path / "assets", tmp_path / "notes")
    missing = urllib.error.HTTPError(
        "https://api.example.invalid", 404, "Not Found", {}, None
    )

    def missing_response(url: str, _token: str) -> object:
        if "/releases/tags/" in url:
            raise missing
        if "/releases?" in url:
            return []
        raise AssertionError(url)

    monkeypatch.setattr(release_publish, "_request_json", missing_response)

    assert (
        release_publish_bundle.publication_state(identity, bundle, token="test-token")
        == "absent"
    )

    forbidden = urllib.error.HTTPError(
        "https://api.example.invalid", 403, "Forbidden", {}, None
    )
    monkeypatch.setattr(
        release_publish,
        "_request_json",
        lambda _url, _token: (_ for _ in ()).throw(forbidden),
    )
    with pytest.raises(release_publish.ReleasePublishError, match="HTTP 403"):
        release_publish_bundle.publication_state(identity, bundle, token="test-token")


def test_publication_state_fails_closed_for_leftover_draft(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    bundle = release_publish.PreparedBundle(tmp_path / "assets", tmp_path / "notes")
    missing = urllib.error.HTTPError(
        "https://api.example.invalid", 404, "Not Found", {}, None
    )

    def response(url: str, _token: str) -> object:
        if "/releases/tags/" in url:
            raise missing
        if "/releases?" in url:
            return [{"tag_name": identity.tag, "draft": True}]
        raise AssertionError(url)

    monkeypatch.setattr(release_publish, "_request_json", response)

    with pytest.raises(
        release_publish.ReleasePublishError, match="non-published GitHub Release"
    ):
        release_publish_bundle.publication_state(identity, bundle, token="test-token")


def test_publication_state_resumes_only_exact_immutable_release(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root, sha = _release_repository(tmp_path)
    identity = _identity(root, sha)
    output = tmp_path / "release-assets"
    release_publish_bundle.build_release_bundle(
        root,
        _artifact_inputs(tmp_path, sha),
        output,
        identity,
        _workflow_evidence(sha),
    )
    notes = tmp_path / "RELEASE_NOTES.md"
    payload = _github_release_payload(output, notes, identity, False, True)
    monkeypatch.setattr(release_publish, "_request_json", lambda _url, _token: payload)

    assert (
        release_publish_bundle.publication_state(
            identity, _bundle(output), token="test-token"
        )
        == "published"
    )

    payload["body"] = "wrong notes"
    with pytest.raises(release_publish.ReleasePublishError, match="notes differ"):
        release_publish_bundle.publication_state(
            identity, _bundle(output), token="test-token"
        )
