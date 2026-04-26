import { getDisplayStatus } from "./logic.mjs";

export function buildDecisionFirstLayout(
  { bestStation = null, backupStation = null, recommendedStations = [], nearbyStations = [], avoidStations = [] },
  maxVisibleStations = 5,
) {
  const rankedStations = uniqueStations([
    ...(bestStation ? [bestStation] : []),
    ...(backupStation ? [backupStation] : []),
    ...recommendedStations,
    ...nearbyStations,
    ...avoidStations,
  ]);
  const heroStation = bestStation ?? getFirstNonClosedStation(rankedStations) ?? rankedStations[0] ?? null;
  const resolvedBackupStation =
    backupStation && backupStation.id !== heroStation?.id
      ? backupStation
      : getFirstNonClosedStation(rankedStations.filter((station) => station.id !== heroStation?.id)) ??
        rankedStations.find((station) => station.id !== heroStation?.id) ??
        null;
  const fallbackCandidates = recommendedStations.filter(
    (station) => station.id !== heroStation?.id && station.id !== resolvedBackupStation?.id,
  );
  const nearbyPool = [
    ...fallbackCandidates,
    ...nearbyStations.filter(
      (station) => station.id !== heroStation?.id && station.id !== resolvedBackupStation?.id,
    ),
  ].filter((station, index, stations) => stations.findIndex((item) => item.id === station.id) === index);
  const remainingAvoidStations = avoidStations.filter(
    (station) => station.id !== heroStation?.id && station.id !== resolvedBackupStation?.id,
  );

  return {
    heroStation,
    backupStation: resolvedBackupStation,
    nearbyVisible: nearbyPool.slice(0, maxVisibleStations),
    otherStations: [...nearbyPool.slice(maxVisibleStations), ...remainingAvoidStations],
  };
}

function uniqueStations(stations) {
  return stations.filter(
    (station, index, allStations) => station && allStations.findIndex((item) => item?.id === station.id) === index,
  );
}

function getFirstNonClosedStation(stations) {
  return stations.find((station) => getDisplayStatus(station) !== "مسكر") ?? null;
}
