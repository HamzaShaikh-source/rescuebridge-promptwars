"""Triage API routes — the core endpoints.

POST /api/triage  — full multimodal pipeline
GET  /api/history  — recent incident history
GET  /api/history/:id  — single incident
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.core.security import sanitise_text, validate_base64_audio, validate_base64_image
from app.models.schemas import (
    Escalation,
    GeoLocation,
    IncidentRecord,
    Severity,
    TriageInput,
    TriageResponse,
    VerificationStatus,
)
from app.services.firestore_service import get_incident_by_id, get_recent_incidents, save_incident
from app.services.places_client import find_nearest_emergency_services
from app.services.tts_client import synthesise_speech
from app.services.verification_signals import build_signal_verification, gather_verification_signals

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/triage", response_model=TriageResponse)
async def run_triage_pipeline(inp: TriageInput) -> dict:
    """Full multimodal triage pipeline.

    1. Validate & sanitise inputs
    2. Gather optional external signals
    3. Run Gemini structured triage + verification
    4. Look up nearest emergency services
    5. Synthesise speech for instructions
    6. Persist to Firestore / memory
    7. Return complete triage response
    """
    settings = get_settings()

    # ── Input validation & sanitisation ────────────────────────────────────
    if inp.raw_text:
        inp.raw_text = sanitise_text(inp.raw_text, max_length=settings.MAX_TEXT_LENGTH)
    if not inp.raw_text and not inp.audio_base64 and not inp.image_base64:
        raise HTTPException(
            status_code=400,
            detail="At least one of raw_text, audio_base64, or image_base64 is required",
        )

    if inp.audio_base64:
        inp.audio_base64 = validate_base64_audio(inp.audio_base64, settings.MAX_AUDIO_BYTES)
    if inp.image_base64:
        inp.image_base64 = validate_base64_image(inp.image_base64, settings.MAX_IMAGE_BYTES)

    # ── Gather external verification signals ───────────────────────────────
    signal_verification = None
    if inp.geolocation:
        try:
            signals = await gather_verification_signals(inp.geolocation)
            signal_verification = build_signal_verification(signals)
        except Exception:
            logger.warning("Failed to gather verification signals — continuing without them")

    # ── Run Gemini triage ──────────────────────────────────────────────────
    try:
        from app.services.gemini_engine import run_triage as gemini_run_triage

        triage_output = await gemini_run_triage(inp, signal_verification)
    except Exception as e:
        logger.exception("Triage pipeline failed")
        raise HTTPException(status_code=500, detail=f"Triage failed: {str(e)}")

    # ── Nearest places ─────────────────────────────────────────────────────
    nearby_places = []
    if inp.geolocation:
        try:
            nearby_places = await find_nearest_emergency_services(inp.geolocation)
        except Exception:
            logger.warning("Places lookup failed — continuing without it")

    # ── TTS synthesis ──────────────────────────────────────────────────────
    audio_url = None
    try:
        # Speak the first 3 actions
        actions_text = ". ".join(
            triage_output.immediate_actions[:3]
        )
        audio_b64 = await synthesise_speech(
            actions_text, language_code=triage_output.language_detected
        )
        if audio_b64:
            audio_url = f"data:audio/mp3;base64,{audio_b64}"
    except Exception:
        logger.warning("TTS synthesis failed — frontend will use Web Speech API")

    # ── Persist to Firestore / memory ──────────────────────────────────────
    record_id = triage_output.handoff_packet.incident_id
    incident_record = {
        "id": record_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "severity": triage_output.severity.value,
        "headline": triage_output.headline,
        "verification_status": triage_output.verification.status.value,
        "input_types_used": triage_output.handoff_packet.input_types_used,
        "triage": triage_output.model_dump(mode="json"),
    }
    try:
        await save_incident(incident_record)
    except Exception:
        logger.warning("Failed to persist incident record")

    return TriageResponse(
        success=True,
        triage=triage_output,
        nearby_places=nearby_places,
        audio_url=audio_url,
    ).model_dump(mode="json")


@router.get("/history")
async def get_history(limit: int = 20) -> list[dict]:
    """Return recent incident records (newest first)."""
    limit = min(limit, 50)  # Cap at 50
    try:
        records = await get_recent_incidents(limit)
        return records
    except Exception as e:
        logger.exception("Failed to fetch history")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{incident_id}")
async def get_history_item(incident_id: str) -> dict:
    """Return a single incident record by ID."""
    try:
        record = await get_incident_by_id(incident_id)
        if not record:
            raise HTTPException(status_code=404, detail="Incident not found")
        return record
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch incident")
        raise HTTPException(status_code=500, detail=str(e))
