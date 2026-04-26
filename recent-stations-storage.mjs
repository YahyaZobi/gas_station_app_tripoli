export const RECENT_STATIONS_STORAGE_KEY = "recentStations";
export const MAX_RECENT_STATIONS = 5;

export function readRecentStations(storage = globalThis.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(RECENT_STATIONS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter(isValidRecentStation)
      .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))
      .slice(0, MAX_RECENT_STATIONS);
  } catch {
    return [];
  }
}

export function saveRecentStation(station, {
  now = new Date(),
  storage = globalThis.localStorage,
} = {}) {
  if (!storage || !station?.id || !station?.name) {
    return [];
  }

  const nextRecentStation = {
    id: station.id,
    name: station.name,
    distance: station.distanceKm ?? station.distance ?? null,
    timestamp: now.toISOString(),
  };

  const recentStations = readRecentStations(storage).filter(
    (item) => item.id !== nextRecentStation.id,
  );
  const nextRecentStations = [nextRecentStation, ...recentStations].slice(0, MAX_RECENT_STATIONS);

  try {
    storage.setItem(RECENT_STATIONS_STORAGE_KEY, JSON.stringify(nextRecentStations));
  } catch {
    return recentStations;
  }

  return nextRecentStations;
}

function isValidRecentStation(station) {
  return Boolean(
    station
      && typeof station.id === "string"
      && typeof station.name === "string"
      && station.timestamp
      && Number.isFinite(new Date(station.timestamp).getTime()),
  );
}
