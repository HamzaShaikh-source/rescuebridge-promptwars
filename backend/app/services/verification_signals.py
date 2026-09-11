"""Degradable external verification signal clients.

These provide supplementary data to the verification engine.
They are optional — core triage works without them.
Each returns empty results on failure, never blocking the pipeline.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.models.schemas import GeoLocation

logger = logging.getLogger(__name__)


async def get_weather_signal(location: GeoLocation) -> dict[str, Any]:
    """Fetch weather conditions as a verification signal.

    Uses wttr.in (free, no API key required) as a lightweight option.
    Returns empty dict on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"https://wttr.in/{location.lat},{location.lng}?format=j1"
            )
            resp.raise_for_status()
            data = resp.json()

        current = data.get("current_condition", [{}])[0]
        return {
            "condition": current.get("weatherDesc", [{}])[0].get("value", "unknown"),
            "temp_c": current.get("temp_C", "unknown"),
            "visibility_km": current.get("visibility", "unknown"),
            "wind_kmph": current.get("windspeedKmph", "unknown"),
        }
    except Exception:
        logger.debug("Weather signal unavailable")
        return {}


async def get_traffic_signal(location: GeoLocation) -> dict[str, Any]:
    """Fetch traffic density as a verification signal.

    Requires GOOGLE_MAPS_API_KEY. Returns empty dict if unconfigured or on failure.
    """
    from app.core.config import get_settings

    settings = get_settings()
    if not settings.GOOGLE_MAPS_API_KEY:
        return {}

    try:
        # Use Roads API traffic snapshot (simplified)
        url = "https://maps.googleapis.com/maps/api/traffic/snapshot"
        params = {
            "location": f"{location.lat},{location.lng}",
            "radius": 1000,
            "key": settings.GOOGLE_MAPS_API_KEY,
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        return {
            "available": True,
            "road": data.get("snappedPoints", [{}])[0]
            .get("placeId", "unknown"),
        }
    except Exception:
        logger.debug("Traffic signal unavailable")
        return {}


async def get_news_signal() -> dict[str, Any]:
    """Fetch recent emergency-related news headlines.

    Uses a lightweight RSS feed from a public source.
    Returns empty dict on failure.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # Google News RSS for India emergencies
            resp = await client.get(
                "https://news.google.com/rss/search?q=emergency+accident+india&hl=en-IN&gl=IN&ceid=IN:en",
                headers={"User-Agent": "RescueBridge/1.0"},
            )
            resp.raise_for_status()
            text = resp.text

        # Simple XML parsing for headlines
        headlines: list[str] = []
        import re

        for match in re.findall(r"<title><!\[CDATA\[(.*?)\]\]></title>", text):
            headlines.append(match)
            if len(headlines) >= 3:
                break

        return {"recent_headlines": headlines}
    except Exception:
        logger.debug("News signal unavailable")
        return {}


async def gather_verification_signals(
    location: Optional[GeoLocation] = None,
) -> dict[str, Any]:
    """Gather all available external verification signals.

    All signals are optional — failures are silently absorbed.
    Returns a dict with optional keys: weather, traffic, news.
    """
    signals: dict[str, Any] = {}

    if location:
        signals["weather"] = await get_weather_signal(location)
        signals["traffic"] = await get_traffic_signal(location)

    signals["news"] = await get_news_signal()

    return signals


def build_signal_verification(
    signals: dict[str, Any],
) -> dict[str, Any]:
    """Convert raw signal data into verification checks for the triage output."""
    checks: list[dict[str, str]] = []
    contradictions: list[str] = []
    uncertainties: list[str] = []

    weather = signals.get("weather")
    if weather:
        if weather.get("visibility_km") and weather["visibility_km"] != "unknown":
            vis = float(weather["visibility_km"])
            if vis < 1:
                contradictions.append(
                    "Very low visibility reported by weather data — "
                    "may impact rescue access"
                )
            checks.append(
                {
                    "source": "weather_signal",
                    "result": f"Visibility {weather['visibility_km']}km, "
                    f"conditions: {weather.get('condition', 'unknown')}",
                }
            )
        else:
            uncertainties.append("Weather visibility data unavailable")

    traffic = signals.get("traffic")
    if traffic:
        checks.append(
            {
                "source": "traffic_signal",
                "result": "Traffic data retrieved for incident area",
            }
        )
    else:
        uncertainties.append("Traffic data unavailable")

    news = signals.get("news")
    if news and news.get("recent_headlines"):
        checks.append(
            {
                "source": "news_signal",
                "result": f"Found {len(news['recent_headlines'])} recent emergency headlines",
            }
        )
    else:
        uncertainties.append("News signal unavailable")

    return {
        "checks_done": checks,
        "contradictions": contradictions,
        "uncertainties": uncertainties,
    }
