import { appendStoredReport, readStoredReports } from "./report-storage.mjs";
import { createSupabaseClient } from "./supabaseClient.mjs";

function getReportKey(report) {
  if (report?.id) {
    return `id:${report.id}`;
  }

  return [
    report?.stationId ?? "",
    report?.status ?? "",
    report?.queueLevel ?? "",
    report?.createdAt ?? "",
  ].join("|");
}

function mergeReports(primaryReports, secondaryReports) {
  const mergedReports = [];
  const seenKeys = new Set();

  [primaryReports, secondaryReports].forEach((reports) => {
    reports.forEach((report) => {
      const reportKey = getReportKey(report);
      if (seenKeys.has(reportKey)) {
        return;
      }

      seenKeys.add(reportKey);
      mergedReports.push(report);
    });
  });

  return mergedReports.sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function normalizeLogger(logger = console) {
  return {
    info: typeof logger?.info === "function" ? logger.info.bind(logger) : () => {},
    warn: typeof logger?.warn === "function" ? logger.warn.bind(logger) : () => {},
  };
}

export function createRepository({
  storage = globalThis.localStorage,
  supabaseClient = createSupabaseClient(),
  fallbackStations = [],
  nowFactory = () => new Date(),
  logger = console,
} = {}) {
  const log = normalizeLogger(logger);

  return {
    async getStations() {
      if (!supabaseClient.isConfigured) {
        log.warn("[Repository] Using local station data. Reason: Supabase config missing.");
        return fallbackStations;
      }

      try {
        const rows = await supabaseClient.select(
          "stations",
          "select=id,name,latitude,longitude,is_active&is_active=eq.true&order=name.asc",
        );

        if (!Array.isArray(rows) || rows.length === 0) {
          log.warn("[Repository] Using local station data. Reason: Supabase returned no stations.");
          return fallbackStations;
        }

        const stations = rows.map((row) => ({
          id: row.id,
          name: row.name,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
        }));

        log.info(`[Repository] Stations fetch succeeded. Count: ${stations.length}.`);
        return stations;
      } catch {
        log.warn("[Repository] Using local station data. Reason: Supabase stations fetch failed.");
        return fallbackStations;
      }
    },

    async getRecentReports() {
      const localReports = readStoredReports(storage, nowFactory());

      if (!supabaseClient.isConfigured) {
        log.warn("[Repository] Using local reports. Reason: Supabase config missing.");
        return localReports;
      }

      try {
        const cutoff = new Date(nowFactory().getTime() - 60 * 60000).toISOString();
        const rows = await supabaseClient.select(
          "reports",
          `select=id,station_id,fuel_status,queue_level,reported_at,station_latitude,station_longitude,user_latitude,user_longitude&reported_at=gte.${encodeURIComponent(cutoff)}&order=reported_at.desc`,
        );

        const remoteReports = Array.isArray(rows)
          ? rows.map((row) => ({
              id: row.id,
              stationId: row.station_id,
              status: row.fuel_status,
              queueLevel: row.queue_level,
              createdAt: row.reported_at,
              latitude: Number(row.station_latitude),
              longitude: Number(row.station_longitude),
              userLatitude: row.user_latitude == null ? null : Number(row.user_latitude),
              userLongitude: row.user_longitude == null ? null : Number(row.user_longitude),
            }))
          : [];

        const mergedReports = mergeReports(remoteReports, localReports);
        log.info(
          `[Repository] Reports fetch succeeded. Remote count: ${remoteReports.length}. Total active count: ${mergedReports.length}.`,
        );
        return mergedReports;
      } catch {
        log.warn("[Repository] Using local reports. Reason: Supabase reports fetch failed.");
        return localReports;
      }
    },

    async submitReport(report, userLocation = null) {
      appendStoredReport(storage, report, nowFactory());

      if (!supabaseClient.isConfigured) {
        log.warn("[Repository] Report saved to local storage only. Reason: Supabase config missing.");
        return report;
      }

      try {
        const [insertedRow] = await supabaseClient.insert("reports", {
          station_id: report.stationId,
          fuel_status: report.status,
          queue_level: report.queueLevel,
          reported_at: report.createdAt,
          station_latitude: report.latitude,
          station_longitude: report.longitude,
          user_latitude: userLocation?.latitude ?? null,
          user_longitude: userLocation?.longitude ?? null,
        });

        log.info("[Repository] Report submit succeeded in Supabase.");
        return insertedRow ?? report;
      } catch {
        log.warn("[Repository] Report saved to local storage. Reason: Supabase submit failed.");
        return report;
      }
    },
    subscribeToReportInserts(onInsert) {
      if (typeof supabaseClient.subscribeToReportInserts !== "function") {
        log.warn("[Repository] Realtime disabled. Reason: Supabase client has no realtime support.");
        return () => {};
      }

      return supabaseClient.subscribeToReportInserts((insertedReport) => {
        log.info("[Repository] Realtime insert received for reports table.");
        onInsert(insertedReport);
      });
    },
    async getRecentPresence() {
      if (!supabaseClient.isConfigured) {
        log.warn("[Repository] Presence disabled. Reason: Supabase config missing.");
        return [];
      }

      try {
        const cutoff = new Date(nowFactory().getTime() - 60 * 60000).toISOString();
        const rows = await supabaseClient.select(
          "station_presence",
          `select=station_id,device_id,last_seen_at,distance_to_station_meters&last_seen_at=gte.${encodeURIComponent(cutoff)}`,
        );

        const presenceRows = Array.isArray(rows)
          ? rows.map((row) => ({
              stationId: row.station_id,
              deviceId: row.device_id,
              lastSeenAt: row.last_seen_at,
              distanceToStationMeters: Number(row.distance_to_station_meters),
            }))
          : [];

        log.info(`[Repository] Presence fetch succeeded. Active rows: ${presenceRows.length}.`);
        return presenceRows;
      } catch {
        log.warn("[Repository] Presence disabled. Reason: Supabase presence fetch failed.");
        return [];
      }
    },
    async submitPresenceHeartbeat({ stationId, deviceId, latitude, longitude, distanceToStationMeters, lastSeenAt }) {
      if (!supabaseClient.isConfigured) {
        log.warn("[Repository] Presence heartbeat skipped. Reason: Supabase config missing.");
        return null;
      }

      try {
        const [row] = await supabaseClient.upsert(
          "station_presence",
          {
            station_id: stationId,
            device_id: deviceId,
            latitude,
            longitude,
            distance_to_station_meters: distanceToStationMeters,
            last_seen_at: lastSeenAt,
          },
          ["station_id", "device_id"],
        );

        log.info("[Repository] Presence heartbeat saved.");
        return row ?? null;
      } catch {
        log.warn("[Repository] Presence heartbeat skipped. Reason: Supabase presence submit failed.");
        return null;
      }
    },
  };
}
