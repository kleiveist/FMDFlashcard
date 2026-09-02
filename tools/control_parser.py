"""Argument parsing and compatibility normalization for the FMD CLI."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass

from tools import logger


class HelpFormatter(argparse.RawDescriptionHelpFormatter):
    def __init__(self, prog: str) -> None:
        super().__init__(prog, max_help_position=30, width=100)


class ControlParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # type: ignore[override]
        self.print_help(sys.stderr)
        print(file=sys.stderr)
        logger.error(f"{self.prog}: {message}", stream=sys.stderr)
        logger.info(f"Next step: {self.prog} --help", stream=sys.stderr)
        self.exit(2)


class LegacySyntaxError(ValueError):
    """Raised when old flag syntax cannot map to one unambiguous command."""


@dataclass(frozen=True, slots=True)
class NormalizationResult:
    argv: tuple[str, ...]
    original: tuple[str, ...]
    legacy: bool = False
    suppress_warning: bool = False


ROOT_DESCRIPTION = """
One entry point for FMDFlashcard development, quality, builds, and release validation.

Recommended workflow:
  1. doctor        Inspect required tools and project files without changing them.
  2. install       Install or repair explicitly selected development dependencies.
  3. run           Start the Tauri development application.
  4. quality       Run the read-only repository quality gate.
  5. test          Select a deterministic test suite.
  6. build         Select a web or native desktop build.

Groups with command maps print their guide when invoked without an action.
Legacy flag-oriented invocations remain available with a deprecation notice.
"""

ROOT_EXAMPLES = """
examples:
  python tools/control.py doctor --json
  python tools/control.py install --dry-run
  python tools/control.py run --foreground
  python tools/control.py stop
  python tools/control.py quality
  python tools/control.py test --suite all --ci
  python tools/control.py build desktop --target linux --bundles deb,rpm,appimage
  python tools/control.py tauri
  python tools/control.py version
  python tools/control.py release
"""

TEST_SUITES = ("frontend", "rust", "tooling", "tauri", "all")
DESKTOP_TARGETS = (
    "linux",
    "windows",
    "windows-portable",
    "windows-cross-linux",
    "macos",
)

_ROOT_LEGACY_ACTIONS = {
    "--doctor": "doctor",
    "--check": "doctor",
    "--install": "install",
    "--run": "run",
    "--start": "run",
    "--test": "test",
    "--tauri": "tauri-install",
    "--install-appimage": "tauri-appimage",
    "--appimage": "tauri-appimage",
    "--build": "build",
    "--build-lin": "build-linux",
    "--build-win": "build-windows",
    "--build-mac": "build-macos",
    "--vscode": "vscode",
}
_LEGACY_MODIFIERS = {"--json", "--dry-run", "--winlinux", "--copy", "-p", "--portable"}
_TAURI_LEGACY_ACTIONS = {
    "--doctor": "doctor",
    "--install": "install",
    "--run": "run",
    "--build": "build",
    "--install-appimage": "install-appimage",
    "--test": "test",
    "--copy": "copy",
}


def _fold(value: str) -> str:
    return value.casefold()


def _unique(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def normalize_argv(argv: list[str]) -> NormalizationResult:
    """Normalize historical flags before argparse sees the command line."""

    original = tuple(argv)
    if not argv:
        return NormalizationResult(tuple(argv), original)

    if not argv[0].startswith("-"):
        normalized = list(argv)
        if _fold(normalized[0]) == "tauri" and len(normalized) > 1:
            alias = _TAURI_LEGACY_ACTIONS.get(_fold(normalized[1]))
            if alias is not None:
                normalized[1] = alias
                return NormalizationResult(
                    tuple(normalized),
                    original,
                    legacy=True,
                    suppress_warning=alias == "doctor" and "--json" in normalized[2:],
                )
        return NormalizationResult(tuple(normalized), original)

    folded = [_fold(item) for item in argv]
    actions = _unique(
        [_ROOT_LEGACY_ACTIONS[item] for item in folded if item in _ROOT_LEGACY_ACTIONS]
    )
    modifiers = {item for item in folded if item in _LEGACY_MODIFIERS}
    if not actions:
        dangling = sorted(modifiers)
        if dangling:
            raise LegacySyntaxError(
                f"legacy modifier {dangling[0]!r} requires a legacy command flag"
            )
        return NormalizationResult(tuple(argv), original)
    if len(actions) != 1:
        raise LegacySyntaxError("legacy flags select multiple commands; run one command at a time")

    action = actions[0]
    known = set(_ROOT_LEGACY_ACTIONS) | _LEGACY_MODIFIERS
    remaining = [value for value in argv if _fold(value) not in known]
    has_json = "--json" in modifiers
    dry_run = "--dry-run" in modifiers
    portable = bool({"-p", "--portable"} & modifiers)
    winlinux = "--winlinux" in modifiers
    copy = "--copy" in modifiers

    if has_json and action != "doctor":
        raise LegacySyntaxError("--json is supported only with --doctor or --check")
    if (winlinux or copy) and action != "build":
        raise LegacySyntaxError("--winlinux and --copy are supported only with --build")
    if portable and action != "build-windows":
        raise LegacySyntaxError("--portable/-p is supported only with --build-win")
    if winlinux and copy:
        raise LegacySyntaxError("--build cannot combine --winlinux and --copy")

    if action == "doctor":
        canonical = ["doctor"]
        if has_json:
            canonical.append("--json")
        if dry_run:
            canonical.append("--dry-run")
    elif action == "install":
        canonical = ["install"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "run":
        canonical = ["run"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "test":
        canonical = ["test", "--suite", "frontend"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "tauri-install":
        canonical = ["tauri", "install"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "tauri-appimage":
        canonical = ["tauri", "install-appimage"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "build":
        if winlinux:
            canonical = ["build", "desktop", "--target", "windows-cross-linux"]
        elif copy:
            canonical = ["tauri", "copy"]
        else:
            canonical = ["build"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "build-linux":
        canonical = ["build", "desktop", "--target", "linux"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "build-windows":
        target = "windows-portable" if portable else "windows"
        canonical = ["build", "desktop", "--target", target]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "build-macos":
        canonical = ["build", "desktop", "--target", "macos"]
        if dry_run:
            canonical.append("--dry-run")
    elif action == "vscode":
        canonical = ["install", "--vscode"]
        if dry_run:
            canonical.append("--dry-run")
    else:  # pragma: no cover - exhaustive mapping guard
        raise LegacySyntaxError(f"unsupported legacy action: {action}")

    canonical.extend(remaining)
    return NormalizationResult(
        tuple(canonical),
        original,
        legacy=True,
        suppress_warning=action == "doctor" and has_json,
    )


def _positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def build_parser() -> ControlParser:
    parser = ControlParser(
        prog="python tools/control.py",
        description=ROOT_DESCRIPTION.strip(),
        epilog=ROOT_EXAMPLES.strip(),
        formatter_class=HelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", title="command map", metavar="<command>")
    _add_doctor(subparsers)
    _add_install(subparsers)
    _add_lifecycle(subparsers)
    _add_test(subparsers)
    _add_quality(subparsers)
    _add_build(subparsers)
    _add_docs(subparsers)
    _add_tauri(subparsers)
    _add_version_release_tooling(subparsers)
    subparsers.add_parser(
        "console",
        help="open the optional interactive command menu",
        formatter_class=HelpFormatter,
    )
    return parser


def _add_doctor(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "doctor",
        help="inspect tools and project prerequisites",
        description="Inspect the environment without changing files or installing software.",
        formatter_class=HelpFormatter,
    )
    output = parser.add_mutually_exclusive_group()
    output.add_argument("--json", action="store_true", help="emit stable machine-readable JSON")
    output.add_argument("--watch", action="store_true", help="repeat checks until interrupted")
    parser.add_argument(
        "--interval", type=_positive_int, default=5, help="watch interval in seconds (default: 5)"
    )
    parser.add_argument("--dry-run", action="store_true", help=argparse.SUPPRESS)


def _add_install(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "install",
        help="install or repair development dependencies",
        description="Prepare system, Rust, Node, and frontend dependencies in explicit stages.",
        formatter_class=HelpFormatter,
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="print the plan without commands or writes"
    )
    parser.add_argument(
        "--skip-system-deps", action="store_true", help="skip native operating-system packages"
    )
    parser.add_argument("--skip-rust", action="store_true", help="skip Rust toolchain preparation")
    parser.add_argument(
        "--skip-node", action="store_true", help="skip Node.js and pnpm preparation"
    )
    parser.add_argument(
        "--skip-frontend", action="store_true", help="skip the frozen frontend install"
    )
    parser.add_argument("--vscode", action="store_true", help=argparse.SUPPRESS)


def _add_lifecycle(subparsers: argparse._SubParsersAction) -> None:
    run_parser = subparsers.add_parser(
        "run",
        help="start Tauri development mode",
        description="Start a tracked detached process by default; foreground is explicit.",
        formatter_class=HelpFormatter,
    )
    mode = run_parser.add_mutually_exclusive_group()
    mode.add_argument("--foreground", action="store_true", help="run in the current terminal")
    mode.add_argument("--no-follow", action="store_true", help="return after detached start")
    run_parser.add_argument(
        "--dry-run", action="store_true", help="print the command without starting it"
    )
    subparsers.add_parser(
        "stop",
        help="stop only the tracked Tauri development process",
        formatter_class=HelpFormatter,
    )


def _add_test(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "test",
        help="select deterministic FMD test suites",
        description="Test map. Bare 'test' prints this guide and does not run all suites.",
        formatter_class=HelpFormatter,
    )
    parser.set_defaults(test_parser=parser)
    parser.add_argument(
        "--suite", choices=TEST_SUITES, help="suite to run; all runs every required suite"
    )
    parser.add_argument("--coverage", action="store_true", help="collect supported real coverage")
    parser.add_argument(
        "--report", action="store_true", help="write machine-readable reports under .reports"
    )
    parser.add_argument(
        "--ci", action="store_true", help="force deterministic non-interactive behavior"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="print commands without running them"
    )
    parser.epilog = """suites:
  frontend  Vitest unit and component tests
  rust      Cargo tests with Cargo.lock
  tooling   Python tooling tests
  tauri     Tauri structure and locked Cargo check
  all       frontend, rust, tooling, and tauri
"""


def _add_quality(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "quality",
        help="run the read-only repository quality gate",
        description="Bare 'quality' runs every relevant check. Mutations require --fix.",
        formatter_class=HelpFormatter,
    )
    parser.add_argument(
        "quality_command",
        nargs="?",
        default="check",
        choices=("check", "lint", "format"),
        help="focused check (default: check)",
    )
    parser.add_argument(
        "--format",
        dest="output_format",
        choices=("text", "json"),
        default="text",
        help="result format (default: text)",
    )
    parser.add_argument("--release", action="store_true", help="include release-readiness checks")
    parser.add_argument(
        "--fix", action="store_true", help="explicitly apply formatter/linter fixes"
    )


def _add_build(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "build",
        help="select a web or native desktop build",
        description="Build map. Bare 'build' prints this guide without building.",
        formatter_class=HelpFormatter,
    )
    parser.set_defaults(build_parser=parser)
    targets = parser.add_subparsers(dest="build_command", title="build targets", metavar="<target>")
    web = targets.add_parser(
        "web", help="build and archive the Vite frontend", formatter_class=HelpFormatter
    )
    web.add_argument("--dry-run", action="store_true", help="print the build plan")
    desktop = targets.add_parser(
        "desktop", help="build native Tauri packages", formatter_class=HelpFormatter
    )
    desktop.add_argument("--target", choices=DESKTOP_TARGETS, default="linux")
    desktop.add_argument("--bundles", help="comma-separated bundle formats")
    desktop.add_argument("--rust-target", help="explicit Rust compilation target triple")
    desktop.add_argument("--dry-run", action="store_true", help="print the build plan")
    desktop.add_argument(
        "--no-clean", action="store_true", help="retain old outputs but reject stale reuse"
    )
    # A normalized bare legacy --build may carry --dry-run while remaining a guide.
    parser.add_argument("--dry-run", action="store_true", help=argparse.SUPPRESS)


def _add_docs(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "docs",
        help="check or update documentation navigation",
        description="Documentation map. Bare 'docs' prints this guide.",
        formatter_class=HelpFormatter,
    )
    parser.set_defaults(docs_parser=parser)
    actions = parser.add_subparsers(
        dest="docs_command", title="documentation actions", metavar="<action>"
    )
    actions.add_parser("check", help="run read-only documentation validation")
    index = actions.add_parser("index", help="update deterministic documentation indexes")
    index.add_argument("--dry-run", action="store_true")


def _add_tauri(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "tauri",
        help="open the Tauri command map",
        description="Tauri diagnostics, setup, development, builds, tests, and artifacts.",
        formatter_class=HelpFormatter,
    )
    parser.set_defaults(tauri_parser=parser)
    commands = parser.add_subparsers(
        dest="tauri_command", title="Tauri command map", metavar="<command>"
    )
    doctor = commands.add_parser("doctor", help="inspect desktop prerequisites")
    doctor.add_argument("--json", action="store_true")
    install = commands.add_parser("install", help="prepare desktop dependencies")
    install.add_argument("--dry-run", action="store_true")
    install.add_argument("--skip-system-deps", action="store_true")
    install.add_argument("--skip-rust", action="store_true")
    install.add_argument("--skip-node", action="store_true")
    install.add_argument("--skip-frontend", action="store_true")
    appimage = commands.add_parser("install-appimage", help="install the latest local AppImage")
    appimage.add_argument("--dry-run", action="store_true")
    run = commands.add_parser("run", help="start Tauri development mode")
    mode = run.add_mutually_exclusive_group()
    mode.add_argument("--foreground", action="store_true")
    mode.add_argument("--no-follow", action="store_true")
    run.add_argument("--dry-run", action="store_true")
    commands.add_parser("stop", help="stop the tracked Tauri process")
    build = commands.add_parser("build", help="build Tauri desktop artifacts")
    build.add_argument("--target", choices=DESKTOP_TARGETS, default="linux")
    build.add_argument("--bundles")
    build.add_argument("--rust-target", help="explicit Rust compilation target triple")
    build.add_argument("--dry-run", action="store_true")
    build.add_argument("--no-clean", action="store_true")
    test = commands.add_parser("test", help="validate Tauri structure and Rust code")
    test.add_argument("--cargo", action="store_true")
    test.add_argument("--all", action="store_true")
    copy = commands.add_parser("copy", help="collect native build artifacts")
    copy.add_argument("--dry-run", action="store_true")
    copy.add_argument("--target-dir")
    copy.add_argument(
        "--allow-outside-repo",
        action="store_true",
        help="explicitly permit a destination outside this checkout",
    )
    verify = commands.add_parser("verify-artifacts", help="verify requested native artifacts")
    verify.add_argument("--target", choices=DESKTOP_TARGETS)
    verify.add_argument("--bundles")
    verify.add_argument("--directory", help="artifact directory to verify")
    verify.add_argument("--matrix-id", help="declared release-matrix identifier")


def _add_version_release_tooling(subparsers: argparse._SubParsersAction) -> None:
    version = subparsers.add_parser("version", help="check or synchronize application versions")
    version.set_defaults(version_parser=version)
    version_actions = version.add_subparsers(dest="version_command", metavar="<action>")
    version_check = version_actions.add_parser("check", help="compare all owned version sources")
    version_check.add_argument("--json", action="store_true")
    version_actions.add_parser("sync", help="synchronize all owned version sources")

    release = subparsers.add_parser("release", help="run non-publishing release validation")
    release.set_defaults(release_parser=release)
    release_actions = release.add_subparsers(dest="release_command", metavar="<action>")
    release_check = release_actions.add_parser(
        "check", help="run the read-only production release gate"
    )
    release_check.add_argument("--json", action="store_true")
    collect = release_actions.add_parser("collect", help="collect one native matrix target")
    collect.add_argument("--matrix-id", required=True)
    collect.add_argument("--built-after")
    collect.add_argument("--output-dir", required=True)
    assemble = release_actions.add_parser("assemble", help="assemble verified release assets")
    assemble.add_argument("--input-dir", required=True)
    assemble.add_argument("--output-dir", required=True)
    assemble.add_argument("--tag", required=True)
    verify_release = release_actions.add_parser(
        "verify", help="verify an assembled release directory"
    )
    verify_release.add_argument("--directory", required=True)
    notes = release_actions.add_parser(
        "notes", help="extract release notes for the current version"
    )
    notes.add_argument("--output", required=True)

    tooling = subparsers.add_parser("tooling", help="verify the FMD tooling contract")
    tooling.set_defaults(tooling_parser=tooling)
    tooling_actions = tooling.add_subparsers(dest="tooling_command", metavar="<action>")
    verify = tooling_actions.add_parser(
        "verify", help="verify paths, wrappers, and command contracts"
    )
    verify.add_argument("--json", action="store_true")
