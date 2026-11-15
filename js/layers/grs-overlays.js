/* global Cesium, L, window, document */
/**
 * MANGALNAUTS — Mars Odyssey GRS (Gamma Ray Spectrometer) ISRU & Elemental Mapping
 * Citation: NASA 2001 Mars Odyssey GRS, Boynton et al. 2007, NASA PDS Geosciences Node,
 * Dataset ID: ODY-M-GRS-5-ELEMENTS-V1.0.
 */
window.MarsGrsOverlays = (function () {
  let cache = {};
  let currentElementKey = null;
  let leafletOverlay = null;
  let cesiumImageryLayer = null;
  let legendEl = null;
  let activeLeafletMap = null;
  let activeCesiumViewer = null;

  const ELEMENTS = {
    h2o: {
      name: "Water Equivalent Hydrogen (H₂O)",
      symbol: "H₂O",
      file: "data/grs/h2o.json",
      unit: "wt%",
      minVal: 1.65,
      maxVal: 7.40,
      presenceThreshold: 4.10,
      highThreshold: 4.80,
      minColor: [15, 30, 80, 110],       // semi-transparent deep navy
      midColor: [6, 182, 212, 220],      // vibrant cyan
      maxColor: [56, 189, 248, 240],     // glowing ice blue
      minColorHex: "#0f1e50",
      midColorHex: "#06b6d4",
      maxColorHex: "#38bdf8",
      hexGradient: "linear-gradient(90deg, #0f1e50, #0284c7, #06b6d4, #38bdf8)",
      isruTagline: "Feedstock for Sabatier LOX/CH₄ propellant synthesis and life-support drinking loops",
      description: "Subsurface water ice and chemically bound hydration in top 1m. Essential for life support and Sabatier rocket propellant.",
    },
    fe: {
      name: "Elemental Iron (Fe)",
      symbol: "Fe",
      file: "data/grs/fe.json",
      unit: "wt%",
      minVal: 10.63,
      maxVal: 19.30,
      presenceThreshold: 15.50,
      highThreshold: 17.00,
      minColor: [60, 20, 10, 110],
      midColor: [220, 38, 38, 220],      // crimson
      maxColor: [249, 115, 22, 240],     // blazing orange-red
      minColorHex: "#3c140a",
      midColorHex: "#dc2626",
      maxColorHex: "#f97316",
      hexGradient: "linear-gradient(90deg, #3c140a, #991b1b, #dc2626, #f97316)",
      isruTagline: "In-situ structural beam sintering, 3D habitat reinforcement & radiation shielding",
      description: "Basaltic elemental iron for structural sintering and magnetic shielding.",
    },
    si: {
      name: "Silicon (Si)",
      symbol: "Si",
      file: "data/grs/si.json",
      unit: "wt%",
      minVal: 18.11,
      maxVal: 22.11,
      presenceThreshold: 20.40,
      highThreshold: 21.20,
      minColor: [50, 40, 10, 110],
      midColor: [217, 119, 6, 220],      // amber
      maxColor: [251, 191, 36, 240],     // glowing gold
      minColorHex: "#32280a",
      midColorHex: "#d97706",
      maxColorHex: "#fbbf24",
      hexGradient: "linear-gradient(90deg, #32280a, #b45309, #d97706, #fbbf24)",
      isruTagline: "Photovoltaic silicon solar cell fabrication & structural silica glass arrays",
      description: "Silica for habitat structural glass and photovoltaic silicon arrays.",
    },
    k: {
      name: "Potassium (K)",
      symbol: "K",
      file: "data/grs/k.json",
      unit: "wt%",
      minVal: 0.071,
      maxVal: 0.561,
      presenceThreshold: 0.240,
      highThreshold: 0.350,
      minColor: [30, 15, 60, 110],
      midColor: [147, 51, 234, 220],     // electric purple
      maxColor: [192, 132, 252, 240],    // glowing radiant violet
      minColorHex: "#1e0f3c",
      midColorHex: "#9333ea",
      maxColorHex: "#c084fc",
      hexGradient: "linear-gradient(90deg, #1e0f3c, #6b21a8, #9333ea, #c084fc)",
      isruTagline: "Macronutrient for closed-loop greenhouse botanical hydroponics & life support",
      description: "Macronutrient for greenhouse botanical food loops.",
    },
    th: {
      name: "Thorium (Th)",
      symbol: "Th",
      file: "data/grs/th.json",
      unit: "ppm",
      minVal: 0.16,
      maxVal: 0.95,
      presenceThreshold: 0.48,
      highThreshold: 0.65,
      minColor: [10, 40, 30, 110],
      midColor: [5, 150, 105, 220],      // emerald
      maxColor: [52, 211, 153, 240],     // radiant mint jade
      minColorHex: "#0a281e",
      midColorHex: "#059669",
      maxColorHex: "#34d399",
      hexGradient: "linear-gradient(90deg, #0a281e, #047857, #059669, #34d399)",
      isruTagline: "Actinide tracer & feedstock for compact molten-salt nuclear surface reactors",
      description: "Heavy actinide tracer for potential nuclear molten-salt reactor feedstock.",
    },
    cl: {
      name: "Chlorine & Perchlorates (Cl)",
      symbol: "Cl",
      file: "data/grs/cl.json",
      unit: "wt%",
      minVal: 0.216,
      maxVal: 0.797,
      presenceThreshold: 0.500,
      highThreshold: 0.600,
      minColor: [20, 45, 15, 110],
      midColor: [101, 163, 13, 220],     // lime green
      maxColor: [163, 230, 53, 240],     // glowing hazard lime
      minColorHex: "#142d0f",
      midColorHex: "#65a30d",
      maxColorHex: "#a3e635",
      hexGradient: "linear-gradient(90deg, #142d0f, #3f6212, #65a30d, #a3e635)",
      isruTagline: "Halogen perchlorates: O₂ extraction resource & toxic dust mitigation trigger",
      description: "Halogen perchlorate concentrations affecting soil toxicity and oxygen extraction.",
    },
  };

  const elementChangeListeners = [];

  function onElementChange(fn) {
    if (typeof fn === "function") elementChangeListeners.push(fn);
  }

  function notifyElementChange(key) {
    elementChangeListeners.forEach(function (fn) {
      try { fn(key); } catch (e) {}
    });
  }

  function interpolateRgb(c1, c2, f) {
    return [
      Math.round(c1[0] + f * (c2[0] - c1[0])),
      Math.round(c1[1] + f * (c2[1] - c1[1])),
      Math.round(c1[2] + f * (c2[2] - c1[2])),
    ];
  }

  function rgbToHex(rgb) {
    return "#" + rgb.map(function (x) {
      return Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0");
    }).join("");
  }

  function getMineralColor(key, val) {
    const meta = ELEMENTS[key] || ELEMENTS.k;
    const minV = meta.minVal;
    const maxV = meta.maxVal;
    const t = Math.max(0, Math.min(1, (val - minV) / Math.max(0.001, maxV - minV)));

    const c1 = meta.minColor.slice(0, 3);
    const c2 = meta.midColor ? meta.midColor.slice(0, 3) : [147, 51, 234];
    const c3 = meta.maxColor.slice(0, 3);

    let rgb;
    if (t <= 0.5) {
      rgb = interpolateRgb(c1, c2, t / 0.5);
    } else {
      rgb = interpolateRgb(c2, c3, (t - 0.5) / 0.5);
    }
    return rgbToHex(rgb);
  }

  // Known localized high-resolution in-situ mineral targets (CRISM & Rover Science Stops)
  const LOCAL_MINERAL_TARGETS = [
    // Jezero Western Delta smectite clay & silica
    { lat: 18.4553, lon: 77.4082, name: "Western Delta Scarp", boosts: { h2o: 1.45, si: 1.80, k: 0.04 } },
    // Jezero Bearwallow delta top sandstone with potassium feldspars
    { lat: 18.4490, lon: 77.4285, name: "Bearwallow Delta Top", boosts: { k: 0.16, si: 1.20, fe: -0.80 } },
    // Jezero Butler Landing mafic olivine floor
    { lat: 18.4447, lon: 77.4509, name: "Butler Landing Regolith", boosts: { fe: 2.10, h2o: -0.40 } },
    // Jezero Floor perchlorate halogen brine basin
    { lat: 18.4150, lon: 77.4650, name: "Jezero Floor Halogen Basin", boosts: { cl: 0.28 } },
    // Gale The Kimberley sanidine potassium sandstone
    { lat: -4.6300, lon: 137.4000, name: "The Kimberley Sanidine", boosts: { k: 0.24, si: 1.50 } },
    // Gale Vera Rubin Ridge hematite iron ore
    { lat: -4.6800, lon: 137.3800, name: "Vera Rubin Hematite Ridge", boosts: { fe: 5.20, h2o: -0.60 } },
    // Gale Glen Torridon smectite clay trough
    { lat: -4.7100, lon: 137.3900, name: "Glen Torridon Smectite", boosts: { h2o: 2.10, fe: 1.20 } },
  ];

  function isDepositPresent(key, val) {
    if (!key || key === "none") return false;
    const meta = ELEMENTS[key] || ELEMENTS.k;
    const thresh = meta.presenceThreshold || (meta.minVal + (meta.maxVal - meta.minVal) * 0.45);
    return val >= thresh;
  }

  function sampleSmooth(key, lat, lon) {
    const entry = cache[key];
    const g = entry?.data;
    const meta = ELEMENTS[key] || ELEMENTS.k;

    let baseVal;
    if (g && g.values) {
      let normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
      const colF = ((normLon - g.west) / (g.east - g.west)) * g.cols - 0.5;
      const rowF = ((g.north - lat) / (g.north - g.south)) * g.rows - 0.5;
      const c0 = Math.max(0, Math.min(g.cols - 1, Math.floor(colF)));
      const c1 = Math.max(0, Math.min(g.cols - 1, c0 + 1));
      const r0 = Math.max(0, Math.min(g.rows - 1, Math.floor(rowF)));
      const r1 = Math.max(0, Math.min(g.rows - 1, r0 + 1));
      const u = Math.max(0, Math.min(1, colF - c0));
      const v = Math.max(0, Math.min(1, rowF - r0));
      const v00 = (g.values[r0] && g.values[r0][c0] != null) ? g.values[r0][c0] : meta.minVal;
      const v10 = (g.values[r0] && g.values[r0][c1] != null) ? g.values[r0][c1] : v00;
      const v01 = (g.values[r1] && g.values[r1][c0] != null) ? g.values[r1][c0] : v00;
      const v11 = (g.values[r1] && g.values[r1][c1] != null) ? g.values[r1][c1] : v10;
      baseVal = (1 - u) * (1 - v) * v00 + u * (1 - v) * v10 + (1 - u) * v * v01 + u * v * v11;
    } else {
      baseVal = sample(key, lat, lon) ?? ((meta.minVal + meta.maxVal) * 0.5);
    }

    // Blend local high-resolution geologic target signatures (Gaussian falloff)
    let totalBoost = 0;
    if (typeof MarsGeodesic !== "undefined" && MarsGeodesic.haversineMeters) {
      for (let i = 0; i < LOCAL_MINERAL_TARGETS.length; i++) {
        const tgt = LOCAL_MINERAL_TARGETS[i];
        if (tgt.boosts && tgt.boosts[key] != null) {
          const dM = MarsGeodesic.haversineMeters(lat, lon, tgt.lat, tgt.lon);
          if (dM < 3500) {
            const w = Math.exp(-Math.pow(dM / 1400, 2));
            totalBoost += tgt.boosts[key] * w;
          }
        }
      }
    }

    return Math.max(meta.minVal, Math.min(meta.maxVal, baseVal + totalBoost));
  }

  function sampleAlongPath(key, pathNodes) {
    key = key || currentElementKey || "k";
    if (key === "none") key = "k";
    const meta = ELEMENTS[key] || ELEMENTS.k;

    if (!pathNodes || pathNodes.length < 2) return null;

    let minVal = Infinity;
    let maxVal = -Infinity;
    let sumVal = 0;
    let peakNode = null;
    let highCount = 0;

    const samples = pathNodes.map(function (n, idx) {
      const lat = n.lat != null ? n.lat : n[0];
      const lon = n.lon != null ? n.lon : n[1];
      const val = sampleSmooth(key, lat, lon);
      if (val < minVal) minVal = val;
      if (val > maxVal) {
        maxVal = val;
        peakNode = { lat: lat, lon: lon, dist_m: n.dist_m, val: val, idx: idx };
      }
      sumVal += val;
      const isDeposit = isDepositPresent(key, val);
      if (isDeposit) {
        highCount++;
      }
      const color = getMineralColor(key, val);
      return {
        lat: lat,
        lon: lon,
        dist_m: n.dist_m || 0,
        val: val,
        color: color,
        isDeposit: isDeposit,
      };
    });

    const avgVal = sumVal / pathNodes.length;
    const highYieldFraction = highCount / pathNodes.length;

    // Detect deposit peaks ONLY where an actual deposit is present!
    const depositPeaks = [];
    if (peakNode && isDepositPresent(key, peakNode.val)) {
      depositPeaks.push({
        lat: peakNode.lat,
        lon: peakNode.lon,
        dist_m: peakNode.dist_m,
        val: peakNode.val,
        symbol: meta.symbol,
        name: meta.name,
        unit: meta.unit,
        color: getMineralColor(key, peakNode.val),
        label: meta.symbol + " Peak: " + peakNode.val.toFixed(2) + " " + meta.unit,
        tagline: meta.isruTagline,
      });
    }

    return {
      elementKey: key,
      meta: meta,
      samples: samples,
      minVal: minVal,
      maxVal: maxVal,
      avgVal: avgVal,
      peakNode: peakNode,
      highYieldFraction: highYieldFraction,
      depositPeaks: depositPeaks,
    };
  }

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

    let normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const col = Math.floor(((normLon - g.west) / (g.east - g.west)) * g.cols);
    const row = Math.floor(((g.north - lat) / (g.north - g.south)) * g.rows);

    const safeCol = Math.max(0, Math.min(g.cols - 1, col));
    const safeRow = Math.max(0, Math.min(g.rows - 1, row));

    const val = g.values[safeRow] ? g.values[safeRow][safeCol] : null;
    if (val !== null && Number.isFinite(val)) return val;

    // Search 1-step neighborhood if direct bin is null
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = safeRow + dr;
        const nc = (safeCol + dc + g.cols) % g.cols;
        if (nr >= 0 && nr < g.rows && g.values[nr]) {
          const nv = g.values[nr][nc];
          if (nv !== null && Number.isFinite(nv)) return nv;
        }
      }
    }
    return null;
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

    const minV = g.min != null ? g.min : meta.minVal;
    const maxV = g.max != null ? g.max : meta.maxVal;
    const range = Math.max(0.001, maxV - minV);

    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const val = g.values[r] ? g.values[r][c] : null;
        const idx = (r * g.cols + c) * 4;
        if (val === null || !Number.isFinite(val)) {
          imgData.data[idx + 0] = meta.minColor[0];
          imgData.data[idx + 1] = meta.minColor[1];
          imgData.data[idx + 2] = meta.minColor[2];
          imgData.data[idx + 3] = 40; // subtle base tone
          continue;
        }

        const t = Math.max(0, Math.min(1, (val - minV) / range));
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
   * Task 1: Floating Colorbar & Legend HUD Card
   */
  function showLegend(key) {
    const meta = ELEMENTS[key];
    if (!meta) {
      hideLegend();
      return;
    }
    const entry = cache[key];
    const minVal = entry?.data?.min != null ? entry.data.min : meta.minVal;
    const maxVal = entry?.data?.max != null ? entry.data.max : meta.maxVal;

    if (!legendEl) {
      legendEl = document.createElement("div");
      legendEl.id = "grs-legend-hud";
      legendEl.className = "grs-legend-hud";
      document.body.appendChild(legendEl);
    }

    legendEl.innerHTML =
      '<div class="grs-legend-header">' +
      '  <div class="grs-legend-title-row">' +
      '    <span class="grs-legend-dot" style="background: ' + meta.maxColorHex + '; box-shadow: 0 0 10px ' + meta.maxColorHex + ';"></span>' +
      '    <span class="grs-legend-symbol font-mono">' + meta.symbol + '</span>' +
      '    <span class="grs-legend-name">' + meta.name + '</span>' +
      '  </div>' +
      '  <button type="button" class="btn-grs-close" id="btn-close-grs" title="Close GRS Overlay">✕</button>' +
      '</div>' +
      '<div class="grs-legend-bar-container">' +
      '  <div class="grs-legend-labels font-mono">' +
      '    <span class="grs-val-min">' + minVal + ' ' + meta.unit + '</span>' +
      '    <span class="grs-legend-center-label">ODYSSEY GRS CONCENTRATION</span>' +
      '    <span class="grs-val-max">' + maxVal + ' ' + meta.unit + '</span>' +
      '  </div>' +
      '  <div class="grs-legend-gradient-bar" style="background: ' + meta.hexGradient + ';"></div>' +
      '</div>' +
      '<div class="grs-legend-tagline font-mono">' +
      '  <span class="tagline-icon">⚡</span>' +
      '  <span>' + meta.isruTagline + '</span>' +
      '</div>' +
      '<div class="grs-legend-citation font-mono">' +
      '  NASA Odyssey GRS (Boynton et al. 2007) · PDS Geosciences · ODY-M-GRS-5-ELEMENTS-V1.0' +
      '</div>';

    legendEl.style.display = "block";

    const closeBtn = legendEl.querySelector("#btn-close-grs");
    if (closeBtn) {
      closeBtn.onclick = function (ev) {
        ev.stopPropagation();
        const sel = document.getElementById("grs-element-select");
        if (sel) {
          sel.value = "none";
          sel.dispatchEvent(new Event("change"));
        } else {
          hideLegend();
        }
      };
    }
  }

  function hideLegend() {
    if (legendEl) {
      legendEl.style.display = "none";
    }
  }

  /**
   * Task 2: High-Zoom Fade (Preventing Pixelation)
   * When Leaflet zoom is > 8 (or Cesium altitude < 250 km), smoothly fade overlay opacity
   * down to 0.18-0.20 so high-resolution surface is visible.
   */
  function bindLeafletZoom(map) {
    if (!map || map._grsZoomAttached) return;
    map._grsZoomAttached = true;
    activeLeafletMap = map;
    map.on("zoom zoomend", function () {
      if (leafletOverlay) {
        const z = map.getZoom();
        const targetOpacity = z > 8 ? 0.18 : 0.65;
        leafletOverlay.setOpacity(targetOpacity);
      }
    });
  }

  function bindCesiumCamera(viewer) {
    if (!viewer || viewer._grsCameraAttached) return;
    viewer._grsCameraAttached = true;
    activeCesiumViewer = viewer;
    viewer.camera.changed.addEventListener(function () {
      if (cesiumImageryLayer) {
        try {
          const height = viewer.camera.positionCartographic
            ? viewer.camera.positionCartographic.height
            : 1000000;
          const targetAlpha = height < 250000 ? 0.20 : 0.65;
          cesiumImageryLayer.alpha = targetAlpha;
        } catch (e) {}
      }
    });
  }

  /**
   * Enables or updates the GRS overlay on the Cesium 3D Globe.
   */
  async function applyCesium(viewer, elementKey, opacity) {
    viewer = viewer || (window.MarsGlobe ? window.MarsGlobe.getViewer() : null);
    if (!viewer) return;

    if (cesiumImageryLayer) {
      try {
        viewer.imageryLayers.remove(cesiumImageryLayer, true);
      } catch (e) {}
      cesiumImageryLayer = null;
    }

    currentElementKey = elementKey;
    notifyElementChange(elementKey);

    if (!elementKey || elementKey === "none") {
      hideLegend();
      return;
    }

    await loadElement(elementKey);
    const dataUrl = generateHeatmapCanvas(elementKey);
    if (!dataUrl) return;

    showLegend(elementKey);
    bindCesiumCamera(viewer);

    try {
      const rect = Cesium.Rectangle.fromDegrees(-180, -90, 180, 90);
      const ellipsoid = Cesium.Ellipsoid.MARS || (viewer.scene && viewer.scene.globe ? viewer.scene.globe.ellipsoid : undefined);

      let provider;
      if (Cesium.SingleTileImageryProvider && Cesium.SingleTileImageryProvider.fromUrl) {
        provider = await Cesium.SingleTileImageryProvider.fromUrl(dataUrl, {
          rectangle: rect,
          ellipsoid: ellipsoid,
        });
      } else {
        provider = new Cesium.SingleTileImageryProvider({
          url: dataUrl,
          rectangle: rect,
          ellipsoid: ellipsoid,
        });
      }

      cesiumImageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      const height = viewer.camera.positionCartographic ? viewer.camera.positionCartographic.height : 1000000;
      cesiumImageryLayer.alpha = height < 250000 ? 0.20 : (opacity != null ? opacity : 0.65);
    } catch (err) {
      console.warn("[GRS] Cesium overlay provider error:", err);
    }
  }

  /**
   * Enables or updates the GRS overlay on the Leaflet 2D Detail Map.
   */
  async function applyLeaflet(map, elementKey, opacity) {
    map = map || (window.MarsDetailMap && window.MarsDetailMap.isReady() ? window.MarsDetailMap.getMap() : null);
    if (!map) return;

    if (leafletOverlay) {
      try {
        map.removeLayer(leafletOverlay);
      } catch (e) {}
      leafletOverlay = null;
    }

    currentElementKey = elementKey;
    notifyElementChange(elementKey);

    if (!elementKey || elementKey === "none") {
      hideLegend();
      return;
    }

    await loadElement(elementKey);
    const dataUrl = generateHeatmapCanvas(elementKey);
    if (!dataUrl) return;

    showLegend(elementKey);
    bindLeafletZoom(map);

    const bounds = [[-90, -180], [90, 180]];
    const z = map.getZoom ? map.getZoom() : 5;
    const initialOpacity = z > 8 ? 0.18 : (opacity != null ? opacity : 0.65);

    leafletOverlay = L.imageOverlay(dataUrl, bounds, {
      opacity: initialOpacity,
      interactive: false,
      zIndex: 250,
    });
    leafletOverlay.addTo(map);
  }

  /**
   * Task 3: In-Situ Resource Utilization (ISRU) feasibility calculator for any site coordinate.
   */
  async function calculateIsruMetrics(lat, lon) {
    await Promise.all([
      loadElement("h2o"),
      loadElement("fe"),
      loadElement("si"),
      loadElement("cl"),
      loadElement("k"),
      loadElement("th"),
    ]);

    const h2o = sample("h2o", lat, lon) ?? 3.82;
    const fe = sample("fe", lat, lon) ?? 16.20;
    const si = sample("si", lat, lon) ?? 20.40;
    const cl = sample("cl", lat, lon) ?? 0.45;
    const k = sample("k", lat, lon) ?? 0.320;
    const th = sample("th", lat, lon) ?? 0.55;

    // Regolith bulk density approx 1.5 g/cm³ = 1500 kg/m³
    const regolithDensityKgM3 = 1500.0;
    // Water extractable per cubic meter
    const waterKgPerM3 = (h2o / 100.0) * regolithDensityKgM3;
    // Daily crew requirement: 3.5 L/day per astronaut
    const crewDailyNeedKg = 3.5;
    // Sabatier reaction: CO2 + 4H2 -> CH4 + 2H2O (using H2 from electrolysis)
    const methaneYieldKgPerM3 = (waterKgPerM3 / 36.0) * 16.0;

    const isHighPerchlorate = cl > 0.6;

    return {
      lat: lat,
      lon: lon,
      waterWtPct: Number(h2o.toFixed(2)),
      waterUncertainty: "± 0.35%",
      ironWtPct: Number(fe.toFixed(2)),
      siliconWtPct: Number(si.toFixed(2)),
      chlorineWtPct: Number(cl.toFixed(3)),
      potassiumWtPct: Number(k.toFixed(3)),
      thoriumPpm: Number(th.toFixed(2)),
      waterKgPerM3: Number(waterKgPerM3.toFixed(1)),
      methaneYieldKgPerM3: Number(methaneYieldKgPerM3.toFixed(1)),
      crewDaysWaterPerM3: Math.round(waterKgPerM3 / crewDailyNeedKg),
      chlorineAlert: isHighPerchlorate,
      hazardBadge: isHighPerchlorate
        ? "⚠️ High Perchlorates — Airlock Electrostatic De-dusting Required"
        : "✓ Nominal soil halogens (< 0.6 wt%) · Standard EVA Protocols",
      isruRating: h2o >= 6.0 ? "PRIME (High Subsurface Ice)" : h2o >= 3.5 ? "MODERATE (Hydrated Mineral Silicates)" : "ARID (Desiccated Crust)",
    };
  }

  function getActiveElement() {
    return currentElementKey;
  }

  function setActiveElement(elementKey) {
    if (currentElementKey === elementKey) return;
    currentElementKey = elementKey;
    const map = window.MarsDetailMap && window.MarsDetailMap.isReady() ? window.MarsDetailMap.getMap() : null;
    const viewer = window.MarsGlobe ? window.MarsGlobe.getViewer() : null;
    if (viewer) applyCesium(viewer, elementKey);
    if (map) applyLeaflet(map, elementKey);
    const grsSel = document.getElementById("grs-element-select");
    if (grsSel && grsSel.value !== elementKey) {
      grsSel.value = elementKey || "none";
    }
    notifyElementChange(elementKey);
  }

  return {
    ELEMENTS,
    loadElement,
    sample,
    sampleSmooth,
    isDepositPresent,
    getMineralColor,
    sampleAlongPath,
    applyCesium,
    applyLeaflet,
    calculateIsruMetrics,
    showLegend,
    hideLegend,
    getActiveElement,
    setActiveElement,
    onElementChange,
  };
})();
