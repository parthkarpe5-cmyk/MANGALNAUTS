/* global window */
window.MarsTravelMode = (function () {
  const MODES = {
    walk: {
      id: "walk",
      label: "Marswalk (≤15°)",
      shortLabel: "Marswalk",
      maxSlopeDeg: 15,
      type: "walk",
      speedBaseMs: 0.65,
      nasaStandard: "NASA Apollo/Artemis Flight Rule EVA-01",
      rationale: "Apollo EVA standard: Traverses on regolith restricted to ≤15° to prevent astronaut metabolic heat generation exceeding the Liquid Cooling Garment (LCVG max 450 kcal/hr) and sublimator freeze-up.",
    },
    conservative: {
      id: "conservative",
      label: "Equipment Cart (≤10°)",
      shortLabel: "Cart / Heavy",
      maxSlopeDeg: 10,
      type: "walk",
      speedBaseMs: 0.48,
      nasaStandard: "NASA MET / Payload Hauler Rule",
      rationale: "Modular Equipment Transporter standard: Slopes restricted to ≤10° when hauling sample drills or rock core canisters to prevent backward slip in loose fine-grained regolith.",
    },
    steep_walk: {
      id: "steep_walk",
      label: "Steep Scramble (≤20°)",
      shortLabel: "Scramble",
      maxSlopeDeg: 20,
      type: "walk",
      speedBaseMs: 0.38,
      nasaStandard: "NASA Extreme Terrain EVA Recon",
      rationale: "Unencumbered scout astronaut traverse without heavy science carts. Permissible up to 20° on solid bedrock with mandatory 5-minute metabolic rests every 100 meters.",
    },
    rover: {
      id: "rover",
      label: "Rover AutoNav (≤20°)",
      shortLabel: "Rover",
      maxSlopeDeg: 20,
      type: "rover",
      speedBaseMs: 0.12,
      nasaStandard: "JPL Mars 2020 AutoNav Baseline",
      rationale: "Nominal autonomous navigation limit for Perseverance and Curiosity rocker-bogie mobility systems to ensure slip stays under 40% in aeolian bedforms and ripple crests.",
    },
    aggressive_rover: {
      id: "aggressive_rover",
      label: "Rim Ascent Rover (≤26°)",
      shortLabel: "Rim Ascent",
      maxSlopeDeg: 26,
      type: "rover",
      speedBaseMs: 0.07,
      nasaStandard: "JPL Jezero Crater Rim Ascent Protocol",
      rationale: "Documented Mars 2020 Perseverance ascent protocol climbing out of Jezero Crater over consolidated boulder bedrock ramps with high traction.",
    },
  };

  let current = "walk";
  const listeners = [];

  function get() {
    return MODES[current] || MODES.walk;
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
