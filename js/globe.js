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

  async function init(containerId) {
    Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;

    viewer = new Cesium.Viewer(containerId, {
      animation: false,
      timeline: false,
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: true,
      navigationHelpButton: false,
      fullscreenButton: true,
      infoBox: false,
      selectionIndicator: false,
      terrain: undefined,
    });

    viewer.scene.globe.ellipsoid = Cesium.Ellipsoid.MARS;
    if (viewer.scene.skyBox) {
      viewer.scene.skyBox.show = false;
    }
    if (viewer.scene.sun) {
      viewer.scene.sun.show = false;
    }
    if (viewer.scene.moon) {
      viewer.scene.moon.show = false;
    }
    viewer.scene.backgroundColor = Cesium.Color.BLACK;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.maximumScreenSpaceError = 2.5;
    viewer.scene.globe.baseColor =
      Cesium.Color.fromCssColorString("#4a3628");
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

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        77.58,
        18.44,
        8000000
      ),
    });

    return viewer;
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
    let provider;
    provider = TrekLayers.createProvider(key);
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
    setBaseFilter /* async */,
    setOverlayBlend,
    applyOverlay,
    flyTo,
    getCameraState,
    getViewer,
    getActiveFilter,
    setGlobeOpacity,
  };
})();