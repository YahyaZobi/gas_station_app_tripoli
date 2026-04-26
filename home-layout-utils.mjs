export function buildDecisionFirstLayout(
  { bestStation = null, backupStation = null, recommendedStations = [], nearbyStations = [], avoidStations = [] },
  maxVisibleStations = 5,
) {
  const heroStation = bestStation ?? null;
  const fallbackCandidates = recommendedStations.filter(
    (station) => station.id !== heroStation?.id && station.id !== backupStation?.id,
  );
  const resolvedBackupStation = backupStation ?? null;
  const nearbyPool = [
    ...fallbackCandidates,
    ...nearbyStations,
  ];

  return {
    heroStation,
    backupStation: resolvedBackupStation,
    nearbyVisible: nearbyPool.slice(0, maxVisibleStations),
    otherStations: [...nearbyPool.slice(maxVisibleStations), ...avoidStations],
  };
}
