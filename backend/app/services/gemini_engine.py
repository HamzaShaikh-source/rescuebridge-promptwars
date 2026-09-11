"""Gemini Structured Output engine — multimodal triage and verification.

This service accepts raw messy input (text, audio transcription, image analysis)
and produces a fully structured, verified triage packet via Gemini's JSON Schema
structured output mode.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.models.schemas import (
    Escalation,
    HandoffPacket,
    MedicalContext,
    Severity,
    TriageInput,
    TriageOutput,
    Verification,
    VerificationCheck,
    VerificationStatus,
)

logger = logging.getLogger(__name__)

TRIAGE_SYSTEM_PROMPT = """\
You are RescueBridge, an emergency triage assistant deployed in India.
You receive messy, unstructured emergency inputs from panicked people.
Your job: convert chaos into structured, verified, actionable triage data.

RULES:
1. Output MUST be valid JSON matching the schema provided.
2. Severity: P1_CRITICAL (life-threatening), P2_SERIOUS (urgent), P3_MODERATE (needs care), P4_LOW (self-care).
3. Escalation: Use exactly one of: CALL_112_IMMEDIATELY, VISIT_ER, URGENT_CARE, POISON_CONTROL, SELF_CARE.
4. Always use 112 (Indian emergency number). Never reference 911 or any other number.
5. Extract ALL medical context: symptoms, vitals mentioned, drug/alergy flags.
6. Strip noise/rambling but preserve EVERY factual detail — list preserved facts in noise_filtered.
7. Provide ordered, specific, actionable first-aid steps (not vague advice).
8. For verification:
   - Cross-check stated facts against your medical knowledge.
   - Flag contradictions (e.g. "person says conscious but image shows unresponsive").
   - Flag uncertainties (e.g. "insufficient data to determine severity").
   - Status: VERIFIED (all facts check out), PARTIAL (some facts verified, some unconfirmed), CONFLICT (contradictions found).
9. For the handoff_packet, produce a compact dispatch-ready JSON with incident_id (UUID), geotag, severity, timeline, verified_facts, unverified, and recommended_escalation.
10. Detect the language of the input and return it in language_detected.
11. Environmental hazards: note any weather/traffic/news that impacts the emergency.
12. Be calm, precise, and clinical. Every word matters in an emergency.
"""

TRIAGE_RESPONSE_SCHEMA = {
    "type": "object",
    "required": [
        "severity",
        "headline",
        "medical_context",
        "noise_filtered",
        "immediate_actions",
        "escalation",
        "verification",
        "handoff_packet",
        "language_detected",
    ],
    "properties": {
        "severity": {
            "type": "string",
            "enum": ["P1_CRITICAL", "P2_SERIOUS", "P3_MODERATE", "P4_LOW"],
        },
        "headline": {"type": "string"},
        "medical_context": {
            "type": "object",
            "properties": {
                "symptoms": {"type": "array", "items": {"type": "string"}},
                "vitals_mentioned": {"type": "array", "items": {"type": "string"}},
                "drug_flags": {"type": "array", "items": {"type": "string"}},
                "allergy_flags": {"type": "array", "items": {"type": "string"}},
            },
        },
        "noise_filtered": {"type": "array", "items": {"type": "string"}},
        "immediate_actions": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
        },
        "escalation": {
            "type": "string",
            "enum": [
                "CALL_112_IMMEDIATELY",
                "VISIT_ER",
                "URGENT_CARE",
                "POISON_CONTROL",
                "SELF_CARE",
            ],
        },
        "verification": {
            "type": "object",
            "required": ["status", "checks_done", "contradictions", "uncertainties"],
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["VERIFIED", "PARTIAL", "CONFLICT"],
                },
                "checks_done": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["source", "result"],
                        "properties": {
                            "source": {"type": "string"},
                            "result": {"type": "string"},
                        },
                    },
                },
                "contradictions": {"type": "array", "items": {"type": "string"}},
                "uncertainties": {"type": "array", "items": {"type": "string"}},
            },
        },
        "handoff_packet": {
            "type": "object",
            "required": [
                "severity",
                "recommended_escalation",
            ],
            "properties": {
                "severity": {
                    "type": "string",
                    "enum": ["P1_CRITICAL", "P2_SERIOUS", "P3_MODERATE", "P4_LOW"],
                },
                "timeline": {"type": "array", "items": {"type": "string"}},
                "verified_facts": {"type": "array", "items": {"type": "string"}},
                "unverified": {"type": "array", "items": {"type": "string"}},
                "recommended_escalation": {
                    "type": "string",
                    "enum": [
                        "CALL_112_IMMEDIATELY",
                        "VISIT_ER",
                        "URGENT_CARE",
                        "POISON_CONTROL",
                        "SELF_CARE",
                    ],
                },
            },
        },
        "environmental_hazards": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["hazard_type", "description"],
                "properties": {
                    "hazard_type": {"type": "string"},
                    "description": {"type": "string"},
                    "severity_impact": {"type": "string"},
                },
            },
        },
        "language_detected": {"type": "string"},
    },
}


def _build_user_content(inp: TriageInput) -> list[types.Part]:
    """Build Gemini content parts from the triage input."""
    parts: list[types.Part] = []

    # Text context
    context_parts: list[str] = []
    if inp.raw_text:
        context_parts.append(f"USER TEXT:\n{inp.raw_text}")
    if inp.language_tag and inp.language_tag != "auto":
        context_parts.append(f"User stated language: {inp.language_tag}")
    if inp.geolocation:
        context_parts.append(
            f"Location: lat={inp.geolocation.lat}, lng={inp.geolocation.lng}"
        )
    if inp.weather_notes:
        context_parts.append(f"Weather signal: {inp.weather_notes}")
    if inp.traffic_notes:
        context_parts.append(f"Traffic signal: {inp.traffic_notes}")
    if inp.news_notes:
        context_parts.append(f"News signal: {inp.news_notes}")
    if context_parts:
        parts.append(types.Part.from_text(text="\n\n".join(context_parts)))

    # Image
    if inp.image_base64:
        raw_bytes = _decode_base64(inp.image_base64)
        mime = _guess_mime(inp.image_base64, default="image/jpeg")
        parts.append(types.Part.from_bytes(data=raw_bytes, mime_type=mime))

    # Audio transcription hint (we pass audio data when supported)
    if inp.audio_base64:
        raw_bytes = _decode_base64(inp.audio_base64)
        mime = _guess_mime(inp.audio_base64, default="audio/webm")
        parts.append(types.Part.from_bytes(data=raw_bytes, mime_type=mime))

    return parts


def _decode_base64(data: str) -> bytes:
    """Decode base64 data, stripping data-URL prefix if present."""
    import base64

    if "," in data and data.index(",") < 100:
        data = data.split(",", 1)[1]
    return base64.b64decode(data)


def _guess_mime(data: str, default: str = "application/octet-stream") -> str:
    """Heuristic mime-type guess from base64 prefix."""
    if data.startswith("data:"):
        try:
            return data.split(":", 1)[1].split(";", 1)[0]
        except (IndexError, ValueError):
            pass
    return default


def _build_triage_output(
    raw: dict[str, Any],
    inp: TriageInput,
    verification_from_signals: Optional[dict] = None,
) -> TriageOutput:
    """Convert Gemini's raw JSON dict into a validated TriageOutput.

    Hardened against partial LLM output — every required nested field is
    backfilled or defaulted so a partial response never produces a 500.
    """
    incident_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Top-level severity/escalation with safe defaults
    severity = raw.get("severity", Severity.P2_SERIOUS)
    escalation = raw.get("escalation", Escalation.CALL_112_IMMEDIATELY)

    # Build handoff packet, filling in ALL fields Gemini might omit
    hp_raw = raw.get("handoff_packet", {})
    hp_raw.setdefault("incident_id", incident_id)
    hp_raw.setdefault("geotag", inp.geolocation.model_dump() if inp.geolocation else None)
    hp_raw.setdefault("timestamp", now)
    hp_raw.setdefault("input_types_used", _detect_input_types(inp))
    hp_raw.setdefault("severity", severity)
    hp_raw.setdefault("recommended_escalation", escalation)
    hp_raw.setdefault("timeline", [])
    hp_raw.setdefault("verified_facts", [])
    hp_raw.setdefault("unverified", [])
    hp = HandoffPacket(**hp_raw)

    # Build verification, merging optional external signal verification
    v_raw = raw.get("verification", {})
    v_raw.setdefault("status", VerificationStatus.PARTIAL)
    v_raw.setdefault("checks_done", [])
    v_raw.setdefault("contradictions", [])
    v_raw.setdefault("uncertainties", [])
    if verification_from_signals:
        v_raw = _merge_verification(v_raw, verification_from_signals)
    verification = Verification(**v_raw)

    return TriageOutput(
        severity=severity,
        headline=raw.get("headline", "Emergency triage in progress"),
        medical_context=MedicalContext(**raw.get("medical_context", {})),
        noise_filtered=raw.get("noise_filtered", []),
        immediate_actions=raw.get("immediate_actions", ["Call 112 immediately"]),
        escalation=escalation,
        verification=verification,
        handoff_packet=hp,
        environmental_hazards=raw.get("environmental_hazards", []),
        language_detected=raw.get("language_detected", "en"),
    )


def _detect_input_types(inp: TriageInput) -> list[str]:
    types_used: list[str] = []
    if inp.raw_text:
        types_used.append("text")
    if inp.audio_base64:
        types_used.append("audio")
    if inp.image_base64:
        types_used.append("image")
    return types_used or ["text"]


def _merge_verification(
    base: dict, signals: dict
) -> dict:
    """Merge signal-based checks into the verification object."""
    base.setdefault("checks_done", [])
    for check in signals.get("checks_done", []):
        base["checks_done"].append(check)

    # If signals found contradictions, upgrade to CONFLICT
    if signals.get("contradictions"):
        base.setdefault("contradictions", [])
        base["contradictions"].extend(signals["contradictions"])
        base["status"] = "CONFLICT"

    base.setdefault("uncertainties", [])
    base["uncertainties"].extend(signals.get("uncertainties", []))

    return base


def _build_user_message_text(inp: TriageInput) -> str:
    """Build a single user message string from triage input fields.

    Used by both Gemini (as part list) and the local provider (as plain text).
    """
    parts: list[str] = []
    if inp.raw_text:
        parts.append(f"USER TEXT:\n{inp.raw_text}")
    if inp.language_tag and inp.language_tag != "auto":
        parts.append(f"User stated language: {inp.language_tag}")
    if inp.geolocation:
        parts.append(f"Location: lat={inp.geolocation.lat}, lng={inp.geolocation.lng}")
    if inp.weather_notes:
        parts.append(f"Weather signal: {inp.weather_notes}")
    if inp.traffic_notes:
        parts.append(f"Traffic signal: {inp.traffic_notes}")
    if inp.news_notes:
        parts.append(f"News signal: {inp.news_notes}")
    if inp.image_base64:
        parts.append("[Image provided — describe the scene in the text above]")
    if inp.audio_base64:
        parts.append("[Audio voice note provided — transcribed above]")
    return "\n\n".join(parts) if parts else ""


# Cached model name for the local provider
_local_model_cache: Optional[str] = None


async def _discover_local_model(base_url: str, api_key: str) -> str:
    """Discover a chat-capable model from the local OpenAI-compatible server.

    Caches the result after the first successful call.
    """
    global _local_model_cache  # noqa: PLW0603
    if _local_model_cache:
        return _local_model_cache

    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{base_url}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()

        models = data.get("data", [])
        # Prefer models with chat in the name, fall back to first
        # All models on the local proxy are chat-capable; prefer flash for speed
        # Skip non-chat models (tts, image-only)
        all_ids = [m["id"] for m in models]
        skip = {"tts", "image"}
        chat_ids = [m for m in all_ids if not any(s in m.lower() for s in skip)]
        flash = [m for m in chat_ids if "flash" in m.lower()]
        chosen = flash[0] if flash else (chat_ids[0] if chat_ids else (all_ids[0] if all_ids else ""))
        if chosen:
            _local_model_cache = chosen
            logger.info("Local LLM model discovered: %s", chosen)
        return chosen
    except Exception:
        logger.exception("Failed to discover local model")
        return ""


async def _run_local_triage(
    inp: TriageInput,
    signal_verification: Optional[dict] = None,
) -> TriageOutput:
    """Run triage using a local OpenAI-compatible server.

    Uses chat.completions.create with json_object response format.
    Falls back to _fallback_triage on any failure.
    """
    from openai import AsyncOpenAI  # type: ignore[import-untyped]

    settings = get_settings()
    base_url = settings.OPENAI_BASE_URL
    api_key = settings.OPENAI_API_KEY

    # Discover model if not configured
    model = settings.OPENAI_MODEL
    if not model:
        model = await _discover_local_model(base_url, api_key)
    if not model:
        logger.warning("No local model available — falling back to offline triage")
        return _fallback_triage(inp)

    # Build messages
    user_text = _build_user_message_text(inp)
    if not user_text:
        raise ValueError("Triage input is empty — provide text, audio, or image")

    # Schema instruction for json_object mode
    schema_hint = json.dumps(TRIAGE_RESPONSE_SCHEMA, indent=2)

    messages = [
        {
            "role": "system",
            "content": (
                f"{TRIAGE_SYSTEM_PROMPT}\n\n"
                "IMPORTANT: You MUST respond with ONLY valid JSON matching this schema.\n"
                "No markdown, no explanation, no code fences — just raw JSON.\n\n"
                f"Schema:\n{schema_hint}"
            ),
        },
        {"role": "user", "content": user_text},
    ]

    try:
        client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )

        raw_text = response.choices[0].message.content or "{}"
        raw_dict = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error("Local LLM returned invalid JSON: %s", raw_text[:500])
        return _fallback_triage(inp)
    except Exception:
        logger.exception("Local LLM call failed")
        return _fallback_triage(inp)

    return _build_triage_output(raw_dict, inp, signal_verification)


async def run_triage(
    inp: TriageInput,
    signal_verification: Optional[dict] = None,
) -> TriageOutput:
    """Execute the full triage pipeline.

    Routes to the local OpenAI-compatible provider or Gemini based on LLM_PROVIDER.

    Args:
        inp: The raw, messy user input.
        signal_verification: Optional pre-computed verification from
            external signals (weather, traffic, news).

    Returns:
        A fully structured and verified TriageOutput.
    """
    settings = get_settings()

    # Route to local provider if configured
    if settings.LLM_PROVIDER == "local":
        logger.info("Using local LLM provider at %s", settings.OPENAI_BASE_URL)
        return await _run_local_triage(inp, signal_verification)

    # Gemini path (production)
    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY not set — returning fallback triage")
        return _fallback_triage(inp)

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    content_parts = _build_user_content(inp)
    if not content_parts:
        raise ValueError("Triage input is empty — provide text, audio, or image")

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=content_parts,
        config=types.GenerateContentConfig(
            system_instruction=TRIAGE_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=TRIAGE_RESPONSE_SCHEMA,
            temperature=0.2,
            max_output_tokens=4096,
        ),
    )

    raw_text = response.text or "{}"
    try:
        raw_dict = json.loads(raw_text)
    except json.JSONDecodeError:
        logger.error("Gemini returned invalid JSON: %s", raw_text[:500])
        raw_dict = {}

    return _build_triage_output(raw_dict, inp, signal_verification)


def _fallback_triage(inp: TriageInput) -> TriageOutput:
    """Offline fallback when Gemini is unavailable — conservative P2 triage."""
    now = datetime.now(timezone.utc).isoformat()
    incident_id = str(uuid.uuid4())

    text_preview = inp.raw_text[:200] if inp.raw_text else "No text provided"
    has_image = bool(inp.image_base64)
    has_audio = bool(inp.audio_base64)

    return TriageOutput(
        severity=Severity.P2_SERIOUS,
        headline=f"Offline triage: {text_preview[:60]}…",
        medical_context=MedicalContext(
            symptoms=["Unable to analyse without AI — err on caution"],
        ),
        noise_filtered=[text_preview],
        immediate_actions=[
            "Call 112 immediately",
            "Stay on the line with the dispatcher",
            "Do not move the patient unless there is immediate danger",
            "Apply pressure to any visible bleeding",
            "Note the time and any changes in the patient's condition",
        ],
        escalation=Escalation.CALL_112_IMMEDIATELY,
        verification=Verification(
            status=VerificationStatus.PARTIAL,
            checks_done=[
                VerificationCheck(
                    source="offline_fallback",
                    result="No Gemini API key configured — conservative triage applied",
                )
            ],
            contradictions=[],
            uncertainties=["Full AI analysis unavailable", "All inputs unverified"],
        ),
        handoff_packet=HandoffPacket(
            incident_id=incident_id,
            geotag=inp.geolocation,
            severity=Severity.P2_SERIOUS,
            timestamp=now,
            timeline=[f"Input received: text={bool(inp.raw_text)}, audio={has_audio}, image={has_image}"],
            verified_facts=[],
            unverified=["All inputs — offline mode"],
            recommended_escalation=Escalation.CALL_112_IMMEDIATELY,
            input_types_used=_detect_input_types(inp),
        ),
        environmental_hazards=[],
        language_detected=inp.language_tag if inp.language_tag != "auto" else "en",
    )
