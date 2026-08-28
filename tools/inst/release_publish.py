from __future__ import annotations

import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REQUIRED_WORKFLOWS = (
    "Core CI",
    "Desktop CI",
    "PostgreSQL Integration",
    "Profile Matrix",
    "Security",
)
REQUIRED_WORKFLOW_PATHS = {
    "Core CI": ".github/workflows/ci.yml",
    "Desktop CI": ".github/workflows/desktop.yml",
    "PostgreSQL Integration": ".github/workflows/postgres.yml",
    "Profile Matrix": ".github/workflows/profiles.yml",
    "Security": ".github/workflows/security.yml",
}
RELEASE_WORKFLOW = "Release Validation"
RELEASE_WORKFLOW_PATH = ".github/workflows/release.yml"
REPOSITORY_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
TAG_PATTERN = re.compile(r"^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
RELEASE_TAG_RULE_PATTERNS = {"refs/tags/v*", "~ALL"}


class ReleasePublishError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class ReleaseRequest:
    repository: str
    tag: str
    sha: str
    release_run_id: int
    release_run_attempt: int


@dataclass(frozen=True, slots=True)
class PreparedBundle:
    output_dir: Path
    notes_path: Path


@dataclass(frozen=True, slots=True)
class ReleaseIdentity:
    repository: str
    tag: str
    version: str
    sha: str
    tag_object_sha: str
    release_run_id: int
    release_run_attempt: int


@dataclass(frozen=True, slots=True)
class WorkflowEvidence:
    workflow: str
    run_id: int
    run_attempt: int
    event: str
    status: str
    conclusion: str
    head_branch: str
    head_sha: str
    url: str


def validate_request_shape(request: ReleaseRequest) -> None:
    if not isinstance(request.tag, str) or TAG_PATTERN.fullmatch(request.tag) is None:
        raise ReleasePublishError(
            f"release tag is not strict patch SemVer: {request.tag}"
        )
    if (
        not isinstance(request.repository, str)
        or REPOSITORY_PATTERN.fullmatch(request.repository) is None
    ):
        raise ReleasePublishError(
            f"invalid GitHub repository identity: {request.repository}"
        )
    if not isinstance(request.sha, str) or SHA_PATTERN.fullmatch(request.sha) is None:
        raise ReleasePublishError(
            f"release SHA must be a full lowercase commit SHA: {request.sha}"
        )
    if not _positive_int(request.release_run_id) or not _positive_int(
        request.release_run_attempt
    ):
        raise ReleasePublishError(
            "Release Validation run ID and attempt must be positive"
        )


def _positive_int(value: object) -> bool:
    return type(value) is int and value > 0


def _git(root: Path, *arguments: str) -> str:
    completed = subprocess.run(
        ["git", *arguments],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        detail = (
            completed.stderr.strip() or completed.stdout.strip() or "unknown git error"
        )
        raise ReleasePublishError(f"git {' '.join(arguments)} failed: {detail}")
    return completed.stdout.strip()


def validate_release_identity(root: Path, request: ReleaseRequest) -> ReleaseIdentity:
    validate_request_shape(request)
    version = request.tag.removeprefix("v")
    source_version = (root / "VERSION").read_text(encoding="utf-8").strip()
    if source_version != version:
        raise ReleasePublishError(
            f"tag {request.tag} does not match VERSION={source_version or '<empty>'}"
        )
    if _git(root, "rev-parse", "HEAD") != request.sha:
        raise ReleasePublishError(
            "checked-out HEAD does not match the validated release SHA"
        )
    if _git(root, "cat-file", "-t", f"refs/tags/{request.tag}") != "tag":
        raise ReleasePublishError(f"{request.tag} must be an annotated tag")
    if _git(root, "rev-parse", f"refs/tags/{request.tag}^{{commit}}") != request.sha:
        raise ReleasePublishError(
            f"{request.tag} does not resolve to the validated release SHA"
        )
    tag_object_sha = _git(root, "rev-parse", f"refs/tags/{request.tag}")
    if SHA_PATTERN.fullmatch(tag_object_sha) is None:
        raise ReleasePublishError(
            f"{request.tag} has an invalid annotated tag-object SHA"
        )
    return ReleaseIdentity(
        request.repository,
        request.tag,
        version,
        request.sha,
        tag_object_sha,
        request.release_run_id,
        request.release_run_attempt,
    )


def _request_json(url: str, token: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "Template-Tooling-release-publisher",
            "X-GitHub-Api-Version": "2026-03-10",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def _workflow_evidence(run: dict[str, Any], repository: str) -> WorkflowEvidence:
    try:
        run_id = run["id"]
        run_attempt = run["run_attempt"]
        base_url = run["html_url"]
        string_fields = (
            "name",
            "event",
            "status",
            "conclusion",
            "head_branch",
            "head_sha",
            "html_url",
        )
        if not _positive_int(run_id) or not _positive_int(run_attempt):
            raise ValueError("run ID and attempt must be positive integers")
        if any(not isinstance(run[field], str) for field in string_fields):
            raise ValueError("workflow evidence fields must be strings")
        expected_url = f"https://github.com/{repository}/actions/runs/{run_id}"
        if base_url.rstrip("/") != expected_url:
            raise ValueError("html_url does not identify the exact repository run")
        return WorkflowEvidence(
            workflow=run["name"],
            run_id=run_id,
            run_attempt=run_attempt,
            event=run["event"],
            status=run["status"],
            conclusion=run["conclusion"],
            head_branch=run["head_branch"],
            head_sha=run["head_sha"],
            url=f"{base_url.rstrip('/')}/attempts/{run_attempt}",
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ReleasePublishError(f"invalid GitHub Actions run payload: {exc}") from exc


def _successful_push(
    runs: list[dict[str, Any]],
    workflow: str,
    identity: ReleaseIdentity,
) -> WorkflowEvidence:
    workflow_path = REQUIRED_WORKFLOW_PATHS[workflow]
    matches = [
        run
        for run in runs
        if run.get("name") == workflow
        and run.get("path") == workflow_path
        and run.get("head_sha") == identity.sha
        and run.get("event") == "push"
        and run.get("status") == "completed"
        and run.get("conclusion") == "success"
        and run.get("head_branch") == "main"
    ]
    if not matches:
        raise ReleasePublishError(
            f"no successful main push run for {workflow} on exact SHA {identity.sha}"
        )
    evidence = tuple(_workflow_evidence(run, identity.repository) for run in matches)
    return max(evidence, key=lambda item: item.run_id)


def _workflow_runs(
    identity: ReleaseIdentity,
    workflow: str,
    *,
    token: str,
    api_url: str,
) -> list[dict[str, Any]]:
    workflow_file = Path(REQUIRED_WORKFLOW_PATHS[workflow]).name
    encoded_workflow = urllib.parse.quote(workflow_file, safe="")
    endpoint = f"{api_url.rstrip('/')}/repos/{identity.repository}/actions/workflows/{encoded_workflow}/runs"
    parameters = {
        "branch": "main",
        "event": "push",
        "head_sha": identity.sha,
        "status": "success",
        "per_page": 100,
    }
    runs: list[dict[str, Any]] = []
    for page in range(1, 11):
        query = urllib.parse.urlencode({**parameters, "page": page})
        payload = _request_json(f"{endpoint}?{query}", token)
        page_runs = payload.get("workflow_runs") if isinstance(payload, dict) else None
        total_count = payload.get("total_count") if isinstance(payload, dict) else None
        if (
            not isinstance(page_runs, list)
            or type(total_count) is not int
            or total_count < 0
        ):
            raise ReleasePublishError(
                f"GitHub Actions response for {workflow} is invalid"
            )
        if total_count > 1000:
            raise ReleasePublishError(
                f"GitHub Actions search for {workflow} exceeds the 1,000-run API limit"
            )
        runs.extend(item for item in page_runs if isinstance(item, dict))
        if len(runs) >= total_count or len(page_runs) < 100:
            return runs
    raise ReleasePublishError(
        f"GitHub Actions pagination for {workflow} did not terminate"
    )


def verify_remote_tag_identity(
    identity: ReleaseIdentity,
    *,
    token: str,
    api_url: str = "https://api.github.com",
) -> None:
    encoded_tag = urllib.parse.quote(identity.tag, safe="")
    base = f"{api_url.rstrip('/')}/repos/{identity.repository}/git"
    reference = _request_json(f"{base}/ref/tags/{encoded_tag}", token)
    reference_object = reference.get("object") if isinstance(reference, dict) else None
    if not isinstance(reference_object, dict):
        raise ReleasePublishError("remote release-tag reference payload is invalid")
    if (
        reference_object.get("type") != "tag"
        or reference_object.get("sha") != identity.tag_object_sha
    ):
        raise ReleasePublishError(
            "remote release tag is not the expected annotated tag object"
        )
    tag_object = _request_json(f"{base}/tags/{identity.tag_object_sha}", token)
    target = tag_object.get("object") if isinstance(tag_object, dict) else None
    valid_target = (
        isinstance(target, dict)
        and tag_object.get("tag") == identity.tag
        and target.get("type") == "commit"
        and target.get("sha") == identity.sha
    )
    if not valid_target:
        raise ReleasePublishError(
            "remote annotated tag does not resolve to the validated release SHA"
        )


def collect_workflow_evidence(
    identity: ReleaseIdentity,
    *,
    token: str,
    api_url: str = "https://api.github.com",
) -> tuple[WorkflowEvidence, ...]:
    evidence = [
        _successful_push(
            _workflow_runs(identity, name, token=token, api_url=api_url),
            name,
            identity,
        )
        for name in REQUIRED_WORKFLOWS
    ]
    release_url = f"{api_url.rstrip('/')}/repos/{identity.repository}/actions/runs/{identity.release_run_id}"
    release_run = _request_json(release_url, token)
    if not isinstance(release_run, dict):
        raise ReleasePublishError(
            "triggering Release Validation run payload is invalid"
        )
    expected_release = {
        "id": identity.release_run_id,
        "run_attempt": identity.release_run_attempt,
        "name": RELEASE_WORKFLOW,
        "path": RELEASE_WORKFLOW_PATH,
        "head_sha": identity.sha,
        "head_branch": identity.tag,
        "event": "push",
        "status": "completed",
        "conclusion": "success",
    }
    mismatches = [
        key for key, value in expected_release.items() if release_run.get(key) != value
    ]
    if mismatches:
        raise ReleasePublishError(
            f"triggering Release Validation run has invalid fields: {', '.join(mismatches)}"
        )
    evidence.append(_workflow_evidence(release_run, identity.repository))
    return tuple(evidence)


def ensure_immutable_releases_enabled(
    repository: str,
    *,
    token: str,
    api_url: str = "https://api.github.com",
) -> None:
    if (
        not isinstance(repository, str)
        or REPOSITORY_PATTERN.fullmatch(repository) is None
    ):
        raise ReleasePublishError(f"invalid GitHub repository identity: {repository}")
    url = f"{api_url.rstrip('/')}/repos/{repository}/immutable-releases"
    try:
        payload = _request_json(url, token)
    except urllib.error.HTTPError as exc:
        raise ReleasePublishError(
            f"could not prove immutable releases are enabled: HTTP {exc.code}"
        ) from exc
    except (OSError, ValueError) as exc:
        raise ReleasePublishError(
            f"could not prove immutable releases are enabled: {exc}"
        ) from exc
    if not isinstance(payload, dict) or payload.get("enabled") is not True:
        raise ReleasePublishError(
            "repository does not report native immutable releases as enabled"
        )


def _tag_ruleset_summaries(
    identity: ReleaseIdentity,
    *,
    token: str,
    api_url: str,
) -> list[dict[str, Any]]:
    endpoint = f"{api_url.rstrip('/')}/repos/{identity.repository}/rulesets"
    summaries: list[dict[str, Any]] = []
    for page in range(1, 11):
        query = urllib.parse.urlencode(
            {
                "includes_parents": "true",
                "targets": "tag",
                "per_page": 100,
                "page": page,
            }
        )
        payload = _request_json(f"{endpoint}?{query}", token)
        if not isinstance(payload, list):
            raise ReleasePublishError("GitHub tag-ruleset list payload is invalid")
        summaries.extend(item for item in payload if isinstance(item, dict))
        if len(payload) < 100:
            return summaries
    raise ReleasePublishError("GitHub tag-ruleset pagination exceeds 1,000 entries")


def _tag_ruleset_is_sufficient(payload: Any) -> bool:
    if not isinstance(payload, dict):
        return False
    conditions = payload.get("conditions")
    ref_name = conditions.get("ref_name") if isinstance(conditions, dict) else None
    include = ref_name.get("include") if isinstance(ref_name, dict) else None
    exclude = ref_name.get("exclude") if isinstance(ref_name, dict) else None
    rules = payload.get("rules")
    rule_types = (
        {
            item["type"]
            for item in rules
            if isinstance(item, dict) and isinstance(item.get("type"), str)
        }
        if isinstance(rules, list)
        else set()
    )
    return (
        payload.get("target") == "tag"
        and payload.get("enforcement") == "active"
        and payload.get("bypass_actors") == []
        and isinstance(include, list)
        and all(isinstance(pattern, str) for pattern in include)
        and bool(RELEASE_TAG_RULE_PATTERNS.intersection(include))
        and exclude == []
        and {"update", "deletion"}.issubset(rule_types)
    )


def ensure_release_tag_ruleset(
    identity: ReleaseIdentity,
    *,
    token: str,
    api_url: str = "https://api.github.com",
) -> None:
    try:
        summaries = _tag_ruleset_summaries(identity, token=token, api_url=api_url)
        details = [
            _request_json(
                f"{api_url.rstrip('/')}/repos/{identity.repository}/rulesets/{int(item['id'])}?includes_parents=true",
                token,
            )
            for item in summaries
            if type(item.get("id")) is int and item["id"] > 0
        ]
    except urllib.error.HTTPError as exc:
        raise ReleasePublishError(
            f"could not prove release-tag ruleset protection: HTTP {exc.code}"
        ) from exc
    except (KeyError, OSError, TypeError, ValueError) as exc:
        raise ReleasePublishError(
            f"could not prove release-tag ruleset protection: {exc}"
        ) from exc
    if not any(_tag_ruleset_is_sufficient(payload) for payload in details):
        raise ReleasePublishError(
            "no active non-bypassable tag ruleset protects refs/tags/v* from update and deletion"
        )
