/* global Cesium, L, window */
window.MarsGrsOverlays = (function () {
  let cache = {};
  let currentLayer = null;
  let leafletOverlay = null;
  let cesiumImageryLayer = null;

  const ELEMENTS = {
    h2o: {
      name: "Water Equivalent Hydrogen (H₂O)",
      symbol: "H₂O",
      file: "data/grs/h2o.json",
      unit: "wt%",
      minColor: [15, 30, 80, 0],       // transparent deep navy
      maxColor: [56, 189, 248, 200],    // glowing cyan
      description: "Subsurface water ice and chemically bound hydration in top 1m. Essential for life support and Sabatier rocket propellant.",
    },
    fe: {
      name: "Iron (Fe)",
      symbol: "Fe",
      file: "data/grs/fe.json",
      unit: "wt%",
      minColor: [60, 20, 10, 0],
      maxColor: [239, 68, 68, 190],     // glowing rust red
      description: "Basaltic elemental iron for structural sintering and magnetic shielding.",
    },
    si: {
      name: "Silicon (Si)",
      symbol: "Si",
      file: "data/grs/si.json",
      unit: "wt%",
      minColor: [50, 40, 10, 0],
      maxColor: [245, 158, 11, 190],    // amber
      description: "Silica for habitat structural glass and photovoltaic silicon arrays.",
    },
    k: {
      name: "Potassium (K)",
      symbol: "K",
      file: "data/grs/k.json",
      unit: "wt%",
      minColor: [30, 15, 60, 0],
      maxColor: [168, 85, 247, 190],    // purple
      description: "Macronutrient for greenhouse botanical food loops.",
    },
    th: {
      name: "Thorium (Th)",
      symbol: "Th",
      file: "data/grs/th.json",
      unit: "ppm",
      minColor: [10, 40, 30, 0],
      maxColor: [16, 185, 129, 190],    // emerald
      description: "Heavy actinide tracer for potential nuclear molten-salt reactor feedstock.",
    },
    cl: {
      name: "Chlorine & Perchlorates (Cl)",
      symbol: "Cl",
      file: "data/grs/cl.json",
      unit: "wt%",
      minColor: [20, 45, 15, 0],
      maxColor: [132, 204, 22, 190],    // lime green
      description: "Halogen perchlorate concentrations affecting soil toxicity and oxygen extraction.",
    },
  };

  async function loadElement(key) {
    if (cache[key]) return cache[key];
    const meta = ELEMENTS[key];
    if (!meta) return null;
    try {
      const res = await fetch(meta.file);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      cache[key] = { meta: meta, data: data };
      return cache[key];
    } catch (e) {
      console.warn("[GRS] Failed to load element:", key, e);
      return null;
    }
  }

  /**
   * Samples a GRS grid at arbitrary (lat, lon).
   * Grid is 36 rows x 72 cols (-180 to 180 lon, 90 to -90 lat).
   */
  function sample(key, lat, lon) {
    const entry = cache[key];
    if (!entry || !entry.data || !entry.data.values) return null;
    const g = entry.data;

    let normLon = ((lon + 180) % 360 + 360) % 360 - 180;
    const col = Math.floor(((normLon - g.west) / (g.east - g.west)) * g.cols);
    const row = Math.floor(((g.north - lat) / (g.north - g.south)) * g.rows);

    const safeCol = Math.max(0, Math.min(g.cols - 1, col));
    const safeRow = Math.max(0, Math.min(g.rows - 1, row));

    const val = g.values[safeRow] ? g.values[safeRow][safeCol] : null;
    return val !== null && Number.isFinite(val) ? val : null;
  }

  /**
   * Generates a high-performance Canvas data URL representing the GRS heatmap.
   */
  function generateHeatmapCanvas(key) {
    const entry = cache[key];
    if (!entry) return null;

    const g = entry.data;
    const meta = entry.meta;
    const canvas = document.createElement("canvas");
    canvas.width = g.cols;
    canvas.height = g.rows;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(g.cols, g.rows);

    const minV = g.min || 0;
    const maxV = g.max || 1;
    const range = Math.max(0.001, maxV - minV);

    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const val = g.values[r][c];
        const idx = (r * g.cols + c) * 4;
        if (val === null || !Number.isFinite(val)) {
          imgData.data[idx + 3] = 0;
          continue;
        }

        const t = Math.max(0, Math.min(1, (val - minV) / range));
        // Interpolate RGBA
        imgData.data[idx + 0] = Math.round(meta.minColor[0] + (meta.maxColor[0] - meta.minColor[0]) * t);
        imgData.data[idx + 1] = Math.round(meta.minColor[1] + (meta.maxColor[1] - meta.minColor[1]) * t);
        imgData.data[idx + 2] = Math.round(meta.minColor[2] + (meta.maxColor[2] - meta.minColor[2]) * t);
        imgData.data[idx + 3] = Math.round(meta.minColor[3] + (meta.maxColor[3] - meta.minColor[3]) * t);
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /**
   * Enables or updates the GRS overlay on the Cesium 3D Globe.
   */
  async function applyCesium(viewer, elementKey, opacity) {
    if (!viewer) return;
    if (cesiumImageryLayer) {
      viewer.imageryLayers.remove(cesiumImageryLayer, true);
      cesiumImageryLayer = null;
    }
    if (!elementKey) return;

    await loadElement(elementKey);
    const dataUrl = generateHeatmapCanvas(elementKey);
    if (!dataUrl) return;

    const provider = new Cesium.SingleTileImageryProvider({
      url: dataUrl,
      rectangle: Cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
      ellipsoid: Cesium.Ellipsoid.MARS,
    });

    cesiumImageryLayer = viewer.imageryLayers.addImageryProvider(provider);
    cesiumImageryLayer.alpha = opacity != null ? opacity : 0.65;
  }

  /**
   * Enables or updates the GRS overlay on the Leaflet 2D Detail Map.
   */
  async function applyLeaflet(map, elementKey, opacity) {
    if (!map) return;
    if (leafletOverlay) {
      map.removeLayer(leafletOverlay);
      leafletOverlay = null;
    }
    if (!elementKey) return;

    await loadElement(elementKey);
    const dataUrl = generateHeatmapCanvas(elementKey);
    if (!dataUrl) return;

    const bounds = [[-90, -180], [90, 180]];
    leafletOverlay = L.imageOverlay(dataUrl, bounds, {
      opacity: opacity != null ? opacity : 0.65,
      interactive: false,
    });
    leafletOverlay.addTo(map);
  }

  /**
   * Computes In-Situ Resource Utilization (ISRU) feasibility for any site coordinate.
   */
  function calculateIsruMetrics(lat, lon) {
    const h2o = sample("h2o", lat, lon) || 3.5; // fallback average 3.5 wt%
    const fe = sample("fe", lat, lon) || 16.0;
    const si = sample("si", lat, lon) || 20.0;

    // Regolith density approx 1.5 g/cm3 = 1500 kg/m3
    const regolithDensityKgM3 = 1500.0;
    // Water extractable per cubic meter
    const waterKgPerM3 = (h2o / 100.0) * regolithDensityKgM3;
    // Daily crew requirement: 3.5 L/day per astronaut
    const crewDailyNeedKg = 3.5;
    // Sabatier reaction: CO2 + 4H2 -> CH4 + 2H2O (using H2 from electrolysis)
    const methaneYieldKgPerM3 = (waterKgPerM3 / 36.0) * 16.0;

    return {
      lat: lat,
      lon: lon,
      waterWtPct: Number(h2o.toFixed(2)),
      ironWtPct: Number(fe.toFixed(2)),
      siliconWtPct: Number(si.toFixed(2)),
      waterKgPerM3: Number(waterKgPerM3.toFixed(1)),
      methaneYieldKgPerM3: Number(methaneYieldKgPerM3.toFixed(1)),
      crewDaysWaterPerM3: Math.round(waterKgPerM3 / crewDailyNeedKg),
      isruRating: h2o >= 6.0 ? "PRIME (High Ice Content)" : h2o >= 3.5 ? "MODERATE (Mineral Hydration)" : "ARID (Desiccated Crust)",
    };
  }

  return {
    ELEMENTS,
    loadElement,
    sample,
    applyCesium,
    applyLeaflet,
    calculateIsruMetrics,
  };
})();
