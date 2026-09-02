"""FMD-specific tooling contract verification."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import tomllib
from dataclasses import dataclass

from tools.commands.docs import proposed_indexes
from tools.commands.versioning import collect_version_checks
from tools.paths import ProjectPaths, project_paths
from tools.project_config import ConfigError, load_release_matrix, load_toolchain_contract


@dataclass(frozen=True, slots=True)
class ToolingCheck:
    name: str
    passed: bool
    detail: str


def _workflow_checks(paths: ProjectPaths) -> list[ToolingCheck]:
    checks: list[ToolingCheck] = []
    workflows = sorted(paths.workflows.iterdir()) if paths.workflows.is_dir() else []
    invalid_suffixes = [
        path.name for path in workflows if path.is_file() and path.suffix not in {".yml", ".yaml"}
    ]
    checks.append(
        ToolingCheck(
            "workflow-suffixes",
            not invalid_suffixes,
            "only YAML workflow files"
            if not invalid_suffixes
            else f"invalid files: {', '.join(invalid_suffixes)}",
        )
    )
    mutable_actions: list[str] = []
    action_pattern = re.compile(r"uses:\s+([^\s#]+)@([^\s#]+)")
    action_files = sorted((paths.root / ".github" / "actions").rglob("*.y*ml"))
    for path in [*workflows, *action_files]:
        if not path.is_file() or path.suffix not in {".yml", ".yaml"}:
            continue
        for action, reference in action_pattern.findall(path.read_text(encoding="utf-8")):
            if action.startswith("./"):
                continue
            if not re.fullmatch(r"[0-9a-f]{40}", reference):
                mutable_actions.append(f"{path.name}:{action}@{reference}")
    checks.append(
        ToolingCheck(
            "action-pinning",
            not mutable_actions,
            "all external actions use full commit SHAs"
            if not mutable_actions
            else "mutable actions: " + ", ".join(mutable_actions),
        )
    )
    forbidden_tokens = ("continue-on-error:", "git push origin HEAD:main", "--clobber")
    violations: list[str] = []
    for path in workflows:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        violations.extend(f"{path.name}:{token}" for token in forbidden_tokens if token in text)
    checks.append(
        ToolingCheck(
            "workflow-safety",
            not violations,
            "no suppressed gates, main writes, or asset overwrite flags"
            if not violations
            else "violations: " + ", ".join(violations),
        )
    )
    return checks


def _toolchain_check(paths: ProjectPaths) -> ToolingCheck:
    try:
        contract = load_toolchain_contract(paths)
        package = json.loads(paths.package_json.read_text(encoding="utf-8"))
        rust = tomllib.loads((paths.root / "rust-toolchain.toml").read_text(encoding="utf-8"))
        requirements = {
            line.strip()
            for line in (paths.tools / "requirements-dev.txt")
            .read_text(encoding="utf-8")
            .splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        }
        manager_ok = package.get("packageManager") == f"pnpm@{contract.pnpm}"
        setup_action = (
            paths.root / ".github" / "actions" / "setup-fmd-environment" / "action.yml"
        ).read_text(encoding="utf-8")
        corepack_ok = (
            "corepack@${{ steps.versions.outputs.corepack }}" in setup_action
            and "corepack --version" in setup_action
        )
        rust_config = rust.get("toolchain", {})
        rust_ok = rust_config.get("channel") == contract.rust
        components = set(rust_config.get("components", []))
        components_ok = {"clippy", "rustfmt"} <= components
        required_python = {
            "pytest==9.1.1",
            "ruff==0.16.5",
            "mkdocs==1.6.1",
            "mkdocs-material==9.7.7",
            "PyYAML==6.0.3",
        }
        requirements_ok = requirements == required_python
        passed = manager_ok and corepack_ok and rust_ok and components_ok and requirements_ok
        detail = (
            "package manager, Rust, and Python tooling pins agree"
            if passed
            else "toolchain metadata differs across package.json, rust-toolchain.toml, "
            "toolchains.json, or requirements-dev.txt"
        )
        return ToolingCheck("toolchain-contract", passed, detail)
    except (OSError, ValueError, json.JSONDecodeError, tomllib.TOMLDecodeError, ConfigError) as exc:
        return ToolingCheck("toolchain-contract", False, str(exc))


def _tracked_runtime_check(paths: ProjectPaths) -> ToolingCheck:
    result = subprocess.run(
        ["git", "ls-files"], cwd=paths.root, check=False, capture_output=True, text=True
    )
    forbidden = [
        line
        for line in result.stdout.splitlines()
        if line.startswith(("apps/UserGlobal/", ".dist/", ".reports/", ".tooling-state/"))
    ]
    return ToolingCheck(
        "runtime-data-denylist",
        result.returncode == 0 and not forbidden,
        "no user/runtime data is tracked" if not forbidden else ", ".join(forbidden),
    )


def collect_checks(paths: ProjectPaths | None = None) -> list[ToolingCheck]:
    project = paths or project_paths()
    required = [
        project.version_file,
        project.desktop / "package.json",
        project.desktop / "pnpm-lock.yaml",
        project.tauri / "Cargo.toml",
        project.tauri / "Cargo.lock",
        project.tauri / "tauri.conf.json",
        project.release_matrix,
    ]
    checks = [
        ToolingCheck(
            "project-paths",
            all(path.is_file() for path in required),
            "all canonical project files exist",
        )
    ]
    checks.append(_toolchain_check(project))
    wrappers = {
        "control": '"$@"',
        "control.ps1": "@args",
        "control.cmd": "%*",
    }
    wrapper_ok = all(
        (project.root / name).is_file()
        and token in (project.root / name).read_text(encoding="utf-8")
        for name, token in wrappers.items()
    ) and os.access(project.root / "control", os.X_OK)
    checks.append(ToolingCheck("wrappers", wrapper_ok, "all wrappers forward arguments"))
    version_checks = collect_version_checks(project)
    checks.append(
        ToolingCheck(
            "version-consistency",
            all(item.passed for item in version_checks),
            "; ".join(f"{item.name}: {item.detail}" for item in version_checks),
        )
    )
    try:
        matrix = load_release_matrix(project)
        checks.append(
            ToolingCheck(
                "release-matrix",
                True,
                f"{len(matrix.targets)} native targets validated",
            )
        )
    except (ConfigError, OSError) as exc:
        checks.append(ToolingCheck("release-matrix", False, str(exc)))
    try:
        proposals = proposed_indexes(project)
        stale = [
            path.relative_to(project.root).as_posix()
            for path, value in proposals.items()
            if path.read_text(encoding="utf-8") != value
        ]
        checks.append(
            ToolingCheck(
                "docs-indexes",
                not stale,
                "generated indexes are current" if not stale else f"stale: {', '.join(stale)}",
            )
        )
    except (OSError, ValueError) as exc:
        checks.append(ToolingCheck("docs-indexes", False, str(exc)))
    checks.extend(_workflow_checks(project))
    checks.append(_tracked_runtime_check(project))
    owner_path = re.compile(r"/(?:home|Users)/(?P<owner>[A-Za-z0-9._-]+)/")
    windows_owner_path = re.compile(r"[A-Za-z]:[\\/]Users[\\/](?P<owner>[A-Za-z0-9._-]+)[\\/]")
    placeholder_owners = {"example", "user", "username"}
    offenders: list[str] = []
    tracked = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=project.root,
        check=False,
        capture_output=True,
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
    if tracked.returncode != 0:
        offenders.append("<git ls-files failed>")
    else:
        for relative in tracked.stdout.decode("utf-8").split("\0"):
            path = project.root / relative
            if not relative or not path.is_file() or path.suffix not in text_suffixes:
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            owners = [
                match.group("owner").lower()
                for pattern in (owner_path, windows_owner_path)
                for match in pattern.finditer(text)
            ]
            if any(owner not in placeholder_owners for owner in owners):
                offenders.append(relative)
    checks.append(
        ToolingCheck(
            "portable-paths",
            not offenders,
            "no owner-specific absolute paths" if not offenders else ", ".join(offenders),
        )
    )
    return checks


def verify(*, json_output: bool = False) -> int:
    checks = collect_checks()
    passed = all(check.passed for check in checks)
    if json_output:
        print(
            json.dumps(
                {
                    "checks": [
                        {
                            "detail": check.detail,
                            "name": check.name,
                            "status": "ok" if check.passed else "fail",
                        }
                        for check in checks
                    ],
                    "ok": passed,
                },
                indent=2,
                sort_keys=True,
            )
        )
    else:
        for check in checks:
            print(f"[{'OK' if check.passed else 'FAIL'}] {check.name}: {check.detail}")
    return 0 if passed else 1


def handle(args: argparse.Namespace) -> int:
    if getattr(args, "tooling_command", None) == "verify":
        return verify(json_output=args.json)
    args.tooling_parser.print_help()
    return 0
