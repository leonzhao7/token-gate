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
const notificationMenuBtn = document.querySelector("#notificationMenuBtn");
const profileMenuBtn = document.querySelector("#profileMenuBtn");
const headerPanelRoot = document.querySelector("#headerPanelRoot");
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
const SIDEBAR_COLLAPSED_KEY = "token-gate-sidebar-collapsed";
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
const DrawerRuntimeUtils = typeof ResourceRuntimeUtils.requireDrawerRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireDrawerRuntimeUtils(globalThis.DrawerRuntimeUtils)
  : (() => {
    throw new Error("drawer-runtime.js failed to load before app.js");
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
const DashboardRuntimeUtils = typeof ResourceRuntimeUtils.requireDashboardRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireDashboardRuntimeUtils(globalThis.DashboardRuntimeUtils)
  : (() => {
    throw new Error("dashboard-runtime.js failed to load before app.js");
  })();
const SearchRuntimeUtils = typeof ResourceRuntimeUtils.requireSearchRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireSearchRuntimeUtils(globalThis.SearchRuntimeUtils)
  : (() => {
    throw new Error("search-runtime.js failed to load before app.js");
  })();
const ObservabilityRuntimeUtils = typeof ResourceRuntimeUtils.requireObservabilityRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireObservabilityRuntimeUtils(globalThis.ObservabilityRuntimeUtils)
  : (() => {
    throw new Error("observability-runtime.js failed to load before app.js");
  })();
const ResourceListRuntimeUtils = typeof ResourceRuntimeUtils.requireResourceListRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireResourceListRuntimeUtils(globalThis.ResourceListRuntimeUtils)
  : (() => {
    throw new Error("resource-list-runtime.js failed to load before app.js");
  })();
const ResourceRenderRuntimeUtils = typeof ResourceRuntimeUtils.requireResourceRenderRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireResourceRenderRuntimeUtils(globalThis.ResourceRenderRuntimeUtils)
  : (() => {
    throw new Error("resource-runtime.js failed to load before app.js");
  })();
const ResourceDataRuntimeUtils = typeof ResourceRuntimeUtils.requireResourceDataRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireResourceDataRuntimeUtils(globalThis.ResourceDataRuntimeUtils)
  : (() => {
    throw new Error("resource-runtime.js failed to load before app.js");
  })();
const ConsoleDataRuntimeUtils = typeof ResourceRuntimeUtils.requireConsoleDataRuntimeUtils === "function"
  ? ResourceRuntimeUtils.requireConsoleDataRuntimeUtils(globalThis.ConsoleDataRuntimeUtils)
  : (() => {
    throw new Error("resource-runtime.js failed to load before app.js");
  })();
const escapeHTML = DisplayUtils.escapeHTML;
const formatDateTime = DisplayUtils.formatDateTime;
const DashboardUtils = globalThis.DashboardUtils || {};
const DashboardViewUtils = typeof ResourceRuntimeUtils.requireDashboardViewUtils === "function"
  ? ResourceRuntimeUtils.requireDashboardViewUtils(globalThis.DashboardViewUtils)
  : (() => {
    throw new Error("dashboard-view.js failed to load before app.js");
  })();
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
    headerPanels: typeof ShellStateUtils.createHeaderPanelState === "function"
      ? ShellStateUtils.createHeaderPanelState()
      : { active: "" },
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
  return ResourceDataRuntimeUtils.renderProxyOptions({
    backendForm,
    state,
    displayUtils: DisplayUtils,
  });
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

function initializeSidebarState() {
  ShellRuntimeUtils.initializeSidebarState({
    appShell,
    sidebarRoot,
    localStorage,
    sidebarCollapsedKey: SIDEBAR_COLLAPSED_KEY,
    shellStateUtils: ShellStateUtils,
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
  renderHeaderPanels();
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
    localStorage,
    sidebarCollapsedKey: SIDEBAR_COLLAPSED_KEY,
    shellStateUtils: ShellStateUtils,
  });
  renderSettings();
  renderHeaderPanels();
}

tokenInput.value = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
initializeThemeState();
initializeSidebarState();
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

notificationMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleHeaderPanel("notifications");
});

profileMenuBtn?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleHeaderPanel("profile");
});

headerPanelRoot?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-header-action]");
  if (!actionButton) {
    event.stopPropagation();
    return;
  }
  event.stopPropagation();
  handleSettingsAction(actionButton.dataset.headerAction || "")
    .then(() => closeHeaderPanel())
    .catch(reportError);
});

document.addEventListener("click", (event) => {
  if (!state.ui.headerPanels.active) {
    return;
  }
  if (headerPanelRoot?.contains(event.target) || notificationMenuBtn?.contains(event.target) || profileMenuBtn?.contains(event.target)) {
    return;
  }
  closeHeaderPanel();
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

async function saveAdminToken() {
  const token = tokenInput.value.trim();
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  renderSettings();
  renderHeaderPanels();
  return refreshAll();
}

saveTokenBtn.addEventListener("click", () => {
  saveAdminToken().catch(reportError);
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
    if (state.ui.headerPanels.active) {
      event.preventDefault();
      closeHeaderPanel();
      return;
    }
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
  if (!buildSettingsSnapshot().adminTokenPresent) {
    renderSettings();
    renderHeaderPanels();
    return null;
  }
  const result = await ConsoleDataRuntimeUtils.refreshAll({
    state,
    startDashboardLoading,
    renderDashboardShell,
    refreshDashboardData,
    reportError,
    buildUsageLogQuery,
    buildEventQuery,
    buildEventSummaryQuery,
    buildUsageLogStatsQuery,
    fetchAllCollectionPages,
    api,
    displayUtils: DisplayUtils,
    paginationUtils: PaginationUtils,
    resourceStateUtils: ResourceStateUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    renderProxyOptions,
    renderUsageLogFilterOptions,
    renderProxies,
    renderBackends,
    renderClients,
    renderPolicies,
    renderEvents,
    renderUsageLogs,
    renderDrawerShell,
    renderSearchShell,
    renderTheme,
  });
  renderHeaderPanels();
  return result;
}

function buildUsageLogQuery() {
  return ObservabilityRuntimeUtils.buildUsageLogQuery({
    state,
    observabilityUtils: ObservabilityUtils,
  });
}

function buildUsageLogStatsQuery() {
  return ObservabilityRuntimeUtils.buildUsageLogStatsQuery({
    state,
    observabilityUtils: ObservabilityUtils,
  });
}

function buildEventQuery() {
  return ObservabilityRuntimeUtils.buildEventQuery({
    state,
    observabilityUtils: ObservabilityUtils,
  });
}

function buildEventSummaryQuery() {
  return ObservabilityRuntimeUtils.buildEventSummaryQuery({
    state,
    observabilityUtils: ObservabilityUtils,
  });
}

function syncEventFilterInputs() {
  ObservabilityRuntimeUtils.syncEventFilterInputs({
    state,
    eventQueryFilter,
    eventActorFilter,
    eventBackendFilter,
    eventCategoryFilter,
    eventSeverityFilter,
    eventDateFromFilter,
    eventDateToFilter,
  });
}

async function applyEventFilters() {
  await ObservabilityRuntimeUtils.applyEventFilters({
    state,
    refreshAll,
    eventQueryFilter,
    eventActorFilter,
    eventBackendFilter,
    eventCategoryFilter,
    eventSeverityFilter,
    eventDateFromFilter,
    eventDateToFilter,
  });
}

async function resetEventFilters() {
  await ObservabilityRuntimeUtils.resetEventFilters({
    state,
    refreshAll,
    eventQueryFilter,
    eventActorFilter,
    eventBackendFilter,
    eventCategoryFilter,
    eventSeverityFilter,
    eventDateFromFilter,
    eventDateToFilter,
  });
}

async function refreshEvents() {
  await ObservabilityRuntimeUtils.refreshEvents({ refreshAll });
}

function syncUsageLogFilterInputs() {
  ObservabilityRuntimeUtils.syncUsageLogFilterInputs({
    state,
    usageLogQueryFilter,
    usageLogDateFromFilter,
    usageLogDateToFilter,
    usageLogBackendFilter,
    usageLogModelFilter,
    usageLogClientKeyFilter,
    usageLogPolicyFilter,
    usageLogProxyFilter,
    usageLogStatusFilter,
  });
}

async function applyUsageLogFilters() {
  await ObservabilityRuntimeUtils.applyUsageLogFilters({
    state,
    refreshAll,
    usageLogQueryFilter,
    usageLogDateFromFilter,
    usageLogDateToFilter,
    usageLogBackendFilter,
    usageLogModelFilter,
    usageLogClientKeyFilter,
    usageLogPolicyFilter,
    usageLogProxyFilter,
    usageLogStatusFilter,
  });
}

async function resetUsageLogFilters() {
  await ObservabilityRuntimeUtils.resetUsageLogFilters({
    state,
    refreshAll,
    usageLogQueryFilter,
    usageLogDateFromFilter,
    usageLogDateToFilter,
    usageLogBackendFilter,
    usageLogModelFilter,
    usageLogClientKeyFilter,
    usageLogPolicyFilter,
    usageLogProxyFilter,
    usageLogStatusFilter,
  });
}

async function refreshUsageLogs() {
  await ObservabilityRuntimeUtils.refreshUsageLogs({ refreshAll });
}

async function clearUsageLogs() {
  await ObservabilityRuntimeUtils.clearUsageLogs({
    state,
    confirm,
    alert,
    api,
    refreshAll,
  });
}

async function deleteFilteredUsageLogs() {
  await ObservabilityRuntimeUtils.deleteFilteredUsageLogs({
    state,
    observabilityUtils: ObservabilityUtils,
    confirm,
    alert,
    api,
    refreshAll,
  });
}

function buildUsageLogDeleteQuery() {
  return buildUsageLogStatsQuery();
}

function renderUsageLogFilterOptions() {
  ObservabilityRuntimeUtils.renderUsageLogFilterOptions({
    state,
    displayUtils: DisplayUtils,
    usageLogBackendOptions,
    usageLogModelOptions,
    usageLogClientKeyOptions,
    usageLogPolicyOptions,
    usageLogProxyOptions,
  });
}

async function refreshDashboardData() {
  return ConsoleDataRuntimeUtils.refreshDashboardData({
    state,
    api,
    dashboardUtils: DashboardUtils,
    renderDashboardShell,
  });
}

function startDashboardLoading() {
  DashboardRuntimeUtils.startDashboardLoading({ state });
}

async function handleSettingsAction(action) {
  return ConsoleDataRuntimeUtils.handleSettingsAction({
    action,
    tokenInput,
    refreshAll,
    cycleThemePreference,
    toggleSidebarCollapsed,
    openSearchShell,
    navigateToPage,
  });
}

function renderDashboardShell() {
  if (!dashboardRoot) {
    return;
  }
  const panels = DashboardRuntimeUtils.renderDashboardPanels({
    dashboard: state.dashboard,
    dashboardUtils: DashboardUtils,
    dashboardViewUtils: DashboardViewUtils,
    renderSparkline(values, options) {
      return DashboardViewUtils.renderSparkline(values, options, ChartsUtils);
    },
    renderAreaChart(values, labels, options) {
      return DashboardViewUtils.renderAreaChart(values, labels, options, ChartsUtils);
    },
    formatDateTime,
    feedToneClass,
    escapeHTML,
  });
  DashboardRuntimeUtils.renderDashboardShell({
    state,
    dashboardRoot,
    dashboardSummaryRow,
    dashboardUsageCard,
    dashboardEventsSummaryCard,
    dashboardRecentEventsCard,
    dashboardRecentUsageCard,
    renderSummaryRow() {
      return panels.summary;
    },
    renderUsageCard() {
      return panels.usage;
    },
    renderEventsSummaryCard() {
      return panels.eventsSummary;
    },
    renderRecentEventsCard() {
      return panels.recentEvents;
    },
    renderRecentUsageCard() {
      return panels.recentUsage;
    },
    bindInteractions: bindDashboardInteractions,
  });
}

function renderDrawerShell() {
  return DrawerRuntimeUtils.renderDrawerShell({
    state,
    drawerRoot,
    drawerTitle,
    drawerTabRoot,
    drawerBodyRoot,
    drawerFooterRoot,
    drawerUtils: DrawerUtils,
    drawerViewUtils: DrawerViewUtils,
    escapeHTML,
    formatDateTime,
    openDrawerEditor,
    deleteDrawerResource,
    reportError,
    rerender: renderDrawerShell,
  });
}

function closeDrawerShell() {
  return DrawerRuntimeUtils.closeDrawerShell({
    state,
    renderDrawerShell,
    HTMLElementClass: HTMLElement,
  });
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

function currentHeaderPanelViewModel() {
  return typeof ShellStateUtils.createHeaderPanelViewModel === "function"
    ? ShellStateUtils.createHeaderPanelViewModel({
      activePanel: state.ui.headerPanels.active,
      dashboard: state.dashboard,
      ui: {
        ...state.ui,
        lastRefreshAt: state.ui.lastRefreshAt ? formatDateTime(state.ui.lastRefreshAt) : "",
      },
    })
    : { activePanel: state.ui.headerPanels.active };
}

function renderHeaderPanels() {
  return ShellRuntimeUtils.renderHeaderPanels({
    headerPanelRoot,
    notificationMenuBtn,
    profileMenuBtn,
    shellViewUtils: ShellViewUtils,
    viewModel: currentHeaderPanelViewModel(),
  });
}

function toggleHeaderPanel(panel) {
  return ShellRuntimeUtils.toggleHeaderPanel({
    state,
    panel,
    renderHeaderPanels,
  });
}

function closeHeaderPanel() {
  return ShellRuntimeUtils.closeHeaderPanel({
    state,
    renderHeaderPanels,
  });
}

function bindDashboardInteractions() {
  return DashboardRuntimeUtils.bindDashboardInteractions({
    dashboardRoot,
    state,
    renderDashboardShell,
    refreshDashboardUsagePanel,
    retryDashboardSection,
    reportError,
  });
}

async function refreshDashboardUsagePanel() {
  return DashboardRuntimeUtils.refreshDashboardUsagePanel({
    state,
    api,
    dashboardUtils: DashboardUtils,
    renderDashboardShell,
  });
}

async function retryDashboardSection(target) {
  return DashboardRuntimeUtils.retryDashboardSection({
    target,
    state,
    api,
    dashboardUtils: DashboardUtils,
    startDashboardLoading,
    renderDashboardShell,
    refreshDashboardData,
  });
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
  return SearchRuntimeUtils.closeSearchShell({
    state,
    searchUtils: SearchUtils,
    searchDebounce,
    renderSearchShell,
    HTMLElementClass: HTMLElement,
  });
}

function openSearchShell() {
  return SearchRuntimeUtils.openSearchShell({
    state,
    searchUtils: SearchUtils,
    renderSearchShell,
    searchInput,
    searchModalPanel,
    searchOpenBtn,
    documentObject: document,
    HTMLElementClass: HTMLElement,
    triggerSearch,
  });
}

function updateSearchQuery(value) {
  return SearchRuntimeUtils.updateSearchQuery({
    state,
    value,
    searchUtils: SearchUtils,
    searchDebounce,
    triggerSearch,
  });
}

function triggerSearch() {
  return SearchRuntimeUtils.triggerSearch({
    state,
    searchUtils: SearchUtils,
    searchDebounce,
    reportError,
    executeSearch,
    renderSearchShell,
  });
}

async function executeSearch(request) {
  return SearchRuntimeUtils.executeSearch({
    state,
    request,
    searchUtils: SearchUtils,
    api,
    searchLimit: SEARCH_LIMIT,
    renderSearchShell,
    currentSearchKeyboardState,
  });
}

function renderSearchResults() {
  return SearchRuntimeUtils.renderSearchResults({
    state,
    shellViewUtils: ShellViewUtils,
    currentSearchKeyboardState,
    escapeHTML,
  });
}

async function fetchAllCollectionPages(basePath) {
  return ResourceDataRuntimeUtils.fetchAllCollectionPages({
    basePath,
    api,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  });
}

async function refreshResourceList(resourceKey) {
  return ResourceDataRuntimeUtils.refreshResourceList({
    resourceKey,
    state,
    fetchAllCollectionPages,
    renderProxies,
    renderBackends,
    renderClients,
    renderPolicies,
  });
}

function navigateToSearchResult(payload) {
  return SearchRuntimeUtils.navigateToSearchResult({
    payload,
    searchUtils: SearchUtils,
    windowObject: window,
    activatePage,
    closeSearchShell,
    openResourceDrawer,
    reportError,
  });
}

function currentSearchKeyboardState() {
  return SearchRuntimeUtils.currentSearchKeyboardState({
    state,
    searchUtils: SearchUtils,
  });
}

function moveSearchSelection(delta) {
  return SearchRuntimeUtils.moveSearchSelection({
    state,
    delta,
    searchUtils: SearchUtils,
    currentSearchKeyboardState,
    renderSearchShell,
  });
}

async function openResourceDrawer(target) {
  return DrawerRuntimeUtils.openResourceDrawer({
    target,
    state,
    drawerUtils: DrawerUtils,
    api,
    renderDrawerShell,
    drawerPanel,
    documentObject: document,
    HTMLElementClass: HTMLElement,
  });
}

function openDrawerEditor() {
  return DrawerRuntimeUtils.openDrawerEditor({
    state,
    closeDrawerShell,
    startEditBackend,
    startEditClient,
    startEditPolicy,
    startEditProxy,
  });
}

async function deleteDrawerResource() {
  return DrawerRuntimeUtils.deleteDrawerResource({
    state,
    drawerUtils: DrawerUtils,
    drawerViewUtils: DrawerViewUtils,
    confirm,
    api,
    closeDrawerShell,
    refreshAll,
  });
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
  ResourceListRuntimeUtils.renderManagedResourceSection({
    resourceKey: "proxies",
    kind: "proxy",
    items: state.proxies,
    state,
    container: proxyList,
    searchPlaceholder: "Search proxies",
    emptyTitle: "还没有 SOCKS5 Proxy",
    emptyDescription: "如果某些 Backend 需要固定出口代理，先在这里添加 SOCKS5 节点，再回到 Backend 里绑定。",
    headers: ["Proxy", "Status", "Bindings", "Traffic", "Latency", "Last Used", "Updated", "Actions"],
    rowRenderer: renderProxyRow,
    resourceViewConfig: RESOURCE_VIEW_CONFIG,
    rendererUtils: RendererUtils,
    resourceViewUtils: ResourceViewUtils,
    resourceStateUtils: ResourceStateUtils,
    paginationUtils: PaginationUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    getExpandedSet() {
      return state.expandedProxies;
    },
    getEditingID() {
      return state.editingProxyID;
    },
    renderList: renderProxies,
    startEdit: startEditProxy,
    resetForm: resetProxyForm,
    refreshAll,
    confirm,
    deleteMessage: "确认删除这个 SOCKS5 Proxy？已绑定的 Backend 会自动改为直连。",
    deletePath(id) {
      return `/admin/api/socks-proxies/${id}`;
    },
    toggleExpanded,
    api,
    drawerUtils: DrawerUtils,
    drawerViewUtils: DrawerViewUtils,
    openResourceDrawer,
    renderResourceListByKey,
    refreshResourceList,
    reportError,
    onCreate: startCreateProxy,
  });
}

function renderBackends() {
  ResourceListRuntimeUtils.renderManagedResourceSection({
    resourceKey: "backends",
    kind: "backend",
    items: state.backends,
    state,
    container: backendList,
    searchPlaceholder: "Search backends",
    emptyTitle: "还没有 Backend",
    emptyDescription: "先配置至少一个 OpenAI 或 Claude/Anthropic 上游节点，之后模型路由和故障切换才会生效。",
    headers: ["Backend", "Routing", "Coverage", "Requests", "Avg Latency", "Last Used", "Recent 30m", "Actions"],
    rowRenderer: renderBackendRow,
    resourceViewConfig: RESOURCE_VIEW_CONFIG,
    rendererUtils: RendererUtils,
    resourceViewUtils: ResourceViewUtils,
    resourceStateUtils: ResourceStateUtils,
    paginationUtils: PaginationUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    getExpandedSet() {
      return state.expandedBackends;
    },
    getEditingID() {
      return state.editingBackendID;
    },
    renderList: renderBackends,
    startEdit: startEditBackend,
    resetForm: resetBackendForm,
    refreshAll,
    confirm,
    deleteMessage: "确认删除这个 Backend？",
    deletePath(id) {
      return `/admin/api/backends/${id}`;
    },
    toggleExpanded,
    api,
    drawerUtils: DrawerUtils,
    drawerViewUtils: DrawerViewUtils,
    openResourceDrawer,
    renderResourceListByKey,
    refreshResourceList,
    reportError,
    onCreate: startCreateBackend,
  });
}

function renderClients() {
  ResourceListRuntimeUtils.renderManagedResourceSection({
    resourceKey: "clients",
    kind: "client",
    items: state.clients,
    state,
    container: clientList,
    searchPlaceholder: "Search client keys",
    emptyTitle: "还没有 Client Key",
    emptyDescription: "创建一个客户端 key 后，外部 SDK 或 AI 客户端才能通过 Token Gate 访问后端模型。",
    headers: ["Client Key", "Status", "Routing", "Usage", "Last Used", "Updated", "Actions"],
    rowRenderer: renderClientRow,
    resourceViewConfig: RESOURCE_VIEW_CONFIG,
    rendererUtils: RendererUtils,
    resourceViewUtils: ResourceViewUtils,
    resourceStateUtils: ResourceStateUtils,
    paginationUtils: PaginationUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    getExpandedSet() {
      return state.expandedClients;
    },
    getEditingID() {
      return state.editingClientID;
    },
    renderList: renderClients,
    startEdit: startEditClient,
    resetForm: resetClientForm,
    refreshAll,
    confirm,
    deleteMessage: "确认删除这个 Client Key？",
    deletePath(id) {
      return `/admin/api/client-keys/${id}`;
    },
    toggleExpanded,
    api,
    drawerUtils: DrawerUtils,
    drawerViewUtils: DrawerViewUtils,
    openResourceDrawer,
    renderResourceListByKey,
    refreshResourceList,
    reportError,
    onCreate: startCreateClient,
  });
}

function renderPolicies() {
  ResourceListRuntimeUtils.renderManagedResourceSection({
    resourceKey: "policies",
    kind: "policy",
    items: state.policies,
    state,
    container: policyList,
    searchPlaceholder: "Search policies",
    emptyTitle: "还没有 Model Policy",
    emptyDescription: "定义模型模式、端点和 placement 策略后，路由行为才会按业务意图收敛。",
    headers: ["Pattern", "Routing", "Usage", "Coverage", "Last Used", "Updated", "Actions"],
    rowRenderer: renderPolicyRow,
    resourceViewConfig: RESOURCE_VIEW_CONFIG,
    rendererUtils: RendererUtils,
    resourceViewUtils: ResourceViewUtils,
    resourceStateUtils: ResourceStateUtils,
    paginationUtils: PaginationUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    getExpandedSet() {
      return state.expandedPolicies;
    },
    getEditingID() {
      return state.editingPolicyID;
    },
    renderList: renderPolicies,
    startEdit: startEditPolicy,
    resetForm: resetPolicyForm,
    refreshAll,
    confirm,
    deleteMessage: "确认删除这个 Model Policy？",
    deletePath(id) {
      return `/admin/api/model-policies/${id}`;
    },
    toggleExpanded,
    api,
    drawerUtils: DrawerUtils,
    drawerViewUtils: DrawerViewUtils,
    openResourceDrawer,
    renderResourceListByKey,
    refreshResourceList,
    reportError,
    onCreate: startCreatePolicy,
  });
}

function renderProxyRow(proxy) {
  return ResourceRenderRuntimeUtils.renderProxyRow({
    proxy,
    state,
    buildQuickDetailMarkup,
    resourceViewUtils: ResourceViewUtils,
    displayUtils: DisplayUtils,
  });
}

function renderBackendRow(backend) {
  return ResourceRenderRuntimeUtils.renderBackendRow({
    backend,
    state,
    buildQuickDetailMarkup,
    resourceViewUtils: ResourceViewUtils,
    displayUtils: DisplayUtils,
  });
}

function renderClientRow(client) {
  return ResourceRenderRuntimeUtils.renderClientRow({
    client,
    state,
    buildQuickDetailMarkup,
    resourceViewUtils: ResourceViewUtils,
    displayUtils: DisplayUtils,
  });
}

function renderPolicyRow(policy) {
  return ResourceRenderRuntimeUtils.renderPolicyRow({
    policy,
    state,
    buildQuickDetailMarkup,
    resourceViewUtils: ResourceViewUtils,
    displayUtils: DisplayUtils,
  });
}

function renderResourceListByKey(resourceKey) {
  return ResourceRenderRuntimeUtils.renderResourceListByKey({
    resourceKey,
    renderProxies,
    renderBackends,
    renderClients,
    renderPolicies,
  });
}

function buildQuickDetailMarkup(resourceKey, record) {
  return ResourceRenderRuntimeUtils.buildQuickDetailMarkup({
    resourceKey,
    record,
    rendererUtils: RendererUtils,
    resourceViewUtils: ResourceViewUtils,
    displayUtils: DisplayUtils,
  });
}

function renderEvents() {
  ObservabilityRuntimeUtils.renderEvents({
    state,
    eventList,
    observabilityUtils: ObservabilityUtils,
    observabilityViewUtils: ObservabilityViewUtils,
    paginationUtils: PaginationUtils,
    resourceStateUtils: ResourceStateUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    refreshAll,
    reportError,
    feedToneClass,
    openResourceDrawer,
    eventQueryFilter,
    eventActorFilter,
    eventBackendFilter,
    eventCategoryFilter,
    eventSeverityFilter,
    eventDateFromFilter,
    eventDateToFilter,
  });
}

function renderUsageLogs() {
  ObservabilityRuntimeUtils.renderUsageLogs({
    state,
    usageLogList,
    deleteUsageLogsBtn,
    observabilityUtils: ObservabilityUtils,
    observabilityViewUtils: ObservabilityViewUtils,
    paginationUtils: PaginationUtils,
    resourceStateUtils: ResourceStateUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    refreshAll,
    reportError,
    openResourceDrawer,
    renderUsageLogInlineDetail,
    toggleExpanded,
    usageLogQueryFilter,
    usageLogDateFromFilter,
    usageLogDateToFilter,
    usageLogBackendFilter,
    usageLogModelFilter,
    usageLogClientKeyFilter,
    usageLogPolicyFilter,
    usageLogProxyFilter,
    usageLogStatusFilter,
  });
}

function renderUsageLogInlineDetail(row) {
  return ObservabilityRuntimeUtils.renderUsageLogInlineDetail({
    row,
    state,
    observabilityUtils: ObservabilityUtils,
    observabilityViewUtils: ObservabilityViewUtils,
    displayUtils: DisplayUtils,
    primeUsageLogDetail,
  });
}

async function primeUsageLogDetail(id) {
  await ObservabilityRuntimeUtils.primeUsageLogDetail({
    id,
    state,
    api,
    renderUsageLogs,
  });
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
