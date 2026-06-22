(function initThemeModule(globalScope) {
  const VALID_PREFERENCES = new Set(["system", "light", "dark"]);

  function normalizeThemePreference(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return VALID_PREFERENCES.has(normalized) ? normalized : "system";
  }

  function resolveThemeState({ storedPreference, systemPrefersDark }) {
    const preference = normalizeThemePreference(storedPreference);
    const theme = preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
    return {
      preference,
      theme,
      isAuto: preference === "system",
    };
  }

  function nextThemePreference(currentPreference) {
    const normalized = normalizeThemePreference(currentPreference);
    if (normalized === "system") {
      return "light";
    }
    if (normalized === "light") {
      return "dark";
    }
    return "system";
  }

  function getThemeToggleState({ preference, theme }) {
    const normalizedPreference = normalizeThemePreference(preference);
    const normalizedTheme = theme === "dark" ? "dark" : "light";

    if (normalizedPreference === "system") {
      return {
        label: "Auto",
        hint: "Follow system theme",
        pressed: "mixed",
      };
    }

    return {
      label: normalizedTheme === "dark" ? "Dark" : "Light",
      hint: "Switch theme mode",
      pressed: normalizedTheme === "dark",
    };
  }

  const api = {
    getThemeToggleState,
    nextThemePreference,
    normalizeThemePreference,
    resolveThemeState,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ThemeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
