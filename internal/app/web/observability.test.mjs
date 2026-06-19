import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildEventQueryParams,
  buildUsageLogQueryParams,
  createEventSummaryModel,
  createEventTimelineItems,
  createUsageLogDetailPreview,
  createUsageLogRows,
  createUsageStatsCards,
  formatUsageLogRequestLine,
  normalizeUsageLogStatus,
  statusTone,
  toAPIDateTime,
} = require("./observability.js");

test("createUsageStatsCards maps usage stats into premium metric cards", () => {
  assert.deepEqual(createUsageStatsCards({
    totals: { requests: 17, successes: 15, failures: 2 },
    latency: { avg_ms: 241.6, p95_ms: 903 },
    status_families: [
      { family: "2xx", count: 15 },
      { family: "4xx", count: 2 },
    ],
  }), [
    { key: "requests", label: "Requests", value: "17", detail: "15 success / 2 failed", tone: "primary" },
    { key: "success_rate", label: "Success Rate", value: "88.2%", detail: "2 failures", tone: "success" },
    { key: "avg_latency", label: "Avg Latency", value: "242 ms", detail: "p95 903 ms", tone: "neutral" },
    { key: "status_mix", label: "Status Mix", value: "2xx 15", detail: "4xx 2", tone: "warning" },
  ]);
});

test("statusTone classifies status codes for badges", () => {
  assert.equal(statusTone(200), "success");
  assert.equal(statusTone(302), "primary");
  assert.equal(statusTone(429), "warning");
  assert.equal(statusTone(503), "danger");
  assert.equal(statusTone(0), "neutral");
});

test("createUsageLogRows keeps request metadata needed by the usage table", () => {
  assert.deepEqual(createUsageLogRows([
    {
      id: 9,
      request_id: "req-9",
      created_at: "2026-06-18T01:02:55.123Z",
      method: "POST",
      path: "/v1/responses",
      status_code: 429,
      duration_ms: 804,
      client_name: "web-prod",
      client_ip: "127.0.0.1:51234",
      backend_name: "edge-a",
      proxy_name: "tokyo",
      model: "gpt-5.4",
      trace_id: "trace-9",
      query: "stream=true",
      request_headers_json: "{\"content-type\":\"application/json\"}",
      request_body_preview: "{\"model\":\"gpt-5.4\"}",
      response_body_preview: "{\"id\":\"resp_1\"}",
      status_family: "4xx",
    },
  ]), [
    {
      id: "9",
      requestId: "req-9",
      timestamp: "2026-06-18T01:02:55.123Z",
      method: "POST",
      path: "/v1/responses",
      status: "429",
      tone: "warning",
      latency: "804 ms",
      clientKey: "web-prod",
      client: "127.0.0.1:51234",
      backend: "edge-a",
      proxy: "tokyo",
      model: "gpt-5.4",
      traceId: "trace-9",
      requestMetadata: "POST /v1/responses?stream=true",
      headersPreview: "{\"content-type\":\"application/json\"}",
      payloadPreview: "{\"model\":\"gpt-5.4\"}",
      responsePreview: "{\"id\":\"resp_1\"}",
      statusFamily: "4xx",
    },
  ]);
});

test("createUsageLogDetailPreview prefers fetched detail and keeps the inline detail fields", () => {
  assert.deepEqual(
    createUsageLogDetailPreview(
      {
        request: {
          method: "POST",
          path: "/v1/responses",
          query: "stream=true",
          headers: "{\"content-type\":\"application/json\"}",
          body_preview: "{\"model\":\"gpt-5.4\"}",
        },
        response: {
          body_preview: "{\"id\":\"resp_1\"}",
        },
      },
      {
        traceId: "trace-9",
        headersPreview: "-",
        payloadPreview: "-",
        responsePreview: "-",
      },
    ),
    [
      { key: "trace", label: "Trace ID", value: "trace-9" },
      { key: "request", label: "Request", value: "POST /v1/responses?stream=true" },
      { key: "headers", label: "Headers", value: "{\"content-type\":\"application/json\"}" },
      { key: "payload", label: "Payload", value: "{\"model\":\"gpt-5.4\"}" },
      { key: "response", label: "Response", value: "{\"id\":\"resp_1\"}" },
    ],
  );
});

test("buildUsageLogQueryParams uses the shared filter set for list, stats, and delete requests", () => {
  const query = buildUsageLogQueryParams({
    q: "trace-9",
    dateFrom: "2026-06-18",
    dateTo: "2026-06-19",
    backend: "alpha",
    model: "gpt-5.4",
    clientKey: "web-prod",
    policy: "gpt-*",
    proxy: "tokyo",
    status: "4xx",
  });
  const params = new URLSearchParams(query);
  assert.equal(params.get("q"), "trace-9");
  assert.equal(params.get("backend"), "alpha");
  assert.equal(params.get("model"), "gpt-5.4");
  assert.equal(params.get("client_key"), "web-prod");
  assert.equal(params.get("policy"), "gpt-*");
  assert.equal(params.get("proxy"), "tokyo");
  assert.equal(params.get("status"), "4xx");
  assert.match(params.get("date_from") || "", /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.match(params.get("date_to") || "", /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("buildUsageLogQueryParams drops invalid status filters", () => {
  const params = new URLSearchParams(buildUsageLogQueryParams({
    q: "trace-9",
    status: "warning",
  }));
  assert.equal(params.get("q"), "trace-9");
  assert.equal(params.has("status"), false);
  assert.equal(normalizeUsageLogStatus("5XX"), "5xx");
  assert.equal(normalizeUsageLogStatus("warning"), "");
});

test("formatUsageLogRequestLine keeps method and path separated", () => {
  assert.equal(
    formatUsageLogRequestLine({ method: "POST", path: "/v1/responses", query: "stream=true" }),
    "POST /v1/responses?stream=true",
  );
  assert.equal(
    formatUsageLogRequestLine({}, { method: "GET", path: "/v1/models", query: "" }),
    "GET /v1/models",
  );
});

test("createEventSummaryModel normalizes counters and keeps common categories", () => {
  assert.deepEqual(createEventSummaryModel({
    total: 8,
    categories: [
      { category: "backend", count: 4 },
      { category: "security", count: 1 },
    ],
    severities: [
      { severity: "error", count: 2 },
      { severity: "warning", count: 3 },
    ],
  }), {
    total: 8,
    categories: [
      { key: "system", label: "System", count: 0, tone: "neutral" },
      { key: "backend", label: "Backend", count: 4, tone: "success" },
      { key: "policy", label: "Policy", count: 0, tone: "primary" },
      { key: "proxy", label: "Proxy", count: 0, tone: "neutral" },
      { key: "client_key", label: "Client Key", count: 0, tone: "primary" },
      { key: "security", label: "Security", count: 1, tone: "danger" },
    ],
    severities: [
      { key: "error", label: "Errors", count: 2, tone: "danger" },
      { key: "warning", label: "Warnings", count: 3, tone: "warning" },
      { key: "info", label: "Info", count: 0, tone: "primary" },
    ],
  });
});

test("createEventTimelineItems maps raw events into timeline rows", () => {
  assert.deepEqual(createEventTimelineItems([
    {
      id: 11,
      type: "backend.failover",
      category: "backend",
      severity: "warning",
      actor: "system",
      message: "switched backend",
      backend_name: "edge-b",
      client_name: "web-prod",
      created_at: "2026-06-18T01:02:55.123Z",
    },
  ]), [
    {
      id: "11",
      icon: "B",
      title: "backend.failover",
      description: "switched backend",
      actor: "system",
      timestamp: "2026-06-18T01:02:55.123Z",
      category: "backend",
      severity: "warning",
      tone: "warning",
      meta: "edge-b · web-prod",
    },
  ]);
});

test("createEventSummaryModel folds warn into warning counters", () => {
  assert.equal(
    createEventSummaryModel({
      total: 3,
      categories: [],
      severities: [
        { severity: "warn", count: 2 },
        { severity: "warning", count: 1 },
      ],
    }).severities.find((item) => item.key === "warning")?.count,
    3,
  );
});

test("toAPIDateTime converts date-only filters into RFC3339 boundaries", () => {
  assert.match(toAPIDateTime("2026-06-19"), /^2026-06-18T16:00:00\.000Z|^2026-06-19T00:00:00\.000Z/);
  assert.match(toAPIDateTime("2026-06-19", true), /^2026-06-19T15:59:59\.999Z|^2026-06-19T23:59:59\.999Z/);
  assert.equal(toAPIDateTime(""), "");
});

test("buildEventQueryParams includes text, actor, backend, and timeline filters", () => {
  const query = buildEventQueryParams({
    q: "failover",
    actor: "system",
    backend: "edge-a",
    category: "backend",
    severity: "warning",
    dateFrom: "2026-06-18",
    dateTo: "2026-06-19",
  });
  const params = new URLSearchParams(query);
  assert.equal(params.get("q"), "failover");
  assert.equal(params.get("actor"), "system");
  assert.equal(params.get("backend"), "edge-a");
  assert.equal(params.get("category"), "backend");
  assert.equal(params.get("severity"), "warning");
  assert.match(params.get("date_from") || "", /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.match(params.get("date_to") || "", /T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
