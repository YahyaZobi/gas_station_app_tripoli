import {
  buildStationSections,
  createReportRecord,
  findNearestStationWithinDistance,
  formatDistanceLabel,
  formatNumber,
  getAreaOptions,
  getDemoReportPreset,
  getDemoUpdateDelayMs,
  getDisplayStatus,
  getLiveActivityLabel,
  getReportEligibility,
  getReportSuccessMessage,
  getStationAreaLabel,
  getStationUrgencyMessage,
  matchesStationSearch,
  minutesSince,
  PRESENCE_HEARTBEAT_MS,
  predictCrowdStatus,
  predictStationStatus,
  STATUS_META,
  formatRelativeTime,
  projectStations,
  getStationPriorityScore,
  sortStationsForDiscovery,
  sortStationsForSearch,
} from "./logic.mjs";
import {
  getDevLocationOverrideConfig,
  getDevPanelConfig,
  getLocationModeConfig,
  getProtocolWarning,
} from "./environment-utils.mjs";
import { buildDecisionFirstLayout } from "./home-layout-utils.mjs";
import { getGoogleMapsDirectionsUrl } from "./map-utils.mjs";
import { getGoogleRouteMetrics, hasGoogleRouteConfig, resolveGoogleMapsApiKey } from "./route-metrics-utils.mjs";
import {
  isFavoriteStation,
  readFavoriteStations,
  toggleFavoriteStation,
} from "./favorite-stations-storage.mjs";
import {
  canNotifyStation,
  getStationAvailabilityNotificationMessage,
  markStationNotified,
  notifyUser,
  shouldNotifyAvailabilityChange,
} from "./notification-utils.mjs";
import { getAnonymousDeviceId } from "./presence-storage.mjs";
import { readRecentStations, saveRecentStation } from "./recent-stations-storage.mjs";
import { createRepository } from "./repository.mjs";
import { resolveSelectedStationId } from "./selection-utils.mjs";
import { getUsageAnalyticsSummary, trackEvent } from "./usage-analytics-storage.mjs";

const fallbackTripoliLocation = {
  latitude: 32.8872,
  longitude: 13.1913,
};
const NEARBY_RADIUS_STEPS_KM = [5, 10, 15];
const EXPANDED_DISCOVERY_RADIUS_KM = NEARBY_RADIUS_STEPS_KM[NEARBY_RADIUS_STEPS_KM.length - 1];
const LOCATION_STATES = {
  gpsLoading: "gps_loading",
  gpsSuccess: "gps_success",
  gpsFailed: "gps_failed",
  fallbackUsed: "fallback_used",
};
// Development-only location override.
// Set DEV_LOCATION_OVERRIDE.enabled = true for desktop testing.
// Set DEV_LOCATION_OVERRIDE.enabled = false before production.
const DEV_LOCATION_OVERRIDE = {
  enabled: false,
  latitude: 32.9028,
  longitude: 13.3354,
};
const DEV_RANKING_TEST_MODE = {
  enabled: false,
  // Scenarios: normal_day, thursday_evening, friday_morning, fuel_shortage_emergency
  scenario: "normal_day",
};

const fallbackStations = [
  {
    id: "station-1",
    name: "محطة السياحي",
    latitude: 32.8925,
    longitude: 13.1589,
  },
  {
    id: "station-2",
    name: "محطة قرقارش",
    latitude: 32.8792,
    longitude: 13.1336,
  },
  {
    id: "station-3",
    name: "محطة باب بن غشير",
    latitude: 32.8604,
    longitude: 13.2135,
  },
  {
    id: "station-4",
    name: "محطة صلاح الدين",
    latitude: 32.8475,
    longitude: 13.2597,
  },
  {
    id: "station-5",
    name: "محطة تاجوراء الساحلية",
    latitude: 32.9028,
    longitude: 13.3354,
  },
  {
    id: "station-6",
    name: "محطة طريق المطار",
    latitude: 32.8322,
    longitude: 13.1845,
  },
];

const now = Date.now();
const demoSeedReports = [
  createSeedReport("station-1", "available", "short", now - 8 * 60000, fallbackStations[0]),
  createSeedReport("station-1", "available", "medium", now - 20 * 60000, fallbackStations[0]),
  createSeedReport("station-2", "available", "long", now - 12 * 60000, fallbackStations[1]),
  createSeedReport("station-3", "no_fuel", "long", now - 10 * 60000, fallbackStations[2]),
  createSeedReport("station-3", "available", "medium", now - 55 * 60000, fallbackStations[2]),
  createSeedReport("station-4", "available", "medium", now - 18 * 60000, fallbackStations[3]),
  createSeedReport("station-4", "available", "long", now - 6 * 60000, fallbackStations[3]),
  createSeedReport("station-6", "available", "short", now - 80 * 60000, fallbackStations[5]),
];

let stations = [...fallbackStations];
let persistedReports = [];
let transientReports = [];
let presenceRows = [];

const state = {
  realUserLocation: null,
  fallbackTripoliLocation,
  userLocation: fallbackTripoliLocation,
  hasUserLocation: false,
  isLocatingUser: true,
  locationState: LOCATION_STATES.gpsLoading,
  locationSource: "fallback_tripoli_center",
  locationFailureReason: "",
  gpsPermissionStatus: "unknown",
  selectedStationId: fallbackStations[0]?.id ?? null,
  shouldCenterSelectedOnMap: false,
  shouldCenterUserOnMap: false,
  didAutoFocusBestStation: false,
  activeTab: "home",
  searchQuery: "",
  selectedArea: "",
  discoveryRadiusKm: NEARBY_RADIUS_STEPS_KM[0],
};

const repository = createRepository({
  fallbackStations,
});

const stationMap = document.querySelector("#station-map");
const mapFocusPill = document.querySelector("#map-focus-pill");
const mapPanel = document.querySelector(".map-panel");
const stationList = document.querySelector("#station-list");
const stationTitle = document.querySelector("#station-title");
const stationStatusBadge = document.querySelector("#station-status-badge");
const stationEmpty = document.querySelector("#station-empty");
const stationDetails = document.querySelector("#station-details");
const detailsPanel = document.querySelector(".details-panel");
const environmentWarning = document.querySelector("#environment-warning");
const locationBanner = document.querySelector("#location-banner");
const layout = document.querySelector(".layout");
const listPanelHeading = document.querySelector("#list-panel-heading");
const screenTitle = document.querySelector("#screen-title");
const screenSubtitle = document.querySelector("#screen-subtitle");
const listEmpty = document.querySelector("#list-empty");
const searchPrompt = document.querySelector("#search-prompt");
const searchToolbar = document.querySelector("#search-toolbar");
const showMoreButton = document.querySelector("#show-more-button");
const homeInfoNotice = document.querySelector("#home-info-notice");
const stationSearchInput = document.querySelector("#station-search-input");
const areaFilterContainer = document.querySelector("#area-filter-container");
const areaFilterSelect = document.querySelector("#area-filter-select");
const bottomNavItems = document.querySelectorAll("[data-tab]");
const openReportModalButton = document.querySelector("#open-report-modal-button");
const reportModalBackdrop = document.querySelector("#report-modal-backdrop");
const closeReportModalButton = document.querySelector("#close-report-modal-button");
const recenterUserButton = document.querySelector("#recenter-user-button");
const recenterTripoliButton = document.querySelector("#recenter-tripoli-button");
const reportModalStationName = document.querySelector("#report-modal-station-name");
const reportForm = document.querySelector("#report-form");
const reportSuccessToast = document.querySelector("#report-success-toast");
const reportAccessMessage = document.querySelector("#report-access-message");
const bottomNav = document.querySelector(".bottom-nav");
const navIndicator = document.querySelector(".nav-indicator");

const detailsFields = {
  distance: document.querySelector("#station-distance"),
  updated: document.querySelector("#station-updated"),
  reports: document.querySelector("#station-reports"),
  activityLabel: document.querySelector("#station-activity-label"),
  activityCount: document.querySelector("#station-activity-count"),
};

const mapState = {
  instance: null,
  markersByStationId: new Map(),
  userMarker: null,
  infoWindow: null,
  hasInitialView: false,
  apiLoaderPromise: null,
};

const isDevPanelEnabled = getDevPanelConfig().enableDevPanel;
const presenceSignalHealth = {
  locationSource: "disabled",
  nearestStationName: "غير متاح",
  nearestStationDistanceKm: null,
  lastHeartbeatAt: null,
  heartbeatStatus: "disabled",
  heartbeatReason: "لم يبدأ إرسال الإشارات",
  heartbeatError: "",
};

let demoUpdateTimerId = null;
let presenceHeartbeatTimerId = null;
let successToastTimerId = null;
let latestEnrichedStations = [];
let routeMetricsByStationId = new Map();
let latestRouteMetricsRequestKey = "";
let routeMetricsRequestKey = "";
let routeMetricsRequestVersion = 0;
let routeMetricsStatus = "idle";
let hasStatusHistory = false;
let previousStationStatusById = new Map();
// homeListBuildKey: changes only when GPS is first obtained or radius expands.
// lockedHomeLayout: station IDs in the order of the first render. Used to
// rebuild the DOM (e.g. after a tab switch) without re-sorting.
let homeListBuildKey = null;
let lockedHomeLayout = null; // { heroId, backupId, nearbyIds[], otherIds[] }
const anonymousDeviceId = getAnonymousDeviceId();

trackEvent("app_open");
renderEnvironmentWarning();
await safeHydrateData();
locationBanner.textContent = "جاري تحديد موقعك...";
render();
safeHydrateLocation();
initDevPredictionPanel();
scheduleDemoUpdate();
safeSubscribeToRealtime();

stationList.addEventListener("click", (event) => {
  const target = event.target;
  const favoriteAction = target.closest("[data-station-action='favorite']");
  if (favoriteAction) {
    const stationCard = favoriteAction.closest("[data-station-id]");
    if (!stationCard) {
      return;
    }

    event.stopPropagation();
    toggleStationFavorite(stationCard.dataset.stationId);
    return;
  }

  const stationMapAction = target.closest("[data-station-action='maps']");

  if (!stationMapAction) {
    return;
  }

  const stationCard = stationMapAction.closest("[data-station-id]");
  if (!stationCard) {
    return;
  }

  event.stopPropagation();
  openStationInGoogleMaps(stationCard.dataset.stationId);
});

stationList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const favoriteButton = event.target.closest("[data-station-action='favorite']");
  if (favoriteButton) {
    const stationCard = favoriteButton.closest("[data-station-id]");
    if (!stationCard) {
      return;
    }

    event.preventDefault();
    toggleStationFavorite(stationCard.dataset.stationId);
    return;
  }

  const stationButton = event.target.closest("[data-station-action='maps']");
  if (!stationButton) {
    return;
  }

  const stationCard = stationButton.closest("[data-station-id]");
  if (!stationCard) {
    return;
  }

  event.preventDefault();
  openStationInGoogleMaps(stationCard.dataset.stationId);
});

recenterUserButton.addEventListener("click", () => {
  if (!state.hasUserLocation) {
    return;
  }

  state.shouldCenterUserOnMap = true;
  render();
});

recenterTripoliButton.addEventListener("click", () => {
  state.shouldCenterSelectedOnMap = false;
  state.shouldCenterUserOnMap = false;
  centerMapOn(fallbackTripoliLocation, 11);
  mapFocusPill.textContent = "الخريطة على طرابلس";
});

openReportModalButton.addEventListener("click", () => {
  openReportModal();
});

closeReportModalButton.addEventListener("click", () => {
  closeReportModal();
});

reportModalBackdrop.addEventListener("click", (event) => {
  if (event.target === reportModalBackdrop) {
    closeReportModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !reportModalBackdrop.classList.contains("hidden")) {
    closeReportModal();
  }
});

reportForm.addEventListener("submit", (event) => {
  void handleReportSubmit(event);
});

stationSearchInput.addEventListener("input", (event) => {
  const nextSearchQuery = event.target.value.trim();
  if (nextSearchQuery && !state.searchQuery) {
    trackEvent("search_used");
  }

  state.searchQuery = nextSearchQuery;
  state.didAutoFocusBestStation = false;
  render();
});

areaFilterSelect.addEventListener("change", (event) => {
  state.selectedArea = event.target.value;
  state.didAutoFocusBestStation = false;
  render();
});

showMoreButton.addEventListener("click", () => {
  state.discoveryRadiusKm = EXPANDED_DISCOVERY_RADIUS_KM;
  render();
});

bottomNavItems.forEach((item) => {
  item.addEventListener("click", () => {
    const nextTab = item.dataset.tab;
    if (!nextTab || state.activeTab === nextTab) {
      return;
    }

    state.activeTab = nextTab;
    setBottomNavActiveState();
    trackEvent("tab_changed", { tabName: nextTab });
    render();
  });
});

function setBottomNavActiveState() {
  bottomNavItems.forEach((item) => {
    const isActive = item.dataset.tab === state.activeTab;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-current", isActive ? "page" : "false");
  });

  if (bottomNav) {
    bottomNav.dataset.activeTab = state.activeTab;
  }
}

async function handleReportSubmit(event) {
  event.preventDefault();

  const selectedStation = getSelectedStation();
  if (!selectedStation) {
    return;
  }

  const formData = new FormData(reportForm);
  const newReport = createReportRecord({
    stationId: selectedStation.id,
    status: formData.get("status"),
    queueLevel: formData.get("queueLevel"),
    station: selectedStation,
  });

  await repository.submitReport(newReport, state.hasUserLocation ? state.userLocation : null);
  persistedReports = await repository.getRecentReports();

  const updatedStation = projectStations(
    stations,
    getAllReports(),
    state.userLocation,
    presenceRows,
    new Date(),
  ).find(
    (station) => station.id === selectedStation.id,
  );

  closeReportModal();
  showSuccessToast(`${getReportSuccessMessage(selectedStation.name, "")} · شكراً على مساهمتك`);
  render();
}

async function handleRealtimeInsert() {
  try {
    persistedReports = await repository.getRecentReports();
    presenceRows = await repository.getRecentPresence();
  } catch {
    presenceRows = [];
  }
  // Do NOT reset didAutoFocusBestStation — that would force the hero card
  // to re-evaluate and potentially move on every incoming report.
  render();
  showSuccessToast("تم وصول بلاغ جديد");
}

function render() {
  if (state.locationState === LOCATION_STATES.gpsLoading) {
    stationList.innerHTML = "";
    clearMapMarkers();
    listEmpty.classList.add("hidden");
    searchPrompt.classList.add("hidden");
    showMoreButton.classList.add("hidden");
    mapFocusPill.textContent = "جاري تحديد موقعك...";
    renderStationDetails(null);
    return;
  }

  const rankingScenarioContext = getRankingScenarioContext(new Date(), stations);
  const now = rankingScenarioContext.now;
  const reportsForProjection = [...getAllReports(), ...rankingScenarioContext.injectedReports];
  const baseProjectedStations = projectStations(
    stations,
    reportsForProjection,
    state.userLocation,
    presenceRows,
    now,
  );
  const routingResolution = scheduleRouteMetricsRefresh(baseProjectedStations);
  const enrichedStations = buildEnrichedStations(baseProjectedStations, routingResolution.requestKey);
  logLocationDebugSnapshot();
  assertEnrichedStations(enrichedStations, "render");
  logEnrichedStationsTable(enrichedStations);
  processStationNotifications(enrichedStations, now);
  latestEnrichedStations = enrichedStations;
  const areaOptions = getAreaOptions(enrichedStations);
  syncAreaFilter(areaOptions);

  const isMapTab = state.activeTab === "search";
  const activeArea = isMapTab ? state.selectedArea : "";
  const hasSearch = isMapTab && Boolean(state.searchQuery || activeArea);
  const nearbyScope = getNearbyScope(enrichedStations);
  const nearbyRadiusKm = nearbyScope.radiusKm;
  const nearbyBaseStations = nearbyScope.stations;
  state.discoveryRadiusKm = nearbyRadiusKm;
  const discoveryBaseStations = nearbyBaseStations;
  const areaScopedStations = activeArea
    ? discoveryBaseStations.filter((station) => getStationAreaLabel(station) === activeArea)
    : discoveryBaseStations;
  const searchedStations = sortStationsForSearch(
    areaScopedStations.filter((station) => matchesStationSearch(station, state.searchQuery)),
  );
  const discoveryStations = searchedStations.length || hasSearch || state.selectedArea
    ? searchedStations
    : nearbyBaseStations;
  const bestStationCandidates = hasSearch
    ? discoveryStations
    : discoveryStations.filter((station) => station.distanceKm <= nearbyRadiusKm);
  const canExpandRadius = false;
  const stationSections = buildStationSections(enrichedStations, {
    bestCandidates: bestStationCandidates,
    listCandidates: discoveryStations,
    listLimit: 5,
  });
  const renderedStationCount =
    stationSections.recommendedStations.length +
    stationSections.nearbyStations.length +
    stationSections.avoidStations.length;

  console.info(
    `[Home] total stations loaded: ${enrichedStations.length}, rendered station count: ${renderedStationCount}, best station found: ${stationSections.bestStation ? "yes" : "no"}`,
  );

  updateMapActionButtons();
  syncActiveTabUi();

  // ── DEBUG: show user location at top of station list ─────────────────────
  {
    let dbg = document.getElementById("debug-location");
    if (!dbg) {
      dbg = document.createElement("p");
      dbg.id = "debug-location";
      dbg.style.cssText = "font-size:11px;color:#94a3b8;padding:4px 8px 0;margin:0;text-align:right;direction:rtl;font-family:monospace;";
      stationList.parentNode.insertBefore(dbg, stationList);
    }
    if (state.hasUserLocation && state.userLocation) {
      const lat = state.userLocation.latitude.toFixed(5);
      const lng = state.userLocation.longitude.toFixed(5);
      const text = `موقعك: ${lat}، ${lng}`;
      dbg.textContent = text;
      console.log("[DEBUG location]", text);
    } else {
      dbg.textContent = "موقعك: غير محدد";
    }
  }
  // ── END DEBUG ─────────────────────────────────────────────────────────────

  if (!nearbyBaseStations.length) {
    stationList.innerHTML = "";
    clearMapMarkers();
    mapFocusPill.textContent = "لا توجد محطات على الخريطة حالياً";
    listEmpty.classList.remove("hidden");
    searchPrompt.classList.add("hidden");
    renderStationDetails(null);
    return;
  }

  if (stationSections.bestStation && !state.didAutoFocusBestStation) {
    state.selectedStationId = stationSections.bestStation.id;
    state.shouldCenterSelectedOnMap = true;
    state.didAutoFocusBestStation = true;
  } else {
    state.selectedStationId = resolveSelectedStationId(state.selectedStationId, nearbyBaseStations);
  }

  renderStationList({
    stationSections,
    searchResults: searchedStations,
    hasSearch,
    canExpandRadius,
    projectedStations: enrichedStations,
  });
  renderMap(nearbyBaseStations, stationSections.bestStation);
  renderStationDetails(nearbyBaseStations.find((station) => station.id === state.selectedStationId));
}

function buildEnrichedStations(projectedStations, requestKey = "") {
  const canUseRouteMetrics = Boolean(requestKey) &&
    routeMetricsStatus === "ready" &&
    routeMetricsRequestKey === requestKey;

  return projectedStations
    .map((station) => {
      const routeMetric = canUseRouteMetrics ? routeMetricsByStationId.get(station.id) : null;
      const distanceKm = Number.isFinite(routeMetric?.distanceKm)
        ? routeMetric.distanceKm
        : station.distanceKm;
      const routeSource = routeMetric?.routeSource ?? "haversine_fallback";
      const etaMinutes = Number.isFinite(routeMetric?.etaMinutes)
        ? routeMetric.etaMinutes
        : getFallbackEtaMinutesForStation({ ...station, distanceKm });
      const enrichedStation = {
        ...station,
        id: station.id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        distanceKm,
        etaMinutes,
        routeSource,
        status: station.status,
      };
      const score = getStationPriorityScore(enrichedStation);
      return {
        ...enrichedStation,
        score,
        __isEnrichedStation: true,
      };
    })
    .sort((left, right) => right.score - left.score || left.distanceKm - right.distanceKm);
}

function scheduleRouteMetricsRefresh(projectedStations) {
  const requestKey = createRouteMetricsRequestKey(state.userLocation, projectedStations);
  if (!projectedStations.length) {
    routeMetricsByStationId = new Map();
    routeMetricsStatus = "fallback";
    routeMetricsRequestKey = requestKey;
    return { readyForRanking: true, requestKey };
  }

  const routeConfigAvailable = hasGoogleRouteConfig(import.meta.env ?? {}, window.BENZINA_CONFIG ?? {});
  const hasValidUserLocation = Number.isFinite(state.userLocation?.latitude) && Number.isFinite(state.userLocation?.longitude);
  if (!hasValidUserLocation || !routeConfigAvailable || !state.hasUserLocation) {
    routeMetricsByStationId = new Map();
    routeMetricsStatus = "fallback";
    routeMetricsRequestKey = requestKey;
    return { readyForRanking: true, requestKey };
  }

  if (requestKey === latestRouteMetricsRequestKey) {
    return { readyForRanking: routeMetricsStatus !== "pending", requestKey };
  }
  latestRouteMetricsRequestKey = requestKey;
  routeMetricsByStationId = new Map();
  routeMetricsRequestKey = "";
  routeMetricsStatus = "pending";
  const requestVersion = ++routeMetricsRequestVersion;
  void getGoogleRouteMetrics(state.userLocation, projectedStations, {
    runtimeEnv: import.meta.env ?? {},
    browserConfig: window.BENZINA_CONFIG ?? {},
    isDev: isRouteMetricsDevLoggingEnabled(),
  }).then((metrics) => {
    if (requestVersion !== routeMetricsRequestVersion) {
      return;
    }
    routeMetricsByStationId = new Map(metrics.map((metric) => [metric.stationId, metric]));
    routeMetricsRequestKey = requestKey;
    routeMetricsStatus = "ready";
    render();
  }).catch(() => {
    if (requestVersion !== routeMetricsRequestVersion) {
      return;
    }
    routeMetricsByStationId = new Map();
    routeMetricsRequestKey = requestKey;
    routeMetricsStatus = "fallback";
    if (isRouteMetricsDevLoggingEnabled()) {
      console.warn("[Routes] Google route lookup failed, using Haversine fallback", {
        routeSource: "fallback",
      });
    }
    render();
  });
  return { readyForRanking: false, requestKey };
}

function createRouteMetricsRequestKey(userLocation, stationsList) {
  if (!userLocation || !Number.isFinite(userLocation.latitude) || !Number.isFinite(userLocation.longitude)) {
    return "invalid-user-location";
  }
  const userKey = `${userLocation.latitude.toFixed(5)},${userLocation.longitude.toFixed(5)}`;
  const stationKey = stationsList
    .map((station) => `${station.id}:${station.latitude.toFixed(5)},${station.longitude.toFixed(5)}`)
    .join("|");
  return `${userKey}|${stationKey}`;
}

function isRouteMetricsDevLoggingEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env.DEV) {
      return true;
    }
  }
  return Boolean(window?.BENZINA_CONFIG?.ENABLE_DEV_PANEL);
}

function getFallbackEtaMinutesForStation(station) {
  if (!Number.isFinite(station?.distanceKm)) {
    return null;
  }

  const speedKmH = station?.status === "busy" || station?.status === "crowded" || station.distanceKm >= 7
    ? 15
    : station.distanceKm <= 1.5
      ? 35
      : 25;
  const etaMinutes = Math.ceil((station.distanceKm / speedKmH) * 60);
  return Math.min(60, Math.max(2, etaMinutes));
}

function getNearbyScope(stationsList) {
  const validStations = stationsList
    .filter((station) => Number.isFinite(station.distanceKm))
    .sort((left, right) => left.distanceKm - right.distanceKm);

  for (const radiusKm of NEARBY_RADIUS_STEPS_KM) {
    const withinRadius = validStations.filter((station) => station.distanceKm <= radiusKm);
    if (withinRadius.length >= 3) {
      return {
        radiusKm,
        stations: withinRadius,
      };
    }
  }

  const maxRadiusKm = NEARBY_RADIUS_STEPS_KM[NEARBY_RADIUS_STEPS_KM.length - 1];
  return {
    radiusKm: maxRadiusKm,
    stations: validStations.filter((station) => station.distanceKm <= maxRadiusKm),
  };
}

function logLocationDebugSnapshot() {
  if (!isRouteMetricsDevLoggingEnabled()) {
    return;
  }

  console.info("[Location]", {
    state: state.locationState,
    source: state.locationSource,
    gpsPermissionStatus: state.gpsPermissionStatus,
    gpsUsed: state.hasUserLocation,
    fallbackUsed: !state.hasUserLocation,
    userLatitude: state.userLocation?.latitude ?? null,
    userLongitude: state.userLocation?.longitude ?? null,
    failureReason: state.locationFailureReason || null,
  });
}

function assertEnrichedStations(stationsList, context) {
  const invalidStations = stationsList.filter(
    (station) =>
      !station?.__isEnrichedStation ||
      !Number.isFinite(station.distanceKm) ||
      !Number.isFinite(station.etaMinutes) ||
      typeof station.routeSource !== "string" ||
      !Number.isFinite(station.score),
  );

  if (invalidStations.length) {
    console.error("[DataFlow] UI render received non-enriched station data", {
      context,
      invalidStations: invalidStations.map((station) => ({
        id: station?.id,
        name: station?.name,
        distanceKm: station?.distanceKm,
        etaMinutes: station?.etaMinutes,
        routeSource: station?.routeSource,
        score: station?.score,
        isEnriched: station?.__isEnrichedStation === true,
      })),
    });
  }
}

function assertStationSectionsUseEnrichedStations(stationSections) {
  const sectionStations = [
    stationSections.bestStation,
    stationSections.backupStation,
    ...stationSections.recommendedStations,
    ...stationSections.nearbyStations,
    ...stationSections.avoidStations,
  ].filter(Boolean);
  assertEnrichedStations(sectionStations, "station-sections");
}

function logEnrichedStationsTable(enrichedStations) {
  if (typeof console.table !== "function") {
    return;
  }

  console.table(
    enrichedStations.slice(0, 5).map((station) => ({
      name: station.name,
      lat: station.latitude,
      lng: station.longitude,
      distanceKm: Number.isFinite(station.distanceKm)
        ? Number(station.distanceKm.toFixed(3))
        : null,
      etaMinutes: Number.isFinite(station.etaMinutes) ? station.etaMinutes : null,
      routeSource: station.routeSource,
      score: Number(station.score.toFixed(2)),
    })),
  );
}

function getRankingScenarioContext(baseNow, stationsList) {
  const runtimeOverride = window.__RANKING_TEST_MODE__;
  const effectiveMode = runtimeOverride ?? DEV_RANKING_TEST_MODE;
  if (!effectiveMode?.enabled) {
    return {
      now: baseNow,
      injectedReports: [],
    };
  }

  switch (effectiveMode.scenario) {
    case "thursday_evening":
      return {
        now: resolveScenarioDate(baseNow, 4, 20),
        injectedReports: [],
      };
    case "friday_morning":
      return {
        now: resolveScenarioDate(baseNow, 5, 8),
        injectedReports: [],
      };
    case "fuel_shortage_emergency":
      return {
        now: new Date(baseNow),
        injectedReports: createEmergencyScenarioReports(stationsList, baseNow),
      };
    case "normal_day":
    default:
      return {
        now: new Date(baseNow),
        injectedReports: [],
      };
  }
}

function resolveScenarioDate(baseNow, targetDayOfWeek, targetHour) {
  const resolved = new Date(baseNow);
  const deltaDays = (targetDayOfWeek - resolved.getDay() + 7) % 7;
  resolved.setDate(resolved.getDate() + deltaDays);
  resolved.setHours(targetHour, 0, 0, 0);
  return resolved;
}

function createEmergencyScenarioReports(stationsList, now) {
  const emergencyTimestamp = new Date(now.getTime() - 2 * 60000).toISOString();
  return stationsList.map((station, index) => ({
    id: `dev-emergency-${station.id}-${index}`,
    stationId: station.id,
    status: "no_fuel",
    queueLevel: "long",
    createdAt: emergencyTimestamp,
    latitude: station.latitude,
    longitude: station.longitude,
  }));
}

function renderMap(enrichedStations, bestStation) {
  assertEnrichedStations(enrichedStations, "map");
  if (bestStation) {
    assertEnrichedStations([bestStation], "map-best-station");
  }

  if (state.activeTab !== "search") {
    return;
  }

  void ensureGoogleMapsLoaded().then(() => {
    ensureMap();
    if (!mapState.instance) {
      return;
    }

    syncMapMarkers(enrichedStations, bestStation);
    syncUserMarker();

    if (!mapState.hasInitialView) {
      centerMapOn(fallbackTripoliLocation, 11);
      mapState.hasInitialView = true;
    }

    const selectedStation =
      enrichedStations.find((station) => station.id === state.selectedStationId) ??
      enrichedStations[0];

    if (!selectedStation) {
      centerMapOn(state.userLocation, 11);
      mapFocusPill.textContent = "الخريطة على طرابلس";
      return;
    }

    if (state.shouldCenterUserOnMap) {
      centerMapOn(state.userLocation, 12);
      state.shouldCenterUserOnMap = false;
    }

    if (state.shouldCenterSelectedOnMap) {
      centerMapOn(selectedStation, 13);
      state.shouldCenterSelectedOnMap = false;
    }

    mapFocusPill.textContent = selectedStation.name;
    renderMapStationBottomSheet(selectedStation);
  }).catch(() => {
    mapFocusPill.textContent = "تعذر تحميل Google Maps";
  });
}

function renderStationList({ stationSections, searchResults, hasSearch, canExpandRadius = false, projectedStations = [] }) {
  assertStationSectionsUseEnrichedStations(stationSections);
  assertEnrichedStations(searchResults, "search-results");
  searchPrompt.classList.add("hidden");
  const template = document.querySelector("#station-card-template");
  const { bestStation, recommendedStations, nearbyStations, avoidStations } = stationSections;

  // ── Non-home tabs: always wipe and rebuild (search/account have their own order) ──
  if (state.activeTab === "account") {
    stationList.innerHTML = "";
    renderAccountScreen();
    listEmpty.classList.add("hidden");
    showMoreButton.classList.add("hidden");
    return;
  }

  if (state.activeTab === "search") {
    if (hasSearch) {
      renderSearchResults({
        stations: searchResults,
        hasSearch,
        template,
      });
    } else {
      stationList.innerHTML = "";
      listEmpty.classList.add("hidden");
      searchPrompt.classList.add("hidden");
    }
    showMoreButton.classList.add("hidden");
    return;
  }

  // ── Home tab ─────────────────────────────────────────────────────────────
  //
  // Sorting happens ONCE.  The build key only changes on two events:
  //   • GPS is first obtained  (hasUserLocation false → true)
  //   • The user expands the discovery radius
  // Every other render call (realtime insert, demo tick, heartbeat, report
  // submit, tab-switch back to home) must preserve the card order exactly.
  //
  // Three paths:
  //   1. buildKey changed          → fresh sort, save locked order, build DOM
  //   2. Cards already in DOM      → patch data only (no DOM restructuring)
  //   3. DOM empty + locked order  → rebuild in saved order, then patch data
  // ─────────────────────────────────────────────────────────────────────────

  const buildKey = `${state.hasUserLocation ? 1 : 0}|${state.discoveryRadiusKm}`;

  if (buildKey !== homeListBuildKey) {
    // Structural change: clear locked order so next pass does a fresh sort
    homeListBuildKey = buildKey;
    lockedHomeLayout = null;
  }

  // ── Path 2: cards present → in-place data patch, order untouched ─────────
  // Use "article[data-station-id]" — account screen injects li[data-station-id]
  // for favorites/recent items; a bare [data-station-id] selector would match
  // those and incorrectly trigger Path 2 while the account screen is still showing.
  const existingCards = stationList.querySelectorAll("article[data-station-id]");
  if (existingCards.length > 0) {
    existingCards.forEach(function (card) {
      const station = projectedStations.find(function (s) { return s.id === card.dataset.stationId; });
      if (station) patchCardData(card, station);
    });
    showMoreButton.classList.toggle("hidden", !canExpandRadius);
    return;
  }

  // ── Path 3: DOM wiped (tab switch back) → rebuild in locked order ─────────
  if (lockedHomeLayout) {
    var find = function (id) { return projectedStations.find(function (s) { return s.id === id; }); };
    var restoredLayout = {
      heroStation:   lockedHomeLayout.heroId   ? find(lockedHomeLayout.heroId)   : null,
      backupStation: lockedHomeLayout.backupId ? find(lockedHomeLayout.backupId) : null,
      nearbyVisible: lockedHomeLayout.nearbyIds.map(find).filter(Boolean),
      otherStations: lockedHomeLayout.otherIds.map(find).filter(Boolean),
    };
    buildHomeDOM(restoredLayout, template, canExpandRadius);
    // Patch immediately so status reflects current data, not stale first-render data
    stationList.querySelectorAll("article[data-station-id]").forEach(function (card) {
      var station = projectedStations.find(function (s) { return s.id === card.dataset.stationId; });
      if (station) patchCardData(card, station);
    });
    return;
  }

  // ── Path 1: first build → sort once, save order, build DOM ───────────────
  var layout = buildDecisionFirstLayout({
    bestStation,
    backupStation: stationSections.backupStation,
    recommendedStations,
    nearbyStations,
    avoidStations,
  }, 3);
  layout.nearbyVisible = sortStationsForDiscovery(layout.nearbyVisible);
  layout.otherStations = sortStationsForDiscovery(layout.otherStations);
  if (!layout.nearbyVisible.length && !layout.heroStation) {
    layout.nearbyVisible = [...recommendedStations, ...nearbyStations, ...avoidStations].slice(0, 5);
  }

  // Save only IDs — no stale station-object references
  lockedHomeLayout = {
    heroId:    layout.heroStation  ? layout.heroStation.id  : null,
    backupId:  layout.backupStation ? layout.backupStation.id : null,
    nearbyIds: layout.nearbyVisible.map(function (s) { return s.id; }),
    otherIds:  layout.otherStations.map(function (s) { return s.id; }),
  };

  buildHomeDOM(layout, template, canExpandRadius);
}

// Renders a home-tab layout object into #station-list.
// Shared by Path 1 (fresh build) and Path 3 (locked-order restore).
function buildHomeDOM(layout, template, canExpandRadius) {
  stationList.innerHTML = "";

  var totalVisibleStations =
    (layout.heroStation ? 1 : 0) +
    (layout.backupStation ? 1 : 0) +
    layout.nearbyVisible.length +
    layout.otherStations.length;

  if (!totalVisibleStations) {
    listEmpty.textContent = "لا توجد محطات متاحة حالياً.";
    listEmpty.classList.remove("hidden");
    showMoreButton.classList.toggle("hidden", !canExpandRadius);
    return;
  }

  listEmpty.textContent = "لا توجد محطات متاحة حالياً.";
  listEmpty.classList.add("hidden");

  if (layout.heroStation) {
    stationList.append(createHeroSection(layout.heroStation, template));
  }
  if (layout.backupStation) {
    stationList.append(createBackupSection(layout.backupStation, template));
  }
  if (layout.nearbyVisible.length) {
    stationList.append(createSectionBlock({
      title: "محطات قريبة أخرى",
      tone: "nearby",
      stations: layout.nearbyVisible,
      template,
      variant: "compact",
    }));
  }
  if (layout.otherStations.length) {
    stationList.append(createOtherSectionBlock(layout.otherStations, template));
  }

  showMoreButton.classList.toggle("hidden", !canExpandRadius);
}

function renderSearchResults({ stations, hasSearch, template }) {
  if (!hasSearch) {
    listEmpty.classList.add("hidden");
    searchPrompt.classList.remove("hidden");
    return;
  }

  if (!stations.length) {
    searchPrompt.classList.add("hidden");
    listEmpty.textContent = "لا توجد نتائج مطابقة";
    listEmpty.classList.remove("hidden");
    return;
  }

  searchPrompt.classList.add("hidden");
  listEmpty.classList.add("hidden");
  stationList.append(
    createSectionBlock({
      tone: "search",
      stations,
      template,
      variant: "compact",
      hideHeader: true,
    }),
  );
}

function renderAccountScreen() {
  stationList.append(createAccountScreen());
}

function createAccountScreen() {
  const screen = document.createElement("section");
  screen.className = "account-screen";
  screen.append(
    createAccountCardElement(
      "موقعي",
      getLocationStatusText(),
      "نستخدم موقعك لعرض أقرب المحطات فقط",
    ),
    createFavoriteStationsCard(),
    createRecentStationsCard(),
    createUsageActivityCard(),
    createAccountCardElement("عن التطبيق", "شيل يساعدك تعرف أقرب محطة مناسبة قبل ما تمشي"),
    createAccountCardElement("الخصوصية", "لا نعرض موقعك لأي مستخدم آخر"),
  );
  return screen;
}

function createAccountCardElement(title, text, note = "") {
  const card = document.createElement("article");
  card.className = "account-card";

  const heading = document.createElement("h3");
  heading.textContent = title;
  card.append(heading);

  const body = document.createElement("p");
  body.textContent = text;
  card.append(body);

  if (note) {
    const noteElement = document.createElement("p");
    noteElement.className = "account-card-note";
    noteElement.textContent = note;
    card.append(noteElement);
  }

  return card;
}

function createFavoriteStationsCard() {
  const card = document.createElement("article");
  card.className = "account-card";

  const heading = document.createElement("h3");
  heading.textContent = "المفضلة";
  card.append(heading);

  const favoriteStations = readFavoriteStations();
  if (!favoriteStations.length) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "لا توجد محطات محفوظة";
    card.append(emptyState);
    return card;
  }

  const list = document.createElement("ul");
  list.className = "account-stations-list";
  favoriteStations.forEach((station) => {
    list.append(createAccountStationListItem(station, {
      timeText: getFavoriteStationDistanceText(station),
    }));
  });

  card.append(list);
  return card;
}

function createRecentStationsCard() {
  const card = document.createElement("article");
  card.className = "account-card";

  const heading = document.createElement("h3");
  heading.textContent = "آخر استخدام";
  card.append(heading);

  const recentStations = readRecentStations();
  if (!recentStations.length) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "لم يتم فتح أي محطة بعد";
    card.append(emptyState);
    return card;
  }

  const list = document.createElement("ul");
  list.className = "account-stations-list recent-stations-list";
  recentStations.forEach((station) => {
    list.append(createAccountStationListItem(station, {
      timeText: getRecentStationOpenedText(station.timestamp),
    }));
  });

  card.append(list);
  return card;
}

function createUsageActivityCard() {
  const card = document.createElement("article");
  card.className = "account-card";

  const heading = document.createElement("h3");
  heading.textContent = "نشاطك";
  card.append(heading);

  const usageSummary = getUsageAnalyticsSummary();
  const favoriteStations = readFavoriteStations();
  const list = document.createElement("ul");
  list.className = "account-activity-list";

  [
    ["عدد المحطات التي فتحتها", usageSummary.stationOpenCount],
    ["عدد عمليات البحث", usageSummary.searchUsedCount],
    ["عدد المحطات المحفوظة", favoriteStations.length],
  ].forEach(([label, value]) => {
    const item = document.createElement("li");

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = formatNumber(value);

    item.append(labelElement, valueElement);
    list.append(item);
  });

  card.append(list);
  return card;
}

function createAccountStationListItem(station, { timeText }) {
  const item = document.createElement("li");
  item.dataset.stationId = station.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "account-station-button";
  button.dataset.stationAction = "maps";
  button.setAttribute("aria-label", `افتح ${station.name} في خرائط Google`);

  const name = document.createElement("span");
  name.className = "account-station-name";
  name.textContent = station.name;

  const meta = document.createElement("span");
  meta.className = "account-station-meta";
  meta.textContent = timeText;

  button.append(name, meta);
  item.append(button);
  return item;
}

function getLocationStatusText() {
  if (state.hasUserLocation) {
    return "الموقع مفعّل";
  }

  return "الموقع غير مفعّل";
}

function getRecentStationOpenedText(timestamp, now = new Date()) {
  const diffMinutes = Math.max(0, Math.round(minutesSince(timestamp, now)));

  if (!Number.isFinite(diffMinutes)) {
    return "منذ وقت سابق";
  }

  if (diffMinutes < 1) {
    return "منذ أقل من دقيقة";
  }

  if (diffMinutes === 1) {
    return "منذ دقيقة";
  }

  if (diffMinutes < 60) {
    return `منذ ${formatNumber(diffMinutes)} دقائق`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return "منذ ساعة";
  }

  return `منذ ${formatNumber(diffHours)} ساعات`;
}

function getFavoriteStationDistanceText(station) {
  return Number.isFinite(station.distance) ? formatDistanceLabel(station.distance) : "افتح في خرائط Google";
}

function createHeroSection(station, template) {
  const section = document.createElement("section");
  section.className = "station-group station-group-hero";

  const cards = document.createElement("div");
  cards.className = "station-group-list station-group-list-hero";
  cards.append(
    createStationCard(
      { ...station, recommendationBadge: "الأفضل الآن" },
      template,
      "recommended",
      "hero",
    ),
  );
  section.append(cards);

  return section;
}

function createBackupSection(station, template) {
  const section = document.createElement("section");
  section.className = "station-group station-group-backup";

  const cards = document.createElement("div");
  cards.className = "station-group-list station-group-list-compact";
  cards.append(
    createStationCard(
      { ...station, recommendationBadge: "⭐ الخيار الثاني" },
      template,
      "backup",
      "backup",
    ),
  );
  section.append(cards);

  return section;
}

function createSectionBlock({
  title = "",
  description = "",
  tone,
  stations,
  template,
  variant = "default",
  hideHeader = false,
}) {
  const section = document.createElement("section");
  section.className = `station-group station-group-${tone}`;

  if (!hideHeader && (title || description)) {
    const header = document.createElement("div");
    header.className = "station-group-header";
    header.innerHTML = `
      <div>
        ${title ? `<h3 class="station-group-title">${title}</h3>` : ""}
        ${description ? `<p class="station-group-copy">${description}</p>` : ""}
      </div>
    `;
    section.append(header);
  }

  const cards = document.createElement("div");
  cards.className = `station-group-list station-group-list-${variant}`;
  if (tone === "nearby" && variant === "compact") {
    cards.classList.add("nearby-list-card");
  }
  if (tone === "search" && variant === "compact") {
    cards.classList.add("search-list-card");
  }
  stations.forEach((station) => {
    cards.append(createStationCard(station, template, tone, variant));
  });
  section.append(cards);

  return section;
}

function createOtherSectionBlock(stations, template) {
  const details = document.createElement("details");
  details.className = "station-group station-group-avoid";

  const summary = document.createElement("summary");
  summary.className = "station-group-summary";
  summary.innerHTML = `<span class="station-group-link">عرض باقي المحطات</span>`;
  details.append(summary);

  const cards = document.createElement("div");
  cards.className = "station-group-list station-group-list-compact station-group-list-avoid";
  stations.forEach((station) => {
    cards.append(createStationCard(station, template, "avoid", "compact"));
  });
  details.append(cards);

  return details;
}

function createStationCard(station, template, tone, variant = "default") {
    if (variant === "hero") {
      return createReferenceHeroCard(station);
    }

    if (variant === "backup") {
      return createReferenceBackupCard(station);
    }

    if (variant === "compact") {
      return createReferenceListCard(station, tone);
    }

    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".station-card");
    const top = fragment.querySelector(".station-card-top");
    const title = fragment.querySelector(".station-card-title");
    const status = fragment.querySelector(".station-card-status");
    const distance = fragment.querySelector(".station-card-distance");
    const updated = fragment.querySelector(".station-card-updated");
    const reports = fragment.querySelector(".station-card-reports");
    const activity = fragment.querySelector(".station-card-activity");
    const mapsAction = fragment.querySelector("[data-station-action='maps']");

    title.textContent = station.name;
    const displayStatus = getDisplayStatus(station);
    status.textContent = "";
    status.classList.add(`station-card-status-${getDisplayStatusTone(displayStatus)}`);
    distance.textContent = formatDistanceLabel(station.distanceKm);
    updated.textContent = getStationUpdatedText(station);
    reports.textContent = "";
    activity.textContent = "";
    mapsAction.textContent = "افتح في خرائط Google";
    card.dataset.stationId = station.id;
    card.dataset.stationTone = tone;
    card.dataset.stationVariant = variant;

    if (tone === "recommended") {
      card.classList.add("station-card-recommended");
      card.classList.add("station-card-best");
      top.insertAdjacentHTML(
        "afterbegin",
        `<div class="station-card-crown" aria-label="الأفضل الآن"><span>👑</span><span>الأفضل الآن</span></div>`,
      );
    }

    if (tone === "backup") {
      card.classList.add("station-card-backup");
    }

    if (station.recommendationBadge) {
      title.insertAdjacentHTML(
        "beforebegin",
        `<span class="station-card-badge">${station.recommendationBadge}</span>`,
      );
    }

    if (variant === "hero") {
      card.classList.add("station-card-hero");
      card.classList.add("best-station-card");
    }

    if (variant === "backup") {
      card.classList.add("station-card-backup-variant");
      card.classList.add("backup-station-card");
    }

    if (variant === "compact") {
      card.classList.add("station-card-compact");
    }

    if (variant === "hero") {
      mapsAction.innerHTML = `
        <span class="station-card-action-icon" aria-hidden="true">⌖</span>
        <span>افتح في خرائط Google</span>
      `;
    } else if (variant === "backup" || variant === "compact") {
      mapsAction.innerHTML = `
        <span class="sr-only">افتح في خرائط Google</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m7 4 6 6-6 6"></path>
        </svg>
      `;
      mapsAction.setAttribute("aria-label", `افتح ${station.name} في خرائط Google`);
    }

    return fragment;
}

function createReferenceHeroCard(station) {
  return createHeroCard(station);
}

function createReferenceBackupCard(station) {
  return createCompactStationCard(station, "backup");
}

function createReferenceListCard(station, tone) {
  return createCompactStationCard(station, tone);
}

function createHeroCard(station) {
  const card = createStationCardElement(station, "recommended", "hero");
  card.className = "station-card best-station-card hero-card figma-hero-card";
  card.innerHTML = `
    <div class="figma-hero-head">
      <div class="figma-hero-copy">
        <p class="station-card-status"></p>
        <h3 class="best-station-title title"></h3>
      </div>
      <div class="figma-hero-icon-wrap" aria-hidden="true">
        ${createHeroGoldIconMarkup()}
      </div>
    </div>
    <div class="figma-hero-pills">
      <span class="figma-hero-pill">
        <span aria-hidden="true">📍</span>
        <strong data-card-distance></strong>
      </span>
      <span class="figma-hero-pill">
        <span aria-hidden="true">⏱</span>
        <strong data-card-arrival></strong>
      </span>
    </div>
  `;
  card.querySelector(".best-station-title").textContent = station.name;
  fillMetaRow(card, station);
  return card;
}

function createCompactStationCard(station, tone) {
  const card = createStationCardElement(station, tone, "compact");
  card.className = "station-card nearby-station-row figma-nearby-card";
  card.dataset.stationStatus = station.status ?? "unknown";
  card.setAttribute("aria-label", station.name);
  card.innerHTML = `
    <div class="nearby-station-info">
      <div class="nearby-station-icon station-icon-wrap" aria-hidden="true">
        ${createFuelIconMarkup()}
      </div>
    </div>
    <div class="nearby-station-copy">
      <h3 class="nearby-station-title"></h3>
      <div class="station-card-meta-row nearby-station-meta">
        <span class="station-card-meta-item">
          <span aria-hidden="true">📍</span>
          <span data-card-distance></span>
        </span>
        <span class="station-card-meta-separator" aria-hidden="true">·</span>
        <span class="station-card-meta-item">
          <span aria-hidden="true">⏱</span>
          <span data-card-arrival></span>
        </span>
      </div>
    </div>
    <div class="station-card-side-actions">
      <button type="button" class="station-card-row-action station-card-action-map" data-station-action="maps" aria-label="افتح في خرائط Google">
        ${createChevronIconMarkup()}
      </button>
    </div>
  `;

  card.querySelector(".nearby-station-title").textContent = station.name;
  fillMetaRow(card, station);
  return card;
}

function createStationCardElement(station, tone, variant) {
  const card = document.createElement("article");
  card.dataset.stationId = station.id;
  card.dataset.stationTone = tone;
  card.dataset.stationVariant = variant;
  return card;
}

function fillStatus(element, displayStatus) {
  element.textContent = displayStatus;
  element.classList.add(`station-card-status-${getDisplayStatusTone(displayStatus)}`);
}

function fillMetaRow(card, station) {
  const distance = card.querySelector("[data-card-distance]");
  if (distance) {
    distance.textContent = Number.isFinite(station.distanceKm) ? formatDistanceLabel(station.distanceKm) : "غير متاح";
  }

  const updated = card.querySelector("[data-card-updated]");
  if (updated) {
    updated.textContent = getStationUpdatedText(station);
  }

  const arrival = card.querySelector("[data-card-arrival]");
  if (arrival) {
    arrival.textContent = getEstimatedArrivalText(station);
  }
}

function fillForecast(card, station) {
  const forecast = predictCrowdStatus(station, new Date(), {
    activeDevices: station.activeDevices,
    activityLevel: station.activityLevel,
  });

  card.querySelector("[data-forecast-window]").textContent = forecast.bestTimeWindow;
  card.querySelector("[data-forecast-status]").textContent = forecast.predictedStatus;
}

// In-place card data update — never touches DOM structure or card position.
// Called by the locked-order path in renderStationList.
function patchCardData(card, station) {
  const displayStatus = getDisplayStatus(station);

  const statusEl = card.querySelector(".station-card-status");
  if (statusEl) {
    statusEl.className = "station-card-status";
    statusEl.classList.add(`station-card-status-${getDisplayStatusTone(displayStatus)}`);
    statusEl.textContent = "";
  }

  const distEl = card.querySelector("[data-card-distance]");
  if (distEl) distEl.textContent = formatDistanceLabel(station.distanceKm);

  const updEl = card.querySelector("[data-card-updated]");
  if (updEl) updEl.textContent = getStationUpdatedText(station);
}

function createMetaRowMarkup(className) {
  return `
    <div class="station-card-meta-row ${className}">
      <span class="station-card-meta-item">
        <span aria-hidden="true">📍</span>
        <span data-card-distance></span>
      </span>
      <span class="station-card-meta-separator" aria-hidden="true">·</span>
      <span class="station-card-meta-item">
        <span aria-hidden="true">⏱</span>
        <span data-card-updated></span>
      </span>
    </div>
  `;
}

function createForecastMarkup(className) {
  return `
    <div class="station-card-forecast ${className}">
      <span>
        <strong>أفضل وقت للتعبئة</strong>
        <span data-forecast-window></span>
      </span>
      <span>
        <strong>توقع الزحمة</strong>
        <span data-forecast-status></span>
      </span>
    </div>
  `;
}

function createFuelIconMarkup() {
  return `<img src="/assets/gas-station.png" class="station-icon-img" alt="" aria-hidden="true" />`;
}

function createHeroGoldIconMarkup() {
  return `<img src="/assets/gas-station.png" class="hero-gold-icon" alt="" aria-hidden="true" />`;
}

function createFavoriteActionMarkup(station) {
  const isSaved = isFavoriteStation(station.id);
  return `
    <button type="button" class="station-favorite-action${isSaved ? " is-saved" : ""}" data-station-action="favorite" aria-pressed="${isSaved ? "true" : "false"}">
      <span aria-hidden="true">${isSaved ? "★" : "☆"}</span>
      <span>${isSaved ? "محفوظ" : "حفظ"}</span>
    </button>
  `;
}

function createChevronIconMarkup() {
  return `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m7 4 6 6-6 6"></path>
    </svg>
  `;
}

function getDisplayStatusTone(displayStatus) {
  if (displayStatus === "عالبومبة طول") {
    return "available";
  }

  if (displayStatus === "طابور خفيف") {
    return "light";
  }

  if (displayStatus === "زحمة") {
    return "long";
  }

  if (displayStatus === "مسكر") {
    return "closed";
  }

  return "light";
}

function updateMapActionButtons() {
  recenterUserButton.disabled = !state.hasUserLocation;
}

function renderStationDetails(station) {
  if (station) {
    assertEnrichedStations([station], "details-panel");
  }

  if (!station) {
    stationEmpty.classList.remove("hidden");
    stationDetails.classList.add("hidden");
    stationTitle.textContent = "اختر محطة";
    openReportModalButton.disabled = true;
    reportAccessMessage.textContent = "";
    return;
  }

  stationEmpty.classList.add("hidden");
  stationDetails.classList.remove("hidden");

  stationTitle.textContent = station.name;

  detailsFields.distance.textContent = formatDistanceLabel(station.distanceKm);
  detailsFields.updated.textContent = getStationUpdatedText(station);
  detailsFields.reports.textContent = getDriverTrustLabel(station);
  detailsFields.activityLabel.textContent = getStationActivityText(station);
  detailsFields.activityCount.textContent = (station.activeDevices ?? 0) > 0
    ? `${getLiveActivityLabel(station.activeDevices)} · مباشر الآن`
    : "0";

  const reportEligibility = getReportEligibility({
    userLocation: state.userLocation,
    station,
    hasUserLocation: state.hasUserLocation,
  });

  openReportModalButton.disabled = false;
  reportAccessMessage.textContent = reportEligibility.message;
}

function syncAreaFilter(areaOptions) {
  if (state.activeTab !== "search") {
    areaFilterContainer.classList.add("hidden");
    return;
  }

  if (!areaOptions.length) {
    areaFilterContainer.classList.add("hidden");
    areaFilterSelect.value = "";
    state.selectedArea = "";
    return;
  }

  areaFilterContainer.classList.remove("hidden");
  const currentOptions = new Set([...areaFilterSelect.options].map((option) => option.value));
  const hasChanged =
    areaOptions.length !== areaFilterSelect.options.length - 1 ||
    areaOptions.some((option) => !currentOptions.has(option));

  if (hasChanged) {
    areaFilterSelect.innerHTML = `<option value="">كل المناطق</option>${areaOptions
      .map((option) => `<option value="${option}">${option}</option>`)
      .join("")}`;
  }

  if (state.selectedArea && !areaOptions.includes(state.selectedArea)) {
    state.selectedArea = "";
  }

  areaFilterSelect.value = state.selectedArea;
}

function syncActiveTabUi() {
  const isMapTab = state.activeTab === "search";
  const isAccountTab = state.activeTab === "account";
  const isHomeTab = state.activeTab === "home";

  screenTitle.textContent = isAccountTab ? "حسابي" : isMapTab ? "الخريطة" : "أقرب المحطات";
  screenSubtitle.textContent = isAccountTab
    ? "إعدادات بسيطة للنموذج الأولي"
    : isMapTab
      ? "اختر محطة من الخريطة وافتح الاتجاهات"
      : "اختر المحطة المناسبة وافتحها في خرائط Google";
  listPanelHeading.classList.toggle("hidden", isHomeTab);
  homeInfoNotice?.classList.toggle("hidden", !isHomeTab);
  mapPanel?.classList.toggle("home-screen-hidden", !isMapTab);
  mapPanel?.toggleAttribute("hidden", !isMapTab);
  mapPanel?.setAttribute("aria-hidden", isMapTab ? "false" : "true");
  detailsPanel?.classList.toggle("home-screen-hidden", !isMapTab);
  detailsPanel?.toggleAttribute("hidden", !isMapTab);
  detailsPanel?.setAttribute("aria-hidden", isMapTab ? "false" : "true");

  searchToolbar.classList.toggle("hidden", !isMapTab);
  if (!isMapTab) {
    searchPrompt.classList.add("hidden");
  }

  setBottomNavActiveState();
}

function initDevPredictionPanel() {
  if (!isDevPanelEnabled || !layout) {
    return;
  }

  const panel = createDevPredictionPanel();
  layout.append(panel);
  updateDevPredictionPanel(panel);
  panel.addEventListener("input", () => {
    updateDevPredictionPanel(panel);
  });
  panel.addEventListener("change", () => {
    updateDevPredictionPanel(panel);
  });
}

function createDevPredictionPanel() {
  const panel = document.createElement("section");
  panel.className = "panel dev-prediction-panel";
  panel.dataset.devPanel = "prediction";
  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="section-label">اختبار المطور</p>
        <h2>محرك التوقع</h2>
      </div>
      <p class="panel-copy">هذا القسم يظهر فقط عند تفعيل ENABLE_DEV_PANEL.</p>
    </div>
    <div class="dev-prediction-grid">
      <label>
        <span>الأجهزة النشطة</span>
        <input type="number" min="0" step="1" value="8" data-dev-input="activeDevices" />
      </label>
      <label>
        <span>متوسط البقاء بالدقائق</span>
        <input type="number" min="0" step="1" value="4" data-dev-input="averageDwellMinutes" />
      </label>
      <label>
        <span>معدل الخروج السريع</span>
        <input type="number" min="0" max="1" step="0.1" value="0" data-dev-input="bounceRate" />
      </label>
      <label>
        <span>اليوم</span>
        <select data-dev-input="dayOfWeek">
          <option value="0">الأحد</option>
          <option value="1" selected>الإثنين</option>
          <option value="2">الثلاثاء</option>
          <option value="3">الأربعاء</option>
          <option value="4">الخميس</option>
          <option value="5">الجمعة</option>
          <option value="6">السبت</option>
        </select>
      </label>
      <label>
        <span>الساعة</span>
        <input type="number" min="0" max="23" step="1" value="13" data-dev-input="hourOfDay" />
      </label>
    </div>
    <div class="dev-prediction-result" aria-live="polite">
      <div>
        <span>النتيجة المتوقعة</span>
        <strong data-dev-output="predictedStatus"></strong>
      </div>
      <div>
        <span>الثقة</span>
        <strong data-dev-output="confidence"></strong>
      </div>
    </div>
    <div class="dev-signal-health" aria-live="polite">
      <h3>فحص إشارات الحضور</h3>
      <dl>
        <div>
          <dt>device_id</dt>
          <dd data-dev-health="deviceId"></dd>
        </div>
        <div>
          <dt>مصدر الموقع</dt>
          <dd data-dev-health="locationSource"></dd>
        </div>
        <div>
          <dt>أقرب محطة</dt>
          <dd data-dev-health="nearestStation"></dd>
        </div>
        <div>
          <dt>المسافة</dt>
          <dd data-dev-health="nearestDistance"></dd>
        </div>
        <div>
          <dt>آخر heartbeat</dt>
          <dd data-dev-health="lastHeartbeat"></dd>
        </div>
        <div>
          <dt>حالة heartbeat</dt>
          <dd data-dev-health="heartbeatStatus"></dd>
        </div>
        <div>
          <dt>خطأ Supabase</dt>
          <dd data-dev-health="heartbeatError"></dd>
        </div>
      </dl>
    </div>
  `;

  return panel;
}

function updateDevPredictionPanel(panel) {
  const activeDevices = getDevPanelNumber(panel, "activeDevices");
  const averageDwellMinutes = getDevPanelNumber(panel, "averageDwellMinutes");
  const bounceRate = getDevPanelNumber(panel, "bounceRate");
  const dayOfWeek = getDevPanelNumber(panel, "dayOfWeek");
  const hourOfDay = getDevPanelNumber(panel, "hourOfDay");
  const now = new Date();
  const prediction = predictStationStatus(
    {
      activeDevices,
      averageDwellMinutes,
      bounceRate,
      arrivalRate: activeDevices,
      lastSignalAt: activeDevices > 0 ? now.toISOString() : null,
    },
    {
      dayOfWeek,
      hourOfDay,
      now,
    },
  );

  panel.querySelector("[data-dev-output='predictedStatus']").textContent = prediction.predictedStatus;
  panel.querySelector("[data-dev-output='confidence']").textContent = prediction.confidenceLabelArabic;
  updateDevSignalHealthPanel();
}

function getDevPanelNumber(panel, name) {
  const value = Number(panel.querySelector(`[data-dev-input='${name}']`)?.value);
  return Number.isFinite(value) ? value : 0;
}

function updateDevSignalHealthPanel() {
  if (!isDevPanelEnabled) {
    return;
  }

  const panel = document.querySelector("[data-dev-panel='prediction']");
  if (!panel) {
    return;
  }

  const setHealthText = (key, value) => {
    const target = panel.querySelector(`[data-dev-health='${key}']`);
    if (target) {
      target.textContent = value;
    }
  };

  setHealthText("deviceId", anonymousDeviceId);
  setHealthText("locationSource", presenceSignalHealth.locationSource);
  setHealthText("nearestStation", presenceSignalHealth.nearestStationName);
  setHealthText(
    "nearestDistance",
    presenceSignalHealth.nearestStationDistanceKm == null
      ? "غير متاح"
      : `${formatNumber(Math.round(presenceSignalHealth.nearestStationDistanceKm * 1000))} متر`,
  );
  setHealthText(
    "lastHeartbeat",
    presenceSignalHealth.lastHeartbeatAt
      ? formatRelativeTime(presenceSignalHealth.lastHeartbeatAt).replace("آخر تحديث: منذ", "منذ")
      : "لا يوجد",
  );
  setHealthText(
    "heartbeatStatus",
    `${presenceSignalHealth.heartbeatStatus} · ${presenceSignalHealth.heartbeatReason}`,
  );
  setHealthText("heartbeatError", presenceSignalHealth.heartbeatError || "لا يوجد");
}

function updatePresenceSignalHealth(nextHealth) {
  Object.assign(presenceSignalHealth, nextHealth);
  updateDevSignalHealthPanel();
}

function logDevPresence(message, metadata = {}) {
  if (!isDevPanelEnabled) {
    return;
  }

  console.info(`[Dev Presence] ${message}`, metadata);
}

function getPresenceHeartbeatFailureReason(errorMessage = "") {
  const normalizedError = errorMessage.toLowerCase();

  if (normalizedError.includes("config")) {
    return "Supabase غير مفعّل";
  }

  if (
    normalizedError.includes("row-level") ||
    normalizedError.includes("rls") ||
    normalizedError.includes("policy") ||
    normalizedError.includes("permission")
  ) {
    return "غالباً RLS تمنع الإدخال";
  }

  return "لم يتم حفظ الإشارة في station_presence";
}

function toggleStationFavorite(stationId) {
  const station = latestEnrichedStations.find((item) => item.id === stationId);
  if (!station) {
    console.error("[DataFlow] Favorite action attempted without enriched station data", { stationId });
    return;
  }

  const { isFavorite } = toggleFavoriteStation(station);
  trackEvent(isFavorite ? "favorite_added" : "favorite_removed", {
    stationId: station.id,
    stationName: station.name,
  });
  showSuccessToast(isFavorite ? "تم حفظ المحطة" : "تم إزالة المحطة من المفضلة");
  render();
}

function openStationInGoogleMaps(stationId) {
  const station = latestEnrichedStations.find((item) => item.id === stationId);
  if (!station) {
    console.error("[DataFlow] Maps action attempted without enriched station data", { stationId });
    return;
  }

  saveRecentStation(station);
  trackEvent("station_opened_google_maps", {
    stationId: station.id,
    stationName: station.name,
  });
  const mapsUrl = getGoogleMapsDirectionsUrl(
    station,
    state.hasUserLocation ? state.userLocation : null,
  );
  window.open(mapsUrl, "_blank", "noopener");
  showSuccessToast("تم فتح الخريطة. رحلة موفقة");
}

function hydrateLocation() {
  const locationModeConfig = getLocationModeConfig();
  const devLocationOverride = getDevLocationOverrideConfig(
    import.meta.env ?? {},
    window,
    DEV_LOCATION_OVERRIDE,
  );
  state.isLocatingUser = true;
  state.locationState = LOCATION_STATES.gpsLoading;
  state.locationFailureReason = "";
  locationBanner.textContent = "جاري تحديد موقعك...";
  void logGpsPermissionStatus();

  if (devLocationOverride.enabled && devLocationOverride.hasValidLocation) {
    applyResolvedLocation({
      latitude: devLocationOverride.latitude,
      longitude: devLocationOverride.longitude,
      source: "dev_override",
      isGps: true,
      locationBannerText: "وضع المطور: يتم استخدام موقع اختبار ثابت.",
    });
    console.info("Location source: dev_override", {
      latitude: devLocationOverride.latitude,
      longitude: devLocationOverride.longitude,
    });
    safeStartPresenceHeartbeat();
    render();
    return;
  }

  if (devLocationOverride.enabled && !devLocationOverride.hasValidLocation) {
    applyFallbackLocation("invalid_dev_location_override", "إحداثيات وضع المطور غير صالحة");
    stopPresenceHeartbeat();
    console.warn("Location source: fallback_tripoli_invalid_dev_override", {
      latitude: devLocationOverride.latitude,
      longitude: devLocationOverride.longitude,
    });
    render();
    return;
  }

  if (locationModeConfig.useFakeLocation) {
    if (locationModeConfig.hasValidFakeLocation) {
      applyResolvedLocation({
        latitude: locationModeConfig.latitude,
        longitude: locationModeConfig.longitude,
        source: "dev_override",
        isGps: true,
        locationBannerText: "وضع الاختبار: يتم استخدام موقع وهمي",
      });
      updatePresenceSignalHealth({
        locationSource: "fake",
        heartbeatStatus: "disabled",
        heartbeatReason: "ينتظر أول إرسال",
        heartbeatError: "",
      });
      logDevPresence("location source", { source: "fake" });
      logDevPresence("location fetched", {
        source: "fake",
        latitude: state.userLocation.latitude,
        longitude: state.userLocation.longitude,
      });
      safeStartPresenceHeartbeat();
      render();
      return;
    }

    applyFallbackLocation("invalid_fake_location", "إحداثيات الاختبار غير صالحة");
    stopPresenceHeartbeat();
    updatePresenceSignalHealth({
      locationSource: "fallback_tripoli_invalid_fake_location",
      nearestStationName: "غير متاح",
      nearestStationDistanceKm: null,
      heartbeatStatus: "disabled",
      heartbeatReason: "إحداثيات الاختبار غير صالحة",
      heartbeatError: "Invalid fake location coordinates.",
    });
    logDevPresence("location source", { source: "fallback_tripoli_invalid_fake_location" });
    render();
    return;
  }

  if (window.location.protocol === "file:") {
    applyFallbackLocation("file_protocol", "التطبيق مفتوح عبر file://");
    stopPresenceHeartbeat();
    updatePresenceSignalHealth({
      locationSource: "disabled_file_protocol",
      nearestStationName: "غير متاح",
      nearestStationDistanceKm: null,
      heartbeatStatus: "disabled",
      heartbeatReason: "التطبيق مفتوح عبر file://",
      heartbeatError: "Location is disabled on file://. Use localhost.",
    });
    logDevPresence("location source", { source: "disabled_file_protocol" });
    render();
    return;
  }

  if (!("geolocation" in navigator)) {
    applyFallbackLocation("no_geolocation_support", "Geolocation API unavailable.");
    stopPresenceHeartbeat();
    updatePresenceSignalHealth({
      locationSource: "fallback_tripoli_no_geolocation",
      nearestStationName: "غير متاح",
      nearestStationDistanceKm: null,
      heartbeatStatus: "disabled",
      heartbeatReason: "المتصفح لا يدعم الموقع",
      heartbeatError: "Geolocation API unavailable.",
    });
    logDevPresence("location source", { source: "fallback_tripoli_no_geolocation" });
    render();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      applyResolvedLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        source: "gps",
        isGps: true,
        locationBannerText: "تم تحديد موقعك الحالي. يتم ترتيب المحطات وعرض موقعك على الخريطة.",
      });
      if (isRouteMetricsDevLoggingEnabled()) {
        console.info("[GPS] user location", {
          latitude: state.userLocation.latitude,
          longitude: state.userLocation.longitude,
          defaultLocationUsed: false,
        });
      }
      console.info("[GPS] success", {
        source: "gps",
        accuracyMeters: position.coords.accuracy,
      });
      updatePresenceSignalHealth({
        locationSource: "browser_geolocation",
        heartbeatStatus: "disabled",
        heartbeatReason: "ينتظر أول إرسال",
        heartbeatError: "",
      });
      logDevPresence("location source", { source: "browser_geolocation" });
      logDevPresence("location fetched", {
        source: "browser_geolocation",
        latitude: state.userLocation.latitude,
        longitude: state.userLocation.longitude,
        accuracyMeters: position.coords.accuracy,
      });
      safeStartPresenceHeartbeat();
      render();
    },
    (error) => {
      const failureReason = resolveGeolocationErrorReason(error);
      state.locationState = LOCATION_STATES.gpsFailed;
      state.locationFailureReason = failureReason;
      if (isRouteMetricsDevLoggingEnabled()) {
        console.warn("[GPS] failure", {
          reason: failureReason,
          errorCode: error?.code ?? null,
          errorMessage: error?.message ?? null,
        });
      }
      applyFallbackLocation("gps_failure", failureReason);
      stopPresenceHeartbeat();
      updatePresenceSignalHealth({
        locationSource: "fallback_tripoli_permission_denied",
        nearestStationName: "غير متاح",
        nearestStationDistanceKm: null,
      heartbeatStatus: "disabled",
      heartbeatReason: "تم رفض إذن الموقع",
      heartbeatError: "Location permission denied.",
    });
      logDevPresence("location source", { source: "fallback_tripoli_permission_denied" });
      render();
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
}

function getSelectedStation() {
  return (
    latestEnrichedStations.find((station) => station.id === state.selectedStationId) ??
    stations.find((station) => station.id === state.selectedStationId) ??
    null
  );
}

function applyResolvedLocation({
  latitude,
  longitude,
  source,
  isGps,
  locationBannerText,
}) {
  state.realUserLocation = {
    latitude,
    longitude,
  };
  state.userLocation = state.realUserLocation;
  state.hasUserLocation = Boolean(isGps);
  state.isLocatingUser = false;
  state.locationState = LOCATION_STATES.gpsSuccess;
  state.locationSource = source;
  state.shouldCenterUserOnMap = true;
  state.didAutoFocusBestStation = false;
  locationBanner.textContent = locationBannerText;
}

function applyFallbackLocation(reasonCode, reasonMessage = "") {
  state.realUserLocation = null;
  state.userLocation = fallbackTripoliLocation;
  state.hasUserLocation = false;
  state.isLocatingUser = false;
  state.locationState = LOCATION_STATES.fallbackUsed;
  state.locationSource = "fallback_tripoli_center";
  state.locationFailureReason = reasonMessage || reasonCode;
  locationBanner.textContent = "لم نتمكن من تحديد موقعك، يتم عرض محطات قريبة من وسط طرابلس.";
  console.warn("Using fallback Tripoli center — distances are approximate", {
    source: state.locationSource,
    reason: reasonMessage || reasonCode,
    latitude: fallbackTripoliLocation.latitude,
    longitude: fallbackTripoliLocation.longitude,
  });
}

async function logGpsPermissionStatus() {
  if (!navigator.permissions?.query) {
    state.gpsPermissionStatus = "unsupported";
    if (isRouteMetricsDevLoggingEnabled()) {
      console.info("[GPS] permission status", {
        status: state.gpsPermissionStatus,
      });
    }
    return;
  }

  try {
    const permissionState = await navigator.permissions.query({ name: "geolocation" });
    state.gpsPermissionStatus = permissionState.state;
    if (isRouteMetricsDevLoggingEnabled()) {
      console.info("[GPS] permission status", {
        status: permissionState.state,
      });
    }
  } catch (error) {
    state.gpsPermissionStatus = "unknown";
    if (isRouteMetricsDevLoggingEnabled()) {
      console.warn("[GPS] permission status unavailable", {
        error: error?.message ?? "unknown",
      });
    }
  }
}

function resolveGeolocationErrorReason(error) {
  if (!error) {
    return "unknown_geolocation_error";
  }

  if (error.code === 1) {
    return "permission_denied";
  }
  if (error.code === 2) {
    return "position_unavailable";
  }
  if (error.code === 3) {
    return "timeout";
  }
  return error.message || "unknown_geolocation_error";
}

function openReportModal() {
  const selectedStation = getSelectedStation();
  if (!selectedStation) {
    return;
  }

  reportModalStationName.textContent = selectedStation.name;
  reportForm.reset();
  reportForm.elements.status.value = "available";
  reportModalBackdrop.classList.remove("hidden");
  document.body.classList.add("modal-open");
  showSuccessToast("وجودك يساعد تحسين دقة البيانات");
}

function closeReportModal() {
  reportModalBackdrop.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function showSuccessToast(message) {
  window.clearTimeout(successToastTimerId);
  reportSuccessToast.textContent = message;
  reportSuccessToast.classList.remove("hidden");

  successToastTimerId = window.setTimeout(() => {
    reportSuccessToast.classList.add("hidden");
  }, 2600);
}

function getStationUpdatedText(station) {
  const urgencyMessage = getStationUrgencyMessage(station);
  if (urgencyMessage) {
    return urgencyMessage.replace("كانت شغالة قبل", "تم التحديث منذ");
  }

  const relativeTime = formatRelativeTime(station.lastUpdated).replace("آخر تحديث: منذ", "تم التحديث منذ");
  if (station.signalNote) {
    return `${relativeTime} · قديمة نسبياً`;
  }

  return relativeTime;
}

function getStationActivityText(station) {
  if ((station.activeDevices ?? 0) > 0) {
    return `${getLiveActivityLabel(station.activeDevices)} · مباشر الآن`;
  }

  if (station.status === "busy") {
    return "زحمة";
  }

  if (station.status === "no_fuel") {
    return "مسكر";
  }

  return "طابور خفيف";
}

function getDriverFlowLabel(station) {
  return getDisplayStatus(station);
}

function getEstimatedArrivalText(station) {
  if (!Number.isFinite(station?.etaMinutes)) {
    return "الوصول غير متاح";
  }

  return `الوصول خلال ${formatNumber(station.etaMinutes)} دقائق`;
}

function getDriverTrustLabel(station) {
  if (station.confidenceLevel === "high") {
    return "واضحة";
  }

  if (station.confidenceLevel === "medium") {
    return "مقبولة";
  }

  return "خفيفة";
}

function processStationNotifications(enrichedStations, now = new Date()) {
  assertEnrichedStations(enrichedStations, "notifications");
  const nextStatusById = new Map(enrichedStations.map((station) => [station.id, station.status]));

  if (!hasStatusHistory) {
    previousStationStatusById = nextStatusById;
    hasStatusHistory = true;
    return;
  }

  enrichedStations.forEach((station) => {
    const previousStatus = previousStationStatusById.get(station.id);
    if (!shouldNotifyAvailabilityChange(previousStatus, station.status)) {
      return;
    }

    if (!canNotifyStation(station.id, now)) {
      return;
    }

    notifyUser(station, getStationAvailabilityNotificationMessage(station), {
      showToast(message) {
        showSuccessToast(message);
      },
    });
    markStationNotified(station.id, now);
  });

  previousStationStatusById = nextStatusById;
}

function renderEnvironmentWarning() {
  const warningMessage = getProtocolWarning(window.location.protocol);

  if (!warningMessage) {
    environmentWarning.classList.add("hidden");
    environmentWarning.textContent = "";
    return;
  }

  environmentWarning.textContent = warningMessage;
  environmentWarning.classList.remove("hidden");
}

function ensureGoogleMapsLoaded() {
  if (window.google?.maps) {
    return Promise.resolve();
  }
  if (mapState.apiLoaderPromise) {
    return mapState.apiLoaderPromise;
  }

  const apiKey = resolveGoogleMapsApiKey(import.meta.env ?? {}, globalThis.BENZINA_CONFIG ?? {}).trim();
  if (!apiKey) {
    return Promise.reject(new Error("GOOGLE_MAPS_API_KEY is missing"));
  }

  mapState.apiLoaderPromise = new Promise((resolve, reject) => {
    const callbackName = `__shaleMapsReady_${Date.now()}`;
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };

    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=ar&region=LY&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[callbackName];
      mapState.apiLoaderPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.append(script);
  });

  return mapState.apiLoaderPromise;
}

function getStationPinColor(station) {
  if (station.status === "available") {
    return "#16a34a";
  }
  if (station.status === "busy" || station.status === "crowded") {
    return "#eab308";
  }
  if (station.status === "no_fuel") {
    return "#ef4444";
  }
  return "#9ca3af";
}

function renderMapStationBottomSheet(station) {
  if (!stationMap) {
    return;
  }

  let sheet = stationMap.querySelector(".map-station-sheet");
  if (!sheet) {
    sheet = document.createElement("article");
    sheet.className = "map-station-sheet";
    stationMap.append(sheet);
  }

  const distanceText = Number.isFinite(station.distanceKm) ? formatDistanceLabel(station.distanceKm) : "غير متاح";
  const etaText = getEstimatedArrivalText(station);

  sheet.innerHTML = `
    <h3 class="map-station-sheet-title">${station.name}</h3>
    <p class="map-station-sheet-meta">${distanceText} · ${etaText}</p>
    <button type="button" class="map-station-sheet-action" data-map-direction-button="true">الاتجاهات</button>
  `;

  const directionButton = sheet.querySelector("[data-map-direction-button='true']");
  directionButton?.addEventListener("click", () => {
    const url = getGoogleMapsDirectionsUrl(
      station,
      state.hasUserLocation ? state.userLocation : null,
    );
    window.open(url, "_blank", "noopener");
  });
}

function ensureMap() {
  if (mapState.instance) {
    return;
  }

  if (!stationMap) {
    mapFocusPill.textContent = "تعذر تحميل الخريطة الآن";
    return;
  }

  if (!window.google?.maps) {
    mapFocusPill.textContent = "تعذر تحميل Google Maps";
    return;
  }

  mapState.instance = new window.google.maps.Map(stationMap, {
    center: { lat: fallbackTripoliLocation.latitude, lng: fallbackTripoliLocation.longitude },
    zoom: 11,
    disableDefaultUI: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
  });
  mapState.infoWindow = new window.google.maps.InfoWindow();
}

function syncUserMarker() {
  if (!mapState.instance) {
    return;
  }

  if (!state.hasUserLocation) {
    mapState.userMarker?.setMap(null);
    mapState.userMarker = null;
    return;
  }

  if (!mapState.userMarker) {
    mapState.userMarker = new window.google.maps.Marker({
      map: mapState.instance,
      position: { lat: state.userLocation.latitude, lng: state.userLocation.longitude },
      title: "موقعك الحالي",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#1f7aec",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 3,
      },
      zIndex: 2000,
    });
    return;
  }

  mapState.userMarker.setPosition({
    lat: state.userLocation.latitude,
    lng: state.userLocation.longitude,
  });
}

function syncMapMarkers(enrichedStations, bestStation) {
  if (!mapState.instance) {
    return;
  }

  clearMapMarkers();

  assertEnrichedStations(enrichedStations, "map-markers");

  enrichedStations.forEach((station) => {
    const marker = new window.google.maps.Marker({
      map: mapState.instance,
      position: { lat: station.latitude, lng: station.longitude },
      title: station.name,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: bestStation?.id === station.id ? 9 : 7,
        fillColor: getStationPinColor(station),
        fillOpacity: 1,
        strokeColor: station.id === state.selectedStationId ? "#111827" : "#ffffff",
        strokeWeight: station.id === state.selectedStationId ? 3 : 2,
      },
      zIndex: station.id === state.selectedStationId ? 1200 : 1000,
    });

    marker.addListener("click", () => {
      selectStation(station.id, {
        centerMap: true,
        showDetails: state.activeTab === "search",
        showCard: state.activeTab !== "search",
      });
      renderMapStationBottomSheet(station);
    });

    mapState.markersByStationId.set(station.id, marker);
  });
}

function clearMapMarkers() {
  mapState.markersByStationId.forEach((marker) => marker.setMap(null));
  mapState.markersByStationId = new Map();
}

function centerMapOn(location, zoom) {
  if (!mapState.instance) {
    return;
  }

  mapState.instance.panTo({
    lat: location.latitude,
    lng: location.longitude,
  });
  mapState.instance.setZoom(zoom);
}

function revealSelection({ showDetails = false, showCard = false } = {}) {
  window.requestAnimationFrame(() => {
    if (showCard) {
      const selectedCard = stationList.querySelector(`[data-station-id="${state.selectedStationId}"]`);
      selectedCard?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }

    if (showDetails) {
      detailsPanel?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
}

function selectStation(stationId, { centerMap = false, showDetails = false, showCard = false } = {}) {
  const nextStationId = resolveSelectedStationId(stationId, latestEnrichedStations);
  if (!nextStationId || nextStationId !== stationId) {
    return;
  }

  state.selectedStationId = nextStationId;
  state.shouldCenterSelectedOnMap = centerMap;
  render();
  revealSelection({ showDetails, showCard });
}

function scheduleDemoUpdate() {
  if (!isDevPanelEnabled) {
    window.clearTimeout(demoUpdateTimerId);
    return;
  }
  window.clearTimeout(demoUpdateTimerId);
  demoUpdateTimerId = window.setTimeout(() => {
    applyDemoUpdate();
    scheduleDemoUpdate();
  }, getDemoUpdateDelayMs());
}

function applyDemoUpdate() {
  if (!stations.length) {
    return;
  }

  const station = stations[Math.floor(Math.random() * stations.length)];
  const preset = getDemoReportPreset();

  transientReports.push(
    createReportRecord({
      stationId: station.id,
      status: preset.status,
      queueLevel: preset.queueLevel,
      station,
    }),
  );

  render();
}

async function hydrateData() {
  stations = await repository.getStations();
  persistedReports = await repository.getRecentReports();
  presenceRows = await repository.getRecentPresence();
}

function getAllReports() {
  return [...transientReports, ...persistedReports];
}

function startPresenceHeartbeat() {
  if (!state.hasUserLocation) {
    updatePresenceSignalHealth({
      heartbeatStatus: "disabled",
      heartbeatReason: "الموقع غير مفعل",
    });
    return;
  }

  stopPresenceHeartbeat();
  void sendPresenceHeartbeat();
  presenceHeartbeatTimerId = window.setInterval(() => {
    void sendPresenceHeartbeat();
  }, PRESENCE_HEARTBEAT_MS);
}

function stopPresenceHeartbeat() {
  window.clearInterval(presenceHeartbeatTimerId);
  presenceHeartbeatTimerId = null;
}

async function sendPresenceHeartbeat() {
  if (!state.hasUserLocation) {
    updatePresenceSignalHealth({
      heartbeatStatus: "disabled",
      heartbeatReason: "الموقع غير مفعل",
    });
    return;
  }

  try {
    const nearestDetectedStation = findNearestStationWithinDistance(
      state.userLocation,
      stations,
      Number.POSITIVE_INFINITY,
    );
    const nearestStation = findNearestStationWithinDistance(state.userLocation, stations);
    if (!nearestStation) {
      updatePresenceSignalHealth({
        nearestStationName: nearestDetectedStation?.station.name ?? "لا توجد محطات",
        nearestStationDistanceKm: nearestDetectedStation?.distanceKm ?? null,
        heartbeatStatus: "disabled",
        heartbeatReason: "لا توجد محطة قريبة بما يكفي",
        heartbeatError: "User is farther than 200 meters from the nearest station.",
      });
      logDevPresence("nearest station", {
        station: nearestDetectedStation?.station.name ?? null,
        distanceMeters: nearestDetectedStation ? Math.round(nearestDetectedStation.distanceKm * 1000) : null,
      });
      logDevPresence("heartbeat failed reason", { reason: "no station within 200 meters" });
      presenceRows = await repository.getRecentPresence();
      render();
      return;
    }

    updatePresenceSignalHealth({
      nearestStationName: nearestStation.station.name,
      nearestStationDistanceKm: nearestStation.distanceKm,
      heartbeatStatus: "disabled",
      heartbeatReason: "جاري الإرسال",
    });
    logDevPresence("nearest station", {
      station: nearestStation.station.name,
      distanceMeters: Math.round(nearestStation.distanceKm * 1000),
    });

    const heartbeatTime = new Date().toISOString();
    const heartbeatPayload = {
      stationId: nearestStation.station.id,
      deviceId: anonymousDeviceId,
      latitude: state.userLocation.latitude,
      longitude: state.userLocation.longitude,
      distanceToStationMeters: Math.round(nearestStation.distanceKm * 1000),
      lastSeenAt: heartbeatTime,
    };
    logDevPresence("heartbeat payload", {
      table: "station_presence",
      payload: {
        station_id: heartbeatPayload.stationId,
        device_id: heartbeatPayload.deviceId,
        last_seen_at: heartbeatPayload.lastSeenAt,
        distance_to_station_meters: heartbeatPayload.distanceToStationMeters,
      },
    });
    const heartbeatResult = await repository.submitPresenceHeartbeat(
      heartbeatPayload,
      { detailedResult: isDevPanelEnabled },
    );
    const heartbeatSucceeded = isDevPanelEnabled ? heartbeatResult?.ok === true : Boolean(heartbeatResult);

    if (heartbeatSucceeded) {
      updatePresenceSignalHealth({
        lastHeartbeatAt: heartbeatTime,
        heartbeatStatus: "success",
        heartbeatReason: "تم إرسال الإشارة",
        heartbeatError: "",
      });
      logDevPresence("heartbeat sent", {
        table: "station_presence",
        station: nearestStation.station.name,
        deviceId: anonymousDeviceId,
      });
      logDevPresence("heartbeat response", {
        status: "success",
        response: isDevPanelEnabled ? heartbeatResult : "saved",
      });
    } else {
      const heartbeatError = isDevPanelEnabled
        ? heartbeatResult?.error ?? "Unknown heartbeat failure."
        : "Repository returned no saved heartbeat.";
      updatePresenceSignalHealth({
        heartbeatStatus: "failed",
        heartbeatReason: getPresenceHeartbeatFailureReason(heartbeatError),
        heartbeatError,
      });
      logDevPresence("heartbeat failed reason", {
        reason: heartbeatError,
        station: nearestStation.station.name,
      });
      logDevPresence("heartbeat response", {
        status: "error",
        error: heartbeatError,
      });
    }

    presenceRows = await repository.getRecentPresence();
    render();
  } catch (error) {
    updatePresenceSignalHealth({
      heartbeatStatus: "failed",
      heartbeatReason: "حدث خطأ أثناء إرسال الإشارة",
      heartbeatError: error?.message ?? "unknown error",
    });
    logDevPresence("heartbeat failed reason", { reason: error?.message ?? "unknown error" });
    presenceRows = [];
    render();
  }
}

async function safeHydrateData() {
  try {
    await hydrateData();
  } catch {
    stations = [...fallbackStations];
    persistedReports = [];
    presenceRows = [];
  }
}

function safeHydrateLocation() {
  try {
    hydrateLocation();
  } catch {
    state.realUserLocation = null;
    state.userLocation = fallbackTripoliLocation;
    state.hasUserLocation = false;
    state.isLocatingUser = false;
    stopPresenceHeartbeat();
    locationBanner.textContent = "لم نتمكن من تحديد موقعك، يتم عرض محطات قريبة من وسط طرابلس.";
    updatePresenceSignalHealth({
      locationSource: "fallback_tripoli_location_error",
      nearestStationName: "غير متاح",
      nearestStationDistanceKm: null,
      heartbeatStatus: "disabled",
      heartbeatReason: "تعذر تهيئة الموقع",
    });
    logDevPresence("location source", { source: "fallback_tripoli_location_error" });
    render();
  }
}

function safeStartPresenceHeartbeat() {
  try {
    startPresenceHeartbeat();
  } catch (error) {
    updatePresenceSignalHealth({
      heartbeatStatus: "failed",
      heartbeatReason: "تعذر تشغيل heartbeat",
    });
    logDevPresence("heartbeat failed reason", { reason: error?.message ?? "startup failed" });
    stopPresenceHeartbeat();
  }
}

function safeSubscribeToRealtime() {
  try {
    repository.subscribeToReportInserts(() => {
      void handleRealtimeInsert();
    });
  } catch {
    // Keep the app interactive even if realtime setup fails.
  }
}

function createSeedReport(stationId, status, queueLevel, timestamp, station) {
  return {
    id: `seed-${stationId}-${timestamp}`,
    stationId,
    status,
    queueLevel,
    createdAt: new Date(timestamp).toISOString(),
    latitude: station.latitude,
    longitude: station.longitude,
  };
}
