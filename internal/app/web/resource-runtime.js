(function initResourceRuntimeModule(globalScope) {
  const REQUIRED_METHODS = [
    "renderResourceToolbar",
    "createQuickDetailMarkup",
    "renderProxyRow",
    "renderBackendRow",
    "renderClientRow",
    "renderResourceTablePage",
  ];
  const REQUIRED_STATE_METHODS = [
    "defaultResourceView",
    "toolbarStatusLabel",
    "applyResourceView",
    "currentLocalPageData",
    "currentRemotePageData",
    "applyPagedResponse",
    "paginationPageNumbers",
  ];
  const REQUIRED_CRUD_METHODS = [
    "createResourceCrud",
    "parseModelMapping",
    "formatModelMappingInput",
    "readForm",
    "splitList",
  ];
  const REQUIRED_SHELL_STATE_METHODS = [
    "buildPageNavigation",
    "createSettingsSnapshot",
    "createThemeRuntimeState",
    "createThemeStorageOperation",
  ];
  const REQUIRED_SHELL_VIEW_METHODS = [
    "activatePageView",
    "pageIDFromHash",
    "renderSearchResults",
    "renderSearchShellView",
    "renderThemeView",
  ];
  const REQUIRED_DRAWER_VIEW_METHODS = [
    "drawerDisplayTitle",
    "renderDrawerShell",
  ];
  const REQUIRED_DRAWER_RUNTIME_METHODS = [
    "closeDrawerShell",
    "deleteDrawerResource",
    "openDrawerEditor",
    "openResourceDrawer",
    "renderDrawerShell",
  ];
  const REQUIRED_SHELL_RUNTIME_METHODS = [
    "pageIDFromHash",
    "activatePage",
    "navigateToPage",
    "initializeThemeState",
    "persistThemePreference",
    "applyResolvedTheme",
    "renderTheme",
    "renderSettings",
    "buildSettingsSnapshot",
    "cycleThemePreference",
    "toggleSidebarCollapsed",
  ];
  const REQUIRED_PAGINATION_METHODS = [
    "bindPagination",
    "currentLocalPageData",
    "currentRemotePageData",
    "applyPagedResponse",
    "renderPagination",
  ];
  const REQUIRED_DISPLAY_METHODS = [
    "backendProtocolLabel",
    "clientTokenDisplay",
    "ensureArray",
    "formatBackendCoverage",
    "formatBackendRecentStats",
    "formatBackendRouting",
    "formatHourlyCount",
    "formatBindingCount",
    "formatDataSize",
    "formatDateTime",
    "formatLatency",
    "formatModelList",
    "formatTagList",
    "formatUsageCount",
    "escapeHTML",
    "emptyState",
    "renderDatalist",
    "statusPill",
    "tableActions",
  ];
  const REQUIRED_DASHBOARD_RUNTIME_METHODS = [
    "bindDashboardInteractions",
    "refreshDashboardUsagePanel",
    "startDashboardLoading",
    "renderDashboardPanels",
    "renderDashboardShell",
    "retryDashboardSection",
  ];
  const REQUIRED_DASHBOARD_VIEW_METHODS = [
    "renderDashboardSummaryRow",
    "renderDashboardUsageCard",
    "renderDashboardEventsSummaryCard",
    "renderDashboardRecentEventsCard",
    "renderDashboardRecentUsageCard",
    "renderSparkline",
    "renderAreaChart",
  ];
  const REQUIRED_SEARCH_RUNTIME_METHODS = [
    "openSearchShell",
    "closeSearchShell",
    "updateSearchQuery",
    "triggerSearch",
    "executeSearch",
    "renderSearchResults",
    "navigateToSearchResult",
    "currentSearchKeyboardState",
    "moveSearchSelection",
  ];
  const REQUIRED_OBSERVABILITY_RUNTIME_METHODS = [
    "buildUsageLogQuery",
    "buildUsageLogStatsQuery",
    "buildEventQuery",
    "buildEventSummaryQuery",
    "syncEventFilterInputs",
    "applyEventFilters",
    "resetEventFilters",
    "refreshEvents",
    "syncUsageLogFilterInputs",
    "applyUsageLogFilters",
    "resetUsageLogFilters",
    "refreshUsageLogs",
    "clearUsageLogs",
    "deleteFilteredUsageLogs",
    "renderUsageLogFilterOptions",
    "renderEvents",
    "renderUsageLogs",
    "renderUsageLogInlineDetail",
    "primeUsageLogDetail",
  ];
  const REQUIRED_RESOURCE_LIST_RUNTIME_METHODS = [
    "bindResourceListInteractions",
    "renderLocalResourceTable",
  ];
  const REQUIRED_RESOURCE_RENDER_RUNTIME_METHODS = [
    "buildQuickDetailMarkup",
    "renderProxyRow",
    "renderBackendRow",
    "renderClientRow",
    "renderResourceListByKey",
  ];
  const REQUIRED_RESOURCE_DATA_RUNTIME_METHODS = [
    "renderProxyOptions",
    "fetchAllCollectionPages",
    "refreshResourceList",
  ];
  const REQUIRED_CONSOLE_DATA_RUNTIME_METHODS = [
    "refreshDashboardData",
    "refreshAll",
    "handleSettingsAction",
  ];

  function resolveSubmittedBackendStatus({ submittedStatus, currentBackendStatus, editing }) {
    const normalizedSubmittedStatus = String(submittedStatus || "").trim();
    if (normalizedSubmittedStatus) {
      return normalizedSubmittedStatus;
    }
    if (editing) {
      return String(currentBackendStatus || "").trim() || "normal";
    }
    return "normal";
  }

  function requireResourceViewUtils(resourceViewUtils) {
    const candidate = resourceViewUtils && typeof resourceViewUtils === "object"
      ? resourceViewUtils
      : null;
    const missing = REQUIRED_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-view.js failed to load before app.js; missing ResourceViewUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceStateUtils(resourceStateUtils) {
    const candidate = resourceStateUtils && typeof resourceStateUtils === "object"
      ? resourceStateUtils
      : null;
    const missing = REQUIRED_STATE_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-state.js failed to load before app.js; missing ResourceStateUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceCrudUtils(resourceCrudUtils) {
    const candidate = resourceCrudUtils && typeof resourceCrudUtils === "object"
      ? resourceCrudUtils
      : null;
    const missing = REQUIRED_CRUD_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-crud.js failed to load before app.js; missing ResourceCrudUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireShellStateUtils(shellStateUtils) {
    const candidate = shellStateUtils && typeof shellStateUtils === "object"
      ? shellStateUtils
      : null;
    const missing = REQUIRED_SHELL_STATE_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `shell-state.js failed to load before app.js; missing ShellStateUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireShellViewUtils(shellViewUtils) {
    const candidate = shellViewUtils && typeof shellViewUtils === "object"
      ? shellViewUtils
      : null;
    const missing = REQUIRED_SHELL_VIEW_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `shell-view.js failed to load before app.js; missing ShellViewUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireDrawerViewUtils(drawerViewUtils) {
    const candidate = drawerViewUtils && typeof drawerViewUtils === "object"
      ? drawerViewUtils
      : null;
    const missing = REQUIRED_DRAWER_VIEW_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `drawer-view.js failed to load before app.js; missing DrawerViewUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireDrawerRuntimeUtils(drawerRuntimeUtils) {
    const candidate = drawerRuntimeUtils && typeof drawerRuntimeUtils === "object"
      ? drawerRuntimeUtils
      : null;
    const missing = REQUIRED_DRAWER_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `drawer-runtime.js failed to load before app.js; missing DrawerRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireShellRuntimeUtils(shellRuntimeUtils) {
    const candidate = shellRuntimeUtils && typeof shellRuntimeUtils === "object"
      ? shellRuntimeUtils
      : null;
    const missing = REQUIRED_SHELL_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `shell-runtime.js failed to load before app.js; missing ShellRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requirePaginationUtils(paginationUtils) {
    const candidate = paginationUtils && typeof paginationUtils === "object"
      ? paginationUtils
      : null;
    const missing = REQUIRED_PAGINATION_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `pagination.js failed to load before app.js; missing PaginationUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireDisplayUtils(displayUtils) {
    const candidate = displayUtils && typeof displayUtils === "object"
      ? displayUtils
      : null;
    const missing = REQUIRED_DISPLAY_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `display-utils.js failed to load before app.js; missing DisplayUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireDashboardRuntimeUtils(dashboardRuntimeUtils) {
    const candidate = dashboardRuntimeUtils && typeof dashboardRuntimeUtils === "object"
      ? dashboardRuntimeUtils
      : null;
    const missing = REQUIRED_DASHBOARD_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `dashboard-runtime.js failed to load before app.js; missing DashboardRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireDashboardViewUtils(dashboardViewUtils) {
    const candidate = dashboardViewUtils && typeof dashboardViewUtils === "object"
      ? dashboardViewUtils
      : null;
    const missing = REQUIRED_DASHBOARD_VIEW_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `dashboard-view.js failed to load before app.js; missing DashboardViewUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireSearchRuntimeUtils(searchRuntimeUtils) {
    const candidate = searchRuntimeUtils && typeof searchRuntimeUtils === "object"
      ? searchRuntimeUtils
      : null;
    const missing = REQUIRED_SEARCH_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `search-runtime.js failed to load before app.js; missing SearchRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireObservabilityRuntimeUtils(observabilityRuntimeUtils) {
    const candidate = observabilityRuntimeUtils && typeof observabilityRuntimeUtils === "object"
      ? observabilityRuntimeUtils
      : null;
    const missing = REQUIRED_OBSERVABILITY_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `observability-runtime.js failed to load before app.js; missing ObservabilityRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceListRuntimeUtils(resourceListRuntimeUtils) {
    const candidate = resourceListRuntimeUtils && typeof resourceListRuntimeUtils === "object"
      ? resourceListRuntimeUtils
      : null;
    const missing = REQUIRED_RESOURCE_LIST_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-list-runtime.js failed to load before app.js; missing ResourceListRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceRenderRuntimeUtils(resourceRenderRuntimeUtils) {
    const candidate = resourceRenderRuntimeUtils && typeof resourceRenderRuntimeUtils === "object"
      ? resourceRenderRuntimeUtils
      : null;
    const missing = REQUIRED_RESOURCE_RENDER_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-render-runtime.js failed to load before app.js; missing ResourceRenderRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceDataRuntimeUtils(resourceDataRuntimeUtils) {
    const candidate = resourceDataRuntimeUtils && typeof resourceDataRuntimeUtils === "object"
      ? resourceDataRuntimeUtils
      : null;
    const missing = REQUIRED_RESOURCE_DATA_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-data-runtime.js failed to load before app.js; missing ResourceDataRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireConsoleDataRuntimeUtils(consoleDataRuntimeUtils) {
    const candidate = consoleDataRuntimeUtils && typeof consoleDataRuntimeUtils === "object"
      ? consoleDataRuntimeUtils
      : null;
    const missing = REQUIRED_CONSOLE_DATA_RUNTIME_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `console-data-runtime.js failed to load before app.js; missing ConsoleDataRuntimeUtils methods: ${missing.join(", ")}`,
    );
  }

  const api = {
    resolveSubmittedBackendStatus,
    requireConsoleDataRuntimeUtils,
    requireDashboardRuntimeUtils,
    requireDashboardViewUtils,
    requireDisplayUtils,
    requireDrawerRuntimeUtils,
    requireObservabilityRuntimeUtils,
    requirePaginationUtils,
    requireResourceListRuntimeUtils,
    requireResourceDataRuntimeUtils,
    requireResourceRenderRuntimeUtils,
    requireSearchRuntimeUtils,
    requireDrawerViewUtils,
    requireResourceCrudUtils,
    requireResourceStateUtils,
    requireResourceViewUtils,
    requireShellRuntimeUtils,
    requireShellStateUtils,
    requireShellViewUtils,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
