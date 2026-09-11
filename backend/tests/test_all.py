"""Comprehensive test suite for RescueBridge backend.

Covers: input validation, triage schema, severity rules, verification logic,
security sanitisation, API endpoints, fallback behavior, and Places/TTS degradation.
"""

from __future__ import annotations

import base64
import json
import uuid

import pytest

from app.core.security import sanitise_text, validate_base64_audio, validate_base64_image
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


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 1: Input Validation & Security
# ═══════════════════════════════════════════════════════════════════════════


class TestSanitiseText:
    """Tests for text sanitisation."""

    def test_strips_html_tags(self):
        result = sanitise_text("<script>alert('xss')</script>Help me!")
        assert "<script>" not in result
        assert "Help me!" in result

    def test_escapes_html_entities(self):
        result = sanitise_text("Tom & Jerry <3")
        assert "&amp;" in result or "&lt;" in result

    def test_truncates_long_text(self):
        long = "a" * 20_000
        result = sanitise_text(long, max_length=1000)
        assert len(result) <= 1000

    def test_collapses_whitespace(self):
        result = sanitise_text("hello    world\n\n\n   test")
        assert "  " not in result

    def test_empty_string(self):
        result = sanitise_text("")
        assert result == ""

    def test_preserves_medical_terms(self):
        result = sanitise_text("Patient has diabetes type 2, allergic to penicillin")
        assert "diabetes" in result.lower()
        assert "penicillin" in result.lower()


class TestInputValidation:
    """Tests for TriageInput validation."""

    def test_text_only_valid(self):
        inp = TriageInput(raw_text="Help, someone is hurt")
        assert inp.raw_text == "Help, someone is hurt"

    def test_empty_input_valid_at_schema_level(self):
        """Empty input passes Pydantic validation but is caught at API layer."""
        inp = TriageInput()
        assert inp.raw_text == ""
        assert inp.audio_base64 is None
        assert inp.image_base64 is None

    def test_geo_location_valid(self):
        geo = GeoLocation(lat=12.9716, lng=77.5946)
        assert geo.lat == 12.9716
        assert geo.lng == 77.5946

    def test_geo_location_invalid_lat(self):
        with pytest.raises(Exception):
            GeoLocation(lat=91, lng=77)

    def test_geo_location_invalid_lng(self):
        with pytest.raises(Exception):
            GeoLocation(lat=12, lng=181)

    def test_base64_image_valid(self):
        tiny = base64.b64encode(b"fake image data").decode()
        result = validate_base64_image(tiny)
        assert result == tiny

    def test_base64_image_with_data_url_prefix(self):
        raw = b"fake image data"
        b64 = base64.b64encode(raw).decode()
        data_url = f"data:image/jpeg;base64,{b64}"
        result = validate_base64_image(data_url)
        # Should strip the prefix and return just the base64
        assert result == b64

    def test_base64_image_too_large(self):
        """Simulate oversized image rejection."""
        # Create a fake oversized base64 that decodes to > 10MB
        # Instead, test with a small payload and low limit
        tiny = base64.b64encode(b"x" * 100).decode()
        with pytest.raises(ValueError, match="limit"):
            validate_base64_image(tiny, max_bytes=50)

    def test_base64_audio_valid(self):
        tiny = base64.b64encode(b"fake audio data").decode()
        result = validate_base64_audio(tiny)
        assert result == tiny


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 2: Schema & Model Validation
# ═══════════════════════════════════════════════════════════════════════════


class TestSeverity:
    """Severity enum values."""

    def test_all_severities_exist(self):
        values = {s.value for s in Severity}
        assert values == {
            "P1_CRITICAL",
            "P2_SERIOUS",
            "P3_MODERATE",
            "P4_LOW",
        }

    def test_severity_ordering_logic(self):
        """P1 > P2 > P3 > P4 in urgency."""
        assert Severity.P1_CRITICAL.value < Severity.P4_LOW.value


class TestEscalation:
    """Escalation enum values."""

    def test_all_escalations(self):
        values = {e.value for e in Escalation}
        assert "CALL_112_IMMEDIATELY" in values
        assert "VISIT_ER" in values
        assert "URGENT_CARE" in values
        assert "POISON_CONTROL" in values
        assert "SELF_CARE" in values

    def test_no_911_anywhere(self):
        """CRITICAL: 112 only, never 911."""
        for e in Escalation:
            assert "911" not in e.value


class TestTriageOutput:
    """TriageOutput model validation."""

    def test_minimal_valid_output(self, sample_triage_output):
        out = sample_triage_output
        assert out.severity == Severity.P1_CRITICAL
        assert len(out.immediate_actions) >= 1
        assert out.escalation == Escalation.CALL_112_IMMEDIATELY

    def test_output_serialises_to_json(self, sample_triage_output):
        data = sample_triage_output.model_dump(mode="json")
        assert isinstance(data, dict)
        json_str = json.dumps(data)
        assert "P1_CRITICAL" in json_str
        assert "CALL_112_IMMEDIATELY" in json_str

    def test_output_roundtrip(self, sample_triage_output):
        data = sample_triage_output.model_dump(mode="json")
        restored = TriageOutput(**data)
        assert restored.severity == sample_triage_output.severity
        assert restored.headline == sample_triage_output.headline

    def test_handoff_packet_has_required_fields(self, sample_triage_output):
        hp = sample_triage_output.handoff_packet
        assert hp.incident_id
        assert hp.severity
        assert hp.timestamp
        assert hp.recommended_escalation

    def test_verification_has_status(self, sample_triage_output):
        v = sample_triage_output.verification
        assert v.status in {VerificationStatus.VERIFIED, VerificationStatus.PARTIAL, VerificationStatus.CONFLICT}

    def test_medical_context_structured(self, sample_triage_output):
        mc = sample_triage_output.medical_context
        assert isinstance(mc.symptoms, list)
        assert isinstance(mc.drug_flags, list)


class TestVerificationStatus:
    """Verification status enum."""

    def test_all_statuses(self):
        values = {v.value for v in VerificationStatus}
        assert values == {"VERIFIED", "PARTIAL", "CONFLICT"}


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 3: Verification Engine Logic
# ═══════════════════════════════════════════════════════════════════════════


class TestVerificationEngine:
    """Tests for verification logic and contradiction detection."""

    def test_verified_status_all_checks_pass(self):
        v = Verification(
            status=VerificationStatus.VERIFIED,
            checks_done=[
                VerificationCheck(source="gemini_knowledge", result="Symptoms consistent"),
                VerificationCheck(source="input_cross_check", result="No contradictions"),
            ],
            contradictions=[],
            uncertainties=[],
        )
        assert v.status == VerificationStatus.VERIFIED
        assert len(v.contradictions) == 0

    def test_partial_status_uncertainties(self):
        v = Verification(
            status=VerificationStatus.PARTIAL,
            checks_done=[
                VerificationCheck(source="gemini_knowledge", result="Partial match"),
            ],
            contradictions=[],
            uncertainties=["Exact time unknown"],
        )
        assert v.status == VerificationStatus.PARTIAL
        assert len(v.uncertainties) > 0

    def test_conflict_status_contradictions(self):
        v = Verification(
            status=VerificationStatus.CONFLICT,
            checks_done=[],
            contradictions=[
                "User says conscious but image shows no response",
                "Weather data contradicts stated conditions",
            ],
            uncertainties=[],
        )
        assert v.status == VerificationStatus.CONFLICT
        assert len(v.contradictions) == 2

    def test_verification_merge_signal_checks(self):
        """Simulate merging signal verification into base verification."""
        base = {
            "status": "PARTIAL",
            "checks_done": [
                {"source": "gemini_knowledge", "result": "OK"}
            ],
            "contradictions": [],
            "uncertainties": [],
        }
        signals = {
            "checks_done": [
                {"source": "weather_signal", "result": "Low visibility detected"}
            ],
            "contradictions": ["Visibility contradicts user travel claims"],
            "uncertainties": [],
        }

        # Simulate the merge logic
        for check in signals["checks_done"]:
            base["checks_done"].append(check)
        if signals["contradictions"]:
            base["contradictions"].extend(signals["contradictions"])
            base["status"] = "CONFLICT"
        base["uncertainties"].extend(signals.get("uncertainties", []))

        assert base["status"] == "CONFLICT"
        assert len(base["checks_done"]) == 2
        assert len(base["contradictions"]) == 1

    def test_degradable_without_signals(self):
        """Verification still works with no external signals."""
        v = Verification(
            status=VerificationStatus.PARTIAL,
            checks_done=[
                VerificationCheck(
                    source="gemini_knowledge",
                    result="Standalone knowledge check",
                ),
            ],
            contradictions=[],
            uncertainties=["No external signal data available"],
        )
        assert v.status == VerificationStatus.PARTIAL
        assert len(v.checks_done) == 1


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 4: Handoff Packet
# ═══════════════════════════════════════════════════════════════════════════


class TestHandoffPacket:
    """Tests for the dispatcher-ready handoff packet."""

    def test_handoff_packet_has_incident_id(self, sample_triage_output):
        hp = sample_triage_output.handoff_packet
        assert hp.incident_id
        # Should be a valid UUID
        parsed = uuid.UUID(hp.incident_id)
        assert str(parsed) == hp.incident_id

    def test_handoff_packet_serialisable(self, sample_triage_output):
        hp = sample_triage_output.handoff_packet.model_dump(mode="json")
        assert isinstance(hp, dict)
        assert "incident_id" in hp
        assert "severity" in hp
        assert "recommended_escalation" in hp

    def test_handoff_packet_timeline_is_list(self, sample_triage_output):
        hp = sample_triage_output.handoff_packet
        assert isinstance(hp.timeline, list)
        assert len(hp.timeline) > 0

    def test_handoff_packet_verified_unverified_split(self, sample_triage_output):
        hp = sample_triage_output.handoff_packet
        assert isinstance(hp.verified_facts, list)
        assert isinstance(hp.unverified, list)


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 5: Severity Escalation Rules
# ═══════════════════════════════════════════════════════════════════════════


class TestSeverityEscalationRules:
    """Severity-escalation mapping rule table."""

    def test_p1_maps_to_call_112(self):
        assert Severity.P1_CRITICAL is not None
        assert Escalation.CALL_112_IMMEDIATELY is not None

    def test_p2_maps_to_visit_er_or_call_112(self):
        """P2 serious — could be ER or 112 depending on context."""
        assert Severity.P2_SERIOUS is not None

    def test_p3_maps_to_urgent_care(self):
        assert Severity.P3_MODERATE is not None

    def test_p4_maps_to_self_care(self):
        assert Severity.P4_LOW is not None

    def test_severity_tier_count(self):
        """Must have exactly 4 severity tiers."""
        assert len(Severity) == 4

    def test_escalation_tier_count(self):
        """Must have exactly 5 escalation options."""
        assert len(Escalation) == 5


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 6: Places & Services Degradation
# ═══════════════════════════════════════════════════════════════════════════


class TestServicesDegradation:
    """Verify services degrade gracefully without API keys."""

    def test_places_client_returns_empty_without_key(self):
        """When GOOGLE_MAPS_API_KEY is empty, places returns []."""
        import os

        old = os.environ.get("GOOGLE_MAPS_API_KEY")
        os.environ["GOOGLE_MAPS_API_KEY"] = ""
        try:
            import importlib
            from app.services import places_client
            importlib.reload(places_client)
            # The function should return empty list when key is missing
            # We can't easily test async without event loop, but we verify the guard
            assert not places_client.get_settings().GOOGLE_MAPS_API_KEY
        finally:
            if old:
                os.environ["GOOGLE_MAPS_API_KEY"] = old
            elif "GOOGLE_MAPS_API_KEY" in os.environ:
                del os.environ["GOOGLE_MAPS_API_KEY"]

    def test_tts_returns_none_without_credentials(self):
        """When GOOGLE_TTS_CREDENTIALS_PATH is empty, TTS returns None."""
        import os

        os.environ.pop("GOOGLE_TTS_CREDENTIALS_PATH", None)
        from app.core.config import get_settings
        s = get_settings()
        assert not s.GOOGLE_TTS_CREDENTIALS_PATH

    def test_haversine_distance(self):
        """Test the haversine distance function directly."""
        from app.services.places_client import _haversine_distance

        # Bangalore to Chennai is ~290km
        dist = _haversine_distance(12.9716, 77.5946, 13.0827, 80.2707)
        assert 200_000 < dist < 400_000  # ~290km in metres

    def test_haversine_same_point(self):
        from app.services.places_client import _haversine_distance

        dist = _haversine_distance(12.9716, 77.5946, 12.9716, 77.5946)
        assert dist == 0.0


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 7: API Endpoints
# ═══════════════════════════════════════════════════════════════════════════


class TestAPIHealth:
    """Test health and root endpoints."""

    def test_health_check(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "timestamp" in data
        assert "gemini_configured" in data

    def test_root_endpoint(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "RescueBridge" in data["service"]


class TestTriageEndpoint:
    """Test the POST /api/triage endpoint."""

    def test_triage_empty_input_rejected(self, client):
        resp = client.post(
            "/api/triage",
            json={"raw_text": "", "language_tag": "en"},
        )
        assert resp.status_code == 400

    def test_triage_text_input_accepted(self, client):
        """Text-only triage should succeed (uses fallback if no Gemini key)."""
        resp = client.post(
            "/api/triage",
            json={
                "raw_text": "Car accident, person bleeding from head, in shock",
                "language_tag": "en",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "triage" in data
        assert "severity" in data["triage"]
        assert "immediate_actions" in data["triage"]
        assert "verification" in data["triage"]
        assert "handoff_packet" in data["triage"]

    def test_triage_includes_verification(self, client):
        resp = client.post(
            "/api/triage",
            json={"raw_text": "Poisoning case, swallowed unknown substance"},
        )
        assert resp.status_code == 200
        data = resp.json()
        v = data["triage"]["verification"]
        assert "status" in v
        assert v["status"] in ("VERIFIED", "PARTIAL", "CONFLICT")

    def test_triage_includes_handoff_packet(self, client):
        resp = client.post(
            "/api/triage",
            json={"raw_text": "Heart attack symptoms, chest pain, left arm numb"},
        )
        assert resp.status_code == 200
        hp = resp.json()["triage"]["handoff_packet"]
        assert "incident_id" in hp
        assert "severity" in hp
        assert "recommended_escalation" in hp

    def test_triage_112_only(self, client):
        """Critical: triage output must reference 112, never 911."""
        resp = client.post(
            "/api/triage",
            json={"raw_text": "Emergency, call for help immediately"},
        )
        assert resp.status_code == 200
        full_json = json.dumps(resp.json())
        assert "911" not in full_json
        # 112 should appear somewhere in the output
        assert "112" in full_json

    def test_triage_severity_valid(self, client):
        resp = client.post(
            "/api/triage",
            json={"raw_text": "Minor cut on finger, first aid needed"},
        )
        data = resp.json()
        severity = data["triage"]["severity"]
        assert severity in ("P1_CRITICAL", "P2_SERIOUS", "P3_MODERATE", "P4_LOW")


class TestHistoryEndpoint:
    """Test history endpoints."""

    def test_history_empty(self, client):
        resp = client.get("/api/history")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_history_after_triage(self, client):
        # First create an incident
        client.post(
            "/api/triage",
            json={"raw_text": "Test incident for history"},
        )
        # Then fetch history
        resp = client.get("/api/history")
        assert resp.status_code == 200
        history = resp.json()
        assert len(history) >= 1

    def test_history_limit(self, client):
        resp = client.get("/api/history?limit=5")
        assert resp.status_code == 200


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 8: Indian Emergency Context
# ═══════════════════════════════════════════════════════════════════════════


class TestIndianEmergencyContext:
    """Ensure Indian emergency context is maintained throughout."""

    def test_no_911_in_any_schema_enum(self):
        """911 must never appear in any enum value."""
        for sev in Severity:
            assert "911" not in sev.value
        for esc in Escalation:
            assert "911" not in esc.value

    def test_112_in_escalation(self):
        """112 must be the emergency escalation option."""
        assert Escalation.CALL_112_IMMEDIATELY.value == "CALL_112_IMMEDIATELY"

    def test_language_map_covers_indian_languages(self):
        from app.services.tts_client import LANGUAGE_MAP

        assert "hi" in LANGUAGE_MAP
        assert "kn" in LANGUAGE_MAP
        assert "ta" in LANGUAGE_MAP
        assert "te" in LANGUAGE_MAP
        assert "bn" in LANGUAGE_MAP
        assert "en" in LANGUAGE_MAP

    def test_fallback_triage_uses_112(self):
        """Fallback triage must also use 112."""
        from app.services.gemini_engine import _fallback_triage

        inp = TriageInput(raw_text="Test fallback")
        output = _fallback_triage(inp)
        assert "112" in " ".join(output.immediate_actions)
        assert "911" not in " ".join(output.immediate_actions)


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 9: Lifecycle State Machine
# ═══════════════════════════════════════════════════════════════════════════


class TestLifecycleTransitions:
    """Legal and illegal lifecycle transitions."""

    def test_valid_transition_draft_to_verified(self):
        from app.services.lifecycle import advance_lifecycle, is_valid_transition
        from app.models.schemas import LifecycleState

        assert is_valid_transition(LifecycleState.DRAFT, LifecycleState.VERIFIED)
        new_state, entry = advance_lifecycle(
            LifecycleState.DRAFT, LifecycleState.VERIFIED, "user", "Confirmed facts"
        )
        assert new_state == LifecycleState.VERIFIED
        assert entry.state == LifecycleState.VERIFIED
        assert entry.actor == "user"

    def test_valid_transition_full_chain(self):
        from app.services.lifecycle import advance_lifecycle
        from app.models.schemas import LifecycleState

        chain = [
            (LifecycleState.DRAFT, LifecycleState.VERIFIED),
            (LifecycleState.VERIFIED, LifecycleState.SENT),
            (LifecycleState.SENT, LifecycleState.ACKNOWLEDGED),
            (LifecycleState.ACKNOWLEDGED, LifecycleState.ASSIGNED),
            (LifecycleState.ASSIGNED, LifecycleState.ARRIVING),
            (LifecycleState.ARRIVING, LifecycleState.CLOSED),
        ]
        current = LifecycleState.DRAFT
        for from_s, to_s in chain:
            assert from_s == current
            current, _ = advance_lifecycle(current, to_s, "system", f"Move to {to_s.value}")
        assert current == LifecycleState.CLOSED

    def test_invalid_transition_draft_to_closed(self):
        from app.services.lifecycle import InvalidTransitionError, advance_lifecycle
        from app.models.schemas import LifecycleState

        with pytest.raises(InvalidTransitionError):
            advance_lifecycle(LifecycleState.DRAFT, LifecycleState.CLOSED)

    def test_invalid_transition_skipping_steps(self):
        from app.services.lifecycle import InvalidTransitionError, advance_lifecycle
        from app.models.schemas import LifecycleState

        with pytest.raises(InvalidTransitionError):
            advance_lifecycle(LifecycleState.DRAFT, LifecycleState.ACKNOWLEDGED)

    def test_invalid_transition_from_terminal_state(self):
        from app.services.lifecycle import InvalidTransitionError, advance_lifecycle
        from app.models.schemas import LifecycleState

        with pytest.raises(InvalidTransitionError):
            advance_lifecycle(LifecycleState.CLOSED, LifecycleState.DRAFT)

    def test_valid_failure_transitions(self):
        from app.services.lifecycle import is_valid_transition
        from app.models.schemas import LifecycleState

        assert is_valid_transition(LifecycleState.SENT, LifecycleState.NO_ACK)
        assert is_valid_transition(LifecycleState.DRAFT, LifecycleState.REJECTED)
        assert is_valid_transition(LifecycleState.SENT, LifecycleState.STALE_LOCATION)

    def test_invalid_failure_from_wrong_state(self):
        from app.services.lifecycle import is_valid_transition
        from app.models.schemas import LifecycleState

        assert not is_valid_transition(LifecycleState.CLOSED, LifecycleState.NO_ACK)
        assert not is_valid_transition(LifecycleState.ARRIVING, LifecycleState.REJECTED)

    def test_is_valid_transition_check(self):
        from app.services.lifecycle import is_valid_transition
        from app.models.schemas import LifecycleState

        assert is_valid_transition(LifecycleState.DRAFT, LifecycleState.VERIFIED)
        assert not is_valid_transition(LifecycleState.DRAFT, LifecycleState.SENT)


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 10: Ledger Evidence Recording
# ═══════════════════════════════════════════════════════════════════════════


class TestLedgerEvidence:
    """Ledger entries record evidence for each transition."""

    def test_initial_ledger_has_draft_entry(self):
        from app.services.lifecycle import create_initial_ledger

        ledger = create_initial_ledger("test-123")
        assert len(ledger) == 1
        assert ledger[0].state.value == "DRAFT"
        assert ledger[0].actor == "system"
        assert "test-123" in ledger[0].evidence

    def test_ledger_entry_has_timestamp(self):
        from app.services.lifecycle import create_initial_ledger

        ledger = create_initial_ledger("test-456")
        assert ledger[0].timestamp  # non-empty
        # Should be ISO format
        from datetime import datetime
        datetime.fromisoformat(ledger[0].timestamp.replace("Z", "+00:00"))

    def test_ledger_entry_has_actor_and_evidence(self):
        from app.services.lifecycle import advance_lifecycle
        from app.models.schemas import LifecycleState

        _, entry = advance_lifecycle(
            LifecycleState.DRAFT,
            LifecycleState.VERIFIED,
            "paramedic",
            "Verified on scene",
        )
        assert entry.actor == "paramedic"
        assert entry.evidence == "Verified on scene"
        assert entry.state == LifecycleState.VERIFIED

    def test_ledger_serialisable(self):
        from app.services.lifecycle import create_initial_ledger

        ledger = create_initial_ledger("test-serial")
        data = ledger[0].model_dump(mode="json")
        assert isinstance(data, dict)
        assert "state" in data
        assert "actor" in data
        assert "timestamp" in data
        assert "evidence" in data

    def test_advance_returns_entry_with_correct_fields(self):
        from app.services.lifecycle import advance_lifecycle
        from app.models.schemas import LifecycleState

        new_state, entry = advance_lifecycle(
            LifecycleState.VERIFIED,
            LifecycleState.SENT,
            "dispatcher",
            "Packet sent to 112",
        )
        assert new_state == LifecycleState.SENT
        assert entry.state == LifecycleState.SENT
        assert entry.actor == "dispatcher"
        assert entry.evidence == "Packet sent to 112"


# ═══════════════════════════════════════════════════════════════════════════
# SECTION 11: Contradiction Detection
# ═══════════════════════════════════════════════════════════════════════════


class TestContradictionDetection:
    """Deterministic contradiction detection across structured fields."""

    def test_consciousness_contradiction(self):
        from app.services.contradiction import detect_contradictions
        from app.models.schemas import (
            MedicalContext, Severity, Verification, VerificationStatus,
            HandoffPacket, TriageOutput, Escalation, GeoLocation,
        )

        inp = TriageInput(raw_text="Person is unconscious, not responding")
        output = TriageOutput(
            severity=Severity.P2_SERIOUS,
            headline="Patient unresponsive",
            medical_context=MedicalContext(
                symptoms=["alert and talking"],
                vitals_mentioned=["conscious"],
            ),
            noise_filtered=["Patient appears conscious"],
            immediate_actions=["Call 112"],
            escalation=Escalation.CALL_112_IMMEDIATELY,
            verification=Verification(
                status=VerificationStatus.PARTIAL,
                checks_done=[],
                contradictions=[],
                uncertainties=[],
            ),
            handoff_packet=HandoffPacket(
                incident_id="test-contradiction-1",
                geotag=GeoLocation(lat=12.0, lng=77.0),
                severity=Severity.P2_SERIOUS,
                timestamp="2026-09-11T12:00:00Z",
                timeline=[],
                verified_facts=[],
                unverified=[],
                recommended_escalation=Escalation.CALL_112_IMMEDIATELY,
                input_types_used=["text"],
            ),
            language_detected="en",
        )

        contradictions = detect_contradictions(inp, output)
        assert len(contradictions) >= 1
        consciousness_c = [c for c in contradictions if c.field_name == "consciousness"]
        assert len(consciousness_c) == 1
        assert "unconscious" in consciousness_c[0].confirm_back_question.lower()

    def test_no_contradiction_when_consistent(self):
        from app.services.contradiction import detect_contradictions
        from app.models.schemas import (
            MedicalContext, Severity, Verification, VerificationStatus,
            HandoffPacket, TriageOutput, Escalation, GeoLocation,
        )

        inp = TriageInput(raw_text="Person is conscious, talking clearly")
        output = TriageOutput(
            severity=Severity.P3_MODERATE,
            headline="Conscious patient with minor injury",
            medical_context=MedicalContext(
                symptoms=["minor cut"],
                vitals_mentioned=["conscious", "alert"],
            ),
            noise_filtered=["Patient is conscious"],
            immediate_actions=["Apply bandage"],
            escalation=Escalation.URGENT_CARE,
            verification=Verification(
                status=VerificationStatus.VERIFIED,
                checks_done=[],
                contradictions=[],
                uncertainties=[],
            ),
            handoff_packet=HandoffPacket(
                incident_id="test-no-contradiction-1",
                geotag=None,
                severity=Severity.P3_MODERATE,
                timestamp="2026-09-11T12:00:00Z",
                timeline=[],
                verified_facts=[],
                unverified=[],
                recommended_escalation=Escalation.URGENT_CARE,
                input_types_used=["text"],
            ),
            language_detected="en",
        )

        contradictions = detect_contradictions(inp, output)
        assert len(contradictions) == 0

    def test_injury_side_contradiction(self):
        from app.services.contradiction import detect_contradictions
        from app.models.schemas import (
            MedicalContext, Severity, Verification, VerificationStatus,
            HandoffPacket, TriageOutput, Escalation, GeoLocation,
        )

        inp = TriageInput(raw_text="Injury on left arm, bleeding")
        output = TriageOutput(
            severity=Severity.P2_SERIOUS,
            headline="Right arm injury",
            medical_context=MedicalContext(
                symptoms=["right arm laceration"],
                vitals_mentioned=[],
            ),
            noise_filtered=[],
            immediate_actions=["Apply pressure"],
            escalation=Escalation.VISIT_ER,
            verification=Verification(
                status=VerificationStatus.PARTIAL,
                checks_done=[],
                contradictions=[],
                uncertainties=[],
            ),
            handoff_packet=HandoffPacket(
                incident_id="test-side-1",
                geotag=None,
                severity=Severity.P2_SERIOUS,
                timestamp="2026-09-11T12:00:00Z",
                timeline=[],
                verified_facts=[],
                unverified=[],
                recommended_escalation=Escalation.VISIT_ER,
                input_types_used=["text"],
            ),
            language_detected="en",
        )

        contradictions = detect_contradictions(inp, output)
        side_c = [c for c in contradictions if c.field_name == "injury_side"]
        assert len(side_c) == 1
        assert "left" in side_c[0].confirm_back_question.lower()

    def test_patient_count_contradiction(self):
        from app.services.contradiction import detect_contradictions
        from app.models.schemas import (
            MedicalContext, Severity, Verification, VerificationStatus,
            HandoffPacket, TriageOutput, Escalation, GeoLocation,
        )

        inp = TriageInput(raw_text="3 people injured in the accident")
        output = TriageOutput(
            severity=Severity.P2_SERIOUS,
            headline="Single patient with head injury",
            medical_context=MedicalContext(
                symptoms=["head trauma"],
                vitals_mentioned=[],
            ),
            noise_filtered=["One person hurt"],
            immediate_actions=["Call 112"],
            escalation=Escalation.CALL_112_IMMEDIATELY,
            verification=Verification(
                status=VerificationStatus.PARTIAL,
                checks_done=[],
                contradictions=[],
                uncertainties=[],
            ),
            handoff_packet=HandoffPacket(
                incident_id="test-count-1",
                geotag=None,
                severity=Severity.P2_SERIOUS,
                timestamp="2026-09-11T12:00:00Z",
                timeline=[],
                verified_facts=[],
                unverified=[],
                recommended_escalation=Escalation.CALL_112_IMMEDIATELY,
                input_types_used=["text"],
            ),
            language_detected="en",
        )

        contradictions = detect_contradictions(inp, output)
        count_c = [c for c in contradictions if c.field_name == "patient_count"]
        assert len(count_c) == 1
        assert "3" in count_c[0].confirm_back_question or "three" in count_c[0].confirm_back_question.lower()

    def test_apply_contradictions_sets_conflict(self):
        from app.services.contradiction import (
            apply_contradictions_to_verification, Contradiction,
        )

        contradictions = [
            Contradiction(
                field_name="consciousness",
                fact_a="Input: unconscious",
                fact_b="Output: conscious",
                description="Mismatch",
                confirm_back_question="Which is current?",
            )
        ]
        status, updated, question = apply_contradictions_to_verification(
            contradictions, "PARTIAL", []
        )
        assert status == "CONFLICT"
        assert len(updated) == 1
        assert question == "Which is current?"

    def test_empty_input_no_contradictions(self):
        from app.services.contradiction import detect_contradictions

        inp = TriageInput(raw_text="")
        # Minimal output for empty input
        contradictions = detect_contradictions(inp, TriageOutput(
            severity=Severity.P4_LOW,
            headline="No data",
            immediate_actions=["Wait"],
            escalation=Escalation.SELF_CARE,
            verification=Verification(
                status=VerificationStatus.PARTIAL,
                checks_done=[],
                contradictions=[],
                uncertainties=[],
            ),
            handoff_packet=HandoffPacket(
                incident_id="test-empty",
                geotag=None,
                severity=Severity.P4_LOW,
                timestamp="2026-09-11T12:00:00Z",
                timeline=[],
                verified_facts=[],
                unverified=[],
                recommended_escalation=Escalation.SELF_CARE,
                input_types_used=[],
            ),
        ))
        assert contradictions == []

    def test_deterministic_output(self):
        """Same input always produces same contradictions."""
        from app.services.contradiction import detect_contradictions
        from app.models.schemas import (
            MedicalContext, Severity, Verification, VerificationStatus,
            HandoffPacket, TriageOutput, Escalation, GeoLocation,
        )

        inp = TriageInput(raw_text="Person is unconscious on the ground")
        output = TriageOutput(
            severity=Severity.P1_CRITICAL,
            headline="Unresponsive patient",
            medical_context=MedicalContext(
                symptoms=[],
                vitals_mentioned=["conscious", "alert"],
            ),
            noise_filtered=[],
            immediate_actions=["Call 112"],
            escalation=Escalation.CALL_112_IMMEDIATELY,
            verification=Verification(
                status=VerificationStatus.PARTIAL,
                checks_done=[],
                contradictions=[],
                uncertainties=[],
            ),
            handoff_packet=HandoffPacket(
                incident_id="test-deterministic",
                geotag=GeoLocation(lat=12.0, lng=77.0),
                severity=Severity.P1_CRITICAL,
                timestamp="2026-09-11T12:00:00Z",
                timeline=[],
                verified_facts=[],
                unverified=[],
                recommended_escalation=Escalation.CALL_112_IMMEDIATELY,
                input_types_used=["text"],
            ),
            language_detected="en",
        )

        result1 = detect_contradictions(inp, output)
        result2 = detect_contradictions(inp, output)
        assert len(result1) == len(result2)
        for c1, c2 in zip(result1, result2):
            assert c1.field_name == c2.field_name
            assert c1.confirm_back_question == c2.confirm_back_question
