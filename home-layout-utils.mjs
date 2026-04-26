export function buildDecisionFirstLayout(
  { bestStation = null, recommendedStations = [], nearbyStations = [], avoidStations = [] },
  maxVisibleStations = 5,
) {
  const heroStation = bestStation ?? null;
  const fallbackCandidates = recommendedStations.filter((station) => station.id !== heroStation?.id);
  const backupStation = fallbackCandidates[0] ?? null;
  const nearbyPool = [
    ...fallbackCandidates.filter((station) => station.id !== backupStation?.id),
    ...nearbyStations,
  ];

  return {
    heroStation,
    backupStation,
    nearbyVisible: nearbyPool.slice(0, maxVisibleStations),
    otherStations: [...nearbyPool.slice(maxVisibleStations), ...avoidStations],
  };
}
