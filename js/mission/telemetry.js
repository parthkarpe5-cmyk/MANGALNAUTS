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

  function calculateConsumables(distanceMeters, modeKey) {
    const isWalk = modeKey === "walk";
    const speedMs = isWalk ? 1.2 : 0.14;
    const durationSec = distanceMeters / speedMs;
    const durationMin = durationSec / 60;
    const durationHours = durationMin / 60;

    const o2RatePerMin = isWalk ? 0.8 : 0.25;
    const powerWatts = isWalk ? 220 : 450;

    const o2Liters = durationMin * o2RatePerMin;
    const batteryWh = durationHours * powerWatts;

    return {
      durationSec: Math.round(durationSec),
      durationMin: Math.round(durationMin),
      durationHours: durationHours.toFixed(1),
      o2Liters: Math.round(o2Liters),
      batteryWh: Math.round(batteryWh),
      speedMs: speedMs,
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
        '  <span class="alert-sub">' + topAlert.message.substring(0, 48) + '...</span>' +
        '</div>' +
        '</div>';
    }

    el.innerHTML =
      '<div class="telemetry-pill-group">' +
      '  <div class="telemetry-pill highlight" title="Current Martian Mission Sol">' +
      '    <span class="pill-icon">' + ic("rocket") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">MISSION SOL</span>' +
      '      <span class="telemetry-value font-mono">Sol ' + sol + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="Local Mars Solar Time (NASA Mars24)">' +
      '    <span class="pill-icon">' + ic("clock") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">LTST (SOLAR)</span>' +
      '      <span class="telemetry-value font-mono neon-time" id="telemetry-ltst">' + getFormattedLTST() + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="In-situ surface temperature from rover sensors">' +
      '    <span class="pill-icon">' + ic("thermometer") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">SURFACE TEMP</span>' +
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
      '      <span class="telemetry-label">SURFACE WIND</span>' +
      '      <span class="telemetry-value font-mono">' + wind + ' m/s</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill" title="NOAA GOES X-ray solar flare flux & MSL RAD surface dose rate">' +
      '    <span class="pill-icon">' + ic("shield") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">RADIATION (NOAA/RAD)</span>' +
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
  window.addEventListener("mars:site-changed", async function () {
    envData = await MarsData.loadEnvironment();
    simulatedSeconds = 0;
    renderBar(currentContainerId);
  });

  return { init, calculateConsumables, getEnv };
})();
