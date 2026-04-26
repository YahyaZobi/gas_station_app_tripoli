import {
  buildStationSections,
  createReportRecord,
  DEFAULT_DISCOVERY_RADIUS_KM,
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
  STATUS_META,
  formatRelativeTime,
  projectStations,
  sortStationsForDiscovery,
  sortStationsForSearch,
} from "./logic.mjs";
import { getLocationModeConfig, getProtocolWarning } from "./environment-utils.mjs";
import { buildDecisionFirstLayout } from "./home-layout-utils.mjs";
import { getGoogleMapsUrl, getLeafletMarkerClass } from "./map-utils.mjs";
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

const tripoliCenter = {
  latitude: 32.8872,
  longitude: 13.1913,
};
const EXPANDED_DISCOVERY_RADIUS_KM = 15;

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
let transientReports = [...demoSeedReports];
let presenceRows = [];

const state = {
  userLocation: tripoliCenter,
  hasUserLocation: false,
  selectedStationId: fallbackStations[0]?.id ?? null,
  shouldCenterSelectedOnMap: false,
  shouldCenterUserOnMap: false,
  didAutoFocusBestStation: false,
  activeTab: "home",
  searchQuery: "",
  selectedArea: "",
  discoveryRadiusKm: DEFAULT_DISCOVERY_RADIUS_KM,
};

const repository = createRepository({
  fallbackStations,
});

const stationMap = document.querySelector("#station-map");
const mapFocusPill = document.querySelector("#map-focus-pill");
const stationList = document.querySelector("#station-list");
const stationTitle = document.querySelector("#station-title");
const stationStatusBadge = document.querySelector("#station-status-badge");
const stationEmpty = document.querySelector("#station-empty");
const stationDetails = document.querySelector("#station-details");
const detailsPanel = document.querySelector(".details-panel");
const environmentWarning = document.querySelector("#environment-warning");
const locationBanner = document.querySelector("#location-banner");
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
  queue: document.querySelector("#station-queue"),
  updated: document.querySelector("#station-updated"),
  reports: document.querySelector("#station-reports"),
  activityLabel: document.querySelector("#station-activity-label"),
  activityCount: document.querySelector("#station-activity-count"),
};

const mapState = {
  instance: null,
  markers: [],
  userMarker: null,
  hasInitialView: false,
};

let demoUpdateTimerId = null;
let presenceHeartbeatTimerId = null;
let successToastTimerId = null;
let latestProjectedStations = [];
let hasStatusHistory = false;
let previousStationStatusById = new Map();
const anonymousDeviceId = getAnonymousDeviceId();

renderEnvironmentWarning();
await safeHydrateData();
render();
safeHydrateLocation();
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
  centerMapOn(tripoliCenter, 11);
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
  state.searchQuery = event.target.value.trim();
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
    render();
  });
});

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
  showSuccessToast(
    `${getReportSuccessMessage(
      selectedStation.name,
      updatedStation ? getDisplayStatus(updatedStation) : "",
    )} · شكراً على مساهمتك`,
  );
  render();
}

async function handleRealtimeInsert() {
  try {
    persistedReports = await repository.getRecentReports();
    presenceRows = await repository.getRecentPresence();
  } catch {
    presenceRows = [];
  }
  state.didAutoFocusBestStation = false;
  render();
  showSuccessToast("تم وصول بلاغ جديد");
}

function render() {
  const now = new Date();
  const projectedStations = projectStations(stations, getAllReports(), state.userLocation, presenceRows, now);
  projectedStations.forEach((station) => {
    console.info(
      `[Status] ${station.name} | activeDevices: ${station.activeDevices ?? 0} | final status: ${getDisplayStatus(station)}`,
    );
  });
  processStationNotifications(projectedStations, now);
  latestProjectedStations = projectedStations;
  const areaOptions = getAreaOptions(projectedStations);
  syncAreaFilter(areaOptions);

  const isSearchTab = state.activeTab === "search";
  const activeArea = isSearchTab ? state.selectedArea : "";
  const hasSearch = isSearchTab && Boolean(state.searchQuery || activeArea);
  const nearbyRadiusKm = state.discoveryRadiusKm;
  const radiusStations = projectedStations.filter((station) => station.distanceKm <= nearbyRadiusKm);
  const nearbyBaseStations = radiusStations;
  const discoveryBaseStations = isSearchTab ? projectedStations : nearbyBaseStations;
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
  const canExpandRadius = !hasSearch &&
    state.activeTab === "home" &&
    state.discoveryRadiusKm < EXPANDED_DISCOVERY_RADIUS_KM &&
    projectedStations.some(
      (station) =>
        station.distanceKm > state.discoveryRadiusKm &&
        station.distanceKm <= EXPANDED_DISCOVERY_RADIUS_KM,
    );
  const stationSections = buildStationSections(projectedStations, {
    bestCandidates: bestStationCandidates,
    listCandidates: discoveryStations,
    listLimit: 5,
  });
  const renderedStationCount =
    stationSections.recommendedStations.length +
    stationSections.nearbyStations.length +
    stationSections.avoidStations.length;

  console.info(
    `[Home] total stations loaded: ${projectedStations.length}, rendered station count: ${renderedStationCount}, best station found: ${stationSections.bestStation ? "yes" : "no"}`,
  );

  if (!projectedStations.length) {
    stationList.innerHTML = "";
    clearMapMarkers();
    ensureMap();
    centerMapOn(tripoliCenter, 11);
    mapFocusPill.textContent = "الخريطة على طرابلس";
    listEmpty.classList.remove("hidden");
    searchPrompt.classList.add("hidden");
    renderStationDetails(null);
    return;
  }

  updateMapActionButtons();
  syncActiveTabUi();

  if (stationSections.bestStation && !state.didAutoFocusBestStation) {
    state.selectedStationId = stationSections.bestStation.id;
    state.shouldCenterSelectedOnMap = true;
    state.didAutoFocusBestStation = true;
  } else {
    state.selectedStationId = resolveSelectedStationId(state.selectedStationId, projectedStations);
  }

  renderStationList({
    stationSections,
    searchResults: searchedStations,
    hasSearch,
    canExpandRadius,
  });
  renderStationDetails(projectedStations.find((station) => station.id === state.selectedStationId));
}

function renderMap(projectedStations, bestStation) {
  ensureMap();

  if (!mapState.instance) {
    return;
  }

  mapState.instance.invalidateSize(false);
  syncMapMarkers(projectedStations, bestStation);

  if (!mapState.hasInitialView) {
    centerMapOn(tripoliCenter, 11);
    mapState.hasInitialView = true;
  }

  const selectedStation =
    projectedStations.find((station) => station.id === state.selectedStationId) ??
    projectedStations[0];

  if (!selectedStation) {
    centerMapOn(state.userLocation, 11);
    mapFocusPill.textContent = "الخريطة على طرابلس";
    return;
  }

  syncUserMarker();

  if (state.shouldCenterUserOnMap) {
    centerMapOn(state.userLocation, 12);
    state.shouldCenterUserOnMap = false;
  }

  if (state.shouldCenterSelectedOnMap) {
    centerMapOn(selectedStation, 13);
    state.shouldCenterSelectedOnMap = false;
  }

  mapFocusPill.textContent = `${selectedStation.name} · ${getDisplayStatus(selectedStation)}`;
}

function renderStationList({ stationSections, searchResults, hasSearch, canExpandRadius = false }) {
  stationList.innerHTML = "";
  searchPrompt.classList.add("hidden");
  const template = document.querySelector("#station-card-template");
  const { bestStation, recommendedStations, nearbyStations, avoidStations } = stationSections;

  if (state.activeTab === "account") {
    renderAccountScreen();
    listEmpty.classList.add("hidden");
    showMoreButton.classList.add("hidden");
    return;
  }

  if (state.activeTab === "search") {
    renderSearchResults({
      stations: searchResults,
      hasSearch,
      template,
    });
    showMoreButton.classList.add("hidden");
    return;
  }

  const layout = buildDecisionFirstLayout({
    bestStation,
    backupStation: stationSections.backupStation,
    recommendedStations,
    nearbyStations,
    avoidStations,
  }, 3);
  if (!layout.nearbyVisible.length && !layout.heroStation) {
    layout.nearbyVisible = [...recommendedStations, ...nearbyStations, ...avoidStations].slice(0, 5);
  }

  const totalVisibleStations =
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
    stationList.append(
      createSectionBlock({
        title: "محطات قريبة أخرى",
        tone: "nearby",
        stations: layout.nearbyVisible,
        template,
        variant: "compact",
      }),
    );
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
    const queue = fragment.querySelector(".queue-pill");
    const updated = fragment.querySelector(".station-card-updated");
    const reports = fragment.querySelector(".station-card-reports");
    const activity = fragment.querySelector(".station-card-activity");
    const mapsAction = fragment.querySelector("[data-station-action='maps']");

    title.textContent = station.name;
    const displayStatus = getDisplayStatus(station);
    status.textContent = displayStatus;
    status.classList.add(`station-card-status-${getDisplayStatusTone(displayStatus)}`);
    distance.textContent = formatDistanceLabel(station.distanceKm);
    queue.textContent = getDriverFlowLabel(station);
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
  const card = createStationCardElement(station, "recommended", "hero");
  const displayStatus = getDisplayStatus(station);
  card.className = "station-card best-station-card hero-card";
  card.innerHTML = `
    <div class="best-station-burst" aria-hidden="true"></div>
    <div class="best-station-body">
      <div class="best-station-copy">
        <span class="best-station-label badge-best">👑 الأفضل الآن</span>
        <h3 class="best-station-title title"></h3>
        <p class="station-card-status status-pill"></p>
        ${createMetaRowMarkup("best-station-meta meta-row")}
      </div>
      <div class="best-station-icon icon-wrapper station-icon-wrap" aria-hidden="true">
        <img src="/assets/gas-station.png" class="station-icon-img hero-icon" alt="" aria-hidden="true" />
      </div>
    </div>
    <button type="button" class="best-station-cta cta-button station-card-action-map" data-station-action="maps" aria-label="افتح في خرائط Google">
      <span>افتح في خرائط Google</span>
      <span class="station-card-action-icon" aria-hidden="true">⌖</span>
    </button>
    ${createFavoriteActionMarkup(station)}
  `;

  card.querySelector(".best-station-title").textContent = station.name;
  fillStatus(card.querySelector(".station-card-status"), displayStatus);
  fillMetaRow(card, station);
  return card;
}

function createReferenceBackupCard(station) {
  const card = createStationCardElement(station, "backup", "backup");
  const displayStatus = getDisplayStatus(station);
  card.className = "station-card backup-station-card";
  card.innerHTML = `
    <div class="backup-station-copy">
      <span class="backup-station-label">⭐ الخيار الثاني</span>
      <h3 class="backup-station-title"></h3>
      <p class="station-card-status"></p>
      ${createMetaRowMarkup("backup-station-meta")}
    </div>
    <div class="backup-station-icon station-icon-wrap" aria-hidden="true">
      ${createFuelIconMarkup()}
    </div>
    <button type="button" class="station-card-row-action station-card-action-map" data-station-action="maps" aria-label="افتح في خرائط Google">
      ${createChevronIconMarkup()}
    </button>
    ${createFavoriteActionMarkup(station)}
  `;

  card.querySelector(".backup-station-title").textContent = station.name;
  fillStatus(card.querySelector(".station-card-status"), displayStatus);
  fillMetaRow(card, station);
  return card;
}

function createReferenceListCard(station, tone) {
  const card = createStationCardElement(station, tone, "compact");
  const displayStatus = getDisplayStatus(station);
  card.className = "station-card nearby-station-row";
  card.innerHTML = `
    <div class="nearby-station-icon station-icon-wrap" aria-hidden="true">
      ${createFuelIconMarkup()}
    </div>
    <div class="nearby-station-copy">
      <h3 class="nearby-station-title"></h3>
      <p class="station-card-status"></p>
      ${createMetaRowMarkup("nearby-station-meta")}
    </div>
    <button type="button" class="station-card-row-action station-card-action-map" data-station-action="maps" aria-label="افتح في خرائط Google">
      ${createChevronIconMarkup()}
    </button>
    ${createFavoriteActionMarkup(station)}
  `;

  card.querySelector(".nearby-station-title").textContent = station.name;
  fillStatus(card.querySelector(".station-card-status"), displayStatus);
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
  card.querySelector("[data-card-distance]").textContent = formatDistanceLabel(station.distanceKm);
  card.querySelector("[data-card-updated]").textContent = getStationUpdatedText(station);
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

function createFuelIconMarkup() {
  return `<img src="/assets/gas-station.png" class="station-icon-img" alt="" aria-hidden="true" />`;
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
    return "busy";
  }

  return "no_fuel";
}

function updateMapActionButtons() {
  recenterUserButton.disabled = !state.hasUserLocation;
}

function renderStationDetails(station) {
  if (!station) {
    stationEmpty.classList.remove("hidden");
    stationDetails.classList.add("hidden");
    stationTitle.textContent = "اختر محطة";
    stationStatusBadge.textContent = "مسكر";
    stationStatusBadge.className = "status-badge status-unknown";
    openReportModalButton.disabled = true;
    reportAccessMessage.textContent = "";
    return;
  }

  stationEmpty.classList.add("hidden");
  stationDetails.classList.remove("hidden");

  stationTitle.textContent = station.name;
  stationStatusBadge.textContent = getDisplayStatus(station);
  stationStatusBadge.className = `status-badge ${STATUS_META[station.status].className}`;

  detailsFields.distance.textContent = formatDistanceLabel(station.distanceKm);
  detailsFields.queue.textContent = getDriverFlowLabel(station);
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
  const isSearchTab = state.activeTab === "search";
  const isAccountTab = state.activeTab === "account";

  screenTitle.textContent = isAccountTab ? "حسابي" : isSearchTab ? "البحث" : "أقرب المحطات";
  screenSubtitle.textContent = isAccountTab
    ? "إعدادات بسيطة للنموذج الأولي"
    : isSearchTab
      ? "ابحث عن المحطة أو المنطقة المناسبة"
      : "اختر المحطة المناسبة وافتحها في خرائط Google";
  listPanelHeading.classList.toggle("hidden", !isSearchTab && !isAccountTab);
  homeInfoNotice.classList.toggle("hidden", isSearchTab || isAccountTab);

  searchToolbar.classList.toggle("hidden", !isSearchTab);
  if (!isSearchTab) {
    searchPrompt.classList.add("hidden");
  }

  bottomNavItems.forEach((item) => {
    const isActive = item.dataset.tab === state.activeTab;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-current", isActive ? "page" : "false");
  });

  if (bottomNav) {
    bottomNav.dataset.activeTab = state.activeTab;
  }
}

function toggleStationFavorite(stationId) {
  const station = latestProjectedStations.find((item) => item.id === stationId)
    ?? stations.find((item) => item.id === stationId);
  if (!station) {
    return;
  }

  const { isFavorite } = toggleFavoriteStation(station);
  showSuccessToast(isFavorite ? "تم حفظ المحطة" : "تم إزالة المحطة من المفضلة");
  render();
}

function openStationInGoogleMaps(stationId) {
  const station = latestProjectedStations.find((item) => item.id === stationId)
    ?? stations.find((item) => item.id === stationId);
  if (!station) {
    return;
  }

  saveRecentStation(station);
  window.open(getGoogleMapsUrl(station), "_blank", "noopener");
  showSuccessToast("تم فتح الخريطة. رحلة موفقة");
}

function hydrateLocation() {
  const locationModeConfig = getLocationModeConfig();

  if (locationModeConfig.useFakeLocation) {
    if (locationModeConfig.hasValidFakeLocation) {
      state.userLocation = {
        latitude: locationModeConfig.latitude,
        longitude: locationModeConfig.longitude,
      };
      state.hasUserLocation = true;
      state.shouldCenterUserOnMap = true;
      state.didAutoFocusBestStation = false;
      locationBanner.textContent = "وضع الاختبار: يتم استخدام موقع وهمي";
      safeStartPresenceHeartbeat();
      render();
      return;
    }

    state.userLocation = tripoliCenter;
    state.hasUserLocation = false;
    stopPresenceHeartbeat();
    locationBanner.textContent = "وضع الاختبار: الإحداثيات الوهمية غير صالحة، يتم استخدام وسط طرابلس.";
    render();
    return;
  }

  if (window.location.protocol === "file:") {
    state.hasUserLocation = false;
    stopPresenceHeartbeat();
    locationBanner.textContent = "شغّل التطبيق من localhost حتى يعمل طلب الموقع في المتصفح.";
    render();
    return;
  }

  if (!("geolocation" in navigator)) {
    stopPresenceHeartbeat();
    locationBanner.textContent = "الموقع غير متاح في هذا المتصفح. يتم استخدام وسط طرابلس كموقع افتراضي.";
    render();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      state.hasUserLocation = true;
      state.shouldCenterUserOnMap = true;
      state.didAutoFocusBestStation = false;
      locationBanner.textContent = "تم تحديد موقعك الحالي. يتم ترتيب المحطات وعرض موقعك على الخريطة.";
      safeStartPresenceHeartbeat();
      render();
    },
    () => {
      state.hasUserLocation = false;
      stopPresenceHeartbeat();
      locationBanner.textContent = "تم رفض إذن الموقع. يتم استخدام وسط طرابلس كموقع افتراضي.";
      render();
    },
    {
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 300000,
    },
  );
}

function getSelectedStation() {
  return stations.find((station) => station.id === state.selectedStationId) ?? null;
}

function openReportModal() {
  const selectedStation = getSelectedStation();
  if (!selectedStation) {
    return;
  }

  reportModalStationName.textContent = selectedStation.name;
  reportForm.reset();
  reportForm.elements.status.value = "available";
  reportForm.elements.queueLevel.value = "short";
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

function getDriverTrustLabel(station) {
  if (station.confidenceLevel === "high") {
    return "واضحة";
  }

  if (station.confidenceLevel === "medium") {
    return "مقبولة";
  }

  return "خفيفة";
}

function processStationNotifications(projectedStations, now = new Date()) {
  const nextStatusById = new Map(projectedStations.map((station) => [station.id, station.status]));

  if (!hasStatusHistory) {
    previousStationStatusById = nextStatusById;
    hasStatusHistory = true;
    return;
  }

  projectedStations.forEach((station) => {
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

function ensureMap() {
  if (mapState.instance) {
    return;
  }

  const leaflet = window.L;
  if (!leaflet || !stationMap) {
    mapFocusPill.textContent = "تعذر تحميل الخريطة الآن";
    return;
  }

  mapState.instance = leaflet.map(stationMap, {
    center: [tripoliCenter.latitude, tripoliCenter.longitude],
    zoom: 11,
    zoomControl: true,
  });

  leaflet
    .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    .addTo(mapState.instance);
}

function syncUserMarker() {
  if (!mapState.instance) {
    return;
  }

  if (!state.hasUserLocation) {
    mapState.userMarker?.remove();
    mapState.userMarker = null;
    return;
  }

  if (!mapState.userMarker) {
    mapState.userMarker = window.L.circleMarker(
      [state.userLocation.latitude, state.userLocation.longitude],
      {
        radius: 8,
        color: "#ffffff",
        weight: 3,
        fillColor: "#1f7aec",
        fillOpacity: 1,
      },
    )
      .bindTooltip("موقعك الحالي", {
        direction: "top",
        offset: [0, -10],
      })
      .addTo(mapState.instance);
    return;
  }

  mapState.userMarker.setLatLng([state.userLocation.latitude, state.userLocation.longitude]);
}

function syncMapMarkers(projectedStations, bestStation) {
  if (!mapState.instance) {
    return;
  }

  clearMapMarkers();

  projectedStations.forEach((station) => {
    const markerEmphasis = bestStation?.id === station.id ? "best" : "dim";
    const marker = window.L.marker([station.latitude, station.longitude], {
      icon: window.L.divIcon({
        className: getLeafletMarkerClass(
          station.status,
          station.id === state.selectedStationId,
          markerEmphasis,
        ),
        html: "<span></span>",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      keyboard: false,
    }).addTo(mapState.instance);

    marker.on("click", () => {
      selectStation(station.id, {
        centerMap: true,
        showDetails: true,
        showCard: true,
      });
    });

    mapState.markers.push(marker);
  });
}

function clearMapMarkers() {
  mapState.markers.forEach((marker) => marker.remove());
  mapState.markers = [];
}

function centerMapOn(location, zoom) {
  if (!mapState.instance) {
    return;
  }

  mapState.instance.flyTo([location.latitude, location.longitude], zoom, {
    animate: true,
    duration: 0.7,
  });
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
  const nextStationId = resolveSelectedStationId(stationId, latestProjectedStations);
  if (!nextStationId || nextStationId !== stationId) {
    return;
  }

  state.selectedStationId = nextStationId;
  state.shouldCenterSelectedOnMap = centerMap;
  render();
  revealSelection({ showDetails, showCard });
}

function scheduleDemoUpdate() {
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
    return;
  }

  try {
    const nearestStation = findNearestStationWithinDistance(state.userLocation, stations);
    if (!nearestStation) {
      presenceRows = await repository.getRecentPresence();
      render();
      return;
    }

    await repository.submitPresenceHeartbeat({
      stationId: nearestStation.station.id,
      deviceId: anonymousDeviceId,
      latitude: state.userLocation.latitude,
      longitude: state.userLocation.longitude,
      distanceToStationMeters: Math.round(nearestStation.distanceKm * 1000),
      lastSeenAt: new Date().toISOString(),
    });
    presenceRows = await repository.getRecentPresence();
    render();
  } catch {
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
    state.userLocation = tripoliCenter;
    state.hasUserLocation = false;
    stopPresenceHeartbeat();
    locationBanner.textContent = "تعذر تهيئة الموقع الآن. يتم استخدام وسط طرابلس.";
    render();
  }
}

function safeStartPresenceHeartbeat() {
  try {
    startPresenceHeartbeat();
  } catch {
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
