import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DashboardRuntimeUtils = require("./dashboard-runtime.js");

function createButton(dataset = {}) {
  const listeners = new Map();
  return {
    dataset,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    click() {
      listeners.get("click")?.();
    },
  };
}

test("startDashboardLoading resets every dashboard panel to loading", () => {
  const state = {
    dashboard: {
      summaryCards: {
        backends: { status: "ready", error: "x", data: { id: 1 } },
        client_keys: { status: "failed", error: "y", data: { id: 2 } },
      },
      usage: { status: "ready", error: "z", data: { id: 3 } },
      eventsSummary: { status: "ready", error: "a", data: { id: 4 } },
      recentEvents: { status: "failed", error: "b", data: { id: 5 } },
      recentUsage: { status: "empty", error: "c", data: { id: 6 } },
    },
  };

  DashboardRuntimeUtils.startDashboardLoading({ state });

  assert.deepEqual(state.dashboard.summaryCards.backends, { status: "loading", error: "", data: null });
  assert.deepEqual(state.dashboard.summaryCards.client_keys, { status: "loading", error: "", data: null });
  assert.deepEqual(state.dashboard.usage, { status: "loading", error: "", data: null });
  assert.deepEqual(state.dashboard.eventsSummary, { status: "loading", error: "", data: null });
  assert.deepEqual(state.dashboard.recentEvents, { status: "loading", error: "", data: null });
  assert.deepEqual(state.dashboard.recentUsage, { status: "loading", error: "", data: null });
});

test("renderDashboardShell renders cards into roots and binds interactions", () => {
  const state = {
    ui: { theme: "dark" },
    dashboard: {
      usage: { metric: "requests", range: "7d" },
    },
  };
  const roots = {
    dashboardRoot: { dataset: {}, querySelectorAll() { return []; } },
    dashboardSummaryRow: { innerHTML: "" },
    dashboardUsageCard: { innerHTML: "" },
    dashboardEventsSummaryCard: { innerHTML: "" },
    dashboardRecentEventsCard: { innerHTML: "" },
    dashboardRecentUsageCard: { innerHTML: "" },
  };
  const calls = [];

  DashboardRuntimeUtils.renderDashboardShell({
    state,
    ...roots,
    renderSummaryRow() {
      calls.push("summary");
      return "<section>summary</section>";
    },
    renderUsageCard() {
      calls.push("usage");
      return "<section>usage</section>";
    },
    renderEventsSummaryCard() {
      calls.push("events");
      return "<section>events</section>";
    },
    renderRecentEventsCard() {
      calls.push("recent-events");
      return "<section>recent-events</section>";
    },
    renderRecentUsageCard() {
      calls.push("recent-usage");
      return "<section>recent-usage</section>";
    },
    bindInteractions(input) {
      calls.push(["bind", input.dashboardRoot === roots.dashboardRoot]);
    },
  });

  assert.equal(roots.dashboardRoot.dataset.theme, "dark");
  assert.match(roots.dashboardSummaryRow.innerHTML, /summary/);
  assert.match(roots.dashboardUsageCard.innerHTML, /usage/);
  assert.match(roots.dashboardEventsSummaryCard.innerHTML, /events/);
  assert.match(roots.dashboardRecentEventsCard.innerHTML, /recent-events/);
  assert.match(roots.dashboardRecentUsageCard.innerHTML, /recent-usage/);
  assert.deepEqual(calls, [
    "summary",
    "usage",
    "events",
    "recent-events",
    "recent-usage",
    ["bind", true],
  ]);
});

test("renderDashboardPanels delegates dashboard panel rendering to shared view helpers", () => {
  const calls = [];
  const dashboard = { usage: { range: "7d", metric: "requests" } };
  const renderSparkline = (...args) => {
    calls.push(["renderSparkline", args]);
    return "<sparkline />";
  };
  const renderAreaChart = (...args) => {
    calls.push(["renderAreaChart", args]);
    return "<chart />";
  };
  const formatDateTime = (value) => `dt:${value}`;
  const feedToneClass = (value) => `tone:${value}`;
  const escapeHTML = (value) => String(value);
  const markup = DashboardRuntimeUtils.renderDashboardPanels({
    dashboard,
    dashboardUtils: {
      createDashboardRangeOptions(range) {
        calls.push(["range-options", range]);
        return [{ key: "7d", label: "7d", active: true }];
      },
    },
    dashboardViewUtils: {
      renderDashboardSummaryRow(input) {
        calls.push(["summary", input.dashboard, input.renderSparkline, input.escapeHTML]);
        return "<summary />";
      },
      renderDashboardUsageCard(input) {
        calls.push(["usage", input.dashboard, input.createDashboardRangeOptions, input.renderAreaChart, input.escapeHTML]);
        return "<usage />";
      },
      renderDashboardEventsSummaryCard(input) {
        calls.push(["events", input.dashboard, input.escapeHTML]);
        return "<events />";
      },
      renderDashboardRecentEventsCard(input) {
        calls.push(["recent-events", input.dashboard, input.formatDateTime, input.escapeHTML, input.feedToneClass]);
        return "<recent-events />";
      },
      renderDashboardRecentUsageCard(input) {
        calls.push(["recent-usage", input.dashboard, input.formatDateTime, input.escapeHTML]);
        return "<recent-usage />";
      },
    },
    renderSparkline,
    renderAreaChart,
    formatDateTime,
    feedToneClass,
    escapeHTML,
  });

  assert.deepEqual(markup, {
    summary: "<summary />",
    usage: "<usage />",
    eventsSummary: "<events />",
    recentEvents: "<recent-events />",
    recentUsage: "<recent-usage />",
  });
  assert.deepEqual(calls.map((entry) => entry[0]), [
    "summary",
    "usage",
    "events",
    "recent-events",
    "recent-usage",
  ]);
  assert.equal(calls[0][1], dashboard);
  assert.equal(calls[0][2], renderSparkline);
  assert.equal(calls[0][3], escapeHTML);
  assert.equal(calls[1][1], dashboard);
  assert.equal(typeof calls[1][2], "function");
  assert.equal(calls[1][3], renderAreaChart);
  assert.equal(calls[1][4], escapeHTML);
  assert.equal(calls[2][1], dashboard);
  assert.equal(calls[2][2], escapeHTML);
  assert.equal(calls[3][1], dashboard);
  assert.equal(calls[3][2], formatDateTime);
  assert.equal(calls[3][3], escapeHTML);
  assert.equal(calls[3][4], feedToneClass);
  assert.equal(calls[4][1], dashboard);
  assert.equal(calls[4][2], formatDateTime);
  assert.equal(calls[4][3], escapeHTML);
});

test("renderDashboardShell returns before evaluating panel callbacks when dashboard root is missing", () => {
  const calls = [];

  DashboardRuntimeUtils.renderDashboardShell({
    state: { ui: { theme: "dark" } },
    dashboardRoot: null,
    renderSummaryRow() {
      calls.push("summary");
      return "";
    },
    renderUsageCard() {
      calls.push("usage");
      return "";
    },
    renderEventsSummaryCard() {
      calls.push("events");
      return "";
    },
    renderRecentEventsCard() {
      calls.push("recent-events");
      return "";
    },
    renderRecentUsageCard() {
      calls.push("recent-usage");
      return "";
    },
    bindInteractions() {
      calls.push("bind");
    },
  });

  assert.deepEqual(calls, []);
});

test("bindDashboardInteractions wires range, metric, and retry controls", async () => {
  const state = {
    dashboard: {
      usage: {
        range: "7d",
        metric: "requests",
      },
    },
  };
  const rangeCurrentButton = createButton({ dashboardRange: "7d" });
  const rangeNextButton = createButton({ dashboardRange: "30d" });
  const metricButton = createButton({ dashboardMetric: "traffic" });
  const retryButton = createButton({ dashboardRetry: "activity:recentEvents" });
  const calls = [];

  DashboardRuntimeUtils.bindDashboardInteractions({
    dashboardRoot: {
      querySelectorAll(selector) {
        if (selector === "[data-dashboard-range]") {
          return [rangeCurrentButton, rangeNextButton];
        }
        if (selector === "[data-dashboard-metric]") {
          return [metricButton];
        }
        if (selector === "[data-dashboard-retry]") {
          return [retryButton];
        }
        return [];
      },
    },
    state,
    renderDashboardShell() {
      calls.push(["render"]);
    },
    refreshDashboardUsagePanel() {
      calls.push(["refresh-usage"]);
      return Promise.resolve();
    },
    retryDashboardSection(target) {
      calls.push(["retry", target]);
      return Promise.resolve();
    },
    reportError(error) {
      calls.push(["error", error.message]);
    },
  });

  rangeCurrentButton.click();
  rangeNextButton.click();
  metricButton.click();
  retryButton.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(state.dashboard.usage.range, "30d");
  assert.equal(state.dashboard.usage.metric, "traffic");
  assert.deepEqual(calls, [
    ["refresh-usage"],
    ["render"],
    ["retry", "activity:recentEvents"],
  ]);
});

test("refreshDashboardUsagePanel clears stale usage state and stores loaded data", async () => {
  const state = {
    dashboard: {
      usage: {
        range: "30d",
        status: "failed",
        error: "stale",
        data: { points: [99] },
      },
    },
  };
  const renders = [];

  await DashboardRuntimeUtils.refreshDashboardUsagePanel({
    state,
    api(path) {
      assert.equal(path, "/admin/api/dashboard/usage?range=30d");
      return Promise.resolve({ series: [{ label: "Mon", requests: 12 }] });
    },
    dashboardUtils: {
      createDashboardUsageState(payload) {
        assert.deepEqual(payload, { series: [{ label: "Mon", requests: 12 }] });
        return { points: [{ label: "Mon", value: 12 }] };
      },
    },
    renderDashboardShell() {
      renders.push({
        status: state.dashboard.usage.status,
        error: state.dashboard.usage.error,
        data: state.dashboard.usage.data,
      });
    },
  });

  assert.deepEqual(renders, [
    { status: "loading", error: "", data: null },
    { status: "ready", error: "", data: { points: [{ label: "Mon", value: 12 }] } },
  ]);
});

test("retryDashboardSection refreshes one summary card without reloading unrelated panels", async () => {
  const state = {
    dashboard: {
      summaryCards: {
        backends: { status: "ready", error: "old", data: { key: "backends" } },
        client_keys: { status: "ready", error: "", data: { key: "client_keys" } },
      },
      usage: { status: "ready", error: "", data: { points: [1] }, range: "7d" },
      eventsSummary: { status: "ready", error: "", data: [] },
      recentEvents: { status: "ready", error: "", data: [] },
      recentUsage: { status: "ready", error: "", data: [] },
    },
  };
  const calls = [];

  await DashboardRuntimeUtils.retryDashboardSection({
    target: "summary:backends",
    state,
    api(path) {
      calls.push(["api", path]);
      return Promise.resolve({ counts: { backends: 8 } });
    },
    dashboardUtils: {
      applyDashboardSummaryPayload(dashboard, payload, targetKey) {
        calls.push(["apply-summary", payload, targetKey]);
        dashboard.summaryCards[targetKey] = {
          status: "ready",
          error: "",
          data: { value: payload.counts.backends },
        };
      },
    },
    startDashboardLoading() {
      calls.push(["start-loading"]);
    },
    renderDashboardShell() {
      calls.push(["render", state.dashboard.summaryCards.backends.status]);
    },
    refreshDashboardData() {
      calls.push(["refresh-all"]);
      return Promise.resolve();
    },
  });

  assert.deepEqual(calls, [
    ["render", "loading"],
    ["api", "/admin/api/dashboard/summary"],
    ["apply-summary", { counts: { backends: 8 } }, "backends"],
    ["render", "ready"],
  ]);
  assert.equal(state.dashboard.summaryCards.backends.data.value, 8);
  assert.equal(state.dashboard.summaryCards.client_keys.data.key, "client_keys");
});

test("retryDashboardSection repopulates activity panels from normalized payloads", async () => {
  const state = {
    dashboard: {
      summaryCards: {},
      usage: { status: "ready", error: "", data: { points: [1] }, range: "7d" },
      eventsSummary: { status: "ready", error: "", data: [{ count: 1 }] },
      recentEvents: { status: "ready", error: "", data: [{ id: 1 }] },
      recentUsage: { status: "failed", error: "old", data: null },
    },
  };

  await DashboardRuntimeUtils.retryDashboardSection({
    target: "activity:recentUsage",
    state,
    api(path) {
      assert.equal(path, "/admin/api/dashboard/activity");
      return Promise.resolve({ usage: [{ id: 42, status: "200" }] });
    },
    dashboardUtils: {
      createDashboardActivityState(payload) {
        assert.deepEqual(payload, { usage: [{ id: 42, status: "200" }] });
        return {
          counters: [],
          events: [],
          usage: [{ id: 42, status: "200" }],
        };
      },
    },
    startDashboardLoading() {},
    renderDashboardShell() {},
    refreshDashboardData() {
      return Promise.resolve();
    },
  });

  assert.equal(state.dashboard.recentUsage.status, "ready");
  assert.deepEqual(state.dashboard.recentUsage.data, [{ id: 42, status: "200" }]);
  assert.equal(state.dashboard.eventsSummary.status, "ready");
  assert.equal(state.dashboard.recentEvents.status, "ready");
});

test("retryDashboardSection falls back to full dashboard reload for unknown targets", async () => {
  const calls = [];

  await DashboardRuntimeUtils.retryDashboardSection({
    target: "unknown",
    state: { dashboard: {} },
    api() {
      calls.push(["api"]);
      return Promise.resolve({});
    },
    dashboardUtils: {},
    startDashboardLoading() {
      calls.push(["start-loading"]);
    },
    renderDashboardShell() {
      calls.push(["render"]);
    },
    refreshDashboardData() {
      calls.push(["refresh-all"]);
      return Promise.resolve();
    },
  });

  assert.deepEqual(calls, [
    ["start-loading"],
    ["render"],
    ["refresh-all"],
  ]);
});
