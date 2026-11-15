/* global L, Cesium, window */
window.MarsHistoricalTraverses = (function () {
  let traversesData = null;
  let leafletLayerGroup = null;
  let cesiumEntities = [];
  let isVisible = false;

  const ROVER_COLORS = {
    perseverance: "#fb923c", // Mars 2020 orange
    curiosity: "#38bdf8",    // MSL sky blue
    opportunity: "#a855f7",  // MER-B violet
    spirit: "#f472b6",       // MER-A rose
    pathfinder: "#facc15",   // Sojourner gold
  };

  async function loadData() {
    if (traversesData) return traversesData;
    try {
      const res = await fetch("data/traverses.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      traversesData = await res.json();
      return traversesData;
    } catch (err) {
      console.warn("[Traverses] Could not load data/traverses.json:", err);
      return { traverses: [] };
    }
  }

  // --- Leaflet 2D Map Integration ---
  async function initLeaflet(map, targetRoverId) {
    if (!leafletLayerGroup) {
      leafletLayerGroup = L.layerGroup();
      if (isVisible) {
        leafletLayerGroup.addTo(map);
      }
    }
    leafletLayerGroup.clearLayers();

    const data = await loadData();
    if (!data.traverses) return;

    data.traverses.forEach(function (tr) {
      // If targetRoverId is provided, optionally filter or style accordingly
      if (targetRoverId && tr.id !== targetRoverId && targetRoverId !== "all") {
        return;
      }

      if (!tr.points || tr.points.length < 2) return;

      const latLngs = tr.points.map(function (pt) {
        return [pt[0], pt[1]];
      });

      const color = ROVER_COLORS[tr.id] || tr.color || "#fb923c";

      // 1. Casing / Halo
      const halo = L.polyline(latLngs, {
        color: "#050811",
        weight: 6,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      });

      // 2. Core glowing line
      const core = L.polyline(latLngs, {
        color: color,
        weight: 2.8,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });

      // Popup content with authentic mission data
      const popupHtml = `
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #e2e8f0; line-height: 1.4; padding: 4px;">
          <div style="font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 3px; margin-bottom: 4px;">
            ${tr.name}
          </div>
          <div><strong>Location:</strong> ${tr.location}</div>
          <div><strong>Traverse Distance:</strong> ${tr.lengthKm} km</div>
          ${tr.lastSol ? `<div><strong>Mission Sol:</strong> Sol ${tr.lastSol}</div>` : ""}
          <div style="margin-top: 4px; font-size: 10px; color: #94a3b8; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 4px;">
            ${tr.highlights || "NASA planetary exploration drive."}
          </div>
        </div>
      `;

      core.bindPopup(popupHtml);

      // Start & End markers
      const startPt = latLngs[0];
      const endPt = latLngs[latLngs.length - 1];

      const startIcon = L.divIcon({
        className: "historical-start-pin",
        html: `<div style="width: 8px; height: 8px; border-radius: 50%; background: #ffffff; border: 2px solid ${color}; box-shadow: 0 0 6px ${color};"></div>`,
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });

      const endIcon = L.divIcon({
        className: "historical-end-pin",
        html: `<div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; border: 2px solid #ffffff; box-shadow: 0 0 8px ${color};"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const startMarker = L.marker(startPt, { icon: startIcon }).bindPopup(
        `<b>${tr.name}</b><br/>Landing Point (Sol 0)`
      );
      const endMarker = L.marker(endPt, { icon: endIcon }).bindPopup(
        `<b>${tr.name}</b><br/>Current / Terminal Location (${tr.lengthKm} km)`
      );

      leafletLayerGroup.addLayer(halo);
      leafletLayerGroup.addLayer(core);
      leafletLayerGroup.addLayer(startMarker);
      leafletLayerGroup.addLayer(endMarker);
    });
  }

  // --- Cesium 3D Globe Integration ---
  async function initCesium(viewer) {
    if (!viewer) return;

    // Clear any previous entities
    cesiumEntities.forEach(function (e) {
      viewer.entities.remove(e);
    });
    cesiumEntities = [];

    const data = await loadData();
    if (!data.traverses) return;

    data.traverses.forEach(function (tr) {
      if (!tr.points || tr.points.length < 2) return;

      const positions = [];
      tr.points.forEach(function (pt) {
        positions.push(
          Cesium.Cartesian3.fromDegrees(
            pt[1], // lon
            pt[0], // lat
            500.0, // clamp slightly above ellipsoid
            Cesium.Ellipsoid.MARS
          )
        );
      });

      const hexColor = ROVER_COLORS[tr.id] || tr.color || "#fb923c";
      const cesiumColor = Cesium.Color.fromCssColorString(hexColor);

      const entity = viewer.entities.add({
        name: tr.name,
        show: isVisible,
        polyline: {
          positions: positions,
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: cesiumColor,
          }),
          clampToGround: false,
        },
        description: `
          <h3>${tr.name}</h3>
          <p><strong>Location:</strong> ${tr.location}</p>
          <p><strong>Distance:</strong> ${tr.lengthKm} km</p>
          <p>${tr.highlights || ""}</p>
        `,
      });

      cesiumEntities.push(entity);
    });
  }

  function setVisible(visible, leafletMap, cesiumViewer) {
    isVisible = !!visible;
    if (leafletLayerGroup && leafletMap) {
      if (isVisible) {
        if (!leafletMap.hasLayer(leafletLayerGroup)) {
          leafletMap.addLayer(leafletLayerGroup);
        }
      } else {
        if (leafletMap.hasLayer(leafletLayerGroup)) {
          leafletMap.removeLayer(leafletLayerGroup);
        }
      }
    }

    if (cesiumEntities.length > 0) {
      cesiumEntities.forEach(function (e) {
        e.show = isVisible;
      });
    }
  }

  function getTraverses() {
    return traversesData ? traversesData.traverses : [];
  }

  return {
    loadData,
    initLeaflet,
    initCesium,
    setVisible,
    getTraverses,
  };
})();
