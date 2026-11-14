/* global window */
window.MarsData = (function () {
  let manifest = null;
  let graph = null;
  let scores = null;
  let scienceStops = null;
  let routes = null;
  let environment = null;

  async function loadManifest() {
    if (manifest) return manifest;
    const res = await fetch("data/manifest.json");
    manifest = await res.json();
    return manifest;
  }

  async function loadGraph() {
    if (graph) return graph;
    const m = await loadManifest();
    const res = await fetch(m.files.terrain_graph);
    graph = await res.json();
    return graph;
  }

  async function loadScores() {
    if (scores) return scores;
    const m = await loadManifest();
    if (!m.files.gnn_scores) return null;
    const res = await fetch(m.files.gnn_scores);
    if (!res.ok) return null;
    scores = await res.json();
    return scores;
  }

  async function loadScienceStops() {
    if (scienceStops) return scienceStops;
    const m = await loadManifest();
    const res = await fetch(m.files.science_stops);
    scienceStops = await res.json();
    return scienceStops;
  }

  async function loadRoutes() {
    if (routes) return routes;
    const m = await loadManifest();
    const res = await fetch(m.files.routes);
    routes = await res.json();
    return routes;
  }

  async function loadEnvironment() {
    if (environment) return environment;
    const m = await loadManifest();
    const res = await fetch(m.files.environment);
    environment = await res.json();
    return environment;
  }

  return {
    loadManifest,
    loadGraph,
    loadScores,
    loadScienceStops,
    loadRoutes,
    loadEnvironment,
  };
})();
