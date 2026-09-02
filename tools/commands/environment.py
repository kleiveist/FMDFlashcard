"""Read-only environment diagnostics and explicit dependency installation."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import platform
import shutil
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from tools import logger
from tools.paths import ProjectPaths, project_paths
from tools.process import command_string, run_command
from tools.project_config import load_toolchain_contract


@dataclass(frozen=True, slots=True)
class Check:
    name: str
    status: str
    required: bool
    detail: str


def _tool_check(name: str, *, required: bool = True) -> Check:
    executable = shutil.which(name)
    return Check(
        name=f"tool:{name}",
        status="ok" if executable else "fail",
        required=required,
        detail=executable or "not found on PATH",
    )


def _file_check(name: str, path: Path) -> Check:
    present = path.is_file()
    return Check(
        name=f"file:{name}",
        status="ok" if present else "fail",
        required=True,
        detail=str(path),
    )


def collect_doctor_checks(paths: ProjectPaths | None = None) -> list[Check]:
    """Collect checks in a fixed order so JSON output remains stable."""

    project = paths or project_paths()
    checks = [
        Check("runtime:python", "ok", True, platform.python_version()),
        _tool_check("git"),
        _tool_check("node"),
        _tool_check("corepack", required=False),
        _tool_check("pnpm"),
        _tool_check("rustc"),
        _tool_check("cargo"),
        _file_check("package.json", project.package_json),
        _file_check("pnpm-lock.yaml", project.pnpm_lock),
        _file_check("Cargo.toml", project.cargo_manifest),
        _file_check("Cargo.lock", project.cargo_lock),
        _file_check("tauri.conf.json", project.tauri_config),
    ]
    for module, label in (
        ("pytest", "pytest"),
        ("ruff", "ruff"),
        ("yaml", "PyYAML"),
        ("mkdocs", "MkDocs"),
    ):
        present = importlib.util.find_spec(module) is not None
        checks.append(
            Check(
                f"python-package:{label}",
                "ok" if present else "fail",
                True,
                "importable" if present else "not installed for the active Python interpreter",
            )
        )
    return checks


def doctor_document(paths: ProjectPaths | None = None) -> dict[str, object]:
    checks = collect_doctor_checks(paths)
    passed = all(check.status == "ok" for check in checks if check.required)
    return {
        "schema_version": 1,
        "status": "ok" if passed else "fail",
        "checks": [asdict(check) for check in checks],
    }


def _print_doctor_text(document: dict[str, object]) -> None:
    for item in document["checks"]:
        check = item if isinstance(item, dict) else {}
        status = str(check.get("status", "fail"))
        message = f"{check.get('name', 'unknown')}: {check.get('detail', '')}"
        if status == "ok":
            logger.ok(message)
        else:
            logger.error(message)
    logger.info(f"Doctor status: {document['status']}")


def doctor(args: argparse.Namespace, *, paths: ProjectPaths | None = None) -> int:
    while True:
        document = doctor_document(paths)
        if args.json:
            print(json.dumps(document, sort_keys=True, separators=(",", ":")))
        else:
            _print_doctor_text(document)
        exit_code = 0 if document["status"] == "ok" else 1
        if not args.watch:
            return exit_code
        try:
            time.sleep(args.interval)
        except KeyboardInterrupt:
            return 130


def _package_manager_command(packages: list[str]) -> list[list[str]] | None:
    if sys.platform == "win32":
        winget = shutil.which("winget") or "winget"
        return [
            [
                winget,
                "install",
                "--exact",
                "--id",
                package,
                "--source",
                "winget",
                "--silent",
                "--disable-interactivity",
                "--accept-package-agreements",
                "--accept-source-agreements",
            ]
            for package in packages
        ]
    if sys.platform == "darwin":
        return [[shutil.which("brew") or "brew", "install", *packages]]

    prefix: list[str] = (
        [] if hasattr(os, "geteuid") and os.geteuid() == 0 else [shutil.which("sudo") or "sudo"]
    )
    if shutil.which("apt-get"):
        return [
            [*prefix, "apt-get", "update"],
            [*prefix, "apt-get", "install", "-y", *packages],
        ]
    if shutil.which("dnf"):
        return [[*prefix, "dnf", "install", "-y", *packages]]
    if shutil.which("pacman"):
        return [[*prefix, "pacman", "-S", "--needed", "--noconfirm", *packages]]
    if shutil.which("zypper"):
        return [[*prefix, "zypper", "--non-interactive", "install", *packages]]
    return None


def _system_dependency_plan() -> list[list[str]] | None:
    if sys.platform == "win32":
        return _package_manager_command(
            ["Git.Git", "Microsoft.VisualStudio.2022.BuildTools", "Microsoft.EdgeWebView2Runtime"]
        )
    if sys.platform == "darwin":
        return _package_manager_command(["git", "pkg-config"])
    if shutil.which("apt-get"):
        packages = [
            "build-essential",
            "curl",
            "file",
            "git",
            "libayatana-appindicator3-dev",
            "librsvg2-dev",
            "libssl-dev",
            "libwebkit2gtk-4.1-dev",
            "libxdo-dev",
            "patchelf",
            "pkg-config",
            "rpm",
            "xdg-utils",
        ]
    elif shutil.which("dnf"):
        packages = [
            "gcc",
            "gcc-c++",
            "git",
            "openssl-devel",
            "webkit2gtk4.1-devel",
            "libappindicator-gtk3-devel",
            "librsvg2-devel",
            "patchelf",
            "dpkg",
            "rpm-build",
        ]
    elif shutil.which("pacman"):
        packages = [
            "base-devel",
            "curl",
            "file",
            "git",
            "openssl",
            "webkit2gtk-4.1",
            "libappindicator-gtk3",
            "librsvg",
            "patchelf",
            "dpkg",
            "rpm-tools",
        ]
    else:
        packages = ["git", "pkg-config"]
    return _package_manager_command(packages)


def _package_manager_version(package_json: Path) -> str:
    try:
        payload = json.loads(package_json.read_text(encoding="utf-8"))
        value = payload.get("packageManager", "")
    except (OSError, json.JSONDecodeError, AttributeError):
        return "pnpm@10.17.1"
    return value if isinstance(value, str) and value.startswith("pnpm@") else "pnpm@10.17.1"


def _run_plan(
    title: str,
    commands: list[list[str]],
    *,
    cwd: Path,
    dry_run: bool,
) -> int:
    logger.info(title)
    for command in commands:
        logger.info(f"$ {command_string(command)}")
        result = run_command(command, cwd=cwd, dry_run=dry_run, capture_output=True)
        if result.stdout.strip():
            print(result.stdout.rstrip())
        if result.stderr.strip():
            print(result.stderr.rstrip(), file=sys.stderr)
        if result.returncode != 0:
            logger.error(f"Command failed with exit code {result.returncode}")
            return result.returncode
    return 0


def _rust_plan() -> list[list[str]]:
    bootstrap: list[list[str]] = []
    if shutil.which("rustup") is None:
        if sys.platform == "win32":
            bootstrap = _package_manager_command(["Rustlang.Rustup"]) or []
        elif sys.platform == "darwin":
            bootstrap = [[shutil.which("brew") or "brew", "install", "rustup"]]
        else:
            bootstrap = _package_manager_command(["rustup"]) or []
    rustup = shutil.which("rustup") or "rustup"
    rust_version = load_toolchain_contract().rust
    return [
        *bootstrap,
        [
            rustup,
            "toolchain",
            "install",
            rust_version,
            "--profile",
            "minimal",
            "--no-self-update",
        ],
        [rustup, "component", "add", "--toolchain", rust_version, "rustfmt", "clippy"],
    ]


def _node_plan(paths: ProjectPaths) -> list[list[str]]:
    bootstrap: list[list[str]] = []
    if shutil.which("node") is None:
        if sys.platform == "win32":
            bootstrap.extend(_package_manager_command(["OpenJS.NodeJS.LTS"]) or [])
        elif sys.platform == "darwin":
            bootstrap.append([shutil.which("brew") or "brew", "install", "node@22"])
        else:
            bootstrap.extend(_package_manager_command(["nodejs", "npm"]) or [])
    contract = load_toolchain_contract(paths)
    bootstrap.append(
        [
            shutil.which("npm") or "npm",
            "install",
            "--global",
            f"corepack@{contract.corepack}",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
        ]
    )
    corepack = shutil.which("corepack") or "corepack"
    package_manager = _package_manager_version(paths.package_json)
    return [
        *bootstrap,
        [corepack, "enable"],
        [corepack, "prepare", package_manager, "--activate"],
    ]


def _python_tooling_plan(paths: ProjectPaths) -> list[list[str]]:
    contract = load_toolchain_contract(paths)
    python = (
        paths.root / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    )
    commands: list[list[str]] = []
    if not python.is_file():
        commands.append([sys.executable, "-m", "venv", str(paths.root / ".venv")])
    commands.extend(
        [
            [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--upgrade",
                f"pip=={contract.pip}",
            ],
            [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--requirement",
                str(paths.tools / "requirements-dev.txt"),
            ],
        ]
    )
    return commands


def install(args: argparse.Namespace, *, paths: ProjectPaths | None = None) -> int:
    project = paths or project_paths()
    if getattr(args, "vscode", False):
        helper = project.tools / "inst" / "linux" / "installuixvs.py"
        if not helper.is_file():
            logger.error(f"Legacy VS Code helper is unavailable: {helper}")
            return 1
        if args.dry_run:
            logger.info(
                "Dry-run: commands are displayed; no process is started and no file is changed"
            )
        exit_code = _run_plan(
            "Legacy VS Code helper",
            [[sys.executable, str(helper)]],
            cwd=project.root,
            dry_run=args.dry_run,
        )
        if exit_code:
            return exit_code
        logger.ok(
            "VS Code helper completed" if not args.dry_run else "VS Code helper dry-run completed"
        )
        return 0

    stages: list[tuple[str, list[list[str]] | None, Path]] = [
        ("Python tooling environment", _python_tooling_plan(project), project.root)
    ]
    if not args.skip_system_deps:
        system_plan = _system_dependency_plan()
        if system_plan is None:
            stages.append(("System dependencies", None, project.root))
        else:
            stages.append(("System dependencies", system_plan, project.root))
    if not args.skip_rust:
        stages.append(("Rust toolchain", _rust_plan(), project.root))
    if not args.skip_node:
        stages.append(("Node package manager", _node_plan(project), project.root))
    if not args.skip_frontend:
        pnpm = shutil.which("pnpm") or "pnpm"
        stages.append(
            ("Frontend dependencies", [[pnpm, "install", "--frozen-lockfile"]], project.desktop)
        )
    if args.dry_run:
        logger.info("Dry-run: commands are displayed; no process is started and no file is changed")
    for title, commands, cwd in stages:
        if commands is None:
            if args.dry_run:
                logger.warn(
                    "System dependencies skipped in dry-run: no supported package manager "
                    "is available on this host"
                )
                continue
            logger.error("No supported system package manager was found")
            return 127
        exit_code = _run_plan(title, commands, cwd=cwd, dry_run=args.dry_run)
        if exit_code:
            return exit_code
    logger.ok("Install plan completed" if not args.dry_run else "Install dry-run completed")
    return 0
