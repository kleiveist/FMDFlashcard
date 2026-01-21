#!/usr/bin/env python3
"""Linux-only: cross-compile Windows Tauri build using cargo-xwin.

control.py entry:
  python3 tools/control.py --winlinux --build

Default behavior:
  - pnpm install
  - pnpm tauri build --runner cargo-xwin --target <WIN_LINUX_TARGET> --no-bundle
  - package a portable zip from the produced .exe

Env toggles:
  - WIN_LINUX_TARGET (default: x86_64-pc-windows-msvc)
  - WIN_LINUX_RUNNER (default: cargo-xwin)
  - WIN_LINUX_BUNDLES (if set, uses --bundles instead of --no-bundle)
  - WIN_LINUX_ZIP=0  -> skip portable zip
  - CLEAN_PORTABLE=0 -> skip cleanup of old portable output
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path

from console import (
    bundle,
    cleanup,
    err,
    info,
    kv,
    ok,
    section,
    warn,
    cmd as console_cmd,
)


def _repo_root_from_tools_build() -> Path:
    return Path(__file__).resolve().parents[2]


def _ensure_cargo_bin_on_path() -> None:
    cargo_bin = Path.home() / ".cargo" / "bin"
    if cargo_bin.exists():
        path = os.environ.get("PATH", "")
        path_items = path.split(os.pathsep) if path else []
        if str(cargo_bin) not in path_items:
            os.environ["PATH"] = str(cargo_bin) + os.pathsep + path


def _which_pnpm() -> str:
    exe = shutil.which("pnpm")
    if exe:
        return exe
    if os.name == "nt":
        exe = shutil.which("pnpm.cmd") or shutil.which("pnpm.exe")
        if exe:
            return exe
    raise SystemExit("pnpm not found in PATH. Install pnpm (or enable corepack) and retry.")


def _prompt_yes_no(question: str) -> bool:
    if not sys.stdin.isatty():
        warn("No interactive TTY available for prompts.")
        return False
    while True:
        answer = input(f"{question} [j/n]: ").strip().lower()
        if answer in ("j", "y", "yes"):
            return True
        if answer in ("n", "no", ""):
            return False
        warn("Please answer with j/n.")


def _format_duration(seconds: float) -> str:
    return f"{seconds:.2f}s"


def _run(cmd: list[str], cwd: Path, env: dict[str, str], dry_run: bool) -> tuple[int, float]:
    console_cmd(cwd, cmd)
    start = time.perf_counter()
    if dry_run:
        warn("Dry run: command not executed.")
        return 0, time.perf_counter() - start
    process = subprocess.Popen(cmd, cwd=str(cwd), env=env)
    rc = process.wait()
    return rc, time.perf_counter() - start


def _run_cmd(cmd: list[str], dry_run: bool) -> int:
    console_cmd(Path.cwd(), cmd)
    if dry_run:
        warn("Dry run: command not executed.")
        return 0
    try:
        return subprocess.run(cmd).returncode
    except FileNotFoundError:
        err(f"Command not found: {cmd[0]}")
        return 1


def _run_capture(cmd: list[str], dry_run: bool) -> tuple[int, str]:
    console_cmd(Path.cwd(), cmd)
    if dry_run:
        warn("Dry run: command not executed.")
        return 0, ""
    try:
        p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        return p.returncode, (p.stdout or "")
    except FileNotFoundError:
        err(f"Command not found: {cmd[0]}")
        return 1, ""


def _install_rustup(dry_run: bool) -> int:
    cmd = [
        "bash",
        "-lc",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    ]
    rc = _run_cmd(cmd, dry_run=dry_run)
    if rc != 0:
        return rc
    _ensure_cargo_bin_on_path()
    rustup = shutil.which("rustup") or str(Path.home() / ".cargo" / "bin" / "rustup")
    return _run_cmd([rustup, "default", "stable"], dry_run=dry_run)


def _is_rust_target_installed(target: str, dry_run: bool) -> bool:
    rustup = shutil.which("rustup") or str(Path.home() / ".cargo" / "bin" / "rustup")
    if not rustup or not Path(rustup).exists():
        return False
    rc, out = _run_capture([rustup, "target", "list", "--installed"], dry_run=dry_run)
    if rc != 0:
        return False
    installed = {line.strip() for line in out.splitlines() if line.strip()}
    return target in installed


def _ensure_rust_target(target: str, dry_run: bool, prompt: bool) -> bool:
    rustup = shutil.which("rustup") or str(Path.home() / ".cargo" / "bin" / "rustup")
    if not rustup or not Path(rustup).exists():
        err("rustup not found in PATH. Install Rust (rustup) and retry.")
        return False
    if _is_rust_target_installed(target, dry_run=dry_run):
        return True
    if prompt and not _prompt_yes_no(f"Rust target '{target}' not installed. Install now?"):
        warn("Skipping rust target install.")
        return False
    if dry_run:
        warn("Dry run: skipping rust target install.")
        return False
    return _run_cmd([rustup, "target", "add", target], dry_run=dry_run) == 0


def _install_pnpm(dry_run: bool) -> int:
    if shutil.which("pnpm"):
        return 0
    corepack = shutil.which("corepack")
    if corepack:
        rc = _run_cmd([corepack, "enable"], dry_run=dry_run)
        if rc != 0:
            return rc
        rc = _run_cmd([corepack, "prepare", "pnpm@latest", "--activate"], dry_run=dry_run)
        if rc == 0 and shutil.which("pnpm"):
            return 0
    npm = shutil.which("npm")
    if npm:
        rc = _run_cmd([npm, "i", "-g", "pnpm"], dry_run=dry_run)
        if rc == 0 and shutil.which("pnpm"):
            return 0
    err("pnpm install failed. Try: corepack enable && corepack prepare pnpm@latest --activate")
    return 1


def _install_cargo_xwin(dry_run: bool) -> int:
    cargo = shutil.which("cargo") or str(Path.home() / ".cargo" / "bin" / "cargo")
    if not cargo or not Path(cargo).exists():
        err("cargo not found in PATH. Install Rust (rustup) and retry.")
        return 1
    return _run_cmd([cargo, "install", "--locked", "cargo-xwin"], dry_run=dry_run)


def _clean_old_portable(portable_dir: Path, dry_run: bool) -> float:
    start = time.perf_counter()
    if portable_dir.exists():
        cleanup(f"Cleaning old portable output: {portable_dir}")
        if not dry_run:
            shutil.rmtree(portable_dir, ignore_errors=True)
    else:
        info(f"No old portable output found at: {portable_dir}")
    return time.perf_counter() - start


def _find_portable_exe(release_dir: Path) -> Path | None:
    if not release_dir.exists():
        return None
    candidates: list[Path] = []
    for p in sorted(release_dir.glob("*.exe")):
        name = p.name.lower()
        if name.endswith("-setup.exe") or name.endswith("setup.exe"):
            continue
        if "uninstall" in name:
            continue
        candidates.append(p)
    if not candidates:
        return None
    return max(candidates, key=lambda x: x.stat().st_mtime)


def _sanitize_bundles(bundles_env: str) -> str:
    raw = bundles_env.strip()
    if not raw:
        return ""
    if raw.lower() in {"none", "no", "false", "0"}:
        return ""
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    return ",".join(parts)


def _ensure_required_tools(runner: str, target: str, dry_run: bool) -> bool:
    _ensure_cargo_bin_on_path()
    missing_pnpm = shutil.which("pnpm") is None
    missing_rust = shutil.which("cargo") is None or shutil.which("rustc") is None
    missing_runner = shutil.which(runner) is None
    missing_target = False
    if not missing_rust and not _is_rust_target_installed(target, dry_run=dry_run):
        missing_target = True

    if not (missing_pnpm or missing_rust or missing_runner):
        if missing_target:
            if not _ensure_rust_target(target, dry_run=dry_run, prompt=True):
                return False
        return True

    missing = []
    if missing_pnpm:
        missing.append("pnpm")
    if missing_rust:
        missing.append("rust toolchain")
    if missing_runner:
        missing.append(runner)
    if missing_target:
        missing.append(f"rust target {target}")
    err(f"Missing tools: {', '.join(missing)}")

    if not _prompt_yes_no("Install missing tools now?"):
        warn("Skipping install; please install the missing tools and retry.")
        return False

    if dry_run:
        warn("Dry run: skipping installation.")
        return False

    if missing_rust:
        info("Installing Rust toolchain (rustup)...")
        if _install_rustup(dry_run=dry_run) != 0:
            return False
    if missing_pnpm:
        info("Installing pnpm...")
        if _install_pnpm(dry_run=dry_run) != 0:
            return False
    if missing_runner:
        if runner != "cargo-xwin":
            err(f"{runner} not found in PATH. Install it and retry.")
            return False
        info("Installing cargo-xwin...")
        if _install_cargo_xwin(dry_run=dry_run) != 0:
            return False
    if not _ensure_rust_target(target, dry_run=dry_run, prompt=False):
        return False

    _ensure_cargo_bin_on_path()
    if shutil.which("pnpm") is None:
        err("pnpm still not found in PATH.")
        return False
    if shutil.which("cargo") is None or shutil.which("rustc") is None:
        err("Rust toolchain still not found in PATH.")
        return False
    if shutil.which(runner) is None:
        err(f"{runner} still not found in PATH.")
        return False
    return True


def run_install(dry_run: bool = False) -> int:
    if platform.system().lower() != "linux":
        err("Windows cross-compile is Linux-only in this script.")
        return 2

    repo_root = _repo_root_from_tools_build()
    app_dir = (repo_root / "apps" / "fmd-desktop").resolve()
    legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
    using_legacy = False
    if not app_dir.exists() and legacy_dir.exists():
        app_dir = legacy_dir
        using_legacy = True
    if not app_dir.exists():
        raise SystemExit(f"Desktop app dir not found: {app_dir}")

    runner = os.environ.get("WIN_LINUX_RUNNER", "cargo-xwin")
    target = os.environ.get("WIN_LINUX_TARGET", "x86_64-pc-windows-msvc")
    bundles = _sanitize_bundles(os.environ.get("WIN_LINUX_BUNDLES", ""))

    clean_portable_env = os.environ.get("CLEAN_PORTABLE")
    clean_portable_value = clean_portable_env if clean_portable_env is not None else "1"
    clean_portable_enabled = clean_portable_value.lower() not in ("0", "false", "no")

    zip_env = os.environ.get("WIN_LINUX_ZIP")
    zip_enabled = zip_env is None or zip_env.lower() not in ("0", "false", "no")

    if not _ensure_required_tools(runner, target, dry_run=dry_run):
        return 1
    pnpm = _which_pnpm()

    env = os.environ.copy()
    release_dir = app_dir / "src-tauri" / "target" / target / "release"
    portable_dir = release_dir / "bundle" / "portable"

    section("Run Context")
    info(f"Repo root: {repo_root}")
    info(f"App dir:   {app_dir}")
    if using_legacy:
        warn("Using legacy path: consider migrating to /apps/fmd-desktop")

    section("Settings")
    kv("WIN_LINUX_TARGET", target)
    kv("WIN_LINUX_RUNNER", runner)
    kv("WIN_LINUX_BUNDLES", bundles or "(none)")
    kv(
        "CLEAN_PORTABLE",
        f"{clean_portable_value} ({'cleanup' if clean_portable_enabled else 'skip'})",
    )
    kv("WIN_LINUX_ZIP", f"{'enabled' if zip_enabled else 'disabled'}")
    if dry_run:
        warn("Dry run mode enabled: commands will not execute.")

    step_times: dict[str, float] = {}
    overall_start = time.perf_counter()

    if clean_portable_enabled and zip_enabled:
        section("Portable Cleanup")
        step_times["cleanup"] = _clean_old_portable(portable_dir, dry_run)

    section("Install")
    install_rc, install_time = _run([pnpm, "install"], cwd=app_dir, env=env, dry_run=dry_run)
    step_times["install"] = install_time
    if install_rc != 0:
        err("pnpm install failed.")
        return install_rc

    section("Tauri Build (Windows cross)")
    build_cmd = [
        pnpm,
        "tauri",
        "build",
        "--runner",
        runner,
        "--target",
        target,
    ]
    if bundles:
        build_cmd.extend(["--bundles", bundles])
    else:
        build_cmd.append("--no-bundle")
    build_rc, build_time = _run(build_cmd, cwd=app_dir, env=env, dry_run=dry_run)
    step_times["build"] = build_time
    if build_rc != 0:
        err("pnpm tauri build failed.")
        return build_rc

    if dry_run:
        section("Result")
        ok("Dry run completed (no artifacts were produced).")
        return 0

    exe = _find_portable_exe(release_dir)
    if not exe:
        err(f"No portable .exe found in: {release_dir}")
        err("Expected the app binary in src-tauri/target/<target>/release after a successful build.")
        return 1

    zip_path = None
    if zip_enabled:
        section("Package Portable ZIP")
        portable_dir.mkdir(parents=True, exist_ok=True)
        zip_path = portable_dir / f"{exe.stem}-portable.zip"
        readme = (
            "PORTABLE BUILD\n\n"
            f"- Run: {exe.name}\n"
            "- This ZIP is provided without an installer.\n"
            "- WebView2 Runtime may be required on target machines.\n"
        )
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.write(exe, arcname=exe.name)
            zf.writestr("README_PORTABLE.txt", readme)

    total_time = time.perf_counter() - overall_start
    section("Result")
    ok("Windows cross-compile completed.")
    kv("Install time", _format_duration(step_times.get("install", 0.0)))
    kv("Build time", _format_duration(step_times.get("build", 0.0)))
    if "cleanup" in step_times:
        kv("Cleanup time", _format_duration(step_times["cleanup"]))
    kv("Total time", _format_duration(total_time))

    bundle(f"exe: {exe}")
    if zip_path:
        bundle(f"zip: {zip_path}")
    else:
        warn("Portable ZIP skipped (WIN_LINUX_ZIP=0).")

    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
