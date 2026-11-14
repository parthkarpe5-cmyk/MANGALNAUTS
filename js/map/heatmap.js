/* global L, MarsData, window */
window.MarsHeatmap = (function () {
  let layerGroup = null;
  let currentMap = null;
  let activeMode = "off"; // "off" | "risk" | "science"
  let cachedData = null;

  function riskColor(val) {
    if (val < 0.35) return "#22c55e";
    if (val < 0.6) return "#eab308";
    if (val < 0.75) return "#f97316";
    return "#ef4444";
  }

  function scienceColor(val) {
    if (val < 45) return "#3b82f6";
    if (val < 65) return "#06b6d4";
    if (val < 80) return "#10b981";
    return "#facc15";
  }

  async function loadData() {
    if (cachedData) return cachedData;
    const [graph, scores] = await Promise.all([
      MarsData.loadGraph(),
      MarsData.loadScores(),
    ]);
    const scoreMap = scores?.graph_id === graph.graph_id ? (scores.nodes || scores) : {};
    cachedData = { graph, scoreMap };
    return cachedData;
  }

  async function setMode(map, mode) {
    currentMap = map;
    activeMode = mode;
    if (!layerGroup) {
      layerGroup = L.layerGroup().addTo(map);
    }
    layerGroup.clearLayers();

    if (mode === "off") {
      return;
    }

    if (mode === "slope") {
      const site = await MarsData.getActiveSiteMeta();
      if (currentMap !== map || activeMode !== mode || !site?.files?.slope) return;
      const b = site.bbox;
      L.imageOverlay(site.files.slope, [[b.south, b.west], [b.north, b.east]], {
        interactive: false,
        className: "measured-slope-overlay",
        alt: "Terrain slope: amber 8–15°, orange 15–20°, coral 20° or more.",
      }).addTo(layerGroup);
      return;
    }
    const { graph, scoreMap } = await loadData();
    if (currentMap !== map || activeMode !== mode) return;
    if (!graph || !graph.nodes) return;

    graph.nodes.forEach(function (n) {
      const s = scoreMap[n.id];
      if (!s) return;
      const isRisk = mode === "risk";
      const color = isRisk
        ? riskColor(s.risk_0_1)
        : scienceColor(s.science_0_100);

      const circle = L.circle([n.lat, n.lon], {
        radius: MarsDetailMap.marsRadius ? MarsDetailMap.marsRadius(280) : 280, // ~280 m (Mars) per node
        fillColor: color,
        fillOpacity: 0.45,
        stroke: true,
        color: color,
        weight: 1.5,
      });

      const tooltipContent = isRisk
        ? "<strong>Traversability Risk:</strong> " +
          (s.risk_0_1 * 100).toFixed(1) +
          "%<br/>" +
          "<small>Slope & Terrain Factor</small>"
        : "<strong>Science Potential:</strong> " +
          s.science_0_100.toFixed(1) +
          "%<br/>" +
          "<small>Spectroscopic Biosignature Target</small>";

      circle.bindTooltip(tooltipContent, {
        direction: "center",
        className: "hud-tooltip",
        permanent: false,
      });

      layerGroup.addLayer(circle);
    });
  }

  // React to site changes across the application
  window.addEventListener("mars:site-changed", function () {
    cachedData = null;
    if (currentMap && activeMode !== "off") {
      setMode(currentMap, activeMode);
    }
  });

  return { setMode };
})();
