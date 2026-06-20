import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DashboardRuntimeUtils = require("./dashboard-runtime.js");

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
