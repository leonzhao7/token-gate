import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  renderResourceToolbar,
  createQuickDetailMarkup,
  renderProxyRow,
  renderBackendRow,
  renderClientRow,
  renderResourceTablePage,
} = require("./resource-view.js");

test("renderResourceToolbar renders search, count, status and complete admin controls", () => {
  const html = renderResourceToolbar({
    resourceKey: "backends",
    viewState: { query: "gpt", filter: "enabled", sort: "weight_desc" },
    model: { searchPlaceholder: "Search backends", count: 12, createLabel: "新增 Backend" },
    config: {
      filterOptions: [{ value: "all", label: "All" }, { value: "enabled", label: "Enabled" }],
      sortOptions: [{ value: "updated_desc", label: "Updated" }, { value: "weight_desc", label: "Weight" }],
    },
    activeFilters: 2,
    hasChanges: true,
  });

  assert.match(html, /Search backends/);
  assert.match(html, /12 items/);
  assert.match(html, /2 active controls/);
  assert.match(html, /data-toolbar-search="backends"/);
  assert.match(html, /data-toolbar-filter="backends"/);
  assert.match(html, /data-toolbar-sort="backends"/);
  assert.match(html, /data-toolbar-create="backends"/);
  assert.match(html, /新增 Backend/);
  assert.match(html, /data-toolbar-refresh="backends"/);
  assert.match(html, /resource-toolbar-button/);
  assert.match(html, /data-shell-icon="toolbar-reset"/);
  assert.match(html, /data-shell-icon="toolbar-refresh"/);
  assert.match(html, /data-shell-icon="toolbar-create"/);
});

test("createQuickDetailMarkup renders structured quick detail cards", () => {
  const html = createQuickDetailMarkup({
    sections: [{
      title: "Usage",
      tone: "warning",
      items: [
        { label: "Requests", value: "42" },
        { label: "Avg latency", value: "88 ms" },
      ],
    }],
  });

  assert.match(html, /Usage/);
  assert.match(html, /Requests/);
  assert.match(html, /88 ms/);
});

test("resource row renderers output expandable rows with actions", () => {
  const proxyRow = renderProxyRow({
    proxy: {
      id: 1,
      name: "tokyo-proxy",
      enabled: true,
      bound_backend_count: 3,
      traffic_bytes: 4096,
      avg_latency_ms: 82,
      last_used_at: "2026-06-19T00:00:00Z",
      updated_at: "2026-06-19T00:10:00Z",
    },
    expanded: true,
    editing: false,
    quickDetails: "<div>proxy-detail</div>",
    statusPill() {
      return "<span>enabled</span>";
    },
    formatBindingCount() {
      return "3 backends";
    },
    formatDataSize() {
      return "4 KB";
    },
    formatLatency() {
      return "82 ms";
    },
    formatDateTime(value) {
      return `dt:${value}`;
    },
    tableActions() {
      return "<div>actions</div>";
    },
  });

  const backendRow = renderBackendRow({
    backend: {
      id: 2,
      name: "edge-a",
      base_url: "https://edge-a.example/v1",
      status: "normal",
      protocol: "openai",
      request_count: 19,
      avg_latency_ms: 41,
      last_used_at: "2026-06-19T00:00:00Z",
      recent_stats: { window_minutes: 30, successes: 18, failures: 1 },
    },
    expanded: false,
    editing: true,
    quickDetails: "",
    statusPill() {
      return "<span>enabled</span>";
    },
    formatBackendRouting() {
      return "direct";
    },
    formatBackendCoverage() {
      return "2 models / 2 endpoints";
    },
    backendProtocolLabel() {
      return "OpenAI";
    },
    formatUsageCount() {
      return "19 requests";
    },
    formatLatency() {
      return "41 ms";
    },
    formatDateTime(value) {
      return `dt:${value}`;
    },
    formatBackendRecentStats() {
      return "30m 18 ok / 1 fail";
    },
    tableActions() {
      return "<div>actions</div>";
    },
  });

  const clientRow = renderClientRow({
    client: {
      id: 3,
      name: "client-a",
      enabled: true,
      usage_count: 7,
      last_used_at: "2026-06-19T00:00:00Z",
      updated_at: "2026-06-19T00:10:00Z",
    },
    expanded: false,
    editing: false,
    quickDetails: "",
    clientTokenText: "client-v...-key",
    statusPill() {
      return "<span>enabled</span>";
    },
    formatUsageCount() {
      return "7 requests";
    },
    formatDateTime(value) {
      return `dt:${value}`;
    },
    tableActions() {
      return "<div>actions</div>";
    },
  });

  assert.match(proxyRow, /tokyo-proxy/);
  assert.match(proxyRow, /proxy-detail/);
  assert.match(proxyRow, /aria-expanded="true"/);
  assert.match(proxyRow, /data-shell-icon="row-collapse"/);
  assert.doesNotMatch(proxyRow, />收起</);
  assert.match(backendRow, /edge-a/);
  assert.match(backendRow, /30m 18 ok \/ 1 fail/);
  assert.match(backendRow, /aria-expanded="false"/);
  assert.match(backendRow, /data-shell-icon="row-expand"/);
  assert.doesNotMatch(backendRow, />展开</);
  assert.match(clientRow, /client-v\.\.\.-key/);
});

test("renderResourceTablePage renders empty and table states", () => {
  const emptyHTML = renderResourceTablePage({
    toolbar: "<div>toolbar</div>",
    isEmpty: true,
    emptyMarkup: "<article>empty</article>",
    headers: [],
    rowsMarkup: "",
    paginationMarkup: "",
  });

  const tableHTML = renderResourceTablePage({
    toolbar: "<div>toolbar</div>",
    isEmpty: false,
    emptyMarkup: "",
    headers: ["Proxy", "Status"],
    rowsMarkup: "<tr><td>a</td><td>b</td></tr>",
    paginationMarkup: "<nav>pager</nav>",
  });

  assert.match(emptyHTML, /toolbar/);
  assert.match(emptyHTML, /empty/);
  assert.match(tableHTML, /<th>Proxy<\/th>/);
  assert.match(tableHTML, /pager/);
});
