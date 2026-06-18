import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildSearchRequestPath,
  createSearchRequest,
  createDebouncedTask,
  getSearchResultTarget,
  isSearchDismissKey,
  isSearchShortcut,
  nextSearchSequence,
  normalizeSearchResponse,
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
