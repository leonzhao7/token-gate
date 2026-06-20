import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ResourceViewUtils = require("./resource-view.js");
const ResourceStateUtils = require("./resource-state.js");
const { requireResourceViewUtils } = require("./resource-runtime.js");
const { requireResourceStateUtils } = require("./resource-runtime.js");
const { requireResourceCrudUtils } = require("./resource-runtime.js");
const { requireShellStateUtils } = require("./resource-runtime.js");
const { requireShellViewUtils } = require("./resource-runtime.js");
const { requireDrawerViewUtils } = require("./resource-runtime.js");
const { requireShellRuntimeUtils } = require("./resource-runtime.js");
const { requirePaginationUtils } = require("./resource-runtime.js");
const { requireDisplayUtils } = require("./resource-runtime.js");
const { requireDashboardRuntimeUtils } = require("./resource-runtime.js");
const { requireSearchRuntimeUtils } = require("./resource-runtime.js");
const { requireObservabilityRuntimeUtils } = require("./resource-runtime.js");
const { requireResourceListRuntimeUtils } = require("./resource-runtime.js");
const ResourceCrudUtils = require("./resource-crud.js");
const ShellStateUtils = require("./shell-state.js");
const ShellViewUtils = require("./shell-view.js");
const DrawerViewUtils = require("./drawer-view.js");
const ShellRuntimeUtils = require("./shell-runtime.js");
const PaginationUtils = require("./pagination.js");
const DisplayUtils = require("./display-utils.js");
const DashboardRuntimeUtils = require("./dashboard-runtime.js");
const SearchRuntimeUtils = require("./search-runtime.js");
const ObservabilityRuntimeUtils = require("./observability-runtime.js");
const ResourceListRuntimeUtils = require("./resource-list-runtime.js");
const ThemeUtils = require("./theme.js");
const SettingsUtils = require("./settings.js");

test("requireResourceViewUtils returns the resource view api when all required functions exist", () => {
  const resourceView = requireResourceViewUtils(ResourceViewUtils);
  const html = resourceView.renderResourceTablePage({
    toolbar: "<div>toolbar</div>",
    isEmpty: false,
    emptyMarkup: "",
    headers: ["Name"],
    rowsMarkup: "<tr><td>edge-a</td></tr>",
    paginationMarkup: "<nav>pager</nav>",
  });

  assert.match(html, /toolbar/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /pager/);
});

test("requireResourceViewUtils throws a clear error when resource-view utils are unavailable", () => {
  assert.throws(
    () => requireResourceViewUtils(null),
    /resource-view\.js.*load.*before app\.js/i,
  );
});

test("requireResourceStateUtils returns the resource state api when all required functions exist", () => {
  const resourceState = requireResourceStateUtils(ResourceStateUtils);
  assert.deepEqual(resourceState.defaultResourceView("policies"), {
    query: "",
    filter: "all",
    sort: "priority_asc",
  });
});

test("requireResourceStateUtils throws a clear error when resource-state utils are unavailable", () => {
  assert.throws(
    () => requireResourceStateUtils(null),
    /resource-state\.js.*load.*before app\.js/i,
  );
});

test("requireResourceStateUtils reports missing helper names for partial state modules", () => {
  assert.throws(
    () => requireResourceStateUtils({
      defaultResourceView() {
        return { query: "", filter: "all", sort: "updated_desc" };
      },
      toolbarStatusLabel() {
        return "Default view";
      },
    }),
    /missing ResourceStateUtils methods: applyResourceView, currentLocalPageData, currentRemotePageData, applyPagedResponse, paginationPageNumbers/i,
  );
});

test("requireResourceCrudUtils returns the resource crud api when all required functions exist", () => {
  const resourceCrud = requireResourceCrudUtils(ResourceCrudUtils);
  assert.deepEqual(resourceCrud.parseModelMapping("gpt-4=gpt-4.1"), { "gpt-4": "gpt-4.1" });
  assert.equal(typeof resourceCrud.createResourceCrud, "function");
});

test("requireResourceCrudUtils throws a clear error when resource-crud utils are unavailable", () => {
  assert.throws(
    () => requireResourceCrudUtils(null),
    /resource-crud\.js.*load.*before app\.js/i,
  );
});

test("requireResourceCrudUtils reports exact missing helper names for partial crud modules", () => {
  assert.throws(
    () => requireResourceCrudUtils({
      createResourceCrud() {
        return {};
      },
      splitList() {
        return [];
      },
    }),
    /missing ResourceCrudUtils methods: parseModelMapping, formatModelMappingInput, readForm/i,
  );
});

test("app.js fails clearly during startup when resource view utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils: null,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-view\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when resource state utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils: null,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-state\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when resource crud utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils: null,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-crud\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when shell state utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils: null,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /shell-state\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when shell view utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils: null,
    DrawerViewUtils,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /shell-view\.js.*load.*before app\.js/i,
  );
});

test("requireDrawerViewUtils throws a clear error when drawer-view utils are unavailable", () => {
  assert.throws(
    () => requireDrawerViewUtils(null),
    /drawer-view\.js.*load.*before app\.js/i,
  );
});

test("requireDrawerViewUtils accepts a narrow drawer view api contract", () => {
  const drawerView = requireDrawerViewUtils({
    drawerDisplayTitle(kind) {
      return kind || "Resource";
    },
    renderDrawerShell() {
      return { isOpen: false, ariaHidden: "true", title: "Detail Drawer", tabs: "", body: "", footer: "" };
    },
  });

  assert.equal(typeof drawerView.drawerDisplayTitle, "function");
  assert.equal(typeof drawerView.renderDrawerShell, "function");
});

test("requirePaginationUtils returns the pagination api when app.js dependencies exist", () => {
  const pagination = requirePaginationUtils(PaginationUtils);

  assert.equal(typeof pagination.bindPagination, "function");
  assert.equal(typeof pagination.currentLocalPageData, "function");
  assert.equal(typeof pagination.currentRemotePageData, "function");
  assert.equal(typeof pagination.applyPagedResponse, "function");
  assert.equal(typeof pagination.renderPagination, "function");
});

test("requirePaginationUtils throws a clear error when pagination utils are unavailable", () => {
  assert.throws(
    () => requirePaginationUtils(null),
    /pagination\.js.*load.*before app\.js/i,
  );
});

test("requirePaginationUtils accepts a narrow pagination api contract", () => {
  const pagination = requirePaginationUtils({
    bindPagination() {},
    currentLocalPageData() {
      return {};
    },
    currentRemotePageData() {
      return {};
    },
    applyPagedResponse() {},
    renderPagination() {
      return "";
    },
  });

  assert.equal(typeof pagination.bindPagination, "function");
  assert.equal(typeof pagination.renderPagination, "function");
});

test("requireDisplayUtils returns the display api when app.js dependencies exist", () => {
  const display = requireDisplayUtils(createDisplayUtilsStub());

  assert.equal(typeof display.formatDateTime, "function");
  assert.equal(typeof display.escapeHTML, "function");
  assert.equal(typeof display.emptyState, "function");
  assert.equal(typeof display.formatLatency, "function");
  assert.equal(typeof display.tableActions, "function");
});

test("requireDisplayUtils throws a clear error when display utils are unavailable", () => {
  assert.throws(
    () => requireDisplayUtils(null),
    /display-utils\.js.*load.*before app\.js/i,
  );
});

test("requireDisplayUtils reports exact missing helper names for partial modules", () => {
  assert.throws(
    () => requireDisplayUtils(createDisplayUtilsStub({
      formatLatency: undefined,
      tableActions: undefined,
      ensureArray: undefined,
    })),
    /missing DisplayUtils methods: ensureArray, formatLatency, tableActions/i,
  );
});

test("requireDashboardRuntimeUtils returns the dashboard runtime api when app.js dependencies exist", () => {
  const runtime = requireDashboardRuntimeUtils(DashboardRuntimeUtils);

  assert.equal(typeof runtime.startDashboardLoading, "function");
  assert.equal(typeof runtime.renderDashboardShell, "function");
});

test("requireDashboardRuntimeUtils throws a clear error when dashboard runtime utils are unavailable", () => {
  assert.throws(
    () => requireDashboardRuntimeUtils(null),
    /dashboard-runtime\.js.*load.*before app\.js/i,
  );
});

test("requireDashboardRuntimeUtils accepts a narrow dashboard runtime api contract", () => {
  const runtime = requireDashboardRuntimeUtils({
    startDashboardLoading() {},
    renderDashboardShell() {
      return null;
    },
  });

  assert.equal(typeof runtime.startDashboardLoading, "function");
  assert.equal(typeof runtime.renderDashboardShell, "function");
});

test("requireSearchRuntimeUtils returns the search runtime api when app.js dependencies exist", () => {
  const runtime = requireSearchRuntimeUtils(SearchRuntimeUtils);

  assert.equal(typeof runtime.openSearchShell, "function");
  assert.equal(typeof runtime.executeSearch, "function");
});

test("requireSearchRuntimeUtils throws a clear error when search runtime utils are unavailable", () => {
  assert.throws(
    () => requireSearchRuntimeUtils(null),
    /search-runtime\.js.*load.*before app\.js/i,
  );
});

test("requireSearchRuntimeUtils accepts a narrow search runtime api contract", () => {
  const runtime = requireSearchRuntimeUtils({
    openSearchShell() {},
    closeSearchShell() {},
    updateSearchQuery() {},
    triggerSearch() {},
    executeSearch() {},
    renderSearchResults() {
      return "";
    },
    navigateToSearchResult() {},
    currentSearchKeyboardState() {
      return { items: [], activeIndex: -1, activeItem: null };
    },
    moveSearchSelection() {
      return -1;
    },
  });

  assert.equal(typeof runtime.openSearchShell, "function");
  assert.equal(typeof runtime.renderSearchResults, "function");
});

test("requireObservabilityRuntimeUtils returns the observability runtime api when app.js dependencies exist", () => {
  const runtime = requireObservabilityRuntimeUtils(ObservabilityRuntimeUtils);

  assert.equal(typeof runtime.buildUsageLogQuery, "function");
  assert.equal(typeof runtime.renderUsageLogs, "function");
});

test("requireObservabilityRuntimeUtils throws a clear error when observability runtime utils are unavailable", () => {
  assert.throws(
    () => requireObservabilityRuntimeUtils(null),
    /observability-runtime\.js.*load.*before app\.js/i,
  );
});

test("requireObservabilityRuntimeUtils accepts a narrow observability runtime api contract", () => {
  const runtime = requireObservabilityRuntimeUtils({
    buildUsageLogQuery() {
      return "";
    },
    buildUsageLogStatsQuery() {
      return "";
    },
    buildEventQuery() {
      return "";
    },
    buildEventSummaryQuery() {
      return "";
    },
    syncEventFilterInputs() {},
    applyEventFilters() {
      return Promise.resolve();
    },
    resetEventFilters() {
      return Promise.resolve();
    },
    refreshEvents() {
      return Promise.resolve();
    },
    syncUsageLogFilterInputs() {},
    applyUsageLogFilters() {
      return Promise.resolve();
    },
    resetUsageLogFilters() {
      return Promise.resolve();
    },
    refreshUsageLogs() {
      return Promise.resolve();
    },
    clearUsageLogs() {
      return Promise.resolve();
    },
    deleteFilteredUsageLogs() {
      return Promise.resolve();
    },
    renderUsageLogFilterOptions() {},
    renderEvents() {},
    renderUsageLogs() {},
    renderUsageLogInlineDetail() {
      return "";
    },
    primeUsageLogDetail() {
      return Promise.resolve();
    },
  });

  assert.equal(typeof runtime.buildEventQuery, "function");
  assert.equal(typeof runtime.primeUsageLogDetail, "function");
});

test("requireResourceListRuntimeUtils returns the resource list runtime api when app.js dependencies exist", () => {
  const runtime = requireResourceListRuntimeUtils(ResourceListRuntimeUtils);

  assert.equal(typeof runtime.bindResourceToolbar, "function");
  assert.equal(typeof runtime.bindResourceRowOpen, "function");
  assert.equal(typeof runtime.renderLocalResourceTable, "function");
});

test("requireResourceListRuntimeUtils throws a clear error when resource list runtime utils are unavailable", () => {
  assert.throws(
    () => requireResourceListRuntimeUtils(null),
    /resource-list-runtime\.js.*load.*before app\.js/i,
  );
});

test("requireResourceListRuntimeUtils accepts a narrow resource list runtime api contract", () => {
  const runtime = requireResourceListRuntimeUtils({
    bindResourceToolbar() {},
    bindResourceRowOpen() {},
    renderLocalResourceTable() {
      return { filtered: [], pageData: { items: [], page: 1, size: 10, total: 0, totalPages: 1 } };
    },
  });

  assert.equal(typeof runtime.bindResourceToolbar, "function");
  assert.equal(typeof runtime.bindResourceRowOpen, "function");
});

test("createAppVmContext injects search runtime helpers by default", () => {
  const context = createAppVmContext({
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
  });

  assert.equal(context.SearchRuntimeUtils, SearchRuntimeUtils);
  assert.equal(
    context.ResourceRuntimeUtils.requireSearchRuntimeUtils,
    requireSearchRuntimeUtils,
  );
});

test("createAppVmContext injects observability runtime helpers by default", () => {
  const context = createAppVmContext({
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
  });

  assert.equal(context.ObservabilityRuntimeUtils, ObservabilityRuntimeUtils);
  assert.equal(
    context.ResourceRuntimeUtils.requireObservabilityRuntimeUtils,
    requireObservabilityRuntimeUtils,
  );
});

test("createAppVmContext injects resource list runtime helpers by default", () => {
  const context = createAppVmContext({
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
  });

  assert.equal(context.ResourceListRuntimeUtils, ResourceListRuntimeUtils);
  assert.equal(
    context.ResourceRuntimeUtils.requireResourceListRuntimeUtils,
    requireResourceListRuntimeUtils,
  );
});

test("requireShellRuntimeUtils returns the shell runtime api when app.js dependencies exist", () => {
  const runtime = requireShellRuntimeUtils({
    pageIDFromHash() {
      return "overview";
    },
    activatePage() {},
    navigateToPage() {},
    initializeThemeState() {},
    persistThemePreference() {},
    applyResolvedTheme() {},
    renderTheme() {},
    renderSettings() {},
    buildSettingsSnapshot() {
      return {};
    },
    cycleThemePreference() {
      return "light";
    },
    toggleSidebarCollapsed() {
      return false;
    },
  });

  assert.equal(typeof runtime.pageIDFromHash, "function");
  assert.equal(typeof runtime.toggleSidebarCollapsed, "function");
});

test("requireShellRuntimeUtils reports exact missing shell runtime helpers for partial modules", () => {
  assert.throws(
    () => requireShellRuntimeUtils({
      pageIDFromHash() {
        return "overview";
      },
      activatePage() {},
    }),
    /missing ShellRuntimeUtils methods: navigateToPage, initializeThemeState, persistThemePreference, applyResolvedTheme, renderTheme, renderSettings, buildSettingsSnapshot, cycleThemePreference, toggleSidebarCollapsed/i,
  );
});

test("requireShellRuntimeUtils throws a clear error when shell-runtime utils are unavailable", () => {
  assert.throws(
    () => requireShellRuntimeUtils(null),
    /shell-runtime\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when drawer view utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils: null,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /drawer-view\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when shell runtime utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    ShellRuntimeUtils: null,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /shell-runtime\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when pagination utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    ShellRuntimeUtils,
    PaginationUtils: null,
    DisplayUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /pagination\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when display utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
      requireDisplayUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    ShellRuntimeUtils,
    PaginationUtils,
    DisplayUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /display-utils\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when dashboard runtime utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
      requireDisplayUtils,
      requireDashboardRuntimeUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    ShellRuntimeUtils,
    PaginationUtils,
    DisplayUtils,
    DashboardRuntimeUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /dashboard-runtime\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when search runtime utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
      requireDisplayUtils,
      requireDashboardRuntimeUtils,
      requireSearchRuntimeUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
    DashboardRuntimeUtils,
    SearchRuntimeUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /search-runtime\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when observability runtime utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
      requireDisplayUtils,
      requireDashboardRuntimeUtils,
      requireSearchRuntimeUtils,
      requireObservabilityRuntimeUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
    DashboardRuntimeUtils,
    SearchRuntimeUtils,
    ObservabilityRuntimeUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /observability-runtime\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when resource list runtime utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
      requireDisplayUtils,
      requireDashboardRuntimeUtils,
      requireSearchRuntimeUtils,
      requireObservabilityRuntimeUtils,
      requireResourceListRuntimeUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
    DashboardRuntimeUtils,
    SearchRuntimeUtils,
    ObservabilityRuntimeUtils,
    ResourceListRuntimeUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-list-runtime\.js.*load.*before app\.js/i,
  );
});

test("app.js integrates the validated resource view module for proxy list rendering", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  loadAppWithoutBootstrap(context);
  vm.runInContext(`
    state.proxies = [{
      id: 1,
      name: "tokyo-proxy",
      enabled: true,
      bound_backend_count: 2,
      traffic_bytes: 4096,
      avg_latency_ms: 82,
      last_used_at: "2026-06-19T00:00:00Z",
      updated_at: "2026-06-19T00:10:00Z"
    }];
    renderProxies();
  `, context);

  const html = context.__elements.get("#proxyList").innerHTML;
  assert.match(html, /data-toolbar-search="proxies"/);
  assert.match(html, /tokyo-proxy/);
  assert.match(html, /Default view/);
});

test("app.js keeps backend proxy option rendering outside shared crud utils", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  loadAppWithoutBootstrap(context);
  vm.runInContext(`
    state.proxies = [
      { id: 7, name: "tokyo", address: "10.0.0.7:1080", enabled: true },
      { id: 8, name: "sydney", address: "10.0.0.8:1080", enabled: false }
    ];
    backendForm.elements.proxy_id.value = "7";
    renderProxyOptions();
  `, context);

  const proxySelect = context.__elements.get("form:proxy_id");
  assert.match(proxySelect.innerHTML, /Direct connection/);
  assert.match(proxySelect.innerHTML, /tokyo \(10\.0\.0\.7:1080\)/);
  assert.match(proxySelect.innerHTML, /sydney \(10\.0\.0\.8:1080\) - disabled/);
  assert.equal(proxySelect.value, "7");

  vm.runInContext(`
    backendForm.elements.proxy_id.value = "999";
    renderProxyOptions();
  `, context);
  assert.equal(proxySelect.value, "0");
});

test("app.js wires backend proxy options through backend form lifecycle helpers", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  loadAppWithoutBootstrap(context);
  vm.runInContext(`
    state.proxies = [
      { id: 7, name: "tokyo", address: "10.0.0.7:1080", enabled: true },
      { id: 8, name: "sydney", address: "10.0.0.8:1080", enabled: false }
    ];
    state.backends = [{
      id: 3,
      name: "edge-a",
      pool: "premium",
      protocol: "openai",
      base_url: "https://edge-a.example",
      api_key: "secret",
      proxy_id: 7,
      models: ["gpt-4.1"],
      model_mapping: {},
      endpoints: ["responses"],
      weight: 1,
      enabled: true
    }];
    startCreateBackend();
  `, context);

  const proxySelect = context.__elements.get("form:proxy_id");
  assert.match(proxySelect.innerHTML, /Direct connection/);
  assert.match(proxySelect.innerHTML, /tokyo \(10\.0\.0\.7:1080\)/);
  assert.equal(proxySelect.value, "0");

  vm.runInContext(`
    startEditBackend(3);
  `, context);
  assert.equal(proxySelect.value, "7");

  vm.runInContext(`
    resetBackendForm();
  `, context);
  assert.equal(proxySelect.value, "0");
});

test("app.js initializes resource view defaults through ResourceStateUtils", () => {
  const calls = [];
  const instrumentedResourceStateUtils = {
    ...ResourceStateUtils,
    defaultResourceView(resourceKey) {
      calls.push(resourceKey);
      return ResourceStateUtils.defaultResourceView(resourceKey);
    },
  };
  const context = createAppVmContext({
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
    },
    ResourceViewUtils,
    ResourceStateUtils: instrumentedResourceStateUtils,
    ResourceCrudUtils,
    ShellStateUtils,
    ShellViewUtils,
    DrawerViewUtils,
    DisplayUtils,
  });

  loadAppWithoutBootstrap(context);

  assert.deepEqual(calls, ["proxies", "backends", "clients", "policies"]);
});

test("index.html loads resource runtime dependencies before app.js", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const shellViewIndex = html.indexOf("./shell-view.js");
  const shellRuntimeIndex = html.indexOf("./shell-runtime.js");
  const shellStateIndex = html.indexOf("./shell-state.js");
  const resourceViewIndex = html.indexOf("./resource-view.js");
  const resourceRuntimeIndex = html.indexOf("./resource-runtime.js");
  const resourceStateIndex = html.indexOf("./resource-state.js");
  const resourceCrudIndex = html.indexOf("./resource-crud.js");
  const drawerViewIndex = html.indexOf("./drawer-view.js");
  const paginationIndex = html.indexOf("./pagination.js");
  const displayUtilsIndex = html.indexOf("./display-utils.js");
  const dashboardRuntimeIndex = html.indexOf("./dashboard-runtime.js");
  const searchRuntimeIndex = html.indexOf("./search-runtime.js");
  const observabilityRuntimeIndex = html.indexOf("./observability-runtime.js");
  const resourceListRuntimeIndex = html.indexOf("./resource-list-runtime.js");
  const appIndex = html.indexOf("./app.js");

  assert.ok(shellStateIndex >= 0);
  assert.ok(shellViewIndex >= 0);
  assert.ok(shellViewIndex > shellStateIndex);
  assert.ok(shellRuntimeIndex > shellViewIndex);
  assert.ok(resourceViewIndex >= 0);
  assert.ok(resourceViewIndex > shellRuntimeIndex);
  assert.ok(resourceRuntimeIndex > resourceViewIndex);
  assert.ok(resourceStateIndex > resourceRuntimeIndex);
  assert.ok(resourceCrudIndex > resourceStateIndex);
  assert.ok(drawerViewIndex > resourceCrudIndex);
  assert.ok(paginationIndex > drawerViewIndex);
  assert.ok(displayUtilsIndex > paginationIndex);
  assert.ok(dashboardRuntimeIndex > displayUtilsIndex);
  assert.ok(searchRuntimeIndex > dashboardRuntimeIndex);
  assert.ok(observabilityRuntimeIndex > searchRuntimeIndex);
  assert.ok(resourceListRuntimeIndex > observabilityRuntimeIndex);
  assert.ok(appIndex > resourceListRuntimeIndex);
});

function loadAppWithoutBootstrap(context) {
  const originalSource = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const source = originalSource.replace(
    /\nactivatePage\(pageIDFromHash\(\)\);\s*\nrefreshAll\(\)\.catch\(reportError\);\s*/,
    "\n",
  );
  if (source === originalSource) {
    throw new Error("failed to remove app bootstrap while loading app.js for tests");
  }
  vm.runInContext(source, context, { filename: "app.js" });
  return context;
}

function createDisplayUtilsStub(overrides = {}) {
  return {
    backendProtocolLabel() {
      return "OpenAI";
    },
    clientTokenDisplay() {
      return "masked-token";
    },
    ensureArray(value) {
      return Array.isArray(value) ? value : [];
    },
    emptyState() {
      return "<div></div>";
    },
    escapeHTML(value) {
      return String(value);
    },
    formatBackendCoverage() {
      return "1 models / 1 endpoints";
    },
    formatBackendRecentStats() {
      return "30m 0 ok / 0 fail";
    },
    formatBackendRouting() {
      return "pool default";
    },
    formatBindingCount() {
      return "0 backends";
    },
    formatDataSize() {
      return "0 B";
    },
    formatDateTime(value) {
      return `dt:${value}`;
    },
    formatLatency() {
      return "10 ms";
    },
    formatPolicyCoverage() {
      return "0 backends / 0 models";
    },
    formatPolicyRouting() {
      return "priority 10";
    },
    formatUsageCount() {
      return "0 requests";
    },
    renderDatalist() {},
    statusPill() {
      return "<span></span>";
    },
    tableActions() {
      return "<div></div>";
    },
    ...overrides,
  };
}

function createAppVmContext({
  ResourceRuntimeUtils,
  ResourceViewUtils: resourceViewUtils,
  ResourceStateUtils: resourceStateUtils,
  ResourceCrudUtils: resourceCrudUtils,
  ShellStateUtils: shellStateUtils = ShellStateUtils,
  ShellViewUtils: shellViewUtils = ShellViewUtils,
  DrawerViewUtils: drawerViewUtils = DrawerViewUtils,
  ShellRuntimeUtils: shellRuntimeUtils = ShellRuntimeUtils,
  SearchRuntimeUtils: searchRuntimeUtils = SearchRuntimeUtils,
  ObservabilityRuntimeUtils: observabilityRuntimeUtils = ObservabilityRuntimeUtils,
  ResourceListRuntimeUtils: resourceListRuntimeUtils = ResourceListRuntimeUtils,
  PaginationUtils: paginationUtils = PaginationUtils,
  DisplayUtils: displayUtils = {},
  DashboardRuntimeUtils: dashboardRuntimeUtils = DashboardRuntimeUtils,
  ThemeUtils: themeUtils = ThemeUtils,
  SettingsUtils: settingsUtils = SettingsUtils,
}) {
  const elements = new Map();
  const HTMLElement = class HTMLElement {};

  function createStubElement(key) {
    const classState = new Set();
    const element = new HTMLElement();
    element.__key = key;
    element.dataset = {};
    element.style = {};
    element.value = "";
    element.checked = false;
    element.disabled = false;
    element.hidden = false;
    element.innerHTML = "";
    element.textContent = "";
    element.title = "";
    element.attributes = {};
    element.elements = new Proxy({}, {
      get(_target, property) {
        if (!elements.has(`form:${String(property)}`)) {
          elements.set(`form:${String(property)}`, createStubElement(`form:${String(property)}`));
        }
        return elements.get(`form:${String(property)}`);
      },
    });
    element.classList = {
      add(...tokens) {
        tokens.forEach((token) => classState.add(token));
      },
      remove(...tokens) {
        tokens.forEach((token) => classState.delete(token));
      },
      toggle(token, force) {
        if (force === true) {
          classState.add(token);
          return true;
        }
        if (force === false) {
          classState.delete(token);
          return false;
        }
        if (classState.has(token)) {
          classState.delete(token);
          return false;
        }
        classState.add(token);
        return true;
      },
      contains(token) {
        return classState.has(token);
      },
    };
    element.addEventListener = () => {};
    element.removeEventListener = () => {};
    element.setAttribute = (name, value) => {
      element.attributes[name] = value;
    };
    element.getAttribute = (name) => element.attributes[name];
    element.hasAttribute = (name) => Object.prototype.hasOwnProperty.call(element.attributes, name);
    element.focus = () => {};
    element.closest = () => null;
    element.matches = () => false;
    element.querySelector = (selector) => getElement(selector);
    element.querySelectorAll = () => [];
    element.reset = () => {
      Object.values(element.elements).forEach((field) => {
        if (field && typeof field === "object") {
          if ("value" in field) {
            field.value = "";
          }
          if ("checked" in field) {
            field.checked = false;
          }
        }
      });
    };
    return element;
  }

  function getElement(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, createStubElement(selector));
    }
    return elements.get(selector);
  }

  const document = {
    documentElement: getElement("documentElement"),
    activeElement: getElement("activeElement"),
    querySelector(selector) {
      return getElement(selector);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const localStorage = {
    getItem() {
      return "";
    },
    setItem() {},
    removeItem() {},
  };

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    HTMLElement,
    FormData: class FormData {
      constructor() {
        this.entries = function* entries() {};
      }
    },
    document,
    localStorage,
    alert() {},
    confirm() {
      return true;
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {};
      },
    }),
    window: {
      document,
      location: { hash: "" },
      matchMedia() {
        return {
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        };
      },
      addEventListener() {},
      removeEventListener() {},
    },
    ResourceRuntimeUtils: {
      requireResourceViewUtils,
      requireResourceStateUtils,
      requireResourceCrudUtils,
      requireShellStateUtils,
      requireShellViewUtils,
      requireDrawerViewUtils,
      requireShellRuntimeUtils,
      requirePaginationUtils,
      requireDisplayUtils,
      requireDashboardRuntimeUtils,
      requireSearchRuntimeUtils,
      requireObservabilityRuntimeUtils,
      requireResourceListRuntimeUtils,
      ...(ResourceRuntimeUtils || {}),
    },
    ResourceViewUtils: resourceViewUtils,
    ResourceStateUtils: resourceStateUtils,
    ResourceCrudUtils: resourceCrudUtils,
    ShellStateUtils: shellStateUtils,
    ShellViewUtils: shellViewUtils,
    DrawerViewUtils: drawerViewUtils,
    ShellRuntimeUtils: shellRuntimeUtils,
    SearchRuntimeUtils: searchRuntimeUtils,
    ObservabilityRuntimeUtils: observabilityRuntimeUtils,
    ResourceListRuntimeUtils: resourceListRuntimeUtils,
    PaginationUtils: paginationUtils,
    DisplayUtils: displayUtils,
    DashboardRuntimeUtils: dashboardRuntimeUtils,
    ThemeUtils: themeUtils,
    SearchUtils: {},
    DashboardUtils: {},
    DashboardViewUtils: {},
    ChartsUtils: {},
    DrawerUtils: {},
    ObservabilityUtils: {},
    ObservabilityViewUtils: {},
    RendererUtils: {},
    SettingsUtils: settingsUtils,
  });

  context.globalThis = context;
  context.__elements = elements;
  return context;
}
