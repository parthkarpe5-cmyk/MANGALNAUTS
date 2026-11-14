/* global MarsGeodesic, window */
window.MarsSegmentDrawer = (function () {
  let panel = null;

  function init(panelId) {
    panel = document.getElementById(panelId);
  }

  function render(segment, statusText) {
    if (!panel) return;
    if (statusText) {
      panel.innerHTML = "<p class=\"drawer-hint\">" + statusText + "</p>";
      return;
    }
    if (!segment) {
      panel.innerHTML = "<p class=\"drawer-hint\">Pick point A, then point B on the map.</p>";
      return;
    }
    if (segment.error) {
      panel.innerHTML =
        '<p class="drawer-error"></p>';
      panel.firstElementChild.textContent = segment.error;
      return;
    }

    const geo = MarsGeodesic.formatDistance(segment.geodesic_m);
    const path =
      segment.path_m != null
        ? MarsGeodesic.formatDistance(segment.path_m)
        : "—";
    const feasible = segment.path_found && segment.feasible;
    const feasClass = feasible ? "ok" : "bad";
    const feasText = segment.path_found
      ? feasible
        ? "Feasible for current mode"
        : "Exceeds slope limit or blocked"
      : "No route under the current slope limit";

    panel.innerHTML =
      "<h3 class=\"drawer-title\">Segment A → B</h3>" +
      "<dl class=\"drawer-stats\">" +
      "<dt>Geodesic (straight)</dt><dd>" +
      geo +
      "</dd>" +
      "<dt>Path (graph)</dt><dd>" +
      path +
      "</dd>" +
      "<dt>Max slope</dt><dd>" +
      (segment.max_slope_deg != null
        ? segment.max_slope_deg.toFixed(1) + "°"
        : "—") +
      "</dd>" +
      "<dt>Elevation Δ</dt><dd>" +
      (segment.elev_delta_m != null
        ? segment.elev_delta_m.toFixed(1) + " m"
        : "—") +
      "</dd>" +
      "<dt>Mean risk</dt><dd>" +
      (segment.mean_risk != null
        ? (segment.mean_risk * 100).toFixed(0) + "%"
        : "—") +
      "</dd>" +
      "<dt>Snapped nodes</dt><dd>" +
      segment.from.node_id +
      " → " +
      segment.to.node_id +
      "</dd>" +
      "</dl>" +
      '<p class="drawer-feasible ' +
      feasClass +
      '">' +
      feasText +
      "</p>";
  }

  return { init, render };
})();