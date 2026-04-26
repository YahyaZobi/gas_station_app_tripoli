export const STATION_NOTIFICATION_COOLDOWN_MINUTES = 30;
export const STATION_NOTIFICATION_STORAGE_KEY = "shale_station_notifications";

export function getStationAvailabilityNotificationMessage(station) {
  return `محطة ${station.name} رجعت تخدم الآن`;
}

export function shouldNotifyAvailabilityChange(previousStatus, nextStatus) {
  return nextStatus === "available" && (previousStatus === "no_fuel" || previousStatus === "busy");
}

export function canNotifyStation(stationId, now = new Date(), storage = globalThis.localStorage) {
  if (!stationId) {
    return false;
  }

  const notificationState = readNotificationState(storage);
  const lastNotifiedAt = notificationState[stationId];
  if (!lastNotifiedAt) {
    return true;
  }

  const diffMinutes = (now.getTime() - new Date(lastNotifiedAt).getTime()) / 60000;
  return diffMinutes >= STATION_NOTIFICATION_COOLDOWN_MINUTES;
}

export function markStationNotified(stationId, now = new Date(), storage = globalThis.localStorage) {
  if (!stationId) {
    return;
  }

  const notificationState = readNotificationState(storage);
  notificationState[stationId] = now.toISOString();
  writeNotificationState(notificationState, storage);
}

export function notifyUser(
  station,
  message,
  {
    notificationApi = globalThis.Notification,
    showToast = () => {},
  } = {},
) {
  if (notificationApi?.permission === "granted") {
    new notificationApi(message);
    return "browser";
  }

  showToast(message, station);
  return "toast";
}

function readNotificationState(storage = globalThis.localStorage) {
  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(STATION_NOTIFICATION_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

function writeNotificationState(notificationState, storage = globalThis.localStorage) {
  if (!storage) {
    return;
  }

  storage.setItem(STATION_NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationState));
}
