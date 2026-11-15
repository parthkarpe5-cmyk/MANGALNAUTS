/* global MarsGlobe, MarsDetailMap */
window.MarsWorkspace = (() => {
  const workspace = document.getElementById("map-workspace");
  const divider = document.getElementById("map-divider");
  const sidebar = document.getElementById("workspace-sidebar");
  const closeButton = document.getElementById("workspace-close");
  const sidebarTitle = document.getElementById("workspace-sidebar-title");

  const panels = {
    missions: document.getElementById("workspace-missions-menu"),
    projects: document.getElementById("workspace-projects-menu"),
    layers: document.getElementById("globe-layers-menu"),
    route: document.getElementById("segment-drawer"),
    split: document.getElementById("workspace-split-menu"),
  };

  const titles = {
    missions: "MARTIAN MISSIONS & SECTORS",
    projects: "EXPLORATION PROJECTS & PDS",
    layers: "MAP CONTROLS & OVERLAYS",
    route: "EXPEDITION ROUTE & CONSUMABLES",
    split: "VIEWPORT DISPLAY ENGINE",
  };

  let panel = null;
  const defaultShare = 50;
  let share = defaultShare;

  function show(name) {
    if (!name) {
      close();
      return;
    }
    const targetName = (name === "controls") ? "layers" : name;
    if (panel === targetName) {
      close();
      return;
    }
    panel = targetName;
    if (sidebar) sidebar.hidden = false;

    if (sidebarTitle && titles[panel]) {
      sidebarTitle.textContent = titles[panel];
    }

    for (const [key, el] of Object.entries(panels)) {
      if (el) {
        el.hidden = (key !== panel);
      }
    }

    // Update active class on left rail buttons
    document.querySelectorAll(".rail-btn").forEach(btn => {
      const action = btn.dataset.railAction;
      const isActive = (action === panel);
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-expanded", String(isActive));
    });

    // Sync legacy tabs and toggles
    const routeTab = document.getElementById("workspace-route-tab");
    const controlsTab = document.getElementById("workspace-controls-tab");
    if (routeTab) {
      routeTab.setAttribute("aria-selected", String(panel === "route"));
      routeTab.tabIndex = panel === "route" ? 0 : -1;
    }
    if (controlsTab) {
      controlsTab.setAttribute("aria-selected", String(panel === "layers"));
      controlsTab.tabIndex = panel === "layers" ? 0 : -1;
    }
    const routeToggle = document.getElementById("workspace-route-toggle");
    const layersToggle = document.getElementById("globe-layers-toggle");
    if (routeToggle) routeToggle.setAttribute("aria-expanded", String(panel === "route"));
    if (layersToggle) layersToggle.setAttribute("aria-expanded", String(panel === "layers"));
  }

  function close() {
    panel = null;
    if (sidebar) sidebar.hidden = true;
    for (const el of Object.values(panels)) {
      if (el) el.hidden = true;
    }
    document.querySelectorAll(".rail-btn").forEach(btn => {
      btn.classList.remove("active");
      btn.setAttribute("aria-expanded", "false");
    });
    const routeToggle = document.getElementById("workspace-route-toggle");
    const layersToggle = document.getElementById("globe-layers-toggle");
    if (routeToggle) routeToggle.setAttribute("aria-expanded", "false");
    if (layersToggle) layersToggle.setAttribute("aria-expanded", "false");
  }

  // Hook legacy triggers & tabs
  const routeToggle = document.getElementById("workspace-route-toggle");
  const layersToggle = document.getElementById("globe-layers-toggle");
  const routeTab = document.getElementById("workspace-route-tab");
  const controlsTab = document.getElementById("workspace-controls-tab");

  if (routeToggle) {
    routeToggle.addEventListener("click", () => {
      window.MarsAudio?.playClick();
      if (panel === "route") close();
      else show("route");
    });
  }
  if (layersToggle) {
    layersToggle.addEventListener("click", () => {
      window.MarsAudio?.playClick();
      if (panel === "layers") close();
      else show("layers");
    });
  }
  if (routeTab) {
    routeTab.addEventListener("click", () => show("route"));
  }
  if (controlsTab) {
    controlsTab.addEventListener("click", () => show("layers"));
  }

  if (closeButton) {
    closeButton.addEventListener("click", close);
  }

  if (sidebar) {
    sidebar.addEventListener("keydown", event => {
      if (event.key === "Escape") close();
    });
  }

  function setShare(value) {
    share = Math.min(75, Math.max(25, value));
    if (workspace) workspace.style.setProperty("--split-share", (share / 100).toFixed(3));
    if (divider) divider.setAttribute("aria-valuenow", String(Math.round(share)));
  }

  if (divider && workspace) {
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
  }

  const resize = new ResizeObserver(() => {
    window.MarsGlobe?.getViewer()?.resize();
    window.MarsDetailMap?.getMap()?.invalidateSize({ pan: false });
  });
  const globeP = document.getElementById("globe-pane");
  const detailP = document.getElementById("detail-pane");
  if (globeP) resize.observe(globeP);
  if (detailP) resize.observe(detailP);

  return {
    show,
    close,
    getPanel: () => panel,
    closeRoute: () => { if (panel === "route") close(); }
  };
})();
