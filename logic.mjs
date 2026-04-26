export const REPORT_WINDOW_MINUTES = 60;
export const REPORT_PROXIMITY_KM = 0.2;
export const PRESENCE_WINDOW_MINUTES = 5;
export const PRESENCE_RECENT_WINDOW_MINUTES = 10;
export const PRESENCE_PROXIMITY_KM = 0.2;
export const PRESENCE_HEARTBEAT_MS = 60000;
export const DEFAULT_DISCOVERY_RADIUS_KM = 5;

export const STATUS_META = {
  available: {
    label: "عالبومبة طول",
    className: "status-available",
    markerColor: "#168A3A",
  },
  busy: {
    label: "زحمة",
    className: "status-crowded",
    markerColor: "#F59E0B",
  },
  crowded: {
    label: "زحمة",
    className: "status-crowded",
    markerColor: "#F59E0B",
  },
  no_fuel: {
    label: "مسكر",
    className: "status-no-fuel",
    markerColor: "#DC4C3F",
  },
  uncertain: {
    label: "طابور خفيف",
    shortLabel: "طابور خفيف",
    className: "status-uncertain",
    markerColor: "#182433",
  },
  unknown: {
    label: "طابور خفيف",
    className: "status-unknown",
    markerColor: "#9CA3AF",
  },
};

export const QUEUE_LABELS = {
  short: "قصير",
  medium: "متوسط",
  long: "طويل",
  unknown: "مسكر",
};

export const ACTIVITY_LABELS = {
  unknown: "طابور خفيف",
  low: "طابور خفيف",
  likely_available: "طابور خفيف",
  busy: "زحمة",
};

export const CONFIDENCE_LABELS_ARABIC = {
  high: "ثقة عالية",
  medium: "ثقة متوسطة",
  low: "ثقة ضعيفة",
};

const QUEUE_SCORE_WEIGHTS = {
  short: 30,
  medium: 10,
  long: -20,
  unknown: 0,
};
const QUEUE_LEVEL_WEIGHTS = {
  short: 1,
  medium: 2,
  long: 3,
};
const REPORT_WEIGHT_TIE_THRESHOLD = 0.2;

const englishNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export function formatNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return englishNumberFormatter.format(value);
  }

  return String(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/،/g, ",");
}
export function createReportRecord({
  stationId,
  status,
  queueLevel,
  station,
  id = `report-${crypto.randomUUID()}`,
  createdAt = new Date().toISOString(),
}) {
  return {
    id,
    stationId,
    status,
    queueLevel,
    createdAt,
    latitude: station.latitude,
    longitude: station.longitude,
  };
}

export function getDemoUpdateDelayMs(randomValue = Math.random()) {
  return 30000 + Math.round(randomValue * 30000);
}

export function getDemoReportPreset(randomValue = Math.random()) {
  if (randomValue < 0.42) {
    return { status: "available", queueLevel: "short" };
  }

  if (randomValue < 0.72) {
    return { status: "available", queueLevel: "medium" };
  }

  if (randomValue < 0.9) {
    return { status: "available", queueLevel: "long" };
  }

  if (randomValue < 0.96) {
    return { status: "no_fuel", queueLevel: "medium" };
  }

  return { status: "no_fuel", queueLevel: "long" };
}

export function getReportSuccessMessage(stationName, statusLabel = "") {
  if (statusLabel) {
    return `تم تحديث ${stationName} إلى ${statusLabel}`;
  }

  return `تم إرسال البلاغ بنجاح إلى ${stationName}`;
}

export function formatDistanceLabel(distanceKm) {
  if (distanceKm < 1) {
    return "أقل من 1 كم";
  }

  return `${formatNumber(Number(distanceKm.toFixed(1)))} كم`;
}

export function getDisplayStatus(station) {
  if (!station) {
    return "طابور خفيف";
  }

  if (station.status === "no_fuel") {
    return "مسكر";
  }

  if (
    station.status === "busy" ||
    station.status === "crowded" ||
    station.queueLevel === "long" ||
    station.activityLevel === "busy" ||
    (station.activeDevices ?? 0) >= 10
  ) {
    return "زحمة";
  }

  if (station.status === "available" && station.queueLevel === "medium") {
    return "طابور خفيف";
  }

  if (station.status === "available" && station.queueLevel === "short") {
    return "عالبومبة طول";
  }

  if (station.status === "available") {
    return "طابور خفيف";
  }

  return "طابور خفيف";
}

export function getReportEligibility({
  userLocation,
  station,
  hasUserLocation,
}) {
  if (!station) {
    return {
      canSubmit: false,
      distanceKm: null,
      message: "فعّل الموقع لإرسال البلاغ",
    };
  }

  if (!hasUserLocation || !userLocation) {
    return {
      canSubmit: false,
      distanceKm: null,
      message: "فعّل الموقع لإرسال البلاغ",
    };
  }

  const distanceKm = computeDistanceKm(userLocation, station);

  if (distanceKm > REPORT_PROXIMITY_KM) {
    return {
      canSubmit: false,
      distanceKm,
      message: "يجب أن تكون قريب من المحطة لإرسال بلاغ",
    };
  }

  return {
    canSubmit: true,
    distanceKm,
    message: "",
  };
}

export function computeDistanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function minutesSince(dateLike, now = new Date()) {
  return (now.getTime() - new Date(dateLike).getTime()) / 60000;
}

export function isReportRecent(report, now = new Date()) {
  return getReportWeight(report, now) > 0;
}

export function getReportWeight(report, now = new Date()) {
  const ageMinutes = minutesSince(getReportTimestamp(report), now);
  if (ageMinutes < 0) {
    return 0;
  }

  if (ageMinutes <= 10) {
    return 1;
  }

  if (ageMinutes <= 30) {
    return 0.7;
  }

  if (ageMinutes > REPORT_WINDOW_MINUTES) {
    return 0;
  }

  return 0.4;
}

export function getRecentReportsForStation(stationId, reports, now = new Date()) {
  return reports.filter((report) => {
    const reportStationId = report.stationId ?? report.station_id;
    return reportStationId === stationId && isReportRecent(report, now);
  });
}

export function aggregateStation(station, reports, now = new Date()) {
  return aggregateStationWithPresence(station, reports, {}, now);
}

function aggregateStationWithPresence(station, reports, presenceSummary = {}, now = new Date()) {
  const recentReports = getRecentReportsForStation(station.id, reports, now);
  const activeDevices = presenceSummary.activeDevices ?? 0;
  const recentPresenceSignalsCount = presenceSummary.recentSignalsCount ?? 0;
  const activityLevel = getActivityLevel(activeDevices);
  const lastPresenceAt = presenceSummary.lastSeenAt ?? null;
  const hasRecentPresenceData = Boolean(lastPresenceAt) &&
    minutesSince(lastPresenceAt, now) <= PRESENCE_RECENT_WINDOW_MINUTES;

  let availableWeight = 0;
  let noFuelWeight = 0;
  let weightedQueueTotal = 0;
  let weightedQueueSum = 0;

  recentReports.forEach((report) => {
    const weight = getReportWeight(report, now);
    if (weight <= 0) {
      return;
    }

    if (report.status === "available") {
      availableWeight += weight;
    }

    if (report.status === "no_fuel") {
      noFuelWeight += weight;
    }

    const queueWeight = QUEUE_LEVEL_WEIGHTS[report.queueLevel];
    if (typeof queueWeight === "number") {
      weightedQueueTotal += queueWeight * weight;
      weightedQueueSum += weight;
    }
  });

  const queueLevel = getResolvedQueueLevel(weightedQueueTotal, weightedQueueSum, activeDevices);
  const status = computeStationStatus({
    reports: recentReports,
    activeDevices,
    hasRecentPresenceData,
    now,
  });

  const latestReport = recentReports
    .slice()
    .sort((left, right) => new Date(getReportTimestamp(right)) - new Date(getReportTimestamp(left)))[0];
  const lastUpdated = getMostRecentTimestamp(getReportTimestamp(latestReport), lastPresenceAt);
  const hasFreshSignal = Boolean(lastUpdated) && minutesSince(lastUpdated, now) <= REPORT_WINDOW_MINUTES;
  const signalNote = getSignalFreshnessNote(lastUpdated, now);
  const finalStatus = status;
  const finalQueueLevel = queueLevel;
  const recentReportSignalsCount = recentReports.filter(
    (report) => minutesSince(getReportTimestamp(report), now) <= PRESENCE_RECENT_WINDOW_MINUTES,
  ).length;
  const confidence = getStationConfidenceSummary({
    activeDevices,
    recentSignalsCount: recentPresenceSignalsCount + recentReportSignalsCount,
    lastUpdated,
    recentReportsCount: recentReports.length,
    now,
  });

  return {
    ...station,
    status: finalStatus,
    computedStatus: finalStatus,
    queueLevel: finalQueueLevel,
    activeDevices,
    activityLevel,
    activityLabel: ACTIVITY_LABELS[activityLevel],
    lastUpdated,
    lastSignalAt: lastPresenceAt,
    signalNote,
    hasFreshSignal,
    recentReportsCount: recentReports.length,
    recentSignalsCount: recentPresenceSignalsCount + recentReportSignalsCount,
    confidenceLevel: confidence.level,
    confidenceLabelArabic: confidence.labelArabic,
  };
}

function getWeightedQueueLevel(weightedQueueTotal, weightedQueueSum) {
  if (weightedQueueSum === 0) {
    return "unknown";
  }

  const averageQueueValue = weightedQueueTotal / weightedQueueSum;

  if (averageQueueValue <= 1.5) {
    return "short";
  }

  if (averageQueueValue <= 2.5) {
    return "medium";
  }

  return "long";
}

export function formatRelativeTime(dateLike, now = new Date()) {
  if (!dateLike) {
    return "لا توجد إشارات حديثة";
  }

  const diffMinutes = Math.round(minutesSince(dateLike, now));
  if (diffMinutes > REPORT_WINDOW_MINUTES) {
    return "لا توجد إشارات حديثة";
  }

  if (diffMinutes < 1) {
    return "آخر تحديث: منذ أقل من دقيقة";
  }
  if (diffMinutes === 1) {
    return "آخر تحديث: منذ دقيقة";
  }
  if (diffMinutes < 60) {
    return `آخر تحديث: منذ ${formatNumber(diffMinutes)} دقيقة`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return "آخر تحديث: منذ ساعة";
  }

  return `آخر تحديث: منذ ${formatNumber(diffHours)} ساعات`;
}

export function getLiveActivityLabel(activeDevices = 0) {
  return `${formatNumber(activeDevices)} مستخدمين حالياً`;
}

export function getStationUrgencyMessage(station, now = new Date()) {
  if (!station?.lastUpdated || station.status !== "available") {
    return "";
  }

  const diffMinutes = Math.round(minutesSince(station.lastUpdated, now));
  if (diffMinutes < 0 || diffMinutes > REPORT_WINDOW_MINUTES) {
    return "";
  }

  if (diffMinutes < 1) {
    return "كانت شغالة قبل أقل من دقيقة";
  }

  if (diffMinutes === 1) {
    return "كانت شغالة قبل دقيقة";
  }

  return `كانت شغالة قبل ${formatNumber(diffMinutes)} دقيقة`;
}

export function projectStations(stations, reports, userLocation, presenceRowsOrNow = [], maybeNow = new Date()) {
  const hasPresenceRows = Array.isArray(presenceRowsOrNow);
  const presenceRows = hasPresenceRows ? presenceRowsOrNow : [];
  const now = hasPresenceRows ? maybeNow : presenceRowsOrNow;
  const presenceByStation = summarizeStationPresence(presenceRows, now);

  return stations
    .map((station) => {
      const aggregated = aggregateStationWithPresence(station, reports, presenceByStation.get(station.id), now);
      return {
        ...aggregated,
        distanceKm: computeDistanceKm(userLocation, station),
      };
    })
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

export function getStationPriorityScore(station) {
  const statusScore = getBestStationBaseScore(station);
  const queueScore = QUEUE_SCORE_WEIGHTS[station.queueLevel] ?? 0;
  const distancePenalty = (station.distanceKm ?? 0) * 10;
  const activeDevicesBonus = (station.activeDevices ?? 0) >= 6 ? 20 : 0;
  const recentReportsBonus = (station.recentReportsCount ?? 0) >= 3 ? 10 : 0;

  return statusScore + queueScore - distancePenalty + activeDevicesBonus + recentReportsBonus;
}

export function getActivityLevel(activeDevices) {
  if (activeDevices >= 16) {
    return "busy";
  }

  if (activeDevices >= 6) {
    return "likely_available";
  }

  if (activeDevices >= 2) {
    return "low";
  }

  return "unknown";
}

export function getStationActivitySummary(activeDevices) {
  const level = getActivityLevel(activeDevices);

  return {
    level,
    label: ACTIVITY_LABELS[level],
  };
}

export function computeStationStatus({
  reports,
  activeDevices,
  hasRecentPresenceData = activeDevices > 0,
  now = new Date(),
}) {
  const recentReports = Array.isArray(reports)
    ? reports.filter((report) => isReportRecent(report, now))
    : [];
  const availableReports = recentReports.filter((report) => report.status === "available").length;
  const noFuelReports = recentReports.filter((report) => report.status === "no_fuel").length;

  if (noFuelReports > availableReports && noFuelReports > 0) {
    return "no_fuel";
  }

  if (availableReports > noFuelReports && availableReports > 0) {
    return activeDevices > 8 ? "busy" : "available";
  }

  if (!hasRecentPresenceData && recentReports.length === 0) {
    return "unknown";
  }

  if (activeDevices > 8) {
    return "busy";
  }

  if (hasRecentPresenceData && activeDevices > 0) {
    return "available";
  }

  return "unknown";
}

export function summarizeStationPresence(presenceRows, now = new Date()) {
  const countsByStation = new Map();

  presenceRows.forEach((row) => {
    if (!row?.stationId || !row?.lastSeenAt) {
      return;
    }

    const ageMinutes = minutesSince(row.lastSeenAt, now);
    if (ageMinutes > REPORT_WINDOW_MINUTES) {
      return;
    }

    const existingSummary = countsByStation.get(row.stationId) ?? {
      activeDevices: 0,
      recentSignalsCount: 0,
      lastSeenAt: null,
    };

    countsByStation.set(row.stationId, {
      activeDevices:
        existingSummary.activeDevices + (ageMinutes <= PRESENCE_WINDOW_MINUTES ? 1 : 0),
      recentSignalsCount:
        existingSummary.recentSignalsCount + (ageMinutes <= PRESENCE_RECENT_WINDOW_MINUTES ? 1 : 0),
      lastSeenAt: getMostRecentTimestamp(existingSummary.lastSeenAt, row.lastSeenAt),
    });
  });

  return countsByStation;
}

export function getPresenceDrivenStatus(activeDevices, hasRecentPresenceData) {
  if (!hasRecentPresenceData) {
    return "طابور خفيف";
  }

  if (activeDevices === 0) {
    return "طابور خفيف";
  }

  if (activeDevices <= 3) {
    return "عالبومبة طول";
  }

  if (activeDevices <= 8) {
    return "طابور خفيف";
  }

  return "زحمة";
}

export function findNearestStationWithinDistance(userLocation, stations, maxDistanceKm = PRESENCE_PROXIMITY_KM) {
  if (!userLocation || !Array.isArray(stations) || stations.length === 0) {
    return null;
  }

  const nearestStation = stations
    .map((station) => ({
      station,
      distanceKm: computeDistanceKm(userLocation, station),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0];

  if (!nearestStation || nearestStation.distanceKm > maxDistanceKm) {
    return null;
  }

  return nearestStation;
}

export function getStationPriorityGroup(station) {
  if (station.status === "no_fuel") {
    return "avoid";
  }

  return "candidate";
}

export function rankStations(stations, { listLimit = 5 } = {}) {
  const rankedStations = sortStationsForRanking(stations);
  const nonClosedStations = rankedStations.filter((station) => getDisplayStatus(station) !== "مسكر");
  const confidentStations = nonClosedStations.filter((station) => station.confidenceLevel !== "low");
  const recommendationPool = confidentStations.length
    ? confidentStations
    : nonClosedStations.length
      ? nonClosedStations
      : rankedStations;
  const bestStation = recommendationPool[0] ?? null;
  const backupStation = recommendationPool.find((station) => station.id !== bestStation?.id) ?? null;
  const selectedIds = new Set([bestStation?.id, backupStation?.id].filter(Boolean));
  const nearbyStations = rankedStations
    .filter((station) => !selectedIds.has(station.id))
    .slice(0, listLimit);

  return {
    bestStation,
    backupStation,
    nearbyStations,
  };
}

export function buildStationSections(
  stations,
  {
    bestCandidates = stations,
    listCandidates = stations,
    listLimit = 5,
  } = {},
) {
  const rankedStations = sortStationsForRanking(stations);
  const rankedListCandidates = sortStationsForRanking(listCandidates);
  const rankedCandidateIds = new Set(bestCandidates.map((station) => station.id));
  const rankedCandidates = rankedStations.filter((station) => rankedCandidateIds.has(station.id));
  const {
    bestStation,
    backupStation,
  } = rankStations(rankedCandidates, { listLimit });
  const selectedIds = new Set([bestStation?.id, backupStation?.id].filter(Boolean));
  const fallbackStations = rankedStations.filter((station) => !selectedIds.has(station.id));
  const nearbyPool = rankedListCandidates.filter((station) => !selectedIds.has(station.id));
  const visibleNearbyStations = (nearbyPool.length ? nearbyPool : fallbackStations)
    .slice(0, listLimit)
    .map((station, index) => ({
      ...station,
      recommendationBadge: getRecommendationBadge(index),
    }));
  const recommendedIds = new Set(visibleNearbyStations.map((station) => station.id));
  const nearbyStations = rankedListCandidates
    .filter(
      (station) =>
        station.id !== bestStation?.id &&
        station.id !== backupStation?.id &&
        !recommendedIds.has(station.id),
    )
    .map((station) => ({
      ...station,
      recommendationBadge: "خيار جيد",
    }));

  return {
    bestStation,
    backupStation,
    recommendedStations: visibleNearbyStations,
    nearbyStations,
    avoidStations: [],
  };
}

export function isReliableBestStation(station) {
  const displayStatus = getDisplayStatus(station);
  return (
    (displayStatus === "عالبومبة طول" ||
      displayStatus === "طابور خفيف" ||
      displayStatus === "زحمة") &&
    station.confidenceLevel !== "low" &&
    station.status !== "unknown" &&
    station.status !== "uncertain"
  );
}

function compareBestStationCandidates(left, right) {
  const availabilityDelta = getBestStationAvailabilityRank(right) - getBestStationAvailabilityRank(left);
  if (availabilityDelta !== 0) {
    return availabilityDelta;
  }

  const distanceDelta = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  const recencyDelta = getBestStationTimestamp(right) - getBestStationTimestamp(left);
  if (recencyDelta !== 0) {
    return recencyDelta;
  }

  return getStationPriorityScore(right) - getStationPriorityScore(left);
}

function getBestStationAvailabilityRank(station) {
  const displayStatus = getDisplayStatus(station);
  if (displayStatus === "عالبومبة طول") {
    return 3;
  }

  if (displayStatus === "طابور خفيف") {
    return 2;
  }

  if (displayStatus === "زحمة") {
    return 1;
  }

  return 0;
}

function getBestStationTimestamp(station) {
  return station.lastUpdated ? new Date(station.lastUpdated).getTime() : 0;
}

export function getStationConfidenceSummary({
  activeDevices = 0,
  recentSignalsCount = 0,
  lastUpdated = null,
  now = new Date(),
} = {}) {
  const lastUpdateAgeMinutes = lastUpdated ? minutesSince(lastUpdated, now) : Number.POSITIVE_INFINITY;
  const hasRecentSignalWithin30Minutes = lastUpdateAgeMinutes <= 30;
  let level = "low";

  if (activeDevices >= 5 || recentSignalsCount >= 3) {
    level = "high";
  } else if (activeDevices >= 2 || hasRecentSignalWithin30Minutes) {
    level = "medium";
  }

  return {
    level,
    labelArabic: CONFIDENCE_LABELS_ARABIC[level],
  };
}

function getRecommendationBadge(index) {
  if (index === 0) {
    return "أفضل خيار الآن";
  }

  return "خيار جيد";
}

function getResolvedQueueLevel(weightedQueueTotal, weightedQueueSum, activeDevices) {
  if (weightedQueueSum > 0) {
    return getWeightedQueueLevel(weightedQueueTotal, weightedQueueSum);
  }

  if (activeDevices === 0) {
    return "unknown";
  }

  if (activeDevices <= 3) {
    return "short";
  }

  if (activeDevices <= 8) {
    return "medium";
  }

  return "long";
}

function getBestStationBaseScore(station) {
  if (station.status === "available") {
    return 100;
  }

  if (station.status === "no_fuel") {
    return -100;
  }

  if (station.status === "busy" || station.activityLevel === "likely_available") {
    return 60;
  }

  if (station.activityLevel === "low") {
    return 20;
  }

  return 0;
}

export function sortStationsForDiscovery(stations) {
  return [...stations].sort(compareNearbyStations);
}

export function sortStationsForSearch(stations) {
  return [...stations].sort(compareSearchStations);
}

export function sortStationsForRanking(stations) {
  return stations
    .map(normalizeStationForRanking)
    .sort(compareStationRankingCandidates);
}

export function matchesStationSearch(station, query) {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    station.name,
    station.area,
    station.neighborhood,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function getStationAreaLabel(station) {
  return station.area || station.neighborhood || "";
}

export function getAreaOptions(stations) {
  return [...new Set(stations.map(getStationAreaLabel).filter(Boolean))];
}

export function compareNearbyStations(left, right) {
  const distanceDelta = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
  const statusDelta = getDisplayStatusRank(left) - getDisplayStatusRank(right);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  return getStationPriorityScore(right) - getStationPriorityScore(left);
}

function compareSearchStations(left, right) {
  const statusDelta = getDisplayStatusRank(left) - getDisplayStatusRank(right);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const distanceDelta = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  const confidenceDelta = getConfidenceRank(right) - getConfidenceRank(left);
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  return getBestStationTimestamp(right) - getBestStationTimestamp(left);
}

function compareStationRankingCandidates(left, right) {
  const closedDelta = getClosedStatusRank(left) - getClosedStatusRank(right);
  if (closedDelta !== 0) {
    return closedDelta;
  }

  const missingStatusDelta = getMissingStatusRank(left) - getMissingStatusRank(right);
  if (missingStatusDelta !== 0) {
    return missingStatusDelta;
  }

  const statusDelta = getDisplayStatusRank(left) - getDisplayStatusRank(right);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const distanceDelta = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  const freshnessDelta = getBestStationTimestamp(right) - getBestStationTimestamp(left);
  if (freshnessDelta !== 0) {
    return freshnessDelta;
  }

  const confidenceDelta = getConfidenceRank(right) - getConfidenceRank(left);
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  return getStationPriorityScore(right) - getStationPriorityScore(left);
}

function normalizeStationForRanking(station) {
  const confidenceLevel = hasMissingStatusData(station)
    ? "low"
    : station.confidenceLevel ?? "low";
  const confidenceLabelArabic = station.confidenceLabelArabic ?? CONFIDENCE_LABELS_ARABIC[confidenceLevel];

  if (confidenceLevel === station.confidenceLevel && confidenceLabelArabic === station.confidenceLabelArabic) {
    return station;
  }

  return {
    ...station,
    confidenceLevel,
    confidenceLabelArabic,
  };
}

function hasMissingStatusData(station) {
  return (
    !station?.status ||
    station.status === "unknown" ||
    station.status === "uncertain" ||
    station.hasFreshSignal === false
  );
}

function getMissingStatusRank(station) {
  return hasMissingStatusData(station) ? 1 : 0;
}

function getClosedStatusRank(station) {
  return getDisplayStatus(station) === "مسكر" ? 1 : 0;
}

function getConfidenceRank(station) {
  if (station.confidenceLevel === "high") {
    return 2;
  }

  if (station.confidenceLevel === "medium") {
    return 1;
  }

  return 0;
}

export function getDisplayStatusRank(station) {
  const displayStatus = getDisplayStatus(station);
  if (displayStatus === "عالبومبة طول") {
    return 0;
  }

  if (displayStatus === "طابور خفيف") {
    return 1;
  }

  if (displayStatus === "زحمة") {
    return 2;
  }

  return 3;
}

function getMostRecentTimestamp(...values) {
  const validValues = values.filter(Boolean);
  if (!validValues.length) {
    return null;
  }

  return validValues.sort((left, right) => new Date(right) - new Date(left))[0];
}

function getSignalFreshnessNote(dateLike, now = new Date()) {
  if (!dateLike) {
    return "";
  }

  const ageMinutes = minutesSince(dateLike, now);
  if (ageMinutes > 10 && ageMinutes <= REPORT_WINDOW_MINUTES) {
    return "إشارة قديمة نسبياً";
  }

  return "";
}

function getReportTimestamp(report) {
  return report?.createdAt ?? report?.reported_at ?? null;
}
