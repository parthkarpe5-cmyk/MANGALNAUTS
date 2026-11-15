/* global window */
window.MarsData = (function () {
  let manifest = null;
  let currentSiteKey = "jezero";
  const cache = new Map();

  async function loadManifest() {
    if (manifest) return manifest;
    const res = await fetch("data/manifest.json");
    manifest = await res.json();
    if (manifest.active_site && manifest.sites && manifest.sites[manifest.active_site]) {
      currentSiteKey = manifest.active_site;
    }
    return manifest;
  }

  function getActiveSiteKey() {
    return currentSiteKey;
  }

  async function getActiveSiteMeta() {
    const m = await loadManifest();
    if (m.sites && m.sites[currentSiteKey]) {
      return m.sites[currentSiteKey];
    }
    return {
      id: currentSiteKey,
      name: m.title || "Jezero Crater",
      center: m.center,
      bbox: m.bbox,
      files: m.files,
    };
  }

  function getActiveSiteMetaSync() {
    if (manifest && manifest.sites && manifest.sites[currentSiteKey]) {
      return manifest.sites[currentSiteKey];
    }
    return null;
  }

  async function setActiveSite(siteKey) {
    const m = await loadManifest();
    if (!m.sites || !m.sites[siteKey]) {
      console.warn("[MarsData] Unknown siteKey:", siteKey);
      return false;
    }

    if (currentSiteKey !== siteKey) {
      currentSiteKey = siteKey;
      window.dispatchEvent(new CustomEvent("mars:site-changed", {
        detail: { siteKey, siteMeta: m.sites[siteKey] },
      }));
    }
    return true;
  }

  async function loadFile(field, fallback) {
    const site = await getActiveSiteMeta();
    const url = site.files[field];
    if (!url) return fallback;
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(response => {
        if (!response.ok) throw new Error("Could not load " + field);
        return response.json();
      }).catch(error => {
        cache.delete(url);
        throw error;
      }));
    }
    return cache.get(url);
  }

  const loadGraph = () => loadFile("terrain_graph");
  const loadScores = () => loadFile("gnn_scores", null);
  const emptyFeatures = { type: "FeatureCollection", features: [] };
  const loadScienceStops = () => loadFile("science_stops", emptyFeatures);
  const loadRoutes = () => loadFile("routes", emptyFeatures);
  const loadEnvironment = () => loadFile("environment", {});

  function formatCoordSimple(lat, lon) {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return Math.abs(lat).toFixed(3) + "°" + ns + ", " + Math.abs(lon).toFixed(3) + "°" + ew;
  }

  async function findNearestScienceStop(lat, lon, maxDistM) {
    maxDistM = maxDistM || 3500;
    try {
      const data = await loadScienceStops();
      if (!data || !data.features || data.features.length === 0) return null;
      let bestStop = null;
      let bestDist = maxDistM;
      for (const f of data.features) {
        const coords = f.geometry && f.geometry.coordinates;
        if (!coords) continue;
        const sLat = coords[1];
        const sLon = coords[0];
        const d = (window.MarsGeodesic && window.MarsGeodesic.haversineMeters)
          ? window.MarsGeodesic.haversineMeters(lat, lon, sLat, sLon)
          : Math.hypot(lat - sLat, lon - sLon) * 59000;
        if (d < bestDist) {
          bestDist = d;
          bestStop = Object.assign({ distM: d }, f.properties);
        }
      }
      return bestStop;
    } catch {
      return null;
    }
  }

  async function getWaypointLabel(lat, lon, fallbackName) {
    const stop = await findNearestScienceStop(lat, lon, 3500);
    if (stop && stop.name) {
      if (stop.distM < 600) return stop.name;
      return "Near " + stop.name;
    }
    const meta = getActiveSiteMetaSync ? getActiveSiteMetaSync() : null;
    const sitePrefix = meta && meta.name ? meta.name : (fallbackName || "Waypoint");
    return sitePrefix + " (" + formatCoordSimple(lat, lon) + ")";
  }

  return {
    loadManifest,
    getActiveSiteKey,
    getActiveSiteMeta,
    getActiveSiteMetaSync,
    setActiveSite,
    loadGraph,
    loadRegionalGraph: () => loadFile("regional_graph", null),
    loadScores,
    loadScienceStops,
    loadRoutes,
    loadEnvironment,
    findNearestScienceStop,
    getWaypointLabel,
  };
})();
