/* global L, MarsAstar, MarsData, MarsDetailMap, MarsGeodesic, MarsTelemetry, MarsIcons, window, document */
/**
 * MANGALNAUTS — Contingency drills (prototype)
 *
 * "If something fails here, what recovery options remain?"
 *  - Walk-back cover: from every point on the planned route, can the crew
 *    still walk back to the start (base) inside the suit reserve?
 *  - Rover fails:      walk-back path from an incident point to base.
 *  - Corridor blocked: re-route A→B around a blocked zone.
 *  - Cascade:          rover fails, then the walk-back corridor is blocked.
 *
 * All incident inputs are simulated. Reserve is an assumption, labelled in the UI.
 * Uses the same terrain graph and A* router as the main planner.
 */
window.MarsContingency = (function () {
  const WALK_LIMIT_DEG = 15;
  const SUIT_RESERVE_MIN = 120; // assumed suit O2 reserve for a walk-back (simulated)
  const BLOCK_RADIUS_M = 650;

  const C = {
    walk: "#F3E8E2",
    detour: "#66D9FF",
    block: "#FF8B86",
  };

  let layer = null;
  let segment = null;
  let panel = null;
  let activeDrill = null;
  let fraction = 0.6;
  let runId = 0;

  function ic(name) {
    return window.MarsIcons ? window.MarsIcons.get(name) : "";
  }
  function map() {
    return MarsDetailMap.isReady() ? MarsDetailMap.getMap() : null;
  }
  function fmtKm(m) {
    return MarsGeodesic.formatDistance(m);
  }
  function fmtMin(min) {
    return min < 60 ? Math.round(min) + " min" : (min / 60).toFixed(1) + " h";
  }

  function clearLayer() {
    const m = map();
    if (layer && m) m.removeLayer(layer);
    layer = null;
    const stage = document.querySelector(".map-stage");
    if (stage) stage.classList.remove("drill-active");
  }

  function clear() {
    clearLayer();
    segment = null;
    panel = null;
    activeDrill = null;
    runId++;
  }

  // ---- graph helpers -------------------------------------------------------
  function nodesById(g) {
    if (!g._byId) {
      g._byId = {};
      g.nodes.forEach(function (n) {
        g._byId[n.id] = n;
      });
    }
    return g._byId;
  }

  function without(g, blocked) {
    if (!blocked || !blocked.size) return g;
    return {
      nodes: g.nodes.filter(function (n) {
        return !blocked.has(n.id);
      }),
      edges: g.edges.filter(function (e) {
        return !blocked.has(e.from) && !blocked.has(e.to);
      }),
    };
  }

  function route(g, fromId, toId, maxSlope, blocked) {
    if (fromId === toId) {
      return { found: true, path: [fromId], length_m: 0, max_slope_deg: 0 };
    }
    const r = MarsAstar.findPath(without(g, blocked), fromId, toId, {
      maxSlopeDeg: maxSlope,
    });
    if (!r.found) return { found: false, path: [] };
    return {
      found: true,
      path: r.path,
      length_m: MarsAstar.pathLengthM(g, r.path),
      max_slope_deg: MarsAstar.pathStats(g, r.path).max_slope_deg,
    };
  }

  function blockedAround(g, center, keep) {
    const set = new Set();
    g.nodes.forEach(function (n) {
      if (keep.indexOf(n.id) !== -1) return;
      if (MarsGeodesic.haversineMeters(center.lat, center.lon, n.lat, n.lon) <= BLOCK_RADIUS_M) {
        set.add(n.id);
      }
    });
    return set;
  }

  function walkBack(lengthM) {
    const c = MarsTelemetry.calculateConsumables(lengthM, "walk");
    const minutes = c.durationSec / 60;
    return {
      minutes: minutes,
      o2: c.o2Liters,
      reservePct: Math.round((minutes / SUIT_RESERVE_MIN) * 100),
      withinReserve: minutes <= SUIT_RESERVE_MIN,
    };
  }

  function incidentNode() {
    const nodes = segment.path_nodes;
    const total = nodes[nodes.length - 1].dist_m;
    const target = total * fraction;
    let best = nodes[0];
    nodes.forEach(function (n) {
      if (Math.abs(n.dist_m - target) < Math.abs(best.dist_m - target)) best = n;
    });
    return best;
  }

  function latlngs(g, path) {
    const byId = nodesById(g);
    return path.map(function (id) {
      return [byId[id].lat, byId[id].lon];
    });
  }

  // ---- drawing -------------------------------------------------------------
  function ensureLayer() {
    const m = map();
    if (!m) return null;
    if (!layer) layer = L.layerGroup().addTo(m);
    const stage = document.querySelector(".map-stage");
    if (stage) stage.classList.add("drill-active");
    return layer;
  }

  function drawPath(pts, color, dash, weight) {
    const l = ensureLayer();
    if (!l || pts.length < 2) return;
    l.addLayer(
      L.polyline(pts, { color: "#0B090A", weight: (weight || 3) + 4, opacity: 0.6, interactive: false })
    );
    l.addLayer(
      L.polyline(pts, {
        color: color,
        weight: weight || 3,
        dashArray: dash,
        lineCap: "round",
        opacity: 0.95,
        interactive: false,
      })
    );
  }

  function drawBlock(center) {
    const l = ensureLayer();
    if (!l) return;
    l.addLayer(
      L.circle([center.lat, center.lon], {
        radius: MarsDetailMap.marsRadius ? MarsDetailMap.marsRadius(BLOCK_RADIUS_M) : BLOCK_RADIUS_M,
        color: C.block,
        weight: 3,
        dashArray: "5 4",
        fillColor: C.block,
        fillOpacity: 0.32,
        interactive: false,
      })
    );
    l.addLayer(
      L.marker([center.lat, center.lon], {
        interactive: false,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: "drill-tag-icon",
          html: '<span class="drill-tag block">Blocked</span>',
          iconSize: [0, 0],
        }),
      })
    );
  }

  function drawFailure(node, label) {
    const l = ensureLayer();
    if (!l) return;
    l.addLayer(
      L.marker([node.lat, node.lon], {
        interactive: false,
        zIndexOffset: 900,
        icon: L.divIcon({
          className: "drill-tag-icon",
          html: '<span class="drill-fail">✕</span><span class="drill-tag">' + label + "</span>",
          iconSize: [0, 0],
        }),
      })
    );
  }

  // ---- panel ---------------------------------------------------------------
  function sectionHtml(seg) {
    const isRover = seg.mode === "rover";
    return (
      '<section class="rp-drill" aria-label="Contingency drills">' +
      '  <div class="rp-section-head"><span>' + ic("shield") + " Contingency</span>" +
      '  <span class="rp-sim" title="Incident inputs and suit reserve are simulated">Simulated</span></div>' +
      '  <div class="rp-cover">' +
      '    <div class="rp-cover-row"><span class="rp-label">Walk-back cover</span><span class="rp-cover-val font-mono">…</span></div>' +
      '    <div class="rp-strip" aria-hidden="true"></div>' +
      '    <p class="rp-cover-note">Can the crew walk back to A from each point? Walk ≤' +
      WALK_LIMIT_DEG + "°, " + SUIT_RESERVE_MIN / 60 + " h assumed suit reserve.</p>" +
      "  </div>" +
      '  <label class="rp-slider"><span>Incident at <output class="font-mono">—</output></span>' +
      '    <input type="range" min="5" max="95" step="1" value="' + Math.round(fraction * 100) + '" aria-label="Incident position along route" />' +
      "  </label>" +
      '  <div class="rp-drill-btns" role="group" aria-label="Drill">' +
      '    <button type="button" data-drill="abort">' + (isRover ? "Rover fails" : "Turn back") + "</button>" +
      '    <button type="button" data-drill="block">Corridor blocked</button>' +
      '    <button type="button" data-drill="cascade">Both</button>' +
      "  </div>" +
      '  <div class="rp-drill-out" aria-live="polite"><p class="rp-drill-idle">Pick a drill to test a recovery plan.</p></div>' +
      "</section>"
    );
  }

  function verdict(ok, okText, badText) {
    return '<span class="rp-verdict ' + (ok ? "ok" : "bad") + '">' + (ok ? okText : badText) + "</span>";
  }

  function rows(list) {
    return (
      '<dl class="rp-details">' +
      list
        .map(function (r) {
          return "<div><dt>" + r[0] + '</dt><dd class="font-mono' + (r[2] ? " val-danger" : "") + '">' + r[1] + "</dd></div>";
        })
        .join("") +
      "</dl>"
    );
  }

  function updateSliderLabel() {
    if (!panel) return;
    const out = panel.querySelector(".rp-slider output");
    if (!out || !segment) return;
    out.textContent = fmtKm(incidentNode().dist_m) + " from A";
  }

  async function renderCover(myRun) {
    const g = await MarsData.loadGraph();
    if (myRun !== runId || !panel) return;
    const startId = segment.node_ids[0];
    const results = segment.path_nodes.map(function (n) {
      const r = route(g, n.id, startId, WALK_LIMIT_DEG);
      const ok = r.found && walkBack(r.length_m).withinReserve;
      return { node: n, ok: ok, len: r.found ? r.length_m : null };
    });
    const total = segment.path_nodes[segment.path_nodes.length - 1].dist_m || 1;
    const strip = panel.querySelector(".rp-strip");
    const val = panel.querySelector(".rp-cover-val");
    if (!strip || !val) return;
    let html = "";
    let coveredM = 0;
    for (let i = 0; i < results.length - 1; i++) {
      const span = results[i + 1].node.dist_m - results[i].node.dist_m;
      const ok = results[i].ok && results[i + 1].ok;
      if (ok) coveredM += span;
      html += '<span class="' + (ok ? "ok" : "bad") + '" style="flex:' + Math.max(span, 1) + '"></span>';
    }
    strip.innerHTML = html;
    const pct = Math.round((coveredM / total) * 100);
    val.textContent = pct + "% of route";
    val.classList.toggle("val-danger", pct < 100);
    const firstBad = results.find(function (r) {
      return !r.ok;
    });
    const longest = results.reduce(function (m, r) {
      return r.ok && r.len > m ? r.len : m;
    }, 0);
    if (!firstBad && longest > 0) {
      panel.querySelector(".rp-cover-note").innerHTML =
        "Walk back to A is possible from every point. Longest walk-back: <strong class=\"ok\">" +
        fmtKm(longest) + " · " + fmtMin(walkBack(longest).minutes) + "</strong> (≤" +
        WALK_LIMIT_DEG + "°, " + SUIT_RESERVE_MIN / 60 + " h assumed reserve).";
    }
    if (firstBad) {
      const note = panel.querySelector(".rp-cover-note");
      note.innerHTML =
        "No walk-back after <strong>" + fmtKm(firstBad.node.dist_m) + "</strong> from A. Beyond this, the crew depends on the vehicle.";
      const l = ensureLayer();
      if (l) {
        l.addLayer(
          L.circleMarker([firstBad.node.lat, firstBad.node.lon], {
            radius: 6,
            color: "#0B090A",
            weight: 2,
            fillColor: C.block,
            fillOpacity: 1,
          }).bindTooltip("Point of no walk-back", { className: "hud-tooltip", direction: "top" })
        );
      }
    }
  }

  async function runDrill(myRun) {
    const out = panel && panel.querySelector(".rp-drill-out");
    if (!out) return;
    panel.querySelectorAll(".rp-drill-btns button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.drill === activeDrill);
      b.setAttribute("aria-pressed", b.dataset.drill === activeDrill ? "true" : "false");
    });
    clearLayer();
    if (!activeDrill) {
      out.innerHTML = '<p class="rp-drill-idle">Pick a drill to test a recovery plan.</p>';
      renderCover(myRun);
      return;
    }

    const g = await MarsData.loadGraph();
    if (myRun !== runId) return;
    const byId = nodesById(g);
    const startId = segment.node_ids[0];
    const goalId = segment.node_ids[segment.node_ids.length - 1];
    const modeLimit = segment.mode === "walk" ? 15 : 20;
    const inc = incidentNode();
    const isRover = segment.mode === "rover";
    let html = "";

    if (activeDrill === "abort") {
      const r = route(g, inc.id, startId, WALK_LIMIT_DEG);
      drawFailure(inc, isRover ? "Rover fails" : "Turn back");
      if (!r.found) {
        html =
          verdict(false, "", "No walk-back") +
          '<p class="rp-drill-text">No path back to A stays under ' + WALK_LIMIT_DEG + "° on foot from here.</p>";
      } else {
        const w = walkBack(r.length_m);
        drawPath(latlngs(g, r.path), C.walk, "1 7", 3.5);
        html =
          verdict(w.withinReserve, "Walk-back OK", "Exceeds suit reserve") +
          rows([
            ["Walk back to A", fmtKm(r.length_m)],
            ["Time on foot", fmtMin(w.minutes)],
            ["Steepest edge", r.max_slope_deg.toFixed(1) + "°"],
            ["Suit O₂ used", w.o2 + " L · " + w.reservePct + "% of reserve", !w.withinReserve],
          ]);
      }
    } else if (activeDrill === "block") {
      const blocked = blockedAround(g, inc, [startId, goalId]);
      drawBlock(inc);
      const r = route(g, startId, goalId, modeLimit, blocked);
      if (!r.found) {
        html =
          verdict(false, "", "No detour") +
          '<p class="rp-drill-text">This corridor is a single bottleneck. Plan a different route before you go.</p>';
      } else {
        drawPath(latlngs(g, r.path), C.detour, "9 7", 3.5);
        const extra = r.length_m - (segment.path_m || 0);
        const pct = segment.path_m ? Math.round((extra / segment.path_m) * 100) : 0;
        html =
          verdict(true, "Detour found", "") +
          (extra < 50
            ? '<p class="rp-drill-text">A parallel corridor of the same length avoids the blocked zone.</p>'
            : "") +
          rows([
            ["Detour distance", fmtKm(r.length_m)],
            ["Extra distance", extra < 50 ? "none" : "+" + fmtKm(extra) + " (+" + pct + "%)", pct > 30],
            ["Steepest edge", r.max_slope_deg.toFixed(1) + "° (limit " + modeLimit + "°)"],
          ]);
      }
    } else if (activeDrill === "cascade") {
      drawFailure(inc, isRover ? "Rover fails" : "Turn back");
      const direct = route(g, inc.id, startId, WALK_LIMIT_DEG);
      if (!direct.found || direct.path.length < 3) {
        html =
          verdict(false, "", "No walk-back") +
          '<p class="rp-drill-text">No walking corridor to block from this point. Move the incident further along.</p>';
      } else {
        const mid = byId[direct.path[Math.floor(direct.path.length / 2)]];
        const blocked = blockedAround(g, mid, [inc.id, startId]);
        drawBlock(mid);
        drawPath(latlngs(g, direct.path), "rgba(243,232,226,0.35)", "1 7", 2.5);
        const r = route(g, inc.id, startId, WALK_LIMIT_DEG, blocked);
        if (!r.found) {
          html =
            verdict(false, "", "Stranded") +
            '<p class="rp-drill-text">With the walk-back blocked, no other path stays under ' +
            WALK_LIMIT_DEG + "°. Wait for rescue or carry a second vehicle.</p>";
        } else {
          const w = walkBack(r.length_m);
          drawPath(latlngs(g, r.path), C.walk, "1 7", 3.5);
          html =
            verdict(w.withinReserve, "Recovery path found", "Over suit reserve") +
            rows([
              ["New walk-back", fmtKm(r.length_m)],
              ["Extra vs direct", r.length_m - direct.length_m < 50 ? "none (parallel path)" : "+" + fmtKm(r.length_m - direct.length_m)],
              ["Time on foot", fmtMin(w.minutes)],
              ["Suit O₂ used", w.o2 + " L · " + w.reservePct + "% of reserve", !w.withinReserve],
            ]);
        }
      }
    }
    if (myRun !== runId) return;
    out.innerHTML = html;
  }

  /** Called by the route panel after it renders a solved route. */
  function attach(panelEl, seg) {
    clearLayer();
    runId++;
    const myRun = runId;
    panel = panelEl;
    segment = seg;
    if (!panel || !seg || !seg.path_found || !seg.path_nodes || seg.path_nodes.length < 2) return;

    const host = panel.querySelector(".rp-drill-host");
    if (!host) return;
    host.innerHTML = sectionHtml(seg);
    updateSliderLabel();

    const slider = host.querySelector('input[type="range"]');
    slider.addEventListener("input", function () {
      fraction = Number(slider.value) / 100;
      updateSliderLabel();
    });
    slider.addEventListener("change", function () {
      runId++;
      runDrill(runId);
    });
    host.querySelectorAll(".rp-drill-btns button").forEach(function (b) {
      b.addEventListener("click", function () {
        if (window.MarsAudio) window.MarsAudio.playClick();
        activeDrill = activeDrill === b.dataset.drill ? null : b.dataset.drill;
        runId++;
        runDrill(runId);
      });
    });

    if (activeDrill) {
      runDrill(myRun).then(function () {
        renderCover(myRun);
      });
    } else {
      renderCover(myRun);
    }
  }

  return { attach, clear };
})();
