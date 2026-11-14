/* global L, window, MarsPlaces, MarsData */
window.MarsDetailMap = (function () {
  let map = null;
  let vikingLayer = null;
  let reliefLayer = null;
  let hiriseLayer = null;
  let boundaryLayer = null;
  let initialized = false;
  let currentSite = "jezero";

  const TREK_BASE = "https://trek.nasa.gov/tiles/Mars/EQ";
  const VIKING_URL = `${TREK_BASE}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`;
  const RELIEF_URL = `${TREK_BASE}/Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw/1.0.0/default/default028mm/{z}/{y}/{x}.png`;
  const JEZERO_HIRISE_URL = `${TREK_BASE}/NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018/1.0.0/default/default028mm/{z}/{y}/{x}.png`;
  const GALE_HIRISE_URL = `${TREK_BASE}/curiosity_hirise_mosaic/1.0.0/default/default028mm/{z}/{y}/{x}.png`;

  function init() {
    if (initialized) {
      return map;
    }
    initialized = true;

    const MARS_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);

    map = L.map("detail-map-inner", {
      center: [18.4447, 77.4509],
      zoom: 10,
      minZoom: 2,
      maxZoom: 17,
      maxBounds: MARS_BOUNDS,
      maxBoundsViscosity: 1,
      worldCopyJump: false,
      zoomControl: false,
    });

    // Custom sleek zoom control in bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // 1. Base Layer: Global NASA Viking MDIM 2.1 Color Mosaic (232m/px)
    vikingLayer = L.tileLayer(VIKING_URL, {
      maxZoom: 17,
      maxNativeZoom: 9,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
      attribution: "NASA Mars Trek / Viking MDIM 2.1 Mosaic",
    }).addTo(map);

    // 2. Relief Overlay: HRSC-MOLA 200m Shaded Relief (3D depth)
    reliefLayer = L.tileLayer(RELIEF_URL, {
      maxZoom: 17,
      maxNativeZoom: 8,
      opacity: 0.5,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
      attribution: "USGS / NASA HRSC-MOLA 200m Relief",
    }).addTo(map);

    // 3. Localized Sub-Meter HiRISE Orthomosaic for Active Hero Sector
    updateHiRiseLayer();

    // 4. Operational Site Boundary with Distinctive High-Tech Color
    updateSiteBoundary();

    // Listen for site changes to update sector tiles and boundary
    window.addEventListener("mars:site-changed", function (e) {
      if (e.detail && e.detail.siteKey) {
        setSite(e.detail.siteKey);
      }
    });

    return map;
  }

  function updateHiRiseLayer() {
    if (!map) return;
    if (hiriseLayer) {
      map.removeLayer(hiriseLayer);
      hiriseLayer = null;
    }

    if (currentSite === "jezero") {
      hiriseLayer = L.tileLayer(JEZERO_HIRISE_URL, {
        minZoom: 8,
        maxZoom: 17,
        maxNativeZoom: 16,
        noWrap: true,
        bounds: [[17.5, 76.5], [19.3, 78.5]],
        attribution: "NASA/JPL/UofA Mars 2020 HiRISE (0.25 m/px)",
        opacity: 0.95,
      }).addTo(map);
    } else if (currentSite === "gale") {
      hiriseLayer = L.tileLayer(GALE_HIRISE_URL, {
        minZoom: 8,
        maxZoom: 17,
        maxNativeZoom: 16,
        noWrap: true,
        bounds: [[-5.2, 137.0], [-4.2, 137.8]],
        attribution: "NASA/JPL/UofA MSL HiRISE (0.25 m/px)",
        opacity: 0.95,
      }).addTo(map);
    }
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
    updateHiRiseLayer();
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
