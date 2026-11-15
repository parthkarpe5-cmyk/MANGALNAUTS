/* global MarsGlobe, MarsDetailMap */
window.MarsWorkspace = (() => {
  const workspace = document.getElementById("map-workspace");
  const divider = document.getElementById("map-divider");
  const sidebar = document.getElementById("workspace-sidebar");
  const closeButton = document.getElementById("workspace-close");
  const panels = {
    route: document.getElementById("segment-drawer"),
    controls: document.getElementById("globe-layers-menu"),
  };
  const tabs = {
    route: document.getElementById("workspace-route-tab"),
    controls: document.getElementById("workspace-controls-tab"),
  };
  const toggles = {
    route: document.getElementById("workspace-route-toggle"),
    controls: document.getElementById("globe-layers-toggle"),
  };
  let panel = null;
  const defaultShare = 50;
  let share = defaultShare;

  function show(name) {
    panel = name;
    sidebar.hidden = !panel;
    for (const key of Object.keys(panels)) {
      const selected = key === panel;
      panels[key].hidden = !selected;
      tabs[key].setAttribute("aria-selected", String(selected));
      tabs[key].tabIndex = selected ? 0 : -1;
      toggles[key].setAttribute("aria-expanded", String(selected));
    }
  }

  function close() {
    const opener = toggles[panel];
    show(null);
    opener?.focus();
  }

  for (const key of Object.keys(tabs)) {
    toggles[key].addEventListener("click", () => {
      window.MarsAudio?.playClick();
      if (panel === key) close();
      else {
        show(key);
        tabs[key].focus();
      }
    });
    tabs[key].addEventListener("click", () => show(key));
    tabs[key].addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const next = key === "route" ? "controls" : "route";
      show(next);
      tabs[next].focus();
    });
  }

  closeButton.addEventListener("click", close);
  sidebar.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });

  function setShare(value) {
    share = Math.min(75, Math.max(25, value));
    workspace.style.setProperty("--split-share", (share / 100).toFixed(3));
    divider.setAttribute("aria-valuenow", String(Math.round(share)));
  }

  divider.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    divider.setPointerCapture(event.pointerId);
  });
  divider.addEventListener("pointermove", event => {
    if (!divider.hasPointerCapture(event.pointerId)) return;
    const bounds = workspace.getBoundingClientRect();
    const available = bounds.width - divider.offsetWidth;
    if (available > 0) setShare((event.clientX - bounds.left - divider.offsetWidth / 2) / available * 100);
  });
  divider.addEventListener("dblclick", () => setShare(defaultShare));
  divider.addEventListener("keydown", event => {
    const values = { ArrowLeft: share - 5, ArrowRight: share + 5, Home: 25, End: 75 };
    if (!Object.hasOwn(values, event.key)) return;
    event.preventDefault();
    setShare(values[event.key]);
  });

  const resize = new ResizeObserver(() => {
    window.MarsGlobe?.getViewer()?.resize();
    window.MarsDetailMap?.getMap()?.invalidateSize({ pan: false });
  });
  resize.observe(document.getElementById("globe-pane"));
  resize.observe(document.getElementById("detail-pane"));

  return { show, closeRoute: () => { if (panel === "route") show(null); } };
})();
