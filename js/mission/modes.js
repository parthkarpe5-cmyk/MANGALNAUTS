/* global window */
window.MarsTravelMode = (function () {
  const MODES = {
    walk: {
      id: "walk",
      label: "Marswalk",
      maxSlopeDeg: 15,
    },
    rover: {
      id: "rover",
      label: "Rover",
      maxSlopeDeg: 20,
    },
  };

  let current = "walk";
  const listeners = [];

  function get() {
    return MODES[current];
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