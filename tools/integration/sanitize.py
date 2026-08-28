"""Redaction helpers shared by integration reports and transaction journals."""

from __future__ import annotations

import re
from pathlib import Path

_SENSITIVE_LINE = re.compile(
    r"(?i)(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|authorization|database_url)"
    r"[a-z0-9_.-]*\s*[:=]"
)
_PRIVATE_KEY_BEGIN = re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----")
_PRIVATE_KEY_END = re.compile(r"-----END [A-Z0-9 ]*PRIVATE KEY-----")
_URI_CREDENTIALS = re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)[^\s/@:]+:[^\s/@]+@")
_WINDOWS_ABSOLUTE = re.compile(r"(?i)(?<![A-Za-z0-9_.-])[A-Z]:[\\/][^\s;,]+")
# At the first slash of a URL ``(?!/)`` fails and at the second slash the
# negative lookbehind fails. A colon before a filesystem path is allowed so
# strings such as ``path:/opt/private`` are still redacted.
_POSIX_ABSOLUTE = re.compile(r"(?<![A-Za-z0-9_./-])/(?!/)[^\s;,]+")


def sanitize_text(value: object, project_root: Path) -> str:
    """Remove credentials, secret assignments, and absolute local paths."""

    text = str(value).replace(str(project_root.resolve(strict=False)), ".")
    text = _URI_CREDENTIALS.sub(r"\1<redacted>@", text)
    text = _WINDOWS_ABSOLUTE.sub("<absolute-path>", text)
    text = _POSIX_ABSOLUTE.sub("<absolute-path>", text)
    redacted: list[str] = []
    private_key = False
    for line in text.splitlines() or [""]:
        if _PRIVATE_KEY_BEGIN.search(line):
            private_key = True
        if private_key:
            if not redacted or redacted[-1] != "<redacted private key material>":
                redacted.append("<redacted private key material>")
            if _PRIVATE_KEY_END.search(line):
                private_key = False
            continue
        redacted.append(
            "<redacted sensitive line>" if _SENSITIVE_LINE.search(line) else line
        )
    return "\n".join(redacted)
