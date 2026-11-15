/* global MarsGlobe, MarsDetailMap, window */
window.MarsHybrid = (function () {
  let currentMode = "2d"; // "3d" | "2d" | "split"
  let container = null;
  let globePane = null;
  let detailPane = null;
  let modeEl = null;
  let heightEl = null;
  let onDetailChange = null;

  function init(elements) {
    container = document.getElementById("viewport-split");
    globePane = document.getElementById("globe-pane");
    detailPane = elements.detailPane || document.getElementById("detail-pane");
    modeEl = elements.modeEl;
    heightEl = elements.heightEl;
    onDetailChange = elements.onDetailChange;

    // Ensure 2D detail map is ready
    if (!MarsDetailMap.isReady()) {
      MarsDetailMap.init();
    }

    const viewer = MarsGlobe.getViewer();
    if (viewer && heightEl) {
      viewer.camera.changed.addEventListener(updateAltitude);
      updateAltitude();
    }

    // Bind segmented view mode buttons
    document.querySelectorAll(".view-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        setViewMode(btn.dataset.mode);
      });
    });

    // Default startup in 3D Planetary Globe Orbit with Cosmic Galaxy
    const initialMode = "3d";
    setViewMode(initialMode);
  }

  function setViewMode(mode) {
    currentMode = ["3d", "2d", "split"].includes(mode) ? mode : "2d";

    if (!container) container = document.getElementById("viewport-split");
    if (!globePane) globePane = document.getElementById("globe-pane");
    if (!detailPane) detailPane = document.getElementById("detail-pane");

    // Update active button state
    document.querySelectorAll(".view-mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.mode === currentMode);
      btn.setAttribute("aria-pressed", String(btn.dataset.mode === currentMode));
    });

    if (container) {
      container.classList.remove("mode-3d", "mode-2d", "mode-split");
      container.classList.add("mode-" + currentMode);
    }

    const showGlobe = currentMode !== "2d";
    const showSurface = currentMode !== "3d";

    // Clear conflicting inline display styles so CSS classes (.mode-3d, .mode-2d, .mode-split) control layout
    if (globePane) globePane.style.display = "";
    if (detailPane) detailPane.style.display = "";

    const viewer = MarsGlobe.getViewer();
    if (viewer) {
      viewer.useDefaultRenderLoop = showGlobe;
      if (showGlobe) {
        viewer.resize();
        viewer.scene?.requestRender();
      }
    }

    if (window.MarsStarfield) {
      if (showGlobe) {
        window.MarsStarfield.resume();
        window.MarsStarfield.resize();
      } else {
        window.MarsStarfield.pause();
      }
    }

    if (showSurface) {
      if (!MarsDetailMap.isReady()) {
        MarsDetailMap.init();
      }
      MarsDetailMap.setSite(window.MarsData.getActiveSiteKey());
      MarsDetailMap.invalidateSize();
    }

    // Two-pass resize to guarantee proper dimensions after layout reflow
    requestAnimationFrame(() => {
      if (showGlobe && viewer) {
        viewer.resize();
        viewer.scene?.requestRender();
      }
      if (showGlobe && window.MarsStarfield) {
        window.MarsStarfield.resize();
      }
      if (showSurface) {
        MarsDetailMap.invalidateSize();
      }
    });

    if (modeEl) {
      const modeLabels = {
        "3d": "3D Planetary Orbit",
        "2d": "2D Tactical Surface",
        "split": "Dual Mission Cockpit",
      };
      modeEl.textContent = modeLabels[currentMode] || currentMode.toUpperCase();
    }

    if (onDetailChange) {
      onDetailChange(currentMode !== "3d");
    }
  }

  function updateAltitude() {
    const state = MarsGlobe.getCameraState();
    if (!state) return;
    if (heightEl) {
      let km = "";
      if (state.heightM < 10000) {
        km = Math.round(state.heightM).toLocaleString() + " m";
      } else if (state.heightM < 10000000) {
        km = Math.round(state.heightM / 1000).toLocaleString() + " km";
      } else {
        km = (state.heightM / 1000000).toFixed(1) + " Mm";
      }
      if (heightEl.textContent !== km) heightEl.textContent = km;
    }
  }

  function getViewMode() {
    return currentMode;
  }

  function isInDetailMode() {
    return currentMode !== "3d";
  }

  function syncFromDetail() {
    if (!MarsDetailMap.isReady()) return;
    const c = MarsDetailMap.getCenter();
    if (!c) return;
    MarsGlobe.flyTo(c.lat, c.lon, 250000, 0.8);
  }

  return {
    init,
    setViewMode,
    getViewMode,
    isInDetailMode,
    syncFromDetail,
  };
})();