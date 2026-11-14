/* global L, window, MarsPlaces, MarsData */
window.MarsDetailMap = (function () {
  let map = null;
  let initialized = false;
  let currentSite = "jezero";

  const TREK_BASE = "https://trek.nasa.gov/tiles/Mars/EQ";
  const VIKING_URL = `${TREK_BASE}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`;
  const THEMIS_URL = TREK_BASE + "/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png";
  const CTX_URL = "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}";

  function init() {
    if (initialized) {
      return map;
    }
    initialized = true;

    const MARS_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);

    map = L.map("detail-map-inner", {
      crs: L.CRS.EPSG4326,
      center: [18.4447, 77.4509],
      zoom: 10,
      minZoom: 2,
      maxZoom: 15,
      maxBounds: MARS_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      zoomControl: false,
    });

    // Custom sleek zoom control in bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const bounds = [[-90, -180], [90, 180]];
    L.tileLayer(VIKING_URL, { bounds, noWrap: true, maxNativeZoom: 7, maxZoom: 15,
      attribution: "NASA Viking · Mars Trek" }).addTo(map);
    L.tileLayer(THEMIS_URL, { bounds, noWrap: true, maxNativeZoom: 8, maxZoom: 15,
      className: "surface-warm", attribution: "NASA Odyssey THEMIS · Mars Trek" }).addTo(map);
    L.tileLayer(CTX_URL, { bounds, noWrap: true, tileSize: 512, zoomOffset: -1,
      minZoom: 8, maxNativeZoom: 13, maxZoom: 15, className: "surface-warm",
      attribution: "NASA/JPL/MSSS · CTX · USGS/Esri" }).addTo(map);


    // Listen for site changes to update sector tiles and boundary
    window.addEventListener("mars:site-changed", function (e) {
      if (e.detail && e.detail.siteKey) {
        setSite(e.detail.siteKey);
      }
    });

    return map;
  }

  function flyTo(lat, lon, zoom) {
    if (!map) return;
    map.flyTo([lat, lon], zoom != null ? zoom : 10, { duration: 0.6 });
  }

  function fitBounds(bounds, options) {
    if (!map || !bounds) return;
    map.fitBounds(bounds, options || { padding: [24, 24], maxZoom: 15 });
  }

  async function setSite(siteKey) {
    currentSite = siteKey || "jezero";
    if (!map) return;
    return MarsData.getActiveSiteMeta().then(meta => {
      if (meta.id !== currentSite || !meta.bbox) return;
      const b = meta.bbox;
      map.invalidateSize({pan: false});
      fitBounds([[b.south,b.west],[b.north,b.east]]);
    }).catch(console.warn);
  }

  function getCenter() {
    if (!map) return null;
    const c = map.getCenter();
    return { lat: c.lat, lon: c.lng, zoom: map.getZoom() };
  }

  function invalidateSize() {
    if (map) {
      map.invalidateSize();
      setTimeout(function () {
        if (map) map.invalidateSize();
      }, 100);
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
