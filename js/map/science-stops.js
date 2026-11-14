/* global L, MarsData, MarsSegmentDrawer, MarsIcons, window */
window.MarsScienceStops = (function () {
  let layerGroup = null;
  let visible = true;

  function stopIcon(type) {
    const isCritical = type.includes("Delta") || type.includes("Canyon");
    const borderColor = isCritical ? "#ef4444" : "#c9f31d";
    const ic = window.MarsIcons ? window.MarsIcons.get : function () { return ""; };
    const svgIcon = type.includes("Delta")
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
    if (!layerGroup) {
      layerGroup = L.layerGroup();
    }
    layerGroup.clearLayers();

    const data = await MarsData.loadScienceStops();

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
        }
        if (window.MarsSegmentDrawer) {
          MarsSegmentDrawer.renderScienceStop(p);
        }
      });

      layerGroup.addLayer(marker);
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
