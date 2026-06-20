import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PaginationUtils = require("./pagination.js");

test("currentLocalPageData paginates local items and normalizes state", () => {
  const state = {
    pagination: {
      proxies: { page: 9, size: 7 },
    },
  };

  const pageData = PaginationUtils.currentLocalPageData("proxies", [1, 2, 3], state, {
    pageSizeOptions: [2, 4],
    resourceStateUtils: {
      currentLocalPageData(key, items, inputState, options) {
        assert.equal(key, "proxies");
        assert.deepEqual(items, [1, 2, 3]);
        assert.equal(inputState, state);
        assert.deepEqual(options, { pageSizeOptions: [2, 4] });
        return {
          items: [3],
          page: 2,
          size: 2,
          total: 3,
          totalPages: 2,
        };
      },
    },
  });

  assert.deepEqual(pageData, {
    items: [3],
    page: 2,
    size: 2,
    total: 3,
    totalPages: 2,
  });
});

test("applyPagedResponse updates remote pagination meta and resource items", () => {
  const state = {
    usageLogs: [],
    pagination: {
      usageLogs: { page: 1, size: 10 },
    },
    paginationMeta: {
      usageLogs: { total: 0, page: 1, limit: 10 },
    },
  };

  PaginationUtils.applyPagedResponse("usageLogs", {
    items: [{ id: "log-1" }],
    total: 42,
    page: 3,
    limit: 20,
  }, state, {
    pageSizeOptions: [10, 20, 50],
    resourceStateUtils: {
      applyPagedResponse(key, payload, inputState, options) {
        assert.equal(key, "usageLogs");
        assert.deepEqual(payload, {
          items: [{ id: "log-1" }],
          total: 42,
          page: 3,
          limit: 20,
        });
        assert.equal(inputState, state);
        assert.deepEqual(options, { pageSizeOptions: [10, 20, 50] });
        inputState.usageLogs = payload.items;
        inputState.pagination.usageLogs = { page: 3, size: 20 };
        inputState.paginationMeta.usageLogs = { total: 42, page: 3, limit: 20 };
      },
    },
  });

  assert.deepEqual(state.usageLogs, [{ id: "log-1" }]);
  assert.deepEqual(state.pagination.usageLogs, { page: 3, size: 20 });
  assert.deepEqual(state.paginationMeta.usageLogs, { total: 42, page: 3, limit: 20 });
});

test("renderPagination renders controls using supplied page numbers", () => {
  const markup = PaginationUtils.renderPagination("events", {
    page: 3,
    size: 20,
    total: 75,
    totalPages: 4,
  }, {
    pageSizeOptions: [10, 20, 50],
    paginationPageNumbers() {
      return [1, 2, 3, 4];
    },
  });

  assert.match(markup, /data-pagination="events"/);
  assert.match(markup, /共 75 条/);
  assert.match(markup, /data-page-size="events"/);
  assert.match(markup, /option value="20" selected/);
  assert.match(markup, /data-page-number="events" data-page-value="3"/);
  assert.match(markup, /pagination-number active/);
});

test("renderPagination returns empty markup when there is no total", () => {
  assert.equal(PaginationUtils.renderPagination("events", {
    page: 1,
    size: 10,
    total: 0,
    totalPages: 1,
  }, {
    pageSizeOptions: [10, 20, 50],
    paginationPageNumbers() {
      return [1];
    },
  }), "");
});

test("currentRemotePageData composes remote pagination from state metadata", () => {
  const state = {
    pagination: {
      usageLogs: { page: 1, size: 10 },
    },
    paginationMeta: {
      usageLogs: { total: 22, page: 2, limit: 10 },
    },
  };

  const result = PaginationUtils.currentRemotePageData("usageLogs", [{ id: "log-1" }], state, {
    pageSizeOptions: [10, 20, 50],
    resourceStateUtils: {
      currentRemotePageData(key, items, inputState, options) {
        assert.equal(key, "usageLogs");
        assert.deepEqual(items, [{ id: "log-1" }]);
        assert.equal(inputState, state);
        assert.deepEqual(options, { pageSizeOptions: [10, 20, 50] });
        return { items: [{ id: "log-1" }], page: 2, size: 10, total: 22, totalPages: 3 };
      },
    },
  });

  assert.deepEqual(result, { items: [{ id: "log-1" }], page: 2, size: 10, total: 22, totalPages: 3 });
});

test("bindPagination wires page size and navigation handlers to rerender", async () => {
  const events = [];
  const state = {
    pagination: {
      events: { page: 2, size: 10 },
    },
  };
  let rerenderCalls = 0;

  const container = createPaginationContainer(events);
  PaginationUtils.bindPagination(container, "events", () => {
    rerenderCalls += 1;
  }, state);

  await eventsBySelector(events, '[data-page-size="events"]')[0]({
    currentTarget: { value: "20" },
  });
  assert.deepEqual(state.pagination.events, { page: 1, size: 20 });

  await eventsBySelector(events, '[data-page-prev="events"]')[0]();
  assert.equal(state.pagination.events.page, 1);

  state.pagination.events.page = 1;
  await eventsBySelector(events, '[data-page-next="events"]')[0]();
  assert.equal(state.pagination.events.page, 2);

  await eventsBySelector(events, '[data-page-number="events"]')[0]();
  assert.equal(state.pagination.events.page, 5);
  assert.equal(rerenderCalls, 4);
});

function createPaginationContainer(events) {
  return {
    querySelector(selector) {
      return {
        addEventListener(_type, listener) {
          events.push({ selector, listener });
        },
      };
    },
    querySelectorAll(selector) {
      if (selector !== '[data-page-number="events"]') {
        return [];
      }
      return [{
        dataset: { pageValue: "5" },
        addEventListener(_type, listener) {
          events.push({ selector, listener });
        },
      }];
    },
  };
}

function eventsBySelector(events, selector) {
  return events.filter((entry) => entry.selector === selector).map((entry) => entry.listener);
}
