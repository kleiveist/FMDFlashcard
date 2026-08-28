from __future__ import annotations

import io

from tools import logger


def test_status_uses_ascii_fallback_for_strict_cp1252_stream() -> None:
    buffer = io.BytesIO()
    stream = io.TextIOWrapper(
        buffer,
        encoding="cp1252",
        errors="strict",
        newline="",
        write_through=True,
    )

    logger.info("Creating shared tooling virtualenv", stream=stream)
    logger.fail("Analyzer snowman: ☃", stream=stream)

    output = buffer.getvalue().decode("cp1252")
    assert output == ("[INFO] Creating shared tooling virtualenv\n[FAIL] Analyzer snowman: \\u2603\n")


def test_status_keeps_emoji_for_unicode_stream() -> None:
    stream = io.StringIO()

    logger.ok("ready", stream=stream)

    assert stream.getvalue() == "✅ ready\n"
