from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

from tools.config import ConfigLoadError, is_server_only_name, resolve_configuration, validate_configuration
from tools.profiles import runtime as profile_runtime


class E2EConfigurationError(ValueError):
    """Raised when Playwright cannot target the configured frontend endpoint."""


def _browser_host(host: str) -> str:
    if host in {"0.0.0.0", "::", "[::]"}:
        return "127.0.0.1"
    return f"[{host}]" if ":" in host and not host.startswith("[") else host


def playwright_environment(project_root: Path, environ: Mapping[str, str] | None = None) -> dict[str, str]:
    profile = profile_runtime.active_profile(project_root)
    try:
        resolved = resolve_configuration(profile, project_root=project_root, environ=environ)
    except ConfigLoadError as exc:
        raise E2EConfigurationError(f"configuration could not be loaded: {exc}") from exc

    relevant = {"FRONTEND_HOST", "FRONTEND_PORT"}
    issues = [issue for issue in validate_configuration(resolved) if issue.name in relevant]
    if issues:
        detail = "; ".join(f"{issue.name}: {issue.message}" for issue in issues)
        raise E2EConfigurationError(f"frontend endpoint is invalid: {detail}")

    host = _browser_host(resolved.value("FRONTEND_HOST") or "127.0.0.1")
    port = int(resolved.value("FRONTEND_PORT") or 0)
    source_environment = os.environ if environ is None else environ
    environment = {name: value for name, value in source_environment.items() if not is_server_only_name(name)}
    environment["PLAYWRIGHT_BASE_URL"] = f"http://{host}:{port}"
    return environment
