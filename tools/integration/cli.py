"""Command-line surface for portable tooling integration."""

from __future__ import annotations

import argparse
from collections.abc import Callable


def configure_parser(
    subparsers: argparse._SubParsersAction,
    *,
    formatter_class: Callable[..., argparse.HelpFormatter],
) -> None:
    integrate = subparsers.add_parser(
        "integrate",
        help="check or apply portable profile integration",
        description=(
            "Compare the detected project with its desired profile, or apply the complete "
            "transactional integration plan."
        ),
        formatter_class=formatter_class,
    )
    mode = integrate.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--check",
        action="store_true",
        help="inspect and print the integration plan without changing any file",
    )
    mode.add_argument(
        "--full-fix",
        action="store_true",
        help="apply the complete plan with backup, verification, and rollback",
    )
    integrate.add_argument(
        "--json",
        action="store_true",
        help="emit the result as stable machine-readable JSON",
    )
    integrate.set_defaults(integration_parser=integrate)
    integrate.epilog = """examples:
  python tools/control.py integrate --check
  python tools/control.py integrate --check --json
  python tools/control.py integrate --full-fix"""

    tooling = subparsers.add_parser(
        "tooling",
        help="migrate, verify, or export the portable tooling",
        description="Maintenance commands for an already copied tooling directory.",
        formatter_class=formatter_class,
    )
    tooling.set_defaults(tooling_parser=tooling)
    actions = tooling.add_subparsers(
        dest="tooling_command", title="tooling actions", metavar="<action>"
    )

    migrate = actions.add_parser(
        "migrate",
        help="apply pending tooling-state migrations",
        formatter_class=formatter_class,
    )
    migrate.add_argument(
        "--check",
        action="store_true",
        help="show pending migrations without applying them",
    )
    migrate.add_argument(
        "--json", action="store_true", help="emit machine-readable JSON"
    )

    verify = actions.add_parser(
        "verify",
        help="verify the current integration and state",
        formatter_class=formatter_class,
    )
    verify.add_argument(
        "--json", action="store_true", help="emit machine-readable JSON"
    )

    adapter_action = actions.add_parser(
        "action",
        help="run one profile-selected adapter capability",
        formatter_class=formatter_class,
    )
    adapter_action.add_argument("adapter", help="selected adapter name")
    adapter_action.add_argument(
        "capability",
        choices=("install", "run", "stop", "test", "build"),
        help="fixed capability implemented by that adapter",
    )
    adapter_action.add_argument(
        "--json", action="store_true", help="emit machine-readable JSON"
    )

    export = actions.add_parser(
        "export",
        help="create a portable tools/docs export",
        formatter_class=formatter_class,
    )
    export.add_argument(
        "--output", metavar="PATH", help="parent directory for the exported package"
    )


def main(args: argparse.Namespace) -> int:
    if args.command == "integrate":
        from tools.integration import service

        if args.check:
            return service.run_check(json_output=bool(args.json))
        return service.run_full_fix(json_output=bool(args.json))

    if args.command != "tooling":
        return 2
    action = getattr(args, "tooling_command", None)
    if action is None:
        args.tooling_parser.print_help()
        return 0
    from tools.integration import service

    if action == "migrate":
        return service.run_migrate(
            check_only=bool(args.check), json_output=bool(args.json)
        )
    if action == "verify":
        return service.run_verify(json_output=bool(args.json))
    if action == "action":
        return service.run_adapter_action(
            adapter_name=args.adapter,
            capability=args.capability,
            json_output=bool(args.json),
        )
    if action == "export":
        return service.run_export(output=getattr(args, "output", None))
    return 2


def standalone_main(argv: list[str] | None = None) -> int:
    """Parse only integration commands for the safe early control dispatch."""

    parser = argparse.ArgumentParser(
        prog="python tools/control.py",
        description="Portable tooling integration and maintenance commands.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")
    configure_parser(
        subparsers,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 0
    return main(args)


__all__ = ["configure_parser", "main", "standalone_main"]
