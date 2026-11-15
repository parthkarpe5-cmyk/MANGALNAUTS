/* global MarsData, MarsIcons, window */
window.MarsTelemetry = (function () {
  let envData = null;
  let timer = null;
  let simulatedSeconds = 0;
  let currentContainerId = "telemetry-bar";

  async function init(containerId) {
    currentContainerId = containerId || currentContainerId;
    envData = await MarsData.loadEnvironment();
    renderBar(currentContainerId);
    startClock();
  }

  function startClock() {
    if (typeof document === "undefined") return;
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      simulatedSeconds += 1;
      const ltstEl = document.getElementById("telemetry-ltst");
      if (ltstEl && envData) {
        ltstEl.textContent = getFormattedLTST();
      }
    }, 1000);
  }

  function getFormattedLTST() {
    if (!envData) return "--:-- MTC";
    const raw = envData.local_solar_time || envData.ltst || "12:00:00 MTC";
    // If it's already a string like "07:57 MTC"
    const cleaned = raw.replace(/[A-Za-z\s]/g, "");
    const parts = cleaned.split(":").map(Number);
    const h0 = parts[0] || 12;
    const m0 = parts[1] || 0;
    const s0 = parts[2] || 0;

    let totalSec = h0 * 3600 + m0 * 60 + s0 + simulatedSeconds;
    const h = Math.floor((totalSec / 3600) % 24);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return (
      (h < 10 ? "0" + h : h) +
      ":" +
      (m < 10 ? "0" + m : m) +
      ":" +
      (s < 10 ? "0" + s : s) +
      " MTC"
    );
  }

  function calculateConsumables(distanceMeters, modeKey, pathNodes, opts) {
    opts = opts || {};
    const mode = (window.MarsTravelMode && window.MarsTravelMode.MODES && window.MarsTravelMode.MODES[modeKey])
      ? window.MarsTravelMode.MODES[modeKey]
      : { type: (modeKey === "rover" || modeKey === "aggressive_rover") ? "rover" : "walk", speedBaseMs: 0.65, maxSlopeDeg: 15 };

    const isWalk = mode.type === "walk";
    const payloadKg = Number.isFinite(opts.payloadKg) ? opts.payloadKg : 20; // Default 20 kg carried equipment
    const crewCount = opts.crewCount || 2; // NASA EVA Flight Rule EVA-01 Buddy Pair

    let totalDurationSec = 0;
    let meanSlopeDeg = 0;
    let elevationGainM = 0;

    if (pathNodes && pathNodes.length > 1) {
      let slopeSum = 0;
      for (let i = 1; i < pathNodes.length; i++) {
        const p1 = pathNodes[i - 1];
        const p2 = pathNodes[i];
        const segDist = Math.max(1, (p2.dist_m || 0) - (p1.dist_m || 0));
        const elevDiff = (p2.elev_m || 0) - (p1.elev_m || 0);
        if (elevDiff > 0) elevationGainM += elevDiff;

        const slopeRad = Math.atan(Math.abs(elevDiff) / segDist);
        const slopeDeg = (slopeRad * 180) / Math.PI;
        slopeSum += slopeDeg;

        let segSpeed = mode.speedBaseMs || 0.65;
        if (isWalk) {
          // Tobler's hiking velocity model adapted for Mars 0.38g & carried payload mass
          const slopeFactor = Math.exp(-3.5 * Math.abs(Math.tan(slopeRad) + 0.05));
          const payloadFactor = Math.max(0.75, 1.0 - (payloadKg - 10) * 0.007);
          segSpeed = Math.max(0.25, Math.min(0.85, segSpeed * slopeFactor * payloadFactor));
        } else {
          // Rover speed reduction on slopes > 8° due to wheel slip & visual odometry stops
          const slipReduction = slopeDeg > 8 ? Math.max(0.45, 1.0 - (slopeDeg / (mode.maxSlopeDeg || 20)) * 0.5) : 1.0;
          segSpeed = Math.max(0.04, segSpeed * slipReduction);
        }
        totalDurationSec += segDist / segSpeed;
      }
      meanSlopeDeg = slopeSum / (pathNodes.length - 1);
    } else {
      const baseSpeed = mode.speedBaseMs || (isWalk ? 0.65 : 0.12);
      totalDurationSec = distanceMeters / baseSpeed;
    }

    const durationMin = totalDurationSec / 60;
    const durationHours = durationMin / 60;
    const avgSpeedMs = totalDurationSec > 0 ? distanceMeters / totalDurationSec : (mode.speedBaseMs || 0.65);

    let o2Liters = 0;
    let batteryWh = 0;
    let waterCoolingL = 0;

    if (isWalk) {
      // Bio-energetics: NASA EVA Metabolic Rate
      // Basal: ~0.45 L/min per astronaut
      // Incline workload: +0.035 L/min per degree of slope
      // Payload burden: +0.012 L/min per 10 kg carried mass
      const o2PerAstronautPerMin = 0.45 + (0.012 * (payloadKg / 10)) + (0.035 * Math.min(15, meanSlopeDeg));
      // Total for buddy pair with 20% emergency safety margin (NASA Flight Rule EVA-01)
      o2Liters = crewCount * o2PerAstronautPerMin * durationMin * 1.20;

      // Power: NASA xEMU PLSS avionics (55W) + sublimation fan/pump (95W) + thermal suit heaters at -60°C (90W)
      const suitWattsPerPerson = 240;
      batteryWh = crewCount * suitWattsPerPerson * durationHours;

      // Water sublimation for astronaut metabolic body heat rejection: ~0.35 L/hr per astronaut
      waterCoolingL = crewCount * 0.35 * durationHours;
    } else {
      // Rover pressurized cabin / remote avionics
      const o2RateCabinPerMin = 0.22 * crewCount;
      o2Liters = o2RateCabinPerMin * durationMin * 1.15;

      // Rover traction motors + avionics + RTG/battery draw: 420W nominal, up to 700W on slopes
      const roverWatts = 420 + (meanSlopeDeg / (mode.maxSlopeDeg || 20)) * 220;
      batteryWh = roverWatts * durationHours;
      waterCoolingL = 0;
    }

    return {
      durationSec: Math.round(totalDurationSec),
      durationMin: Math.round(durationMin),
      durationHours: durationHours.toFixed(1),
      avgSpeedMs: avgSpeedMs.toFixed(2),
      o2Liters: Math.round(o2Liters),
      batteryWh: Math.round(batteryWh),
      waterCoolingL: waterCoolingL.toFixed(1),
      payloadKg: payloadKg,
      crewCount: crewCount,
      meanSlopeDeg: meanSlopeDeg.toFixed(1),
      elevationGainM: Math.round(elevationGainM),
      modeLabel: mode.label,
      nasaStandard: mode.nasaStandard || "NASA EVA Flight Rule EVA-01",
      rationale: mode.rationale,
    };
  }

  function renderBar(containerId) {
    if (typeof document === "undefined") return;
    const el = document.getElementById(containerId);
    if (!el || !envData) return;

    const temp = envData.temp_C != null ? envData.temp_C : (envData.atmosphere ? envData.atmosphere.air_temp_c.current : -45.0);
    const press = envData.pressure_pa != null ? envData.pressure_pa : (envData.atmosphere ? envData.atmosphere.pressure_pa : 775.0);
    const wind = envData.wind_m_s != null ? envData.wind_m_s : (envData.atmosphere ? envData.atmosphere.wind_speed_ms : 5.0);
    const radVal = envData.rad_dose_proxy != null ? envData.rad_dose_proxy : (envData.radiation ? envData.radiation.dose_rate_uSv_hr : 28.5);
    const flare = envData.flare_level || "A (Quiet)";
    const sol = envData.sol != null ? envData.sol : 1133;

    const ic = window.MarsIcons ? window.MarsIcons.get : function () { return ""; };

    let alertHtml = "";
    if (envData.alerts && envData.alerts.length > 0) {
      const topAlert = envData.alerts[0];
      const title = topAlert.title || topAlert.code || "SAFETY ADVISORY";
      alertHtml =
        '<div class="telemetry-alert-badge ' +
        topAlert.severity +
        '" title="' +
        topAlert.message +
        '">' +
        '<span class="alert-icon">' + ic("alertTriangle") + '</span>' +
        '<div class="alert-content">' +
        '  <span class="alert-title">' + title + '</span>' +
        '</div>' +
        '</div>';
    }

    el.innerHTML =
      '<div class="telemetry-pill-group">' +
      '  <div class="telemetry-pill highlight" title="Current Martian Mission Sol">' +
      '    <span class="pill-icon">' + ic("rocket") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">SOL</span>' +
      '      <span class="telemetry-value font-mono">' + sol + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="Local Mars Solar Time (NASA Mars24)">' +
      '    <span class="pill-icon">' + ic("clock") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">LOCAL TIME</span>' +
      '      <span class="telemetry-value font-mono neon-time" id="telemetry-ltst">' + getFormattedLTST() + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="In-situ surface temperature from rover sensors">' +
      '    <span class="pill-icon">' + ic("thermometer") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">TEMP</span>' +
      '      <span class="telemetry-value font-mono">' + temp + '°C</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="Atmospheric surface pressure">' +
      '    <span class="pill-icon">' + ic("gauge") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">PRESSURE</span>' +
      '      <span class="telemetry-value font-mono">' + Math.round(press) + ' Pa</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="Surface wind velocity from rover anemometer">' +
      '    <span class="pill-icon">' + ic("wind") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">WIND</span>' +
      '      <span class="telemetry-value font-mono">' + wind + ' m/s</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="NOAA GOES X-ray solar flare flux & MSL RAD surface dose rate">' +
      '    <span class="pill-icon">' + ic("shield") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">RAD EST.</span>' +
      '      <span class="telemetry-value font-mono">' + radVal + ' µSv/h · ' + flare + '</span>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      alertHtml;
  }

  function getEnv() {
    return envData;
  }

  // React to site changes across the application
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("mars:site-changed", async function () {
      if (window.MarsData && window.MarsData.loadEnvironment) {
        envData = await MarsData.loadEnvironment();
      }
      simulatedSeconds = 0;
      renderBar(currentContainerId);
    });
  }

  return { init, calculateConsumables, getEnv };
})();
