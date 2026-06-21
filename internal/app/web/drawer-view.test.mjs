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
              title: "policy updated",
              summary: "policy.changed",
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
        title: "policy updated",
        summary: "policy.changed",
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
    drawer: { kind: "policies", tab: "overview", loading: false, error: "boom", data: null },
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
        title: "policy updated",
        summary: "policy.changed",
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
    enabled: true,
    pool: "premium",
    protocol: "openai",
    weight: 3,
    proxy_id: 7,
  }, {
    escapeHTML: (value) => String(value),
  });

  assert.match(markup, /drawer-overview-hero/);
  assert.match(markup, /drawer-highlight-grid/);
  assert.match(markup, /edge-a/);
  assert.match(markup, /premium/);
  assert.match(markup, /openai/);
  assert.match(markup, /Enabled/);
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
