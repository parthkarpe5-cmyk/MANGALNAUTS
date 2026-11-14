/* global window, localStorage, document */
window.MarsTheme = (function () {
  const THEMES = ["perseverance", "ares", "deepspace"];
  let currentTheme = localStorage.getItem("mars_mission_theme") || "perseverance";

  function apply(theme) {
    if (!THEMES.includes(theme)) theme = "perseverance";
    currentTheme = theme;
    localStorage.setItem("mars_mission_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  function get() {
    return currentTheme;
  }

  function list() {
    return THEMES;
  }

  // Auto-apply on load
  apply(currentTheme);

  return { apply, get, list };
})();
