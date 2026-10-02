/*
 * theme.js — the light / dark toggle. The choice is saved for this site only
 * ("ieee738-theme"); with none saved, the page follows the system setting.
 * story.js redraws when data-theme changes.
 */
(function () {
  "use strict";
  const root = document.documentElement, button = document.getElementById("theme-toggle"), KEY = "ieee738-theme";
  function apply(theme) {
    root.dataset.theme = theme;
    const dark = theme === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    button.title = dark ? "Light mode" : "Dark mode";
  }
  apply(root.dataset.theme || "light");
  button.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* private browsing: the choice lasts this visit */ }
  });
})();
