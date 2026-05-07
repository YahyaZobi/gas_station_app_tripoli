export const USAGE_ANALYTICS_STORAGE_KEY = "usageAnalytics";
export const MAX_USAGE_EVENTS = 200;

export function trackEvent(eventName, metadata = {}, {
  now = new Date(),
  storage = globalThis.localStorage,
} = {}) {
  if (!storage || !eventName) {
    return [];
  }

  const usageEvents = readUsageEvents(storage);
  const nextEvent = {
    event_name: eventName,
    timestamp: now.toISOString(),
  };

  const stationId = metadata.station_id ?? metadata.stationId;
  const stationName = metadata.station_name ?? metadata.stationName;
  const tabName = metadata.tab_name ?? metadata.tabName;

  if (stationId) {
    nextEvent.station_id = stationId;
  }
  if (stationName) {
    nextEvent.station_name = stationName;
  }
  if (tabName) {
    nextEvent.tab_name = tabName;
  }

  const nextUsageEvents = [nextEvent, ...usageEvents].slice(0, MAX_USAGE_EVENTS);

  try {
    storage.setItem(USAGE_ANALYTICS_STORAGE_KEY, JSON.stringify(nextUsageEvents));
  } catch {
    return usageEvents;
  }

  return nextUsageEvents;
}

export function readUsageEvents(storage = globalThis.localStorage) {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(USAGE_ANALYTICS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isValidUsageEvent).slice(0, MAX_USAGE_EVENTS);
  } catch {
    return [];
  }
}

export function getUsageAnalyticsSummary(storage = globalThis.localStorage) {
  const usageEvents = readUsageEvents(storage);

  return {
    stationOpenCount: countEvents(usageEvents, "station_opened_google_maps"),
    searchUsedCount: countEvents(usageEvents, "search_used"),
  };
}

function countEvents(usageEvents, eventName) {
  return usageEvents.filter((event) => event.event_name === eventName).length;
}

function isValidUsageEvent(event) {
  return Boolean(
    event
      && typeof event.event_name === "string"
      && event.timestamp
      && Number.isFinite(new Date(event.timestamp).getTime()),
  );
}
