import sqlite3
import os
import math
import time
import secrets
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from datetime import datetime, timedelta
from typing import Literal

import requests
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ==========================================================
# APP
# ==========================================================

app = FastAPI(
    title="FloodFlow Guwahati API"
)


# ==========================================================
# CORS
# ==========================================================

DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://floodflow.netlify.app",
]

extra_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        ""
    ).split(",")
    if origin.strip()
]

ALLOWED_FRONTEND_ORIGINS = list(
    dict.fromkeys(
        DEFAULT_FRONTEND_ORIGINS
        + extra_origins
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=
        ALLOWED_FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================================
# BASIC ROUTES
# ==========================================================

@app.get("/")
def home():
    return {
        "project": "FloodFlow Guwahati",
        "status": "running",
        "frontend":
            "https://floodflow.netlify.app",
        "docs": "/docs"
    }


@app.get("/api/test")
def test():
    return {
        "message": "Backend connected successfully"
    }


# ==========================================================
# WEATHER
# ==========================================================

@app.get("/api/weather")
def get_weather(
    lat: float = 26.1445,
    lon: float = 91.7362
):
    url = "https://api.open-meteo.com/v1/forecast"

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "rain"
        ),
        "hourly": "precipitation",
        "past_days": 1,
        "forecast_days": 1,
        "timezone": "Asia/Kolkata"
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        response.raise_for_status()
        data = response.json()

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Weather service error: {error}"
        )

    current = data.get("current", {})
    hourly = data.get("hourly", {})

    times = hourly.get("time", [])
    precipitation = hourly.get("precipitation", [])

    rainfall_24h = 0.0
    current_time_text = current.get("time")

    if current_time_text:
        current_time = datetime.fromisoformat(
            current_time_text
        )

        start_time = current_time - timedelta(
            hours=24
        )

        for time_text, rain_value in zip(
            times,
            precipitation
        ):
            timestamp = datetime.fromisoformat(
                time_text
            )

            if start_time < timestamp <= current_time:
                rainfall_24h += rain_value or 0

    return {
        "location": "Guwahati",
        "latitude": lat,
        "longitude": lon,
        "temperature_c":
            current.get("temperature_2m"),
        "humidity_percent":
            current.get("relative_humidity_2m"),
        "current_precipitation_mm":
            current.get("precipitation"),
        "current_rain_mm":
            current.get("rain"),
        "rainfall_24h_mm":
            round(rainfall_24h, 2),
        "updated_at":
            current.get("time"),
        "data_source":
            "Open-Meteo",
        "data_type":
            "weather model data"
    }


# ==========================================================
# RIVER DISCHARGE
# ==========================================================

@app.get("/api/river")
def get_river(
    lat: float = 26.18,
    lon: float = 91.74
):
    url = "https://flood-api.open-meteo.com/v1/flood"

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "river_discharge",
        "forecast_days": 7
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=15
        )

        response.raise_for_status()
        data = response.json()

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"River service error: {error}"
        )

    daily = data.get("daily", {})

    dates = daily.get("time", [])
    discharge = daily.get(
        "river_discharge",
        []
    )

    today_discharge = None

    if discharge:
        today_discharge = discharge[0]

    return {
        "river": "Brahmaputra",
        "location": "Guwahati",
        "latitude": lat,
        "longitude": lon,
        "today_discharge_m3s":
            today_discharge,
        "forecast_dates":
            dates,
        "forecast_discharge_m3s":
            discharge,
        "source":
            "Open-Meteo Flood API / GloFAS",
        "data_type":
            "modelled river discharge",
        "note":
            "Modelled discharge only; not official CWC gauge height."
    }


# ==========================================================
# OSM DRAINAGE / OVERPASS
# ==========================================================

SOUTH = 26.06
WEST = 91.60
NORTH = 26.24
EAST = 91.92

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.maprva.org/api/interpreter",
]

DRAINAGE_CACHE_SECONDS = 15 * 60

drainage_cache = {
    "saved_at": 0.0,
    "payload": None,
}


def build_drainage_query():
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


def convert_drainage_elements(data):
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
                    "waterway"
                ),
                "name": tags.get(
                    "name",
                    ""
                ),
                "width": tags.get(
                    "width",
                    ""
                ),
                "intermittent": tags.get(
                    "intermittent",
                    ""
                ),
                "coordinates": coordinates,
            }
        )

    return features


@app.get("/api/drainage")
def get_drainage():
    now = time.time()

    cached_payload = drainage_cache.get("payload")

    if (
        cached_payload is not None
        and now - drainage_cache["saved_at"] < DRAINAGE_CACHE_SECONDS
    ):
        return {
            **cached_payload,
            "cache": "hit"
        }

    query = build_drainage_query()

    headers = {
        "User-Agent":
            "FloodFlow-Guwahati-SIH/0.1 "
            "(educational prototype)",
        "Accept": "application/json",
    }

    def fetch_endpoint(endpoint):
        response = requests.post(
            endpoint,
            data={"data": query},
            headers=headers,
            timeout=(5, 12),
        )

        response.raise_for_status()

        data = response.json()

        features = convert_drainage_elements(data)

        return endpoint, features

    errors = []

    with ThreadPoolExecutor(
        max_workers=len(OVERPASS_ENDPOINTS)
    ) as executor:
        futures = {
            executor.submit(
                fetch_endpoint,
                endpoint
            ): endpoint
            for endpoint in OVERPASS_ENDPOINTS
        }

        try:
            for future in as_completed(
                futures,
                timeout=15
            ):
                endpoint = futures[future]

                try:
                    provider, features = future.result()

                    payload = {
                        "source":
                            "OpenStreetMap / Overpass API",
                        "provider_endpoint":
                            provider,
                        "bbox": {
                            "south": SOUTH,
                            "west": WEST,
                            "north": NORTH,
                            "east": EAST,
                        },
                        "features": features,
                    }

                    drainage_cache["saved_at"] = now
                    drainage_cache["payload"] = payload

                    return {
                        **payload,
                        "cache": "miss"
                    }

                except Exception as error:
                    errors.append(
                        f"{endpoint}: {error}"
                    )

        except TimeoutError:
            errors.append(
                "Overpass providers exceeded "
                "the 15 second request window."
            )

        finally:
            for future in futures:
                future.cancel()

    if cached_payload is not None:
        return {
            **cached_payload,
            "cache": "stale",
            "warning":
                "Live Overpass refresh failed; "
                "showing cached drainage data."
        }

    raise HTTPException(
        status_code=503,
        detail=(
            "OSM drainage is temporarily unavailable. "
            "Public Overpass providers did not respond "
            "within 15 seconds."
        )
    )


# ==========================================================
# SMART ROUTING / PLACE SEARCH
# ==========================================================

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OSRM_URL = "https://router.project-osrm.org"

# Keep public Nominatim usage conservative.
# The public service requests no more than ~1 request/second.
NOMINATIM_LOCK = Lock()
NOMINATIM_LAST_REQUEST = 0.0
GEOCODE_CACHE_SECONDS = 60 * 60
GEOCODE_CACHE = {}

# Guwahati-focused search box.
GEOCODE_VIEWBOX = "91.55,26.30,92.05,25.95"


def nominatim_get(path, params):
    global NOMINATIM_LAST_REQUEST

    headers = {
        "User-Agent":
            "FloodFlow-Guwahati-SIH/0.1 "
            "(educational flood-routing prototype)",
        "Accept-Language": "en",
    }

    with NOMINATIM_LOCK:
        elapsed = (
            time.time()
            - NOMINATIM_LAST_REQUEST
        )

        if elapsed < 1.05:
            time.sleep(
                1.05 - elapsed
            )

        response = requests.get(
            f"{NOMINATIM_URL}{path}",
            params=params,
            headers=headers,
            timeout=15,
        )

        NOMINATIM_LAST_REQUEST = (
            time.time()
        )

    response.raise_for_status()

    return response.json()


@app.get("/api/geocode")
def geocode_place(q: str = ""):
    query = q.strip()

    if len(query) < 2:
        return {
            "results": []
        }

    cache_key = query.lower()

    cached = GEOCODE_CACHE.get(
        cache_key
    )

    now = time.time()

    if (
        cached
        and now - cached["saved_at"]
        < GEOCODE_CACHE_SECONDS
    ):
        return {
            "results":
                cached["results"],
            "cache": "hit",
        }

    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 6,
        "countrycodes": "in",
        "viewbox":
            GEOCODE_VIEWBOX,
        "bounded": 1,
    }

    try:
        data = nominatim_get(
            "/search",
            params
        )

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=(
                "Place search service "
                f"error: {error}"
            ),
        )

    results = []

    for item in data:
        try:
            lat = float(item["lat"])
            lng = float(item["lon"])
        except Exception:
            continue

        address = (
            item.get("address")
            or {}
        )

        short_name = (
            address.get("amenity")
            or address.get("building")
            or address.get("road")
            or address.get("suburb")
            or address.get("neighbourhood")
            or address.get("village")
            or address.get("town")
            or address.get("city")
            or item.get("name")
            or item.get(
                "display_name",
                "Destination",
            ).split(",")[0]
        )

        results.append(
            {
                "id":
                    item.get("place_id"),
                "name":
                    short_name,
                "label":
                    item.get(
                        "display_name",
                        short_name,
                    ),
                "lat": lat,
                "lng": lng,
                "category":
                    item.get("category"),
                "type":
                    item.get("type"),
            }
        )

    GEOCODE_CACHE[
        cache_key
    ] = {
        "saved_at": now,
        "results": results,
    }

    return {
        "results": results,
        "cache": "miss",
        "source":
            "OpenStreetMap Nominatim",
    }


def point_segment_distance_m(
    point_lat,
    point_lng,
    start_lat,
    start_lng,
    end_lat,
    end_lng,
):
    mean_lat = math.radians(
        (
            point_lat
            + start_lat
            + end_lat
        )
        / 3
    )

    meters_per_deg_lat = 111320.0
    meters_per_deg_lng = (
        111320.0
        * math.cos(mean_lat)
    )

    px = (
        point_lng - start_lng
    ) * meters_per_deg_lng

    py = (
        point_lat - start_lat
    ) * meters_per_deg_lat

    vx = (
        end_lng - start_lng
    ) * meters_per_deg_lng

    vy = (
        end_lat - start_lat
    ) * meters_per_deg_lat

    length_sq = vx * vx + vy * vy

    if length_sq == 0:
        return math.sqrt(
            px * px + py * py
        )

    t = max(
        0.0,
        min(
            1.0,
            (
                px * vx + py * vy
            )
            / length_sq,
        ),
    )

    dx = px - t * vx
    dy = py - t * vy

    return math.sqrt(
        dx * dx + dy * dy
    )


def parse_route_hazards(
    hazards_text,
):
    if not hazards_text:
        return []

    points = []

    for item in hazards_text.split(";"):
        try:
            parts = item.split(",")

            lat = float(parts[0])
            lng = float(parts[1])

            radius_m = (
                float(parts[2])
                if len(parts) >= 3
                else 300.0
            )

            if (
                25.8 <= lat <= 26.4
                and 91.4 <= lng <= 92.2
            ):
                points.append(
                    {
                        "lat": lat,
                        "lng": lng,
                        "radius_m":
                            max(
                                100.0,
                                min(
                                    radius_m,
                                    800.0,
                                ),
                            ),
                    }
                )

        except Exception:
            continue

    return points[:25]


def route_projection_fraction(
    point_lat,
    point_lng,
    start_lat,
    start_lng,
    end_lat,
    end_lng,
):
    mean_lat = math.radians(
        (
            point_lat +
            start_lat +
            end_lat
        ) / 3
    )

    meters_per_deg_lat = 111320.0
    meters_per_deg_lng = (
        111320.0 *
        math.cos(mean_lat)
    )

    px = (
        point_lng - start_lng
    ) * meters_per_deg_lng

    py = (
        point_lat - start_lat
    ) * meters_per_deg_lat

    vx = (
        end_lng - start_lng
    ) * meters_per_deg_lng

    vy = (
        end_lat - start_lat
    ) * meters_per_deg_lat

    length_sq = vx * vx + vy * vy

    if length_sq <= 0:
        return 0.0

    return max(
        0.0,
        min(
            1.0,
            (
                px * vx + py * vy
            )
            / length_sq,
        ),
    )


def make_bypass_pair(
    hazard,
    start_lat,
    start_lng,
    end_lat,
    end_lng,
    side,
):
    mean_lat = math.radians(
        hazard["lat"]
    )

    meters_per_deg_lat = 111320.0
    meters_per_deg_lng = (
        111320.0 *
        math.cos(mean_lat)
    )

    vx = (
        end_lng - start_lng
    ) * meters_per_deg_lng

    vy = (
        end_lat - start_lat
    ) * meters_per_deg_lat

    length = math.sqrt(
        vx * vx + vy * vy
    )

    if length < 1:
        return []

    ux = vx / length
    uy = vy / length

    # Perpendicular unit vector.
    px = -uy
    py = ux

    radius = float(
        hazard.get(
            "radius_m",
            300,
        )
    )

    # Two via points form a real bypass corridor.
    # The previous version used only one point,
    # allowing OSRM to cut straight back through
    # the hazard area afterwards.
    along_m = radius + 500
    offset_m = radius + 650

    points = []

    for along_sign in (-1, 1):
        dx = (
            ux *
            along_m *
            along_sign
            +
            px *
            offset_m *
            side
        )

        dy = (
            uy *
            along_m *
            along_sign
            +
            py *
            offset_m *
            side
        )

        points.append(
            {
                "lat":
                    hazard["lat"]
                    + dy /
                    meters_per_deg_lat,
                "lng":
                    hazard["lng"]
                    + dx /
                    meters_per_deg_lng,
            }
        )

    return points


def coordinate_distance_m(
    lat1,
    lng1,
    lat2,
    lng2,
):
    mean_lat = math.radians(
        (
            lat1 + lat2
        ) / 2
    )

    dy = (
        lat2 - lat1
    ) * 111320.0

    dx = (
        lng2 - lng1
    ) * (
        111320.0 *
        math.cos(mean_lat)
    )

    return math.sqrt(
        dx * dx +
        dy * dy
    )


def osrm_route_request(
    coordinate_string,
    alternatives,
):
    url = (
        f"{OSRM_URL}/route/v1/"
        f"driving/{coordinate_string}"
    )

    coordinate_parts = (
        coordinate_string.split(";")
    )

    # Stop OSRM from silently snapping a bad desktop
    # GPS position several kilometres away.
    # Start/end have a tighter limit; generated detour
    # via points get a little more room.
    if len(coordinate_parts) <= 2:
        radius_values = [
            "900",
            "900",
        ]
    else:
        radius_values = [
            "900",
            *(
                "1200"
                for _ in range(
                    len(coordinate_parts) - 2
                )
            ),
            "900",
        ]

    params = {
        "alternatives":
            "true"
            if alternatives
            else "false",
        "steps": "true",
        "overview": "full",
        "geometries": "geojson",
        "annotations":
            "duration,distance",
        "radiuses":
            ";".join(
                radius_values
            ),
    }

    headers = {
        "User-Agent":
            "FloodFlow-Guwahati-SIH/0.1 "
            "(educational flood-routing prototype)",
    }

    response = requests.get(
        url,
        params=params,
        headers=headers,
        timeout=20,
    )

    response.raise_for_status()

    data = response.json()

    if data.get("code") != "Ok":
        return []

    routes = data.get(
        "routes",
        [],
    )

    waypoints = data.get(
        "waypoints",
        [],
    )

    try:
        first_input_lng, first_input_lat = (
            map(
                float,
                coordinate_parts[0]
                    .split(",")
            )
        )

        last_input_lng, last_input_lat = (
            map(
                float,
                coordinate_parts[-1]
                    .split(",")
            )
        )

        if (
            len(waypoints) >= 2
            and waypoints[0].get(
                "location"
            )
            and waypoints[-1].get(
                "location"
            )
        ):
            start_lng, start_lat = (
                waypoints[0][
                    "location"
                ]
            )

            end_lng, end_lat = (
                waypoints[-1][
                    "location"
                ]
            )

            start_snap_m = (
                coordinate_distance_m(
                    first_input_lat,
                    first_input_lng,
                    start_lat,
                    start_lng,
                )
            )

            end_snap_m = (
                coordinate_distance_m(
                    last_input_lat,
                    last_input_lng,
                    end_lat,
                    end_lng,
                )
            )

            for route in routes:
                route[
                    "floodflow_snapped_start"
                ] = {
                    "lat": start_lat,
                    "lng": start_lng,
                }

                route[
                    "floodflow_snapped_end"
                ] = {
                    "lat": end_lat,
                    "lng": end_lng,
                }

                route[
                    "floodflow_start_snap_m"
                ] = round(
                    start_snap_m,
                    1,
                )

                route[
                    "floodflow_end_snap_m"
                ] = round(
                    end_snap_m,
                    1,
                )

    except Exception:
        pass

    return routes


def route_min_distance_to_hazard(
    route,
    hazard,
):
    geometry = route.get(
        "geometry"
    ) or {}

    coordinates = (
        geometry.get(
            "coordinates"
        ) or []
    )

    if len(coordinates) < 2:
        return float("inf")

    minimum = float("inf")

    for index in range(
        len(coordinates) - 1
    ):
        start_lng, start_lat = (
            coordinates[index]
        )

        end_lng, end_lat = (
            coordinates[index + 1]
        )

        distance = (
            point_segment_distance_m(
                hazard["lat"],
                hazard["lng"],
                start_lat,
                start_lng,
                end_lat,
                end_lng,
            )
        )

        minimum = min(
            minimum,
            distance,
        )

        if minimum <= 1:
            break

    return minimum


def tag_route_hazard_intersections(
    route,
    hazards,
):
    intersections = []

    for index, hazard in enumerate(
        hazards
    ):
        distance = (
            route_min_distance_to_hazard(
                route,
                hazard,
            )
        )

        if (
            distance <=
            hazard["radius_m"]
        ):
            intersections.append(
                {
                    "hazard_index":
                        index,
                    "distance_m":
                        round(
                            distance,
                            1,
                        ),
                    "radius_m":
                        hazard[
                            "radius_m"
                        ],
                }
            )

    route[
        "floodflow_hazard_intersections"
    ] = intersections

    route[
        "floodflow_safe_from_hazards"
    ] = (
        len(intersections) == 0
    )

    return route


@app.get("/api/route")
def get_smart_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    hazards: str = "",
):
    base_coordinates = (
        f"{start_lng},{start_lat};"
        f"{end_lng},{end_lat}"
    )

    all_routes = []

    try:
        all_routes.extend(
            osrm_route_request(
                base_coordinates,
                alternatives=True,
            )
        )

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=(
                "Road routing service "
                f"error: {error}"
            ),
        )

    hazard_points = (
        parse_route_hazards(
            hazards
        )
    )

    relevant_hazards = []

    for hazard in hazard_points:
        corridor_distance = (
            point_segment_distance_m(
                hazard["lat"],
                hazard["lng"],
                start_lat,
                start_lng,
                end_lat,
                end_lng,
            )
        )

        if (
            corridor_distance <=
            hazard["radius_m"] +
            1400
        ):
            relevant_hazards.append(
                {
                    **hazard,
                    "corridor_distance":
                        corridor_distance,
                    "route_fraction":
                        route_projection_fraction(
                            hazard["lat"],
                            hazard["lng"],
                            start_lat,
                            start_lng,
                            end_lat,
                            end_lng,
                        ),
                }
            )

    relevant_hazards.sort(
        key=lambda item:
            item["route_fraction"]
    )

    # Up to three current relevant hazards are bypassed.
    selected_hazards = (
        relevant_hazards[:3]
    )

    # Explore multiple sides of the flooded corridor.
    side_patterns = [
        [1, 1, 1],
        [-1, -1, -1],
        [1, -1, 1],
        [-1, 1, -1],
    ]

    for pattern in side_patterns:
        if not selected_hazards:
            break

        via_points = []

        for hazard_index, hazard in enumerate(
            selected_hazards
        ):
            side = pattern[
                hazard_index %
                len(pattern)
            ]

            via_points.extend(
                make_bypass_pair(
                    hazard,
                    start_lat,
                    start_lng,
                    end_lat,
                    end_lng,
                    side,
                )
            )

        if not via_points:
            continue

        coordinate_parts = [
            f"{start_lng},{start_lat}"
        ]

        coordinate_parts.extend(
            f"{point['lng']},{point['lat']}"
            for point in via_points
        )

        coordinate_parts.append(
            f"{end_lng},{end_lat}"
        )

        try:
            detour_routes = (
                osrm_route_request(
                    ";".join(
                        coordinate_parts
                    ),
                    alternatives=False,
                )
            )

            if detour_routes:
                route = detour_routes[0]

                route[
                    "floodflow_candidate"
                ] = "strict-flood-bypass"

                route[
                    "floodflow_via_count"
                ] = len(via_points)

                all_routes.append(
                    route
                )

        except Exception:
            continue

    if not all_routes:
        raise HTTPException(
            status_code=404,
            detail=(
                "No road route available "
                "for these points."
            ),
        )

    tagged_routes = [
        tag_route_hazard_intersections(
            route,
            hazard_points,
        )
        for route in all_routes
    ]

    unique_routes = []
    seen = set()

    for route in tagged_routes:
        geometry = route.get(
            "geometry"
        ) or {}

        coordinates = (
            geometry.get(
                "coordinates"
            ) or []
        )

        midpoint = (
            coordinates[
                len(coordinates) // 2
            ]
            if coordinates
            else [0, 0]
        )

        key = (
            round(
                float(
                    route.get(
                        "distance",
                        0,
                    )
                ) / 40
            ),
            round(
                float(
                    route.get(
                        "duration",
                        0,
                    )
                ) / 12
            ),
            round(
                float(midpoint[0]),
                3,
            ),
            round(
                float(midpoint[1]),
                3,
            ),
        )

        if key in seen:
            continue

        seen.add(key)
        unique_routes.append(
            route
        )

    # Hazard-free candidates are returned first.
    unique_routes.sort(
        key=lambda route: (
            len(
                route.get(
                    "floodflow_hazard_intersections",
                    [],
                )
            ),
            float(
                route.get(
                    "duration",
                    0,
                )
            ),
        )
    )

    return {
        "source":
            "OSRM / OpenStreetMap",
        "routes":
            unique_routes[:8],
        "candidate_count":
            len(unique_routes),
        "safe_candidate_count":
            sum(
                1
                for route in unique_routes
                if route.get(
                    "floodflow_safe_from_hazards"
                )
            ),
        "strict_bypass_candidates":
            sum(
                1
                for route in unique_routes
                if route.get(
                    "floodflow_candidate"
                )
                == "strict-flood-bypass"
            ),
        "live_hazards_received":
            len(hazard_points),
    }


# ==========================================================
# SQLITE DATABASE
# ==========================================================

DATABASE = "floodflow.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_column(conn, table_name, column_name, definition):
    columns = {
        row["name"]
        for row in conn.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()
    }

    if column_name not in columns:
        conn.execute(
            f"ALTER TABLE {table_name} "
            f"ADD COLUMN {column_name} {definition}"
        )


def create_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS flood_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            water_depth_cm REAL NOT NULL,
            road_status TEXT NOT NULL,
            locality TEXT,
            note TEXT,
            created_at TEXT NOT NULL,
            verified INTEGER DEFAULT 0,
            verification_status TEXT DEFAULT 'pending',
            verified_at TEXT,
            verification_note TEXT
        )
    """)

    # Safe migration for databases created by older FloodFlow builds.
    ensure_column(
        conn,
        "flood_reports",
        "verification_status",
        "TEXT DEFAULT 'pending'"
    )
    ensure_column(
        conn,
        "flood_reports",
        "verified_at",
        "TEXT"
    )
    ensure_column(
        conn,
        "flood_reports",
        "verification_note",
        "TEXT"
    )

    conn.execute("""
        UPDATE flood_reports
        SET verification_status = CASE
            WHEN verified = 1 THEN 'verified'
            ELSE COALESCE(verification_status, 'pending')
        END
        WHERE verification_status IS NULL
           OR verification_status = ''
    """)

    conn.commit()
    conn.close()


create_database()


# ==========================================================
# FLOOD REPORT MODEL
# ==========================================================

class FloodReport(BaseModel):
    latitude: float = Field(
        ge=-90,
        le=90
    )

    longitude: float = Field(
        ge=-180,
        le=180
    )

    water_depth_cm: float = Field(
        ge=0,
        le=500
    )

    road_status: Literal[
        "open",
        "caution",
        "blocked"
    ]

    locality: str = Field(
        default="",
        max_length=100
    )

    note: str = Field(
        default="",
        max_length=500
    )


# ==========================================================
# GET FLOOD REPORTS
# ==========================================================

def serialize_report(row):
    report = dict(row)

    try:
        created_at = datetime.fromisoformat(
            report["created_at"]
        )
        age_minutes = max(
            0,
            int(
                (datetime.now() - created_at)
                .total_seconds() / 60
            )
        )
    except Exception:
        age_minutes = None

    status = (
        report.get("verification_status")
        or (
            "verified"
            if report.get("verified")
            else "pending"
        )
    )

    report["verification_status"] = status
    report["verified"] = bool(
        report.get("verified")
    ) or status == "verified"
    report["age_minutes"] = age_minutes
    report["active"] = (
        status != "rejected"
        and (
            age_minutes is None
            or age_minutes <= 360
        )
    )

    return report


@app.get("/api/reports")
def get_reports():
    conn = get_db()

    rows = conn.execute("""
        SELECT *
        FROM flood_reports
        ORDER BY created_at DESC
        LIMIT 200
    """).fetchall()

    conn.close()

    return [
        serialize_report(row)
        for row in rows
    ]


# ==========================================================
# CREATE FLOOD REPORT
# ==========================================================

@app.post("/api/reports")
def create_report(
    report: FloodReport
):
    conn = get_db()

    cursor = conn.execute(
        """
        INSERT INTO flood_reports (
            latitude,
            longitude,
            water_depth_cm,
            road_status,
            locality,
            note,
            created_at,
            verified,
            verification_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            report.latitude,
            report.longitude,
            report.water_depth_cm,
            report.road_status,
            report.locality,
            report.note,
            datetime.now().isoformat(),
            0,
            "pending"
        )
    )

    conn.commit()

    report_id = cursor.lastrowid

    conn.close()

    return {
        "success": True,
        "report_id": report_id,
        "verification_status": "pending",
        "message":
            "Flood report submitted successfully"
    }


# ==========================================================
# REPORT VERIFICATION
# ==========================================================

class ReportVerification(BaseModel):
    status: Literal[
        "verified",
        "rejected"
    ]

    note: str = Field(
        default="",
        max_length=300
    )


def require_admin_key(admin_key):
    configured_key = os.getenv(
        "FLOODFLOW_ADMIN_KEY",
        ""
    ).strip()

    if not configured_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Report verification is not configured. "
                "Set FLOODFLOW_ADMIN_KEY on the backend."
            )
        )

    if not admin_key or not secrets.compare_digest(
        admin_key,
        configured_key
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid FloodFlow admin key"
        )


@app.patch("/api/reports/{report_id}/verify")
def verify_report(
    report_id: int,
    verification: ReportVerification,
    admin_key: str | None = Header(
        default=None,
        alias="X-Admin-Key"
    )
):
    require_admin_key(admin_key)

    conn = get_db()

    existing = conn.execute(
        "SELECT id FROM flood_reports WHERE id = ?",
        (report_id,)
    ).fetchone()

    if not existing:
        conn.close()
        raise HTTPException(
            status_code=404,
            detail="Flood report not found"
        )

    is_verified = (
        1
        if verification.status == "verified"
        else 0
    )
    verified_at = (
        datetime.now().isoformat()
        if verification.status == "verified"
        else None
    )

    conn.execute(
        """
        UPDATE flood_reports
        SET verified = ?,
            verification_status = ?,
            verified_at = ?,
            verification_note = ?
        WHERE id = ?
        """,
        (
            is_verified,
            verification.status,
            verified_at,
            verification.note,
            report_id
        )
    )

    conn.commit()

    row = conn.execute(
        "SELECT * FROM flood_reports WHERE id = ?",
        (report_id,)
    ).fetchone()

    conn.close()

    return {
        "success": True,
        "report": serialize_report(row)
    }


# ==========================================================
# LIVE DERIVED FLOOD-RISK ENGINE
# ==========================================================

# These are geographic monitoring anchors only. They do not
# contain any dummy/fabricated risk scores. Risk is calculated
# at request time from current model weather, real DEM terrain
# and recent FloodFlow ground reports.
MONITORING_POINTS = [
    {
        "name": "Azara / GCU",
        "lat": 26.1328,
        "lng": 91.6222,
        "basin": "Deepar Basin",
    },
    {
        "name": "Maligaon",
        "lat": 26.157,
        "lng": 91.696,
        "basin": "Deepar Basin",
    },
    {
        "name": "Kahilipara",
        "lat": 26.122,
        "lng": 91.756,
        "basin": "Bharalu Basin",
    },
    {
        "name": "Japorigog",
        "lat": 26.161,
        "lng": 91.783,
        "basin": "Bharalu Basin",
    },
    {
        "name": "Hatigaon",
        "lat": 26.116,
        "lng": 91.789,
        "basin": "Silsako Basin",
    },
    {
        "name": "Rukminigaon",
        "lat": 26.136,
        "lng": 91.801,
        "basin": "Silsako Basin",
    },
    {
        "name": "Hengrabari",
        "lat": 26.151,
        "lng": 91.789,
        "basin": "Silsako Basin",
    },
    {
        "name": "Satgaon",
        "lat": 26.175,
        "lng": 91.823,
        "basin": "Silsako Basin",
    },
    {
        "name": "Noonmati",
        "lat": 26.191,
        "lng": 91.79,
        "basin": "Foreshore Basin",
    },
    {
        "name": "Bamunimaidam",
        "lat": 26.187,
        "lng": 91.769,
        "basin": "Foreshore Basin",
    },
]

ELEVATION_CACHE_SECONDS = 30 * 60
LIVE_WEATHER_CACHE_SECONDS = 90

elevation_cache = {
    "saved_at": 0.0,
    "values": None,
}

live_weather_cache = {
    "saved_at": 0.0,
    "values": None,
}


def haversine_meters(
    lat1,
    lon1,
    lat2,
    lon2
):
    from math import asin, cos, radians, sin, sqrt

    radius = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    return 2 * radius * asin(sqrt(a))


def get_monitoring_elevations():
    now = time.time()

    if (
        elevation_cache["values"] is not None
        and now - elevation_cache["saved_at"]
        < ELEVATION_CACHE_SECONDS
    ):
        return elevation_cache["values"]

    latitudes = ",".join(
        str(item["lat"])
        for item in MONITORING_POINTS
    )
    longitudes = ",".join(
        str(item["lng"])
        for item in MONITORING_POINTS
    )

    response = requests.get(
        "https://api.open-meteo.com/v1/elevation",
        params={
            "latitude": latitudes,
            "longitude": longitudes,
        },
        timeout=20,
    )
    response.raise_for_status()

    values = response.json().get("elevation", [])
    if len(values) != len(MONITORING_POINTS):
        raise ValueError("Elevation response was incomplete")

    result = {
        item["name"]: float(value)
        for item, value in zip(
            MONITORING_POINTS,
            values,
        )
    }

    elevation_cache["saved_at"] = now
    elevation_cache["values"] = result
    return result


def calculate_rolling_24h(item):
    current = item.get("current", {})
    hourly = item.get("hourly", {})
    current_time_text = current.get("time")

    if not current_time_text:
        return 0.0

    current_time = datetime.fromisoformat(current_time_text)
    start_time = current_time - timedelta(hours=24)
    total = 0.0

    for time_text, value in zip(
        hourly.get("time", []),
        hourly.get("precipitation", []),
    ):
        timestamp = datetime.fromisoformat(time_text)
        if start_time < timestamp <= current_time:
            total += float(value or 0)

    return round(total, 2)


def get_live_weather_points():
    now = time.time()

    if (
        live_weather_cache["values"] is not None
        and now - live_weather_cache["saved_at"]
        < LIVE_WEATHER_CACHE_SECONDS
    ):
        return live_weather_cache["values"]

    latitudes = ",".join(
        str(item["lat"])
        for item in MONITORING_POINTS
    )
    longitudes = ",".join(
        str(item["lng"])
        for item in MONITORING_POINTS
    )

    response = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": latitudes,
            "longitude": longitudes,
            "current": (
                "temperature_2m,"
                "relative_humidity_2m,"
                "precipitation,rain"
            ),
            "hourly": "precipitation",
            "past_days": 1,
            "forecast_days": 1,
            "timezone": "Asia/Kolkata",
        },
        timeout=25,
    )
    response.raise_for_status()

    payload = response.json()
    rows = payload if isinstance(payload, list) else [payload]

    if len(rows) != len(MONITORING_POINTS):
        raise ValueError("Live weather response was incomplete")

    result = {}

    for point, item in zip(MONITORING_POINTS, rows):
        current = item.get("current", {})
        result[point["name"]] = {
            "temperature_c": current.get("temperature_2m"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "current_precipitation_mm": current.get("precipitation"),
            "current_rain_mm": current.get("rain"),
            "rainfall_24h_mm": calculate_rolling_24h(item),
            "updated_at": current.get("time"),
        }

    live_weather_cache["saved_at"] = now
    live_weather_cache["values"] = result
    return result


def percentile_value(values, ratio):
    ordered = sorted(values)
    if not ordered:
        return None

    index = round((len(ordered) - 1) * ratio)
    index = max(0, min(len(ordered) - 1, index))
    return ordered[index]


def rainfall_24h_score(value):
    value = float(value or 0)
    if value >= 70:
        return 40
    if value >= 40:
        return 32
    if value >= 20:
        return 22
    if value >= 10:
        return 12
    if value >= 5:
        return 6
    if value > 0:
        return 2
    return 0


def current_rain_score(value):
    value = float(value or 0)
    if value >= 10:
        return 15
    if value >= 5:
        return 12
    if value >= 2:
        return 8
    if value >= 0.5:
        return 4
    if value > 0:
        return 2
    return 0


def get_risk_level(score):
    if score >= 70:
        return "Very High"
    if score >= 45:
        return "High"
    if score >= 25:
        return "Medium"
    return "Low"


def get_recent_reports(hours=6):
    cutoff = (
        datetime.now() - timedelta(hours=hours)
    ).isoformat()

    conn = get_db()
    rows = conn.execute(
        """
        SELECT *
        FROM flood_reports
        WHERE created_at >= ?
          AND COALESCE(verification_status, 'pending') != 'rejected'
        ORDER BY created_at DESC
        """,
        (cutoff,),
    ).fetchall()
    conn.close()

    return [dict(row) for row in rows]


def citizen_score_for_point(point, reports):
    score = 0.0
    nearby = []

    for report in reports:
        distance = haversine_meters(
            point["lat"],
            point["lng"],
            float(report["latitude"]),
            float(report["longitude"]),
        )

        if distance > 1000:
            continue

        report_score = 0.0
        if report["road_status"] == "blocked":
            report_score += 10
        elif report["road_status"] == "caution":
            report_score += 5
        else:
            report_score += 1

        depth = float(report.get("water_depth_cm") or 0)
        if depth >= 60:
            report_score += 8
        elif depth >= 30:
            report_score += 5
        elif depth >= 10:
            report_score += 2

        status = (
            report.get("verification_status")
            or ("verified" if report.get("verified") else "pending")
        )
        trust_weight = 1.0 if status == "verified" else 0.65

        proximity_weight = max(0.25, 1 - distance / 1200)
        weighted = report_score * trust_weight * proximity_weight
        score += weighted

        nearby.append({
            "id": report["id"],
            "distance_m": round(distance),
            "road_status": report["road_status"],
            "water_depth_cm": depth,
            "verification_status": status,
            "trust_weight": trust_weight,
        })

    return min(round(score), 25), nearby


@app.get("/api/risks")
def get_risks():
    try:
        weather_by_name = get_live_weather_points()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Live weather grid unavailable: {error}",
        )

    try:
        elevations = get_monitoring_elevations()
    except Exception:
        elevations = {}

    reports = get_recent_reports(hours=6)

    elevation_values = list(elevations.values())
    q25 = percentile_value(elevation_values, 0.25)
    q50 = percentile_value(elevation_values, 0.50)
    q75 = percentile_value(elevation_values, 0.75)

    risks = []
    updated_values = []

    for point in MONITORING_POINTS:
        live_weather = weather_by_name.get(point["name"], {})
        rainfall_24h = float(live_weather.get("rainfall_24h_mm") or 0)
        current_rain = float(live_weather.get("current_rain_mm") or 0)

        rain24_score = rainfall_24h_score(rainfall_24h)
        rain_now_score = current_rain_score(current_rain)

        elevation = elevations.get(point["name"])
        terrain_score = 0
        terrain_band = "Unknown"

        if elevation is not None:
            if q25 is not None and elevation <= q25:
                terrain_score = 20
                terrain_band = "Lower"
            elif q50 is not None and elevation <= q50:
                terrain_score = 14
                terrain_band = "Lower-mid"
            elif q75 is not None and elevation >= q75:
                terrain_score = 3
                terrain_band = "Higher"
            else:
                terrain_score = 8
                terrain_band = "Mid-range"

        citizen_score, nearby_reports = citizen_score_for_point(
            point,
            reports,
        )

        score = max(
            0,
            min(
                100,
                round(
                    rain24_score
                    + rain_now_score
                    + terrain_score
                    + citizen_score
                ),
            ),
        )
        level = get_risk_level(score)

        reasons = [
            f"Open-Meteo rolling precipitation: {rainfall_24h:.1f} mm / 24 h (+{rain24_score})",
            f"Current model rain: {current_rain:.1f} mm (+{rain_now_score})",
        ]

        if elevation is not None:
            reasons.append(
                f"Copernicus DEM elevation: {elevation:.0f} m; relative terrain {terrain_band} (+{terrain_score})"
            )
        else:
            reasons.append("Elevation feed unavailable; terrain contributed 0")

        if nearby_reports:
            reasons.append(
                f"{len(nearby_reports)} recent FloodFlow report(s) within 1 km (+{citizen_score})"
            )
        else:
            reasons.append(
                "No recent FloodFlow ground reports within 1 km"
            )

        reasons.append(
            "Live drain blockage/capacity sensor data is not available, so drainage condition is not scored"
        )

        updated_at = live_weather.get("updated_at")
        if updated_at:
            updated_values.append(updated_at)

        risks.append({
            "name": point["name"],
            "lat": point["lat"],
            "lng": point["lng"],
            "basin": point["basin"],
            "score": score,
            "level": level,
            "components": {
                "rainfall_24h_score": rain24_score,
                "current_rain_score": rain_now_score,
                "terrain_score": terrain_score,
                "citizen_report_score": citizen_score,
                "drainage_score": None,
            },
            "inputs": {
                **live_weather,
                "elevation_m": elevation,
                "terrain_band": terrain_band,
                "recent_reports_6h": len(nearby_reports),
            },
            "reasons": reasons,
            "method": "live derived multi-factor index",
            "official_warning": False,
            "synthetic_data_used": False,
        })

    return {
        "location": "Guwahati",
        "updated_at": max(updated_values) if updated_values else None,
        "risk_method": (
            "current Open-Meteo weather model + Copernicus DEM terrain + recent trusted FloodFlow reports"
        ),
        "synthetic_data_used": False,
        "official_warning": False,
        "sources": [
            "Open-Meteo weather model",
            "Copernicus DEM GLO-90 via Open-Meteo Elevation API",
            "FloodFlow citizen reports",
        ],
        "drainage_note": (
            "OSM drainage geometry is displayed separately. Live blockage/capacity is not scored because no verified public realtime drain-sensor feed is connected."
        ),
        "risks": risks,
    }

