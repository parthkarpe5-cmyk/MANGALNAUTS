/* global window */
window.MarsData = (function () {
  let manifest = null;
  let currentSiteKey = "jezero";
  let graph = null;
  let scores = null;
  let scienceStops = null;
  let routes = null;
  let environment = null;

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

    if (currentSiteKey === siteKey && graph) {
      return true;
    }

    currentSiteKey = siteKey;
    // Invalidate caches
    graph = null;
    scores = null;
    scienceStops = null;
    routes = null;
    environment = null;

    const siteMeta = m.sites[siteKey];

    // Preload graph & scores for the new site
    await Promise.all([loadGraph(), loadScores(), loadScienceStops(), loadRoutes(), loadEnvironment()]);

    // Dispatch global site changed event
    window.dispatchEvent(
      new CustomEvent("mars:site-changed", {
        detail: { siteKey: siteKey, siteMeta: siteMeta },
      })
    );

    return true;
  }

  async function loadGraph() {
    if (graph) return graph;
    const m = await loadManifest();
    const siteFiles = (m.sites && m.sites[currentSiteKey]) ? m.sites[currentSiteKey].files : m.files;
    const res = await fetch(siteFiles.terrain_graph);
    graph = await res.json();
    return graph;
  }

  async function loadScores() {
    if (scores) return scores;
    const m = await loadManifest();
    const siteFiles = (m.sites && m.sites[currentSiteKey]) ? m.sites[currentSiteKey].files : m.files;
    if (!siteFiles.gnn_scores) return null;
    const res = await fetch(siteFiles.gnn_scores);
    if (!res.ok) return null;
    scores = await res.json();
    return scores;
  }

  async function loadScienceStops() {
    if (scienceStops) return scienceStops;
    const m = await loadManifest();
    const siteFiles = (m.sites && m.sites[currentSiteKey]) ? m.sites[currentSiteKey].files : m.files;
    const res = await fetch(siteFiles.science_stops);
    scienceStops = await res.json();
    return scienceStops;
  }

  async function loadRoutes() {
    if (routes) return routes;
    const m = await loadManifest();
    const siteFiles = (m.sites && m.sites[currentSiteKey]) ? m.sites[currentSiteKey].files : m.files;
    const res = await fetch(siteFiles.routes);
    routes = await res.json();
    return routes;
  }

  async function loadEnvironment() {
    if (environment) return environment;
    const m = await loadManifest();
    const siteFiles = (m.sites && m.sites[currentSiteKey]) ? m.sites[currentSiteKey].files : m.files;
    const res = await fetch(siteFiles.environment);
    environment = await res.json();
    return environment;
  }

  return {
    loadManifest,
    getActiveSiteKey,
    getActiveSiteMeta,
    setActiveSite,
    loadGraph,
    loadScores,
    loadScienceStops,
    loadRoutes,
    loadEnvironment,
  };
})();
