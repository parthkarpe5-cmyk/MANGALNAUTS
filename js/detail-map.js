/* global L, window, MarsPlaces */
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
      center: [18.4447, 77.4509],
      zoom: 10,
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

  function fitBounds(bounds, options) {
    if (!map || !bounds) return;
    map.fitBounds(bounds, options || { padding: [20, 20], maxZoom: 11 });
  }

  function setSite(siteKey) {
    if (!map) return;
    const place = window.MarsPlaces ? window.MarsPlaces[siteKey] : null;
    if (place) {
      if (place.bounds) {
        fitBounds(place.bounds);
      } else {
        flyTo(place.lat, place.lon, place.detailZoom);
      }
    }
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

  return { init, flyTo, fitBounds, setSite, getCenter, invalidateSize, isReady, getMap };
})();
