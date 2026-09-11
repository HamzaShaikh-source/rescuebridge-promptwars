"""Deterministic contradiction detection across structured triage fields.

Cross-checks consciousness, injury side, patient count, time, location
from different input channels to find conflicts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from app.models.schemas import TriageInput, TriageOutput


@dataclass
class Contradiction:
    """A detected contradiction between two facts."""

    field_name: str
    fact_a: str
    fact_b: str
    description: str
    confirm_back_question: str


# Keywords indicating consciousness state
CONSCIOUS_KEYWORDS = {
    "conscious": "conscious",
    "awake": "conscious",
    "responsive": "conscious",
    "alert": "conscious",
    "talking": "conscious",
    "unconscious": "unconscious",
    "not responsive": "unconscious",
    "no response": "unconscious",
    "not moving": "unconscious",
    "passed out": "unconscious",
    "fainted": "unconscious",
    "collapsed": "unconscious",
    "coma": "unconscious",
    "sleeping": "unconscious",
    "disoriented": "impaired",
    "dazed": "impaired",
    "confused": "impaired",
}

# Injury side keywords
SIDE_KEYWORDS = {
    "left arm": "left",
    "left hand": "left",
    "left leg": "left",
    "left side": "left",
    "left head": "left",
    "right arm": "right",
    "right hand": "right",
    "right leg": "right",
    "right side": "right",
    "right head": "right",
    "left chest": "left",
    "right chest": "right",
}


def _extract_consciousness_state(text: str) -> Optional[str]:
    """Extract consciousness state from text.

    Checks negative/unconscious keywords first to avoid substring matches
    (e.g. 'unconscious' contains 'conscious').
    """
    text_lower = text.lower()
    # Check negative states first (longer, more specific keywords)
    negative_first = [
        ("unconscious", "unconscious"),
        ("not responsive", "unconscious"),
        ("no response", "unconscious"),
        ("not moving", "unconscious"),
        ("passed out", "unconscious"),
        ("fainted", "unconscious"),
        ("collapsed", "unconscious"),
        ("coma", "unconscious"),
        ("sleeping", "unconscious"),
        ("disoriented", "impaired"),
        ("dazed", "impaired"),
        ("confused", "impaired"),
        ("conscious", "conscious"),
        ("awake", "conscious"),
        ("responsive", "conscious"),
        ("alert", "conscious"),
        ("talking", "conscious"),
    ]
    for keyword, state in negative_first:
        if keyword in text_lower:
            return state
    return None


def _extract_injury_side(text: str) -> Optional[str]:
    """Extract injury side from text."""
    text_lower = text.lower()
    for keyword, side in SIDE_KEYWORDS.items():
        if keyword in text_lower:
            return side
    return None


def _extract_patient_count(text: str) -> Optional[int]:
    """Extract number of patients mentioned."""
    text_lower = text.lower()
    patterns = [
        (r"(\d+)\s*(?:people|persons?|patients?|victims?|injured)", True),
        (r"two\s+(?:people|persons?|patients?)", True),
        (r"three\s+(?:people|persons?|patients?)", True),
        (r"(?:a|one|1)\s*(?:person|patient|victim)", True),
    ]
    for pattern, _ in patterns:
        match = re.search(pattern, text_lower)
        if match:
            if "two" in text_lower:
                return 2
            if "three" in text_lower:
                return 3
            try:
                return int(match.group(1))
            except (IndexError, ValueError):
                return 1
    return None


def _extract_time_references(text: str) -> list[str]:
    """Extract time references from text."""
    text_lower = text.lower()
    time_patterns = [
        r"(\d+)\s*(?:minutes?|mins?)\s*(?:ago|back)",
        r"(\d+)\s*(?:hours?|hrs?)\s*(?:ago|back)",
        r"just\s*(?:now|happened)",
        r"few\s*minutes?\s*ago",
        r"half\s*(?:an?\s*)?hour\s*ago",
    ]
    found = []
    for pattern in time_patterns:
        matches = re.findall(pattern, text_lower)
        found.extend(matches)
    return found


def detect_contradictions(
    inp: TriageInput,
    output: TriageOutput,
) -> list[Contradiction]:
    """Detect contradictions between input text and triage output.

    Cross-checks structured fields deterministically.
    """
    contradictions: list[Contradiction] = []

    if not inp.raw_text:
        return contradictions

    # 1. Consciousness cross-check
    input_consciousness = _extract_consciousness_state(inp.raw_text)
    output_vitals = " ".join(output.medical_context.vitals_mentioned).lower()
    output_symptoms = " ".join(output.medical_context.symptoms).lower()
    combined_output = f"{output_vitals} {output_symptoms}"

    output_consciousness = _extract_consciousness_state(combined_output)
    if (
        input_consciousness
        and output_consciousness
        and input_consciousness != output_consciousness
    ):
        contradictions.append(
            Contradiction(
                field_name="consciousness",
                fact_a=f"Input states: person is {input_consciousness}",
                fact_b=f"AI assessment: person appears {output_consciousness}",
                description=(
                    f"You described the person as {input_consciousness}, but the AI "
                    f"assessment suggests {output_consciousness}. This needs confirmation."
                ),
                confirm_back_question=(
                    f"You said the person is {input_consciousness}. Is that still "
                    f"accurate, or has their condition changed?"
                ),
            )
        )

    # 2. Injury side cross-check
    input_side = _extract_injury_side(inp.raw_text)
    # Check if output contradicts the side (e.g., mentions opposite side)
    if input_side:
        opposite = "right" if input_side == "left" else "left"
        if opposite in combined_output and input_side not in combined_output:
            contradictions.append(
                Contradiction(
                    field_name="injury_side",
                    fact_a=f"Injury on {input_side} side (from input)",
                    fact_b=f"AI assessment mentions {opposite} side",
                    description=(
                        f"Input indicates injury on the {input_side} side, but "
                        f"the AI assessment references the {opposite} side."
                    ),
                    confirm_back_question=(
                        f"You mentioned an injury on the {input_side} side. "
                        f"Can you confirm which side is affected?"
                    ),
                )
            )

    # 3. Patient count cross-check
    input_count = _extract_patient_count(inp.raw_text)
    if input_count and input_count > 1:
        # Check if triage output only mentions singular
        headline_singular = not any(
            w in output.headline.lower()
            for w in ["multiple", "several", "patients", "victims", "people"]
        )
        if headline_singular and len(output.noise_filtered) <= 2:
            contradictions.append(
                Contradiction(
                    field_name="patient_count",
                    fact_a=f"Input mentions {input_count} patients",
                    fact_b="Triage output focuses on single patient",
                    description=(
                        f"Input describes {input_count} people involved, but "
                        f"the triage focuses on a single patient."
                    ),
                    confirm_back_question=(
                        f"You mentioned {input_count} people. How many actually "
                        f"need medical attention right now?"
                    ),
                )
            )

    # 4. Time reference cross-check
    time_refs = _extract_time_references(inp.raw_text)
    if time_refs and output.severity == "P4_LOW":
        contradictions.append(
            Contradiction(
                field_name="timing_severity",
                fact_a=f"Input mentions event happened {' '.join(time_refs)}",
                fact_b="Severity rated as P4_LOW (minor)",
                description=(
                    "The timing suggests this may be more recent/urgent than "
                    "the severity level indicates."
                ),
                confirm_back_question=(
                    "When exactly did this happen? The timing might change "
                    "the urgency level."
                ),
            )
        )

    return contradictions


def apply_contradictions_to_verification(
    contradictions: list[Contradiction],
    verification_status: str,
    existing_contradictions: list[str],
) -> tuple[str, list[str], Optional[str]]:
    """Apply detected contradictions to the verification result.

    Returns (new_status, updated_contradictions_list, confirm_back_question).
    """
    if not contradictions:
        return verification_status, existing_contradictions, None

    updated = list(existing_contradictions)
    for c in contradictions:
        desc = f"{c.field_name}: {c.description}"
        if desc not in updated:
            updated.append(desc)

    # Use the first contradiction's confirm_back_question
    question = contradictions[0].confirm_back_question

    # Any contradiction forces CONFLICT status
    return "CONFLICT", updated, question
