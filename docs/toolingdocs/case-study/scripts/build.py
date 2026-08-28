"""Build audited German and English case-study PDFs outside the source tree."""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

try:  # Supports both ``python scripts/build.py`` and package imports in tests.
    from ._shared import (
        CASE_STUDY_ROOT,
        LANGUAGES,
        CaseStudyError,
        deterministic_environment,
        executable,
        load_config,
        require_audited_config,
        selected_output_directory,
        source_main,
    )
    from .render_check import render_pdf, validate_case_study_pdf
except ImportError:  # pragma: no cover - exercised by the command-line entry point.
    from _shared import (
        CASE_STUDY_ROOT,
        LANGUAGES,
        CaseStudyError,
        deterministic_environment,
        executable,
        load_config,
        require_audited_config,
        selected_output_directory,
        source_main,
    )
    from render_check import render_pdf, validate_case_study_pdf


@dataclass(frozen=True, slots=True)
class PdfEvidence:
    pages: int
    text: str
    rendered_hashes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class BuildResult:
    language: str
    payload: bytes
    evidence: PdfEvidence


def _run(
    command: Sequence[str], *, cwd: Path, environment: dict[str, str], timeout: int
) -> str:
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            env=environment,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=timeout,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise CaseStudyError(f"Could not run {' '.join(command)}: {exc}") from exc
    output = "\n".join(
        part.strip() for part in (completed.stdout, completed.stderr) if part.strip()
    )
    if completed.returncode != 0:
        raise CaseStudyError(
            f"Command failed with exit code {completed.returncode}: {' '.join(command)}\n{output[-6000:]}"
        )
    return output


def _warning_check(log: str, language: str) -> None:
    normalized = log.casefold()
    forbidden = (
        "undefined references",
        "undefined citation",
        "citation '",
        "please (re)run biber",
        "empty bibliography",
        "citation `",
        "there were undefined",
        "multiply-defined labels",
        "overfull \\hbox",
        "missing character:",
    )
    hit = next((pattern for pattern in forbidden if pattern in normalized), None)
    if hit is not None:
        raise CaseStudyError(f"LaTeX warning policy failed for {language}: {hit}")


def _copy_build_inputs(work: Path) -> Path:
    source = CASE_STUDY_ROOT / "source"
    assets = CASE_STUDY_ROOT / "assets"
    staged_source = work / "source"
    staged_assets = work / "assets"
    shutil.copytree(source, staged_source)
    shutil.copytree(assets, staged_assets)
    return staged_source


def _pdf_evidence(pdf: Path, language: str, config: dict) -> PdfEvidence:
    language_config = config["languages"][language]
    pages, text, _rendered = validate_case_study_pdf(
        pdf,
        title=str(language_config["pdf_title"]),
        language=str(language_config["pdf_language"]),
        tooling_version=str(config["build"]["tooling_version"]),
    )
    with tempfile.TemporaryDirectory(prefix="case-study-pages-") as temporary:
        rendered = render_pdf(pdf, Path(temporary))
        hashes = tuple(
            hashlib.sha256(path.read_bytes()).hexdigest() for path in rendered
        )
    return PdfEvidence(pages=pages, text=text, rendered_hashes=hashes)


def _compile_language(
    language: str,
    *,
    config: dict,
    engine: str,
    biber: str,
    output: Path,
    timeout: int,
) -> BuildResult:
    configured_main = source_main(config, language)
    if configured_main.name != "main.tex":
        raise CaseStudyError("The audited build requires a main.tex entry point.")
    work = Path(tempfile.mkdtemp(prefix=f"case-study-{language}-", dir=output))
    try:
        source = _copy_build_inputs(work)
        language_root = source / language
        main = language_root / "main.tex"
        build = work / "build"
        build.mkdir()
        environment = deterministic_environment(work, config)
        command = (
            engine,
            "-no-shell-escape",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-file-line-error",
            f"-output-directory={build}",
            main.name,
        )
        first_log = _run(
            command, cwd=language_root, environment=environment, timeout=timeout
        )
        biber_log = _run(
            (
                biber,
                "--input-directory",
                str(build),
                "--output-directory",
                str(build),
                "main",
            ),
            cwd=language_root,
            environment=environment,
            timeout=timeout,
        )
        latex_logs = [first_log]
        for _ in range(int(config["build"]["max_latex_passes"]) - 1):
            latex_logs.append(
                _run(
                    command, cwd=language_root, environment=environment, timeout=timeout
                )
            )
        # The first clean LaTeX pass necessarily reports unresolved references.
        # Enforce the warning policy against Biber and the converged final pass.
        _warning_check("\n".join((biber_log, latex_logs[-1])), language)
        pdf = build / "main.pdf"
        if not pdf.is_file():
            raise CaseStudyError(f"TeX did not produce a PDF for {language}.")
        payload = pdf.read_bytes()
        if (
            len(payload) < 1024
            or not payload.startswith(b"%PDF-")
            or b"%%EOF" not in payload[-2048:]
        ):
            raise CaseStudyError(f"TeX produced an invalid PDF for {language}.")
        evidence = _pdf_evidence(pdf, language, config)
        return BuildResult(language=language, payload=payload, evidence=evidence)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _publish(target: Path, payload: bytes) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def _compare(first: BuildResult, second: BuildResult, *, require_bytes: bool) -> None:
    if first.evidence.pages != second.evidence.pages:
        raise CaseStudyError(
            f"Reproducibility page count differs for {first.language}."
        )
    if first.evidence.text != second.evidence.text:
        raise CaseStudyError(f"Reproducibility text differs for {first.language}.")
    if first.evidence.rendered_hashes != second.evidence.rendered_hashes:
        raise CaseStudyError(f"Reproducibility rendering differs for {first.language}.")
    if require_bytes and first.payload != second.payload:
        raise CaseStudyError(f"Reproducibility PDF bytes differ for {first.language}.")


def build(
    languages: Sequence[str],
    *,
    output_directory: Path | None = None,
    compiler: str | None = None,
    biber_command: str | None = None,
    timeout: int | None = None,
    reproducible: bool = False,
) -> tuple[Path, ...]:
    """Build selected editions and publish only their final PDFs."""

    selected = tuple(languages)
    if not selected or any(language not in LANGUAGES for language in selected):
        raise CaseStudyError("Languages must be a non-empty subset of: de, en.")
    if len(set(selected)) != len(selected):
        raise CaseStudyError("Languages must not contain duplicates.")
    config = load_config()
    require_audited_config(config)
    output = selected_output_directory(config, output_directory)
    output.mkdir(parents=True, exist_ok=True)
    engine = executable("pdflatex", compiler)
    biber = executable("biber", biber_command)
    effective_timeout = timeout or int(config["build"]["timeout_seconds"])
    if effective_timeout <= 0:
        raise CaseStudyError("Build timeout must be greater than zero.")

    results = {
        language: _compile_language(
            language,
            config=config,
            engine=engine,
            biber=biber,
            output=output,
            timeout=effective_timeout,
        )
        for language in selected
    }
    if reproducible:
        repeats = {
            language: _compile_language(
                language,
                config=config,
                engine=engine,
                biber=biber,
                output=output,
                timeout=effective_timeout,
            )
            for language in selected
        }
        for language in selected:
            _compare(
                results[language],
                repeats[language],
                require_bytes=bool(config["build"]["byte_identical_pdfs"]),
            )

    targets = tuple(
        output / f"{config['build']['pdf_prefix']}-{language}.pdf"
        for language in selected
    )
    for language, target in zip(selected, targets, strict=True):
        _publish(target, results[language].payload)
    return targets


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build audited, reproducible case-study PDFs."
    )
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument(
        "--language", choices=(*LANGUAGES, "all"), help="edition to build"
    )
    selection.add_argument(
        "--all", action="store_true", help="build German and English editions"
    )
    parser.add_argument(
        "--output-dir", type=Path, help="temporary directory receiving final PDFs"
    )
    parser.add_argument("--compiler", help="pdflatex executable name or path")
    parser.add_argument(
        "--biber", dest="biber_command", help="biber executable name or path"
    )
    parser.add_argument(
        "--timeout", type=int, help="timeout per tool invocation in seconds"
    )
    parser.add_argument(
        "--reproducible",
        action="store_true",
        help="perform two clean builds and compare them",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="clean the default state output before building",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    config = load_config()
    try:
        require_audited_config(config)
        if args.clean:
            if args.output_dir is not None:
                raise CaseStudyError(
                    "--clean is allowed only with the default state output."
                )
            try:
                from .clean import clean_default_output
            except ImportError:  # pragma: no cover - command-line entry point.
                from clean import clean_default_output

            clean_default_output(config)
        selected = (
            LANGUAGES
            if args.all or args.language in (None, "all")
            else (args.language,)
        )
        targets = build(
            selected,
            output_directory=args.output_dir,
            compiler=args.compiler,
            biber_command=args.biber_command,
            timeout=args.timeout,
            reproducible=args.reproducible,
        )
    except CaseStudyError as exc:
        print(f"case-study build failed: {exc}", file=sys.stderr)
        return 1
    for target in targets:
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        print(f"built {target} sha256:{digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
