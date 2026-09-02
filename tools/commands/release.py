"""Read-only release gates and native artifact assembly commands."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tomllib
from dataclasses import dataclass
from pathlib import Path

from tools.artifacts import (
    ArtifactError,
    assemble_release,
    collect_target_artifacts,
    verify_manifest_directory,
)
from tools.commands.versioning import changelog_section, collect_version_checks
from tools.paths import ProjectPaths, ensure_within, project_paths
from tools.project_config import ConfigError, application_version, load_release_matrix


@dataclass(frozen=True, slots=True)
class ReleaseCheck:
    name: str
    status: str
    detail: str


def _check(name: str, passed: bool, detail: str, *, warning: bool = False) -> ReleaseCheck:
    status = "warn" if warning and not passed else ("ok" if passed else "fail")
    return ReleaseCheck(name, status, detail)


def _tagged(paths: ProjectPaths) -> bool:
    if os.environ.get("GITHUB_REF_TYPE") == "tag" or os.environ.get("GITHUB_REF", "").startswith(
        "refs/tags/"
    ):
        return True
    symbolic = subprocess.run(
        ["git", "symbolic-ref", "-q", "HEAD"],
        cwd=paths.root,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if symbolic.returncode == 0:
        return False
    tags = subprocess.run(
        ["git", "tag", "--points-at", "HEAD"],
        cwd=paths.root,
        check=False,
        capture_output=True,
        text=True,
    )
    expected = f"v{application_version(paths)}"
    return tags.returncode == 0 and expected in tags.stdout.splitlines()


def _git_status(paths: ProjectPaths) -> ReleaseCheck:
    result = subprocess.run(
        ["git", "status", "--porcelain=v1", "--untracked-files=all"],
        cwd=paths.root,
        check=False,
        capture_output=True,
        text=True,
    )
    clean = result.returncode == 0 and not result.stdout.strip()
    detail = "working tree is clean" if clean else "working tree contains changes"
    return _check("git-clean", clean, detail)


def _tracked_runtime_data(paths: ProjectPaths) -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=paths.root,
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        return ["<git ls-files failed>"]
    tracked = result.stdout.decode("utf-8").split("\0")
    forbidden_prefixes = (
        "apps/UserGlobal/",
        ".dist/",
        ".reports/",
        ".tooling-state/",
    )
    return sorted(path for path in tracked if path.startswith(forbidden_prefixes))


def _icons_valid(paths: ProjectPaths) -> bool:
    icon_dir = paths.tauri / "icons"
    required = ("icon.png", "icon.ico", "icon.icns", "32x32.png", "128x128.png")
    return all(
        (icon_dir / name).is_file() and (icon_dir / name).stat().st_size > 0 for name in required
    )


def _license_check(paths: ProjectPaths) -> ReleaseCheck:
    license_files = [
        path
        for name in ("LICENSE", "LICENSE.md", "COPYING")
        if (path := paths.root / name).is_file()
    ]
    if not license_files:
        return _check(
            "license",
            False,
            "no license terms are present; a tagged release is blocked",
            warning=not _tagged(paths),
        )
    if len(license_files) != 1:
        return _check("license", False, "exactly one canonical root license file is required")

    package = json.loads((paths.desktop / "package.json").read_text(encoding="utf-8"))
    cargo = tomllib.loads((paths.tauri / "Cargo.toml").read_text(encoding="utf-8"))
    tauri = json.loads((paths.tauri / "tauri.conf.json").read_text(encoding="utf-8"))
    npm_license = package.get("license")
    cargo_license = cargo.get("package", {}).get("license")
    if (
        not isinstance(npm_license, str)
        or not npm_license.strip()
        or npm_license in {"UNLICENSED", "SEE LICENSE IN LICENSE"}
        or cargo_license != npm_license
    ):
        return _check(
            "license",
            False,
            "package.json and Cargo.toml must declare the same explicit SPDX license expression",
        )
    license_setting = tauri.get("bundle", {}).get("licenseFile")
    if not isinstance(license_setting, str) or not license_setting.strip():
        return _check("license", False, "Tauri bundle.licenseFile must include the root license")
    bundled_license = (paths.tauri / license_setting).resolve(strict=False)
    if bundled_license != license_files[0].resolve():
        return _check(
            "license",
            False,
            "Tauri bundle.licenseFile does not resolve to the canonical root license",
        )
    return _check(
        "license",
        True,
        f"{license_files[0].name}, SPDX metadata, and native bundle inclusion agree",
    )


def _signing_check() -> ReleaseCheck:
    policy = os.environ.get("FMD_SIGNING_POLICY", "optional").lower()
    if policy not in {"optional", "required"}:
        return _check("signing-policy", False, "must be optional or required")
    required_names = {
        "WINDOWS_CERTIFICATE_BASE64",
        "WINDOWS_CERTIFICATE_PASSWORD",
        "APPLE_CERTIFICATE",
        "APPLE_CERTIFICATE_PASSWORD",
        "APPLE_SIGNING_IDENTITY",
        "APPLE_ID",
        "APPLE_PASSWORD",
        "APPLE_TEAM_ID",
    }
    presence: dict[str, bool] = {}
    for name in required_names:
        marker_name = f"FMD_{name}_PRESENT"
        marker = os.environ.get(marker_name, "").strip().lower()
        if marker not in {"", "true", "false"}:
            return _check(
                "signing-policy",
                False,
                f"{marker_name} must be true or false when supplied",
            )
        presence[name] = bool(os.environ.get(name)) or marker == "true"
    missing = sorted(name for name, configured in presence.items() if not configured)
    if policy == "required" and missing:
        return _check(
            "signing-policy",
            False,
            "required credentials are incomplete; see release-maintainer documentation",
        )
    return _check(
        "signing-policy",
        not missing,
        "credentials configured" if not missing else "unsigned validation build (optional policy)",
        warning=True,
    )


def collect_release_checks(paths: ProjectPaths | None = None) -> list[ReleaseCheck]:
    project = paths or project_paths()
    checks = [
        _check(item.name, item.passed, item.detail) for item in collect_version_checks(project)
    ]
    try:
        matrix = load_release_matrix(project)
        checks.append(
            _check(
                "release-matrix",
                True,
                f"{len(matrix.targets)} native targets and "
                f"{len(matrix.expected_filenames(application_version(project)))} assets",
            )
        )
    except (OSError, ConfigError) as exc:
        checks.append(_check("release-matrix", False, str(exc)))
    wrappers = (
        project.root / "control",
        project.root / "control.ps1",
        project.root / "control.cmd",
    )
    checks.append(
        _check(
            "entry-points",
            all(path.is_file() for path in wrappers) and os.access(wrappers[0], os.X_OK),
            "POSIX, PowerShell, and CMD wrappers are present",
        )
    )
    cargo_text = (project.tauri / "Cargo.toml").read_text(encoding="utf-8")
    package = json.loads((project.desktop / "package.json").read_text(encoding="utf-8"))
    placeholders = [
        value
        for value in ("A Tauri App", 'authors = ["you"]', "homecodeprojects")
        if value in cargo_text
    ]
    repository = package.get("repository")
    repository_url = repository.get("url") if isinstance(repository, dict) else repository
    metadata_valid = (
        not placeholders
        and package.get("private") is True
        and package.get("author") == "FMDFlashcard contributors"
        and package.get("homepage") == "https://github.com/kleiveist/FMDFlashcard"
        and repository_url == "https://github.com/kleiveist/FMDFlashcard.git"
        and 'authors = ["FMDFlashcard contributors"]' in cargo_text
        and 'repository = "https://github.com/kleiveist/FMDFlashcard"' in cargo_text
        and 'homepage = "https://github.com/kleiveist/FMDFlashcard"' in cargo_text
        and "publish = false" in cargo_text
    )
    checks.append(
        _check(
            "package-metadata",
            metadata_valid,
            "release metadata is populated"
            if metadata_valid
            else f"package metadata is incomplete; placeholders={placeholders}",
        )
    )
    checks.append(_license_check(project))
    forbidden = _tracked_runtime_data(project)
    checks.append(
        _check(
            "release-denylist",
            not forbidden,
            "no runtime/user output is tracked"
            if not forbidden
            else "forbidden tracked paths: " + ", ".join(forbidden),
        )
    )
    checks.append(
        _check("icons", _icons_valid(project), "required native icons are present and non-empty")
    )
    config = json.loads((project.tauri / "tauri.conf.json").read_text(encoding="utf-8"))
    security = config.get("app", {}).get("security", {})
    broad_scope = security.get("csp") is None or security.get("assetProtocol", {}).get("scope") == [
        "**"
    ]
    checks.append(
        _check(
            "tauri-security-review",
            not broad_scope,
            "CSP and asset scope are restricted"
            if not broad_scope
            else "existing null CSP/broad asset scope retained; see documented security follow-up",
            warning=True,
        )
    )
    required_workflows = {
        "ci-quality.yml",
        "ci-tests.yml",
        "ci-documentation.yml",
        "ci-tauri.yml",
        "ci-nightly.yml",
        "_build-desktop.yml",
        "release.yml",
    }
    present_workflows = {path.name for path in project.workflows.glob("*.y*ml")}
    checks.append(
        _check(
            "workflows",
            required_workflows <= present_workflows,
            "required CI/release workflows are present",
        )
    )
    checks.append(_signing_check())
    checks.append(_git_status(project))
    return checks


def check_release(*, json_output: bool = False, paths: ProjectPaths | None = None) -> int:
    try:
        checks = collect_release_checks(paths)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        checks = [ReleaseCheck("release-check", "fail", str(exc))]
    passed = all(check.status != "fail" for check in checks)
    if json_output:
        print(
            json.dumps(
                {
                    "checks": [
                        {"detail": item.detail, "name": item.name, "status": item.status}
                        for item in checks
                    ],
                    "ok": passed,
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        for item in checks:
            print(f"[{item.status.upper()}] {item.name}: {item.detail}")
    return 0 if passed else 1


def release_notes(output: Path, paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    version = application_version(project)
    changelog = project.changelog.read_text(encoding="utf-8")
    section = changelog_section(changelog, version)
    if section is None:
        print(f"[FAIL] CHANGELOG.md has no release notes for {version}")
        return 1
    destination = output.resolve(strict=False)
    try:
        ensure_within(destination, project.root, label="release notes")
    except ValueError as exc:
        print(f"[FAIL] release notes: {exc}")
        return 1
    content = f"# FMDFlashcard {version}\n\n{section}\n"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding="utf-8", newline="\n")
    print(f"[OK] wrote release notes to {destination}")
    return 0


def handle(args: argparse.Namespace) -> int:
    command = getattr(args, "release_command", None)
    if command == "check":
        return check_release(json_output=getattr(args, "json", False))
    try:
        if command == "collect":
            marker = Path(args.built_after) if args.built_after else None
            fragment = collect_target_artifacts(
                args.matrix_id,
                output_dir=Path(args.output_dir),
                built_after=marker,
            )
            print(f"[OK] wrote {fragment}")
            return 0
        if command == "assemble":
            manifest, checksums = assemble_release(
                input_dir=Path(args.input_dir),
                output_dir=Path(args.output_dir),
                tag=args.tag,
            )
            print(f"[OK] assembled {manifest.parent}")
            print(f"[OK] verified {checksums}")
            return 0
        if command == "verify":
            verify_manifest_directory(Path(args.directory))
            print(f"[OK] verified release assets in {args.directory}")
            return 0
        if command == "notes":
            return release_notes(Path(args.output))
    except (ArtifactError, ConfigError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"[FAIL] release {command}: {exc}")
        return 1
    parser = getattr(args, "release_parser", None)
    if parser is not None:
        parser.print_help()
        return 0
    return 2
