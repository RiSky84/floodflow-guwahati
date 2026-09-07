import { useEffect, useMemo, useRef, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Polyline,
  Popup,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import {
  drainageAssets,
  getAssetStatusGroup,
} from "./data/drainageAssets.js";

import {
  getWeather,
  getRiver,
  getRainRadar,
  getDrainageFeatures,
  getTerrainSamples,
  getRisks,
  searchPlaces,
  getRouteCandidates,
  getFloodReports,
  submitFloodReport,
} from "./api.js";

const hotspots = [
  {
    name: "Rukminigaon",
    lat: 26.136,
    lng: 91.801,
    baseScore: 70,
    populationRisk: 2037,
    basin: "Silsako Basin",
  },
  {
    name: "Hatigaon",
    lat: 26.116,
    lng: 91.789,
    baseScore: 60,
    populationRisk: 12912,
    basin: "Silsako Basin",
  },
  {
    name: "Japorigog",
    lat: 26.161,
    lng: 91.783,
    baseScore: 75,
    populationRisk: 58246,
    basin: "Bharalu Basin",
  },
  {
    name: "Kahilipara",
    lat: 26.122,
    lng: 91.756,
    baseScore: 55,
    populationRisk: 986,
    basin: "Bharalu Basin",
  },
  {
    name: "Hengrabari",
    lat: 26.151,
    lng: 91.789,
    baseScore: 40,
    populationRisk: 5765,
    basin: "Silsako Basin",
  },
  {
    name: "Satgaon",
    lat: 26.175,
    lng: 91.823,
    baseScore: 58,
    populationRisk: 1492,
    basin: "Silsako Basin",
  },
  {
    name: "Maligaon",
    lat: 26.157,
    lng: 91.696,
    baseScore: 57,
    populationRisk: 6864,
    basin: "Deepar Basin",
  },
  {
    name: "Noonmati",
    lat: 26.191,
    lng: 91.79,
    baseScore: 42,
    populationRisk: 1636,
    basin: "Foreshore Basin",
  },
  {
    name: "Bamunimaidam",
    lat: 26.187,
    lng: 91.769,
    baseScore: 61,
    populationRisk: 5543,
    basin: "Foreshore Basin",
  },
];

const demoFloodZones = [
  {
    name: "DEMO — GS Road / Christian Basti",
    lat: 26.1618,
    lng: 91.7768,
    level: "Very High",
    radius_m: 320,
  },
  {
    name: "DEMO — Ganeshguri Junction",
    lat: 26.1548,
    lng: 91.7868,
    level: "Very High",
    radius_m: 300,
  },
  {
    name: "DEMO — Dispur Last Gate",
    lat: 26.1437,
    lng: 91.7928,
    level: "High",
    radius_m: 280,
  },
  {
    name: "DEMO — Six Mile",
    lat: 26.1375,
    lng: 91.8064,
    level: "Very High",
    radius_m: 300,
  },
  {
    name: "DEMO — Beltola Tiniali",
    lat: 26.1238,
    lng: 91.7989,
    level: "High",
    radius_m: 280,
  },
  {
    name: "DEMO — Basistha Chariali",
    lat: 26.1112,
    lng: 91.7868,
    level: "High",
    radius_m: 300,
  },
  {
    name: "DEMO — Hatigaon Main Road",
    lat: 26.1162,
    lng: 91.7870,
    level: "Very High",
    radius_m: 300,
  },
  {
    name: "DEMO — Kahilipara Main Road",
    lat: 26.1230,
    lng: 91.7555,
    level: "High",
    radius_m: 290,
  },
  {
    name: "DEMO — Ulubari",
    lat: 26.1726,
    lng: 91.7505,
    level: "High",
    radius_m: 300,
  },
  {
    name: "DEMO — Chandmari",
    lat: 26.1850,
    lng: 91.7735,
    level: "High",
    radius_m: 280,
  },
  {
    name: "DEMO — Zoo Road Tiniali",
    lat: 26.1744,
    lng: 91.7815,
    level: "Very High",
    radius_m: 300,
  },
  {
    name: "DEMO — Noonmati",
    lat: 26.1900,
    lng: 91.7915,
    level: "High",
    radius_m: 300,
  },
  {
    name: "DEMO — Narengi",
    lat: 26.1800,
    lng: 91.8350,
    level: "High",
    radius_m: 300,
  },
  {
    name: "DEMO — Maligaon",
    lat: 26.1580,
    lng: 91.6975,
    level: "Very High",
    radius_m: 320,
  },
  {
    name: "DEMO — Bharalumukh",
    lat: 26.1752,
    lng: 91.7337,
    level: "High",
    radius_m: 300,
  },
  {
    name: "DEMO — Jalukbari",
    lat: 26.1598,
    lng: 91.6748,
    level: "High",
    radius_m: 320,
  },
  {
    name: "DEMO — Lokhra",
    lat: 26.1105,
    lng: 91.7485,
    level: "Very High",
    radius_m: 300,
  },
  {
    name: "DEMO — Sarusajai",
    lat: 26.1120,
    lng: 91.7710,
    level: "High",
    radius_m: 280,
  },
];

function getRiskColor(risk) {
  if (risk === "Very High") return "#b63a34";
  if (risk === "High") return "#d76b26";
  if (risk === "Medium") return "#c79a1b";
  return "#2f7b58";
}

function calculateLiveRisk(baseScore, rainfall24h) {
  let score = baseScore;

  if (rainfall24h >= 70) score += 25;
  else if (rainfall24h >= 40) score += 18;
  else if (rainfall24h >= 20) score += 10;
  else if (rainfall24h >= 10) score += 5;

  score = Math.min(score, 100);

  let level = "Low";
  if (score >= 75) level = "Very High";
  else if (score >= 50) level = "High";
  else if (score >= 25) level = "Medium";

  return { score, level };
}

function MapFocus({ place }) {
  const map = useMap();

  useEffect(() => {
    if (!place) return;

    map.flyTo([place.lat, place.lng], 14, {
      animate: true,
      duration: 0.7,
    });
  }, [map, place]);

  return null;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const earthRadius = 6371000;

  const toRadians = (value) =>
    (value * Math.PI) / 180;

  const dLat =
    toRadians(lat2 - lat1);

  const dLng =
    toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}


function pointToSegmentDistanceMeters(
  latitude,
  longitude,
  startLat,
  startLng,
  endLat,
  endLng
) {
  const meanLat =
    (
      latitude +
      startLat +
      endLat
    ) / 3;

  const metersPerLat =
    111320;

  const metersPerLng =
    111320 *
    Math.cos(
      meanLat *
      Math.PI /
      180
    );

  const px =
    (longitude - startLng) *
    metersPerLng;

  const py =
    (latitude - startLat) *
    metersPerLat;

  const vx =
    (endLng - startLng) *
    metersPerLng;

  const vy =
    (endLat - startLat) *
    metersPerLat;

  const lengthSquared =
    vx * vx +
    vy * vy;

  if (lengthSquared === 0) {
    return Math.sqrt(
      px * px +
      py * py
    );
  }

  const t =
    Math.max(
      0,
      Math.min(
        1,
        (
          px * vx +
          py * vy
        ) /
        lengthSquared
      )
    );

  const dx =
    px - t * vx;

  const dy =
    py - t * vy;

  return Math.sqrt(
    dx * dx +
    dy * dy
  );
}


function minimumDistanceToRoute(
  latitude,
  longitude,
  coordinates
) {
  if (!coordinates?.length) {
    return Infinity;
  }

  if (coordinates.length === 1) {
    const [lng, lat] =
      coordinates[0];

    return haversineMeters(
      latitude,
      longitude,
      lat,
      lng
    );
  }

  let minimum = Infinity;

  // Check every route SEGMENT. A route can cross a
  // flood circle between two geometry vertices.
  for (
    let index = 0;
    index <
      coordinates.length - 1;
    index += 1
  ) {
    const [startLng, startLat] =
      coordinates[index];

    const [endLng, endLat] =
      coordinates[index + 1];

    const distance =
      pointToSegmentDistanceMeters(
        latitude,
        longitude,
        startLat,
        startLng,
        endLat,
        endLng
      );

    if (distance < minimum) {
      minimum = distance;
    }

    if (minimum <= 1) {
      break;
    }
  }

  return minimum;
}


function scoreRouteCandidate(
  route,
  rainfall24h,
  reports,
  riskByName = {},
  extraHazards = []
) {
  const coordinates =
    route?.geometry?.coordinates ?? [];

  let floodPenalty = 0;
  const nearbyRisks = [];
  const nearbyReports = [];
  const demoFloodIntersections = [];

  const routeHazards = [
    ...hotspots.map((place) => ({
      ...place,
      demo: false,
      radius_m: 450,
    })),
    ...extraHazards.map((place) => ({
      ...place,
      demo: true,
      radius_m:
        place.radius_m || 300,
    })),
  ];

  routeHazards.forEach((place) => {
    const distance =
      minimumDistanceToRoute(
        place.lat,
        place.lng,
        coordinates
      );

    const influenceRadius =
      place.demo
        ? Math.max(
            420,
            (place.radius_m || 300) + 180
          )
        : 450;

    if (distance > influenceRadius) {
      return;
    }

    if (
      place.demo &&
      distance <=
        (place.radius_m || 300)
    ) {
      demoFloodIntersections.push({
        name: place.name,
        distance,
        radius_m:
          place.radius_m || 300,
      });

      // Hard penalty for physically crossing a
      // simulated flooded area.
      floodPenalty += 250;
    }

    const risk =
      place.demo
        ? {
            level:
              place.level || "Very High",
            score:
              place.level === "High"
                ? 75
                : 92,
          }
        : (
            riskByName[place.name] ||
            calculateLiveRisk(
              place.baseScore,
              rainfall24h
            )
          );

    const weight =
      place.demo
        ? risk.level === "Very High"
          ? 62
          : 42
        : risk.level === "Very High"
        ? 34
        : risk.level === "High"
        ? 22
        : risk.level === "Medium"
        ? 10
        : 3;

    const proximity =
      Math.max(
        0,
        1 -
          distance /
            influenceRadius
      );

    floodPenalty +=
      weight * proximity;

    if (
      risk.level === "Very High" ||
      risk.level === "High"
    ) {
      nearbyRisks.push({
        name: place.name,
        level: risk.level,
        distance,
        demo: place.demo,
      });
    }
  });

  reports.forEach((report) => {
    const distance =
      minimumDistanceToRoute(
        Number(report.latitude),
        Number(report.longitude),
        coordinates
      );

    if (distance > 220) {
      return;
    }

    const weight =
      report.road_status === "blocked"
        ? 35
        : report.road_status === "caution"
        ? 20
        : 6;

    const proximity =
      Math.max(
        0,
        1 - distance / 220
      );

    floodPenalty +=
      weight * proximity;

    nearbyReports.push({
      id: report.id,
      locality:
        report.locality ||
        "Citizen report",
      roadStatus:
        report.road_status,
      distance,
    });
  });

  const durationMinutes =
    (route.duration ?? 0) / 60;

  // Lower is better. Travel time remains important,
  // but flood proximity can make a slightly longer
  // alternative preferable.
  const blockedReports =
    nearbyReports.filter(
      (item) =>
        item.roadStatus ===
        "blocked"
    ).length;

  const safetyCost =
    durationMinutes +
    floodPenalty * 0.8 +
    blockedReports * 45 +
    demoFloodIntersections.length *
      10000;

  return {
    ...route,
    durationMinutes,
    distanceKm:
      (route.distance ?? 0) / 1000,
    floodPenalty,
    blockedReports,
    demoFloodIntersections,
    crossesDemoFlood:
      demoFloodIntersections.length > 0,
    safetyCost,
    nearbyRisks,
    nearbyReports,
  };
}


function RouteMapPicker({
  enabled,
  onPick,
}) {
  useMapEvents({
    click(event) {
      if (!enabled) {
        return;
      }

      onPick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return null;
}


function NavigationFollower({
  active,
  point,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !active ||
      !point
    ) {
      return;
    }

    map.panTo(
      [point.lat, point.lng],
      {
        animate: true,
      }
    );
  }, [
    active,
    map,
    point,
  ]);

  return null;
}


function flattenRouteSteps(route) {
  return (
    route?.legs
      ?.flatMap(
        (leg) =>
          leg.steps ?? []
      ) ?? []
  );
}


function getTurnIcon(step) {
  const maneuver =
    step?.maneuver ?? {};

  const modifier =
    maneuver.modifier ?? "";

  const type =
    maneuver.type ?? "";

  if (type === "arrive") {
    return "●";
  }

  if (
    modifier.includes("left")
  ) {
    return "↰";
  }

  if (
    modifier.includes("right")
  ) {
    return "↱";
  }

  if (
    type === "roundabout" ||
    type === "rotary"
  ) {
    return "⟳";
  }

  if (type === "depart") {
    return "↑";
  }

  return "↑";
}


function getTurnInstruction(step) {
  const maneuver =
    step?.maneuver ?? {};

  const type =
    maneuver.type ?? "continue";

  const modifier =
    (maneuver.modifier ?? "")
      .replaceAll("_", " ");

  const road =
    step?.name?.trim()
      ? step.name.trim()
      : "the road";

  if (type === "depart") {
    return `Start on ${road}`;
  }

  if (type === "arrive") {
    return "You have arrived";
  }

  if (
    type === "roundabout" ||
    type === "rotary"
  ) {
    const exit =
      maneuver.exit
        ? ` and take exit ${maneuver.exit}`
        : "";

    return (
      `Enter the roundabout${exit} ` +
      `toward ${road}`
    );
  }

  if (
    type === "turn" ||
    type === "fork" ||
    type === "end of road"
  ) {
    return (
      `Turn ${modifier || ""} ` +
      `onto ${road}`
    ).replace(/\s+/g, " ").trim();
  }

  if (
    type === "merge" ||
    type === "on ramp" ||
    type === "off ramp"
  ) {
    return (
      `${type} ${modifier || ""} ` +
      `onto ${road}`
    ).replace(/\s+/g, " ").trim();
  }

  return (
    `Continue ${modifier || "straight"} ` +
    `on ${road}`
  ).replace(/\s+/g, " ").trim();
}


function routeRiskLabel(
  floodPenalty,
  blockedReports
) {
  if (blockedReports > 0) {
    return "Blocked report nearby";
  }

  if (floodPenalty >= 55) {
    return "High flood exposure";
  }

  if (floodPenalty >= 25) {
    return "Caution";
  }

  return "Lower flood exposure";
}


function RouteFocus({ route }) {
  const map = useMap();

  useEffect(() => {
    const coordinates =
      route?.geometry?.coordinates;

    if (!coordinates?.length) {
      return;
    }

    const bounds =
      coordinates.map(
        ([lng, lat]) => [lat, lng]
      );

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 14,
    });
  }, [map, route]);

  return null;
}


function formatNumber(value, digits = 0) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
  });
}

function percentile(values, ratio) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const index =
    Math.min(
      sorted.length - 1,
      Math.max(
        0,
        Math.round(
          (sorted.length - 1) *
            ratio
        )
      )
    );

  return sorted[index];
}


function getTerrainBand(
  elevation,
  elevations
) {
  if (
    elevation === null ||
    elevation === undefined ||
    !elevations.length
  ) {
    return "Unknown";
  }

  const q1 =
    percentile(elevations, 0.25);

  const q3 =
    percentile(elevations, 0.75);

  if (elevation <= q1) {
    return "Lower";
  }

  if (elevation >= q3) {
    return "Higher";
  }

  return "Mid-range";
}


function getTerrainBandClass(band) {
  if (band === "Lower") {
    return "terrain-low";
  }

  if (band === "Higher") {
    return "terrain-high";
  }

  return "terrain-mid";
}


function App() {
  const [selected, setSelected] = useState(hotspots[0]);
  const [weather, setWeather] = useState(null);
  const [river, setRiver] = useState(null);
  const [radar, setRadar] = useState(null);
  const [radarError, setRadarError] = useState("");
  const [drainage, setDrainage] = useState([]);
  const [drainageError, setDrainageError] = useState("");
  const [loadingDrainage, setLoadingDrainage] = useState(false);

  const [terrain, setTerrain] = useState({});
  const [terrainError, setTerrainError] = useState("");
  const [loadingTerrain, setLoadingTerrain] = useState(true);

  const [reports, setReports] = useState([]);
  const [risks, setRisks] = useState([]);
  const [riskError, setRiskError] = useState("");
  const [loadingWeather, setLoadingWeather] = useState(true);

  const [showReport, setShowReport] = useState(false);
  const [showRiskLayer, setShowRiskLayer] = useState(true);
  const [showReportLayer, setShowReportLayer] = useState(true);
  const [showRadarLayer, setShowRadarLayer] = useState(false);
  const [showDrainageLayer, setShowDrainageLayer] = useState(false);
  const [showHillshadeLayer, setShowHillshadeLayer] = useState(false);

  const [drainageMode, setDrainageMode] = useState(false);
  const [terrainMode, setTerrainMode] = useState(false);
  const [assetFilter, setAssetFilter] = useState("all");

  const [routeMode, setRouteMode] = useState(false);
  const [routeStartMode, setRouteStartMode] = useState("gps");
  const [routeGps, setRouteGps] = useState(null);
  const [routeManualStart, setRouteManualStart] = useState(null);
  const [routePickingStart, setRoutePickingStart] = useState(false);

  const [routePreference, setRoutePreference] = useState("safest");
  const [demoFloodScenario, setDemoFloodScenario] = useState(false);
  const [sideRoadDetours, setSideRoadDetours] = useState(true);

  const [routeDestinationPoint, setRouteDestinationPoint] = useState({
    lat: hotspots[1].lat,
    lng: hotspots[1].lng,
  });

  const [routeDestinationLabel, setRouteDestinationLabel] = useState(
    hotspots[1].name
  );

  const [routeSearch, setRouteSearch] = useState("");
  const [routeSuggestions, setRouteSuggestions] = useState([]);
  const [routeSearchLoading, setRouteSearchLoading] = useState(false);
  const [routePickingDestination, setRoutePickingDestination] = useState(false);

  const [routeOptions, setRouteOptions] = useState([]);
  const [chosenRoute, setChosenRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeMessage, setRouteMessage] = useState("");

  const [navigationActive, setNavigationActive] = useState(false);
  const [navigationPoint, setNavigationPoint] = useState(null);
  const [navigationAccuracy, setNavigationAccuracy] = useState(null);
  const [voiceNavigation, setVoiceNavigation] = useState(false);

  const lastRerouteAt = useRef(0);
  const lastSpokenStep = useRef(-1);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    latitude: "",
    longitude: "",
    water_depth_cm: "",
    road_status: "caution",
    locality: "",
    note: "",
  });

  async function loadWeather() {
    try {
      const data = await getWeather();
      setWeather(data);
    } catch (error) {
      console.error("Weather:", error);
    } finally {
      setLoadingWeather(false);
    }
  }

  async function loadRiver() {
    try {
      const data = await getRiver();
      setRiver(data);
    } catch (error) {
      console.error("River:", error);
      setRiver(null);
    }
  }

  async function loadRadar() {
    try {
      const data = await getRainRadar();
      setRadar(data);
      setRadarError("");
    } catch (error) {
      console.error("Radar:", error);
      setRadar(null);
      setRadarError("Radar feed unavailable");
    }
  }

  async function loadDrainage() {
    if (loadingDrainage) {
      return false;
    }

    setLoadingDrainage(true);

    try {
      const data =
        await getDrainageFeatures();

      const features =
        data.features ?? [];

      setDrainage(features);
      setDrainageError("");

      return features.length > 0;

    } catch (error) {
      console.error(
        "Drainage:",
        error
      );

      setDrainageError(
        error?.message ||
        "Mapped drainage feed unavailable"
      );

      return false;

    } finally {
      setLoadingDrainage(false);
    }
  }


  async function loadTerrain() {
    setLoadingTerrain(true);

    try {
      const data =
        await getTerrainSamples(
          hotspots
        );

      setTerrain(
        data.byName ?? {}
      );

      setTerrainError("");
    } catch (error) {
      console.error(
        "Terrain:",
        error
      );

      setTerrain({});
      setTerrainError(
        "Terrain elevation feed unavailable"
      );
    } finally {
      setLoadingTerrain(false);
    }
  }


  async function loadRisks() {
    try {
      const data = await getRisks();

      setRisks(
        data.risks ?? []
      );

      setRiskError("");
    } catch (error) {
      console.error(
        "Risk engine:",
        error
      );

      setRiskError(
        "Backend risk engine unavailable"
      );
    }
  }


  async function loadReports() {
    try {
      const data = await getFloodReports();
      setReports(data);
    } catch (error) {
      console.error("Reports:", error);
    }
  }

  useEffect(() => {
    loadWeather();
    loadRiver();
    loadRadar();
    loadTerrain();
    loadRisks();
    loadReports();

    const weatherTimer = setInterval(
      loadWeather,
      5 * 60 * 1000
    );

    const riverTimer = setInterval(
      loadRiver,
      30 * 60 * 1000
    );

    const radarTimer = setInterval(
      loadRadar,
      5 * 60 * 1000
    );

    const riskTimer = setInterval(
      loadRisks,
      5 * 60 * 1000
    );

    const reportTimer = setInterval(
      loadReports,
      30 * 1000
    );

    return () => {
      clearInterval(weatherTimer);
      clearInterval(riverTimer);
      clearInterval(radarTimer);
      clearInterval(riskTimer);
      clearInterval(reportTimer);
    };
  }, []);

  useEffect(() => {
    if (!routeMode) {
      return;
    }

    const query =
      routeSearch.trim();

    if (query.length < 3) {
      setRouteSuggestions([]);
      setRouteSearchLoading(false);
      return;
    }

    const timer =
      setTimeout(
        async () => {
          setRouteSearchLoading(true);

          try {
            const data =
              await searchPlaces(
                query
              );

            setRouteSuggestions(
              data.results ?? []
            );

          } catch (error) {
            console.error(
              "Place search:",
              error
            );

            setRouteSuggestions([]);

          } finally {
            setRouteSearchLoading(false);
          }
        },
        500
      );

    return () =>
      clearTimeout(timer);

  }, [
    routeMode,
    routeSearch,
  ]);


  async function enableDrainageLayer() {
    if (showDrainageLayer) {
      setShowDrainageLayer(false);
      return;
    }

    if (drainage.length) {
      setShowDrainageLayer(true);
      return;
    }

    const ok =
      await loadDrainage();

    if (ok) {
      setShowDrainageLayer(true);
    }
  }


  async function openDrainageMode() {
    setRouteMode(false);
    setTerrainMode(false);
    setDrainageMode(true);

    if (drainage.length) {
      setShowDrainageLayer(true);
      return;
    }

    const ok =
      await loadDrainage();

    if (ok) {
      setShowDrainageLayer(true);
    }
  }


  function getMyLocation() {
    if (!navigator.geolocation) {
      setMessage("GPS is not supported by this browser.");
      return;
    }

    setMessage("Getting your GPS location...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((old) => ({
          ...old,
          latitude:
            position.coords.latitude.toFixed(6),
          longitude:
            position.coords.longitude.toFixed(6),
        }));

        setMessage("GPS location detected.");
      },
      () => {
        setMessage(
          "Could not access GPS. Please allow location permission."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await submitFloodReport({
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        water_depth_cm:
          Number(form.water_depth_cm),
        road_status: form.road_status,
        locality: form.locality,
        note: form.note,
      });

      setMessage(
        "Flood report submitted successfully."
      );

      await loadReports();
      await loadRisks();

      setForm({
        latitude: "",
        longitude: "",
        water_depth_cm: "",
        road_status: "caution",
        locality: "",
        note: "",
      });

      setTimeout(() => {
        setShowReport(false);
        setMessage("");
      }, 1200);
    } catch (error) {
      console.error(error);
      setMessage("Unable to submit report.");
    }
  }

  function getRouteGpsLocation() {
    return new Promise(
      (resolve, reject) => {
        if (!navigator.geolocation) {
          reject(
            new Error(
              "GPS is not supported by this browser."
            )
          );
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const point = {
              lat:
                position.coords.latitude,
              lng:
                position.coords.longitude,
            };

            setRouteGps(point);
            resolve(point);
          },
          () => {
            reject(
              new Error(
                "Could not access GPS location."
              )
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
          }
        );
      }
    );
  }


  async function calculateSmartRoutes(
    startPoint,
    destinationPoint,
    options = {}
  ) {
    const {
      silent = false,
      fromReroute = false,
    } = options;

    if (!silent) {
      setRouteMessage("");
    }

    setRouteLoading(true);

    try {
      const directDistance =
        haversineMeters(
          startPoint.lat,
          startPoint.lng,
          destinationPoint.lat,
          destinationPoint.lng
        );

      if (directDistance < 80) {
        throw new Error(
          "Start and destination are too close."
        );
      }

      const activeDemoHazards =
        demoFloodScenario
          ? demoFloodZones
          : [];

      const data =
        await getRouteCandidates(
          startPoint,
          destinationPoint,
          sideRoadDetours
            ? activeDemoHazards
            : []
        );

      let scored =
        (data.routes ?? [])
          .map((route) =>
            scoreRouteCandidate(
              route,
              rainfall24,
              reports,
              riskByName,
              activeDemoHazards
            )
          );

      if (!scored.length) {
        throw new Error(
          "No road route was returned."
        );
      }

      const snapFiltered =
        scored.filter(
          (route) =>
            (
              route
                .floodflow_start_snap_m
              ?? 0
            ) <= 900
        );

      if (!snapFiltered.length) {
        const closestSnap =
          Math.min(
            ...scored.map(
              (route) =>
                route
                  .floodflow_start_snap_m
                ?? Infinity
            )
          );

        throw new Error(
          `Your start location is being snapped ${Math.round(
            closestSnap
          )} m to a mapped road. Desktop GPS may be inaccurate. Choose "Pick start on map" and click your actual road.`
        );
      }

      scored =
        snapFiltered;

      const fastest =
        [...scored].sort(
          (a, b) =>
            a.durationMinutes -
            b.durationMinutes
        );

      // Strict flood avoidance:
      // First reject any route that physically
      // intersects a simulated flood circle.
      let safestPool =
        scored.filter(
          (route) =>
            route
              .demoFloodIntersections
              .length === 0 &&
            route.blockedReports === 0
        );

      if (!safestPool.length) {
        safestPool =
          scored.filter(
            (route) =>
              route
                .demoFloodIntersections
                .length === 0
          );
      }

      // If absolutely every drivable candidate crosses
      // a flood zone, choose the one with the fewest
      // crossings instead of pretending it is safe.
      if (!safestPool.length) {
        const minimumCrossings =
          Math.min(
            ...scored.map(
              (route) =>
                route
                  .demoFloodIntersections
                  .length
            )
          );

        safestPool =
          scored.filter(
            (route) =>
              route
                .demoFloodIntersections
                .length ===
              minimumCrossings
          );
      }

      const safest =
        [...safestPool].sort(
          (a, b) =>
            a.safetyCost -
            b.safetyCost
        );

      const ordered =
        routePreference === "fastest"
          ? fastest
          : safest;

      setRouteOptions(ordered);
      setChosenRoute(ordered[0]);

      if (!silent) {
        const blockedAvoided =
          scored.some(
            (route) =>
              route.blockedReports > 0
          ) &&
          ordered[0].blockedReports === 0;

        const selectedCrossings =
          ordered[0]
            .demoFloodIntersections
            .length;

        const safeCandidates =
          scored.filter(
            (route) =>
              route
                .demoFloodIntersections
                .length === 0
          ).length;

        setRouteMessage(
          routePreference === "safest"
            ? selectedCrossings === 0
              ? `FloodFlow found ${safeCandidates} flood-free candidate${safeCandidates === 1 ? "" : "s"} and selected the safest one.`
              : `No completely flood-free drivable route was found. Using the route with the fewest flood-zone crossings (${selectedCrossings}).`
            : blockedAvoided
            ? "Fastest option avoided a nearby blocked-road report."
            : `Compared ${scored.length} route option${scored.length === 1 ? "" : "s"} by travel time.`
        );
      }

      if (fromReroute) {
        setRouteMessage(
          "Route updated from your current position."
        );
      }

      return ordered[0];

    } catch (error) {
      console.error(
        "Smart route:",
        error
      );

      if (!silent) {
        setRouteOptions([]);
        setChosenRoute(null);
      }

      setRouteMessage(
        error.message ||
        "Unable to calculate route."
      );

      return null;

    } finally {
      setRouteLoading(false);
    }
  }


  async function handleFindRoute() {
    let startPoint;

    try {
      if (routeStartMode === "gps") {
        startPoint =
          routeGps ||
          (await getRouteGpsLocation());

      } else if (
        routeStartMode === "map"
      ) {
        if (!routeManualStart) {
          throw new Error(
            "Pick the route start on the map first."
          );
        }

        startPoint =
          routeManualStart;

      } else {
        startPoint = {
          lat: selected.lat,
          lng: selected.lng,
        };
      }

      await calculateSmartRoutes(
        startPoint,
        routeDestinationPoint
      );

    } catch (error) {
      setRouteMessage(
        error.message ||
        "Could not get your location."
      );
    }
  }


  async function startNavigation() {
    if (!chosenRoute) {
      setRouteMessage(
        "Calculate a route first."
      );
      return;
    }

    try {
      const point =
        await getRouteGpsLocation();

      setRouteStartMode("gps");
      setNavigationPoint(point);

      await calculateSmartRoutes(
        point,
        routeDestinationPoint,
        {
          silent: true,
          fromReroute: true,
        }
      );

      lastRerouteAt.current =
        Date.now();

      setNavigationActive(true);

      setRouteMessage(
        "Navigation started. FloodFlow will reroute if you move away from the route."
      );

    } catch (error) {
      setRouteMessage(
        error.message ||
        "GPS is required to start navigation."
      );
    }
  }


  function stopNavigation() {
    setNavigationActive(false);
    setNavigationPoint(null);
    setNavigationAccuracy(null);
    lastSpokenStep.current = -1;

    if (
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel();
    }

    setRouteMessage(
      "Navigation stopped."
    );
  }


  function chooseStartPoint(
    point
  ) {
    const startPoint = {
      lat: Number(point.lat),
      lng: Number(point.lng),
    };

    setRouteManualStart(
      startPoint
    );

    setRouteStartMode(
      "map"
    );

    setRoutePickingStart(false);
    setRouteOptions([]);
    setChosenRoute(null);
    setNavigationActive(false);

    setRouteMessage(
      `Start pinned · ${startPoint.lat.toFixed(
        5
      )}, ${startPoint.lng.toFixed(
        5
      )}`
    );
  }


  function chooseDestination(
    point,
    label
  ) {
    setRouteDestinationPoint({
      lat: Number(point.lat),
      lng: Number(point.lng),
    });

    setRouteDestinationLabel(
      label || "Pinned destination"
    );

    setRouteSearch(
      label || ""
    );

    setRouteSuggestions([]);
    setRoutePickingDestination(false);
    setRouteOptions([]);
    setChosenRoute(null);
    setNavigationActive(false);
  }


  function openRouteMode() {
    const defaultDestination =
      hotspots.find(
        (place) =>
          place.name !==
          selected.name
      );

    if (defaultDestination) {
      chooseDestination(
        {
          lat:
            defaultDestination.lat,
          lng:
            defaultDestination.lng,
        },
        defaultDestination.name
      );
    }

    setRouteMessage("");
    setDemoFloodScenario(true);
    setRouteMode(true);
  }




  useEffect(() => {
    if (!navigationActive) {
      return;
    }

    if (!navigator.geolocation) {
      setRouteMessage(
        "Live navigation is not supported by this browser."
      );
      return;
    }

    const watchId =
      navigator.geolocation.watchPosition(
        async (position) => {
          const point = {
            lat:
              position.coords.latitude,
            lng:
              position.coords.longitude,
          };

          setNavigationPoint(point);
          setRouteGps(point);
          setNavigationAccuracy(
            position.coords.accuracy
          );

          if (
            chosenRoute
              ?.geometry
              ?.coordinates
          ) {
            const deviation =
              minimumDistanceToRoute(
                point.lat,
                point.lng,
                chosenRoute
                  .geometry
                  .coordinates
              );

            const now =
              Date.now();

            if (
              deviation > 120 &&
              now -
                lastRerouteAt.current >
                20000
            ) {
              lastRerouteAt.current =
                now;

              await calculateSmartRoutes(
                point,
                routeDestinationPoint,
                {
                  silent: true,
                  fromReroute: true,
                }
              );
            }

            if (
              voiceNavigation &&
              window.speechSynthesis
            ) {
              const steps =
                flattenRouteSteps(
                  chosenRoute
                );

              let nearestIndex = -1;
              let nearestDistance =
                Infinity;

              steps.forEach(
                (step, index) => {
                  const location =
                    step?.maneuver
                      ?.location;

                  if (
                    !Array.isArray(
                      location
                    )
                  ) {
                    return;
                  }

                  const distance =
                    haversineMeters(
                      point.lat,
                      point.lng,
                      location[1],
                      location[0]
                    );

                  if (
                    distance <
                    nearestDistance
                  ) {
                    nearestDistance =
                      distance;
                    nearestIndex =
                      index;
                  }
                }
              );

              if (
                nearestIndex >= 0 &&
                nearestDistance < 70 &&
                lastSpokenStep.current !==
                  nearestIndex
              ) {
                lastSpokenStep.current =
                  nearestIndex;

                const instruction =
                  getTurnInstruction(
                    steps[
                      nearestIndex
                    ]
                  );

                const utterance =
                  new SpeechSynthesisUtterance(
                    instruction
                  );

                utterance.rate = 1;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(
                  utterance
                );
              }
            }
          }
        },
        (error) => {
          console.error(
            "Navigation GPS:",
            error
          );

          setRouteMessage(
            "Live GPS signal was lost."
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      );

    return () => {
      navigator.geolocation
        .clearWatch(watchId);
    };

  }, [
    navigationActive,
    chosenRoute,
    voiceNavigation,
    routeDestinationPoint,
  ]);


  function runSearch() {
    const query = search.trim().toLowerCase();

    if (!query) return;

    const match = hotspots.find((place) =>
      place.name.toLowerCase().includes(query)
    );

    if (match) {
      setSelected(match);
      setSearch(match.name);
    }
  }

  const rainfall24 =
    weather?.rainfall_24h_mm ?? 0;

  const currentRain =
    weather?.current_rain_mm ?? 0;

  const riverDischarge =
    river?.today_discharge_m3s;

  const radarUpdated =
    radar?.time
      ? new Date(radar.time * 1000)
          .toLocaleTimeString(
            "en-IN",
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            }
          )
      : null;

  const nearestDrainage =
    useMemo(() => {
      if (!drainage.length) {
        return null;
      }

      let nearest = null;

      drainage.forEach(
        (feature) => {
          const distance =
            minimumDistanceToRoute(
              selected.lat,
              selected.lng,
              feature.coordinates
            );

          if (
            !nearest ||
            distance <
              nearest.distance
          ) {
            nearest = {
              ...feature,
              distance,
            };
          }
        }
      );

      return nearest;
    }, [
      drainage,
      selected,
    ]);


  const drainageCounts =
    useMemo(() => {
      return drainage.reduce(
        (counts, feature) => {
          const type =
            feature.type ||
            "other";

          counts[type] =
            (counts[type] || 0) + 1;

          return counts;
        },
        {}
      );
    }, [drainage]);


  const selectedTerrain =
    terrain[selected.name] ?? null;


  const hotspotElevations =
    useMemo(() => {
      return hotspots
        .map(
          (place) =>
            terrain[place.name]
              ?.elevation_m
        )
        .filter(
          (value) =>
            value !== null &&
            value !== undefined
        );
    }, [terrain]);


  const terrainBand =
    getTerrainBand(
      selectedTerrain?.elevation_m,
      hotspotElevations
    );


  const terrainRanking =
    useMemo(() => {
      return hotspots
        .map((place) => ({
          ...place,
          terrain:
            terrain[place.name] ??
            null,
        }))
        .filter(
          (item) =>
            item.terrain
              ?.elevation_m !==
              undefined
        )
        .sort(
          (a, b) =>
            a.terrain.elevation_m -
            b.terrain.elevation_m
        );
    }, [terrain]);


  const relatedDrainageAssets =
    useMemo(() => {
      const locality =
        selected.name.toLowerCase();

      const basinKeyword =
        selected.basin
          .replace(" Basin", "")
          .toLowerCase();

      const related =
        drainageAssets.filter(
          (asset) => {
            const haystack =
              `${asset.name} ${asset.location}`
                .toLowerCase();

            return (
              haystack.includes(locality) ||
              haystack.includes(basinKeyword)
            );
          }
        );

      return related;
    }, [selected]);


  const filteredDrainageAssets =
    useMemo(() => {
      return drainageAssets.filter(
        (asset) => {
          if (assetFilter === "all") {
            return true;
          }

          return (
            getAssetStatusGroup(asset) ===
            assetFilter
          );
        }
      );
    }, [assetFilter]);


  const completedAssetCount =
    drainageAssets.filter(
      (asset) =>
        getAssetStatusGroup(asset) ===
        "completed"
    ).length;


  const ongoingAssetCount =
    drainageAssets.filter(
      (asset) =>
        getAssetStatusGroup(asset) ===
        "ongoing"
    ).length;


  const knownCapacityAssetCount =
    drainageAssets.filter(
      (asset) =>
        asset.capacity_cumec !== null
    ).length;


  const riskByName =
    useMemo(() => {
      return Object.fromEntries(
        risks.map(
          (risk) => [
            risk.name,
            risk,
          ]
        )
      );
    }, [risks]);


  const routeStartPoint =
    navigationActive &&
    navigationPoint
      ? navigationPoint
      : routeStartMode === "gps"
      ? routeGps
      : routeStartMode === "map"
      ? routeManualStart
      : {
          lat: selected.lat,
          lng: selected.lng,
        };

  const snappedRouteStart =
    chosenRoute
      ?.floodflow_snapped_start
      ?? null;

  const startSnapDistance =
    chosenRoute
      ?.floodflow_start_snap_m
      ?? null;

  const routeSteps =
    flattenRouteSteps(
      chosenRoute
    );

  const routeArrivalTime =
    chosenRoute
      ? new Date(
          Date.now() +
          chosenRoute
            .durationMinutes *
          60 *
          1000
        ).toLocaleTimeString(
          "en-IN",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }
        )
      : null;

  const liveSelected =
    riskByName[selected.name] ||
    calculateLiveRisk(
      selected.baseScore,
      rainfall24
    );

  const highRiskCount = useMemo(() => {
    if (risks.length) {
      return risks.filter(
        (risk) =>
          risk.level === "High" ||
          risk.level === "Very High"
      ).length;
    }

    return hotspots.filter((location) => {
      const result =
        calculateLiveRisk(
          location.baseScore,
          rainfall24
        );

      return (
        result.level === "High" ||
        result.level === "Very High"
      );
    }).length;
  }, [risks, rainfall24]);

  return (
    <div className="app-shell">

      {/* TOP HEADER */}
      <header className="topbar">

        <div className="brand">
          <div className="brand-mark">
            F
          </div>

          <div className="brand-copy">
            <strong>
              FloodFlow
            </strong>

            <span>
              Guwahati flood intelligence
            </span>
          </div>
        </div>

        <div className="locality-search">
          <span className="search-icon">
            ⌕
          </span>

          <input
            list="floodflow-localities"
            value={search}
            placeholder="Search locality"
            onChange={(event) =>
              setSearch(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                runSearch();
              }
            }}
          />

          <datalist id="floodflow-localities">
            {hotspots.map((place) => (
              <option
                key={place.name}
                value={place.name}
              />
            ))}
          </datalist>

          <button
            type="button"
            onClick={runSearch}
          >
            Go
          </button>
        </div>

        <div className="topbar-status">
          <span className="source-pill">
            OPEN-METEO
          </span>

          <span className="live-dot" />

          <span>
            Live monitoring
          </span>
        </div>

      </header>


      {/* LEFT NAVIGATION */}
      <aside className="nav-rail">

        <div className="nav-group">

          <button
            className={`rail-item ${
              !routeMode &&
              !drainageMode &&
              !terrainMode
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() => {
              setRouteMode(false);
              setDrainageMode(false);
              setTerrainMode(false);
            }}
          >
            <span className="rail-icon">
              ⌖
            </span>

            <span>
              Map
            </span>
          </button>

          <button
            className={`rail-item ${
              showRiskLayer
                ? "selected"
                : ""
            }`}
            type="button"
            onClick={() => {
              setDrainageMode(false);
              setTerrainMode(false);
              setShowRiskLayer(
                (value) => !value
              );
            }}
          >
            <span className="rail-icon">
              △
            </span>

            <span>
              Risk
            </span>
          </button>

          <button
            className={`rail-item ${
              showReportLayer
                ? "selected"
                : ""
            }`}
            type="button"
            onClick={() => {
              setDrainageMode(false);
              setTerrainMode(false);
              setShowReportLayer(
                (value) => !value
              );
            }}
          >
            <span className="rail-icon">
              ◎
            </span>

            <span>
              Reports
            </span>
          </button>

          <button
            className={`rail-item ${
              routeMode ? "active" : ""
            }`}
            type="button"
            onClick={() => {
              setDrainageMode(false);
              setTerrainMode(false);
              openRouteMode();
            }}
          >
            <span className="rail-icon">
              ↗
            </span>

            <span>
              Routes
            </span>
          </button>

          <button
            className={`rail-item ${
              drainageMode
                ? "active"
                : ""
            }`}
            type="button"
            onClick={openDrainageMode}
          >
            <span className="rail-icon">
              ≋
            </span>

            <span>
              Drains
            </span>
          </button>

          <button
            className={`rail-item ${
              terrainMode
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() => {
              setRouteMode(false);
              setDrainageMode(false);
              setTerrainMode(true);
              setShowHillshadeLayer(true);
            }}
          >
            <span className="rail-icon">
              ∿
            </span>

            <span>
              Terrain
            </span>
          </button>

        </div>

        <button
          className="rail-report"
          type="button"
          onClick={() =>
            setShowReport(true)
          }
        >
          <span>
            +
          </span>

          Report
        </button>

      </aside>


      {/* MAP */}
      <main className="map-stage">

        <MapContainer
          center={[26.1445, 91.7362]}
          zoom={12}
          zoomControl={false}
          className="main-map"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {showRadarLayer && radar?.tile_url && (
            <TileLayer
              url={radar.tile_url}
              opacity={drainageMode ? 0.20 : 0.58}
              maxNativeZoom={7}
              maxZoom={18}
              zIndex={350}
              attribution="Weather radar &copy; RainViewer"
            />
          )}

          {showDrainageLayer &&
            drainage.map(
              (feature) => {

                const positions =
                  feature.coordinates.map(
                    ([lng, lat]) => [
                      lat,
                      lng,
                    ]
                  );

                const isCanal =
                  feature.type === "canal";

                const isDitch =
                  feature.type === "ditch";

                const innerColor =
                  isCanal
                    ? "#006e82"
                    : isDitch
                    ? "#5e95a2"
                    : "#0788a0";

                const innerWeight =
                  isCanal
                    ? 4.6
                    : isDitch
                    ? 2.1
                    : 3.2;

                const casingWeight =
                  innerWeight + 3.2;

                const dashArray =
                  isDitch
                    ? "7 6"
                    : undefined;

                const label =
                  feature.name ||
                  (
                    isCanal
                      ? "Mapped canal"
                      : isDitch
                      ? "Mapped ditch"
                      : "Mapped storm drain"
                  );

                return (
                  <div
                    key={`drainage-group-${feature.id}`}
                  >
                    <Polyline
                      positions={positions}
                      interactive={false}
                      pathOptions={{
                        color:
                          drainageMode
                            ? "#ffffff"
                            : "#eef7f8",
                        weight:
                          casingWeight,
                        opacity:
                          drainageMode
                            ? 0.95
                            : 0.78,
                        lineCap: "round",
                        lineJoin: "round",
                        dashArray,
                      }}
                    />

                    <Polyline
                      positions={positions}
                      pathOptions={{
                        color:
                          innerColor,
                        weight:
                          innerWeight,
                        opacity:
                          drainageMode
                            ? 1
                            : 0.90,
                        lineCap: "round",
                        lineJoin: "round",
                        dashArray,
                      }}
                    >
                      <Tooltip
                        sticky
                        direction="top"
                        className="drainage-tooltip"
                      >
                        <strong>
                          {label}
                        </strong>

                        <span>
                          {feature.type}
                        </span>
                      </Tooltip>

                      <Popup>
                        <div className="map-popup drainage-popup">

                          <strong>
                            {label}
                          </strong>

                          <span>
                            Type:
                            {" "}
                            {feature.type}
                          </span>

                          {feature.width && (
                            <span>
                              Width:
                              {" "}
                              {feature.width}
                            </span>
                          )}

                          <span>
                            Source:
                            {" "}
                            OpenStreetMap / Overpass
                          </span>

                          <small>
                            Geometry only — live
                            blockage, capacity and
                            water level are not
                            inferred from OSM.
                          </small>

                        </div>
                      </Popup>
                    </Polyline>
                  </div>
                );
              }
            )}

          {showHillshadeLayer && (
            <TileLayer
              url="https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}"
              opacity={drainageMode ? 0.20 : 0.32}
              zIndex={320}
              className="terrain-hillshade"
              attribution="Hillshade &copy; Esri and contributors"
            />
          )}

          <ZoomControl
            position="bottomright"
          />

          <MapFocus
            place={selected}
          />


          {/* SAFE ROUTE */}
          {routeMode &&
            routeOptions.map(
              (route, index) => {
                const positions =
                  route.geometry.coordinates.map(
                    ([lng, lat]) => [
                      lat,
                      lng,
                    ]
                  );

                const selectedRoute =
                  chosenRoute === route;

                return (
                  <Polyline
                    key={`route-${index}`}
                    positions={positions}
                    pathOptions={{
                      color:
                        route.crossesDemoFlood
                          ? selectedRoute
                            ? "#a53b32"
                            : "#b96b62"
                          : selectedRoute
                          ? navigationActive
                            ? "#126f88"
                            : "#0f6270"
                          : "#7b878e",
                      weight:
                        selectedRoute
                          ? 7
                          : 4,
                      opacity:
                        selectedRoute
                          ? 0.96
                          : 0.28,
                      dashArray:
                        route.crossesDemoFlood
                          ? "10 7"
                          : undefined,
                    }}
                    eventHandlers={{
                      click: () =>
                        setChosenRoute(route),
                    }}
                  />
                );
              }
            )}

          {routeMode &&
            routeStartPoint && (
              <CircleMarker
                center={[
                  routeStartPoint.lat,
                  routeStartPoint.lng,
                ]}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#173f49",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  Route start
                </Popup>
              </CircleMarker>
            )}

          {routeMode &&
            routeDestinationPoint && (
              <CircleMarker
                center={[
                  routeDestinationPoint.lat,
                  routeDestinationPoint.lng,
                ]}
                radius={8}
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#111c23",
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Popup>
                  Destination:
                  {" "}
                  {routeDestinationLabel}
                </Popup>
              </CircleMarker>
            )}

          {navigationActive &&
            navigationPoint && (
              <>
                <CircleMarker
                  center={[
                    navigationPoint.lat,
                    navigationPoint.lng,
                  ]}
                  radius={14}
                  interactive={false}
                  pathOptions={{
                    color: "#2b7f96",
                    fillColor: "#2b7f96",
                    fillOpacity: 0.12,
                    weight: 1,
                  }}
                />

                <CircleMarker
                  center={[
                    navigationPoint.lat,
                    navigationPoint.lng,
                  ]}
                  radius={6}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: "#18677b",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    Current GPS position
                    {navigationAccuracy
                      ? ` · ±${Math.round(
                          navigationAccuracy
                        )} m`
                      : ""}
                  </Popup>
                </CircleMarker>
              </>
            )}

          <RouteMapPicker
            enabled={
              routeMode &&
              (
                routePickingStart ||
                routePickingDestination
              )
            }
            onPick={(point) => {
              if (routePickingStart) {
                chooseStartPoint(
                  point
                );
                return;
              }

              chooseDestination(
                point,
                "Pinned destination"
              );
            }}
          />

          <NavigationFollower
            active={navigationActive}
            point={navigationPoint}
          />

          {routeMode &&
            routeStartPoint &&
            snappedRouteStart &&
            startSnapDistance > 20 && (
              <Polyline
                positions={[
                  [
                    routeStartPoint.lat,
                    routeStartPoint.lng,
                  ],
                  [
                    snappedRouteStart.lat,
                    snappedRouteStart.lng,
                  ],
                ]}
                pathOptions={{
                  color: "#53666d",
                  weight: 2,
                  opacity: 0.75,
                  dashArray: "5 5",
                }}
              >
                <Popup>
                  Routing engine snapped the
                  start point
                  {" "}
                  {Math.round(
                    startSnapDistance
                  )}
                  {" "}m to a drivable road.
                </Popup>
              </Polyline>
            )}

          {routeMode &&
            chosenRoute && (
              <RouteFocus
                route={chosenRoute}
              />
            )}


          {/* DEMO FLOOD STRESS-TEST ZONES */}
          {routeMode &&
            demoFloodScenario &&
            demoFloodZones.map(
              (zone) => (
                <Circle
                  key={zone.name}
                  center={[
                    zone.lat,
                    zone.lng,
                  ]}
                  radius={zone.radius_m}
                  pathOptions={{
                    color:
                      zone.level === "Very High"
                        ? "#a92f2b"
                        : "#c96727",
                    fillColor:
                      zone.level === "Very High"
                        ? "#c54338"
                        : "#df7a2b",
                    fillOpacity: 0.24,
                    weight: 2,
                    dashArray: "7 5",
                  }}
                >
                  <Popup>
                    <div className="map-popup demo-flood-popup">
                      <strong>
                        {zone.name}
                      </strong>

                      <span>
                        {zone.level}
                        {" "}simulated flood zone
                      </span>

                      <small>
                        DEMO ONLY — used to
                        stress-test safer routing.
                      </small>
                    </div>
                  </Popup>
                </Circle>
              )
            )}


          {/* RISK MARKERS */}
          {showRiskLayer &&
            hotspots.map((place) => {

              const liveRisk =
                riskByName[place.name] ||
                calculateLiveRisk(
                  place.baseScore,
                  rainfall24
                );

              return (
                <CircleMarker
                  key={place.name}
                  center={[
                    place.lat,
                    place.lng,
                  ]}
                  radius={
                    drainageMode
                      ? place.name ===
                        selected.name
                        ? 8
                        : 5
                      : place.name ===
                        selected.name
                      ? 12
                      : 9
                  }
                  pathOptions={{
                    color: "#ffffff",
                    fillColor:
                      getRiskColor(
                        liveRisk.level
                      ),
                    fillOpacity:
                      drainageMode
                        ? 0.38
                        : 0.92,
                    weight:
                      place.name ===
                      selected.name
                        ? 3
                        : 2,
                  }}
                  eventHandlers={{
                    click: () =>
                      setSelected(place),
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <strong>
                        {place.name}
                      </strong>

                      <span>
                        {liveRisk.level}
                        {" "}risk
                      </span>

                      <span>
                        Prototype index:
                        {" "}
                        {liveRisk.score}/100
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}


          {/* CITIZEN REPORT MARKERS */}
          {showReportLayer &&
            reports.map((report) => (
              <CircleMarker
                key={`report-${report.id}`}
                center={[
                  report.latitude,
                  report.longitude,
                ]}
                radius={
                  drainageMode
                    ? 5
                    : 7
                }
                pathOptions={{
                  color: "#ffffff",
                  fillColor: "#287c95",
                  fillOpacity:
                    drainageMode
                      ? 0.42
                      : 0.95,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="map-popup">

                    <strong>
                      {report.locality ||
                        "Citizen flood report"}
                    </strong>

                    <span>
                      Water depth:
                      {" "}
                      {report.water_depth_cm}
                      {" "}cm
                    </span>

                    <span>
                      Road:
                      {" "}
                      {report.road_status}
                    </span>

                    <span>
                      {report.verified
                        ? "Verified"
                        : "Unverified"}
                    </span>

                  </div>
                </Popup>
              </CircleMarker>
            ))}

        </MapContainer>


        {/* MAP TITLE */}
        <div className="map-title-block">
          <span className="eyebrow">
            OPERATIONS MAP
          </span>

          <h1>
            {drainageMode
              ? "Guwahati drainage network"
              : "Guwahati flood conditions"}
          </h1>

          <p>
            {drainageMode
              ? "Mapped storm drains, ditches and canals"
              : "Historical vulnerability + live rainfall input"}
          </p>
        </div>

        {drainageMode && (
          <div className="drainage-focus-chip">
            <div>
              <span className="eyebrow">
                DRAINAGE FOCUS
              </span>

              <strong>
                {drainage.length}
                {" "}mapped ways
              </strong>
            </div>

            <div className="drainage-focus-counts">
              <span>
                {drainageCounts.canal || 0}
                {" "}canals
              </span>

              <span>
                {drainageCounts.drain || 0}
                {" "}drains
              </span>

              <span>
                {drainageCounts.ditch || 0}
                {" "}ditches
              </span>
            </div>
          </div>
        )}


        {/* LAYERS */}
        <div className="layer-panel">

          <span className="eyebrow">
            LAYERS
          </span>

          <label>
            <input
              type="checkbox"
              checked={showRiskLayer}
              onChange={() =>
                setShowRiskLayer(
                  (value) => !value
                )
              }
            />

            <span>
              Flood-risk points
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={showReportLayer}
              onChange={() =>
                setShowReportLayer(
                  (value) => !value
                )
              }
            />

            <span>
              Citizen reports
            </span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={showRadarLayer}
              disabled={!radar}
              onChange={() =>
                setShowRadarLayer(
                  (value) => !value
                )
              }
            />

            <span>
              Rain radar
            </span>

            <small className="radar-live-label">
              {radar ? "live" : "offline"}
            </small>
          </label>

          <label>
            <input
              type="checkbox"
              checked={showDrainageLayer}
              disabled={loadingDrainage}
              onChange={enableDrainageLayer}
            />

            <span>
              Stormwater network
            </span>

            <small
              className={`drainage-live-label ${
                drainageError &&
                !drainage.length
                  ? "offline"
                  : ""
              }`}
            >
              {loadingDrainage
                ? "syncing"
                : drainage.length
                ? `${drainage.length}`
                : drainageError
                ? "retry"
                : "load"}
            </small>
          </label>

          <label>
            <input
              type="checkbox"
              checked={showHillshadeLayer}
              onChange={() =>
                setShowHillshadeLayer(
                  (value) => !value
                )
              }
            />

            <span>
              Terrain hillshade
            </span>

            <small className="terrain-live-label">
              DEM
            </small>
          </label>

          <div className="radar-feed-status">
            <span>
              {radarError
                ? radarError
                : radarUpdated
                ? `Radar frame ${radarUpdated} IST`
                : "Loading radar feed..."}
            </span>
            <small>
              RainViewer
            </small>
          </div>

          <div className="drainage-feed-status">
            <span>
              {loadingDrainage
                ? "Syncing mapped drainage..."
                : drainage.length
                ? `${drainage.length} mapped waterway features ready`
                : drainageError
                ? `${drainageError} — toggle to retry`
                : "Drainage loads only when requested"}
            </span>

            <small>
              OpenStreetMap / Overpass
            </small>
          </div>

          <div className="terrain-feed-status">
            <span>
              {terrainError
                ? terrainError
                : loadingTerrain
                ? "Loading elevation samples..."
                : `${hotspotElevations.length} locality elevations loaded`}
            </span>

            <small>
              Copernicus DEM GLO-90 / Open-Meteo
            </small>
          </div>

        </div>


        {/* LEGEND */}
        <div className="map-legend">

          <span>
            <i className="legend-swatch low" />
            Low
          </span>

          <span>
            <i className="legend-swatch medium" />
            Medium
          </span>

          <span>
            <i className="legend-swatch high" />
            High
          </span>

          <span>
            <i className="legend-swatch very-high" />
            Very high
          </span>

          <span>
            <i className="legend-swatch report" />
            Citizen
          </span>

          {showDrainageLayer && (
            <>
              <span>
                <i className="legend-line canal" />
                Canal
              </span>

              <span>
                <i className="legend-line drain" />
                Drain
              </span>

              <span>
                <i className="legend-line ditch" />
                Ditch
              </span>
            </>
          )}

          {showHillshadeLayer && (
            <span>
              <i className="legend-box hillshade" />
              Hillshade
            </span>
          )}

        </div>

      </main>


      {/* RIGHT PANEL */}
      <aside className="intel-panel">

        {routeMode ? (

          <div className="route-panel-content smart-route-panel">

            <div className="panel-heading">

              <div>
                <span className="eyebrow">
                  FLOODFLOW NAVIGATION
                </span>

                <h2>
                  Smart route
                </h2>
              </div>

              <button
                type="button"
                className="panel-report-button"
                onClick={() => {
                  stopNavigation();
                  setRouteMode(false);
                }}
              >
                MAP
              </button>

            </div>


            <div className="route-disclaimer smart">
              <span className="model-tag">
                LIVE
              </span>

              Google-like navigation UX using
              OpenStreetMap routing plus FloodFlow
              flood-risk intelligence. Live traffic
              congestion is not available in this
              free prototype.
            </div>


            <section className="panel-section smart-route-search">

              <div className="route-mode-switch">

                <button
                  type="button"
                  className={
                    routePreference === "safest"
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setRoutePreference("safest");
                    setRouteOptions([]);
                    setChosenRoute(null);
                  }}
                >
                  Safer
                </button>

                <button
                  type="button"
                  className={
                    routePreference === "fastest"
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setRoutePreference("fastest");
                    setRouteOptions([]);
                    setChosenRoute(null);
                  }}
                >
                  Fastest
                </button>

              </div>


              <div className="route-stress-controls">

                <label>
                  <input
                    type="checkbox"
                    checked={demoFloodScenario}
                    onChange={(event) => {
                      setDemoFloodScenario(
                        event.target.checked
                      );

                      setRouteOptions([]);
                      setChosenRoute(null);
                    }}
                  />

                  <span>
                    Demo flood stress test
                  </span>

                  <small>
                    {demoFloodScenario
                      ? `${demoFloodZones.length} simulated zones`
                      : "off"}
                  </small>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={sideRoadDetours}
                    onChange={(event) => {
                      setSideRoadDetours(
                        event.target.checked
                      );

                      setRouteOptions([]);
                      setChosenRoute(null);
                    }}
                  />

                  <span>
                    Explore side-road detours
                  </span>

                  <small>
                    residential / service roads
                  </small>
                </label>

              </div>


              {demoFloodScenario && (
                <div className="demo-route-warning">
                  <strong>
                    SIMULATION
                  </strong>

                  <span>
                    Extra flooded areas are synthetic
                    and exist only to test whether
                    FloodFlow can find smaller-road
                    detours. They are not current
                    flood observations.
                  </span>
                </div>
              )}


              <label className="route-field">
                Start

                <select
                  value={routeStartMode}
                  onChange={(event) => {
                    setRouteStartMode(
                      event.target.value
                    );

                    setRouteOptions([]);
                    setChosenRoute(null);
                    setNavigationActive(false);
                  }}
                >
                  <option value="gps">
                    My current location
                  </option>

                  <option value="selected">
                    Selected locality — {selected.name}
                  </option>

                  <option value="map">
                    Pick start on map
                  </option>
                </select>
              </label>


              {routeStartMode === "gps" && (

                <button
                  type="button"
                  className="route-location-button"
                  onClick={async () => {
                    setRouteMessage(
                      "Getting your location..."
                    );

                    try {
                      const point =
                        await getRouteGpsLocation();

                      setNavigationPoint(point);

                      setRouteMessage(
                        `GPS ready · ${point.lat.toFixed(
                          5
                        )}, ${point.lng.toFixed(
                          5
                        )}`
                      );
                    } catch (error) {
                      setRouteMessage(
                        error.message
                      );
                    }
                  }}
                >
                  <span>
                    ◎
                  </span>

                  {routeGps
                    ? "Refresh current location"
                    : "Use current location"}
                </button>

              )}

              {routeStartMode === "map" && (

                <div className="manual-start-box">

                  <button
                    type="button"
                    className={
                      routePickingStart
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setRoutePickingDestination(false);
                      setRoutePickingStart(
                        (value) => !value
                      );
                    }}
                  >
                    {routePickingStart
                      ? "Click map to set start..."
                      : "Pick start on map"}
                  </button>

                  <span>
                    {routeManualStart
                      ? `${routeManualStart.lat.toFixed(
                          5
                        )}, ${routeManualStart.lng.toFixed(
                          5
                        )}`
                      : "No start point selected"}
                  </span>

                </div>

              )}


              <div className="smart-destination-field">

                <label>
                  Destination
                </label>

                <div className="smart-search-input">

                  <span>
                    ⌕
                  </span>

                  <input
                    value={routeSearch}
                    placeholder="Search any place in Guwahati"
                    onChange={(event) =>
                      setRouteSearch(
                        event.target.value
                      )
                    }
                  />

                  {routeSearchLoading && (
                    <small>
                      searching
                    </small>
                  )}

                </div>


                {routeSuggestions.length > 0 && (

                  <div className="route-suggestions">

                    {routeSuggestions.map(
                      (place) => (

                        <button
                          key={
                            place.id ||
                            `${place.lat}-${place.lng}`
                          }
                          type="button"
                          onClick={() =>
                            chooseDestination(
                              place,
                              place.label
                            )
                          }
                        >
                          <strong>
                            {place.name}
                          </strong>

                          <span>
                            {place.label}
                          </span>
                        </button>

                      )
                    )}

                  </div>

                )}


                <div className="destination-selected">

                  <div>
                    <span>
                      Destination
                    </span>

                    <strong>
                      {routeDestinationLabel}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className={
                      routePickingDestination
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setRoutePickingStart(false);
                      setRoutePickingDestination(
                        (value) => !value
                      );
                    }}
                  >
                    {routePickingDestination
                      ? "Click map..."
                      : "Pick on map"}
                  </button>

                </div>

              </div>


              <div className="route-quick-places">

                {hotspots
                  .slice(0, 6)
                  .map(
                    (place) => (

                      <button
                        key={`quick-${place.name}`}
                        type="button"
                        onClick={() =>
                          chooseDestination(
                            place,
                            place.name
                          )
                        }
                      >
                        {place.name}
                      </button>

                    )
                  )}

              </div>


              <button
                type="button"
                className="route-calculate"
                onClick={handleFindRoute}
                disabled={
                  routeLoading ||
                  !routeDestinationPoint
                }
              >
                {routeLoading
                  ? "Finding route..."
                  : routePreference === "safest"
                  ? "Find safer route"
                  : "Find fastest route"}

                <span>
                  ↗
                </span>
              </button>


              {routeMessage && (
                <div className="route-message">
                  {routeMessage}
                </div>
              )}

              {chosenRoute &&
                startSnapDistance !== null &&
                startSnapDistance > 20 && (
                  <div
                    className={`start-snap-warning ${
                      startSnapDistance > 300
                        ? "strong"
                        : ""
                    }`}
                  >
                    <strong>
                      Start snapped to road
                    </strong>

                    <span>
                      {Math.round(
                        startSnapDistance
                      )}
                      {" "}m from the location you supplied.
                      {startSnapDistance > 300
                        ? " If this looks wrong, use Pick start on map."
                        : ""}
                    </span>
                  </div>
                )}

            </section>


            {chosenRoute && (

              <>

                <section className="panel-section navigation-summary">

                  <div className="navigation-eta">

                    <div>
                      <strong>
                        {Math.round(
                          chosenRoute.durationMinutes
                        )}
                      </strong>

                      <span>
                        min
                      </span>
                    </div>

                    <div>
                      <strong>
                        {formatNumber(
                          chosenRoute.distanceKm,
                          1
                        )}
                      </strong>

                      <span>
                        km
                      </span>
                    </div>

                    <div>
                      <strong>
                        {routeArrivalTime}
                      </strong>

                      <span>
                        ETA
                      </span>
                    </div>

                  </div>


                  <div className="route-risk-banner">

                    <div>
                      <span>
                        Flood exposure
                      </span>

                      <strong>
                        {routeRiskLabel(
                          chosenRoute.floodPenalty,
                          chosenRoute.blockedReports
                        )}
                      </strong>
                    </div>

                    <div className="route-risk-score">
                      {Math.round(
                        chosenRoute.floodPenalty
                      )}
                    </div>

                  </div>


                  <div className="route-action-row">

                    {!navigationActive ? (

                      <button
                        type="button"
                        className="start-navigation"
                        onClick={startNavigation}
                      >
                        Start navigation
                      </button>

                    ) : (

                      <button
                        type="button"
                        className="stop-navigation"
                        onClick={stopNavigation}
                      >
                        Stop
                      </button>

                    )}

                    <button
                      type="button"
                      className="route-refresh"
                      onClick={handleFindRoute}
                      disabled={routeLoading}
                    >
                      Refresh
                    </button>

                  </div>


                  <label className="voice-route-toggle">

                    <input
                      type="checkbox"
                      checked={voiceNavigation}
                      onChange={(event) =>
                        setVoiceNavigation(
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      Voice directions
                    </span>

                    {navigationActive &&
                      navigationAccuracy && (
                        <small>
                          GPS ±
                          {Math.round(
                            navigationAccuracy
                          )}
                          {" "}m
                        </small>
                      )}

                  </label>

                </section>


                {routeOptions.length > 1 && (

                  <section className="panel-section">

                    <div className="section-title">

                      <h3>
                        Route options
                      </h3>

                      <span>
                        tap to compare
                      </span>

                    </div>

                    <div className="smart-route-options">

                      {routeOptions.map(
                        (route, index) => {

                          const selectedRoute =
                            route === chosenRoute;

                          return (
                            <button
                              key={`smart-route-${index}`}
                              type="button"
                              className={
                                selectedRoute
                                  ? "active"
                                  : ""
                              }
                              onClick={() =>
                                setChosenRoute(route)
                              }
                            >
                              <div>
                                <strong>
                                  {index === 0
                                    ? routePreference === "safest"
                                      ? "Recommended safer"
                                      : "Recommended fastest"
                                    : `Alternative ${index}`}
                                </strong>

                                <span
                                  className={
                                    route
                                      .demoFloodIntersections
                                      .length
                                      ? "route-crossing-warning"
                                      : "route-clear-status"
                                  }
                                >
                                  {route
                                    .demoFloodIntersections
                                    .length
                                    ? `Crosses ${route.demoFloodIntersections.length} demo flood zone${route.demoFloodIntersections.length === 1 ? "" : "s"}`
                                    : "Avoids demo flood zones"}
                                </span>
                              </div>

                              <div>
                                <strong>
                                  {Math.round(
                                    route.durationMinutes
                                  )} min
                                </strong>

                                <span>
                                  {formatNumber(
                                    route.distanceKm,
                                    1
                                  )} km
                                </span>
                              </div>
                            </button>
                          );
                        }
                      )}

                    </div>

                  </section>

                )}


                <section className="panel-section">

                  <div className="section-title">

                    <h3>
                      Directions
                    </h3>

                    <span>
                      {routeSteps.length}
                      {" "}steps
                    </span>

                  </div>

                  <div className="turn-by-turn-list">

                    {routeSteps
                      .slice(0, 12)
                      .map(
                        (step, index) => (

                          <div
                            key={`turn-${index}-${step.distance}`}
                            className="turn-step"
                          >
                            <span className="turn-icon">
                              {getTurnIcon(
                                step
                              )}
                            </span>

                            <div>
                              <strong>
                                {getTurnInstruction(
                                  step
                                )}
                              </strong>

                              <span>
                                {step.distance < 1000
                                  ? `${Math.round(
                                      step.distance
                                    )} m`
                                  : `${formatNumber(
                                      step.distance / 1000,
                                      1
                                    )} km`}
                              </span>
                            </div>
                          </div>

                        )
                      )}

                    {routeSteps.length > 12 && (
                      <div className="more-turns">
                        +
                        {routeSteps.length - 12}
                        {" "}more directions
                      </div>
                    )}

                  </div>

                </section>


                <section className="panel-section">

                  <h3>
                    Flood checks
                  </h3>

                  <div className="route-safety-summary">

                    <div>
                      <span>
                        High-risk areas near route
                      </span>

                      <strong>
                        {
                          chosenRoute
                            .nearbyRisks
                            .length
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Citizen reports near route
                      </span>

                      <strong>
                        {
                          chosenRoute
                            .nearbyReports
                            .length
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Blocked-road reports
                      </span>

                      <strong>
                        {
                          chosenRoute
                            .blockedReports
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Flood zones crossed
                      </span>

                      <strong
                        className={
                          chosenRoute
                            .demoFloodIntersections
                            .length
                            ? "danger-number"
                            : "safe-number"
                        }
                      >
                        {
                          chosenRoute
                            .demoFloodIntersections
                            .length
                        }
                      </strong>
                    </div>

                  </div>


                  <ul className="factor-list">

                    {chosenRoute.nearbyRisks
                      .slice(0, 3)
                      .map((item) => (
                        <li key={item.name}>
                          {item.level}
                          {" "}risk near
                          {" "}
                          {item.name}
                        </li>
                      ))}

                    {chosenRoute.nearbyReports
                      .slice(0, 3)
                      .map((item) => (
                        <li
                          key={`route-report-${item.id}`}
                        >
                          {item.roadStatus}
                          {" "}report near
                          {" "}
                          {item.locality}
                        </li>
                      ))}

                    {!chosenRoute.nearbyRisks.length &&
                      !chosenRoute.nearbyReports.length && (
                        <li>
                          No current FloodFlow
                          hazard observations are
                          close to this route.
                        </li>
                      )}

                  </ul>

                </section>

              </>

            )}


            <div className="route-source-note">
              Road routing: OSRM / OpenStreetMap.
              Search: OSM Nominatim. Flood exposure
              ranking: FloodFlow. When the demo stress
              test is enabled, extra synthetic flood
              zones and side-road detour candidates
              are used only for testing. No Google
              traffic or official emergency-routing
              feed is used.
            </div>

          </div>

        ) : drainageMode ? (

          <div className="drainage-intel-panel">

            <div className="panel-heading">

              <div>
                <span className="eyebrow">
                  DRAINAGE INTELLIGENCE
                </span>

                <h2>
                  {selected.name}
                </h2>
              </div>

              <button
                type="button"
                className="panel-report-button"
                onClick={() => {
                  setDrainageMode(false);
                }}
              >
                MAP
              </button>

            </div>


            <div className="drainage-mode-note">
              <span className="model-tag">
                MULTI-SOURCE
              </span>

              OSM mapped waterways +
              published drainage assets /
              projects. Present blockage and
              hydraulic condition are not yet
              available from a live official feed.
            </div>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  Selected locality
                </h3>

                <span className="model-tag">
                  {selected.basin}
                </span>

              </div>

              <div className="drainage-kpi-grid">

                <div>
                  <span>
                    Nearest mapped drain
                  </span>

                  <strong>
                    {nearestDrainage
                      ? `${Math.round(
                          nearestDrainage.distance
                        )} m`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    OSM mapped ways
                  </span>

                  <strong>
                    {drainage.length}
                  </strong>
                </div>

                <div>
                  <span>
                    Related published assets
                  </span>

                  <strong>
                    {relatedDrainageAssets.length}
                  </strong>
                </div>

              </div>

              <div className="data-quality-box">
                <strong>
                  Interpretation
                </strong>

                <span>
                  Distance is calculated only
                  against OSM-mapped drainage,
                  so missing map features can
                  make the nearest distance look
                  larger than reality.
                </span>
              </div>

            </section>


            <section className="panel-section">

              <h3>
                Published infrastructure
              </h3>

              <div className="asset-overview-grid">

                <div>
                  <span>
                    Total records
                  </span>
                  <strong>
                    {drainageAssets.length}
                  </strong>
                </div>

                <div>
                  <span>
                    Completed
                  </span>
                  <strong>
                    {completedAssetCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Ongoing / tender
                  </span>
                  <strong>
                    {ongoingAssetCount}
                  </strong>
                </div>

                <div>
                  <span>
                    Capacity published
                  </span>
                  <strong>
                    {knownCapacityAssetCount}
                  </strong>
                </div>

              </div>


              {relatedDrainageAssets.length > 0 && (

                <div className="related-assets">

                  <span className="eyebrow">
                    RELATED TO THIS LOCALITY / BASIN
                  </span>

                  {relatedDrainageAssets.map(
                    (asset) => (
                      <div
                        key={`related-${asset.id}`}
                        className="asset-card compact"
                      >
                        <div className="asset-card-heading">
                          <strong>
                            {asset.name}
                          </strong>

                          <span>
                            {asset.source}
                          </span>
                        </div>

                        <p>
                          {asset.location}
                        </p>

                        <small>
                          {asset.status}
                        </small>
                      </div>
                    )
                  )}

                </div>

              )}

            </section>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  Asset register
                </h3>

                <span>
                  Published seed dataset
                </span>

              </div>


              <div className="asset-filters">

                {[
                  ["all", "All"],
                  ["completed", "Completed"],
                  ["ongoing", "Ongoing"],
                  ["published", "Historical / other"],
                ].map(
                  ([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        assetFilter === value
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setAssetFilter(value)
                      }
                    >
                      {label}
                    </button>
                  )
                )}

              </div>


              <div className="asset-list">

                {filteredDrainageAssets.map(
                  (asset) => (

                    <div
                      key={asset.id}
                      className="asset-card"
                    >

                      <div className="asset-card-heading">

                        <strong>
                          {asset.name}
                        </strong>

                        <span>
                          {asset.source}
                        </span>

                      </div>

                      <p>
                        {asset.location}
                      </p>

                      <div className="asset-meta">

                        <span>
                          {asset.type}
                        </span>

                        {asset.length_m !== null && (
                          <span>
                            {asset.length_m} m
                          </span>
                        )}

                        {asset.capacity_cumec !== null && (
                          <span>
                            {asset.capacity_cumec} cumec
                          </span>
                        )}

                        {asset.shutters !== null && (
                          <span>
                            {asset.shutters} shutters
                          </span>
                        )}

                        {asset.pump_count !== null && (
                          <span>
                            {asset.pump_count} pumps
                          </span>
                        )}

                      </div>

                      <div className="asset-status-row">

                        <span
                          className={`asset-status ${getAssetStatusGroup(
                            asset
                          )}`}
                        >
                          {asset.status}
                        </span>

                        {asset.cost_lakh !== null && (
                          <small>
                            ₹
                            {formatNumber(
                              asset.cost_lakh,
                              2
                            )}
                            {" "}lakh
                          </small>
                        )}

                      </div>

                    </div>

                  )
                )}

              </div>

            </section>


            <section className="panel-section">

              <h3>
                Condition data gaps
              </h3>

              <ul className="data-gap-list">
                <li>
                  Current blockage /
                  obstruction — unavailable
                </li>

                <li>
                  Silt depth — unavailable
                </li>

                <li>
                  Drain water level —
                  unavailable
                </li>

                <li>
                  Real-time pump status —
                  unavailable
                </li>

                <li>
                  Most hydraulic capacities —
                  not published
                </li>
              </ul>

              <div className="data-quality-box warning">
                <strong>
                  Next data layer
                </strong>

                <span>
                  Field inspection or IoT
                  measurements should populate
                  these fields before drainage
                  condition is used directly in
                  the flood-risk score.
                </span>
              </div>

            </section>


            <div className="route-source-note">
              Infrastructure values are
              historical / published seed
              records from ASDMA, GMC and GMDA.
              Null values remain unknown rather
              than being estimated.
            </div>

          </div>

        ) : terrainMode ? (

          <div className="terrain-intel-panel">

            <div className="panel-heading">

              <div>
                <span className="eyebrow">
                  TERRAIN INTELLIGENCE
                </span>

                <h2>
                  {selected.name}
                </h2>
              </div>

              <button
                type="button"
                className="panel-report-button"
                onClick={() =>
                  setTerrainMode(false)
                }
              >
                MAP
              </button>

            </div>


            <div className="terrain-mode-note">
              <span className="model-tag">
                GLO-90
              </span>

              Elevation is sampled from the
              Copernicus DEM through Open-Meteo.
              The local-relief value compares
              nearby DEM samples; it is not a
              surveyed street-level height.
            </div>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  Selected terrain
                </h3>

                <span
                  className={`terrain-band ${
                    getTerrainBandClass(
                      terrainBand
                    )
                  }`}
                >
                  {terrainBand}
                </span>

              </div>


              <div className="terrain-kpi-grid">

                <div>
                  <span>
                    Elevation
                  </span>

                  <strong>
                    {selectedTerrain
                      ? `${formatNumber(
                          selectedTerrain.elevation_m,
                          0
                        )} m`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Local relief
                  </span>

                  <strong>
                    {selectedTerrain
                      ? `${formatNumber(
                          selectedTerrain.local_relief_m,
                          0
                        )} m`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Nearby sample min
                  </span>

                  <strong>
                    {selectedTerrain
                      ? `${formatNumber(
                          selectedTerrain.local_min_m,
                          0
                        )} m`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Nearby sample max
                  </span>

                  <strong>
                    {selectedTerrain
                      ? `${formatNumber(
                          selectedTerrain.local_max_m,
                          0
                        )} m`
                      : "—"}
                  </strong>
                </div>

              </div>


              <div className="data-quality-box">
                <strong>
                  Relative terrain band
                </strong>

                <span>
                  “Lower”, “Mid-range” and
                  “Higher” compare this locality
                  only with the FloodFlow hotspot
                  sample. They are not official
                  flood-hazard classes.
                </span>
              </div>

            </section>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  Elevation comparison
                </h3>

                <span>
                  hotspot sample
                </span>

              </div>

              <div className="terrain-ranking">

                {terrainRanking.map(
                  (item) => {

                    const band =
                      getTerrainBand(
                        item.terrain.elevation_m,
                        hotspotElevations
                      );

                    return (
                      <button
                        key={`terrain-${item.name}`}
                        type="button"
                        className={
                          item.name ===
                          selected.name
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setSelected(item)
                        }
                      >
                        <div>
                          <strong>
                            {item.name}
                          </strong>

                          <span>
                            {item.basin}
                          </span>
                        </div>

                        <div className="terrain-ranking-value">
                          <strong>
                            {formatNumber(
                              item.terrain.elevation_m,
                              0
                            )} m
                          </strong>

                          <span
                            className={
                              getTerrainBandClass(
                                band
                              )
                            }
                          >
                            {band}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}

              </div>

            </section>


            <section className="panel-section">

              <h3>
                Flood interpretation
              </h3>

              <ul className="factor-list">

                <li>
                  Lower terrain can increase
                  susceptibility to ponding,
                  but elevation alone does not
                  determine flood risk.
                </li>

                <li>
                  Local runoff depends on slope,
                  upstream catchment, drainage
                  capacity and obstruction.
                </li>

                <li>
                  FloodFlow will later combine
                  DEM-derived slope / flow with
                  rainfall, drainage and
                  historical flood evidence.
                </li>

              </ul>


              <button
                type="button"
                className="secondary-map-action strong"
                onClick={() =>
                  setShowHillshadeLayer(
                    (value) => !value
                  )
                }
              >
                {showHillshadeLayer
                  ? "Hide terrain hillshade"
                  : "Show terrain hillshade"}
              </button>

            </section>


            <div className="route-source-note">
              Elevation source: Copernicus
              DEM 2021 GLO-90 via Open-Meteo
              Elevation API. Hillshade is a
              visual terrain layer and should
              not be interpreted as measured
              flood depth.
            </div>

          </div>

        ) : (

          <>

            <div className="intel-summary">

              <div className="panel-heading">

                <div>
                  <span className="eyebrow">
                    SELECTED LOCALITY
                  </span>

                  <h2>
                    {selected.name}
                  </h2>
                </div>

                <button
                  type="button"
                  className="panel-report-button"
                  onClick={() => {
                    setForm((old) => ({
                      ...old,
                      locality:
                        selected.name,
                    }));

                    setShowReport(true);
                  }}
                >
                  + Report
                </button>

              </div>


              <div className="risk-hero">

                <div>
                  <span className="eyebrow">
                    FLOOD RISK INDEX
                  </span>

                  <strong>
                    {liveSelected.score}
                  </strong>

                  <small>
                    /100
                  </small>
                </div>

                <span
                  className="risk-label"
                  style={{
                    color:
                      getRiskColor(
                        liveSelected.level
                      ),
                    borderColor:
                      getRiskColor(
                        liveSelected.level
                      ),
                  }}
                >
                  {liveSelected.level}
                </span>

              </div>


              <div className="source-note">

                <span className="model-tag">
                  MODEL
                </span>

                {riskByName[selected.name]
                  ? "Explainable backend risk index — not an official flood warning."
                  : "Fallback prototype risk index — backend risk engine unavailable."}

              </div>

            </div>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  Live conditions
                </h3>

                <span>
                  {weather?.updated_at ||
                    "—"}
                </span>

              </div>

              <div className="metric-grid">

                <div>
                  <span>
                    Rain / 24 h
                  </span>

                  <strong>
                    {loadingWeather
                      ? "…"
                      : `${formatNumber(
                          rainfall24,
                          1
                        )} mm`}
                  </strong>
                </div>

                <div>
                  <span>
                    Current rain
                  </span>

                  <strong>
                    {formatNumber(
                      currentRain,
                      1
                    )} mm
                  </strong>
                </div>

                <div>
                  <span>
                    Temperature
                  </span>

                  <strong>
                    {formatNumber(
                      weather?.temperature_c,
                      1
                    )} °C
                  </strong>
                </div>

                <div>
                  <span>
                    Humidity
                  </span>

                  <strong>
                    {formatNumber(
                      weather?.humidity_percent
                    )}%
                  </strong>
                </div>

              </div>

            </section>


            <section className="panel-section">

              <h3>
                Local context
              </h3>

              <dl className="detail-list">

                <div>
                  <dt>
                    Drainage basin
                  </dt>

                  <dd>
                    {selected.basin}
                  </dd>
                </div>

                <div>
                  <dt>
                    Historical planning exposure
                  </dt>

                  <dd>
                    {selected.populationRisk
                      .toLocaleString("en-IN")}
                  </dd>
                </div>

                <div>
                  <dt>
                    Nearest OSM drainage
                  </dt>

                  <dd>
                    {nearestDrainage
                      ? `${Math.round(
                          nearestDrainage.distance
                        )} m`
                      : "—"}
                  </dd>
                </div>

                <div>
                  <dt>
                    DEM elevation
                  </dt>

                  <dd>
                    {selectedTerrain
                      ? `${formatNumber(
                          selectedTerrain.elevation_m,
                          0
                        )} m`
                      : "—"}
                  </dd>
                </div>

                <div>
                  <dt>
                    Mapped drainage ways
                  </dt>

                  <dd>
                    {loadingDrainage
                      ? "Loading..."
                      : drainage.length}
                  </dd>
                </div>

                <div>
                  <dt>
                    Citizen reports loaded
                  </dt>

                  <dd>
                    {reports.length}
                  </dd>
                </div>

              </dl>

              <div className="context-source-note">
                OSM drainage is a mapped
                network layer, not a complete
                GMDA engineering inventory.
              </div>

            </section>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  Drainage network
                </h3>

                <span className="model-tag">
                  OSM
                </span>

              </div>

              <div className="drainage-summary-grid">

                <div>
                  <span>
                    Drains
                  </span>

                  <strong>
                    {drainageCounts.drain || 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Ditches
                  </span>

                  <strong>
                    {drainageCounts.ditch || 0}
                  </strong>
                </div>

                <div>
                  <span>
                    Canals
                  </span>

                  <strong>
                    {drainageCounts.canal || 0}
                  </strong>
                </div>

              </div>

              <p className="drainage-explainer">
                This layer shows drainage
                waterways mapped in
                OpenStreetMap. It does not
                indicate present blockage,
                depth, capacity or pump status.
              </p>

              <div className="drainage-actions">

                <button
                  type="button"
                  className="secondary-map-action"
                  onClick={() =>
                    setShowDrainageLayer(
                      (value) => !value
                    )
                  }
                  disabled={!drainage.length}
                >
                  {showDrainageLayer
                    ? "Hide drainage layer"
                    : "Show drainage layer"}
                </button>

                <button
                  type="button"
                  className="secondary-map-action strong"
                  onClick={openDrainageMode}
                >
                  Open drainage intelligence
                </button>

              </div>

              <button
                type="button"
                className="secondary-map-action terrain-open-action"
                onClick={() => {
                  setRouteMode(false);
                  setDrainageMode(false);
                  setTerrainMode(true);
                  setShowHillshadeLayer(true);
                }}
              >
                Open terrain intelligence
              </button>

            </section>


            <section className="panel-section">

              <div className="section-title">

                <h3>
                  River model
                </h3>

                <span className="model-tag">
                  GLOFAS
                </span>

              </div>

              <div className="river-readout">

                <strong>
                  {riverDischarge === null ||
                  riverDischarge === undefined
                    ? "Data unavailable"
                    : `${formatNumber(
                        riverDischarge,
                        1
                      )} m³/s`}
                </strong>

                <span>
                  GloFAS point discharge.
                  River reach still needs validation
                  against the CWC Brahmaputra gauge.
                </span>

              </div>

            </section>


            <section className="panel-section">

              <h3>
                Risk factors
              </h3>

              {riskByName[selected.name] ? (

                <div className="risk-breakdown">

                  <div>
                    <span>
                      Historical prior
                    </span>
                    <strong>
                      {liveSelected.components
                        ?.historical_prior ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Rainfall modifier
                    </span>
                    <strong>
                      {liveSelected.components
                        ?.rainfall_modifier >= 0
                        ? "+"
                        : ""}
                      {liveSelected.components
                        ?.rainfall_modifier ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Terrain modifier
                    </span>
                    <strong>
                      {liveSelected.components
                        ?.terrain_modifier >= 0
                        ? "+"
                        : ""}
                      {liveSelected.components
                        ?.terrain_modifier ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Citizen modifier
                    </span>
                    <strong>
                      +
                      {liveSelected.components
                        ?.citizen_modifier ?? 0}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Drainage condition
                    </span>
                    <strong className="not-scored">
                      Not scored
                    </strong>
                  </div>

                </div>

              ) : (

                <ul className="factor-list">
                  <li>
                    Historical flood vulnerability
                  </li>
                  <li>
                    Live rainfall contribution:
                    {" "}
                    {formatNumber(
                      rainfall24,
                      1
                    )}
                    {" "}mm / 24 h
                  </li>
                </ul>

              )}

              {riskByName[selected.name]
                ?.reasons?.length > 0 && (

                <ul className="risk-reasons">
                  {riskByName[selected.name]
                    .reasons.map(
                      (reason) => (
                        <li key={reason}>
                          {reason}
                        </li>
                      )
                    )}
                </ul>

              )}

              {riskError && (
                <div className="risk-engine-warning">
                  {riskError}
                </div>
              )}

            </section>


            <button
              className="primary-action"
              type="button"
              onClick={openRouteMode}
            >
              Find safer route

              <span>
                ↗
              </span>
            </button>

          </>

        )}

      </aside>


      {/* BOTTOM LIVE STRIP */}
      <footer className="status-strip">

        <div className="status-live">
          <span className="live-dot" />
          LIVE
        </div>

        <div className="status-item">
          <span>
            Rain / 24 h
          </span>

          <strong>
            {formatNumber(
              rainfall24,
              1
            )} mm
          </strong>
        </div>

        <div className="status-item">
          <span>
            Current rain
          </span>

          <strong>
            {formatNumber(
              currentRain,
              1
            )} mm
          </strong>
        </div>

        <div className="status-item">
          <span>
            Rain radar
          </span>

          <strong className={radar ? "feed-ok" : "feed-offline"}>
            {radar
              ? radarUpdated
                ? `Updated ${radarUpdated}`
                : "Available"
              : "Unavailable"}
          </strong>
        </div>

        <div className="status-item">
          <span>
            OSM drainage
          </span>

          <strong
            className={
              drainage.length
                ? "feed-ok"
                : "feed-offline"
            }
          >
            {loadingDrainage
              ? "Syncing"
              : drainage.length
              ? `${drainage.length} ways`
              : drainageError
              ? "Retry"
              : "Not loaded"}
          </strong>
        </div>

        <div className="status-item">
          <span>
            Published drain assets
          </span>

          <strong>
            {drainageAssets.length}
          </strong>
        </div>

        <div className="status-item">
          <span>
            Risk engine
          </span>

          <strong
            className={
              risks.length
                ? "feed-ok"
                : "feed-offline"
            }
          >
            {risks.length
              ? "Backend"
              : "Fallback"}
          </strong>
        </div>

        <div className="status-item">
          <span>
            Selected elevation
          </span>

          <strong
            className={
              selectedTerrain
                ? "feed-ok"
                : "feed-offline"
            }
          >
            {selectedTerrain
              ? `${formatNumber(
                  selectedTerrain.elevation_m,
                  0
                )} m`
              : "Unavailable"}
          </strong>
        </div>

        <div className="status-item">

          <span>
            Brahmaputra discharge
          </span>

          <strong>
            {riverDischarge === null ||
            riverDischarge === undefined
              ? "—"
              : `${formatNumber(
                  riverDischarge
                )} m³/s`}
          </strong>

        </div>

        <div className="status-item warning">

          <span>
            High-risk localities
          </span>

          <strong>
            {highRiskCount}
          </strong>

        </div>

        <div className="status-item">

          <span>
            Citizen reports
          </span>

          <strong>
            {reports.length}
          </strong>

        </div>

      </footer>


      {/* REPORT MODAL */}
      {showReport && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowReport(false);
            }
          }}
        >

          <form
            className="report-modal"
            onSubmit={handleSubmit}
          >

            <div className="modal-header">

              <div>
                <span className="eyebrow">
                  GROUND REPORT
                </span>

                <h2>
                  Report flooding
                </h2>
              </div>

              <button
                type="button"
                className="close-btn"
                onClick={() =>
                  setShowReport(false)
                }
              >
                ×
              </button>

            </div>


            <p className="modal-intro">
              Add a current street-level
              observation. Citizen reports
              remain separate from official
              and model data.
            </p>


            <button
              type="button"
              className="gps-btn"
              onClick={getMyLocation}
            >
              Use my GPS location
            </button>


            <div className="field-row">

              <label>
                Latitude

                <input
                  required
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      latitude:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Longitude

                <input
                  required
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      longitude:
                        event.target.value,
                    })
                  }
                />
              </label>

            </div>


            <label>
              Locality

              <input
                value={form.locality}
                placeholder="Example: Rukminigaon"
                onChange={(event) =>
                  setForm({
                    ...form,
                    locality:
                      event.target.value,
                  })
                }
              />
            </label>


            <div className="field-row">

              <label>
                Water depth (cm)

                <input
                  required
                  type="number"
                  min="0"
                  max="500"
                  value={
                    form.water_depth_cm
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      water_depth_cm:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Road status

                <select
                  value={
                    form.road_status
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      road_status:
                        event.target.value,
                    })
                  }
                >
                  <option value="open">
                    Open
                  </option>

                  <option value="caution">
                    Caution
                  </option>

                  <option value="blocked">
                    Blocked
                  </option>
                </select>

              </label>

            </div>


            <label>
              Description

              <textarea
                rows="3"
                value={form.note}
                placeholder="What can you see on the road?"
                onChange={(event) =>
                  setForm({
                    ...form,
                    note:
                      event.target.value,
                  })
                }
              />
            </label>


            {message && (
              <div className="form-message">
                {message}
              </div>
            )}


            <button
              type="submit"
              className="submit-report"
            >
              Submit flood report
            </button>

          </form>

        </div>

      )}

    </div>
  );
}

export default App;
