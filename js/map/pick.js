/* global L, MarsDetailMap, MarsRouteBetween, MarsSegmentDrawer, MarsData, window */
window.MarsSegmentPick = (function () {
  let active = false;
  let step = 0;
  let pointA = null;
  let markerA = null;
  let markerB = null;
  let lineLayer = null;
  let map = null;
  let clickHandler = null;
  let coverageLayer = null;
  let coverageRequest = 0;

  async function showCoverage() {
    const request = ++coverageRequest;
    try {
      const { bbox } = await MarsData.loadManifest();
      if (!active || request !== coverageRequest || !bbox) return;
      const bounds = [[bbox.south, bbox.west], [bbox.north, bbox.east]];
      if (coverageLayer) map.removeLayer(coverageLayer);
      coverageLayer = L.rectangle(bounds, {
        color: "#c9f31d",
        weight: 2,
        dashArray: "7 5",
        fill: false,
        interactive: false,
      }).addTo(map);
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [20, 20], animate: false });
      if (step === 0 && !markerB) {
        MarsSegmentDrawer.render(null, "Click point A inside the outlined routing area.");
      }
    } catch {
      if (active && request === coverageRequest) {
        MarsSegmentDrawer.render(null, "Could not load the routing area. Refresh and try again.");
      }
    }
  }

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
      MarsSegmentDrawer.render(null, "Now click point B.");
      return;
    }

    markerB = L.marker([lat, lon], { icon: markerIcon("B", "#5eb8ff") }).addTo(
      map
    );
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
      showCoverage();
      MarsSegmentDrawer.render(null, "Click point A inside the routing area.");
    } else {
      m.off("click", clickHandler);
      coverageRequest++;
      if (coverageLayer) {
        m.removeLayer(coverageLayer);
        coverageLayer = null;
      }
      clearMarkers();
      MarsSegmentDrawer.render(null, "Plan segment is off.");
    }
  }

  function reset() {
    if (map) clearMarkers();
    if (active) {
      MarsSegmentDrawer.render(null, "Click point A inside the routing area.");
    }
  }

  function isActive() {
    return active;
  }

  return { setActive, reset, isActive };
})();