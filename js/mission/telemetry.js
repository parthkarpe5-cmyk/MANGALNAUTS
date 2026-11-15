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

  const PAYLOAD_LOADOUTS = [
    { id: "scout", label: "Scout", kg: 0, toolWatts: 0, icon: "🔎", desc: "Camera & Optical Recon" },
    { id: "sample", label: "Science", kg: 15, toolWatts: 45, icon: "🔬", desc: "Sample Tubes & Spectrometer" },
    { id: "drill", label: "Drill", kg: 25, toolWatts: 90, icon: "⚡", desc: "Percussive Rock Core Drill" },
    { id: "survey", label: "Survey", kg: 40, toolWatts: 150, icon: "📡", desc: "GPR Ground Radar & Heavy Rig" },
  ];

  function calculateConsumables(distanceMeters, modeKey, pathNodes, opts) {
    opts = opts || {};
    const mode = (window.MarsTravelMode && window.MarsTravelMode.MODES && window.MarsTravelMode.MODES[modeKey])
      ? window.MarsTravelMode.MODES[modeKey]
      : { type: modeKey === "rover" ? "rover" : "walk", speedBaseMs: modeKey === "rover" ? 0.12 : 0.65, maxSlopeDeg: modeKey === "rover" ? 20 : 15 };

    const isWalk = mode.type === "walk";
    const payloadKg = Number.isFinite(opts.payloadKg) ? opts.payloadKg : 15; // Default 15 kg Science Loadout
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
          const payloadFactor = Math.max(0.72, 1.0 - (payloadKg - 10) * 0.007);
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

    // Physics-Based Mars EVA Consumables Model (Pandolf-Givoni-Santee adapted for Mars 0.38g)
    const mAstronaut = 80; // kg nominal human body mass
    const mSuitPLSS = 135; // kg NASA xEMU space suit + portable life support system
    const mPayload = payloadKg; // kg carried equipment
    const M = mAstronaut + mSuitPLSS + mPayload; // Total Mass M in kg

    // Ambient Temperature from live environmental telemetry (REMS/MEDA)
    const ambientTempC = (envData && Number.isFinite(envData.temp_C)) ? envData.temp_C : -52.0;
    const targetSuitTempC = 18.0; // Interior comfortable suit temperature
    const deltaT = Math.max(0, targetSuitTempC - ambientTempC);

    let o2LitersNominal = 0;
    let o2LitersSafeReturn = 0;
    let batteryWhNominal = 0;
    let batteryWhSafeReturn = 0;
    let waterCoolingLNominal = 0;
    let waterCoolingLSafeReturn = 0;
    let pMetWatts = 0;
    let pSuitWatts = 0;

    if (isWalk) {
      // 1. Terrain surface roughness factor eta (1.20 for Mars fine regolith & delta sand)
      const eta = 1.20;

      // 2. Slope percentage grade G: tan(theta) * 100
      const slopeRad = (meanSlopeDeg * Math.PI) / 180;
      const G = Math.abs(Math.tan(slopeRad)) * 100;

      // 3. Walking speed v in m/s
      const v = Math.max(0.2, avgSpeedMs);

      // 4. Pandolf-Givoni-Santee Metabolic Power Demand adapted for Mars 0.38g:
      // P_met = [1.5 * M + 2.0 * M * (m_payload / M)^2 + eta * M * (1.5 * v^2 + 0.35 * v * G)] * (g_mars / g_earth)
      const loadRatio = M > 0 ? (mPayload / M) : 0;
      const pMetEarth = 1.5 * M + 2.0 * M * (loadRatio * loadRatio) + eta * M * (1.5 * v * v + 0.35 * v * G);
      pMetWatts = pMetEarth * 0.38; // Adjusted for Mars 0.38g gravity
      pMetWatts = Math.max(120, Math.min(650, pMetWatts)); // Physiological human bounds

      // 5. Oxygen Consumption Rate (V_dot_O2):
      // V_dot_O2 = (P_met / 20.9 kJ/L) * 3.6 L/hr per astronaut (20.9 kJ metabolic heat per Liter of O2)
      const vDotO2LitersPerHr = (pMetWatts * 3.6) / 20.9;
      o2LitersNominal = vDotO2LitersPerHr * durationHours * crewCount;

      // 6. Thermal & Electrical Battery Draw:
      // P_suit = P_avionics (90 W) + P_LCG_pump (40 W) + P_heating (Delta T * 0.8 W) + P_payload_tools
      const pAvionics = 90;
      const pLcgPump = 40;
      const pHeating = deltaT * 0.8; // Thermal compensation in Mars thin atmosphere
      const pPayloadTools = mPayload >= 40 ? 150 : (mPayload >= 25 ? 90 : (mPayload >= 15 ? 45 : 0));
      pSuitWatts = pAvionics + pLcgPump + pHeating + pPayloadTools;
      batteryWhNominal = pSuitWatts * durationHours * crewCount;

      // 7. Water sublimation for body metabolic heat rejection (~0.35 L/hr per astronaut at 300W)
      waterCoolingLNominal = (pMetWatts / 300) * 0.35 * durationHours * crewCount;

      // 8. NASA 20% Contingency Reserve Rule:
      // Safe Return Threshold = 1.20 * Calculated Consumables
      o2LitersSafeReturn = o2LitersNominal * 1.20;
      batteryWhSafeReturn = batteryWhNominal * 1.20;
      waterCoolingLSafeReturn = waterCoolingLNominal * 1.20;
    } else {
      // Rover pressurized / AutoNav power model
      const roverWatts = 420 + (meanSlopeDeg / (mode.maxSlopeDeg || 20)) * 240 + (mPayload * 2.5);
      batteryWhNominal = roverWatts * durationHours;
      batteryWhSafeReturn = batteryWhNominal * 1.20;

      const cabinO2RateLitersPerHr = 0.22 * 60 * crewCount;
      o2LitersNominal = cabinO2RateLitersPerHr * durationHours;
      o2LitersSafeReturn = o2LitersNominal * 1.20;
      waterCoolingLNominal = 0;
      waterCoolingLSafeReturn = 0;
      pMetWatts = 85;
      pSuitWatts = roverWatts;
    }

    return {
      durationSec: Math.round(totalDurationSec),
      durationMin: Math.round(durationMin),
      durationHours: durationHours.toFixed(1),
      avgSpeedMs: avgSpeedMs.toFixed(2),
      // Nominal values
      o2Liters: Math.round(o2LitersNominal),
      batteryWh: Math.round(batteryWhNominal),
      waterCoolingL: waterCoolingLNominal.toFixed(1),
      // Safe Return Threshold (120% NASA Flight Rule Reserve)
      o2SafeReturnL: Math.round(o2LitersSafeReturn),
      batterySafeReturnWh: Math.round(batteryWhSafeReturn),
      waterCoolingSafeReturnL: waterCoolingLSafeReturn.toFixed(1),
      // Bio-energetic telemetry details
      pMetWatts: Math.round(pMetWatts),
      pSuitWatts: Math.round(pSuitWatts),
      totalMassKg: Math.round(M),
      apparentWeightMarsKg: (M * 0.38).toFixed(1),
      deltaT: Math.round(deltaT),
      ambientTempC: Math.round(ambientTempC),
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
      '</div>';
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

  return { init, calculateConsumables, getEnv, PAYLOAD_LOADOUTS };
})();
