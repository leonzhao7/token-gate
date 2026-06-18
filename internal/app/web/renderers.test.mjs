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
    actions: ["search", "filters", "sort", "refresh", "create"],
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
    pool: "premium",
    proxy: { name: "tokyo-egress" },
    model_mapping: { "gpt-4o": "gpt-4o-prod" },
  });

  assert.deepEqual(sections, [
    { title: "Relationships", items: ["Pool premium", "Proxy tokyo-egress"] },
    { title: "Capabilities", items: ["2 models", "2 endpoints"] },
    { title: "JSON Preview", items: ['"base_url":"https://edge.example.com/v1"', '"gpt-4o":"gpt-4o-prod"'] },
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
