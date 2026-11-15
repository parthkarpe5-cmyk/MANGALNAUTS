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
      alt: 123000,
      color: "#c9f31d",
      description: "NASA Mars 2020 landing site in Jezero Crater Western Delta.",
    },
    {
      id: "curiosity",
      siteKey: "gale",
      name: "Curiosity Rover (Gale)",
      lat: -4.650,
      lon: 137.400,
      alt: 632000,
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

    const marsGlobe = new Cesium.Globe(Cesium.Ellipsoid.MARS);
    marsGlobe.baseColor = Cesium.Color.fromCssColorString("#1a0804");
    marsGlobe.enableLighting = true;
    marsGlobe.depthTestAgainstTerrain = false;

    const marsSkyAtmosphere = new Cesium.SkyAtmosphere(Cesium.Ellipsoid.MARS);
    marsSkyAtmosphere.show = true;
    marsSkyAtmosphere.hueShift = -0.55;
    marsSkyAtmosphere.saturationShift = 0.4;
    marsSkyAtmosphere.brightnessShift = -0.2;

    viewer = new Cesium.Viewer(containerId, {
      globe: marsGlobe,
      skyAtmosphere: marsSkyAtmosphere,
      terrainProvider: new Cesium.EllipsoidTerrainProvider({ ellipsoid: Cesium.Ellipsoid.MARS }),
      showRenderLoopErrors: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      skyBox: false,
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
      contextOptions: {
        webgl: {
          alpha: true,
        },
      },
    });

    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1.0, 1.25);
    viewer.camera.percentageChanged = 0.01;

    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0B0B0F");
    viewer.scene.postProcessStages.fxaa.enabled = true;

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
      if (terrainProvider && terrainProvider.ready !== false) {
        viewer.terrainProvider = terrainProvider;
      }
    } catch (e) {
      console.warn("[MarsGlobe] MDEM elevation unavailable, falling back to ellipsoid:", e);
    }

    await initOptionalLayers();
    window.MarsOrbiters?.init(viewer).catch(console.warn);

    // Init Historical Traverses on 3D globe
    if (window.MarsHistoricalTraverses) {
      window.MarsHistoricalTraverses.initCesium(viewer).catch(console.warn);
    }

    // Landmark & Route picking click listener on 3D globe
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction(function (movement) {
      if (window.MarsSegmentPick && window.MarsSegmentPick.isActive && window.MarsSegmentPick.isActive()) {
        const ray = viewer.camera.getPickRay(movement.position);
        const hit = ray && (viewer.scene.globe.pick(ray, viewer.scene) || viewer.camera.pickEllipsoid(movement.position, Cesium.Ellipsoid.MARS));
        if (hit) {
          const carto = Cesium.Cartographic.fromCartesian(hit, Cesium.Ellipsoid.MARS);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          if (window.MarsSegmentPick.onMapClick) {
            window.MarsSegmentPick.onMapClick({ latlng: { lat, lng: lon } });
            return;
          }
        }
      }

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

    // Initial camera position: If cosmic intro is active, start in deep space (32,000 km) for smooth fly-in
    const isIntroActive = window.MarsCosmicIntro && window.MarsCosmicIntro.isRunning && window.MarsCosmicIntro.isRunning();
    const initAlt = isIntroActive ? 32000000 : 11500000;
    const initLon = isIntroActive ? 22.0 : 35.0;
    const initLat = isIntroActive ? 4.0 : 10.0;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(initLon, initLat, initAlt),
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

    initGoogleEarthHud();

    return viewer;
  }

  function initGoogleEarthHud() {
    if (!viewer) return;

    const compassDial = document.getElementById("compass-dial");
    const compassBtn = document.getElementById("globe-compass");
    const tiltBtn = document.getElementById("globe-tilt-btn");
    const tiltText = document.getElementById("globe-tilt-text");
    const zoomInBtn = document.getElementById("globe-zoom-in");
    const zoomOutBtn = document.getElementById("globe-zoom-out");
    const chipCoords = document.getElementById("globe-chip-coords");
    const chipAlt = document.getElementById("globe-chip-alt");
    const chipHeading = document.getElementById("globe-chip-heading");

    let isMouseOverGlobe = false;
    let lastHoverCoords = null;

    function updateHud() {
      if (!viewer || !viewer.camera) return;
      const camera = viewer.camera;
      const headingRad = camera.heading;
      const headingDeg = Cesium.Math.toDegrees(headingRad);
      const pitchDeg = Cesium.Math.toDegrees(camera.pitch);
      const carto = camera.positionCartographic;
      const height = carto ? carto.height : 0;

      // Update Compass dial rotation (rotate needle to point Martian North)
      if (compassDial) {
        compassDial.style.transform = "rotate(" + (-headingDeg) + "deg)";
      }

      // Update 3D/2D Tilt Button Text and state
      if (tiltText && tiltBtn) {
        tiltText.textContent = pitchDeg < -65 ? "3D" : "2D";
        tiltBtn.classList.toggle("active-tilted", pitchDeg >= -65);
      }

      // Update Eye Altitude in chip: m below 10 km, km below 10,000 km, Mm above
      if (chipAlt) {
        let altStr = "";
        if (height < 10000) {
          altStr = "EYE " + Math.round(height).toLocaleString() + " m";
        } else if (height < 10000000) {
          altStr = "EYE " + Math.round(height / 1000).toLocaleString() + " km";
        } else {
          altStr = "EYE " + (height / 1000000).toFixed(1) + " Mm";
        }
        chipAlt.textContent = altStr;
      }

      // Update Heading in chip
      if (chipHeading) {
        const normHdg = Math.round((headingDeg + 360) % 360);
        chipHeading.textContent = "HDG " + String(normHdg).padStart(3, "0") + "°";
      }

      // Coords: display camera center when mouse is not hovering
      if (chipCoords && (!lastHoverCoords || !isMouseOverGlobe)) {
        if (carto) {
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lon = Cesium.Math.toDegrees(carto.longitude);
          const ns = lat >= 0 ? "°N" : "°S";
          const ew = lon >= 0 ? "°E" : "°W";
          chipCoords.textContent = Math.abs(lat).toFixed(3) + ns + ", " + Math.abs(lon).toFixed(3) + ew;
        }
      }
    }

    viewer.camera.changed.addEventListener(updateHud);
    updateHud();

    // Snap to North
    if (compassBtn) {
      compassBtn.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        const camera = viewer.camera;
        viewer.camera.flyTo({
          destination: camera.positionCartographic,
          orientation: {
            heading: 0,
            pitch: camera.pitch,
            roll: 0,
          },
          duration: 0.8,
        });
      });
    }

    // Toggle 3D Oblique / 2D Nadir Tilt
    if (tiltBtn) {
      tiltBtn.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        const camera = viewer.camera;
        const currentPitchDeg = Cesium.Math.toDegrees(camera.pitch);
        const targetPitch = currentPitchDeg < -65 ? Cesium.Math.toRadians(-45) : Cesium.Math.toRadians(-90);
        viewer.camera.flyTo({
          destination: camera.positionCartographic,
          orientation: {
            heading: camera.heading,
            pitch: targetPitch,
            roll: 0,
          },
          duration: 0.8,
        });
      });
    }

    // Zoom buttons
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        if (viewer.camera && viewer.camera.positionCartographic) {
          const height = viewer.camera.positionCartographic.height;
          viewer.camera.zoomIn(height * 0.35);
          updateHud();
        }
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        if (viewer.camera && viewer.camera.positionCartographic) {
          const height = viewer.camera.positionCartographic.height;
          viewer.camera.zoomOut(height * 0.45);
          updateHud();
        }
      });
    }

    // Mouse movement coordinate tracker on the 3D globe surface
    const canvas = viewer.scene.canvas;
    if (canvas) {
      canvas.addEventListener("mouseenter", function () { isMouseOverGlobe = true; });
      canvas.addEventListener("mouseleave", function () {
        isMouseOverGlobe = false;
        lastHoverCoords = null;
        updateHud();
      });

      const moveHandler = new Cesium.ScreenSpaceEventHandler(canvas);
      let rafPending = false;
      let lastMovePos = null;

      moveHandler.setInputAction(function (movement) {
        lastMovePos = movement.endPosition;
        if (rafPending) return;
        rafPending = true;

        requestAnimationFrame(function () {
          rafPending = false;
          if (!lastMovePos || !chipCoords || !viewer.scene || !isMouseOverGlobe) return;
          const cartesian = viewer.camera.pickEllipsoid(
            lastMovePos,
            viewer.scene.globe.ellipsoid
          );
          if (cartesian) {
            const carto = Cesium.Cartographic.fromCartesian(
              cartesian,
              Cesium.Ellipsoid.MARS
            );
            const lat = Cesium.Math.toDegrees(carto.latitude);
            const lon = Cesium.Math.toDegrees(carto.longitude);
            const ns = lat >= 0 ? "°N" : "°S";
            const ew = lon >= 0 ? "°E" : "°W";
            lastHoverCoords = Math.abs(lat).toFixed(3) + ns + ", " + Math.abs(lon).toFixed(3) + ew;
            chipCoords.textContent = lastHoverCoords;
          }
        });
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }
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
      entity.show = false;
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
      show: false,
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
    if (viewer.scene) {
      viewer.scene.requestRender();
    }
  }

  function requestRender() {
    if (viewer && viewer.scene) {
      viewer.scene.requestRender();
    }
  }

  function setContinuousRender(enable) {
    if (viewer && viewer.scene) {
      viewer.scene.requestRenderMode = !enable;
      if (!enable) {
        viewer.scene.requestRender();
      }
    }
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

  function prepareForCosmicIntro() {
    if (!viewer) return;
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(22.0, 4.0, 32000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    });
    if (viewer.scene) {
      viewer.scene.requestRender();
    }
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
    requestRender,
    setContinuousRender,
    prepareForCosmicIntro,
  };
})();
