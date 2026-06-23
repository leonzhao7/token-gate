import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ConsoleDataRuntimeUtils = require("./console-data-runtime.js");

test("refreshDashboardData delegates dashboard payload shaping and rerenders after each request branch", async () => {
  const calls = [];
  const state = {
    dashboard: {
      summaryCards: {
        backends: { status: "loading", data: null, error: "" },
      },
      usage: { status: "loading", data: null, error: "", range: "7d" },
      eventsSummary: { status: "loading", data: null, error: "" },
      recentEvents: { status: "loading", data: null, error: "" },
      recentUsage: { status: "loading", data: null, error: "" },
    },
  };

  await ConsoleDataRuntimeUtils.refreshDashboardData({
    state,
    api(path) {
      calls.push(["api", path]);
      if (path === "/admin/api/dashboard/summary") {
        return Promise.resolve({ summary: true });
      }
      if (path === "/admin/api/dashboard/activity") {
        return Promise.resolve({ activity: true });
      }
      if (path === "/admin/api/dashboard/usage?range=7d") {
        return Promise.resolve({ points: [{ label: "Mon", requests: 4 }] });
      }
      throw new Error(`unexpected path: ${path}`);
    },
    dashboardUtils: {
      applyDashboardSummaryPayload(dashboard, payload) {
        calls.push(["summary", payload]);
        dashboard.summaryCards.backends.status = "ready";
      },
      createDashboardUsageState(payload) {
        calls.push(["usage", payload]);
        return { points: payload.points };
      },
      applyDashboardActivityPayload(dashboard, payload) {
        calls.push(["activity", payload]);
        dashboard.eventsSummary.status = "ready";
        dashboard.recentEvents.status = "ready";
        dashboard.recentUsage.status = "ready";
      },
    },
    renderDashboardShell() {
      calls.push(["render"]);
    },
  });

  assert.equal(state.dashboard.summaryCards.backends.status, "ready");
  assert.equal(state.dashboard.usage.status, "ready");
  assert.deepEqual(state.dashboard.usage.data, { points: [{ label: "Mon", requests: 4 }] });
  assert.equal(state.dashboard.eventsSummary.status, "ready");
  assert.equal(state.dashboard.recentEvents.status, "ready");
  assert.equal(state.dashboard.recentUsage.status, "ready");
  assert.deepEqual(calls, [
    ["api", "/admin/api/dashboard/summary"],
    ["api", "/admin/api/dashboard/usage?range=7d"],
    ["api", "/admin/api/dashboard/activity"],
    ["summary", { summary: true }],
    ["usage", { points: [{ label: "Mon", requests: 4 }] }],
    ["activity", { activity: true }],
    ["render"],
    ["render"],
    ["render"],
  ]);
});

test("refreshAll hydrates resources, pagination state, usage options, and rerenders console sections", async () => {
  const calls = [];
  const state = {
    proxies: [],
    backends: [],
    clients: [],
    eventSummary: null,
    usageLogStats: null,
    usageLogOptions: {
      backends: [],
      models: [],
      clientKeys: [],
      proxies: [],
    },
    paginationMeta: {
      events: { total: 0, page: 1, limit: 10 },
      usageLogs: { total: 0, page: 1, limit: 10 },
    },
    pagination: {
      events: { page: 2, size: 20 },
      usageLogs: { page: 3, size: 50 },
    },
    ui: {
      lastRefreshAt: "",
    },
  };

  await ConsoleDataRuntimeUtils.refreshAll({
    state,
    startDashboardLoading() {
      calls.push(["startDashboardLoading"]);
    },
    renderDashboardShell() {
      calls.push(["renderDashboardShell"]);
    },
    refreshDashboardData() {
      calls.push(["refreshDashboardData"]);
      return Promise.resolve();
    },
    reportError(error) {
      calls.push(["reportError", error.message]);
    },
    buildUsageLogQuery() {
      calls.push(["buildUsageLogQuery"]);
      return "&q=model";
    },
    buildEventQuery() {
      calls.push(["buildEventQuery"]);
      return "&severity=warning";
    },
    buildEventSummaryQuery() {
      calls.push(["buildEventSummaryQuery"]);
      return "window=24h";
    },
    buildUsageLogStatsQuery() {
      calls.push(["buildUsageLogStatsQuery"]);
      return "group=minute";
    },
    fetchAllCollectionPages(basePath) {
      calls.push(["fetchAllCollectionPages", basePath]);
      const payloads = {
        "/admin/api/socks-proxies": [{ id: 1, name: "proxy-a" }],
        "/admin/api/backends": [{ id: 2, name: "edge-a" }],
        "/admin/api/client-keys": [{ id: 3, name: "sdk-a" }],
      };
      return Promise.resolve(payloads[basePath]);
    },
    api(path) {
      calls.push(["api", path]);
      const payloads = {
        "/admin/api/events?page=2&limit=20&severity=warning": { items: [{ id: 11 }], total: 1, page: 2, limit: 20 },
        "/admin/api/events/summary?window=24h": { counters: [1] },
        "/admin/api/usage-logs?page=3&limit=50&q=model": { items: [{ id: 12 }], total: 2, page: 3, limit: 50 },
        "/admin/api/usage-logs/stats?group=minute": { totals: { ok: 10, fail: 1 } },
        "/admin/api/usage-log-options": {
          backends: ["edge-a"],
          models: ["gpt-4.1"],
          client_keys: ["sdk-a"],
          proxies: ["proxy-a"],
        },
      };
      return Promise.resolve(payloads[path]);
    },
    displayUtils: {
      ensureArray(value) {
        return Array.isArray(value) ? value : [];
      },
    },
    paginationUtils: {
      applyPagedResponse(resourceKey, payload, nextState) {
        calls.push(["applyPagedResponse", resourceKey, payload.total]);
        nextState.paginationMeta[resourceKey] = {
          total: payload.total,
          page: payload.page,
          limit: payload.limit,
        };
        nextState[resourceKey === "events" ? "events" : "usageLogs"] = payload.items;
      },
    },
    resourceStateUtils: {},
    pageSizeOptions: [10, 20, 50],
    renderProxyOptions() {
      calls.push(["renderProxyOptions"]);
    },
    renderUsageLogFilterOptions() {
      calls.push(["renderUsageLogFilterOptions"]);
    },
    renderProxies() {
      calls.push(["renderProxies"]);
    },
    renderBackends() {
      calls.push(["renderBackends"]);
    },
    renderClients() {
      calls.push(["renderClients"]);
    },
    renderEvents() {
      calls.push(["renderEvents"]);
    },
    renderUsageLogs() {
      calls.push(["renderUsageLogs"]);
    },
    renderDrawerShell() {
      calls.push(["renderDrawerShell"]);
    },
    renderSearchShell() {
      calls.push(["renderSearchShell"]);
    },
    renderTheme() {
      calls.push(["renderTheme"]);
    },
  });

  assert.deepEqual(state.proxies, [{ id: 1, name: "proxy-a" }]);
  assert.deepEqual(state.backends, [{ id: 2, name: "edge-a" }]);
  assert.deepEqual(state.clients, [{ id: 3, name: "sdk-a" }]);
  assert.deepEqual(state.eventSummary, { counters: [1] });
  assert.deepEqual(state.usageLogStats, { totals: { ok: 10, fail: 1 } });
  assert.deepEqual(state.usageLogOptions, {
    backends: ["edge-a"],
    models: ["gpt-4.1"],
    clientKeys: ["sdk-a"],
    proxies: ["proxy-a"],
  });
  assert.equal(typeof state.ui.lastRefreshAt, "string");
  assert.notEqual(state.ui.lastRefreshAt, "");
  assert.ok(calls.some((entry) => entry[0] === "startDashboardLoading"));
  assert.ok(calls.some((entry) => entry[0] === "refreshDashboardData"));
  assert.ok(calls.some((entry) => entry[0] === "renderProxyOptions"));
  assert.ok(calls.some((entry) => entry[0] === "renderUsageLogs"));
  assert.ok(calls.some((entry) => entry[0] === "renderTheme"));
});

test("handleSettingsAction dispatches supported actions to the matching handlers", async () => {
  const calls = [];
  const tokenInput = {
    focus() {
      calls.push(["focus"]);
    },
  };

  await ConsoleDataRuntimeUtils.handleSettingsAction({
    action: "focus-token",
    tokenInput,
    refreshAll() {
      calls.push(["refreshAll"]);
      return Promise.resolve();
    },
    cycleThemePreference() {
      calls.push(["cycleThemePreference"]);
    },
    toggleSidebarCollapsed() {
      calls.push(["toggleSidebarCollapsed"]);
    },
    openSearchShell() {
      calls.push(["openSearchShell"]);
    },
    navigateToPage(page) {
      calls.push(["navigateToPage", page]);
    },
  });
  await ConsoleDataRuntimeUtils.handleSettingsAction({
    action: "refresh-data",
    tokenInput,
    refreshAll() {
      calls.push(["refreshAll"]);
      return Promise.resolve();
    },
    cycleThemePreference() {},
    toggleSidebarCollapsed() {},
    openSearchShell() {},
    navigateToPage() {},
  });
  assert.deepEqual(calls, [
    ["focus"],
    ["refreshAll"],
  ]);
});
