/* global L, MarsData, window */
window.MarsHeatmap = (function () {
  let layerGroup = null;
  let currentMap = null;
  let activeMode = "off"; // "off" | "risk" | "science"
  let cachedData = null;
  let radiationLegend = null;
  let renderId = 0;

  // Illustrative atmosphere anchored at Gale (795 Pa in the RAD solar-minimum
  // study). The fixed scale height is a demo assumption, not a climate model.
  const radiationBands = [
    { minimumPa: 750, label: "More shielding", color: [241, 196, 109] },
    { minimumPa: 450, label: "Intermediate shielding", color: [211, 126, 189] },
    { minimumPa: 0, label: "Less shielding", color: [151, 109, 248] },
  ];

  function renderRadiation(map, graph) {
    const { bbox, raster: { rows, cols }, nodes } = graph;
    const canvas = document.createElement("canvas");
    canvas.width = cols;
    canvas.height = rows;
    const context = canvas.getContext("2d");
    const image = context.createImageData(cols, rows);
    const imgData = image.data;
    const len = nodes.length;
    for (let i = 0; i < len; i++) {
      const node = nodes[i];
      if (!Number.isFinite(node.elev_m)) continue;
      let offset = i * 4;
      if (node.id) {
        const p = node.id.split("_");
        if (p.length === 3) {
          const r = parseInt(p[1], 10);
          const c = parseInt(p[2], 10);
          offset = (r * cols + c) * 4;
        }
      }
      const pressure = 795 * Math.exp(-(node.elev_m + 4400) / 10800);
      let r = 151, g = 109, b = 248;
      if (pressure >= 750) {
        r = 241; g = 196; b = 109;
      } else if (pressure >= 450) {
        r = 211; g = 126; b = 189;
      }
      imgData[offset] = r;
      imgData[offset + 1] = g;
      imgData[offset + 2] = b;
      imgData[offset + 3] = 136;
    }
    context.putImageData(image, 0, 0);
    L.imageOverlay(canvas.toDataURL(), [[bbox.south, bbox.west], [bbox.north, bbox.east]], {
      interactive: false,
      alt: "Illustrative atmospheric shielding for background radiation.",
    }).addTo(layerGroup);

    radiationLegend = L.control({ position: "topleft" });
    radiationLegend.onAdd = function () {
      const legend = L.DomUtil.create("div", "radiation-legend");
      legend.innerHTML = '<strong>Radiation exposure proxy</strong><ul>' +
        radiationBands.map(band => '<li><span style="background:rgb(' + band.color.join(",") +
          ')"></span>' + band.label + '</li>').join("") +
        '</ul><small>Pressure model only · no dose estimate<br>Historical Gale reference · 795 Pa</small>' +
        '<br><a href="https://www.sciencedirect.com/science/article/am/pii/S0019103522001488" target="_blank" rel="noopener">Curiosity RAD study</a>';
      L.DomEvent.disableClickPropagation(legend);
      return legend;
    };
    radiationLegend.addTo(map);
  }

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
    const request = ++renderId;
    radiationLegend?.remove();
    radiationLegend = null;
    currentMap = map;
    activeMode = mode;
    if (!layerGroup) {
      layerGroup = L.layerGroup().addTo(map);
    }
    layerGroup.clearLayers();

    if (mode === "off") {
      return;
    }

    if (mode === "radiation") {
      try {
        const graph = await MarsData.loadRegionalGraph();
        if (request === renderId && graph?.raster) renderRadiation(map, graph);
      } catch (error) {
        console.warn("Could not load the radiation proxy layer", error);
      }
      return;
    }

    if (mode === "slope") {
      const site = await MarsData.getActiveSiteMeta();
      if (request !== renderId || !site?.files?.slope) return;
      const b = site.bbox;
      L.imageOverlay(site.files.slope, [[b.south, b.west], [b.north, b.east]], {
        interactive: false,
        className: "measured-slope-overlay",
        alt: "Terrain slope: amber 8–15°, orange 15–20°, coral 20° or more.",
      }).addTo(layerGroup);
      return;
    }
    const { graph, scoreMap } = await loadData();
    if (request !== renderId) return;
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
