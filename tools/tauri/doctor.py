from __future__ import annotations

import argparse
import json
import shutil
import socket
import sys
import time
from datetime import datetime
from pathlib import Path

from tools import logger
from tools.config import ConfigLoadError, resolve_configuration, validate_configuration
from tools.profiles import runtime as profile_runtime
from tools.tauri import common, paths
from tools.tauri.build import appimage
from tools.tauri.common import CheckResult


def collect_checks(frontend_port: int | None = None) -> tuple[list[CheckResult], str]:
    configuration_check: CheckResult | None = None
    frontend_host = "127.0.0.1"
    if frontend_port is None:
        profile = profile_runtime.active_profile(paths.ROOT)
        try:
            resolved = resolve_configuration(profile, project_root=paths.ROOT)
        except ConfigLoadError as exc:
            configuration_check = CheckResult("configuration", "FAIL", str(exc))
            frontend_port = 0
        else:
            relevant = {"FRONTEND_HOST", "FRONTEND_PORT"}
            issues = [issue for issue in validate_configuration(resolved) if issue.name in relevant]
            if issues:
                configuration_check = CheckResult(
                    "configuration",
                    "FAIL",
                    "; ".join(f"{issue.name}: {issue.message}" for issue in issues),
                )
                frontend_port = 0
            else:
                frontend_host = resolved.value("FRONTEND_HOST") or frontend_host
                frontend_port = int(resolved.value("FRONTEND_PORT") or 0)
    checks: list[CheckResult] = [
        _check_binary("git", "Git", ["git", "--version"]),
        _check_binary("curl", "curl", ["curl", "--version"]),
        _check_binary("node", "Node.js", ["node", "--version"]),
        _check_binary("npm", "npm", ["npm", "--version"]),
        _check_optional_binary("pnpm", "pnpm", ["pnpm", "--version"]),
        _check_optional_binary("corepack", "Corepack", ["corepack", "--version"]),
        _check_binary("rustup", "Rustup", ["rustup", "--version"]),
        _check_binary("rustc", "Rust compiler", ["rustc", "--version"]),
        _check_binary("cargo", "Cargo", ["cargo", "--version"]),
        _check_rust_toolchain(),
        _check_tauri_cli(),
        _check_path("src-tauri", paths.TAURI_DIR, required=True),
        _check_path("tauri-config", paths.TAURI_CONFIG, required=True),
        _check_path("frontend-package", paths.FRONTEND_PACKAGE_JSON, required=True),
        _check_path("frontend-dist", paths.FRONTEND_DIR / "dist", required=False),
    ]
    if configuration_check is not None:
        checks.append(configuration_check)
    else:
        checks.append(_check_port(frontend_host, frontend_port))

    checks.extend(_platform_checks())
    overall = common.overall_status(checks)
    return checks, overall


def main(args: argparse.Namespace) -> int:
    interval = max(1, int(getattr(args, "interval", 5)))

    if getattr(args, "json", False):
        checks, overall = collect_checks()
        print(json.dumps({"overall": overall, "checks": [item.as_dict() for item in checks]}, indent=2))
        return 1 if overall == "FAIL" else 0

    if not getattr(args, "watch", False):
        checks, overall = collect_checks()
        _print_report(checks, overall)
        return 1 if overall == "FAIL" else 0

    previous: dict[str, str] | None = None
    logger.info(f"Tauri doctor watch mode enabled (interval={interval}s). Press Ctrl+C to stop.")
    try:
        while True:
            checks, overall = collect_checks()
            _print_report(checks, overall, previous)
            previous = {item.name: item.status for item in checks}
            time.sleep(interval)
    except KeyboardInterrupt:
        logger.info("Watch stopped by user")
        return 0


def _check_binary(name: str, help_text: str, version_cmd: list[str]) -> CheckResult:
    binary = shutil.which(name)
    if binary is None:
        return CheckResult(name, "FAIL", f"not found. Action: install {help_text}.")
    ok, version = common.command_output(version_cmd)
    if not ok:
        return CheckResult(name, "WARN", f"found at {binary}, version check failed: {version}")
    return CheckResult(name, "OK", f"{binary} ({version})")


def _check_optional_binary(name: str, help_text: str, version_cmd: list[str]) -> CheckResult:
    binary = shutil.which(name)
    if binary is None:
        return CheckResult(name, "WARN", f"not found. Action: install or enable {help_text} if needed.")
    ok, version = common.command_output(version_cmd)
    if not ok:
        return CheckResult(name, "WARN", f"found at {binary}, version check failed: {version}")
    return CheckResult(name, "OK", f"{binary} ({version})")


def _check_rust_toolchain() -> CheckResult:
    if shutil.which("rustup") is None:
        return CheckResult("rust-toolchain", "FAIL", "rustup not found")
    ok, output = common.command_output(["rustup", "show", "active-toolchain"])
    if not ok:
        return CheckResult("rust-toolchain", "WARN", f"active toolchain unavailable: {output}")
    return CheckResult("rust-toolchain", "OK", output)


def _check_tauri_cli() -> CheckResult:
    command = common.tauri_cli_command("--version")
    ok, output = common.command_output(command, cwd=paths.ROOT)
    if ok:
        return CheckResult("tauri-cli", "OK", output)
    return CheckResult(
        "tauri-cli",
        "WARN",
        "local Tauri CLI unavailable. Action: run 'python tools/control.py tauri install'.",
    )


def _check_path(name: str, path: Path, *, required: bool) -> CheckResult:
    if path.exists():
        return CheckResult(name, "OK", f"{path.relative_to(paths.ROOT)} found")
    status = "FAIL" if required else "WARN"
    message = f"{path.relative_to(paths.ROOT)} missing"
    if not required:
        message += " (created by frontend build)"
    return CheckResult(name, status, message)


def _check_port(host: str, port: int) -> CheckResult:
    occupied = False
    try:
        addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError:
        addresses = []
    for family, socktype, protocol, _, address in addresses:
        with socket.socket(family, socktype, protocol) as sock:
            sock.settimeout(0.3)
            if sock.connect_ex(address) == 0:
                occupied = True
                break
    if occupied:
        return CheckResult(f"port:{port}", "WARN", f"occupied on {host}")
    return CheckResult(f"port:{port}", "OK", f"free on {host}")


def _platform_checks() -> list[CheckResult]:
    host = common.host_os()
    if host == "linux":
        return _linux_checks()
    if host == "windows":
        return _windows_checks()
    if host == "darwin":
        return _macos_checks()
    return [CheckResult("platform", "WARN", f"unsupported host platform: {sys.platform}")]


def _linux_checks() -> list[CheckResult]:
    checks = [
        _check_pkg_config("webkitgtk", ["webkit2gtk-4.1"], required=True),
        _check_pkg_config("gtk3", ["gtk+-3.0"], required=True),
        _check_pkg_config("librsvg", ["librsvg-2.0"], required=True),
        _check_pkg_config("openssl", ["openssl"], required=True),
        _check_pkg_config(
            "appindicator",
            ["ayatana-appindicator3-0.1", "appindicator3-0.1"],
            required=True,
        ),
        _check_optional_binary("patchelf", "patchelf for AppImage builds", ["patchelf", "--version"]),
        _check_optional_binary("mksquashfs", "squashfs-tools for AppImage builds", ["mksquashfs", "-version"]),
        _check_optional_binary(
            "desktop-file-validate",
            "desktop-file-utils for AppImage builds",
            ["desktop-file-validate", "--version"],
        ),
        _check_libfuse2(),
    ]
    return checks


def _check_pkg_config(name: str, packages: list[str], *, required: bool = False) -> CheckResult:
    if shutil.which("pkg-config") is None:
        status = "FAIL" if required else "WARN"
        return CheckResult(name, status, "pkg-config missing; system dependencies cannot be verified")

    for package in packages:
        ok, output = common.command_output(["pkg-config", "--modversion", package])
        if ok:
            return CheckResult(name, "OK", f"{package} {output}")
    status = "FAIL" if required else "WARN"
    return CheckResult(name, status, f"missing required pkg-config package: {' or '.join(packages)}")


def _check_libfuse2() -> CheckResult:
    if appimage._libfuse2_available():
        return CheckResult("libfuse2", "OK", "libfuse.so.2 found")
    return CheckResult("libfuse2", "WARN", "libfuse.so.2 missing; AppImage linuxdeploy may fail")


def _windows_checks() -> list[CheckResult]:
    vswhere = Path("C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe")
    if vswhere.exists():
        return [CheckResult("msvc", "OK", "Visual Studio installer found")]
    if shutil.which("cl"):
        return [CheckResult("msvc", "OK", "MSVC compiler found in PATH")]
    return [CheckResult("msvc", "WARN", "MSVC Build Tools not detected")]


def _macos_checks() -> list[CheckResult]:
    ok, output = common.command_output(["xcode-select", "-p"])
    if ok:
        return [CheckResult("xcode-tools", "OK", output)]
    return [CheckResult("xcode-tools", "WARN", "Xcode Command Line Tools not detected")]


def _print_report(
    checks: list[CheckResult],
    overall: str,
    previous: dict[str, str] | None = None,
) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"Tauri doctor report at {timestamp}")
    for item in checks:
        logger.status(item.status, f"{item.name:<18} {item.message}")

    if previous is not None:
        changed = [
            f"{item.name}: {previous[item.name]} -> {item.status}"
            for item in checks
            if previous.get(item.name) != item.status
        ]
        if changed:
            logger.info("Changes since previous run:")
            for line in changed:
                logger.info(f"- {line}")

    logger.status(overall, f"Overall status: {overall}")
