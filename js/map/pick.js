/* global L, MarsDetailMap, MarsRouteBetween, MarsSegmentDrawer, MarsData, MarsRouteRenderer, MarsGeodesic, window, performance, requestAnimationFrame, cancelAnimationFrame */
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

  // Navigation Lifecycle States (Google Maps Paradigm):
  // 0: IDLE (no points picked, ready for Point A)
  // 1: PICKING_B (Point A set, waiting for Point B)
  // 2: SOLVING (Route solver running)
  // 3: NAVIGATING_LOCKED (Route active & locked, rover traversing towards destination B)
  // 4: ARRIVED (Rover reached Point B, arrived at destination, locked until reset or replay)
  const NAV_STATE = {
    IDLE: 0,
    PICKING_B: 1,
    SOLVING: 2,
    NAVIGATING_LOCKED: 3,
    ARRIVED: 4,
  };
  let navState = NAV_STATE.IDLE;
  let navDockEl = null;
  let lockToastTimer = null;
  let currentRouteTitle = "Point A ➔ Point B";

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
    removeNavDock();
    if (snapLinks && map) {
      map.removeLayer(snapLinks);
      snapLinks = null;
    }
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
    navState = NAV_STATE.IDLE;
  }

  function exitNavigation() {
    clearMarkers();
    if (window.MarsSegmentDrawer) {
      MarsSegmentDrawer.render(null, "Navigation ended. Map unlocked. Click anywhere to select new Start Point (A).");
    }
  }

  function showNavLockNotice() {
    if (!map) return;
    let toast = document.getElementById("mars-nav-lock-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "mars-nav-lock-toast";
      toast.className = "mars-nav-lock-toast";
      const container = map.getContainer();
      container.appendChild(toast);
    }
    toast.innerHTML =
      '<span class="lock-icon" style="font-size:1.15rem;">🔒</span>' +
      '<div>' +
      '  <strong>NAVIGATION ACTIVE // ROUTE A ➔ B LOCKED</strong><br/>' +
      '  <span style="opacity:0.85;">Points A &amp; B are locked during active navigation. Wait until destination is reached or tap <strong>Exit Nav</strong> to unlock.</span>' +
      '</div>';
    toast.classList.add("visible");

    if (window.MarsAudio && window.MarsAudio.playClick) {
      window.MarsAudio.playClick();
    }

    if (lockToastTimer) clearTimeout(lockToastTimer);
    lockToastTimer = setTimeout(function () {
      toast.classList.remove("visible");
    }, 3200);
  }

  function showNavDock(segment, title) {
    if (!map) return;
    removeNavDock();
    const isWalk = segment && segment.mode === "walk";
    const displayTitle = title || currentRouteTitle || (segment && segment.routeTitle) || "Mission Waypoint A ➔ Waypoint B";
    const container = map.getContainer();
    const totalDistM = segment && segment.path_m ? segment.path_m : traversalTotalDistM;
    const totalDistKm = (totalDistM / 1000).toFixed(2);
    navDockEl = document.createElement("div");
    navDockEl.className = "mars-active-nav-dock";

    const avgSpeed = isWalk ? 1.2 : 0.14; // m/s
    const initEtaSec = traversalTotalDistM / avgSpeed;
    const initEtaMin = Math.round(initEtaSec / 60);
    const initEtaStr = initEtaMin >= 60 ? (Math.floor(initEtaMin / 60) + "h " + (initEtaMin % 60) + "m") : (initEtaMin + " min");

    navDockEl.innerHTML =
      '<div class="nav-dock-left">' +
      '  <span class="nav-dock-pulse"></span>' +
      '  <span class="nav-dock-badge font-mono">🔒 ACTIVE NAV</span>' +
      '  <span class="nav-dock-route-title font-mono" title="' + displayTitle + '">' + displayTitle + '</span>' +
      '</div>' +
      '<div class="nav-dock-center font-mono">' +
      '  <span id="nav-dock-dist" class="nav-metric-bold">' + totalDistKm + ' km</span>' +
      '  <span class="nav-divider">·</span>' +
      '  <span id="nav-dock-eta" class="nav-metric-eta" title="Estimated Time of Arrival">ETA ' + initEtaStr + '</span>' +
      '  <span class="nav-divider">·</span>' +
      '  <span id="nav-dock-consumables" class="nav-metric-consumables" title="NASA 120% Contingency Safe Return Reserve"><span style="color:#22c55e;">O₂ Nominal</span> · <span style="color:#38bdf8;">⚡ Safe</span></span>' +
      '</div>' +
      '<div class="nav-dock-right">' +
      '  <button type="button" class="btn-dock-hud-ghost" id="btn-dock-pause" title="Pause or Resume Traversal">⏸ Pause</button>' +
      '  <button type="button" class="btn-dock-hud-exit" id="btn-dock-exit" title="Exit Navigation and Unlock Map">✕ Exit Nav</button>' +
      '</div>';
    container.appendChild(navDockEl);

    const pauseBtn = navDockEl.querySelector("#btn-dock-pause");
    if (pauseBtn) {
      pauseBtn.onclick = function (ev) {
        ev.stopPropagation();
        const paused = togglePauseTraversal();
        pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
        const toggleTravBtn = document.getElementById("btn-toggle-traversal");
        if (toggleTravBtn) toggleTravBtn.textContent = paused ? "▶ Resume Traverse" : "⏸ Pause Traverse";
      };
    }
    const exitBtn = navDockEl.querySelector("#btn-dock-exit");
    if (exitBtn) {
      exitBtn.onclick = function (ev) {
        ev.stopPropagation();
        exitNavigation();
      };
    }
  }

  function updateNavDockProgress(distRemainingM, curElev, curSlope) {
    if (!navDockEl) return;
    const distEl = navDockEl.querySelector("#nav-dock-dist");
    if (distEl) distEl.textContent = (distRemainingM / 1000).toFixed(2) + " km";

    const isWalk = lastSolvedSegment && lastSolvedSegment.mode === "walk";
    const avgSpeed = isWalk ? 1.2 : 0.14;
    const etaSec = distRemainingM / avgSpeed;
    const etaMin = Math.round(etaSec / 60);
    const etaStr = etaMin >= 60 ? (Math.floor(etaMin / 60) + "h " + (etaMin % 60) + "m") : (etaMin + " min");
    const etaEl = navDockEl.querySelector("#nav-dock-eta");
    if (etaEl) etaEl.textContent = distRemainingM > 10 ? ("ETA " + etaStr) : "Arriving";

    const elevEl = navDockEl.querySelector("#nav-dock-elev");
    if (elevEl) elevEl.textContent = Math.round(curElev) + " m (" + curSlope.toFixed(1) + "°)";

    const consumablesEl = navDockEl.querySelector("#nav-dock-consumables");
    if (consumablesEl && traversalTotalDistM > 0) {
      const progressRatio = Math.max(0, Math.min(1, 1 - (distRemainingM / traversalTotalDistM)));
      const o2Pct = Math.max(68, Math.round(100 - (progressRatio * 30)));
      const battPct = Math.max(72, Math.round(100 - (progressRatio * 24)));
      consumablesEl.innerHTML = '<span style="color:#22c55e;">O₂ ' + o2Pct + '%</span> · <span style="color:#38bdf8;">⚡ ' + battPct + '%</span>';
    }
  }

  function updateNavDockArrival(title) {
    if (!navDockEl) return;
    const displayTitle = title || currentRouteTitle || "Destination B";
    navDockEl.classList.add("arrived");
    navDockEl.innerHTML =
      '<div class="nav-dock-left">' +
      '  <span class="nav-dock-check">✓</span>' +
      '  <span class="nav-dock-badge arrived font-mono">ARRIVED</span>' +
      '  <span class="nav-dock-route-title font-mono" title="' + displayTitle + '">' + displayTitle + ' · Complete</span>' +
      '</div>' +
      '<div class="nav-dock-center font-mono">' +
      '  <span class="nav-metric-bold">' + (traversalTotalDistM / 1000).toFixed(2) + ' km total</span>' +
      '  <span class="nav-divider">·</span>' +
      '  <span style="color:#22c55e; font-weight:700;">✓ 100% Safe Return Margin</span>' +
      '</div>' +
      '<div class="nav-dock-right">' +
      '  <button type="button" class="btn-dock-hud-ghost" id="btn-dock-replay" title="Replay traverse along route">⏮ Replay</button>' +
      '  <button type="button" class="btn-dock-hud-new" id="btn-dock-new" title="Plan New Route">➕ New Route</button>' +
      '</div>';

    const replayBtn = navDockEl.querySelector("#btn-dock-replay");
    if (replayBtn) {
      replayBtn.onclick = function (ev) {
        ev.stopPropagation();
        replayAutoTraversal();
      };
    }
    const newBtn = navDockEl.querySelector("#btn-dock-new");
    if (newBtn) {
      newBtn.onclick = function (ev) {
        ev.stopPropagation();
        exitNavigation();
      };
    }
  }

  function removeNavDock() {
    if (navDockEl) {
      navDockEl.remove();
      navDockEl = null;
    }
  }

  /**
   * Programmatic route execution for Quick Mission presets & Science Stop clicks
   */
  async function planRoute(latA, lonA, latB, lonB) {
    ensureMap();
    clearMarkers();
    pointA = { lat: latA, lon: lonA };
    pointB = { lat: latB, lon: lonB };
    navState = NAV_STATE.SOLVING;
    step = 2;

    // Dynamically resolve real science stop names from manifest & GeoJSON data
    let nameA = "Point A";
    let nameB = "Point B";
    if (window.MarsData && window.MarsData.getWaypointLabel) {
      nameA = await MarsData.getWaypointLabel(latA, lonA, "Origin A");
      nameB = await MarsData.getWaypointLabel(latB, lonB, "Target B");
    }
    currentRouteTitle = nameA + " ➔ " + nameB;

    // Enable planner checkbox in UI if present
    const planCheckbox = document.getElementById("plan-segment");
    if (planCheckbox && !planCheckbox.checked) {
      planCheckbox.checked = true;
      setActive(true);
    }

    markerA = L.marker([latA, lonA], {
      icon: MarsRouteRenderer.createWaypointPin("start", "A", "#F4C76A"),
      interactive: true,
    }).addTo(map);
    markerA.bindTooltip(nameA + " (Locked Origin)", { direction: "top" });

    markerB = L.marker([latB, lonB], {
      icon: MarsRouteRenderer.createWaypointPin("target", "B", "#FF5722"),
      interactive: true,
    }).addTo(map);
    markerB.bindTooltip(nameB + " (Locked Destination)", { direction: "top" });

    markerA.on("click", function () {
      if (navState === NAV_STATE.NAVIGATING_LOCKED) showNavLockNotice();
    });
    markerB.on("click", function () {
      if (navState === NAV_STATE.NAVIGATING_LOCKED) showNavLockNotice();
    });

    const current = ++request;
    solving = true;
    MarsSegmentDrawer.render(null, "Calculating route on measured terrain…");
    try {
      const segment = await MarsRouteBetween.solve(latA, lonA, latB, lonB);
      if (current !== request) return;
      segment.routeTitle = currentRouteTitle;
      segment.nameA = nameA;
      segment.nameB = nameB;

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
        navState = NAV_STATE.NAVIGATING_LOCKED;
        step = 3;

        const latlngs = segment.path_nodes.map((n) => [n.lat, n.lon]);
        const isWalk = segment.mode === "walk";
        const routeColor = segment.feasible ? (isWalk ? "#00f0ff" : "#f59e0b") : "#FF8B86";

        lineLayer = MarsRouteRenderer.createCorridorLayer(latlngs, {
          color: routeColor,
          animated: true,
          drawIn: true,
          ticks: true,
          pathNodes: segment.path_nodes,
        }).addTo(map);

        // Zoom map to encompass the route
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], animate: true });

        // Launch automated traversal rover pointer along the path & show HUD dock
        startAutoTraversal(segment.path_nodes, segment.mode);
        showNavDock(segment, currentRouteTitle);
      } else {
        navState = NAV_STATE.IDLE;
        step = 0;
      }

      if (segment.path_found && window.MarsAudio) window.MarsAudio.playSuccess();
      MarsSegmentDrawer.render(segment);
    } catch (err) {
      navState = NAV_STATE.IDLE;
      step = 0;
      if (current === request) MarsSegmentDrawer.render({ error: err.message });
    } finally {
      if (current === request) solving = false;
    }
  }

  async function onMapClick(e) {
    if (!active || solving || navState === NAV_STATE.SOLVING) return;

    // 1. Google Maps Navigation Lock: A and B are locked until arrival or exit
    if (navState === NAV_STATE.NAVIGATING_LOCKED) {
      showNavLockNotice();
      return;
    }

    // 2. Arrived at Destination: clicking the map unlocks and starts a fresh mission
    if (navState === NAV_STATE.ARRIVED) {
      exitNavigation();
    }

    const { lat, lng: lon } = e.latlng;
    if (step === 0 || navState === NAV_STATE.IDLE) {
      clearMarkers();
      pointA = { lat, lon };
      markerA = L.marker([lat, lon], {
        icon: MarsRouteRenderer.createWaypointPin("start", "A", "#F4C76A"),
      }).addTo(map);
      step = 1;
      navState = NAV_STATE.PICKING_B;
      MarsSegmentDrawer.render(null, "Start (Point A) selected. Checking terrain coverage…");
      const selection = request;
      MarsRouteBetween.elevationTier(lat, lon).then(tier => {
        if (request !== selection || step !== 1) return;
        const message = tier === "local" ? "Start: local elevation available. Pick Destination (Point B)."
          : tier === "regional" ? "Start: regional elevation available (200 m). Pick Destination (Point B)."
          : "Start: outside loaded elevation coverage. Pick Destination (Point B).";
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

  function startAutoTraversal(pathNodes, mode) {
    stopAutoTraversal();
    if (!pathNodes || pathNodes.length < 2 || !map) return;

    const isWalk = mode === "walk";
    const pointerFill = isWalk ? "#00f0ff" : "#f59e0b";
    const tagPrefix = isWalk ? "EVA" : "ROVER";

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
        '<div class="mars-traversal-pointer" id="rover-pointer" title="' + (isWalk ? "Astronaut EVA" : "Rover AutoNav") + ' (Click to Pause/Resume)">' +
        '  <div class="traversal-beacon-pulse" style="border-color: ' + pointerFill + '; box-shadow: 0 0 12px ' + pointerFill + ';"></div>' +
        '  <div class="traversal-pointer-core" id="rover-pointer-core" style="border-color: ' + pointerFill + ';">' +
        '    <svg viewBox="0 0 24 24" class="traversal-rover-svg" width="22" height="22">' +
        '      <polygon points="12,2 22,20 12,16 2,20" fill="' + pointerFill + '" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>' +
        '    </svg>' +
        '  </div>' +
        '  <div class="traversal-hud-tag" id="rover-hud-tag" style="border-color: ' + pointerFill + ';">' +
        '    <span class="traversal-tag-dot" style="background: ' + pointerFill + ';"></span>' +
        '    <span class="traversal-tag-text" id="rover-tag-text">' + tagPrefix + ' // 0.00 km</span>' +
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
      // Destination Reached! Stop looping. Lock in arrived state.
      updatePointerAtDistance(traversalTotalDistM, true);
      onArrivalAtDestination();
      return;
    }

    const currentDistM = progress * traversalTotalDistM;
    updatePointerAtDistance(currentDistM, false);
    traversalAnimId = requestAnimationFrame(traversalLoop);
  }

  function onArrivalAtDestination() {
    navState = NAV_STATE.ARRIVED;
    step = 4;
    if (traversalAnimId) {
      cancelAnimationFrame(traversalAnimId);
      traversalAnimId = null;
    }
    if (window.MarsAudio && window.MarsAudio.playSuccess) {
      window.MarsAudio.playSuccess();
    }
    updateNavDockArrival(currentRouteTitle);
    if (window.MarsSegmentDrawer && window.MarsSegmentDrawer.notifyArrival) {
      window.MarsSegmentDrawer.notifyArrival(lastSolvedSegment, currentRouteTitle);
    }
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
        const isWalk = lastSolvedSegment && lastSolvedSegment.mode === "walk";
        const tagPrefix = isWalk ? "EVA" : "ROVER";
        tagTextEl.textContent =
          tagPrefix + " // " +
          (distM / 1000).toFixed(2) +
          " km · " +
          Math.round(curElev) +
          "m · " +
          curSlope.toFixed(1) +
          "°";
      }
    }

    const distRemainingM = Math.max(0, traversalTotalDistM - distM);
    updateNavDockProgress(distRemainingM, curElev, curSlope);

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
    const pauseBtn = navDockEl ? navDockEl.querySelector("#btn-dock-pause") : null;
    if (pauseBtn) pauseBtn.textContent = traversalPaused ? "▶ Resume" : "⏸ Pause";
    return traversalPaused;
  }

  function replayAutoTraversal() {
    if (!traversalNodes) return;
    navState = NAV_STATE.NAVIGATING_LOCKED;
    step = 3;
    traversalStartTime = performance.now();
    traversalElapsedOffset = 0;
    traversalPaused = false;
    traversalWaitingRestart = false;
    showNavDock(lastSolvedSegment);
    if (window.MarsSegmentDrawer && window.MarsSegmentDrawer.render) {
      window.MarsSegmentDrawer.render(lastSolvedSegment);
    }
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
      exitNavigation();
    }
  }

  function reset() {
    exitNavigation();
  }

  function isActive() {
    return active;
  }

  function isNavigating() {
    return navState === NAV_STATE.NAVIGATING_LOCKED;
  }

  function isLocked() {
    return navState === NAV_STATE.NAVIGATING_LOCKED || navState === NAV_STATE.ARRIVED;
  }

  function getNavState() {
    return navState;
  }

  function getLastSolvedSegment() {
    return lastSolvedSegment;
  }

  function attachTravelModeSync() {
    function triggerReplan() {
      if (pointA && pointB && !solving && navState !== NAV_STATE.NAVIGATING_LOCKED) {
        planRoute(pointA.lat, pointA.lon, pointB.lat, pointB.lon);
      }
    }
    if (window.MarsTravelMode && window.MarsTravelMode.onChange) {
      window.MarsTravelMode.onChange(triggerReplan);
    }
    const travelSelect = document.getElementById("travel-mode");
    if (travelSelect) {
      travelSelect.addEventListener("change", triggerReplan);
    }
  }

  if (typeof window !== "undefined") {
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", attachTravelModeSync);
    } else {
      attachTravelModeSync();
    }
  }

  return {
    setActive,
    reset,
    isActive,
    isNavigating,
    isLocked,
    getNavState,
    showScrubber,
    hideScrubber,
    planRoute,
    getLastSolvedSegment,
    startAutoTraversal,
    stopAutoTraversal,
    togglePauseTraversal,
    replayAutoTraversal,
    exitNavigation,
  };
})();
