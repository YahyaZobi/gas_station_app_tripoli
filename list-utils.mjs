export function filterStationsForList(stations, filterStatus = "all") {
  if (!Array.isArray(stations) || filterStatus === "all") {
    return Array.isArray(stations) ? stations : [];
  }

  return stations.filter((station) => station.status === filterStatus);
}
