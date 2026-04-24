export function getLeafletMarkerClass(status, isSelected = false) {
  const statusClass = `leaflet-status-${String(status).replaceAll("_", "-")}`;
  return isSelected
    ? `leaflet-station-marker ${statusClass} leaflet-station-marker-active`
    : `leaflet-station-marker ${statusClass}`;
}
