import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SearchRuntimeUtils = require("./search-runtime.js");
const SearchUtils = require("./search.js");
const ShellViewUtils = require("./shell-view.js");

test("search runtime opens and closes with real search state helpers", () => {
  const state = {
    ui: {
      search: {
        open: false,
        query: " edge ",
        loading: false,
        activeIndex: 2,
        results: { total: 0, groups: [] },
        triggerElement: null,
      },
    },
  };
  const renderCalls = [];
  const searchInput = new HTMLElementStub("search-input");
  const searchModalPanel = new HTMLElementStub("search-modal-panel");
  const searchOpenBtn = new HTMLElementStub("search-open");
  const triggerElement = new HTMLElementStub("trigger");
  const searchDebounce = {
    canceled: 0,
    cancel() {
      this.canceled += 1;
    },
  };
  let triggered = 0;

  SearchRuntimeUtils.openSearchShell({
    state,
    searchUtils: SearchUtils,
    renderSearchShell() {
      renderCalls.push("render");
    },
    searchInput,
    searchModalPanel,
    searchOpenBtn,
    documentObject: { activeElement: triggerElement },
    HTMLElementClass: HTMLElementStub,
    triggerSearch() {
      triggered += 1;
    },
  });

  assert.equal(state.ui.search.open, true);
  assert.equal(state.ui.search.triggerElement, triggerElement);
  assert.deepEqual(searchInput.actions, ["focus", "select"]);
  assert.equal(triggered, 1);
  assert.deepEqual(renderCalls, ["render"]);

  SearchRuntimeUtils.closeSearchShell({
    state,
    searchUtils: SearchUtils,
    searchDebounce,
    renderSearchShell() {
      renderCalls.push("close-render");
    },
    HTMLElementClass: HTMLElementStub,
  });

  assert.equal(state.ui.search.open, false);
  assert.equal(state.ui.search.activeIndex, -1);
  assert.equal(searchDebounce.canceled, 1);
  assert.deepEqual(triggerElement.actions, ["focus"]);
  assert.deepEqual(renderCalls, ["render", "close-render"]);
});

test("search runtime requires search utils methods instead of embedding fallbacks", async () => {
  const state = {
    ui: {
      search: {
        open: false,
        query: "edge",
        loading: false,
        activeIndex: 0,
        requestSequence: 0,
        activeSequence: 0,
        results: { query: "", total: 0, groups: [] },
      },
    },
  };

  assert.throws(
    () => SearchRuntimeUtils.openSearchShell({
      state,
      searchUtils: {},
      renderSearchShell() {},
      searchInput: new HTMLElementStub("search-input"),
      searchModalPanel: new HTMLElementStub("search-modal-panel"),
      searchOpenBtn: new HTMLElementStub("search-open"),
      documentObject: { activeElement: new HTMLElementStub("trigger") },
      HTMLElementClass: HTMLElementStub,
      triggerSearch() {},
    }),
    /openSearchState/i,
  );

  assert.throws(
    () => SearchRuntimeUtils.triggerSearch({
      state,
      searchUtils: {},
      searchDebounce() {},
      reportError(error) {
        throw error;
      },
      executeSearch() {
        return Promise.resolve();
      },
      renderSearchShell() {},
    }),
    /startSearchRequestState/i,
  );

  await assert.rejects(
    () => SearchRuntimeUtils.executeSearch({
      state,
      request: { sequence: 1, query: "edge" },
      searchUtils: {},
      api() {
        return Promise.resolve({});
      },
      searchLimit: 8,
      renderSearchShell() {},
      currentSearchKeyboardState() {
        return { items: [], activeIndex: -1, activeItem: null };
      },
    }),
    /buildSearchRequestPath/i,
  );

  assert.throws(
    () => SearchRuntimeUtils.currentSearchKeyboardState({
      state,
      searchUtils: {},
    }),
    /createSearchKeyboardState/i,
  );
});

test("search runtime updates query and clears state with real search helpers", () => {
  const state = {
    ui: {
      search: {
        open: true,
        query: "edge",
        loading: true,
        activeIndex: 3,
        requestSequence: 2,
        activeSequence: 4,
        results: {
          query: "edge",
          total: 2,
          groups: [{ key: "backends", label: "Backends", items: [{ title: "edge-a" }] }],
        },
      },
    },
  };
  const searchDebounce = {
    canceled: 0,
    cancel() {
      this.canceled += 1;
    },
  };
  let triggered = 0;

  SearchRuntimeUtils.updateSearchQuery({
    state,
    value: "   ",
    searchUtils: SearchUtils,
    searchDebounce,
    triggerSearch() {
      triggered += 1;
    },
  });

  assert.equal(state.ui.search.query, "   ");
  assert.equal(state.ui.search.loading, false);
  assert.equal(state.ui.search.activeIndex, -1);
  assert.deepEqual(state.ui.search.results, {
    query: "",
    total: 0,
    groups: [],
  });
  assert.equal(state.ui.search.requestSequence, 5);
  assert.equal(state.ui.search.activeSequence, 5);
  assert.equal(searchDebounce.canceled, 1);
  assert.equal(triggered, 0);
});

test("search runtime triggers and executes with real search helpers", async () => {
  const state = {
    ui: {
      search: {
        open: true,
        query: " gateway ",
        loading: false,
        activeIndex: -1,
        requestSequence: 0,
        activeSequence: 0,
        results: { query: "", total: 0, groups: [] },
      },
    },
  };
  const renderCalls = [];
  const scheduled = [];
  const debounce = (request) => {
    scheduled.push(request);
  };

  SearchRuntimeUtils.triggerSearch({
    state,
    searchUtils: SearchUtils,
    searchDebounce: debounce,
    reportError(error) {
      throw error;
    },
    executeSearch() {
      throw new Error("should not execute immediately when debounce exists");
    },
    renderSearchShell() {
      renderCalls.push("render");
    },
  });

  assert.equal(state.ui.search.requestSequence, 1);
  assert.equal(state.ui.search.activeSequence, 1);
  assert.equal(state.ui.search.loading, true);
  assert.deepEqual(scheduled, [{ sequence: 1, query: "gateway" }]);
  assert.deepEqual(renderCalls, ["render"]);

  const apiCalls = [];
  await SearchRuntimeUtils.executeSearch({
    state,
    request: scheduled[0],
    searchUtils: SearchUtils,
    api(path) {
      apiCalls.push(path);
      return Promise.resolve({
        query: "gateway",
        results: {
          backends: [
            {
              kind: "backend",
              id: "1",
              title: "edge-a",
              subtitle: "OpenAI",
              meta: "healthy",
              status: "ok",
              target_page: "backends",
              target_id: "1",
            },
          ],
        },
      });
    },
    searchLimit: 8,
    renderSearchShell() {
      renderCalls.push("render-after");
    },
    currentSearchKeyboardState() {
      return SearchRuntimeUtils.currentSearchKeyboardState({
        state,
        searchUtils: SearchUtils,
      });
    },
  });

  assert.deepEqual(apiCalls, ["/admin/api/search?q=gateway&limit=8"]);
  assert.equal(state.ui.search.loading, false);
  assert.equal(state.ui.search.results.total, 1);
  assert.equal(state.ui.search.results.groups[0].key, "backends");
  assert.equal(state.ui.search.activeIndex, 0);
  assert.deepEqual(renderCalls, ["render", "render-after", "render-after"]);
});

test("search runtime ignores stale responses with real search helpers", async () => {
  const state = {
    ui: {
      search: {
        query: "edge",
        loading: true,
        activeIndex: 1,
        requestSequence: 3,
        activeSequence: 9,
        results: {
          query: "edge",
          total: 1,
          groups: [{ key: "backends", label: "Backends", items: [{ title: "current" }] }],
        },
      },
    },
  };
  let renderCount = 0;

  await SearchRuntimeUtils.executeSearch({
    state,
    request: { sequence: 8, query: "edge" },
    searchUtils: SearchUtils,
    api() {
      return Promise.resolve({
        query: "edge",
        results: {
          backends: [
            {
              kind: "backend",
              id: "2",
              title: "stale",
              target_page: "backends",
              target_id: "2",
            },
          ],
        },
      });
    },
    searchLimit: 8,
    renderSearchShell() {
      renderCount += 1;
    },
    currentSearchKeyboardState() {
      return SearchRuntimeUtils.currentSearchKeyboardState({
        state,
        searchUtils: SearchUtils,
      });
    },
  });

  assert.equal(renderCount, 1);
  assert.equal(state.ui.search.loading, true);
  assert.deepEqual(state.ui.search.results, {
    query: "edge",
    total: 1,
    groups: [{ key: "backends", label: "Backends", items: [{ title: "current" }] }],
  });
  assert.equal(state.ui.search.activeIndex, 1);
});

test("search runtime renders results and moves selection with real helpers", () => {
  const state = {
    ui: {
      search: {
        query: "edge",
        loading: false,
        activeIndex: 0,
        results: {
          query: "edge",
          total: 2,
          groups: [
            {
              key: "backends",
              label: "Backends",
              items: [
                {
                  kind: "backend",
                  title: "edge-a",
                  subtitle: "OpenAI",
                  meta: "healthy",
                  status: "ok",
                  targetPage: "backends",
                  targetId: "1",
                },
                {
                  kind: "backend",
                  title: "edge-b",
                  subtitle: "Anthropic",
                  meta: "standby",
                  status: "warning",
                  targetPage: "backends",
                  targetId: "2",
                },
              ],
            },
          ],
        },
      },
    },
  };

  const markup = SearchRuntimeUtils.renderSearchResults({
    state,
    shellViewUtils: ShellViewUtils,
    currentSearchKeyboardState() {
      return SearchRuntimeUtils.currentSearchKeyboardState({
        state,
        searchUtils: SearchUtils,
      });
    },
    escapeHTML(value) {
      return String(value);
    },
  });

  assert.match(markup, /search-result-item active/);
  assert.match(markup, /edge-a/);
  assert.match(markup, /edge-b/);

  let renderCount = 0;
  SearchRuntimeUtils.moveSearchSelection({
    state,
    delta: 1,
    searchUtils: SearchUtils,
    currentSearchKeyboardState() {
      return SearchRuntimeUtils.currentSearchKeyboardState({
        state,
        searchUtils: SearchUtils,
      });
    },
    renderSearchShell() {
      renderCount += 1;
    },
  });

  assert.equal(state.ui.search.activeIndex, 1);
  assert.equal(renderCount, 1);
});

test("search runtime navigates to normalized result targets with real helpers", async () => {
  const payload = {
    kind: "backend",
    title: "edge-a",
    targetPage: "backends",
    targetId: "1",
  };
  const windowObject = { location: { hash: "" } };
  const calls = [];

  SearchRuntimeUtils.navigateToSearchResult({
    payload,
    searchUtils: SearchUtils,
    windowObject,
    activatePage(page) {
      calls.push(["activatePage", page]);
    },
    closeSearchShell() {
      calls.push(["closeSearchShell"]);
    },
    openResourceDrawer(target) {
      calls.push(["openResourceDrawer", target]);
      return Promise.resolve();
    },
    reportError(error) {
      throw error;
    },
  });

  await Promise.resolve();

  assert.equal(windowObject.location.hash, "#backends");
  assert.deepEqual(calls, [
    ["activatePage", "backends"],
    ["closeSearchShell"],
    ["openResourceDrawer", { kind: "backend", page: "backends", id: "1", title: "edge-a" }],
  ]);
});

class HTMLElementStub {
  constructor(name) {
    this.name = name;
    this.actions = [];
  }

  focus() {
    this.actions.push("focus");
  }

  select() {
    this.actions.push("select");
  }
}
