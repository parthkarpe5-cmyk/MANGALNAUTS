/* global Cesium, TrekLayers, window */
window.MarsGlobe = (function () {
  const MDEM_URL =
    "https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer";

  let viewer = null;
  let baseLayer = null;
  let overlayLayer = null;
  let activeFilter = "viking";
  let overlayFilter = null;
  let overlayOpacity = 0.45;

  let landmarksCollection = null;
  let aoiEntity = null;
  let graticuleCollection = null;

  const modeledLandmarks = new Set(["perseverance", "opportunity"]);

  const LANDMARKS = [
    {
      id: "perseverance",
      siteKey: "jezero",
      name: "Perseverance Rover (Jezero)",
      lat: 18.4447,
      lon: 77.4509,
      alt: 85000,
      color: "#c9f31d",
      description: "NASA Mars 2020 landing site in Jezero Crater Western Delta.",
    },
    {
      id: "curiosity",
      siteKey: "gale",
      name: "Curiosity Rover (Gale)",
      lat: -4.650,
      lon: 137.400,
      alt: 95000,
      color: "#38bdf8",
      description: "NASA Mars Science Laboratory landing site climbing Mount Sharp in Gale Crater.",
    },
    {
      id: "insight",
      siteKey: null,
      name: "InSight Lander (Elysium)",
      lat: 4.5024,
      lon: 135.6234,
      alt: 120000,
      color: "#fbbf24",
      description: "NASA interior exploration and seismic station.",
    },
    {
      id: "opportunity",
      siteKey: null,
      name: "Opportunity Rover (Meridiani)",
      lat: -1.9462,
      lon: 354.4734,
      alt: 120000,
      color: "#a78bfa",
      description: "Explored Victoria and Endeavour craters for 14 years.",
    },
    {
      id: "spirit",
      siteKey: null,
      name: "Spirit Rover (Gusev)",
      lat: -14.5684,
      lon: 175.4726,
      alt: 120000,
      color: "#f472b6",
      description: "Explored Gusev Crater and Columbia Hills.",
    },
    {
      id: "olympus",
      siteKey: "olympus",
      name: "Olympus Mons",
      lat: 18.65,
      lon: -133.8,
      alt: 650000,
      color: "#f97316",
      description: "Highest volcano and planetary mountain in the Solar System (21.9 km).",
    },
    {
      id: "valles_marineris",
      siteKey: null,
      name: "Valles Marineris",
      lat: -14.0,
      lon: -59.0,
      alt: 1200000,
      color: "#e11d48",
      description: "Grand Canyon of Mars spanning over 4,000 km across the equator.",
    },
  ];

  async function init(containerId) {
    Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;

    viewer = new Cesium.Viewer(containerId, {
      // Orbiters animate when visible, so cap the render rate instead of freezing the scene.
      targetFrameRate: 30,
      animation: false,
      timeline: false,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      terrain: undefined,
      contextOptions: {
        webgl: {
          alpha: true,
        },
      },
    });

    viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;
    viewer.scene.globe.ellipsoid = Cesium.Ellipsoid.MARS;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#1a0804");
    viewer.scene.globe.enableLighting = true;
    viewer.scene.postProcessStages.fxaa.enabled = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Start real-time cosmic galaxy backdrop
    if (window.MarsCosmicGalaxy) {
      window.MarsCosmicGalaxy.init("cosmic-canvas");
    }
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = true;
      viewer.scene.skyAtmosphere.hueShift = -0.55;
      viewer.scene.skyAtmosphere.saturationShift = 0.4;
      viewer.scene.skyAtmosphere.brightnessShift = -0.2;
    }

    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 5000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 30000000;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;

    // Load MDEM Elevation if available
    try {
      const terrainProvider = await Cesium.ArcGisImageServerTerrainProvider.fromUrl(
        MDEM_URL,
        {
          ellipsoid: Cesium.Ellipsoid.MARS,
          token: undefined,
        }
      );
      viewer.terrainProvider = terrainProvider;
    } catch (e) {
      console.warn("[MarsGlobe] MDEM elevation unavailable, falling back to ellipsoid:", e);
    }

    await initOptionalLayers();
    window.MarsOrbiters?.init(viewer).catch(console.warn);

    // Init Historical Traverses on 3D globe
    if (window.MarsHistoricalTraverses) {
      window.MarsHistoricalTraverses.initCesium(viewer).catch(console.warn);
    }

    // Landmark click listener on 3D globe
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction(function (movement) {
      const picked = viewer.scene.pick(movement.position);
      if (picked && picked.id && picked.id.landmarkData) {
        const lm = picked.id.landmarkData;
        if (window.MarsAudio) window.MarsAudio.playClick();
        if (lm.siteKey && window.MarsData) {
          window.MarsData.setActiveSite(lm.siteKey);
          const locSelect = document.getElementById("location");
          if (locSelect) locSelect.value = lm.siteKey;
        }
        flyTo(lm.lat, lm.lon, lm.alt, 1.5);
        showSiteEntryBanner(lm);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Wire HUD Site Banner action buttons
    const enterBtn = document.getElementById("btn-enter-tactical");
    if (enterBtn) {
      enterBtn.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        const site = enterBtn.dataset.site || "jezero";
        if (window.MarsData) {
          window.MarsData.setActiveSite(site).catch(console.warn);
        }
        const locSelect = document.getElementById("location");
        if (locSelect) locSelect.value = site;
        if (window.MarsHybrid) {
          window.MarsHybrid.setViewMode("split");
        }
        hideSiteEntryBanner();
      });
    }

    const orbitBtn = document.getElementById("btn-globe-orbit");
    if (orbitBtn) {
      orbitBtn.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        const locSelect = document.getElementById("location");
        if (locSelect) locSelect.value = "global";
        flyTo(10, 35, 11500000, 2.0);
        hideSiteEntryBanner();
      });
    }

    // Automatically hide site entry banner when zooming back out to space
    viewer.camera.changed.addEventListener(function () {
      if (viewer && viewer.camera && viewer.camera.positionCartographic) {
        if (viewer.camera.positionCartographic.height > 5000000) {
          hideSiteEntryBanner();
        }
      }
    });

    // Initial camera position: Planetary Orbit floating in Deep Space Cosmic Galaxy
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(35.0, 10.0, 11500000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });

    window.addEventListener("mars:site-changed", function (e) {
      if (e.detail && e.detail.siteMeta) {
        const meta = e.detail.siteMeta;
        const color = meta.boundary_color || (meta.id === "gale" ? "#f59e0b" : "#c9f31d");
        updateAoiFootprint(meta.bbox, color);
      }
    });

    return viewer;
  }

  async function resolveDynamicLandmarks() {
    const landmarks = LANDMARKS.map(function (lm) {
      return Object.assign({}, lm);
    });

    // 1. Enrich from manifest.json
    try {
      const manifest = window.MarsData && window.MarsData.loadManifest
        ? await window.MarsData.loadManifest()
        : null;
      if (manifest && manifest.sites) {
        Object.keys(manifest.sites).forEach(function (siteKey) {
          const site = manifest.sites[siteKey];
          const existing = landmarks.find(function (lm) {
            return lm.siteKey === siteKey || lm.id === siteKey;
          });
          if (existing) {
            if (site.center) {
              existing.lat = site.center.lat;
              existing.lon = site.center.lon;
            }
            if (site.boundary_color) {
              existing.color = site.boundary_color;
            }
            if (site.globe_camera && site.globe_camera.height) {
              existing.alt = site.globe_camera.height;
            }
            if (site.name) {
              existing.name = site.rover
                ? site.rover + " (" + site.name.split(" (")[0] + ")"
                : site.name;
            }
          }
        });
      }
    } catch (e) {
      console.warn("[MarsGlobe] Could not enrich landmarks from manifest:", e);
    }

    // 2. Enrich from traverses.json
    try {
      const trData = window.MarsHistoricalTraverses && window.MarsHistoricalTraverses.loadData
        ? await window.MarsHistoricalTraverses.loadData()
        : null;
      if (trData && trData.traverses) {
        trData.traverses.forEach(function (tr) {
          const match = landmarks.find(function (lm) {
            return lm.id === tr.id || (lm.siteKey && tr.id.includes(lm.siteKey));
          });
          if (match) {
            if (tr.highlights) {
              match.description = tr.highlights;
            }
            if (tr.points && tr.points.length > 0) {
              const lastPt = tr.points[tr.points.length - 1];
              match.lat = lastPt[0];
              match.lon = lastPt[1];
            }
          }
        });
      }
    } catch (e) {
      console.warn("[MarsGlobe] Could not enrich landmarks from traverses:", e);
    }

    return landmarks;
  }

  async function initOptionalLayers() {
    // 1. Landmarks (dynamically enriched from manifest.json and traverses.json)
    landmarksCollection = [];
    const effectiveLandmarks = await resolveDynamicLandmarks();
    effectiveLandmarks.forEach(function (lm) {
      const hasModel = modeledLandmarks.has(lm.id);
      const entity = viewer.entities.add({
        name: lm.name,
        position: Cesium.Cartesian3.fromDegrees(lm.lon, lm.lat, 500),
        model: hasModel ? {
          uri: "assets/spacecraft/" + lm.id + ".glb",
          minimumPixelSize: 26,
          maximumScale: 250000,
        } : undefined,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString(lm.color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
        },
        label: {
          text: lm.name,
          font: "12px sans-serif",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, hasModel ? -22 : -10),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        },
      });
      entity.landmarkData = lm;
      landmarksCollection.push(entity);
    });

    // 2. Active Site AOI Footprint (dynamically resolved from active site manifest)
    const activeMeta = window.MarsData?.getActiveSiteMetaSync ? window.MarsData.getActiveSiteMetaSync() : null;
    const initialBbox = activeMeta?.bbox || { west: 77.355, south: 18.395, east: 77.485, north: 18.505 };
    const initialColorHex = activeMeta?.boundary_color || "#c9f31d";
    const initialColor = Cesium.Color.fromCssColorString(initialColorHex);

    aoiEntity = viewer.entities.add({
      name: "Mission Exploration AOI Footprint",
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          initialBbox.west, initialBbox.south,
          initialBbox.east, initialBbox.south,
          initialBbox.east, initialBbox.north,
          initialBbox.west, initialBbox.north,
        ]),
        material: initialColor.withAlpha(0.18),
        outline: true,
        outlineColor: initialColor,
        outlineWidth: 2,
        height: 100,
      },
      show: true,
    });

    // 3. Graticule
    graticuleCollection = [];
    [-60, -30, 0, 30, 60].forEach(function (lat) {
      const coords = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        coords.push(lon, lat);
      }
      const isEquator = lat === 0;
      const polyline = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(coords),
          width: isEquator ? 2 : 1,
          material: isEquator
            ? Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.6)
            : Cesium.Color.WHITE.withAlpha(0.25),
        },
        show: false,
      });
      graticuleCollection.push(polyline);
    });

    [-120, -60, 0, 60, 120, 180].forEach(function (lon) {
      const coords = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        coords.push(lon, lat);
      }
      const isPrime = lon === 0;
      const polyline = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(coords),
          width: isPrime ? 2 : 1,
          material: isPrime
            ? Cesium.Color.fromCssColorString("#f59e0b").withAlpha(0.6)
            : Cesium.Color.WHITE.withAlpha(0.25),
        },
        show: false,
      });
      graticuleCollection.push(polyline);
    });
  }

  function updateAoiFootprint(bbox, colorHex) {
    if (!aoiEntity || !bbox) return;
    const color = Cesium.Color.fromCssColorString(colorHex || "#c9f31d");
    aoiEntity.polygon.hierarchy = Cesium.Cartesian3.fromDegreesArray([
      bbox.west, bbox.south,
      bbox.east, bbox.south,
      bbox.east, bbox.north,
      bbox.west, bbox.north,
    ]);
    aoiEntity.polygon.material = color.withAlpha(0.2);
    aoiEntity.polygon.outlineColor = color;
  }

  function setLandmarksVisible(visible) {
    if (!landmarksCollection) return;
    landmarksCollection.forEach(function (entity) {
      entity.show = visible;
    });
  }

  function setAoiFootprintVisible(visible) {
    if (aoiEntity) {
      aoiEntity.show = visible;
    }
  }

  function setGraticuleVisible(visible) {
    if (!graticuleCollection) return;
    graticuleCollection.forEach(function (entity) {
      entity.show = visible;
    });
  }

  function setLightingEnabled(enabled) {
    if (viewer) {
      viewer.scene.globe.enableLighting = enabled;
      if (viewer.scene.sun) {
        viewer.scene.sun.show = enabled;
      }
    }
  }

  function clearImageryLayers() {
    while (viewer.imageryLayers.length > 0) {
      viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
    }
    baseLayer = null;
    overlayLayer = null;
  }

  async function setBaseFilter(key) {
    if (!viewer) return;
    activeFilter = key;
    clearImageryLayers();
    const provider = TrekLayers.createProvider(key);
    baseLayer = viewer.imageryLayers.addImageryProvider(provider);
    if (key === "viking") {
      // Grade the globe presentation without altering the elevation data.
      baseLayer.brightness = 0.82;
      baseLayer.contrast = 1.18;
      baseLayer.saturation = 1.10;
    }
    if (overlayFilter) {
      applyOverlay(overlayFilter, overlayOpacity);
    }
  }

  async function applyOverlay(key, opacity) {
    if (!viewer) return;
    overlayFilter = key;
    overlayOpacity = opacity;
    if (overlayLayer) {
      viewer.imageryLayers.remove(overlayLayer, false);
      overlayLayer = null;
    }
    if (!key) return;
    const provider = TrekLayers.createProvider(key);
    overlayLayer = viewer.imageryLayers.addImageryProvider(provider);
    overlayLayer.alpha = opacity;
  }

  function setOverlayBlend(key, opacity) {
    if (key === activeFilter) {
      return applyOverlay(null, opacity);
    }
    return applyOverlay(key, opacity);
  }

  function flyTo(lat, lon, heightMeters, duration) {
    if (!viewer) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, heightMeters),
      duration: duration != null ? duration : 1.5,
    });
  }

  function getCameraState() {
    if (!viewer) return null;
    const carto = viewer.camera.positionCartographic;
    return {
      lat: Cesium.Math.toDegrees(carto.latitude),
      lon: Cesium.Math.toDegrees(carto.longitude),
      heightM: carto.height,
    };
  }

  function getViewer() {
    return viewer;
  }

  function getActiveFilter() {
    return activeFilter;
  }

  function setGlobeOpacity(alpha) {
    if (viewer) {
      viewer.scene.globe.show = alpha > 0.01;
      if (baseLayer) {
        baseLayer.alpha = alpha;
      }
    }
  }

  function showSiteEntryBanner(lm) {
    const banner = document.getElementById("globe-site-banner");
    if (!banner) return;
    const nameEl = document.getElementById("globe-site-name");
    const coordsEl = document.getElementById("globe-site-coords");
    const enterBtn = document.getElementById("btn-enter-tactical");

    if (nameEl) nameEl.textContent = (lm.name || "Martian Site").toUpperCase();
    if (coordsEl) {
      const latStr = Math.abs(lm.lat).toFixed(2) + (lm.lat >= 0 ? "°N" : "°S");
      const lonStr = Math.abs(lm.lon).toFixed(2) + (lm.lon >= 0 ? "°E" : "°W");
      const sub = lm.siteKey
        ? latStr + ", " + lonStr + " · Surface Exploration Ready"
        : latStr + ", " + lonStr + " · Planetary Orbital Observation";
      coordsEl.textContent = sub;
    }
    if (enterBtn) {
      enterBtn.style.display = lm.siteKey ? "inline-flex" : "none";
      enterBtn.dataset.site = lm.siteKey || "";
      enterBtn.innerHTML = "🗺️ Explore Surface Tactical Radar ➔";
    }
    banner.hidden = false;
  }

  function hideSiteEntryBanner() {
    const banner = document.getElementById("globe-site-banner");
    if (banner) banner.hidden = true;
  }

  return {
    init,
    setBaseFilter,
    setOverlayBlend,
    applyOverlay,
    flyTo,
    getCameraState,
    getViewer,
    getActiveFilter,
    setGlobeOpacity,
    setLandmarksVisible,
    setAoiFootprintVisible,
    updateAoiFootprint,
    setGraticuleVisible,
    setLightingEnabled,
    showSiteEntryBanner,
    hideSiteEntryBanner,
  };
})();
