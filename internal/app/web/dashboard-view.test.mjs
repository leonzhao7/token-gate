import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  renderDashboardSummaryRow,
  renderDashboardUsageCard,
  renderDashboardEventsSummaryCard,
  renderDashboardRecentEventsCard,
  renderDashboardRecentUsageCard,
  renderSparkline,
  renderAreaChart,
} = require("./dashboard-view.js");

test("renderDashboardSummaryRow renders ready cards from dashboard state", () => {
  const html = renderDashboardSummaryRow({
    dashboard: {
      summaryCards: {
        backends: { status: "ready", data: { label: "Backends", value: 4, trend: "+12.0%", tone: "positive", detail: "3 healthy / 1 attention", sparkline: [1, 3, 2] } },
        client_keys: { status: "ready", data: { label: "Client Keys", value: 8, trend: "+12.0%", tone: "positive", detail: "6 active clients", sparkline: [1, 3, 2] } },
        proxies: { status: "ready", data: { label: "Proxies", value: 2, trend: "-3.0%", tone: "warning", detail: "6 active clients", sparkline: [1, 3, 2] } },
      },
    },
    renderSparkline(values) {
      return `<svg data-points="${values.join(",")}"></svg>`;
    },
  });

  assert.match(html, /Backends/);
  assert.match(html, /Client Keys/);
  assert.match(html, /data-points="1,3,2"/);
});

test("renderDashboardUsageCard renders empty state when no usage exists", () => {
  const html = renderDashboardUsageCard({
    dashboard: { usage: { status: "empty", data: null, range: "7d" } },
    createDashboardRangeOptions() {
      return [];
    },
    renderAreaChart() {
      return "";
    },
  });

  assert.match(html, /No usage yet/);
  assert.match(html, /Traffic intelligence/);
});

test("renderDashboardEventsSummaryCard renders summary counters", () => {
  const html = renderDashboardEventsSummaryCard({
    dashboard: {
      eventsSummary: {
        status: "ready",
        data: [
          { label: "Warnings", count: 2, tone: "warning" },
          { label: "Errors", count: 1, tone: "danger" },
        ],
      },
    },
  });

  assert.match(html, /Warnings/);
  assert.match(html, /Errors/);
});

test("renderDashboardRecent feed cards render formatted items", () => {
  const formatDateTime = (value) => `dt:${value}`;
  const eventsHTML = renderDashboardRecentEventsCard({
    dashboard: {
      recentEvents: {
        status: "ready",
        data: [
          { title: "backend.abnormal", message: "Backend marked abnormal", createdAt: "2026-06-19T00:00:00Z", tone: "warning" },
        ],
      },
    },
    formatDateTime,
  });
  const usageHTML = renderDashboardRecentUsageCard({
    dashboard: {
      recentUsage: {
        status: "ready",
        data: [
          { client: "alpha", model: "gpt-5.4", backend: "edge-a", requestId: "req-1", duration: 120, status: "200", createdAt: "2026-06-19T00:00:00Z" },
        ],
      },
    },
    formatDateTime,
  });

  assert.match(eventsHTML, /backend\.abnormal/);
  assert.match(eventsHTML, /dt:2026-06-19T00:00:00Z/);
  assert.match(usageHTML, /alpha/);
  assert.match(usageHTML, /req-1/);
  assert.match(usageHTML, /dt:2026-06-19T00:00:00Z/);
});

test("renderSparkline renders chart svg from chart helpers", () => {
  const html = renderSparkline([1, 3, 2], {
    width: 150,
    height: 54,
    padding: 5,
    className: "sparkline-chart tone-positive",
  }, {
    createSparklinePoints() {
      return [{ x: 5, y: 49 }, { x: 75, y: 8 }, { x: 145, y: 28 }];
    },
    createLinePath() {
      return "M 5 49 L 75 8 L 145 28";
    },
    createAreaPath() {
      return "M 5 49 L 75 8 L 145 28 Z";
    },
  });

  assert.match(html, /sparkline-chart tone-positive/);
  assert.match(html, /Trend sparkline/);
  assert.match(html, /M 5 49 L 75 8 L 145 28/);
});

test("renderAreaChart renders usage chart and axis labels from chart helpers", () => {
  const html = renderAreaChart([5, 9, 7], ["Mon", "Tue", "Wed"], {
    width: 720,
    height: 260,
    padding: 22,
  }, {
    createSparklinePoints() {
      return [{ x: 22, y: 200 }, { x: 360, y: 40 }, { x: 698, y: 120 }];
    },
    createLinePath() {
      return "M 22 200 L 360 40 L 698 120";
    },
    createAreaPath() {
      return "M 22 200 L 360 40 L 698 120 Z";
    },
  });

  assert.match(html, /Usage overview chart/);
  assert.match(html, /Mon/);
  assert.match(html, /Wed/);
  assert.match(html, /M 22 200 L 360 40 L 698 120/);
});
