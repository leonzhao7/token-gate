import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ResourceDataRuntimeUtils = require("./resource-data-runtime.js");

test("renderProxyOptions renders direct connection plus proxy choices and preserves valid selection", () => {
  const proxyInput = { value: "7", innerHTML: "" };

  ResourceDataRuntimeUtils.renderProxyOptions({
    backendForm: {
      elements: {
        proxy_id: proxyInput,
      },
    },
    state: {
      proxies: [
        { id: 7, name: "tokyo", address: "10.0.0.7:1080", enabled: true },
        { id: 8, name: "sydney", address: "10.0.0.8:1080", enabled: false },
      ],
    },
    displayUtils: {
      escapeHTML(value) {
        return String(value);
      },
    },
  });

  assert.match(proxyInput.innerHTML, /Direct connection/);
  assert.match(proxyInput.innerHTML, /tokyo \(10\.0\.0\.7:1080\)/);
  assert.match(proxyInput.innerHTML, /sydney \(10\.0\.0\.8:1080\) - disabled/);
  assert.equal(proxyInput.value, "7");
});

test("renderProxyOptions resets invalid selection to direct connection", () => {
  const proxyInput = { value: "999", innerHTML: "" };

  ResourceDataRuntimeUtils.renderProxyOptions({
    backendForm: {
      elements: {
        proxy_id: proxyInput,
      },
    },
    state: {
      proxies: [{ id: 7, name: "tokyo", address: "10.0.0.7:1080", enabled: true }],
    },
    displayUtils: {
      escapeHTML(value) {
        return String(value);
      },
    },
  });

  assert.equal(proxyInput.value, "0");
});

test("fetchAllCollectionPages requests remaining pages when the first page indicates more results", async () => {
  const calls = [];
  const pages = {
    "/admin/api/backends?page=1&limit=50": {
      items: [{ id: 1 }, { id: 2 }],
      total: 21,
      limit: 10,
    },
    "/admin/api/backends?page=2&limit=10": {
      items: [{ id: 3 }, { id: 4 }],
    },
    "/admin/api/backends?page=3&limit=10": {
      items: [{ id: 5 }],
    },
  };

  const result = await ResourceDataRuntimeUtils.fetchAllCollectionPages({
    basePath: "/admin/api/backends",
    api(path) {
      calls.push(path);
      return Promise.resolve(pages[path]);
    },
    displayUtils: {
      ensureArray(value) {
        return Array.isArray(value) ? value : [];
      },
    },
    pageSizeOptions: [10, 20, 50],
  });

  assert.deepEqual(result, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
  assert.deepEqual(calls, [
    "/admin/api/backends?page=1&limit=50",
    "/admin/api/backends?page=2&limit=10",
    "/admin/api/backends?page=3&limit=10",
  ]);
});

test("refreshResourceList updates matching resource collection and calls the paired render function", async () => {
  const state = {
    proxies: [],
    backends: [],
    clients: [],
    policies: [],
  };
  const renderCalls = [];

  await ResourceDataRuntimeUtils.refreshResourceList({
    resourceKey: "clients",
    state,
    fetchAllCollectionPages(basePath) {
      assert.equal(basePath, "/admin/api/client-keys");
      return Promise.resolve([{ id: 9, name: "sdk-a" }]);
    },
    renderProxies() {
      renderCalls.push("proxies");
    },
    renderBackends() {
      renderCalls.push("backends");
    },
    renderClients() {
      renderCalls.push("clients");
    },
    renderPolicies() {
      renderCalls.push("policies");
    },
  });

  assert.deepEqual(state.clients, [{ id: 9, name: "sdk-a" }]);
  assert.deepEqual(renderCalls, ["clients"]);
});
