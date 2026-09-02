"""Application version consistency and deterministic synchronization."""

from __future__ import annotations

import json
import os
import re
import subprocess
import tomllib
from dataclasses import dataclass
from pathlib import Path

from tools.paths import ProjectPaths, project_paths
from tools.project_config import ConfigError, application_version


@dataclass(frozen=True, slots=True)
class VersionCheck:
    name: str
    passed: bool
    detail: str


def changelog_section(changelog: str, version: str) -> str | None:
    match = re.search(
        rf"^## \[{re.escape(version)}\](?:\s+-\s+[^\n]+)?\s*$\n(.*?)(?=^## \[|\Z)",
        changelog,
        re.MULTILINE | re.DOTALL,
    )
    if match is None:
        return None
    content = match.group(1).strip()
    return content or None


def _read_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return payload


def collect_version_checks(paths: ProjectPaths | None = None) -> list[VersionCheck]:
    project = paths or project_paths()
    try:
        expected = application_version(project)
    except (OSError, ConfigError) as exc:
        return [VersionCheck("VERSION", False, str(exc))]
    checks = [VersionCheck("VERSION", True, expected)]
    try:
        package = _read_json(project.desktop / "package.json")
        cargo = tomllib.loads((project.tauri / "Cargo.toml").read_text(encoding="utf-8"))
        tauri = _read_json(project.tauri / "tauri.conf.json")
        cargo_lock = tomllib.loads((project.tauri / "Cargo.lock").read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError, tomllib.TOMLDecodeError) as exc:
        checks.append(VersionCheck("metadata", False, f"could not read metadata: {exc}"))
        return checks
    package_name = str(cargo.get("package", {}).get("name", ""))
    locked = next(
        (
            item
            for item in cargo_lock.get("package", [])
            if isinstance(item, dict) and item.get("name") == package_name
        ),
        {},
    )
    values = {
        "package.json": str(package.get("version", "")),
        "Cargo.toml": str(cargo.get("package", {}).get("version", "")),
        "Cargo.lock": str(locked.get("version", "")),
        "tauri.conf.json": str(tauri.get("version", "")),
    }
    for name, actual in values.items():
        checks.append(
            VersionCheck(
                name,
                actual == expected,
                f"{actual or '<missing>'}; expected {expected}",
            )
        )
    changelog = project.changelog.read_text(encoding="utf-8")
    version_section = changelog_section(changelog, expected)
    unreleased_heading = re.search(r"^## \[Unreleased\]\s*$", changelog, re.MULTILINE)
    placeholder = bool(
        version_section
        and re.search(r"\b(?:TBD|TODO|PLACEHOLDER)\b", version_section, re.IGNORECASE)
    )
    checks.append(
        VersionCheck(
            "CHANGELOG.md",
            version_section is not None and not placeholder and unreleased_heading is not None,
            (
                f"non-empty entry for {expected} and Unreleased section present"
                if version_section is not None
                and not placeholder
                and unreleased_heading is not None
                else "current release notes are missing, contain placeholders, or Unreleased is absent"
            ),
        )
    )
    tag = _current_tag(project)
    if tag:
        expected_tag = f"v{expected}"
        checks.append(
            VersionCheck("release tag", tag == expected_tag, f"{tag}; expected {expected_tag}")
        )
    return checks


def _current_tag(paths: ProjectPaths) -> str:
    ref = os.environ.get("GITHUB_REF", "")
    if os.environ.get("GITHUB_REF_TYPE") == "tag" or ref.startswith("refs/tags/"):
        return os.environ.get("GITHUB_REF_NAME") or ref.removeprefix("refs/tags/")
    symbolic = subprocess.run(
        ["git", "symbolic-ref", "-q", "HEAD"],
        cwd=paths.root,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if symbolic.returncode == 0:
        return ""
    tags = subprocess.run(
        ["git", "tag", "--points-at", "HEAD"],
        cwd=paths.root,
        check=False,
        capture_output=True,
        text=True,
    )
    if tags.returncode == 0:
        values = sorted(tag for tag in tags.stdout.splitlines() if tag)
        if len(values) == 1:
            return values[0]
        expected = f"v{application_version(paths)}"
        if expected in values:
            return expected
    return ""


def check_versions(*, json_output: bool = False, paths: ProjectPaths | None = None) -> int:
    checks = collect_version_checks(paths)
    if json_output:
        payload = {
            "checks": [
                {
                    "detail": check.detail,
                    "name": check.name,
                    "status": "ok" if check.passed else "fail",
                }
                for check in checks
            ],
            "ok": all(check.passed for check in checks),
        }
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        for check in checks:
            print(f"[{'OK' if check.passed else 'FAIL'}] {check.name}: {check.detail}")
    return 0 if all(check.passed for check in checks) else 1


def _replace_package_version(text: str, expected: str) -> str:
    lines = text.splitlines(keepends=True)
    in_package = False
    replaced = False
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("["):
            in_package = stripped == "[package]"
        elif in_package and stripped.startswith("version ="):
            newline = "\n" if line.endswith("\n") else ""
            lines[index] = f'version = "{expected}"{newline}'
            replaced = True
            break
    if not replaced:
        raise ValueError("Cargo.toml has no package.version")
    return "".join(lines)


def _replace_locked_version(text: str, package_name: str, expected: str) -> str:
    lines = text.splitlines(keepends=True)
    section_start: int | None = None
    for index, line in enumerate(lines):
        if line.strip() == "[[package]]":
            section_start = index
        elif section_start is not None and line.strip() == f'name = "{package_name}"':
            for inner in range(index + 1, len(lines)):
                if lines[inner].strip() == "[[package]]":
                    break
                if lines[inner].strip().startswith("version ="):
                    newline = "\n" if lines[inner].endswith("\n") else ""
                    lines[inner] = f'version = "{expected}"{newline}'
                    return "".join(lines)
    raise ValueError(f"Cargo.lock has no package entry for {package_name}")


def sync_versions(paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    try:
        expected = application_version(project)
        package_path = project.desktop / "package.json"
        package = _read_json(package_path)
        package["version"] = expected
        package_path.write_text(
            json.dumps(package, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        tauri_path = project.tauri / "tauri.conf.json"
        tauri = _read_json(tauri_path)
        tauri["version"] = expected
        tauri_path.write_text(
            json.dumps(tauri, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        cargo_path = project.tauri / "Cargo.toml"
        cargo_text = cargo_path.read_text(encoding="utf-8")
        cargo = tomllib.loads(cargo_text)
        package_name = str(cargo.get("package", {}).get("name", ""))
        cargo_path.write_text(
            _replace_package_version(cargo_text, expected), encoding="utf-8", newline="\n"
        )
        lock_path = project.tauri / "Cargo.lock"
        lock_path.write_text(
            _replace_locked_version(lock_path.read_text(encoding="utf-8"), package_name, expected),
            encoding="utf-8",
            newline="\n",
        )
    except (OSError, ValueError, ConfigError, json.JSONDecodeError, tomllib.TOMLDecodeError) as exc:
        print(f"[FAIL] version sync: {exc}")
        return 1
    print(f"[OK] synchronized owned version metadata to {expected}")
    return 0
