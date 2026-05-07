import { computeDistanceKm } from "./logic.mjs";

const ETA_SPEED_KMH = {
  normal: 25,
  crowded: 15,
  low: 35,
};

const ETA_MINUTES_MIN = 2;
const ETA_MINUTES_MAX = 60;

export async function getGoogleRouteMetrics(userLocation, stations, options = {}) {
  const runtimeEnv = options.runtimeEnv ?? import.meta.env ?? {};
  const browserConfig = options.browserConfig ?? globalThis.BENZINA_CONFIG ?? {};
  const isDev = Boolean(options.isDev);
  const apiKey = resolveGoogleMapsApiKey(runtimeEnv, browserConfig);
  const proxyUrl = resolveRoutesProxyUrl(runtimeEnv, browserConfig);
  const originLocation = isValidLatLng(userLocation) ? userLocation : null;
  const stationValidation = validateStationCoordinates(stations, isDev);
  const validStations = stationValidation.validStations;
  const fallbackMetrics = stations.map((station) => createFallbackMetric(userLocation, station));
  if (isDev) {
    console.info("[Routes] bootstrap", {
      apiKeyExists: Boolean(apiKey),
      usingProxy: Boolean(proxyUrl),
      userLocation: originLocation,
    });
  }

  if ((!apiKey && !proxyUrl) || !originLocation || !stations.length) {
    if (isDev) {
      fallbackMetrics.forEach((metric) => {
        console.info("[Routes] fallback_only", {
          stationName: metric.stationName,
          stationCoordinates: metric.stationCoordinates,
          distanceKm: metric.distanceKm,
          etaMinutes: metric.etaMinutes,
          routeSource: metric.routeSource,
        });
      });
    }
    return fallbackMetrics;
  }

  try {
    const results = await Promise.all(
      validStations.map((station) => fetchGoogleRouteMetric({ apiKey, proxyUrl, originLocation, station, isDev })),
    );
    const metricsByStationId = new Map(results.filter(Boolean).map((metric) => [metric.stationId, metric]));
    const metrics = stations.map((station) => metricsByStationId.get(station.id) ?? createFallbackMetric(userLocation, station));
    if (isDev) {
      metrics.forEach((metric) => {
        console.info("[Routes]", {
          stationName: metric.stationName,
          distanceKm: metric.distanceKm,
          etaMinutes: metric.etaMinutes,
          routeSource: metric.routeSource,
        });
      });
    }
    return metrics;
  } catch {
    if (isDev) {
      console.info("[Routes] Google request failed, using fallback results");
    }
    return fallbackMetrics;
  }
}

export function resolveGoogleMapsApiKey(runtimeEnv = {}, browserConfig = {}) {
  return (
    browserConfig.VITE_GOOGLE_MAPS_API_KEY ||
    browserConfig.GOOGLE_MAPS_API_KEY ||
    runtimeEnv.VITE_GOOGLE_MAPS_API_KEY ||
    runtimeEnv.GOOGLE_MAPS_API_KEY ||
    ""
  );
}

export function hasGoogleRouteConfig(runtimeEnv = {}, browserConfig = {}) {
  return Boolean(resolveGoogleMapsApiKey(runtimeEnv, browserConfig) || resolveRoutesProxyUrl(runtimeEnv, browserConfig));
}

function createFallbackMetric(userLocation, station) {
  const canComputeDistance = isValidLatLng(userLocation) && isValidLatLng(station);
  const distanceKm = canComputeDistance ? computeDistanceKm(userLocation, station) : Number.POSITIVE_INFINITY;
  const etaMinutes = estimateFallbackEtaMinutes(distanceKm, station);
  return {
    stationId: station.id,
    stationName: station.name,
    distanceKm,
    etaMinutes,
    routeSource: "fallback",
    stationCoordinates: {
      latitude: station.latitude,
      longitude: station.longitude,
    },
  };
}

function validateStationCoordinates(stations, isDev = false) {
  const validStations = [];
  stations.forEach((station) => {
    if (isValidLatLng(station)) {
      validStations.push(station);
      return;
    }
    if (isDev) {
      console.warn("[Routes] Invalid station coordinates", {
        stationName: station?.name,
        stationId: station?.id,
        latitude: station?.latitude,
        longitude: station?.longitude,
      });
    }
  });
  return { validStations };
}

async function fetchGoogleRouteMetric({ apiKey, proxyUrl, originLocation, station, isDev = false }) {
  if (!isValidLatLng(station)) {
    if (isDev) {
      console.info("[Routes] invalid station coordinates, using fallback", {
        stationName: station.name,
        stationCoordinates: {
          latitude: station.latitude,
          longitude: station.longitude,
        },
      });
    }
    return null;
  }

  const endpoint = proxyUrl || "https://routes.googleapis.com/directions/v2:computeRoutes";
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
  };
  if (!proxyUrl) {
    headers["X-Goog-Api-Key"] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: originLocation.latitude,
            longitude: originLocation.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: station.latitude,
            longitude: station.longitude,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      units: "METRIC",
      languageCode: "ar",
    }),
  });

  if (!response.ok) {
    if (isDev) {
      console.info("[Routes] non-200 response", {
        stationName: station.name,
        status: response.status,
      });
    }
    throw new Error(`Google Routes failed with status ${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route || !Number.isFinite(route.distanceMeters)) {
    if (isDev) {
      console.info("[Routes] empty route result", {
        stationName: station.name,
        payload,
      });
    }
    return null;
  }

  const distanceKm = route.distanceMeters / 1000;
  const durationSeconds = parseGoogleDurationSeconds(route.duration);
  const etaMinutes = Number.isFinite(durationSeconds)
    ? clampMinutes(Math.ceil(durationSeconds / 60))
    : estimateFallbackEtaMinutes(distanceKm, station);

  return {
    stationId: station.id,
    stationName: station.name,
    distanceKm,
    etaMinutes,
    routeSource: "google_maps",
  };
}

function parseGoogleDurationSeconds(durationValue) {
  if (typeof durationValue === "string") {
    const seconds = Number.parseFloat(durationValue.replace("s", ""));
    return Number.isFinite(seconds) ? seconds : null;
  }

  if (typeof durationValue === "number") {
    return durationValue;
  }

  return null;
}

function estimateFallbackEtaMinutes(distanceKm, station = {}) {
  if (!Number.isFinite(distanceKm)) {
    return ETA_MINUTES_MAX;
  }

  let speedKmH = ETA_SPEED_KMH.normal;
  if (station.status === "busy" || station.status === "crowded" || distanceKm >= 7) {
    speedKmH = ETA_SPEED_KMH.crowded;
  } else if (distanceKm <= 1.5) {
    speedKmH = ETA_SPEED_KMH.low;
  }

  return clampMinutes(Math.ceil((distanceKm / speedKmH) * 60));
}

function clampMinutes(minutes) {
  return Math.min(ETA_MINUTES_MAX, Math.max(ETA_MINUTES_MIN, minutes));
}

function resolveRoutesProxyUrl(runtimeEnv = {}, browserConfig = {}) {
  return (
    browserConfig.ROUTES_PROXY_URL ||
    runtimeEnv.VITE_ROUTES_PROXY_URL ||
    runtimeEnv.ROUTES_PROXY_URL ||
    ""
  );
}

function isValidLatLng(value) {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude),
  );
}
