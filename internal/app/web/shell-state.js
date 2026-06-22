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

  function parseSidebarCollapsedPreference(value) {
    return String(value || "").trim() === "collapsed";
  }

  function createSidebarStorageOperation(collapsed) {
    return collapsed
      ? { type: "set", value: "collapsed" }
      : { type: "remove", value: "" };
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

  function createHeaderPanelState() {
    return {
      active: "",
    };
  }

  function createHeaderPanelViewModel({
    activePanel = "",
    dashboard = {},
    ui = {},
  } = {}) {
    const normalizedActive = normalizeHeaderPanel(activePanel);
    const recentEvents = ensureArray(dashboard?.recentEvents?.data).slice(0, 5);
    const notificationItems = recentEvents.map((event) => ({
      title: stringValue(event?.title || event?.type || "Event"),
      description: stringValue(event?.description || event?.message || "-"),
      meta: stringValue(event?.meta || [event?.backend_name, event?.model].filter(Boolean).join(" · ") || "-"),
      timestamp: stringValue(event?.timestamp || event?.createdAt || event?.created_at || ""),
      tone: stringValue(event?.tone || event?.severity || "neutral"),
    }));

    return {
      activePanel: normalizedActive,
      notifications: {
        count: notificationItems.length,
        items: notificationItems,
        emptyTitle: "No recent events",
        emptyDescription: "Recent backend, policy, and security events will appear here.",
        actions: [
          { key: "view-events", label: "View Events" },
          { key: "refresh-data", label: "Refresh" },
        ],
      },
      profile: {
        title: "Admin",
        subtitle: "Proxy Ops",
        items: [
          { label: "Theme", value: themePanelLabel(ui?.themePreference, ui?.theme) },
          { label: "Last sync", value: stringValue(ui?.lastRefreshAt) || "Not synced yet" },
        ],
        actions: [
          { key: "open-search", label: "Open Search" },
          { key: "cycle-theme", label: "Cycle Theme" },
          { key: "refresh-data", label: "Refresh Data" },
        ],
      },
    };
  }

  function normalizeHeaderPanel(value) {
    const normalized = String(value || "").trim();
    return normalized === "notifications" || normalized === "profile" ? normalized : "";
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

  function stringValue(value) {
    return String(value ?? "").trim();
  }

  function themePanelLabel(preference, theme) {
    const normalizedPreference = stringValue(preference || "system");
    const normalizedTheme = stringValue(theme || "light");
    const preferenceLabel = normalizedPreference === "system"
      ? "Auto"
      : normalizedPreference.charAt(0).toUpperCase() + normalizedPreference.slice(1);
    const themeLabel = normalizedTheme.charAt(0).toUpperCase() + normalizedTheme.slice(1);
    return `${preferenceLabel} · ${themeLabel}`;
  }

  const api = {
    buildPageNavigation,
    createHeaderPanelState,
    createHeaderPanelViewModel,
    createSidebarStorageOperation,
    createSettingsSnapshot,
    createThemeRuntimeState,
    createThemeStorageOperation,
    parseSidebarCollapsedPreference,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ShellStateUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
