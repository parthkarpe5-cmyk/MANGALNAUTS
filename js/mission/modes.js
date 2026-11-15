/* global window */
window.MarsTravelMode = (function () {
  const MODES = {
    rover: {
      id: "rover",
      label: "Rover AutoNav (≤20°)",
      shortLabel: "Rover",
      maxSlopeDeg: 20,
      type: "rover",
      speedBaseMs: 0.12,
      nasaStandard: "JPL Mars 2020 AutoNav Baseline",
      rationale: "Autonomous navigation standard for rocker-bogie rovers. Rigorously avoids loose sand ripples, dust drifts, and wheel entrapment hazards, favoring stable bedrock.",
    },
    walk: {
      id: "walk",
      label: "Marswalk (≤15°)",
      shortLabel: "Marswalk",
      maxSlopeDeg: 15,
      type: "walk",
      speedBaseMs: 0.65,
      nasaStandard: "NASA Apollo/Artemis Flight Rule EVA-01",
      rationale: "Astronaut EVA on foot. Minimizes metabolic work rate and steep climbs to maintain Liquid Cooling Garment (LCVG max 450 kcal/hr) limits. Unencumbered by surface sand ripples.",
    },
  };

  let current = "rover";
  const listeners = [];

  function get() {
    return MODES[current] || MODES.rover;
  }

  function set(id) {
    if (!MODES[id]) return;
    current = id;
    listeners.forEach(function (fn) {
      fn(MODES[id]);
    });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  return { get, set, onChange, MODES };
})();
