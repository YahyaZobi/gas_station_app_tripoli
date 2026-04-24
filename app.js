import {
  createReportRecord,
  formatDistanceLabel,
  getDemoReportPreset,
  getDemoUpdateDelayMs,
  getReportEligibility,
  getReportSuccessMessage,
  STATUS_META,
  QUEUE_LABELS,
  formatRelativeTime,
  projectStations,
} from "./logic.mjs";
import { filterStationsForList } from "./list-utils.mjs";
import { getProtocolWarning } from "./environment-utils.mjs";
import { getLeafletMarkerClass } from "./map-utils.mjs";

const tripoliCenter = {
  latitude: 32.8872,
  longitude: 13.1913,
};

const stations = [
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
const reports = [
  createSeedReport("station-1", "available", "short", now - 8 * 60000, stations[0]),
  createSeedReport("station-1", "available", "medium", now - 20 * 60000, stations[0]),
  createSeedReport("station-2", "available", "long", now - 12 * 60000, stations[1]),
  createSeedReport("station-3", "no_fuel", "long", now - 10 * 60000, stations[2]),
  createSeedReport("station-3", "available", "medium", now - 55 * 60000, stations[2]),
  createSeedReport("station-4", "available", "medium", now - 18 * 60000, stations[3]),
  createSeedReport("station-4", "available", "long", now - 6 * 60000, stations[3]),
  createSeedReport("station-6", "available", "short", now - 80 * 60000, stations[5]),
];

const state = {
  userLocation: tripoliCenter,
  hasUserLocation: false,
  selectedStationId: stations[0]?.id ?? null,
  shouldCenterSelectedOnMap: false,
  shouldCenterUserOnMap: false,
  listFilterStatus: "all",
};

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
const listSummary = document.querySelector("#list-summary");
const listEmpty = document.querySelector("#list-empty");
const listFilters = document.querySelector("#list-filters");
const openReportModalButton = document.querySelector("#open-report-modal-button");
const reportModalBackdrop = document.querySelector("#report-modal-backdrop");
const closeReportModalButton = document.querySelector("#close-report-modal-button");
const recenterUserButton = document.querySelector("#recenter-user-button");
const recenterTripoliButton = document.querySelector("#recenter-tripoli-button");
const reportModalStationName = document.querySelector("#report-modal-station-name");
const reportForm = document.querySelector("#report-form");
const reportSuccessToast = document.querySelector("#report-success-toast");
const reportAccessMessage = document.querySelector("#report-access-message");

const detailsFields = {
  distance: document.querySelector("#station-distance"),
  queue: document.querySelector("#station-queue"),
  updated: document.querySelector("#station-updated"),
  reports: document.querySelector("#station-reports"),
};

const arabicNumberFormatter = new Intl.NumberFormat("ar-LY", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const mapState = {
  instance: null,
  markers: [],
  userMarker: null,
  hasInitialView: false,
};

let demoUpdateTimerId = null;
let successToastTimerId = null;

renderEnvironmentWarning();
render();
hydrateLocation();
scheduleDemoUpdate();

listFilters.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-filter-status]");
  if (!filterButton) {
    return;
  }

  state.listFilterStatus = filterButton.dataset.filterStatus ?? "all";
  render();
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
  event.preventDefault();

  const selectedStation = getSelectedStation();
  if (!selectedStation) {
    return;
  }

  const reportEligibility = getReportEligibility({
    userLocation: state.userLocation,
    station: selectedStation,
    hasUserLocation: state.hasUserLocation,
  });

  if (!reportEligibility.canSubmit) {
    reportAccessMessage.textContent = reportEligibility.message;
    return;
  }

  const formData = new FormData(reportForm);
  reports.push(
    createReportRecord({
      stationId: selectedStation.id,
      status: formData.get("status"),
      queueLevel: formData.get("queueLevel"),
      station: selectedStation,
    }),
  );

  const updatedStation = projectStations(stations, reports, state.userLocation, new Date()).find(
    (station) => station.id === selectedStation.id,
  );

  closeReportModal();
  showSuccessToast(
    getReportSuccessMessage(
      selectedStation.name,
      updatedStation ? STATUS_META[updatedStation.status].label : "",
    ),
  );
  render();
});

function render() {
  const projectedStations = projectStations(stations, reports, state.userLocation, new Date());
  const filteredStations = filterStationsForList(projectedStations, state.listFilterStatus);

  if (!projectedStations.length) {
    stationList.innerHTML = "";
    clearMapMarkers();
    ensureMap();
    centerMapOn(tripoliCenter, 11);
    mapFocusPill.textContent = "الخريطة على طرابلس";
    listSummary.textContent = "لا توجد محطات محملة.";
    listEmpty.classList.remove("hidden");
    renderStationDetails(null);
    return;
  }

  updateFilterChips();
  updateMapActionButtons();
  listSummary.textContent = getListSummaryText(filteredStations.length, projectedStations.length);

  if (!projectedStations.some((station) => station.id === state.selectedStationId)) {
    state.selectedStationId = projectedStations[0].id;
  }

  renderMap(projectedStations);
  renderStationList(filteredStations);
  renderStationDetails(projectedStations.find((station) => station.id === state.selectedStationId));
}

function renderMap(projectedStations) {
  ensureMap();

  if (!mapState.instance) {
    return;
  }

  mapState.instance.invalidateSize(false);
  syncMapMarkers(projectedStations);

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

  mapFocusPill.textContent = `${selectedStation.name} · ${STATUS_META[selectedStation.status].label}`;
}

function renderStationList(projectedStations) {
  stationList.innerHTML = "";
  const template = document.querySelector("#station-card-template");

  if (!projectedStations.length) {
    listEmpty.textContent = "لا توجد محطات ضمن هذا التصنيف حالياً.";
    listEmpty.classList.remove("hidden");
    return;
  }

  listEmpty.textContent = "لا توجد محطات متاحة حالياً.";
  listEmpty.classList.add("hidden");

  projectedStations.forEach((station) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".station-card");
    const title = fragment.querySelector(".station-card-title");
    const distance = fragment.querySelector(".station-card-distance");
    const badge = fragment.querySelector(".status-badge");
    const queue = fragment.querySelector(".queue-pill");
    const updated = fragment.querySelector(".station-card-updated");

    title.textContent = station.name;
    distance.textContent = formatDistanceLabel(station.distanceKm);
    badge.textContent = STATUS_META[station.status].label;
    badge.classList.add(STATUS_META[station.status].className);
    queue.textContent = `الزحمة: ${QUEUE_LABELS[station.queueLevel]}`;
    updated.textContent = formatRelativeTime(station.lastUpdated);
    card.dataset.stationId = station.id;

    if (station.id === state.selectedStationId) {
      card.classList.add("station-card-active");
    }

    card.addEventListener("click", () => {
      state.selectedStationId = station.id;
      state.shouldCenterSelectedOnMap = true;
      render();
      revealSelection({ showDetails: true, showCard: false });
    });

    stationList.append(fragment);
  });
}

function updateFilterChips() {
  listFilters.querySelectorAll("[data-filter-status]").forEach((button) => {
    const isActive = button.dataset.filterStatus === state.listFilterStatus;
    button.classList.toggle("filter-chip-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function getListSummaryText(filteredCount, totalCount) {
  if (filteredCount === totalCount) {
    return `${formatArabicNumber(totalCount)} محطة مرتبة حسب القرب`;
  }

  return `${formatArabicNumber(filteredCount)} من أصل ${formatArabicNumber(totalCount)} محطة`;
}

function updateMapActionButtons() {
  recenterUserButton.disabled = !state.hasUserLocation;
}

function renderStationDetails(station) {
  if (!station) {
    stationEmpty.classList.remove("hidden");
    stationDetails.classList.add("hidden");
    stationTitle.textContent = "اختر محطة";
    stationStatusBadge.textContent = "غير معروف";
    stationStatusBadge.className = "status-badge status-unknown";
    openReportModalButton.disabled = true;
    reportAccessMessage.textContent = "";
    return;
  }

  stationEmpty.classList.add("hidden");
  stationDetails.classList.remove("hidden");

  stationTitle.textContent = station.name;
  stationStatusBadge.textContent = STATUS_META[station.status].label;
  stationStatusBadge.className = `status-badge ${STATUS_META[station.status].className}`;

  detailsFields.distance.textContent = formatDistanceLabel(station.distanceKm);
  detailsFields.queue.textContent = QUEUE_LABELS[station.queueLevel];
  detailsFields.updated.textContent = formatRelativeTime(station.lastUpdated);
  detailsFields.reports.textContent =
    `${formatArabicNumber(station.recentReportsCount)} خلال آخر ٦٠ دقيقة`;

  const reportEligibility = getReportEligibility({
    userLocation: state.userLocation,
    station,
    hasUserLocation: state.hasUserLocation,
  });

  openReportModalButton.disabled = !reportEligibility.canSubmit;
  reportAccessMessage.textContent = reportEligibility.message;
}

function hydrateLocation() {
  if (window.location.protocol === "file:") {
    state.hasUserLocation = false;
    locationBanner.textContent = "شغّل التطبيق من localhost حتى يعمل طلب الموقع في المتصفح.";
    render();
    return;
  }

  if (!("geolocation" in navigator)) {
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
      locationBanner.textContent = "تم تحديد موقعك الحالي. يتم ترتيب المحطات وعرض موقعك على الخريطة.";
      render();
    },
    () => {
      state.hasUserLocation = false;
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

  const reportEligibility = getReportEligibility({
    userLocation: state.userLocation,
    station: selectedStation,
    hasUserLocation: state.hasUserLocation,
  });

  if (!reportEligibility.canSubmit) {
    reportAccessMessage.textContent = reportEligibility.message;
    return;
  }

  reportModalStationName.textContent = selectedStation.name;
  reportForm.reset();
  reportForm.elements.status.value = "available";
  reportForm.elements.queueLevel.value = "short";
  reportModalBackdrop.classList.remove("hidden");
  document.body.classList.add("modal-open");
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

function formatArabicNumber(value) {
  return arabicNumberFormatter.format(value);
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

function syncMapMarkers(projectedStations) {
  if (!mapState.instance) {
    return;
  }

  clearMapMarkers();

  projectedStations.forEach((station) => {
    const marker = window.L.marker([station.latitude, station.longitude], {
      icon: window.L.divIcon({
        className: getLeafletMarkerClass(
          station.status,
          station.id === state.selectedStationId,
        ),
        html: "<span></span>",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      keyboard: false,
    }).addTo(mapState.instance);

    marker.on("click", () => {
      state.selectedStationId = station.id;
      state.shouldCenterSelectedOnMap = true;
      render();
      revealSelection({ showDetails: true, showCard: true });
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

  reports.push(
    createReportRecord({
      stationId: station.id,
      status: preset.status,
      queueLevel: preset.queueLevel,
      station,
    }),
  );

  render();
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
