import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildDrawerActivitySections,
  drawerDisplayTitle,
  buildDrawerTarget,
  drawerFooterActions,
  drawerTabsForResource,
  normalizeDrawerPayload,
  normalizeResourceKind,
} = require("./drawer.js");

test("normalizeResourceKind maps aliases and page ids to canonical resource keys", () => {
  assert.equal(normalizeResourceKind("backend"), "backends");
  assert.equal(normalizeResourceKind("client_key"), "clients");
  assert.equal(normalizeResourceKind("client-keys"), "clients");
  assert.equal(normalizeResourceKind("proxy"), "proxies");
  assert.equal(normalizeResourceKind("socks-proxies"), "proxies");
  assert.equal(normalizeResourceKind("usage_log"), "usage_logs");
  assert.equal(normalizeResourceKind("events"), "events");
});

test("buildDrawerTarget returns detail and delete endpoints for supported resources", () => {
  assert.deepEqual(buildDrawerTarget({ kind: "backend", page: "backends", id: "7" }), {
    kind: "backends",
    id: "7",
    title: "Backend",
    detailPath: "/admin/api/backends/7/detail",
    deletePath: "/admin/api/backends/7",
    page: "backends",
  });

  assert.deepEqual(buildDrawerTarget({ kind: "client_key", page: "client-keys", id: "12" }), {
    kind: "clients",
    id: "12",
    title: "Client Key",
    detailPath: "/admin/api/client-keys/12/detail",
    deletePath: "/admin/api/client-keys/12",
    page: "client-keys",
  });

  assert.deepEqual(buildDrawerTarget({ kind: "usage_log", page: "usage-logs", id: "9" }), {
    kind: "usage_logs",
    id: "9",
    title: "Usage Log",
    detailPath: "/admin/api/usage-logs/9",
    deletePath: "",
    page: "usage-logs",
  });

  assert.deepEqual(buildDrawerTarget({ kind: "event", page: "events", id: "13" }), {
    kind: "events",
    id: "13",
    title: "Event",
    detailPath: "/admin/api/events/13",
    deletePath: "",
    page: "events",
  });
});

test("drawerDisplayTitle uses canonical resource titles for all supported drawer resources", () => {
  assert.equal(drawerDisplayTitle("backends"), "Backend");
  assert.equal(drawerDisplayTitle("clients"), "Client Key");
  assert.equal(drawerDisplayTitle("proxies"), "Proxy");
  assert.equal(drawerDisplayTitle("events"), "Event");
  assert.equal(drawerDisplayTitle("usage_logs"), "Usage Log");
  assert.equal(drawerDisplayTitle("unknown"), "Resource");
});

test("drawerTabsForResource keeps events on the standard drawer layout", () => {
  assert.deepEqual(drawerTabsForResource("events"), [
    { key: "overview", label: "Overview" },
    { key: "configuration", label: "Configuration" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
    { key: "activity", label: "Activity" },
  ]);
});

test("drawerTabsForResource returns the premium drawer tab order", () => {
  assert.deepEqual(drawerTabsForResource("backends"), [
    { key: "overview", label: "Overview" },
    { key: "configuration", label: "Configuration" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
    { key: "activity", label: "Activity" },
  ]);
  assert.deepEqual(drawerTabsForResource("usage_logs"), [
    { key: "overview", label: "Overview" },
    { key: "request", label: "Request" },
    { key: "response", label: "Response" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
  ]);
});

test("normalizeDrawerPayload guarantees all tab payload buckets", () => {
  assert.deepEqual(normalizeDrawerPayload({
    overview: { name: "edge-a" },
    raw: { id: 7 },
  }), {
    overview: { name: "edge-a" },
    configuration: {},
    metadata: {},
    raw: { id: 7 },
    request: {},
    response: {},
    activity: {},
  });
});

test("normalizeDrawerPayload converts array-based detail sections and usage_logs into drawer-friendly objects", () => {
  assert.deepEqual(normalizeDrawerPayload({
    overview: [{ key: "name", label: "Name", value: "edge-a" }],
    configuration: [{ label: "Base URL", value: "https://edge-a.local/v1" }],
    metadata: [{ key: "created_at", label: "Created At", value: "2026-06-22T00:00:00Z" }],
    activity: {
      usage_logs: [{ id: 1 }],
      events: [{ id: 2 }],
    },
  }), {
    overview: { name: "edge-a" },
    configuration: { base_url: "https://edge-a.local/v1" },
    metadata: { created_at: "2026-06-22T00:00:00Z" },
    raw: {},
    request: {},
    response: {},
    activity: {
      usage_logs: [{ id: 1 }],
      usage: [{ id: 1 }],
      events: [{ id: 2 }],
    },
  });
});

test("drawerFooterActions keeps save disabled for read-only drawer detail", () => {
  assert.deepEqual(drawerFooterActions(), [
    { key: "edit", label: "Edit", tone: "ghost", disabled: false },
    { key: "delete", label: "Delete", tone: "danger", disabled: false },
    { key: "save", label: "Save", tone: "primary", disabled: true },
  ]);
});

test("buildDrawerActivitySections normalizes event usage and backend activity cards", () => {
  const sections = buildDrawerActivitySections({
    events: [{
      message: "backend recovered",
      severity: "warning",
      category: "backend",
      actor: "admin",
      type: "backend.recovered",
      created_at: "2026-06-19T08:00:00Z",
    }],
    usage: [{
      request_id: "req-1",
      model: "gpt-5.4",
      method: "POST",
      path: "/v1/chat/completions",
      status_code: 429,
      endpoint: "chat",
      duration_ms: 87,
      backend_name: "edge-a",
      client_name: "client-a",
      created_at: "2026-06-19T08:01:00Z",
    }],
    backends: [{
      name: "edge-a",
      protocol: "openai",
      base_url: "https://edge-a.example/v1",
      status: "normal",
      models: ["gpt-5.4", "gpt-image-2"],
      socks_proxy: { name: "proxy-a" },
    }],
  });

  assert.equal(sections.length, 3);

  assert.deepEqual(sections[0], {
    key: "events",
    title: "Events",
    count: 1,
    items: [{
      title: "backend recovered",
      summary: "backend.recovered",
      tone: "warning",
      chips: ["warning", "backend"],
      meta: [
        { label: "Actor", value: "admin" },
        { label: "Time", value: "2026-06-19T08:00:00Z", format: "datetime" },
      ],
    }],
  });

  assert.deepEqual(sections[1], {
    key: "usage",
    title: "Usage",
    count: 1,
    items: [{
      title: "req-1",
      summary: "gpt-5.4",
      tone: "warning",
      chips: ["429", "chat"],
      meta: [
        { label: "Route", value: "POST /v1/chat/completions" },
        { label: "Backend", value: "edge-a" },
        { label: "Client", value: "client-a" },
        { label: "Latency", value: "87 ms" },
        { label: "Time", value: "2026-06-19T08:01:00Z", format: "datetime" },
      ],
    }],
  });

  assert.deepEqual(sections[2], {
    key: "backends",
    title: "Backends",
    count: 1,
    items: [{
      title: "edge-a",
      summary: "https://edge-a.example/v1",
      tone: "success",
      chips: ["openai", "normal"],
      meta: [
        { label: "Proxy", value: "proxy-a" },
        { label: "Models", value: "2" },
      ],
    }],
  });
});

test("buildDrawerActivitySections skips empty buckets and tolerates invalid input", () => {
  assert.deepEqual(buildDrawerActivitySections(null), []);
  assert.deepEqual(buildDrawerActivitySections({ events: [], usage: [{}], backends: [] }), [{
    key: "usage",
    title: "Usage",
    count: 1,
    items: [{
      title: "Usage request",
      summary: "-",
      tone: "neutral",
      chips: [],
      meta: [],
    }],
  }]);
});
