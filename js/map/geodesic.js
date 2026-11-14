/* global window */
self.MarsGeodesic = (function () {
  const R_M = 3396190.0;
  const DEG = Math.PI / 180;

  function haversineMeters(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * DEG;
    const phi2 = lat2 * DEG;
    const dPhi = (lat2 - lat1) * DEG;
    const dLambda = (lon2 - lon1) * DEG;
    const a =
      Math.sin(dPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return 2 * R_M * Math.asin(Math.sqrt(a));
  }

  function formatDistance(m) {
    if (m >= 1000) {
      return (m / 1000).toFixed(2) + " km";
    }
    return Math.round(m) + " m";
  }

  return { haversineMeters, formatDistance, R_M };
})();