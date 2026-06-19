const tokenInput = document.querySelector("#adminToken");
const saveTokenBtn = document.querySelector("#saveTokenBtn");
const refreshBtn = document.querySelector("#refreshBtn");
const pageTitle = document.querySelector("#pageTitle");
const pageBreadcrumb = document.querySelector("#pageBreadcrumb");
const appShell = document.querySelector(".app-shell");
const rootElement = document.documentElement;
const sidebarRoot = document.querySelector("#sidebarRoot");
const sidebarToggleBtn = document.querySelector("#sidebarToggleBtn");
const themeToggleBtn = document.querySelector("#themeToggleBtn");
const themeToggleLabel = document.querySelector("#themeToggleLabel");
const dashboardRoot = document.querySelector("#dashboardRoot");
const dashboardSummaryRow = document.querySelector("#dashboardSummaryRow");
const dashboardUsageCard = document.querySelector("#dashboardUsageCard");
const dashboardEventsSummaryCard = document.querySelector("#dashboardEventsSummaryCard");
const dashboardRecentEventsCard = document.querySelector("#dashboardRecentEventsCard");
const dashboardRecentUsageCard = document.querySelector("#dashboardRecentUsageCard");
const drawerRoot = document.querySelector("#drawerRoot");
const drawerPanel = document.querySelector(".drawer-shell-panel");
const drawerTitle = document.querySelector("#drawerTitle");
const drawerCloseBtn = document.querySelector("#drawerCloseBtn");
const drawerBodyRoot = document.querySelector("#drawerBodyRoot");
const drawerTabRoot = document.querySelector("#drawerTabRoot");
const drawerFooterRoot = document.querySelector("#drawerFooterRoot");
const searchModalRoot = document.querySelector("#searchModalRoot");
const searchModalPanel = document.querySelector(".search-modal-panel");
const searchOpenBtn = document.querySelector("#searchOpenBtn");
const searchCloseBtn = document.querySelector("#searchCloseBtn");
const searchInput = document.querySelector("#searchInput");
const searchResultsRoot = document.querySelector("#searchResultsRoot");
const proxyList = document.querySelector("#proxyList");
const backendList = document.querySelector("#backendList");
const clientList = document.querySelector("#clientList");
const policyList = document.querySelector("#policyList");
const eventList = document.querySelector("#eventList");
const eventQueryFilter = document.querySelector("#eventQueryFilter");
const eventActorFilter = document.querySelector("#eventActorFilter");
const eventBackendFilter = document.querySelector("#eventBackendFilter");
const eventCategoryFilter = document.querySelector("#eventCategoryFilter");
const eventSeverityFilter = document.querySelector("#eventSeverityFilter");
const eventDateFromFilter = document.querySelector("#eventDateFromFilter");
const eventDateToFilter = document.querySelector("#eventDateToFilter");
const refreshEventsBtn = document.querySelector("#refreshEventsBtn");
const applyEventFiltersBtn = document.querySelector("#applyEventFiltersBtn");
const resetEventFiltersBtn = document.querySelector("#resetEventFiltersBtn");
const usageLogList = document.querySelector("#usageLogList");
const deleteUsageLogsBtn = document.querySelector("#deleteUsageLogsBtn");
const clearUsageLogsBtn = document.querySelector("#clearUsageLogsBtn");
const usageLogQueryFilter = document.querySelector("#usageLogQueryFilter");
const usageLogDateFromFilter = document.querySelector("#usageLogDateFromFilter");
const usageLogDateToFilter = document.querySelector("#usageLogDateToFilter");
const usageLogBackendFilter = document.querySelector("#usageLogBackendFilter");
const usageLogModelFilter = document.querySelector("#usageLogModelFilter");
const usageLogClientKeyFilter = document.querySelector("#usageLogClientKeyFilter");
const usageLogPolicyFilter = document.querySelector("#usageLogPolicyFilter");
const usageLogProxyFilter = document.querySelector("#usageLogProxyFilter");
const usageLogStatusFilter = document.querySelector("#usageLogStatusFilter");
const usageLogBackendOptions = document.querySelector("#usageLogBackendOptions");
const usageLogModelOptions = document.querySelector("#usageLogModelOptions");
const usageLogClientKeyOptions = document.querySelector("#usageLogClientKeyOptions");
const usageLogPolicyOptions = document.querySelector("#usageLogPolicyOptions");
const usageLogProxyOptions = document.querySelector("#usageLogProxyOptions");
const refreshUsageLogsBtn = document.querySelector("#refreshUsageLogsBtn");
const applyUsageLogFiltersBtn = document.querySelector("#applyUsageLogFiltersBtn");
const resetUsageLogFiltersBtn = document.querySelector("#resetUsageLogFiltersBtn");
const settingsRoot = document.querySelector("#settingsRoot");
const pages = Array.from(document.querySelectorAll(".page"));
const pageLinks = Array.from(document.querySelectorAll("[data-page-link]"));

const proxyForm = document.querySelector("#proxyForm");
const backendForm = document.querySelector("#backendForm");
const clientForm = document.querySelector("#clientForm");
const policyForm = document.querySelector("#policyForm");

const addProxyBtn = document.querySelector("#addProxyBtn");
const addBackendBtn = document.querySelector("#addBackendBtn");
const addClientBtn = document.querySelector("#addClientBtn");
const addPolicyBtn = document.querySelector("#addPolicyBtn");
const proxyModal = document.querySelector("#proxyModal");
const proxyModalCloseBtn = document.querySelector("#proxyModalCloseBtn");
const proxyModalTitle = document.querySelector("#proxyModalTitle");
const proxySubmitBtn = document.querySelector("#proxySubmitBtn");
const proxyCancelBtn = document.querySelector("#proxyCancelBtn");
const proxyEditBanner = document.querySelector("#proxyEditBanner");
const backendModal = document.querySelector("#backendModal");
const backendModalCloseBtn = document.querySelector("#backendModalCloseBtn");
const backendModalTitle = document.querySelector("#backendModalTitle");
const backendSubmitBtn = document.querySelector("#backendSubmitBtn");
const backendCancelBtn = document.querySelector("#backendCancelBtn");
const backendEditBanner = document.querySelector("#backendEditBanner");
const clientModal = document.querySelector("#clientModal");
const clientModalCloseBtn = document.querySelector("#clientModalCloseBtn");
const clientModalTitle = document.querySelector("#clientModalTitle");
const clientSubmitBtn = document.querySelector("#clientSubmitBtn");
const clientCancelBtn = document.querySelector("#clientCancelBtn");
const clientEditBanner = document.querySelector("#clientEditBanner");
const policyModal = document.querySelector("#policyModal");
const policyModalCloseBtn = document.querySelector("#policyModalCloseBtn");
const policyModalTitle = document.querySelector("#policyModalTitle");
const policySubmitBtn = document.querySelector("#policySubmitBtn");
const policyCancelBtn = document.querySelector("#policyCancelBtn");
const policyEditBanner = document.querySelector("#policyEditBanner");

const ADMIN_TOKEN_KEY = "token-gate-admin-token";
const THEME_PREFERENCE_KEY = "token-gate-theme-preference";
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SEARCH_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 220;
const RESOURCE_VIEW_CONFIG = {
  proxies: {
    searchPlaceholder: "Search proxies by name or address",
    filterOptions: [
      { value: "all", label: "All status" },
      { value: "enabled", label: "Enabled" },
      { value: "disabled", label: "Disabled" },
    ],
    sortOptions: [
      { value: "updated_desc", label: "Updated" },
      { value: "name_asc", label: "Name" },
    ],
  },
  backends: {
    searchPlaceholder: "Search backends, base URL, models",
    filterOptions: [
      { value: "all", label: "All status" },
      { value: "enabled", label: "Enabled" },
      { value: "disabled", label: "Disabled" },
    ],
    sortOptions: [
      { value: "updated_desc", label: "Updated" },
      { value: "name_asc", label: "Name" },
      { value: "weight_desc", label: "Weight" },
    ],
  },
  clients: {
    searchPlaceholder: "Search client keys, groups, routes",
    filterOptions: [
      { value: "all", label: "All status" },
      { value: "enabled", label: "Enabled" },
      { value: "disabled", label: "Disabled" },
    ],
    sortOptions: [
      { value: "updated_desc", label: "Updated" },
      { value: "name_asc", label: "Name" },
      { value: "group_asc", label: "Route group" },
    ],
  },
  policies: {
    searchPlaceholder: "Search patterns, endpoints, pools",
    filterOptions: [
      { value: "all", label: "All failover" },
      { value: "enabled", label: "Failover on" },
      { value: "disabled", label: "Failover off" },
    ],
    sortOptions: [
      { value: "priority_asc", label: "Priority" },
      { value: "updated_desc", label: "Updated" },
      { value: "pattern_asc", label: "Pattern" },
    ],
  },
};
const ThemeUtils = globalThis.ThemeUtils || {};
const SearchUtils = globalThis.SearchUtils || {};
const DashboardUtils = globalThis.DashboardUtils || {};
const DashboardViewUtils = globalThis.DashboardViewUtils || {};
const ChartsUtils = globalThis.ChartsUtils || {};
const DrawerUtils = globalThis.DrawerUtils || {};
const ObservabilityUtils = globalThis.ObservabilityUtils || {};
const ObservabilityViewUtils = globalThis.ObservabilityViewUtils || {};
const ResourceRuntimeUtils = globalThis.ResourceRuntimeUtils || {};
const ResourceViewUtils = typeof ResourceRuntimeUtils.requireResourceViewUtils === "function"
  ? ResourceRuntimeUtils.requireResourceViewUtils(globalThis.ResourceViewUtils)
  : (() => {
    throw new Error("resource-runtime.js failed to load before app.js");
  })();
const RendererUtils = globalThis.RendererUtils || {};
const SettingsUtils = globalThis.SettingsUtils || {};
const systemThemeQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const searchDebounce = typeof SearchUtils.createDebouncedTask === "function"
  ? SearchUtils.createDebouncedTask((query) => {
    executeSearch(query).catch(reportError);
  }, SEARCH_DEBOUNCE_MS)
  : null;
const initialDashboardState = typeof DashboardUtils.createDashboardState === "function"
  ? DashboardUtils.createDashboardState()
  : {
    summaryCards: {
      backends: { status: "loading", data: null, error: "" },
      client_keys: { status: "loading", data: null, error: "" },
      policies: { status: "loading", data: null, error: "" },
      proxies: { status: "loading", data: null, error: "" },
    },
    usage: { status: "loading", data: null, error: "", metric: "requests", range: "7d" },
    eventsSummary: { status: "loading", data: null, error: "" },
    recentEvents: { status: "loading", data: null, error: "" },
    recentUsage: { status: "loading", data: null, error: "" },
  };
const state = {
  dashboard: initialDashboardState,
  proxies: [],
  backends: [],
  clients: [],
  policies: [],
  events: [],
  usageLogs: [],
  usageLogStats: null,
  eventSummary: null,
  usageLogDetailCache: new Map(),
  usageLogOptions: {
    backends: [],
    models: [],
    clientKeys: [],
    policies: [],
    proxies: [],
  },
  paginationMeta: {
    proxies: { total: 0, page: 1, limit: 10 },
    backends: { total: 0, page: 1, limit: 10 },
    clients: { total: 0, page: 1, limit: 10 },
    policies: { total: 0, page: 1, limit: 10 },
    events: { total: 0, page: 1, limit: 10 },
    usageLogs: { total: 0, page: 1, limit: 10 },
  },
  editingProxyID: null,
  editingBackendID: null,
  editingClientID: null,
  editingPolicyID: null,
  expandedProxies: new Set(),
  expandedBackends: new Set(),
  expandedClients: new Set(),
  expandedPolicies: new Set(),
  expandedUsageLogs: new Set(),
  usageLogFilters: {
    q: "",
    dateFrom: "",
    dateTo: "",
    backend: "",
    model: "",
    clientKey: "",
    policy: "",
    proxy: "",
    status: "",
  },
  eventFilters: {
    q: "",
    actor: "",
    backend: "",
    category: "",
    severity: "",
    dateFrom: "",
    dateTo: "",
  },
  resourceViews: {
    proxies: { query: "", filter: "all", sort: "updated_desc" },
    backends: { query: "", filter: "all", sort: "updated_desc" },
    clients: { query: "", filter: "all", sort: "updated_desc" },
    policies: { query: "", filter: "all", sort: "priority_asc" },
  },
  pagination: {
    proxies: { page: 1, size: 10 },
    backends: { page: 1, size: 10 },
    clients: { page: 1, size: 10 },
    policies: { page: 1, size: 10 },
    events: { page: 1, size: 10 },
    usageLogs: { page: 1, size: 10 },
  },
  ui: {
    theme: "light",
    themePreference: "system",
    lastRefreshAt: "",
    drawer: { open: false, kind: "", id: null, title: "", tab: "overview", loading: false, data: null, error: "", detailPath: "", deletePath: "", page: "", triggerElement: null },
    search: {
      open: false,
      query: "",
      loading: false,
      activeIndex: -1,
      results: { query: "", total: 0, groups: [] },
      requestSequence: 0,
      activeSequence: 0,
      triggerElement: null,
    },
  },
};

tokenInput.value = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
initializeThemeState();
renderTheme();

window.addEventListener("hashchange", () => {
  activatePage(pageIDFromHash());
});

sidebarToggleBtn?.addEventListener("click", () => {
  toggleSidebarCollapsed();
});

themeToggleBtn?.addEventListener("click", () => {
  cycleThemePreference();
});

searchOpenBtn?.addEventListener("click", () => {
  openSearchShell();
});

searchOpenBtn?.addEventListener("input", (event) => {
  updateSearchQuery(String(event.currentTarget.value || ""));
  if (!state.ui.search.open) {
    openSearchShell();
  }
  renderSearchShell();
});

searchOpenBtn?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  openSearchShell();
});

searchCloseBtn?.addEventListener("click", () => {
  closeSearchShell();
});

searchModalRoot?.addEventListener("click", (event) => {
  if (event.target === searchModalRoot) {
    closeSearchShell();
  }
});

searchInput?.addEventListener("input", (event) => {
  updateSearchQuery(String(event.currentTarget.value || ""));
  renderSearchShell();
});

searchInput?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSearchSelection(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSearchSelection(-1);
    return;
  }
  if (event.key === "Enter") {
    const keyboardState = currentSearchKeyboardState();
    if (!keyboardState.activeItem) {
      return;
    }
    event.preventDefault();
    navigateToSearchResult({
      group: keyboardState.activeItem.groupKey,
      kind: keyboardState.activeItem.kind || "",
      title: keyboardState.activeItem.title || "",
      targetPage: keyboardState.activeItem.targetPage || "",
      targetId: keyboardState.activeItem.targetId || "",
    });
  }
});

settingsRoot?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-settings-action]");
  if (!actionButton) {
    return;
  }
  handleSettingsAction(actionButton.dataset.settingsAction || "").catch(reportError);
});

searchResultsRoot?.addEventListener("click", (event) => {
  const target = event.target.closest("[data-search-result]");
  if (!target) {
    return;
  }

  const group = target.dataset.searchGroup || "";
  const kind = target.dataset.searchKind || "";
  const title = target.dataset.searchTitle || "";
  const targetPage = target.dataset.searchPage || "";
  const targetID = target.dataset.searchId || "";
  navigateToSearchResult({ group, kind, title, targetPage, targetId: targetID });
});

drawerCloseBtn?.addEventListener("click", () => {
  closeDrawerShell();
});

drawerRoot?.addEventListener("click", (event) => {
  if (event.target === drawerRoot) {
    closeDrawerShell();
  }
});

drawerTabRoot?.querySelectorAll("[data-drawer-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.ui.drawer.tab = button.dataset.drawerTab || "overview";
    renderDrawerShell();
  });
});

saveTokenBtn.addEventListener("click", () => {
  localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.value.trim());
  renderSettings();
});

refreshBtn.addEventListener("click", () => {
  refreshAll().catch(reportError);
});

addProxyBtn.addEventListener("click", () => {
  startCreateProxy();
});

proxyModalCloseBtn.addEventListener("click", () => {
  resetProxyForm();
});

proxyModal.addEventListener("click", (event) => {
  if (event.target === proxyModal) {
    resetProxyForm();
  }
});

proxyCancelBtn.addEventListener("click", () => {
  resetProxyForm();
});

addBackendBtn.addEventListener("click", () => {
  startCreateBackend();
});

backendModalCloseBtn.addEventListener("click", () => {
  resetBackendForm();
});

backendModal.addEventListener("click", (event) => {
  if (event.target === backendModal) {
    resetBackendForm();
  }
});

backendCancelBtn.addEventListener("click", () => {
  resetBackendForm();
});

addClientBtn.addEventListener("click", () => {
  startCreateClient();
});

clientModalCloseBtn.addEventListener("click", () => {
  resetClientForm();
});

clientModal.addEventListener("click", (event) => {
  if (event.target === clientModal) {
    resetClientForm();
  }
});

clientCancelBtn.addEventListener("click", () => {
  resetClientForm();
});

addPolicyBtn.addEventListener("click", () => {
  startCreatePolicy();
});

policyModalCloseBtn.addEventListener("click", () => {
  resetPolicyForm();
});

policyModal.addEventListener("click", (event) => {
  if (event.target === policyModal) {
    resetPolicyForm();
  }
});

policyCancelBtn.addEventListener("click", () => {
  resetPolicyForm();
});

applyUsageLogFiltersBtn.addEventListener("click", () => {
  applyUsageLogFilters().catch(reportError);
});

resetUsageLogFiltersBtn.addEventListener("click", () => {
  resetUsageLogFilters().catch(reportError);
});

refreshUsageLogsBtn?.addEventListener("click", () => {
  refreshUsageLogs().catch(reportError);
});

applyEventFiltersBtn?.addEventListener("click", () => {
  applyEventFilters().catch(reportError);
});

resetEventFiltersBtn?.addEventListener("click", () => {
  resetEventFilters().catch(reportError);
});

refreshEventsBtn?.addEventListener("click", () => {
  refreshEvents().catch(reportError);
});

clearUsageLogsBtn.addEventListener("click", () => {
  clearUsageLogs().catch(reportError);
});

deleteUsageLogsBtn.addEventListener("click", () => {
  deleteFilteredUsageLogs().catch(reportError);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    if (state.ui.search.open && trapFocusWithin(searchModalRoot, event)) {
      return;
    }
    if (state.ui.drawer.open && trapFocusWithin(drawerRoot, event)) {
      return;
    }
  }

  if (typeof SearchUtils.isSearchShortcut === "function" && SearchUtils.isSearchShortcut(event)) {
    event.preventDefault();
    openSearchShell();
    return;
  }

  if (typeof SearchUtils.isSearchDismissKey === "function" && SearchUtils.isSearchDismissKey(event)) {
    if (state.ui.search.open) {
      event.preventDefault();
      closeSearchShell();
      return;
    }
    if (state.ui.drawer.open) {
      closeDrawerShell();
    }
  }
});

if (systemThemeQuery) {
  const handleSystemThemeChange = () => {
    if (state.ui.themePreference === "system") {
      applyResolvedTheme();
      renderTheme();
    }
  };
  if (typeof systemThemeQuery.addEventListener === "function") {
    systemThemeQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof systemThemeQuery.addListener === "function") {
    systemThemeQuery.addListener(handleSystemThemeChange);
  }
}

[usageLogQueryFilter, usageLogDateFromFilter, usageLogDateToFilter, usageLogBackendFilter, usageLogModelFilter, usageLogClientKeyFilter, usageLogPolicyFilter, usageLogProxyFilter, usageLogStatusFilter].forEach((input) => {
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyUsageLogFilters().catch(reportError);
    }
  });
});

[eventQueryFilter, eventActorFilter, eventBackendFilter, eventCategoryFilter, eventSeverityFilter, eventDateFromFilter, eventDateToFilter].forEach((input) => {
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyEventFilters().catch(reportError);
    }
  });
});

proxyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingProxyID !== null;
    const data = readForm(event.currentTarget);
    data.enabled = Boolean(data.enabled);

    const path = editing ? `/admin/api/socks-proxies/${state.editingProxyID}` : "/admin/api/socks-proxies";
    const method = editing ? "PUT" : "POST";
    await api(path, method, data);
    resetProxyForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

backendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingBackendID !== null;
    const data = readForm(event.currentTarget);
    data.models = splitList(data.models);
    data.model_mapping = parseModelMapping(data.model_mapping);
    data.endpoints = splitList(data.endpoints);
    data.weight = Number(data.weight || 1);
    data.proxy_id = Number(data.proxy_id || 0);
    data.enabled = Boolean(data.enabled);

    if (!editing && !String(data.api_key || "").trim()) {
      throw new Error("新增 Backend 必须填写 API key");
    }

    const path = editing ? `/admin/api/backends/${state.editingBackendID}` : "/admin/api/backends";
    const method = editing ? "PUT" : "POST";
    await api(path, method, data);
    resetBackendForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingClientID !== null;
    const data = readForm(event.currentTarget);
    data.enabled = Boolean(data.enabled);

    const path = editing ? `/admin/api/client-keys/${state.editingClientID}` : "/admin/api/client-keys";
    const method = editing ? "PUT" : "POST";
    const response = await api(path, method, data);

    if (response.issued_token) {
      alert(`Issued token: ${response.issued_token}`);
    }
    resetClientForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

policyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingPolicyID !== null;
    const data = readForm(event.currentTarget);
    data.priority = Number(data.priority || 100);
    data.failover_enabled = Boolean(data.failover_enabled);

    const path = editing ? `/admin/api/model-policies/${state.editingPolicyID}` : "/admin/api/model-policies";
    const method = editing ? "PUT" : "POST";
    await api(path, method, data);
    resetPolicyForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

async function refreshAll() {
  startDashboardLoading();
  renderDashboardShell();
  const dashboardRefresh = refreshDashboardData().catch(reportError);

  const eventPage = state.pagination.events;
  const usageLogPage = state.pagination.usageLogs;
  const usageLogQuery = buildUsageLogQuery();
  const eventQuery = buildEventQuery();
  const [proxies, backends, clients, policies, events, eventSummary, usageLogs, usageLogStats, usageLogOptions] = await Promise.all([
    fetchAllCollectionPages("/admin/api/socks-proxies"),
    fetchAllCollectionPages("/admin/api/backends"),
    fetchAllCollectionPages("/admin/api/client-keys"),
    fetchAllCollectionPages("/admin/api/model-policies"),
    api(`/admin/api/events?page=${eventPage.page}&limit=${eventPage.size}${eventQuery}`),
    api(`/admin/api/events/summary?${buildEventSummaryQuery()}`),
    api(`/admin/api/usage-logs?page=${usageLogPage.page}&limit=${usageLogPage.size}${usageLogQuery}`),
    api(`/admin/api/usage-logs/stats?${buildUsageLogStatsQuery()}`),
    api("/admin/api/usage-log-options"),
  ]);

  state.proxies = ensureArray(proxies);
  state.backends = ensureArray(backends);
  state.clients = ensureArray(clients);
  state.policies = ensureArray(policies);
  applyPagedResponse("events", events);
  applyPagedResponse("usageLogs", usageLogs);
  state.eventSummary = eventSummary;
  state.usageLogStats = usageLogStats;
  state.usageLogOptions.backends = ensureArray(usageLogOptions?.backends);
  state.usageLogOptions.models = ensureArray(usageLogOptions?.models);
  state.usageLogOptions.clientKeys = ensureArray(usageLogOptions?.client_keys);
  state.usageLogOptions.policies = ensureArray(usageLogOptions?.policies);
  state.usageLogOptions.proxies = ensureArray(usageLogOptions?.proxies);
  state.ui.lastRefreshAt = new Date().toISOString();

  renderProxyOptions();
  renderUsageLogFilterOptions();
  renderProxies();
  renderBackends();
  renderClients();
  renderPolicies();
  renderEvents();
  renderUsageLogs();
  renderDashboardShell();
  renderDrawerShell();
  renderSearchShell();
  renderTheme();
  await dashboardRefresh;
}

function buildUsageLogQuery() {
  const query = typeof ObservabilityUtils.buildUsageLogQueryParams === "function"
    ? ObservabilityUtils.buildUsageLogQueryParams(state.usageLogFilters)
    : "";
  return query ? `&${query}` : "";
}

function buildUsageLogStatsQuery() {
  return typeof ObservabilityUtils.buildUsageLogQueryParams === "function"
    ? ObservabilityUtils.buildUsageLogQueryParams(state.usageLogFilters)
    : "";
}

function buildEventQuery() {
  const query = typeof ObservabilityUtils.buildEventQueryParams === "function"
    ? ObservabilityUtils.buildEventQueryParams(state.eventFilters)
    : "";
  return query ? `&${query}` : "";
}

function buildEventSummaryQuery() {
  const query = buildEventQuery();
  return query.startsWith("&") ? query.slice(1) : query;
}

function syncEventFilterInputs() {
  if (eventQueryFilter) {
    eventQueryFilter.value = state.eventFilters.q;
  }
  if (eventActorFilter) {
    eventActorFilter.value = state.eventFilters.actor;
  }
  if (eventBackendFilter) {
    eventBackendFilter.value = state.eventFilters.backend;
  }
  if (eventCategoryFilter) {
    eventCategoryFilter.value = state.eventFilters.category;
  }
  if (eventSeverityFilter) {
    eventSeverityFilter.value = state.eventFilters.severity;
  }
  if (eventDateFromFilter) {
    eventDateFromFilter.value = state.eventFilters.dateFrom;
  }
  if (eventDateToFilter) {
    eventDateToFilter.value = state.eventFilters.dateTo;
  }
}

async function applyEventFilters() {
  state.eventFilters.q = String(eventQueryFilter?.value || "").trim();
  state.eventFilters.actor = String(eventActorFilter?.value || "").trim();
  state.eventFilters.backend = String(eventBackendFilter?.value || "").trim();
  state.eventFilters.category = String(eventCategoryFilter?.value || "").trim();
  state.eventFilters.severity = String(eventSeverityFilter?.value || "").trim();
  state.eventFilters.dateFrom = String(eventDateFromFilter?.value || "").trim();
  state.eventFilters.dateTo = String(eventDateToFilter?.value || "").trim();
  state.pagination.events.page = 1;
  await refreshAll();
}

async function resetEventFilters() {
  state.eventFilters.q = "";
  state.eventFilters.actor = "";
  state.eventFilters.backend = "";
  state.eventFilters.category = "";
  state.eventFilters.severity = "";
  state.eventFilters.dateFrom = "";
  state.eventFilters.dateTo = "";
  syncEventFilterInputs();
  state.pagination.events.page = 1;
  await refreshAll();
}

async function refreshEvents() {
  await refreshAll();
}

function syncUsageLogFilterInputs() {
  if (usageLogQueryFilter) {
    usageLogQueryFilter.value = state.usageLogFilters.q;
  }
  if (usageLogDateFromFilter) {
    usageLogDateFromFilter.value = state.usageLogFilters.dateFrom;
  }
  if (usageLogDateToFilter) {
    usageLogDateToFilter.value = state.usageLogFilters.dateTo;
  }
  usageLogBackendFilter.value = state.usageLogFilters.backend;
  usageLogModelFilter.value = state.usageLogFilters.model;
  usageLogClientKeyFilter.value = state.usageLogFilters.clientKey;
  if (usageLogPolicyFilter) {
    usageLogPolicyFilter.value = state.usageLogFilters.policy;
  }
  if (usageLogProxyFilter) {
    usageLogProxyFilter.value = state.usageLogFilters.proxy;
  }
  if (usageLogStatusFilter) {
    usageLogStatusFilter.value = state.usageLogFilters.status;
  }
}

async function applyUsageLogFilters() {
  state.usageLogFilters.q = String(usageLogQueryFilter?.value || "").trim();
  state.usageLogFilters.dateFrom = String(usageLogDateFromFilter?.value || "").trim();
  state.usageLogFilters.dateTo = String(usageLogDateToFilter?.value || "").trim();
  state.usageLogFilters.backend = String(usageLogBackendFilter.value || "").trim();
  state.usageLogFilters.model = String(usageLogModelFilter.value || "").trim();
  state.usageLogFilters.clientKey = String(usageLogClientKeyFilter.value || "").trim();
  state.usageLogFilters.policy = String(usageLogPolicyFilter?.value || "").trim();
  state.usageLogFilters.proxy = String(usageLogProxyFilter?.value || "").trim();
  state.usageLogFilters.status = String(usageLogStatusFilter?.value || "").trim();
  state.pagination.usageLogs.page = 1;
  await refreshAll();
}

async function resetUsageLogFilters() {
  state.usageLogFilters.q = "";
  state.usageLogFilters.dateFrom = "";
  state.usageLogFilters.dateTo = "";
  state.usageLogFilters.backend = "";
  state.usageLogFilters.model = "";
  state.usageLogFilters.clientKey = "";
  state.usageLogFilters.policy = "";
  state.usageLogFilters.proxy = "";
  state.usageLogFilters.status = "";
  syncUsageLogFilterInputs();
  state.pagination.usageLogs.page = 1;
  await refreshAll();
}

async function refreshUsageLogs() {
  await refreshAll();
}

async function clearUsageLogs() {
  if (!confirm("确认清空所有使用日志？")) {
    return;
  }
  const response = await api("/admin/api/usage-logs", "DELETE");
  state.pagination.usageLogs.page = 1;
  await refreshAll();
  alert(`已清空 ${Number(response?.deleted || 0)} 条使用日志。`);
}

async function deleteFilteredUsageLogs() {
  if (!buildUsageLogStatsQuery()) {
    throw new Error("请先设置查询条件，再删除查询结果");
  }
  if (!confirm("确认删除当前查询条件命中的使用日志？")) {
    return;
  }
  const response = await api(`/admin/api/usage-logs?${buildUsageLogDeleteQuery()}`, "DELETE");
  state.pagination.usageLogs.page = 1;
  await refreshAll();
  alert(`已删除 ${Number(response?.deleted || 0)} 条符合条件的使用日志。`);
}

function buildUsageLogDeleteQuery() {
  return buildUsageLogStatsQuery();
}

function renderUsageLogFilterOptions() {
  renderDatalist(usageLogBackendOptions, state.usageLogOptions.backends);
  renderDatalist(usageLogModelOptions, state.usageLogOptions.models);
  renderDatalist(usageLogClientKeyOptions, state.usageLogOptions.clientKeys);
  renderDatalist(usageLogPolicyOptions, state.usageLogOptions.policies);
  renderDatalist(usageLogProxyOptions, state.usageLogOptions.proxies);
}

async function refreshDashboardData() {
  const usageRange = state.dashboard.usage.range || "7d";
  const requests = [
    api("/admin/api/dashboard/summary")
      .then((payload) => {
        if (typeof DashboardUtils.applyDashboardSummaryPayload === "function") {
          DashboardUtils.applyDashboardSummaryPayload(state.dashboard, payload);
          return;
        }
        const cards = typeof DashboardUtils.createDashboardSummaryCards === "function"
          ? DashboardUtils.createDashboardSummaryCards(payload)
          : [];
        const cardsByKey = cards.reduce((accumulator, card) => {
          accumulator[card.key] = card;
          return accumulator;
        }, {});
        Object.entries(state.dashboard.summaryCards || {}).forEach(([key, cardState]) => {
          cardState.data = cardsByKey[key] || null;
          cardState.error = "";
          cardState.status = cardState.data ? "ready" : "empty";
        });
      })
      .catch((error) => {
        if (typeof DashboardUtils.applyDashboardSummaryError === "function") {
          DashboardUtils.applyDashboardSummaryError(state.dashboard, error?.message || "Failed to load summary");
          return;
        }
        Object.values(state.dashboard.summaryCards || {}).forEach((cardState) => {
          cardState.status = "failed";
          cardState.error = error?.message || "Failed to load summary";
          cardState.data = null;
        });
      })
      .finally(() => {
        renderDashboardShell();
      }),
    api(`/admin/api/dashboard/usage?range=${encodeURIComponent(usageRange)}`)
      .then((payload) => {
        state.dashboard.usage.status = "ready";
        state.dashboard.usage.data = typeof DashboardUtils.createDashboardUsageState === "function"
          ? DashboardUtils.createDashboardUsageState(payload)
          : null;
        state.dashboard.usage.error = "";
      })
      .catch((error) => {
        state.dashboard.usage.status = "failed";
        state.dashboard.usage.error = error?.message || "Failed to load usage";
        state.dashboard.usage.data = null;
      })
      .finally(() => {
        if (state.dashboard.usage.status === "ready" && !(state.dashboard.usage.data?.points || []).length) {
          state.dashboard.usage.status = "empty";
        }
        renderDashboardShell();
      }),
    api("/admin/api/dashboard/activity")
      .then((payload) => {
        if (typeof DashboardUtils.applyDashboardActivityPayload === "function") {
          DashboardUtils.applyDashboardActivityPayload(state.dashboard, payload);
          return;
        }
        const activityState = typeof DashboardUtils.createDashboardActivityState === "function"
          ? DashboardUtils.createDashboardActivityState(payload)
          : { counters: [], events: [], usage: [] };
        state.dashboard.eventsSummary.data = activityState.counters;
        state.dashboard.eventsSummary.error = "";
        state.dashboard.eventsSummary.status = (activityState.counters || []).some((item) => Number(item.count) > 0) ? "ready" : "empty";
        state.dashboard.recentEvents.data = activityState.events;
        state.dashboard.recentEvents.error = "";
        state.dashboard.recentEvents.status = (activityState.events || []).length ? "ready" : "empty";
        state.dashboard.recentUsage.data = activityState.usage;
        state.dashboard.recentUsage.error = "";
        state.dashboard.recentUsage.status = (activityState.usage || []).length ? "ready" : "empty";
      })
      .catch((error) => {
        if (typeof DashboardUtils.applyDashboardActivityError === "function") {
          DashboardUtils.applyDashboardActivityError(state.dashboard, error?.message || "Failed to load activity");
          return;
        }
        [state.dashboard.eventsSummary, state.dashboard.recentEvents, state.dashboard.recentUsage].forEach((panelState) => {
          panelState.status = "failed";
          panelState.error = error?.message || "Failed to load activity";
          panelState.data = null;
        });
      })
      .finally(() => {
        renderDashboardShell();
      }),
  ];

  await Promise.allSettled(requests);
}

function startDashboardLoading() {
  Object.values(state.dashboard.summaryCards || {}).forEach((cardState) => {
    cardState.status = "loading";
    cardState.error = "";
    cardState.data = null;
  });
  state.dashboard.usage.status = "loading";
  state.dashboard.usage.error = "";
  state.dashboard.usage.data = null;
  [state.dashboard.eventsSummary, state.dashboard.recentEvents, state.dashboard.recentUsage].forEach((panelState) => {
    panelState.status = "loading";
    panelState.error = "";
    panelState.data = null;
  });
}

function pageIDFromHash() {
  const id = window.location.hash.slice(1);
  return pages.some((page) => page.id === id) ? id : "overview";
}

function activatePage(id) {
  const nextID = pages.some((page) => page.id === id) ? id : "overview";
  for (const page of pages) {
    page.classList.toggle("active", page.id === nextID);
  }
  for (const link of pageLinks) {
    link.classList.toggle("active", link.dataset.pageLink === nextID);
  }

  const activePage = pages.find((page) => page.id === nextID);
  if (activePage) {
    pageTitle.textContent = activePage.dataset.pageTitle || "透明代理控制台";
    pageBreadcrumb.textContent = activePage.dataset.pageBreadcrumb || "Dashboard";
  }
}

function navigateToPage(id) {
  const nextID = pages.some((page) => page.id === id) ? id : "overview";
  if (window.location.hash !== `#${nextID}`) {
    window.location.hash = `#${nextID}`;
    return;
  }
  activatePage(nextID);
}

function initializeThemeState() {
  const storedPreference = localStorage.getItem(THEME_PREFERENCE_KEY);
  const resolved = resolveThemeState(storedPreference);
  state.ui.themePreference = resolved.preference;
  state.ui.theme = resolved.theme;
  rootElement.dataset.themePreference = resolved.preference;
  rootElement.dataset.theme = resolved.theme;
}

function resolveThemeState(storedPreference) {
  if (typeof ThemeUtils.resolveThemeState === "function") {
    return ThemeUtils.resolveThemeState({
      storedPreference,
      systemPrefersDark: Boolean(systemThemeQuery?.matches),
    });
  }
  return {
    preference: "system",
    theme: systemThemeQuery?.matches ? "dark" : "light",
    isAuto: true,
  };
}

function persistThemePreference(preference) {
  if (preference === "system") {
    localStorage.removeItem(THEME_PREFERENCE_KEY);
    return;
  }
  localStorage.setItem(THEME_PREFERENCE_KEY, preference);
}

function applyResolvedTheme() {
  const resolved = resolveThemeState(state.ui.themePreference);
  state.ui.themePreference = resolved.preference;
  state.ui.theme = resolved.theme;
}

function renderTheme() {
  rootElement.dataset.theme = state.ui.theme;
  rootElement.dataset.themePreference = state.ui.themePreference;
  appShell?.setAttribute("data-theme", state.ui.theme);
  if (themeToggleBtn) {
    const buttonState = typeof ThemeUtils.getThemeToggleState === "function"
      ? ThemeUtils.getThemeToggleState({
        preference: state.ui.themePreference,
        theme: state.ui.theme,
      })
      : {
        label: state.ui.theme,
        hint: "Switch theme mode",
        pressed: state.ui.theme === "dark",
      };
    if (themeToggleLabel) {
      themeToggleLabel.textContent = buttonState.label;
    } else {
      themeToggleBtn.textContent = buttonState.label;
    }
    themeToggleBtn.title = buttonState.hint;
    if (buttonState.pressed === "mixed") {
      themeToggleBtn.setAttribute("aria-pressed", "mixed");
    } else {
      themeToggleBtn.setAttribute("aria-pressed", String(Boolean(buttonState.pressed)));
    }
  }
  renderSettings();
}

function renderSettings() {
  if (!settingsRoot) {
    return;
  }
  const viewModel = typeof SettingsUtils.createSettingsViewModel === "function"
    ? SettingsUtils.createSettingsViewModel(buildSettingsSnapshot())
    : null;
  if (!viewModel) {
    settingsRoot.innerHTML = "";
    return;
  }
  settingsRoot.innerHTML = typeof SettingsUtils.renderSettingsPage === "function"
    ? SettingsUtils.renderSettingsPage(viewModel)
    : "";
}

function buildSettingsSnapshot() {
  return {
    adminTokenPresent: Boolean((localStorage.getItem(ADMIN_TOKEN_KEY) || "").trim()),
    themePreference: state.ui.themePreference,
    resolvedTheme: state.ui.theme,
    sidebarCollapsed: appShell?.classList.contains("sidebar-collapsed"),
    lastRefreshLabel: state.ui.lastRefreshAt ? formatDateTime(state.ui.lastRefreshAt) : "",
    backends: state.backends,
    clients: state.clients,
    policies: state.policies,
    proxies: state.proxies,
    usageLogStats: state.usageLogStats,
    usageLogMeta: state.paginationMeta.usageLogs,
    eventSummary: state.eventSummary,
  };
}

async function handleSettingsAction(action) {
  const normalized = String(action || "").trim();
  if (!normalized) {
    return;
  }
  if (normalized === "focus-token") {
    tokenInput?.focus();
    return;
  }
  if (normalized === "refresh-data") {
    await refreshAll();
    return;
  }
  if (normalized === "cycle-theme") {
    cycleThemePreference();
    return;
  }
  if (normalized === "toggle-sidebar") {
    toggleSidebarCollapsed();
    return;
  }
  if (normalized === "open-search") {
    openSearchShell();
    return;
  }
  if (normalized === "view-usage-logs") {
    navigateToPage("usage-logs");
    return;
  }
  if (normalized === "view-events") {
    navigateToPage("events");
    return;
  }
  if (normalized === "open-backends") {
    navigateToPage("backends");
    return;
  }
  if (normalized === "open-policies") {
    navigateToPage("model-policies");
  }
}

function renderDashboardShell() {
  if (!dashboardRoot) {
    return;
  }
  dashboardRoot.dataset.theme = state.ui.theme;
  if (dashboardSummaryRow) {
    dashboardSummaryRow.innerHTML = renderDashboardSummaryRow();
  }
  if (dashboardUsageCard) {
    dashboardUsageCard.innerHTML = renderDashboardUsageCard();
  }
  if (dashboardEventsSummaryCard) {
    dashboardEventsSummaryCard.innerHTML = renderDashboardEventsSummaryCard();
  }
  if (dashboardRecentEventsCard) {
    dashboardRecentEventsCard.innerHTML = renderDashboardRecentEventsCard();
  }
  if (dashboardRecentUsageCard) {
    dashboardRecentUsageCard.innerHTML = renderDashboardRecentUsageCard();
  }
  bindDashboardInteractions();
}

function renderDrawerShell() {
  if (!drawerRoot) {
    return;
  }
  const isOpen = Boolean(state.ui.drawer.open);
  drawerRoot.classList.toggle("hidden", !isOpen);
  drawerRoot.setAttribute("aria-hidden", String(!isOpen));
  if (drawerTitle) {
    const detailTitle = state.ui.drawer.title || drawerDisplayTitle(state.ui.drawer.kind);
    drawerTitle.textContent = detailTitle ? `${detailTitle} Detail` : "Detail Drawer";
  }
  renderDrawerTabs();
  renderDrawerBody();
  renderDrawerFooter();
}

function closeDrawerShell() {
  const previousTrigger = state.ui.drawer.triggerElement;
  state.ui.drawer.open = false;
  state.ui.drawer.kind = "";
  state.ui.drawer.id = null;
  state.ui.drawer.title = "";
  state.ui.drawer.tab = "overview";
  state.ui.drawer.loading = false;
  state.ui.drawer.data = null;
  state.ui.drawer.error = "";
  state.ui.drawer.detailPath = "";
  state.ui.drawer.deletePath = "";
  state.ui.drawer.page = "";
  state.ui.drawer.triggerElement = null;
  renderDrawerShell();
  if (previousTrigger instanceof HTMLElement) {
    previousTrigger.focus();
  }
}

function renderSearchShell() {
  if (!searchModalRoot) {
    return;
  }
  const isOpen = Boolean(state.ui.search.open);
  searchModalRoot.classList.toggle("hidden", !isOpen);
  searchModalRoot.setAttribute("aria-hidden", String(!isOpen));
  searchOpenBtn?.setAttribute("aria-expanded", String(isOpen));
  if (searchOpenBtn && searchOpenBtn.value !== state.ui.search.query) {
    searchOpenBtn.value = state.ui.search.query;
  }
  if (searchInput && searchInput.value !== state.ui.search.query) {
    searchInput.value = state.ui.search.query;
  }
  if (searchResultsRoot) {
    searchResultsRoot.innerHTML = renderSearchResults();
  }
}

function renderDashboardSummaryRow() {
  if (typeof DashboardViewUtils.renderDashboardSummaryRow === "function") {
    return DashboardViewUtils.renderDashboardSummaryRow({
      dashboard: state.dashboard,
      renderSparkline,
      escapeHTML,
    });
  }
  return "";
}

function renderDashboardUsageCard() {
  if (typeof DashboardViewUtils.renderDashboardUsageCard === "function") {
    return DashboardViewUtils.renderDashboardUsageCard({
      dashboard: state.dashboard,
      createDashboardRangeOptions: DashboardUtils.createDashboardRangeOptions,
      renderAreaChart,
      escapeHTML,
    });
  }
  return "";
}

function renderDashboardEventsSummaryCard() {
  if (typeof DashboardViewUtils.renderDashboardEventsSummaryCard === "function") {
    return DashboardViewUtils.renderDashboardEventsSummaryCard({
      dashboard: state.dashboard,
      escapeHTML,
    });
  }
  return "";
}

function renderDashboardRecentEventsCard() {
  if (typeof DashboardViewUtils.renderDashboardRecentEventsCard === "function") {
    return DashboardViewUtils.renderDashboardRecentEventsCard({
      dashboard: state.dashboard,
      formatDateTime,
      escapeHTML,
      feedToneClass,
    });
  }
  return "";
}

function renderDashboardRecentUsageCard() {
  if (typeof DashboardViewUtils.renderDashboardRecentUsageCard === "function") {
    return DashboardViewUtils.renderDashboardRecentUsageCard({
      dashboard: state.dashboard,
      formatDateTime,
      escapeHTML,
    });
  }
  return "";
}

function renderSparkline(values, { width, height, padding, className = "" }) {
  const points = typeof ChartsUtils.createSparklinePoints === "function"
    ? ChartsUtils.createSparklinePoints(values, { width, height, padding })
    : [];
  if (points.length === 0) {
    return `<div class="dashboard-chart-empty">No trend</div>`;
  }
  const linePath = typeof ChartsUtils.createLinePath === "function" ? ChartsUtils.createLinePath(points) : "";
  const areaPath = typeof ChartsUtils.createAreaPath === "function" ? ChartsUtils.createAreaPath(points, { height, padding }) : "";
  return `
    <svg class="${escapeHTML(className)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend sparkline">
      <path class="sparkline-area" d="${escapeHTML(areaPath)}"></path>
      <path class="sparkline-line" d="${escapeHTML(linePath)}"></path>
    </svg>
  `;
}

function renderAreaChart(values, labels, { width, height, padding }) {
  const points = typeof ChartsUtils.createSparklinePoints === "function"
    ? ChartsUtils.createSparklinePoints(values, { width, height, padding })
    : [];
  if (points.length === 0) {
    return `<div class="dashboard-chart-empty">No chart data</div>`;
  }
  const linePath = typeof ChartsUtils.createLinePath === "function" ? ChartsUtils.createLinePath(points) : "";
  const areaPath = typeof ChartsUtils.createAreaPath === "function" ? ChartsUtils.createAreaPath(points, { height, padding }) : "";
  return `
    <div class="dashboard-area-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Usage overview chart">
        <defs>
          <linearGradient id="usageAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.28"></stop>
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.02"></stop>
          </linearGradient>
        </defs>
        <path class="usage-area-path" d="${escapeHTML(areaPath)}"></path>
        <path class="usage-line-path" d="${escapeHTML(linePath)}"></path>
        ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.2"></circle>`).join("")}
      </svg>
      <div class="dashboard-chart-axis">
        ${labels.map((label) => `<span>${escapeHTML(label)}</span>`).join("")}
      </div>
    </div>
  `;
}

function usageValueForMetric(point, metric) {
  if (metric === "traffic") {
    return Number(point?.trafficBytes) || 0;
  }
  if (metric === "errors") {
    return (Number(point?.errorRate) || 0) * 100;
  }
  return Number(point?.requests) || 0;
}

function bindDashboardInteractions() {
  dashboardRoot?.querySelectorAll("[data-dashboard-range]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextRange = button.dataset.dashboardRange || "7d";
      if (state.dashboard.usage.range === nextRange) {
        return;
      }
      state.dashboard.usage.range = nextRange;
      refreshDashboardUsagePanel().catch(reportError);
    });
  });

  dashboardRoot?.querySelectorAll("[data-dashboard-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dashboard.usage.metric = button.dataset.dashboardMetric || "requests";
      renderDashboardShell();
    });
  });

  dashboardRoot?.querySelectorAll("[data-dashboard-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.dashboardRetry || "";
      retryDashboardSection(target).catch(reportError);
    });
  });
}

async function refreshDashboardUsagePanel() {
  state.dashboard.usage.status = "loading";
  state.dashboard.usage.error = "";
  state.dashboard.usage.data = null;
  renderDashboardShell();
  try {
    const payload = await api(`/admin/api/dashboard/usage?range=${encodeURIComponent(state.dashboard.usage.range)}`);
    state.dashboard.usage.data = typeof DashboardUtils.createDashboardUsageState === "function"
      ? DashboardUtils.createDashboardUsageState(payload)
      : null;
    state.dashboard.usage.status = (state.dashboard.usage.data?.points || []).length ? "ready" : "empty";
    state.dashboard.usage.error = "";
  } catch (error) {
    state.dashboard.usage.status = "failed";
    state.dashboard.usage.error = error?.message || "Failed to load usage";
    state.dashboard.usage.data = null;
  }
  renderDashboardShell();
}

async function retryDashboardSection(target) {
  if (target.startsWith("summary:")) {
    const targetKey = target.slice("summary:".length);
    const cardState = state.dashboard.summaryCards?.[targetKey];
    if (!cardState) {
      return;
    }
    cardState.status = "loading";
    cardState.error = "";
    cardState.data = null;
    renderDashboardShell();
    try {
      const payload = await api("/admin/api/dashboard/summary");
      if (typeof DashboardUtils.applyDashboardSummaryPayload === "function") {
        DashboardUtils.applyDashboardSummaryPayload(state.dashboard, payload, targetKey);
      } else {
        const cards = DashboardUtils.createDashboardSummaryCards(payload);
        const cardsByKey = cards.reduce((accumulator, card) => {
          accumulator[card.key] = card;
          return accumulator;
        }, {});
        cardState.data = cardsByKey[targetKey] || null;
        cardState.error = "";
        cardState.status = cardState.data ? "ready" : "empty";
      }
    } catch (error) {
      if (typeof DashboardUtils.applyDashboardSummaryError === "function") {
        DashboardUtils.applyDashboardSummaryError(state.dashboard, error?.message || "Failed to load summary", targetKey);
      } else {
        cardState.status = "failed";
        cardState.error = error?.message || "Failed to load summary";
        cardState.data = null;
      }
    }
    renderDashboardShell();
    return;
  }
  if (target === "usage") {
    state.dashboard.usage.status = "loading";
    renderDashboardShell();
    try {
      const payload = await api(`/admin/api/dashboard/usage?range=${encodeURIComponent(state.dashboard.usage.range)}`);
      state.dashboard.usage.data = DashboardUtils.createDashboardUsageState(payload);
      state.dashboard.usage.status = (state.dashboard.usage.data?.points || []).length ? "ready" : "empty";
      state.dashboard.usage.error = "";
    } catch (error) {
      state.dashboard.usage.status = "failed";
      state.dashboard.usage.error = error?.message || "Failed to load usage";
    }
    renderDashboardShell();
    return;
  }
  if (target.startsWith("activity:")) {
    const targetKey = target.slice("activity:".length);
    const panelState = state.dashboard[targetKey];
    if (!panelState) {
      return;
    }
    panelState.status = "loading";
    panelState.error = "";
    panelState.data = null;
    renderDashboardShell();
    try {
      const payload = await api("/admin/api/dashboard/activity");
      if (typeof DashboardUtils.applyDashboardActivityPayload === "function") {
        DashboardUtils.applyDashboardActivityPayload(state.dashboard, payload, targetKey);
      } else {
        const activityData = DashboardUtils.createDashboardActivityState(payload);
        if (targetKey === "eventsSummary") {
          panelState.data = activityData.counters;
          panelState.error = "";
          panelState.status = (activityData.counters || []).some((item) => Number(item.count) > 0) ? "ready" : "empty";
        }
        if (targetKey === "recentEvents") {
          panelState.data = activityData.events;
          panelState.error = "";
          panelState.status = (activityData.events || []).length ? "ready" : "empty";
        }
        if (targetKey === "recentUsage") {
          panelState.data = activityData.usage;
          panelState.error = "";
          panelState.status = (activityData.usage || []).length ? "ready" : "empty";
        }
      }
    } catch (error) {
      if (typeof DashboardUtils.applyDashboardActivityError === "function") {
        DashboardUtils.applyDashboardActivityError(state.dashboard, error?.message || "Failed to load activity", targetKey);
      } else {
        panelState.status = "failed";
        panelState.error = error?.message || "Failed to load activity";
        panelState.data = null;
      }
    }
    renderDashboardShell();
    return;
  }
  startDashboardLoading();
  renderDashboardShell();
  await refreshDashboardData();
}

function feedToneClass(tone) {
  if (tone === "danger") {
    return "off";
  }
  if (tone === "warning") {
    return "";
  }
  return "ok";
}

function closeSearchShell() {
  const previousTrigger = state.ui.search.triggerElement;
  state.ui.search.open = false;
  searchDebounce?.cancel?.();
  state.ui.search.activeIndex = -1;
  renderSearchShell();
  if (previousTrigger instanceof HTMLElement) {
    previousTrigger.focus();
  }
}

function openSearchShell() {
  state.ui.search.triggerElement = document.activeElement instanceof HTMLElement ? document.activeElement : searchOpenBtn;
  state.ui.search.open = true;
  renderSearchShell();
  if (searchInput) {
    searchInput.focus();
  } else {
    searchModalPanel?.focus();
  }
  if (state.ui.search.query.trim()) {
    searchInput?.select();
    if (!state.ui.search.results.total && !state.ui.search.loading) {
      triggerSearch();
    }
  }
}

function updateSearchQuery(value) {
  state.ui.search.query = String(value || "");
  if (!state.ui.search.query.trim()) {
    searchDebounce?.cancel?.();
    const clearedSequence = typeof SearchUtils.nextSearchSequence === "function"
      ? SearchUtils.nextSearchSequence(Math.max(state.ui.search.requestSequence, state.ui.search.activeSequence))
      : Math.max(state.ui.search.requestSequence, state.ui.search.activeSequence) + 1;
    state.ui.search.requestSequence = clearedSequence;
    state.ui.search.activeSequence = clearedSequence;
    state.ui.search.loading = false;
    state.ui.search.activeIndex = -1;
    state.ui.search.results = {
      query: "",
      total: 0,
      groups: [],
    };
    return;
  }
  triggerSearch();
}

function triggerSearch() {
  const request = typeof SearchUtils.createSearchRequest === "function"
    ? SearchUtils.createSearchRequest(state.ui.search.query, state.ui.search.requestSequence)
    : {
      sequence: (Number(state.ui.search.requestSequence) || 0) + 1,
      query: String(state.ui.search.query || "").trim(),
    };
  state.ui.search.requestSequence = request.sequence;
  state.ui.search.activeSequence = request.sequence;
  if (!searchDebounce) {
    executeSearch(request).catch(reportError);
    return;
  }
  state.ui.search.loading = true;
  renderSearchShell();
  searchDebounce(request);
}

async function executeSearch(request) {
  const requestID = Number(request?.sequence) || 0;
  const trimmedQuery = String(request?.query || "").trim();
  if (!trimmedQuery) {
    state.ui.search.loading = false;
    state.ui.search.activeIndex = -1;
    state.ui.search.results = {
      query: "",
      total: 0,
      groups: [],
    };
    renderSearchShell();
    return;
  }

  state.ui.search.loading = true;
  renderSearchShell();
  const path = typeof SearchUtils.buildSearchRequestPath === "function"
    ? SearchUtils.buildSearchRequestPath(trimmedQuery, SEARCH_LIMIT)
    : `/admin/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${SEARCH_LIMIT}`;
  try {
    const response = await api(path);
    if (requestID !== state.ui.search.activeSequence) {
      return;
    }
    state.ui.search.results = typeof SearchUtils.normalizeSearchResponse === "function"
      ? SearchUtils.normalizeSearchResponse(response)
      : { query: trimmedQuery, total: 0, groups: [] };
    const keyboardState = currentSearchKeyboardState();
    state.ui.search.activeIndex = keyboardState.activeIndex;
  } finally {
    if (requestID === state.ui.search.activeSequence) {
      state.ui.search.loading = false;
      renderSearchShell();
    }
  }
}

function renderSearchResults() {
  const query = state.ui.search.query.trim();
  const results = state.ui.search.results || { total: 0, groups: [] };
  const keyboardState = currentSearchKeyboardState();
  const activeItem = keyboardState.activeItem;

  if (!query) {
    return `
      <div class="search-empty-state">
        <strong>Search everything</strong>
        <p class="muted-text">按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 或 <kbd>⌘</kbd> + <kbd>K</kbd> 快速打开，支持资源与观测数据统一搜索。</p>
      </div>
    `;
  }

  if (state.ui.search.loading) {
    return `
      <div class="search-empty-state">
        <strong>Searching “${escapeHTML(query)}”</strong>
        <p class="muted-text">正在查询 backends、keys、policies、proxies、usage logs 与 events。</p>
      </div>
    `;
  }

  if (!results.total) {
    return `
      <div class="search-empty-state">
        <strong>No results</strong>
        <p class="muted-text">没有找到与 “${escapeHTML(query)}” 相关的结果。</p>
      </div>
    `;
  }

  return results.groups.map((group) => `
    <section class="search-result-group">
      <header class="search-result-group-head">
        <span>${escapeHTML(group.label)}</span>
        <small>${group.items.length}</small>
      </header>
      <div class="search-result-list">
        ${group.items.map((item, itemIndex) => `
          <button
            class="search-result-item ${activeItem && activeItem.groupKey === group.key && activeItem.itemIndex === itemIndex ? "active" : ""}"
            type="button"
            data-search-result="true"
            data-search-group="${escapeHTML(group.key)}"
            data-search-kind="${escapeHTML(item.kind)}"
            data-search-page="${escapeHTML(item.targetPage)}"
            data-search-id="${escapeHTML(item.targetId)}"
            data-search-title="${escapeHTML(item.title)}"
            data-search-index="${escapeHTML(String(itemIndex))}"
          >
            <span class="search-result-copy">
              <strong>${escapeHTML(item.title)}</strong>
              ${item.subtitle ? `<span>${escapeHTML(item.subtitle)}</span>` : ""}
            </span>
            <span class="search-result-meta">
              ${item.status ? `<em class="search-status-pill">${escapeHTML(item.status)}</em>` : ""}
              ${item.meta ? `<small>${escapeHTML(item.meta)}</small>` : ""}
            </span>
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");
}

async function fetchAllCollectionPages(basePath) {
  const firstPage = await api(`${basePath}?page=1&limit=50`);
  const items = ensureArray(firstPage?.items);
  const total = Number(firstPage?.total) || items.length;
  const limit = PAGE_SIZE_OPTIONS.includes(Number(firstPage?.limit)) ? Number(firstPage.limit) : 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages === 1) {
    return items;
  }

  const remaining = [];
  for (let page = 2; page <= totalPages; page += 1) {
    remaining.push(api(`${basePath}?page=${page}&limit=${limit}`));
  }
  const pages = await Promise.all(remaining);
  pages.forEach((payload) => {
    items.push(...ensureArray(payload?.items));
  });
  return items;
}

async function refreshResourceList(resourceKey) {
  if (resourceKey === "proxies") {
    state.proxies = await fetchAllCollectionPages("/admin/api/socks-proxies");
    renderProxies();
    return;
  }
  if (resourceKey === "backends") {
    state.backends = await fetchAllCollectionPages("/admin/api/backends");
    renderBackends();
    return;
  }
  if (resourceKey === "clients") {
    state.clients = await fetchAllCollectionPages("/admin/api/client-keys");
    renderClients();
    return;
  }
  if (resourceKey === "policies") {
    state.policies = await fetchAllCollectionPages("/admin/api/model-policies");
    renderPolicies();
  }
}

function navigateToSearchResult(payload) {
  const normalized = typeof SearchUtils.getSearchResultTarget === "function"
    ? SearchUtils.getSearchResultTarget(payload)
    : null;
  if (!normalized?.page) {
    return;
  }

  window.location.hash = `#${normalized.page}`;
  activatePage(normalized.page);
  closeSearchShell();
  openResourceDrawer({
    kind: normalized.drawer.kind || payload.group || "",
    page: normalized.page,
    id: normalized.drawer.id || payload.targetId || payload.id || null,
    title: normalized.drawer.title || payload.title || "",
  }).catch(reportError);
}

function currentSearchKeyboardState() {
  return typeof SearchUtils.createSearchKeyboardState === "function"
    ? SearchUtils.createSearchKeyboardState({
      results: state.ui.search.results,
      activeIndex: state.ui.search.activeIndex,
    })
    : { items: [], activeIndex: -1, activeItem: null };
}

function moveSearchSelection(delta) {
  const keyboardState = currentSearchKeyboardState();
  state.ui.search.activeIndex = typeof SearchUtils.moveSearchSelection === "function"
    ? SearchUtils.moveSearchSelection({
      currentIndex: keyboardState.activeIndex,
      delta,
      itemCount: keyboardState.items.length,
    })
    : -1;
  renderSearchShell();
}

async function openResourceDrawer(target) {
  const normalized = typeof DrawerUtils.buildDrawerTarget === "function"
    ? DrawerUtils.buildDrawerTarget(target)
    : null;
  if (!normalized) {
    return;
  }

  state.ui.drawer.open = true;
  state.ui.drawer.kind = normalized.kind;
  state.ui.drawer.id = normalized.id;
  state.ui.drawer.title = normalized.title;
  state.ui.drawer.page = normalized.page;
  state.ui.drawer.detailPath = normalized.detailPath;
  state.ui.drawer.deletePath = normalized.deletePath;
  state.ui.drawer.triggerElement = target?.triggerElement instanceof HTMLElement ? target.triggerElement : document.activeElement;
  state.ui.drawer.tab = "overview";
  state.ui.drawer.loading = true;
  state.ui.drawer.data = null;
  state.ui.drawer.error = "";
  renderDrawerShell();
  drawerPanel?.focus();

  try {
    const payload = await api(normalized.detailPath);
    state.ui.drawer.data = typeof DrawerUtils.normalizeDrawerPayload === "function"
      ? DrawerUtils.normalizeDrawerPayload(payload)
      : payload;
    state.ui.drawer.error = "";
  } catch (error) {
    state.ui.drawer.error = error?.message || "Failed to load detail";
    state.ui.drawer.data = null;
  } finally {
    state.ui.drawer.loading = false;
    renderDrawerShell();
  }
}

function renderDrawerTabs() {
  if (!drawerTabRoot) {
    return;
  }
  const tabs = typeof DrawerUtils.drawerTabsForResource === "function"
    ? DrawerUtils.drawerTabsForResource(state.ui.drawer.kind)
    : [];
  drawerTabRoot.innerHTML = tabs.map((tab) => `
    <button class="ghost-button ${tab.key === state.ui.drawer.tab ? "active" : ""}" type="button" data-drawer-tab="${escapeHTML(tab.key)}">
      ${escapeHTML(tab.label)}
    </button>
  `).join("");
  drawerTabRoot.querySelectorAll("[data-drawer-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui.drawer.tab = button.dataset.drawerTab || "overview";
      renderDrawerShell();
    });
  });
}

function renderDrawerBody() {
  if (!drawerBodyRoot) {
    return;
  }
  if (state.ui.drawer.loading) {
    drawerBodyRoot.innerHTML = `
      <div class="drawer-state">
        <strong>Loading detail</strong>
        <p class="muted-text">Fetching ${escapeHTML(drawerDisplayTitle(state.ui.drawer.kind))} detail.</p>
      </div>
    `;
    return;
  }
  if (state.ui.drawer.error) {
    drawerBodyRoot.innerHTML = `
      <div class="drawer-state drawer-state-error">
        <strong>Drawer unavailable</strong>
        <p class="muted-text">${escapeHTML(state.ui.drawer.error)}</p>
      </div>
    `;
    return;
  }
  const data = state.ui.drawer.data || {};
  const activeTab = state.ui.drawer.tab || "overview";
  drawerBodyRoot.innerHTML = renderDrawerTabPanel(activeTab, data[activeTab]);
}

function renderDrawerTabPanel(tab, value) {
  if (tab === "raw") {
    const raw = value == null ? {} : value;
    return `
      <div class="drawer-code-block">
        <pre>${escapeHTML(JSON.stringify(raw, null, 2))}</pre>
      </div>
    `;
  }

  if (tab === "request" || tab === "response") {
    const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const entries = Object.entries(objectValue);
    if (!entries.length) {
      return `<div class="drawer-state"><strong>No ${escapeHTML(tab)}</strong><p class="muted-text">This tab has no data yet.</p></div>`;
    }
    return `
      <div class="drawer-kv-grid">
        ${entries.map(([key, entryValue]) => `
          <article class="drawer-kv-card">
            <small>${escapeHTML(humanizeKey(key))}</small>
            <strong>${escapeHTML(formatDrawerValue(entryValue))}</strong>
          </article>
        `).join("")}
      </div>
    `;
  }

  if (tab === "activity") {
    const activity = value && typeof value === "object" ? value : {};
    const sections = typeof DrawerUtils.buildDrawerActivitySections === "function"
      ? DrawerUtils.buildDrawerActivitySections(activity).map((section) => renderDrawerActivitySection(section))
      : [];
    if (!sections.length) {
      return `<div class="drawer-state"><strong>No activity</strong><p class="muted-text">No related activity for this resource yet.</p></div>`;
    }
    return `<div class="drawer-section-stack">${sections.join("")}</div>`;
  }

  const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.entries(objectValue);
  if (!entries.length) {
    return `<div class="drawer-state"><strong>No ${escapeHTML(tab)}</strong><p class="muted-text">This tab has no data yet.</p></div>`;
  }

  return `
    <div class="drawer-kv-grid">
      ${entries.map(([key, entryValue]) => `
        <article class="drawer-kv-card">
          <small>${escapeHTML(humanizeKey(key))}</small>
          <strong>${escapeHTML(formatDrawerValue(entryValue))}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function renderDrawerActivitySection(section) {
  if (!section || !Array.isArray(section.items) || !section.items.length) {
    return "";
  }
  return `
    <section class="drawer-activity-section">
      <header>
        <strong>${escapeHTML(section.title || "Activity")}</strong>
        <span>${escapeHTML(String(section.count || section.items.length || 0))}</span>
      </header>
      <div class="drawer-activity-grid">
        ${section.items.slice(0, 8).map((item) => renderDrawerActivityCard(item)).join("")}
      </div>
    </section>
  `;
}

function renderDrawerActivityCard(item) {
  const chips = ensureArray(item?.chips).filter(Boolean);
  const meta = ensureArray(item?.meta).filter((entry) => entry && entry.label && entry.value);
  return `
    <article class="drawer-activity-card tone-${escapeHTML(item?.tone || "neutral")}">
      <div class="drawer-activity-card-top">
        <strong>${escapeHTML(item?.title || "-")}</strong>
        ${chips.length ? `
          <div class="drawer-activity-chip-row">
            ${chips.map((chip) => `<span class="drawer-activity-chip">${escapeHTML(chip)}</span>`).join("")}
          </div>
        ` : ""}
      </div>
      <p>${escapeHTML(item?.summary || "-")}</p>
      ${meta.length ? `
        <dl class="drawer-activity-meta">
          ${meta.map((entry) => `
            <div>
              <dt>${escapeHTML(entry.label)}</dt>
              <dd>${escapeHTML(formatDrawerActivityMetaValue(entry))}</dd>
            </div>
          `).join("")}
        </dl>
      ` : ""}
    </article>
  `;
}

function formatDrawerActivityMetaValue(entry) {
  if (!entry || typeof entry !== "object") {
    return "-";
  }
  if (entry.format === "datetime") {
    return formatDateTime(entry.value);
  }
  return String(entry.value || "-");
}

function renderDrawerFooter() {
  if (!drawerFooterRoot) {
    return;
  }
  if (!state.ui.drawer.open) {
    drawerFooterRoot.innerHTML = "";
    return;
  }
  const actions = typeof DrawerUtils.drawerFooterActions === "function"
    ? DrawerUtils.drawerFooterActions()
    : [
      { key: "edit", label: "Edit", tone: "ghost", disabled: false },
      { key: "delete", label: "Delete", tone: "danger", disabled: false },
      { key: "save", label: "Save", tone: "primary", disabled: true },
    ];
  const visibleActions = state.ui.drawer.kind === "usage_logs"
    ? [{ key: "save", label: "Save", tone: "primary", disabled: true }]
    : actions;
  drawerFooterRoot.innerHTML = visibleActions.map((action) => `
    <button
      class="${action.tone === "ghost" ? "ghost-button" : action.tone === "danger" ? "danger-button" : ""}"
      type="button"
      data-drawer-footer="${escapeHTML(action.key)}"
      ${action.disabled ? "disabled aria-disabled=\"true\" title=\"Read-only detail drawer\"" : ""}
    >
      ${escapeHTML(action.label)}
    </button>
  `).join("");
  drawerFooterRoot.querySelector('[data-drawer-footer="edit"]')?.addEventListener("click", () => {
    openDrawerEditor();
  });
  drawerFooterRoot.querySelector('[data-drawer-footer="delete"]')?.addEventListener("click", () => {
    deleteDrawerResource().catch(reportError);
  });
}

function openDrawerEditor() {
  const drawer = state.ui.drawer;
  if (drawer.kind === "backends") {
    closeDrawerShell();
    startEditBackend(drawer.id);
    return;
  }
  if (drawer.kind === "clients") {
    closeDrawerShell();
    startEditClient(drawer.id);
    return;
  }
  if (drawer.kind === "policies") {
    closeDrawerShell();
    startEditPolicy(drawer.id);
    return;
  }
  if (drawer.kind === "proxies") {
    closeDrawerShell();
    startEditProxy(drawer.id);
  }
}

async function deleteDrawerResource() {
  if (!state.ui.drawer.deletePath) {
    return;
  }
  if (!confirm(`确认删除 ${drawerDisplayTitle(state.ui.drawer.kind)}？`)) {
    return;
  }
  await api(state.ui.drawer.deletePath, "DELETE");
  closeDrawerShell();
  await refreshAll();
}

function drawerDisplayTitle(kind) {
  const titles = {
    backends: "Backend",
    clients: "Client Key",
    policies: "Policy",
    proxies: "Proxy",
  };
  return titles[kind] || "Resource";
}

function formatDrawerValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ") || "-";
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }
  return String(value);
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function trapFocusWithin(container, event) {
  if (!container || event.key !== "Tab") {
    return false;
  }

  const focusable = Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("hidden") && !element.closest(".hidden"));

  if (focusable.length === 0) {
    return false;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}

function renderProxies() {
  const proxies = state.proxies;
  const filtered = applyResourceView("proxies", proxies);
  const pageData = currentLocalPageData("proxies", filtered);
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "proxies",
    searchPlaceholder: "Search proxies",
    count: pageData.total,
  });

  proxyList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: emptyState(
      "还没有 SOCKS5 Proxy",
      "如果某些 Backend 需要固定出口代理，先在这里添加 SOCKS5 节点，再回到 Backend 里绑定。",
    ),
    headers: ["Proxy", "Status", "Bindings", "Traffic", "Latency", "Last Used", "Updated", "Actions"],
    rowsMarkup: pageData.items.map(renderProxyRow).join(""),
    paginationMarkup: renderPagination("proxies", pageData),
    escapeHTML,
  });

  proxyList.querySelectorAll("[data-toggle-proxy]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedProxies, button.dataset.toggleProxy);
      renderProxies();
    });
  });

  proxyList.querySelectorAll("[data-edit-proxy]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditProxy(button.dataset.editProxy);
    });
  });
  bindResourceRowOpen(proxyList, "proxy");

  proxyList.querySelectorAll("[data-delete-proxy]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 SOCKS5 Proxy？已绑定的 Backend 会自动改为直连。")) {
          return;
        }
        await api(`/admin/api/socks-proxies/${button.dataset.deleteProxy}`, "DELETE");
        if (String(state.editingProxyID) === button.dataset.deleteProxy) {
          resetProxyForm();
        }
        state.expandedProxies.delete(button.dataset.deleteProxy);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(proxyList, "proxies", renderProxies);
  bindResourceToolbar(proxyList, "proxies", { create: startCreateProxy });
}

function renderBackends() {
  const backends = state.backends;
  const filtered = applyResourceView("backends", backends);
  const pageData = currentLocalPageData("backends", filtered);
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
    count: pageData.total,
  });

  backendList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: emptyState(
      "还没有 Backend",
      "先配置至少一个 OpenAI 或 Claude/Anthropic 上游节点，之后模型路由和故障切换才会生效。",
    ),
    headers: ["Backend", "Routing", "Coverage", "Requests", "Avg Latency", "Last Used", "Recent 30m", "Actions"],
    rowsMarkup: pageData.items.map(renderBackendRow).join(""),
    paginationMarkup: renderPagination("backends", pageData),
    escapeHTML,
  });

  backendList.querySelectorAll("[data-toggle-backend]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedBackends, button.dataset.toggleBackend);
      renderBackends();
    });
  });

  backendList.querySelectorAll("[data-edit-backend]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditBackend(button.dataset.editBackend);
    });
  });
  bindResourceRowOpen(backendList, "backend");

  backendList.querySelectorAll("[data-delete-backend]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 Backend？")) {
          return;
        }
        await api(`/admin/api/backends/${button.dataset.deleteBackend}`, "DELETE");
        if (String(state.editingBackendID) === button.dataset.deleteBackend) {
          resetBackendForm();
        }
        state.expandedBackends.delete(button.dataset.deleteBackend);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(backendList, "backends", renderBackends);
  bindResourceToolbar(backendList, "backends", { create: startCreateBackend });
}

function renderClients() {
  const clients = state.clients;
  const filtered = applyResourceView("clients", clients);
  const pageData = currentLocalPageData("clients", filtered);
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "clients",
    searchPlaceholder: "Search client keys",
    count: pageData.total,
  });

  clientList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: emptyState(
      "还没有 Client Key",
      "创建一个客户端 key 后，外部 SDK 或 AI 客户端才能通过 Token Gate 访问后端模型。",
    ),
    headers: ["Client Key", "Status", "Routing", "Usage", "Last Used", "Updated", "Actions"],
    rowsMarkup: pageData.items.map(renderClientRow).join(""),
    paginationMarkup: renderPagination("clients", pageData),
    escapeHTML,
  });

  clientList.querySelectorAll("[data-toggle-client]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedClients, button.dataset.toggleClient);
      renderClients();
    });
  });

  clientList.querySelectorAll("[data-edit-client]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditClient(button.dataset.editClient);
    });
  });
  bindResourceRowOpen(clientList, "client");

  clientList.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 Client Key？")) {
          return;
        }
        await api(`/admin/api/client-keys/${button.dataset.deleteClient}`, "DELETE");
        if (String(state.editingClientID) === button.dataset.deleteClient) {
          resetClientForm();
        }
        state.expandedClients.delete(button.dataset.deleteClient);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(clientList, "clients", renderClients);
  bindResourceToolbar(clientList, "clients", { create: startCreateClient });
}

function renderPolicies() {
  const policies = state.policies;
  const filtered = applyResourceView("policies", policies);
  const pageData = currentLocalPageData("policies", filtered);
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "policies",
    searchPlaceholder: "Search policies",
    count: pageData.total,
  });

  policyList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: emptyState(
      "还没有 Model Policy",
      "定义模型模式、端点和 placement 策略后，路由行为才会按业务意图收敛。",
    ),
    headers: ["Pattern", "Routing", "Usage", "Coverage", "Last Used", "Updated", "Actions"],
    rowsMarkup: pageData.items.map(renderPolicyRow).join(""),
    paginationMarkup: renderPagination("policies", pageData),
    escapeHTML,
  });

  policyList.querySelectorAll("[data-toggle-policy]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedPolicies, button.dataset.togglePolicy);
      renderPolicies();
    });
  });

  policyList.querySelectorAll("[data-edit-policy]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditPolicy(button.dataset.editPolicy);
    });
  });
  bindResourceRowOpen(policyList, "policy");

  policyList.querySelectorAll("[data-delete-policy]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 Model Policy？")) {
          return;
        }
        await api(`/admin/api/model-policies/${button.dataset.deletePolicy}`, "DELETE");
        if (String(state.editingPolicyID) === button.dataset.deletePolicy) {
          resetPolicyForm();
        }
        state.expandedPolicies.delete(button.dataset.deletePolicy);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(policyList, "policies", renderPolicies);
  bindResourceToolbar(policyList, "policies", { create: startCreatePolicy });
}

function renderProxyRow(proxy) {
  return ResourceViewUtils.renderProxyRow({
    proxy,
    expanded: state.expandedProxies.has(String(proxy.id)),
    editing: String(state.editingProxyID) === String(proxy.id),
    quickDetails: buildQuickDetailMarkup("proxies", proxy),
    statusPill,
    formatBindingCount,
    formatDataSize,
    formatLatency,
    formatDateTime,
    tableActions,
    escapeHTML,
  });
}

function renderBackendRow(backend) {
  return ResourceViewUtils.renderBackendRow({
    backend,
    expanded: state.expandedBackends.has(String(backend.id)),
    editing: String(state.editingBackendID) === String(backend.id),
    quickDetails: buildQuickDetailMarkup("backends", backend),
    statusPill,
    formatBackendRouting,
    formatBackendCoverage,
    backendProtocolLabel,
    formatUsageCount,
    formatLatency,
    formatDateTime,
    formatBackendRecentStats,
    tableActions,
    escapeHTML,
  });
}

function renderClientRow(client) {
  return ResourceViewUtils.renderClientRow({
    client,
    expanded: state.expandedClients.has(String(client.id)),
    editing: String(state.editingClientID) === String(client.id),
    quickDetails: buildQuickDetailMarkup("clients", client),
    clientTokenText: clientTokenDisplay(client),
    statusPill,
    formatUsageCount,
    formatDateTime,
    tableActions,
    escapeHTML,
  });
}

function renderPolicyRow(policy) {
  return ResourceViewUtils.renderPolicyRow({
    policy,
    expanded: state.expandedPolicies.has(String(policy.id)),
    editing: String(state.editingPolicyID) === String(policy.id),
    quickDetails: buildQuickDetailMarkup("policies", policy),
    formatPolicyRouting,
    formatUsageCount,
    formatPolicyCoverage,
    formatDateTime,
    tableActions,
    escapeHTML,
  });
}

function bindResourceRowOpen(container, kind) {
  container.querySelectorAll("[data-row-open]").forEach((row) => {
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", `Open ${row.dataset.rowTitle || drawerDisplayTitle(kind)} detail`);
    row.setAttribute("aria-haspopup", "dialog");
    row.setAttribute("aria-controls", "drawerRoot");
    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) {
        return;
      }
      openResourceDrawer({
        kind,
        page: row.closest(".page")?.id || "",
        id: row.dataset.rowId || "",
        title: row.dataset.rowTitle || "",
        triggerElement: row,
      }).catch(reportError);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (event.target.closest("button")) {
        return;
      }
      event.preventDefault();
      openResourceDrawer({
        kind,
        page: row.closest(".page")?.id || "",
        id: row.dataset.rowId || "",
        title: row.dataset.rowTitle || "",
        triggerElement: row,
      }).catch(reportError);
    });
  });
}

function buildResourceToolbarMarkup({ resourceKey, searchPlaceholder, count }) {
  const viewState = state.resourceViews[resourceKey] || { query: "", filter: "all", sort: "updated_desc" };
  const defaultView = defaultResourceView(resourceKey);
  const activeFilters = Number(Boolean(String(viewState.query || "").trim()))
    + Number((viewState.filter || "all") !== defaultView.filter)
    + Number((viewState.sort || "") !== defaultView.sort);
  const hasChanges = activeFilters > 0;
  const model = typeof RendererUtils.createResourceToolbarModel === "function"
    ? RendererUtils.createResourceToolbarModel({ resourceKey, searchPlaceholder, count, activeFilters, hasChanges })
    : { searchPlaceholder, count, activeFilters, hasChanges, actions: ["search", "filters", "sort", "reset", "refresh"] };
  const config = RESOURCE_VIEW_CONFIG[resourceKey] || { filterOptions: [], sortOptions: [] };
  return ResourceViewUtils.renderResourceToolbar({
    resourceKey,
    viewState,
    model,
    config,
    activeFilters,
    hasChanges,
    escapeHTML,
    toolbarStatusLabel,
  });
}

function bindResourceToolbar(container, resourceKey, actions) {
  container.querySelector(`[data-toolbar-search="${resourceKey}"]`)?.addEventListener("input", (event) => {
    state.resourceViews[resourceKey].query = String(event.currentTarget.value || "");
    state.pagination[resourceKey].page = 1;
    renderResourceListByKey(resourceKey);
  });
  container.querySelector(`[data-toolbar-filter="${resourceKey}"]`)?.addEventListener("change", (event) => {
    state.resourceViews[resourceKey].filter = String(event.currentTarget.value || "all");
    state.pagination[resourceKey].page = 1;
    renderResourceListByKey(resourceKey);
  });
  container.querySelector(`[data-toolbar-sort="${resourceKey}"]`)?.addEventListener("change", (event) => {
    state.resourceViews[resourceKey].sort = String(event.currentTarget.value || "");
    state.pagination[resourceKey].page = 1;
    renderResourceListByKey(resourceKey);
  });
  container.querySelector(`[data-toolbar-reset="${resourceKey}"]`)?.addEventListener("click", () => {
    state.resourceViews[resourceKey] = defaultResourceView(resourceKey);
    state.pagination[resourceKey].page = 1;
    renderResourceListByKey(resourceKey);
  });
  container.querySelector(`[data-toolbar-refresh="${resourceKey}"]`)?.addEventListener("click", () => {
    refreshResourceList(resourceKey).catch(reportError);
  });
  container.querySelector(`[data-toolbar-create="${resourceKey}"]`)?.addEventListener("click", () => {
    actions.create();
  });
}

function renderResourceListByKey(resourceKey) {
  if (resourceKey === "proxies") {
    renderProxies();
    return;
  }
  if (resourceKey === "backends") {
    renderBackends();
    return;
  }
  if (resourceKey === "clients") {
    renderClients();
    return;
  }
  if (resourceKey === "policies") {
    renderPolicies();
  }
}

function defaultResourceView(resourceKey) {
  const current = state.resourceViews[resourceKey];
  if (current && typeof current === "object") {
    const fallbackSort = resourceKey === "policies" ? "priority_asc" : "updated_desc";
    return {
      query: "",
      filter: "all",
      sort: fallbackSort,
    };
  }
  return { query: "", filter: "all", sort: "updated_desc" };
}

function toolbarStatusLabel(activeFilters, hasChanges) {
  if (!hasChanges || activeFilters <= 0) {
    return "Default view";
  }
  if (activeFilters === 1) {
    return "1 active control";
  }
  return `${activeFilters} active controls`;
}

function applyResourceView(resourceKey, items) {
  const source = ensureArray(items).slice();
  const viewState = state.resourceViews[resourceKey] || { query: "", filter: "all", sort: "updated_desc" };
  const query = String(viewState.query || "").trim().toLowerCase();
  let filtered = source.filter((item) => resourceFilterPredicate(resourceKey, item, viewState.filter));
  if (query) {
    filtered = filtered.filter((item) => resourceSearchText(resourceKey, item).includes(query));
  }
  filtered.sort(resourceSorter(resourceKey, viewState.sort));
  return filtered;
}

function resourceFilterPredicate(resourceKey, item, filter) {
  if (filter === "all" || !filter) {
    return true;
  }
  if (resourceKey === "policies") {
    return filter === "enabled" ? Boolean(item.failover_enabled) : !item.failover_enabled;
  }
  return filter === "enabled" ? Boolean(item.enabled) : !item.enabled;
}

function resourceSearchText(resourceKey, item) {
  const parts = [];
  if (resourceKey === "proxies") {
    parts.push(item.name, item.address, item.username);
  }
  if (resourceKey === "backends") {
    parts.push(item.name, item.base_url, item.pool, ...(item.models || []), ...(item.endpoints || []));
  }
  if (resourceKey === "clients") {
    parts.push(item.name, item.route_group, item.route_mode_override, item.token_prefix);
  }
  if (resourceKey === "policies") {
    parts.push(item.pattern, item.endpoint, item.placement_policy, item.backend_pool);
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function resourceSorter(resourceKey, sortKey) {
  return (left, right) => {
    if (sortKey === "name_asc") {
      return String(left.name || "").localeCompare(String(right.name || ""));
    }
    if (sortKey === "group_asc") {
      return String(left.route_group || "").localeCompare(String(right.route_group || ""));
    }
    if (sortKey === "weight_desc") {
      return Number(right.weight || 0) - Number(left.weight || 0);
    }
    if (sortKey === "pattern_asc") {
      return String(left.pattern || "").localeCompare(String(right.pattern || ""));
    }
    if (sortKey === "priority_asc") {
      return Number(left.priority || 0) - Number(right.priority || 0);
    }
    return String(right.updated_at || "").localeCompare(String(left.updated_at || ""));
  };
}

function buildQuickDetailMarkup(resourceKey, record) {
  const sections = typeof RendererUtils.createQuickDetailSections === "function"
    ? RendererUtils.createQuickDetailSections(resourceKey, record)
    : [];
  return ResourceViewUtils.createQuickDetailMarkup({ sections, escapeHTML });
}

function renderEvents() {
  const events = state.events;
  syncEventFilterInputs();
  const pageData = currentRemotePageData("events", events);
  const pageTimeline = typeof ObservabilityUtils.createEventTimelineItems === "function"
    ? ObservabilityUtils.createEventTimelineItems(pageData.items)
    : [];
  const summary = typeof ObservabilityUtils.createEventSummaryModel === "function"
    ? ObservabilityUtils.createEventSummaryModel(state.eventSummary)
    : { total: 0, categories: [], severities: [] };

  eventList.innerHTML = typeof ObservabilityViewUtils.renderEventsPage === "function"
    ? ObservabilityViewUtils.renderEventsPage({
      events,
      pageData,
      timelineItems: pageTimeline,
      summary,
      formatDateTime,
      renderPagination,
      emptyState,
      feedToneClass,
      escapeHTML,
    })
    : "";

  bindPagination(eventList, "events", refreshAll);
  eventList.querySelectorAll("[data-event-row]").forEach((row) => {
    const openEventDrawer = () => {
      openResourceDrawer({
        kind: "event",
        page: "events",
        id: row.dataset.eventRow || "",
        title: row.dataset.eventTitle || "Event",
        triggerElement: row,
      }).catch(reportError);
    };
    row.addEventListener("click", openEventDrawer);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      openEventDrawer();
    });
  });
}

function renderUsageLogs() {
  const logs = state.usageLogs;
  syncUsageLogFilterInputs();
  deleteUsageLogsBtn.disabled = logs.length === 0;
  const statsCards = typeof ObservabilityUtils.createUsageStatsCards === "function"
    ? ObservabilityUtils.createUsageStatsCards(state.usageLogStats)
    : [];
  const rows = typeof ObservabilityUtils.createUsageLogRows === "function"
    ? ObservabilityUtils.createUsageLogRows(logs)
    : [];
  const pageData = currentRemotePageData("usageLogs", logs);
  const pageRows = typeof ObservabilityUtils.createUsageLogRows === "function"
    ? ObservabilityUtils.createUsageLogRows(pageData.items)
    : [];

  usageLogList.innerHTML = typeof ObservabilityViewUtils.renderUsageLogsPage === "function"
    ? ObservabilityViewUtils.renderUsageLogsPage({
      logs,
      pageData,
      statsCards,
      pageRows,
      expandedUsageLogs: state.expandedUsageLogs,
      formatDateTime,
      renderPagination,
      emptyState,
      renderUsageLogInlineDetail,
      escapeHTML,
    })
    : "";

  bindPagination(usageLogList, "usageLogs", refreshAll);
  usageLogList.querySelectorAll("[data-toggle-usage-log]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleExpanded(state.expandedUsageLogs, button.dataset.toggleUsageLog);
      renderUsageLogs();
    });
  });
  usageLogList.querySelectorAll("[data-usage-log-row]").forEach((row) => {
    row.addEventListener("click", () => {
      openResourceDrawer({
        kind: "usage_log",
        page: "usage-logs",
        id: row.dataset.usageLogRow || "",
        title: row.dataset.usageLogTitle || "Usage Log",
        triggerElement: row,
      }).catch(reportError);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      openResourceDrawer({
        kind: "usage_log",
        page: "usage-logs",
        id: row.dataset.usageLogRow || "",
        title: row.dataset.usageLogTitle || "Usage Log",
        triggerElement: row,
      }).catch(reportError);
    });
  });
}

function renderUsageLogRow(row) {
  if (typeof ObservabilityViewUtils.renderUsageLogRow === "function") {
    return ObservabilityViewUtils.renderUsageLogRow({
      row,
      expanded: state.expandedUsageLogs.has(String(row.id)),
      formatDateTime,
      renderInlineDetail: () => renderUsageLogInlineDetail(row),
      escapeHTML,
    });
  }
  return "";
}

function renderUsageLogInlineDetail(row) {
  const detail = state.usageLogDetailCache.get(String(row.id));
  if (!detail) {
    primeUsageLogDetail(row.id);
  }
  const previewItems = typeof ObservabilityUtils.createUsageLogDetailPreview === "function"
    ? ObservabilityUtils.createUsageLogDetailPreview(detail, row)
    : [
      { key: "trace", label: "Trace ID", value: row.traceId || "-" },
      { key: "request", label: "Request", value: row.requestMetadata || "-" },
      { key: "headers", label: "Headers", value: row.headersPreview || "-" },
      { key: "payload", label: "Payload", value: row.payloadPreview || "-" },
      { key: "response", label: "Response", value: row.responsePreview || "-" },
    ];
  if (typeof ObservabilityViewUtils.renderUsageLogInlineDetail === "function") {
    return ObservabilityViewUtils.renderUsageLogInlineDetail({
      detail,
      row,
      previewItems,
      formatInlinePreview: ObservabilityViewUtils.formatInlinePreview,
      escapeHTML,
    });
  }
  return "";
}

async function primeUsageLogDetail(id) {
  const key = String(id || "").trim();
  if (!key || state.usageLogDetailCache.has(key)) {
    return;
  }
  try {
    const payload = await api(`/admin/api/usage-logs/${encodeURIComponent(key)}`);
    state.usageLogDetailCache.set(key, payload && typeof payload === "object" ? payload : {});
    if (state.expandedUsageLogs.has(key)) {
      renderUsageLogs();
    }
  } catch (error) {
    state.usageLogDetailCache.set(key, { error: error?.message || "Failed to load usage log detail" });
    if (state.expandedUsageLogs.has(key)) {
      renderUsageLogs();
    }
  }
}

function cycleThemePreference() {
  const nextPreference = typeof ThemeUtils.nextThemePreference === "function"
    ? ThemeUtils.nextThemePreference(state.ui.themePreference)
    : "light";
  state.ui.themePreference = nextPreference;
  persistThemePreference(nextPreference);
  applyResolvedTheme();
  renderTheme();
}

function toggleSidebarCollapsed(forceState) {
  const nextState = typeof forceState === "boolean"
    ? forceState
    : !appShell?.classList.contains("sidebar-collapsed");
  appShell?.classList.toggle("sidebar-collapsed", nextState);
  sidebarRoot?.classList.toggle("is-collapsed", nextState);
  renderSettings();
}

function bindPagination(container, key, rerender) {
  container.querySelector(`[data-page-size="${key}"]`)?.addEventListener("change", async (event) => {
    state.pagination[key].size = Number(event.currentTarget.value || 10);
    state.pagination[key].page = 1;
    await Promise.resolve(rerender()).catch(reportError);
  });

  container.querySelector(`[data-page-prev="${key}"]`)?.addEventListener("click", async () => {
    state.pagination[key].page = Math.max(1, state.pagination[key].page - 1);
    await Promise.resolve(rerender()).catch(reportError);
  });

  container.querySelector(`[data-page-next="${key}"]`)?.addEventListener("click", async () => {
    state.pagination[key].page += 1;
    await Promise.resolve(rerender()).catch(reportError);
  });

  container.querySelectorAll(`[data-page-number="${key}"]`).forEach((button) => {
    button.addEventListener("click", async () => {
      state.pagination[key].page = Number(button.dataset.pageValue || 1);
      await Promise.resolve(rerender()).catch(reportError);
    });
  });
}

function currentLocalPageData(key, items) {
  const normalized = ensureArray(items);
  const pageState = state.pagination[key];
  const paginated = typeof RendererUtils.paginateResourceRows === "function"
    ? RendererUtils.paginateResourceRows(normalized, pageState)
    : {
      items: normalized,
      page: 1,
      size: PAGE_SIZE_OPTIONS.includes(Number(pageState?.size)) ? Number(pageState.size) : 10,
      total: normalized.length,
      totalPages: 1,
    };
  state.pagination[key].page = paginated.page;
  state.pagination[key].size = paginated.size;
  return paginated;
}

function currentRemotePageData(key, items) {
  const normalized = ensureArray(items);
  const pageState = state.pagination[key];
  const meta = state.paginationMeta[key];
  const size = PAGE_SIZE_OPTIONS.includes(Number(pageState?.size)) ? Number(pageState.size) : 10;
  const total = Number(meta?.total) || 0;
  const page = Math.max(1, Number(meta?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    items: normalized,
    page,
    size,
    total,
    totalPages,
  };
}

function applyPagedResponse(key, payload) {
  const pageState = state.pagination[key];
  const metaState = state.paginationMeta[key];
  const items = ensureArray(payload?.items);
  const total = Number(payload?.total) || 0;
  const limit = PAGE_SIZE_OPTIONS.includes(Number(payload?.limit)) ? Number(payload.limit) : pageState.size;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Number(payload?.page) || 1), totalPages);

  pageState.page = page;
  pageState.size = limit;
  metaState.total = total;
  metaState.page = page;
  metaState.limit = limit;

  state[key] = items;
}

function renderPagination(key, pageData) {
  const pageState = state.pagination[key];
  if (!pageState || pageData.total <= 0) {
    return "";
  }

  return `
    <div class="pagination-bar" data-pagination="${key}">
      <div class="pagination-meta">
        <span>共 ${pageData.total} 条</span>
        <span>第 ${pageData.page} / ${pageData.totalPages} 页</span>
      </div>
      <div class="pagination-controls">
        <label class="pagination-size">
          <span>每页</span>
          <select data-page-size="${key}">
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${pageData.size === size ? "selected" : ""}>${size}</option>`).join("")}
          </select>
        </label>
        <div class="pagination-pages">
          <button class="small-button ghost-button pagination-arrow" data-page-prev="${key}" type="button" aria-label="上一页" ${pageData.page <= 1 ? "disabled" : ""}>&lsaquo;</button>
          ${paginationPageNumbers(pageData).map((page) => {
            if (page === "...") {
              return `<span class="pagination-ellipsis">...</span>`;
            }
            return `<button class="small-button ${page === pageData.page ? "pagination-number active" : "ghost-button pagination-number"}" data-page-number="${key}" data-page-value="${page}" type="button">${page}</button>`;
          }).join("")}
          <button class="small-button ghost-button pagination-arrow" data-page-next="${key}" type="button" aria-label="下一页" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>&rsaquo;</button>
        </div>
      </div>
    </div>
  `;
}

function paginationPageNumbers(pageData) {
  const totalPages = Math.max(1, Number(pageData.totalPages) || 1);
  const current = Math.max(1, Number(pageData.page) || 1);
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (current >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", current - 1, current, current + 1, "...", totalPages];
}

function formatUsageRequest(log) {
  const method = String(log.method || "").toUpperCase();
  const path = log.path || "-";
  const requestID = log.request_id || "-";
  return `${method} ${path} · ${requestID}`;
}

function formatUsageStatus(log) {
  const status = Number(log.status_code) || 0;
  const attempts = Number(log.attempts) || 0;
  const duration = Number(log.duration_ms) || 0;
  const statusText = status > 0 ? String(status) : "failed";
  return `${statusText} · ${attempts} try · ${duration} ms`;
}

function formatUsageDetail(log) {
  const parts = [];
  if (log.error_message) {
    parts.push(`err ${log.error_message}`);
  }
  return parts.join(" · ") || "-";
}

function parseModelMapping(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }
  const mapping = {};
  raw.split(",").forEach((item) => {
    const [from, to] = item.split("=").map((part) => String(part || "").trim());
    if (from && to) {
      mapping[from] = to;
    }
  });
  return mapping;
}

function formatModelMapping(mapping) {
  if (!mapping || typeof mapping !== "object") {
    return "-";
  }
  const items = Object.entries(mapping).map(([from, to]) => `${from} -> ${to}`);
  return items.length === 0 ? "-" : items.join(", ");
}

function formatModelMappingInput(mapping) {
  if (!mapping || typeof mapping !== "object") {
    return "";
  }
  return Object.entries(mapping).map(([from, to]) => `${from}=${to}`).join(", ");
}

function startEditProxy(id) {
  const proxy = state.proxies.find((item) => String(item.id) === String(id));
  if (!proxy) {
    return;
  }

  state.editingProxyID = proxy.id;
  proxyForm.elements.name.value = proxy.name || "";
  proxyForm.elements.address.value = proxy.address || "";
  proxyForm.elements.username.value = proxy.username || "";
  proxyForm.elements.password.value = proxy.password || "";
  proxyForm.elements.enabled.checked = Boolean(proxy.enabled);

  proxySubmitBtn.textContent = "保存 Proxy";
  proxyCancelBtn.classList.remove("hidden");
  proxyEditBanner.textContent = `正在编辑 SOCKS5 Proxy: ${proxy.name}`;
  proxyEditBanner.classList.remove("hidden");
  proxyModalTitle.textContent = "编辑 Proxy";
  showProxyModal();
  renderProxies();
}

function startCreateProxy() {
  state.editingProxyID = null;
  proxyForm.reset();
  proxyForm.elements.enabled.checked = true;
  proxySubmitBtn.textContent = "新增 Proxy";
  proxyCancelBtn.classList.remove("hidden");
  proxyEditBanner.classList.add("hidden");
  proxyModalTitle.textContent = "新增 Proxy";
  showProxyModal();
  renderProxies();
}

function startCreateBackend() {
  state.editingBackendID = null;
  backendForm.reset();
  backendForm.elements.protocol.value = "openai";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = "0";
  backendForm.elements.model_mapping.value = "";
  backendForm.elements.weight.value = 1;
  backendForm.elements.enabled.checked = true;
  backendSubmitBtn.textContent = "新增 Backend";
  backendCancelBtn.classList.remove("hidden");
  backendEditBanner.classList.add("hidden");
  backendModalTitle.textContent = "新增 Backend";
  showBackendModal();
  renderBackends();
}

function startEditBackend(id) {
  const backend = state.backends.find((item) => String(item.id) === String(id));
  if (!backend) {
    return;
  }

  state.editingBackendID = backend.id;
  backendForm.elements.name.value = backend.name || "";
  backendForm.elements.pool.value = backend.pool || "";
  backendForm.elements.protocol.value = backend.protocol || "openai";
  backendForm.elements.base_url.value = backend.base_url || "";
  backendForm.elements.api_key.value = backend.api_key || "";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = String(backend.proxy_id || 0);
  backendForm.elements.models.value = (backend.models || []).join(", ");
  backendForm.elements.model_mapping.value = formatModelMappingInput(backend.model_mapping);
  backendForm.elements.endpoints.value = (backend.endpoints || []).join(", ");
  backendForm.elements.weight.value = backend.weight || 1;
  backendForm.elements.enabled.checked = Boolean(backend.enabled);

  backendSubmitBtn.textContent = "保存 Backend";
  backendCancelBtn.classList.remove("hidden");
  backendEditBanner.textContent = `正在编辑 Backend: ${backend.name}`;
  backendEditBanner.classList.remove("hidden");
  backendModalTitle.textContent = "编辑 Backend";
  showBackendModal();
  renderBackends();
}

function startCreateClient() {
  state.editingClientID = null;
  clientForm.reset();
  clientForm.elements.token.placeholder = "Leave blank to auto-generate";
  clientForm.elements.enabled.checked = true;
  clientSubmitBtn.textContent = "新增 Client Key";
  clientCancelBtn.classList.remove("hidden");
  clientEditBanner.classList.add("hidden");
  clientModalTitle.textContent = "新增 Client Key";
  showClientModal();
  renderClients();
}

function startEditClient(id) {
  const client = state.clients.find((item) => String(item.id) === String(id));
  if (!client) {
    return;
  }

  state.editingClientID = client.id;
  clientForm.elements.name.value = client.name || "";
  clientForm.elements.token.value = client.token || "";
  clientForm.elements.token.placeholder = client.token ? "Client token" : "历史 key 仅保存了 hash；重新填写后可显示";
  clientForm.elements.route_mode_override.value = client.route_mode_override || "";
  clientForm.elements.route_group.value = client.route_group || "";
  clientForm.elements.enabled.checked = Boolean(client.enabled);

  clientSubmitBtn.textContent = "保存 Client Key";
  clientCancelBtn.classList.remove("hidden");
  clientEditBanner.textContent = `正在编辑 Client Key: ${client.name}`;
  clientEditBanner.classList.remove("hidden");
  clientModalTitle.textContent = "编辑 Client Key";
  showClientModal();
  renderClients();
}

function showBackendModal() {
  backendModal.classList.remove("hidden");
  backendForm.elements.name.focus();
}

function showProxyModal() {
  proxyModal.classList.remove("hidden");
  proxyForm.elements.name.focus();
}

function hideProxyModal() {
  proxyModal.classList.add("hidden");
}

function hideBackendModal() {
  backendModal.classList.add("hidden");
}

function showClientModal() {
  clientModal.classList.remove("hidden");
  clientForm.elements.name.focus();
}

function hideClientModal() {
  clientModal.classList.add("hidden");
}

function startCreatePolicy() {
  state.editingPolicyID = null;
  policyForm.reset();
  policyForm.elements.endpoint.value = "chat";
  policyForm.elements.placement_policy.value = "sticky";
  policyForm.elements.priority.value = 100;
  policyForm.elements.failover_enabled.checked = true;
  policySubmitBtn.textContent = "新增 Policy";
  policyCancelBtn.classList.remove("hidden");
  policyEditBanner.classList.add("hidden");
  policyModalTitle.textContent = "新增 Policy";
  showPolicyModal();
  renderPolicies();
}

function startEditPolicy(id) {
  const policy = state.policies.find((item) => String(item.id) === String(id));
  if (!policy) {
    return;
  }

  state.editingPolicyID = policy.id;
  policyForm.elements.pattern.value = policy.pattern || "";
  policyForm.elements.endpoint.value = policy.endpoint || "chat";
  policyForm.elements.placement_policy.value = policy.placement_policy || "sticky";
  policyForm.elements.backend_pool.value = policy.backend_pool || "";
  policyForm.elements.priority.value = policy.priority || 100;
  policyForm.elements.failover_enabled.checked = Boolean(policy.failover_enabled);

  policySubmitBtn.textContent = "保存 Policy";
  policyCancelBtn.classList.remove("hidden");
  policyEditBanner.textContent = `正在编辑 Model Policy: ${policy.pattern}`;
  policyEditBanner.classList.remove("hidden");
  policyModalTitle.textContent = "编辑 Policy";
  showPolicyModal();
  renderPolicies();
}

function resetProxyForm() {
  state.editingProxyID = null;
  proxyForm.reset();
  proxyForm.elements.enabled.checked = true;
  proxySubmitBtn.textContent = "新增 Proxy";
  proxyCancelBtn.classList.add("hidden");
  proxyEditBanner.classList.add("hidden");
  proxyModalTitle.textContent = "新增 Proxy";
  hideProxyModal();
  renderProxies();
}

function resetBackendForm() {
  state.editingBackendID = null;
  backendForm.reset();
  backendForm.elements.protocol.value = "openai";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = "0";
  backendForm.elements.model_mapping.value = "";
  backendForm.elements.weight.value = 1;
  backendForm.elements.enabled.checked = true;
  backendSubmitBtn.textContent = "新增 Backend";
  backendCancelBtn.classList.add("hidden");
  backendEditBanner.classList.add("hidden");
  backendModalTitle.textContent = "新增 Backend";
  hideBackendModal();
  renderBackends();
}

function resetClientForm() {
  state.editingClientID = null;
  clientForm.reset();
  clientForm.elements.token.placeholder = "Leave blank to auto-generate";
  clientForm.elements.enabled.checked = true;
  clientSubmitBtn.textContent = "新增 Client Key";
  clientCancelBtn.classList.add("hidden");
  clientEditBanner.classList.add("hidden");
  clientModalTitle.textContent = "新增 Client Key";
  hideClientModal();
  renderClients();
}

function resetPolicyForm() {
  state.editingPolicyID = null;
  policyForm.reset();
  policyForm.elements.endpoint.value = "chat";
  policyForm.elements.placement_policy.value = "sticky";
  policyForm.elements.priority.value = 100;
  policyForm.elements.failover_enabled.checked = true;
  policySubmitBtn.textContent = "新增 Policy";
  policyCancelBtn.classList.add("hidden");
  policyEditBanner.classList.add("hidden");
  policyModalTitle.textContent = "新增 Policy";
  hidePolicyModal();
  renderPolicies();
}

function showPolicyModal() {
  policyModal.classList.remove("hidden");
  policyForm.elements.pattern.focus();
}

function hidePolicyModal() {
  policyModal.classList.add("hidden");
}

function readForm(form) {
  const formData = new FormData(form);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }
  for (const input of form.querySelectorAll("input[type=checkbox]")) {
    payload[input.name] = input.checked;
  }
  return payload;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderProxyOptions() {
  const selected = backendForm.elements.proxy_id?.value || "0";
  backendForm.elements.proxy_id.innerHTML = `
    <option value="0">Direct connection</option>
    ${state.proxies.map((proxy) => `
      <option value="${proxy.id}">${escapeHTML(proxy.name)} (${escapeHTML(proxy.address)})${proxy.enabled ? "" : " - disabled"}</option>
    `).join("")}
  `;
  backendForm.elements.proxy_id.value = state.proxies.some((proxy) => String(proxy.id) === selected) ? selected : "0";
}

function formatBackendRecentStats(stats = {}) {
  const windowMinutes = Number(stats.window_minutes) || 30;
  const successes = Number(stats.successes) || 0;
  const failures = Number(stats.failures) || 0;
  return `${windowMinutes}m ${successes} ok / ${failures} fail`;
}

function formatDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return raw;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function clientTokenDisplay(client) {
  if (client.masked_token) {
    return client.masked_token;
  }
  if (client.token) {
    return client.token;
  }
  if (client.token_prefix) {
    return `${client.token_prefix} (历史记录仅保存 prefix)`;
  }
  return "-";
}

function formatUsageCount(value) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return "0 requests";
  }
  return `${count} requests`;
}

function formatBindingCount(value) {
  const count = Number(value || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return "0 backends";
  }
  return `${count} backends`;
}

function formatBackendCoverage(backend) {
  const modelCount = Number.isFinite(Number(backend?.model_count))
    ? Number(backend.model_count)
    : ensureArray(backend?.models).filter(Boolean).length;
  const endpointCount = Number.isFinite(Number(backend?.endpoint_count))
    ? Number(backend.endpoint_count)
    : ensureArray(backend?.endpoints).filter(Boolean).length;
  return `${modelCount} models / ${endpointCount} endpoints`;
}

function formatPolicyCoverage(policy) {
  const backendCount = Number(policy?.backend_count || 0);
  const modelCount = Number(policy?.model_count || 0);
  return `${Number.isFinite(backendCount) ? backendCount : 0} backends / ${Number.isFinite(modelCount) ? modelCount : 0} models`;
}

function formatLatency(value) {
  const latency = Number(value || 0);
  if (!Number.isFinite(latency) || latency <= 0) {
    return "-";
  }
  return `${Math.round(latency)} ms`;
}

function formatDataSize(value) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let amount = size;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  const rounded = amount >= 10 || unitIndex === 0 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

function proxyLabel(proxyID, proxy) {
  if (!proxyID || Number(proxyID) === 0) {
    return "direct";
  }
  if (!proxy) {
    return `missing proxy #${proxyID}`;
  }
  return `${proxy.name}${proxy.enabled ? "" : " (disabled)"}`;
}

function formatBackendRouting(backend) {
  const parts = [
    backend?.pool ? `pool ${backend.pool}` : "",
    proxyLabel(backend?.proxy_id, backend?.proxy),
  ].filter(Boolean);
  return parts.join(" | ") || "-";
}

function formatPolicyRouting(policy) {
  const parts = [
    policy?.backend_pool ? `pool ${policy.backend_pool}` : "",
    Number.isFinite(Number(policy?.priority)) ? `priority ${policy.priority}` : "",
    policy?.failover_enabled ? "failover on" : "failover off",
  ].filter(Boolean);
  return parts.join(" | ") || "-";
}

function backendProtocolLabel(protocol) {
  return protocol === "anthropic" ? "Claude / Anthropic" : "OpenAI";
}

function toggleExpanded(set, id) {
  const normalizedID = String(id);
  if (set.has(normalizedID)) {
    set.delete(normalizedID);
    return;
  }
  set.add(normalizedID);
}

function statusPill(enabled, onText, offText) {
  const active = Boolean(enabled);
  return `<span class="status-pill ${active ? "ok" : "off"}">${escapeHTML(active ? onText : offText)}</span>`;
}

function compactList(values) {
  const items = ensureArray(values).filter(Boolean);
  if (items.length === 0) {
    return `<span class="muted-text">-</span>`;
  }

  const visible = items.slice(0, 2);
  const rest = items.length - visible.length;
  return `
    <div class="compact-list">
      ${visible.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}
      ${rest > 0 ? `<span class="more-count">+${rest}</span>` : ""}
    </div>
  `;
}

function chipList(values, className = "") {
  const items = ensureArray(values).filter(Boolean);
  if (items.length === 0) {
    return `<span class="muted-text">-</span>`;
  }

  const modifier = className ? ` ${escapeHTML(className)}` : "";
  return items.map((item) => `<span class="chip${modifier}">${escapeHTML(item)}</span>`).join("");
}

function tableActions(type, id) {
  const normalizedID = escapeHTML(id);
  const attributes = {
    proxy: ["data-edit-proxy", "data-delete-proxy"],
    backend: ["data-edit-backend", "data-delete-backend"],
    client: ["data-edit-client", "data-delete-client"],
    policy: ["data-edit-policy", "data-delete-policy"],
  }[type];

  if (!attributes) {
    return "";
  }

  const [editAttribute, deleteAttribute] = attributes;
  return `
    <div class="table-actions">
      <button class="small-button" ${editAttribute}="${normalizedID}" type="button">编辑</button>
      <button class="small-button danger-button" ${deleteAttribute}="${normalizedID}" type="button">删除</button>
    </div>
  `;
}

function emptyState(title, description) {
  return `
    <article class="empty-state">
      <strong>${escapeHTML(title)}</strong>
      <p class="empty-copy">${escapeHTML(description)}</p>
    </article>
  `;
}

function renderDatalist(element, values) {
  element.innerHTML = ensureArray(values)
    .filter(Boolean)
    .map((value) => `<option value="${escapeHTML(value)}"></option>`)
    .join("");
}

async function api(path, method = "GET", body) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

function reportError(error) {
  console.error(error);
  alert(error?.message || "操作失败");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

activatePage(pageIDFromHash());
refreshAll().catch(reportError);
