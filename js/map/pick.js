/* global L, MarsDetailMap, MarsRouteBetween, MarsSegmentDrawer, MarsData, MarsRouteRenderer, window */
window.MarsSegmentPick = (function () {
  let active = false;
  let step = 0;
  let pointA = null;
  let markerA = null;
  let markerB = null;
  let lineLayer = null;
  let scrubberMarker = null;
  let lastSolvedSegment = null;
  let map = null;
  let clickHandler = null;
  let coverageLayer = null;
  let coverageRequest = 0;

  async function showCoverage() {
    const request = ++coverageRequest;
    try {
      const { bbox } = await MarsData.loadManifest();
      if (!active || request !== coverageRequest || !bbox) return;
      const bounds = [
        [bbox.south, bbox.west],
        [bbox.north, bbox.east],
      ];
      if (coverageLayer) map.removeLayer(coverageLayer);
      coverageLayer = L.rectangle(bounds, {
        color: "#38bdf8",
        weight: 1.5,
        dashArray: "6 6",
        fill: true,
        fillColor: "#38bdf8",
        fillOpacity: 0.03,
        interactive: false,
      }).addTo(map);
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [20, 20], animate: false });
      if (step === 0 && !markerB) {
        MarsSegmentDrawer.render(
          null,
          "Click point A inside the outlined mission area."
        );
      }
    } catch {
      if (active && request === coverageRequest) {
        MarsSegmentDrawer.render(
          null,
          "Could not load the routing area. Refresh and try again."
        );
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
    hideScrubber();
    lastSolvedSegment = null;
    pointA = null;
    step = 0;
  }

  async function onMapClick(e) {
    if (!active) return;
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    if (step === 0) {
      clearMarkers();
      pointA = { lat, lon };
      markerA = L.marker([lat, lon], {
        icon: MarsRouteRenderer.createWaypointPin("start", "A", "#22c55e"),
      }).addTo(map);
      step = 1;
      if (window.MarsAudio) window.MarsAudio.playClick();
      MarsSegmentDrawer.render(null, "Now click point B (Objective destination).");
      return;
    }

    markerB = L.marker([lat, lon], {
      icon: MarsRouteRenderer.createWaypointPin("target", "B", "#5eb8ff"),
    }).addTo(map);
    if (window.MarsAudio) window.MarsAudio.playLock();
    MarsSegmentDrawer.render(null, "Computing optimal Martian traverse & GNN safety scores…");

    try {
      const segment = await MarsRouteBetween.solve(
        pointA.lat,
        pointA.lon,
        lat,
        lon
      );
      lastSolvedSegment = segment;

      if (segment.path_found && segment.path_nodes && segment.path_nodes.length > 1) {
        const latlngs = segment.path_nodes.map(function (n) {
          return [n.lat, n.lon];
        });
        const routeColor = segment.feasible ? "#c9f31d" : "#ef4444";

        // Render advanced multi-layer glowing sci-fi corridor with directional pulse & km ticks
        lineLayer = MarsRouteRenderer.createCorridorLayer(latlngs, {
          color: routeColor,
          animated: true,
          drawIn: true,
          ticks: true,
          pathNodes: segment.path_nodes,
        }).addTo(map);
      } else if (segment.geometry) {
        // Fallback for simple geometry
        const latlngs = segment.geometry.coordinates.map(function (c) {
          return [c[1], c[0]];
        });
        lineLayer = MarsRouteRenderer.createCorridorLayer(latlngs, {
          color: segment.feasible ? "#c9f31d" : "#ef4444",
          animated: true,
          drawIn: true,
          ticks: true,
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

  /**
   * Highlights a distance location along the active solved route (synced with elevation scrubber)
   */
  function showScrubber(distM) {
    if (!lastSolvedSegment || !lastSolvedSegment.path_nodes || !map) return;
    const nodes = lastSolvedSegment.path_nodes;
    if (nodes.length < 2) return;

    let seg = 1;
    while (seg < nodes.length - 1 && nodes[seg].dist_m < distM) seg++;
    const a = nodes[seg - 1];
    const b = nodes[seg];
    const span = Math.max(1, b.dist_m - a.dist_m);
    const f = Math.min(1, Math.max(0, (distM - a.dist_m) / span));

    const curLat = a.lat + (b.lat - a.lat) * f;
    const curLon = a.lon + (b.lon - a.lon) * f;
    const elev = (a.elev_m || 0) + ((b.elev_m || 0) - (a.elev_m || 0)) * f;
    const risk = (a.risk || 0.35) + ((b.risk || 0.35) - (a.risk || 0.35)) * f;

    if (!scrubberMarker) {
      scrubberMarker = L.circleMarker([curLat, curLon], {
        radius: 8,
        color: "#ffffff",
        fillColor: "#38bdf8",
        fillOpacity: 0.95,
        weight: 3,
        className: "route-scrubber-cursor",
      }).addTo(map);
    } else {
      scrubberMarker.setLatLng([curLat, curLon]);
    }

    scrubberMarker
      .bindTooltip(
        '<div class="hud-tooltip font-mono text-xs"><strong>' +
          (distM / 1000).toFixed(2) +
          " km</strong><br/>Elev: " +
          elev.toFixed(1) +
          "m · Risk: " +
          risk.toFixed(2) +
          "</div>",
        { permanent: true, direction: "top", className: "hud-tooltip" }
      )
      .openTooltip();
  }

  function hideScrubber() {
    if (scrubberMarker && map) {
      map.removeLayer(scrubberMarker);
      scrubberMarker = null;
    }
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

  return { setActive, reset, isActive, showScrubber, hideScrubber };
})();
