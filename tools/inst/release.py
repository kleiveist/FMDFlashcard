from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tomllib

from tools import logger
from tools.core.context import ProjectContext, load_context
from tools.profiles import runtime as profile_runtime

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent
SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve release metadata paths for the current target project."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


@dataclass(frozen=True, slots=True)
class ReleaseCheck:
    name: str
    status: str
    message: str


def source_version() -> str:
    context = _context()
    for path in (context.project_root / "VERSION", context.tools_root / "VERSION"):
        try:
            value = path.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if value:
            return value
    return ""


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise TypeError(f"{path} must contain a JSON object")
    return payload


def collect_version_checks() -> list[ReleaseCheck]:
    expected = source_version()
    if not expected:
        return [ReleaseCheck("version:source", "FAIL", "VERSION is missing or empty")]
    checks = [
        ReleaseCheck(
            "version:source",
            "OK" if SEMVER.fullmatch(expected) else "FAIL",
            f"VERSION={expected}"
            if SEMVER.fullmatch(expected)
            else f"VERSION is not SemVer: {expected}",
        )
    ]
    profile = profile_runtime.active_profile(ROOT)
    context = _context()
    frontend_dir = context.paths.frontend
    tauri_dir = context.paths.tauri
    versions: list[tuple[str, str]] = []
    try:
        if profile.has_feature("frontend"):
            package = _read_json(frontend_dir / "package.json")
            package_lock = _read_json(frontend_dir / "package-lock.json")
            lock_packages = package_lock.get("packages", {})
            lock_root = (
                lock_packages.get("", {}) if isinstance(lock_packages, dict) else {}
            )
            versions.extend(
                [
                    ("frontend/package.json", str(package.get("version", ""))),
                    (
                        "frontend/package-lock.json",
                        str(package_lock.get("version", "")),
                    ),
                    (
                        "frontend/package-lock.json root package",
                        str(lock_root.get("version", ""))
                        if isinstance(lock_root, dict)
                        else "",
                    ),
                ]
            )
        if profile.has_feature("tauri"):
            tauri = _read_json(tauri_dir / "tauri.conf.json")
            cargo = tomllib.loads(
                (tauri_dir / "Cargo.toml").read_text(encoding="utf-8")
            )
            cargo_name = str(cargo.get("package", {}).get("name", ""))
            cargo_lock = tomllib.loads(
                (tauri_dir / "Cargo.lock").read_text(encoding="utf-8")
            )
            locked_root = next(
                (
                    item
                    for item in cargo_lock.get("package", [])
                    if isinstance(item, dict) and item.get("name") == cargo_name
                ),
                {},
            )
            versions.extend(
                [
                    ("src-tauri/tauri.conf.json", str(tauri.get("version", ""))),
                    (
                        "src-tauri/Cargo.toml",
                        str(cargo.get("package", {}).get("version", "")),
                    ),
                    (
                        "src-tauri/Cargo.lock root package",
                        str(locked_root.get("version", "")),
                    ),
                ]
            )
    except (
        OSError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        tomllib.TOMLDecodeError,
    ) as exc:
        checks.append(
            ReleaseCheck(
                "version:metadata", "FAIL", f"Could not read version metadata: {exc}"
            )
        )
        return checks

    for path, actual in versions:
        checks.append(
            ReleaseCheck(
                f"version:{Path(path).name}",
                "OK" if actual == expected else "FAIL",
                f"{path}={actual or '<missing>'}; expected {expected}",
            )
        )
    return checks


def _placeholder_checks() -> list[ReleaseCheck]:
    context = _context()
    if not context.config_exists:
        return [
            ReleaseCheck(
                "project-identity",
                "WARN",
                "project-tooling.toml is absent; release identity is inferred from the directory name",
            )
        ]
    return [
        ReleaseCheck(
            "project-identity",
            "OK",
            f"project identity is configured as {context.config.project_name!r}",
        )
    ]


def _tauri_security_checks() -> list[ReleaseCheck]:
    if not profile_runtime.feature_enabled("tauri", ROOT):
        return [
            ReleaseCheck("tauri-security", "OK", "Tauri disabled by active profile")
        ]
    tauri_dir = _context().paths.tauri
    try:
        config = _read_json(tauri_dir / "tauri.conf.json")
        capabilities = _read_json(tauri_dir / "capabilities" / "default.json")
    except (OSError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return [
            ReleaseCheck(
                "tauri-security",
                "FAIL",
                f"Could not read Tauri security configuration: {exc}",
            )
        ]
    csp = config.get("app", {}).get("security", {}).get("csp")
    hardened_csp = (
        isinstance(csp, str)
        and "default-src 'self'" in csp
        and "'unsafe-eval'" not in csp
        and "*" not in csp
    )
    checks = [
        ReleaseCheck(
            "tauri-csp",
            "OK" if hardened_csp else "WARN",
            "Tauri CSP is explicitly restricted"
            if hardened_csp
            else "Tauri CSP is not production hardened.",
        )
    ]
    permissions = capabilities.get("permissions", [])
    unexpected = (
        [item for item in permissions if item != "core:default"]
        if isinstance(permissions, list)
        else ["invalid"]
    )
    checks.append(
        ReleaseCheck(
            "tauri-capabilities",
            "OK" if not unexpected else "WARN",
            "only core:default is enabled"
            if not unexpected
            else f"review additional permissions: {unexpected}",
        )
    )
    return checks


def _git_check() -> ReleaseCheck:
    try:
        probe = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        return ReleaseCheck("git", "WARN", f"working tree status unavailable: {exc}")
    if probe.returncode != 0:
        return ReleaseCheck("git", "WARN", "working tree status unavailable")
    return ReleaseCheck(
        "git",
        "OK" if not probe.stdout.strip() else "FAIL",
        "working tree is clean"
        if not probe.stdout.strip()
        else "working tree contains uncommitted changes",
    )


def _signing_checks() -> list[ReleaseCheck]:
    if not profile_runtime.feature_enabled("tauri", ROOT):
        return []
    expected = (
        "WINDOWS_CERTIFICATE_BASE64",
        "WINDOWS_CERTIFICATE_PASSWORD",
        "APPLE_CERTIFICATE",
        "APPLE_CERTIFICATE_PASSWORD",
        "APPLE_SIGNING_IDENTITY",
        "APPLE_ID",
        "APPLE_PASSWORD",
        "APPLE_TEAM_ID",
    )
    configured = [name for name in expected if os.environ.get(name)]
    return [
        ReleaseCheck(
            "signing",
            "OK" if len(configured) == len(expected) else "WARN",
            "signing environment is configured"
            if len(configured) == len(expected)
            else "verification build is unsigned; production signing remains externally configured",
        )
    ]


def _tag_check() -> ReleaseCheck:
    ref_type = os.environ.get("GITHUB_REF_TYPE", "")
    ref = os.environ.get("GITHUB_REF", "")
    if ref_type != "tag" and not ref.startswith("refs/tags/"):
        return ReleaseCheck("release-tag", "OK", "validation is not tag-triggered")
    tag = os.environ.get("GITHUB_REF_NAME") or ref.removeprefix("refs/tags/")
    expected = f"v{source_version()}"
    return ReleaseCheck(
        "release-tag",
        "OK" if tag == expected else "FAIL",
        f"tag {tag or '<missing>'}; expected {expected}",
    )


def sync_versions() -> int:
    expected = source_version()
    if not SEMVER.fullmatch(expected):
        logger.fail(f"VERSION is missing or not valid SemVer: {expected or '<empty>'}")
        return 1
    profile = profile_runtime.active_profile(ROOT)
    context = _context()
    frontend_dir = context.paths.frontend
    tauri_dir = context.paths.tauri
    try:
        if profile.has_feature("frontend"):
            package_path = frontend_dir / "package.json"
            package = _read_json(package_path)
            package["version"] = expected
            package_path.write_text(
                json.dumps(package, indent=2) + "\n", encoding="utf-8", newline="\n"
            )

            lock_path = frontend_dir / "package-lock.json"
            package_lock = _read_json(lock_path)
            package_lock["version"] = expected
            packages = package_lock.get("packages")
            if isinstance(packages, dict) and isinstance(packages.get(""), dict):
                packages[""]["version"] = expected
            lock_path.write_text(
                json.dumps(package_lock, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )

        if profile.has_feature("tauri"):
            tauri_path = tauri_dir / "tauri.conf.json"
            tauri = _read_json(tauri_path)
            tauri["version"] = expected
            tauri_path.write_text(
                json.dumps(tauri, indent=2) + "\n", encoding="utf-8", newline="\n"
            )

            cargo_path = tauri_dir / "Cargo.toml"
            cargo_text = cargo_path.read_text(encoding="utf-8")
            cargo_text, replacements = re.subn(
                r'(\[package\][\s\S]*?^version\s*=\s*")[^"]+("\s*$)',
                rf"\g<1>{expected}\g<2>",
                cargo_text,
                count=1,
                flags=re.MULTILINE,
            )
            if replacements != 1:
                raise ValueError("Cargo package version could not be located")
            cargo_path.write_text(cargo_text, encoding="utf-8", newline="\n")

            cargo = tomllib.loads(cargo_text)
            package_name = str(cargo.get("package", {}).get("name", ""))
            lock_path = tauri_dir / "Cargo.lock"
            lock_text = lock_path.read_text(encoding="utf-8")
            pattern = rf'(\[\[package\]\]\nname = "{re.escape(package_name)}"\nversion = ")[^"]+("\n)'
            lock_text, replacements = re.subn(
                pattern, rf"\g<1>{expected}\g<2>", lock_text, count=1
            )
            if replacements != 1:
                raise ValueError("Cargo.lock root package version could not be located")
            lock_path.write_text(lock_text, encoding="utf-8", newline="\n")
    except (
        OSError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        tomllib.TOMLDecodeError,
    ) as exc:
        logger.fail(f"Could not synchronize version metadata: {exc}")
        return 1
    logger.ok(f"Synchronized enabled component metadata to {expected}")
    return 0


def collect_release_checks() -> list[ReleaseCheck]:
    return [
        *collect_version_checks(),
        *_placeholder_checks(),
        *_tauri_security_checks(),
        _tag_check(),
        _git_check(),
        *_signing_checks(),
    ]


def _print_checks(checks: list[ReleaseCheck]) -> int:
    for check in checks:
        logger.status(check.status, f"{check.name:<24} {check.message}")
    return 1 if any(check.status == "FAIL" for check in checks) else 0


def version(args: argparse.Namespace) -> int:
    if getattr(args, "version_command", None) == "check":
        return _print_checks(collect_version_checks())
    if getattr(args, "version_command", None) == "sync":
        return sync_versions()
    value = source_version()
    if not value:
        logger.fail("VERSION is missing or empty")
        return 1
    print(value)
    return 0


def release(args: argparse.Namespace) -> int:
    if getattr(args, "release_command", None) != "check":
        args.release_parser.print_help()
        return 0
    return _print_checks(collect_release_checks())
