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
