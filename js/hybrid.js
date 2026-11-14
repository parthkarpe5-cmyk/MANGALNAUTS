/* global MarsGlobe, MarsDetailMap, window */
window.MarsHybrid = (function () {
  const DETAIL_THRESHOLD_M = 400000;
  const GLOBE_FADE_IN_DETAIL = 0.35;

  let inDetailMode = false;
  let detailPane = null;
  let modeEl = null;
  let heightEl = null;
  let onDetailChange = null;

  function init(elements) {
    detailPane = elements.detailPane;
    modeEl = elements.modeEl;
    heightEl = elements.heightEl;
    onDetailChange = elements.onDetailChange;

    const viewer = MarsGlobe.getViewer();
    if (!viewer) return;

    viewer.scene.postRender.addEventListener(function () {
      updateMode();
    });
    viewer.camera.changed.addEventListener(function () {
      updateMode();
    });
  }

  function updateMode() {
    const state = MarsGlobe.getCameraState();
    if (!state) return;

    if (heightEl) {
      const km =
        state.heightM >= 1000
          ? (state.heightM / 1000).toFixed(0) + " km"
          : Math.round(state.heightM) + " m";
      heightEl.textContent = km;
    }

    const shouldDetail = state.heightM < DETAIL_THRESHOLD_M;

    if (shouldDetail && !inDetailMode) {
      enterDetail(state);
    } else if (!shouldDetail && inDetailMode) {
      exitDetail();
    }
  }

  function enterDetail(state) {
    inDetailMode = true;
    detailPane.classList.add("open");
    MarsGlobe.setGlobeOpacity(GLOBE_FADE_IN_DETAIL);

    if (!MarsDetailMap.isReady()) {
      MarsDetailMap.init();
    }
    MarsDetailMap.invalidateSize();
    if (window.MarsSegmentPick && window.MarsSegmentPick.isActive()) {
      window.MarsSegmentPick.reset();
    }
    MarsDetailMap.flyTo(
      state.lat,
      state.lon,
      state.heightM < 80000 ? 11 : 10
    );

    if (modeEl && window.MarsTravelMode) {
      modeEl.textContent = MarsTravelMode.get().label + " · Surface";
    } else if (modeEl) {
      modeEl.textContent = "Surface detail";
    }
    if (onDetailChange) {
      onDetailChange(true, state);
    }
  }

  function exitDetail() {
    inDetailMode = false;
    detailPane.classList.remove("open");
    MarsGlobe.setGlobeOpacity(1);

    if (modeEl && window.MarsTravelMode) {
      modeEl.textContent = MarsTravelMode.get().label + " · Planet";
    } else if (modeEl) {
      modeEl.textContent = "Planet";
    }
    if (onDetailChange) {
      onDetailChange(false, null);
    }
  }

  function isInDetailMode() {
    return inDetailMode;
  }

  function syncFromDetail() {
    if (!MarsDetailMap.isReady()) return;
    const c = MarsDetailMap.getCenter();
    if (!c) return;
    MarsGlobe.flyTo(c.lat, c.lon, 250000, 0.8);
  }

  return {
    init,
    isInDetailMode,
    syncFromDetail,
    DETAIL_THRESHOLD_M,
  };
})();