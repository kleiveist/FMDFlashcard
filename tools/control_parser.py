from __future__ import annotations

import argparse
import sys

from tools import logger
from tools.inst import configuration, db
from tools.integration import cli as integration_cli
from tools.quality import control as quality_control
from tools.tauri import control as tauri_control


class HelpFormatter(argparse.RawDescriptionHelpFormatter):
    def __init__(self, prog: str) -> None:
        super().__init__(prog, max_help_position=30, width=100)


class ControlParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # type: ignore[override]
        self.print_help(sys.stderr)
        print(file=sys.stderr)
        logger.fail(f"{self.prog}: {message}", stream=sys.stderr)
        logger.info(f"Next step: {self.prog} --help", stream=sys.stderr)
        self.exit(2)


ROOT_HELP = """
One entry point for portable project tooling.

Integrate a copied tools/ and docs/ directory:
  1. integrate --check      Detect the project and print a read-only plan.
  2. integrate --full-fix   Apply the complete plan transactionally.

Recommended workflow after returning to the project:
  1. doctor   Check tools, dependencies and occupied ports.
  2. install  Install or repair dependencies for enabled features.
  3. run      Start the enabled local development services.
  4. quality  Enforce code-quality and architecture governance.
  5. test     Select and run the relevant automated tests.
  6. build    Choose a web, desktop, or container artifact.

Prefer a menu? Start the optional interactive console:
  python tools/control.py console

Groups with their own command maps:
  python tools/control.py build
  python tools/control.py container
  python tools/control.py config
  python tools/control.py db
  python tools/control.py docs
  python tools/control.py quality
  python tools/control.py tauri
  python tools/control.py integrate --check
  python tools/control.py tooling
  python tools/control.py version
  python tools/control.py release
"""

ROOT_EXAMPLES = """
examples:
  python tools/control.py integrate --check
  python tools/control.py integrate --full-fix
  python tools/control.py tooling verify
  python tools/control.py doctor
  python tools/control.py install
  python tools/control.py run --detach
  python tools/control.py stop
  python tools/control.py quality
  python tools/control.py test --suite all --report
  python tools/control.py build web
  python tools/control.py build container
  python tools/control.py config doctor
  python tools/control.py db doctor
  python tools/control.py db current
  python tools/control.py docs index --dry-run
  python tools/control.py tauri

Compatibility:
  The former aliases --doctor, --install, --run, --stop, --test and --build remain available.
"""

TEST_SUITES = (
    "api",
    "schema",
    "database",
    "postgres",
    "frontend",
    "e2e",
    "tools",
    "tauri",
    "all",
)


def _add_examples(parser: argparse.ArgumentParser, examples: str) -> None:
    parser.epilog = examples.strip()


def build_parser() -> argparse.ArgumentParser:
    parser = ControlParser(
        prog="python tools/control.py",
        description=ROOT_HELP.strip(),
        epilog=ROOT_EXAMPLES.strip(),
        formatter_class=HelpFormatter,
    )
    subparsers = parser.add_subparsers(
        dest="command",
        title="command map",
        metavar="<command>",
    )

    integration_cli.configure_parser(subparsers, formatter_class=HelpFormatter)
    _add_environment_parsers(subparsers)
    _add_build_parser(subparsers)
    _add_platform_parsers(subparsers)
    _add_docs_parser(subparsers)
    _add_service_parsers(subparsers)
    _add_test_parser(subparsers)
    _add_quality_parser(subparsers)
    _add_tauri_parser(subparsers)
    return parser


def _add_environment_parsers(subparsers: argparse._SubParsersAction) -> None:
    _add_doctor_parser(subparsers)
    _add_install_parser(subparsers)
    _add_console_parser(subparsers)


def _add_doctor_parser(subparsers: argparse._SubParsersAction) -> None:
    doctor_parser = subparsers.add_parser(
        "doctor",
        help="inspect the development environment",
        description="Inspect runtimes, dependencies, project files and local ports without changing them.",
        formatter_class=HelpFormatter,
    )
    doctor_parser.add_argument(
        "--watch", action="store_true", help="repeat checks until interrupted"
    )
    doctor_parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="seconds between watch checks (default: 5)",
    )
    _add_examples(
        doctor_parser,
        """examples:
  python tools/control.py doctor
  python tools/control.py doctor --watch --interval 10""",
    )


def _add_install_parser(subparsers: argparse._SubParsersAction) -> None:
    install_parser = subparsers.add_parser(
        "install",
        help="install or repair project dependencies",
        description="Prepare the local frontend, backend and optional E2E environment.",
        formatter_class=HelpFormatter,
    )
    install_parser.add_argument(
        "--skip-frontend", action="store_true", help="do not run npm install"
    )
    install_parser.add_argument(
        "--skip-backend", action="store_true", help="do not prepare the Python venv"
    )
    install_parser.add_argument(
        "--skip-tooling",
        action="store_true",
        help="do not prepare the shared tooling test venv",
    )
    install_parser.add_argument(
        "--skip-playwright",
        action="store_true",
        help="do not install Playwright Chromium",
    )
    _add_examples(
        install_parser,
        """examples:
  python tools/control.py install
  python tools/control.py install --skip-playwright
  python tools/control.py install --skip-frontend""",
    )


def _add_console_parser(subparsers: argparse._SubParsersAction) -> None:
    console_parser = subparsers.add_parser(
        "console",
        help="open an interactive menu for common tasks",
        description="Open a numbered menu that guides you through common project actions.",
        formatter_class=HelpFormatter,
    )
    _add_examples(
        console_parser,
        """sections:
  environment  Doctor and dependency setup
  services     Foreground/background start and stop
  tests        Quick, complete, individual and reported test runs
  builds       Web packages and guided desktop targets
  Tauri        Diagnostics, setup, development and artifacts
  docs         PyGitIndex preview and update

example:
  python tools/control.py console""",
    )


def _add_build_parser(subparsers: argparse._SubParsersAction) -> None:
    build_parser = subparsers.add_parser(
        "build",
        help="choose a web, desktop, or container artifact",
        description="Build map. Choose one target; a bare 'build' only shows this guide.",
        formatter_class=HelpFormatter,
    )
    build_parser.set_defaults(build_parser=build_parser)
    build_subparsers = build_parser.add_subparsers(
        dest="build_command",
        title="build targets",
        metavar="<target>",
    )
    web_parser = build_subparsers.add_parser(
        "web",
        help="compile and package the Vite web app",
        description="Build frontend/dist and create .dist/web/web-build.zip.",
        formatter_class=HelpFormatter,
    )
    _add_examples(web_parser, "examples:\n  python tools/control.py build web")

    _add_desktop_build_parser(build_subparsers)
    _add_container_build_parser(build_subparsers)
    _add_examples(
        build_parser,
        """examples:
  python tools/control.py build web
  python tools/control.py build desktop --dry-run
  python tools/control.py build container

More desktop commands:
  python tools/control.py tauri""",
    )


def _add_desktop_build_parser(build_subparsers: argparse._SubParsersAction) -> None:
    desktop_parser = build_subparsers.add_parser(
        "desktop",
        help="build Tauri desktop artifacts",
        description="Build native desktop artifacts through the restored Tauri tooling.",
        formatter_class=HelpFormatter,
    )
    tauri_control.configure_build_parser(desktop_parser)
    _add_examples(
        desktop_parser,
        """examples:
  python tools/control.py build desktop --dry-run
  python tools/control.py build desktop --target linux --bundles deb,rpm
  python tools/control.py build desktop --target windows-portable""",
    )


def _add_container_build_parser(build_subparsers: argparse._SubParsersAction) -> None:
    container_build_parser = build_subparsers.add_parser(
        "container",
        help="build profile-aware backend and frontend images",
        description="Build provider-neutral production images for a cloud-enabled profile.",
        formatter_class=HelpFormatter,
    )
    container_build_parser.add_argument(
        "--component",
        choices=["all", "backend", "frontend"],
        default="all",
        help="image component to build (default: all)",
    )
    container_build_parser.add_argument(
        "--no-cache", action="store_true", help="disable Docker build cache"
    )


def _add_platform_parsers(subparsers: argparse._SubParsersAction) -> None:
    _add_database_parser(subparsers)
    _add_container_parser(subparsers)
    _add_version_parser(subparsers)
    _add_release_parser(subparsers)
    _add_config_parser(subparsers)


def _add_database_parser(subparsers: argparse._SubParsersAction) -> None:
    db_parser = subparsers.add_parser(
        "db",
        help="manage optional database diagnostics and migrations",
        description="Database command map. Commands require the active project to enable the database feature.",
        formatter_class=HelpFormatter,
    )
    db.configure_parser(db_parser)
    _add_examples(
        db_parser,
        """examples:
  python tools/control.py db doctor
  python tools/control.py db doctor --connect
  python tools/control.py db current
  python tools/control.py db upgrade
  python tools/control.py db downgrade
  python tools/control.py db revision --message 'add widgets'""",
    )


def _add_container_parser(subparsers: argparse._SubParsersAction) -> None:
    container_parser = subparsers.add_parser(
        "container",
        help="inspect and validate provider-neutral container deployment files",
        description="Container command map for Docker and Compose validation.",
        formatter_class=HelpFormatter,
    )
    container_parser.set_defaults(container_parser=container_parser)
    container_subparsers = container_parser.add_subparsers(
        dest="container_command", metavar="<action>"
    )
    container_subparsers.add_parser(
        "doctor", help="check Docker, Compose, and deployment files"
    )
    container_subparsers.add_parser(
        "validate", help="validate the Compose model without starting services"
    )
    _add_examples(
        container_parser,
        "examples:\n  python tools/control.py container doctor\n  python tools/control.py container validate",
    )


def _add_version_parser(subparsers: argparse._SubParsersAction) -> None:
    version_parser = subparsers.add_parser(
        "version",
        help="show or validate the application version",
        description="Read the VERSION source of truth and compare published metadata.",
        formatter_class=HelpFormatter,
    )
    version_subparsers = version_parser.add_subparsers(
        dest="version_command", metavar="<action>"
    )
    version_subparsers.add_parser("check", help="verify all enabled component versions")
    version_subparsers.add_parser(
        "sync", help="copy VERSION into enabled component metadata"
    )


def _add_release_parser(subparsers: argparse._SubParsersAction) -> None:
    release_parser = subparsers.add_parser(
        "release",
        help="run non-publishing release validation",
        description="Validate identity, version, security, and repository state without publishing.",
        formatter_class=HelpFormatter,
    )
    release_parser.set_defaults(release_parser=release_parser)
    release_subparsers = release_parser.add_subparsers(
        dest="release_command", metavar="<action>"
    )
    release_subparsers.add_parser("check", help="run the production release gate")


def _add_config_parser(subparsers: argparse._SubParsersAction) -> None:
    config_parser = subparsers.add_parser(
        "config",
        help="show and validate effective runtime configuration",
        description="Configuration command map. Values resolve from CLI, process environment, .env, and defaults.",
        formatter_class=HelpFormatter,
    )
    configuration.configure_parser(config_parser)
    _add_examples(
        config_parser,
        """examples:
  python tools/control.py config show
  python tools/control.py config doctor
  python tools/control.py config show --backend-port 9000""",
    )


def _add_docs_parser(subparsers: argparse._SubParsersAction) -> None:
    docs_parser = subparsers.add_parser(
        "docs",
        help="check documentation navigation and regenerate it with PyGitIndex",
        description="Documentation map. A bare 'docs' shows the available maintenance actions.",
        formatter_class=HelpFormatter,
    )
    docs_parser.set_defaults(docs_parser=docs_parser)
    docs_subparsers = docs_parser.add_subparsers(
        dest="docs_command",
        title="documentation actions",
        metavar="<action>",
    )
    docs_check_parser = docs_subparsers.add_parser(
        "check",
        help="validate documentation navigation in the selected scope",
        description=(
            "Read the configured docs/toolingdocs tree, or an explicit safe "
            "project-relative documentation tree, and validate its generated "
            "indices, internal backlinks and targets."
        ),
        formatter_class=HelpFormatter,
    )
    docs_check_parser.add_argument(
        "--docs-dir",
        default=None,
        metavar="PATH",
        help="safe project-relative override (default: configured docs/toolingdocs)",
    )
    docs_index_parser = docs_subparsers.add_parser(
        "index",
        help="regenerate indices and backlinks with the system PyGitIndex script",
        description="Run PyGitIndex and keep its generated navigation labels in English.",
        formatter_class=HelpFormatter,
    )
    _configure_docs_index_parser(docs_index_parser)
    _add_examples(
        docs_parser,
        """examples:
  python tools/control.py docs check
  python tools/control.py docs check --docs-dir docs
  python tools/control.py docs index --dry-run
  python tools/control.py docs index --docs-dir docs""",
    )


def _configure_docs_index_parser(docs_index_parser: argparse.ArgumentParser) -> None:
    docs_index_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="preview PyGitIndex without writing files",
    )
    docs_index_parser.add_argument(
        "--force",
        action="store_true",
        help="replace index files instead of updating markers",
    )
    docs_index_parser.add_argument(
        "--compact",
        action="store_true",
        help="accepted for compatibility; the project README is never modified",
    )
    docs_index_parser.add_argument(
        "--no-backlinks",
        action="store_true",
        help="do not add or update Markdown backlinks",
    )
    docs_index_parser.add_argument(
        "--no-readme",
        action="store_true",
        help="compatibility flag; project README updates are always disabled",
    )
    docs_index_parser.add_argument(
        "--script",
        metavar="PATH",
        help="explicit PyGitIndex.py path (otherwise use PYGITINDEX_PATH, PATH or known user locations)",
    )
    docs_index_parser.add_argument(
        "--docs-dir",
        default=None,
        metavar="PATH",
        help="safe project-relative override (default: configured docs/toolingdocs)",
    )
    _add_examples(
        docs_index_parser,
        """examples:
  python tools/control.py docs index --dry-run
  python tools/control.py docs index --docs-dir docs
  python tools/control.py docs index --script /path/to/PyGitIndex.py""",
    )


def _add_service_parsers(subparsers: argparse._SubParsersAction) -> None:
    run_parser = subparsers.add_parser(
        "run",
        help="start enabled development services",
        description="Start the services enabled by project-tooling.toml. Foreground is the default; Ctrl+C stops them.",
        formatter_class=HelpFormatter,
    )
    run_parser.add_argument("--frontend-host", help="override FRONTEND_HOST")
    run_parser.add_argument("--frontend-port", type=int, help="override FRONTEND_PORT")
    run_parser.add_argument("--backend-host", help="override BACKEND_HOST")
    run_parser.add_argument("--backend-port", type=int, help="override BACKEND_PORT")
    run_parser.add_argument(
        "--detach",
        action="store_true",
        help="run in background and write logs to .tooling-state/runtime",
    )
    _add_examples(
        run_parser,
        """examples:
  python tools/control.py run
  python tools/control.py run --detach
  python tools/control.py stop""",
    )

    stop_parser = subparsers.add_parser(
        "stop",
        help="stop tracked development services",
        description="Stop services recorded by detached runs and optionally clean stale project ports.",
        formatter_class=HelpFormatter,
    )
    stop_parser.add_argument(
        "--frontend-port",
        type=int,
        help="override FRONTEND_PORT for stale-listener cleanup",
    )
    stop_parser.add_argument(
        "--backend-port",
        type=int,
        help="override BACKEND_PORT for stale-listener cleanup",
    )
    stop_parser.add_argument(
        "--tracked-only", action="store_true", help="do not inspect stale listeners"
    )
    _add_examples(
        stop_parser,
        "examples:\n  python tools/control.py stop\n  python tools/control.py stop --tracked-only",
    )


def _add_test_parser(subparsers: argparse._SubParsersAction) -> None:
    test_parser = subparsers.add_parser(
        "test",
        help="select test suites and optional reports",
        description="Test map. A bare 'test' shows this guide and does not run every suite unexpectedly.",
        formatter_class=HelpFormatter,
    )
    test_parser.set_defaults(test_parser=test_parser)
    test_parser.add_argument(
        "--suite",
        choices=TEST_SUITES,
        default=None,
        help="suite to run; use all for the complete configured set",
    )
    test_parser.add_argument(
        "--no-start", action="store_true", help="do not start services for E2E tests"
    )
    test_parser.add_argument(
        "--report",
        nargs="?",
        const="md",
        choices=["md", "markdown", "json", "all", "done"],
        help="write a report, or use '--report done' to remove .report",
    )
    test_parser.add_argument(
        "--suite-help", action="store_true", help=argparse.SUPPRESS
    )
    _add_examples(
        test_parser,
        """suites:
  api       FastAPI tests
  schema    shared JSON Schema examples
  database  SQLAlchemy and session unit tests
  postgres  PostgreSQL integration tests (skipped without DATABASE_URL_TEST)
  frontend  Vitest tests
  e2e       Playwright browser and accessibility tests
  tools     restored Python tooling tests
  tauri     Tauri structure, cargo check, and Rust tests
  all       every configured suite

examples:
  python tools/control.py test --suite tools
  python tools/control.py test --suite all --report
  python tools/control.py test --report done""",
    )


def _add_quality_parser(subparsers: argparse._SubParsersAction) -> None:
    quality_parser = subparsers.add_parser(
        "quality",
        help="run code-quality and architecture governance checks",
        description="Run the repository quality gate. A bare 'quality' performs the complete check.",
        formatter_class=HelpFormatter,
    )
    quality_control.configure_parser(quality_parser)
    _add_examples(
        quality_parser,
        """examples:
  python tools/control.py quality
  python tools/control.py quality size
  python tools/control.py quality architecture
  python tools/control.py quality lint
  python tools/control.py quality --release
  python tools/control.py quality --format json""",
    )


def _add_tauri_parser(subparsers: argparse._SubParsersAction) -> None:
    tauri_parser = subparsers.add_parser(
        "tauri",
        help="open the Tauri desktop command map",
        description="Tauri-specific diagnostics, setup, development, builds and artifact handling.",
        formatter_class=HelpFormatter,
    )
    tauri_control.configure_parser(tauri_parser)
