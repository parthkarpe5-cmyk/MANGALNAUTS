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

  return {
    loadManifest,
    getActiveSiteKey,
    getActiveSiteMeta,
    setActiveSite,
    loadGraph,
    loadRegionalGraph: () => loadFile("regional_graph", null),
    loadScores,
    loadScienceStops,
    loadRoutes,
    loadEnvironment,
  };
})();
