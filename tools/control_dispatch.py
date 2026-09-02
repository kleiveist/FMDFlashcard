"""Lazy command dispatch for the dependency-free control entry point."""

from __future__ import annotations

import argparse
import importlib
from collections.abc import Callable, Mapping

from tools import logger

Handler = Callable[[argparse.Namespace], int]

HANDLER_SPECS: dict[str, str] = {
    "doctor": "tools.commands.environment:doctor",
    "install": "tools.commands.environment:install",
    "run": "tools.commands.lifecycle:run",
    "stop": "tools.commands.lifecycle:stop",
    "test": "tools.commands.testing:test",
    "quality": "tools.commands.quality:quality",
    "build": "tools.commands.build:handle",
    "docs": "tools.commands.docs:handle",
    "tauri": "tools.commands.tauri:handle",
    "release": "tools.commands.release:handle",
    "tooling": "tools.commands.tooling:handle",
    "console": "tools.commands.console:handle",
}

_BARE_GROUPS = {
    "build": ("build_command", "build_parser"),
    "docs": ("docs_command", "docs_parser"),
    "tauri": ("tauri_command", "tauri_parser"),
    "release": ("release_command", "release_parser"),
    "tooling": ("tooling_command", "tooling_parser"),
}


def _version(args: argparse.Namespace) -> int:
    from tools.commands import versioning

    if args.version_command is None:
        args.version_parser.print_help()
        return 0
    if args.version_command == "check":
        return versioning.check_versions(json_output=getattr(args, "json", False))
    if args.version_command == "sync":
        return versioning.sync_versions()
    return 2


def _load(specification: str) -> Handler:
    module_name, separator, attribute = specification.partition(":")
    if not separator or not module_name or not attribute:
        raise ValueError(f"invalid command handler specification: {specification}")
    module = importlib.import_module(module_name)
    handler = getattr(module, attribute)
    if not callable(handler):
        raise TypeError(f"command handler is not callable: {specification}")
    return handler


def dispatch(
    args: argparse.Namespace,
    *,
    handlers: Mapping[str, Handler | str] | None = None,
) -> int:
    """Dispatch a parsed namespace and preserve the handler's exit status."""

    command = getattr(args, "command", None)
    if command is None:
        args.root_parser.print_help()
        return 0
    if command == "version":
        return _version(args)
    bare_group = _BARE_GROUPS.get(command)
    if bare_group is not None:
        selection, parser_name = bare_group
        if getattr(args, selection, None) is None:
            getattr(args, parser_name).print_help()
            return 0

    registry: Mapping[str, Handler | str] = handlers or HANDLER_SPECS
    target = registry.get(command)
    if target is None:
        logger.error(f"No handler is registered for command: {command}")
        return 1
    try:
        handler = _load(target) if isinstance(target, str) else target
        result = handler(args)
    except (ImportError, AttributeError, TypeError, ValueError) as exc:
        logger.error(f"Command '{command}' is unavailable: {exc}")
        return 1
    if not isinstance(result, int):
        logger.error(f"Command '{command}' returned an invalid exit status")
        return 1
    return result
