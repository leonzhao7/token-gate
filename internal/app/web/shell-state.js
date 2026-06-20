(function initShellStateModule(globalScope) {
  function buildPageNavigation({ currentHash = "", requestedID = "", pages = [] }) {
    const nextID = ensurePageExists(pages, requestedID) ? requestedID : "overview";
    const nextHash = `#${nextID}`;
    return {
      nextID,
      nextHash,
      shouldUpdateHash: String(currentHash || "") !== nextHash,
    };
  }

  function createThemeRuntimeState({
    storedPreference,
    systemPrefersDark = false,
    resolveThemeState,
  }) {
    if (typeof resolveThemeState === "function") {
      const resolved = resolveThemeState({ storedPreference, systemPrefersDark });
      return {
        preference: resolved?.preference || "system",
        theme: resolved?.theme || (systemPrefersDark ? "dark" : "light"),
      };
    }
    return {
      preference: "system",
      theme: systemPrefersDark ? "dark" : "light",
    };
  }

  function createThemeStorageOperation(preference) {
    return String(preference || "") === "system"
      ? { type: "remove", value: "" }
      : { type: "set", value: String(preference || "") };
  }

  function createSettingsSnapshot({
    adminTokenValue = "",
    themePreference = "system",
    resolvedTheme = "light",
    sidebarCollapsed = false,
    lastRefreshLabel = "",
    backends = [],
    clients = [],
    policies = [],
    proxies = [],
    usageLogStats = {},
    usageLogMeta = {},
    eventSummary = {},
  }) {
    return {
      adminTokenPresent: Boolean(String(adminTokenValue || "").trim()),
      themePreference,
      resolvedTheme,
      sidebarCollapsed: Boolean(sidebarCollapsed),
      lastRefreshLabel: String(lastRefreshLabel || ""),
      backends: ensureArray(backends),
      clients: ensureArray(clients),
      policies: ensureArray(policies),
      proxies: ensureArray(proxies),
      usageLogStats: plainObject(usageLogStats),
      usageLogMeta: plainObject(usageLogMeta),
      eventSummary: plainObject(eventSummary),
    };
  }

  function ensurePageExists(pages, id) {
    return ensureArray(pages).some((page) => page?.id === id);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  const api = {
    buildPageNavigation,
    createSettingsSnapshot,
    createThemeRuntimeState,
    createThemeStorageOperation,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ShellStateUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
