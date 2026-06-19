import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  createQuickDetailSections,
  createResourceToolbarModel,
  createResourceTableModel,
  paginateResourceRows,
} = require("./renderers.js");

test("createResourceToolbarModel keeps shared admin list actions in order", () => {
  assert.deepEqual(createResourceToolbarModel({
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
  }), {
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
    actions: ["search", "filters", "sort", "refresh"],
  });
});

test("createResourceTableModel normalizes rows and columns for premium list pages", () => {
  const model = createResourceTableModel({
    columns: [
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
    ],
    rows: [
      { id: 7, name: "edge-a", status: "enabled" },
    ],
  });

  assert.deepEqual(model.columns, [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
  ]);
  assert.deepEqual(model.rows, [
    { id: "7", values: { id: 7, name: "edge-a", status: "enabled" } },
  ]);
});

test("createQuickDetailSections limits inline expansion to concise summaries", () => {
  const sections = createQuickDetailSections("backends", {
    id: 7,
    base_url: "https://edge.example.com/v1",
    models: ["gpt-4o", "gpt-4.1"],
    endpoints: ["chat", "responses"],
    model_count: 2,
    endpoint_count: 2,
    pool: "premium",
    proxy: { name: "tokyo-egress" },
    request_count: 42,
    avg_latency_ms: 88,
    last_used_at: "2026-06-19T13:00:00Z",
    model_mapping: { "gpt-4o": "gpt-4o-prod" },
  });

  assert.deepEqual(sections, [
    { title: "Relationships", items: ["Pool premium", "Proxy tokyo-egress"] },
    { title: "Capabilities", items: ["2 models", "2 endpoints"] },
    { title: "Usage", items: ["42 requests", "88 ms avg latency", "Last used 2026-06-19T13:00:00Z"] },
    { title: "JSON Preview", items: ['"base_url":"https://edge.example.com/v1"', '"gpt-4o":"gpt-4o-prod"'] },
  ]);
});

test("createQuickDetailSections surfaces client usage and routing summaries", () => {
  const sections = createQuickDetailSections("clients", {
    name: "prod-web",
    token: "client-visible-key",
    masked_token: "client-v...-key",
    route_mode_override: "sticky",
    route_group: "frontend-a",
    usage_count: 12,
    last_used_at: "2026-06-19T12:00:00Z",
  });

  assert.deepEqual(sections, [
    { title: "Routing", items: ["Route sticky", "Group frontend-a"] },
    { title: "Usage", items: ["12 requests", "Last used 2026-06-19T12:00:00Z"] },
    { title: "Client Key", items: ["client-v...-key", "client-visible-key"] },
  ]);
});

test("createQuickDetailSections preserves legacy prefix-only client key context", () => {
  const sections = createQuickDetailSections("clients", {
    route_mode_override: "",
    route_group: "",
    token_prefix: "legacy-ab",
  });

  assert.deepEqual(sections, [
    { title: "Routing", items: ["Route default"] },
    { title: "Usage", items: [] },
    { title: "Client Key", items: ["Prefix legacy-ab (历史记录仅保存 prefix)"] },
  ]);
});

test("createQuickDetailSections surfaces proxy bindings and usage summary", () => {
  const sections = createQuickDetailSections("proxies", {
    username: "proxy-user",
    address: "127.0.0.1:1080",
    enabled: true,
    password: "secret",
    bound_backend_count: 3,
    request_count: 42,
    avg_latency_ms: 88,
    last_used_at: "2026-06-19T13:00:00Z",
  });

  assert.deepEqual(sections, [
    { title: "Relationships", items: ["3 bound backends", "Address 127.0.0.1:1080"] },
    { title: "Usage", items: ["42 requests", "88 ms avg latency", "Last used 2026-06-19T13:00:00Z"] },
    { title: "Access", items: ["Auth user proxy-user", "Password set", "Enabled"] },
  ]);
});

test("paginateResourceRows uses local filtered totals and clamps out-of-range pages", () => {
  assert.deepEqual(
    paginateResourceRows(
      [
        { id: 1, name: "alpha" },
        { id: 2, name: "beta" },
        { id: 3, name: "gamma" },
      ],
      { page: 4, size: 2 },
    ),
    {
      items: [{ id: 3, name: "gamma" }],
      page: 2,
      size: 2,
      total: 3,
      totalPages: 2,
    },
  );
});
