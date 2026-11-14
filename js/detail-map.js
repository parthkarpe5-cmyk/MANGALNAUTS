/* global L, window, MarsPlaces, MarsData */
window.MarsDetailMap = (function () {
  let map = null;
  let opmLayer = null;
  let ctxLayer = null;
  let boundaryLayer = null;
  let initialized = false;
  let currentSite = "jezero";

  // 1. OpenPlanetary Mars Global Basemap (Web Mercator, 100% reliable 200 OK)
  const OPM_URL = "https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png";
  // 2. NASA MRO Context Camera (CTX) Global 6m/px Mosaic (Esri Astrogeology / The Murray Lab)
  const CTX_URL = "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}";

  function init() {
    if (initialized) {
      return map;
    }
    initialized = true;

    const MARS_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);

    map = L.map("detail-map-inner", {
      center: [18.4447, 77.35],
      zoom: 10,
      minZoom: 2,
      maxZoom: 16,
      maxBounds: MARS_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      zoomControl: false,
    });

    // Custom sleek zoom control in bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 1. Base Layer: Global OpenPlanetary Mars (Color Mosaic & MOLA Shading)
    opmLayer = L.tileLayer(OPM_URL, {
      maxZoom: 16,
      maxNativeZoom: 12,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
      attribution: "OpenPlanetary Mars / USGS / NASA MOLA",
    }).addTo(map);

    // 2. Ultra-High Resolution Surface Imagery: NASA MRO CTX Mosaic (6m/px)
    ctxLayer = L.tileLayer(CTX_URL, {
      maxZoom: 16,
      maxNativeZoom: 12,
      opacity: 0.88,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
      attribution: "NASA/JPL/MSSS/The Murray Lab CTX Mosaic",
    }).addTo(map);

    // 3. Operational Site Boundary with Distinctive High-Tech Color
    updateSiteBoundary();

    // Listen for site changes to update sector tiles and boundary
    window.addEventListener("mars:site-changed", function (e) {
      if (e.detail && e.detail.siteKey) {
        setSite(e.detail.siteKey);
      }
    });

    return map;
  }

  async function updateSiteBoundary() {
    if (!map) return;
    if (boundaryLayer) {
      map.removeLayer(boundaryLayer);
      boundaryLayer = null;
    }

    const meta = window.MarsData && window.MarsData.getActiveSiteMeta
      ? await MarsData.getActiveSiteMeta()
      : null;

    if (!meta || !meta.bbox) return;

    const b = meta.bbox;
    const color = meta.boundary_color || (currentSite === "gale" ? "#f59e0b" : "#c9f31d");
    const siteTitle = currentSite === "gale" ? "GALE CRATER (MOUNT SHARP)" : "JEZERO CRATER (DELTA)";

    boundaryLayer = L.rectangle(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      {
        color: color,
        weight: 2.5,
        dashArray: "8, 6",
        fillColor: color,
        fillOpacity: 0.04,
        interactive: false,
      }
    ).addTo(map);

    // Add tactical corner label tooltip
    boundaryLayer.bindTooltip(
      `<span style="color: ${color}; font-weight: 800; letter-spacing: 0.08em; font-family: monospace;">⬚ OPERATIONAL SECTOR: ${siteTitle}</span>`,
      {
        permanent: true,
        direction: "top",
        className: "tactical-boundary-tooltip",
        offset: [0, -4],
      }
    );
  }

  function flyTo(lat, lon, zoom) {
    if (!map) return;
    map.flyTo([lat, lon], zoom != null ? zoom : 10, { duration: 0.6 });
  }

  function fitBounds(bounds, options) {
    if (!map || !bounds) return;
    map.fitBounds(bounds, options || { padding: [24, 24], maxZoom: 12 });
  }

  function setSite(siteKey) {
    currentSite = siteKey || "jezero";
    updateSiteBoundary();
    if (!map) return;
    const place = window.MarsPlaces ? window.MarsPlaces[siteKey] : null;
    if (place) {
      if (place.bounds) {
        fitBounds(place.bounds);
      } else {
        flyTo(place.lat, place.lon, place.detailZoom || 10);
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
