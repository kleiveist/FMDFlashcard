from __future__ import annotations

import hashlib
import json
import posixpath
import re
import shutil
import subprocess
import tarfile
import unicodedata
import urllib.error
import urllib.parse
import zipfile
from dataclasses import asdict
from pathlib import Path
from typing import Any

from tools.inst import release_publish

WINDOWS_RESERVED_NAMES = {
    "aux",
    "con",
    "nul",
    "prn",
    *(f"com{index}" for index in range(1, 10)),
    *(f"lpt{index}" for index in range(1, 10)),
}
EXPECTED_INPUTS = {
    "desktop-linux-unsigned",
    "desktop-macos-unsigned",
    "desktop-windows-unsigned",
    "web-release-candidate",
}
DESKTOP_PREARCHIVES = {
    "linux": "desktop-linux-unsigned.tar.gz",
    "macos": "desktop-macos-unsigned.tar.gz",
    "windows": "desktop-windows-unsigned.zip",
}
CHECKSUM_PATTERN = re.compile(r"([0-9a-f]{64})  ([A-Za-z0-9][A-Za-z0-9._-]*)")

PreparedBundle = release_publish.PreparedBundle
ReleaseIdentity = release_publish.ReleaseIdentity
ReleasePublishError = release_publish.ReleasePublishError
ReleaseRequest = release_publish.ReleaseRequest
WorkflowEvidence = release_publish.WorkflowEvidence


def _regular_files(root: Path) -> list[Path]:
    if root.is_symlink() or not root.is_dir():
        raise ReleasePublishError(f"required workflow artifact is missing: {root.name}")
    entries = sorted(root.rglob("*"))
    symlinks = [path for path in entries if path.is_symlink()]
    if symlinks:
        raise ReleasePublishError(
            f"workflow artifact contains a symbolic link: {symlinks[0]}"
        )
    files = [path for path in entries if path.is_file()]
    if not files:
        raise ReleasePublishError(f"workflow artifact is empty: {root.name}")
    return files


def _single_file(root: Path, suffix: str, *, exact_name: str | None = None) -> Path:
    files = _regular_files(root)
    matches = (
        [path for path in files if path.name == exact_name]
        if exact_name is not None
        else [path for path in files if path.name.endswith(suffix)]
    )
    if len(matches) != 1:
        expected = exact_name or f"*{suffix}"
        raise ReleasePublishError(
            f"{root.name} must contain exactly one {expected} file; found {len(matches)}"
        )
    if matches[0].stat().st_size == 0:
        raise ReleasePublishError(f"workflow artifact file is empty: {matches[0].name}")
    return matches[0]


def _only_file(root: Path, exact_name: str) -> Path:
    files = _regular_files(root)
    if len(files) != 1 or files[0].parent != root or files[0].name != exact_name:
        raise ReleasePublishError(f"{root.name} must contain only {exact_name}")
    if files[0].stat().st_size == 0:
        raise ReleasePublishError(f"workflow artifact file is empty: {exact_name}")
    return files[0]


def _validate_spdx(path: Path) -> None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReleasePublishError(f"SPDX SBOM is not valid JSON: {path.name}") from exc
    if not isinstance(payload, dict):
        raise ReleasePublishError("SPDX SBOM root must be a JSON object")
    version = payload.get("spdxVersion")
    if not isinstance(version, str) or re.fullmatch(r"SPDX-2\.\d+", version) is None:
        raise ReleasePublishError("SBOM does not declare an SPDX 2.x version")
    required = {"SPDXID": "SPDXRef-DOCUMENT", "dataLicense": "CC0-1.0"}
    invalid = [key for key, value in required.items() if payload.get(key) != value]
    if (
        invalid
        or not isinstance(payload.get("creationInfo"), dict)
        or not isinstance(payload.get("packages"), list)
    ):
        raise ReleasePublishError("SBOM is missing required SPDX document fields")


def _validate_portable_name(relative: str) -> str:
    for component in relative.split("/"):
        normalized = unicodedata.normalize("NFC", component)
        stem = normalized.split(".", 1)[0].casefold()
        invalid = (
            component in {"", ".", ".."}
            or "\\" in component
            or ":" in component
            or component.endswith((" ", "."))
            or any(
                ord(character) < 32 or ord(character) == 127 for character in component
            )
            or stem in WINDOWS_RESERVED_NAMES
        )
        if invalid:
            raise ReleasePublishError(
                f"workflow artifact has a non-portable member name: {relative!r}"
            )
    return relative


def _validate_archive_names(names: list[str]) -> None:
    normalized_names: set[str] = set()
    for name in names:
        relative = _validate_portable_name(name.rstrip("/"))
        normalized = unicodedata.normalize("NFC", relative).casefold()
        if normalized in normalized_names:
            raise ReleasePublishError(
                f"workflow artifact has a portable-name collision: {relative!r}"
            )
        normalized_names.add(normalized)


def _validate_zip_prearchive(path: Path) -> list[zipfile.ZipInfo]:
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        _validate_archive_names([item.filename for item in members])
        invalid = archive.testzip()
    if invalid is not None:
        raise ReleasePublishError(
            f"Windows desktop prearchive has a corrupt member: {invalid}"
        )
    return [item for item in members if not item.is_dir()]


def _validate_tar_prearchive(path: Path, platform: str) -> list[tarfile.TarInfo]:
    with tarfile.open(path, mode="r:gz") as archive:
        members = archive.getmembers()
    _validate_archive_names([item.name for item in members])
    member_names = {item.name.rstrip("/") for item in members}
    for member in members:
        if member.isfile() or member.isdir():
            continue
        if member.issym():
            _validate_tar_symlink(member, member_names, platform)
            continue
        raise ReleasePublishError(
            f"{platform} desktop prearchive contains a hard link or special member"
        )
    return [item for item in members if item.isfile()]


def _validate_tar_symlink(
    member: tarfile.TarInfo, member_names: set[str], platform: str
) -> None:
    target = member.linkname
    unsafe_target = (
        not target
        or target.startswith("/")
        or "\\" in target
        or ":" in target
        or any(ord(character) < 32 or ord(character) == 127 for character in target)
    )
    resolved = posixpath.normpath(
        posixpath.join(posixpath.dirname(member.name), target)
    )
    escapes_archive = resolved == ".." or resolved.startswith("../")
    if unsafe_target or escapes_archive or resolved not in member_names:
        raise ReleasePublishError(
            f"{platform} desktop prearchive contains an unsafe symbolic link: {member.name!r} -> {target!r}"
        )


def _validate_prearchive(path: Path, platform: str) -> None:
    try:
        regular_files = (
            _validate_zip_prearchive(path)
            if platform == "windows"
            else _validate_tar_prearchive(path, platform)
        )
    except (OSError, tarfile.TarError, zipfile.BadZipFile) as exc:
        raise ReleasePublishError(f"{platform} desktop prearchive is invalid") from exc
    if not regular_files:
        raise ReleasePublishError(f"{platform} desktop prearchive contains no files")


def _create_source_archive(
    root: Path, identity: ReleaseIdentity, destination: Path
) -> None:
    completed = subprocess.run(
        [
            "git",
            "archive",
            "--format=zip",
            f"--prefix=Template-Tooling-{identity.tag}/",
            f"--output={destination}",
            identity.sha,
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if (
        completed.returncode != 0
        or not destination.is_file()
        or destination.stat().st_size == 0
    ):
        detail = completed.stderr.strip() or "archive is missing or empty"
        raise ReleasePublishError(f"could not create source archive: {detail}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_evidence(
    output_dir: Path,
    identity: ReleaseIdentity,
    workflows: tuple[WorkflowEvidence, ...],
    asset_names: list[str],
    release_notes_sha256: str,
) -> Path:
    path = output_dir / f"Template-Tooling-{identity.tag}-release-evidence.json"
    payload = {
        "schema_version": 1,
        "release": asdict(identity),
        "workflows": [asdict(item) for item in workflows],
        "assets": asset_names,
        "release_notes_sha256": release_notes_sha256,
    }
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return path


def _write_checksums(output_dir: Path) -> Path:
    path = output_dir / "SHA256SUMS.txt"
    assets = sorted(
        item for item in output_dir.iterdir() if item.is_file() and item != path
    )
    path.write_text(
        "".join(f"{sha256(item)}  {item.name}\n" for item in assets), encoding="utf-8"
    )
    return path


def _write_release_notes(
    root: Path,
    output_dir: Path,
    identity: ReleaseIdentity,
    workflows: tuple[WorkflowEvidence, ...],
) -> Path:
    template = root / ".github" / "release-notes" / f"{identity.tag}.md"
    if template.is_symlink() or not template.is_file():
        raise ReleasePublishError(
            f"reviewed release-notes template is missing: {template.relative_to(root)}"
        )
    rows = "\n".join(
        f"| {item.workflow} | [{item.run_id}]({item.url}) | {item.run_attempt} | `{item.conclusion}` |"
        for item in workflows
    )
    evidence = (
        "\n\n## Exact-SHA workflow evidence\n\n"
        f"Immutable release commit: [`{identity.sha}`](https://github.com/{identity.repository}/commit/{identity.sha})\n\n"
        "| Workflow | Run ID | Attempt | Conclusion |\n"
        "| --- | ---: | ---: | --- |\n"
        f"{rows}\n"
    )
    path = output_dir.parent / "RELEASE_NOTES.md"
    path.write_text(
        template.read_text(encoding="utf-8").rstrip() + evidence, encoding="utf-8"
    )
    return path


def publication_asset_names(identity: ReleaseIdentity) -> set[str]:
    prefix = f"Template-Tooling-{identity.tag}"
    return {
        f"{prefix}-source.zip",
        f"{prefix}-web.zip",
        f"{prefix}.spdx.json",
        f"{prefix}-linux-unsigned.tar.gz",
        f"{prefix}-macos-unsigned.tar.gz",
        f"{prefix}-windows-unsigned.zip",
        f"{prefix}-release-evidence.json",
        "SHA256SUMS.txt",
    }


def _read_evidence(bundle: PreparedBundle, request: ReleaseRequest) -> dict[str, Any]:
    evidence_path = (
        bundle.output_dir / f"Template-Tooling-{request.tag}-release-evidence.json"
    )
    try:
        payload = json.loads(evidence_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReleasePublishError(
            "prepared release evidence is missing or invalid JSON"
        ) from exc
    if (
        not isinstance(payload, dict)
        or type(payload.get("schema_version")) is not int
        or payload["schema_version"] != 1
    ):
        raise ReleasePublishError("prepared release evidence has an unsupported schema")
    return payload


def _identity_from_evidence(
    payload: dict[str, Any], request: ReleaseRequest
) -> ReleaseIdentity:
    release = payload.get("release")
    if not isinstance(release, dict):
        raise ReleasePublishError("prepared release evidence has no release identity")
    tag_object_sha = release.get("tag_object_sha")
    if not isinstance(tag_object_sha, str) or not release_publish.SHA_PATTERN.fullmatch(
        tag_object_sha
    ):
        raise ReleasePublishError(
            "prepared release evidence has an invalid tag-object SHA"
        )
    identity = ReleaseIdentity(
        request.repository,
        request.tag,
        request.tag.removeprefix("v"),
        request.sha,
        tag_object_sha,
        request.release_run_id,
        request.release_run_attempt,
    )
    expected = asdict(identity)
    exact_identity = set(release) == set(expected) and all(
        type(release[key]) is type(value) and release[key] == value
        for key, value in expected.items()
    )
    if not exact_identity:
        raise ReleasePublishError(
            "prepared release evidence identity does not match the publication event"
        )
    return identity


def _workflow_record_is_valid(item: WorkflowEvidence, request: ReleaseRequest) -> bool:
    expected_branch = (
        request.tag if item.workflow == release_publish.RELEASE_WORKFLOW else "main"
    )
    string_values = (
        item.workflow,
        item.event,
        item.status,
        item.conclusion,
        item.head_branch,
        item.head_sha,
        item.url,
    )
    expected_url = f"https://github.com/{request.repository}/actions/runs/{item.run_id}/attempts/{item.run_attempt}"
    return (
        all(isinstance(value, str) for value in string_values)
        and release_publish._positive_int(item.run_id)
        and release_publish._positive_int(item.run_attempt)
        and item.event == "push"
        and item.status == "completed"
        and item.conclusion == "success"
        and item.head_branch == expected_branch
        and item.head_sha == request.sha
        and item.url == expected_url
    )


def _workflows_from_evidence(
    payload: dict[str, Any],
    request: ReleaseRequest,
) -> tuple[WorkflowEvidence, ...]:
    raw_workflows = payload.get("workflows")
    if not isinstance(raw_workflows, list):
        raise ReleasePublishError("prepared release evidence has no workflow records")
    try:
        workflows = tuple(
            WorkflowEvidence(**item) for item in raw_workflows if isinstance(item, dict)
        )
    except (TypeError, ValueError) as exc:
        raise ReleasePublishError("prepared workflow evidence is invalid") from exc
    expected_names = (
        *release_publish.REQUIRED_WORKFLOWS,
        release_publish.RELEASE_WORKFLOW,
    )
    if (
        len(workflows) != len(raw_workflows)
        or tuple(item.workflow for item in workflows) != expected_names
    ):
        raise ReleasePublishError(
            "prepared workflow evidence does not contain the governed workflow set"
        )
    invalid = next(
        (
            item.workflow
            for item in workflows
            if not _workflow_record_is_valid(item, request)
        ),
        None,
    )
    if invalid is not None:
        raise ReleasePublishError(f"prepared workflow record is invalid: {invalid}")
    return workflows


def _load_prepared_evidence(
    bundle: PreparedBundle,
    request: ReleaseRequest,
) -> tuple[ReleaseIdentity, tuple[WorkflowEvidence, ...], dict[str, Any]]:
    release_publish.validate_request_shape(request)
    payload = _read_evidence(bundle, request)
    return (
        _identity_from_evidence(payload, request),
        _workflows_from_evidence(payload, request),
        payload,
    )


def _verify_asset_inventory(
    bundle: PreparedBundle, identity: ReleaseIdentity
) -> set[str]:
    files = _regular_files(bundle.output_dir)
    if any(path.parent != bundle.output_dir for path in files):
        raise ReleasePublishError(
            "prepared release bundle must not contain nested files"
        )
    expected_names = publication_asset_names(identity)
    if {path.name for path in files} != expected_names:
        raise ReleasePublishError(
            "prepared release bundle does not contain the exact governed asset set"
        )
    return expected_names


def _checksum_entries(path: Path) -> dict[str, str]:
    entries: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = CHECKSUM_PATTERN.fullmatch(line)
        if match is None or match.group(2) in entries:
            raise ReleasePublishError(
                "prepared SHA256SUMS.txt has an invalid or duplicate entry"
            )
        entries[match.group(2)] = match.group(1)
    return entries


def _verify_checksums(bundle: PreparedBundle, expected_names: set[str]) -> None:
    entries = _checksum_entries(bundle.output_dir / "SHA256SUMS.txt")
    if set(entries) != expected_names - {"SHA256SUMS.txt"}:
        raise ReleasePublishError(
            "prepared SHA256SUMS.txt does not cover the exact asset set"
        )
    invalid = next(
        (
            name
            for name, digest in entries.items()
            if sha256(bundle.output_dir / name) != digest
        ),
        None,
    )
    if invalid is not None:
        raise ReleasePublishError(f"prepared asset checksum mismatch: {invalid}")


def _verify_notes(
    bundle: PreparedBundle,
    request: ReleaseRequest,
    workflows: tuple[WorkflowEvidence, ...],
    payload: dict[str, Any],
) -> None:
    try:
        notes = bundle.notes_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise ReleasePublishError(
            "prepared release notes are missing or invalid"
        ) from exc
    if not notes.strip() or request.sha not in notes:
        raise ReleasePublishError(
            "prepared release notes do not identify the exact release SHA"
        )
    if payload.get("release_notes_sha256") != sha256(bundle.notes_path):
        raise ReleasePublishError(
            "prepared release notes do not match the evidence-bound digest"
        )
    missing = next((item.workflow for item in workflows if item.url not in notes), None)
    if missing is not None:
        raise ReleasePublishError(
            f"prepared release notes omit the exact {missing} attempt"
        )


def verify_prepared_bundle(
    bundle: PreparedBundle, request: ReleaseRequest
) -> ReleaseIdentity:
    identity, workflows, payload = _load_prepared_evidence(bundle, request)
    expected_names = _verify_asset_inventory(bundle, identity)
    _verify_checksums(bundle, expected_names)
    evidence_name = f"Template-Tooling-{request.tag}-release-evidence.json"
    expected_evidence_assets = expected_names - {"SHA256SUMS.txt", evidence_name}
    evidence_assets = payload.get("assets")
    valid_evidence_assets = (
        isinstance(evidence_assets, list)
        and all(isinstance(name, str) for name in evidence_assets)
        and len(evidence_assets) == len(set(evidence_assets))
        and set(evidence_assets) == expected_evidence_assets
    )
    if not valid_evidence_assets:
        raise ReleasePublishError("release evidence asset inventory is inconsistent")
    _verify_notes(bundle, request, workflows, payload)
    return identity


def _published_release_url(identity: ReleaseIdentity, api_url: str) -> str:
    encoded_tag = urllib.parse.quote(identity.tag, safe="")
    return (
        f"{api_url.rstrip('/')}/repos/{identity.repository}/releases/tags/{encoded_tag}"
    )


def _matching_releases(
    identity: ReleaseIdentity,
    *,
    token: str,
    api_url: str,
) -> list[dict[str, Any]]:
    endpoint = f"{api_url.rstrip('/')}/repos/{identity.repository}/releases"
    matches: list[dict[str, Any]] = []
    for page in range(1, 11):
        query = urllib.parse.urlencode({"per_page": 100, "page": page})
        try:
            payload = release_publish._request_json(f"{endpoint}?{query}", token)
        except urllib.error.HTTPError as exc:
            raise ReleasePublishError(
                f"could not inspect draft GitHub Releases: HTTP {exc.code}"
            ) from exc
        except (OSError, ValueError) as exc:
            raise ReleasePublishError(
                f"could not inspect draft GitHub Releases: {exc}"
            ) from exc
        if not isinstance(payload, list) or any(
            not isinstance(item, dict) for item in payload
        ):
            raise ReleasePublishError("GitHub Release list payload is invalid")
        matches.extend(item for item in payload if item.get("tag_name") == identity.tag)
        if len(payload) < 100:
            return matches
    raise ReleasePublishError("GitHub Release pagination exceeds 1,000 entries")


def _draft_release_payload(
    identity: ReleaseIdentity, *, token: str, api_url: str
) -> dict[str, Any]:
    matches = _matching_releases(identity, token=token, api_url=api_url)
    if len(matches) != 1:
        raise ReleasePublishError(
            f"expected exactly one draft GitHub Release for {identity.tag}; found {len(matches)}"
        )
    return matches[0]


def _verify_release_fields(
    payload: dict[str, Any], identity: ReleaseIdentity, state: str
) -> None:
    expected_text = {
        "tag_name": identity.tag,
        "name": f"Template-Tooling {identity.tag}",
    }
    expected_booleans = {
        "draft": state == "draft",
        "prerelease": False,
        "immutable": state == "published",
    }
    mismatches = [
        key for key, value in expected_text.items() if payload.get(key) != value
    ]
    mismatches.extend(
        key for key, value in expected_booleans.items() if payload.get(key) is not value
    )
    if mismatches:
        raise ReleasePublishError(
            f"GitHub Release has invalid fields: {', '.join(mismatches)}"
        )


def _verify_release_assets(
    payload: dict[str, Any], identity: ReleaseIdentity, bundle: PreparedBundle
) -> None:
    assets = payload.get("assets")
    if not isinstance(assets, list):
        raise ReleasePublishError("GitHub Release assets payload is invalid")
    remote_assets: dict[str, dict[str, Any]] = {}
    for item in assets:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("name"), str)
            or item["name"] in remote_assets
        ):
            raise ReleasePublishError("GitHub Release assets payload is invalid")
        remote_assets[item["name"]] = item
    if set(remote_assets) != publication_asset_names(identity):
        raise ReleasePublishError(
            "GitHub Release does not contain the exact governed asset set"
        )
    for name, item in remote_assets.items():
        path = bundle.output_dir / name
        size = item.get("size")
        valid = (
            item.get("state") == "uploaded"
            and type(size) is int
            and size == path.stat().st_size
        )
        if not valid:
            raise ReleasePublishError(
                f"GitHub Release asset metadata is invalid: {name}"
            )
        if item.get("digest") != f"sha256:{sha256(path)}":
            raise ReleasePublishError(f"GitHub Release asset digest mismatch: {name}")


def _verify_release_payload(
    payload: Any,
    identity: ReleaseIdentity,
    bundle: PreparedBundle,
    state: str,
) -> None:
    if state not in {"draft", "published"}:
        raise ReleasePublishError(
            f"unsupported GitHub Release verification state: {state}"
        )
    if not isinstance(payload, dict):
        raise ReleasePublishError("GitHub Release payload is invalid")
    _verify_release_fields(payload, identity, state)
    expected_body = bundle.notes_path.read_text(encoding="utf-8").rstrip()
    body = payload.get("body")
    if not isinstance(body, str) or body.rstrip() != expected_body:
        raise ReleasePublishError(
            "GitHub Release notes differ from the reviewed exact-SHA notes"
        )
    _verify_release_assets(payload, identity, bundle)


def verify_github_release(
    identity: ReleaseIdentity,
    bundle: PreparedBundle,
    *,
    token: str,
    state: str,
    api_url: str = "https://api.github.com",
) -> None:
    payload = (
        _draft_release_payload(identity, token=token, api_url=api_url)
        if state == "draft"
        else release_publish._request_json(
            _published_release_url(identity, api_url), token
        )
    )
    _verify_release_payload(payload, identity, bundle, state)


def publication_state(
    identity: ReleaseIdentity,
    bundle: PreparedBundle,
    *,
    token: str,
    api_url: str = "https://api.github.com",
) -> str:
    try:
        payload = release_publish._request_json(
            _published_release_url(identity, api_url), token
        )
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            matches = _matching_releases(identity, token=token, api_url=api_url)
            if not matches:
                return "absent"
            raise ReleasePublishError(
                f"a non-published GitHub Release already exists for {identity.tag}; manual recovery is required"
            ) from exc
        raise ReleasePublishError(
            f"could not inspect GitHub Release state: HTTP {exc.code}"
        ) from exc
    except (OSError, ValueError) as exc:
        raise ReleasePublishError(
            f"could not inspect GitHub Release state: {exc}"
        ) from exc
    _verify_release_payload(payload, identity, bundle, "published")
    return "published"


def _validate_inputs(input_dir: Path) -> None:
    if input_dir.is_symlink() or not input_dir.is_dir():
        raise ReleasePublishError("release artifact input directory is missing")
    entries = list(input_dir.iterdir())
    if {entry.name for entry in entries} != EXPECTED_INPUTS or any(
        not entry.is_dir() for entry in entries
    ):
        raise ReleasePublishError(
            "release validation did not produce the exact governed artifact set"
        )


def _initialize_output(output_dir: Path) -> None:
    if output_dir.exists() and any(output_dir.iterdir()):
        raise ReleasePublishError(
            f"release output directory is not empty: {output_dir}"
        )
    output_dir.mkdir(parents=True, exist_ok=True)


def _build_primary_assets(
    root: Path,
    input_dir: Path,
    output_dir: Path,
    identity: ReleaseIdentity,
) -> list[Path]:
    prefix = f"Template-Tooling-{identity.tag}"
    source = output_dir / f"{prefix}-source.zip"
    web = output_dir / f"{prefix}-web.zip"
    sbom = output_dir / f"{prefix}.spdx.json"
    _create_source_archive(root, identity, source)
    web_input = input_dir / "web-release-candidate"
    shutil.copyfile(_single_file(web_input, ".zip"), web)
    sbom_input = _single_file(
        web_input, ".spdx.json", exact_name=f"template-tooling-{identity.sha}.spdx.json"
    )
    _validate_spdx(sbom_input)
    shutil.copyfile(sbom_input, sbom)
    return [source, web, sbom]


def _build_desktop_assets(
    input_dir: Path, output_dir: Path, identity: ReleaseIdentity
) -> list[Path]:
    assets: list[Path] = []
    for platform, archive_name in DESKTOP_PREARCHIVES.items():
        source = _only_file(input_dir / f"desktop-{platform}-unsigned", archive_name)
        _validate_prearchive(source, platform)
        suffix = ".zip" if platform == "windows" else ".tar.gz"
        destination = (
            output_dir / f"Template-Tooling-{identity.tag}-{platform}-unsigned{suffix}"
        )
        shutil.copyfile(source, destination)
        assets.append(destination)
    return assets


def _request_from_identity(identity: ReleaseIdentity) -> ReleaseRequest:
    return ReleaseRequest(
        identity.repository,
        identity.tag,
        identity.sha,
        identity.release_run_id,
        identity.release_run_attempt,
    )


def build_release_bundle(
    root: Path,
    input_dir: Path,
    output_dir: Path,
    identity: ReleaseIdentity,
    workflows: tuple[WorkflowEvidence, ...],
) -> tuple[Path, ...]:
    _validate_inputs(input_dir)
    _initialize_output(output_dir)
    assets = _build_primary_assets(root, input_dir, output_dir, identity)
    assets.extend(_build_desktop_assets(input_dir, output_dir, identity))
    notes = _write_release_notes(root, output_dir, identity, workflows)
    evidence = _write_evidence(
        output_dir, identity, workflows, [path.name for path in assets], sha256(notes)
    )
    checksums = _write_checksums(output_dir)
    bundle = PreparedBundle(output_dir, notes)
    verify_prepared_bundle(bundle, _request_from_identity(identity))
    return (*assets, evidence, checksums, notes)
