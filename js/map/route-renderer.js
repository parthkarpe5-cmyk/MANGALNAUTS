/* global L, MarsGeodesic, window */
/**
 * MANGALNAUTS — Aerospace Route Corridor & Telemetry Renderer
 * Inspired by NASA flight traverse systems and Team Martis-Ovikorsho.
 * Replaces standard single-layer polylines with multi-layered glowing corridors,
 * animated directional marching pulse dashes, milestone km badges, and elevation scrubber.
 */
window.MarsRouteRenderer = (function () {
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
   * Builds an advanced multi-layered sci-fi traverse corridor:
   * 1. Dark high-contrast casing (11px, #05070a)
   * 2. Soft glowing halo (7px, 35% opacity)
   * 3. Core high-visibility track (3.5px solid)
   * 4. Animated directional marching dashes (2px, white neon, .route-flow)
   * 5. Optional milestone km ticks along the route
   * 6. Optional risk-colored waypoint beads
   */
  function createCorridorLayer(latlngs, opts) {
    opts = opts || {};
    const group = L.layerGroup();
    const color = opts.color || "#38bdf8";

    // 1. Outer Dark Contrast Casing
    const casing = L.polyline(latlngs, {
      color: "#05070a",
      weight: 10,
      opacity: 0.72,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    });
    group.addLayer(casing);

    // 2. Soft Glowing Halo Aura
    const halo = L.polyline(latlngs, {
      color: color,
      weight: 7,
      opacity: 0.38,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
    });
    group.addLayer(halo);

    // 3. Core Solid High-Contrast Track
    const core = L.polyline(latlngs, {
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
      const flow = L.polyline(latlngs, {
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
      const drawIn = L.polyline(latlngs, {
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
      const ticks = buildKmTicks(latlngs);
      ticks.forEach(function (t) {
        group.addLayer(t);
      });
    }

    // 7. Intermediate Waypoint Beads (Colored by GNN Risk)
    if (opts.pathNodes && opts.pathNodes.length > 2) {
      opts.pathNodes.forEach(function (n, idx) {
        if (idx === 0 || idx === opts.pathNodes.length - 1) return;
        const risk = Number.isFinite(n.risk) ? n.risk : 0.35;
        const beadColor =
          risk < 0.45 ? "#22c55e" : risk < 0.65 ? "#eab308" : "#ef4444";

        const bead = L.circleMarker([n.lat, n.lon], {
          radius: 4,
          color: "#ffffff",
          fillColor: beadColor,
          fillOpacity: 0.95,
          weight: 1.5,
        });

        bead.bindTooltip(
          '<div class="hud-tooltip font-mono text-xs">' +
            "<strong>Waypoint #" +
            idx +
            "</strong><br/>" +
            "Elev: " +
            (n.elev_m != null ? n.elev_m.toFixed(1) + "m" : "—") +
            " · Slope: " +
            (n.slope_deg != null ? n.slope_deg.toFixed(1) + "°" : "—") +
            "<br/>GNN Risk: " +
            risk.toFixed(2) +
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
        '<div class="mars-route-pin">' +
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
      iconSize: [0, 0],
      iconAnchor: [14, 14],
    });
  }

  return {
    buildKmTicks,
    createCorridorLayer,
    createWaypointPin,
  };
})();
