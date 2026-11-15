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

  // Google Earth-Style Map Presets & Globe Layers
  const mapStylePreset = document.getElementById("map-style-preset");
  const toggleOrbiters = document.getElementById("toggle-orbiters");
  const toggleMoons = document.getElementById("toggle-moons");
  const toggleOrbitPaths = document.getElementById("toggle-orbit-paths");
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
    if (!filterSelect || !window.TrekLayers) return;
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

    MarsSegmentPick.reset();
    if (key === "global") {
      MarsGlobe.flyTo(place.lat, place.lon, place.globeHeight, 2.0);
      if (window.MarsGlobe && window.MarsGlobe.hideSiteEntryBanner) {
        window.MarsGlobe.hideSiteEntryBanner();
      }
      return;
    }

    // Switch active site in MarsData
    if (place.siteKey && window.MarsData) {
      window.MarsData.setActiveSite(place.siteKey).catch(console.warn);
    }

    MarsGlobe.flyTo(place.lat, place.lon, place.globeHeight, 1.5);
    if (window.MarsGlobe && window.MarsGlobe.showSiteEntryBanner) {
      window.MarsGlobe.showSiteEntryBanner({
        name: place.name,
        lat: place.lat,
        lon: place.lon,
        siteKey: place.siteKey,
      });
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
    if (grsSelect && grsSelect.value !== "none" && window.MarsGrsOverlays) {
      MarsGrsOverlays.applyLeaflet(map, grsSelect.value, 0.65);
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

  function initGoogleEarthControls() {
    const railBtnMissions = document.getElementById("rail-btn-missions");
    const railBtnProjects = document.getElementById("rail-btn-projects");
    const railBtnLayers = document.getElementById("rail-btn-layers");
    const railBtnMeasure = document.getElementById("rail-btn-measure");
    const railBtnRoute = document.getElementById("rail-btn-route");
    const railBtnAbout = document.getElementById("rail-btn-about");

    // View Mode Tags (2D, DUAL, 3D)
    ["view-tag-2d", "view-tag-split", "view-tag-3d"].forEach(id => {
      const tagBtn = document.getElementById(id);
      if (tagBtn) {
        tagBtn.addEventListener("click", function () {
          if (window.MarsAudio) MarsAudio.playClick();
          if (window.MarsHybrid) {
            MarsHybrid.setViewMode(tagBtn.dataset.mode);
          }
        });
      }
    });

    const searchInput = document.getElementById("mars-search-input");
    const searchClear = document.getElementById("search-clear-btn");
    const searchResults = document.getElementById("search-results-menu");

    function setRailActive(btn) {
      document.querySelectorAll(".rail-btn").forEach(b => b.classList.remove("active"));
      if (btn) btn.classList.add("active");
    }

    if (railBtnMissions) {
      railBtnMissions.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsWorkspace) MarsWorkspace.show("missions");
      });
    }

    if (railBtnProjects) {
      railBtnProjects.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsWorkspace) MarsWorkspace.show("projects");
      });
    }

    if (railBtnLayers) {
      railBtnLayers.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsWorkspace) MarsWorkspace.show("layers");
      });
    }

    if (railBtnMeasure) {
      railBtnMeasure.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsWorkspace) MarsWorkspace.show("measure");
      });
    }

    if (railBtnRoute) {
      railBtnRoute.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsWorkspace) MarsWorkspace.show("route");
        if (window.MarsHybrid && !window.MarsHybrid.isInDetailMode()) {
          window.MarsHybrid.setViewMode("split");
        }
      });
    }

    if (railBtnAbout) {
      railBtnAbout.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (aboutPanel) {
          aboutPanel.hidden = !aboutPanel.hidden;
        }
      });
    }

    // Sync sector cards in Missions panel
    function syncSectorCards(sec) {
      document.querySelectorAll(".mission-sector-card").forEach(c => {
        const isMatch = c.dataset.sector === sec;
        c.classList.toggle("active", isMatch);
        const st = c.querySelector(".sector-status-live");
        if (st) st.remove();
        if (isMatch) {
          const hdr = c.querySelector(".sector-card-hdr");
          if (hdr) {
            const span = document.createElement("span");
            span.className = "sector-status-live";
            span.textContent = "ACTIVE";
            hdr.appendChild(span);
          }
        }
      });
    }

    document.querySelectorAll(".mission-sector-card").forEach(card => {
      card.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        const sec = card.dataset.sector;
        syncSectorCards(sec);
        if (locationSelect) {
          locationSelect.value = sec;
          locationSelect.dispatchEvent(new Event("change"));
        } else {
          flyToPlace(sec);
        }
      });
    });

    if (locationSelect) {
      locationSelect.addEventListener("change", function () {
        syncSectorCards(locationSelect.value);
      });
    }

    // Unified synchronization for all Expedition Travel Mode controls across UI
    const travelSelectors = [
      document.getElementById("travel-mode"),
      document.getElementById("travel-mode-panel"),
      document.getElementById("travel-mode-measure"),
      document.getElementById("travel-mode-top")
    ].filter(Boolean);

    function syncTravelModeUI(modeObj) {
      if (!modeObj) return;
      const modeId = modeObj.id || modeObj;
      const isRover = modeId === "rover";

      travelSelectors.forEach(sel => {
        if (sel.value !== modeId) sel.value = modeId;
      });

      const drawerSelect = document.getElementById("drawer-travel-mode-select");
      if (drawerSelect && drawerSelect.value !== modeId) drawerSelect.value = modeId;

      const activeDrawerSelect = document.getElementById("drawer-active-travel-mode");
      if (activeDrawerSelect && activeDrawerSelect.value !== modeId) activeDrawerSelect.value = modeId;

      const errDrawerSelect = document.getElementById("drawer-error-travel-mode");
      if (errDrawerSelect && errDrawerSelect.value !== modeId) errDrawerSelect.value = modeId;

      // Update badges and descriptions
      const measureBadge = document.getElementById("measure-travel-mode-badge");
      if (measureBadge) measureBadge.textContent = isRover ? "≤20° SLOPE" : "≤15° SLOPE";

      const drawerBadge = document.getElementById("drawer-travel-mode-badge");
      if (drawerBadge) drawerBadge.textContent = isRover ? "≤20° SLOPE" : "≤15° SLOPE";

      const drawerDesc = document.getElementById("drawer-travel-mode-desc");
      if (drawerDesc) {
        drawerDesc.textContent = isRover
          ? "Autonomous navigation standard for rocker-bogie rovers. Rigorously avoids loose sand ripples and steep walls."
          : "Astronaut EVA on foot. Enforces Liquid Cooling Garment (LCVG max 450 kcal/hr) metabolic limits.";
      }
    }

    travelSelectors.forEach(sel => {
      sel.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsTravelMode && window.MarsTravelMode.set) {
          window.MarsTravelMode.set(sel.value);
        }
      });
    });

    if (window.MarsTravelMode && window.MarsTravelMode.onChange) {
      window.MarsTravelMode.onChange(syncTravelModeUI);
      syncTravelModeUI(window.MarsTravelMode.get());
    }

    // Sync Projects checkboxes
    function linkCheckbox(panelId, origEl) {
      const pEl = document.getElementById(panelId);
      if (pEl && origEl) {
        pEl.checked = origEl.checked;
        pEl.addEventListener("change", function () {
          origEl.checked = pEl.checked;
          origEl.dispatchEvent(new Event("change"));
        });
        origEl.addEventListener("change", function () {
          pEl.checked = origEl.checked;
        });
      }
    }
    linkCheckbox("panel-toggle-traverses", toggleTraverses);
    linkCheckbox("panel-toggle-science-stops", toggleScienceStops);
    linkCheckbox("panel-toggle-landmarks", toggleLandmarks);
    linkCheckbox("panel-toggle-aoi", toggleAoi);
    linkCheckbox("panel-toggle-graticule", toggleGraticule);

    // Sync Measure buttons
    const panelBtnPlanCustom = document.getElementById("panel-btn-plan-custom-route");
    if (panelBtnPlanCustom) {
      panelBtnPlanCustom.addEventListener("click", () => {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsSegmentPick) {
          MarsSegmentPick.setActive(true);
        }
      });
    }

    const panelBtnMeasure = document.getElementById("panel-btn-measured-route");
    if (panelBtnMeasure) {
      panelBtnMeasure.addEventListener("click", () => {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsHybrid && !window.MarsHybrid.isInDetailMode()) {
          window.MarsHybrid.setViewMode("split");
        }
        const tryBtn = document.getElementById("try-measured-route");
        if (tryBtn) tryBtn.click();
      });
    }
    const panelBtnClear = document.getElementById("panel-btn-clear-route");
    if (panelBtnClear) {
      panelBtnClear.addEventListener("click", () => {
        if (clearSegment) clearSegment.click();
      });
    }
    const panelBtnSync = document.getElementById("panel-btn-sync-globe");
    if (panelBtnSync) {
      panelBtnSync.addEventListener("click", () => {
        if (syncDetailBtn) syncDetailBtn.click();
      });
    }

    // Search Pill logic
    if (searchInput && searchResults) {
      const SEARCH_TARGETS = [
        { name: "Jezero Crater", sub: "18.45°N, 77.42°E · Delta Fan · Perseverance", key: "jezero" },
        { name: "Gale Crater", sub: "4.59°S, 137.44°E · Mount Sharp · Curiosity", key: "gale" },
        { name: "Olympus Mons", sub: "18.65°N, 133.80°W · Solar System's Tallest Volcano", key: "olympus" },
        { name: "Global Mars Orbit", sub: "Equatorial Satellite Orbit · Planetary Overview", key: "global" }
      ];

      function renderResults(query) {
        const q = (query || "").toLowerCase().trim();
        if (!q) {
          searchResults.hidden = true;
          if (searchClear) searchClear.hidden = true;
          return;
        }
        if (searchClear) searchClear.hidden = false;
        const matches = SEARCH_TARGETS.filter(t => t.name.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q));
        if (matches.length === 0) {
          searchResults.innerHTML = '<div style="padding:10px 18px;color:#94a3b8;font-size:12px;">No matching Martian landmarks found.</div>';
          searchResults.hidden = false;
          return;
        }
        searchResults.innerHTML = matches.map(m =>
          `<div class="search-result-item" data-key="${m.key}" tabindex="0">` +
          `  <span>${m.name}</span>` +
          `  <span class="search-result-sub">${m.sub}</span>` +
          `</div>`
        ).join("");
        searchResults.hidden = false;

        searchResults.querySelectorAll(".search-result-item").forEach(item => {
          item.addEventListener("click", function () {
            const k = item.dataset.key;
            if (locationSelect) {
              locationSelect.value = k;
              locationSelect.dispatchEvent(new Event("change"));
            } else {
              flyToPlace(k);
            }
            searchResults.hidden = true;
            searchInput.value = item.querySelector("span").textContent;
          });
        });
      }

      searchInput.addEventListener("input", function () {
        renderResults(searchInput.value);
      });

      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          const first = searchResults.querySelector(".search-result-item");
          if (first) first.click();
        } else if (e.key === "Escape") {
          searchResults.hidden = true;
        }
      });

      if (searchClear) {
        searchClear.addEventListener("click", function () {
          searchInput.value = "";
          searchResults.hidden = true;
          searchClear.hidden = true;
          searchInput.focus();
        });
      }

      document.addEventListener("click", function (e) {
        if (!document.getElementById("search-pill")?.contains(e.target)) {
          searchResults.hidden = true;
        }
      });
    }
  }

  async function bootstrap() {
    if (window.MarsCosmicIntro) {
      try {
        MarsCosmicIntro.init();
      } catch (err) {
        console.warn("Cosmic intro init error:", err);
      }
    }

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
      const v = MarsGlobe.getViewer();
      if (v && window.MarsHistoricalTraverses) {
        window.MarsHistoricalTraverses.initCesium(v);
      }
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

    MarsData.getActiveSiteMeta().then(meta => MarsDetailMap.setSite(meta.id)).catch(console.warn);

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

    // Google Earth-Style Map Presets
    function markCustomPreset() {
      if (mapStylePreset && mapStylePreset.value !== "custom") {
        mapStylePreset.value = "custom";
      }
    }

    function setLayerState(config) {
      const curViewer = (window.MarsGlobe && window.MarsGlobe.getViewer) ? MarsGlobe.getViewer() : null;
      const map = MarsDetailMap.isReady() ? MarsDetailMap.getMap() : null;

      if (config.orbiters !== undefined && toggleOrbiters) {
        toggleOrbiters.checked = config.orbiters;
        if (window.MarsOrbiters?.setOrbitersVisible) {
          MarsOrbiters.setOrbitersVisible(config.orbiters);
        }
      }
      if (config.moons !== undefined && toggleMoons) {
        toggleMoons.checked = config.moons;
        if (window.MarsOrbiters?.setMoonsVisible) {
          MarsOrbiters.setMoonsVisible(config.moons);
        }
      }
      if (config.trajectories !== undefined && toggleOrbitPaths) {
        toggleOrbitPaths.checked = config.trajectories;
        if (window.MarsOrbiters?.setTrajectoriesVisible) {
          MarsOrbiters.setTrajectoriesVisible(config.trajectories);
        }
      }
      if (config.landmarks !== undefined && toggleLandmarks) {
        toggleLandmarks.checked = config.landmarks;
        MarsGlobe.setLandmarksVisible(config.landmarks);
      }
      if (config.traverses !== undefined && toggleTraverses) {
        toggleTraverses.checked = config.traverses;
        if (window.MarsHistoricalTraverses) {
          MarsHistoricalTraverses.setVisible(config.traverses, map, curViewer);
        }
      }
      if (config.aoi !== undefined && toggleAoi) {
        toggleAoi.checked = config.aoi;
        MarsGlobe.setAoiFootprintVisible(config.aoi);
      }
      if (config.graticule !== undefined && toggleGraticule) {
        toggleGraticule.checked = config.graticule;
        MarsGlobe.setGraticuleVisible(config.graticule);
      }
      if (config.lighting !== undefined && toggleLighting) {
        toggleLighting.checked = config.lighting;
        MarsGlobe.setLightingEnabled(config.lighting);
      }
      if (config.grs !== undefined && grsSelect) {
        grsSelect.value = config.grs;
        const elemKey = config.grs === "none" ? null : config.grs;
        if (window.MarsGrsOverlays) {
          MarsGrsOverlays.applyCesium(curViewer, elemKey, 0.65);
          if (map) MarsGrsOverlays.applyLeaflet(map, elemKey, 0.65);
        }
      }
    }

    function applyMapPreset(val) {
      if (window.MarsAudio) MarsAudio.playClick();
      if (val === "clean") {
        setLayerState({
          orbiters: false,
          moons: false,
          trajectories: false,
          landmarks: false,
          traverses: false,
          aoi: false,
          graticule: false,
          lighting: true,
          grs: "none",
        });
      } else if (val === "exploration") {
        setLayerState({
          orbiters: false,
          moons: false,
          trajectories: false,
          landmarks: true,
          traverses: true,
          aoi: true,
          graticule: false,
          lighting: true,
          grs: "none",
        });
      } else if (val === "orbital") {
        setLayerState({
          orbiters: true,
          moons: true,
          trajectories: true,
          landmarks: false,
          traverses: false,
          aoi: false,
          graticule: false,
          lighting: true,
          grs: "none",
        });
      }
    }

    if (mapStylePreset) {
      mapStylePreset.addEventListener("change", function () {
        applyMapPreset(mapStylePreset.value);
      });
    }

    if (toggleOrbiters) {
      toggleOrbiters.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        if (window.MarsOrbiters?.setOrbitersVisible) {
          MarsOrbiters.setOrbitersVisible(toggleOrbiters.checked);
        }
      });
    }
    if (toggleMoons) {
      toggleMoons.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        if (window.MarsOrbiters?.setMoonsVisible) {
          MarsOrbiters.setMoonsVisible(toggleMoons.checked);
        }
      });
    }
    if (toggleOrbitPaths) {
      toggleOrbitPaths.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        if (window.MarsOrbiters?.setTrajectoriesVisible) {
          MarsOrbiters.setTrajectoriesVisible(toggleOrbitPaths.checked);
        }
      });
    }

    if (toggleLandmarks) {
      toggleLandmarks.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        MarsGlobe.setLandmarksVisible(toggleLandmarks.checked);
      });
    }
    if (toggleTraverses) {
      toggleTraverses.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        const map = MarsDetailMap.isReady() ? MarsDetailMap.getMap() : null;
        const curViewer = (window.MarsGlobe && window.MarsGlobe.getViewer) ? MarsGlobe.getViewer() : null;
        if (window.MarsHistoricalTraverses) {
          MarsHistoricalTraverses.setVisible(toggleTraverses.checked, map, curViewer);
        }
      });
    }
    if (toggleAoi) {
      toggleAoi.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        MarsGlobe.setAoiFootprintVisible(toggleAoi.checked);
      });
    }
    if (toggleGraticule) {
      toggleGraticule.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        MarsGlobe.setGraticuleVisible(toggleGraticule.checked);
      });
    }
    if (toggleLighting) {
      toggleLighting.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        MarsGlobe.setLightingEnabled(toggleLighting.checked);
      });
    }

    // Odyssey GRS ISRU Select
    if (grsSelect) {
      grsSelect.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        markCustomPreset();
        const val = grsSelect.value;
        const elemKey = val === "none" ? null : val;
        const curViewer = (window.MarsGlobe && window.MarsGlobe.getViewer) ? MarsGlobe.getViewer() : null;
        const map = MarsDetailMap.isReady() ? MarsDetailMap.getMap() : null;
        if (window.MarsGrsOverlays) {
          MarsGrsOverlays.applyCesium(curViewer, elemKey, 0.65);
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
          const key = locationSelect && locationSelect.value !== "global" ? locationSelect.value : "jezero";
          if (locationSelect) locationSelect.value = key;
          MarsHybrid.setViewMode("split");
          flyToPlace(key);
        }
        if (planSegment.checked) {
          const map = MarsDetailMap.getMap();
          if (togglePresetRoutes) togglePresetRoutes.checked = false;
          if (toggleTraverses) toggleTraverses.checked = false;
          if (map && window.MarsPresetRoutes) MarsPresetRoutes.setVisible(map, false);
          if (window.MarsHistoricalTraverses) MarsHistoricalTraverses.setVisible(false, map, MarsGlobe.getViewer());
        }
        MarsSegmentPick.setActive(planSegment.checked);
      });
    }
    const tryBtn = document.getElementById("try-measured-route");
    if (tryBtn) {
      tryBtn.addEventListener("click", async () => {
        try {
          if (window.MarsHybrid && !window.MarsHybrid.isInDetailMode()) {
            window.MarsHybrid.setViewMode("split");
          }
          const site = await MarsData.getActiveSiteMeta();
          const example = site.example_route;
          if (!example) return;
          await MarsSegmentPick.planRoute(
            example.from.lat, example.from.lon, example.to.lat, example.to.lon
          );
        } catch {
          MarsSegmentDrawer.render({ error: "Could not load the example route." });
        }
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

    initGoogleEarthControls();

    // Dismiss the Binary Orbits mission loader with a smooth reveal
    const loader = document.getElementById("mission-loader");
    if (loader) {
      setTimeout(function () {
        loader.classList.add("loaded");
        setTimeout(function () {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 650);
      }, 350);
    }
  }

  // Chrome sends trackpad pinch as Ctrl+wheel. Cancel browser zoom while
  // letting Leaflet and Cesium receive the original event at the pointer.
  window.addEventListener("wheel", function (event) {
    if (event.ctrlKey && event.cancelable) event.preventDefault();
  }, { capture: true, passive: false });

  window.addEventListener("keydown", function (event) {
    if (event.ctrlKey && ["=", "-", "+"].includes(event.key)) {
      event.preventDefault();
    }
  });

  bootstrap().catch(function (err) {
    console.error(err);
    const loader = document.getElementById("mission-loader");
    if (loader) {
      loader.classList.add("loaded");
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 650);
    }
    const hud = document.getElementById("globe");
    if (hud) {
      hud.innerHTML =
        '<p style="padding:1rem;color:#f88;">Failed to start globe: ' +
        err.message +
        "</p>";
    }
  });
})();
