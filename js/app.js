/* global MarsGlobe, MarsHybrid, MarsDetailMap, MarsPlaces, TrekLayers, MarsTravelMode, MarsSegmentDrawer, MarsSegmentPick, MarsData, MarsTelemetry, MarsHeatmap, MarsPresetRoutes, MarsScienceStops, MarsTheme, MarsAudio, MarsHistoricalTraverses, MarsGrsOverlays, Cesium */
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
  const travelMode = document.getElementById("travel-mode");
  const planSegment = document.getElementById("plan-segment");
  const clearSegment = document.getElementById("clear-segment");

  // Theme & Audio Controls
  const themeSelector = document.getElementById("theme-selector");
  const audioToggle = document.getElementById("audio-toggle");
  const audioLabel = document.getElementById("audio-label");
  const windToggle = document.getElementById("ambient-wind-toggle");
  const windLabel = document.getElementById("wind-label");

  // Optional globe layers controls
  const globeLayersToggle = document.getElementById("globe-layers-toggle");
  const globeLayersMenu = document.getElementById("globe-layers-menu");
  const toggleLandmarks = document.getElementById("toggle-landmarks");
  const toggleTraverses = document.getElementById("toggle-traverses");
  const toggleAoi = document.getElementById("toggle-aoi");
  const toggleGraticule = document.getElementById("toggle-graticule");
  const toggleLighting = document.getElementById("toggle-lighting");
  const grsSelect = document.getElementById("grs-element-select");

  // Detail map layer controls
  const heatmapModeSelect = document.getElementById("heatmap-mode");
  const togglePresetRoutes = document.getElementById("toggle-preset-routes");
  const toggleScienceStops = document.getElementById("toggle-science-stops");

  let detailLayersInitialized = false;

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
    if (window.MarsAudio) MarsAudio.playClick();
    MarsGlobe.setBaseFilter(filterSelect.value).then(function () {
      if (filterLabel) {
        filterLabel.textContent = TrekLayers.labelFor(filterSelect.value);
      }
      syncOverlay();
    });
  }

  function flyToPlace(key) {
    if (window.MarsAudio) MarsAudio.playClick();
    const place = MarsPlaces[key];
    if (!place) return;

    // Switch active site in MarsData
    if (place.siteKey && window.MarsData) {
      window.MarsData.setActiveSite(place.siteKey).catch(console.warn);
    }

    MarsGlobe.flyTo(place.lat, place.lon, place.globeHeight, 1.5);
    if (MarsDetailMap.isReady()) {
      MarsDetailMap.setSite(key);
      if (MarsHybrid.isInDetailMode()) {
        MarsDetailMap.flyTo(place.lat, place.lon, place.detailZoom);
      }
    }
  }

  function ensureDetailLayers() {
    if (!MarsDetailMap.isReady()) return;
    const map = MarsDetailMap.getMap();
    if (!map) return;

    if (!detailLayersInitialized) {
      detailLayersInitialized = true;
      MarsScienceStops.init(map);
      MarsPresetRoutes.init(map);
      if (window.MarsHistoricalTraverses) {
        MarsHistoricalTraverses.initLeaflet(map);
      }
    }

    if (heatmapModeSelect) {
      MarsHeatmap.setMode(map, heatmapModeSelect.value);
    }
    if (togglePresetRoutes) {
      MarsPresetRoutes.setVisible(map, togglePresetRoutes.checked);
    }
    if (toggleScienceStops) {
      MarsScienceStops.setVisible(map, toggleScienceStops.checked);
    }
    if (toggleTraverses && window.MarsHistoricalTraverses) {
      MarsHistoricalTraverses.setVisible(toggleTraverses.checked, map, MarsGlobe.getViewer());
    }
  }

  function syncAudioButton() {
    if (!audioLabel || !window.MarsAudio) return;
    const muted = MarsAudio.isMuted();
    audioLabel.textContent = muted ? "AUDIO: OFF" : "AUDIO: ON";
    if (audioToggle) {
      audioToggle.classList.toggle("muted", muted);
    }
  }

  async function bootstrap() {
    MarsSegmentDrawer.init("segment-drawer");
    MarsData.loadGraph().catch(console.warn);
    MarsTelemetry.init("telemetry-bar").catch(console.warn);

    // Init theme
    if (themeSelector && window.MarsTheme) {
      themeSelector.value = MarsTheme.get();
      themeSelector.addEventListener("change", function () {
        MarsTheme.apply(themeSelector.value);
        if (window.MarsAudio) MarsAudio.playClick();
      });
    }

    // Init audio button
    if (audioToggle && window.MarsAudio) {
      syncAudioButton();
      audioToggle.addEventListener("click", function () {
        MarsAudio.setMuted(!MarsAudio.isMuted());
        syncAudioButton();
        if (!MarsAudio.isMuted()) MarsAudio.playClick();
      });
    }

    // Init ambient Martian wind button
    if (windToggle && window.MarsAudio) {
      windToggle.addEventListener("click", function () {
        const active = MarsAudio.toggleAmbientWind();
        if (windLabel) {
          windLabel.textContent = active ? "WIND: ON" : "WIND: OFF";
        }
        windToggle.classList.toggle("active-wind", active);
      });
    }

    populateFilters();
    try {
      await MarsGlobe.init("globe");
      onFilterChange();
    } catch (e) {
      console.error("[MarsGlobe] Globe init error:", e);
      const hud = document.getElementById("globe");
      if (hud) {
        hud.innerHTML =
          '<p style="padding:1rem;color:#f88;">Failed to start 3D globe: ' +
          (e.message || e) +
          "</p>";
      }
    }

    try {
      MarsHybrid.init({
        detailPane: document.getElementById("detail-pane"),
        modeEl,
        heightEl,
        onDetailChange: function (isDetail) {
          if (isDetail) {
            ensureDetailLayers();
          }
        },
      });
    } catch (e) {
      console.error("[MarsHybrid] Hybrid init error:", e);
    }

    const viewer = MarsGlobe.getViewer();
    if (viewer && viewer.scene && viewer.scene.canvas) {
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
    }

    filterSelect.addEventListener("change", onFilterChange);
    overlayToggle.addEventListener("change", function () {
      if (window.MarsAudio) MarsAudio.playClick();
      syncOverlay();
    });
    overlayOpacity.addEventListener("input", syncOverlay);
    locationSelect.addEventListener("change", function () {
      flyToPlace(locationSelect.value);
    });
    if (syncDetailBtn) {
      syncDetailBtn.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsHybrid.syncFromDetail();
      });
    }
    if (aboutToggle && aboutPanel) {
      aboutToggle.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        aboutPanel.hidden = !aboutPanel.hidden;
      });
    }

    // Globe layers menu toggle
    if (globeLayersToggle && globeLayersMenu) {
      globeLayersToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        if (window.MarsAudio) MarsAudio.playClick();
        globeLayersMenu.hidden = !globeLayersMenu.hidden;
      });
      document.addEventListener("click", function () {
        if (!globeLayersMenu.hidden) {
          globeLayersMenu.hidden = true;
        }
      });
      globeLayersMenu.addEventListener("click", function (e) {
        e.stopPropagation();
      });
    }

    if (toggleLandmarks) {
      toggleLandmarks.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsGlobe.setLandmarksVisible(toggleLandmarks.checked);
      });
    }
    if (toggleTraverses) {
      toggleTraverses.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        const map = MarsDetailMap.isReady() ? MarsDetailMap.getMap() : null;
        if (window.MarsHistoricalTraverses) {
          MarsHistoricalTraverses.setVisible(toggleTraverses.checked, map, viewer);
        }
      });
    }
    if (toggleAoi) {
      toggleAoi.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsGlobe.setAoiFootprintVisible(toggleAoi.checked);
      });
    }
    if (toggleGraticule) {
      toggleGraticule.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsGlobe.setGraticuleVisible(toggleGraticule.checked);
      });
    }
    if (toggleLighting) {
      toggleLighting.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsGlobe.setLightingEnabled(toggleLighting.checked);
      });
    }

    // Odyssey GRS ISRU Select
    if (grsSelect) {
      grsSelect.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        const val = grsSelect.value;
        const elemKey = val === "none" ? null : val;
        const map = MarsDetailMap.isReady() ? MarsDetailMap.getMap() : null;
        if (window.MarsGrsOverlays) {
          MarsGrsOverlays.applyCesium(viewer, elemKey, 0.65);
          if (map) {
            MarsGrsOverlays.applyLeaflet(map, elemKey, 0.65);
          }
        }
      });
    }

    // Detail map controls
    if (heatmapModeSelect) {
      heatmapModeSelect.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        const map = MarsDetailMap.getMap();
        if (map) {
          MarsHeatmap.setMode(map, heatmapModeSelect.value);
        }
      });
    }

    if (togglePresetRoutes) {
      togglePresetRoutes.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        const map = MarsDetailMap.getMap();
        if (map) {
          MarsPresetRoutes.setVisible(map, togglePresetRoutes.checked);
        }
      });
    }

    if (toggleScienceStops) {
      toggleScienceStops.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        const map = MarsDetailMap.getMap();
        if (map) {
          MarsScienceStops.setVisible(map, toggleScienceStops.checked);
        }
      });
    }

    if (travelMode) {
      travelMode.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsTravelMode.set(travelMode.value);
        if (modeEl) {
          modeEl.textContent =
            MarsTravelMode.get().label +
            " · " +
            (MarsHybrid.isInDetailMode() ? "Surface" : "Planet");
        }
      });
      MarsTravelMode.set(travelMode.value);
    }

    if (planSegment) {
      planSegment.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (planSegment.checked && !MarsHybrid.isInDetailMode()) {
          const key = locationSelect ? locationSelect.value : "jezero";
          flyToPlace(key || "jezero");
        }
        MarsSegmentPick.setActive(planSegment.checked);
      });
    }
    if (clearSegment) {
      clearSegment.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        MarsSegmentPick.reset();
      });
    }

    MarsTravelMode.onChange(function (m) {
      if (modeEl && !MarsHybrid.isInDetailMode()) {
        modeEl.textContent = m.label + " · Planet";
      }
    });

    if (modeEl) {
      modeEl.textContent = MarsTravelMode.get().label + " · Planet";
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
