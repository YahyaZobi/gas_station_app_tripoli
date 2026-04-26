import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  ACTIVITY_LABELS,
  aggregateStation,
  buildStationSections,
  computeStationStatus,
  createReportRecord,
  findNearestStationWithinDistance,
  formatDistanceLabel,
  formatNumber,
  getDisplayStatus,
  getDemoReportPreset,
  getDemoUpdateDelayMs,
  getActivityLevel,
  getAreaOptions,
  getLiveActivityLabel,
  getDisplayStatusRank,
  getPresenceDrivenStatus,
  getReportEligibility,
  getReportWeight,
  getReportSuccessMessage,
  getStationAreaLabel,
  getStationActivitySummary,
  getStationPriorityScore,
  getStationUrgencyMessage,
  matchesStationSearch,
  minutesSince,
  PRESENCE_PROXIMITY_KM,
  PRESENCE_WINDOW_MINUTES,
  projectStations,
  REPORT_PROXIMITY_KM,
  REPORT_WINDOW_MINUTES,
  sortStationsForDiscovery,
  STATUS_META,
  formatRelativeTime,
  summarizeStationPresence,
} from "../logic.mjs";
import { getLocationModeConfig, getProtocolWarning } from "../environment-utils.mjs";
import { buildDecisionFirstLayout } from "../home-layout-utils.mjs";
import { filterStationsForList } from "../list-utils.mjs";
import { getGoogleMapsUrl, getLeafletMarkerClass } from "../map-utils.mjs";
import {
  canNotifyStation,
  getStationAvailabilityNotificationMessage,
  markStationNotified,
  notifyUser,
  shouldNotifyAvailabilityChange,
  STATION_NOTIFICATION_STORAGE_KEY,
} from "../notification-utils.mjs";
import { DEVICE_ID_STORAGE_KEY, getAnonymousDeviceId } from "../presence-storage.mjs";
import { readStoredReports } from "../report-storage.mjs";
import { createRepository } from "../repository.mjs";
import { resolveSelectedStationId } from "../selection-utils.mjs";
import { createSupabaseClient, getSupabaseConfig } from "../supabaseClient.mjs";

const station = {
  id: "station-1",
  name: "Test Station",
  latitude: 32.88,
  longitude: 13.19,
};

test("falls back to unknown when there are no recent reports or presence signals", () => {
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
  assert.equal(result.hasFreshSignal, false);
});

test("available reports with active devices >= 3 return available", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const status = computeStationStatus({
    reports: [
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
    ],
    activeDevices: 3,
    now,
  });

  assert.equal(status, "available");
});

test("no_fuel reports with active devices <= 2 return no_fuel", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const status = computeStationStatus({
    reports: [
      {
        id: "available-1",
        stationId: "station-1",
        status: "available",
        queueLevel: "short",
        createdAt: new Date(now.getTime() - 15 * 60000).toISOString(),
      },
      {
        id: "no-fuel-1",
        stationId: "station-1",
        status: "no_fuel",
        queueLevel: "long",
        createdAt: new Date(now.getTime() - 3 * 60000).toISOString(),
      },
      {
        id: "no-fuel-2",
        stationId: "station-1",
        status: "no_fuel",
        queueLevel: "medium",
        createdAt: new Date(now.getTime() - 9 * 60000).toISOString(),
      },
    ],
    activeDevices: 2,
    now,
  });

  assert.equal(status, "no_fuel");
});

test("active devices >= 10 return busy even if reports are weak", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const status = computeStationStatus({
    reports: [
      {
        id: "recent-1",
        stationId: "station-1",
        status: "available",
        queueLevel: "short",
        createdAt: new Date(now.getTime() - 45 * 60000).toISOString(),
      },
    ],
    activeDevices: 10,
    now,
  });

  assert.equal(status, "busy");
});

test("presence-driven thresholds map active devices into believable statuses", () => {
  assert.equal(getPresenceDrivenStatus(0, true), "طابور خفيف");
  assert.equal(getPresenceDrivenStatus(2, true), "عالبومبة طول");
  assert.equal(getPresenceDrivenStatus(8, true), "طابور خفيف");
  assert.equal(getPresenceDrivenStatus(12, true), "زحمة");
  assert.equal(getPresenceDrivenStatus(0, false), "طابور خفيف");
});

test("aggregateStation uses passive presence and reports together for busy stations", () => {
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

  const result = projectStations([station], reports, { latitude: 32.88, longitude: 13.19 }, [
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 3 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 4 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 3 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString() },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString() },
  ], now)[0];

  assert.equal(result.status, "busy");
  assert.equal(result.queueLevel, "long");
  assert.equal(result.activeDevices, 10);
});

test("newer reports have more weight than older reports within the 60 minute window", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const freshReport = {
    createdAt: "2026-04-24T11:55:00.000Z",
  };
  const olderReport = {
    createdAt: "2026-04-24T11:35:00.000Z",
  };

  assert.equal(minutesSince(freshReport.createdAt, now), 5);
  assert.equal(getReportWeight(freshReport, now), 1);
  assert.equal(getReportWeight(olderReport, now), 0.7);
  assert.ok(getReportWeight(freshReport, now) > getReportWeight(olderReport, now));
});

test("reports older than 60 minutes get zero weight and are ignored", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const staleReport = {
    createdAt: "2026-04-24T10:59:00.000Z",
  };

  assert.equal(getReportWeight(staleReport, now), 0);
});

test("station with signals older than 60 minutes falls back to unknown", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const result = projectStations(
    [station],
    [
      {
        id: "old-report",
        stationId: "station-1",
        status: "available",
        queueLevel: "short",
        createdAt: "2026-04-24T10:58:00.000Z",
      },
    ],
    { latitude: 32.88, longitude: 13.19 },
    [
      {
        stationId: "station-1",
        lastSeenAt: "2026-04-24T10:57:00.000Z",
      },
    ],
    now,
  )[0];

  assert.equal(result.status, "unknown");
  assert.equal(result.hasFreshSignal, false);
  assert.equal(result.lastUpdated, null);
});

test("recent presence signal updates lastUpdated and trust fields", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const result = projectStations(
    [station],
    [],
    { latitude: 32.88, longitude: 13.19 },
    [
      {
        stationId: "station-1",
        lastSeenAt: "2026-04-24T11:56:00.000Z",
      },
      {
        stationId: "station-1",
        lastSeenAt: "2026-04-24T11:58:00.000Z",
      },
    ],
    now,
  )[0];

  assert.equal(result.lastUpdated, "2026-04-24T11:58:00.000Z");
  assert.equal(result.activeDevices, 2);
  assert.equal(result.activityLabel, "طابور خفيف");
  assert.equal(result.hasFreshSignal, true);
  assert.equal(result.status, "available");
  assert.equal(getDisplayStatus(result), "عالبومبة طول");
});

test("recent report updates lastUpdated when newer than presence", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const result = projectStations(
    [station],
    [
      {
        id: "recent-report",
        stationId: "station-1",
        status: "available",
        queueLevel: "short",
        createdAt: "2026-04-24T11:59:00.000Z",
      },
    ],
    { latitude: 32.88, longitude: 13.19 },
    [
      {
        stationId: "station-1",
        lastSeenAt: "2026-04-24T11:57:00.000Z",
      },
    ],
    now,
  )[0];

  assert.equal(result.lastUpdated, "2026-04-24T11:59:00.000Z");
  assert.equal(result.hasFreshSignal, true);
});

test("includes a marker color for every station status used by the map", () => {
  assert.match(STATUS_META.available.markerColor, /^#/);
  assert.match(STATUS_META.busy.markerColor, /^#/);
  assert.match(STATUS_META.crowded.markerColor, /^#/);
  assert.match(STATUS_META.no_fuel.markerColor, /^#/);
  assert.match(STATUS_META.uncertain.markerColor, /^#/);
  assert.match(STATUS_META.unknown.markerColor, /^#/);
});

test("leaflet marker classes track station status and active selection", () => {
  assert.equal(getLeafletMarkerClass("available"), "leaflet-station-marker leaflet-status-available");
  assert.equal(
    getLeafletMarkerClass("busy", true),
    "leaflet-station-marker leaflet-status-busy leaflet-station-marker-active",
  );
  assert.equal(
    getLeafletMarkerClass("no_fuel", true),
    "leaflet-station-marker leaflet-status-no-fuel leaflet-station-marker-active",
  );
  assert.equal(
    getLeafletMarkerClass("available", false, "best"),
    "leaflet-station-marker leaflet-status-available leaflet-station-marker-best",
  );
});

test("google maps url opens with station latitude and longitude", () => {
  assert.equal(
    getGoogleMapsUrl({ latitude: 32.88, longitude: 13.19 }),
    "https://www.google.com/maps?q=32.88%2C13.19",
  );
});

test("notification logic triggers only when station becomes available from busy or no_fuel", () => {
  assert.equal(shouldNotifyAvailabilityChange("no_fuel", "available"), true);
  assert.equal(shouldNotifyAvailabilityChange("busy", "available"), true);
  assert.equal(shouldNotifyAvailabilityChange("unknown", "available"), false);
  assert.equal(shouldNotifyAvailabilityChange("available", "available"), false);
});

test("station notifications are throttled to one per 30 minutes", () => {
  const storage = createMemoryStorage();
  const now = new Date("2026-04-24T12:00:00.000Z");

  assert.equal(canNotifyStation("station-1", now, storage), true);
  markStationNotified("station-1", now, storage);
  assert.equal(canNotifyStation("station-1", new Date("2026-04-24T12:20:00.000Z"), storage), false);
  assert.equal(canNotifyStation("station-1", new Date("2026-04-24T12:31:00.000Z"), storage), true);
  assert.match(storage.getItem(STATION_NOTIFICATION_STORAGE_KEY), /station-1/);
});

test("notifyUser falls back to toast when browser notifications are unavailable", () => {
  const toastMessages = [];
  const channel = notifyUser(
    { id: "station-1", name: "محطة السياحي" },
    getStationAvailabilityNotificationMessage({ name: "محطة السياحي" }),
    {
      notificationApi: { permission: "default" },
      showToast(message) {
        toastMessages.push(message);
      },
    },
  );

  assert.equal(channel, "toast");
  assert.deepEqual(toastMessages, ["محطة محطة السياحي رجعت تخدم الآن"]);
});

test("file protocol shows a localhost warning", () => {
  assert.equal(
    getProtocolWarning("file:"),
    "شغّل التطبيق من localhost بدل فتحه مباشرة عبر file:// حتى تعمل الخريطة والموقع بشكل صحيح.",
  );
  assert.equal(getProtocolWarning("http:"), "");
});

test("supabase config reads optional environment values without hardcoding", () => {
  const config = getSupabaseConfig(
    {
      SUPABASE_URL: "https://demo.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
    },
    {},
  );

  assert.deepEqual(config, {
    url: "https://demo.supabase.co",
    anonKey: "anon-key",
  });
});

test("supabase config prefers BENZINA_CONFIG in the browser runtime", () => {
  const config = getSupabaseConfig(
    {
      SUPABASE_URL: "https://env.supabase.co",
      SUPABASE_ANON_KEY: "env-key",
    },
    {
      BENZINA_CONFIG: {
        SUPABASE_URL: "https://runtime.supabase.co",
        SUPABASE_ANON_KEY: "runtime-key",
      },
    },
  );

  assert.deepEqual(config, {
    url: "https://runtime.supabase.co",
    anonKey: "runtime-key",
  });
});

test("fake location mode reads browser runtime config for localhost testing", () => {
  const config = getLocationModeConfig(
    {},
    {
      BENZINA_CONFIG: {
        USE_FAKE_LOCATION: true,
        FAKE_LATITUDE: 32.8872,
        FAKE_LONGITUDE: 13.1913,
      },
    },
  );

  assert.deepEqual(config, {
    useFakeLocation: true,
    hasValidFakeLocation: true,
    latitude: 32.8872,
    longitude: 13.1913,
  });
});

test("fake location mode is disabled when coordinates are invalid", () => {
  const config = getLocationModeConfig(
    {},
    {
      BENZINA_CONFIG: {
        USE_FAKE_LOCATION: "true",
        FAKE_LATITUDE: "",
        FAKE_LONGITUDE: "13.1913",
      },
    },
  );

  assert.deepEqual(config, {
    useFakeLocation: true,
    hasValidFakeLocation: false,
    latitude: null,
    longitude: 13.1913,
  });
});

test("supabase client logs config status without exposing keys", () => {
  const logger = createMemoryLogger();

  createSupabaseClient({
    config: {
      url: "https://demo.supabase.co",
      anonKey: "super-secret-anon-key",
    },
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    logger,
  });

  assert.equal(logger.infoMessages.length, 1);
  assert.match(logger.infoMessages[0], /Config detected: yes/);
  assert.doesNotMatch(logger.infoMessages[0], /super-secret-anon-key/);
});

test("supabase realtime subscription receives report insert events", () => {
  const logger = createMemoryLogger();
  const socket = createFakeSocket();
  const receivedReports = [];
  const client = createSupabaseClient({
    config: {
      url: "https://demo.supabase.co",
      anonKey: "anon-key",
    },
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    logger,
    websocketFactory: () => socket,
  });

  const unsubscribe = client.subscribeToReportInserts((report) => {
    receivedReports.push(report);
  });

  socket.emit("open");
  socket.emit("message", {
    data: JSON.stringify({
      event: "postgres_changes",
      payload: {
        data: {
          eventType: "INSERT",
          record: {
            id: "report-1",
            station_id: "station-1",
          },
        },
      },
    }),
  });

  unsubscribe();

  assert.equal(receivedReports.length, 1);
  assert.equal(receivedReports[0].id, "report-1");
  assert.equal(JSON.parse(socket.sentMessages[0]).event, "phx_join");
  assert.match(logger.infoMessages.join("\n"), /Realtime connected for reports inserts/);
});

test("station list filtering affects only the requested status slice", () => {
  const stations = [
    { id: "1", status: "available" },
    { id: "2", status: "crowded" },
    { id: "3", status: "available" },
    { id: "4", status: "uncertain" },
  ];

  assert.deepEqual(filterStationsForList(stations, "all"), stations);
  assert.deepEqual(filterStationsForList(stations, "available"), [
    { id: "1", status: "available" },
    { id: "3", status: "available" },
  ]);
});

test("station priority score favors available, short-queue, nearby stations", () => {
  const bestStation = {
    status: "available",
    activityLevel: "likely_available",
    queueLevel: "short",
    distanceKm: 1.2,
    activeDevices: 7,
    recentReportsCount: 4,
  };
  const worseStation = {
    status: "unknown",
    activityLevel: "low",
    queueLevel: "long",
    distanceKm: 4.6,
    activeDevices: 2,
    recentReportsCount: 1,
  };

  assert.ok(getStationPriorityScore(bestStation) > getStationPriorityScore(worseStation));
});

test("station sections prioritize top available stations and keep crowded or closed lower", () => {
  const sections = buildStationSections([
    { id: "1", status: "available", queueLevel: "short", distanceKm: 0.6, confidenceLevel: "high", hasFreshSignal: true, activeDevices: 6 },
    { id: "2", status: "available", queueLevel: "medium", distanceKm: 1.4, confidenceLevel: "medium", hasFreshSignal: true, activeDevices: 4 },
    { id: "3", status: "busy", activityLevel: "busy", queueLevel: "long", distanceKm: 0.8, confidenceLevel: "low", hasFreshSignal: true, activeDevices: 12 },
    { id: "4", status: "unknown", activityLevel: "unknown", queueLevel: "unknown", distanceKm: 0.5, confidenceLevel: "medium", hasFreshSignal: false, activeDevices: 0 },
    { id: "5", status: "no_fuel", queueLevel: "medium", distanceKm: 0.4, confidenceLevel: "high", hasFreshSignal: true, activeDevices: 0 },
  ]);

  assert.equal(sections.bestStation?.id, "1");
  assert.equal(sections.backupStation?.id, "2");
  assert.deepEqual(sections.recommendedStations.map((station) => station.id), ["4", "3", "5"]);
  assert.deepEqual(sections.nearbyStations.map((station) => station.id), []);
  assert.deepEqual(sections.avoidStations.map((station) => station.id), []);
});

test("station sections can promote likely available activity signals when no available station exists", () => {
  const sections = buildStationSections([
    { id: "1", status: "busy", activityLevel: "busy", queueLevel: "long", distanceKm: 0.6, confidenceLevel: "medium", hasFreshSignal: true, activeDevices: 12 },
    { id: "2", status: "no_fuel", queueLevel: "medium", distanceKm: 1.4, confidenceLevel: "high", hasFreshSignal: true, activeDevices: 0 },
    { id: "3", status: "unknown", activityLevel: "low", queueLevel: "unknown", distanceKm: 7.5, confidenceLevel: "low", hasFreshSignal: false, activeDevices: 0 },
  ]);

  assert.equal(sections.bestStation?.id, "1");
  assert.equal(sections.backupStation, null);
  assert.deepEqual(sections.recommendedStations.map((station) => station.id), ["3", "2"]);
  assert.deepEqual(sections.nearbyStations.map((station) => station.id), []);
});

test("station sections still keep nearby stations when all stations display as مسكر", () => {
  const sections = buildStationSections([
    { id: "1", status: "unknown", activityLevel: "unknown", queueLevel: "unknown", distanceKm: 0.3, hasFreshSignal: false, activeDevices: 0 },
    { id: "2", status: "no_fuel", activityLevel: "unknown", queueLevel: "medium", distanceKm: 0.8, hasFreshSignal: true, activeDevices: 0 },
    { id: "3", status: "uncertain", activityLevel: "low", queueLevel: "medium", distanceKm: 1.2, hasFreshSignal: false, activeDevices: 0 },
  ]);

  assert.equal(sections.bestStation, null);
  assert.deepEqual(sections.recommendedStations.map((station) => station.id), ["1", "3", "2"]);
});

test("unknown and uncertain stations can never be selected as the best station", () => {
  const sections = buildStationSections([
    { id: "1", status: "unknown", activityLevel: "likely_available", queueLevel: "unknown", distanceKm: 0.2, confidenceLevel: "medium", hasFreshSignal: false, activeDevices: 0 },
    { id: "2", status: "uncertain", activityLevel: "low", queueLevel: "medium", distanceKm: 0.1, confidenceLevel: "medium", hasFreshSignal: false, activeDevices: 0 },
    { id: "3", status: "available", activityLevel: "likely_available", queueLevel: "short", distanceKm: 1.4, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:55:00.000Z", hasFreshSignal: true, activeDevices: 3 },
  ]);

  assert.equal(sections.bestStation?.id, "3");
});

test("best station prioritizes availability then distance then recency", () => {
  const sections = buildStationSections([
    { id: "1", status: "busy", activityLevel: "busy", queueLevel: "medium", distanceKm: 0.1, confidenceLevel: "high", lastUpdated: "2026-04-24T11:59:00.000Z", hasFreshSignal: true, activeDevices: 12 },
    { id: "2", status: "available", activityLevel: "likely_available", queueLevel: "short", distanceKm: 1.1, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:50:00.000Z", hasFreshSignal: true, activeDevices: 3 },
    { id: "3", status: "available", activityLevel: "likely_available", queueLevel: "short", distanceKm: 1.1, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:58:00.000Z", hasFreshSignal: true, activeDevices: 3 },
  ]);

  assert.equal(sections.bestStation?.id, "3");
});

test("decision-first layout shows hero, backup, then nearby stations without duplication", () => {
  const layout = buildDecisionFirstLayout({
    bestStation: { id: "hero" },
    backupStation: { id: "r2" },
    recommendedStations: [{ id: "hero" }, { id: "r2" }, { id: "r3" }],
    nearbyStations: [{ id: "n1" }, { id: "n2" }, { id: "n3" }, { id: "n4" }, { id: "n5" }],
    avoidStations: [{ id: "x1" }, { id: "x2" }],
  });

  assert.equal(layout.heroStation?.id, "hero");
  assert.equal(layout.backupStation?.id, "r2");
  assert.deepEqual(layout.nearbyVisible.map((station) => station.id), ["r3", "n1", "n2", "n3", "n4"]);
  assert.deepEqual(layout.otherStations.map((station) => station.id), ["n5", "x1", "x2"]);
});

test("discovery sorting keeps nearby stations first, then convenience rank", () => {
  const sortedStations = sortStationsForDiscovery([
    { id: "far-open", status: "available", queueLevel: "short", distanceKm: 4.8, activeDevices: 6 },
    { id: "near-busy", status: "busy", queueLevel: "long", distanceKm: 1.2, activeDevices: 12 },
    { id: "near-light", status: "unknown", queueLevel: "unknown", distanceKm: 1.2, activeDevices: 0 },
    { id: "near-closed", status: "no_fuel", queueLevel: "medium", distanceKm: 1.2, activeDevices: 0 },
  ]);

  assert.deepEqual(sortedStations.map((station) => station.id), [
    "far-open",
    "near-light",
    "near-busy",
    "near-closed",
  ]);
  assert.equal(getDisplayStatusRank(sortedStations[0]), 0);
});

test("search matches station name and area labels", () => {
  const stationWithArea = {
    id: "station-area",
    name: "محطة قرقارش",
    area: "قرقارش",
    neighborhood: "السياحي",
  };

  assert.equal(matchesStationSearch(stationWithArea, "قرقارش"), true);
  assert.equal(matchesStationSearch(stationWithArea, "السياحي"), true);
  assert.equal(matchesStationSearch(stationWithArea, "الهاني"), false);
  assert.equal(getStationAreaLabel(stationWithArea), "قرقارش");
});

test("area options are hidden until unique area labels exist", () => {
  const options = getAreaOptions([
    { id: "1", name: "محطة 1", area: "السياحي" },
    { id: "2", name: "محطة 2", neighborhood: "قرقارش" },
    { id: "3", name: "محطة 3", area: "السياحي" },
    { id: "4", name: "محطة 4" },
  ]);

  assert.deepEqual(options, ["السياحي", "قرقارش"]);
});

test("selected station falls back to the first loaded station when the current id is missing", () => {
  const stations = [
    { id: "station-a" },
    { id: "station-b" },
  ];

  assert.equal(resolveSelectedStationId("station-b", stations), "station-b");
  assert.equal(resolveSelectedStationId("station-missing", stations), "station-a");
  assert.equal(resolveSelectedStationId(null, []), null);
});

test("distance label uses western digits in the Arabic mobile copy", () => {
  assert.equal(formatDistanceLabel(0.42), "أقل من 1 كم");
  assert.equal(formatDistanceLabel(3.2), "3.2 كم");
});

test("formatNumber normalizes values to western digits", () => {
  assert.equal(formatNumber(12.5), "12.5");
  assert.equal(formatNumber("١٢٫٥"), "12.5");
});

test("stored reports are cleaned when they are older than 60 minutes", () => {
  const storage = createMemoryStorage();
  const now = new Date("2026-04-24T12:00:00.000Z");

  storage.setItem(
    "benzina_reports",
    JSON.stringify([
      {
        id: "fresh",
        stationId: "station-1",
        status: "available",
        queueLevel: "short",
        createdAt: "2026-04-24T11:40:00.000Z",
      },
      {
        id: "old",
        stationId: "station-1",
        status: "no_fuel",
        queueLevel: "long",
        createdAt: "2026-04-24T10:40:00.000Z",
      },
    ]),
  );

  const reports = readStoredReports(storage, now);

  assert.equal(reports.length, 1);
  assert.equal(reports[0].id, "fresh");
  assert.match(storage.getItem("benzina_reports"), /fresh/);
  assert.doesNotMatch(storage.getItem("benzina_reports"), /old/);
});

test("repository falls back to local storage when supabase is not configured", async () => {
  const storage = createMemoryStorage();
  const logger = createMemoryLogger();
  const now = new Date("2026-04-24T12:00:00.000Z");
  const fallbackStations = [station];
  const repository = createRepository({
    storage,
    fallbackStations,
    nowFactory: () => now,
    logger,
    supabaseClient: {
      isConfigured: false,
    },
  });

  const submittedReport = createReportRecord({
    stationId: station.id,
    status: "available",
    queueLevel: "short",
    station,
    createdAt: now.toISOString(),
  });

  const stationsResult = await repository.getStations();
  await repository.submitReport(submittedReport, null);
  const reportsResult = await repository.getRecentReports();

  assert.deepEqual(stationsResult, fallbackStations);
  assert.equal(reportsResult.length, 1);
  assert.equal(reportsResult[0].stationId, "station-1");
  assert.match(storage.getItem("benzina_reports"), /station-1/);
  assert.match(logger.warnMessages.join("\n"), /Supabase config missing/);
  assert.match(logger.warnMessages.join("\n"), /local storage/i);
});

test("repository reads and writes through supabase while keeping local fallback data", async () => {
  const storage = createMemoryStorage();
  const logger = createMemoryLogger();
  const now = new Date("2026-04-24T12:00:00.000Z");
  const submittedReport = createReportRecord({
    id: "report-remote-1",
    stationId: station.id,
    status: "available",
    queueLevel: "medium",
    station,
    createdAt: now.toISOString(),
  });
  const insertCalls = [];
  const repository = createRepository({
    storage,
    fallbackStations: [station],
    nowFactory: () => now,
    logger,
    supabaseClient: {
      isConfigured: true,
      async select(path) {
        if (path === "stations") {
          return [
            {
              id: "station-db-1",
              name: "محطة من Supabase",
              latitude: 32.881,
              longitude: 13.2,
              is_active: true,
            },
          ];
        }

        if (path === "reports") {
          return [
            {
              id: "report-remote-1",
              station_id: station.id,
              fuel_status: "available",
              queue_level: "medium",
              reported_at: now.toISOString(),
              station_latitude: station.latitude,
              station_longitude: station.longitude,
              user_latitude: 32.88,
              user_longitude: 13.19,
            },
          ];
        }

        return [];
      },
      async insert(path, payload) {
        insertCalls.push({ path, payload });
        return [{ id: "report-remote-1" }];
      },
    },
  });

  await repository.submitReport(submittedReport, { latitude: 32.88, longitude: 13.19 });
  const stationsResult = await repository.getStations();
  const reportsResult = await repository.getRecentReports();

  assert.equal(insertCalls.length, 1);
  assert.equal(insertCalls[0].path, "reports");
  assert.equal(insertCalls[0].payload.station_id, "station-1");
  assert.deepEqual(stationsResult, [
    {
      id: "station-db-1",
      name: "محطة من Supabase",
      latitude: 32.881,
      longitude: 13.2,
    },
  ]);
  assert.equal(reportsResult.length, 1);
  assert.equal(reportsResult[0].id, "report-remote-1");
  assert.match(storage.getItem("benzina_reports"), /report-remote-1/);
  assert.match(logger.infoMessages.join("\n"), /Stations fetch succeeded\. Count: 1/);
  assert.match(logger.infoMessages.join("\n"), /Reports fetch succeeded\. Remote count: 1\. Total active count: 1/);
  assert.match(logger.infoMessages.join("\n"), /Report submit succeeded in Supabase/);
});

test("repository loads and saves passive station presence through supabase", async () => {
  const logger = createMemoryLogger();
  const now = new Date("2026-04-24T12:00:00.000Z");
  const upsertCalls = [];
  const repository = createRepository({
    nowFactory: () => now,
    logger,
    supabaseClient: {
      isConfigured: true,
      async select(path) {
        if (path !== "station_presence") {
          return [];
        }

        return [
          {
            station_id: "station-1",
            device_id: "device-1",
            last_seen_at: now.toISOString(),
            distance_to_station_meters: 88,
          },
        ];
      },
      async upsert(path, payload, onConflictColumns) {
        upsertCalls.push({ path, payload, onConflictColumns });
        return [{ id: "presence-1" }];
      },
    },
  });

  const rows = await repository.getRecentPresence();
  await repository.submitPresenceHeartbeat({
    stationId: "station-1",
    deviceId: "device-1",
    latitude: 32.88,
    longitude: 13.19,
    distanceToStationMeters: 88,
    lastSeenAt: now.toISOString(),
  });

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    stationId: "station-1",
    deviceId: "device-1",
    lastSeenAt: now.toISOString(),
    distanceToStationMeters: 88,
  });
  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0].path, "station_presence");
  assert.deepEqual(upsertCalls[0].onConflictColumns, ["station_id", "device_id"]);
  assert.match(logger.infoMessages.join("\n"), /Presence fetch succeeded\. Active rows: 1/);
  assert.match(logger.infoMessages.join("\n"), /Presence heartbeat saved/);
});

test("repository forwards realtime inserts when supabase realtime is available", () => {
  const logger = createMemoryLogger();
  const receivedReports = [];
  const repository = createRepository({
    logger,
    supabaseClient: {
      subscribeToReportInserts(onInsert) {
        onInsert({ id: "report-live-1" });
        return () => {};
      },
    },
  });

  repository.subscribeToReportInserts((report) => {
    receivedReports.push(report);
  });

  assert.equal(receivedReports.length, 1);
  assert.equal(receivedReports[0].id, "report-live-1");
  assert.match(logger.infoMessages.join("\n"), /Realtime insert received/);
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

test("presence activity summary follows the required active-device ranges", () => {
  assert.equal(getActivityLevel(0), "unknown");
  assert.equal(getStationActivitySummary(0).label, ACTIVITY_LABELS.unknown);
  assert.equal(getStationActivitySummary(2).label, ACTIVITY_LABELS.low);
  assert.equal(getActivityLevel(16), "busy");
  assert.equal(getStationActivitySummary(6).label, ACTIVITY_LABELS.likely_available);
  assert.equal(getStationActivitySummary(16).label, ACTIVITY_LABELS.busy);
});

test("presence rows older than the 5 minute window are ignored", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const counts = summarizeStationPresence(
    [
      {
        stationId: "station-1",
        lastSeenAt: new Date(now.getTime() - (PRESENCE_WINDOW_MINUTES - 1) * 60000).toISOString(),
      },
      {
        stationId: "station-1",
        lastSeenAt: new Date(now.getTime() - (PRESENCE_WINDOW_MINUTES + 1) * 60000).toISOString(),
      },
      {
        stationId: "station-2",
        lastSeenAt: now.toISOString(),
      },
    ],
    now,
  );

  assert.equal(counts.get("station-1")?.activeDevices, 1);
  assert.equal(counts.get("station-2")?.activeDevices, 1);
  assert.equal(counts.get("station-1")?.lastSeenAt, new Date(now.getTime() - (PRESENCE_WINDOW_MINUTES - 1) * 60000).toISOString());
});

test("presence heartbeat targets the nearest station within 200 meters", () => {
  const nearest = findNearestStationWithinDistance(
    { latitude: 32.88, longitude: 13.19 },
    [
      { id: "far", latitude: 32.89, longitude: 13.22 },
      { id: "near", latitude: 32.8807, longitude: 13.1907 },
    ],
  );

  assert.equal(nearest?.station.id, "near");
  assert.ok(nearest?.distanceKm <= PRESENCE_PROXIMITY_KM);
});

test("presence heartbeat returns null when no station is close enough", () => {
  const nearest = findNearestStationWithinDistance(
    { latitude: 32.88, longitude: 13.19 },
    [
      { id: "far", latitude: 32.95, longitude: 13.3 },
    ],
  );

  assert.equal(nearest, null);
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

  assert.equal(formatRelativeTime(recentDate, now), "آخر تحديث: منذ 3 دقيقة");
  assert.equal(formatRelativeTime(null, now), "لا توجد إشارات حديثة");
});

test("live activity label shows current active users with western digits", () => {
  assert.equal(getLiveActivityLabel(4), "4 مستخدمين حالياً");
});

test("urgency message appears only for recently available stations", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");

  assert.match(
    getStationUrgencyMessage(
      {
        status: "available",
        lastUpdated: new Date("2026-04-24T11:52:00.000Z").toISOString(),
      },
      now,
    ),
    /كانت شغالة قبل 8 دقيقة/,
  );
  assert.equal(
    getStationUrgencyMessage(
      {
        status: "no_fuel",
        lastUpdated: new Date("2026-04-24T11:52:00.000Z").toISOString(),
      },
      now,
    ),
    "",
  );
});

test("report success message includes the station name in Arabic copy", () => {
  assert.equal(
    getReportSuccessMessage("محطة السياحي", STATUS_META.available.label),
    "تم تحديث محطة السياحي إلى عالبومبة طول",
  );
});

test("display status returns only the approved user-facing labels", () => {
  assert.equal(
    getDisplayStatus({ status: "available", queueLevel: "short", activityLevel: "likely_available", activeDevices: 6, hasFreshSignal: true }),
    "عالبومبة طول",
  );
  assert.equal(
    getDisplayStatus({ status: "available", queueLevel: "medium", activityLevel: "likely_available", activeDevices: 6, hasFreshSignal: true }),
    "طابور خفيف",
  );
  assert.equal(
    getDisplayStatus({ status: "crowded", queueLevel: "long", activityLevel: "busy", activeDevices: 12, hasFreshSignal: true }),
    "زحمة",
  );
  assert.equal(
    getDisplayStatus({ status: "unknown", queueLevel: "unknown", activityLevel: "unknown", activeDevices: 0, hasFreshSignal: false }),
    "طابور خفيف",
  );
});

test("project sources no longer contain the removed Arabic status labels", () => {
  const sources = [
    fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../logic.mjs", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../notification-utils.mjs", import.meta.url), "utf8"),
  ].join("\n");
  const bannedLabels = [
    "\u063A\u064A\u0631 \u0648\u0627\u0636\u062D",
    "\u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641",
    "\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0624\u0643\u062F\u0629",
    "\u0645\u062A\u0648\u0641\u0631",
    "\u0645\u0632\u062F\u062D\u0645\u0629",
    "\u0641\u0627\u0631\u063A\u0629",
    "\u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631",
  ];

  assert.doesNotMatch(sources, new RegExp(bannedLabels.join("|")));
});

test("anonymous device id is generated once and stored locally", () => {
  const storage = createMemoryStorage();
  const firstId = getAnonymousDeviceId(storage);
  const secondId = getAnonymousDeviceId(storage);

  assert.match(firstId, /^device-/);
  assert.equal(secondId, firstId);
  assert.equal(storage.getItem(DEVICE_ID_STORAGE_KEY), firstId);
});

test("index.html includes the desktop phone preview wrapper", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /class="phone-preview"/);
  assert.match(html, /class="phone-frame"/);
  assert.match(html, /class="phone-screen"/);
});

test("home screen hides map and details panels and keeps only the maps action on cards", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /class="panel map-panel home-screen-hidden"/);
  assert.match(html, /class="panel details-panel home-screen-hidden"/);
  assert.doesNotMatch(html, /data-station-action="details"/);
  assert.match(html, /افتح في خرائط Google/);
  assert.match(html, /class="station-card-status"/);
  assert.doesNotMatch(html, /class="station-card-priority"/);
});

test("home screen and search tab keep clear separated copy", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(html, /<main class="app-content">/);
  assert.match(html, /id="screen-title">أقرب المحطات<\/h2>/);
  assert.match(html, /id="screen-subtitle">اختر المحطة المناسبة وافتحها في خرائط Google<\/p>/);
  assert.match(html, /id="search-toolbar"/);
  assert.match(html, /placeholder="ابحث عن محطة أو منطقة"/);
  assert.match(html, /ابحث باسم المحطة أو المنطقة/);
  assert.match(html, /<nav class="bottom-nav"/);
  assert.match(html, /class="nav-indicator"/);
  assert.match(html, /<button type="button" class="nav-item active" data-tab="home"/);
  assert.match(html, /<svg viewBox="0 0 24 24"/);
  assert.match(html, /data-tab="home"/);
  assert.match(html, /data-tab="search"/);
  assert.match(source, /state\.activeTab === "search"/);
  assert.match(source, /screenTitle\.textContent = isSearchTab \? "البحث" : "أقرب المحطات"/);
  assert.match(source, /navIndicator\.style\.transform = isSearchTab/);
  assert.match(source, /state\.discoveryRadiusKm = EXPANDED_DISCOVERY_RADIUS_KM/);
  assert.match(source, /distanceKm <= nearbyRadiusKm/);
});

test("app hides the best-station section entirely when no reliable hero exists", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /if \(layout\.heroStation\) \{\n\s+stationList\.append\(createHeroSection\(layout\.heroStation, template\)\);\n\s+\}/);
  assert.doesNotMatch(source, /createRecommendationEmptyState/);
  assert.doesNotMatch(source, /لا توجد بيانات موثوقة حالياً — جرّب أقرب محطة/);
});

test("home screen uses best and backup section labels", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /الأفضل الآن/);
  assert.match(source, /الخيار الثاني/);
  assert.match(source, /محطات قريبة أخرى/);
});

test("styles keep a premium hero card and full-width primary action", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.station-card-hero \{/);
  assert.match(css, /width: 100%;\n\s+min-height: 54px;/);
});

test("bottom navigation uses a dark premium bar with a green active pill", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.bottom-nav \{/);
  assert.match(css, /position: absolute;/);
  assert.match(css, /bottom: 16px;/);
  assert.match(css, /width: 85%;/);
  assert.match(css, /height: 56px;/);
  assert.match(css, /border-radius: 999px;/);
  assert.match(css, /background: #0f172a;/);
  assert.match(css, /\.app-content \{/);
  assert.match(css, /overflow-y: auto;/);
  assert.match(css, /padding: 52px 12px 96px;/);
  assert.match(css, /\.nav-indicator \{/);
  assert.match(css, /width: calc\(50% - 12px\);/);
  assert.match(css, /transition: transform 200ms ease;/);
  assert.match(css, /\.nav-item \{/);
  assert.match(css, /\.nav-item\.active \{/);
  assert.match(css, /background: #2fa84f;/);
});

test("station cards keep a visual status dot and warmer premium treatment", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.station-card-status::before \{/);
  assert.match(css, /background:\n\s+linear-gradient\(180deg, rgba\(253, 255, 253, 1\), rgba\(237, 248, 239, 0\.98\)\);/);
  assert.match(css, /box-shadow:\n\s+0 16px 34px rgba\(119, 89, 47, 0\.08\),/);
  assert.match(css, /\.station-card-backup \{/);
  assert.match(css, /\.station-card-badge \{/);
});

test("only the maps CTA triggers card navigation interactions", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const clickBlock = source.slice(
    source.indexOf('stationList.addEventListener("click"'),
    source.indexOf('stationList.addEventListener("keydown"'),
  );
  const keydownBlock = source.slice(
    source.indexOf('stationList.addEventListener("keydown"'),
    source.indexOf('recenterUserButton.addEventListener("click"'),
  );

  assert.match(clickBlock, /if \(!stationMapAction\) \{\n\s+return;\n\s+\}/);
  assert.doesNotMatch(clickBlock, /selectStation\(/);
  assert.match(keydownBlock, /const stationButton = event\.target\.closest\("\[data-station-action='maps'\]"\);/);
  assert.doesNotMatch(keydownBlock, /selectStation\(/);
  assert.match(source, /station-card-crown/);
  assert.match(source, /createBackupSection/);
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function createMemoryLogger() {
  return {
    infoMessages: [],
    warnMessages: [],
    info(message) {
      this.infoMessages.push(String(message));
    },
    warn(message) {
      this.warnMessages.push(String(message));
    },
  };
}

function createFakeSocket() {
  const listeners = new Map();

  return {
    readyState: 1,
    sentMessages: [],
    closed: false,
    addEventListener(eventName, listener) {
      const eventListeners = listeners.get(eventName) ?? [];
      eventListeners.push(listener);
      listeners.set(eventName, eventListeners);
    },
    send(message) {
      this.sentMessages.push(String(message));
    },
    close() {
      this.closed = true;
      this.emit("close");
    },
    emit(eventName, payload = {}) {
      const eventListeners = listeners.get(eventName) ?? [];
      eventListeners.forEach((listener) => {
        listener(payload);
      });
    },
  };
}
