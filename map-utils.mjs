export function getLeafletMarkerClass(status, isSelected = false, emphasis = "normal") {
  const statusClass = `leaflet-status-${String(status).replaceAll("_", "-")}`;
  const emphasisClass =
    emphasis === "best"
      ? "leaflet-station-marker-best"
      : emphasis === "dim"
        ? "leaflet-station-marker-dim"
        : "";

  return [
    "leaflet-station-marker",
    statusClass,
    emphasisClass,
    isSelected ? "leaflet-station-marker-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getGoogleMapsUrl(location) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;
}
