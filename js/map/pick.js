/* global L, MarsDetailMap, MarsRouteBetween, MarsSegmentDrawer, window */
window.MarsSegmentPick = (function () {
  let active = false;
  let step = 0;
  let pointA = null;
  let markerA = null;
  let markerB = null;
  let lineLayer = null;
  let map = null;
  let clickHandler = null;

  function ensureMap() {
    if (!MarsDetailMap.isReady()) {
      MarsDetailMap.init();
    }
    map = MarsDetailMap.getMap();
    return map;
  }

  function clearMarkers() {
    if (markerA) {
      map.removeLayer(markerA);
      markerA = null;
    }
    if (markerB) {
      map.removeLayer(markerB);
      markerB = null;
    }
    if (lineLayer) {
      map.removeLayer(lineLayer);
      lineLayer = null;
    }
    pointA = null;
    step = 0;
  }

  function markerIcon(label, color) {
    return L.divIcon({
      className: "seg-marker",
      html:
        '<span style="background:' +
        color +
        '">' +
        label +
        "</span>",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  async function onMapClick(e) {
    if (!active) return;
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    if (step === 0) {
      clearMarkers();
      pointA = { lat, lon };
      markerA = L.marker([lat, lon], { icon: markerIcon("A", "#c9f31d") }).addTo(
        map
      );
      step = 1;
      if (window.MarsAudio) window.MarsAudio.playClick();
      MarsSegmentDrawer.render(null, "Now click point B.");
      return;
    }

    markerB = L.marker([lat, lon], { icon: markerIcon("B", "#5eb8ff") }).addTo(
      map
    );
    if (window.MarsAudio) window.MarsAudio.playLock();
    MarsSegmentDrawer.render(null, "Computing route…");

    try {
      const segment = await MarsRouteBetween.solve(
        pointA.lat,
        pointA.lon,
        lat,
        lon
      );
      if (segment.geometry) {
        lineLayer = L.geoJSON(segment.geometry, {
          style: {
            color: segment.feasible ? "#c9f31d" : "#f87171",
            weight: 4,
            opacity: 0.9,
          },
        }).addTo(map);
      }
      if (window.MarsAudio) window.MarsAudio.playSuccess();
      MarsSegmentDrawer.render(segment);
    } catch (err) {
      MarsSegmentDrawer.render({ error: err.message });
    }

    step = 0;
    pointA = null;
  }

  function setActive(on) {
    active = on;
    const m = ensureMap();
    if (!clickHandler) {
      clickHandler = onMapClick;
    }
    if (on) {
      m.on("click", clickHandler);
      MarsSegmentDrawer.render(null, "Click point A on the map.");
    } else {
      m.off("click", clickHandler);
      clearMarkers();
      MarsSegmentDrawer.render(null, "Plan segment is off.");
    }
  }

  function reset() {
    if (map) clearMarkers();
    if (active) {
      MarsSegmentDrawer.render(null, "Click point A on the map.");
    }
  }

  function isActive() {
    return active;
  }

  return { setActive, reset, isActive };
})();