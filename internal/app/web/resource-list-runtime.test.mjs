import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ResourceListRuntimeUtils = require("./resource-list-runtime.js");
const ResourceViewUtils = require("./resource-view.js");
const ResourceStateUtils = require("./resource-state.js");
const PaginationUtils = require("./pagination.js");
const DisplayUtils = require("./display-utils.js");

test("buildResourceToolbarMarkup delegates toolbar model and render composition to shared helpers", () => {
  const viewState = {
    query: "edge",
    filter: "enabled",
    sort: "weight_desc",
  };
  const defaultView = {
    query: "",
    filter: "all",
    sort: "updated_desc",
  };
  const rendererCalls = [];
  const renderCalls = [];
  const escapeHTML = (value) => value;
  const toolbarStatusLabel = () => "2 filters";

  const markup = ResourceListRuntimeUtils.buildResourceToolbarMarkup({
    resourceKey: "backends",
    searchPlaceholder: "Search backends",
    count: 7,
    state: {
      resourceViews: {
        backends: viewState,
      },
    },
    resourceViewConfig: {
      backends: {
        filterOptions: [{ value: "enabled", label: "Enabled" }],
        sortOptions: [{ value: "weight_desc", label: "Weight" }],
      },
    },
    rendererUtils: {
      createResourceToolbarModel(input) {
        rendererCalls.push(input);
        return { source: "renderer-model" };
      },
    },
    resourceViewUtils: {
      renderResourceToolbar(input) {
        renderCalls.push(input);
        return "<toolbar />";
      },
    },
    resourceStateUtils: {
      defaultResourceView() {
        return defaultView;
      },
      toolbarStatusLabel,
    },
    displayUtils: { escapeHTML },
  });

  assert.equal(markup, "<toolbar />");
  assert.equal(rendererCalls.length, 1);
  assert.equal(rendererCalls[0].resourceKey, "backends");
  assert.equal(rendererCalls[0].searchPlaceholder, "Search backends");
  assert.equal(rendererCalls[0].count, 7);
  assert.equal(rendererCalls[0].activeFilters, 3);
  assert.equal(rendererCalls[0].hasChanges, true);
  assert.equal(renderCalls.length, 1);
  assert.equal(renderCalls[0].resourceKey, "backends");
  assert.equal(renderCalls[0].viewState, viewState);
  assert.deepEqual(renderCalls[0].model, { source: "renderer-model" });
  assert.deepEqual(renderCalls[0].config, {
    filterOptions: [{ value: "enabled", label: "Enabled" }],
    sortOptions: [{ value: "weight_desc", label: "Weight" }],
  });
  assert.equal(renderCalls[0].activeFilters, 3);
  assert.equal(renderCalls[0].hasChanges, true);
  assert.equal(renderCalls[0].escapeHTML, escapeHTML);
  assert.equal(renderCalls[0].toolbarStatusLabel, toolbarStatusLabel);
});

test("renderLocalResourceTable delegates filtering, pagination, toolbar, and shell rendering to shared helpers", () => {
  const items = [{ id: 1, name: "alpha" }, { id: 2, name: "beta" }];
  const filtered = [{ id: 1, name: "alpha" }];
  const pageData = {
    items: [{ id: 1, name: "alpha" }],
    page: 1,
    size: 10,
    total: 1,
    totalPages: 1,
  };
  const state = {
    resourceViews: {
      backends: {
        query: "alpha",
        filter: "enabled",
        sort: "updated_desc",
      },
    },
    pagination: {
      backends: { page: 1, size: 10 },
    },
  };
  const container = createContainer();
  const calls = {
    applyResourceView: [],
    currentLocalPageData: [],
    createResourceToolbarModel: [],
    renderResourceToolbar: [],
    emptyState: [],
    rowRenderer: [],
    renderResourceTablePage: [],
  };

  const result = ResourceListRuntimeUtils.renderLocalResourceTable({
    resourceKey: "backends",
    items,
    state,
    container,
    searchPlaceholder: "Search backends",
    emptyTitle: "还没有 Backend",
    emptyDescription: "先配置至少一个 Backend。",
    headers: ["Backend", "Actions"],
    rowRenderer(row) {
      calls.rowRenderer.push(row);
      return `<tr>${row.name}</tr>`;
    },
    resourceViewConfig: {
      backends: {
        filterOptions: [{ value: "enabled", label: "Enabled" }],
        sortOptions: [{ value: "updated_desc", label: "Updated" }],
      },
    },
    rendererUtils: {
      createResourceToolbarModel(input) {
        calls.createResourceToolbarModel.push(input);
        return { source: "toolbar-model" };
      },
    },
    resourceViewUtils: {
      renderResourceToolbar(input) {
        calls.renderResourceToolbar.push(input);
        return "<toolbar />";
      },
      renderResourceTablePage(input) {
        calls.renderResourceTablePage.push(input);
        return "<table-shell />";
      },
    },
    resourceStateUtils: {
      applyResourceView(resourceKey, nextItems, resourceViews) {
        calls.applyResourceView.push({ resourceKey, items: nextItems, resourceViews });
        return filtered;
      },
      defaultResourceView() {
        return {
          query: "",
          filter: "all",
          sort: "updated_desc",
        };
      },
      toolbarStatusLabel() {
        return "active";
      },
      paginationPageNumbers(page, totalPages) {
        return [page, totalPages];
      },
    },
    paginationUtils: {
      currentLocalPageData(resourceKey, nextItems, nextState, options) {
        calls.currentLocalPageData.push({ resourceKey, items: nextItems, state: nextState, options });
        return pageData;
      },
      renderPagination(resourceKey, nextPageData, options) {
        return `pagination:${resourceKey}:${nextPageData.total}:${options.pageSizeOptions.join(",")}`;
      },
    },
    displayUtils: {
      escapeHTML(value) {
        return value;
      },
      emptyState(title, description) {
        calls.emptyState.push({ title, description });
        return `<empty>${title}:${description}</empty>`;
      },
    },
    pageSizeOptions: [10, 20, 50],
  });

  assert.equal(result.filtered, filtered);
  assert.equal(result.pageData, pageData);
  assert.equal(result.toolbar, "<toolbar />");
  assert.equal(container.innerHTML, "<table-shell />");
  assert.equal(calls.applyResourceView.length, 1);
  assert.equal(calls.applyResourceView[0].resourceKey, "backends");
  assert.equal(calls.applyResourceView[0].items, items);
  assert.equal(calls.applyResourceView[0].resourceViews, state.resourceViews);
  assert.equal(calls.currentLocalPageData.length, 1);
  assert.equal(calls.currentLocalPageData[0].resourceKey, "backends");
  assert.equal(calls.currentLocalPageData[0].items, filtered);
  assert.equal(calls.currentLocalPageData[0].state, state);
  assert.deepEqual(calls.currentLocalPageData[0].options.pageSizeOptions, [10, 20, 50]);
  assert.equal(typeof calls.currentLocalPageData[0].options.resourceStateUtils.defaultResourceView, "function");
  assert.equal(calls.createResourceToolbarModel.length, 1);
  assert.equal(calls.createResourceToolbarModel[0].resourceKey, "backends");
  assert.equal(calls.createResourceToolbarModel[0].searchPlaceholder, "Search backends");
  assert.equal(calls.createResourceToolbarModel[0].count, 1);
  assert.equal(calls.createResourceToolbarModel[0].activeFilters, 2);
  assert.equal(calls.createResourceToolbarModel[0].hasChanges, true);
  assert.equal(calls.renderResourceToolbar.length, 1);
  assert.equal(calls.renderResourceToolbar[0].resourceKey, "backends");
  assert.deepEqual(calls.emptyState, [{
    title: "还没有 Backend",
    description: "先配置至少一个 Backend。",
  }]);
  assert.deepEqual(calls.rowRenderer, pageData.items);
  assert.equal(calls.renderResourceTablePage.length, 1);
  assert.equal(calls.renderResourceTablePage[0].toolbar, "<toolbar />");
  assert.equal(calls.renderResourceTablePage[0].isEmpty, false);
  assert.match(calls.renderResourceTablePage[0].emptyMarkup, /还没有 Backend/);
  assert.deepEqual(calls.renderResourceTablePage[0].headers, ["Backend", "Actions"]);
  assert.equal(calls.renderResourceTablePage[0].rowsMarkup, "<tr>alpha</tr>");
  assert.match(calls.renderResourceTablePage[0].paginationMarkup, /^pagination:backends:1:/);
});

test("renderManagedResourceSection composes local table rendering with shared list interactions", () => {
  const calls = [];
  const state = {
    resourceViews: {},
    pagination: {},
  };
  const container = createContainer();

  ResourceListRuntimeUtils.renderManagedResourceSection({
    resourceKey: "clients",
    kind: "client",
    items: [{ id: 1, name: "alpha" }],
    state,
    container,
    searchPlaceholder: "Search client keys",
    emptyTitle: "还没有 Client Key",
    emptyDescription: "创建一个客户端 key。",
    headers: ["Client Key", "Actions"],
    rowRenderer(row) {
      calls.push(["rowRenderer", row.id]);
      return `<tr>${row.name}</tr>`;
    },
    resourceViewConfig: {},
    rendererUtils: {},
    resourceViewUtils: {
      renderResourceToolbar() {
        return "<toolbar />";
      },
      renderResourceTablePage() {
        return "<table />";
      },
    },
    resourceStateUtils: {
      applyResourceView(_resourceKey, items) {
        return items;
      },
      defaultResourceView() {
        return { query: "", filter: "all", sort: "updated_desc" };
      },
      toolbarStatusLabel() {
        return "default";
      },
      paginationPageNumbers() {
        return [1];
      },
    },
    paginationUtils: {
      currentLocalPageData(_resourceKey, items) {
        return {
          items,
          page: 1,
          size: 10,
          total: items.length,
          totalPages: 1,
        };
      },
      renderPagination() {
        return "<pagination />";
      },
      bindPagination(input) {
        calls.push(["bindPagination", input.resourceKey]);
      },
    },
    displayUtils: {
      escapeHTML(value) {
        return String(value);
      },
      emptyState(title) {
        return `<empty>${title}</empty>`;
      },
    },
    pageSizeOptions: [10, 20, 50],
    getExpandedSet() {
      return new Set();
    },
    getEditingID() {
      return null;
    },
    renderList() {
      calls.push(["renderList"]);
    },
    startEdit() {
      calls.push(["startEdit"]);
    },
    resetForm() {
      calls.push(["resetForm"]);
    },
    refreshAll() {
      calls.push(["refreshAll"]);
      return Promise.resolve();
    },
    confirm() {
      return true;
    },
    deleteMessage: "确认删除这个 Client Key？",
    deletePath(id) {
      return `/admin/api/client-keys/${id}`;
    },
    toggleExpanded() {
      calls.push(["toggleExpanded"]);
    },
    api() {
      calls.push(["api"]);
      return Promise.resolve();
    },
    bindResourceListInteractions(input) {
      calls.push(["bindInteractions", input.resourceKey, input.kind, typeof input.openResourceDrawer]);
    },
    drawerUtils: {},
    drawerViewUtils: {},
    openResourceDrawer() {
      return Promise.resolve();
    },
    renderResourceListByKey() {
      calls.push(["renderResourceListByKey"]);
    },
    refreshResourceList() {
      calls.push(["refreshResourceList"]);
      return Promise.resolve();
    },
    reportError(error) {
      calls.push(["reportError", error?.message || "error"]);
    },
    onCreate() {
      calls.push(["onCreate"]);
    },
  });

  assert.equal(container.innerHTML, "<table />");
  assert.deepEqual(calls, [
    ["rowRenderer", 1],
    ["bindInteractions", "clients", "client", "function"],
  ]);
});

test("resource list runtime renders a local resource table with real helpers", () => {
  const container = createContainer();
  const state = {
    resourceViews: {
      backends: {
        query: "edge",
        filter: "enabled",
        sort: "weight_desc",
      },
    },
    pagination: {
      backends: { page: 1, size: 10 },
    },
  };

  const result = ResourceListRuntimeUtils.renderLocalResourceTable({
    resourceKey: "backends",
    items: [
      {
        id: 1,
        name: "edge-a",
        base_url: "https://edge-a.example/v1",
        enabled: true,
        pool: "premium",
        protocol: "openai",
        request_count: 12,
        avg_latency_ms: 41,
        last_used_at: "2026-06-19T00:00:00Z",
        recent_stats: { window_minutes: 30, successes: 11, failures: 1 },
        weight: 20,
        updated_at: "2026-06-19T00:10:00Z",
      },
      {
        id: 2,
        name: "edge-disabled",
        base_url: "https://edge-disabled.example/v1",
        enabled: false,
        pool: "bulk",
        protocol: "openai",
        request_count: 6,
        avg_latency_ms: 80,
        last_used_at: "2026-06-18T00:00:00Z",
        recent_stats: { window_minutes: 30, successes: 6, failures: 0 },
        weight: 10,
        updated_at: "2026-06-18T00:10:00Z",
      },
    ],
    state,
    container,
    searchPlaceholder: "Search backends",
    emptyTitle: "还没有 Backend",
    emptyDescription: "先配置至少一个 Backend。",
    headers: ["Backend", "Routing", "Coverage", "Requests", "Avg Latency", "Last Used", "Recent 30m", "Actions"],
    rowRenderer(row) {
      return ResourceViewUtils.renderBackendRow({
        backend: row,
        expanded: false,
        editing: false,
        quickDetails: "",
        statusPill: DisplayUtils.statusPill,
        formatBackendRouting: DisplayUtils.formatBackendRouting,
        formatBackendCoverage: DisplayUtils.formatBackendCoverage,
        backendProtocolLabel: DisplayUtils.backendProtocolLabel,
        formatUsageCount: DisplayUtils.formatUsageCount,
        formatLatency: DisplayUtils.formatLatency,
        formatDateTime: DisplayUtils.formatDateTime,
        formatBackendRecentStats: DisplayUtils.formatBackendRecentStats,
        tableActions: DisplayUtils.tableActions,
      });
    },
    resourceViewUtils: ResourceViewUtils,
    resourceStateUtils: ResourceStateUtils,
    paginationUtils: PaginationUtils,
    displayUtils: DisplayUtils,
    resourceViewConfig: {
      backends: {
        filterOptions: [
          { value: "all", label: "All status" },
          { value: "enabled", label: "Enabled" },
        ],
        sortOptions: [
          { value: "updated_desc", label: "Updated" },
          { value: "weight_desc", label: "Weight" },
        ],
      },
    },
    rendererUtils: {},
    pageSizeOptions: [10, 20, 50],
  });

  assert.equal(result.filtered.length, 1);
  assert.equal(result.pageData.total, 1);
  assert.match(container.innerHTML, /Search backends/);
  assert.match(container.innerHTML, /1 items/);
  assert.match(container.innerHTML, /edge-a/);
  assert.doesNotMatch(container.innerHTML, /edge-disabled/);
});

test("resource list runtime binds toolbar controls through state updates and callbacks", async () => {
  const state = {
    resourceViews: {
      backends: {
        query: "",
        filter: "all",
        sort: "updated_desc",
      },
    },
    pagination: {
      backends: { page: 3, size: 10 },
    },
  };
  const container = createToolbarContainer("backends");
  const rerenders = [];
  const refreshes = [];
  const creates = [];

  ResourceListRuntimeUtils.bindResourceToolbar({
    container,
    resourceKey: "backends",
    state,
    resourceStateUtils: ResourceStateUtils,
    renderResourceListByKey(resourceKey) {
      rerenders.push(resourceKey);
    },
    refreshResourceList(resourceKey) {
      refreshes.push(resourceKey);
      return Promise.resolve();
    },
    reportError(error) {
      throw error;
    },
    onCreate() {
      creates.push("create");
    },
  });

  await container.listeners['[data-toolbar-search="backends"]'].input({
    currentTarget: { value: "edge" },
  });
  assert.equal(state.resourceViews.backends.query, "edge");
  assert.equal(state.pagination.backends.page, 1);

  state.pagination.backends.page = 4;
  await container.listeners['[data-toolbar-filter="backends"]'].change({
    currentTarget: { value: "enabled" },
  });
  assert.equal(state.resourceViews.backends.filter, "enabled");
  assert.equal(state.pagination.backends.page, 1);

  state.pagination.backends.page = 5;
  await container.listeners['[data-toolbar-sort="backends"]'].change({
    currentTarget: { value: "weight_desc" },
  });
  assert.equal(state.resourceViews.backends.sort, "weight_desc");
  assert.equal(state.pagination.backends.page, 1);

  state.resourceViews.backends.query = "edge";
  state.resourceViews.backends.filter = "enabled";
  state.resourceViews.backends.sort = "weight_desc";
  state.pagination.backends.page = 6;
  await container.listeners['[data-toolbar-reset="backends"]'].click();
  assert.deepEqual(state.resourceViews.backends, {
    query: "",
    filter: "all",
    sort: "updated_desc",
  });
  assert.equal(state.pagination.backends.page, 1);

  await container.listeners['[data-toolbar-refresh="backends"]'].click();
  await container.listeners['[data-toolbar-create="backends"]'].click();

  assert.deepEqual(rerenders, ["backends", "backends", "backends", "backends"]);
  assert.deepEqual(refreshes, ["backends"]);
  assert.deepEqual(creates, ["create"]);
});

test("resource list runtime binds shared list interactions through delegated helpers and callbacks", async () => {
  const container = createResourceListContainer({
    toggleSelector: "[data-toggle-backend]",
    toggleDatasetKey: "toggleBackend",
    toggleValue: "42",
    editSelector: "[data-edit-backend]",
    editDatasetKey: "editBackend",
    editValue: "42",
    deleteSelector: "[data-delete-backend]",
    deleteDatasetKey: "deleteBackend",
    deleteValue: "42",
  });
  const calls = {
    bindResourceRowOpen: [],
    bindResourceToolbar: [],
    bindPagination: [],
    toggleExpanded: [],
    startEdit: [],
    api: [],
    resetForm: [],
    refreshAll: 0,
    reportError: [],
    confirm: [],
  };
  const expandedSet = new Set(["7"]);
  let editingID = "42";

  ResourceListRuntimeUtils.bindResourceListInteractions({
    container,
    resourceKey: "backends",
    kind: "backend",
    state: {
      expandedBackends: expandedSet,
      editingBackendID: editingID,
      resourceViews: {
        backends: {
          query: "",
          filter: "all",
          sort: "updated_desc",
        },
      },
      pagination: {
        backends: { page: 1, size: 10 },
      },
    },
    getExpandedSet() {
      return expandedSet;
    },
    getEditingID() {
      return editingID;
    },
    renderList() {
      calls.renderList = (calls.renderList || 0) + 1;
    },
    startEdit(id) {
      calls.startEdit.push(id);
    },
    resetForm() {
      calls.resetForm.push("reset");
    },
    refreshAll() {
      calls.refreshAll += 1;
      return Promise.resolve();
    },
    confirm(message) {
      calls.confirm.push(message);
      return true;
    },
    deleteMessage: "确认删除这个 Backend？",
    deletePath(id) {
      return `/admin/api/backends/${id}`;
    },
    toggleExpanded(set, id) {
      calls.toggleExpanded.push({ set, id });
    },
    api(path, method) {
      calls.api.push({ path, method });
      return Promise.resolve();
    },
    bindResourceRowOpen(input) {
      calls.bindResourceRowOpen.push(input);
    },
    bindResourceToolbar(input) {
      calls.bindResourceToolbar.push(input);
    },
    paginationUtils: {
      bindPagination(containerArg, resourceKeyArg, renderListArg, stateArg, optionsArg) {
        calls.bindPagination.push({
          container: containerArg,
          resourceKey: resourceKeyArg,
          renderList: renderListArg,
          state: stateArg,
          options: optionsArg,
        });
      },
    },
    drawerUtils: { drawerDisplayTitle() { return "Backend"; } },
    drawerViewUtils: { drawerDisplayTitle() { return "Backend"; } },
    openResourceDrawer() {
      return Promise.resolve();
    },
    resourceStateUtils: {
      defaultResourceView() {
        return { query: "", filter: "all", sort: "updated_desc" };
      },
    },
    renderResourceListByKey() {},
    refreshResourceList() {
      return Promise.resolve();
    },
    reportError(error) {
      calls.reportError.push(error);
    },
    onCreate() {},
  });

  assert.equal(calls.bindResourceRowOpen.length, 1);
  assert.equal(calls.bindResourceRowOpen[0].container, container);
  assert.equal(calls.bindResourceRowOpen[0].kind, "backend");
  assert.equal(calls.bindResourceToolbar.length, 1);
  assert.equal(calls.bindResourceToolbar[0].container, container);
  assert.equal(calls.bindResourceToolbar[0].resourceKey, "backends");
  assert.equal(calls.bindPagination.length, 1);
  assert.equal(calls.bindPagination[0].container, container);
  assert.equal(calls.bindPagination[0].resourceKey, "backends");

  await container.listeners["[data-toggle-backend]"][0].click();
  assert.equal(calls.toggleExpanded.length, 1);
  assert.equal(calls.toggleExpanded[0].set, expandedSet);
  assert.equal(calls.toggleExpanded[0].id, "42");
  assert.equal(calls.renderList, 1);

  await container.listeners["[data-edit-backend]"][0].click();
  assert.deepEqual(calls.startEdit, ["42"]);

  await container.listeners["[data-delete-backend]"][0].click();
  await Promise.resolve();
  assert.deepEqual(calls.confirm, ["确认删除这个 Backend？"]);
  assert.deepEqual(calls.api, [{
    path: "/admin/api/backends/42",
    method: "DELETE",
  }]);
  assert.deepEqual(calls.resetForm, ["reset"]);
  assert.equal(expandedSet.has("42"), false);
  assert.equal(calls.refreshAll, 1);
  assert.deepEqual(calls.reportError, []);
});

test("resource list runtime reports missing dataset ids before triggering side effects", async () => {
  const container = createResourceListContainer({
    toggleSelector: "[data-toggle-backend]",
    toggleDatasetKey: "togglePolicy",
    toggleValue: "42",
    editSelector: "[data-edit-backend]",
    editDatasetKey: "editPolicy",
    editValue: "42",
    deleteSelector: "[data-delete-backend]",
    deleteDatasetKey: "deletePolicy",
    deleteValue: "42",
  });
  const calls = {
    toggleExpanded: 0,
    startEdit: 0,
    api: 0,
    refreshAll: 0,
    resetForm: 0,
    reportError: [],
    confirm: 0,
  };
  const expandedSet = new Set(["42"]);

  ResourceListRuntimeUtils.bindResourceListInteractions({
    container,
    resourceKey: "backends",
    kind: "backend",
    state: {
      resourceViews: {
        backends: {
          query: "",
          filter: "all",
          sort: "updated_desc",
        },
      },
      pagination: {
        backends: { page: 1, size: 10 },
      },
    },
    getExpandedSet() {
      return expandedSet;
    },
    getEditingID() {
      return "42";
    },
    renderList() {},
    startEdit() {
      calls.startEdit += 1;
    },
    resetForm() {
      calls.resetForm += 1;
    },
    refreshAll() {
      calls.refreshAll += 1;
      return Promise.resolve();
    },
    confirm() {
      calls.confirm += 1;
      return true;
    },
    deleteMessage: "确认删除这个 Backend？",
    deletePath(id) {
      return `/admin/api/backends/${id}`;
    },
    toggleExpanded() {
      calls.toggleExpanded += 1;
    },
    api() {
      calls.api += 1;
      return Promise.resolve();
    },
    bindResourceRowOpen() {},
    bindResourceToolbar() {},
    paginationUtils: {
      bindPagination() {},
    },
    drawerUtils: { drawerDisplayTitle() { return "Backend"; } },
    drawerViewUtils: { drawerDisplayTitle() { return "Backend"; } },
    openResourceDrawer() {
      return Promise.resolve();
    },
    resourceStateUtils: {
      defaultResourceView() {
        return { query: "", filter: "all", sort: "updated_desc" };
      },
    },
    renderResourceListByKey() {},
    refreshResourceList() {
      return Promise.resolve();
    },
    reportError(error) {
      calls.reportError.push(error);
    },
    onCreate() {},
  });

  try {
    await container.listeners["[data-toggle-backend]"][0].click();
  } catch {}
  try {
    await container.listeners["[data-edit-backend]"][0].click();
  } catch {}
  try {
    await container.listeners["[data-delete-backend]"][0].click();
    await Promise.resolve();
  } catch {}

  assert.equal(calls.toggleExpanded, 0);
  assert.equal(calls.startEdit, 0);
  assert.equal(calls.confirm, 0);
  assert.equal(calls.api, 0);
  assert.equal(calls.refreshAll, 0);
  assert.equal(calls.resetForm, 0);
  assert.equal(expandedSet.has("42"), true);
  assert.equal(calls.reportError.length, 3);
  assert.match(String(calls.reportError[0]?.message || ""), /missing backend toggle target id/i);
  assert.match(String(calls.reportError[1]?.message || ""), /missing backend edit target id/i);
  assert.match(String(calls.reportError[2]?.message || ""), /missing backend delete target id/i);
});

test("resource list runtime binds row open interactions and ignores nested buttons", async () => {
  const row = createRowStub({
    rowId: "42",
    rowTitle: "edge-a",
    pageId: "backends",
  });
  const drawerCalls = [];
  const reported = [];

  ResourceListRuntimeUtils.bindResourceRowOpen({
    container: {
      querySelectorAll(selector) {
        if (selector === "[data-row-open]") {
          return [row];
        }
        return [];
      },
    },
    kind: "backend",
    drawerViewUtils: {
      drawerDisplayTitle() {
        return "Backend";
      },
    },
    drawerUtils: {},
    openResourceDrawer(payload) {
      drawerCalls.push(payload);
      return Promise.resolve();
    },
    reportError(error) {
      reported.push(error);
    },
  });

  assert.equal(row.attributes.tabindex, "0");
  assert.equal(row.attributes["aria-controls"], "drawerRoot");
  assert.equal(row.attributes["aria-label"], "Open edge-a detail");

  await row.listeners.click({
    target: {
      closest() {
        return null;
      },
    },
  });
  assert.deepEqual(drawerCalls[0], {
    kind: "backend",
    page: "backends",
    id: "42",
    title: "edge-a",
    triggerElement: row,
  });

  let prevented = false;
  await row.listeners.keydown({
    key: "Enter",
    preventDefault() {
      prevented = true;
    },
    target: {
      closest() {
        return null;
      },
    },
  });
  assert.equal(prevented, true);
  assert.equal(drawerCalls.length, 2);

  await row.listeners.click({
    target: {
      closest(selector) {
        return selector === "button" ? {} : null;
      },
    },
  });
  assert.equal(drawerCalls.length, 2);
  assert.deepEqual(reported, []);
});

function createContainer() {
  return {
    innerHTML: "",
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

function createToolbarContainer(resourceKey) {
  const listeners = {};

  function ensureEntry(selector) {
    if (!listeners[selector]) {
      listeners[selector] = {};
    }
    return {
      addEventListener(type, listener) {
        listeners[selector][type] = listener;
      },
    };
  }

  return {
    listeners,
    querySelector(selector) {
      const known = new Set([
        `[data-toolbar-search="${resourceKey}"]`,
        `[data-toolbar-filter="${resourceKey}"]`,
        `[data-toolbar-sort="${resourceKey}"]`,
        `[data-toolbar-reset="${resourceKey}"]`,
        `[data-toolbar-refresh="${resourceKey}"]`,
        `[data-toolbar-create="${resourceKey}"]`,
      ]);
      return known.has(selector) ? ensureEntry(selector) : null;
    },
  };
}

function createResourceListContainer({
  toggleSelector,
  toggleDatasetKey,
  toggleValue,
  editSelector,
  editDatasetKey,
  editValue,
  deleteSelector,
  deleteDatasetKey,
  deleteValue,
}) {
  const listeners = {
    [toggleSelector]: [],
    [editSelector]: [],
    [deleteSelector]: [],
  };
  const buttons = new Map([
    [toggleSelector, [{ dataset: { [toggleDatasetKey]: toggleValue } }]],
    [editSelector, [{ dataset: { [editDatasetKey]: editValue } }]],
    [deleteSelector, [{ dataset: { [deleteDatasetKey]: deleteValue } }]],
  ]);

  return {
    listeners,
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      return (buttons.get(selector) || []).map((button) => ({
        dataset: button.dataset,
        addEventListener(type, listener) {
          listeners[selector].push({
            [type]: (...args) => listener(...args),
          });
        },
      }));
    },
  };
}

function createRowStub({ rowId, rowTitle, pageId }) {
  return {
    dataset: {
      rowId,
      rowTitle,
    },
    attributes: {},
    listeners: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    closest(selector) {
      if (selector === ".page") {
        return { id: pageId };
      }
      return null;
    },
  };
}
