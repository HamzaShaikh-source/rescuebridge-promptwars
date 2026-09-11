"""Google Maps Places client — nearest ER / trauma / category lookup.

Degrades gracefully when GOOGLE_MAPS_API_KEY is absent: returns a
deterministic MOCK list (clearly labelled source="mock") so the resources
page still demoes, and never blocks.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import get_settings
from app.models.schemas import GeoLocation, NearbyPlace, PlaceCategory, PlaceResult

logger = logging.getLogger(__name__)

# Emergency-relevant place types for Indian context
EMERGENCY_TYPES = "hospital|emergency_room|pharmacy"
EMERGENCY_KEYWORDS = ["emergency", "trauma", "hospital", "clinic", "24 hours"]

# Category → Google Places Nearby Search params
CATEGORY_QUERY: dict[PlaceCategory, dict[str, str]] = {
    PlaceCategory.HOSPITAL: {"type": "hospital", "keyword": "emergency"},
    PlaceCategory.BLOOD_BANK: {"type": "hospital", "keyword": "blood bank"},
    PlaceCategory.PHARMACY: {"type": "pharmacy", "keyword": "24 hours"},
    PlaceCategory.POLICE: {"type": "police", "keyword": ""},
    PlaceCategory.FUEL: {"type": "gas_station", "keyword": ""},
    PlaceCategory.AMBULANCE: {"type": "hospital", "keyword": "ambulance service"},
}

# Deterministic mock results (labelled source="mock") so the demo works without a key
MOCK_PLACES: dict[PlaceCategory, list[dict]] = {
    PlaceCategory.HOSPITAL: [
        {"name": "City General Hospital", "address": "Near 5th Main, Shanti Nagar", "distance_m": 1200, "open_now_24h": True, "phone": "+91 80 22660000"},
        {"name": "St. Mary's Trauma Centre", "address": "Ring Road, Jayanagar", "distance_m": 3100, "open_now_24h": True, "phone": "+91 80 26554444"},
        {"name": "Mission District ER", "address": "MG Road, Richmond Town", "distance_m": 5400, "open_now_24h": False, "phone": "+91 80 41470000"},
    ],
    PlaceCategory.BLOOD_BANK: [
        {"name": "Red Cross Blood Bank", "address": "Central Ave, City", "distance_m": 900, "open_now_24h": False, "phone": "+91 80 41110000"},
        {"name": "LifeLine Blood Centre", "address": "2nd Cross, Basavanagudi", "distance_m": 2400, "open_now_24h": False, "phone": "+91 80 26561122"},
        {"name": "Jeevan Blood Bank", "address": "Victoria Road, Cantonment", "distance_m": 4600, "open_now_24h": False, "phone": "+91 80 25380000"},
    ],
    PlaceCategory.PHARMACY: [
        {"name": "MedPlus 24x7", "address": "5th Main Road, Shanti Nagar", "distance_m": 400, "open_now_24h": True, "phone": "+91 80 41662233"},
        {"name": "Apollo Pharmacy", "address": "Near Clock Tower, City Centre", "distance_m": 1500, "open_now_24h": True, "phone": "+91 80 22554433"},
        {"name": "Wells Pharmacy", "address": "Green Park, Vineet Nagar", "distance_m": 2800, "open_now_24h": False, "phone": "+91 80 24110011"},
    ],
    PlaceCategory.POLICE: [
        {"name": "City Police Station", "address": "Main Bazaar, City Centre", "distance_m": 1100, "open_now_24h": True, "phone": "112"},
        {"name": "Traffic Police HQ", "address": "Infantry Road", "distance_m": 3300, "open_now_24h": True, "phone": "+91 80 22942800"},
        {"name": "Woman's Police Station", "address": "Queens Road", "distance_m": 4100, "open_now_24h": True, "phone": "+91 80 22260011"},
    ],
    PlaceCategory.FUEL: [
        {"name": "IndianOil Petrol Pump", "address": "Outer Ring Road", "distance_m": 800, "open_now_24h": True, "phone": "+91 80 41112233"},
        {"name": "Bharat Petroleum", "address": "NH-44 Service Lane", "distance_m": 1900, "open_now_24h": True, "phone": "+91 80 23310022"},
        {"name": "HP Gas Station", "address": "Siddapura Main Road", "distance_m": 3600, "open_now_24h": False, "phone": "+91 80 25550099"},
    ],
    PlaceCategory.AMBULANCE: [
        {"name": "108 Ambulance Dispatch", "address": "State ERSS, Response Base 4", "distance_m": 100, "open_now_24h": True, "phone": "108"},
        {"name": "LifeCare Ambulance Service", "address": "Hospital Road", "distance_m": 2100, "open_now_24h": True, "phone": "+91 80 22447711"},
        {"name": "Trauma Rescue Ambulance", "address": "KIADB Industrial Area", "distance_m": 5200, "open_now_24h": True, "phone": "+91 80 26885566"},
    ],
}


def _mock_category_places(category: PlaceCategory, location: GeoLocation) -> list[PlaceResult]:
    """Deterministic mock results — never raises, clearly labelled source='mock'."""
    results: list[PlaceResult] = []
    for i, item in enumerate(MOCK_PLACES.get(category, [])):
        # Fictional small lat/lng jitter so distances vary around the user
        offset = {0: 0.009, 1: 0.028, 2: 0.048}.get(i, 0.04)
        lat = location.lat + offset
        lng = location.lng + offset
        dist = _haversine_distance(location.lat, location.lng, lat, lng)
        results.append(
            PlaceResult(
                name=item["name"],
                category=category,
                address=item["address"],
                distance_m=round(dist, 1),
                walk_min=max(1, int(dist / 80)),
                drive_min=max(1, int(dist / 400)),
                open_now_24h=item["open_now_24h"],
                phone=item["phone"],
                map_url=f"https://www.google.com/maps/search/?api=1&query={lat},{lng}",
                source="mock",
            )
        )
    return results


async def find_category_places(
    location: GeoLocation,
    category: PlaceCategory,
    max_results: int = 5,
) -> list[PlaceResult]:
    """Find the nearest places for a supported category.

    Uses Google Places when GOOGLE_MAPS_API_KEY is set; otherwise returns
    clearly-labelled deterministic mock data for the demo flow.
    """
    settings = get_settings()

    if not settings.GOOGLE_MAPS_API_KEY:
        logger.info("GOOGLE_MAPS_API_KEY not set — returning mock places for %s", category.value)
        return _mock_category_places(category, location)[:max_results]

    try:
        return await _query_category_places(
            api_key=settings.GOOGLE_MAPS_API_KEY,
            location=location,
            category=category,
            max_results=max_results,
        )
    except Exception:
        logger.exception("Places API request failed — falling back to mock")
        return _mock_category_places(category, location)[:max_results]


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


async def _query_category_places(
    api_key: str,
    location: GeoLocation,
    category: PlaceCategory,
    max_results: int,
) -> list[PlaceResult]:
    """Query Google Places Nearby Search with per-category type+keyword."""
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    cfg = CATEGORY_QUERY[category]
    params: dict[str, str] = {
        "location": f"{location.lat},{location.lng}",
        "radius": "5000",
        "key": api_key,
        "rankby": "distance",
    }
    if cfg["type"]:
        params["type"] = cfg["type"]
    if cfg["keyword"]:
        params["keyword"] = cfg["keyword"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != "OK" and data.get("status") != "ZERO_RESULTS":
        logger.warning("Places API returned status: %s", data.get("status"))
        return []

    results = data.get("results", [])[:max_results]
    places: list[PlaceResult] = []
    for r in results:
        geo = r.get("geometry", {}).get("location", {})
        lat, lng = geo.get("lat", 0), geo.get("lng", 0)
        dist = _haversine_distance(location.lat, location.lng, lat, lng)
        places.append(
            PlaceResult(
                name=r.get("name", "Unknown"),
                category=category,
                address=r.get("vicinity", "No address"),
                distance_m=round(dist, 1),
                walk_min=max(1, int(dist / 80)),
                drive_min=max(1, int(dist / 400)),
                open_now_24h=r.get("opening_hours", {}).get("open_now"),
                phone=r.get("international_phone_number"),
                map_url=f"https://www.google.com/maps/place/?q=place_id:{r.get('place_id', '')}",
                source="google",
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
