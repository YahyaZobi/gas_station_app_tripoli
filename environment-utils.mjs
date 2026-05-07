export function getProtocolWarning(protocol) {
  if (protocol === "file:") {
    return "شغّل التطبيق من localhost بدل فتحه مباشرة عبر file:// حتى تعمل الخريطة والموقع بشكل صحيح.";
  }

  return "";
}

export function getLocationModeConfig(runtimeEnv = import.meta.env ?? {}, browserWindow = globalThis) {
  const browserConfig = browserWindow?.BENZINA_CONFIG ?? {};
  const useFakeLocation = parseBooleanConfig(
    browserConfig.USE_FAKE_LOCATION ??
      runtimeEnv.USE_FAKE_LOCATION ??
      runtimeEnv.VITE_USE_FAKE_LOCATION ??
      browserWindow.USE_FAKE_LOCATION ??
      false,
  );
  const latitude = parseNumberConfig(
    browserConfig.FAKE_LATITUDE ??
      runtimeEnv.FAKE_LATITUDE ??
      runtimeEnv.VITE_FAKE_LATITUDE ??
      browserWindow.FAKE_LATITUDE ??
      null,
  );
  const longitude = parseNumberConfig(
    browserConfig.FAKE_LONGITUDE ??
      runtimeEnv.FAKE_LONGITUDE ??
      runtimeEnv.VITE_FAKE_LONGITUDE ??
      browserWindow.FAKE_LONGITUDE ??
      null,
  );

  const hasValidFakeLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  return {
    useFakeLocation,
    hasValidFakeLocation,
    latitude,
    longitude,
  };
}

export function getDevLocationOverrideConfig(
  runtimeEnv = import.meta.env ?? {},
  browserWindow = globalThis,
  defaults = {},
) {
  const browserConfig = browserWindow?.BENZINA_CONFIG ?? {};
  const nestedConfig = browserConfig.DEV_LOCATION_OVERRIDE ?? {};
  const enabled = parseBooleanConfig(
    nestedConfig.enabled ??
      nestedConfig.ENABLED ??
      browserConfig.DEV_LOCATION_OVERRIDE_ENABLED ??
      runtimeEnv.DEV_LOCATION_OVERRIDE_ENABLED ??
      runtimeEnv.VITE_DEV_LOCATION_OVERRIDE_ENABLED ??
      defaults.enabled ??
      false,
  );
  const latitude = parseNumberConfig(
    nestedConfig.latitude ??
      nestedConfig.lat ??
      browserConfig.DEV_LOCATION_OVERRIDE_LATITUDE ??
      runtimeEnv.DEV_LOCATION_OVERRIDE_LATITUDE ??
      runtimeEnv.VITE_DEV_LOCATION_OVERRIDE_LATITUDE ??
      defaults.latitude ??
      null,
  );
  const longitude = parseNumberConfig(
    nestedConfig.longitude ??
      nestedConfig.lng ??
      browserConfig.DEV_LOCATION_OVERRIDE_LONGITUDE ??
      runtimeEnv.DEV_LOCATION_OVERRIDE_LONGITUDE ??
      runtimeEnv.VITE_DEV_LOCATION_OVERRIDE_LONGITUDE ??
      defaults.longitude ??
      null,
  );

  return {
    enabled,
    hasValidLocation: Number.isFinite(latitude) && Number.isFinite(longitude),
    latitude,
    longitude,
  };
}

export function getDevPanelConfig(runtimeEnv = import.meta.env ?? {}, browserWindow = globalThis) {
  const browserConfig = browserWindow?.BENZINA_CONFIG ?? {};
  const enableDevPanel = parseBooleanConfig(
    browserConfig.ENABLE_DEV_PANEL ??
      runtimeEnv.ENABLE_DEV_PANEL ??
      runtimeEnv.VITE_ENABLE_DEV_PANEL ??
      browserWindow.ENABLE_DEV_PANEL ??
      false,
  );

  return {
    enableDevPanel,
  };
}

function parseBooleanConfig(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function parseNumberConfig(value) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsedValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}
