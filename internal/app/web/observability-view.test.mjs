import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  renderEventsPage,
  renderUsageLogsPage,
  renderUsageLogRow,
  renderUsageLogInlineDetail,
  formatInlinePreview,
} = require("./observability-view.js");

test("renderEventsPage renders timeline and summary sidebar", () => {
  const html = renderEventsPage({
    events: [{ id: "1" }],
    pageData: { items: [{ id: "1" }], total: 1 },
    timelineItems: [{
      id: "1",
      title: "backend.failover",
      description: "switched backend",
      timestamp: "2026-06-19T00:00:00Z",
      category: "backend",
      tone: "warning",
      meta: "edge-a",
      actor: "system",
      icon: "B",
    }],
    summary: {
      total: 1,
      categories: [{ label: "Backend", count: 1, tone: "success" }],
      severities: [{ label: "Warnings", count: 1, tone: "warning" }],
    },
    formatDateTime(value) {
      return `dt:${value}`;
    },
    renderPagination() {
      return "<nav>pager</nav>";
    },
    emptyState() {
      return "<div>empty</div>";
    },
    feedToneClass() {
      return "ok";
    },
  });

  assert.match(html, /backend\.failover/);
  assert.match(html, /dt:2026-06-19T00:00:00Z/);
  assert.match(html, /1 events/);
  assert.match(html, /Timeline/);
  assert.match(html, /observability-section-head/);
  assert.match(html, /pager/);
});

test("renderUsageLogsPage renders stats and table rows", () => {
  const html = renderUsageLogsPage({
    logs: [{ id: "9" }],
    pageData: { items: [{ id: "9" }], total: 1 },
    statsCards: [{ label: "Requests", value: "1", detail: "1 success / 0 failed", tone: "primary" }],
    rows: [{ id: "9" }],
    pageRows: [{
      id: "9",
      timestamp: "2026-06-19T00:00:00Z",
      method: "POST",
      path: "/v1/responses",
      status: "200",
      tone: "success",
      latency: "100 ms",
      clientKey: "alpha",
      backend: "edge-a",
      proxy: "tokyo",
      traceId: "trace-9",
      requestId: "req-9",
      model: "gpt-5.4",
    }],
    expandedUsageLogs: new Set(),
    deleteDisabled: false,
    formatDateTime(value) {
      return `dt:${value}`;
    },
    renderPagination() {
      return "<nav>pager</nav>";
    },
    emptyState() {
      return "<div>empty</div>";
    },
    renderUsageLogInlineDetail() {
      return "<div>inline</div>";
    },
  });

  assert.match(html, /Requests/);
  assert.match(html, /POST/);
  assert.match(html, /trace-9/);
  assert.match(html, /Request Stream/);
  assert.match(html, /observability-section-head/);
  assert.match(html, /pager/);
});

test("renderUsageLogRow and inline detail render expanded content", () => {
  const rowHTML = renderUsageLogRow({
    row: {
      id: "9",
      timestamp: "2026-06-19T00:00:00Z",
      method: "POST",
      path: "/v1/responses",
      status: "429",
      tone: "warning",
      latency: "804 ms",
      clientKey: "alpha",
      backend: "edge-a",
      proxy: "tokyo",
      traceId: "trace-9",
      requestId: "req-9",
      model: "gpt-5.4",
    },
    expanded: true,
    formatDateTime(value) {
      return `dt:${value}`;
    },
    renderInlineDetail() {
      return "<div>expanded</div>";
    },
  });

  assert.match(rowHTML, /req-9/);
  assert.match(rowHTML, /expanded/);
  assert.match(rowHTML, /dt:2026-06-19T00:00:00Z/);

  const detailHTML = renderUsageLogInlineDetail({
    detail: { error: "Failed to load usage log detail" },
    row: { traceId: "trace-9", requestMetadata: "POST \\/v1\\/responses" },
    formatInlinePreview,
  });
  assert.match(detailHTML, /trace-9/);
  assert.match(detailHTML, /Failed to load usage log detail/);
});

test("formatInlinePreview trims long payload text", () => {
  assert.equal(formatInlinePreview(""), "-");
  assert.equal(formatInlinePreview("short"), "short");
  assert.match(formatInlinePreview("x".repeat(220)), /^x{177}\.\.\.$/);
});
