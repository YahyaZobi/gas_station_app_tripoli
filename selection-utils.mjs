export function resolveSelectedStationId(selectedStationId, stations) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return null;
  }

  if (stations.some((station) => station.id === selectedStationId)) {
    return selectedStationId;
  }

  return stations[0].id ?? null;
}
