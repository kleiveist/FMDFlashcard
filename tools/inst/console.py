from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path

from tools.core.context import ProjectContext, load_context

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve the control entrypoint for the current target project."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

logger = importlib.import_module("tools.logger")

SUITES = {"schema", "api", "database", "postgres", "frontend", "e2e", "tools", "all"}
DESKTOP_TARGETS = {
    "linux",
    "windows",
    "windows-portable",
    "windows-cross-linux",
    "macos",
}


class ConsoleExit(Exception):
    """Request a clean exit from any console menu depth."""


def _run_control(args: list[str]) -> int:
    command = [sys.executable, str(_context().tools_root / "control.py"), *args]
    logger.info(f"Executing: {' '.join(command)}")
    try:
        completed = subprocess.run(command, cwd=ROOT, check=False)
        status = "OK" if completed.returncode == 0 else "FAIL"
        logger.status(status, f"Command finished with exit code {completed.returncode}")
        return completed.returncode
    except KeyboardInterrupt:
        logger.status("WARN", "Execution interrupted by user")
        return 130


def _read(prompt: str) -> str:
    try:
        return input(prompt).strip().lower()
    except EOFError:
        print()
        return "q"


def _confirm(prompt: str) -> bool:
    while True:
        answer = _read(f"{prompt} [y/N]: ")
        if answer == "q":
            raise ConsoleExit
        if answer in {"", "n", "no"}:
            logger.info("Action cancelled")
            return False
        if answer in {"y", "yes"}:
            return True
        logger.status("WARN", "Enter 'y' to continue or 'n' to cancel")


def _print_menu(title: str, description: str, entries: list[tuple[str, str]]) -> None:
    print()
    print(f"=== {title} ===")
    print(description)
    print()
    for key, label in entries:
        print(f"{key:>2}) {label}")


def _prompt_suite() -> str | None:
    value = _read("Suite (schema/api/database/postgres/frontend/e2e/tools/all): ")
    if value not in SUITES:
        logger.status(
            "WARN", "Unknown suite. Use the test map to review available suites."
        )
        return None
    return value


def _prompt_desktop_target() -> str | None:
    value = (
        _read(
            "Target (linux/windows/windows-portable/windows-cross-linux/macos) [linux]: "
        )
        or "linux"
    )
    if value not in DESKTOP_TARGETS:
        logger.status(
            "WARN",
            "Unknown desktop target. Open the build map for supported strategies.",
        )
        return None
    return value


def _environment_menu() -> None:
    while True:
        _print_menu(
            "Environment and setup",
            "Inspect the machine first; installation actions can then repair only the required layer.",
            [
                ("1", "Run project doctor (read-only)"),
                ("2", "Install all configured dependencies"),
                ("3", "Install frontend dependencies only"),
                ("4", "Install backend dependencies only"),
                ("5", "Show install command help"),
                ("b", "Back to main menu"),
            ],
        )
        choice = _read("Select action: ")
        if choice == "1":
            _run_control(["doctor"])
        elif choice == "2":
            if _confirm("Install or repair all configured dependencies?"):
                _run_control(["install"])
        elif choice == "3":
            if _confirm("Install or repair frontend dependencies?"):
                _run_control(["install", "--skip-backend", "--skip-playwright"])
        elif choice == "4":
            if _confirm("Install or repair backend dependencies?"):
                _run_control(["install", "--skip-frontend", "--skip-playwright"])
        elif choice == "5":
            _run_control(["install", "--help"])
        elif choice == "b":
            return
        elif choice == "q":
            raise ConsoleExit
        else:
            logger.status("WARN", "Unknown option")


def _services_menu() -> None:
    while True:
        _print_menu(
            "Development services",
            "Start Vite and FastAPI together. Detached runs write state and logs below .tooling-state/runtime.",
            [
                ("1", "Start services in the foreground (Ctrl+C stops both)"),
                ("2", "Start services in the background"),
                ("3", "Stop tracked services"),
                ("4", "Show service command help"),
                ("b", "Back to main menu"),
            ],
        )
        choice = _read("Select action: ")
        if choice == "1":
            _run_control(["run"])
        elif choice == "2":
            _run_control(["run", "--detach"])
        elif choice == "3":
            _run_control(["stop"])
        elif choice == "4":
            _run_control(["run", "--help"])
        elif choice == "b":
            return
        elif choice == "q":
            raise ConsoleExit
        else:
            logger.status("WARN", "Unknown option")


def _tests_menu() -> None:
    while True:
        _print_menu(
            "Tests and reports",
            "Choose a focused suite for fast feedback or all configured suites before hand-off.",
            [
                ("1", "Quick check: API, frontend and tooling suites"),
                ("2", "Run all configured suites"),
                ("3", "Run one selected suite"),
                ("4", "Run all suites and create a Markdown report"),
                ("5", "Remove generated test reports"),
                ("6", "Show test suite map"),
                ("b", "Back to main menu"),
            ],
        )
        choice = _read("Select action: ")
        if choice == "1":
            for suite in ("api", "frontend", "tools"):
                _run_control(["test", "--suite", suite])
        elif choice == "2":
            _run_control(["test", "--suite", "all"])
        elif choice == "3":
            suite = _prompt_suite()
            if suite:
                _run_control(["test", "--suite", suite])
        elif choice == "4":
            _run_control(["test", "--suite", "all", "--report"])
        elif choice == "5":
            if _confirm("Remove generated reports from .tooling-state?"):
                _run_control(["test", "--report", "done"])
        elif choice == "6":
            _run_control(["test"])
        elif choice == "b":
            return
        elif choice == "q":
            raise ConsoleExit
        else:
            logger.status("WARN", "Unknown option")


def _builds_menu() -> None:
    while True:
        _print_menu(
            "Builds",
            "Web builds create a ZIP. Desktop dry-runs explain the native command before it is executed.",
            [
                ("1", "Build and package the web application"),
                ("2", "Preview the default desktop build (safe dry-run)"),
                ("3", "Build a selected desktop target"),
                ("4", "Show build target map"),
                ("b", "Back to main menu"),
            ],
        )
        choice = _read("Select action: ")
        if choice == "1":
            _run_control(["build", "web"])
        elif choice == "2":
            _run_control(["build", "desktop", "--dry-run", "--no-clean"])
        elif choice == "3":
            target = _prompt_desktop_target()
            if target and _confirm(
                f"Start the real desktop build for target '{target}'?"
            ):
                _run_control(["build", "desktop", "--target", target])
        elif choice == "4":
            _run_control(["build"])
        elif choice == "b":
            return
        elif choice == "q":
            raise ConsoleExit
        else:
            logger.status("WARN", "Unknown option")


def _tauri_menu() -> None:
    while True:
        _print_menu(
            "Tauri desktop",
            "Use diagnostics and dry-runs before installing system packages or creating native artifacts.",
            [
                ("1", "Run Tauri doctor"),
                ("2", "Validate the committed Tauri structure"),
                ("3", "Run all Tauri checks, including a build dry-run"),
                ("4", "Preview desktop prerequisite installation"),
                ("5", "Install desktop prerequisites"),
                ("6", "Start Tauri development mode in the foreground"),
                ("7", "Preview artifact collection"),
                ("8", "Preview local AppImage installation"),
                ("9", "Show complete Tauri command map"),
                ("b", "Back to main menu"),
            ],
        )
        choice = _read("Select action: ")
        if choice == "1":
            _run_control(["tauri", "doctor"])
        elif choice == "2":
            _run_control(["tauri", "test"])
        elif choice == "3":
            _run_control(["tauri", "test", "--all"])
        elif choice == "4":
            _run_control(["tauri", "install", "--dry-run"])
        elif choice == "5":
            if _confirm("Install or repair desktop prerequisites on this machine?"):
                _run_control(["tauri", "install"])
        elif choice == "6":
            _run_control(["tauri", "run", "--foreground"])
        elif choice == "7":
            _run_control(["tauri", "copy", "--dry-run"])
        elif choice == "8":
            _run_control(["tauri", "install-appimage", "--dry-run"])
        elif choice == "9":
            _run_control(["tauri"])
        elif choice == "b":
            return
        elif choice == "q":
            raise ConsoleExit
        else:
            logger.status("WARN", "Unknown option")


def _documentation_menu() -> None:
    while True:
        _print_menu(
            "Documentation",
            "The project command locates and runs the system PyGitIndex script, then keeps generated labels English.",
            [
                ("1", "Preview documentation index changes (read-only)"),
                ("2", "Update indices, README navigation and backlinks"),
                ("3", "Update with a compact README navigation"),
                ("4", "Show documentation command help"),
                ("b", "Back to main menu"),
            ],
        )
        choice = _read("Select action: ")
        if choice == "1":
            _run_control(["docs", "index", "--dry-run"])
        elif choice == "2":
            if _confirm("Regenerate documentation indices and backlinks?"):
                _run_control(["docs", "index"])
        elif choice == "3":
            if _confirm("Regenerate indices with compact README navigation?"):
                _run_control(["docs", "index", "--compact"])
        elif choice == "4":
            _run_control(["docs", "--help"])
        elif choice == "b":
            return
        elif choice == "q":
            raise ConsoleExit
        else:
            logger.status("WARN", "Unknown option")


def _print_main_menu() -> None:
    _print_menu(
        "Project Tooling Console",
        "Guided access to the complete project lifecycle. Every section explains its effects before running commands.",
        [
            ("1", "Environment and dependency setup"),
            ("2", "Development services"),
            ("3", "Tests and reports"),
            ("4", "Web and desktop builds"),
            ("5", "Tauri desktop workflows"),
            ("6", "Documentation indexing"),
            ("7", "Show the complete CLI help map"),
            ("q", "Exit"),
        ],
    )


def main() -> int:
    logger.info(
        "Interactive console ready. Choose a section; 'b' returns and 'q' exits."
    )

    try:
        while True:
            _print_main_menu()
            choice = _read("Select section: ")
            if choice == "1":
                _environment_menu()
            elif choice == "2":
                _services_menu()
            elif choice == "3":
                _tests_menu()
            elif choice == "4":
                _builds_menu()
            elif choice == "5":
                _tauri_menu()
            elif choice == "6":
                _documentation_menu()
            elif choice == "7":
                _run_control([])
            elif choice in {"q", "9"}:
                raise ConsoleExit
            else:
                logger.status("WARN", "Unknown option")
    except ConsoleExit:
        logger.ok("Console closed")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
