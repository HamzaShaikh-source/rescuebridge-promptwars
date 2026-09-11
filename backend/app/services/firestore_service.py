"""Firestore persistence layer — with in-memory fallback for local development.

When FIRESTORE_PROJECT_ID and FIRESTORE_CREDENTIALS_PATH are set, uses
Google Cloud Firestore. Otherwise, stores in memory (data lost on restart).
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.config import get_settings
from app.models.schemas import IncidentRecord, Severity, VerificationStatus

logger = logging.getLogger(__name__)

# In-memory store for local dev (ordered, max 100 entries)
_memory_store: OrderedDict[str, dict[str, Any]] = OrderedDict()
MAX_MEMORY_RECORDS = 100


def _is_firestore_available() -> bool:
    settings = get_settings()
    return bool(settings.FIRESTORE_PROJECT_ID and settings.FIRESTORE_CREDENTIALS_PATH)


async def save_incident(record: dict[str, Any]) -> str:
    """Persist an incident record and return its ID.

    Falls back to in-memory store when Firestore is unavailable.
    """
    if _is_firestore_available():
        return await _save_to_firestore(record)
    return _save_to_memory(record)


async def get_recent_incidents(limit: int = 20) -> list[dict[str, Any]]:
    """Retrieve the most recent incident records (newest first)."""
    if _is_firestore_available():
        return await _get_from_firestore(limit)
    return _get_from_memory(limit)


async def get_incident_by_id(incident_id: str) -> Optional[dict[str, Any]]:
    """Retrieve a single incident by ID."""
    if _is_firestore_available():
        return await _get_by_id_firestore(incident_id)
    return _memory_store.get(incident_id)


def _save_to_memory(record: dict[str, Any]) -> str:
    """Store incident in memory."""
    record_id = record.get("id", str(len(_memory_store)))
    _memory_store[record_id] = record
    # Evict oldest if over limit
    while len(_memory_store) > MAX_MEMORY_RECORDS:
        _memory_store.popitem(last=False)
    return record_id


def _get_from_memory(limit: int = 20) -> list[dict[str, Any]]:
    """Get recent incidents from memory (newest first)."""
    items = list(_memory_store.items())
    items.reverse()  # newest first
    return [item[1] for item in items[:limit]]


async def _save_to_firestore(record: dict[str, Any]) -> str:
    """Save to Google Cloud Firestore."""
    try:
        from google.cloud import firestore  # type: ignore[import-untyped]

        settings = get_settings()
        db = firestore.Client(project=settings.FIRESTORE_PROJECT_ID)
        doc_ref = db.collection("emergency_incidents").document(record["id"])
        doc_ref.set(record)
        return record["id"]
    except Exception:
        logger.exception("Firestore save failed — falling back to memory")
        return _save_to_memory(record)


async def _get_from_firestore(limit: int = 20) -> list[dict[str, Any]]:
    """Query recent incidents from Firestore."""
    try:
        from google.cloud import firestore  # type: ignore[import-untyped]

        settings = get_settings()
        db = firestore.Client(project=settings.FIRESTORE_PROJECT_ID)
        docs = (
            db.collection("emergency_incidents")
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception:
        logger.exception("Firestore query failed — falling back to memory")
        return _get_from_memory(limit)


async def _get_by_id_firestore(incident_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single incident from Firestore by ID."""
    try:
        from google.cloud import firestore  # type: ignore[import-untyped]

        settings = get_settings()
        db = firestore.Client(project=settings.FIRESTORE_PROJECT_ID)
        doc = db.collection("emergency_incidents").document(incident_id).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception:
        logger.exception("Firestore get failed — falling back to memory")
        return _memory_store.get(incident_id)
