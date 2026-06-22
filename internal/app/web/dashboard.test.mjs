import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  applyDashboardActivityError,
  applyDashboardActivityPayload,
  applyDashboardSummaryError,
  applyDashboardSummaryPayload,
  createDashboardRangeOptions,
  createDashboardState,
  createDashboardSummaryCards,
  createDashboardUsageState,
  createDashboardActivityState,
} = require("./dashboard.js");

test("createDashboardSummaryCards maps counts, growth, status, and sparkline into four cards", () => {
  const cards = createDashboardSummaryCards({
    counts: {
      backends: 4,
      client_keys: 7,
      model_policies: 5,
      socks_proxies: 2,
    },
    growth: {
      requests: 12.6,
      errors: -8.2,
    },
    status: {
      healthy_backends: 3,
      recent_errors: 2,
      active_clients: 6,
    },
    sparkline: [
      { label: "06-12", requests: 2 },
      { label: "06-13", requests: 3 },
      { label: "06-14", requests: 5 },
    ],
  });

  assert.equal(cards.length, 4);
  assert.deepEqual(cards[0], {
    key: "backends",
    label: "Backends",
    value: 4,
    trend: "+12.6%",
    tone: "positive",
    detail: "3 healthy / 1 attention",
    sparkline: [2, 3, 5],
  });
  assert.deepEqual(cards[3], {
    key: "proxies",
    label: "Proxies",
    value: 2,
    trend: "-8.2%",
    tone: "warning",
    detail: "6 active clients",
    sparkline: [2, 3, 5],
  });
});

test("createDashboardUsageState normalizes series and exposes metric summaries", () => {
  const usage = createDashboardUsageState({
    range: "7d",
    series: [
      { label: "Mon", requests: 10, traffic_bytes: 1024, error_rate: 0.1 },
      { label: "Tue", requests: 18, traffic_bytes: 2048, error_rate: 0.2 },
      { label: "Wed", requests: 9, traffic_bytes: 512, error_rate: 0.05 },
    ],
  });

  assert.equal(usage.range, "7d");
  assert.equal(usage.points.length, 3);
  assert.deepEqual(usage.metrics.requests, {
    key: "requests",
    label: "Daily Requests",
    value: 37,
    delta: "+9",
  });
  assert.deepEqual(usage.metrics.traffic, {
    key: "traffic",
    label: "Traffic",
    value: "3.5 KB",
    delta: "+1.5 KB",
  });
  assert.deepEqual(usage.metrics.errors, {
    key: "errors",
    label: "Error Rate",
    value: "5.0%",
    delta: "-15.0%",
  });
});

test("createDashboardRangeOptions marks the active dashboard range", () => {
  assert.deepEqual(createDashboardRangeOptions("30d"), [
    { key: "24h", label: "24h", active: false },
    { key: "7d", label: "7d", active: false },
    { key: "30d", label: "30d", active: true },
  ]);
  assert.deepEqual(createDashboardRangeOptions("unexpected"), [
    { key: "24h", label: "24h", active: false },
    { key: "7d", label: "7d", active: true },
    { key: "30d", label: "30d", active: false },
  ]);
});

test("createDashboardActivityState builds event counters and trims recent lists", () => {
  const activity = createDashboardActivityState({
    summary: [
      { category: "warning", count: 4 },
      { category: "error", count: 1 },
      { category: "policy", count: 3 },
    ],
    events: [
      { id: 11, type: "policy.changed", message: "Policy updated", created_at: "2026-06-18T01:02:03Z" },
      { id: 12, type: "backend.updated", message: "Backend rotated", created_at: "2026-06-18T01:05:03Z" },
    ],
    usage: [
      { id: 21, request_id: "req-1", client_name: "alpha", model: "gpt-4o", backend_name: "edge-a", status_code: 200, duration_ms: 420, created_at: "2026-06-18T01:02:03Z" },
      { id: 22, request_id: "req-2", client_name: "beta", model: "gpt-4.1", backend_name: "edge-b", status_code: 429, duration_ms: 920, created_at: "2026-06-18T01:04:03Z" },
    ],
  });

  assert.deepEqual(activity.counters, [
    { key: "warning", label: "Warnings", count: 4, tone: "warning" },
    { key: "error", label: "Errors", count: 1, tone: "danger" },
    { key: "policy", label: "Policy Changes", count: 3, tone: "primary" },
    { key: "key", label: "Key Creations", count: 0, tone: "neutral" },
    { key: "backend", label: "Backend Updates", count: 0, tone: "success" },
  ]);
  assert.equal(activity.events[0].title, "policy.changed");
  assert.equal(activity.usage[1].status, "429");
});

test("createDashboardState creates independent dashboard card and panel states", () => {
  const state = createDashboardState();

  assert.equal(state.summaryCards.backends.status, "loading");
  assert.equal(state.summaryCards.client_keys.status, "loading");
  assert.notStrictEqual(state.summaryCards.backends, state.summaryCards.client_keys);
  assert.equal(state.eventsSummary.status, "loading");
  assert.equal(state.recentEvents.status, "loading");
  assert.equal(state.recentUsage.status, "loading");
  assert.notStrictEqual(state.eventsSummary, state.recentEvents);
  assert.notStrictEqual(state.recentEvents, state.recentUsage);
});

test("applyDashboardSummaryPayload stores each summary card separately", () => {
  const state = createDashboardState();

  applyDashboardSummaryPayload(state, {
    counts: {
      backends: 3,
      client_keys: 8,
      model_policies: 4,
      socks_proxies: 2,
    },
    growth: {
      requests: 6.2,
      errors: -3.5,
    },
    status: {
      healthy_backends: 2,
      recent_errors: 1,
      active_clients: 5,
    },
    sparkline: [
      { label: "06-15", requests: 4 },
      { label: "06-16", requests: 5 },
    ],
  });

  assert.equal(state.summaryCards.backends.status, "ready");
  assert.equal(state.summaryCards.backends.data.label, "Backends");
  assert.equal(state.summaryCards.client_keys.status, "ready");
  assert.equal(state.summaryCards.client_keys.data.value, 8);
  assert.equal(state.summaryCards.policies.status, "ready");
  assert.equal(state.summaryCards.proxies.status, "ready");
});

test("applyDashboardSummaryPayload can update one summary card without touching peers", () => {
  const state = createDashboardState();

  applyDashboardSummaryPayload(state, {
    counts: {
      backends: 9,
      client_keys: 8,
      model_policies: 4,
      socks_proxies: 2,
    },
    growth: {
      requests: 6.2,
      errors: -3.5,
    },
    status: {
      healthy_backends: 7,
      recent_errors: 1,
      active_clients: 5,
    },
    sparkline: [
      { label: "06-15", requests: 4 },
      { label: "06-16", requests: 5 },
    ],
  }, "backends");

  assert.equal(state.summaryCards.backends.status, "ready");
  assert.equal(state.summaryCards.backends.data.value, 9);
  assert.equal(state.summaryCards.client_keys.status, "loading");
  assert.equal(state.summaryCards.policies.status, "loading");
  assert.equal(state.summaryCards.proxies.status, "loading");
});

test("applyDashboardSummaryError can fail one summary card without touching peers", () => {
  const state = createDashboardState();

  applyDashboardSummaryError(state, "summary unavailable", "backends");

  assert.equal(state.summaryCards.backends.status, "failed");
  assert.equal(state.summaryCards.backends.error, "summary unavailable");
  assert.equal(state.summaryCards.client_keys.status, "loading");
  assert.equal(state.summaryCards.policies.status, "loading");
  assert.equal(state.summaryCards.proxies.status, "loading");
});

test("applyDashboardActivityPayload splits activity into independent panels", () => {
  const state = createDashboardState();

  applyDashboardActivityPayload(state, {
    summary: [],
    events: [
      { id: 1, type: "backend.updated", message: "Backend rotated", created_at: "2026-06-18T01:05:03Z" },
    ],
    usage: [],
  });

  assert.equal(state.eventsSummary.status, "empty");
  assert.equal(state.recentEvents.status, "ready");
  assert.equal(state.recentEvents.data[0].title, "backend.updated");
  assert.equal(state.recentUsage.status, "empty");
});

test("applyDashboardActivityPayload can update one panel without touching peers", () => {
  const state = createDashboardState();

  applyDashboardActivityPayload(state, {
    summary: [],
    events: [
      { id: 1, type: "backend.updated", message: "Backend rotated", created_at: "2026-06-18T01:05:03Z" },
    ],
    usage: [],
  }, "recentEvents");

  assert.equal(state.eventsSummary.status, "loading");
  assert.equal(state.recentEvents.status, "ready");
  assert.equal(state.recentEvents.data[0].title, "backend.updated");
  assert.equal(state.recentUsage.status, "loading");
});

test("applyDashboardActivityError fails each activity panel independently", () => {
  const state = createDashboardState();

  applyDashboardActivityError(state, "activity unavailable");

  assert.equal(state.eventsSummary.status, "failed");
  assert.equal(state.eventsSummary.error, "activity unavailable");
  assert.equal(state.recentEvents.status, "failed");
  assert.equal(state.recentUsage.status, "failed");
});

test("applyDashboardActivityError can fail one panel without touching peers", () => {
  const state = createDashboardState();

  applyDashboardActivityError(state, "activity unavailable", "recentEvents");

  assert.equal(state.eventsSummary.status, "loading");
  assert.equal(state.recentEvents.status, "failed");
  assert.equal(state.recentEvents.error, "activity unavailable");
  assert.equal(state.recentUsage.status, "loading");
});
