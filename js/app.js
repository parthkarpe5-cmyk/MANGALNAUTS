/* global MarsGlobe, MarsHybrid, MarsDetailMap, MarsPlaces, TrekLayers */
(function () {
  function formatCoord(lat, lon) {
    const ns = lat >= 0 ? "N" : "S";
    const ew = lon >= 0 ? "E" : "W";
    return (
      Math.abs(lat).toFixed(3) +
      "°" +
      ns +
      ", " +
      Math.abs(lon).toFixed(3) +
      "°" +
      ew
    );
  }

  const filterSelect = document.getElementById("globe-filter");
  const overlayToggle = document.getElementById("overlay-mola");
  const overlayOpacity = document.getElementById("overlay-opacity");
  const locationSelect = document.getElementById("location");
  const coordsEl = document.getElementById("coords");
  const modeEl = document.getElementById("mode-label");
  const heightEl = document.getElementById("camera-height");
  const filterLabel = document.getElementById("filter-label");
  const syncDetailBtn = document.getElementById("sync-globe-btn");
  const aboutToggle = document.getElementById("about-toggle");
  const aboutPanel = document.getElementById("about-panel");

  function populateFilters() {
    TrekLayers.keys().forEach(function (key) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = TrekLayers.labelFor(key);
      filterSelect.appendChild(opt);
    });
    filterSelect.value = "viking";
  }

  function syncOverlay() {
    const on = overlayToggle.checked;
    const opacity = parseFloat(overlayOpacity.value);
    const promise =
      on && filterSelect.value !== "mola"
        ? MarsGlobe.setOverlayBlend("mola", opacity)
        : MarsGlobe.setOverlayBlend(null, opacity);
    if (promise && promise.then) {
      promise.catch(console.warn);
    }
    overlayToggle.disabled = filterSelect.value === "mola";
  }

  function onFilterChange() {
    MarsGlobe.setBaseFilter(filterSelect.value).then(function () {
      if (filterLabel) {
        filterLabel.textContent = TrekLayers.labelFor(filterSelect.value);
      }
      syncOverlay();
    });
  }

  function flyToPlace(key) {
    const place = MarsPlaces[key];
    if (!place) return;
    MarsGlobe.flyTo(place.lat, place.lon, place.globeHeight, 1.5);
    if (MarsDetailMap.isReady() && MarsHybrid.isInDetailMode()) {
      MarsDetailMap.flyTo(place.lat, place.lon, place.detailZoom);
    }
  }

  async function bootstrap() {
    populateFilters();
    await MarsGlobe.init("globe");
    onFilterChange();

    MarsHybrid.init({
      detailPane: document.getElementById("detail-pane"),
      modeEl,
      heightEl,
      onDetailChange: function () {},
    });

    const viewer = MarsGlobe.getViewer();
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function (movement) {
      const cartesian = viewer.camera.pickEllipsoid(
        movement.endPosition,
        viewer.scene.globe.ellipsoid
      );
      if (cartesian && coordsEl) {
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        coordsEl.textContent = formatCoord(
          Cesium.Math.toDegrees(carto.latitude),
          Cesium.Math.toDegrees(carto.longitude)
        );
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    filterSelect.addEventListener("change", onFilterChange);
    overlayToggle.addEventListener("change", syncOverlay);
    overlayOpacity.addEventListener("input", syncOverlay);
    locationSelect.addEventListener("change", function () {
      flyToPlace(locationSelect.value);
    });
    if (syncDetailBtn) {
      syncDetailBtn.addEventListener("click", function () {
        MarsHybrid.syncFromDetail();
      });
    }
    if (aboutToggle && aboutPanel) {
      aboutToggle.addEventListener("click", function () {
        aboutPanel.hidden = !aboutPanel.hidden;
      });
    }

    if (modeEl) {
      modeEl.textContent = "Planet";
    }
    if (filterLabel) {
      filterLabel.textContent = TrekLayers.labelFor("viking");
    }
  }

  bootstrap().catch(function (err) {
    console.error(err);
    const hud = document.getElementById("globe");
    if (hud) {
      hud.innerHTML =
        '<p style="padding:1rem;color:#f88;">Failed to start globe: ' +
        err.message +
        "</p>";
    }
  });
})();