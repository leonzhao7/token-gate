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

test("createResourceToolbarModel keeps shared admin list actions in order and adds resource-specific create metadata", () => {
  assert.deepEqual(createResourceToolbarModel({
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
    count: 12,
    activeFilters: 2,
    hasChanges: true,
  }), {
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
    count: 12,
    activeFilters: 2,
    hasChanges: true,
    createLabel: "新增 Backend",
    actions: ["search", "filters", "sort", "reset", "refresh", "create"],
  });
});

test("createResourceToolbarModel maps create labels per resource", () => {
  assert.equal(createResourceToolbarModel({ resourceKey: "clients" }).createLabel, "新增 Client Key");
  assert.equal(createResourceToolbarModel({ resourceKey: "proxies" }).createLabel, "新增 Proxy");
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

test("createQuickDetailSections keeps backend inline expansion focused on routing and capability metadata", () => {
  const sections = createQuickDetailSections("backends", {
    base_url: "https://edge.example.com/v1",
    proxy: { name: "tokyo-egress" },
    model_mapping: { "gpt-4o": "gpt-4o-prod" },
  });

  assert.deepEqual(sections, [
    {
      title: "Routing",
      tone: "success",
      items: [
        { label: "Proxy", value: "tokyo-egress" },
        { label: "Base URL", value: "https://edge.example.com/v1" },
      ],
    },
    {
      title: "Capabilities",
      tone: "neutral",
      items: [
        { label: "Mapping", value: '"gpt-4o":"gpt-4o-prod"' },
      ],
    },
  ]);
});

test("createQuickDetailSections surfaces backend console metadata in inline expansion", () => {
  const sections = createQuickDetailSections("backends", {
    console_username: "console-user",
    console_password: "console-pass",
    notes: "night shift",
    proxy: { name: "tokyo-egress" },
    base_url: "https://edge.example.com/v1",
    model_mapping: { "gpt-4o": "gpt-4o-prod" },
    last_used_at: "2026-06-19T13:00:00Z",
    hourly_requests: 19,
    hourly_failures: 2,
    recent_stats: { window_minutes: 30, successes: 17, failures: 1 },
  });

  assert.deepEqual(sections, [
    {
      title: "Console Access",
      tone: "primary",
      items: [
        { label: "Username", value: "console-user" },
        { label: "Password", value: "set" },
        { label: "Notes", value: "night shift" },
      ],
    },
    {
      title: "Routing",
      tone: "success",
      items: [
        { label: "Proxy", value: "tokyo-egress" },
        { label: "Base URL", value: "https://edge.example.com/v1" },
      ],
    },
    {
      title: "Capabilities",
      tone: "neutral",
      items: [
        { label: "Mapping", value: '"gpt-4o":"gpt-4o-prod"' },
      ],
    },
    {
      title: "Recent Usage",
      tone: "warning",
      items: [
        { label: "Last used", value: "2026-06-19T13:00:00Z" },
        { label: "1h", value: "19 req / 2 fail" },
        { label: "30m", value: "17 ok / 1 fail (30m)" },
      ],
    },
  ]);
});

test("createQuickDetailSections surfaces client usage summaries", () => {
  const sections = createQuickDetailSections("clients", {
    name: "prod-web",
    token: "client-visible-key",
    masked_token: "client-v...-key",
    usage_count: 12,
    last_used_at: "2026-06-19T12:00:00Z",
  });

  assert.deepEqual(sections, [
    {
      title: "Usage",
      tone: "success",
      items: [
        { label: "Requests", value: "12" },
        { label: "Last used", value: "2026-06-19T12:00:00Z" },
      ],
    },
    {
      title: "Client Key",
      tone: "neutral",
      items: [
        { label: "Masked", value: "client-v...-key" },
        { label: "Visible", value: "client-visible-key" },
      ],
    },
  ]);
});

test("createQuickDetailSections preserves legacy prefix-only client key context", () => {
  const sections = createQuickDetailSections("clients", {
    token_prefix: "legacy-ab",
  });

  assert.deepEqual(sections, [
    {
      title: "Client Key",
      tone: "neutral",
      items: [{ label: "Prefix", value: "legacy-ab (历史记录仅保存 prefix)" }],
    },
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
    {
      title: "Relationships",
      tone: "primary",
      items: [
        { label: "Bound backends", value: "3" },
        { label: "Address", value: "127.0.0.1:1080" },
      ],
    },
    {
      title: "Usage",
      tone: "warning",
      items: [
        { label: "Requests", value: "42" },
        { label: "Avg latency", value: "88 ms" },
        { label: "Last used", value: "2026-06-19T13:00:00Z" },
      ],
    },
    {
      title: "Access",
      tone: "success",
      items: [
        { label: "Auth", value: "proxy-user" },
        { label: "Password", value: "set" },
        { label: "Status", value: "enabled" },
      ],
    },
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
