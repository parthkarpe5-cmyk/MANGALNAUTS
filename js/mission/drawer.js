/* global MarsGeodesic, MarsElevationProfile, MarsTelemetry, MarsIcons, MarsData, MarsSegmentPick, window */
window.MarsSegmentDrawer = (function () {
  let panel = null;
  let lastSegment = null;
  let renderId = 0;
  let currentPayloadKg = 15;
  let isRadialDialOpen = false;

  function ic(name) {
    return window.MarsIcons ? window.MarsIcons.get(name) : "";
  }

  function buildRadialLoadoutHtml(isWalk, currentKg, pMetWatts) {
    const astronautKg = 80;
    const suitPlssKg = 135;
    const totalEarthKg = astronautKg + suitPlssKg + currentKg;
    const marsApparentKg = (totalEarthKg * 0.38).toFixed(1);

    const loadoutOptions = [
      { id: "scout", label: "0kg", kg: 0, toolWatts: 0, icon: "🎒", name: "Light Recon (Zero Tools)", desc: "Optical survey only (0 kg extra tools, 0W draw)" },
      { id: "sample", label: "+15kg", kg: 15, toolWatts: 45, icon: "🧪", name: "Science Sample Kit", desc: "Sample cache tubes & Raman spectrometer (+15 kg, 45W draw)" },
      { id: "drill", label: "+25kg", kg: 25, toolWatts: 90, icon: "⛏️", name: "Coring Drill Kit", desc: "Subsurface rock core drill (+25 kg, 90W draw)" },
      { id: "survey", label: "+40kg", kg: 40, toolWatts: 150, icon: "📡", name: "RIMFAX GPR Radar", desc: "Ground penetrating radar antenna (+40 kg, 150W draw)" },
    ];

    const activeOption = loadoutOptions.find(o => o.kg === currentKg) || loadoutOptions[1];

    const radialNodes = [
      { id: "astro", fixed: true, icon: "🧑‍🚀", label: "80kg", sub: "Astronaut", x: 0, y: -78, title: "Astronaut Body Mass: 80 kg Earth (30.4 kg on Mars 0.38g)" },
      { id: "suit", fixed: true, icon: "🛡️", label: "135kg", sub: "xEMU PLSS", x: 68, y: -39, title: "NASA xEMU Suit + PLSS Life Support: 135 kg Earth (51.3 kg on Mars 0.38g)" },
      { id: "scout", fixed: false, kg: 0, icon: "🎒", label: "+0kg", sub: "Recon", x: 68, y: 39, title: "Light Recon: 0 kg carried tools (0W draw)" },
      { id: "sample", fixed: false, kg: 15, icon: "🧪", label: "+15kg", sub: "Science", x: 0, y: 78, title: "Science Sample Tubes & Spectrometer: +15 kg carried tools (45W draw)" },
      { id: "drill", fixed: false, kg: 25, icon: "⛏️", label: "+25kg", sub: "Drill", x: -68, y: 39, title: "Rock Coring Drill Kit: +25 kg carried tools (90W draw)" },
      { id: "survey", fixed: false, kg: 40, icon: "📡", label: "+40kg", sub: "Radar", x: -68, y: -39, title: "RIMFAX Subsurface Radar: +40 kg carried tools (150W draw)" }
    ];

    const nodesHtml = radialNodes.map(function(n) {
      if (n.fixed) {
        return (
          '<div class="radial-node radial-node-fixed font-mono" style="transform: translate(' + (n.x - 22) + 'px, ' + (n.y - 22) + 'px);" title="' + n.title + '">' +
          '  <span class="node-icon">' + n.icon + '</span>' +
          '  <span class="node-mass">' + n.label + '</span>' +
          '</div>'
        );
      } else {
        const isActive = currentKg === n.kg ? "active" : "";
        return (
          '<button type="button" class="radial-node loadout-radial-btn font-mono ' + isActive + '" data-kg="' + n.kg + '" style="transform: translate(' + (n.x - 22) + 'px, ' + (n.y - 22) + 'px);" title="' + n.title + '">' +
          '  <span class="node-icon">' + n.icon + '</span>' +
          '  <span class="node-mass">' + n.label + '</span>' +
          '</button>'
        );
      }
    }).join("");

    return (
      '<div class="loadout-circular-control">' +
      '  <div class="loadout-header-row">' +
      '    <span class="loadout-strip-label">' +
      '      <span>⚖️ ' + (isWalk ? 'EVA GROSS MASS' : 'PAYLOAD GEAR MASS') + '</span>' +
      '    </span>' +
      '    <button type="button" class="btn-open-radial-loadout ' + (isRadialDialOpen ? "open" : "") + '" id="btn-toggle-radial-dial" title="Click to open circular loadout dial">' +
      '      <span>🧑‍🚀 80 + 🛡️ 135 + ' + activeOption.icon + ' ' + activeOption.kg + 'kg = <strong>' + totalEarthKg + ' kg</strong> (' + marsApparentKg + ' kg ♂)</span>' +
      '      <span class="loadout-chevron">▼</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="radial-loadout-stage ' + (isRadialDialOpen ? "open" : "") + '" id="radial-loadout-wheel">' +
      '    <div class="radial-orbit-ring"></div>' +
      '    <div class="radial-center-hub">' +
      '      <span class="radial-hub-val">' + totalEarthKg + ' <span style="font-size:0.55rem;">kg</span></span>' +
      '      <span class="radial-hub-mars">' + marsApparentKg + ' kg ♂</span>' +
      '      <span class="radial-hub-sub">P<sub>met</sub> ' + (pMetWatts || 245) + 'W</span>' +
      '    </div>' +
      nodesHtml +
      '  </div>' +
      '  <div class="radial-active-desc font-mono">' +
      '    <span>Carried Gear: <strong>' + activeOption.icon + ' ' + activeOption.name + '</strong> (+' + activeOption.kg + ' kg · ' + activeOption.toolWatts + 'W)</span>' +
      '  </div>' +
      '</div>'
    );
  }

  function bindRadialLoadoutListeners() {
    if (!panel) return;
    const dialToggleBtn = panel.querySelector("#btn-toggle-radial-dial");
    if (dialToggleBtn) {
      dialToggleBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        isRadialDialOpen = !isRadialDialOpen;
        const wheel = panel.querySelector("#radial-loadout-wheel");
        if (wheel) wheel.classList.toggle("open", isRadialDialOpen);
        dialToggleBtn.classList.toggle("open", isRadialDialOpen);
        if (window.MarsAudio && window.MarsAudio.playClick) window.MarsAudio.playClick();
      });
    }

    panel.querySelectorAll(".loadout-radial-btn, .loadout-pill, .payload-chip").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const kg = parseInt(btn.dataset.kg, 10);
        if (!isNaN(kg)) {
          currentPayloadKg = kg;
          if (window.MarsAudio && window.MarsAudio.playClick) window.MarsAudio.playClick();
          render(lastSegment);
        }
      });
    });
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

      const overviewDialHtml =
        '<div class="expedition-flow-card" style="margin-top: 10px;">' +
        '  <div class="section-title-row">' +
        '    <h4>' + ic("zap") + ' EVA Consumables &amp; Payload Loadout</h4>' +
        '    <span class="badge-mini font-mono">PANDOLF 0.38g</span>' +
        '  </div>' +
        buildRadialLoadoutHtml(true, currentPayloadKg, 245) +
        '</div>';

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
        overviewDialHtml +
        qmHtml +
        '</div>';

      bindRadialLoadoutListeners();

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
      const circularDialHtml = buildRadialLoadoutHtml(isWalk, currentPayloadKg, c.pMetWatts);

      consumablesHtml =
        '<div class="drawer-section expedition-flow-card">' +
        '  <div class="section-title-row">' +
        "    <h4>" +
        ic("zap") +
        " Expedition Consumables &amp; Safety</h4>" +
        '    <span class="badge-mini font-mono">' +
        (isWalk ? "2 CREW · EVA-01" : "AUTONAV ROVER") +
        "</span>" +
        "  </div>" + +
        circularDialHtml +
        '  <div class="expedition-telemetry-row">' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + ic("clock") + ' DURATION</span>' +
        '      <span class="stat-val font-mono">' + (c.durationMin < 60 ? c.durationMin + "m" : c.durationHours + "h") + '</span>' +
        '      <span class="stat-foot font-mono">' + c.avgSpeedMs + ' m/s</span>' +
        '    </div>' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + ic("oxygen") + ' O₂ REQUIRED</span>' +
        '      <span class="stat-val font-mono">' + c.o2Liters + ' L</span>' +
        '      <span class="stat-foot safe-pill font-mono" title="NASA 20% Contingency Safe Return Reserve">Safe: ' + c.o2SafeReturnL + 'L</span>' +
        '    </div>' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + ic("battery") + ' BATTERY</span>' +
        '      <span class="stat-val font-mono">' + c.batteryWh + ' Wh</span>' +
        '      <span class="stat-foot safe-pill font-mono" title="NASA 20% Contingency Safe Return Reserve">Safe: ' + c.batterySafeReturnWh + 'Wh</span>' +
        '    </div>' +
        '    <div class="telemetry-stat">' +
        '      <span class="stat-hdr">' + (isWalk ? ic("droplet") : ic("gauge")) + ' ' + (isWalk ? 'COOLING' : 'CLIMB') + '</span>' +
        '      <span class="stat-val font-mono">' + (isWalk ? c.waterCoolingL + ' L' : c.meanSlopeDeg + '°') + '</span>' +
        '      <span class="stat-foot font-mono">' + (isWalk ? 'Safe: ' + c.waterCoolingSafeReturnL + 'L' : '&Delta;z +' + c.elevationGainM + 'm') + '</span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="expedition-physics-bar">' +
        '    <div class="physics-summary">' +
        '      <span class="physics-badge font-mono">PANDOLF 0.38g</span>' +
        '      <span class="physics-text">P<sub>met</sub>: <strong>' + c.pMetWatts + 'W</strong> · Suit Total: <strong>' + c.pSuitWatts + 'W</strong> (' + (c.ambientTempC) + '&deg;C ambient)</span>' +
        '    </div>' +
        '    <div class="physics-reserve-tag" title="NASA Flight Rule EVA-01: Mandatory 20% Life Support Buffer">' +
        '      <span class="reserve-shield">🛡️</span>' +
        '      <span>+20% Contingency Reserve</span>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    let isruHtml = "";
    if (segment.path_found && window.MarsGrsOverlays && segment.from) {
      try {
        const isru = await MarsGrsOverlays.calculateIsruMetrics(segment.from.lat, segment.from.lon);
        isruHtml =
          '<div class="drawer-section drawer-isru">' +
          '  <div class="section-title-row">' +
          '    <h4><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> ISRU &amp; Regolith Telemetry</h4>' +
          '    <span class="badge-mini font-mono" style="color:var(--pl-cyan,#38bdf8); border-color:rgba(56,189,248,0.4);">ODYSSEY GRS</span>' +
          '  </div>' +
          (isru.chlorineAlert
            ? '  <div class="isru-hazard-alert">' +
              '    <span class="hazard-icon">⚠️</span>' +
              '    <div class="hazard-text">' +
              '      <strong>HIGH PERCHLORATES (Cl: ' + isru.chlorineWtPct + ' wt%)</strong><br/>' +
              '      <span>Airlock Electrostatic De-dusting Required</span>' +
              '    </div>' +
              '  </div>'
            : '  <div class="isru-hazard-safe">' +
              '    <span class="safe-icon">✓</span>' +
              '    <span>Perchlorates Nominal (' + isru.chlorineWtPct + ' wt% Cl) · Standard EVA Protocols</span>' +
              '  </div>'
          ) +
          '  <div class="consumables-grid isru-grid">' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">💧</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Local Water Abundance</span>' +
          '        <span class="c-val font-mono">' + isru.waterWtPct + ' wt% <span class="c-sub-inline">' + isru.waterUncertainty + '</span></span>' +
          '        <span class="c-sub">Subsurface H₂O equivalent</span>' +
          '      </div>' +
          '    </div>' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">⛏️</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Extractable Water</span>' +
          '        <span class="c-val font-mono">~' + isru.waterKgPerM3 + ' kg / m³</span>' +
          '        <span class="c-sub">From surface regolith (1m)</span>' +
          '      </div>' +
          '    </div>' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">🚀</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Sabatier CH₄ Yield</span>' +
          '        <span class="c-val font-mono">~' + isru.methaneYieldKgPerM3 + ' kg CH₄ / m³</span>' +
          '        <span class="c-sub">Ascent rocket propellant</span>' +
          '      </div>' +
          '    </div>' +
          '    <div class="consumable-item">' +
          '      <span class="c-icon">🧪</span>' +
          '      <div class="c-info">' +
          '        <span class="c-label">Regolith Composition</span>' +
          '        <span class="c-val font-mono">Fe: ' + isru.ironWtPct + '% · Si: ' + isru.siliconWtPct + '%</span>' +
          '        <span class="c-sub">Sintering &amp; solar array base</span>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '  <div class="isru-citation-note font-mono">' +
          '    <span>NASA 2001 Mars Odyssey GRS (Boynton et al. 2007) · PDS Geosciences</span>' +
          '  </div>' +
          '</div>';
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

    const displayTitle = segment.routeTitle || 'OPTIMAL SAFE TRAVERSE';
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
      isruHtml +
      profileHtml +
      '<div class="route-action-bar">' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-toggle-traversal">⏸ Pause</button>' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-replay-traversal">⏮ Replay</button>' +
      '  <button type="button" class="btn-ghost btn-sm" id="btn-reverse-route">🔄 Reverse Path</button>' +
      '  <button type="button" class="btn-ghost btn-sm btn-exit-nav-drawer" id="btn-exit-navigation" style="border-color: rgba(239, 68, 68, 0.45); color: #f87171; background: rgba(239, 68, 68, 0.08);">✕ Exit Nav (Unlock)</button>' +
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

    bindRadialLoadoutListeners();

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
