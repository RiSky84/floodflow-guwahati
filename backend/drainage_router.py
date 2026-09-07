import time
from typing import Any

import requests
from fastapi import APIRouter, HTTPException


router = APIRouter()

# Guwahati prototype bounding box.
SOUTH = 26.06
WEST = 91.60
NORTH = 26.24
EAST = 91.92

# Public Overpass instances can occasionally be busy.
# The backend tries more than one instead of making the
# browser depend on a single public server.
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.maprva.org/api/interpreter",
]

CACHE_SECONDS = 15 * 60

_cache: dict[str, Any] = {
    "saved_at": 0.0,
    "payload": None,
}


def build_query() -> str:
    bbox = f"{SOUTH},{WEST},{NORTH},{EAST}"

    return f"""
[out:json][timeout:25];
(
  way["waterway"="drain"]({bbox});
  way["waterway"="ditch"]({bbox});
  way["waterway"="canal"]({bbox});
);
out tags geom;
"""


def convert_elements(data: dict) -> list[dict]:
    features = []

    for element in data.get("elements", []):
        if element.get("type") != "way":
            continue

        geometry = element.get("geometry") or []

        if len(geometry) < 2:
            continue

        tags = element.get("tags") or {}

        coordinates = [
            [point["lon"], point["lat"]]
            for point in geometry
            if "lon" in point and "lat" in point
        ]

        if len(coordinates) < 2:
            continue

        features.append(
            {
                "id": element.get("id"),
                "type": tags.get(
                    "waterway",
                    "waterway",
                ),
                "name": tags.get(
                    "name",
                    "",
                ),
                "width": tags.get(
                    "width",
                    "",
                ),
                "intermittent": tags.get(
                    "intermittent",
                    "",
                ),
                "coordinates": coordinates,
            }
        )

    return features


@router.get("/api/drainage")
def get_drainage():
    now = time.time()

    cached_payload = _cache.get("payload")

    if (
        cached_payload is not None
        and now - _cache["saved_at"]
        < CACHE_SECONDS
    ):
        return {
            **cached_payload,
            "cache": "hit",
        }

    query = build_query()
    errors = []

    headers = {
        "User-Agent":
            "FloodFlow-Guwahati-SIH/0.1 "
            "(educational prototype)",
        "Accept": "application/json",
    }

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            response = requests.post(
                endpoint,
                data={"data": query},
                headers=headers,
                timeout=35,
            )

            response.raise_for_status()

            data = response.json()

            features = convert_elements(data)

            payload = {
                "source":
                    "OpenStreetMap / Overpass API",
                "provider_endpoint":
                    endpoint,
                "bbox": {
                    "south": SOUTH,
                    "west": WEST,
                    "north": NORTH,
                    "east": EAST,
                },
                "features": features,
            }

            _cache["saved_at"] = now
            _cache["payload"] = payload

            return {
                **payload,
                "cache": "miss",
            }

        except Exception as error:
            errors.append(
                f"{endpoint}: {error}"
            )

    # If the live refresh failed but an older cache exists,
    # keep the UI useful and clearly identify it as stale.
    if cached_payload is not None:
        return {
            **cached_payload,
            "cache": "stale",
            "warning":
                "Live Overpass refresh failed; "
                "showing the last cached drainage data.",
        }

    raise HTTPException(
        status_code=503,
        detail=(
            "All public Overpass drainage "
            "providers are temporarily unavailable."
        ),
    )
