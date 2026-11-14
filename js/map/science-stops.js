/* global L, MarsData, MarsSegmentDrawer, MarsIcons, window */
window.MarsScienceStops = (function () {
  let layerGroup = null;
  let currentMap = null;
  let visible = true;

  function stopIcon(type) {
    const isCritical = type.includes("Delta") || type.includes("Canyon") || type.includes("Boxwork") || type.includes("Habitable");
    const borderColor = isCritical ? "#ef4444" : "#c9f31d";
    const ic = window.MarsIcons ? window.MarsIcons.get : function () { return ""; };
    const svgIcon = (type.includes("Delta") || type.includes("Lake") || type.includes("Habitable"))
      ? ic("waves")
      : type.includes("Landing")
      ? ic("rocket")
      : ic("mountain");

    return L.divIcon({
      className: "science-stop-marker",
      html:
        '<div class="stop-pin" style="border-color:' +
        borderColor +
        '">' +
        '<span class="stop-badge-svg">' +
        svgIcon +
        '</span>' +
        '</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  async function init(map) {
    currentMap = map;
    if (!layerGroup) {
      layerGroup = L.layerGroup();
    }
    layerGroup.clearLayers();

    const data = await MarsData.loadScienceStops();
    if (!data || !data.features) return;

    data.features.forEach(function (feat) {
      const p = feat.properties;
      const coords = feat.geometry.coordinates; // [lon, lat]
      const marker = L.marker([coords[1], coords[0]], {
        icon: stopIcon(p.type),
      });

      marker.bindTooltip(
        "<strong>" + p.name + "</strong><br/><small>" + p.type + "</small>",
        {
          direction: "top",
          className: "hud-tooltip",
        }
      );

      marker.on("click", function () {
        if (window.MarsAudio) {
          window.MarsAudio.playClick();
          window.MarsAudio.playSuperCamLaser();
        }
        if (window.MarsSegmentDrawer) {
          MarsSegmentDrawer.renderScienceStop(p);
        }
      });

      layerGroup.addLayer(marker);
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
