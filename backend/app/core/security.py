"""Security utilities — input sanitisation and key guards."""

from __future__ import annotations

import html
import re


def sanitise_text(text: str, max_length: int = 10_000) -> str:
    """Strip HTML tags and truncate user-supplied text."""
    # Remove HTML tags
    clean = re.sub(r"<[^>]+>", "", text)
    # Escape HTML entities
    clean = html.escape(clean)
    # Collapse whitespace
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:max_length]


def validate_base64_image(data: str, max_bytes: int = 10 * 1024 * 1024) -> str:
    """Basic validation for base64-encoded image data."""
    import base64

    # Strip data-URL prefix if present
    if "," in data and data.index(",") < 100:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data, validate=True)
    if len(raw) > max_bytes:
        raise ValueError(f"Image exceeds {max_bytes // (1024 * 1024)} MB limit")
    return data


def validate_base64_audio(data: str, max_bytes: int = 10 * 1024 * 1024) -> str:
    """Basic validation for base64-encoded audio data."""
    import base64

    if "," in data and data.index(",") < 100:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data, validate=True)
    if len(raw) > max_bytes:
        raise ValueError(f"Audio exceeds {max_bytes // (1024 * 1024)} MB limit")
    return data
