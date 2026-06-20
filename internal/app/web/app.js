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
const ResourceRuntimeUtils = globalThis.ResourceRuntimeUtils || {};
const ShellStateUtils = typeof ResourceRuntimeUtils.requireShellStateUtils === "function"
  ? ResourceRuntimeUtils.requireShellStateUtils(globalThis.ShellStateUtils)
  : (() => {
    throw new Error("shell-state.js failed to load before app.js");
  })();
const ShellViewUtils = typeof ResourceRuntimeUtils.requireShellViewUtils === "function"
  ? ResourceRuntimeUtils.requireShellViewUtils(globalThis.ShellViewUtils)
  : (() => {
    throw new Error("shell-view.js failed to load before app.js");
  })();
const DrawerViewUtils = typeof ResourceRuntimeUtils.requireDrawerViewUtils === "function"
  ? ResourceRuntimeUtils.requireDrawerViewUtils(globalThis.DrawerViewUtils)
  : (() => {
    throw new Error("drawer-view.js failed to load before app.js");
  })();
const ShellRuntimeUtils = typeof ResourceRuntimeUtils.requireShellRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireShellRuntimeUtils(globalThis.ShellRuntimeUtils)
  : (() => {
    throw new Error("shell-runtime.js failed to load before app.js");
  })();
const PaginationUtils = typeof ResourceRuntimeUtils.requirePaginationUtils === "function"
  ? ResourceRuntimeUtils.requirePaginationUtils(globalThis.PaginationUtils)
  : (() => {
    throw new Error("pagination.js failed to load before app.js");
  })();
const DisplayUtils = typeof ResourceRuntimeUtils.requireDisplayUtils === "function"
  ? ResourceRuntimeUtils.requireDisplayUtils(globalThis.DisplayUtils)
  : (() => {
    throw new Error("display-utils.js failed to load before app.js");
  })();
const escapeHTML = DisplayUtils.escapeHTML;
const formatDateTime = DisplayUtils.formatDateTime;
const DashboardUtils = globalThis.DashboardUtils || {};
const DashboardViewUtils = globalThis.DashboardViewUtils || {};
const ChartsUtils = globalThis.ChartsUtils || {};
const DrawerUtils = globalThis.DrawerUtils || {};
const ObservabilityUtils = globalThis.ObservabilityUtils || {};
const ObservabilityViewUtils = globalThis.ObservabilityViewUtils || {};
const ResourceViewUtils = typeof ResourceRuntimeUtils.requireResourceViewUtils === "function"
  ? ResourceRuntimeUtils.requireResourceViewUtils(globalThis.ResourceViewUtils)
  : (() => {
    throw new Error("resource-runtime.js failed to load before app.js");
  })();
const ResourceStateUtils = typeof ResourceRuntimeUtils.requireResourceStateUtils === "function"
  ? ResourceRuntimeUtils.requireResourceStateUtils(globalThis.ResourceStateUtils)
  : (() => {
    throw new Error("resource-runtime.js failed to load before app.js");
  })();
const ResourceCrudUtils = typeof ResourceRuntimeUtils.requireResourceCrudUtils === "function"
  ? ResourceRuntimeUtils.requireResourceCrudUtils(globalThis.ResourceCrudUtils)
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
const resourceViewDefaults = {
  proxies: ResourceStateUtils.defaultResourceView("proxies"),
  backends: ResourceStateUtils.defaultResourceView("backends"),
  clients: ResourceStateUtils.defaultResourceView("clients"),
  policies: ResourceStateUtils.defaultResourceView("policies"),
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
  resourceViews: { ...resourceViewDefaults },
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
const resourceCrud = ResourceCrudUtils.createResourceCrud({
  state,
  resources: {
    proxies: {
      form: proxyForm,
      modal: proxyModal,
      title: proxyModalTitle,
      submitButton: proxySubmitBtn,
      cancelButton: proxyCancelBtn,
      editBanner: proxyEditBanner,
      editingStateKey: "editingProxyID",
      collectionStateKey: "proxies",
      render: renderProxies,
      createTitle: "新增 Proxy",
      editTitle: "编辑 Proxy",
      createSubmitLabel: "新增 Proxy",
      editSubmitLabel: "保存 Proxy",
      editBannerText(proxy) {
        return `正在编辑 SOCKS5 Proxy: ${proxy.name}`;
      },
      focusField: "name",
      defaults: {
        enabled: true,
      },
      assignEditValues(form, proxy) {
        form.elements.name.value = proxy.name || "";
        form.elements.address.value = proxy.address || "";
        form.elements.username.value = proxy.username || "";
        form.elements.password.value = proxy.password || "";
        form.elements.enabled.checked = Boolean(proxy.enabled);
      },
    },
    backends: {
      form: backendForm,
      modal: backendModal,
      title: backendModalTitle,
      submitButton: backendSubmitBtn,
      cancelButton: backendCancelBtn,
      editBanner: backendEditBanner,
      editingStateKey: "editingBackendID",
      collectionStateKey: "backends",
      render: renderBackends,
      createTitle: "新增 Backend",
      editTitle: "编辑 Backend",
      createSubmitLabel: "新增 Backend",
      editSubmitLabel: "保存 Backend",
      editBannerText(backend) {
        return `正在编辑 Backend: ${backend.name}`;
      },
      focusField: "name",
      defaults: {
        protocol: "openai",
        api_key: { placeholder: "Backend API key" },
        proxy_id: "0",
        model_mapping: "",
        weight: 1,
        enabled: true,
      },
      assignEditValues(form, backend, helpers) {
        form.elements.name.value = backend.name || "";
        form.elements.pool.value = backend.pool || "";
        form.elements.protocol.value = backend.protocol || "openai";
        form.elements.base_url.value = backend.base_url || "";
        form.elements.api_key.value = backend.api_key || "";
        form.elements.api_key.placeholder = "Backend API key";
        form.elements.proxy_id.value = String(backend.proxy_id || 0);
        form.elements.models.value = (backend.models || []).join(", ");
        form.elements.model_mapping.value = helpers.formatModelMappingInput(backend.model_mapping);
        form.elements.endpoints.value = (backend.endpoints || []).join(", ");
        form.elements.weight.value = backend.weight || 1;
        form.elements.enabled.checked = Boolean(backend.enabled);
      },
    },
    clients: {
      form: clientForm,
      modal: clientModal,
      title: clientModalTitle,
      submitButton: clientSubmitBtn,
      cancelButton: clientCancelBtn,
      editBanner: clientEditBanner,
      editingStateKey: "editingClientID",
      collectionStateKey: "clients",
      render: renderClients,
      createTitle: "新增 Client Key",
      editTitle: "编辑 Client Key",
      createSubmitLabel: "新增 Client Key",
      editSubmitLabel: "保存 Client Key",
      editBannerText(client) {
        return `正在编辑 Client Key: ${client.name}`;
      },
      focusField: "name",
      defaults: {
        token: { placeholder: "Leave blank to auto-generate" },
        enabled: true,
      },
      assignEditValues(form, client) {
        form.elements.name.value = client.name || "";
        form.elements.token.value = client.token || "";
        form.elements.token.placeholder = client.token ? "Client token" : "历史 key 仅保存了 hash；重新填写后可显示";
        form.elements.route_mode_override.value = client.route_mode_override || "";
        form.elements.route_group.value = client.route_group || "";
        form.elements.enabled.checked = Boolean(client.enabled);
      },
    },
    policies: {
      form: policyForm,
      modal: policyModal,
      title: policyModalTitle,
      submitButton: policySubmitBtn,
      cancelButton: policyCancelBtn,
      editBanner: policyEditBanner,
      editingStateKey: "editingPolicyID",
      collectionStateKey: "policies",
      render: renderPolicies,
      createTitle: "新增 Policy",
      editTitle: "编辑 Policy",
      createSubmitLabel: "新增 Policy",
      editSubmitLabel: "保存 Policy",
      editBannerText(policy) {
        return `正在编辑 Model Policy: ${policy.pattern}`;
      },
      focusField: "pattern",
      defaults: {
        endpoint: "chat",
        placement_policy: "sticky",
        priority: 100,
        failover_enabled: true,
      },
      assignEditValues(form, policy) {
        form.elements.pattern.value = policy.pattern || "";
        form.elements.endpoint.value = policy.endpoint || "chat";
        form.elements.placement_policy.value = policy.placement_policy || "sticky";
        form.elements.backend_pool.value = policy.backend_pool || "";
        form.elements.priority.value = policy.priority || 100;
        form.elements.failover_enabled.checked = Boolean(policy.failover_enabled);
      },
    },
  },
});
const { readForm, splitList } = resourceCrud;
const parseModelMapping = ResourceCrudUtils.parseModelMapping;
const startCreateProxy = () => resourceCrud.startCreate("proxies");
const startEditProxy = (id) => resourceCrud.startEdit("proxies", id);
const resetProxyForm = () => resourceCrud.reset("proxies");
function startCreateBackend() {
  renderProxyOptions();
  resourceCrud.startCreate("backends");
}

function startEditBackend(id) {
  renderProxyOptions();
  resourceCrud.startEdit("backends", id);
}

function resetBackendForm() {
  resourceCrud.reset("backends");
  renderProxyOptions();
}
const startCreateClient = () => resourceCrud.startCreate("clients");
const startEditClient = (id) => resourceCrud.startEdit("clients", id);
const resetClientForm = () => resourceCrud.reset("clients");
const startCreatePolicy = () => resourceCrud.startCreate("policies");
const startEditPolicy = (id) => resourceCrud.startEdit("policies", id);
const resetPolicyForm = () => resourceCrud.reset("policies");

function renderProxyOptions() {
  const proxyInput = backendForm?.elements?.proxy_id;
  if (!proxyInput) {
    return;
  }

  const selected = proxyInput.value || "0";
  proxyInput.innerHTML = `
    <option value="0">Direct connection</option>
    ${state.proxies.map((proxy) => `
      <option value="${proxy.id}">${DisplayUtils.escapeHTML(proxy.name)} (${DisplayUtils.escapeHTML(proxy.address)})${proxy.enabled ? "" : " - disabled"}</option>
    `).join("")}
  `;
  proxyInput.value = state.proxies.some((proxy) => String(proxy.id) === selected) ? selected : "0";
}

function pageIDFromHash() {
  return ShellRuntimeUtils.pageIDFromHash({
    windowObject: window,
    pages,
    shellViewUtils: ShellViewUtils,
  });
}

function activatePage(id) {
  return ShellRuntimeUtils.activatePage({
    id,
    pages,
    pageLinks,
    pageTitle,
    pageBreadcrumb,
    shellViewUtils: ShellViewUtils,
  });
}

function navigateToPage(id) {
  return ShellRuntimeUtils.navigateToPage({
    id,
    windowObject: window,
    pages,
    pageLinks,
    pageTitle,
    pageBreadcrumb,
    shellStateUtils: ShellStateUtils,
    shellViewUtils: ShellViewUtils,
  });
}

function initializeThemeState() {
  ShellRuntimeUtils.initializeThemeState({
    state,
    rootElement,
    localStorage,
    themePreferenceKey: THEME_PREFERENCE_KEY,
    systemThemeQuery,
    shellStateUtils: ShellStateUtils,
    themeUtils: ThemeUtils,
  });
}

function persistThemePreference(preference) {
  ShellRuntimeUtils.persistThemePreference({
    preference,
    localStorage,
    themePreferenceKey: THEME_PREFERENCE_KEY,
    shellStateUtils: ShellStateUtils,
  });
}

function applyResolvedTheme() {
  ShellRuntimeUtils.applyResolvedTheme({
    state,
    systemThemeQuery,
    themeUtils: ThemeUtils,
  });
}

function buildSettingsSnapshot() {
  return ShellRuntimeUtils.buildSettingsSnapshot({
    shellStateUtils: ShellStateUtils,
    localStorage,
    adminTokenKey: ADMIN_TOKEN_KEY,
    themePreference: state.ui.themePreference,
    resolvedTheme: state.ui.theme,
    appShell,
    lastRefreshAt: state.ui.lastRefreshAt,
    formatDateTime,
    backends: state.backends,
    clients: state.clients,
    policies: state.policies,
    proxies: state.proxies,
    usageLogStats: state.usageLogStats,
    usageLogMeta: state.paginationMeta.usageLogs,
    eventSummary: state.eventSummary,
  });
}

function renderSettings() {
  ShellRuntimeUtils.renderSettings({
    settingsRoot,
    settingsUtils: SettingsUtils,
    buildSettingsSnapshot,
  });
}

function renderTheme() {
  ShellRuntimeUtils.renderTheme({
    rootElement,
    appShell,
    themeToggleBtn,
    themeToggleLabel,
    theme: state.ui.theme,
    preference: state.ui.themePreference,
    shellViewUtils: ShellViewUtils,
    themeUtils: ThemeUtils,
  });
  renderSettings();
}

function cycleThemePreference() {
  const nextPreference = ShellRuntimeUtils.cycleThemePreference({
    currentPreference: state.ui.themePreference,
    themeUtils: ThemeUtils,
  });
  state.ui.themePreference = nextPreference;
  persistThemePreference(nextPreference);
  applyResolvedTheme();
  renderTheme();
}

function toggleSidebarCollapsed(forceState) {
  ShellRuntimeUtils.toggleSidebarCollapsed({
    appShell,
    sidebarRoot,
    forceState,
  });
  renderSettings();
}

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

  state.proxies = DisplayUtils.ensureArray(proxies);
  state.backends = DisplayUtils.ensureArray(backends);
  state.clients = DisplayUtils.ensureArray(clients);
  state.policies = DisplayUtils.ensureArray(policies);
  PaginationUtils.applyPagedResponse("events", events, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
  PaginationUtils.applyPagedResponse("usageLogs", usageLogs, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
  state.eventSummary = eventSummary;
  state.usageLogStats = usageLogStats;
  state.usageLogOptions.backends = DisplayUtils.ensureArray(usageLogOptions?.backends);
  state.usageLogOptions.models = DisplayUtils.ensureArray(usageLogOptions?.models);
  state.usageLogOptions.clientKeys = DisplayUtils.ensureArray(usageLogOptions?.client_keys);
  state.usageLogOptions.policies = DisplayUtils.ensureArray(usageLogOptions?.policies);
  state.usageLogOptions.proxies = DisplayUtils.ensureArray(usageLogOptions?.proxies);
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
  DisplayUtils.renderDatalist(usageLogBackendOptions, state.usageLogOptions.backends);
  DisplayUtils.renderDatalist(usageLogModelOptions, state.usageLogOptions.models);
  DisplayUtils.renderDatalist(usageLogClientKeyOptions, state.usageLogOptions.clientKeys);
  DisplayUtils.renderDatalist(usageLogPolicyOptions, state.usageLogOptions.policies);
  DisplayUtils.renderDatalist(usageLogProxyOptions, state.usageLogOptions.proxies);
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
  const tabs = typeof DrawerUtils.drawerTabsForResource === "function"
    ? DrawerUtils.drawerTabsForResource(state.ui.drawer.kind)
    : [];
  const footerActions = typeof DrawerUtils.drawerFooterActions === "function"
    ? DrawerUtils.drawerFooterActions()
    : [
      { key: "edit", label: "Edit", tone: "ghost", disabled: false },
      { key: "delete", label: "Delete", tone: "danger", disabled: false },
      { key: "save", label: "Save", tone: "primary", disabled: true },
    ];
  const activitySections = state.ui.drawer.tab === "activity" && typeof DrawerUtils.buildDrawerActivitySections === "function"
    ? DrawerUtils.buildDrawerActivitySections(state.ui.drawer.data?.activity || {})
    : [];
  const resolveDrawerTitle = typeof DrawerUtils.drawerDisplayTitle === "function"
    ? DrawerUtils.drawerDisplayTitle
    : undefined;
  const shell = DrawerViewUtils.renderDrawerShell({
    drawer: state.ui.drawer,
    tabs,
    footerActions,
    activitySections,
    escapeHTML,
    formatDateTime,
    resolveTitle: resolveDrawerTitle,
  });

  drawerRoot.classList.toggle("hidden", !shell.isOpen);
  drawerRoot.setAttribute("aria-hidden", shell.ariaHidden);
  if (drawerTitle) {
    drawerTitle.textContent = shell.title;
  }
  if (drawerTabRoot) {
    drawerTabRoot.innerHTML = shell.tabs;
    drawerTabRoot.querySelectorAll("[data-drawer-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.ui.drawer.tab = button.dataset.drawerTab || "overview";
        renderDrawerShell();
      });
    });
  }
  if (drawerBodyRoot) {
    drawerBodyRoot.innerHTML = shell.body;
  }
  if (drawerFooterRoot) {
    drawerFooterRoot.innerHTML = shell.footer;
    drawerFooterRoot.querySelector('[data-drawer-footer="edit"]')?.addEventListener("click", () => {
      openDrawerEditor();
    });
    drawerFooterRoot.querySelector('[data-drawer-footer="delete"]')?.addEventListener("click", () => {
      deleteDrawerResource().catch(reportError);
    });
  }
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
  ShellViewUtils.renderSearchShellView({
    searchModalRoot,
    searchOpenBtn,
    searchInput,
    searchResultsRoot,
    isOpen: Boolean(state.ui.search.open),
    query: state.ui.search.query,
    resultsMarkup: renderSearchResults(),
  });
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
    <svg class="${DisplayUtils.escapeHTML(className)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend sparkline">
      <path class="sparkline-area" d="${DisplayUtils.escapeHTML(areaPath)}"></path>
      <path class="sparkline-line" d="${DisplayUtils.escapeHTML(linePath)}"></path>
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
        <path class="usage-area-path" d="${DisplayUtils.escapeHTML(areaPath)}"></path>
        <path class="usage-line-path" d="${DisplayUtils.escapeHTML(linePath)}"></path>
        ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.2"></circle>`).join("")}
      </svg>
      <div class="dashboard-chart-axis">
        ${labels.map((label) => `<span>${DisplayUtils.escapeHTML(label)}</span>`).join("")}
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
  const closeState = typeof SearchUtils.closeSearchState === "function"
    ? SearchUtils.closeSearchState(state.ui.search)
    : { previousTrigger: state.ui.search.triggerElement };
  const previousTrigger = closeState.previousTrigger;
  searchDebounce?.cancel?.();
  renderSearchShell();
  if (previousTrigger instanceof HTMLElement) {
    previousTrigger.focus();
  }
}

function openSearchShell() {
  const openState = typeof SearchUtils.openSearchState === "function"
    ? SearchUtils.openSearchState(state.ui.search, {
      triggerElement: document.activeElement instanceof HTMLElement ? document.activeElement : searchOpenBtn,
    })
    : {
      shouldTriggerSearch: Boolean(
        state.ui.search.query.trim()
        && !state.ui.search.results.total
        && !state.ui.search.loading
      ),
    };
  renderSearchShell();
  if (searchInput) {
    searchInput.focus();
  } else {
    searchModalPanel?.focus();
  }
  if (state.ui.search.query.trim()) {
    searchInput?.select();
    if (openState.shouldTriggerSearch) {
      triggerSearch();
    }
  }
}

function updateSearchQuery(value) {
  const updateState = typeof SearchUtils.updateSearchQueryState === "function"
    ? SearchUtils.updateSearchQueryState(state.ui.search, value)
    : { shouldTriggerSearch: Boolean(String(value || "").trim()) };
  if (!updateState.shouldTriggerSearch) {
    searchDebounce?.cancel?.();
    return;
  }
  triggerSearch();
}

function triggerSearch() {
  const request = typeof SearchUtils.startSearchRequestState === "function"
    ? SearchUtils.startSearchRequestState(state.ui.search)
    : (typeof SearchUtils.createSearchRequest === "function"
      ? SearchUtils.createSearchRequest(state.ui.search.query, state.ui.search.requestSequence)
      : {
        sequence: (Number(state.ui.search.requestSequence) || 0) + 1,
        query: String(state.ui.search.query || "").trim(),
      });
  state.ui.search.requestSequence = request.sequence;
  state.ui.search.activeSequence = request.sequence;
  if (!searchDebounce) {
    executeSearch(request).catch(reportError);
    return;
  }
  renderSearchShell();
  searchDebounce(request);
}

async function executeSearch(request) {
  const requestID = Number(request?.sequence) || 0;
  const trimmedQuery = String(request?.query || "").trim();
  if (!trimmedQuery) {
    if (typeof SearchUtils.clearSearchState === "function") {
      SearchUtils.clearSearchState(state.ui.search);
    } else {
      state.ui.search.loading = false;
      state.ui.search.activeIndex = -1;
      state.ui.search.results = {
        query: "",
        total: 0,
        groups: [],
      };
    }
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
    const applied = typeof SearchUtils.resolveSearchResponseState === "function"
      ? SearchUtils.resolveSearchResponseState(state.ui.search, requestID, response)
      : null;
    if (applied === false) {
      return;
    }
    if (applied === null) {
      if (requestID !== state.ui.search.activeSequence) {
        return;
      }
      state.ui.search.results = typeof SearchUtils.normalizeSearchResponse === "function"
        ? SearchUtils.normalizeSearchResponse(response)
        : { query: trimmedQuery, total: 0, groups: [] };
      const keyboardState = currentSearchKeyboardState();
      state.ui.search.activeIndex = keyboardState.activeIndex;
    }
  } finally {
    if (requestID === state.ui.search.activeSequence) {
      state.ui.search.loading = false;
      renderSearchShell();
    }
  }
}

function renderSearchResults() {
  return ShellViewUtils.renderSearchResults({
    query: state.ui.search.query,
    loading: state.ui.search.loading,
    results: state.ui.search.results || { total: 0, groups: [] },
    keyboardState: currentSearchKeyboardState(),
    escapeHTML,
  });
}

async function fetchAllCollectionPages(basePath) {
  const firstPage = await api(`${basePath}?page=1&limit=50`);
  const items = DisplayUtils.ensureArray(firstPage?.items);
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
    items.push(...DisplayUtils.ensureArray(payload?.items));
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
  const resourceTitle = typeof DrawerUtils.drawerDisplayTitle === "function"
    ? DrawerUtils.drawerDisplayTitle(state.ui.drawer.kind)
    : DrawerViewUtils.drawerDisplayTitle(state.ui.drawer.kind);
  if (!confirm(`确认删除 ${resourceTitle}？`)) {
    return;
  }
  await api(state.ui.drawer.deletePath, "DELETE");
  closeDrawerShell();
  await refreshAll();
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
  const pageData = PaginationUtils.currentLocalPageData("proxies", filtered, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "proxies",
    searchPlaceholder: "Search proxies",
    count: pageData.total,
  });

  proxyList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: DisplayUtils.emptyState(
      "还没有 SOCKS5 Proxy",
      "如果某些 Backend 需要固定出口代理，先在这里添加 SOCKS5 节点，再回到 Backend 里绑定。",
    ),
    headers: ["Proxy", "Status", "Bindings", "Traffic", "Latency", "Last Used", "Updated", "Actions"],
    rowsMarkup: pageData.items.map(renderProxyRow).join(""),
    paginationMarkup: PaginationUtils.renderPagination("proxies", pageData, {
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      paginationPageNumbers: ResourceStateUtils.paginationPageNumbers,
    }),
    escapeHTML: DisplayUtils.escapeHTML,
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

  PaginationUtils.bindPagination(proxyList, "proxies", renderProxies, state, { reportError });
  bindResourceToolbar(proxyList, "proxies", { create: startCreateProxy });
}

function renderBackends() {
  const backends = state.backends;
  const filtered = applyResourceView("backends", backends);
  const pageData = PaginationUtils.currentLocalPageData("backends", filtered, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
    count: pageData.total,
  });

  backendList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: DisplayUtils.emptyState(
      "还没有 Backend",
      "先配置至少一个 OpenAI 或 Claude/Anthropic 上游节点，之后模型路由和故障切换才会生效。",
    ),
    headers: ["Backend", "Routing", "Coverage", "Requests", "Avg Latency", "Last Used", "Recent 30m", "Actions"],
    rowsMarkup: pageData.items.map(renderBackendRow).join(""),
    paginationMarkup: PaginationUtils.renderPagination("backends", pageData, {
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      paginationPageNumbers: ResourceStateUtils.paginationPageNumbers,
    }),
    escapeHTML: DisplayUtils.escapeHTML,
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

  PaginationUtils.bindPagination(backendList, "backends", renderBackends, state, { reportError });
  bindResourceToolbar(backendList, "backends", { create: startCreateBackend });
}

function renderClients() {
  const clients = state.clients;
  const filtered = applyResourceView("clients", clients);
  const pageData = PaginationUtils.currentLocalPageData("clients", filtered, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "clients",
    searchPlaceholder: "Search client keys",
    count: pageData.total,
  });

  clientList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: DisplayUtils.emptyState(
      "还没有 Client Key",
      "创建一个客户端 key 后，外部 SDK 或 AI 客户端才能通过 Token Gate 访问后端模型。",
    ),
    headers: ["Client Key", "Status", "Routing", "Usage", "Last Used", "Updated", "Actions"],
    rowsMarkup: pageData.items.map(renderClientRow).join(""),
    paginationMarkup: PaginationUtils.renderPagination("clients", pageData, {
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      paginationPageNumbers: ResourceStateUtils.paginationPageNumbers,
    }),
    escapeHTML: DisplayUtils.escapeHTML,
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

  PaginationUtils.bindPagination(clientList, "clients", renderClients, state, { reportError });
  bindResourceToolbar(clientList, "clients", { create: startCreateClient });
}

function renderPolicies() {
  const policies = state.policies;
  const filtered = applyResourceView("policies", policies);
  const pageData = PaginationUtils.currentLocalPageData("policies", filtered, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
  const toolbar = buildResourceToolbarMarkup({
    resourceKey: "policies",
    searchPlaceholder: "Search policies",
    count: pageData.total,
  });

  policyList.innerHTML = ResourceViewUtils.renderResourceTablePage({
    toolbar,
    isEmpty: filtered.length === 0,
    emptyMarkup: DisplayUtils.emptyState(
      "还没有 Model Policy",
      "定义模型模式、端点和 placement 策略后，路由行为才会按业务意图收敛。",
    ),
    headers: ["Pattern", "Routing", "Usage", "Coverage", "Last Used", "Updated", "Actions"],
    rowsMarkup: pageData.items.map(renderPolicyRow).join(""),
    paginationMarkup: PaginationUtils.renderPagination("policies", pageData, {
      pageSizeOptions: PAGE_SIZE_OPTIONS,
      paginationPageNumbers: ResourceStateUtils.paginationPageNumbers,
    }),
    escapeHTML: DisplayUtils.escapeHTML,
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

  PaginationUtils.bindPagination(policyList, "policies", renderPolicies, state, { reportError });
  bindResourceToolbar(policyList, "policies", { create: startCreatePolicy });
}

function renderProxyRow(proxy) {
  return ResourceViewUtils.renderProxyRow({
    proxy,
    expanded: state.expandedProxies.has(String(proxy.id)),
    editing: String(state.editingProxyID) === String(proxy.id),
    quickDetails: buildQuickDetailMarkup("proxies", proxy),
    statusPill: DisplayUtils.statusPill,
    formatBindingCount: DisplayUtils.formatBindingCount,
    formatDataSize: DisplayUtils.formatDataSize,
    formatLatency: DisplayUtils.formatLatency,
    formatDateTime: DisplayUtils.formatDateTime,
    tableActions: DisplayUtils.tableActions,
    escapeHTML: DisplayUtils.escapeHTML,
  });
}

function renderBackendRow(backend) {
  return ResourceViewUtils.renderBackendRow({
    backend,
    expanded: state.expandedBackends.has(String(backend.id)),
    editing: String(state.editingBackendID) === String(backend.id),
    quickDetails: buildQuickDetailMarkup("backends", backend),
    statusPill: DisplayUtils.statusPill,
    formatBackendRouting: DisplayUtils.formatBackendRouting,
    formatBackendCoverage: DisplayUtils.formatBackendCoverage,
    backendProtocolLabel: DisplayUtils.backendProtocolLabel,
    formatUsageCount: DisplayUtils.formatUsageCount,
    formatLatency: DisplayUtils.formatLatency,
    formatDateTime: DisplayUtils.formatDateTime,
    formatBackendRecentStats: DisplayUtils.formatBackendRecentStats,
    tableActions: DisplayUtils.tableActions,
    escapeHTML: DisplayUtils.escapeHTML,
  });
}

function renderClientRow(client) {
  return ResourceViewUtils.renderClientRow({
    client,
    expanded: state.expandedClients.has(String(client.id)),
    editing: String(state.editingClientID) === String(client.id),
    quickDetails: buildQuickDetailMarkup("clients", client),
    clientTokenText: DisplayUtils.clientTokenDisplay(client),
    statusPill: DisplayUtils.statusPill,
    formatUsageCount: DisplayUtils.formatUsageCount,
    formatDateTime: DisplayUtils.formatDateTime,
    tableActions: DisplayUtils.tableActions,
    escapeHTML: DisplayUtils.escapeHTML,
  });
}

function renderPolicyRow(policy) {
  return ResourceViewUtils.renderPolicyRow({
    policy,
    expanded: state.expandedPolicies.has(String(policy.id)),
    editing: String(state.editingPolicyID) === String(policy.id),
    quickDetails: buildQuickDetailMarkup("policies", policy),
    formatPolicyRouting: DisplayUtils.formatPolicyRouting,
    formatUsageCount: DisplayUtils.formatUsageCount,
    formatPolicyCoverage: DisplayUtils.formatPolicyCoverage,
    formatDateTime: DisplayUtils.formatDateTime,
    tableActions: DisplayUtils.tableActions,
    escapeHTML: DisplayUtils.escapeHTML,
  });
}

function bindResourceRowOpen(container, kind) {
  container.querySelectorAll("[data-row-open]").forEach((row) => {
    row.setAttribute("tabindex", "0");
    const resourceTitle = row.dataset.rowTitle || (
      typeof DrawerUtils.drawerDisplayTitle === "function"
        ? DrawerUtils.drawerDisplayTitle(kind)
        : DrawerViewUtils.drawerDisplayTitle(kind)
    );
    row.setAttribute("aria-label", `Open ${resourceTitle} detail`);
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
  const viewState = state.resourceViews[resourceKey] || ResourceStateUtils.defaultResourceView(resourceKey);
  const defaultView = ResourceStateUtils.defaultResourceView(resourceKey);
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
    escapeHTML: DisplayUtils.escapeHTML,
    toolbarStatusLabel: ResourceStateUtils.toolbarStatusLabel,
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
    state.resourceViews[resourceKey] = ResourceStateUtils.defaultResourceView(resourceKey);
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

function applyResourceView(resourceKey, items) {
  return ResourceStateUtils.applyResourceView(resourceKey, items, state.resourceViews);
}

function buildQuickDetailMarkup(resourceKey, record) {
  const sections = typeof RendererUtils.createQuickDetailSections === "function"
    ? RendererUtils.createQuickDetailSections(resourceKey, record)
    : [];
  return ResourceViewUtils.createQuickDetailMarkup({ sections, escapeHTML: DisplayUtils.escapeHTML });
}

function renderEvents() {
  const events = state.events;
  syncEventFilterInputs();
  const pageData = PaginationUtils.currentRemotePageData("events", events, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
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
      formatDateTime: DisplayUtils.formatDateTime,
      renderPagination(key, data) {
        return PaginationUtils.renderPagination(key, data, {
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          paginationPageNumbers: ResourceStateUtils.paginationPageNumbers,
        });
      },
      emptyState: DisplayUtils.emptyState,
      feedToneClass,
      escapeHTML: DisplayUtils.escapeHTML,
    })
    : "";

  PaginationUtils.bindPagination(eventList, "events", refreshAll, state, { reportError });
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
  const pageData = PaginationUtils.currentRemotePageData("usageLogs", logs, state, {
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    resourceStateUtils: ResourceStateUtils,
  });
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
      formatDateTime: DisplayUtils.formatDateTime,
      renderPagination(key, data) {
        return PaginationUtils.renderPagination(key, data, {
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          paginationPageNumbers: ResourceStateUtils.paginationPageNumbers,
        });
      },
      emptyState: DisplayUtils.emptyState,
      renderUsageLogInlineDetail,
      escapeHTML: DisplayUtils.escapeHTML,
    })
    : "";

  PaginationUtils.bindPagination(usageLogList, "usageLogs", refreshAll, state, { reportError });
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
      formatDateTime: DisplayUtils.formatDateTime,
      renderInlineDetail: () => renderUsageLogInlineDetail(row),
      escapeHTML: DisplayUtils.escapeHTML,
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
      escapeHTML: DisplayUtils.escapeHTML,
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

function toggleExpanded(set, id) {
  const normalizedID = String(id);
  if (set.has(normalizedID)) {
    set.delete(normalizedID);
    return;
  }
  set.add(normalizedID);
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

activatePage(pageIDFromHash());
refreshAll().catch(reportError);
