/* global window */
window.MarsData = (function () {
  let manifest = null;
  let graph = null;
  let scores = null;

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
    const res = await fetch(m.files.gnn_scores);
    scores = await res.json();
    return scores;
  }

  return { loadManifest, loadGraph, loadScores };
})();