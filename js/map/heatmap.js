/* global L, MarsData, window */
window.MarsHeatmap = (function () {
  let layerGroup = null;
  let activeMode = "off"; // "off" | "risk" | "science"
  let cachedData = null;

  function riskColor(val) {
    // 0 = safe (#22c55e), 0.5 = moderate (#eab308), 1.0 = hazardous (#ef4444)
    if (val < 0.35) return "#22c55e";
    if (val < 0.6) return "#eab308";
    if (val < 0.75) return "#f97316";
    return "#ef4444";
  }

  function scienceColor(val) {
    // 0 = low (#3b82f6), 50 = med (#06b6d4), 100 = critical (#eab308)
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
    const scoreMap = scores.nodes || scores;
    cachedData = { graph, scoreMap };
    return cachedData;
  }

  async function setMode(map, mode) {
    activeMode = mode;
    if (!layerGroup) {
      layerGroup = L.layerGroup().addTo(map);
    }
    layerGroup.clearLayers();

    if (mode === "off") {
      return;
    }

    const { graph, scoreMap } = await loadData();

    graph.nodes.forEach(function (n) {
      const s = scoreMap[n.id] || { risk_0_1: 0.3, science_0_100: 50 };
      const isRisk = mode === "risk";
      const color = isRisk
        ? riskColor(s.risk_0_1)
        : scienceColor(s.science_0_100);

      const circle = L.circle([n.lat, n.lon], {
        radius: 280, // ~300 meters coverage per node
        fillColor: color,
        fillOpacity: 0.45,
        stroke: true,
        color: color,
        weight: 1.5,
        opacity: 0.8,
      });

      const tooltipContent =
        "<strong>Node " +
        n.id +
        "</strong><br/>" +
        "Elevation: " +
        n.elev_m.toFixed(0) +
        " m<br/>" +
        "Slope: " +
        n.slope_deg.toFixed(1) +
        "°<br/>" +
        "Risk: <strong>" +
        (s.risk_0_1 * 100).toFixed(0) +
        "%</strong><br/>" +
        "Science Yield: <strong>" +
        s.science_0_100.toFixed(0) +
        "%</strong>";

      circle.bindTooltip(tooltipContent, {
        sticky: true,
        direction: "top",
        className: "hud-tooltip",
      });

      layerGroup.addLayer(circle);
    });
  }

  function getMode() {
    return activeMode;
  }

  return { setMode, getMode };
})();
