import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SearchRuntimeUtils = require("./search-runtime.js");

test("search runtime delegates shell open close and query updates to search utils", () => {
  const calls = [];
  const state = {
    ui: {
      search: {
        query: "  edge  ",
        results: { total: 0, groups: [] },
        loading: false,
        triggerElement: null,
      },
    },
  };
  const triggerElement = new HTMLElementStub("trigger");
  const searchInput = new HTMLElementStub("search-input");
  const searchModalPanel = new HTMLElementStub("search-modal-panel");
  const searchOpenBtn = new HTMLElementStub("search-open");
  const renderSearchShell = () => {
    calls.push(["renderSearchShell"]);
  };
  const triggerSearch = () => {
    calls.push(["triggerSearch"]);
  };
  const searchDebounce = {
    cancel() {
      calls.push(["cancel"]);
    },
  };
  const searchUtils = {
    openSearchState(searchState, input) {
      calls.push(["openSearchState", searchState, input.triggerElement]);
      searchState.open = true;
      return { shouldTriggerSearch: true };
    },
    closeSearchState(searchState) {
      calls.push(["closeSearchState", searchState]);
      searchState.open = false;
      return { previousTrigger: triggerElement };
    },
    updateSearchQueryState(searchState, value) {
      calls.push(["updateSearchQueryState", searchState, value]);
      searchState.query = value;
      return { shouldTriggerSearch: false };
    },
  };

  SearchRuntimeUtils.openSearchShell({
    state,
    searchUtils,
    renderSearchShell,
    searchInput,
    searchModalPanel,
    searchOpenBtn,
    documentObject: { activeElement: triggerElement },
    HTMLElementClass: HTMLElementStub,
    triggerSearch,
  });

  assert.equal(state.ui.search.open, true);
  assert.deepEqual(searchInput.actions, ["focus", "select"]);
  assert.deepEqual(calls.slice(0, 3), [
    ["openSearchState", state.ui.search, triggerElement],
    ["renderSearchShell"],
    ["triggerSearch"],
  ]);

  SearchRuntimeUtils.updateSearchQuery({
    state,
    value: "new query",
    searchUtils,
    searchDebounce,
    triggerSearch,
  });
  assert.equal(state.ui.search.query, "new query");
  assert.deepEqual(calls.slice(3, 5), [
    ["updateSearchQueryState", state.ui.search, "new query"],
    ["cancel"],
  ]);

  SearchRuntimeUtils.closeSearchShell({
    state,
    searchUtils,
    searchDebounce,
    renderSearchShell,
    HTMLElementClass: HTMLElementStub,
  });
  assert.equal(state.ui.search.open, false);
  assert.deepEqual(triggerElement.actions, ["focus"]);
  assert.deepEqual(calls.slice(5), [
    ["closeSearchState", state.ui.search],
    ["cancel"],
    ["renderSearchShell"],
  ]);
});

test("search runtime triggers execution immediately or through debounce", () => {
  const state = {
    ui: {
      search: {
        query: " gateway ",
        requestSequence: 2,
      },
    },
  };
  const request = { sequence: 3, query: "gateway" };
  const calls = [];
  const searchUtils = {
    startSearchRequestState(searchState) {
      calls.push(["startSearchRequestState", searchState]);
      searchState.requestSequence = request.sequence;
      searchState.activeSequence = request.sequence;
      return request;
    },
  };

  const immediateExecuteCalls = [];
  SearchRuntimeUtils.triggerSearch({
    state,
    searchUtils,
    searchDebounce: null,
    reportError(error) {
      immediateExecuteCalls.push(["reportError", error]);
    },
    executeSearch(nextRequest) {
      immediateExecuteCalls.push(["executeSearch", nextRequest]);
      return Promise.resolve();
    },
    renderSearchShell() {
      immediateExecuteCalls.push(["renderSearchShell"]);
    },
  });

  assert.deepEqual(calls, [["startSearchRequestState", state.ui.search]]);
  assert.deepEqual(immediateExecuteCalls, [["executeSearch", request]]);

  const debouncedCalls = [];
  SearchRuntimeUtils.triggerSearch({
    state,
    searchUtils,
    searchDebounce(nextRequest) {
      debouncedCalls.push(["searchDebounce", nextRequest]);
    },
    reportError(error) {
      debouncedCalls.push(["reportError", error]);
    },
    executeSearch(nextRequest) {
      debouncedCalls.push(["executeSearch", nextRequest]);
      return Promise.resolve();
    },
    renderSearchShell() {
      debouncedCalls.push(["renderSearchShell"]);
    },
  });

  assert.deepEqual(debouncedCalls, [
    ["renderSearchShell"],
    ["searchDebounce", request],
  ]);
});

test("search runtime executes requests renders results and navigates through injected helpers", async () => {
  const state = {
    ui: {
      search: {
        query: " edge ",
        loading: false,
        activeSequence: 4,
        activeIndex: 0,
        results: { total: 1, groups: [] },
      },
    },
  };
  const renderCalls = [];
  const apiCalls = [];
  const searchUtils = {
    clearSearchState(searchState) {
      renderCalls.push(["clearSearchState", searchState]);
      searchState.query = "";
      searchState.loading = false;
      searchState.activeIndex = -1;
      searchState.results = { query: "", total: 0, groups: [] };
    },
    buildSearchRequestPath(query, limit) {
      apiCalls.push(["buildSearchRequestPath", query, limit]);
      return `/admin/api/search?q=${query}&limit=${limit}`;
    },
    resolveSearchResponseState(searchState, requestID, response) {
      apiCalls.push(["resolveSearchResponseState", requestID, response]);
      searchState.results = response.normalized;
      searchState.activeIndex = 1;
      return true;
    },
    createSearchKeyboardState({ results, activeIndex }) {
      apiCalls.push(["createSearchKeyboardState", results, activeIndex]);
      return {
        items: [{ title: "edge-a" }],
        activeIndex,
        activeItem: results.groups[0]?.items?.[activeIndex] || null,
      };
    },
    getSearchResultTarget(payload) {
      apiCalls.push(["getSearchResultTarget", payload]);
      return {
        page: "backends",
        drawer: { kind: "backend", id: "3", title: "edge-a" },
      };
    },
    moveSearchSelection(input) {
      apiCalls.push(["moveSearchSelection", input]);
      return 0;
    },
  };
  const shellViewUtils = {
    renderSearchResults(input) {
      renderCalls.push(["renderSearchResults", input]);
      return "<section>results</section>";
    },
  };

  await SearchRuntimeUtils.executeSearch({
    state,
    request: { sequence: 4, query: "edge" },
    searchUtils,
    api(path) {
      apiCalls.push(["api", path]);
      return Promise.resolve({
        normalized: {
          query: "edge",
          total: 1,
          groups: [{ key: "backends", label: "Backends", items: [{ title: "edge-a" }] }],
        },
      });
    },
    searchLimit: 8,
    renderSearchShell() {
      renderCalls.push(["renderSearchShell"]);
    },
    currentSearchKeyboardState() {
      renderCalls.push(["currentSearchKeyboardState"]);
      return { items: [{ title: "edge-a" }], activeIndex: 1, activeItem: { title: "edge-a" } };
    },
  });

  assert.equal(state.ui.search.loading, false);
  assert.deepEqual(apiCalls.slice(0, 3), [
    ["buildSearchRequestPath", "edge", 8],
    ["api", "/admin/api/search?q=edge&limit=8"],
    ["resolveSearchResponseState", 4, {
      normalized: {
        query: "edge",
        total: 1,
        groups: [{ key: "backends", label: "Backends", items: [{ title: "edge-a" }] }],
      },
    }],
  ]);
  assert.deepEqual(renderCalls, [
    ["renderSearchShell"],
    ["renderSearchShell"],
  ]);

  const markup = SearchRuntimeUtils.renderSearchResults({
    state,
    shellViewUtils,
    currentSearchKeyboardState() {
      return { items: [{ title: "edge-a" }], activeIndex: 0, activeItem: { title: "edge-a" } };
    },
    escapeHTML(value) {
      return String(value).toUpperCase();
    },
  });
  assert.equal(markup, "<section>results</section>");

  let closed = 0;
  let activated = null;
  const opened = [];
  SearchRuntimeUtils.navigateToSearchResult({
    payload: { kind: "backend", targetPage: "backends", targetId: "3", title: "edge-a" },
    searchUtils,
    windowObject: { location: { hash: "" } },
    activatePage(page) {
      activated = page;
    },
    closeSearchShell() {
      closed += 1;
    },
    openResourceDrawer(target) {
      opened.push(target);
      return Promise.resolve();
    },
    reportError(error) {
      throw error;
    },
  });

  assert.equal(activated, "backends");
  assert.equal(closed, 1);
  assert.deepEqual(opened, [{
    kind: "backend",
    page: "backends",
    id: "3",
    title: "edge-a",
  }]);

  const keyboardState = SearchRuntimeUtils.currentSearchKeyboardState({ state, searchUtils });
  assert.equal(keyboardState.activeIndex, 1);

  SearchRuntimeUtils.moveSearchSelection({
    state,
    delta: -1,
    searchUtils,
    currentSearchKeyboardState() {
      return { items: [{ title: "edge-a" }, { title: "edge-b" }], activeIndex: 1, activeItem: { title: "edge-b" } };
    },
    renderSearchShell() {
      renderCalls.push(["renderSearchShellAfterMove"]);
    },
  });

  assert.equal(state.ui.search.activeIndex, 0);
  assert.deepEqual(apiCalls.at(-1), ["moveSearchSelection", { currentIndex: 1, delta: -1, itemCount: 2 }]);
  assert.deepEqual(renderCalls.at(-1), ["renderSearchShellAfterMove"]);
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
