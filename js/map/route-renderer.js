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
   * 1. Dark high-contrast casing (10px, #05070a)
   * 2. Soft glowing halo (7px, 38% opacity)
   * 3. Core high-visibility track (3.5px solid)
   * 4. Animated directional marching dashes (2px, white neon, .route-flow)
   * 5. Distance milestone km ticks along the route
   * 6. Strategic tactical navigation checkpoints (NAV-01, NAV-02...)
   */
  function createCorridorLayer(latlngs, opts) {
    opts = opts || {};
    const group = L.layerGroup();
    const color = opts.color || "#38bdf8";

    // Smooth discrete lattice points into an aerodynamic spline curve
    const smoothPoints = smoothSpline(latlngs, 4);

    // 1. Outer Dark Contrast Casing
    const casing = L.polyline(smoothPoints, {
      color: "#05070a",
      weight: 10,
      opacity: 0.72,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    });
    group.addLayer(casing);

    // 2. Soft Glowing Halo Aura
    const halo = L.polyline(smoothPoints, {
      color: color,
      weight: 7,
      opacity: 0.38,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    });
    group.addLayer(halo);

    // 3. Core Solid High-Contrast Track
    const core = L.polyline(smoothPoints, {
      color: color,
      weight: 3.5,
      opacity: 0.98,
      lineCap: "round",
      lineJoin: "round",
      interactive: true,
    });
    if (opts.popupHtml) {
      core.bindPopup(opts.popupHtml, { className: "hud-popup" });
    }
    group.addLayer(core);

    // 4. Directional Marching Pulse Flow Animation
    if (opts.animated !== false) {
      const flow = L.polyline(smoothPoints, {
        color: "#ffffff",
        weight: 2,
        opacity: 0.92,
        dashArray: "2, 14",
        lineCap: "round",
        className: "route-flow",
        interactive: false,
      });
      group.addLayer(flow);
    }

    // 5. Draw-in dynamic path animation on load
    if (opts.drawIn) {
      const drawIn = L.polyline(smoothPoints, {
        color: "#ffffff",
        weight: 4.5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
        className: "route-draw",
        interactive: false,
      });
      group.addLayer(drawIn);
    }

    // 6. Floating Kilometric Distance Ticks
    if (opts.ticks !== false) {
      const ticks = buildKmTicks(smoothPoints);
      ticks.forEach(function (t) {
        group.addLayer(t);
      });
    }

    // 7. Strategic Tactical Navigation Checkpoints (NAV-01, NAV-02...)
    if (opts.pathNodes && opts.pathNodes.length > 2) {
      const checkpoints = selectStrategicCheckpoints(opts.pathNodes);
      checkpoints.forEach(function (n, cpIdx) {
        const risk = Number.isFinite(n.risk) ? n.risk : 0.35;
        const beadColor =
          risk < 0.45 ? "#22c55e" : risk < 0.65 ? "#eab308" : "#ef4444";
        const cpName = "NAV-" + String(cpIdx + 1).padStart(2, "0");
        const distKm = n.dist_m != null ? (n.dist_m / 1000).toFixed(2) + " km" : "";

        const bead = L.circleMarker([n.lat, n.lon], {
          radius: 5,
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
   * Aerospace Waypoint Pin Badge (Start / Target)
   */
  function createWaypointPin(kind, label, color) {
    color = color || (kind === "start" ? "#22c55e" : "#F26A3D");
    const tag = kind === "start" ? "START · DEPARTURE" : "OBJECTIVE · TARGET";
    return L.divIcon({
      className: "mars-route-pin",
      html:
        '<div class="mars-route-pin-content">' +
        '  <span class="mars-route-pin-icon" style="background: rgba(' +
        (kind === "start" ? "34, 197, 94" : "242, 106, 61") +
        ', 0.22); color: ' +
        color +
        "; border: 2px solid " +
        color +
        ';">' +
        label +
        "</span>" +
        '  <span class="mars-route-pin-tag" style="border-color:' +
        color +
        ';">' +
        tag +
        "</span>" +
        "</div>",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  return {
    buildKmTicks,
    createCorridorLayer,
    createWaypointPin,
    smoothSpline,
  };
})();
