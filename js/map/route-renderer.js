/* global L, MarsGeodesic, window */
/**
 * MANGALNAUTS — Aerospace Route Corridor & Telemetry Renderer
 * Inspired by NASA flight traverse systems and Team Martis-Ovikorsho.
 * Replaces standard single-layer polylines with multi-layered glowing corridors,
 * animated directional marching pulse dashes, milestone km badges, and elevation scrubber.
 */
window.MarsRouteRenderer = (function () {
  /**
   * Smooths discrete A* lattice coordinates into a flowing, natural aerodynamic curve
   * using a centripetal Catmull-Rom spline.
   */
  function smoothSpline(points, subdivisions) {
    if (!points || points.length < 3) return points;
    subdivisions = subdivisions || 3;
    const result = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      for (let t = 0; t < 1; t += 1 / subdivisions) {
        const t2 = t * t;
        const t3 = t2 * t;
        const lat = 0.5 * (
          (2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
        );
        const lon = 0.5 * (
          (2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
        );
        result.push([lat, lon]);
      }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  /**
   * Mars Geodetic calculations for heading bearing and lateral offset
   */
  const R_MARS = 3389500;

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  function offsetLatLng(lat, lon, bearingDeg, offsetMeters) {
    const bRad = (bearingDeg * Math.PI) / 180;
    const dLat = -((offsetMeters * Math.sin(bRad)) / R_MARS) * (180 / Math.PI);
    const dLon =
      ((offsetMeters * Math.cos(bRad)) /
        (R_MARS * Math.cos((lat * Math.PI) / 180))) *
      (180 / Math.PI);
    return [lat + dLat, lon + dLon];
  }

  /**
   * Generates dual parallel tire tracks for Mars Rover Mode (Photo 1 reference)
   */
  function buildParallelTracks(smoothPoints, offsetMeters) {
    if (!smoothPoints || smoothPoints.length < 2) return { left: [], right: [] };
    const left = [];
    const right = [];
    const n = smoothPoints.length;

    for (let i = 0; i < n; i++) {
      let b;
      if (i === 0) {
        b = calculateBearing(
          smoothPoints[0][0],
          smoothPoints[0][1],
          smoothPoints[1][0],
          smoothPoints[1][1]
        );
      } else if (i === n - 1) {
        b = calculateBearing(
          smoothPoints[n - 2][0],
          smoothPoints[n - 2][1],
          smoothPoints[n - 1][0],
          smoothPoints[n - 1][1]
        );
      } else {
        const b1 = calculateBearing(
          smoothPoints[i - 1][0],
          smoothPoints[i - 1][1],
          smoothPoints[i][0],
          smoothPoints[i][1]
        );
        const b2 = calculateBearing(
          smoothPoints[i][0],
          smoothPoints[i][1],
          smoothPoints[i + 1][0],
          smoothPoints[i + 1][1]
        );
        let diff = b2 - b1;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        b = (b1 + diff / 2 + 360) % 360;
      }
      left.push(offsetLatLng(smoothPoints[i][0], smoothPoints[i][1], b, -offsetMeters));
      right.push(offsetLatLng(smoothPoints[i][0], smoothPoints[i][1], b, offsetMeters));
    }
    return { left, right };
  }

  /**
   * Generates alternating astronaut footsteps / bootprints for Marswalk Mode (Photo 0 reference)
   * Ribbed cross-treads on ball of foot and chevrons on heel in Martian regolith
   */
  function buildFootstepMarkers(smoothPoints) {
    if (!smoothPoints || smoothPoints.length < 2) return [];
    const cum = [0];
    for (let i = 1; i < smoothPoints.length; i++) {
      const d = MarsGeodesic.haversineMeters(
        smoothPoints[i - 1][0],
        smoothPoints[i - 1][1],
        smoothPoints[i][0],
        smoothPoints[i][1]
      );
      cum.push(cum[cum.length - 1] + d);
    }
    const totalDist = cum[cum.length - 1];
    if (totalDist < 12) return [];

    // Step spacing: dynamically adapt to give clear, discernible footprints
    let stepDist = 20;
    if (totalDist > 4000) stepDist = 32;
    else if (totalDist < 500) stepDist = 14;

    const markers = [];
    let seg = 1;
    let stepCount = 0;

    for (let d = stepDist * 0.45; d < totalDist - stepDist * 0.3; d += stepDist) {
      while (seg < cum.length - 1 && cum[seg] < d) seg++;
      const span = Math.max(1, cum[seg] - cum[seg - 1]);
      const f = (d - cum[seg - 1]) / span;
      const pA = smoothPoints[seg - 1];
      const pB = smoothPoints[seg];

      const lat = pA[0] + (pB[0] - pA[0]) * f;
      const lon = pA[1] + (pB[1] - pA[1]) * f;
      const b = calculateBearing(pA[0], pA[1], pB[0], pB[1]);

      // Alternating left (-1.0m) and right (+1.0m) stride
      const isRight = stepCount % 2 === 1;
      const strideOffsetMeters = isRight ? 1.0 : -1.0;
      const [stepLat, stepLon] = offsetLatLng(lat, lon, b, strideOffsetMeters);

      const footClass = isRight ? "mars-foot-right" : "mars-foot-left";
      const svgTransform = isRight ? 'transform="scale(-1, 1) translate(-20, 0)"' : "";

      const footIcon = L.divIcon({
        className: "mars-footstep-icon",
        html:
          '<div class="mars-footstep-wrapper" style="transform: rotate(' +
          Math.round(b) +
          'deg);">' +
          '  <svg viewBox="0 0 20 40" class="mars-footstep-svg ' +
          footClass +
          '" width="13" height="26">' +
          '    <g ' +
          svgTransform +
          ">" +
          '      <path d="M 5,3 C 11,2 17,5 18,12 C 19,18 16,23 15,26 C 14,28 15,30 15,35 C 15,39 12,40 7,40 C 3,40 2,38 2,35 C 2,30 3,28 2,26 C 1,23 -1,18 0,12 C 1,5 2,3 5,3 Z" fill="rgba(6, 18, 30, 0.92)" stroke="#00f0ff" stroke-width="1.2"/>' +
          '      <line x1="3" y1="6.5" x2="14.5" y2="6.5" stroke="#00f0ff" stroke-width="1.2" stroke-linecap="round"/>' +
          '      <line x1="2.5" y1="9.5" x2="15.5" y2="9.5" stroke="#00f0ff" stroke-width="1.2" stroke-linecap="round"/>' +
          '      <line x1="2" y1="12.5" x2="16" y2="12.5" stroke="#00f0ff" stroke-width="1.2" stroke-linecap="round"/>' +
          '      <line x1="2.5" y1="15.5" x2="15.5" y2="15.5" stroke="#00f0ff" stroke-width="1.2" stroke-linecap="round"/>' +
          '      <line x1="3" y1="18.5" x2="14.5" y2="18.5" stroke="#00f0ff" stroke-width="1.2" stroke-linecap="round"/>' +
          '      <line x1="3.5" y1="21.5" x2="13.5" y2="21.5" stroke="#00f0ff" stroke-width="1.2" stroke-linecap="round"/>' +
          '      <line x1="8.5" y1="5" x2="8.5" y2="23" stroke="rgba(6, 18, 30, 0.95)" stroke-width="1.4"/>' +
          '      <path d="M 4,28 L 8.5,26 L 13,28" fill="none" stroke="#00f0ff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
          '      <path d="M 4,31.5 L 8.5,29.5 L 13,31.5" fill="none" stroke="#00f0ff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
          '      <path d="M 4,35 L 8.5,33 L 13,35" fill="none" stroke="#00f0ff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
          "    </g>" +
          "  </svg>" +
          "</div>",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      markers.push(
        L.marker([stepLat, stepLon], { icon: footIcon, interactive: false })
      );
      stepCount++;
    }

    return markers;
  }

  /**
   * Decimates dense internal raster nodes into 3-6 strategic tactical checkpoints (NAV-01, NAV-02...)
   * placed at significant terrain heading inflections and distance intervals.
   */
  function selectStrategicCheckpoints(pathNodes) {
    if (!pathNodes || pathNodes.length <= 2) return [];
    if (pathNodes.length <= 5) return pathNodes.slice(1, -1);

    const totalDist = pathNodes[pathNodes.length - 1].dist_m || 1000;
    const targetCount = Math.min(6, Math.max(3, Math.floor(totalDist / 600)));
    const stepDist = totalDist / (targetCount + 1);

    const selected = [];
    let nextTargetDist = stepDist;
    let lastChosenIdx = 0;

    for (let i = 1; i < pathNodes.length - 1; i++) {
      const node = pathNodes[i];
      const prev = pathNodes[i - 1];
      const next = pathNodes[i + 1];

      // Calculate heading change angle
      const b1 = Math.atan2(node.lon - prev.lon, node.lat - prev.lat);
      const b2 = Math.atan2(next.lon - node.lon, next.lat - node.lat);
      let angleDiff = Math.abs(b2 - b1) * 180 / Math.PI;
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      const isHighRisk = (node.risk || 0) > 0.55;
      const isNearTargetDist = Math.abs((node.dist_m || 0) - nextTargetDist) < stepDist * 0.45;
      const isSignificantTurn = angleDiff > 25 && (i - lastChosenIdx) >= 4;

      if ((isNearTargetDist || isSignificantTurn || isHighRisk) && (i - lastChosenIdx) >= 3 && selected.length < targetCount) {
        selected.push(node);
        lastChosenIdx = i;
        nextTargetDist += stepDist;
      }
    }

    if (selected.length === 0) {
      const step = Math.floor(pathNodes.length / 4);
      for (let i = step; i < pathNodes.length - 1; i += step) {
        selected.push(pathNodes[i]);
      }
    }

    return selected;
  }

  /**
   * Generates distance milestone ticks along a latlng route
   */
  function buildKmTicks(latlngs) {
    if (!latlngs || latlngs.length < 2) return [];

    // Compute cumulative distances
    const cum = [0];
    for (let i = 1; i < latlngs.length; i++) {
      const d = MarsGeodesic.haversineMeters(
        latlngs[i - 1][0],
        latlngs[i - 1][1],
        latlngs[i][0],
        latlngs[i][1]
      );
      cum.push(cum[cum.length - 1] + d);
    }

    const totalM = cum[cum.length - 1];
    if (totalM < 400) return []; // Too short for milestone badges

    // Choose step interval so we have 2 to 6 ticks
    let stepM = 1000;
    if (totalM <= 2500) stepM = 500;
    else if (totalM > 7000) stepM = 2000;

    const ticks = [];
    let seg = 1;

    for (let m = stepM; m < totalM - stepM * 0.25; m += stepM) {
      while (seg < cum.length - 1 && cum[seg] < m) seg++;
      const span = Math.max(1, cum[seg] - cum[seg - 1]);
      const f = (m - cum[seg - 1]) / span;
      const a = latlngs[seg - 1];
      const b = latlngs[seg];

      const tickLat = a[0] + (b[0] - a[0]) * f;
      const tickLon = a[1] + (b[1] - a[1]) * f;
      const label = (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + " km";

      const icon = L.divIcon({
        className: "route-km-tick",
        html:
          '<div class="route-tick-bubble">' +
          '  <span class="route-tick-dot"></span>' +
          '  <span class="route-tick-label">' +
          label +
          "</span>" +
          "</div>",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      ticks.push(L.marker([tickLat, tickLon], { icon: icon, interactive: false }));
    }

    return ticks;
  }

  /**
   * Builds an advanced multi-layered aerospace traverse corridor:
   * - In Marswalk Mode (walk): Alternating astronaut bootprints (Photo 0) with glowing cyan lifeline
   * - In Rover Mode (rover): Dual parallel cleated wheel tracks (Photo 1) in Martian regolith with autonav flow
   */
  function createCorridorLayer(latlngs, opts) {
    opts = opts || {};
    const group = L.layerGroup();
    const isWalk = opts.mode === "walk";
    const color = opts.color || (isWalk ? "#00f0ff" : "#f59e0b");

    // Smooth discrete lattice points into an aerodynamic spline curve
    const smoothPoints = smoothSpline(latlngs, 4);

    if (isWalk) {
      // 1. MARSWALK MODE (Photo 0 Astronaut Bootprints):
      // Glowing cyan halo & lifeline
      const halo = L.polyline(smoothPoints, {
        color: "#00f0ff",
        weight: 6,
        opacity: 0.22,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      });
      group.addLayer(halo);

      const coreTrace = L.polyline(smoothPoints, {
        color: "#00f0ff",
        weight: 1.6,
        opacity: 0.55,
        dashArray: "3, 8",
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      });
      group.addLayer(coreTrace);

      // Distinct astronaut footstep markers along the route (Photo 0)
      const footMarkers = buildFootstepMarkers(smoothPoints);
      footMarkers.forEach(function (m) {
        group.addLayer(m);
      });
    } else {
      // 2. ROVER MODE (Photo 1 Dual Parallel Cleated Wheel Tracks):
      // Martian Regolith Soil Depression Bed
      const rutBed = L.polyline(smoothPoints, {
        color: "#1d0804",
        weight: 11,
        opacity: 0.72,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      });
      group.addLayer(rutBed);

      // Dual parallel cleated wheel tracks (separated by 4.0m track gauge)
      const tracks = buildParallelTracks(smoothPoints, 2.0);
      const leftWheelTrack = L.polyline(tracks.left, {
        color: "#d96b27",
        weight: 3.2,
        opacity: 0.95,
        dashArray: "3, 5",
        lineCap: "butt",
        lineJoin: "round",
        interactive: false,
      });
      group.addLayer(leftWheelTrack);

      const rightWheelTrack = L.polyline(tracks.right, {
        color: "#d96b27",
        weight: 3.2,
        opacity: 0.95,
        dashArray: "3, 5",
        lineCap: "butt",
        lineJoin: "round",
        interactive: false,
      });
      group.addLayer(rightWheelTrack);

      // Central directional marching pulse flow
      if (opts.animated !== false) {
        const flow = L.polyline(smoothPoints, {
          color: "#fbbf24",
          weight: 1.6,
          opacity: 0.85,
          dashArray: "2, 14",
          lineCap: "round",
          className: "route-flow",
          interactive: false,
        });
        group.addLayer(flow);
      }
    }

    // Interactive hitbox for popups
    const hitbox = L.polyline(smoothPoints, {
      color: "transparent",
      weight: 16,
      opacity: 0,
      interactive: true,
    });
    if (opts.popupHtml) {
      hitbox.bindPopup(opts.popupHtml, { className: "hud-popup" });
    }
    group.addLayer(hitbox);

    // Dynamic Draw-in path animation on load
    if (opts.drawIn) {
      const drawIn = L.polyline(smoothPoints, {
        color: "#ffffff",
        weight: 4,
        opacity: 0.75,
        lineCap: "round",
        lineJoin: "round",
        className: "route-draw",
        interactive: false,
      });
      group.addLayer(drawIn);
    }

    // Floating Kilometric Distance Ticks
    if (opts.ticks !== false) {
      const ticks = buildKmTicks(smoothPoints);
      ticks.forEach(function (t) {
        group.addLayer(t);
      });
    }

    // Strategic Tactical Navigation Checkpoints (NAV-01, NAV-02...)
    if (opts.pathNodes && opts.pathNodes.length > 2) {
      const checkpoints = selectStrategicCheckpoints(opts.pathNodes);
      checkpoints.forEach(function (n, cpIdx) {
        const risk = Number.isFinite(n.risk) ? n.risk : 0.35;
        const beadColor =
          risk < 0.45 ? "#22c55e" : risk < 0.65 ? "#eab308" : "#ef4444";
        const cpName = "NAV-" + String(cpIdx + 1).padStart(2, "0");
        const distKm = n.dist_m != null ? (n.dist_m / 1000).toFixed(2) + " km" : "";

        const bead = L.circleMarker([n.lat, n.lon], {
          radius: 4.5,
          color: "#ffffff",
          fillColor: beadColor,
          fillOpacity: 0.95,
          weight: 2,
        });

        bead.bindTooltip(
          '<div class="hud-tooltip font-mono text-xs">' +
            '<div style="color:var(--accent); font-weight:700; margin-bottom:2px;">' +
            cpName +
            (distKm ? " · " + distKm : "") +
            "</div>" +
            "Elev: " +
            (n.elev_m != null ? n.elev_m.toFixed(1) + "m" : "—") +
            " · Slope: " +
            (n.slope_deg != null ? n.slope_deg.toFixed(1) + "°" : "—") +
            "<br/>GNN Risk: <strong style='color:" +
            beadColor +
            ";'>" +
            risk.toFixed(2) +
            "</strong>" +
            "</div>",
          { className: "hud-tooltip", direction: "top" }
        );
        group.addLayer(bead);
      });
    }

    return group;
  }

  /**
   * Mars Mission Waypoint Pin (Start Dark Green Teardrop & Stop Dark Red Teardrop with ground ring, Photo 1)
   */
  function createWaypointPin(kind, label, color) {
    const isStart = kind === "start";
    color = color || (isStart ? "#15803d" : "#b91c1c");
    const tag = isStart ? "START · DEPARTURE" : "OBJECTIVE · TARGET";
    const letter = label || (isStart ? "A" : "B");

    return L.divIcon({
      className: "mars-photo-pin-container",
      html:
        '<div class="mars-photo-pin-wrapper ' +
        (isStart ? "pin-start" : "pin-target") +
        '">' +
        '  <div class="pin-ground-ring" style="border-color: ' +
        color +
        "; box-shadow: 0 0 12px " +
        color +
        ', inset 0 0 6px rgba(0,0,0,0.85); background: rgba(0,0,0,0.5);"></div>' +
        '  <svg class="pin-teardrop-svg" viewBox="0 0 30 40" width="30" height="40">' +
        '    <path d="M15,1 C7.27,1 1,7.27 1,15 C1,25 15,39 15,39 C15,39 29,25 29,15 C29,7.27 22.73,1 15,1 Z" fill="' +
        color +
        '" stroke="#030712" stroke-width="2.5" stroke-linejoin="round"/>' +
        '    <circle cx="15" cy="14.5" r="6.2" fill="#ffffff" stroke="#030712" stroke-width="1.4"/>' +
        '    <text x="15" y="18.2" text-anchor="middle" font-size="11" font-weight="900" fill="#030712" font-family="\'JetBrains Mono\', monospace">' +
        letter +
        "</text>" +
        "  </svg>" +
        '  <span class="mars-photo-pin-tag" style="border-color:' +
        color +
        ';">' +
        tag +
        "</span>" +
        "</div>",
      iconSize: [30, 40],
      iconAnchor: [15, 39],
    });
  }

  return {
    buildKmTicks,
    createCorridorLayer,
    createWaypointPin,
    smoothSpline,
  };
})();
