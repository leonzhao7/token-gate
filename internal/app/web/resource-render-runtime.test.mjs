import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ResourceRenderRuntimeUtils = require("./resource-render-runtime.js");

test("buildQuickDetailMarkup delegates quick detail section shaping to shared helpers", () => {
  const calls = [];
  const markup = ResourceRenderRuntimeUtils.buildQuickDetailMarkup({
    resourceKey: "backends",
    record: { id: 7, name: "edge-a" },
    rendererUtils: {
      createQuickDetailSections(resourceKey, record) {
        calls.push(["sections", resourceKey, record]);
        return [{ title: "Relationships", items: [{ label: "Status", value: "normal" }] }];
      },
    },
    resourceViewUtils: {
      createQuickDetailMarkup(input) {
        calls.push(["markup", input.sections, input.escapeHTML]);
        return "<details />";
      },
    },
    displayUtils: {
      escapeHTML(value) {
        return String(value);
      },
    },
  });

  assert.equal(markup, "<details />");
  assert.equal(calls[0][0], "sections");
  assert.equal(calls[0][1], "backends");
  assert.deepEqual(calls[0][2], { id: 7, name: "edge-a" });
  assert.equal(calls[1][0], "markup");
  assert.deepEqual(calls[1][1], [{ title: "Relationships", items: [{ label: "Status", value: "normal" }] }]);
  assert.equal(typeof calls[1][2], "function");
});

test("renderProxyRow derives expanded and editing state before delegating to resource view helpers", () => {
  const calls = [];
  const html = ResourceRenderRuntimeUtils.renderProxyRow({
    proxy: { id: 3, name: "proxy-a" },
    state: {
      expandedProxies: new Set(["3"]),
      editingProxyID: "3",
    },
    buildQuickDetailMarkup(resourceKey, record) {
      calls.push(["quick", resourceKey, record.id]);
      return "<quick />";
    },
    resourceViewUtils: {
      renderProxyRow(input) {
        calls.push(["render", input.expanded, input.editing, input.quickDetails, input.proxy.id]);
        return "<row />";
      },
    },
    displayUtils: {
      statusPill() {},
      formatBindingCount() {},
      formatDataSize() {},
      formatLatency() {},
      formatDateTime() {},
      tableActions() {},
      escapeHTML(value) {
        return String(value);
      },
    },
  });

  assert.equal(html, "<row />");
  assert.deepEqual(calls, [
    ["quick", "proxies", 3],
    ["render", true, true, "<quick />", 3],
  ]);
});

test("renderBackendRow and renderClientRow forward display helpers and quick details", () => {
  const calls = [];
  const buildQuickDetailMarkup = (resourceKey, record) => {
    calls.push(["quick", resourceKey, record.id]);
    return `<quick:${resourceKey}:${record.id}>`;
  };
  const displayUtils = {
    statusPill() {},
    formatBackendRouting() {},
    formatBackendCoverage() {},
    backendProtocolLabel() {},
    formatUsageCount() {},
    formatLatency() {},
    formatDateTime() {},
    formatBackendRecentStats() {},
    clientTokenDisplay(client) {
      return `token:${client.id}`;
    },
    tableActions() {},
    escapeHTML(value) {
      return String(value);
    },
  };
  const state = {
    expandedBackends: new Set(["11"]),
    expandedClients: new Set(["12"]),
    editingBackendID: "11",
    editingClientID: "12",
  };
  const resourceViewUtils = {
    renderBackendRow(input) {
      calls.push(["backend", input.expanded, input.editing, input.quickDetails, input.backend.id]);
      return "<backend />";
    },
    renderClientRow(input) {
      calls.push(["client", input.expanded, input.editing, input.quickDetails, input.clientTokenText, input.client.id]);
      return "<client />";
    },
  };

  assert.equal(ResourceRenderRuntimeUtils.renderBackendRow({
    backend: { id: 11 },
    state,
    buildQuickDetailMarkup,
    resourceViewUtils,
    displayUtils,
  }), "<backend />");
  assert.equal(ResourceRenderRuntimeUtils.renderClientRow({
    client: { id: 12 },
    state,
    buildQuickDetailMarkup,
    resourceViewUtils,
    displayUtils,
  }), "<client />");
  assert.deepEqual(calls, [
    ["quick", "backends", 11],
    ["backend", true, true, "<quick:backends:11>", 11],
    ["quick", "clients", 12],
    ["client", true, true, "<quick:clients:12>", "token:12", 12],
  ]);
});

test("renderResourceListByKey dispatches to the matching resource renderer", () => {
  const calls = [];

  ResourceRenderRuntimeUtils.renderResourceListByKey({
    resourceKey: "proxies",
    renderProxies() {
      calls.push("proxies");
    },
    renderBackends() {
      calls.push("backends");
    },
    renderClients() {
      calls.push("clients");
    },
  });
  ResourceRenderRuntimeUtils.renderResourceListByKey({
    resourceKey: "backends",
    renderProxies() {
      calls.push("proxies");
    },
    renderBackends() {
      calls.push("backends");
    },
    renderClients() {
      calls.push("clients");
    },
  });
  ResourceRenderRuntimeUtils.renderResourceListByKey({
    resourceKey: "clients",
    renderProxies() {
      calls.push("proxies");
    },
    renderBackends() {
      calls.push("backends");
    },
    renderClients() {
      calls.push("clients");
    },
  });
  ResourceRenderRuntimeUtils.renderResourceListByKey({
    resourceKey: "unknown",
    renderProxies() {
      calls.push("proxies");
    },
    renderBackends() {
      calls.push("backends");
    },
    renderClients() {
      calls.push("clients");
    },
  });

  assert.deepEqual(calls, ["proxies", "backends", "clients"]);
});
