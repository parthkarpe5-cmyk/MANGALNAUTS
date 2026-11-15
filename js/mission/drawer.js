/* global MarsGeodesic, MarsElevationProfile, MarsTelemetry, MarsIcons, MarsData, MarsSegmentPick, window */
window.MarsSegmentDrawer = (function () {
  let panel = null;
  let lastSegment = null;
  let renderId = 0;

  function ic(name) {
    return window.MarsIcons ? window.MarsIcons.get(name) : "";
  }

  function init(panelId) {
    panel = document.getElementById(panelId);
    render(null);

    // Re-render when site changes
    window.addEventListener("mars:site-changed", function () {
      if (!lastSegment) {
        render(null);
      }
    });
  }

  async function render(segment, statusText) {
    const id = ++renderId;
    if (!segment?.path_found) window.MarsContingency?.clear();
    if (!panel) return;
    if (statusText) {
      panel.innerHTML =
        '<div class="drawer-status-box">' +
        '  <span class="status-pulse-dot"></span>' +
        '  <p class="drawer-hint active-cue">' + statusText + '</p>' +
        '</div>';
      return;
    }

    if (!segment) {
      lastSegment = null;
      const siteMeta = window.MarsData && window.MarsData.getActiveSiteMeta
        ? await MarsData.getActiveSiteMeta()
        : null;

      if (id !== renderId) return;
      const siteName = siteMeta ? siteMeta.name : "Jezero Crater (Western Delta)";
      const rover = siteMeta ? siteMeta.rover : "Perseverance (Mars 2020)";
      const color = siteMeta?.boundary_color || (siteMeta?.id === "gale" ? "#f59e0b" : "#c9f31d");
      const graph = await MarsData.loadGraph().catch(() => null);
      if (id !== renderId) return;
      const quickMissions = (siteMeta?.quick_missions || []).filter(mission =>
        graph && [mission.from, mission.to].every(point =>
          MarsRouteBetween.hasElevation(graph, point.lat, point.lon))
      );

      let qmHtml = "";
      if (quickMissions.length > 0) {
        qmHtml = '<div class="quick-missions-group">' +
          '  <div class="qm-group-title">MISSION PRESETS WITH TERRAIN COVERAGE</div>';
        quickMissions.forEach(function (qm) {
          qmHtml +=
            '<div class="qm-card">' +
            '  <div class="qm-info">' +
            '    <div class="qm-title">' + qm.title + '</div>' +
            '    <div class="qm-desc">' + qm.desc + '</div>' +
            '  </div>' +
            '  <button type="button" class="btn-qm-run" data-flat="' + qm.from.lat + '" data-flon="' + qm.from.lon + '" data-tlat="' + qm.to.lat + '" data-tlon="' + qm.to.lon + '">' +
            '    <span>Run Traverse</span> ➔' +
            '  </button>' +
            '</div>';
        });
        qmHtml += '</div>';
      }

      panel.innerHTML =
        '<div class="drawer-overview">' +
        '  <div class="sector-status-card" style="border-left: 3px solid ' + color + ';">' +
        '    <div class="sector-badge-row">' +
        '      <span class="sector-color-tag" style="background: ' + color + ';"></span>' +
        '      <span class="sector-title-text">' + siteName.toUpperCase() + '</span>' +
        '    </div>' +
        '    <div class="sector-meta-line">' +
        '      <span>ROVER: <strong>' + rover + '</strong></span> · ' +
        '      <span>BOUNDARY: <strong style="color: ' + color + ';">ACTIVE</strong></span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="drawer-hint-card">' +
        '    <p>Choose two points to check elevation coverage and calculate a route under the selected slope limit.</p>' +
        '  </div>' +
        qmHtml +
        '</div>';

      // Bind quick mission buttons
      panel.querySelectorAll(".btn-qm-run").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const flat = parseFloat(btn.dataset.flat);
          const flon = parseFloat(btn.dataset.flon);
          const tlat = parseFloat(btn.dataset.tlat);
          const tlon = parseFloat(btn.dataset.tlon);
          if (window.MarsSegmentPick) {
            MarsSegmentPick.planRoute(flat, flon, tlat, tlon);
          }
        });
      });
      return;
    }

    if (segment.error || segment.status === "no_route") {
      panel.innerHTML =
        '<div class="drawer-error-box">' +
        '  <span class="error-badge">ERROR</span>' +
        '  <p class="drawer-error"></p>'
        '  <button type="button" class="btn-ghost" id="drawer-retry-btn">Reset Route</button> <button type="button" class="btn-ghost" id="drawer-fit-terrain">Center on measured terrain</button>' +
        "</div>";
      panel.querySelector(".drawer-error").textContent = segment.error || "No path meets the selected slope limit." ;
      panel.querySelector("#drawer-retry-btn").onclick = () => MarsSegmentPick.reset();
      panel.querySelector("#drawer-fit-terrain").onclick = () => MarsDetailMap.setSite(MarsData.getActiveSiteKey());
      return;
    }

    lastSegment = segment;

    const geo = MarsGeodesic.formatDistance(segment.geodesic_m);
    const path =
      segment.path_m != null
        ? MarsGeodesic.formatDistance(segment.path_m)
        : "—";
    const feasible = segment.path_found && segment.feasible;
    const feasClass = feasible ? "ok" : "bad";
    const feasText = segment.path_found
      ? feasible
        ? "FEASIBLE (" + (segment.mode === "walk" ? "WALK ≤15°" : "ROVER ≤20°") + ")"
        : "EXCEEDS SLOPE LIMIT"
      : "NO PATH FOUND";

    const riskVal = segment.mean_risk != null ? segment.mean_risk : 0.3;
    const riskPercent = Math.round(riskVal * 100);
    const slopeVal = segment.max_slope_deg != null ? segment.max_slope_deg : 0;
    const maxAllowedSlope = segment.mode === "walk" ? 15 : 20;
    const slopePercent = Math.min(
      100,
      Math.round((slopeVal / maxAllowedSlope) * 100)
    );

    let consumablesHtml = "";
    if (segment.path_found && segment.path_m && window.MarsTelemetry) {
      const c = MarsTelemetry.calculateConsumables(segment.path_m, segment.mode);
      consumablesHtml =
        '<div class="drawer-section drawer-consumables">' +
        '  <div class="section-title-row">' +
        "    <h4>" +
        ic("zap") +
        " Consumables Projection</h4>" +
        '    <span class="badge-mini">' +
        (segment.mode === "walk" ? "EVA SUIT" : "ROVER CABIN") +
        "</span>" +
        "  </div>" +
        '  <div class="consumables-grid">' +
        '    <div class="consumable-item">' +
        '      <span class="c-icon">' +
        ic("clock") +
        "</span>" +
        '      <div class="c-info">' +
        '        <span class="c-label">Est. Duration</span>' +
        '        <span class="c-val font-mono">' +
        (c.durationMin < 60 ? c.durationMin + " min" : c.durationHours + " hrs") +
        "</span>" +
        '        <span class="c-sub">Tobler slope speed</span>' +
        "      </div>" +
        "    </div>" +
        '    <div class="consumable-item">' +
        '      <span class="c-icon">' +
        ic("oxygen") +
        "</span>" +
        '      <div class="c-info">' +
        '        <span class="c-label">O₂ Required</span>' +
        '        <span class="c-val font-mono">' +
        c.o2Liters +
        " L</span>" +
        '        <span class="c-sub">PLSS 40 L/hr rate</span>' +
        "      </div>" +
        "    </div>" +
        '    <div class="consumable-item">' +
        '      <span class="c-icon">' +
        ic("battery") +
        "</span>" +
        '      <div class="c-info">' +
        '        <span class="c-label">Energy Draw</span>' +
        '        <span class="c-val font-mono">' +
        c.batteryWh +
        " Wh</span>" +
        '        <span class="c-sub">Thermal &amp; avionics 220W</span>' +
        "      </div>" +
        "    </div>" +
        "  </div>" +
        '  <div class="metric-explainer-box">' +
        '    <strong>ℹ WHY THESE METRICS:</strong> Astronaut EVA missions on Mars require verified oxygen, battery power, and slope limits prior to departure. O₂ calculated at 40 L/h human metabolic consumption; power at 220 W suit heating.' +
        '  </div>' +
        "</div>";
    }

    let profileHtml = "";
    if (segment.path_found && segment.path_nodes && window.MarsElevationProfile) {
      profileHtml =
        '<div class="drawer-section drawer-profile">' +
        '  <div class="section-title-row">' +
        "    <h4>" +
        ic("mountain") +
        " Elevation Profile</h4>" +
        '    <span class="badge-mini font-mono">&Delta;z ' +
        (segment.elev_delta_m != null ? segment.elev_delta_m.toFixed(1) + "m" : "—") +
        "</span>" +
        "  </div>" +
        MarsElevationProfile.renderSvg(segment.path_nodes, 330, 115) +
        "</div>";
    }

    panel.innerHTML =
      '<div class="drawer-header-row">' +
      '  <h3 class="drawer-title">' + ic("route") + ' OPTIMAL SAFE TRAVERSE</h3>' +
      '  <span class="drawer-feasible ' + feasClass + '">' + feasText + '</span>' +
      '</div>' +
      '<div class="drawer-stats-grid">' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Straight (Geodesic)</span>' +
      '    <span class="stat-val font-mono">' + geo + '</span>' +
      '    <span class="stat-sub">Line-of-sight distance</span>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Path Trajectory</span>' +
      '    <span class="stat-val font-mono highlight">' + path + '</span>' +
      '    <span class="stat-sub">Ground safe traverse</span>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Max Path Slope</span>' +
      '    <span class="stat-val font-mono ' + (slopeVal > maxAllowedSlope ? 'val-danger' : '') + '">' + slopeVal.toFixed(1) + '°</span>' +
      '    <span class="stat-sub">Limit: ≤' + maxAllowedSlope + '°</span>' +
      '    <div class="meter-bar"><div class="meter-fill slope-fill" style="width:' + slopePercent + '%"></div></div>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">GNN Mean Risk</span>' +
      '    <span class="stat-val font-mono ' + (riskPercent > 50 ? 'val-danger' : '') + '">' + riskPercent + '%</span>' +
      '    <span class="stat-sub">Terrain slip hazard</span>' +
      '    <div class="meter-bar"><div class="meter-fill risk-fill" style="width:' + riskPercent + '%"></div></div>' +
      '  </div>' +
      '</div>' +
      consumablesHtml +
      profileHtml +
      '<div class="route-action-bar">' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-reverse-route">🔄 Reverse Path</button>' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-clear-active-route">✕ Clear Route</button>' +
      '</div>';

    // Hook up elevation scrubber
    const svgEl = panel.querySelector(".elevation-profile-svg");
    if (svgEl && segment.path_nodes && segment.path_nodes.length > 1) {
      const totalDist = segment.path_nodes[segment.path_nodes.length - 1].dist_m;
      const paddingLeft = 45;
      const paddingRight = 20;

      svgEl.style.cursor = "crosshair";
      svgEl.addEventListener("mousemove", function (e) {
        const rect = svgEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pLeftPx = rect.width * (paddingLeft / 330);
        const pRightPx = rect.width * (paddingRight / 330);
        const chartWPx = rect.width - pLeftPx - pRightPx;
        const offsetX = Math.max(0, Math.min(chartWPx, x - pLeftPx));
        const ratio = chartWPx > 0 ? offsetX / chartWPx : 0;
        const distM = ratio * totalDist;
        if (window.MarsSegmentPick && window.MarsSegmentPick.showScrubber) {
          window.MarsSegmentPick.showScrubber(distM);
        }
      });

      const onLeave = function () {
        if (window.MarsSegmentPick && window.MarsSegmentPick.hideScrubber) {
          window.MarsSegmentPick.hideScrubber();
        }
      };
      svgEl.addEventListener("mouseleave", onLeave);
      svgEl.addEventListener("pointerleave", onLeave);
      svgEl.addEventListener("touchend", onLeave);
    }

    if (segment.terrain_spacing_m) {
      const label = document.createElement("p");
      label.className = "drawer-hint";
      label.textContent = segment.regional
        ? "Regional estimate · 200 m elevation. Small hazards may be unresolved. Contingency drills require local terrain."
        : "Elevation grid: " + segment.terrain_spacing_m + " m sampling";
      panel.prepend(label);
    }
    if (segment.path_found && !segment.regional) window.MarsContingency?.attach(panel, segment);

    // Action buttons

    const clearBtn = document.getElementById("btn-clear-active-route");
    if (clearBtn) clearBtn.onclick = () => MarsSegmentPick.reset();
    const revBtn = document.getElementById("btn-reverse-route");
    if (revBtn && segment.from && segment.to) {
      revBtn.addEventListener("click", function () {
        if (window.MarsSegmentPick) {
          MarsSegmentPick.planRoute(segment.to.lat, segment.to.lon, segment.from.lat, segment.from.lon);
        }
      });
    }
  }

  async function renderScienceStop(stop) {
    if (!panel) return;
    const catIcon = (stop.type || "").includes("Delta")
      ? ic("waves")
      : (stop.type || "").includes("Landing")
      ? ic("rocket")
      : ic("mountain");

    const siteMeta = window.MarsData && window.MarsData.getActiveSiteMeta
      ? await MarsData.getActiveSiteMeta()
      : null;

    panel.innerHTML =
      '<div class="science-card">' +
      '  <div class="science-card-head">' +
      '    <div class="stop-avatar">' + catIcon + '</div>' +
      '    <div class="stop-head-text">' +
      '      <h3>' + stop.name + '</h3>' +
      '      <span class="type-tag">' + (stop.type || "Science Target") + '</span>' +
      '    </div>' +
      '    <button type="button" class="btn-ghost btn-icon close-card-btn" id="close-science-card" title="Close Intel">' + ic("close") + '</button>' +
      '  </div>' +
      (stop.image_url
        ? '  <div class="science-img-wrap">' +
          '    <img src="' + stop.image_url + '" alt="' + stop.name + '" loading="lazy" />' +
          '    <div class="img-overlay">' +
          '      <span class="img-caption">' + (stop.image_caption || "") + '</span>' +
          '    </div>' +
          '  </div>'
        : "") +
      '  <div class="science-details">' +
      '    <div class="meta-pills">' +
      '      <span class="meta-pill"><strong>Discovery:</strong> Sol ' + (stop.sol != null ? stop.sol : "Initial") + '</span>' +
      '      <span class="meta-pill"><strong>Elevation:</strong> ' + (stop.elev_m != null ? stop.elev_m + " m" : "—") + '</span>' +
      '      <span class="meta-pill priority-' + (stop.science_priority || "normal").toLowerCase() + '">Priority: ' + (stop.science_priority || "High") + '</span>' +
      '    </div>' +
      '    <div class="intel-block">' +
      '      <div class="intel-label">PRIMARY SCIENCE TARGET</div>' +
      '      <div class="intel-content">' + (stop.primary_target || stop.name) + '</div>' +
      '    </div>' +
      '    <p class="desc">' + (stop.description || "Documented scientific target analyzed by rover instruments.") + '</p>' +
      '    <div class="geology-box">' +
      '      <div class="geo-label">GEOLOGIC CONTEXT</div>' +
      '      ' + (stop.geology || "Stratified Martian sedimentary/bedrock outcrop.") +
      '    </div>' +
      '    <div class="science-action-row">' +
      '      <button type="button" class="btn-primary" id="btn-route-to-stop">🎯 Plan Route to this Target</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const closeBtn = document.getElementById("close-science-card");
    if (closeBtn) {
      closeBtn.onclick = function () {
        render(lastSegment);
      };
    }

    const routeToStopBtn = document.getElementById("btn-route-to-stop");
    if (routeToStopBtn) {
      routeToStopBtn.onclick = function () {
        // Base coordinates: default to landing site
        const baseLat = siteMeta?.id === "gale" ? -4.5895 : 18.4447;
        const baseLon = siteMeta?.id === "gale" ? 137.4417 : 77.4509;
        const stopLat = stop.lat != null ? stop.lat : (stop.coordinates ? stop.coordinates[1] : 18.4312);
        const stopLon = stop.lon != null ? stop.lon : (stop.coordinates ? stop.coordinates[0] : 77.4128);

        if (window.MarsSegmentPick) {
          MarsSegmentPick.planRoute(baseLat, baseLon, stopLat, stopLon);
        }
      };
    }
  }

  return { init, render, renderScienceStop };
})();
