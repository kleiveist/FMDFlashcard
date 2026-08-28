from __future__ import annotations

import re
from collections.abc import Mapping
from urllib.parse import unquote, urlsplit

URL_CREDENTIAL_PATTERN = re.compile(r"([a-z][a-z0-9+.-]*://[^:/\s@]+:)[^@\s/]+@", re.IGNORECASE)
SECRET_NAME_PATTERN = re.compile(r"(?:^|_)(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)(?:_|$)")
SERVER_ONLY_NAMES = {
    "DATABASE_URL",
    "SECRET_KEY",
    "AUTH_PRIVATE_KEY",
    "SMTP_PASSWORD",
    "REDIS_URL",
}


def is_secret_name(name: str) -> bool:
    normalized = name.upper()
    return normalized == "DATABASE_URL" or SECRET_NAME_PATTERN.search(normalized) is not None


def is_server_only_name(name: str) -> bool:
    return name.upper() in SERVER_ONLY_NAMES


def _mask_url(value: str) -> str:
    return URL_CREDENTIAL_PATTERN.sub(r"\1***@", value)


def mask_config_value(name: str, value: str | None, *, secret: bool = False) -> str:
    if value is None or value == "":
        return "<not set>"
    masked_url = _mask_url(value)
    if masked_url != value:
        return masked_url
    if secret or is_secret_name(name):
        return "<redacted>"
    return value


def redact_text(text: str, values: Mapping[str, str | None]) -> str:
    redacted = text
    for name, value in values.items():
        if not value or not is_secret_name(name):
            continue
        redacted = redacted.replace(value, mask_config_value(name, value, secret=True))
        try:
            password = urlsplit(value).password
        except ValueError:
            password = None
        if password:
            for candidate in {password, unquote(password)}:
                if candidate:
                    redacted = redacted.replace(candidate, "<redacted>")
    return URL_CREDENTIAL_PATTERN.sub(r"\1<redacted>@", redacted)
