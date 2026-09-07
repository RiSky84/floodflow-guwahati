const API =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api";

export async function getWeather() {
  const response = await fetch(
    `${API}/weather`
  );

  if (!response.ok) {
    throw new Error(
      "Weather API failed"
    );
  }

  return response.json();
}


export async function getRiver() {
  const response = await fetch(
    `${API}/river`
  );

  if (!response.ok) {
    throw new Error(
      "River API failed"
    );
  }

  return response.json();
}


export async function getFloodReports() {
  const response = await fetch(
    `${API}/reports`
  );

  if (!response.ok) {
    throw new Error(
      "Could not load flood reports"
    );
  }

  return response.json();
}


export async function submitFloodReport(
  report
) {
  const response = await fetch(
    `${API}/reports`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body:
        JSON.stringify(report),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Could not submit flood report"
    );
  }

  return response.json();
}


const RAINVIEWER =
  "https://api.rainviewer.com/public/weather-maps.json";


export async function getRainRadar() {
  const response = await fetch(
    RAINVIEWER,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      "RainViewer radar API failed"
    );
  }

  const data =
    await response.json();

  const frames =
    data?.radar?.past ?? [];

  const latest =
    frames[frames.length - 1];

  if (
    !latest ||
    !data?.host ||
    !latest?.path
  ) {
    throw new Error(
      "No radar frame available"
    );
  }

  return {
    generated: data.generated,
    time: latest.time,
    host: data.host,
    path: latest.path,

    tile_url:
      `${data.host}` +
      `${latest.path}` +
      "/256/{z}/{x}/{y}/2/1_1.png",
  };
}


export async function searchPlaces(query) {
  const response = await fetch(
    `${API}/geocode?q=${encodeURIComponent(
      query
    )}`
  );

  if (!response.ok) {
    let detail = "";

    try {
      const data =
        await response.json();

      detail =
        data?.detail || "";
    } catch {
      // Use fallback message.
    }

    throw new Error(
      detail ||
      "Place search failed"
    );
  }

  return response.json();
}


export async function getRouteCandidates(
  start,
  end,
  hazards = []
) {
  const params =
    new URLSearchParams({
      start_lat:
        String(start.lat),
      start_lng:
        String(start.lng),
      end_lat:
        String(end.lat),
      end_lng:
        String(end.lng),
    });

  if (hazards.length) {
    params.set(
      "hazards",
      hazards
        .map(
          (item) =>
            `${item.lat},${item.lng},${item.radius_m || 300}`
        )
        .join(";")
    );
  }

  const response = await fetch(
    `${API}/route?${params.toString()}`
  );

  if (!response.ok) {
    let detail = "";

    try {
      const data =
        await response.json();

      detail =
        data?.detail || "";
    } catch {
      // Use fallback message.
    }

    throw new Error(
      detail ||
      "Road routing service failed"
    );
  }

  const data =
    await response.json();

  if (!data.routes?.length) {
    throw new Error(
      "No road route available"
    );
  }

  return data;
}


export async function getDrainageFeatures() {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      16000
    );

  try {
    const response = await fetch(
      `${API}/drainage`,
      {
        signal:
          controller.signal,
      }
    );

    if (!response.ok) {
      let detail = "";

      try {
        const data =
          await response.json();

        detail =
          data?.detail || "";
      } catch {
        // Keep generic error.
      }

      throw new Error(
        detail ||
        "Drainage service failed"
      );
    }

    return response.json();

  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "Drainage request timed out"
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


const ELEVATION_API =
  "https://api.open-meteo.com/v1/elevation";


export async function getTerrainSamples(
  places
) {
  const offsetLat = 0.00225;
  const offsetLng = 0.00245;

  const samples = [];

  places.forEach((place) => {
    samples.push(
      {
        name: place.name,
        slot: "center",
        lat: place.lat,
        lng: place.lng,
      },
      {
        name: place.name,
        slot: "north",
        lat: place.lat + offsetLat,
        lng: place.lng,
      },
      {
        name: place.name,
        slot: "south",
        lat: place.lat - offsetLat,
        lng: place.lng,
      },
      {
        name: place.name,
        slot: "east",
        lat: place.lat,
        lng: place.lng + offsetLng,
      },
      {
        name: place.name,
        slot: "west",
        lat: place.lat,
        lng: place.lng - offsetLng,
      }
    );
  });

  const latitude =
    samples
      .map((sample) => sample.lat)
      .join(",");

  const longitude =
    samples
      .map((sample) => sample.lng)
      .join(",");

  const url =
    `${ELEVATION_API}` +
    `?latitude=${encodeURIComponent(
      latitude
    )}` +
    `&longitude=${encodeURIComponent(
      longitude
    )}`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Elevation API failed"
    );
  }

  const data =
    await response.json();

  const elevations =
    data.elevation ?? [];

  if (
    elevations.length !==
    samples.length
  ) {
    throw new Error(
      "Elevation response was incomplete"
    );
  }

  const grouped = {};

  samples.forEach(
    (sample, index) => {
      if (!grouped[sample.name]) {
        grouped[sample.name] = [];
      }

      grouped[sample.name].push({
        slot: sample.slot,
        elevation_m:
          elevations[index],
      });
    }
  );

  const byName = {};

  Object.entries(grouped).forEach(
    ([name, values]) => {
      const center =
        values.find(
          (item) =>
            item.slot === "center"
        );

      const localValues =
        values
          .map(
            (item) =>
              Number(
                item.elevation_m
              )
          )
          .filter(
            (value) =>
              Number.isFinite(value)
          );

      byName[name] = {
        elevation_m:
          Number(
            center?.elevation_m
          ),

        local_min_m:
          Math.min(
            ...localValues
          ),

        local_max_m:
          Math.max(
            ...localValues
          ),

        local_relief_m:
          Math.max(
            ...localValues
          ) -
          Math.min(
            ...localValues
          ),

        samples: values,
      };
    }
  );

  return {
    source:
      "Open-Meteo Elevation API",

    dataset:
      "Copernicus DEM 2021 GLO-90",

    resolution_m: 90,

    byName,
  };
}


export async function getRisks() {
  const response = await fetch(
    `${API}/risks`
  );

  if (!response.ok) {
    throw new Error(
      "Risk engine API failed"
    );
  }

  return response.json();
}
