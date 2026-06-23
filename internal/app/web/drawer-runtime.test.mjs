import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DrawerRuntimeUtils = require("./drawer-runtime.js");

function createStubElement() {
  const listeners = new Map();
  const classNames = new Set();
  return {
    innerHTML: "",
    textContent: "",
    attributes: {},
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    focusCalled: false,
    focus() {
      this.focusCalled = true;
    },
    classList: {
      toggle(token, force) {
        if (force === true) {
          classNames.add(token);
          return true;
        }
        if (force === false) {
          classNames.delete(token);
          return false;
        }
        if (classNames.has(token)) {
          classNames.delete(token);
          return false;
        }
        classNames.add(token);
        return true;
      },
      contains(token) {
        return classNames.has(token);
      },
    },
    click(type = "click") {
      listeners.get(type)?.();
    },
  };
}

test("renderDrawerShell syncs drawer shell markup and binds tab/footer actions", async () => {
  const state = {
    ui: {
      drawer: {
        open: true,
        kind: "backends",
        tab: "overview",
        data: { activity: {} },
      },
    },
  };
  const tabButton = createStubElement();
  tabButton.dataset = { drawerTab: "metadata" };
  const editButton = createStubElement();
  const deleteButton = createStubElement();
  const drawerTabRoot = createStubElement();
  drawerTabRoot.querySelectorAll = () => [tabButton];
  const drawerFooterRoot = createStubElement();
  drawerFooterRoot.querySelector = (selector) => {
    if (selector === '[data-drawer-footer="edit"]') {
      return editButton;
    }
    if (selector === '[data-drawer-footer="delete"]') {
      return deleteButton;
    }
    return null;
  };
  const renderCalls = [];
  const deleteCalls = [];

  DrawerRuntimeUtils.renderDrawerShell({
    state,
    drawerRoot: createStubElement(),
    drawerTitle: createStubElement(),
    drawerTabRoot,
    drawerBodyRoot: createStubElement(),
    drawerFooterRoot,
    drawerUtils: {
      drawerTabsForResource() {
        return [{ key: "overview", label: "Overview" }, { key: "metadata", label: "Metadata" }];
      },
      drawerFooterActions() {
        return [{ key: "edit", label: "Edit", tone: "ghost", disabled: false }, { key: "delete", label: "Delete", tone: "danger", disabled: false }];
      },
      buildDrawerActivitySections() {
        return [{ key: "events", title: "Events", count: 1, items: [] }];
      },
      drawerDisplayTitle() {
        return "Backend";
      },
    },
    drawerViewUtils: {
      renderDrawerShell(input) {
        renderCalls.push(input);
        return {
          isOpen: true,
          ariaHidden: "false",
          title: "Edge Detail",
          tabs: "<button data-drawer-tab=\"metadata\">Metadata</button>",
          body: "<div>body</div>",
          footer: "<button data-drawer-footer=\"edit\">Edit</button><button data-drawer-footer=\"delete\">Delete</button>",
        };
      },
    },
    escapeHTML(value) {
      return String(value);
    },
    formatDateTime(value) {
      return `dt:${value}`;
    },
    openDrawerEditor() {
      renderCalls.push("edit");
    },
    deleteDrawerResource() {
      deleteCalls.push("delete");
      return Promise.resolve();
    },
    reportError(error) {
      deleteCalls.push(error?.message || "error");
    },
    rerender() {
      renderCalls.push("rerender");
    },
  });

  tabButton.click();
  editButton.click();
  deleteButton.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(state.ui.drawer.tab, "metadata");
  assert.equal(renderCalls[0].tabs.length, 2);
  assert.equal(renderCalls[0].activitySections.length, 0);
  assert.ok(renderCalls.includes("rerender"));
  assert.ok(renderCalls.includes("edit"));
  assert.deepEqual(deleteCalls, ["delete"]);
});

test("closeDrawerShell resets drawer state, rerenders, and restores trigger focus", () => {
  class HTMLElement {}
  const trigger = new HTMLElement();
  trigger.focusCalled = false;
  trigger.focus = () => {
    trigger.focusCalled = true;
  };
  const state = {
    ui: {
      drawer: {
        open: true,
        kind: "backends",
        id: "7",
        title: "Edge A",
        tab: "raw",
        loading: true,
        data: { raw: { id: 7 } },
        error: "boom",
        detailPath: "/detail",
        deletePath: "/delete",
        page: "backends",
        triggerElement: trigger,
      },
    },
  };
  const renders = [];

  DrawerRuntimeUtils.closeDrawerShell({
    state,
    renderDrawerShell() {
      renders.push({
        open: state.ui.drawer.open,
        tab: state.ui.drawer.tab,
        triggerElement: state.ui.drawer.triggerElement,
      });
    },
    HTMLElementClass: HTMLElement,
  });

  assert.deepEqual(state.ui.drawer, {
    open: false,
    kind: "",
    id: null,
    title: "",
    tab: "overview",
    loading: false,
    data: null,
    error: "",
    detailPath: "",
    deletePath: "",
    page: "",
    triggerElement: null,
  });
  assert.deepEqual(renders, [{
    open: false,
    tab: "overview",
    triggerElement: null,
  }]);
  assert.equal(trigger.focusCalled, true);
});

test("openResourceDrawer loads detail payload, normalizes data, and focuses the drawer panel", async () => {
  class HTMLElement {}
  const trigger = new HTMLElement();
  const activeElement = new HTMLElement();
  const state = {
    ui: {
      drawer: {
        open: false,
        kind: "",
        id: null,
        title: "",
        tab: "overview",
        loading: false,
        data: null,
        error: "",
        detailPath: "",
        deletePath: "",
        page: "",
        triggerElement: null,
      },
    },
  };
  const drawerPanel = createStubElement();
  const renders = [];

  await DrawerRuntimeUtils.openResourceDrawer({
    target: { kind: "backend", id: "7", triggerElement: trigger },
    state,
    drawerUtils: {
      buildDrawerTarget(input) {
        assert.equal(input.id, "7");
        return {
          kind: "backends",
          id: "7",
          title: "Backend",
          page: "backends",
          detailPath: "/admin/api/backends/7/detail",
          deletePath: "/admin/api/backends/7",
        };
      },
      normalizeDrawerPayload(payload) {
        return { overview: payload };
      },
    },
    api(path) {
      assert.equal(path, "/admin/api/backends/7/detail");
      return Promise.resolve({ name: "edge-a" });
    },
    renderDrawerShell() {
      renders.push({
        loading: state.ui.drawer.loading,
        error: state.ui.drawer.error,
        data: state.ui.drawer.data,
        kind: state.ui.drawer.kind,
      });
    },
    drawerPanel,
    documentObject: { activeElement },
    HTMLElementClass: HTMLElement,
  });

  assert.equal(drawerPanel.focusCalled, true);
  assert.deepEqual(renders, [
    {
      loading: true,
      error: "",
      data: null,
      kind: "backends",
    },
    {
      loading: false,
      error: "",
      data: { overview: { name: "edge-a" } },
      kind: "backends",
    },
  ]);
  assert.equal(state.ui.drawer.triggerElement, trigger);
  assert.equal(state.ui.drawer.detailPath, "/admin/api/backends/7/detail");
});

test("openResourceDrawer records load errors and falls back to the active element when trigger is absent", async () => {
  class HTMLElement {}
  const activeElement = new HTMLElement();
  const state = {
    ui: {
      drawer: {
        open: false,
        kind: "",
        id: null,
        title: "",
        tab: "overview",
        loading: false,
        data: null,
        error: "",
        detailPath: "",
        deletePath: "",
        page: "",
        triggerElement: null,
      },
    },
  };

  await DrawerRuntimeUtils.openResourceDrawer({
    target: { kind: "backend", id: "7" },
    state,
    drawerUtils: {
      buildDrawerTarget() {
        return {
          kind: "backends",
          id: "7",
          title: "Backend",
          page: "backends",
          detailPath: "/admin/api/backends/7/detail",
          deletePath: "/admin/api/backends/7",
        };
      },
    },
    api() {
      return Promise.reject(new Error("boom"));
    },
    renderDrawerShell() {},
    drawerPanel: createStubElement(),
    documentObject: { activeElement },
    HTMLElementClass: HTMLElement,
  });

  assert.equal(state.ui.drawer.loading, false);
  assert.equal(state.ui.drawer.error, "boom");
  assert.equal(state.ui.drawer.data, null);
  assert.equal(state.ui.drawer.triggerElement, activeElement);
});

test("openDrawerEditor closes the drawer and routes to the matching editor", () => {
  const calls = [];
  const state = {
    ui: {
      drawer: {
        kind: "backends",
        id: "12",
      },
    },
  };

  DrawerRuntimeUtils.openDrawerEditor({
    state,
    closeDrawerShell() {
      calls.push("close");
    },
    startEditBackend(id) {
      calls.push(["backend", id]);
    },
    startEditClient(id) {
      calls.push(["client", id]);
    },
    startEditProxy(id) {
      calls.push(["proxy", id]);
    },
  });

  assert.deepEqual(calls, [
    "close",
    ["backend", "12"],
  ]);
});

test("deleteDrawerResource confirms destructive actions, deletes the record, and refreshes data", async () => {
  const calls = [];
  const state = {
    ui: {
      drawer: {
        kind: "backends",
        deletePath: "/admin/api/backends/7",
      },
    },
  };

  await DrawerRuntimeUtils.deleteDrawerResource({
    state,
    drawerUtils: {
      drawerDisplayTitle() {
        return "Backend";
      },
    },
    drawerViewUtils: {
      drawerDisplayTitle() {
        return "Resource";
      },
    },
    confirm(message) {
      calls.push(["confirm", message]);
      return true;
    },
    api(path, method) {
      calls.push(["api", path, method]);
      return Promise.resolve();
    },
    closeDrawerShell() {
      calls.push(["close"]);
    },
    refreshAll() {
      calls.push(["refresh"]);
      return Promise.resolve();
    },
  });

  assert.deepEqual(calls, [
    ["confirm", "确认删除 Backend？"],
    ["api", "/admin/api/backends/7", "DELETE"],
    ["close"],
    ["refresh"],
  ]);
});

test("deleteDrawerResource returns early when the user cancels or the drawer is read-only", async () => {
  const calls = [];

  await DrawerRuntimeUtils.deleteDrawerResource({
    state: {
      ui: {
        drawer: {
          kind: "events",
          deletePath: "",
        },
      },
    },
    drawerUtils: {},
    drawerViewUtils: {},
    confirm() {
      calls.push("confirm");
      return false;
    },
    api() {
      calls.push("api");
      return Promise.resolve();
    },
    closeDrawerShell() {
      calls.push("close");
    },
    refreshAll() {
      calls.push("refresh");
      return Promise.resolve();
    },
  });

  await DrawerRuntimeUtils.deleteDrawerResource({
    state: {
      ui: {
        drawer: {
          kind: "backends",
          deletePath: "/admin/api/backends/7",
        },
      },
    },
    drawerUtils: {
      drawerDisplayTitle() {
        return "Backend";
      },
    },
    drawerViewUtils: {},
    confirm() {
      calls.push("confirm-cancel");
      return false;
    },
    api() {
      calls.push("api-cancel");
      return Promise.resolve();
    },
    closeDrawerShell() {
      calls.push("close-cancel");
    },
    refreshAll() {
      calls.push("refresh-cancel");
      return Promise.resolve();
    },
  });

  assert.deepEqual(calls, ["confirm-cancel"]);
});
