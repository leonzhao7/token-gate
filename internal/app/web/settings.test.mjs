import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createSettingsViewModel,
  renderSettingsPage,
} = require("./settings.js");

test("createSettingsViewModel summarizes inventory, observability, and workspace controls", () => {
  const model = createSettingsViewModel({
    adminTokenPresent: true,
    themePreference: "system",
    resolvedTheme: "dark",
    sidebarCollapsed: true,
    lastRefreshLabel: "2026-06-19 09:08:07.123",
    backends: [
      { status: "normal", proxy_id: 2, model_mapping: { "gpt-5.4": "gpt-5.4-test" } },
      { status: "disabled", proxy_id: 0, model_mapping: { "gpt-4.1": "gpt-4.1-mini" } },
    ],
    clients: [
      { enabled: true },
      { enabled: true },
      { enabled: false },
    ],
    proxies: [
      { enabled: true },
      { enabled: false },
    ],
    usageLogStats: {
      totals: {
        requests: 42,
        successes: 39,
        failures: 3,
      },
      status_families: [
        { family: "2xx", count: 39 },
        { family: "5xx", count: 3 },
      ],
    },
    usageLogMeta: { total: 42 },
    eventSummary: {
      total: 14,
      severities: [
        { severity: "warning", count: 2 },
        { severity: "error", count: 1 },
      ],
    },
  });

  assert.equal(model.hero.tone, "success");
  assert.equal(model.hero.title, "Control plane ready");
  assert.deepEqual(model.summaryCards.map((card) => ({
    key: card.key,
    value: card.value,
    detail: card.detail,
  })), [
    { key: "backends", value: 2, detail: "1 normal / 0 abnormal / 1 disabled" },
    { key: "clients", value: 3, detail: "2 enabled / 1 disabled" },
    { key: "proxies", value: 2, detail: "1 enabled / 1 disabled" },
  ]);

  const routingPanel = model.panels.find((panel) => panel.key === "routing");
  assert.deepEqual(routingPanel.metrics, [
    { label: "Normal backends", value: "1" },
    { label: "Abnormal backends", value: "0" },
    { label: "Backends with proxy", value: "1" },
    { label: "Model mappings", value: "2" },
  ]);

  const observabilityPanel = model.panels.find((panel) => panel.key === "observability");
  assert.deepEqual(observabilityPanel.metrics, [
    { label: "Usage logs", value: "42" },
    { label: "Events", value: "14" },
    { label: "2xx success", value: "39" },
    { label: "5xx errors", value: "3" },
  ]);
  assert.equal(model.alerts.length, 0);
});

test("createSettingsViewModel raises setup alerts when core configuration is missing", () => {
  const model = createSettingsViewModel({
    adminTokenPresent: false,
    themePreference: "light",
    resolvedTheme: "light",
    sidebarCollapsed: false,
    lastRefreshLabel: "",
    backends: [],
    clients: [],
    proxies: [],
    usageLogStats: {
      totals: { requests: 0, successes: 0, failures: 0 },
      status_families: [],
    },
    usageLogMeta: { total: 0 },
    eventSummary: { total: 0, severities: [] },
  });

  assert.equal(model.hero.tone, "warning");
  assert.equal(model.hero.title, "Configuration attention required");
  assert.deepEqual(model.alerts.map((alert) => alert.title), [
    "Save an admin token",
    "Add a normal backend",
    "Create a client key",
  ]);
  assert.equal(model.hero.badges[0].value, "Missing");
  assert.equal(model.hero.badges[3].value, "Not synced yet");
});

test("renderSettingsPage outputs hero, summary cards, alerts, and control panels", () => {
  const html = renderSettingsPage(createSettingsViewModel({
    adminTokenPresent: false,
    themePreference: "system",
    resolvedTheme: "dark",
    sidebarCollapsed: false,
    lastRefreshLabel: "",
    backends: [],
    clients: [],
    proxies: [],
    usageLogStats: {
      totals: { requests: 0, successes: 0, failures: 0 },
      status_families: [],
    },
    usageLogMeta: { total: 0 },
    eventSummary: { total: 0, severities: [] },
  }));

  assert.match(html, /settings-hero/);
  assert.match(html, /Configuration attention required/);
  assert.match(html, /Save an admin token/);
  assert.match(html, /data-settings-action="refresh-data"/);
  assert.match(html, /data-settings-action="open-search"/);
  assert.match(html, /settings-summary-grid/);
  assert.match(html, /settings-panel-grid/);
});
