import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateStation,
  createReportRecord,
  formatDistanceLabel,
  getDemoReportPreset,
  getDemoUpdateDelayMs,
  getReportEligibility,
  getReportSuccessMessage,
  projectStations,
  REPORT_PROXIMITY_KM,
  REPORT_WINDOW_MINUTES,
  STATUS_META,
  formatRelativeTime,
} from "../logic.mjs";
import { getProtocolWarning } from "../environment-utils.mjs";
import { filterStationsForList } from "../list-utils.mjs";
import { getLeafletMarkerClass } from "../map-utils.mjs";

const station = {
  id: "station-1",
  name: "Test Station",
  latitude: 32.88,
  longitude: 13.19,
};

test("returns unknown when there are no reports in the last 60 minutes", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const reports = [
    {
      id: "old-report",
      stationId: "station-1",
      status: "available",
      queueLevel: "short",
      createdAt: new Date(now.getTime() - (REPORT_WINDOW_MINUTES + 1) * 60000).toISOString(),
    },
  ];

  const result = aggregateStation(station, reports, now);

  assert.equal(result.status, "unknown");
  assert.equal(result.queueLevel, "unknown");
  assert.equal(result.recentReportsCount, 0);
});

test("marks a station as crowded when fresh available reports show a medium or long queue", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const reports = [
    {
      id: "recent-1",
      stationId: "station-1",
      status: "available",
      queueLevel: "long",
      createdAt: new Date(now.getTime() - 5 * 60000).toISOString(),
    },
    {
      id: "recent-2",
      stationId: "station-1",
      status: "available",
      queueLevel: "medium",
      createdAt: new Date(now.getTime() - 12 * 60000).toISOString(),
    },
  ];

  const result = aggregateStation(station, reports, now);

  assert.equal(result.status, "crowded");
  assert.equal(result.queueLevel, "long");
  assert.equal(result.recentReportsCount, 2);
});

test("gives more weight to the newest reports", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const reports = [
    {
      id: "older-available",
      stationId: "station-1",
      status: "available",
      queueLevel: "short",
      createdAt: new Date(now.getTime() - 50 * 60000).toISOString(),
    },
    {
      id: "fresh-no-fuel",
      stationId: "station-1",
      status: "no_fuel",
      queueLevel: "long",
      createdAt: new Date(now.getTime() - 3 * 60000).toISOString(),
    },
  ];

  const result = aggregateStation(station, reports, now);

  assert.equal(result.status, "no_fuel");
  assert.equal(result.queueLevel, "long");
});

test("includes a marker color for every station status used by the map", () => {
  assert.match(STATUS_META.available.markerColor, /^#/);
  assert.match(STATUS_META.crowded.markerColor, /^#/);
  assert.match(STATUS_META.no_fuel.markerColor, /^#/);
  assert.match(STATUS_META.unknown.markerColor, /^#/);
});

test("leaflet marker classes track station status and active selection", () => {
  assert.equal(getLeafletMarkerClass("available"), "leaflet-station-marker leaflet-status-available");
  assert.equal(
    getLeafletMarkerClass("no_fuel", true),
    "leaflet-station-marker leaflet-status-no-fuel leaflet-station-marker-active",
  );
});

test("file protocol shows a localhost warning", () => {
  assert.equal(
    getProtocolWarning("file:"),
    "شغّل التطبيق من localhost بدل فتحه مباشرة عبر file:// حتى تعمل الخريطة والموقع بشكل صحيح.",
  );
  assert.equal(getProtocolWarning("http:"), "");
});

test("station list filtering affects only the requested status slice", () => {
  const stations = [
    { id: "1", status: "available" },
    { id: "2", status: "crowded" },
    { id: "3", status: "available" },
  ];

  assert.deepEqual(filterStationsForList(stations, "all"), stations);
  assert.deepEqual(filterStationsForList(stations, "available"), [
    { id: "1", status: "available" },
    { id: "3", status: "available" },
  ]);
});

test("distance label uses the Arabic mobile copy rules", () => {
  assert.equal(formatDistanceLabel(0.42), "أقل من 1 كم");
  assert.equal(formatDistanceLabel(3.2), "٣٫٢ كم");
});

test("reporting is blocked when location permission is unavailable", () => {
  const result = getReportEligibility({
    userLocation: null,
    station,
    hasUserLocation: false,
  });

  assert.equal(result.canSubmit, false);
  assert.equal(result.distanceKm, null);
  assert.equal(result.message, "فعّل الموقع لإرسال البلاغ");
});

test("reporting is blocked when the user is more than 200 meters away", () => {
  const result = getReportEligibility({
    userLocation: { latitude: 32.88, longitude: 13.19 },
    station: { ...station, latitude: 32.883, longitude: 13.193 },
    hasUserLocation: true,
  });

  assert.equal(result.canSubmit, false);
  assert.ok(result.distanceKm > REPORT_PROXIMITY_KM);
  assert.equal(result.message, "يجب أن تكون قريب من المحطة لإرسال بلاغ");
});

test("reporting is allowed when the user is within 200 meters", () => {
  const result = getReportEligibility({
    userLocation: { latitude: 32.88, longitude: 13.19 },
    station: { ...station, latitude: 32.8807, longitude: 13.1907 },
    hasUserLocation: true,
  });

  assert.equal(result.canSubmit, true);
  assert.ok(result.distanceKm <= REPORT_PROXIMITY_KM);
  assert.equal(result.message, "");
});

test("a new in-memory report changes station status immediately while stale reports are ignored", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const stations = [station];
  const userLocation = { latitude: 32.88, longitude: 13.19 };
  const reports = [
    {
      id: "fresh-available",
      stationId: "station-1",
      status: "available",
      queueLevel: "short",
      createdAt: new Date(now.getTime() - 8 * 60000).toISOString(),
    },
    {
      id: "stale-no-fuel",
      stationId: "station-1",
      status: "no_fuel",
      queueLevel: "long",
      createdAt: new Date(now.getTime() - 80 * 60000).toISOString(),
    },
  ];

  const result = projectStations(stations, reports, userLocation, now)[0];

  assert.equal(result.status, "available");
  assert.equal(result.queueLevel, "short");
  assert.equal(result.recentReportsCount, 1);
});

test("stations are sorted by nearest first using the active user location", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const stations = [
    { id: "far", name: "Far", latitude: 32.95, longitude: 13.3 },
    { id: "near", name: "Near", latitude: 32.8805, longitude: 13.1915 },
  ];
  const userLocation = { latitude: 32.88, longitude: 13.19 };

  const result = projectStations(stations, [], userLocation, now);

  assert.equal(result[0].id, "near");
  assert.equal(result[1].id, "far");
});

test("createReportRecord keeps the selected station coordinates for modal submissions", () => {
  const createdAt = "2026-04-24T12:00:00.000Z";

  const report = createReportRecord({
    id: "report-1",
    stationId: station.id,
    status: "available",
    queueLevel: "medium",
    station,
    createdAt,
  });

  assert.deepEqual(report, {
    id: "report-1",
    stationId: "station-1",
    status: "available",
    queueLevel: "medium",
    createdAt,
    latitude: station.latitude,
    longitude: station.longitude,
  });
});

test("demo update delay stays within 30 to 60 seconds", () => {
  assert.equal(getDemoUpdateDelayMs(0), 30000);
  assert.equal(getDemoUpdateDelayMs(1), 60000);
  assert.equal(getDemoUpdateDelayMs(0.5), 45000);
});

test("demo report preset stays within realistic status and queue combinations", () => {
  assert.deepEqual(getDemoReportPreset(0.2), {
    status: "available",
    queueLevel: "short",
  });
  assert.deepEqual(getDemoReportPreset(0.6), {
    status: "available",
    queueLevel: "medium",
  });
  assert.deepEqual(getDemoReportPreset(0.8), {
    status: "available",
    queueLevel: "long",
  });
  assert.deepEqual(getDemoReportPreset(0.94), {
    status: "no_fuel",
    queueLevel: "medium",
  });
});

test("relative time copy uses the updated Arabic phrasing", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const recentDate = new Date("2026-04-24T11:57:00.000Z");

  assert.match(formatRelativeTime(recentDate, now), /^تم التحديث قبل [3٣] دقائق$/);
});

test("report success message includes the station name in Arabic copy", () => {
  assert.equal(
    getReportSuccessMessage("محطة السياحي", "متوفر"),
    "تم تحديث محطة السياحي إلى متوفر",
  );
});
