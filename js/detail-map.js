/* global L, window */
window.MarsDetailMap = (function () {
  let map = null;
  let molaLayer = null;
  let ctxLayer = null;
  let activeBase = null;
  let initialized = false;

  function init() {
    if (initialized) {
      return map;
    }
    initialized = true;

    const MARS_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);

    map = L.map("detail-map-inner", {
      center: [18.44, 77.58],
      zoom: 9,
      minZoom: 1,
      maxZoom: 11,
      maxBounds: MARS_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
    });

    molaLayer = L.esri.tiledMapLayer({
      url: "https://astro.arcgis.com/arcgis/rest/services/OnMars/MColorDEM/MapServer",
      maxZoom: 11,
      attribution:
        "NASA MGS MOLA · USGS Astrogeology · Esri / astro.arcgis.com",
    });

    ctxLayer = L.esri.tiledMapLayer({
      url: "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer",
      maxZoom: 11,
      attribution:
        "NASA/JPL/MSSS/The Murray Lab · CTX beta mosaic · Esri / astro.arcgis.com",
    });

    molaLayer.setOpacity(0.55);
    molaLayer.addTo(map);
    ctxLayer.addTo(map);
    activeBase = ctxLayer;

    return map;
  }

  function flyTo(lat, lon, zoom) {
    if (!map) return;
    map.flyTo([lat, lon], zoom != null ? zoom : 10, { duration: 0.6 });
  }

  function getCenter() {
    if (!map) return null;
    const c = map.getCenter();
    return { lat: c.lat, lon: c.lng, zoom: map.getZoom() };
  }

  function invalidateSize() {
    if (map) {
      map.invalidateSize();
    }
  }

  function isReady() {
    return initialized;
  }

  function getMap() {
    return map;
  }

  return { init, flyTo, getCenter, invalidateSize, isReady, getMap };
})();