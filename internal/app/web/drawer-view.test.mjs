import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DrawerViewUtils = require("./drawer-view.js");

test("drawerDisplayTitle maps supported kinds and falls back to Resource", () => {
  const resolveTitle = (kind) => ({
    backends: "Backend",
    clients: "Client Key",
    events: "Event",
    usage_logs: "Usage Log",
  }[kind] || "Resource");
  assert.equal(DrawerViewUtils.drawerDisplayTitle("backends", { resolveTitle }), "Backend");
  assert.equal(DrawerViewUtils.drawerDisplayTitle("clients", { resolveTitle }), "Client Key");
  assert.equal(DrawerViewUtils.drawerDisplayTitle("events", { resolveTitle }), "Event");
  assert.equal(DrawerViewUtils.drawerDisplayTitle("usage_logs", { resolveTitle }), "Usage Log");
  assert.equal(DrawerViewUtils.drawerDisplayTitle("unknown", { resolveTitle }), "Resource");
});

test("formatDrawerValue and humanizeKey normalize common drawer values", () => {
  assert.equal(DrawerViewUtils.formatDrawerValue(["gpt-5", "gpt-4.1"]), "gpt-5, gpt-4.1");
  assert.equal(DrawerViewUtils.formatDrawerValue({ enabled: true }), JSON.stringify({ enabled: true }));
  assert.equal(DrawerViewUtils.formatDrawerValue(""), "-");
  assert.equal(DrawerViewUtils.humanizeKey("request_id"), "Request Id");
});

test("formatDrawerActivityMetaValue formats datetime entries through formatter", () => {
  assert.equal(
    DrawerViewUtils.formatDrawerActivityMetaValue(
      { label: "Time", value: "2026-06-19T08:00:00Z", format: "datetime" },
      { formatDateTime: (value) => `fmt:${value}` },
    ),
    "fmt:2026-06-19T08:00:00Z",
  );
  assert.equal(DrawerViewUtils.formatDrawerActivityMetaValue({ label: "Actor", value: "admin" }), "admin");
  assert.equal(DrawerViewUtils.formatDrawerActivityMetaValue(null), "-");
});

test("renderDrawerShell composes tabs, body, and footer markup", () => {
  const html = DrawerViewUtils.renderDrawerShell({
    drawer: {
      open: true,
      kind: "backends",
      title: "Edge A",
      tab: "overview",
      loading: false,
      error: "",
      data: {
        overview: { name: "edge-a", enabled: true },
        configuration: {},
        metadata: {},
        raw: { id: 7 },
        request: {},
        response: {},
        activity: {
          sections: [{
            title: "Events",
            count: 1,
            items: [{
              title: "backend recovered",
              summary: "backend.recovered",
              tone: "warning",
              chips: ["warning"],
              meta: [{ label: "Actor", value: "admin" }],
            }],
          }],
        },
      },
    },
    tabs: [
      { key: "overview", label: "Overview" },
      { key: "raw", label: "Raw JSON" },
    ],
    footerActions: [
      { key: "edit", label: "Edit", tone: "ghost", disabled: false },
      { key: "delete", label: "Delete", tone: "danger", disabled: false },
    ],
    activitySections: [{
      title: "Events",
      count: 1,
    items: [{
        title: "backend recovered",
        summary: "backend.recovered",
        tone: "warning",
        chips: ["warning"],
        meta: [{ label: "Actor", value: "admin" }],
      }],
    }],
    escapeHTML: (value) => String(value),
    formatDateTime: (value) => `fmt:${value}`,
    resolveTitle: (kind) => ({ backends: "Backend" }[kind] || "Resource"),
  });

  assert.match(html.title, /Edge A Detail/);
  assert.match(html.tabs, /data-drawer-tab="overview"/);
  assert.match(html.body, /edge-a/);
  assert.match(html.footer, /data-drawer-footer="edit"/);
});

test("renderDrawerBody returns loading and error states for shell rendering", () => {
  const loadingMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: { kind: "events", tab: "overview", loading: true, error: "", data: null },
    activitySections: [],
    escapeHTML: (value) => String(value),
    resolveTitle: (kind) => ({ events: "Event" }[kind] || "Resource"),
  });
  assert.match(loadingMarkup, /Fetching Event detail/);

  const errorMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: { kind: "backends", tab: "overview", loading: false, error: "boom", data: null },
    activitySections: [],
    escapeHTML: (value) => String(value),
  });
  assert.match(errorMarkup, /Drawer unavailable/);
  assert.match(errorMarkup, /boom/);
});

test("renderDrawerBody renders activity sections and usage log footer stays read-only", () => {
  const activityMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: {
      kind: "usage_logs",
      tab: "activity",
      loading: false,
      error: "",
      data: { activity: {} },
    },
    activitySections: [{
      title: "Events",
      count: 1,
      items: [{
        title: "backend recovered",
        summary: "backend.recovered",
        tone: "warning",
        chips: ["warning"],
        meta: [{ label: "Time", value: "2026-06-19T08:00:00Z", format: "datetime" }],
      }],
    }],
    escapeHTML: (value) => String(value),
    formatDateTime: (value) => `fmt:${value}`,
  });

  assert.match(activityMarkup, /drawer-activity-section/);
  assert.match(activityMarkup, /fmt:2026-06-19T08:00:00Z/);

  const footerMarkup = DrawerViewUtils.renderDrawerFooter({
    isOpen: true,
    kind: "usage_logs",
    footerActions: [
      { key: "edit", label: "Edit", tone: "ghost", disabled: false },
      { key: "delete", label: "Delete", tone: "danger", disabled: false },
    ],
    escapeHTML: (value) => String(value),
  });

  assert.doesNotMatch(footerMarkup, /data-drawer-footer="edit"/);
  assert.match(footerMarkup, /data-drawer-footer="save"/);
});

test("renderDrawerTabPanel upgrades overview payload into a summary hero with highlight cards", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("overview", {
    name: "edge-a",
    status: "normal",
    protocol: "openai",
    weight: 3,
    proxy_id: 7,
  }, {
    escapeHTML: (value) => String(value),
  });

  assert.match(markup, /drawer-overview-hero/);
  assert.match(markup, /drawer-highlight-grid/);
  assert.match(markup, /edge-a/);
  assert.match(markup, /openai/);
  assert.match(markup, /normal/);
});

test("renderDrawerTabPanel upgrades configuration payload into grouped config cards", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("configuration", {
    models: ["gpt-5.4", "gpt-image-2"],
    endpoints: ["chat", "images"],
    model_mapping: { "gpt-5.4": "gpt-5.4-test" },
    base_url: "https://edge-a.example/v1",
  }, {
    escapeHTML: (value) => String(value),
  });

  assert.match(markup, /drawer-section-stack/);
  assert.match(markup, /drawer-detail-section/);
  assert.match(markup, /drawer-list-grid/);
  assert.match(markup, /gpt-image-2/);
  assert.match(markup, /gpt-5\.4-test/);
  assert.match(markup, /https:\/\/edge-a\.example\/v1/);
});

test("renderDrawerTabPanel upgrades metadata payload into audit-friendly layout with formatted times", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("metadata", {
    id: 7,
    created_at: "2026-06-19T08:00:00Z",
    updated_at: "2026-06-19T08:05:00Z",
    resource_id: 11,
  }, {
    escapeHTML: (value) => String(value),
    formatDateTime: (value) => `fmt:${value}`,
  });

  assert.match(markup, /drawer-audit-grid/);
  assert.match(markup, /fmt:2026-06-19T08:00:00Z/);
  assert.match(markup, /fmt:2026-06-19T08:05:00Z/);
  assert.match(markup, /drawer-audit-item/);
});

test("renderDrawerTabPanel renders request tab as observability detail view", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("request", {
    method: "POST",
    path: "/v1/chat/completions",
    query: "stream=true&model=gpt-5",
    bytes: 2048,
    headers_json: "{\"content-type\":\"application/json\"}",
    body_preview: "{\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}",
  }, {
    escapeHTML: (value) => String(value),
  });

  assert.match(markup, /drawer-http-panel/);
  assert.match(markup, /POST \/v1\/chat\/completions\?stream=true&model=gpt-5/);
  assert.match(markup, /Request Bytes/);
  assert.match(markup, /2048/);
  assert.match(markup, /Headers/);
  assert.match(markup, /content-type/);
  assert.match(markup, /Payload Preview/);
  assert.match(markup, /"messages"/);
});

test("renderDrawerTabPanel renders response tab with readable streaming state and empty fallbacks", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("response", {
    status_family: "2xx",
    is_stream: true,
    bytes: null,
    headers_json: "",
    body_preview: "",
  }, {
    escapeHTML: (value) => String(value),
  });

  assert.match(markup, /drawer-http-panel/);
  assert.match(markup, /Status Family/);
  assert.match(markup, /2xx/);
  assert.match(markup, /Streaming/);
  assert.match(markup, /Streamed/);
  assert.doesNotMatch(markup, /\btrue\b/);
  assert.match(markup, /Response Bytes/);
  assert.match(markup, /<strong>-<\/strong>/);
  assert.match(markup, /Headers/);
  assert.match(markup, /Response Preview/);
});

test("renderDrawerBody renders usage log request and response tabs from the real detail payload shape", () => {
  const drawer = {
    kind: "usage_logs",
    loading: false,
    error: "",
    data: {
      overview: {
        request_id: "req-42",
        status_code: 200,
        backend: "edge-a",
        model: "gpt-5.4",
      },
      request: {
        bytes: 512,
        body_preview: "{\"model\":\"gpt-5.4\"}",
        headers_json: "{\"content-type\":\"application/json\"}",
        method: "POST",
        path: "/v1/responses",
        query: "stream=true",
      },
      response: {
        bytes: 1024,
        body_preview: "{\"id\":\"resp_42\"}",
        headers_json: "{\"content-type\":\"text/event-stream\"}",
        status_family: "2xx",
        is_stream: true,
      },
      metadata: {
        id: 42,
        trace_id: "trace-42",
      },
      raw: { id: 42 },
      activity: {},
    },
  };

  const requestMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: { ...drawer, tab: "request" },
    activitySections: [],
    escapeHTML: (value) => String(value),
  });
  assert.match(requestMarkup, /POST \/v1\/responses\?stream=true/);
  assert.match(requestMarkup, /512/);
  assert.match(requestMarkup, /application\/json/);
  assert.match(requestMarkup, /"model":"gpt-5\.4"/);

  const responseMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: { ...drawer, tab: "response" },
    activitySections: [],
    escapeHTML: (value) => String(value),
  });
  assert.match(responseMarkup, /2xx/);
  assert.match(responseMarkup, /Streamed/);
  assert.match(responseMarkup, /1024/);
  assert.match(responseMarkup, /text\/event-stream/);
  assert.match(responseMarkup, /"id":"resp_42"/);
});

test("renderDrawerTabPanel renders event overview as audit-focused hero with summary context", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("overview", {
    type: "backend.abnormal",
    message: "Backend marked abnormal after consecutive failures",
    category: "backend",
    severity: "warning",
    actor: "admin@example.com",
    endpoint: "/admin/backends/7",
    backend: "edge-a",
    client_name: "premium-web",
    model: "gpt-5.4",
  }, {
    escapeHTML: (value) => String(value),
    kind: "events",
  });

  assert.match(markup, /drawer-overview-hero/);
  assert.match(markup, /Backend marked abnormal after consecutive failures/);
  assert.match(markup, /backend\.abnormal/);
  assert.match(markup, /drawer-highlight-grid/);
  assert.match(markup, /Category/);
  assert.match(markup, /Severity/);
  assert.match(markup, /Actor/);
  assert.match(markup, /Endpoint/);
  assert.match(markup, /Backend/);
  assert.match(markup, /Client/);
  assert.match(markup, /Model/);
  assert.doesNotMatch(markup, /Inspect live routing, access, and audit context for this resource\./);
});

test("renderDrawerTabPanel keeps non-event overview payloads on the generic drawer layout", () => {
  const markup = DrawerViewUtils.renderDrawerTabPanel("overview", {
    message: "Upstream request failed",
    type: "backend.error",
    actor: "system",
  }, {
    escapeHTML: (value) => String(value),
  });

  assert.doesNotMatch(markup, /Audit Event/);
  assert.match(markup, /Upstream request failed/);
  assert.match(markup, /<small>Message<\/small>/);
  assert.match(markup, /backend\.error/);
  assert.doesNotMatch(markup, /Category/);
});

test("renderDrawerBody renders event-specific empty states for configuration and activity tabs", () => {
  const configurationMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: {
      kind: "events",
      tab: "configuration",
      loading: false,
      error: "",
      data: {
        overview: {},
        configuration: {},
        metadata: {},
        raw: {},
        activity: {},
      },
    },
    activitySections: [],
    escapeHTML: (value) => String(value),
  });

  assert.doesNotMatch(configurationMarkup, /No configuration/);
  assert.match(configurationMarkup, /Event context/);
  assert.match(configurationMarkup, /This audit event does not include additional configuration state\./);

  const activityMarkup = DrawerViewUtils.renderDrawerBody({
    drawer: {
      kind: "events",
      tab: "activity",
      loading: false,
      error: "",
      data: {
        overview: {},
        configuration: {},
        metadata: {},
        raw: {},
        activity: {},
      },
    },
    activitySections: [],
    escapeHTML: (value) => String(value),
  });

  assert.doesNotMatch(activityMarkup, /No activity/);
  assert.match(activityMarkup, /Related audit trail/);
  assert.match(activityMarkup, /This event is already the primary audit record, so there is no separate activity timeline\./);
});
