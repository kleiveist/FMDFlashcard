from __future__ import annotations

import json
import re
import runpy
import subprocess
from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any

import pytest
import yaml

from tools.paths import project_paths
from tools.project_config import load_release_matrix

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_ROOT = ROOT / ".github" / "workflows"
ACTION_ROOT = ROOT / ".github" / "actions"
EXPECTED_WORKFLOWS = {
    "_build-desktop.yml",
    "ci-documentation.yml",
    "ci-nightly.yml",
    "ci-quality.yml",
    "ci-tauri.yml",
    "ci-tests.yml",
    "release.yml",
}
PUBLICATION_SCOPES = {
    "attestations": "write",
    "contents": "write",
    "id-token": "write",
}
FORBIDDEN_RUNTIME_PREFIXES = (
    "apps/UserGlobal/",
    ".dist/",
    ".reports/",
    ".tooling-state/",
)


def _load_yaml(path: Path) -> dict[str, Any]:
    payload = yaml.load(path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    assert isinstance(payload, dict), f"{path} must contain a YAML mapping"
    return payload


def _workflows() -> dict[str, dict[str, Any]]:
    return {
        path.name: _load_yaml(path)
        for path in sorted(WORKFLOW_ROOT.iterdir())
        if path.is_file() and path.suffix in {".yml", ".yaml"}
    }


def _mapping(value: object, *, context: str) -> Mapping[str, Any]:
    assert isinstance(value, dict), f"{context} must be a mapping"
    return value


def _needs(job: Mapping[str, Any]) -> set[str]:
    value = job.get("needs", [])
    if isinstance(value, str):
        return {value}
    assert isinstance(value, list), "job.needs must be a string or list"
    return {str(item) for item in value}


def _walk(value: object) -> Iterator[tuple[str, object]]:
    if isinstance(value, dict):
        for key, child in value.items():
            yield str(key), child
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _external_uses_lines(path: Path) -> Iterator[str]:
    for line in path.read_text(encoding="utf-8").splitlines():
        if re.match(r"^\s*-?\s*uses:\s*\./", line):
            continue
        if re.match(r"^\s*-?\s*uses:\s*", line):
            yield line


def _job_steps_text(job: Mapping[str, Any]) -> list[str]:
    steps = job.get("steps")
    assert isinstance(steps, list)
    return [json.dumps(step, sort_keys=True) for step in steps]


def test_workflow_inventory_uses_only_yaml_suffixes() -> None:
    files = {path.name for path in WORKFLOW_ROOT.iterdir() if path.is_file()}
    invalid = sorted(
        path.name
        for path in WORKFLOW_ROOT.iterdir()
        if path.is_file() and path.suffix not in {".yml", ".yaml"}
    )

    assert invalid == []
    assert EXPECTED_WORKFLOWS <= files
    assert not (WORKFLOW_ROOT / "build-pdf.md").exists()


def test_expected_triggers_are_present_without_required_check_path_filters() -> None:
    workflows = _workflows()
    branch_workflows = (
        "ci-quality.yml",
        "ci-tests.yml",
        "ci-documentation.yml",
        "ci-tauri.yml",
    )
    for name in branch_workflows:
        triggers = _mapping(workflows[name].get("on"), context=f"{name}.on")
        assert {"pull_request", "push"} <= set(triggers)
        push = _mapping(triggers["push"], context=f"{name}.on.push")
        assert push.get("branches") == ["main"]
        assert (
            "paths" not in triggers["pull_request"]
            if isinstance(triggers["pull_request"], dict)
            else True
        )
        assert (
            "paths-ignore" not in triggers["pull_request"]
            if isinstance(triggers["pull_request"], dict)
            else True
        )
        assert "paths" not in push and "paths-ignore" not in push

    nightly = _mapping(workflows["ci-nightly.yml"]["on"], context="nightly.on")
    assert {"schedule", "workflow_dispatch"} <= set(nightly)
    assert "pull_request" not in nightly and "push" not in nightly

    reusable = _mapping(workflows["_build-desktop.yml"]["on"], context="native-build.on")
    assert set(reusable) == {"workflow_call"}

    release = _mapping(workflows["release.yml"]["on"], context="release.on")
    assert "pull_request" not in release
    assert set(_mapping(release["push"], context="release.on.push").get("tags", [])) == {"v*"}
    assert "workflow_dispatch" in release


def test_permissions_are_read_only_except_one_final_publication_job() -> None:
    write_jobs: list[tuple[str, str, Mapping[str, Any]]] = []
    for workflow_name, workflow in _workflows().items():
        assert workflow.get("permissions") == {"contents": "read"}, workflow_name
        jobs = _mapping(workflow.get("jobs"), context=f"{workflow_name}.jobs")
        for job_name, raw_job in jobs.items():
            job = _mapping(raw_job, context=f"{workflow_name}.{job_name}")
            permissions = job.get("permissions")
            if permissions is None:
                continue
            permission_map = _mapping(
                permissions, context=f"{workflow_name}.{job_name}.permissions"
            )
            if any(value == "write" for value in permission_map.values()):
                write_jobs.append((workflow_name, job_name, permission_map))
            else:
                assert all(value == "read" for value in permission_map.values())

    assert write_jobs == [("release.yml", "publish", PUBLICATION_SCOPES)]


def test_all_executable_jobs_have_timeouts_and_all_workflows_have_concurrency() -> None:
    for workflow_name, workflow in _workflows().items():
        concurrency = _mapping(workflow.get("concurrency"), context=f"{workflow_name}.concurrency")
        assert concurrency.get("group"), workflow_name
        assert concurrency.get("cancel-in-progress") in {"true", "false"} or str(
            concurrency.get("cancel-in-progress", "")
        ).startswith("${{")

        jobs = _mapping(workflow.get("jobs"), context=f"{workflow_name}.jobs")
        for job_name, raw_job in jobs.items():
            job = _mapping(raw_job, context=f"{workflow_name}.{job_name}")
            if "steps" in job:
                timeout = job.get("timeout-minutes")
                assert timeout is not None, f"{workflow_name}:{job_name} has no timeout"
                assert 1 <= int(timeout) <= 180
            else:
                assert str(job.get("uses", "")).startswith("./.github/workflows/")


def test_external_actions_and_container_images_are_immutably_pinned() -> None:
    sources = [*sorted(WORKFLOW_ROOT.glob("*.y*ml")), *sorted(ACTION_ROOT.rglob("*.y*ml"))]
    action_line = re.compile(r"^\s*-?\s*uses:\s*[^\s@]+@([0-9a-f]{40})\s+#\s+\S.*$")
    violations: list[str] = []
    for path in sources:
        for line in _external_uses_lines(path):
            if action_line.fullmatch(line) is None:
                violations.append(f"{path.relative_to(ROOT)}:{line.strip()}")
        for line in path.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*(?:docker_image|image):\s*([^\s#]+)", line)
            if match and "@sha256:" not in match.group(1):
                violations.append(f"{path.relative_to(ROOT)}:{line.strip()}")

    assert violations == []


def test_composite_setup_installs_corepack_without_global_shim_collisions() -> None:
    setup = (ACTION_ROOT / "setup-fmd-environment" / "action.yml").read_text(encoding="utf-8")

    assert "npm install --global" not in setup
    assert "--prefix $corepackRoot" in setup
    assert 'Join-Path $env:RUNNER_TEMP "fmd-corepack"' in setup
    assert "$env:GITHUB_PATH" in setup
    assert 'corepack prepare "pnpm@${{ steps.versions.outputs.pnpm }}" --activate' in setup


def test_checkouts_never_persist_job_credentials() -> None:
    violations: list[str] = []
    for workflow_name, workflow in _workflows().items():
        for job_name, raw_job in _mapping(workflow.get("jobs"), context=workflow_name).items():
            job = _mapping(raw_job, context=f"{workflow_name}.{job_name}")
            for step in job.get("steps", []):
                if not isinstance(step, dict) or not str(step.get("uses", "")).startswith(
                    "actions/checkout@"
                ):
                    continue
                with_values = step.get("with", {})
                if (
                    not isinstance(with_values, dict)
                    or with_values.get("persist-credentials") != "false"
                ):
                    violations.append(f"{workflow_name}:{job_name}")

    assert violations == []


def test_required_workflows_do_not_suppress_failures_or_write_to_main() -> None:
    violations: list[str] = []
    for path in sorted(WORKFLOW_ROOT.glob("*.y*ml")):
        text = path.read_text(encoding="utf-8")
        for token in (
            "continue-on-error:",
            "|| true",
            "git push",
            "git commit",
            "git checkout main",
            "--clobber",
        ):
            if token in text:
                violations.append(f"{path.name}:{token}")
        payload = _load_yaml(path)
        assert all(key != "continue-on-error" for key, _ in _walk(payload))

    assert violations == []


def test_dependency_audits_block_high_frontend_and_yanked_rust_packages() -> None:
    for name in ("ci-nightly.yml", "release.yml"):
        workflow = (WORKFLOW_ROOT / name).read_text(encoding="utf-8")
        assert "pnpm -C apps/fmd-desktop audit --prod --audit-level high" in workflow
        assert (
            "cargo audit --deny yanked --file apps/fmd-desktop/src-tauri/Cargo.lock"
        ) in workflow


def test_shell_scripts_never_interpolate_workflow_contexts_directly() -> None:
    unsafe = re.compile(r"\$\{\{\s*(?:github|inputs|matrix|needs|secrets)\.")
    violations: list[str] = []
    for workflow_name, workflow in _workflows().items():
        for key, value in _walk(workflow):
            if key == "run" and isinstance(value, str) and unsafe.search(value):
                violations.append(workflow_name)

    assert violations == []


def test_pull_request_workflows_neither_publish_nor_install_with_privilege() -> None:
    publication = re.compile(
        r"(?:gh\s+release\s+(?:create|edit|upload)|softprops/action-gh-release|"
        r"ncipollo/release-action)",
        re.IGNORECASE,
    )
    violations: list[str] = []
    for name, workflow in _workflows().items():
        triggers = _mapping(workflow.get("on"), context=f"{name}.on")
        if "pull_request" not in triggers:
            continue
        text = (WORKFLOW_ROOT / name).read_text(encoding="utf-8")
        if publication.search(text):
            violations.append(f"{name}:publication command")
        if re.search(r"(?m)^\s*sudo\s+", text):
            violations.append(f"{name}:privileged sudo installation")

    assert violations == []


def test_only_release_publication_job_contains_release_mutations() -> None:
    publication = re.compile(
        r"(?:gh\s+release\s+(?:create|edit|upload)|softprops/action-gh-release|"
        r"ncipollo/release-action)",
        re.IGNORECASE,
    )
    mutations: list[tuple[str, str]] = []
    for workflow_name, workflow in _workflows().items():
        jobs = _mapping(workflow.get("jobs"), context=f"{workflow_name}.jobs")
        for job_name, raw_job in jobs.items():
            job = _mapping(raw_job, context=f"{workflow_name}.{job_name}")
            if publication.search(json.dumps(job, sort_keys=True)):
                mutations.append((workflow_name, job_name))

    assert mutations == [("release.yml", "publish")]


def test_required_artifact_uploads_are_strict_and_finitely_retained() -> None:
    errors: list[str] = []
    for workflow_name, workflow in _workflows().items():
        jobs = _mapping(workflow.get("jobs"), context=f"{workflow_name}.jobs")
        for job_name, raw_job in jobs.items():
            job = _mapping(raw_job, context=f"{workflow_name}.{job_name}")
            for index, raw_step in enumerate(job.get("steps", [])):
                step = _mapping(raw_step, context=f"{workflow_name}.{job_name}.steps[{index}]")
                uses = str(step.get("uses", ""))
                if not uses.startswith("actions/upload-artifact@"):
                    continue
                options = _mapping(
                    step.get("with"),
                    context=f"{workflow_name}.{job_name}.steps[{index}].with",
                )
                if options.get("if-no-files-found") != "error":
                    errors.append(f"{workflow_name}:{job_name}:{index}:not strict")
                retention = options.get("retention-days")
                if retention is None:
                    errors.append(f"{workflow_name}:{job_name}:{index}:no retention")
                elif str(retention).isdigit() and not 1 <= int(retention) <= 30:
                    errors.append(f"{workflow_name}:{job_name}:{index}:bad retention")

    assert errors == []


@pytest.mark.parametrize(
    "workflow_name",
    ["ci-tauri.yml", "ci-nightly.yml", "release.yml"],
)
def test_native_workflow_matrix_represents_every_declared_target(
    workflow_name: str,
) -> None:
    matrix = load_release_matrix(project_paths(ROOT))
    workflow = _load_yaml(WORKFLOW_ROOT / workflow_name)
    jobs = _mapping(workflow.get("jobs"), context=f"{workflow_name}.jobs")
    rows: list[Mapping[str, Any]] = []
    for job_name, raw_job in jobs.items():
        job = _mapping(raw_job, context=f"{workflow_name}.{job_name}")
        strategy = job.get("strategy")
        if not isinstance(strategy, dict):
            continue
        matrix_payload = strategy.get("matrix")
        if not isinstance(matrix_payload, dict):
            continue
        include = matrix_payload.get("include", [])
        assert isinstance(include, list)
        rows.extend(row for row in include if isinstance(row, dict))

    for target in matrix.targets:
        matching = [row for row in rows if row.get("id") == target.target_id]
        assert matching, f"{workflow_name} omits {target.target_id}"
        assert any(
            row.get("runner") == target.runner and row.get("rust-target") == target.rust_target
            for row in matching
        ), f"{workflow_name} has a stale plan for {target.target_id}"


def test_matrix_packages_are_bound_to_native_runner_families() -> None:
    matrix = load_release_matrix(project_paths(ROOT))
    for target in matrix.targets:
        package_types = {artifact.package_type for artifact in target.artifacts}
        if "msi" in package_types:
            assert target.os == "windows" and target.runner.startswith("windows-")
        if package_types & {"dmg", "app-archive"}:
            assert target.os == "macos" and target.runner.startswith("macos-")
        if package_types & {"deb", "rpm", "appimage"}:
            assert target.os == "linux" and target.runner.startswith("ubuntu-")


def test_reusable_native_build_uploads_verified_manifest_evidence() -> None:
    text = (WORKFLOW_ROOT / "_build-desktop.yml").read_text(encoding="utf-8")
    assert "tools/control.py release collect" in text
    assert "--built-after" in text
    assert "manifest fragment" in text.lower()
    assert "desktop-${{ inputs.matrix-id }}" in text
    assert ".dist/release-fragments/${{ inputs.matrix-id }}" in text
    assert "if-no-files-found: error" in text


def test_windows_signing_config_is_explicit_and_thumbprint_is_masked() -> None:
    text = (WORKFLOW_ROOT / "_build-desktop.yml").read_text(encoding="utf-8")

    assert "::add-mask::$importedThumbprint" in text
    assert "FMD_WINDOWS_IMPORTED_THUMBPRINTS_PATH" in text
    assert "Where-Object { $_.HasPrivateKey }" in text
    assert "signingCertificates.Count -ne 1" in text
    assert "FMD_TAURI_SIGNING_CONFIG_PATH" in text
    assert "fmd-tauri-signing-config.json" in text
    assert "TAURI_CONFIG=$tauriConfig" not in text
    assert "sign_windows_portable.ps1" in (ROOT / "tools" / "commands" / "build.py").read_text(
        encoding="utf-8"
    )
    assert "Expand-Archive" in text
    assert "FMD_WINDOWS_CERTIFICATE_THUMBPRINT" in text


def test_release_publication_transitively_depends_on_every_gate() -> None:
    release = _load_yaml(WORKFLOW_ROOT / "release.yml")
    jobs = _mapping(release.get("jobs"), context="release.jobs")
    publish = _mapping(jobs.get("publish"), context="release.jobs.publish")

    visited: set[str] = set()

    def visit(job_name: str) -> None:
        for dependency in _needs(_mapping(jobs[job_name], context=job_name)):
            if dependency not in visited:
                visited.add(dependency)
                visit(dependency)

    visit("publish")
    assert visited == set(jobs) - {"publish"}
    assert "needs.assemble.result == 'success'" in str(publish.get("if", ""))


def test_manifest_and_checksums_are_reverified_before_publication() -> None:
    release = _load_yaml(WORKFLOW_ROOT / "release.yml")
    jobs = _mapping(release["jobs"], context="release.jobs")
    assemble_steps = "\n".join(
        _job_steps_text(_mapping(jobs["assemble"], context="release.assemble"))
    )
    publish_steps = _job_steps_text(_mapping(jobs["publish"], context="release.publish"))
    publish_text = "\n".join(publish_steps)

    assert "release assemble" in assemble_steps
    assert "release verify" in assemble_steps
    verify_index = next(
        index for index, step in enumerate(publish_steps) if "release verify" in step
    )
    attest_index = next(
        index for index, step in enumerate(publish_steps) if "subject-checksums" in step
    )
    publish_index = next(
        index for index, step in enumerate(publish_steps) if "gh release create" in step
    )
    assert verify_index < attest_index < publish_index
    assert "SHA256SUMS" in publish_text
    assert "write_artifact_summary.py" in assemble_steps


def test_sbom_generator_pins_release_bytes_and_never_executes_remote_installers() -> None:
    workflows = "\n".join(
        path.read_text(encoding="utf-8") for path in sorted(WORKFLOW_ROOT.glob("*.yml"))
    )
    generator = (ROOT / ".github" / "scripts" / "generate_sbom.py").read_text(encoding="utf-8")

    assert "generate_sbom.py" in workflows
    assert "install.sh" not in workflows and "anchore/sbom-action@" not in workflows
    assert 'SYFT_VERSION = "1.33.0"' in generator
    assert re.search(r'SYFT_LINUX_AMD64_SHA256 = "[0-9a-f]{64}"', generator)
    assert "digest.hexdigest() != SYFT_LINUX_AMD64_SHA256" in generator


def test_publication_uses_an_existing_verified_tag_and_never_creates_one() -> None:
    workflow_text = (WORKFLOW_ROOT / "release.yml").read_text(encoding="utf-8")
    gate_text = (ROOT / ".github" / "scripts" / "release_gate.py").read_text(encoding="utf-8")
    verifier_text = (ROOT / ".github" / "scripts" / "verify_release_tag.py").read_text(
        encoding="utf-8"
    )

    assert workflow_text.count("verify_release_tag.py") >= 3
    assert "source_sha" in workflow_text and '"source_sha": head_commit' in gate_text
    assert '"ls-remote", "--tags"' in verifier_text
    assert 'peeled_ref = f"{direct_ref}^{{}}"' in verifier_text
    assert "gh release view" in workflow_text
    assert '"--verify-tag"' in workflow_text or "--verify-tag" in workflow_text
    assert "refs/tags/{tag}^{{commit}}" in gate_text
    assert "release tag does not exist locally" in gate_text
    assert "git push" not in workflow_text and "git push" not in gate_text
    for line in workflow_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("git tag "):
            assert stripped.startswith(("git tag --list", "git tag --points-at"))


def test_manual_release_is_safe_by_default_and_requires_explicit_tag_to_publish() -> None:
    release = _load_yaml(WORKFLOW_ROOT / "release.yml")
    triggers = _mapping(release["on"], context="release.on")
    dispatch = _mapping(triggers["workflow_dispatch"], context="release.dispatch")
    inputs = _mapping(dispatch.get("inputs"), context="release.dispatch.inputs")
    publish = _mapping(inputs.get("publish"), context="release.dispatch.publish")
    tag = _mapping(inputs.get("tag"), context="release.dispatch.tag")

    assert publish.get("type") == "boolean"
    assert publish.get("default") == "false"
    assert tag.get("type") == "string"
    gate_text = (ROOT / ".github" / "scripts" / "release_gate.py").read_text(encoding="utf-8")
    assert "manual publication requires an explicit existing tag" in gate_text
    assert "tag != expected_tag" in gate_text
    assert "rev-parse" in gate_text and "refs/tags/" in gate_text


@pytest.mark.parametrize(
    ("version", "valid"),
    [
        ("0.2.0", True),
        ("1.2.3-alpha.1", True),
        ("1.2.3-rc.1+build.7", True),
        ("v1.2.3", False),
        ("01.2.3", False),
        ("1.2", False),
        ("1.2.3;git-tag", False),
    ],
)
def test_release_gate_uses_exact_semver(version: str, valid: bool) -> None:
    namespace = runpy.run_path(str(ROOT / ".github" / "scripts" / "release_gate.py"))
    pattern = namespace["SEMVER"]

    assert (pattern.fullmatch(version) is not None) is valid


@pytest.mark.parametrize(
    ("version", "expected"),
    [
        ("1.2.3", False),
        ("1.2.3+build-7", False),
        ("1.2.3-rc.1", True),
        ("1.2.3-rc.1+build-7", True),
    ],
)
def test_release_gate_classifies_prereleases_before_build_metadata(
    version: str, expected: bool
) -> None:
    namespace = runpy.run_path(str(ROOT / ".github" / "scripts" / "release_gate.py"))
    assert namespace["_is_prerelease"](version) is expected


def test_documentation_workflow_uploads_pdf_and_never_commits_it() -> None:
    documentation = (WORKFLOW_ROOT / "ci-documentation.yml").read_text(encoding="utf-8")
    release = (WORKFLOW_ROOT / "release.yml").read_text(encoding="utf-8")

    assert "FMDFlashcard-v$version-documentation.pdf" in documentation
    assert "name: documentation-pdf" in documentation
    assert "actions/upload-artifact@" in documentation
    assert "if-no-files-found: error" in documentation
    assert "name: documentation-pdf" in release
    assert "git commit" not in documentation and "git push" not in documentation


def test_no_owner_paths_or_runtime_sources_can_enter_release_contract() -> None:
    owner_path = re.compile(r"/(?:home|Users)/(?P<owner>[A-Za-z0-9._-]+)/")
    offenders: list[str] = []
    tracked = (
        subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=ROOT,
            check=True,
            capture_output=True,
        )
        .stdout.decode("utf-8")
        .split("\0")
    )
    text_suffixes = {
        ".cmd",
        ".html",
        ".js",
        ".json",
        ".md",
        ".ps1",
        ".py",
        ".sh",
        ".toml",
        ".ts",
        ".tsx",
        ".yaml",
        ".yml",
    }
    for relative in tracked:
        path = ROOT / relative
        if not relative or not path.is_file() or path.suffix not in text_suffixes:
            continue
        owners = {
            match.group("owner").lower()
            for match in owner_path.finditer(path.read_text(encoding="utf-8", errors="ignore"))
        }
        if owners - {"example", "user", "username"}:
            offenders.append(relative)
    assert offenders == []

    matrix = load_release_matrix(project_paths(ROOT))
    for target in matrix.targets:
        for artifact in target.artifacts:
            assert not artifact.source_glob.startswith(FORBIDDEN_RUNTIME_PREFIXES)

    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    tracked = result.stdout.decode("utf-8").split("\0")
    forbidden = sorted(path for path in tracked if path.startswith(FORBIDDEN_RUNTIME_PREFIXES))
    assert forbidden == []
