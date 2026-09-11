"""Text-to-Speech service — Google Cloud TTS with in-memory fallback.

When GOOGLE_TTS_CREDENTIALS_PATH is set, uses Google Cloud TTS.
Otherwise, returns None so the frontend uses Web Speech API.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Map detected language codes to BCP-47 TTS language tags (Indian languages focus)
LANGUAGE_MAP: dict[str, str] = {
    "en": "en-IN",
    "hi": "hi-IN",
    "kn": "kn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "ur": "ur-IN",
}


async def synthesise_speech(
    text: str,
    language_code: str = "en",
    speaking_rate: float = 1.0,
) -> Optional[str]:
    """Convert text to speech and return base64-encoded audio, or None if unavailable.

    Returns:
        Base64-encoded MP3 audio string, or None when TTS is not configured.
    """
    settings = get_settings()

    if not settings.GOOGLE_TTS_CREDENTIALS_PATH:
        logger.info("Google TTS not configured — frontend will use Web Speech API")
        return None

    try:
        return await _google_cloud_tts(text, language_code, speaking_rate)
    except Exception:
        logger.exception("Google Cloud TTS failed")
        return None


async def _google_cloud_tts(
    text: str,
    language_code: str,
    speaking_rate: float,
) -> Optional[str]:
    """Synthesise speech using Google Cloud Text-to-Speech v1."""
    import base64

    # Lazy import — only needed when credentials are present
    from google.cloud import texttospeech  # type: ignore[import-untyped]

    client = texttospeech.TextToSpeechClient()

    # Limit input length
    synthesis_input = texttospeech.SynthesisInput(text=text[:5000])

    bcp47 = LANGUAGE_MAP.get(language_code, "en-IN")

    voice = texttospeech.VoiceSelectionParams(
        language_code=bcp47,
        name=f"{bcp47}-Standard-A",
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,
        pitch=0.0,
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    return base64.b64encode(response.audio_content).decode("utf-8")
