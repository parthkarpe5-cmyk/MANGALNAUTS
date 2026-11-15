/* global MarsGeodesic, MarsElevationProfile, MarsTelemetry, MarsIcons, MarsData, MarsSegmentPick, window */
window.MarsSegmentDrawer = (function () {
  let panel = null;
  let lastSegment = null;
  let renderId = 0;
  let currentPayloadKg = 15;

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
    const prompt = document.getElementById("route-prompt");
    prompt.textContent = statusText || "";
    prompt.hidden = !statusText;
    if (statusText) {
      window.MarsWorkspace.closeRoute();
      return;
    }
    if (segment) window.MarsWorkspace.show("route");
    else window.MarsWorkspace.closeRoute();

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

      const activeMode = (window.MarsTravelMode && window.MarsTravelMode.get)
        ? window.MarsTravelMode.get()
        : { id: "rover", label: "Rover AutoNav (≤20°)" };
      const isRover = activeMode.id === "rover";

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
        '  <div class="drawer-travel-mode-section" style="margin: 12px 0; padding: 10px 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px;">' +
        '    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">' +
        '      <span style="font-size:11px; font-weight:700; color:var(--text-muted, #A9A9B8); letter-spacing:0.8px; text-transform:uppercase;">EXPEDITION TRAVEL MODE</span>' +
        '      <span class="badge-mini font-mono" id="drawer-travel-mode-badge" style="color:var(--mars-orange, #FF6B00); background:rgba(255,107,0,0.12); padding:2px 6px; border-radius:4px; font-size:10px;">' +
        (isRover ? '≤20° SLOPE' : '≤15° SLOPE') +
        '      </span>' +
        '    </div>' +
        '    <select id="drawer-travel-mode-select" class="dropdown-select" style="width:100%; padding:8px 10px; background:#15151C; color:#fff; border:1px solid rgba(255,255,255,0.15); border-radius:8px; font-size:12px; font-family:var(--font-ui, sans-serif); cursor:pointer;" aria-label="Expedition travel mode">' +
        '      <option value="rover"' + (isRover ? ' selected' : '') + '>Rover AutoNav (≤20° safe slope)</option>' +
        '      <option value="walk"' + (!isRover ? ' selected' : '') + '>Marswalk EVA (≤15° safe slope)</option>' +
        '    </select>' +
        '    <div id="drawer-travel-mode-desc" style="font-size:11px; color:#71717A; margin-top:6px; line-height:1.35;">' +
        (isRover ? 'Autonomous navigation standard for rocker-bogie rovers. Rigorously avoids loose sand ripples and steep walls.' : 'Astronaut EVA on foot. Enforces Liquid Cooling Garment (LCVG max 450 kcal/hr) metabolic limits.') +
        '    </div>' +
        '  </div>' +
        '  <div class="drawer-action-hero" style="margin: 12px 0;">' +
        '    <button type="button" class="btn-primary-plan" id="drawer-start-plan-btn" style="width:100%; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px 14px; background:linear-gradient(135deg, #FF6B00, #EA580C); border:none; border-radius:12px; color:#fff; font-family:var(--font-ui, sans-serif); font-size:13px; font-weight:700; cursor:pointer; box-shadow:0 4px 16px rgba(255,107,0,0.35);">' +
        '      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#fff; box-shadow:0 0 8px #fff;"></span>' +
        '      <span>📍 PLAN ROUTE (CLICK 2 POINTS ON MAP)</span>' +
        '    </button>' +
        '  </div>' +
        '  <div class="drawer-hint-card">' +
        '    <p>Activate route planner above or choose a preset mission below to calculate safe corridors under terrain slope limits.</p>' +
        '  </div>' +
        qmHtml +
        '</div>';

      const drawerModeSel = panel.querySelector("#drawer-travel-mode-select");
      if (drawerModeSel) {
        drawerModeSel.addEventListener("change", function () {
          if (window.MarsAudio) MarsAudio.playClick();
          if (window.MarsTravelMode && window.MarsTravelMode.set) {
            window.MarsTravelMode.set(drawerModeSel.value);
          }
        });
      }

      const planBtn = panel.querySelector("#drawer-start-plan-btn");
      if (planBtn) {
        planBtn.addEventListener("click", function () {
          if (window.MarsAudio) MarsAudio.playClick();
          if (window.MarsSegmentPick) {
            MarsSegmentPick.setActive(true);
          }
        });
      }

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
      const activeMode = (window.MarsTravelMode && window.MarsTravelMode.get)
        ? window.MarsTravelMode.get()
        : { id: "rover", label: "Rover AutoNav (≤20°)" };
      const isRover = activeMode.id === "rover";

      panel.innerHTML =
        '<div class="drawer-error-box">' +
        '  <span class="error-badge">TRAVERSAL BLOCKED</span>' +
        '  <p class="drawer-error"></p>' +
        '  <div class="drawer-travel-mode-section" style="margin: 10px 0; padding: 10px 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; text-align: left;">' +
        '    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
        '      <span style="font-size: 11px; font-weight: 700; color: #A9A9B8; letter-spacing: 0.8px;">SWITCH EXPEDITION MODE</span>' +
        '      <span class="badge-mini font-mono" style="color: #FF6B00; background: rgba(255,107,0,0.12); padding: 2px 6px; border-radius: 4px; font-size: 10px;">' +
        (isRover ? '≤20° LIMIT' : '≤15° LIMIT') +
        '      </span>' +
        '    </div>' +
        '    <select id="drawer-error-travel-mode" class="dropdown-select" style="width: 100%; padding: 6px 8px; background: #15151C; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12px;" aria-label="Switch expedition travel mode">' +
        '      <option value="rover"' + (isRover ? ' selected' : '') + '>Rover AutoNav (≤20° safe slope)</option>' +
        '      <option value="walk"' + (!isRover ? ' selected' : '') + '>Marswalk EVA (≤15° safe slope)</option>' +
        '    </select>' +
        '  </div>' +
        '  <div style="display: flex; gap: 8px; margin-top: 10px;">' +
        '    <button type="button" class="btn-ghost" id="drawer-retry-btn" style="flex: 1;">Reset Route</button>' +
        '    <button type="button" class="btn-ghost" id="drawer-fit-terrain" style="flex: 1;">Center Terrain</button>' +
        '  </div>' +
        "</div>";
      panel.querySelector(".drawer-error").textContent = segment.error || "No path meets the selected slope limit.";
      const errModeSel = panel.querySelector("#drawer-error-travel-mode");
      if (errModeSel) {
        errModeSel.addEventListener("change", function () {
          if (window.MarsAudio) MarsAudio.playClick();
          if (window.MarsTravelMode && window.MarsTravelMode.set) {
            window.MarsTravelMode.set(errModeSel.value);
          }
        });
      }
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
    const modeObj = (window.MarsTravelMode && window.MarsTravelMode.get)
      ? window.MarsTravelMode.get()
      : { id: segment.mode, label: segment.mode, maxSlopeDeg: 15, nasaStandard: "NASA Flight Rule EVA-01", type: "walk" };
    const maxAllowedSlope = modeObj.maxSlopeDeg || (segment.mode === "walk" ? 15 : 20);

    const feasible = segment.path_found && segment.feasible;
    const feasClass = feasible ? "ok" : "bad";
    const feasText = segment.path_found
      ? feasible
        ? "FEASIBLE (" + (modeObj.shortLabel || modeObj.label) + " ≤" + maxAllowedSlope + "°)"
        : "EXCEEDS SLOPE LIMIT"
      : "NO PATH FOUND";

    const riskVal = segment.mean_risk != null ? segment.mean_risk : 0.3;
    const riskPercent = Math.round(riskVal * 100);
    const slopeVal = segment.max_slope_deg != null ? segment.max_slope_deg : 0;
    const slopePercent = Math.min(
      100,
      Math.round((slopeVal / maxAllowedSlope) * 100)
    );

    let consumablesHtml = "";
    if (segment.path_found && segment.path_m && window.MarsTelemetry) {
      const c = MarsTelemetry.calculateConsumables(segment.path_m, segment.mode, segment.path_nodes, {
        payloadKg: currentPayloadKg,
        crewCount: 2,
      });

      const isWalk = (modeObj.type || "walk") === "walk";
      const detailsOpen = panel.querySelector(".mission-estimate-details")?.open;
      const payloadOptions = MarsTelemetry.PAYLOAD_LOADOUTS.map(loadout =>
        '<option value="' + loadout.kg + '"' + (loadout.kg === currentPayloadKg ? ' selected' : '') + '>' +
        loadout.label + ' · ' + loadout.kg + ' kg</option>'
      ).join("");
      const toolWatts = MarsTelemetry.PAYLOAD_LOADOUTS.find(loadout => loadout.kg === currentPayloadKg)?.toolWatts ?? 0;

      consumablesHtml =
        '<div class="drawer-section expedition-flow-card">' +
        '  <div class="section-title-row">' +
        "    <h4>" +
        ic("zap") +
        " Mission estimates</h4>" +
        '    <span class="badge-mini font-mono">' +
        (isWalk ? "2 CREW · EVA-01" : "AUTONAV ROVER") +
        "</span>" +
        "  </div>" +
        '<label class="mission-payload">Payload <select id="mission-payload">' + payloadOptions + '</select></label>' +
        '  <div class="expedition-telemetry-row">' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + ic("clock") + ' TIME</span>' +
        '      <span class="stat-val font-mono">' + (c.durationMin < 60 ? c.durationMin + " min" : c.durationHours + " h") + '</span>' +
        '    </div>' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + ic("oxygen") + ' O₂</span>' +
        '      <span class="stat-val font-mono">' + c.o2Liters + ' L</span>' +
        '    </div>' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + ic("battery") + ' BATTERY</span>' +
        '      <span class="stat-val font-mono">' + (c.batteryWh >= 1000 ? (c.batteryWh / 1000).toFixed(1) + ' kWh' : c.batteryWh + ' Wh') + '</span>' +
        '    </div>' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + (isWalk ? ic("droplet") : ic("gauge")) + ' ' + (isWalk ? 'COOLING' : 'CLIMB') + '</span>' +
        '      <span class="stat-val font-mono">' + (isWalk ? c.waterCoolingL + ' L' : c.meanSlopeDeg + '°') + '</span>' +
        '    </div>' +
        '  </div>' +
        '<details class="mission-details mission-estimate-details"' + (detailsOpen ? " open" : "") + '><summary>Details</summary>' +
        '<dl class="mission-detail-values">' +
        '<dt>Avg. speed</dt><dd>' + c.avgSpeedMs + ' m/s</dd>' +
        '<dt>Tool load</dt><dd>' + toolWatts + ' W</dd>' +
        (isWalk ? '<dt>Crew</dt><dd>' + c.crewCount + '</dd>' : '<dt>Climb</dt><dd>+' + c.elevationGainM + ' m</dd>') +
        '</dl>' +
        '<h5 class="mission-reserve-heading">With 20% reserve</h5>' +
        '<dl class="mission-detail-values">' +
        '<dt>O₂</dt><dd>' + c.o2SafeReturnL.toLocaleString("en-US") + ' L</dd>' +
        '<dt>Battery</dt><dd>' + (c.batterySafeReturnWh >= 1000
          ? (c.batterySafeReturnWh / 1000).toFixed(1) + ' kWh'
          : c.batterySafeReturnWh + ' Wh') + '</dd>' +
        (isWalk ? '<dt>Cooling</dt><dd>' + c.waterCoolingSafeReturnL + ' L</dd>' : '') +
        '</dl>' +
        '</details>' +
        '<p class="mission-final-note">' +
        (feasible ? 'Within slope limit.' : 'Route exceeds slope limit.') +
        (segment.regional ? ' 200 m terrain may miss small hazards.' : '') +
        '</p>' +
        '</div>';
    }

    let isruHtml = "";
    if (segment.path_found && window.MarsGrsOverlays && (segment.path_nodes || segment.from)) {
      try {
        const isru = await MarsGrsOverlays.calculateIsruMetrics(
          segment.path_nodes || [segment.from, segment.to]
        );
        const hasChlorine = Number.isFinite(isru?.chlorineWtPct);
        if (id !== renderId) return;

        isruHtml =
          '<details class="drawer-section drawer-isru mission-details" open>' +
          '  <summary>' +
          '    <span>Surface resources · In-Situ Science</span>' +
          '    <span class="live-pulse-badge font-mono">● LIVE IN-SITU</span>' +
          '  </summary>' +
          '  <div class="isru-geology-banner">' +
          '    <div class="geo-unit-title font-mono">' +
          '      <span class="geo-icon">' + (isru.mineralIcon || '🔬') + '</span>' +
          '      <span class="geo-name">' + (isru.geologyUnitName || 'Martian Regolith') + '</span>' +
          '    </div>' +
          '    <div class="geo-instruments font-mono">' +
          '      <span class="instr-badge">CRISM Hyperspectral</span>' +
          '      <span class="instr-badge">THEMIS TI: ' + (isru.themisTiAvg || 340) + '</span>' +
          '      <span class="instr-badge">PDS Calibrated</span>' +
          '    </div>' +
          '  </div>' +
          (!hasChlorine
            ? '<p class="drawer-hint">Perchlorates · Data unavailable</p>'
            : isru.chlorineAlert
            ? '  <div class="isru-hazard-alert">' +
              '    <span class="hazard-icon">⚠️</span>' +
              '    <div class="hazard-text">' +
              '      <strong>HIGH PERCHLORATES (Cl: ' +
              isru.chlorineWtPct +
              ' wt%)</strong><br/>' +
              '      <span>Airlock Electrostatic De-dusting Required</span>' +
              '    </div>' +
              '  </div>'
            : '  <div class="isru-hazard-safe">' +
              '    <span class="safe-icon">✓</span>' +
              '    <span>Chlorine estimate · ' +
              isru.chlorineWtPct +
              ' wt% Cl (Nominal)</span>' +
              '  </div>'
          ) +
          '  <div class="consumables-grid isru-grid">' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">💧</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Local Water Abundance</span>' +
          '        <span class="c-val font-mono">' +
          isru.waterWtPct +
          ' wt% <span class="c-sub-inline">' +
          (isru.waterUncertainty ?? '') +
          '</span></span>' +
          '      </div>' +
          '    </div>' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">⛏️</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Extractable Water</span>' +
          '        <span class="c-val font-mono">~' +
          isru.waterKgPerM3 +
          ' kg / m³</span>' +
          '      </div>' +
          '    </div>' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">🚀</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Sabatier CH₄ Yield</span>' +
          '        <span class="c-val font-mono">~' +
          isru.methaneYieldKgPerM3 +
          ' kg CH₄ / m³</span>' +
          '      </div>' +
          '    </div>' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">🧪</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Regolith Composition</span>' +
          '        <span class="c-val font-mono">Fe: ' +
          isru.ironWtPct +
          '% · Si: ' +
          isru.siliconWtPct +
          '%</span>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '  <div class="isru-citation-note font-mono">' +
          '    <span>NASA MRO CRISM · THEMIS · PDS In-Situ Planetary Telemetry</span>' +
          '  </div>' +
          '</details>';
      } catch (e) {
        console.warn("[ISRU] Calculation error:", e);
      }
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

    if (id !== renderId) return;
    const routeTitle = segment.routeTitle || "";
    const displayTitle = routeTitle.includes("➔") ? routeTitle.split("➔")[0].split("(")[0].trim() : routeTitle || "Planned route";
    const coordinates = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lon)
      ? Math.abs(point.lat).toFixed(3) + '°' + (point.lat < 0 ? 'S' : 'N') + ', ' +
        Math.abs(point.lon).toFixed(3) + '°' + (point.lon < 0 ? 'W' : 'E')
      : '—';
    const isNavLocked = window.MarsSegmentPick && window.MarsSegmentPick.isNavigating && window.MarsSegmentPick.isNavigating();
    const navBadgeHtml = isNavLocked
      ? '<span class="nav-lock-badge font-mono">🔒 NAV LOCKED</span>'
      : '';

    panel.innerHTML =
      '<div class="drawer-header-row">' +
      '  <h3 class="drawer-title" title="' + displayTitle + '">' + ic("route") + ' ' + displayTitle + '</h3>' +
      '  <div style="display:flex; align-items:center; gap:8px;">' +
      navBadgeHtml +
      '    <span class="drawer-feasible ' + feasClass + '">' + feasText + '</span>' +
      '  </div>' +
      '</div>' +
      '<div class="drawer-travel-mode-section" style="margin-bottom:12px; padding:8px 12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px;">' +
      '  <div style="display:flex; flex-direction:column; gap:2px;">' +
      '    <span style="font-size:10px; font-weight:700; color:var(--text-muted, #A9A9B8); letter-spacing:0.8px; text-transform:uppercase;">EXPEDITION TRAVEL MODE</span>' +
      '    <span style="font-size:11px; font-family:var(--font-mono, monospace); color:var(--mars-orange, #FF6B00); font-weight:600;">' + (modeObj.shortLabel || modeObj.label) + ' (≤' + maxAllowedSlope + '°)</span>' +
      '  </div>' +
      '  <select id="drawer-active-travel-mode" class="dropdown-select" style="max-width:200px; padding:5px 8px; background:#15151C; color:#fff; border:1px solid rgba(255,255,255,0.15); border-radius:6px; font-size:12px; cursor:pointer;" aria-label="Switch expedition travel mode">' +
      '    <option value="rover"' + (modeObj.id === "rover" ? ' selected' : '') + '>Rover AutoNav (≤20°)</option>' +
      '    <option value="walk"' + (modeObj.id === "walk" ? ' selected' : '') + '>Marswalk EVA (≤15°)</option>' +
      '  </select>' +
      '</div>' +
      '<p class="mission-endpoints">A · ' + coordinates(segment.from) + '<br>B · ' + coordinates(segment.to) + '</p>' +
      '<div class="drawer-stats-grid">' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Direct distance</span>' +
      '    <span class="stat-val font-mono">' + geo + '</span>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Route distance</span>' +
      '    <span class="stat-val font-mono highlight">' + path + '</span>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Max slope</span>' +
      '    <span class="stat-val font-mono ' + (slopeVal > maxAllowedSlope ? 'val-danger' : '') + '">' + slopeVal.toFixed(1) + '°</span>' +
      '    <span class="stat-sub">Limit: ≤' + maxAllowedSlope + '°</span>' +
      '    <div class="meter-bar"><div class="meter-fill slope-fill" style="width:' + slopePercent + '%"></div></div>' +
      '  </div>' +
      '  <div class="stat-card">' +
      '    <span class="stat-label">Avg. terrain risk</span>' +
      '    <span class="stat-val font-mono ' + (riskPercent > 50 ? 'val-danger' : '') + '">' + riskPercent + '%</span>' +
      '    <div class="meter-bar"><div class="meter-fill risk-fill" style="width:' + riskPercent + '%"></div></div>' +
      '  </div>' +
      '</div>' +
      profileHtml +
      consumablesHtml +
      isruHtml +
      '<div class="route-action-bar">' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-toggle-traversal">⏸ Pause</button>' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-replay-traversal">⏮ Replay</button>' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-reverse-route">Reverse</button>' +
      '  <button type="button" class="btn-ghost btn-sm btn-exit-nav-drawer" id="btn-exit-navigation" style="border-color: rgba(239, 68, 68, 0.45); color: #f87171; background: rgba(239, 68, 68, 0.08);">Exit navigation</button>' +
      '</div>';

    const activeModeSelect = panel.querySelector("#drawer-active-travel-mode");
    if (activeModeSelect) {
      activeModeSelect.addEventListener("change", function () {
        if (window.MarsAudio) MarsAudio.playClick();
        if (window.MarsTravelMode && window.MarsTravelMode.set) {
          window.MarsTravelMode.set(activeModeSelect.value);
        }
      });
    }

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
        ? "Regional terrain · 200 m. Drills require local terrain."
        : "Elevation grid: " + segment.terrain_spacing_m + " m sampling";
      panel.prepend(label);
    }
    if (segment.path_found && !segment.regional) window.MarsContingency?.attach(panel, segment);

    const payload = panel.querySelector("#mission-payload");
    payload?.addEventListener("change", async function () {
      currentPayloadKg = Number(payload.value);
      await render(segment);
      if (lastSegment === segment) panel.querySelector("#mission-payload")?.focus({ preventScroll: true });
    });

    // Action buttons
    const toggleTravBtn = document.getElementById("btn-toggle-traversal");
    if (toggleTravBtn) {
      toggleTravBtn.onclick = function () {
        if (window.MarsSegmentPick) {
          const paused = window.MarsSegmentPick.togglePauseTraversal();
          toggleTravBtn.textContent = paused ? "▶ Resume" : "⏸ Pause";
        }
      };
    }
    const replayTravBtn = document.getElementById("btn-replay-traversal");
    if (replayTravBtn) {
      replayTravBtn.onclick = function () {
        if (window.MarsSegmentPick) {
          window.MarsSegmentPick.replayAutoTraversal();
          if (toggleTravBtn) toggleTravBtn.textContent = "⏸ Pause";
        }
      };
    }
    const clearBtn = document.getElementById("btn-clear-active-route");
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (window.MarsSegmentPick && window.MarsSegmentPick.exitNavigation) {
          window.MarsSegmentPick.exitNavigation();
        } else if (window.MarsSegmentPick) {
          window.MarsSegmentPick.reset();
        }
      };
    }
    const exitBtn = document.getElementById("btn-exit-navigation");
    if (exitBtn) {
      exitBtn.onclick = () => {
        if (window.MarsSegmentPick && window.MarsSegmentPick.exitNavigation) {
          window.MarsSegmentPick.exitNavigation();
        } else if (window.MarsSegmentPick) {
          window.MarsSegmentPick.reset();
        }
      };
    }
    const revBtn = document.getElementById("btn-reverse-route");
    if (revBtn && segment.from && segment.to) {
      revBtn.addEventListener("click", function () {
        if (window.MarsSegmentPick) {
          MarsSegmentPick.planRoute(segment.to.lat, segment.to.lon, segment.from.lat, segment.from.lon);
        }
      });
    }


  }

  function notifyArrival(segment, title) {
    if (!panel) return;
    const headerRow = panel.querySelector(".drawer-header-row");
    if (headerRow) {
      let banner = panel.querySelector(".arrival-banner");
      if (!banner) {
        banner = document.createElement("div");
        banner.className = "arrival-banner";
        const displayTitle = title || segment?.routeTitle || "Target Destination";
        banner.innerHTML =
          '<span style="font-size:1.15rem; color:#22c55e;">✓</span>' +
          '<div><strong>OBJECTIVE REACHED:</strong> Arrived at ' + displayTitle + '. Traversal successfully completed.</div>';
        headerRow.after(banner);
      }
    }
    const lockBadge = panel.querySelector(".nav-lock-badge");
    if (lockBadge) {
      lockBadge.outerHTML = '<span class="nav-lock-badge font-mono arrived" style="color:#22c55e; border-color:rgba(34,197,94,0.4); background:rgba(34,197,94,0.12);">✓ ARRIVED // UNLOCKED</span>';
    }
  }

  async function renderScienceStop(stop) {
    if (!panel) return;
    const id = ++renderId;
    const catIcon = (stop.type || "").includes("Delta")
      ? ic("waves")
      : (stop.type || "").includes("Landing")
      ? ic("rocket")
      : ic("mountain");

    const siteMeta = window.MarsData && window.MarsData.getActiveSiteMeta
      ? await MarsData.getActiveSiteMeta()
      : null;

    if (id !== renderId) return;
    window.MarsWorkspace.show("route");
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
        // Dynamic base coordinates: use site's designated landing site or center datum
        const baseLat = siteMeta?.center?.lat ?? siteMeta?.quick_missions?.[0]?.from?.lat ?? 18.4447;
        const baseLon = siteMeta?.center?.lon ?? siteMeta?.quick_missions?.[0]?.from?.lon ?? 77.4509;
        const stopLat = stop.lat != null ? stop.lat : (stop.coordinates ? stop.coordinates[1] : 18.4312);
        const stopLon = stop.lon != null ? stop.lon : (stop.coordinates ? stop.coordinates[0] : 77.4128);

        if (window.MarsSegmentPick) {
          MarsSegmentPick.planRoute(baseLat, baseLon, stopLat, stopLon);
        }
      };
    }
  }

  return { init, render, renderScienceStop, notifyArrival };
})();
