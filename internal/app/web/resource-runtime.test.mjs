import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ResourceViewUtils = require("./resource-view.js");
const ResourceStateUtils = require("./resource-state.js");
const { requireResourceViewUtils } = require("./resource-runtime.js");
const { requireResourceStateUtils } = require("./resource-runtime.js");
const { requireResourceCrudUtils } = require("./resource-runtime.js");
const ResourceCrudUtils = require("./resource-crud.js");

test("requireResourceViewUtils returns the resource view api when all required functions exist", () => {
  const resourceView = requireResourceViewUtils(ResourceViewUtils);
  const html = resourceView.renderResourceTablePage({
    toolbar: "<div>toolbar</div>",
    isEmpty: false,
    emptyMarkup: "",
    headers: ["Name"],
    rowsMarkup: "<tr><td>edge-a</td></tr>",
    paginationMarkup: "<nav>pager</nav>",
  });

  assert.match(html, /toolbar/);
  assert.match(html, /<th>Name<\/th>/);
  assert.match(html, /pager/);
});

test("requireResourceViewUtils throws a clear error when resource-view utils are unavailable", () => {
  assert.throws(
    () => requireResourceViewUtils(null),
    /resource-view\.js.*load.*before app\.js/i,
  );
});

test("requireResourceStateUtils returns the resource state api when all required functions exist", () => {
  const resourceState = requireResourceStateUtils(ResourceStateUtils);
  assert.deepEqual(resourceState.defaultResourceView("policies"), {
    query: "",
    filter: "all",
    sort: "priority_asc",
  });
});

test("requireResourceStateUtils throws a clear error when resource-state utils are unavailable", () => {
  assert.throws(
    () => requireResourceStateUtils(null),
    /resource-state\.js.*load.*before app\.js/i,
  );
});

test("requireResourceStateUtils reports missing helper names for partial state modules", () => {
  assert.throws(
    () => requireResourceStateUtils({
      defaultResourceView() {
        return { query: "", filter: "all", sort: "updated_desc" };
      },
      toolbarStatusLabel() {
        return "Default view";
      },
    }),
    /missing ResourceStateUtils methods: applyResourceView, currentLocalPageData, currentRemotePageData, applyPagedResponse, paginationPageNumbers/i,
  );
});

test("requireResourceCrudUtils returns the resource crud api when all required functions exist", () => {
  const resourceCrud = requireResourceCrudUtils(ResourceCrudUtils);
  assert.deepEqual(resourceCrud.parseModelMapping("gpt-4=gpt-4.1"), { "gpt-4": "gpt-4.1" });
  assert.equal(typeof resourceCrud.createResourceCrud, "function");
});

test("requireResourceCrudUtils throws a clear error when resource-crud utils are unavailable", () => {
  assert.throws(
    () => requireResourceCrudUtils(null),
    /resource-crud\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when resource view utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: { requireResourceViewUtils },
    ResourceViewUtils: null,
    ResourceStateUtils,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-view\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when resource state utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: { requireResourceViewUtils, requireResourceStateUtils },
    ResourceViewUtils,
    ResourceStateUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-state\.js.*load.*before app\.js/i,
  );
});

test("app.js fails clearly during startup when resource crud utils are missing", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: { requireResourceViewUtils, requireResourceStateUtils, requireResourceCrudUtils },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils: null,
  });

  assert.throws(
    () => loadAppWithoutBootstrap(context),
    /resource-crud\.js.*load.*before app\.js/i,
  );
});

test("app.js integrates the validated resource view module for proxy list rendering", () => {
  const context = createAppVmContext({
    ResourceRuntimeUtils: { requireResourceViewUtils, requireResourceStateUtils, requireResourceCrudUtils },
    ResourceViewUtils,
    ResourceStateUtils,
    ResourceCrudUtils,
  });

  loadAppWithoutBootstrap(context);
  vm.runInContext(`
    state.proxies = [{
      id: 1,
      name: "tokyo-proxy",
      enabled: true,
      bound_backend_count: 2,
      traffic_bytes: 4096,
      avg_latency_ms: 82,
      last_used_at: "2026-06-19T00:00:00Z",
      updated_at: "2026-06-19T00:10:00Z"
    }];
    renderProxies();
  `, context);

  const html = context.__elements.get("#proxyList").innerHTML;
  assert.match(html, /data-toolbar-search="proxies"/);
  assert.match(html, /tokyo-proxy/);
  assert.match(html, /Default view/);
});

test("app.js initializes resource view defaults through ResourceStateUtils", () => {
  const calls = [];
  const instrumentedResourceStateUtils = {
    ...ResourceStateUtils,
    defaultResourceView(resourceKey) {
      calls.push(resourceKey);
      return ResourceStateUtils.defaultResourceView(resourceKey);
    },
  };
  const context = createAppVmContext({
    ResourceRuntimeUtils: { requireResourceViewUtils, requireResourceStateUtils, requireResourceCrudUtils },
    ResourceViewUtils,
    ResourceStateUtils: instrumentedResourceStateUtils,
    ResourceCrudUtils,
  });

  loadAppWithoutBootstrap(context);

  assert.deepEqual(calls, ["proxies", "backends", "clients", "policies"]);
});

test("index.html loads resource runtime dependencies before app.js", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const resourceViewIndex = html.indexOf("./resource-view.js");
  const resourceRuntimeIndex = html.indexOf("./resource-runtime.js");
  const resourceStateIndex = html.indexOf("./resource-state.js");
  const resourceCrudIndex = html.indexOf("./resource-crud.js");
  const appIndex = html.indexOf("./app.js");

  assert.ok(resourceViewIndex >= 0);
  assert.ok(resourceRuntimeIndex > resourceViewIndex);
  assert.ok(resourceStateIndex > resourceRuntimeIndex);
  assert.ok(resourceCrudIndex > resourceStateIndex);
  assert.ok(appIndex > resourceCrudIndex);
});

function loadAppWithoutBootstrap(context) {
  const source = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8")
    .replace(/\nactivatePage\(pageIDFromHash\(\)\);\nrefreshAll\(\)\.catch\(reportError\);\s*$/, "\n");
  vm.runInContext(source, context, { filename: "app.js" });
  return context;
}

function createAppVmContext({
  ResourceRuntimeUtils,
  ResourceViewUtils: resourceViewUtils,
  ResourceStateUtils: resourceStateUtils,
  ResourceCrudUtils: resourceCrudUtils,
}) {
  const elements = new Map();
  const HTMLElement = class HTMLElement {};

  function createStubElement(key) {
    const classState = new Set();
    const element = new HTMLElement();
    element.__key = key;
    element.dataset = {};
    element.style = {};
    element.value = "";
    element.checked = false;
    element.disabled = false;
    element.hidden = false;
    element.innerHTML = "";
    element.textContent = "";
    element.title = "";
    element.attributes = {};
    element.elements = new Proxy({}, {
      get(_target, property) {
        if (!elements.has(`form:${String(property)}`)) {
          elements.set(`form:${String(property)}`, createStubElement(`form:${String(property)}`));
        }
        return elements.get(`form:${String(property)}`);
      },
    });
    element.classList = {
      add(...tokens) {
        tokens.forEach((token) => classState.add(token));
      },
      remove(...tokens) {
        tokens.forEach((token) => classState.delete(token));
      },
      toggle(token, force) {
        if (force === true) {
          classState.add(token);
          return true;
        }
        if (force === false) {
          classState.delete(token);
          return false;
        }
        if (classState.has(token)) {
          classState.delete(token);
          return false;
        }
        classState.add(token);
        return true;
      },
      contains(token) {
        return classState.has(token);
      },
    };
    element.addEventListener = () => {};
    element.removeEventListener = () => {};
    element.setAttribute = (name, value) => {
      element.attributes[name] = value;
    };
    element.getAttribute = (name) => element.attributes[name];
    element.hasAttribute = (name) => Object.prototype.hasOwnProperty.call(element.attributes, name);
    element.focus = () => {};
    element.closest = () => null;
    element.matches = () => false;
    element.querySelector = (selector) => getElement(selector);
    element.querySelectorAll = () => [];
    return element;
  }

  function getElement(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, createStubElement(selector));
    }
    return elements.get(selector);
  }

  const document = {
    documentElement: getElement("documentElement"),
    activeElement: getElement("activeElement"),
    querySelector(selector) {
      return getElement(selector);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const localStorage = {
    getItem() {
      return "";
    },
    setItem() {},
    removeItem() {},
  };

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    HTMLElement,
    FormData: class FormData {
      constructor() {
        this.entries = function* entries() {};
      }
    },
    document,
    localStorage,
    alert() {},
    confirm() {
      return true;
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {};
      },
    }),
    window: {
      document,
      location: { hash: "" },
      matchMedia() {
        return {
          matches: false,
          addEventListener() {},
          removeEventListener() {},
        };
      },
      addEventListener() {},
      removeEventListener() {},
    },
    ResourceRuntimeUtils,
    ResourceViewUtils: resourceViewUtils,
    ResourceStateUtils: resourceStateUtils,
    ResourceCrudUtils: resourceCrudUtils,
    ThemeUtils: {},
    SearchUtils: {},
    DashboardUtils: {},
    DashboardViewUtils: {},
    ChartsUtils: {},
    DrawerUtils: {},
    ObservabilityUtils: {},
    ObservabilityViewUtils: {},
    RendererUtils: {},
    SettingsUtils: {},
  });

  context.globalThis = context;
  context.__elements = elements;
  return context;
}
