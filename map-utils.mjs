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

export function getGoogleMapsDirectionsUrl(destination, origin = null) {
  const query = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });

  if (origin && Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude)) {
    query.set("origin", `${origin.latitude},${origin.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${query.toString()}`;
}
