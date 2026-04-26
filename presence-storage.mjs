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
  return `device-${crypto.randomUUID()}`;
}
