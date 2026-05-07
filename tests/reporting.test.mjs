import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  ACTIVITY_LABELS,
  aggregateStation,
  buildStationSections,
  calculateDecisionConfidenceScore,
  computeStationStatus,
  createReportRecord,
  DEMO_DECISION_STATIONS,
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
  getStationConfidenceSummary,
  getStationPriorityScore,
  getStationUrgencyMessage,
  matchesStationSearch,
  minutesSince,
  PRESENCE_PROXIMITY_KM,
  PRESENCE_WINDOW_MINUTES,
  getBestStationDecision,
  getDemoStationDecision,
  predictCrowdStatus,
  predictStationAvailability,
  predictStationStatus,
  projectStations,
  rankStationsForDecision,
  rankStations,
  REPORT_PROXIMITY_KM,
  REPORT_WINDOW_MINUTES,
  sortStationsForDiscovery,
  sortStationsForSearch,
  STATUS_META,
  formatRelativeTime,
  summarizeStationPresence,
} from "../logic.mjs";
import {
  getDevLocationOverrideConfig,
  getDevPanelConfig,
  getLocationModeConfig,
  getProtocolWarning,
} from "../environment-utils.mjs";
import {
  FAVORITE_STATIONS_STORAGE_KEY,
  isFavoriteStation,
  MAX_FAVORITE_STATIONS,
  readFavoriteStations,
  toggleFavoriteStation,
} from "../favorite-stations-storage.mjs";
import { buildDecisionFirstLayout } from "../home-layout-utils.mjs";
import { filterStationsForList } from "../list-utils.mjs";
import { getGoogleMapsUrl, getLeafletMarkerClass } from "../map-utils.mjs";
import { getGoogleRouteMetrics } from "../route-metrics-utils.mjs";
import {
  canNotifyStation,
  getStationAvailabilityNotificationMessage,
  markStationNotified,
  notifyUser,
  shouldNotifyAvailabilityChange,
  STATION_NOTIFICATION_STORAGE_KEY,
} from "../notification-utils.mjs";
import { DEVICE_ID_STORAGE_KEY, getAnonymousDeviceId } from "../presence-storage.mjs";
import {
  MAX_RECENT_STATIONS,
  readRecentStations,
  RECENT_STATIONS_STORAGE_KEY,
  saveRecentStation,
} from "../recent-stations-storage.mjs";
import { readStoredReports } from "../report-storage.mjs";
import { createRepository } from "../repository.mjs";
import { resolveSelectedStationId } from "../selection-utils.mjs";
import { createSupabaseClient, getSupabaseConfig } from "../supabaseClient.mjs";
import {
  getUsageAnalyticsSummary,
  readUsageEvents,
  trackEvent,
  USAGE_ANALYTICS_STORAGE_KEY,
} from "../usage-analytics-storage.mjs";

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

test("long dwell returns busy even if reports are weak", () => {
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
    averageDwellMinutes: 19,
    now,
  });

  assert.equal(status, "busy");
});

test("presence-driven thresholds subtract baseline staff and use dwell and bounce", () => {
  assert.equal(getPresenceDrivenStatus({ activeDevices: 5, averageDwellMinutes: 6, hasRecentPresenceData: true }), "غير مؤكد");
  assert.equal(getPresenceDrivenStatus({ activeDevices: 8, averageDwellMinutes: 4, hasRecentPresenceData: true }), "عالبومبة طول");
  assert.equal(getPresenceDrivenStatus({ activeDevices: 14, averageDwellMinutes: 12, hasRecentPresenceData: true }), "طابور خفيف");
  assert.equal(getPresenceDrivenStatus({ activeDevices: 18, averageDwellMinutes: 12, hasRecentPresenceData: true }), "زحمة");
  assert.equal(getPresenceDrivenStatus({ activeDevices: 8, averageDwellMinutes: 2, bounceRate: 0.5, hasRecentPresenceData: true }), "مسكر");
  assert.equal(getPresenceDrivenStatus({ activeDevices: 0, hasRecentPresenceData: false }), "غير مؤكد");
});

test("Tripoli crowd forecast treats Sunday as high crowd risk", () => {
  const forecast = predictCrowdStatus(
    { status: "available", queueLevel: "short" },
    new Date("2026-04-26T12:00:00"),
    {},
  );

  assert.equal(forecast.predictedStatus, "زحمة");
  assert.equal(forecast.bestTimeWindow, "بعد 10 صباحاً أو آخر اليوم");
  assert.match(forecast.warningMessageArabic, /الأحد/);
});

test("Tripoli crowd forecast treats Thursday as higher crowd risk", () => {
  const forecast = predictCrowdStatus(
    { status: "available", queueLevel: "short" },
    new Date("2026-04-30T12:00:00"),
    {},
  );

  assert.equal(forecast.predictedStatus, "زحمة");
  assert.match(forecast.warningMessageArabic, /الخميس/);
});

test("Tripoli crowd forecast treats Friday morning as best refuel window", () => {
  const forecast = predictCrowdStatus(
    { status: "busy", queueLevel: "long" },
    new Date("2026-05-01T08:00:00"),
    {},
  );

  assert.equal(forecast.predictedStatus, "عالبومبة طول");
  assert.equal(forecast.bestTimeWindow, "الجمعة صباحاً");
});

test("Tripoli crowd forecast lowers crowd risk between 6 and 10 AM", () => {
  const forecast = predictCrowdStatus(
    { status: "busy", queueLevel: "long" },
    new Date("2026-04-27T07:30:00"),
    {},
  );

  assert.equal(forecast.predictedStatus, "عالبومبة طول");
  assert.equal(forecast.bestTimeWindow, "من 6 إلى 10 صباحاً");
});

test("Tripoli crowd forecast shortage mode overrides normal rules", () => {
  const forecast = predictCrowdStatus(
    { status: "available", queueLevel: "short" },
    new Date("2026-05-01T08:00:00"),
    { shortageMode: true },
  );

  assert.equal(forecast.predictedStatus, "مسكر");
  assert.match(forecast.warningMessageArabic, /نقص|طوارئ/);
});

test("passive station prediction applies Sunday crowd risk", () => {
  const prediction = predictStationStatus(
    {
      activeDevices: 8,
      averageDwellMinutes: 4,
      bounceRate: 0,
      arrivalRate: 3,
      lastSignalAt: "2026-04-26T08:55:00.000Z",
    },
    { dayOfWeek: 0, hourOfDay: 9, now: new Date("2026-04-26T09:00:00.000Z") },
  );

  assert.equal(prediction.predictedStatus, "زحمة");
  assert.equal(prediction.confidenceScore, 2);
});

test("passive station prediction applies Thursday crowd risk", () => {
  const prediction = predictStationStatus(
    {
      activeDevices: 8,
      averageDwellMinutes: 4,
      bounceRate: 0,
      arrivalRate: 3,
      lastSignalAt: "2026-04-30T11:55:00.000Z",
    },
    { dayOfWeek: 4, hourOfDay: 12, now: new Date("2026-04-30T12:00:00.000Z") },
  );

  assert.equal(prediction.predictedStatus, "زحمة");
});

test("passive station prediction treats Friday morning as low crowd", () => {
  const prediction = predictStationStatus(
    {
      activeDevices: 18,
      averageDwellMinutes: 7,
      bounceRate: 0,
      arrivalRate: 4,
      lastSignalAt: "2026-05-01T07:55:00.000Z",
    },
    { dayOfWeek: 5, hourOfDay: 8, now: new Date("2026-05-01T08:00:00.000Z") },
  );

  assert.equal(prediction.predictedStatus, "عالبومبة طول");
});

test("passive station prediction marks high dwell as crowded", () => {
  const prediction = predictStationStatus(
    {
      activeDevices: 8,
      averageDwellMinutes: 19,
      bounceRate: 0,
      arrivalRate: 2,
      lastSignalAt: "2026-04-27T12:55:00.000Z",
    },
    { dayOfWeek: 1, hourOfDay: 13, now: new Date("2026-04-27T13:00:00.000Z") },
  );

  assert.equal(prediction.predictedStatus, "زحمة");
});

test("passive station prediction marks high bounce as closed", () => {
  const prediction = predictStationStatus(
    {
      activeDevices: 8,
      averageDwellMinutes: 2,
      bounceRate: 0.5,
      arrivalRate: 3,
      lastSignalAt: "2026-04-27T12:55:00.000Z",
    },
    { dayOfWeek: 1, hourOfDay: 13, now: new Date("2026-04-27T13:00:00.000Z") },
  );

  assert.equal(prediction.predictedStatus, "مسكر");
});

test("passive station prediction marks low activity and short dwell as direct pump", () => {
  const prediction = predictStationStatus(
    {
      activeDevices: 8,
      averageDwellMinutes: 4,
      bounceRate: 0,
      arrivalRate: 1,
      lastSignalAt: "2026-04-27T12:55:00.000Z",
    },
    { dayOfWeek: 1, hourOfDay: 13, now: new Date("2026-04-27T13:00:00.000Z") },
  );

  assert.equal(prediction.predictedStatus, "عالبومبة طول");
});

test("decision prediction follows Tripoli day and time patterns", () => {
  assert.equal(
    predictStationAvailability(
      { id: "sunday", status: "unknown" },
      { dayOfWeek: 0, hourOfDay: 13, now: new Date("2026-04-26T13:00:00.000Z") },
    ).status,
    "crowded",
  );
  assert.equal(
    predictStationAvailability(
      { id: "friday", status: "unknown" },
      { dayOfWeek: 5, hourOfDay: 8, now: new Date("2026-05-01T08:00:00.000Z") },
    ).status,
    "available",
  );
  assert.equal(
    predictStationAvailability(
      { id: "closed", status: "no_fuel", lastSignalAt: "2026-04-27T07:55:00.000Z" },
      { dayOfWeek: 1, hourOfDay: 8, now: new Date("2026-04-27T08:00:00.000Z") },
    ).status,
    "noFuel",
  );
});

test("decision confidence score uses freshness, activity, source, patterns, and emergency mode", () => {
  const now = new Date("2026-04-27T08:00:00.000Z");
  const highConfidence = calculateDecisionConfidenceScore(
    {
      activeDevices: 6,
      recentSignalsCount: 4,
      lastSignalAt: "2026-04-27T07:58:00.000Z",
      statusSource: "confirmed",
    },
    {
      now,
      dayOfWeek: 1,
      hourOfDay: 8,
      prediction: { status: "available", source: "confirmed" },
    },
  );
  const emergencyConfidence = calculateDecisionConfidenceScore(
    {
      activeDevices: 0,
      recentSignalsCount: 0,
      lastSignalAt: "2026-04-27T06:30:00.000Z",
    },
    {
      now,
      dayOfWeek: 1,
      hourOfDay: 8,
      emergencyMode: true,
      prediction: { status: "unknown", source: "predicted" },
    },
  );

  assert.equal(highConfidence, 90);
  assert.ok(emergencyConfidence < highConfidence);
  assert.ok(emergencyConfidence >= 0);
});

test("decision ranking returns best station output with Arabic reason and arrival estimate", () => {
  const now = new Date("2026-04-27T08:00:00.000Z");
  const decision = getBestStationDecision(
    [
      {
        id: "near-crowded",
        name: "محطة قريبة مزدحمة",
        distanceKm: 0.2,
        status: "busy",
        queueLevel: "long",
        activeDevices: 18,
        averageDwellMinutes: 22,
        lastSignalAt: "2026-04-27T07:58:00.000Z",
        recentSignalsCount: 6,
      },
      {
        id: "best",
        name: "محطة مناسبة",
        distanceKm: 1,
        status: "available",
        queueLevel: "short",
        activeDevices: 5,
        lastSignalAt: "2026-04-27T07:57:00.000Z",
        recentSignalsCount: 4,
        statusSource: "confirmed",
      },
      {
        id: "closed",
        name: "محطة مغلقة",
        distanceKm: 0.1,
        status: "no_fuel",
        lastSignalAt: "2026-04-27T07:56:00.000Z",
        recentSignalsCount: 2,
      },
    ],
    { now, dayOfWeek: 1, hourOfDay: 8 },
  );

  assert.equal(decision.bestStation.id, "best");
  assert.equal(decision.status, "available");
  assert.equal(decision.distanceKm, 1);
  assert.equal(decision.estimatedArrivalMinutes, 6);
  assert.match(decision.reasonText, /أفضل خيار حالياً/);
  assert.ok(decision.confidenceScore > 0);
});

test("decision ranking demo data is immediately runnable", () => {
  const demoDecision = getDemoStationDecision({
    now: new Date("2026-04-27T08:00:00.000Z"),
  });
  const ranked = rankStationsForDecision(DEMO_DECISION_STATIONS, {
    now: new Date("2026-04-27T08:00:00.000Z"),
    dayOfWeek: 1,
    hourOfDay: 8,
  });

  assert.ok(DEMO_DECISION_STATIONS.length >= 3);
  assert.ok(demoDecision.bestStation);
  assert.equal(ranked.rankedStations[0].id, demoDecision.bestStation.id);
});

test("decision ranking recalculates distance from user coordinates when available", () => {
  const now = new Date("2026-04-27T08:00:00.000Z");
  const decision = getBestStationDecision(
    [
      {
        id: "stale-distance",
        name: "محطة بعيدة بقيمة قديمة",
        latitude: 32.9028,
        longitude: 13.3354,
        distanceKm: 0.1,
        status: "available",
        queueLevel: "short",
        activeDevices: 5,
        lastSignalAt: "2026-04-27T07:58:00.000Z",
        recentSignalsCount: 3,
      },
      {
        id: "coordinate-near",
        name: "محطة قريبة بالإحداثيات",
        latitude: 32.8872,
        longitude: 13.1913,
        distanceKm: 99,
        status: "available",
        queueLevel: "short",
        activeDevices: 5,
        lastSignalAt: "2026-04-27T07:58:00.000Z",
        recentSignalsCount: 3,
      },
    ],
    {
      now,
      dayOfWeek: 1,
      hourOfDay: 8,
      userLocation: {
        latitude: 32.8872,
        longitude: 13.1913,
      },
    },
  );

  assert.equal(decision.bestStation.id, "coordinate-near");
  assert.ok(decision.bestStation.distanceKm < 0.01);
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
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString(), dwellMinutes: 20 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString(), dwellMinutes: 21 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 3 * 60000).toISOString(), dwellMinutes: 19 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 4 * 60000).toISOString(), dwellMinutes: 22 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString(), dwellMinutes: 20 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString(), dwellMinutes: 19 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString(), dwellMinutes: 21 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 3 * 60000).toISOString(), dwellMinutes: 20 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString(), dwellMinutes: 21 },
    { stationId: "station-1", lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString(), dwellMinutes: 20 },
  ], now)[0];

  assert.equal(result.status, "busy");
  assert.equal(result.queueLevel, "long");
  assert.equal(result.activeDevices, 10);
  assert.ok(result.averageDwellMinutes > 18);
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
  assert.equal(result.status, "unknown");
  assert.equal(getDisplayStatus(result), "طابور خفيف");
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

test("confidence summary follows active device, signal count, and freshness rules", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");

  assert.deepEqual(
    getStationConfidenceSummary({ activeDevices: 5, lastUpdated: "2026-04-24T11:20:00.000Z", now }),
    { level: "high", labelArabic: "ثقة عالية" },
  );
  assert.deepEqual(
    getStationConfidenceSummary({ activeDevices: 1, recentSignalsCount: 3, lastUpdated: "2026-04-24T11:55:00.000Z", now }),
    { level: "high", labelArabic: "ثقة عالية" },
  );
  assert.deepEqual(
    getStationConfidenceSummary({ activeDevices: 2, lastUpdated: "2026-04-24T11:20:00.000Z", now }),
    { level: "medium", labelArabic: "ثقة متوسطة" },
  );
  assert.deepEqual(
    getStationConfidenceSummary({ activeDevices: 0, lastUpdated: "2026-04-24T11:35:00.000Z", now }),
    { level: "medium", labelArabic: "ثقة متوسطة" },
  );
  assert.deepEqual(
    getStationConfidenceSummary({ activeDevices: 0, lastUpdated: "2026-04-24T11:20:00.000Z", now }),
    { level: "low", labelArabic: "ثقة ضعيفة" },
  );
});

test("station summaries expose passive prediction and confidence fields", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const result = projectStations(
    [station],
    [],
    { latitude: 32.88, longitude: 13.19 },
    [
      { stationId: "station-1", lastSeenAt: "2026-04-24T11:59:00.000Z", dwellMinutes: 4 },
      { stationId: "station-1", lastSeenAt: "2026-04-24T11:58:00.000Z", dwellMinutes: 5 },
      { stationId: "station-1", lastSeenAt: "2026-04-24T11:57:00.000Z", dwellMinutes: 4 },
      { stationId: "station-1", lastSeenAt: "2026-04-24T11:56:00.000Z", dwellMinutes: 5 },
      { stationId: "station-1", lastSeenAt: "2026-04-24T11:55:00.000Z", dwellMinutes: 4 },
    ],
    now,
  )[0];

  assert.equal(result.predictedStatus, "طابور خفيف");
  assert.equal(result.predicted_status, "طابور خفيف");
  assert.equal(result.arrivalRate, 5);
  assert.equal(result.confidenceScore, 2);
  assert.equal(result.confidenceLevel, "high");
  assert.equal(result.confidenceLabelArabic, "ثقة عالية");
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

test("recent stations are saved most-recent first with duplicates removed and max five kept", () => {
  const storage = createMemoryStorage();

  for (let index = 1; index <= 6; index += 1) {
    saveRecentStation(
      { id: `station-${index}`, name: `محطة ${index}`, distanceKm: index },
      { now: new Date(`2026-04-24T12:0${index}:00.000Z`), storage },
    );
  }
  saveRecentStation(
    { id: "station-3", name: "محطة 3", distanceKm: 0.7 },
    { now: new Date("2026-04-24T12:10:00.000Z"), storage },
  );

  const recentStations = readRecentStations(storage);

  assert.equal(recentStations.length, MAX_RECENT_STATIONS);
  assert.deepEqual(recentStations.map((item) => item.id), [
    "station-3",
    "station-6",
    "station-5",
    "station-4",
    "station-2",
  ]);
  assert.equal(recentStations[0].distance, 0.7);
  assert.match(storage.getItem(RECENT_STATIONS_STORAGE_KEY), /station-3/);
});

test("favorite stations toggle locally with max ten saved", () => {
  const storage = createMemoryStorage();

  for (let index = 1; index <= 11; index += 1) {
    toggleFavoriteStation(
      { id: `station-${index}`, name: `محطة ${index}`, distanceKm: index / 10 },
      storage,
    );
  }

  let favoriteStations = readFavoriteStations(storage);
  assert.equal(favoriteStations.length, MAX_FAVORITE_STATIONS);
  assert.equal(isFavoriteStation("station-11", storage), true);
  assert.equal(isFavoriteStation("station-1", storage), false);
  assert.equal(favoriteStations[0].distance, 1.1);

  const result = toggleFavoriteStation({ id: "station-11", name: "محطة 11" }, storage);
  favoriteStations = readFavoriteStations(storage);

  assert.equal(result.isFavorite, false);
  assert.equal(isFavoriteStation("station-11", storage), false);
  assert.equal(favoriteStations.length, MAX_FAVORITE_STATIONS - 1);
  assert.match(storage.getItem(FAVORITE_STATIONS_STORAGE_KEY), /station-10/);
});

test("usage analytics track local events and summarize account activity", () => {
  const storage = createMemoryStorage();
  const now = new Date("2026-04-24T12:00:00.000Z");

  trackEvent("app_open", {}, { now, storage });
  trackEvent(
    "station_opened_google_maps",
    { stationId: "station-1", stationName: "محطة السياحي" },
    { now, storage },
  );
  trackEvent("search_used", {}, { now, storage });
  trackEvent("favorite_added", { station_id: "station-1", station_name: "محطة السياحي" }, { now, storage });
  trackEvent("favorite_removed", { stationId: "station-1", stationName: "محطة السياحي" }, { now, storage });
  trackEvent("tab_changed", { tabName: "account" }, { now, storage });

  const usageEvents = readUsageEvents(storage);
  const summary = getUsageAnalyticsSummary(storage);

  assert.equal(usageEvents.length, 6);
  assert.equal(usageEvents[0].event_name, "tab_changed");
  assert.equal(usageEvents[0].tab_name, "account");
  const stationOpenEvent = usageEvents.find((event) => event.event_name === "station_opened_google_maps");
  assert.equal(stationOpenEvent.station_id, "station-1");
  assert.equal(stationOpenEvent.station_name, "محطة السياحي");
  assert.equal(summary.stationOpenCount, 1);
  assert.equal(summary.searchUsedCount, 1);
  assert.match(storage.getItem(USAGE_ANALYTICS_STORAGE_KEY), /station_opened_google_maps/);
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

test("developer location override reads runtime config and validates coordinates", () => {
  assert.deepEqual(
    getDevLocationOverrideConfig(
      {},
      {
        BENZINA_CONFIG: {
          DEV_LOCATION_OVERRIDE: {
            enabled: true,
            latitude: 32.9028,
            longitude: 13.3354,
          },
        },
      },
    ),
    {
      enabled: true,
      hasValidLocation: true,
      latitude: 32.9028,
      longitude: 13.3354,
    },
  );

  assert.deepEqual(
    getDevLocationOverrideConfig(
      {},
      {
        BENZINA_CONFIG: {
          DEV_LOCATION_OVERRIDE_ENABLED: "true",
          DEV_LOCATION_OVERRIDE_LATITUDE: "",
          DEV_LOCATION_OVERRIDE_LONGITUDE: "13.3354",
        },
      },
    ),
    {
      enabled: true,
      hasValidLocation: false,
      latitude: null,
      longitude: 13.3354,
    },
  );
});

test("developer prediction panel is enabled only through runtime config", () => {
  assert.deepEqual(getDevPanelConfig({}, {}), { enableDevPanel: false });
  assert.deepEqual(
    getDevPanelConfig(
      {},
      {
        BENZINA_CONFIG: {
          ENABLE_DEV_PANEL: "true",
        },
      },
    ),
    { enableDevPanel: true },
  );
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

test("supabase upsert errors include response body for debugging RLS failures", async () => {
  const client = createSupabaseClient({
    config: {
      url: "https://demo.supabase.co",
      anonKey: "anon-key",
    },
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => '{"message":"new row violates row-level security policy"}',
    }),
    logger: createMemoryLogger(),
  });

  await assert.rejects(
    client.upsert("station_presence", { station_id: "station-1" }),
    /Supabase upsert failed: 403.*row-level security policy/,
  );
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

test("ranking engine returns best, backup, and nearby stations by status priority", () => {
  const ranking = rankStations([
    { id: "closed", status: "no_fuel", queueLevel: "medium", distanceKm: 0.1, confidenceLevel: "high", lastUpdated: "2026-04-24T11:59:00.000Z" },
    { id: "busy", status: "busy", activityLevel: "busy", queueLevel: "long", distanceKm: 0.2, confidenceLevel: "high", lastUpdated: "2026-04-24T11:58:00.000Z" },
    { id: "light", status: "available", queueLevel: "medium", distanceKm: 1.8, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:56:00.000Z" },
    { id: "direct", status: "available", queueLevel: "short", distanceKm: 2.5, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:55:00.000Z" },
  ]);

  assert.equal(ranking.bestStation?.id, "direct");
  assert.equal(ranking.backupStation?.id, "light");
  assert.deepEqual(ranking.nearbyStations.map((station) => station.id), ["busy", "closed"]);
});

test("ranking engine never recommends closed stations unless every station is closed", () => {
  const mixedRanking = rankStations([
    { id: "closed-near", status: "no_fuel", queueLevel: "medium", distanceKm: 0.1, confidenceLevel: "high" },
    { id: "busy-far", status: "busy", activityLevel: "busy", queueLevel: "long", distanceKm: 4.5, confidenceLevel: "low" },
  ]);
  const closedOnlyRanking = rankStations([
    { id: "closed-near", status: "no_fuel", queueLevel: "medium", distanceKm: 0.7, confidenceLevel: "medium" },
    { id: "closed-fresh", status: "no_fuel", queueLevel: "medium", distanceKm: 0.7, confidenceLevel: "high", lastUpdated: "2026-04-24T11:59:00.000Z" },
  ]);

  assert.equal(mixedRanking.bestStation?.id, "busy-far");
  assert.equal(closedOnlyRanking.bestStation?.id, "closed-fresh");
});

test("ranking engine sorts matching statuses by distance, freshness, then confidence", () => {
  const distanceRanking = rankStations([
    { id: "far-fresh", status: "available", queueLevel: "short", distanceKm: 2, confidenceLevel: "high", lastUpdated: "2026-04-24T11:59:00.000Z" },
    { id: "near-old", status: "available", queueLevel: "short", distanceKm: 1, confidenceLevel: "low", lastUpdated: "2026-04-24T11:40:00.000Z" },
  ]);
  const freshnessRanking = rankStations([
    { id: "old-high", status: "available", queueLevel: "short", distanceKm: 1, confidenceLevel: "high", lastUpdated: "2026-04-24T11:40:00.000Z" },
    { id: "fresh-low", status: "available", queueLevel: "short", distanceKm: 1, confidenceLevel: "low", lastUpdated: "2026-04-24T11:59:00.000Z" },
  ]);
  const confidenceRanking = rankStations([
    { id: "medium", status: "available", queueLevel: "short", distanceKm: 1, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:59:00.000Z" },
    { id: "high", status: "available", queueLevel: "short", distanceKm: 1, confidenceLevel: "high", lastUpdated: "2026-04-24T11:59:00.000Z" },
  ]);

  assert.equal(distanceRanking.bestStation?.id, "far-fresh");
  assert.equal(freshnessRanking.bestStation?.id, "old-high");
  assert.equal(confidenceRanking.bestStation?.id, "high");
});

test("ranking engine treats missing status data as low confidence without marking it closed", () => {
  const ranking = rankStations([
    { id: "missing", status: "unknown", queueLevel: "unknown", distanceKm: 0.2, confidenceLevel: "high", hasFreshSignal: false },
    { id: "confirmed", status: "available", queueLevel: "medium", distanceKm: 1.4, confidenceLevel: "medium", hasFreshSignal: true },
  ]);

  assert.equal(ranking.bestStation?.id, "confirmed");
  assert.equal(ranking.backupStation, null);
  assert.equal(ranking.nearbyStations[0]?.id, "missing");
  assert.equal(getDisplayStatus(ranking.nearbyStations[0]), "طابور خفيف");
  assert.equal(ranking.nearbyStations[0].confidenceLevel, "low");
});

test("ranking engine avoids low-confidence recommendations when better confidence exists", () => {
  const ranking = rankStations([
    { id: "low-near", status: "available", queueLevel: "short", distanceKm: 0.2, confidenceLevel: "low", lastUpdated: "2026-04-24T11:59:00.000Z" },
    { id: "medium-far", status: "available", queueLevel: "short", distanceKm: 2.1, confidenceLevel: "medium", lastUpdated: "2026-04-24T11:40:00.000Z" },
  ]);
  const lowOnlyRanking = rankStations([
    { id: "low-near", status: "available", queueLevel: "short", distanceKm: 0.2, confidenceLevel: "low" },
    { id: "low-far", status: "busy", queueLevel: "long", distanceKm: 2.1, confidenceLevel: "low" },
  ]);

  assert.equal(ranking.bestStation?.id, "medium-far");
  assert.equal(lowOnlyRanking.bestStation?.id, "low-near");
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

test("station sections keep low-confidence stations visible instead of treating them as closed", () => {
  const sections = buildStationSections([
    { id: "1", status: "unknown", activityLevel: "unknown", queueLevel: "unknown", distanceKm: 0.3, hasFreshSignal: false, activeDevices: 0 },
    { id: "2", status: "no_fuel", activityLevel: "unknown", queueLevel: "medium", distanceKm: 0.8, hasFreshSignal: true, activeDevices: 0 },
    { id: "3", status: "uncertain", activityLevel: "low", queueLevel: "medium", distanceKm: 1.2, hasFreshSignal: false, activeDevices: 0 },
  ]);

  assert.equal(sections.bestStation?.id, "1");
  assert.equal(sections.bestStation.confidenceLevel, "low");
  assert.equal(getDisplayStatus(sections.bestStation), "طابور خفيف");
  assert.deepEqual(sections.recommendedStations.map((station) => station.id), ["2"]);
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

test("decision-first layout promotes a non-closed hero when no reliable best exists", () => {
  const layout = buildDecisionFirstLayout({
    bestStation: null,
    backupStation: null,
    recommendedStations: [
      { id: "light", status: "unknown", queueLevel: "unknown" },
      { id: "closed", status: "no_fuel", queueLevel: "medium" },
      { id: "busy", status: "busy", queueLevel: "long" },
    ],
    nearbyStations: [{ id: "nearby", status: "available", queueLevel: "short" }],
    avoidStations: [],
  });

  assert.equal(layout.heroStation?.id, "light");
  assert.equal(layout.backupStation?.id, "busy");
  assert.deepEqual(layout.nearbyVisible.map((station) => station.id), ["closed", "nearby"]);
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

test("search matches station name independently from area labels", () => {
  assert.equal(
    matchesStationSearch({ id: "station-name", name: "محطة طريق المطار" }, "المطار"),
    true,
  );
});

test("search results sort by status, distance, then confidence", () => {
  const sortedStations = sortStationsForSearch([
    { id: "closed-near", status: "no_fuel", queueLevel: "medium", distanceKm: 0.1, confidenceLevel: "high" },
    { id: "busy-near", status: "busy", queueLevel: "long", distanceKm: 0.4, confidenceLevel: "high" },
    { id: "light-far", status: "available", queueLevel: "medium", distanceKm: 4.2, confidenceLevel: "high" },
    { id: "direct-far", status: "available", queueLevel: "short", distanceKm: 2.5, confidenceLevel: "low" },
    { id: "direct-near-low", status: "available", queueLevel: "short", distanceKm: 1.2, confidenceLevel: "low" },
    { id: "direct-near-high", status: "available", queueLevel: "short", distanceKm: 1.2, confidenceLevel: "high" },
  ]);

  assert.deepEqual(sortedStations.map((station) => station.id), [
    "direct-near-high",
    "direct-near-low",
    "direct-far",
    "light-far",
    "busy-near",
    "closed-near",
  ]);
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
        if (path === "station_predictions") {
          return [
            {
              station_id: "station-db-1",
              name: "محطة من Supabase",
              latitude: 32.881,
              longitude: 13.2,
              fuel_status: "available",
              crowd_level: "light",
              confidence_score: 0.86,
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
      fuelStatus: "available",
      crowdLevel: "light",
      confidenceScore: 0.86,
    },
  ]);
  assert.equal(reportsResult.length, 1);
  assert.equal(reportsResult[0].id, "report-remote-1");
  assert.match(storage.getItem("benzina_reports"), /report-remote-1/);
  assert.match(logger.infoMessages.join("\n"), /Prediction fetch succeeded\. Count: 1/);
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
  assert.deepEqual(upsertCalls[0].payload, {
    station_id: "station-1",
    device_id: "device-1",
    latitude: 32.88,
    longitude: 13.19,
    distance_to_station_meters: 88,
    last_seen_at: now.toISOString(),
  });
  assert.match(logger.infoMessages.join("\n"), /Presence fetch succeeded\. Active rows: 1/);
  assert.match(logger.infoMessages.join("\n"), /Presence heartbeat saved/);
});

test("repository returns detailed passive presence heartbeat failures for dev diagnostics", async () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const repository = createRepository({
    nowFactory: () => now,
    logger: createMemoryLogger(),
    supabaseClient: {
      isConfigured: true,
      async select() {
        return [];
      },
      async upsert() {
        throw new Error("new row violates row-level security policy");
      },
    },
  });

  const result = await repository.submitPresenceHeartbeat(
    {
      stationId: "station-1",
      deviceId: "device-1",
      latitude: 32.88,
      longitude: 13.19,
      distanceToStationMeters: 88,
      lastSeenAt: now.toISOString(),
    },
    { detailedResult: true },
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /row-level security policy/);
  assert.equal(result.payload.station_id, "station-1");
  assert.equal(result.payload.device_id, "device-1");
  assert.equal(result.payload.distance_to_station_meters, 88);
  assert.equal(result.payload.last_seen_at, now.toISOString());
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

test("presence summary calculates average dwell and bounce rate from active devices", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const counts = summarizeStationPresence(
    [
      {
        stationId: "station-1",
        lastSeenAt: new Date(now.getTime() - 1 * 60000).toISOString(),
        dwellMinutes: 2,
      },
      {
        stationId: "station-1",
        lastSeenAt: new Date(now.getTime() - 2 * 60000).toISOString(),
        dwellMinutes: 10,
      },
      {
        stationId: "station-1",
        lastSeenAt: new Date(now.getTime() - 3 * 60000).toISOString(),
        firstSeenAt: new Date(now.getTime() - 15 * 60000).toISOString(),
      },
    ],
    now,
  );

  assert.equal(counts.get("station-1")?.activeDevices, 3);
  assert.equal(counts.get("station-1")?.averageDwellMinutes, 8);
  assert.equal(counts.get("station-1")?.bounceRate, 1 / 3);
  assert.equal(counts.get("station-1")?.arrivalRate, 3);
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

test("manual reports are counted but passive signals remain primary for status", () => {
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

  assert.equal(result.status, "unknown");
  assert.equal(result.queueLevel, "unknown");
  assert.equal(result.recentReportsCount, 1);
});

test("stations are sorted by nearest first using the active user location", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");
  const stations = [
    { id: "far", name: "Far", latitude: 32.95, longitude: 13.3, distanceKm: 0.1, etaMinutes: 1 },
    { id: "near", name: "Near", latitude: 32.8805, longitude: 13.1915, distanceKm: 99, etaMinutes: 99 },
  ];
  const userLocation = { latitude: 32.88, longitude: 13.19 };

  const result = projectStations(stations, [], userLocation, now);

  assert.equal(result[0].id, "near");
  assert.equal(result[1].id, "far");
  assert.ok(result[0].distanceKm < 0.2);
  assert.equal(result[0].etaMinutes, null);
  assert.equal(result[0].routeSource, "coordinate_projection");
});

test("route metrics fallback recalculates distance and ETA from coordinates", async () => {
  const [metric] = await getGoogleRouteMetrics(
    { latitude: 32.88, longitude: 13.19 },
    [
      {
        id: "near",
        name: "Near",
        latitude: 32.8805,
        longitude: 13.1915,
        distanceKm: 99,
        etaMinutes: 99,
      },
    ],
    {
      runtimeEnv: {},
      browserConfig: {},
    },
  );

  assert.equal(metric.stationId, "near");
  assert.ok(metric.distanceKm < 0.2);
  assert.ok(metric.etaMinutes >= 2);
  assert.equal(metric.routeSource, "fallback");
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
  assert.match(html, /id="list-panel-heading"/);
  assert.match(html, /id="screen-title">أقرب المحطات<\/h2>/);
  assert.match(html, /id="screen-subtitle">اختر المحطة المناسبة وافتحها في خرائط Google<\/p>/);
  assert.match(html, /id="search-toolbar"/);
  assert.match(html, /placeholder="ابحث عن محطة أو منطقة"/);
  assert.match(html, /ابحث باسم المحطة أو المنطقة/);
  assert.match(source, /listEmpty\.textContent = "لا توجد نتائج مطابقة"/);
  assert.match(html, /<nav class="bottom-nav"/);
  assert.match(html, /class="nav-indicator"/);
  assert.match(html, /data-tab="account"/);
  assert.match(html, /حسابي/);
  assert.match(html, /<button type="button" class="nav-item active" data-tab="home"/);
  assert.match(html, /<svg viewBox="0 0 24 24"/);
  assert.match(html, /data-tab="home"/);
  assert.match(html, /data-tab="search"/);
  assert.match(source, /state\.activeTab === "search"/);
  assert.match(source, /const isMapTab = state\.activeTab === "search"/);
  assert.match(source, /const discoveryBaseStations = nearbyBaseStations/);
  assert.match(source, /sortStationsForSearch\(/);
  assert.match(source, /screenTitle\.textContent = isAccountTab \? "حسابي" : isMapTab \? "الخريطة" : "أقرب المحطات"/);
  assert.match(source, /listPanelHeading\.classList\.toggle\("hidden", isHomeTab\)/);
  assert.match(source, /homeInfoNotice\?\.classList\.toggle\("hidden", !isHomeTab\)/);
  assert.match(source, /state\.activeTab === "account"/);
  assert.match(source, /bottomNav\.dataset\.activeTab = state\.activeTab/);
  assert.match(source, /موقعي/);
  assert.match(source, /نستخدم موقعك لعرض أقرب المحطات فقط/);
  assert.match(source, /لا توجد محطات محفوظة/);
  assert.match(source, /createFavoriteStationsCard/);
  assert.match(source, /نشاطك/);
  assert.match(source, /عدد المحطات التي فتحتها/);
  assert.match(source, /عدد عمليات البحث/);
  assert.match(source, /عدد المحطات المحفوظة/);
  assert.match(source, /شيل يساعدك تعرف أقرب محطة مناسبة قبل ما تمشي/);
  assert.match(source, /لا نعرض موقعك لأي مستخدم آخر/);
  assert.match(source, /state\.discoveryRadiusKm = EXPANDED_DISCOVERY_RADIUS_KM/);
  assert.match(source, /distanceKm <= nearbyRadiusKm/);
});

test("app renders from enriched station data only", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /const enrichedStations = buildEnrichedStations\(/);
  assert.match(source, /latestEnrichedStations = enrichedStations/);
  assert.match(source, /logEnrichedStationsTable\(enrichedStations\)/);
  assert.match(source, /assertEnrichedStations\(enrichedStations, "render"\)/);
  assert.match(source, /__isEnrichedStation: true/);
  assert.match(source, /score,/);
  assert.doesNotMatch(source, /latestProjectedStations/);
  assert.doesNotMatch(source, /stations\.find\(\(item\) => item\.id === stationId\)/);
});

test("developer prediction panel is config gated and uses prediction outputs", () => {
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const config = fs.readFileSync(new URL("../config.js", import.meta.url), "utf8");

  assert.match(config, /ENABLE_DEV_PANEL: false/);
  assert.match(source, /getDevPanelConfig\(\)\.enableDevPanel/);
  assert.match(source, /predictStationStatus\(/);
  assert.match(source, /data-dev-output="predictedStatus"/);
  assert.match(source, /data-dev-output="confidence"/);
  assert.match(source, /data-dev-health="deviceId"/);
  assert.match(source, /data-dev-health="nearestStation"/);
  assert.match(source, /data-dev-health="nearestDistance"/);
  assert.match(source, /data-dev-health="lastHeartbeat"/);
  assert.match(source, /data-dev-health="heartbeatStatus"/);
  assert.match(source, /data-dev-health="heartbeatError"/);
  assert.match(source, /logDevPresence\("location source"/);
  assert.match(source, /logDevPresence\("location fetched"/);
  assert.match(source, /logDevPresence\("nearest station"/);
  assert.match(source, /logDevPresence\("heartbeat payload"/);
  assert.match(source, /logDevPresence\("heartbeat sent"/);
  assert.match(source, /logDevPresence\("heartbeat response"/);
  assert.match(source, /logDevPresence\("heartbeat failed reason"/);
  assert.match(source, /station_presence/);
  assert.match(source, /distance_to_station_meters/);
  assert.match(source, /الأجهزة النشطة/);
  assert.match(source, /متوسط البقاء بالدقائق/);
  assert.match(source, /معدل الخروج السريع/);
  assert.match(source, /فحص إشارات الحضور/);
  assert.match(source, /خطأ Supabase/);
  assert.match(css, /\.dev-prediction-panel \{/);
  assert.match(css, /\.dev-signal-health \{/);
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
  const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /card\.classList\.add\("best-station-card"\)/);
  assert.match(css, /\.station-card-best \.station-card-action-map \{/);
  assert.match(css, /\.station-card-hero \{/);
  assert.match(css, /width: 100%;\n\s+min-height: 54px;/);
});

test("bottom navigation keeps the existing Cursor-created visual styling", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  assert.match(css, /\.bottom-nav \{/);
  assert.match(css, /position: absolute;/);
  assert.match(css, /bottom: 16px;/);
  assert.match(css, /left: 16px;/);
  assert.match(css, /right: 16px;/);
  assert.match(css, /height: 72px;/);
  assert.match(css, /grid-template-columns: repeat\(3, 1fr\);/);
  assert.match(css, /border-radius: 28px;/);
  assert.match(css, /background: #1f2a37;/);
  assert.match(css, /\.app-content \{/);
  assert.match(css, /overflow-y: auto;/);
  assert.match(css, /padding: 52px 16px 112px;/);
  assert.match(css, /\.nav-indicator \{/);
  assert.match(css, /display: none;/);
  assert.match(css, /\.nav-item \{/);
  assert.match(css, /\.nav-item\.active \{/);
  assert.match(css, /\.nav-label \{/);
});

test("station cards keep colored status badges and reference-style premium treatment", () => {
  const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(css, /\.station-card-status::before \{/);
  assert.match(css, /content: none;/);
  assert.match(css, /\.station-card-best \{/);
  assert.match(css, /linear-gradient\(135deg, #0f3d2e 0%, #1e7a3a 55%, #2fa84f 100%\)/);
  assert.match(css, /\.station-card-best::before \{/);
  assert.match(css, /\.station-card-best \.station-card-fuel-icon \{/);
  assert.match(css, /\.nearby-list-card \{/);
  assert.match(css, /\.info-notice \{/);
  assert.match(css, /\.station-card-leading \{/);
  assert.match(css, /\.station-card-chevron \{/);
  assert.match(css, /\.station-card-status-light \{/);
  assert.match(css, /\.station-card-backup \{/);
  assert.match(css, /\.station-card-badge \{/);
  assert.match(css, /\.backup-station-card \{/);
  assert.match(html, /class="station-card-leading"/);
  assert.match(html, /class="station-card-chevron"/);
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
