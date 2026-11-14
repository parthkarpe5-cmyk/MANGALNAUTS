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

  const LANDMARKS = [
    {
      id: "perseverance",
      name: "Perseverance Rover (Jezero)",
      lat: 18.4447,
      lon: 77.4509,
      alt: 60000,
      color: "#c9f31d",
      description: "NASA Mars 2020 landing site in Jezero Crater.",
    },
    {
      id: "curiosity",
      name: "Curiosity Rover (Gale)",
      lat: -4.5895,
      lon: 137.4417,
      alt: 80000,
      color: "#38bdf8",
      description: "NASA Mars Science Laboratory landing site in Gale Crater.",
    },
    {
      id: "insight",
      name: "InSight Lander (Elysium)",
      lat: 4.5024,
      lon: 135.6234,
      alt: 120000,
      color: "#fbbf24",
      description: "NASA interior exploration and seismic station.",
    },
    {
      id: "opportunity",
      name: "Opportunity Rover (Meridiani)",
      lat: -1.9462,
      lon: 354.4734,
      alt: 120000,
      color: "#a78bfa",
      description: "Explored Victoria and Endeavour craters for 14 years.",
    },
    {
      id: "spirit",
      name: "Spirit Rover (Gusev)",
      lat: -14.5684,
      lon: 175.4726,
      alt: 120000,
      color: "#f472b6",
      description: "Explored Gusev Crater and Columbia Hills.",
    },
    {
      id: "olympus",
      name: "Olympus Mons",
      lat: 18.65,
      lon: -133.8,
      alt: 650000,
      color: "#f97316",
      description: "Highest volcano and planetary mountain in the Solar System (21.9 km).",
    },
    {
      id: "valles_marineris",
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
    });

    viewer.scene.globe.ellipsoid = Cesium.Ellipsoid.MARS;
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
    if (viewer.scene.sun) viewer.scene.sun.show = false;
    if (viewer.scene.moon) viewer.scene.moon.show = false;

    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.maximumScreenSpaceError = 2.5;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#4a3628");
    viewer.scene.globe.show = true;

    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider({
      ellipsoid: Cesium.Ellipsoid.MARS,
    });
    try {
      viewer.terrainProvider = new Cesium.ArcGisImageServerTerrainProvider({
        url: MDEM_URL,
        ellipsoid: Cesium.Ellipsoid.MARS,
      });
    } catch (err) {
      console.warn("MDEM terrain unavailable, using smooth ellipsoid.", err);
    }

    viewer.imageryLayers.removeAll();
    await setBaseFilter("viking");

    initOptionalLayers();

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(77.58, 18.44, 8000000),
    });

    // Handle clicks on landmark pins
    const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction(function (movement) {
      const pickedObject = viewer.scene.pick(movement.position);
      if (
        Cesium.defined(pickedObject) &&
        pickedObject.id &&
        pickedObject.id.landmarkData
      ) {
        const d = pickedObject.id.landmarkData;
        flyTo(d.lat, d.lon, d.alt, 2.0);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return viewer;
  }

  function initOptionalLayers() {
    // 1. Landmarks
    landmarksCollection = [];
    LANDMARKS.forEach(function (lm) {
      const entity = viewer.entities.add({
        name: lm.name,
        position: Cesium.Cartesian3.fromDegrees(lm.lon, lm.lat, 500),
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString(lm.color),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: lm.name,
          font: "12px sans-serif",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15000000),
        },
      });
      entity.landmarkData = lm;
      landmarksCollection.push(entity);
    });

    // 2. Jezero AOI Footprint
    aoiEntity = viewer.entities.add({
      name: "Jezero Pilot AOI Boundary",
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          77.53, 18.39,
          77.63, 18.39,
          77.63, 18.49,
          77.53, 18.49,
        ]),
        material: Cesium.Color.fromCssColorString("#c9f31d").withAlpha(0.18),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#c9f31d"),
        outlineWidth: 2,
        height: 100,
      },
      show: true,
    });

    // 3. Graticule
    graticuleCollection = [];
    // Parallels (-60, -30, 0, 30, 60)
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

    // Meridians (-120, -60, 0, 60, 120, 180)
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
    setGraticuleVisible,
    setLightingEnabled,
  };
})();
