import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildPageNavigation,
  createHeaderPanelState,
  createHeaderPanelViewModel,
  createSettingsSnapshot,
  createThemeRuntimeState,
  createThemeStorageOperation,
} = require("./shell-state.js");

test("buildPageNavigation normalizes unknown pages and avoids redundant hash updates", () => {
  const pages = [
    { id: "overview" },
    { id: "backends" },
    { id: "usage-logs" },
  ];

  assert.deepEqual(
    buildPageNavigation({ currentHash: "#overview", requestedID: "backends", pages }),
    {
      nextID: "backends",
      nextHash: "#backends",
      shouldUpdateHash: true,
    },
  );

  assert.deepEqual(
    buildPageNavigation({ currentHash: "#usage-logs", requestedID: "usage-logs", pages }),
    {
      nextID: "usage-logs",
      nextHash: "#usage-logs",
      shouldUpdateHash: false,
    },
  );

  assert.deepEqual(
    buildPageNavigation({ currentHash: "#overview", requestedID: "missing", pages }),
    {
      nextID: "overview",
      nextHash: "#overview",
      shouldUpdateHash: false,
    },
  );
});

test("createThemeRuntimeState resolves the UI theme through ThemeUtils-compatible logic", () => {
  const resolved = createThemeRuntimeState({
    storedPreference: "dark",
    systemPrefersDark: false,
    resolveThemeState(input) {
      return {
        preference: input.storedPreference,
        theme: input.storedPreference,
      };
    },
  });

  assert.deepEqual(resolved, {
    preference: "dark",
    theme: "dark",
  });
});

test("createThemeStorageOperation maps system to remove and explicit overrides to set", () => {
  assert.deepEqual(createThemeStorageOperation("system"), {
    type: "remove",
    value: "",
  });
  assert.deepEqual(createThemeStorageOperation("dark"), {
    type: "set",
    value: "dark",
  });
});

test("createSettingsSnapshot collects shell state and inventory for Settings view model", () => {
  const snapshot = createSettingsSnapshot({
    adminTokenValue: "dev-token",
    themePreference: "system",
    resolvedTheme: "dark",
    sidebarCollapsed: true,
    lastRefreshLabel: "2026-06-20 10:11:12.123",
    backends: [{ id: 1 }],
    clients: [{ id: 2 }],
    policies: [{ id: 3 }],
    proxies: [{ id: 4 }],
    usageLogStats: { totals: { requests: 5 } },
    usageLogMeta: { total: 5 },
    eventSummary: { total: 2 },
  });

  assert.deepEqual(snapshot, {
    adminTokenPresent: true,
    themePreference: "system",
    resolvedTheme: "dark",
    sidebarCollapsed: true,
    lastRefreshLabel: "2026-06-20 10:11:12.123",
    backends: [{ id: 1 }],
    clients: [{ id: 2 }],
    policies: [{ id: 3 }],
    proxies: [{ id: 4 }],
    usageLogStats: { totals: { requests: 5 } },
    usageLogMeta: { total: 5 },
    eventSummary: { total: 2 },
  });
});

test("header panel helpers create stable shell utility state and panel content", () => {
  assert.deepEqual(createHeaderPanelState(), {
    active: "",
  });

  const viewModel = createHeaderPanelViewModel({
    activePanel: "notifications",
    dashboard: {
      recentEvents: {
        data: [
          {
            title: "backend.failover",
            description: "edge-a switched",
            meta: "edge-a · gpt-5.4",
            timestamp: "2026-06-22 10:11:12.123",
            tone: "warning",
          },
        ],
      },
    },
    ui: {
      theme: "dark",
      themePreference: "system",
      lastRefreshAt: "2026-06-22 10:12:13.123",
    },
  });

  assert.equal(viewModel.activePanel, "notifications");
  assert.equal(viewModel.notifications.items.length, 1);
  assert.equal(viewModel.notifications.items[0].title, "backend.failover");
  assert.equal(viewModel.profile.items[0].label, "Theme");
  assert.equal(viewModel.profile.actions[0].key, "open-search");
});
