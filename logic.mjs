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
const DECISION_STATUS_WEIGHTS = {
  available: 100,
  crowded: 45,
  unknown: 0,
  noFuel: -120,
};
const DECISION_QUEUE_WEIGHTS = {
  short: 25,
  medium: 10,
  long: -25,
  unknown: 0,
};
const TRIPOLI_PATTERN_DAYS = new Set([0, 4, 5]);

export const DEMO_DECISION_STATIONS = [
  {
    id: "demo-hai-alandalus",
    name: "محطة حي الأندلس",
    latitude: 32.8925,
    longitude: 13.1589,
    status: "available",
    queueLevel: "short",
    activeDevices: 6,
    recentSignalsCount: 4,
    lastSignalAt: new Date(Date.now() - 4 * 60000).toISOString(),
    lastUpdated: new Date(Date.now() - 4 * 60000).toISOString(),
    statusSource: "confirmed",
  },
  {
    id: "demo-siyahi",
    name: "محطة السياحي",
    latitude: 32.8877,
    longitude: 13.1919,
    status: "busy",
    queueLevel: "long",
    activeDevices: 18,
    averageDwellMinutes: 22,
    recentSignalsCount: 6,
    lastSignalAt: new Date(Date.now() - 6 * 60000).toISOString(),
    lastUpdated: new Date(Date.now() - 6 * 60000).toISOString(),
    statusSource: "predicted",
  },
  {
    id: "demo-airport-road",
    name: "محطة طريق المطار",
    latitude: 32.8322,
    longitude: 13.1845,
    status: "unknown",
    queueLevel: "unknown",
    activeDevices: 1,
    recentSignalsCount: 0,
    lastSignalAt: new Date(Date.now() - 45 * 60000).toISOString(),
    lastUpdated: new Date(Date.now() - 45 * 60000).toISOString(),
    statusSource: "predicted",
  },
  {
    id: "demo-closed",
    name: "محطة باب بن غشير",
    latitude: 32.8604,
    longitude: 13.2135,
    status: "no_fuel",
    queueLevel: "unknown",
    activeDevices: 0,
    recentSignalsCount: 2,
    lastSignalAt: new Date(Date.now() - 9 * 60000).toISOString(),
    lastUpdated: new Date(Date.now() - 9 * 60000).toISOString(),
    statusSource: "confirmed",
  },
];

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

export function predictCrowdStatus(station = {}, dateTime = new Date(), liveSignals = {}) {
  const forecastDate = new Date(dateTime);
  const day = forecastDate.getDay();
  const hour = forecastDate.getHours();
  const isEmergencyMode = Boolean(
    liveSignals.shortageMode
      || liveSignals.emergencyMode
      || liveSignals.shortage_mode
      || liveSignals.emergency_mode,
  );

  if (isEmergencyMode || station.status === "no_fuel") {
    return {
      predictedStatus: "مسكر",
      bestTimeWindow: "انتظر تحديثات البلاغات",
      warningMessageArabic: "وضع نقص أو طوارئ، الأفضل تتأكد قبل ما تمشي",
    };
  }

  if (day === 5 && hour < 12) {
    return {
      predictedStatus: "عالبومبة طول",
      bestTimeWindow: "الجمعة صباحاً",
      warningMessageArabic: "أفضل وقت للتعبئة في طرابلس غالباً الجمعة الصبح",
    };
  }

  if (day === 0) {
    return {
      predictedStatus: "زحمة",
      bestTimeWindow: "بعد 10 صباحاً أو آخر اليوم",
      warningMessageArabic: "الأحد عادةً عليه ضغط أعلى في طرابلس",
    };
  }

  if (day === 4) {
    return {
      predictedStatus: "زحمة",
      bestTimeWindow: "الصبح بدري قبل الزحمة",
      warningMessageArabic: "الخميس غالباً يزيد فيه الطلب قبل الويكند",
    };
  }

  if (hour >= 6 && hour < 10) {
    return {
      predictedStatus: "عالبومبة طول",
      bestTimeWindow: "من 6 إلى 10 صباحاً",
      warningMessageArabic: "الصبح بدري عادةً أخف وقت للتعبئة",
    };
  }

  const liveStatus = getDisplayStatus({
    ...station,
    activeDevices: liveSignals.activeDevices ?? station.activeDevices,
    activityLevel: liveSignals.activityLevel ?? station.activityLevel,
  });

  return {
    predictedStatus: liveStatus,
    bestTimeWindow: "من 6 إلى 10 صباحاً",
    warningMessageArabic: "التوقع يعتمد على اليوم والوقت وإشارات المستخدمين",
  };
}

export function predictStationStatus(stationSignals = {}, context = {}) {
  const activeDevices = Math.max(0, Number(stationSignals.activeDevices) || 0);
  const averageDwellMinutes = Math.max(0, Number(stationSignals.averageDwellMinutes) || 0);
  const bounceRate = Math.max(0, Number(stationSignals.bounceRate) || 0);
  const arrivalRate = Math.max(0, Number(stationSignals.arrivalRate) || 0);
  const lastSignalAt = stationSignals.lastSignalAt ?? null;
  const now = context.now ? new Date(context.now) : new Date();
  const hasRecentPresenceData = Boolean(lastSignalAt) &&
    minutesSince(lastSignalAt, now) <= PRESENCE_RECENT_WINDOW_MINUTES;
  const dayOfWeek = context.dayOfWeek ?? now.getDay();
  const hourOfDay = context.hourOfDay ?? now.getHours();
  const isEmergencyMode = Boolean(
    context.emergencyMode ||
      context.shortageMode ||
      context.emergency_mode ||
      context.shortage_mode,
  );

  let predictedStatus = getPresenceDrivenStatus({
    activeDevices,
    averageDwellMinutes,
    bounceRate,
    hasRecentPresenceData,
  });

  if (isEmergencyMode) {
    predictedStatus = "مسكر";
  } else if (bounceRate > 0.4 && averageDwellMinutes < 3) {
    predictedStatus = "مسكر";
  } else if (averageDwellMinutes > 18 || arrivalRate >= 13) {
    predictedStatus = "زحمة";
  } else if (dayOfWeek === 0 || dayOfWeek === 4) {
    predictedStatus = predictedStatus === "مسكر" ? "مسكر" : "زحمة";
  } else if (dayOfWeek === 5 && hourOfDay < 12) {
    predictedStatus = predictedStatus === "مسكر" ? "مسكر" : "عالبومبة طول";
  } else if (hourOfDay >= 6 && hourOfDay < 10) {
    predictedStatus = predictedStatus === "مسكر" ? "مسكر" : "عالبومبة طول";
  }

  if (predictedStatus === "غير مؤكد") {
    predictedStatus = "طابور خفيف";
  }

  const confidence = getPredictionConfidence({
    activeDevices,
    arrivalRate,
    lastSignalAt,
    now,
  });

  return {
    predictedStatus,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    confidenceLabelArabic: confidence.labelArabic,
    lastSignalAt,
  };
}

export function predictStationAvailability(station = {}, context = {}) {
  const now = context.now ? new Date(context.now) : new Date();
  const dayOfWeek = context.dayOfWeek ?? now.getDay();
  const hourOfDay = context.hourOfDay ?? now.getHours();
  const isEmergencyMode = Boolean(
    context.emergencyMode ||
      context.shortageMode ||
      context.emergency_mode ||
      context.shortage_mode,
  );
  const activeDevices = Math.max(0, Number(station.activeDevices) || 0);
  const averageDwellMinutes = Math.max(0, Number(station.averageDwellMinutes) || 0);
  const bounceRate = Math.max(0, Number(station.bounceRate) || 0);
  const arrivalRate = Math.max(0, Number(station.arrivalRate) || 0);
  const lastSignalAt = getStationSignalTimestamp(station);
  const hasRecentSignal = Boolean(lastSignalAt) && minutesSince(lastSignalAt, now) <= REPORT_WINDOW_MINUTES;
  const normalizedStatus = normalizeDecisionStatus(station.status ?? station.fuelStatus ?? station.predictedStatus);
  const normalizedQueue = normalizeDecisionQueue(station.queueLevel ?? station.crowdLevel);

  if (normalizedStatus === "noFuel") {
    return {
      status: "noFuel",
      source: hasRecentSignal ? "confirmed" : "predicted",
      reason: "station_status",
    };
  }

  if (hasRecentSignal && bounceRate > 0.4 && averageDwellMinutes < 3) {
    return {
      status: "noFuel",
      source: "predicted",
      reason: "high_bounce_short_dwell",
    };
  }

  if (
    hasRecentSignal &&
    (averageDwellMinutes > 18 || arrivalRate >= 13 || activeDevices >= 16 || normalizedQueue === "long")
  ) {
    return {
      status: "crowded",
      source: "predicted",
      reason: "high_activity_or_queue",
    };
  }

  if (hasRecentSignal && (normalizedStatus === "available" || activeDevices >= 2 || arrivalRate >= 1)) {
    return {
      status: normalizedQueue === "long" ? "crowded" : "available",
      source: station.statusSource === "confirmed" || station.hasFreshSignal ? "confirmed" : "predicted",
      reason: "recent_activity",
    };
  }

  if (isEmergencyMode) {
    return {
      status: "unknown",
      source: "predicted",
      reason: "emergency_low_confidence",
    };
  }

  if (dayOfWeek === 5 && hourOfDay < 12) {
    return {
      status: "available",
      source: "predicted",
      reason: "friday_morning_pattern",
    };
  }

  if (dayOfWeek === 0 || dayOfWeek === 4) {
    return {
      status: "crowded",
      source: "predicted",
      reason: dayOfWeek === 0 ? "sunday_peak_pattern" : "thursday_peak_pattern",
    };
  }

  if (hourOfDay >= 6 && hourOfDay < 10) {
    return {
      status: "available",
      source: "predicted",
      reason: "morning_low_crowd_pattern",
    };
  }

  return {
    status: normalizedStatus === "crowded" ? "crowded" : "unknown",
    source: "predicted",
    reason: "weak_or_missing_signal",
  };
}

export function calculateDecisionConfidenceScore(station = {}, context = {}) {
  const now = context.now ? new Date(context.now) : new Date();
  const prediction = context.prediction ?? predictStationAvailability(station, context);
  const activeDevices = Math.max(0, Number(station.activeDevices) || 0);
  const recentSignalsCount = Math.max(0, Number(station.recentSignalsCount) || 0);
  const lastSignalAt = getStationSignalTimestamp(station);
  const signalAgeMinutes = lastSignalAt ? minutesSince(lastSignalAt, now) : Number.POSITIVE_INFINITY;
  const dayOfWeek = context.dayOfWeek ?? now.getDay();
  const hourOfDay = context.hourOfDay ?? now.getHours();
  const isEmergencyMode = Boolean(
    context.emergencyMode ||
      context.shortageMode ||
      context.emergency_mode ||
      context.shortage_mode,
  );

  let score = 0;

  if (signalAgeMinutes <= 5) {
    score += 35;
  } else if (signalAgeMinutes <= 10) {
    score += 30;
  } else if (signalAgeMinutes <= 30) {
    score += 20;
  } else if (signalAgeMinutes <= REPORT_WINDOW_MINUTES) {
    score += 10;
  }

  if (activeDevices >= 5 || recentSignalsCount >= 3) {
    score += 25;
  } else if (activeDevices >= 2 || recentSignalsCount >= 1) {
    score += 15;
  } else if (signalAgeMinutes <= 30) {
    score += 8;
  }

  if (TRIPOLI_PATTERN_DAYS.has(dayOfWeek) || (hourOfDay >= 6 && hourOfDay < 10)) {
    score += 10;
  } else {
    score += 5;
  }

  if (prediction.source === "confirmed" || station.statusSource === "confirmed") {
    score += 20;
  } else if (prediction.source === "predicted") {
    score += 10;
  }

  if (prediction.status === "unknown") {
    score -= 15;
  }

  if (isEmergencyMode) {
    score -= 20;
  }

  return clampNumber(Math.round(score), 0, 100);
}

export function rankStationsForDecision(stations = [], context = {}) {
  const rankedStations = stations
    .map((station) => createDecisionStation(station, context))
    .sort(compareDecisionStations);

  const bestStation = rankedStations[0] ?? null;
  const backupStation = rankedStations.find((station) => station.id !== bestStation?.id) ?? null;

  return {
    bestStation,
    backupStation,
    rankedStations,
  };
}

export function getBestStationDecision(stations = [], context = {}) {
  const { bestStation, backupStation, rankedStations } = rankStationsForDecision(stations, context);

  if (!bestStation) {
    return {
      bestStation: null,
      reasonText: "لا توجد بيانات كافية لاختيار محطة الآن.",
      confidenceScore: 0,
      estimatedArrivalMinutes: null,
      distanceKm: null,
      status: "unknown",
      backupStation: null,
      rankedStations: [],
    };
  }

  return {
    bestStation,
    reasonText: getBestStationReasonText(bestStation),
    confidenceScore: bestStation.confidenceScore,
    estimatedArrivalMinutes: bestStation.estimatedArrivalMinutes,
    distanceKm: bestStation.distanceKm,
    status: bestStation.decisionStatus,
    backupStation,
    rankedStations,
  };
}

export function getDemoStationDecision(context = {}) {
  return getBestStationDecision(DEMO_DECISION_STATIONS, {
    now: new Date(),
    dayOfWeek: 1,
    hourOfDay: 8,
    userLocation: {
      latitude: 32.8872,
      longitude: 13.1913,
    },
    ...context,
  });
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
  const averageDwellMinutes = presenceSummary.averageDwellMinutes ?? 0;
  const bounceRate = presenceSummary.bounceRate ?? 0;
  const arrivalRate = presenceSummary.arrivalRate ?? 0;
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

  const latestReport = recentReports
    .slice()
    .sort((left, right) => new Date(getReportTimestamp(right)) - new Date(getReportTimestamp(left)))[0];
  const lastUpdated = getMostRecentTimestamp(lastPresenceAt, getReportTimestamp(latestReport));
  const emergencyMode = noFuelWeight > availableWeight && noFuelWeight > 0 && activeDevices <= 2;
  const stationSignals = {
    activeDevices,
    averageDwellMinutes,
    bounceRate,
    arrivalRate,
    lastSignalAt: lastPresenceAt,
  };
  const passivePresenceStatus = getPresenceDrivenStatus({
    activeDevices,
    averageDwellMinutes,
    bounceRate,
    hasRecentPresenceData,
  });
  const prediction = predictStationStatus(stationSignals, {
    dayOfWeek: now.getDay(),
    hourOfDay: now.getHours(),
    emergencyMode,
    now,
  });
  const serverStatus = station.fuelStatus ?? null;
  const serverQueueLevel = station.crowdLevel ?? null;
  const queueLevel = (!hasRecentPresenceData || passivePresenceStatus === "غير مؤكد")
    ? (serverQueueLevel ?? "unknown")
    : getQueueLevelFromPredictedStatus(prediction.predictedStatus);
  const status = (!hasRecentPresenceData || passivePresenceStatus === "غير مؤكد")
    ? (serverStatus ?? "unknown")
    : getInternalStatusFromPredictedStatus(prediction.predictedStatus);
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
    averageDwellMinutes,
    bounceRate,
    arrivalRate,
    stationSignals,
    predictedStatus: prediction.predictedStatus,
    predicted_status: prediction.predictedStatus,
    activityLevel,
    activityLabel: ACTIVITY_LABELS[activityLevel],
    lastUpdated,
    lastSignalAt: lastPresenceAt,
    signalNote,
    hasFreshSignal,
    recentReportsCount: recentReports.length,
    recentSignalsCount: recentPresenceSignalsCount + recentReportSignalsCount,
    confidenceScore: prediction.confidenceScore,
    confidenceLevel: prediction.confidenceLevel ?? confidence.level,
    confidenceLabelArabic: prediction.confidenceLabelArabic ?? confidence.labelArabic,
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
        etaMinutes: null,
        routeSource: "coordinate_projection",
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
  averageDwellMinutes = 0,
  bounceRate = 0,
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
    return getPresenceDrivenStatus({
      activeDevices,
      averageDwellMinutes,
      bounceRate,
      hasRecentPresenceData,
    }) === "زحمة" ? "busy" : "available";
  }

  if (!hasRecentPresenceData && recentReports.length === 0) {
    return "unknown";
  }

  const presenceStatus = getPresenceDrivenStatus({
    activeDevices,
    averageDwellMinutes,
    bounceRate,
    hasRecentPresenceData,
  });

  if (presenceStatus === "مسكر") {
    return "no_fuel";
  }

  if (presenceStatus === "زحمة") {
    return "busy";
  }

  if (presenceStatus === "عالبومبة طول" || presenceStatus === "طابور خفيف") {
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
      dwellTotalMinutes: 0,
      dwellSamples: 0,
      shortVisits: 0,
      arrivalRate: 0,
    };
    const isActive = ageMinutes <= PRESENCE_WINDOW_MINUTES;
    const isRecentArrival = ageMinutes <= PRESENCE_RECENT_WINDOW_MINUTES;
    const dwellMinutes = getPresenceDwellMinutes(row);
    const hasDwellSample = isActive && Number.isFinite(dwellMinutes);
    const nextDwellSamples = existingSummary.dwellSamples + (hasDwellSample ? 1 : 0);
    const nextDwellTotalMinutes = existingSummary.dwellTotalMinutes + (hasDwellSample ? dwellMinutes : 0);
    const nextShortVisits = existingSummary.shortVisits + (hasDwellSample && dwellMinutes < 3 ? 1 : 0);
    const nextActiveDevices = existingSummary.activeDevices + (isActive ? 1 : 0);

    countsByStation.set(row.stationId, {
      activeDevices: nextActiveDevices,
      recentSignalsCount:
        existingSummary.recentSignalsCount + (ageMinutes <= PRESENCE_RECENT_WINDOW_MINUTES ? 1 : 0),
      lastSeenAt: getMostRecentTimestamp(existingSummary.lastSeenAt, row.lastSeenAt),
      dwellTotalMinutes: nextDwellTotalMinutes,
      dwellSamples: nextDwellSamples,
      shortVisits: nextShortVisits,
      averageDwellMinutes: nextDwellSamples > 0 ? nextDwellTotalMinutes / nextDwellSamples : 0,
      bounceRate: nextDwellSamples > 0 ? nextShortVisits / nextDwellSamples : 0,
      arrivalRate: existingSummary.arrivalRate + (isRecentArrival ? 1 : 0),
    });
  });

  return countsByStation;
}

export function getPresenceDrivenStatus(input, legacyHasRecentPresenceData = true) {
  const {
    activeDevices,
    averageDwellMinutes,
    bounceRate,
    hasRecentPresenceData,
  } = normalizePresenceStatusInput(input, legacyHasRecentPresenceData);

  if (!hasRecentPresenceData) {
    return "غير مؤكد";
  }

  const baseline = Math.min(activeDevices, 5);
  const effectiveActive = activeDevices - baseline;

  if (bounceRate > 0.4 && averageDwellMinutes < 3) {
    return "مسكر";
  }

  if (effectiveActive <= 0) {
    return "غير مؤكد";
  }

  if (effectiveActive <= 5 && averageDwellMinutes < 8) {
    return "عالبومبة طول";
  }

  if (effectiveActive <= 12 && averageDwellMinutes >= 8 && averageDwellMinutes <= 18) {
    return "طابور خفيف";
  }

  if (effectiveActive >= 13 || averageDwellMinutes > 18) {
    return "زحمة";
  }

  return "غير مؤكد";
}

function normalizePresenceStatusInput(input, legacyHasRecentPresenceData) {
  if (typeof input === "object" && input !== null) {
    return {
      activeDevices: Math.max(0, Number(input.activeDevices) || 0),
      averageDwellMinutes: Math.max(0, Number(input.averageDwellMinutes) || 0),
      bounceRate: Math.max(0, Number(input.bounceRate) || 0),
      hasRecentPresenceData: input.hasRecentPresenceData ?? (Number(input.activeDevices) > 0),
    };
  }

  return {
    activeDevices: Math.max(0, Number(input) || 0),
    averageDwellMinutes: 0,
    bounceRate: 0,
    hasRecentPresenceData: legacyHasRecentPresenceData,
  };
}

function getPresenceDwellMinutes(row) {
  if (Number.isFinite(row.dwellMinutes)) {
    return Math.max(0, row.dwellMinutes);
  }

  if (Number.isFinite(row.dwell_minutes)) {
    return Math.max(0, row.dwell_minutes);
  }

  const firstSeenAt = row.firstSeenAt ?? row.first_seen_at ?? row.createdAt ?? row.created_at;
  if (!firstSeenAt || !row.lastSeenAt) {
    return null;
  }

  const dwellMinutes = (new Date(row.lastSeenAt).getTime() - new Date(firstSeenAt).getTime()) / 60000;
  return Number.isFinite(dwellMinutes) ? Math.max(0, dwellMinutes) : null;
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

function createDecisionStation(station, context) {
  const prediction = predictStationAvailability(station, context);
  const confidenceScore = calculateDecisionConfidenceScore(station, {
    ...context,
    prediction,
  });
  const queueLevel = normalizeDecisionQueue(station.queueLevel ?? station.crowdLevel);
  const distanceKm = getDecisionDistanceKm(station, context.userLocation);
  const estimatedArrivalMinutes = getEstimatedArrivalMinutes(distanceKm);
  const decisionScore = getDecisionScore({
    status: prediction.status,
    queueLevel,
    distanceKm,
    confidenceScore,
    lastSignalAt: getStationSignalTimestamp(station),
    now: context.now,
  });

  return {
    ...station,
    decisionStatus: prediction.status,
    decisionStatusSource: prediction.source,
    decisionReason: prediction.reason,
    confidenceScore,
    queueLevel,
    distanceKm,
    estimatedArrivalMinutes,
    decisionScore,
  };
}

function getDecisionScore({
  status,
  queueLevel,
  distanceKm,
  confidenceScore,
  lastSignalAt,
  now = new Date(),
}) {
  const freshnessAgeMinutes = lastSignalAt ? minutesSince(lastSignalAt, now) : Number.POSITIVE_INFINITY;
  const freshnessScore = freshnessAgeMinutes <= 10
    ? 15
    : freshnessAgeMinutes <= 30
      ? 8
      : freshnessAgeMinutes <= REPORT_WINDOW_MINUTES
        ? 3
        : 0;
  const distancePenalty = Number.isFinite(distanceKm) ? distanceKm * 12 : 40;

  return (
    (DECISION_STATUS_WEIGHTS[status] ?? 0) +
    (DECISION_QUEUE_WEIGHTS[queueLevel] ?? 0) +
    confidenceScore +
    freshnessScore -
    distancePenalty
  );
}

function compareDecisionStations(left, right) {
  const scoreDelta = right.decisionScore - left.decisionScore;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const statusDelta = getDecisionStatusRank(left.decisionStatus) - getDecisionStatusRank(right.decisionStatus);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const distanceDelta = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  return right.confidenceScore - left.confidenceScore;
}

function getDecisionStatusRank(status) {
  if (status === "available") {
    return 0;
  }

  if (status === "crowded") {
    return 1;
  }

  if (status === "unknown") {
    return 2;
  }

  return 3;
}

function getDecisionDistanceKm(station, userLocation) {
  if (userLocation && Number.isFinite(station.latitude) && Number.isFinite(station.longitude)) {
    return computeDistanceKm(userLocation, station);
  }

  if (Number.isFinite(station.distanceKm)) {
    return station.distanceKm;
  }

  return Number.POSITIVE_INFINITY;
}

function getEstimatedArrivalMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }

  return Math.max(3, Math.round(distanceKm * 5.5));
}

function getBestStationReasonText(station) {
  if (station.decisionStatus === "available") {
    return "أفضل خيار حالياً لأنه قريب، الاحتمال عالي أن الوقود موجود، والزحمة منخفضة.";
  }

  if (station.decisionStatus === "crowded") {
    return "أفضل خيار متاح حالياً، لكنه قد يكون مزدحم. اختير لأنه الأقرب والأوثق بين الخيارات.";
  }

  if (station.decisionStatus === "noFuel") {
    return "كل الخيارات ضعيفة حالياً. هذه المحطة ظهرت كأفضل المتاح، لكن احتمال توفر الوقود منخفض.";
  }

  return "أفضل خيار حسب البيانات المتاحة، لكن الثقة منخفضة وتحتاج تتأكد قبل ما تمشي.";
}

function getStationSignalTimestamp(station) {
  return station.lastSignalAt ?? station.lastUpdated ?? station.reportedAt ?? station.createdAt ?? null;
}

function normalizeDecisionStatus(status) {
  if (status === "no_fuel" || status === "noFuel" || status === "مسكر") {
    return "noFuel";
  }

  if (
    status === "busy" ||
    status === "crowded" ||
    status === "زحمة" ||
    status === "زحمة" ||
    status === "مزدحم"
  ) {
    return "crowded";
  }

  if (status === "available" || status === "عالبومبة طول") {
    return "available";
  }

  return "unknown";
}

function normalizeDecisionQueue(queueLevel) {
  if (queueLevel === "short" || queueLevel === "light" || queueLevel === "عالبومبة طول") {
    return "short";
  }

  if (queueLevel === "medium" || queueLevel === "طابور خفيف") {
    return "medium";
  }

  if (queueLevel === "long" || queueLevel === "busy" || queueLevel === "crowded" || queueLevel === "زحمة") {
    return "long";
  }

  return "unknown";
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPredictionConfidence({
  activeDevices = 0,
  arrivalRate = 0,
  lastSignalAt = null,
  now = new Date(),
} = {}) {
  const lastSignalAgeMinutes = lastSignalAt ? minutesSince(lastSignalAt, now) : Number.POSITIVE_INFINITY;
  let level = "low";
  let score = 0;

  if ((activeDevices >= 5 || arrivalRate >= 3) && lastSignalAgeMinutes <= PRESENCE_RECENT_WINDOW_MINUTES) {
    level = "high";
    score = 2;
  } else if ((activeDevices >= 2 || arrivalRate >= 1) && lastSignalAgeMinutes <= 30) {
    level = "medium";
    score = 1;
  }

  return {
    level,
    score,
    labelArabic: CONFIDENCE_LABELS_ARABIC[level],
  };
}

function getRecommendationBadge(index) {
  if (index === 0) {
    return "أفضل خيار الآن";
  }

  return "خيار جيد";
}

function getResolvedQueueLevel(
  weightedQueueTotal,
  weightedQueueSum,
  activeDevices,
  averageDwellMinutes = 0,
  bounceRate = 0,
  hasRecentPresenceData = activeDevices > 0,
) {
  if (weightedQueueSum > 0) {
    return getWeightedQueueLevel(weightedQueueTotal, weightedQueueSum);
  }

  const presenceStatus = getPresenceDrivenStatus({
    activeDevices,
    averageDwellMinutes,
    bounceRate,
    hasRecentPresenceData,
  });

  if (presenceStatus === "غير مؤكد" || presenceStatus === "مسكر") {
    return "unknown";
  }

  if (presenceStatus === "عالبومبة طول") {
    return "short";
  }

  if (presenceStatus === "طابور خفيف") {
    return "medium";
  }

  return "long";
}

function getQueueLevelFromPredictedStatus(predictedStatus) {
  if (predictedStatus === "عالبومبة طول") {
    return "short";
  }

  if (predictedStatus === "طابور خفيف") {
    return "medium";
  }

  if (predictedStatus === "زحمة") {
    return "long";
  }

  return "unknown";
}

function getInternalStatusFromPredictedStatus(predictedStatus) {
  if (predictedStatus === "مسكر") {
    return "no_fuel";
  }

  if (predictedStatus === "زحمة") {
    return "busy";
  }

  return "available";
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

  const statusDelta = getPredictedStatusRank(left) - getPredictedStatusRank(right);
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const confidenceDelta = getConfidenceScore(right) - getConfidenceScore(left);
  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  const distanceDelta = (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY);
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  const freshnessDelta = getBestStationTimestamp(right) - getBestStationTimestamp(left);
  if (freshnessDelta !== 0) {
    return freshnessDelta;
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

function getConfidenceScore(station) {
  if (Number.isFinite(station?.confidenceScore)) {
    return station.confidenceScore;
  }

  return getConfidenceRank(station);
}

function getPredictedStatusRank(station) {
  const predictedStatus = station?.predicted_status ?? station?.predictedStatus ?? getDisplayStatus(station);
  if (predictedStatus === "عالبومبة طول") {
    return 0;
  }

  if (predictedStatus === "طابور خفيف") {
    return 1;
  }

  if (predictedStatus === "زحمة") {
    return 2;
  }

  return 3;
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
