(function () {
  "use strict";

  var KEY = "dup-theme";
  var root = document.documentElement;

  function readTheme() {
    try {
      var value = localStorage.getItem(KEY);
      return value === "dark" ? "dark" : "light";
    } catch (_) {
      return "light";
    }
  }

  function updateButtons(theme) {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      var dark = theme === "dark";
      button.setAttribute("aria-pressed", dark ? "true" : "false");
      button.setAttribute("title", dark ? "Включить светлую тему" : "Включить тёмную тему");
      var icon = button.querySelector("[data-theme-icon]");
      var text = button.querySelector("[data-theme-text]");
      if (icon) icon.textContent = dark ? "☀" : "☾";
      if (text) text.textContent = dark ? "Светлая" : "Тёмная";
    });
  }

  function applyTheme(theme, persist) {
    theme = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
    if (persist !== false) {
      try { localStorage.setItem(KEY, theme); } catch (_) {}
    }
    updateButtons(theme);
    document.dispatchEvent(new CustomEvent("dup-theme-change", { detail: { theme: theme } }));
    return theme;
  }

  function toggleTheme() {
    return applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }

  // Apply before the page paints when the script is loaded from <head>.
  applyTheme(readTheme(), false);

  document.addEventListener("DOMContentLoaded", function () {
    updateButtons(root.getAttribute("data-theme") || "light");
  });

  document.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest("[data-theme-toggle]");
    if (!button) return;
    event.preventDefault();
    toggleTheme();
  });

  window.DUPTheme = {
    get: function () { return root.getAttribute("data-theme") || "light"; },
    set: applyTheme,
    toggle: toggleTheme
  };
})();
