import { isReportRecent } from "./logic.mjs";

export const REPORTS_STORAGE_KEY = "benzina_reports";

export function filterRecentReports(reports, now = new Date()) {
  if (!Array.isArray(reports)) {
    return [];
  }

  return reports.filter((report) => {
    return (
      report &&
      typeof report.stationId === "string" &&
      typeof report.status === "string" &&
      typeof report.queueLevel === "string" &&
      typeof report.createdAt === "string" &&
      isReportRecent(report, now)
    );
  });
}

export function readStoredReports(storage, now = new Date()) {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(REPORTS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);
    const recentReports = filterRecentReports(parsedValue, now);

    if (recentReports.length !== parsedValue.length) {
      writeStoredReports(storage, recentReports, now);
    }

    return recentReports;
  } catch {
    storage.removeItem(REPORTS_STORAGE_KEY);
    return [];
  }
}

export function writeStoredReports(storage, reports, now = new Date()) {
  if (!storage) {
    return [];
  }

  const recentReports = filterRecentReports(reports, now);
  storage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(recentReports));
  return recentReports;
}

export function appendStoredReport(storage, report, now = new Date()) {
  const reports = readStoredReports(storage, now);
  reports.push(report);
  return writeStoredReports(storage, reports, now);
}
