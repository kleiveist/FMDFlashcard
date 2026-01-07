[← Back to Docs Home](../../docs/index.md)

# Gesamtinhalte – Root: /mnt/daten/workspace/Blobbite/Develop/FMDFlashcard/tools

## 📝 control.py — ./control.py

#!/usr/bin/env python3
"""
Project control entry point.

Examples:
    ./control.py --doctor
    ./control.py --doctor --json
"""

from __future__ import annotations

import argparse
import importlib
import inspect
import platform
import sys
from pathlib import Path
from typing import Callable, cast

SCRIPT_DIR = Path(__file__).resolve().parent
PY_DIR = SCRIPT_DIR / "inst"
for extra_dir in (PY_DIR, PY_DIR / "linux", PY_DIR / "mac", PY_DIR / "win"):
    if extra_dir.exists() and str(extra_dir) not in sys.path:
        sys.path.insert(0, str(extra_dir))

from doctor import run as run_doctor  # type: ignore

RunInstall = Callable[[bool], int]
RunVsCodeInstall = Callable[[], int]
run_doctor = cast(Callable[[bool], int], run_doctor)


def _detect_installer_module() -> str | None:
    """Return installer module name (without .py) based on the current OS."""
    sys_name = platform.system().lower()
    if sys_name == "windows":
        return "installwin"
    if sys_name == "darwin":
        return "installmac"
    if sys_name == "linux":
        return "installuix"
    return None


def _load_installer_run_install() -> RunInstall | None:
    mod_name = _detect_installer_module()
    if not mod_name:
        return None
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load installer module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Installer module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(RunInstall, fn)


def _load_vscode_run_install() -> RunVsCodeInstall | None:
    mod_name = "installuixvs"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load VS Code installer module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"VS Code installer module '{mod_name}' has no run_install() function.")
        return None
    return cast(RunVsCodeInstall, fn)


def _load_tauri_run_install() -> Callable[..., int] | None:
    mod_name = "installuixtauri"
    if platform.system().lower() != "linux":
        print("Tauri install routine is Linux-only.")
        return None
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load Tauri installer module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(
            "Tauri installer module "
            f"'{mod_name}' has no run_install(dry_run=...) function."
        )
        return None
    return cast(Callable[..., int], fn)


def _load_run_runner() -> Callable[..., int] | None:
    """Load tools/inst/run.py (runner for pnpm tauri dev)."""
    mod_name = "run"
    try:
        mod = importlib.import_module(mod_name)
    except Exception as e:
        print(f"Could not load run module: {mod_name} ({e})")
        return None

    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        print(f"Run module '{mod_name}' has no run_install(dry_run=...) function.")
        return None
    return cast(Callable[..., int], fn)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Project toolbox launcher.")
    parser.add_argument(
        "--doctor",
        action="store_true",
        help="Runs the system/tooling check.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Alias for --doctor.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Additional JSON output for --doctor.",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Installs missing dependencies via the matching install script (win/uix/mac).",
    )
    parser.add_argument(
        "--VScode",
        "--vscode",
        dest="vscode",
        action="store_true",
        help="Installs Visual Studio Code (Linux).",
    )
    parser.add_argument(
        "--tauri",
        action="store_true",
        help="Installs Tauri prerequisites (Linux).",
    )
    parser.add_argument(
        "--run",
        "--start",
        dest="run",
        action="store_true",
        help="Runs the Tauri desktop app (pnpm tauri dev).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show which commands would run.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    exit_code = 0
    handled = False

    if args.install:
        handled = True
        run_install = _load_installer_run_install()
        if not run_install:
            print(
                "No matching installation routine found. "
                "Expected: tools/inst/win/installwin.py, "
                "tools/inst/linux/installuix.py, or tools/inst/mac/installmac.py"
            )
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, run_install(args.dry_run))

    if args.vscode:
        handled = True
        run_vscode = _load_vscode_run_install()
        if not run_vscode:
            print("No VS Code install routine found. Expected: tools/inst/linux/installuixvs.py")
            exit_code = max(exit_code, 1)
        else:
            exit_code = max(exit_code, run_vscode())

    if args.tauri:
        handled = True
        run_tauri = _load_tauri_run_install()
        if not run_tauri:
            print("No Tauri install routine found. Expected: tools/inst/linux/installuixtauri.py")
            exit_code = max(exit_code, 1)
        else:
            # Accept run_install() or run_install(dry_run)
            try:
                sig = inspect.signature(run_tauri)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_tauri())
                else:
                    exit_code = max(exit_code, run_tauri(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_tauri(args.dry_run))

    if args.run:
        handled = True
        run_runner = _load_run_runner()
        if not run_runner:
            print("No run routine found. Expected: tools/inst/run.py")
            exit_code = max(exit_code, 1)
        else:
            try:
                sig = inspect.signature(run_runner)
                if len(sig.parameters) == 0:
                    exit_code = max(exit_code, run_runner())
                else:
                    exit_code = max(exit_code, run_runner(args.dry_run))
            except Exception:
                exit_code = max(exit_code, run_runner(args.dry_run))

    if args.doctor or args.check:
        handled = True
        exit_code = max(exit_code, run_doctor(args.json))

    if not handled:
        print("Please specify a command (e.g. --doctor, --install, --tauri, or --start/--run).")
        return 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

---

## 📝 pacman_keyring_fix.py — ./fixes/pacman_keyring_fix.py

#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from typing import Sequence

SIG_ERR = re.compile(
    r"(Signatur von .* ist ungültig|Ungültiges oder beschädigtes Paket.*PGP|"
    r"signature from .* is invalid|invalid or corrupted package.*PGP)",
    re.IGNORECASE,
)


def should_apply(pacman_output: str) -> bool:
    return bool(SIG_ERR.search(pacman_output or ""))


def apply(dry_run: bool = False) -> int:
    cmd: Sequence[str] = [
        "sudo",
        "pacman",
        "-Syyu",
        "archlinux-keyring",
        "cachyos-keyring",
    ]
    print("▶", " ".join(cmd))
    if dry_run:
        return 0
    p = subprocess.run(cmd)
    return p.returncode


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    raise SystemExit(apply(dry_run=dry_run))

---

## 📝 doctor.py — ./inst/doctor.py

#!/usr/bin/env python3
"""
Environment doctor/check script used by `tools/control.py`.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


@dataclass
class Check:
    name: str
    ok: bool
    details: str
    category: str


ICONS = {
    "ok": "✅",
    "miss": "❌",
    "info": "ℹ️",
    "warn": "⚠️",
    "dot": "•",
}

CRITICAL_CATEGORIES = (
    "Core Tools",
    "Rust",
    "Node",
    "Tauri System Libs",
)


def run_cmd(cmd: List[str]) -> Optional[str]:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
        return out.strip()
    except Exception:
        return None


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def _cargo_home() -> Path:
    cargo_home = os.environ.get("CARGO_HOME")
    if cargo_home:
        return Path(cargo_home).expanduser()
    return Path.home() / ".cargo"


def _resolve_tool_with_cargo_bin(cmd: str, cargo_bin: Path) -> tuple[Optional[str], bool]:
    found = which(cmd)
    if found:
        return found, False
    candidate = cargo_bin / cmd
    if candidate.exists() and os.access(candidate, os.X_OK):
        return str(candidate), True
    return None, False


def _with_path_hint(details: str, from_cargo: bool, cargo_env: Path, cargo_bin: Path) -> str:
    if not from_cargo:
        return details
    if cargo_env.exists():
        return f"{details} (not in PATH; run 'source {cargo_env}')"
    return f"{details} (not in PATH; add {cargo_bin} to PATH)"


def header(title: str) -> None:
    line = "═" * (len(title) + 2)
    print(f"\n{line}\n {title}\n{line}")


def print_checks(checks: List[Check]) -> None:
    cats: Dict[str, List[Check]] = {}
    for c in checks:
        cats.setdefault(c.category, []).append(c)

    for cat in cats:
        print(f"\n{ICONS['dot']} {cat}")
        for c in cats[cat]:
            icon = ICONS["ok"] if c.ok else ICONS["miss"]
            print(f"  {icon} {c.name:<18} {c.details}")


def collect_checks() -> List[Check]:
    checks: List[Check] = []

    system = platform.system().lower()

    shell = os.environ.get("SHELL", "unknown")
    checks.append(Check("SHELL", True, shell, "Shell"))

    path = os.environ.get("PATH", "")
    path_entries = path.split(os.pathsep) if path else []
    top = path_entries[:8]
    checks.append(
        Check(
            "PATH (Top 8)",
            True,
            "\n" + "\n".join([f"    {i+1}. {p}" for i, p in enumerate(top)]),
            "Shell",
        )
    )

    for tool in ["git", "curl", "file", "pkg-config", "cmake", "make", "gcc", "g++"]:
        p = which(tool)
        if p:
            checks.append(Check(tool, True, f"{p}", "Core Tools"))
        else:
            checks.append(Check(tool, False, "not found", "Core Tools"))

    cargo_home = _cargo_home()
    cargo_bin = cargo_home / "bin"
    cargo_env = cargo_home / "env"
    rustup, rustup_from_cargo = _resolve_tool_with_cargo_bin("rustup", cargo_bin)
    rustc, rustc_from_cargo = _resolve_tool_with_cargo_bin("rustc", cargo_bin)
    cargo, cargo_from_cargo = _resolve_tool_with_cargo_bin("cargo", cargo_bin)

    if rustup:
        v = run_cmd([rustup, "--version"]) or "version unavailable"
        active = run_cmd([rustup, "show", "active-toolchain"]) or "(active toolchain unknown)"
        checks.append(
            Check(
                "rustup",
                True,
                _with_path_hint(v, rustup_from_cargo, cargo_env, cargo_bin),
                "Rust",
            )
        )
        checks.append(
            Check(
                "toolchain",
                True,
                _with_path_hint(active, rustup_from_cargo, cargo_env, cargo_bin),
                "Rust",
            )
        )
    else:
        checks.append(Check("rustup", False, "not found", "Rust"))

    if rustc:
        v = run_cmd([rustc, "-V"]) or "version unavailable"
        checks.append(
            Check("rustc", True, _with_path_hint(v, rustc_from_cargo, cargo_env, cargo_bin), "Rust")
        )
    else:
        checks.append(Check("rustc", False, "not found", "Rust"))

    if cargo:
        v = run_cmd([cargo, "-V"]) or "version unavailable"
        checks.append(
            Check("cargo", True, _with_path_hint(v, cargo_from_cargo, cargo_env, cargo_bin), "Rust")
        )
    else:
        checks.append(Check("cargo", False, "not found", "Rust"))

    node = which("node")
    npm = which("npm")
    pnpm = which("pnpm")

    if node:
        checks.append(Check("node", True, run_cmd(["node", "-v"]) or node, "Node"))
    else:
        checks.append(Check("node", False, "not found", "Node"))

    if npm:
        checks.append(Check("npm", True, run_cmd(["npm", "-v"]) or npm, "Node"))
    else:
        checks.append(Check("npm", False, "not found", "Node"))

    if pnpm:
        checks.append(Check("pnpm", True, run_cmd(["pnpm", "-v"]) or pnpm, "Node"))
    else:
        checks.append(Check("pnpm", True, "not installed (optional)", "Node"))

    # Tauri / WebView dependencies are OS + distro specific.
    # We check them only on Linux, using the available package manager.
    deps = ["gtk3", "webkit2gtk", "libappindicator-gtk3", "librsvg", "openssl"]
    pacman = which("pacman")
    dpkg_query = which("dpkg-query")

    # Debian/Ubuntu package names for the above logical deps.
    debian_pkg = {
        "gtk3": ["libgtk-3-dev"],
        "webkit2gtk": ["libwebkit2gtk-4.1-dev", "libwebkit2gtk-4.0-dev"],
        "libappindicator-gtk3": ["libayatana-appindicator3-dev", "libappindicator3-dev"],
        "librsvg": ["librsvg2-dev"],
        "openssl": ["libssl-dev"],
    }
    arch_pkg = {
        "gtk3": ["gtk3"],
        "webkit2gtk": ["webkit2gtk-4.1", "webkit2gtk"],
        "libappindicator-gtk3": ["libappindicator", "libappindicator-gtk3"],
        "librsvg": ["librsvg"],
        "openssl": ["openssl"],
    }

    if system == "linux" and pacman:
        for d in deps:
            found = None
            for pkg in arch_pkg.get(d, [d]):
                q = run_cmd(["pacman", "-Q", pkg])
                if q:
                    found = q
                    break
            if found:
                checks.append(Check(d, True, found, "Tauri System Libs"))
            else:
                checks.append(Check(d, False, "not installed", "Tauri System Libs"))
    elif system == "linux" and dpkg_query:
        for d in deps:
            pkgs = debian_pkg[d]
            found_pkg = None
            found_status = None
            for pkg in pkgs:
                q = run_cmd(["dpkg-query", "-W", "-f=${Status} ${Version}", pkg])
                if q and "install ok installed" in q:
                    found_pkg = pkg
                    found_status = q
                    break
            if found_pkg:
                checks.append(Check(d, True, f"{found_pkg}: {found_status}", "Tauri System Libs"))
            else:
                checks.append(
                    Check(d, False, f"{'/'.join(pkgs)}: not installed", "Tauri System Libs")
                )
    else:
        # Non-Linux systems or unknown Linux distros: don't fail the doctor on these.
        for d in deps:
            checks.append(Check(d, True, "skipped (Linux package check only)", "Tauri System Libs"))

    sqlite = which("sqlite3")
    if sqlite:
        checks.append(Check("sqlite3", True, run_cmd(["sqlite3", "--version"]) or sqlite, "Optional"))
    else:
        checks.append(Check("sqlite3", True, "not installed (optional)", "Optional"))

    return checks


def summarize(checks: List[Check]) -> None:
    header("Summary")
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    if not missing:
        print(f"{ICONS['ok']} All required tools are present.")
    else:
        print(f"{ICONS['warn']} Missing / required for Tauri:")
        for c in missing:
            print(f"  {ICONS['miss']} {c.name}  ({c.category})")


def run(want_json: bool = False) -> int:
    checks = collect_checks()
    header("Terminal Checkup")
    print_checks(checks)
    summarize(checks)

    if want_json:
        print("\nJSON:")
        payload = [asdict(c) for c in checks]
        print(json.dumps(payload, indent=2, ensure_ascii=False))

    return 0


def missing_checks(
    checks: List[Check], categories: Optional[List[str] | tuple[str, ...]] = None
) -> List[Check]:
    wanted = categories or CRITICAL_CATEGORIES
    return [c for c in checks if (not c.ok) and (c.category in wanted)]


if __name__ == "__main__":
    raise SystemExit(run())

---

## 📝 installuix.py — ./inst/linux/installuix.py

#!/usr/bin/env python3
"""
Linux dispatcher installer.

Selects a distro-specific installer module:
- installuixarc.py (Arch/pacman)
- installuixubu.py (Ubuntu/apt)
- installuixdeb.py (Debian/apt)

Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import importlib
import shutil
from pathlib import Path
from typing import Dict


def _read_os_release() -> Dict[str, str]:
    data: Dict[str, str] = {}
    p = Path("/etc/os-release")
    if not p.exists():
        return data
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        data[k.strip()] = v
    return data


def _pick_module() -> str:
    # Prefer package manager detection first
    if shutil.which("pacman"):
        return "installuixarc"
    if shutil.which("apt-get"):
        osr = _read_os_release()
        os_id = (osr.get("ID") or "").lower()
        like = (osr.get("ID_LIKE") or "").lower()

        if os_id == "ubuntu" or "ubuntu" in like:
            return "installuixubu"
        if os_id == "debian" or "debian" in like:
            return "installuixdeb"

        # apt-based fallback: choose Debian-style defaults
        return "installuixdeb"

    # Last fallback: try Debian-style anyway (will error nicely if apt-get is absent)
    return "installuixdeb"


def run_install(dry_run: bool = False) -> int:
    mod_name = _pick_module()
    mod = importlib.import_module(mod_name)
    fn = getattr(mod, "run_install", None)
    if not callable(fn):
        raise SystemExit(f"Installer module '{mod_name}' has no run_install(dry_run=...)")
    return int(fn(dry_run))


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

---

## 📝 installuixarc.py — ./inst/linux/installuixarc.py

#!/usr/bin/env python3
"""
Arch Linux installer (pacman-based).

Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Set

from doctor import Check, CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}

PackageMap = Dict[str, Iterable[str]]

# Arch/pacman package mapping (dedup happens automatically).
PACMAN_MAP: PackageMap = {
    # Core tools
    "git": ["git"],
    "curl": ["curl"],
    "file": ["file"],
    "pkg-config": ["pkgconf"],
    "cmake": ["cmake"],
    "make": ["make"],
    "gcc": ["gcc"],
    "g++": ["gcc"],
    # Rust
    "rustup": ["rustup"],
    "rustc": ["rust"],
    "cargo": ["rust"],
    # Node
    "node": ["nodejs"],
    "npm": ["npm"],
    # Tauri / WebView deps
    "gtk3": ["gtk3"],
    "webkit2gtk": ["webkit2gtk"],
    "libappindicator-gtk3": ["libappindicator-gtk3"],
    "librsvg": ["librsvg"],
    "openssl": ["openssl"],
}

# If you want fully interactive installs, set FMD_PACMAN_NOCONFIRM=0
PACMAN_NOCONFIRM = os.environ.get("FMD_PACMAN_NOCONFIRM", "1") != "0"
# Optional: do a full sync+upgrade before installing. Set FMD_PACMAN_UPGRADE=0 to disable.
PACMAN_UPGRADE = os.environ.get("FMD_PACMAN_UPGRADE", "1") != "0"


def _gather_missing_tool_names(checks: List[Check]) -> List[str]:
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    return [m.name for m in missing]


def _expand_packages(tools: Iterable[str]) -> tuple[list[str], list[str]]:
    pkgs: Set[str] = set()
    unknown: List[str] = []

    for tool in tools:
        entries = PACMAN_MAP.get(tool)
        if entries is None:
            unknown.append(tool)
            continue
        for pkg in entries:
            if pkg:
                pkgs.add(pkg)

    return (sorted(pkgs), unknown)


def _run_cmd(cmd: list[str], dry_run: bool) -> int:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0
    try:
        subprocess.run(cmd, check=True)
        return 0
    except subprocess.CalledProcessError as e:
        print(f"{ICONS['err']} Error running (exit {e.returncode}): {' '.join(cmd)}")
        return int(e.returncode) if e.returncode is not None else 1


def _run_capture(cmd: list[str], dry_run: bool) -> tuple[int, str]:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0, ""
    try:
        p = subprocess.run(
            cmd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        return p.returncode, (p.stdout or "")
    except OSError as e:
        print(f"{ICONS['err']} Error running: {' '.join(cmd)} ({e})")
        return 1, ""


def _maybe_run_pacman_keyring_fix(pacman_output: str, dry_run: bool) -> bool:
    # tools/fixes/pacman_keyring_fix.py
    fix_script = Path(__file__).resolve().parents[2] / "fixes" / "pacman_keyring_fix.py"
    if not fix_script.exists():
        return False

    spec = importlib.util.spec_from_file_location("pacman_keyring_fix", fix_script)
    if spec is None or spec.loader is None:
        print(f"{ICONS['warn']} Unable to load pacman keyring fix module spec.")
        return False

    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except Exception as e:
        print(f"{ICONS['warn']} Unable to load pacman keyring fix: {e}")
        return False

    should_apply = getattr(module, "should_apply", None)
    if not callable(should_apply):
        print(f"{ICONS['warn']} pacman_keyring_fix missing should_apply().")
        return False

    if not should_apply(pacman_output):
        return False

    rc, _ = _run_capture([sys.executable, str(fix_script)], dry_run=dry_run)
    return rc == 0


def _install_pacman(packages: list[str], dry_run: bool) -> int:
    if not packages:
        print(f"{ICONS['ok']} Everything is already installed (per Doctor).")
        return 0

    if not shutil.which("pacman"):
        print(f"{ICONS['err']} pacman not found. This installer is for Arch/pacman systems.")
        return 1

    base_flags = ["sudo", "pacman"]
    if PACMAN_UPGRADE:
        # Keep system consistent (avoids partial upgrades / dependency weirdness)
        upgrade_cmd = [*base_flags, "-Syu"]
        if PACMAN_NOCONFIRM:
            upgrade_cmd.insert(3, "--noconfirm")
        rc = _run_cmd(upgrade_cmd, dry_run=dry_run)
        if rc != 0:
            return rc

    install_cmd = [*base_flags, "-S", "--needed"]
    if PACMAN_NOCONFIRM:
        install_cmd.append("--noconfirm")
    install_cmd.extend(packages)

    rc, out = _run_capture(install_cmd, dry_run)
    if rc == 0:
        return 0

    # Try keyring fix if it looks like a signature/key issue
    if _maybe_run_pacman_keyring_fix(out, dry_run=dry_run):
        rc2, out2 = _run_capture(install_cmd, dry_run)
        if rc2 == 0:
            return 0
        if out2:
            print(out2)
        return rc2

    if out:
        print(out)
    return rc


def run_install(dry_run: bool = False) -> int:
    checks = collect_checks()
    missing_tools = _gather_missing_tool_names(checks)
    packages, unknown = _expand_packages(missing_tools)

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    print(f"{ICONS['info']} Installer: Arch/pacman")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    if unknown:
        print(f"{ICONS['warn']} No mapping for these tools (ignored): {', '.join(unknown)}")

    print(f"{ICONS['info']} Installing packages: {', '.join(packages)}")
    return _install_pacman(packages, dry_run=dry_run)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

---

## 📝 installuixdeb.py — ./inst/linux/installuixdeb.py

#!/usr/bin/env python3
"""
Debian installer (apt-get).

Rust is installed via official rustup script to avoid apt conflicts and version drift.
Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

# Debian == Ubuntu implementation for now (same logic, different defaults/fallbacks)
from installuixubu import run_install  # re-export


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

---

## 📝 installuixtauri.py — ./inst/linux/installuixtauri.py

#!/usr/bin/env python3
"""Linux-only: prepare Tauri dev env + scaffold a pnpm + React/TS Tauri app.

Stages (order):
1) WASD libs (WebKit2GTK + GUI deps)
2) Build deps (cc/make/pkg-config)
3) Node tooling (node/npm + pnpm)
4) Rust toolchain (rustup + stable toolchain)
5) Scaffold (create-tauri-app) + pnpm install (+ optional dev)

Entry for tools/control.py: run_install(dry_run: bool=False) -> int
"""

from __future__ import annotations

import argparse, os, platform, shutil, subprocess, sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ICONS: Dict[str, str] = {
    "ok": "✅", "info": "ℹ️", "warn": "⚠️", "err": "❌", "run": "▶️",
    "step": "🧩", "box": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
}
_DRY_RUN = False

def eprint(*a: object) -> None: print(*a, file=sys.stderr)

def section(title: str) -> None:
    print(f"\n{ICONS['box']}\n{ICONS['step']} {title}\n{ICONS['box']}\n")

def run(cmd: List[str], *, cwd: Optional[Path]=None, env: Optional[Dict[str,str]]=None, check: bool=True) -> subprocess.CompletedProcess:
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")
    if _DRY_RUN:
        return subprocess.CompletedProcess(cmd, 0)
    proc = subprocess.run(cmd, cwd=str(cwd) if cwd else None, env=env, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed (exit {proc.returncode}): {' '.join(cmd)}")
    return proc

def cmd_ok(cmd: List[str]) -> bool:
    if _DRY_RUN: return True
    try: return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    except Exception: return False

def which(cmd: str) -> Optional[str]: return shutil.which(cmd)

def display_available() -> bool:
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))

def ensure_not_root() -> None:
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        raise RuntimeError("Please run as a normal user (not root).")

def read_os_release() -> Dict[str, str]:
    p = Path("/etc/os-release")
    if not p.exists(): return {}
    out: Dict[str, str] = {}
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        k, v = line.split("=", 1)
        out[k] = v.strip().strip('"')
    return out

def detect_linux_family() -> Tuple[str, Dict[str, str]]:
    osr = read_os_release()
    os_id = (osr.get("ID") or "").lower()
    like = (osr.get("ID_LIKE") or "").lower().split()
    if os_id in {"debian","ubuntu"} or "debian" in like or "ubuntu" in like: return "debian", osr
    if os_id in {"arch","manjaro","endeavouros","cachyos"} or "arch" in like: return "arch", osr
    if which("apt-get") or which("apt"): return "debian", osr
    if which("pacman"): return "arch", osr
    return "unknown", osr

def pkg_config_exists(name: str) -> bool:
    return which("pkg-config") is not None and cmd_ok(["pkg-config","--exists",name])

def need_wasd_deps() -> bool:
    for r in ["webkit2gtk-4.1","gtk+-3.0","openssl","librsvg-2.0"]:
        if not pkg_config_exists(r): return True
    return False

def need_build_deps() -> bool:
    return any(which(c) is None for c in ["cc","make","pkg-config"])

def rust_ready() -> bool:
    # which(rustc) may be a rustup shim; we require the toolchain to be active.
    return cmd_ok(["rustc","--version"]) and cmd_ok(["cargo","--version"])

def _install_apt(pkgs: List[str]) -> None:
    env = dict(os.environ); env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["sudo","apt-get","update"], env=env)
    run(["sudo","apt-get","install","-y",*pkgs], env=env)

def _install_pacman(pkgs: List[str]) -> None:
    run(["sudo","pacman","-S","--needed","--noconfirm",*pkgs])

def install_wasd_deps(family: str) -> None:
    if family == "debian":
        pkgs = [
            "libwebkit2gtk-4.1-dev","libgtk-3-dev","libssl-dev","libxdo-dev",
            "librsvg2-dev","libayatana-appindicator3-dev","pkg-config"
        ]
        if not display_available():
            pkgs.append("xvfb")
        _install_apt(pkgs)
        return
    if family == "arch":
        _install_pacman([
            "webkit2gtk-4.1","gtk3","openssl","xdotool","librsvg",
            "appmenu-gtk-module","libappindicator-gtk3","pkgconf"
        ])
        return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def install_build_deps(family: str) -> None:
    if family == "debian": _install_apt(["build-essential","curl","wget","file","pkg-config"]); return
    if family == "arch": _install_pacman(["base-devel","curl","wget","file","pkgconf"]); return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def install_node_deps(family: str) -> None:
    if family == "debian": _install_apt(["nodejs","npm"]); return
    if family == "arch": _install_pacman(["nodejs","npm","pnpm"]); return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def install_rustup_pkg(family: str) -> None:
    if family == "debian": _install_apt(["rustup"]); return
    if family == "arch": _install_pacman(["rustup"]); return
    raise RuntimeError(f"Unsupported Linux family for auto-install: {family}")

def ensure_pnpm(family: str) -> None:
    if which("pnpm"): print(f"{ICONS['ok']} pnpm gefunden."); return
    if _DRY_RUN: print(f"{ICONS['info']} pnpm fehlt; dry-run wuerde installieren."); return

    # Arch: prefer pacman (avoids npm -g permission/EACCES).
    if family == "arch" and which("pacman"):
        try: _install_pacman(["pnpm"])
        except Exception: pass
        if which("pnpm"): print(f"{ICONS['ok']} pnpm installiert (pacman)."); return

    # Prefer corepack when available.
    if which("corepack"):
        run(["corepack","enable"], check=False)
        run(["corepack","prepare","pnpm@latest","--activate"], check=False)
        if which("pnpm"): print(f"{ICONS['ok']} pnpm aktiviert (corepack)."); return

    # Fallback: npm -g (may require sudo).
    if which("npm"):
        try: run(["npm","i","-g","pnpm"], check=True)
        except Exception: run(["sudo","npm","i","-g","pnpm"], check=True)
        if which("pnpm"): print(f"{ICONS['ok']} pnpm installiert (npm -g)."); return

    raise RuntimeError("Could not install/enable pnpm automatically.")

def ensure_rust(family: str) -> None:
    if rust_ready(): print(f"{ICONS['ok']} Rust Toolchain aktiv."); return
    if _DRY_RUN: print(f"{ICONS['info']} Rust fehlt/inaktiv; dry-run wuerde rustup+stable installieren."); return

    if which("rustup") is None:
        try: install_rustup_pkg(family)
        except Exception: pass

    if which("rustup") is None:
        # Fallback: official installer
        if which("bash") and which("curl"):
            run(["bash","-lc","curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y"])
        else:
            raise RuntimeError("Rust not found. Install rustup or rustc/cargo.")

    # This fixes the log case: rustup installed but "no active toolchain".
    run(["rustup","toolchain","install","stable"], check=False)
    run(["rustup","default","stable"], check=False)

    if not rust_ready():
        raise RuntimeError("Rust installed but rustc/cargo still not usable. Open a new shell and re-run.")
    print(f"{ICONS['ok']} Rust Toolchain aktiviert (stable).")

def report_rust_status() -> None:
    section("Rust Status")
    def ver(cmd: str) -> str:
        try:
            p = subprocess.run([cmd,"--version"], capture_output=True, text=True)
            return p.stdout.strip() if p.returncode == 0 else f"{cmd} not available"
        except Exception:
            return f"{cmd} not available"
    print(f"{ICONS['info']} rustc: {which('rustc') or '-'} ({ver('rustc')})")
    print(f"{ICONS['info']} cargo: {which('cargo') or '-'} ({ver('cargo')})")
    if which("rustup"):
        p = subprocess.run(["rustup","show"], capture_output=True, text=True)
        if p.returncode == 0: print(f"{ICONS['info']} rustup show:\n{p.stdout.strip()}")
    print(f"{ICONS['ok']} Rust bereit." if rust_ready() else f"{ICONS['warn']} Rust noch nicht bereit.")

def ensure_target_dir(target_dir: Path, force: bool) -> bool:
    if target_dir.exists():
        if force or (target_dir.is_dir() and not any(target_dir.iterdir())): return True
        print(f"{ICONS['warn']} Target exists and is not empty: {target_dir}")
        print(f"{ICONS['info']} Skipping scaffold; continuing with install steps in that directory.")
        return False
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    return True

def scaffold_project(target_dir: Path, template: str, identifier: str) -> None:
    section("Scaffold (create-tauri-app)")
    # create-tauri-app supports: --manager, --template, --yes, --identifier
    run([
        "pnpm","create","tauri-app",
        "--template",template,
        "--manager","pnpm",
        "--yes",
        "--identifier",identifier,
        str(target_dir)
    ])

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description="Prepare Linux for Tauri (WASD libs, pnpm, rustup, scaffold).")
    ap.add_argument("--target", default="apps/fmd-desktop")
    ap.add_argument("--template", default="react-ts")
    ap.add_argument("--identifier", default="com.fmd.flashcard")
    ap.add_argument("--repo-root", default=None)
    ap.add_argument("--skip-system-deps", action="store_true")
    ap.add_argument("--full-upgrade-arch", action="store_true")
    ap.add_argument("--skip-install", action="store_true")
    ap.add_argument("--dev", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args(argv)

    if platform.system().lower() != "linux":
        eprint("This script is Linux-only."); return 2

    try:
        ensure_not_root()
        family, osr = detect_linux_family()

        # tools/inst/linux/installuixtauri.py -> parents[3] == repo root
        repo_root = (
            Path(args.repo_root).expanduser().resolve()
            if args.repo_root
            else Path(__file__).resolve().parents[3]
        )
        target_dir = (repo_root / args.target).resolve()

        section("Context")
        print(f"{ICONS['info']} Detected distro family: {family} (ID={osr.get('ID')})")
        print(f"{ICONS['info']} Repo root: {repo_root}")
        print(f"{ICONS['info']} Target dir: {target_dir}")

        if not args.skip_system_deps and family != "unknown":
            if family == "arch" and args.full_upgrade_arch:
                section("Arch: Full upgrade"); run(["sudo","pacman","-Syu","--noconfirm"])

            section("System deps: WASD libs (WebView/GUI)")
            if need_wasd_deps():
                print(f"{ICONS['warn']} Missing -> installing...")
                install_wasd_deps(family)
            else:
                print(f"{ICONS['ok']} OK -> skipping.")

            section("System deps: Build toolchain")
            if need_build_deps():
                print(f"{ICONS['warn']} Missing -> installing...")
                install_build_deps(family)
            else:
                print(f"{ICONS['ok']} OK -> skipping.")

            section("System deps: Node tooling")
            if which("node") is None or which("npm") is None:
                print(f"{ICONS['warn']} Missing -> installing...")
                install_node_deps(family)
            else:
                print(f"{ICONS['ok']} OK -> skipping.")
        else:
            section("System deps")
            print(f"{ICONS['info']} Skipped (requested or unknown distro).")

        section("Ensure pnpm"); ensure_pnpm(family)
        section("Ensure Rust toolchain"); ensure_rust(family); report_rust_status()

        if ensure_target_dir(target_dir, force=args.force):
            scaffold_project(target_dir, template=args.template, identifier=args.identifier)

        if not args.skip_install:
            section("pnpm install"); run(["pnpm","install"], cwd=target_dir)
        if args.dev:
            section("pnpm tauri dev"); run(["pnpm","tauri","dev"], cwd=target_dir)

        section("Done")
        print(f"{ICONS['ok']} Fertig.")
        if not args.dev:
            print(f"{ICONS['info']} Next:")
            print("  python3 tools/control.py --start")
            if not display_available():
                print("  (headless) xvfb-run -a pnpm tauri dev")
            print(f"  oder: cd {target_dir} && pnpm tauri dev")
        return 0
    except Exception as ex:
        eprint(f"{ICONS['err']} {ex}"); return 1

def run_install(dry_run: bool = False) -> int:
    global _DRY_RUN
    _DRY_RUN = dry_run
    return main([])

if __name__ == "__main__":
    raise SystemExit(main())

---

## 📝 installuixubu.py — ./inst/linux/installuixubu.py

#!/usr/bin/env python3
"""
Ubuntu installer (apt-get).

Rust is installed via official rustup script to avoid apt rustup/cargo/rustc conflicts.
Exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Iterable, List, Set

from doctor import Check, CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}

PackageMap = Dict[str, Iterable[str]]

APT_MAP: PackageMap = {
    "git": ["git"],
    "curl": ["curl"],
    "file": ["file"],
    "pkg-config": ["pkg-config"],
    "cmake": ["cmake"],
    # build chain
    "make": ["build-essential"],
    "gcc": ["build-essential"],
    "g++": ["build-essential"],
    # rust: handled via rustup script (no apt mapping)
    "rustup": [],
    "rustc": [],
    "cargo": [],
    # node
    "node": ["nodejs"],
    "npm": ["npm"],
    # Tauri / WebView deps
    "gtk3": ["libgtk-3-dev"],
    "webkit2gtk": ["libwebkit2gtk-4.1-dev", "libwebkit2gtk-4.0-dev"],
    "libappindicator-gtk3": ["libayatana-appindicator3-dev", "libappindicator3-dev"],
    "librsvg": ["librsvg2-dev"],
    "openssl": ["libssl-dev"],
}


def _gather_missing_tool_names(checks: List[Check]) -> List[str]:
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    return [m.name for m in missing]


def _run_cmd(cmd: list[str], dry_run: bool) -> int:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0
    try:
        subprocess.run(cmd, check=True)
        return 0
    except subprocess.CalledProcessError as e:
        print(f"{ICONS['err']} Error running (exit {e.returncode}): {' '.join(cmd)}")
        return int(e.returncode) if e.returncode is not None else 1


def _run_capture(cmd: list[str], dry_run: bool) -> tuple[int, str]:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0, ""
    p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.returncode, (p.stdout or "")


def _apt_pkg_exists(pkg: str, dry_run: bool) -> bool:
    # apt-cache is non-root and works for existence probing
    rc, _ = _run_capture(["apt-cache", "show", pkg], dry_run=dry_run)
    return rc == 0


def _expand_packages(tools: Iterable[str], dry_run: bool) -> tuple[list[str], list[str]]:
    pkgs: Set[str] = set()
    unknown: List[str] = []

    for tool in tools:
        entries = APT_MAP.get(tool)
        if entries is None:
            unknown.append(tool)
            continue

        # pick first existing package from alternatives
        chosen = None
        for pkg in entries:
            if not pkg:
                continue
            if _apt_pkg_exists(pkg, dry_run=dry_run):
                chosen = pkg
                break
        if chosen:
            pkgs.add(chosen)

    return (sorted(pkgs), unknown)


def _ensure_rustup(dry_run: bool) -> int:
    # If rustup already present, assume toolchain is OK.
    if shutil.which("rustup") and shutil.which("cargo") and shutil.which("rustc"):
        return 0

    # Install rustup via official script (non-apt)
    cmd = [
        "bash",
        "-lc",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    ]
    rc = _run_cmd(cmd, dry_run=dry_run)
    if rc != 0:
        return rc

    # Make it usable for subsequent commands in this same process
    cargo_bin = str(Path.home() / ".cargo" / "bin")
    os.environ["PATH"] = cargo_bin + ":" + os.environ.get("PATH", "")

    # Ensure stable toolchain (cargo/rustc)
    rustup = shutil.which("rustup") or str(Path.home() / ".cargo" / "bin" / "rustup")
    rc2 = _run_cmd([rustup, "default", "stable"], dry_run=dry_run)
    return rc2


def run_install(dry_run: bool = False) -> int:
    if not shutil.which("apt-get"):
        print(f"{ICONS['err']} apt-get not found. This installer is for Ubuntu/apt systems.")
        return 1

    checks = collect_checks()
    missing_tools = _gather_missing_tool_names(checks)

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    print(f"{ICONS['info']} Installer: Ubuntu/apt")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    packages, unknown = _expand_packages(missing_tools, dry_run=dry_run)
    if unknown:
        print(f"{ICONS['warn']} No mapping for these tools (ignored): {', '.join(unknown)}")

    # apt deps first
    if packages:
        rc = _run_cmd(["sudo", "apt-get", "update"], dry_run=dry_run)
        if rc != 0:
            return rc
        rc = _run_cmd(["sudo", "apt-get", "install", "-y", *packages], dry_run=dry_run)
        if rc != 0:
            return rc

    # rust via rustup if any rust-related tool is missing
    if any(t in set(missing_tools) for t in ("rustup", "cargo", "rustc")):
        rc = _ensure_rustup(dry_run=dry_run)
        if rc != 0:
            return rc

    return 0


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

---

## 📝 installuixvs.py — ./inst/linux/installuixvs.py

#!/usr/bin/env python3
"""
Unified VS Code installer for Linux/Unix.

Supports:
- Arch and derivatives (pacman, optional AUR helper)
- Debian/Ubuntu (official .deb download)
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from typing import List, Optional

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}


def read_os_release() -> dict:
    data = {}
    try:
        with open("/etc/os-release", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                data[k] = v.strip().strip('"')
    except FileNotFoundError:
        pass
    return data


def is_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


def run(
    cmd: List[str],
    check: bool = True,
    env: dict | None = None,
    use_sudo: bool = True,
) -> None:
    if use_sudo and not is_root() and shutil.which("sudo"):
        cmd = ["sudo"] + cmd
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=check, env=env)


def pacman_install(pkgs: List[str]) -> None:
    run(["pacman", "-Syu", "--noconfirm"])
    run(["pacman", "-S", "--needed", "--noconfirm", *pkgs])


def aur_install(helper: str, pkg: str) -> None:
    if is_root():
        raise RuntimeError("AUR helper darf nicht als root laufen. Bitte ohne sudo ausfuehren.")
    run([helper, "-S", "--needed", "--noconfirm", pkg], use_sudo=False)


def ensure_pkg(pkg: str) -> None:
    if shutil.which(pkg):
        return
    env = dict(os.environ)
    env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["apt-get", "update"], env=env)
    run(["apt-get", "install", "-y", pkg], env=env)


def arch_to_vscode_deb_target() -> str:
    m = platform.machine().lower()
    if m in {"x86_64", "amd64"}:
        return "linux-deb-x64"
    if m in {"aarch64", "arm64"}:
        return "linux-deb-arm64"
    if m.startswith("armv7") or m in {"armhf"}:
        return "linux-deb-armhf"
    raise RuntimeError(f"Unsupported architecture for VS Code deb: {m}")


def install_arch() -> int:
    if shutil.which("code"):
        print(f"{ICONS['info']} VS Code ist bereits installiert (binary: code).")
        return 0

    # Default: Microsoft-Build (AUR) wenn moeglich, sonst OSS-build aus pacman.
    # Setze VSCODE_VARIANT=oss um immer pacman 'code' zu nehmen.
    variant = os.environ.get("VSCODE_VARIANT", "ms").lower().strip()

    if variant == "oss":
        pacman_install(["code"])
        print(f"{ICONS['ok']} Code - OSS installiert (pacman: code).")
        return 0

    helper: Optional[str] = None
    for h in ("paru", "yay"):
        if shutil.which(h):
            helper = h
            break

    if helper:
        # AUR helper muss bereits vorhanden sein; Skript installiert ihn bewusst nicht automatisch.
        aur_install(helper, "visual-studio-code-bin")
        print(
            f"{ICONS['ok']} Visual Studio Code (Microsoft build) installiert "
            "(AUR: visual-studio-code-bin)."
        )
        return 0

    pacman_install(["code"])
    print(
        f"{ICONS['warn']} Kein AUR helper (paru/yay) gefunden -> "
        "Code - OSS installiert (pacman: code)."
    )
    print(
        f"{ICONS['info']} Wenn du den Microsoft-Build willst: installiere paru/yay "
        "und dann VSCODE_VARIANT=ms ausfuehren."
    )
    return 0


def install_deb_like() -> int:
    if shutil.which("code"):
        print(f"{ICONS['info']} VS Code ist bereits installiert (binary: code).")
        return 0

    ensure_pkg("curl")

    target = arch_to_vscode_deb_target()
    url = f"https://update.code.visualstudio.com/latest/{target}/stable"
    deb_path = "/tmp/vscode-latest.deb"

    print(f"Download: {url}")
    run(["curl", "-L", "-o", deb_path, url])

    env = dict(os.environ)
    env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["apt-get", "update"], env=env)
    run(["apt", "install", "-y", deb_path], env=env)

    print(f"{ICONS['ok']} Visual Studio Code installiert.")
    return 0


def _main() -> int:
    osr = read_os_release()
    os_id = (osr.get("ID") or "").lower()
    os_like = (osr.get("ID_LIKE") or "").lower().split()
    has_pacman = shutil.which("pacman") is not None
    has_apt = shutil.which("apt-get") is not None

    if os_id in {"arch", "manjaro", "endeavouros", "cachyos"} or "arch" in os_like or has_pacman:
        return install_arch()

    if os_id in {"debian", "ubuntu"} or "debian" in os_like or "ubuntu" in os_like or has_apt:
        return install_deb_like()

    print(
        f"{ICONS['err']} Dieses Skript ist fuer Arch/Derivate, Debian oder Ubuntu gedacht. "
        f"Detected ID={os_id}, ID_LIKE={' '.join(os_like) if os_like else '-'}"
    )
    return 2


def main() -> int:
    try:
        return _main()
    except subprocess.CalledProcessError as e:
        cmd = e.cmd
        cmd_text = " ".join(str(c) for c in cmd) if isinstance(cmd, list) else str(cmd)
        code = int(e.returncode) if e.returncode is not None else 1
        print(f"{ICONS['err']} Fehler beim Ausfuehren (exit {code}): {cmd_text}")
        return code
    except Exception as e:
        print(f"{ICONS['err']} Fehler: {e}")
        return 1


def run_install() -> int:
    return main()


if __name__ == "__main__":
    sys.exit(main())

---

## 📝 installmac.py — ./inst/mac/installmac.py

#!/usr/bin/env python3
"""macOS installer.

Uses Homebrew where possible. Rust is installed via rustup (recommended).

This module exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import shutil
import subprocess
from typing import List, Set

from doctor import CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}


# Tool-name -> brew formulae.
# Notes:
# - `file` and `curl` are typically preinstalled on macOS.
# - `make`, `gcc`, `g++` on macOS usually come from Xcode Command Line Tools.
BREW_MAP = {
    "git": ["git"],
    "pkg-config": ["pkg-config"],
    "cmake": ["cmake"],
    "node": ["node"],  # includes npm
    "npm": ["node"],
}


def _run(cmd: List[str], dry_run: bool) -> int:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0
    try:
        subprocess.run(cmd, check=True)
        return 0
    except subprocess.CalledProcessError as e:
        print(f"{ICONS['err']} Error running (exit {e.returncode}): {' '.join(cmd)}")
        return int(e.returncode) if e.returncode is not None else 1


def _install_brew(formulae: List[str], dry_run: bool) -> int:
    if not formulae:
        return 0
    # brew install supports multiple formulae at once.
    return _run(["brew", "install", *formulae], dry_run)


def _install_rustup(dry_run: bool) -> int:
    # Standard rustup installer (non-interactive).
    # It will add rust toolchain to your environment (shell profile may be updated).
    cmd = [
        "bash",
        "-lc",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y",
    ]
    return _run(cmd, dry_run)


def run_install(dry_run: bool = False) -> int:
    if not shutil.which("brew"):
        print(
            f"{ICONS['err']} Homebrew not found. Install Homebrew or install dependencies manually."
        )
        return 1

    checks = collect_checks()
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    missing_tools = [c.name for c in missing]

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    # Collect brew formulae.
    formulae: Set[str] = set()
    wants_rustup = False

    for tool in missing_tools:
        if tool in ("rustup", "rustc", "cargo"):
            wants_rustup = True
            continue
        for f in BREW_MAP.get(tool, []):
            if f:
                formulae.add(f)

    # Xcode Command Line Tools hint.
    needs_xcode = any(t in ("make", "gcc", "g++") for t in missing_tools)
    if needs_xcode:
        print(
            f"{ICONS['info']} For make/gcc/g++ you typically need Xcode Command Line Tools on macOS:"
        )
        print(f"{ICONS['run']} xcode-select --install")

    # Brew install
    rc = _install_brew(sorted(formulae), dry_run)
    if rc != 0:
        return rc

    # Rust
    if wants_rustup:
        print(f"{ICONS['info']} Installing Rust via rustup...")
        rc = _install_rustup(dry_run)
        if rc != 0:
            return rc

    print(f"{ICONS['ok']} Installation completed (as far as supported).")
    return 0


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

---

## 📝 run.py — ./inst/run.py

#!/usr/bin/env python3
"""
Run the Tauri desktop app in dev mode.

control.py entry:
  python3 tools/control.py --start (alias: --run)

What it does (default):
  cd <repo>/apps/fmd-desktop
  (optional) pnpm install (if node_modules missing)
  pnpm tauri dev
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
import signal
from pathlib import Path
from typing import List, Optional

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
    "box": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
}

_DRY_RUN = False


def section(title: str) -> None:
    print(f"\n{ICONS['box']}\n{ICONS['info']} {title}\n{ICONS['box']}")


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def display_available() -> bool:
    return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))


def ensure_xvfb() -> bool:
    if which("xvfb-run"):
        return True
    if _DRY_RUN:
        print(f"{ICONS['info']} Dry run: would install xvfb.")
        return True

    if which("apt-get"):
        run(["sudo", "apt-get", "install", "-y", "xvfb"], check=False)
        if which("xvfb-run"):
            return True

    if which("pacman"):
        for pkg in ["xorg-server-xvfb", "xvfb"]:
            run(["sudo", "pacman", "-S", "--needed", "--noconfirm", pkg], check=False)
            if which("xvfb-run"):
                return True

    return False


def run(cmd: List[str], *, cwd: Optional[Path] = None, check: bool = True) -> int:
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")
    if _DRY_RUN:
        return 0
    p = subprocess.run(cmd, cwd=str(cwd) if cwd else None)
    if check and p.returncode != 0:
        raise RuntimeError(f"Command failed (exit {p.returncode}): {' '.join(cmd)}")
    return p.returncode


def run_with_interrupt_prompt(
    cmd: List[str],
    *,
    cwd: Optional[Path] = None,
    check: bool = True,
) -> int:
    if _DRY_RUN or not sys.stdin.isatty():
        return run(cmd, cwd=cwd, check=check)
    cwd_txt = f" (cwd={cwd})" if cwd else ""
    print(f"{ICONS['run']} {' '.join(cmd)}{cwd_txt}")

    popen_kwargs: dict = {}
    if os.name == "posix":
        popen_kwargs["start_new_session"] = True
    elif sys.platform == "win32" and hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    p = subprocess.Popen(cmd, cwd=str(cwd) if cwd else None, **popen_kwargs)
    while True:
        try:
            rc = p.wait()
            break
        except KeyboardInterrupt:
            if p.poll() is not None:
                rc = p.returncode
                break
            if _confirm_exit():
                _signal_child(p, signal.SIGINT)
                rc = p.wait()
                break
            print(f"{ICONS['info']} Weiter...")
            continue

    if check and rc != 0:
        raise RuntimeError(f"Command failed (exit {rc}): {' '.join(cmd)}")
    return rc


def _confirm_exit() -> bool:
    while True:
        try:
            answer = input("Beenden? (j/n) ").strip().lower()
        except (KeyboardInterrupt, EOFError):
            print()
            return True
        if answer in {"j", "ja", "y", "yes"}:
            return True
        if answer in {"n", "nein", ""}:
            return False
        print("Bitte 'j' oder 'n' eingeben.")


def _signal_child(proc: subprocess.Popen, sig: int) -> None:
    try:
        if os.name == "posix":
            os.killpg(proc.pid, sig)
        else:
            proc.send_signal(sig)
    except ProcessLookupError:
        return
    except Exception:
        try:
            proc.send_signal(sig)
        except Exception:
            return


def cmd_ok(cmd: List[str]) -> bool:
    if _DRY_RUN:
        return True
    try:
        return (
            subprocess.run(
                cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            ).returncode
            == 0
        )
    except Exception:
        return False


def repo_root_from_here() -> Path:
    # tools/inst/run.py -> parents[2] == repo root
    return Path(__file__).resolve().parents[2]


def run_install(dry_run: bool = False) -> int:
    """
    Entry point used by control.py.
    """
    global _DRY_RUN
    _DRY_RUN = dry_run

    if platform.system().lower() != "linux":
        print(
            f"{ICONS['warn']} --start/--run is primarily intended for Linux Tauri dev; "
            f"OS={platform.system()}."
        )
        # Still attempt to run in case pnpm/tauri is usable.
    try:
        repo_root = repo_root_from_here()
        target_dir = (repo_root / "apps" / "fmd-desktop").resolve()
        legacy_dir = (repo_root / "tools" / "apps" / "fmd-desktop").resolve()
        if not target_dir.exists() and legacy_dir.exists():
            print(
                f"{ICONS['warn']} Found legacy path (tools/apps). "
                "Consider re-running --tauri to scaffold into /apps."
            )
            target_dir = legacy_dir

        section("Run Context")
        print(f"{ICONS['info']} Repo root:  {repo_root}")
        print(f"{ICONS['info']} Target dir: {target_dir}")

        if not target_dir.exists():
            print(f"{ICONS['err']} Target directory not found.")
            print(f"{ICONS['info']} Create it first with: python3 tools/control.py --tauri")
            return 1

        if which("pnpm") is None:
            print(f"{ICONS['err']} pnpm not found in PATH.")
            print(f"{ICONS['info']} Fix with: python3 tools/control.py --tauri (or install pnpm)")
            return 1

        # Rust must be functional for Tauri.
        if not (cmd_ok(["rustc", "--version"]) and cmd_ok(["cargo", "--version"])):
            print(
                f"{ICONS['err']} Rust toolchain not usable "
                "(rustc/cargo missing or no active toolchain)."
            )
            print(f"{ICONS['info']} Fix with: python3 tools/control.py --tauri")
            return 1
        print(f"{ICONS['ok']} Rust toolchain OK.")

        # If node_modules missing, install deps first.
        node_modules = target_dir / "node_modules"
        if not node_modules.exists():
            section("Install JS dependencies")
            run(["pnpm", "install"], cwd=target_dir)
        else:
            print(f"{ICONS['ok']} node_modules present -> skipping pnpm install.")

        section("Start Tauri dev")
        print(f"{ICONS['info']} Stop with Ctrl+C, then confirm with j/n.")
        dev_cmd = ["pnpm", "tauri", "dev"]
        rc = run_with_interrupt_prompt(dev_cmd, cwd=target_dir, check=False)
        if rc == 0:
            return 0

        if platform.system().lower() == "linux" and not display_available():
            print(f"{ICONS['warn']} Tauri dev exited (code {rc}); trying xvfb-run.")
            if ensure_xvfb():
                xvfb_run = which("xvfb-run")
                if xvfb_run:
                    print(f"{ICONS['info']} Using xvfb-run after failure.")
                    return run([xvfb_run, "-a", *dev_cmd], cwd=target_dir, check=True)

            print(f"{ICONS['err']} No display detected and xvfb-run not available.")
            if which("apt-get"):
                hint = "sudo apt-get install -y xvfb"
            elif which("pacman"):
                hint = "sudo pacman -S --needed xorg-server-xvfb"
            else:
                hint = "Install xvfb with your package manager"
            print(f"{ICONS['info']} Fix with: {hint}")
            print(f"{ICONS['info']} Then run: python3 tools/control.py --start")
            return 1

        return rc
    except Exception as ex:
        print(f"{ICONS['err']} {ex}")
        return 1


if __name__ == "__main__":
    raise SystemExit(run_install(False))

---

## 📝 installwin.py — ./inst/win/installwin.py

#!/usr/bin/env python3
"""Windows installer.

Tries to install missing tools using one of:
- winget (preferred)
- choco
- scoop

This module exposes: run_install(dry_run: bool = False) -> int
"""

from __future__ import annotations

import shutil
import subprocess
from typing import List, Set, Tuple

from doctor import CRITICAL_CATEGORIES, collect_checks, missing_checks

ICONS = {
    "ok": "✅",
    "info": "ℹ️",
    "warn": "⚠️",
    "err": "❌",
    "run": "▶️",
}


# Tool-name -> winget package IDs (exact match)
WINGET_MAP = {
    "git": ["Git.Git"],
    "node": ["OpenJS.NodeJS.LTS"],
    "npm": ["OpenJS.NodeJS.LTS"],
    "rustup": ["Rustlang.Rustup"],
    # `curl` is usually present on modern Windows; `file`, `make`, `gcc` are not handled here.
}

# Tool-name -> Chocolatey packages
CHOCO_MAP = {
    "git": ["git"],
    "node": ["nodejs-lts"],
    "npm": ["nodejs-lts"],
    "rustup": ["rustup.install"],
}

# Tool-name -> Scoop apps
SCOOP_MAP = {
    "git": ["git"],
    "node": ["nodejs-lts"],
    "npm": ["nodejs-lts"],
    "rustup": ["rustup"],
}


def _detect_manager() -> str | None:
    if shutil.which("winget"):
        return "winget"
    if shutil.which("choco"):
        return "choco"
    if shutil.which("scoop"):
        return "scoop"
    return None


def _run(cmd: List[str], dry_run: bool) -> int:
    print(f"{ICONS['run']} {' '.join(cmd)}")
    if dry_run:
        print(f"{ICONS['info']} Dry run: skipping execution.")
        return 0
    try:
        subprocess.run(cmd, check=True)
        return 0
    except subprocess.CalledProcessError as e:
        print(f"{ICONS['err']} Error running (exit {e.returncode}): {' '.join(cmd)}")
        return int(e.returncode) if e.returncode is not None else 1


def _expand(manager: str, tools: List[str]) -> Tuple[List[str], List[str]]:
    mapping = {
        "winget": WINGET_MAP,
        "choco": CHOCO_MAP,
        "scoop": SCOOP_MAP,
    }[manager]

    pkgs: Set[str] = set()
    unknown: List[str] = []
    for t in tools:
        entries = mapping.get(t)
        if entries is None:
            unknown.append(t)
            continue
        for p in entries:
            if p:
                pkgs.add(p)
    return (sorted(pkgs), unknown)


def _install(manager: str, packages: List[str], dry_run: bool) -> int:
    if not packages:
        print(f"{ICONS['ok']} Everything is already installed (per Doctor) or not supported.")
        return 0

    if manager == "winget":
        # `-e` exact match, `--id` uses the package ID.
        # Agreements flags avoid prompts.
        rc = 0
        for pkg_id in packages:
            cmd = [
                "winget",
                "install",
                "-e",
                "--id",
                pkg_id,
                "--accept-package-agreements",
                "--accept-source-agreements",
            ]
            rc = _run(cmd, dry_run)
            if rc != 0:
                return rc
        return 0

    if manager == "choco":
        return _run(["choco", "install", "-y", *packages], dry_run)

    # scoop
    return _run(["scoop", "install", *packages], dry_run)


def run_install(dry_run: bool = False) -> int:
    manager = _detect_manager()
    if not manager:
        print(
            f"{ICONS['err']} No package manager found (winget/choco/scoop).\n"
            f"{ICONS['info']} winget is usually available on Windows 10/11\n"
            f"{ICONS['info']} Alternatively install Chocolatey or Scoop"
        )
        return 1

    checks = collect_checks()
    missing = missing_checks(checks, categories=CRITICAL_CATEGORIES)
    missing_tools = [c.name for c in missing]

    if not missing_tools:
        print(f"{ICONS['ok']} No missing tools per Doctor.")
        return 0

    packages, unknown = _expand(manager, missing_tools)

    print(f"{ICONS['info']} Detected package manager: {manager}")
    print(f"{ICONS['warn']} Missing tools per Doctor: {', '.join(missing_tools)}")

    if unknown:
        print(f"{ICONS['warn']} These tools cannot be installed automatically on Windows:")
        print("\n".join([f"{ICONS['info']} {t}" for t in unknown]))
        print(f"{ICONS['info']} (e.g. make/gcc/g++ usually come from MSVC/BuildTools or WSL)")

    if not packages:
        print(f"{ICONS['err']} No installable packages determined.")
        return 1

    print(f"{ICONS['info']} Installing packages: {', '.join(packages)}")
    return _install(manager, packages, dry_run)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    raise SystemExit(run_install(dry_run=ap.parse_args().dry_run))

---

