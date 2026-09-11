"""Pydantic schemas for RescueBridge — Triage, Verification, Handoff, Maps.

All models use strict typing and JSON Schema generation for Gemini Structured Output.
Severity always maps to Indian emergency context (112 only).
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────────

class Severity(str, Enum):
    P1_CRITICAL = "P1_CRITICAL"
    P2_SERIOUS = "P2_SERIOUS"
    P3_MODERATE = "P3_MODERATE"
    P4_LOW = "P4_LOW"


class Escalation(str, Enum):
    CALL_112_IMMEDIATELY = "CALL_112_IMMEDIATELY"
    VISIT_ER = "VISIT_ER"
    URGENT_CARE = "URGENT_CARE"
    POISON_CONTROL = "POISON_CONTROL"
    SELF_CARE = "SELF_CARE"


class VerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    PARTIAL = "PARTIAL"
    CONFLICT = "CONFLICT"


class LifecycleState(str, Enum):
    """Incident lifecycle states — closed-loop state machine."""

    DRAFT = "DRAFT"
    VERIFIED = "VERIFIED"
    SENT = "SENT"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ASSIGNED = "ASSIGNED"
    ARRIVING = "ARRIVING"
    CLOSED = "CLOSED"
    NO_ACK = "NO_ACK"
    REJECTED = "REJECTED"
    STALE_LOCATION = "STALE_LOCATION"


# ── Input ──────────────────────────────────────────────────────────────────

class GeoLocation(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")


class TriageInput(BaseModel):
    """The messy, unstructured input from a panicked user."""

    raw_text: str = Field(
        "",
        description="Free-form text describing the emergency",
    )
    audio_base64: Optional[str] = Field(
        None, description="Base64-encoded voice note (WebM, MP3, WAV)"
    )
    image_base64: Optional[str] = Field(
        None, description="Base64-encoded scene or injury photo"
    )
    geolocation: Optional[GeoLocation] = Field(
        None, description="Device GPS coordinates"
    )
    language_tag: str = Field(
        "auto",
        description="ISO 639-1 code or 'auto' for detection",
    )
    weather_notes: Optional[str] = Field(None, description="Optional weather signal")
    traffic_notes: Optional[str] = Field(None, description="Optional traffic signal")
    news_notes: Optional[str] = Field(None, description="Optional news signal")


# ── Triage Output (Gemini Structured Output) ───────────────────────────────

class MedicalContext(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    vitals_mentioned: list[str] = Field(default_factory=list)
    drug_flags: list[str] = Field(default_factory=list)
    allergy_flags: list[str] = Field(default_factory=list)


class VerificationCheck(BaseModel):
    source: str = Field(..., description="e.g. 'gemini_knowledge', 'input_cross_check'")
    result: str = Field(..., description="Brief description of check result")


class Verification(BaseModel):
    status: VerificationStatus = Field(
        ..., description="Overall verification verdict"
    )
    checks_done: list[VerificationCheck] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    confirm_back_question: Optional[str] = Field(
        None,
        description="Single short question for the caller to resolve a conflict",
    )


class HandoffPacket(BaseModel):
    """Dispatch-ready summary for 112 operators or incoming EMTs."""

    incident_id: str = Field(..., description="Unique incident UUID")
    geotag: Optional[GeoLocation] = Field(None)
    severity: Severity
    timestamp: str = Field(
        ..., description="ISO-8601 timestamp of triage"
    )
    timeline: list[str] = Field(
        default_factory=list,
        description="Chronological facts extracted from input",
    )
    verified_facts: list[str] = Field(default_factory=list)
    unverified: list[str] = Field(default_factory=list)
    recommended_escalation: Escalation
    input_types_used: list[str] = Field(
        default_factory=list, description="e.g. ['text', 'image']"
    )


class EnvironmentalHazard(BaseModel):
    hazard_type: str = Field(..., description="e.g. 'flooding', 'road_closure'")
    description: str
    severity_impact: str = Field(
        "", description="How this affects triage"
    )


class TriageOutput(BaseModel):
    """Structured triage result produced by the Gemini engine."""

    severity: Severity
    headline: str = Field(
        ..., max_length=120, description="10-word incident synopsis"
    )
    medical_context: MedicalContext = Field(default_factory=MedicalContext)
    noise_filtered: list[str] = Field(
        default_factory=list,
        description="Rambling stripped; key facts preserved",
    )
    immediate_actions: list[str] = Field(
        ..., min_length=1, description="Ordered first-aid steps"
    )
    escalation: Escalation
    verification: Verification
    handoff_packet: HandoffPacket
    environmental_hazards: list[EnvironmentalHazard] = Field(default_factory=list)
    language_detected: str = Field("en", description="Detected language code")


# ── Places / Maps ──────────────────────────────────────────────────────────

class NearbyPlace(BaseModel):
    name: str
    address: str
    distance_m: float = Field(description="Distance in metres")
    rating: Optional[float] = None
    open_now: Optional[bool] = None
    phone: Optional[str] = None
    map_url: Optional[str] = None


class PlaceCategory(str, Enum):
    """Supported place categories for the /api/places endpoint."""

    HOSPITAL = "hospital"
    BLOOD_BANK = "blood_bank"
    PHARMACY = "pharmacy"
    POLICE = "police"
    FUEL = "fuel"
    AMBULANCE = "ambulance"


class PlaceResult(BaseModel):
    """A single nearby place — additive schema for GET /api/places."""

    name: str
    category: PlaceCategory
    address: str
    distance_m: float = Field(description="Straight-line distance in metres")
    walk_min: int = Field(description="Estimated walking minutes")
    drive_min: int = Field(description="Estimated driving minutes")
    open_now_24h: Optional[bool] = Field(
        None, description="Whether the place is open 24/7 (when known)"
    )
    phone: Optional[str] = None
    map_url: Optional[str] = None
    source: str = Field("google", description="'google' for live Places, 'mock' for fallback")


# ── History ────────────────────────────────────────────────────────────────

class LifecycleEntry(BaseModel):
    """Single entry in the incident audit ledger."""

    state: LifecycleState
    actor: str = Field(..., description="Who triggered the transition")
    timestamp: str = Field(..., description="ISO-8601 timestamp")
    evidence: str = Field(
        "", description="Optional evidence or reason for the transition"
    )


class IncidentRecord(BaseModel):
    id: str
    created_at: str
    severity: Severity
    headline: str
    verification_status: VerificationStatus
    input_types_used: list[str]
    triage: TriageOutput
    lifecycle: LifecycleState = Field(
        default=LifecycleState.DRAFT,
        description="Current lifecycle state",
    )
    ledger: list[LifecycleEntry] = Field(
        default_factory=list,
        description="Audit trail of state transitions",
    )


class AdvanceRequest(BaseModel):
    """Request to advance an incident's lifecycle."""

    to_state: LifecycleState
    actor: str = Field("system", description="Who is advancing the state")
    evidence: str = Field("", description="Optional evidence")


class ConfirmRequest(BaseModel):
    """Request to confirm or correct a contradiction."""

    correction: str = Field(..., description="The corrected fact from the user")


# ── API Response Wrappers ─────────────────────────────────────────────────

class TriageResponse(BaseModel):
    success: bool = True
    triage: TriageOutput
    nearby_places: list[NearbyPlace] = Field(default_factory=list)
    audio_url: Optional[str] = Field(
        None, description="URL or base64 of spoken instructions"
    )


class AdvanceResponse(BaseModel):
    success: bool = True
    incident_id: str
    previous_state: LifecycleState
    new_state: LifecycleState
    ledger: list[LifecycleEntry]


class ConfirmResponse(BaseModel):
    success: bool = True
    triage: TriageOutput
    message: str = "Contradiction resolved with provided correction"


class HealthResponse(BaseModel):
    status: str = "ok"
    gemini_configured: bool = False
    maps_configured: bool = False
    timestamp: str = ""
