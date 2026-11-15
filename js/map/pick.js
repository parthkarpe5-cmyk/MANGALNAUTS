/* global L, MarsDetailMap, MarsRouteBetween, MarsSegmentDrawer, MarsData, MarsRouteRenderer, window */
window.MarsSegmentPick = (function () {
  let active = false;
  let step = 0;
  let pointA = null;
  let pointB = null;
  let markerA = null;
  let markerB = null;
  let lineLayer = null;
  let snapLinks = null;
  let request = 0;
  let solving = false;
  let scrubberMarker = null;
  let scrubberTimeout = null;
  let lastSolvedSegment = null;
  let map = null;
  let clickHandler = null;

  // Automated traversal state
  let traversalMarker = null;
  let traversalAnimId = null;
  let traversalPaused = false;
  let traversalNodes = null;
  let traversalTotalDistM = 0;
  let traversalStartTime = 0;
  let traversalElapsedOffset = 0;
  let traversalDurationMs = 8000;
  let traversalWaitingRestart = false;

  function ensureMap() {
    if (!MarsDetailMap.isReady()) {
      MarsDetailMap.init();
    }
    map = MarsDetailMap.getMap();
    return map;
  }

  function clearMarkers() {
    request++;
    solving = false;
    stopAutoTraversal();
    if (snapLinks) { map.removeLayer(snapLinks); snapLinks = null; }
    window.MarsContingency?.clear();
    if (markerA && map) {
      map.removeLayer(markerA);
      markerA = null;
    }
    if (markerB && map) {
      map.removeLayer(markerB);
      markerB = null;
    }
    if (lineLayer && map) {
      map.removeLayer(lineLayer);
      lineLayer = null;
    }
    hideScrubber();
    lastSolvedSegment = null;
    pointA = null;
    pointB = null;
    step = 0;
  }

  /**
   * Programmatic route execution for Quick Mission presets & Science Stop clicks
   */
  async function planRoute(latA, lonA, latB, lonB) {
    ensureMap();
    clearMarkers();
    pointA = { lat: latA, lon: lonA };
    pointB = { lat: latB, lon: lonB };

    // Enable planner checkbox in UI if present
    const planCheckbox = document.getElementById("plan-segment");
    if (planCheckbox && !planCheckbox.checked) {
      planCheckbox.checked = true;
      setActive(true);
    }

    markerA = L.marker([latA, lonA], {
      icon: MarsRouteRenderer.createWaypointPin("start", "A", "#F4C76A"),
    }).addTo(map);
    markerB = L.marker([latB, lonB], {
      icon: MarsRouteRenderer.createWaypointPin("target", "B", "#FF5722"),
    }).addTo(map);

    const current = ++request;
    solving = true;
    MarsSegmentDrawer.render(null, "Calculating route on measured terrain…");
    try {
      const segment = await MarsRouteBetween.solve(latA, lonA, latB, lonB);
      if (current !== request) return;
      if (segment.path_found) {
        snapLinks = L.layerGroup([segment.from, segment.to].map(point =>
          L.polyline([[point.lat, point.lon], [point.snap_lat, point.snap_lon]],
            { color: "#f3e8e2", weight: 2, dashArray: "3 5", interactive: false })
        )).addTo(map);
      }

      if (segment.status === "out_of_coverage") {
        const endpoints = [[markerA, latA, lonA], [markerB, latB, lonB]];
        const tiers = await Promise.all(endpoints.map(([, lat, lon]) => MarsRouteBetween.elevationTier(lat, lon)));
        if (current !== request) return;
        endpoints.forEach(([marker], i) => marker.bindTooltip(tiers[i]
          ? "Elevation available" : "Outside loaded elevation coverage", { direction: "top" }));
      }
      lastSolvedSegment = segment;

      if (segment.path_found && segment.path_nodes && segment.path_nodes.length > 1) {
        const latlngs = segment.path_nodes.map((n) => [n.lat, n.lon]);
        const routeColor = segment.feasible ? "#66D9FF" : "#FF8B86";

        lineLayer = MarsRouteRenderer.createCorridorLayer(latlngs, {
          color: routeColor,
          animated: true,
          drawIn: true,
          ticks: true,
          pathNodes: segment.path_nodes,
        }).addTo(map);

        // Zoom map to encompass the route
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], animate: true });

        // Launch automated traversal rover pointer along the path
        startAutoTraversal(segment.path_nodes);
      }

      if (segment.path_found && window.MarsAudio) window.MarsAudio.playSuccess();
      MarsSegmentDrawer.render(segment);
    } catch (err) {
      if (current === request) MarsSegmentDrawer.render({ error: err.message });
    } finally {
      if (current === request) solving = false;
    }
  }

  async function onMapClick(e) {
    if (!active || solving) return;
    const { lat, lng: lon } = e.latlng;
    if (step === 0) {
      clearMarkers();
      pointA = { lat, lon };
      markerA = L.marker([lat, lon], {
        icon: MarsRouteRenderer.createWaypointPin("start", "A", "#F4C76A"),
      }).addTo(map);
      step = 1;
      MarsSegmentDrawer.render(null, "Start selected. Checking terrain coverage…");
      const selection = request;
      MarsRouteBetween.elevationTier(lat, lon).then(tier => {
        if (request !== selection || step !== 1) return;
        const message = tier === "local" ? "Start: local elevation available. Pick a destination."
          : tier === "regional" ? "Start: regional elevation available (200 m). Pick a destination."
          : "Start: outside loaded elevation coverage.";
        markerA.bindTooltip(message, { direction: "top" });
        MarsSegmentDrawer.render(null, message);
      }).catch(() => {
        if (request === selection && step === 1)
          MarsSegmentDrawer.render(null, "Elevation data could not load. Try selecting the region again.");
      });
      return;
    }
    await planRoute(pointA.lat, pointA.lon, lat, lon);
  }

  function showScrubber(distM) {
    if (!lastSolvedSegment || !lastSolvedSegment.path_nodes || !map) return;
    const nodes = lastSolvedSegment.path_nodes;
    if (nodes.length < 2) return;

    if (scrubberTimeout) {
      clearTimeout(scrubberTimeout);
      scrubberTimeout = null;
    }

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
        radius: 6,
        color: "#ffffff",
        fillColor: "#c9f31d",
        fillOpacity: 1,
        weight: 2,
        className: "route-scrubber-cursor",
      }).addTo(map);
    } else {
      scrubberMarker.setLatLng([curLat, curLon]);
    }

    scrubberMarker
      .bindTooltip(
        '<div class="hud-tooltip font-mono text-xs"><strong>' +
          (distM / 1000).toFixed(2) +
          " km</strong> · Elev: " +
          elev.toFixed(1) +
          "m · Risk: " +
          risk.toFixed(2) +
          "</div>",
        { permanent: true, direction: "top", className: "hud-tooltip" }
      )
      .openTooltip();

    // Auto-hide when mouse stops interacting
    scrubberTimeout = setTimeout(hideScrubber, 1200);
  }

  function hideScrubber() {
    if (scrubberTimeout) {
      clearTimeout(scrubberTimeout);
      scrubberTimeout = null;
    }
    if (scrubberMarker && map) {
      map.removeLayer(scrubberMarker);
      scrubberMarker = null;
    }
  }

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLon);
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  function stopAutoTraversal() {
    if (traversalAnimId) {
      cancelAnimationFrame(traversalAnimId);
      traversalAnimId = null;
    }
    if (traversalMarker && map) {
      map.removeLayer(traversalMarker);
      traversalMarker = null;
    }
    traversalNodes = null;
    traversalPaused = false;
    traversalWaitingRestart = false;
    traversalElapsedOffset = 0;
    if (window.MarsElevationProfile && window.MarsElevationProfile.hideProgress) {
      window.MarsElevationProfile.hideProgress();
    }
  }

  function startAutoTraversal(pathNodes) {
    stopAutoTraversal();
    if (!pathNodes || pathNodes.length < 2 || !map) return;

    const nodes = pathNodes.map(function (n) {
      return {
        lat: n.lat,
        lon: n.lon,
        elev_m: n.elev_m != null ? n.elev_m : 0,
        slope_deg: n.slope_deg != null ? n.slope_deg : 0,
        risk: n.risk != null ? n.risk : 0.35,
        dist_m: n.dist_m != null ? n.dist_m : 0,
      };
    });

    if (nodes[nodes.length - 1].dist_m <= 0) {
      nodes[0].dist_m = 0;
      for (let i = 1; i < nodes.length; i++) {
        const d = MarsGeodesic.haversineMeters(
          nodes[i - 1].lat,
          nodes[i - 1].lon,
          nodes[i].lat,
          nodes[i].lon
        );
        nodes[i].dist_m = nodes[i - 1].dist_m + d;
      }
    }

    traversalTotalDistM = nodes[nodes.length - 1].dist_m;
    if (traversalTotalDistM <= 0) return;

    traversalNodes = nodes;
    traversalDurationMs = Math.max(5500, Math.min(14000, (traversalTotalDistM / 250) * 1000));
    traversalStartTime = performance.now();
    traversalElapsedOffset = 0;
    traversalPaused = false;
    traversalWaitingRestart = false;

    const icon = L.divIcon({
      className: "mars-traversal-pointer-container",
      html:
        '<div class="mars-traversal-pointer" id="rover-pointer" title="Rover Traversal Unit (Click to Pause/Resume)">' +
        '  <div class="traversal-beacon-pulse"></div>' +
        '  <div class="traversal-pointer-core" id="rover-pointer-core">' +
        '    <svg viewBox="0 0 24 24" class="traversal-rover-svg" width="22" height="22">' +
        '      <polygon points="12,2 22,20 12,16 2,20" fill="#00f0ff" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>' +
        '    </svg>' +
        '  </div>' +
        '  <div class="traversal-hud-tag" id="rover-hud-tag">' +
        '    <span class="traversal-tag-dot"></span>' +
        '    <span class="traversal-tag-text" id="rover-tag-text">ROVER // DEPARTING</span>' +
        '  </div>' +
        '</div>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    traversalMarker = L.marker([nodes[0].lat, nodes[0].lon], {
      icon: icon,
      interactive: true,
      zIndexOffset: 3000,
    }).addTo(map);

    traversalMarker.on("click", function () {
      togglePauseTraversal();
    });

    updatePointerAtDistance(0, false);
    traversalAnimId = requestAnimationFrame(traversalLoop);
  }

  function traversalLoop(now) {
    if (!traversalMarker || !map || !traversalNodes) return;

    if (traversalPaused) {
      traversalAnimId = requestAnimationFrame(traversalLoop);
      return;
    }

    const elapsed = now - traversalStartTime + traversalElapsedOffset;
    const progress = elapsed / traversalDurationMs;

    if (progress >= 1.0) {
      updatePointerAtDistance(traversalTotalDistM, true);
      if (!traversalWaitingRestart) {
        traversalWaitingRestart = true;
        setTimeout(function () {
          if (traversalMarker && !traversalPaused) {
            traversalStartTime = performance.now();
            traversalElapsedOffset = 0;
            traversalWaitingRestart = false;
            traversalAnimId = requestAnimationFrame(traversalLoop);
          }
        }, 1800);
      }
      return;
    }

    const currentDistM = progress * traversalTotalDistM;
    updatePointerAtDistance(currentDistM, false);
    traversalAnimId = requestAnimationFrame(traversalLoop);
  }

  function updatePointerAtDistance(distM, isFinished) {
    if (!traversalMarker || !traversalNodes || traversalNodes.length < 2) return;
    const nodes = traversalNodes;

    let seg = 1;
    while (seg < nodes.length - 1 && nodes[seg].dist_m < distM) seg++;
    const a = nodes[seg - 1];
    const b = nodes[seg];
    const span = Math.max(0.01, b.dist_m - a.dist_m);
    const f = Math.min(1, Math.max(0, (distM - a.dist_m) / span));

    const curLat = a.lat + (b.lat - a.lat) * f;
    const curLon = a.lon + (b.lon - a.lon) * f;
    const curElev = (a.elev_m || 0) + ((b.elev_m || 0) - (a.elev_m || 0)) * f;
    const curSlope = (a.slope_deg || 0) + ((b.slope_deg || 0) - (a.slope_deg || 0)) * f;
    const bearing = calculateBearing(a.lat, a.lon, b.lat, b.lon);

    traversalMarker.setLatLng([curLat, curLon]);

    const coreEl = document.getElementById("rover-pointer-core");
    if (coreEl) {
      coreEl.style.transform = "translate(-50%, -50%) rotate(" + Math.round(bearing) + "deg)";
    }

    const tagTextEl = document.getElementById("rover-tag-text");
    if (tagTextEl) {
      if (isFinished) {
        tagTextEl.innerHTML = '<strong style="color:#22c55e">✓ OBJECTIVE REACHED</strong>';
      } else {
        tagTextEl.textContent =
          "ROVER // " +
          (distM / 1000).toFixed(2) +
          " km · " +
          Math.round(curElev) +
          "m · " +
          curSlope.toFixed(1) +
          "°";
      }
    }

    if (window.MarsElevationProfile && window.MarsElevationProfile.updateProgress) {
      window.MarsElevationProfile.updateProgress(distM, curElev);
    }
  }

  function togglePauseTraversal() {
    traversalPaused = !traversalPaused;
    if (traversalPaused) {
      const now = performance.now();
      traversalElapsedOffset += now - traversalStartTime;
    } else {
      traversalStartTime = performance.now();
    }
    return traversalPaused;
  }

  function replayAutoTraversal() {
    if (!traversalNodes) return;
    traversalStartTime = performance.now();
    traversalElapsedOffset = 0;
    traversalPaused = false;
    traversalWaitingRestart = false;
    if (!traversalAnimId) {
      traversalAnimId = requestAnimationFrame(traversalLoop);
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
      MarsSegmentDrawer.render(null, "Route Planner Active: Click Start Point (A).");
    } else {
      m.off("click", clickHandler);
      clearMarkers();
      MarsSegmentDrawer.render(null);
    }
  }

  function reset() {
    if (map) clearMarkers();
    if (active) {
      MarsSegmentDrawer.render(null, "Route Planner Active: Click Start Point (A).");
    } else {
      MarsSegmentDrawer.render(null);
    }
  }

  function isActive() {
    return active;
  }

  function getLastSolvedSegment() {
    return lastSolvedSegment;
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", function () {
      if (window.MarsTravelMode && window.MarsTravelMode.onChange) {
        window.MarsTravelMode.onChange(function () {
          if (pointA && pointB && !solving) {
            planRoute(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
          }
        });
      }
    });
  }

  return {
    setActive,
    reset,
    isActive,
    showScrubber,
    hideScrubber,
    planRoute,
    getLastSolvedSegment,
    startAutoTraversal,
    stopAutoTraversal,
    togglePauseTraversal,
    replayAutoTraversal,
  };
})();
