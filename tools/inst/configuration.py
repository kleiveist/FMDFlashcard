from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from tools import logger
from tools.config import (
    ConfigLoadError,
    mask_config_value,
    resolve_configuration,
    validate_configuration,
)
from tools.core.context import ProjectContext, load_context
from tools.profiles import runtime as profile_runtime

TOOLS_ROOT = Path(__file__).resolve().parents[1]
ROOT = TOOLS_ROOT.parent


def _context(context: ProjectContext | None = None) -> ProjectContext:
    """Resolve configuration against the current target project."""

    if context is not None:
        return context
    return load_context(project_root=ROOT, tools_root=TOOLS_ROOT)


@dataclass(frozen=True, slots=True)
class ConfigurationCheck:
    name: str
    status: str
    message: str


def _add_override_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--app-env", choices=["development", "test", "production"])
    parser.add_argument("--frontend-host")
    parser.add_argument("--frontend-port", type=int)
    parser.add_argument("--backend-host")
    parser.add_argument("--backend-port", type=int)
    parser.add_argument("--api-base-url", dest="vite_api_base_url")
    parser.add_argument("--cors-origins", dest="backend_cors_origins")


def configure_parser(parser: argparse.ArgumentParser) -> None:
    parser.set_defaults(config_parser=parser)
    subparsers = parser.add_subparsers(
        dest="config_command", title="configuration actions", metavar="<action>"
    )

    show = subparsers.add_parser(
        "show", help="display effective profile-aware configuration"
    )
    _add_override_arguments(show)

    doctor = subparsers.add_parser(
        "doctor", help="validate effective configuration without changing it"
    )
    _add_override_arguments(doctor)


def overrides_from_args(args: argparse.Namespace) -> dict[str, object | None]:
    return {
        "APP_ENV": getattr(args, "app_env", None),
        "FRONTEND_HOST": getattr(args, "frontend_host", None),
        "FRONTEND_PORT": getattr(args, "frontend_port", None),
        "BACKEND_HOST": getattr(args, "backend_host", None),
        "BACKEND_PORT": getattr(args, "backend_port", None),
        "VITE_API_BASE_URL": getattr(args, "vite_api_base_url", None),
        "BACKEND_CORS_ORIGINS": getattr(args, "backend_cors_origins", None),
    }


def collect_checks(args: argparse.Namespace | None = None) -> list[ConfigurationCheck]:
    project_root = _context().project_root
    profile = profile_runtime.active_profile(project_root)
    try:
        resolved = resolve_configuration(
            profile,
            project_root=project_root,
            cli_overrides=overrides_from_args(args) if args is not None else None,
        )
    except ConfigLoadError as exc:
        return [ConfigurationCheck("configuration", "FAIL", str(exc))]

    issues = validate_configuration(resolved)
    if issues:
        return [
            ConfigurationCheck(f"config:{issue.name}", "FAIL", issue.message)
            for issue in issues
        ]
    return [
        ConfigurationCheck("configuration", "OK", "effective configuration is valid")
    ]


def _show(args: argparse.Namespace) -> int:
    project_root = _context().project_root
    profile = profile_runtime.active_profile(project_root)
    try:
        resolved = resolve_configuration(
            profile,
            project_root=project_root,
            cli_overrides=overrides_from_args(args),
        )
    except ConfigLoadError as exc:
        logger.fail(str(exc))
        return 1

    current_section: str | None = None
    for variable in resolved.contract.variables:
        if not variable.is_enabled(profile.features):
            continue
        if variable.section != current_section:
            print(f"\n{variable.section}")
            current_section = variable.section
        value = mask_config_value(
            variable.name,
            resolved.value(variable.name),
            secret=variable.secret,
        )
        source = resolved.sources.get(variable.name, "not set")
        print(f"  {variable.name}: {value} [{source}]")
    print()
    issues = validate_configuration(resolved)
    for issue in issues:
        logger.fail(f"{issue.name}: {issue.message}")
    return 1 if issues else 0


def _doctor(args: argparse.Namespace) -> int:
    checks = collect_checks(args)
    failed = False
    for check in checks:
        logger.status(check.status, f"{check.name:<24} {check.message}")
        failed = failed or check.status == "FAIL"
    return 1 if failed else 0


def main(args: argparse.Namespace) -> int:
    command = getattr(args, "config_command", None)
    if command is None:
        args.config_parser.print_help()
        return 0
    if command == "show":
        return _show(args)
    if command == "doctor":
        return _doctor(args)
    logger.fail(f"Unknown configuration command: {command}")
    return 2
