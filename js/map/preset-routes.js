/* global L, MarsData, MarsRouteRenderer, window */
window.MarsPresetRoutes = (function () {
  let layerGroup = null;
  let currentMap = null;
  let visible = false;

  async function init(map) {
    currentMap = map;
    if (!layerGroup) {
      layerGroup = L.layerGroup();
    }
    layerGroup.clearLayers();

    const routesGeoJson = await MarsData.loadRoutes();
    if (!routesGeoJson || !routesGeoJson.features) return;

    routesGeoJson.features.forEach(function (feature) {
      const p = feature.properties;
      const coords = feature.geometry.coordinates;
      const latlngs = coords.map(function (c) {
        return [c[1], c[0]];
      });

      const distStr = p.distance_km != null
        ? p.distance_km + " km"
        : (p.length_m / 1000).toFixed(2) + " km";

      const popupHtml =
        '<div class="route-popup">' +
        "<h4>" +
        p.name +
        "</h4>" +
        "<p>" +
        p.description +
        "</p>" +
        "<ul>" +
        "<li><strong>Length:</strong> " +
        distStr +
        "</li>" +
        (p.max_slope_deg ? "<li><strong>Max Slope:</strong> " + p.max_slope_deg + "°</li>" : "") +
        (p.elevation_gain_m ? "<li><strong>Elev Gain:</strong> " + p.elevation_gain_m + " m</li>" : "") +
        (p.sol_span ? "<li><strong>Sol Span:</strong> " + p.sol_span + "</li>" : "") +
        "</ul>" +
        '<button type="button" class="btn-ghost btn-sm btn-run-preset-traverse" style="margin-top:8px; width:100%; border-color:var(--accent-sub, #38bdf8); color:var(--accent-sub, #38bdf8);" data-flat="' +
        latlngs[0][0] +
        '" data-flon="' +
        latlngs[0][1] +
        '" data-tlat="' +
        latlngs[latlngs.length - 1][0] +
        '" data-tlon="' +
        latlngs[latlngs.length - 1][1] +
        '">' +
        "▶ Run Automated Traversal" +
        "</button>" +
        "</div>";

      // Render advanced multi-layered corridor with glowing halo, directional pulse flow, and km ticks
      const corridor = MarsRouteRenderer.createCorridorLayer(latlngs, {
        color: p.color || "#38bdf8",
        animated: true,
        ticks: true,
        popupHtml: popupHtml,
      });

      layerGroup.addLayer(corridor);
    });

    layerGroup.on("popupopen", function (e) {
      const popupNode = e.popup.getElement();
      if (!popupNode) return;
      const btn = popupNode.querySelector(".btn-run-preset-traverse");
      if (btn) {
        btn.onclick = function () {
          const flat = parseFloat(btn.dataset.flat);
          const flon = parseFloat(btn.dataset.flon);
          const tlat = parseFloat(btn.dataset.tlat);
          const tlon = parseFloat(btn.dataset.tlon);
          if (window.MarsSegmentPick) {
            MarsSegmentPick.planRoute(flat, flon, tlat, tlon);
          }
        };
      }
    });

    if (visible && !map.hasLayer(layerGroup)) {
      layerGroup.addTo(map);
    }
  }

  function setVisible(map, isVisible) {
    visible = isVisible;
    currentMap = map;
    if (!layerGroup) {
      init(map);
      return;
    }
    if (visible) {
      if (!map.hasLayer(layerGroup)) {
        layerGroup.addTo(map);
      }
    } else {
      if (map.hasLayer(layerGroup)) {
        map.removeLayer(layerGroup);
      }
    }
  }

  // React to site changes across the application
  window.addEventListener("mars:site-changed", function () {
    if (currentMap) {
      init(currentMap);
    }
  });

  return { init, setVisible };
})();
