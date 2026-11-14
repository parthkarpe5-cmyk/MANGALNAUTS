/* global MarsGeodesic, MarsElevationProfile, MarsTelemetry, MarsIcons, window */
window.MarsSegmentDrawer = (function () {
  let panel = null;
  let lastSegment = null;

  function ic(name) {
    return window.MarsIcons ? window.MarsIcons.get(name) : "";
  }

  function init(panelId) {
    panel = document.getElementById(panelId);
    render(null);
  }

  function render(segment, statusText) {
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
      panel.innerHTML =
        '<div class="drawer-empty">' +
        '  <div class="drawer-empty-icon">' + ic("crosshair") + '</div>' +
        '  <h4 class="drawer-empty-title">TACTICAL MISSION NAVIGATOR</h4>' +
        '  <p class="drawer-hint">Activate <strong>Plan Segment (A→B)</strong> on the surface toolbar, then select any two points on the CTX map to calculate optimal surface traverse, slope profile, and life-support consumables.</p>' +
        '  <div class="drawer-tip">' + ic("sparkles") + ' Tip: Click any <strong>Science Stop</strong> marker (e.g. Western Delta) to inspect high-resolution NASA rover photography &amp; geologic data.</div>' +
        '</div>';
      return;
    }
    if (segment.error) {
      panel.innerHTML =
        '<div class="drawer-error-box">' +
        '  <span class="error-badge">ERROR</span>' +
        '  <p class="drawer-error"></p>' +
        "</div>";
      panel.querySelector(".drawer-error").textContent = segment.error;
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
        " EVA Consumables Projection</h4>" +
        '    <span class="badge-mini">' +
        (segment.mode === "walk" ? "EVA SUIT" : "ROVER CABIN") +
        "</span>" +
        "  </div>" +
        '  <div class="consumables-grid">' +
        '    <div class="consumable-item">' +
        '      <span class="c-icon">' +
        ic("clock") +
        '</span>' +
        '      <div class="c-info">' +
        '        <span class="c-label">Est. Duration</span>' +
        '        <span class="c-val font-mono">' +
        (c.durationMin < 60 ? c.durationMin + " min" : c.durationHours + " hrs") +
        "</span>" +
        "      </div>" +
        "    </div>" +
        '    <div class="consumable-item">' +
        '      <span class="c-icon">' +
        ic("oxygen") +
        '</span>' +
        '      <div class="c-info">' +
        '        <span class="c-label">O₂ Required</span>' +
        '        <span class="c-val font-mono">' +
        c.o2Liters +
        " L</span>" +
        "      </div>" +
        "    </div>" +
        '    <div class="consumable-item">' +
        '      <span class="c-icon">' +
        ic("battery") +
        '</span>' +
        '      <div class="c-info">' +
        '        <span class="c-label">Energy Draw</span>' +
        '        <span class="c-val font-mono">' +
        c.batteryWh +
        " Wh</span>" +
        "      </div>" +
        "    </div>" +
        "  </div>" +
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
      '  <h3 class="drawer-title">' + ic("route") + ' ROUTE INTEL</h3>' +
      '  <span class="drawer-feasible ' + feasClass + '">' + feasText + '</span>' +
      '</div>' +
      '<div class="drawer-stats-grid">' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Straight (Geodesic)</span>' +
      '    <span class="stat-val font-mono">' + geo + '</span>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Path Trajectory</span>' +
      '    <span class="stat-val font-mono highlight">' + path + '</span>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Max Path Slope</span>' +
      '    <span class="stat-val font-mono ' + (slopeVal > maxAllowedSlope ? 'val-danger' : '') + '">' + slopeVal.toFixed(1) + '°</span>' +
      '    <div class="meter-bar"><div class="meter-fill slope-fill" style="width:' + slopePercent + '%"></div></div>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">GNN Mean Risk</span>' +
      '    <span class="stat-val font-mono ' + (riskPercent > 50 ? 'val-danger' : '') + '">' + riskPercent + '%</span>' +
      '    <div class="meter-bar"><div class="meter-fill risk-fill" style="width:' + riskPercent + '%"></div></div>' +
      '  </div>' +
      '</div>' +
      '<div class="nodes-banner">' +
      '  <span class="nodes-label">Waypoints</span>' +
      '  <span class="nodes-val font-mono">' + segment.from.node_id + ' &rarr; ' + segment.to.node_id + '</span>' +
      '</div>' +
      consumablesHtml +
      profileHtml;
  }

  function renderScienceStop(stop) {
    if (!panel) return;
    const catIcon = stop.type.includes("Delta")
      ? ic("waves")
      : stop.type.includes("Landing")
      ? ic("rocket")
      : ic("mountain");

    panel.innerHTML =
      '<div class="science-card">' +
      '  <div class="science-card-head">' +
      '    <div class="stop-avatar">' + catIcon + '</div>' +
      '    <div class="stop-head-text">' +
      '      <h3>' + stop.name + '</h3>' +
      '      <span class="type-tag">' + stop.type + '</span>' +
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
        : '') +
      '  <div class="science-details">' +
      '    <div class="meta-pills">' +
      '      <span class="meta-pill"><strong>Discovery:</strong> Sol ' + stop.sol + '</span>' +
      '      <span class="meta-pill"><strong>Elevation:</strong> ' + stop.elev_m + ' m</span>' +
      '      <span class="meta-pill priority-' + (stop.science_priority || "").toLowerCase() + '">Priority: ' + stop.science_priority + '</span>' +
      '    </div>' +
      '    <div class="intel-block">' +
      '      <div class="intel-label">PRIMARY SCIENCE TARGET</div>' +
      '      <div class="intel-content">' + stop.primary_target + '</div>' +
      '    </div>' +
      '    <p class="desc">' + stop.description + '</p>' +
      '    <div class="geology-box">' +
      '      <div class="geo-label">GEOLOGIC CONTEXT</div>' +
      '      ' + stop.geology +
      '    </div>' +
      '  </div>' +
      '</div>';

    const closeBtn = document.getElementById("close-science-card");
    if (closeBtn) {
      closeBtn.onclick = function () {
        render(lastSegment);
      };
    }
  }

  return { init, render, renderScienceStop };
})();
