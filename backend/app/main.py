"""FastAPI application — RescueBridge backend API."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.places_routes import router as places_router
from app.api.triage_routes import router as triage_router
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="RescueBridge API",
    description=(
        "Gemini-powered verified emergency triage assistant. "
        "Accepts messy multi-modal inputs and produces structured, "
        "verified triage packets with handoff data for 112 dispatchers."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — configured via CORS_ORIGINS env var (comma-separated)
_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(triage_router, prefix="/api")
app.include_router(places_router, prefix="/api")


@app.get("/api/health")
async def health_check() -> dict:
    """Cloud Run / kubernetes health check endpoint."""
    s = get_settings()
    return {
        "status": "ok",
        "gemini_configured": bool(s.GEMINI_API_KEY),
        "maps_configured": bool(s.GOOGLE_MAPS_API_KEY),
        "firestore_configured": bool(s.FIRESTORE_PROJECT_ID),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }


@app.get("/")
async def root() -> dict:
    """Root endpoint — API info."""
    return {
        "service": "RescueBridge API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/api/health",
    }
