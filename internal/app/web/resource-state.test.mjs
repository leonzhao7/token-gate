import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  defaultResourceView,
  toolbarStatusLabel,
  applyResourceView,
  currentLocalPageData,
  currentRemotePageData,
  applyPagedResponse,
  paginationPageNumbers,
} = require("./resource-state.js");

test("defaultResourceView uses the legacy defaults for each resource list", () => {
  assert.deepEqual(defaultResourceView("proxies"), { query: "", filter: "all", sort: "updated_desc" });
  assert.deepEqual(defaultResourceView("backends"), { query: "", filter: "all", sort: "updated_desc" });
  assert.deepEqual(defaultResourceView("clients"), { query: "", filter: "all", sort: "updated_desc" });
  assert.deepEqual(defaultResourceView("policies"), { query: "", filter: "all", sort: "priority_asc" });
});

test("toolbarStatusLabel preserves default and pluralized active-control copy", () => {
  assert.equal(toolbarStatusLabel(0, false), "Default view");
  assert.equal(toolbarStatusLabel(1, true), "1 active control");
  assert.equal(toolbarStatusLabel(3, true), "3 active controls");
});

test("applyResourceView filters, searches, and sorts proxies with the shared view state shape", () => {
  const items = [
    { id: 1, name: "tokyo-proxy", address: "10.0.0.1:1080", username: "alpha", enabled: true, updated_at: "2026-06-18T12:00:00Z" },
    { id: 2, name: "sydney-proxy", address: "10.0.0.2:1080", username: "beta", enabled: false, updated_at: "2026-06-19T12:00:00Z" },
    { id: 3, name: "amsterdam-proxy", address: "10.0.0.3:1080", username: "gamma", enabled: true, updated_at: "2026-06-17T12:00:00Z" },
  ];

  const filtered = applyResourceView("proxies", items, {
    proxies: { query: "proxy", filter: "enabled", sort: "name_asc" },
  });

  assert.deepEqual(filtered.map((item) => item.id), [3, 1]);
});

test("applyResourceView preserves policy failover filtering and priority sorting", () => {
  const items = [
    { id: 7, pattern: "gpt-4*", endpoint: "chat", placement_policy: "sticky", backend_pool: "premium", failover_enabled: false, priority: 30, updated_at: "2026-06-19T12:00:00Z" },
    { id: 8, pattern: "gpt-*", endpoint: "responses", placement_policy: "round_robin", backend_pool: "shared", failover_enabled: true, priority: 20, updated_at: "2026-06-18T12:00:00Z" },
    { id: 9, pattern: "claude-*", endpoint: "chat", placement_policy: "sticky", backend_pool: "premium", failover_enabled: true, priority: 10, updated_at: "2026-06-17T12:00:00Z" },
  ];

  const filtered = applyResourceView("policies", items, {
    policies: { query: "chat", filter: "enabled", sort: "priority_asc" },
  });

  assert.deepEqual(filtered.map((item) => item.id), [9]);
});

test("applyResourceView searches backend fields across base url, pool, models, and endpoints", () => {
  const items = [
    {
      id: 11,
      name: "edge-east",
      base_url: "https://east.example/v1",
      pool: "premium",
      models: ["gpt-5.4"],
      endpoints: ["responses"],
      enabled: true,
      updated_at: "2026-06-18T12:00:00Z",
    },
    {
      id: 12,
      name: "edge-west",
      base_url: "https://west.example/v1",
      pool: "shared",
      models: ["claude-sonnet-4"],
      endpoints: ["messages"],
      enabled: true,
      updated_at: "2026-06-19T12:00:00Z",
    },
  ];

  assert.deepEqual(
    applyResourceView("backends", items, {
      backends: { query: "shared", filter: "enabled", sort: "updated_desc" },
    }).map((item) => item.id),
    [12],
  );

  assert.deepEqual(
    applyResourceView("backends", items, {
      backends: { query: "responses", filter: "enabled", sort: "updated_desc" },
    }).map((item) => item.id),
    [11],
  );
});

test("applyResourceView preserves client search and route-group sorting behavior", () => {
  const items = [
    {
      id: 21,
      name: "web-prod",
      route_group: "beta",
      route_mode_override: "sticky",
      token_prefix: "prod-ab",
      enabled: true,
      updated_at: "2026-06-18T12:00:00Z",
    },
    {
      id: 22,
      name: "web-stage",
      route_group: "alpha",
      route_mode_override: "random",
      token_prefix: "stage-cd",
      enabled: true,
      updated_at: "2026-06-19T12:00:00Z",
    },
  ];

  assert.deepEqual(
    applyResourceView("clients", items, {
      clients: { query: "stage-cd", filter: "enabled", sort: "group_asc" },
    }).map((item) => item.id),
    [22],
  );

  assert.deepEqual(
    applyResourceView("clients", items, {
      clients: { query: "web", filter: "enabled", sort: "group_asc" },
    }).map((item) => item.id),
    [22, 21],
  );
});

test("currentLocalPageData normalizes page size and clamps page state from filtered rows", () => {
  const state = {
    pagination: {
      backends: { page: 9, size: 20 },
    },
  };
  const items = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));

  const pageData = currentLocalPageData("backends", items, state, { pageSizeOptions: [10, 20, 50] });

  assert.equal(pageData.page, 1);
  assert.equal(pageData.size, 20);
  assert.equal(pageData.total, 12);
  assert.equal(pageData.totalPages, 1);
  assert.deepEqual(pageData.items, items);
  assert.deepEqual(state.pagination.backends, { page: 1, size: 20 });
});

test("currentRemotePageData uses remote pagination metadata and accepted page sizes", () => {
  const state = {
    pagination: {
      usageLogs: { page: 1, size: 999 },
    },
    paginationMeta: {
      usageLogs: { total: 42, page: 3, limit: 20 },
    },
  };

  const pageData = currentRemotePageData("usageLogs", [{ id: 1 }, { id: 2 }], state, { pageSizeOptions: [10, 20, 50] });

  assert.deepEqual(pageData, {
    items: [{ id: 1 }, { id: 2 }],
    page: 3,
    size: 10,
    total: 42,
    totalPages: 5,
  });
});

test("applyPagedResponse updates list state and clamps page using payload metadata", () => {
  const state = {
    events: [],
    pagination: {
      events: { page: 1, size: 10 },
    },
    paginationMeta: {
      events: { total: 0, page: 1, limit: 10 },
    },
  };

  applyPagedResponse("events", {
    items: [{ id: "e-1" }, { id: "e-2" }],
    total: 31,
    limit: 20,
    page: 9,
  }, state, { pageSizeOptions: [10, 20, 50] });

  assert.deepEqual(state.events, [{ id: "e-1" }, { id: "e-2" }]);
  assert.deepEqual(state.pagination.events, { page: 2, size: 20 });
  assert.deepEqual(state.paginationMeta.events, { total: 31, page: 2, limit: 20 });
});

test("paginationPageNumbers preserves ellipsis layout for long result sets", () => {
  assert.deepEqual(
    paginationPageNumbers({ page: 1, totalPages: 3 }),
    [1, 2, 3],
  );
  assert.deepEqual(
    paginationPageNumbers({ page: 2, totalPages: 10 }),
    [1, 2, 3, 4, 5, "...", 10],
  );
  assert.deepEqual(
    paginationPageNumbers({ page: 6, totalPages: 10 }),
    [1, "...", 5, 6, 7, "...", 10],
  );
  assert.deepEqual(
    paginationPageNumbers({ page: 9, totalPages: 10 }),
    [1, "...", 6, 7, 8, 9, 10],
  );
});
