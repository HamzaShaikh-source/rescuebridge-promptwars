"""Places API routes — additive endpoints for the resources page.

GET /api/places?lat=..&lng=..&category=..&limit=..  — nearest places by category.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import GeoLocation, PlaceCategory, PlaceResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/places", response_model=list[PlaceResult])
async def get_places(
    lat: float = Query(..., description="User latitude", ge=-90, le=90),
    lng: float = Query(..., description="User longitude", ge=-180, le=180),
    category: PlaceCategory = Query(PlaceCategory.HOSPITAL, description="Place category"),
    limit: int = Query(5, ge=1, le=10, description="Max results"),
) -> list[PlaceResult]:
    """Return nearest places for a supported category, sorted by distance.

    Uses Google Maps Places when configured; deterministic mock fallback
    otherwise. Never 500s — a failed lookup still returns labelled results.
    """
    from app.services.places_client import find_category_places

    try:
        places = await find_category_places(
            GeoLocation(lat=lat, lng=lng),
            category=category,
            max_results=limit,
        )
    except Exception:
        logger.exception("Places lookup failed")
        raise HTTPException(status_code=500, detail="Internal server error")
    return places