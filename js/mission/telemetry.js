/* global MarsData, MarsIcons, window */
window.MarsTelemetry = (function () {
  let envData = null;
  let timer = null;
  let simulatedSeconds = 0;

  async function init(containerId) {
    envData = await MarsData.loadEnvironment();
    renderBar(containerId);
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
    if (!envData) return "--:--:--";
    const parts = envData.ltst.split(":").map(Number);
    let totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2] + simulatedSeconds;
    const h = Math.floor((totalSec / 3600) % 24);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return (
      (h < 10 ? "0" + h : h) +
      ":" +
      (m < 10 ? "0" + m : m) +
      ":" +
      (s < 10 ? "0" + s : s)
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

    const atmo = envData.atmosphere;
    const rad = envData.radiation;
    const ic = window.MarsIcons ? window.MarsIcons.get : function () { return ""; };

    const alertHtml =
      envData.alerts && envData.alerts.length > 0
        ? '<div class="telemetry-alert-badge ' +
          envData.alerts[0].severity +
          '" title="' +
          envData.alerts[0].message +
          '">' +
          '<span class="alert-icon">' + ic("alertTriangle") + '</span>' +
          '<div class="alert-content">' +
          '  <span class="alert-title">' + envData.alerts[0].title + '</span>' +
          '  <span class="alert-sub">EVA thermal cap in effect</span>' +
          '</div>' +
          '</div>'
        : "";

    el.innerHTML =
      '<div class="telemetry-pill-group">' +
      '  <div class="telemetry-pill highlight">' +
      '    <span class="pill-icon">' + ic("rocket") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">SOL</span>' +
      '      <span class="telemetry-value font-mono">' + envData.sol + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill">' +
      '    <span class="pill-icon">' + ic("clock") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">LTST (SOLAR)</span>' +
      '      <span class="telemetry-value font-mono neon-time" id="telemetry-ltst">' + getFormattedLTST() + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill">' +
      '    <span class="pill-icon">' + ic("thermometer") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">SURFACE TEMP</span>' +
      '      <span class="telemetry-value font-mono">' + atmo.air_temp_c.current + '°C</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill">' +
      '    <span class="pill-icon">' + ic("gauge") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">ATM PRESSURE</span>' +
      '      <span class="telemetry-value font-mono">' + atmo.pressure_pa.toFixed(0) + ' Pa</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill">' +
      '    <span class="pill-icon">' + ic("wind") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">WIND</span>' +
      '      <span class="telemetry-value font-mono">' + atmo.wind_speed_ms + ' m/s ' + atmo.wind_dir_compass + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill">' +
      '    <span class="pill-icon">' + ic("dust") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">DUST &tau;</span>' +
      '      <span class="telemetry-value font-mono">' + atmo.dust_opacity_tau + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="telemetry-pill">' +
      '    <span class="pill-icon">' + ic("shield") + '</span>' +
      '    <div class="pill-text">' +
      '      <span class="telemetry-label">RADIATION</span>' +
      '      <span class="telemetry-value font-mono">' + rad.dose_rate_uSv_hr + ' &mu;Sv/h</span>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      alertHtml;
  }

  function getEnv() {
    return envData;
  }

  return { init, calculateConsumables, getEnv };
})();
