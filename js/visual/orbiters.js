/* global Cesium, window */
window.MarsOrbiters = (() => {
  const radians = Math.PI / 180;
  const modeledOrbiters = new Set(["mro", "odyssey", "maven"]);

  function position(elements, elapsed, result) {
    const { eccentricity: e, semiMajorAxisKm, inclinationDeg, nodeDeg,
      argPeriapsisDeg, meanAnomalyDeg, periodSec } = elements;
    const mean = meanAnomalyDeg * radians + 2 * Math.PI * (elapsed % periodSec) / periodSec;
    let anomaly = mean;
    for (let i = 0; i < 8; i++) {
      anomaly -= (anomaly - e * Math.sin(anomaly) - mean) / (1 - e * Math.cos(anomaly));
    }
    const radius = semiMajorAxisKm * 1000 * (1 - e * Math.cos(anomaly));
    const angle = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(anomaly), Math.cos(anomaly) - e)
      + argPeriapsisDeg * radians;
    const node = nodeDeg * radians;
    const inclination = inclinationDeg * radians;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    return Cesium.Cartesian3.fromElements(
      x * Math.cos(node) - y * Math.cos(inclination) * Math.sin(node),
      x * Math.sin(node) + y * Math.cos(inclination) * Math.cos(node),
      y * Math.sin(inclination), result
    );
  }

  let orbiterList = [];
  let orbitersVisible = false;
  let moonsVisible = false;
  let trajectoriesVisible = false;
  let activeSelectedId = null;

  function applyVisibility() {
    for (const entry of orbiterList) {
      const isSelected = activeSelectedId && entry.item.id === activeSelectedId;
      const isMoon = entry.item.type === "moon";
      const showObj = isSelected || (isMoon ? moonsVisible : orbitersVisible);
      const showPath = isSelected || trajectoriesVisible;

      if (entry.entity) entry.entity.show = showObj;
      if (entry.polyline) entry.polyline.show = showPath;
    }
  }

  function setOrbitersVisible(vis) {
    orbitersVisible = !!vis;
    applyVisibility();
  }

  function setMoonsVisible(vis) {
    moonsVisible = !!vis;
    applyVisibility();
  }

  function setTrajectoriesVisible(vis) {
    trajectoriesVisible = !!vis;
    applyVisibility();
  }

  async function init(viewer) {
    const panel = document.getElementById("orbiter-card");
    const select = document.getElementById("orbiter-picker");
    const response = await fetch("data/mars-orbiters.json");
    if (!response.ok) throw new Error("Mars orbiter catalog unavailable");
    const { orbiters } = await response.json();
    const start = performance.now();
    const catalog = new Map(orbiters.map(item => [item.id, item]));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function show(id) {
      activeSelectedId = id || null;
      applyVisibility();

      const item = catalog.get(id);
      panel.hidden = !item;
      select.value = item ? id : "";
      if (!item) return;
      panel.querySelector("h2").textContent = item.name;
      panel.querySelector(".orbiter-history").textContent = item.history;
      const stats = [
        ["Operator / type", item.agency],
        item.launched && ["Launched", item.launched],
        item.arrival && ["Mars arrival", item.arrival],
        item.diameterKm && ["Mean diameter", item.diameterKm + " km"],
        ["Orbit period", item.orbitalElements.periodMin + " min"],
        ["Orbit altitude", item.orbitalElements.periapsisAltKm + "–" + item.orbitalElements.apoapsisAltKm + " km"],
        item.instruments && ["Instruments", item.instruments.join(", ")],
        item.commsRelay && ["Communications", item.commsRelay],
      ].filter(Boolean);
      panel.querySelector("dl").replaceChildren(...stats.flatMap(([label, value]) => {
        const term = document.createElement("dt");
        const detail = document.createElement("dd");
        term.textContent = label;
        detail.textContent = value;
        return [term, detail];
      }));
    }

    select.addEventListener("change", () => show(select.value));
    panel.querySelector("button").addEventListener("click", () => show(""));

    orbiterList = [];
    for (const item of orbiters) {
      select.add(new Option(item.shortName + (item.type === "moon" ? " (Moon)" : ""), item.id));
      const color = Cesium.Color.fromCssColorString(item.color);
      const elements = item.orbitalElements;
      const positions = Array.from({ length: 181 }, (_, i) =>
        position(elements, elements.periodSec * i / 180));
      const polyline = viewer.entities.add({
        polyline: { positions, width: 1, material: color.withAlpha(0.25), arcType: Cesium.ArcType.NONE },
        show: false,
      });
      const hasModel = modeledOrbiters.has(item.id);
      const entity = viewer.entities.add({
        id: "mars-orbiter-" + item.id,
        position: new Cesium.CallbackProperty((_time, result) => {
          const elapsed = reducedMotion.matches ? 0 : (performance.now() - start) * 0.06;
          return position(elements, elapsed, result);
        }, false),
        model: hasModel ? {
          uri: "assets/spacecraft/" + item.id + ".glb",
          minimumPixelSize: 24,
          maximumScale: 250000,
        } : undefined,
        point: { pixelSize: item.type === "moon" ? 8 : 9, color, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
        label: {
          text: item.shortName, font: "600 12px sans-serif",
          pixelOffset: new Cesium.Cartesian2(0, hasModel ? -28 : -16),
          style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 3,
        },
        show: false,
      });

      orbiterList.push({ item, entity, polyline });
    }

    const click = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    click.setInputAction(({ position: pixel }) => {
      const id = viewer.scene.pick(pixel)?.id?.id;
      if (typeof id === "string" && id.startsWith("mars-orbiter-")) show(id.slice(13));
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    applyVisibility();
  }

  return { init, setOrbitersVisible, setMoonsVisible, setTrajectoriesVisible };
})();
