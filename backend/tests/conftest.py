"""Shared test fixtures for RescueBridge backend tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    Escalation,
    GeoLocation,
    HandoffPacket,
    MedicalContext,
    Severity,
    TriageInput,
    TriageOutput,
    Verification,
    VerificationCheck,
    VerificationStatus,
)


@pytest.fixture(autouse=True)
def _no_gemini_in_tests(monkeypatch):
    """Ensure tests never call the real Gemini API."""
    from app.core import config as config_mod
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "")
    monkeypatch.setenv("GOOGLE_TTS_CREDENTIALS_PATH", "")
    monkeypatch.setenv("FIRESTORE_PROJECT_ID", "")
    monkeypatch.setenv("FIRESTORE_CREDENTIALS_PATH", "")
    # Tests must never hit the live local/OpenAI LLM either
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    # Invalidate cached Settings so it picks up the empty env
    config_mod.get_settings.cache_clear()
    yield
    config_mod.get_settings.cache_clear()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def sample_text_input():
    """Minimal valid triage input (text only)."""
    return TriageInput(
        raw_text="Car crash on MG Road Bangalore, driver bleeding from forehead, "
        "conscious but disoriented, diabetic history",
        language_tag="en",
    )


@pytest.fixture
def sample_geo_input():
    """Triage input with geolocation."""
    return TriageInput(
        raw_text="Motorcycle accident, person on the ground not moving",
        geolocation=GeoLocation(lat=12.9716, lng=77.5946),
        language_tag="en",
    )


@pytest.fixture
def sample_minimal_input():
    """Minimal input with just text."""
    return TriageInput(raw_text="Help, someone fainted")


@pytest.fixture
def sample_full_input():
    """Full multi-modal triage input."""
    # Minimal valid base64 for testing (1x1 white pixel PNG)
    tiny_png = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4"
        "nGP4z8BQDwAEgAF/pooBPQAAAABJRU5ErkJggg=="
    )
    return TriageInput(
        raw_text="House fire, my mother is coughing badly, she has asthma",
        image_base64=f"data:image/png;base64,{tiny_png}",
        geolocation=GeoLocation(lat=13.0827, lng=80.2707),
        language_tag="en",
        weather_notes="Heavy rain, low visibility",
        traffic_notes=None,
        news_notes=None,
    )


@pytest.fixture
def sample_triage_output():
    """A complete TriageOutput for unit tests."""
    return TriageOutput(
        severity=Severity.P1_CRITICAL,
        headline="Car crash, driver bleeding, diabetic, needs ER",
        medical_context=MedicalContext(
            symptoms=["bleeding from forehead", "disorientation"],
            vitals_mentioned=["conscious"],
            drug_flags=[],
            allergy_flags=[],
        ),
        noise_filtered=[
            "Car crash on MG Road Bangalore",
            "Driver bleeding from forehead",
            "Conscious but disoriented",
            "Diabetic history",
        ],
        immediate_actions=[
            "Apply firm pressure to forehead wound with clean cloth",
            "Keep the person still and calm",
            "Call 112 immediately",
            "Monitor consciousness level",
            "Inform dispatcher about diabetic history",
        ],
        escalation=Escalation.CALL_112_IMMEDIATELY,
        verification=Verification(
            status=VerificationStatus.PARTIAL,
            checks_done=[
                VerificationCheck(
                    source="gemini_knowledge",
                    result="Bleeding + disorientation consistent with head trauma",
                ),
            ],
            contradictions=[],
            uncertainties=["Exact time of accident unknown"],
        ),
        handoff_packet=HandoffPacket(
            incident_id="a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            geotag=GeoLocation(lat=12.9716, lng=77.5946),
            severity=Severity.P1_CRITICAL,
            timestamp="2026-09-11T12:00:00Z",
            timeline=[
                "Car crash on MG Road, Bangalore",
                "Driver bleeding from forehead",
                "Conscious but disoriented",
                "Diabetic history noted",
            ],
            verified_facts=["Conscious patient", "Visible bleeding"],
            unverified=["Time of accident", "Other injuries"],
            recommended_escalation=Escalation.CALL_112_IMMEDIATELY,
            input_types_used=["text"],
        ),
        environmental_hazards=[],
        language_detected="en",
    )
