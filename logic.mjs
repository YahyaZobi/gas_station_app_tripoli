export const REPORT_WINDOW_MINUTES = 60;
export const REPORT_PROXIMITY_KM = 0.2;

export const STATUS_META = {
  available: {
    label: "متوفر",
    className: "status-available",
    markerColor: "#2f9e44",
  },
  crowded: {
    label: "متوفر لكن مزدحم",
    className: "status-crowded",
    markerColor: "#e0a800",
  },
  no_fuel: {
    label: "غير متوفر",
    className: "status-no-fuel",
    markerColor: "#d64545",
  },
  unknown: {
    label: "غير معروف",
    className: "status-unknown",
    markerColor: "#84919a",
  },
};

export const QUEUE_LABELS = {
  short: "قصير",
  medium: "متوسط",
  long: "طويل",
  unknown: "غير معروف",
};

const arabicNumberFormatter = new Intl.NumberFormat("ar-LY");
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

  return `${toArabicDistanceNumber(distanceKm)} كم`;
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
  return minutesSince(report.createdAt, now) <= REPORT_WINDOW_MINUTES;
}

export function getReportWeight(report, now = new Date()) {
  const ageMinutes = minutesSince(report.createdAt, now);
  if (ageMinutes > REPORT_WINDOW_MINUTES) {
    return 0;
  }

  const freshness = 1 - ageMinutes / REPORT_WINDOW_MINUTES;
  return Math.max(0.15, freshness ** 2 + 0.15);
}

export function getRecentReportsForStation(stationId, reports, now = new Date()) {
  return reports.filter((report) => report.stationId === stationId && isReportRecent(report, now));
}

export function aggregateStation(station, reports, now = new Date()) {
  const recentReports = getRecentReportsForStation(station.id, reports, now);

  if (recentReports.length === 0) {
    return {
      ...station,
      status: "unknown",
      queueLevel: "unknown",
      lastUpdated: null,
      recentReportsCount: 0,
    };
  }

  const weightedAvailability = {
    available: 0,
    no_fuel: 0,
  };
  const weightedQueue = {
    short: 0,
    medium: 0,
    long: 0,
  };

  recentReports.forEach((report) => {
    const weight = getReportWeight(report, now);
    weightedAvailability[report.status] += weight;
    weightedQueue[report.queueLevel] += weight;
  });

  const availability =
    weightedAvailability.no_fuel > weightedAvailability.available ? "no_fuel" : "available";
  const queueLevel = getHighestWeightedKey(weightedQueue, "short");
  const status = availability === "no_fuel" ? "no_fuel" : queueLevel === "short" ? "available" : "crowded";
  const latestReport = recentReports
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];

  return {
    ...station,
    status,
    queueLevel,
    lastUpdated: latestReport.createdAt,
    recentReportsCount: recentReports.length,
  };
}

function getHighestWeightedKey(weightMap, fallbackKey) {
  let winningKey = fallbackKey;
  let winningValue = -1;

  Object.entries(weightMap).forEach(([key, value]) => {
    if (value > winningValue) {
      winningKey = key;
      winningValue = value;
    }
  });

  return winningKey;
}

export function formatRelativeTime(dateLike, now = new Date()) {
  if (!dateLike) {
    return "لا توجد تحديثات حديثة";
  }

  const diffMinutes = Math.round(minutesSince(dateLike, now));
  if (diffMinutes < 1) {
    return "تم التحديث الآن";
  }
  if (diffMinutes === 1) {
    return "تم التحديث قبل دقيقة";
  }
  if (diffMinutes < 60) {
    return `تم التحديث قبل ${arabicNumberFormatter.format(diffMinutes)} دقائق`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return "تم التحديث قبل ساعة";
  }

  return `تم التحديث قبل ${arabicNumberFormatter.format(diffHours)} ساعات`;
}

export function projectStations(stations, reports, userLocation, now = new Date()) {
  return stations
    .map((station) => {
      const aggregated = aggregateStation(station, reports, now);
      return {
        ...aggregated,
        distanceKm: computeDistanceKm(userLocation, station),
      };
    })
    .sort((left, right) => left.distanceKm - right.distanceKm);
}

function toArabicDistanceNumber(distanceKm) {
  const rounded = Number(distanceKm.toFixed(1)).toString();
  const arabicDigits = {
    0: "٠",
    1: "١",
    2: "٢",
    3: "٣",
    4: "٤",
    5: "٥",
    6: "٦",
    7: "٧",
    8: "٨",
    9: "٩",
    ".": "٫",
  };

  return rounded.replace(/[0-9.]/g, (character) => arabicDigits[character] ?? character);
}
