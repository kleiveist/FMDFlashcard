"""Render every PDF page and perform portable structural checks."""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any

try:  # Supports both ``python scripts/render_check.py`` and package imports in tests.
    from ._shared import CaseStudyError
except ImportError:  # pragma: no cover - command-line entry point.
    from _shared import CaseStudyError


def _pdf_modules() -> tuple[Any, Any]:
    """Load the isolated PDF backends only when a PDF operation is requested."""

    try:
        import pypdfium2
        from pypdf import PdfReader
    except ImportError as exc:
        raise CaseStudyError(
            "The isolated PDF backend is unavailable. Run "
            "docs/toolingdocs/case-study/scripts/environment.py setup first."
        ) from exc
    return PdfReader, pypdfium2


def pdf_backend_available() -> bool:
    """Return whether the project-local PDF inspection dependencies are importable."""

    try:
        _pdf_modules()
    except CaseStudyError:
        return False
    return True


def _reader(pdf: Path) -> Any:
    PdfReader, _pdfium = _pdf_modules()
    try:
        return PdfReader(pdf)
    except Exception as exc:  # pypdf exposes parser-specific exception types.
        raise CaseStudyError(f"The PDF backend rejected {pdf}: {exc}") from exc


def _resolved(value: Any) -> Any:
    getter = getattr(value, "get_object", None)
    return getter() if callable(getter) else value


def pdf_info(pdf: Path, *, pdfinfo: str | None = None) -> dict[str, str]:
    """Return normalized PDF metadata without requiring Poppler."""

    del pdfinfo  # Retained as a source-compatible keyword for existing callers.
    metadata = _reader(pdf).metadata or {}
    return {
        str(key).removeprefix("/"): str(value)
        for key, value in metadata.items()
        if value is not None
    }


def pdf_page_count(pdf: Path, *, pdfinfo: str | None = None) -> int:
    del pdfinfo
    pages = len(_reader(pdf).pages)
    if pages <= 0:
        raise CaseStudyError(f"PDF has no pages: {pdf}")
    return pages


def pdf_text(pdf: Path, *, pdftotext: str | None = None) -> str:
    del pdftotext
    try:
        text = "\n".join((page.extract_text() or "") for page in _reader(pdf).pages)
    except Exception as exc:
        raise CaseStudyError(f"Could not extract text from {pdf}: {exc}") from exc
    if not text.strip():
        raise CaseStudyError(f"PDF has no extractable text: {pdf}")
    return text


def pdf_page_texts(
    pdf: Path, pages: int, *, pdftotext: str | None = None
) -> tuple[str, ...]:
    del pdftotext
    reader = _reader(pdf)
    if len(reader.pages) != pages:
        raise CaseStudyError(f"PDF page count changed while inspecting {pdf}.")
    extracted: list[str] = []
    for number, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:
            raise CaseStudyError(
                f"Could not extract page {number} of {pdf}: {exc}"
            ) from exc
        if len(re.sub(r"\s+", "", text)) < 3:
            raise CaseStudyError(f"PDF has an unexpected blank page {number}: {pdf}")
        extracted.append(text)
    return tuple(extracted)


def _font_descriptors(font: Any) -> tuple[Any, ...]:
    resolved = _resolved(font)
    if not hasattr(resolved, "get"):
        return ()
    descendants = resolved.get("/DescendantFonts")
    if descendants:
        return tuple(
            descriptor
            for descendant in descendants
            if (descriptor := _resolved(descendant).get("/FontDescriptor")) is not None
        )
    descriptor = resolved.get("/FontDescriptor")
    return (descriptor,) if descriptor is not None else ()


def _font_is_embedded(font: Any) -> bool:
    resolved = _resolved(font)
    if not hasattr(resolved, "get"):
        return False
    if resolved.get("/Subtype") == "/Type3":
        return bool(resolved.get("/CharProcs"))
    descriptors = _font_descriptors(resolved)
    return bool(descriptors) and all(
        any(
            key in _resolved(descriptor)
            for key in ("/FontFile", "/FontFile2", "/FontFile3")
        )
        for descriptor in descriptors
    )


def pdf_fonts(pdf: Path, *, pdffonts: str | None = None) -> tuple[str, ...]:
    """Require every font resource used by every page to be embedded."""

    del pdffonts
    fonts: dict[str, str] = {}
    for page_number, page in enumerate(_reader(pdf).pages, start=1):
        resources = _resolved(page.get("/Resources", {}))
        page_fonts = _resolved(resources.get("/Font", {}))
        for resource_name, raw_font in page_fonts.items():
            font = _resolved(raw_font)
            base_name = str(font.get("/BaseFont", resource_name))
            subtype = str(font.get("/Subtype", "unknown"))
            description = f"{base_name} ({subtype}, embedded)"
            if not _font_is_embedded(font):
                raise CaseStudyError(
                    f"PDF has a non-embedded font on page {page_number}: "
                    f"{base_name} ({subtype})"
                )
            fonts[base_name] = description
    if not fonts:
        raise CaseStudyError(f"PDF inspection found no embedded fonts in {pdf}")
    return tuple(fonts[name] for name in sorted(fonts))


def pdf_destinations(pdf: Path, *, pdfinfo: str | None = None) -> tuple[str, ...]:
    del pdfinfo
    try:
        destinations = tuple(
            sorted(str(name) for name in _reader(pdf).named_destinations)
        )
    except Exception as exc:
        raise CaseStudyError(
            f"Could not inspect named destinations for {pdf}: {exc}"
        ) from exc
    if not destinations:
        raise CaseStudyError(
            f"PDF has no named destinations for its contents links: {pdf}"
        )
    return destinations


def pdf_language(pdf: Path) -> str:
    try:
        root = _resolved(_reader(pdf).trailer["/Root"])
        language = root.get("/Lang")
    except Exception as exc:
        raise CaseStudyError(
            f"Could not inspect PDF language for {pdf}: {exc}"
        ) from exc
    if not language:
        raise CaseStudyError(f"PDF does not declare a document language: {pdf}")
    return str(language)


def render_pdf(
    pdf: Path, output: Path, *, pdftoppm: str | None = None
) -> tuple[Path, ...]:
    """Render every page through the venv-owned PDFium binary wheel."""

    del pdftoppm
    _PdfReader, pdfium = _pdf_modules()
    output.mkdir(parents=True, exist_ok=True)
    rendered: list[Path] = []
    try:
        document = pdfium.PdfDocument(pdf)
        for index in range(len(document)):
            page = document[index]
            bitmap = page.render(scale=2)
            target = output / f"page-{index + 1:03d}.png"
            image = bitmap.to_pil()
            image.save(target, format="PNG")
            image.close()
            bitmap.close()
            page.close()
            if not target.is_file() or target.stat().st_size < 128:
                raise CaseStudyError(
                    f"PDF rendering did not produce page {index + 1} for {pdf}"
                )
            rendered.append(target)
        document.close()
    except CaseStudyError:
        raise
    except Exception as exc:
        raise CaseStudyError(f"PDFium could not render {pdf}: {exc}") from exc
    if not rendered:
        raise CaseStudyError(f"PDF rendering produced no pages for {pdf}")
    return tuple(rendered)


def validate_pdf(pdf: Path) -> tuple[int, str, tuple[Path, ...]]:
    if not pdf.is_file() or pdf.stat().st_size < 1024:
        raise CaseStudyError(f"PDF is missing or implausibly small: {pdf}")
    payload = pdf.read_bytes()
    if not payload.startswith(b"%PDF-") or b"%%EOF" not in payload[-2048:]:
        raise CaseStudyError(f"PDF structure is invalid or truncated: {pdf}")
    info = pdf_info(pdf)
    pages = pdf_page_count(pdf)
    text = pdf_text(pdf)
    pdf_page_texts(pdf, pages)
    pdf_fonts(pdf)
    pdf_destinations(pdf)
    if not info.get("Title"):
        raise CaseStudyError(f"PDF has no title metadata: {pdf}")
    if not info.get("Subject"):
        raise CaseStudyError(f"PDF has no subject metadata: {pdf}")
    with tempfile.TemporaryDirectory(prefix="case-study-render-") as temporary:
        rendered = render_pdf(pdf, Path(temporary))
        retained = tuple(Path(page.name) for page in rendered)
    return pages, text, retained


def validate_case_study_pdf(
    pdf: Path, *, title: str, language: str, tooling_version: str
) -> tuple[int, str, tuple[Path, ...]]:
    """Apply the source-specific PDF contract after generic rendering checks."""

    pages, text, rendered = validate_pdf(pdf)
    info = pdf_info(pdf)
    if info.get("Title") != title:
        raise CaseStudyError(
            f"PDF title metadata is wrong for {pdf}: {info.get('Title')!r} != {title!r}"
        )
    if tooling_version not in info.get("Subject", ""):
        raise CaseStudyError(
            f"PDF subject does not contain tooling version {tooling_version}: {pdf}"
        )
    actual_language = pdf_language(pdf)
    if actual_language != language:
        raise CaseStudyError(
            f"PDF language metadata is wrong for {pdf}: {actual_language!r} != {language!r}"
        )
    if title not in text:
        raise CaseStudyError(f"PDF text does not contain its expected title: {pdf}")
    contents_heading = "Inhaltsverzeichnis" if language == "de-DE" else "Contents"
    if contents_heading not in text:
        raise CaseStudyError(f"PDF text does not contain its contents heading: {pdf}")
    return pages, text, rendered


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Render and inspect every case-study PDF page."
    )
    parser.add_argument("pdf", type=Path, nargs="+", help="PDF file(s) to validate")
    parser.add_argument(
        "--render-dir",
        type=Path,
        help="optionally retain diagnostic page renders below this directory",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        for pdf in args.pdf:
            resolved = pdf.resolve()
            pages, text, rendered = validate_pdf(resolved)
            if args.render_dir is not None:
                render_pdf(resolved, args.render_dir.resolve() / pdf.stem)
            print(
                f"validated {pdf}: {pages} pages, {len(text)} text characters, "
                f"{len(rendered)} renders"
            )
    except CaseStudyError as exc:
        print(f"PDF validation failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
