/* global L, MarsData, window */
window.MarsPresetRoutes = (function () {
  let layerGroup = null;
  let visible = false;

  async function init(map) {
    if (!layerGroup) {
      layerGroup = L.layerGroup();
    }

    const routesGeoJson = await MarsData.loadRoutes();

    routesGeoJson.features.forEach(function (feature) {
      const p = feature.properties;
      const polyline = L.geoJSON(feature, {
        style: {
          color: p.color || "#38bdf8",
          weight: 4,
          dashArray: p.dashArray || null,
          opacity: 0.9,
        },
      });

      const popupHtml =
        "<div class=\"route-popup\">" +
        "<h4>" +
        p.name +
        "</h4>" +
        "<p>" +
        p.description +
        "</p>" +
        "<ul>" +
        "<li><strong>Length:</strong> " +
        (p.length_m / 1000).toFixed(2) +
        " km</li>" +
        "<li><strong>Max Slope:</strong> " +
        p.max_slope_deg +
        "°</li>" +
        "<li><strong>Elev Delta:</strong> " +
        p.elev_delta_m +
        " m</li>" +
        "<li><strong>Risk Index:</strong> " +
        p.risk_rating +
        "</li>" +
        "</ul>" +
        "</div>";

      polyline.bindPopup(popupHtml, { className: "hud-popup" });
      layerGroup.addLayer(polyline);
    });

    if (visible) {
      layerGroup.addTo(map);
    }
  }

  function setVisible(map, isVisible) {
    visible = isVisible;
    if (!layerGroup) {
      init(map);
      return;
    }
    if (visible) {
      layerGroup.addTo(map);
    } else {
      map.removeLayer(layerGroup);
    }
  }

  function isVisible() {
    return visible;
  }

  return { init, setVisible, isVisible };
})();
