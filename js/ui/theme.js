/* global window, localStorage, document */
window.MarsTheme = (function () {
  const THEMES = ["perseverance", "ares", "deepspace"];
  const DEFAULT_THEME = "deepspace";
  const PREFERENCE_KEY = "mangalnauts_selected_theme";
  const savedTheme = localStorage.getItem(PREFERENCE_KEY);
  let currentTheme = THEMES.includes(savedTheme) ? savedTheme : DEFAULT_THEME;

  function apply(theme) {
    if (!THEMES.includes(theme)) theme = DEFAULT_THEME;
    currentTheme = theme;
    localStorage.setItem(PREFERENCE_KEY, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }

  function get() {
    return currentTheme;
  }

  function list() {
    return THEMES;
  }

  // Auto-apply on load
  document.documentElement.setAttribute("data-theme", currentTheme);

  return { apply, get, list };
})();
