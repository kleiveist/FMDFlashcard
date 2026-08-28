"""Shared, fail-closed helpers for case-study build scripts."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any

import tomllib

CASE_STUDY_ROOT = Path(__file__).resolve().parents[1]


def _project_root_for_case_study(case_study_root: Path) -> Path:
    """Locate the copied project instead of assuming a fixed docs directory."""

    for candidate in case_study_root.parents:
        if (candidate / "tools" / "control.py").is_file():
            return candidate
    # The standard portable layout has ``docs/toolingdocs/case-study``.  Keep a
    # deterministic fallback so a malformed copy fails in the usual checks.
    return case_study_root.parents[2]


REPOSITORY_ROOT = _project_root_for_case_study(CASE_STUDY_ROOT)
CONFIG_PATH = CASE_STUDY_ROOT / "build-config.toml"
LANGUAGES = ("de", "en")


class CaseStudyError(RuntimeError):
    """Raised when a build or verification precondition is not met."""


def load_config(path: Path = CONFIG_PATH) -> dict[str, Any]:
    try:
        with path.open("rb") as stream:
            config = tomllib.load(stream)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise CaseStudyError(
            f"Could not read build configuration {path}: {exc}"
        ) from exc
    if not isinstance(config, dict):
        raise CaseStudyError("Case-study build configuration must be a TOML table.")
    return config


def require_audited_config(config: dict[str, Any]) -> None:
    template = config.get("template")
    toolchain = config.get("toolchain")
    build = config.get("build")
    languages = config.get("languages")
    if not all(
        isinstance(item, dict) for item in (template, toolchain, build, languages)
    ):
        raise CaseStudyError(
            "Build configuration is missing a required top-level table."
        )
    required_template = {
        "source",
        "commit_sha",
        "reference_tree",
        "audit_status",
        "license_status",
    }
    required_toolchain = {
        "engine",
        "bibliography_backend",
        "tex_distribution",
        "environment_pinning",
        "shell_escape",
        "tinytex_release",
        "tinytex_archive",
        "tinytex_sha256",
        "tinytex_repository",
        "tinytex_packages",
    }
    required_build = {
        "source_date_epoch",
        "max_latex_passes",
        "timeout_seconds",
        "byte_identical_pdfs",
        "default_output",
        "pdf_prefix",
        "tooling_version",
    }
    if not required_template <= set(template):
        raise CaseStudyError("Template compatibility data is incomplete.")
    if not required_toolchain <= set(toolchain):
        raise CaseStudyError("Toolchain compatibility data is incomplete.")
    if not required_build <= set(build):
        raise CaseStudyError("Build reproducibility data is incomplete.")
    if template["audit_status"] != "audited-no-upstream-files-imported":
        raise CaseStudyError(
            "Template audit status does not permit a case-study build."
        )
    if template["license_status"] != "no-license-declared-no-upstream-files-imported":
        raise CaseStudyError("Template transfer decision is not documented safely.")
    commit = template["commit_sha"]
    if (
        not isinstance(commit, str)
        or len(commit) != 40
        or any(char not in "0123456789abcdef" for char in commit)
    ):
        raise CaseStudyError("Template commit SHA must be a complete lowercase SHA-1.")
    if (
        toolchain["engine"] != "pdflatex"
        or toolchain["bibliography_backend"] != "biber"
    ):
        raise CaseStudyError(
            "The audited local adaptation requires pdflatex and biber."
        )
    if toolchain["shell_escape"] is not False:
        raise CaseStudyError("Shell escape must remain disabled.")
    if (
        not isinstance(toolchain["tinytex_sha256"], str)
        or len(toolchain["tinytex_sha256"]) != 64
        or any(
            character not in "0123456789abcdef"
            for character in toolchain["tinytex_sha256"]
        )
    ):
        raise CaseStudyError("TinyTeX archive SHA-256 must be complete and lowercase.")
    for language in LANGUAGES:
        language_config = languages.get(language)
        if (
            not isinstance(language_config, dict)
            or not isinstance(language_config.get("main"), str)
            or not isinstance(language_config.get("pdf_language"), str)
            or not isinstance(language_config.get("pdf_title"), str)
        ):
            raise CaseStudyError(f"Missing main source configuration for {language}.")


def default_output_directory(config: dict[str, Any]) -> Path:
    build = config["build"]
    candidate = (REPOSITORY_ROOT / str(build["default_output"])).resolve()
    state_root = (REPOSITORY_ROOT / ".tooling-state").resolve()
    try:
        candidate.relative_to(state_root)
    except ValueError as exc:
        raise CaseStudyError(
            "Default case-study output must remain below .tooling-state."
        ) from exc
    return candidate


def selected_output_directory(config: dict[str, Any], explicit: Path | None) -> Path:
    if explicit is None:
        return default_output_directory(config)
    output = explicit.expanduser().resolve()
    source_root = CASE_STUDY_ROOT.resolve()
    if output == source_root or output.is_relative_to(source_root):
        raise CaseStudyError("Build output must be outside the case-study source tree.")
    repository_root = REPOSITORY_ROOT.resolve()
    try:
        output.relative_to(repository_root)
    except ValueError:
        # CI supplies an external $RUNNER_TEMP path.  It is safe because it is
        # outside the checkout and is never part of the portable payload.
        return output
    if output != default_output_directory(config):
        raise CaseStudyError(
            "Repository-local build output is restricted to .tooling-state/docs/case-study."
        )
    return output


def executable(name: str, explicit: str | None = None) -> str:
    selected = explicit or name
    candidate = Path(selected).expanduser()
    if candidate.parent != Path("."):
        resolved = candidate.resolve()
        if not resolved.is_file():
            raise CaseStudyError(f"Required executable does not exist: {resolved}")
        return str(resolved)
    discovered = shutil.which(selected)
    if discovered is None:
        raise CaseStudyError(f"Required executable is unavailable: {selected}")
    return discovered


def deterministic_environment(work: Path, config: dict[str, Any]) -> dict[str, str]:
    home = work / "home"
    texmf_config = work / "texmf-config"
    texmf_home = work / "texmf-home"
    texmf_var = work / "texmf-var"
    for directory in (home, texmf_config, texmf_home, texmf_var):
        directory.mkdir(parents=True, exist_ok=True)
    environment = {"PATH": os.environ.get("PATH", os.defpath)}
    for key in ("COMSPEC", "PATHEXT", "SYSTEMROOT", "WINDIR"):
        if value := os.environ.get(key):
            environment[key] = value
    environment.update(
        {
            "SOURCE_DATE_EPOCH": str(config["build"]["source_date_epoch"]),
            "FORCE_SOURCE_DATE": "1",
            "TZ": "UTC",
            "LANG": "C",
            "LANGUAGE": "C",
            "LC_ALL": "C",
            "HOME": str(home),
            "USERPROFILE": str(home),
            "TMP": str(work),
            "TEMP": str(work),
            "TMPDIR": str(work),
            "TEXMFCONFIG": str(texmf_config),
            "TEXMFHOME": str(texmf_home),
            "TEXMFVAR": str(texmf_var),
        }
    )
    return environment


def source_main(config: dict[str, Any], language: str) -> Path:
    if language not in LANGUAGES:
        raise CaseStudyError(f"Unsupported language: {language}")
    main = CASE_STUDY_ROOT / str(config["languages"][language]["main"])
    if not main.is_file():
        raise CaseStudyError(f"Configured source file is missing: {main}")
    return main
