export const FAVORITE_STATIONS_STORAGE_KEY = "favoriteStations";
export const MAX_FAVORITE_STATIONS = 10;

export function readFavoriteStations(storage = globalThis.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(FAVORITE_STATIONS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isValidFavoriteStation).slice(0, MAX_FAVORITE_STATIONS);
  } catch {
    return [];
  }
}

export function isFavoriteStation(stationId, storage = globalThis.localStorage) {
  return readFavoriteStations(storage).some((station) => station.id === stationId);
}

export function toggleFavoriteStation(station, storage = globalThis.localStorage) {
  if (!storage || !station?.id || !station?.name) {
    return { favorites: readFavoriteStations(storage), isFavorite: false };
  }

  const favoriteStations = readFavoriteStations(storage);
  const existingIndex = favoriteStations.findIndex((item) => item.id === station.id);
  const isFavorite = existingIndex === -1;
  const nextFavoriteStations = isFavorite
    ? [
      {
        id: station.id,
        name: station.name,
        distance: station.distanceKm ?? station.distance ?? null,
      },
      ...favoriteStations,
    ].slice(0, MAX_FAVORITE_STATIONS)
    : favoriteStations.filter((item) => item.id !== station.id);

  try {
    storage.setItem(FAVORITE_STATIONS_STORAGE_KEY, JSON.stringify(nextFavoriteStations));
  } catch {
    return { favorites: favoriteStations, isFavorite: !isFavorite };
  }

  return { favorites: nextFavoriteStations, isFavorite };
}

function isValidFavoriteStation(station) {
  return Boolean(
    station
      && typeof station.id === "string"
      && typeof station.name === "string",
  );
}
