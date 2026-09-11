"""Lifecycle state machine — valid transitions and ledger management.

Incident lifecycle: DRAFT → VERIFIED → SENT → ACKNOWLEDGED → ASSIGNED → ARRIVING → CLOSED
Failure states: NO_ACK, REJECTED, STALE_LOCATION
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.schemas import LifecycleEntry, LifecycleState


# Valid transitions: from_state → set of allowed to_states
VALID_TRANSITIONS: dict[LifecycleState, set[LifecycleState]] = {
    LifecycleState.DRAFT: {
        LifecycleState.VERIFIED,
        LifecycleState.REJECTED,
    },
    LifecycleState.VERIFIED: {
        LifecycleState.SENT,
        LifecycleState.REJECTED,
    },
    LifecycleState.SENT: {
        LifecycleState.ACKNOWLEDGED,
        LifecycleState.NO_ACK,
        LifecycleState.STALE_LOCATION,
    },
    LifecycleState.ACKNOWLEDGED: {
        LifecycleState.ASSIGNED,
        LifecycleState.REJECTED,
    },
    LifecycleState.ASSIGNED: {
        LifecycleState.ARRIVING,
        LifecycleState.REJECTED,
    },
    LifecycleState.ARRIVING: {
        LifecycleState.CLOSED,
        LifecycleState.STALE_LOCATION,
    },
    # Terminal states — no transitions out
    LifecycleState.CLOSED: set(),
    LifecycleState.NO_ACK: set(),
    LifecycleState.REJECTED: set(),
    LifecycleState.STALE_LOCATION: set(),
}


class InvalidTransitionError(Exception):
    """Raised when a lifecycle transition is not allowed."""

    def __init__(self, from_state: LifecycleState, to_state: LifecycleState) -> None:
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(
            f"Invalid transition: {from_state.value} → {to_state.value}. "
            f"Allowed: {[s.value for s in VALID_TRANSITIONS.get(from_state, set())]}"
        )


def is_valid_transition(from_state: LifecycleState, to_state: LifecycleState) -> bool:
    """Check whether a transition is allowed."""
    return to_state in VALID_TRANSITIONS.get(from_state, set())


def advance_lifecycle(
    current_state: LifecycleState,
    to_state: LifecycleState,
    actor: str = "system",
    evidence: str = "",
) -> tuple[LifecycleState, LifecycleEntry]:
    """Advance to a new state if valid. Returns (new_state, ledger_entry).

    Raises InvalidTransitionError if the jump is illegal.
    """
    if not is_valid_transition(current_state, to_state):
        raise InvalidTransitionError(current_state, to_state)

    entry = LifecycleEntry(
        state=to_state,
        actor=actor,
        timestamp=datetime.now(timezone.utc).isoformat(),
        evidence=evidence,
    )
    return to_state, entry


def create_initial_ledger(incident_id: str) -> list[LifecycleEntry]:
    """Create the initial DRAFT entry for a new incident."""
    return [
        LifecycleEntry(
            state=LifecycleState.DRAFT,
            actor="system",
            timestamp=datetime.now(timezone.utc).isoformat(),
            evidence=f"Incident {incident_id} created via triage pipeline",
        )
    ]
