export const DEVICE_ID_STORAGE_KEY = "shale_device_id";

export function getAnonymousDeviceId(storage = globalThis.localStorage) {
  if (!storage) {
    return createAnonymousDeviceId();
  }

  const existingDeviceId = storage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId = createAnonymousDeviceId();
  storage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId);
  return nextDeviceId;
}

function createAnonymousDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `device-${crypto.randomUUID()}`;
  }
  // Fallback for iOS <15.4 / older Safari
  const rand = () => Math.random().toString(36).slice(2);
  return `device-${rand()}${rand()}${rand()}`;
}
