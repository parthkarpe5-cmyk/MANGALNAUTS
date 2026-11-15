/* global L, window, MarsPlaces, MarsData */
window.MarsDetailMap = (function () {
  let map = null;
  let initialized = false;
  let currentSite = "jezero";
  let coverageBounds = null;
  let pendingCoverageFit = false;

  const TREK_BASE = "https://trek.nasa.gov/tiles/Mars/EQ";
  const VIKING_URL = `${TREK_BASE}/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`;
  const THEMIS_URL = TREK_BASE + "/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png";
  const CTX_URL = "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}";

  const MARS_BOUNDS = L.latLngBounds([-90, -180], [90, 180]);

  function init() {
    if (initialized) {
      return map;
    }
    initialized = true;

    map = L.map("detail-map-inner", {
      crs: L.CRS.EPSG4326,
      center: [18.4447, 77.4509],
      zoom: 10,
      zoomSnap: 0.25,
      minZoom: 2,
      maxZoom: 15,
      maxBounds: MARS_BOUNDS,
      maxBoundsViscosity: 0.3,
      worldCopyJump: false,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
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


    map.on("resize", fitCoverageWhenVisible);

    // Listen for site changes to update the selectable terrain
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

  function fitCoverageWhenVisible() {
    const container = map.getContainer();
    if (!container.clientWidth || !container.clientHeight) return;

    // Maintain global Mars exploration freedom: unrestricted panning and zooming
    map.setMaxBounds(MARS_BOUNDS);
    map.setMinZoom(2);

    if (pendingCoverageFit && coverageBounds) {
      map.fitBounds(coverageBounds, { padding: [32, 32], maxZoom: 12, animate: false });
      pendingCoverageFit = false;
    }
  }

  async function setSite(siteKey) {
    currentSite = siteKey || "jezero";
    const requestedSite = currentSite;
    if (!map) return;

    try {
      const graph = await MarsData.loadRegionalGraph();
      if (requestedSite !== currentSite) return;
      const b = graph?.bbox;
      if (b) {
        coverageBounds = L.latLngBounds([b.south, b.west], [b.north, b.east]);
      } else if (window.MarsPlaces && window.MarsPlaces[currentSite]?.bounds) {
        coverageBounds = L.latLngBounds(window.MarsPlaces[currentSite].bounds);
      }
      pendingCoverageFit = true;
      map.invalidateSize({ pan: false });
      fitCoverageWhenVisible();
    } catch (error) {
      if (window.MarsPlaces && window.MarsPlaces[currentSite]?.bounds) {
        coverageBounds = L.latLngBounds(window.MarsPlaces[currentSite].bounds);
        pendingCoverageFit = true;
        fitCoverageWhenVisible();
      }
      console.warn("Could not load regional terrain coverage", error);
    }
  }

  function getCenter() {
    if (!map) return null;
    const c = map.getCenter();
    return { lat: c.lat, lon: c.lng, zoom: map.getZoom() };
  }

  function invalidateSize() {
    if (map) {
      map.invalidateSize({ pan: false });
      if (pendingCoverageFit) {
        fitCoverageWhenVisible();
      }
      setTimeout(function () {
        if (map) {
          map.invalidateSize({ pan: false });
          if (pendingCoverageFit) {
            fitCoverageWhenVisible();
          }
        }
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
