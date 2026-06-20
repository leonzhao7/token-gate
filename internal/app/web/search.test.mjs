import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  clearSearchState,
  buildSearchRequestPath,
  closeSearchState,
  createSearchKeyboardState,
  createSearchRequest,
  createDebouncedTask,
  flattenSearchResults,
  getSearchResultTarget,
  isSearchDismissKey,
  isSearchShortcut,
  moveSearchSelection,
  nextSearchSequence,
  normalizeSearchResponse,
  openSearchState,
  resolveSearchResponseState,
  startSearchRequestState,
  updateSearchQueryState,
} = require("./search.js");

test("buildSearchRequestPath trims query and clamps limit", () => {
  assert.equal(buildSearchRequestPath("  gateway  ", 99), "/admin/api/search?q=gateway&limit=50");
  assert.equal(buildSearchRequestPath("logs", 0), "/admin/api/search?q=logs&limit=1");
});

test("normalizeSearchResponse keeps supported groups in product order", () => {
  const normalized = normalizeSearchResponse({
    query: "gpt",
    results: {
      events: [
        {
          kind: "event",
          id: "evt_1",
          title: "Backend failover",
          subtitle: "edge-openai-1",
          meta: "2m ago",
          status: "warning",
          target_page: "events",
          target_id: "evt_1",
        },
      ],
      backends: [
        {
          kind: "backend",
          id: 3,
          title: "edge-openai-1",
          subtitle: "OpenAI compatible",
          meta: "premium",
          status: "healthy",
          target_page: "backends",
          target_id: 3,
        },
      ],
      usage_logs: [
        {
          kind: "usage_log",
          id: 9,
          title: "POST /v1/responses",
          subtitle: "gpt-4o",
          meta: "200",
          status: "ok",
          target_page: "usage-logs",
          target_id: 9,
        },
      ],
      ignored_group: [
        {
          kind: "unknown",
          id: "nope",
          title: "ignored",
        },
      ],
    },
  });

  assert.deepEqual(
    normalized.groups.map((group) => ({ key: group.key, count: group.items.length })),
    [
      { key: "backends", count: 1 },
      { key: "usage_logs", count: 1 },
      { key: "events", count: 1 },
    ],
  );

  assert.deepEqual(normalized.groups[0].items[0], {
    group: "backends",
    kind: "backend",
    id: "3",
    title: "edge-openai-1",
    subtitle: "OpenAI compatible",
    meta: "premium",
    status: "healthy",
    targetPage: "backends",
    targetId: "3",
  });
});

test("normalizeSearchResponse drops invalid rows and defaults missing metadata", () => {
  const normalized = normalizeSearchResponse({
    query: "policy",
    results: {
      policies: [
        {
          kind: "policy",
          id: 7,
          title: "",
          target_page: "model-policies",
          target_id: 7,
        },
        {
          kind: "policy",
          id: 8,
          title: "gpt-4o",
          target_page: "model-policies",
          target_id: 8,
        },
      ],
    },
  });

  assert.equal(normalized.total, 1);
  assert.deepEqual(normalized.groups[0].items[0], {
    group: "policies",
    kind: "policy",
    id: "8",
    title: "gpt-4o",
    subtitle: "",
    meta: "",
    status: "",
    targetPage: "model-policies",
    targetId: "8",
  });
});

test("isSearchShortcut detects Ctrl or Cmd plus K only", () => {
  assert.equal(isSearchShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), true);
  assert.equal(isSearchShortcut({ key: "K", ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }), true);
  assert.equal(isSearchShortcut({ key: "k", ctrlKey: true, metaKey: false, altKey: true, shiftKey: false }), false);
  assert.equal(isSearchShortcut({ key: "p", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }), false);
});

test("isSearchDismissKey detects Escape", () => {
  assert.equal(isSearchDismissKey({ key: "Escape" }), true);
  assert.equal(isSearchDismissKey({ key: "Esc" }), false);
});

test("getSearchResultTarget extracts route and drawer target", () => {
  assert.deepEqual(
    getSearchResultTarget({
      kind: "backend",
      id: "3",
      title: "edge-openai-1",
      targetPage: "backends",
      targetId: "3",
    }),
    {
      page: "backends",
      drawer: {
        kind: "backend",
        id: "3",
        title: "edge-openai-1",
      },
    },
  );
});

test("nextSearchSequence increments and sanitizes invalid state", () => {
  assert.equal(nextSearchSequence(0), 1);
  assert.equal(nextSearchSequence(4), 5);
  assert.equal(nextSearchSequence(-2), 1);
  assert.equal(nextSearchSequence("bad"), 1);
});

test("createSearchRequest trims query and allocates the next sequence immediately", () => {
  assert.deepEqual(createSearchRequest("  alpha  ", 7), {
    sequence: 8,
    query: "alpha",
  });
});

test("createDebouncedTask cancels the previous schedule and runs the latest args", () => {
  const scheduled = [];
  const canceled = [];
  let nextID = 0;
  const received = [];
  const debounce = createDebouncedTask(
    (...args) => {
      received.push(args);
    },
    180,
    {
      schedule(callback, wait) {
        const handle = { id: ++nextID, callback, wait };
        scheduled.push(handle);
        return handle;
      },
      cancel(handle) {
        canceled.push(handle.id);
      },
    },
  );

  debounce("first");
  debounce("second", 2);

  assert.deepEqual(scheduled.map((entry) => entry.wait), [180, 180]);
  assert.deepEqual(canceled, [1]);

  scheduled[1].callback();
  assert.deepEqual(received, [["second", 2]]);
});

test("flattenSearchResults keeps group context and stable item order", () => {
  const items = flattenSearchResults({
    groups: [
      {
        key: "backends",
        label: "Backends",
        items: [
          { title: "edge-a", targetPage: "backends", targetId: "1" },
          { title: "edge-b", targetPage: "backends", targetId: "2" },
        ],
      },
      {
        key: "events",
        label: "Events",
        items: [
          { title: "backend.failed", targetPage: "events", targetId: "9" },
        ],
      },
    ],
  });

  assert.deepEqual(items, [
    { groupKey: "backends", itemIndex: 0, title: "edge-a", targetPage: "backends", targetId: "1" },
    { groupKey: "backends", itemIndex: 1, title: "edge-b", targetPage: "backends", targetId: "2" },
    { groupKey: "events", itemIndex: 0, title: "backend.failed", targetPage: "events", targetId: "9" },
  ]);
});

test("moveSearchSelection wraps in both directions", () => {
  assert.equal(moveSearchSelection({ currentIndex: -1, delta: 1, itemCount: 3 }), 0);
  assert.equal(moveSearchSelection({ currentIndex: 2, delta: 1, itemCount: 3 }), 0);
  assert.equal(moveSearchSelection({ currentIndex: 0, delta: -1, itemCount: 3 }), 2);
  assert.equal(moveSearchSelection({ currentIndex: 1, delta: -1, itemCount: 3 }), 0);
  assert.equal(moveSearchSelection({ currentIndex: 0, delta: 1, itemCount: 0 }), -1);
});

test("createSearchKeyboardState exposes current target from active index", () => {
  const state = createSearchKeyboardState({
    results: {
      groups: [
        {
          key: "usage_logs",
          label: "Usage Logs",
          items: [
            { title: "POST /v1/chat/completions", kind: "usage_log", targetPage: "usage-logs", targetId: "req-1" },
          ],
        },
      ],
    },
    activeIndex: 0,
  });

  assert.equal(state.items.length, 1);
  assert.deepEqual(state.activeItem, {
    groupKey: "usage_logs",
    itemIndex: 0,
    title: "POST /v1/chat/completions",
    kind: "usage_log",
    targetPage: "usage-logs",
    targetId: "req-1",
  });
});

test("openSearchState marks the shell open and requests a fetch only when prior results are empty", () => {
  const searchState = {
    open: false,
    query: "gpt-5",
    loading: false,
    triggerElement: null,
    results: { total: 0, groups: [] },
  };

  const opened = openSearchState(searchState, { triggerElement: { id: "launcher" } });
  assert.equal(searchState.open, true);
  assert.deepEqual(searchState.triggerElement, { id: "launcher" });
  assert.equal(opened.shouldTriggerSearch, true);

  const reopened = openSearchState(searchState, { triggerElement: { id: "other" } });
  assert.equal(reopened.shouldTriggerSearch, true);

  searchState.results.total = 3;
  const withResults = openSearchState(searchState, { triggerElement: { id: "again" } });
  assert.equal(withResults.shouldTriggerSearch, false);
});

test("closeSearchState hides the shell and resets keyboard selection", () => {
  const triggerElement = { id: "search-launcher" };
  const searchState = {
    open: true,
    activeIndex: 4,
    triggerElement,
  };

  const result = closeSearchState(searchState);
  assert.equal(searchState.open, false);
  assert.equal(searchState.activeIndex, -1);
  assert.equal(result.previousTrigger, triggerElement);
});

test("updateSearchQueryState clears results for blank queries and flags non-empty queries for search", () => {
  const searchState = {
    query: "old",
    requestSequence: 4,
    activeSequence: 7,
    loading: true,
    activeIndex: 2,
    results: { query: "old", total: 2, groups: [{ key: "backends", items: [] }] },
  };

  const blank = updateSearchQueryState(searchState, "   ");
  assert.equal(blank.shouldTriggerSearch, false);
  assert.equal(searchState.query, "   ");
  assert.equal(searchState.requestSequence, 8);
  assert.equal(searchState.activeSequence, 8);
  assert.equal(searchState.loading, false);
  assert.equal(searchState.activeIndex, -1);
  assert.deepEqual(searchState.results, { query: "", total: 0, groups: [] });

  const nonEmpty = updateSearchQueryState(searchState, "gpt");
  assert.equal(nonEmpty.shouldTriggerSearch, true);
  assert.equal(searchState.query, "gpt");
});

test("startSearchRequestState allocates sequence and marks the shell loading", () => {
  const searchState = {
    query: "gpt-5",
    requestSequence: 3,
    activeSequence: 3,
    loading: false,
  };

  const request = startSearchRequestState(searchState);
  assert.deepEqual(request, {
    sequence: 4,
    query: "gpt-5",
  });
  assert.equal(searchState.requestSequence, 4);
  assert.equal(searchState.activeSequence, 4);
  assert.equal(searchState.loading, true);
});

test("resolveSearchResponseState applies only the active response and updates keyboard selection", () => {
  const searchState = {
    activeSequence: 9,
    activeIndex: -1,
    results: { query: "", total: 0, groups: [] },
  };

  const ignored = resolveSearchResponseState(searchState, 8, {
    query: "ignored",
    results: {},
  });
  assert.equal(ignored, false);
  assert.deepEqual(searchState.results, { query: "", total: 0, groups: [] });

  const applied = resolveSearchResponseState(searchState, 9, {
    query: "gpt",
    results: {
      backends: [{
        kind: "backend",
        id: 1,
        title: "edge-a",
        target_page: "backends",
        target_id: 1,
      }],
    },
  });
  assert.equal(applied, true);
  assert.equal(searchState.results.total, 1);
  assert.equal(searchState.activeIndex, 0);
});

test("clearSearchState resets loading selection and results while advancing sequence", () => {
  const searchState = {
    requestSequence: 5,
    activeSequence: 8,
    loading: true,
    activeIndex: 3,
    results: { query: "gpt", total: 2, groups: [{ key: "backends", items: [{}] }] },
  };

  const nextSequence = clearSearchState(searchState);
  assert.equal(nextSequence, 9);
  assert.equal(searchState.requestSequence, 9);
  assert.equal(searchState.activeSequence, 9);
  assert.equal(searchState.loading, false);
  assert.equal(searchState.activeIndex, -1);
  assert.deepEqual(searchState.results, { query: "", total: 0, groups: [] });
});
