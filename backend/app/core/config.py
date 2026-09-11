"""Core configuration loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide settings sourced from env vars.

    GEMINI_API_KEY is **required** — the backend refuses to start without it.
    All other keys are optional; missing keys trigger graceful degradation.
    """

    GEMINI_API_KEY: str = ""
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_TTS_CREDENTIALS_PATH: str = ""
    FIRESTORE_CREDENTIALS_PATH: str = ""
    FIRESTORE_PROJECT_ID: str = ""

    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    BACKEND_ENV: str = "development"

    # Input safety limits
    MAX_TEXT_LENGTH: int = 10_000
    MAX_IMAGE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_AUDIO_BYTES: int = 10 * 1024 * 1024  # 10 MB

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:  # type: ignore[misc]
    """Return a singleton Settings instance (cached)."""
    return Settings()  # type: ignore[call-arg]
