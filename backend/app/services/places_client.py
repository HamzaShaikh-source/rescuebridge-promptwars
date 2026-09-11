"""Google Maps Places client — nearest 24/7 ER / trauma centre lookup.

Degrades gracefully when GOOGLE_MAPS_API_KEY is absent: returns empty list, never blocks.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import get_settings
from app.models.schemas import GeoLocation, NearbyPlace

logger = logging.getLogger(__name__)

# Emergency-relevant place types for Indian context
EMERGENCY_TYPES = "hospital|emergency_room|pharmacy"
EMERGENCY_KEYWORDS = ["emergency", "trauma", "hospital", "clinic", "24 hours"]


async def find_nearest_emergency_services(
    location: GeoLocation,
    radius_meters: int = 5000,
    max_results: int = 3,
) -> list[NearbyPlace]:
    """Find the nearest emergency services from user location.

    Returns empty list if API key is missing or request fails — never raises.
    """
    settings = get_settings()

    if not settings.GOOGLE_MAPS_API_KEY:
        logger.info("GOOGLE_MAPS_API_KEY not set — returning empty places list")
        return []

    try:
        return await _query_places_api(
            api_key=settings.GOOGLE_MAPS_API_KEY,
            location=location,
            radius=radius_meters,
            max_results=max_results,
        )
    except Exception:
        logger.exception("Places API request failed")
        return []


async def _query_places_api(
    api_key: str,
    location: GeoLocation,
    radius: int,
    max_results: int,
) -> list[NearbyPlace]:
    """Query Google Places Nearby Search API."""
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{location.lat},{location.lng}",
        "radius": radius,
        "type": EMERGENCY_TYPES,
        "key": api_key,
        "rankby": "distance",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "OK" and data.get("status") != "ZERO_RESULTS":
        logger.warning("Places API returned status: %s", data.get("status"))
        return []

    results = data.get("results", [])[:max_results]
    places: list[NearbyPlace] = []

    for r in results:
        geo = r.get("geometry", {}).get("location", {})
        lat, lng = geo.get("lat", 0), geo.get("lng", 0)
        dist = _haversine_distance(location.lat, location.lng, lat, lng)

        places.append(
            NearbyPlace(
                name=r.get("name", "Unknown"),
                address=r.get("vicinity", "No address"),
                distance_m=round(dist, 1),
                rating=r.get("rating"),
                open_now=r.get("opening_hours", {}).get("open_now"),
                phone=r.get("international_phone_number"),
                map_url=f"https://www.google.com/maps/place/?q=place_id:{r.get('place_id', '')}",
            )
        )

    return sorted(places, key=lambda p: p.distance_m)


def _haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in metres between two lat/lng points."""
    import math

    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
