import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ObservabilityRuntimeUtils = require("./observability-runtime.js");
const ObservabilityUtils = require("./observability.js");
const ObservabilityViewUtils = require("./observability-view.js");
const PaginationUtils = require("./pagination.js");
const ResourceStateUtils = require("./resource-state.js");
const DisplayUtils = require("./display-utils.js");

test("observability runtime builds event and usage log queries with real observability helpers", () => {
  const usageLogQuery = ObservabilityRuntimeUtils.buildUsageLogQuery({
    state: {
      usageLogFilters: {
        q: "gpt-4",
        dateFrom: "2026-06-18",
        dateTo: "2026-06-19",
        backend: "edge-a",
        model: "gpt-4.1",
        clientKey: "client-a",
        proxy: "tokyo",
        status: "5xx",
      },
    },
    observabilityUtils: ObservabilityUtils,
  });
  const usageStatsQuery = ObservabilityRuntimeUtils.buildUsageLogStatsQuery({
    state: {
      usageLogFilters: {
        q: "gpt-4",
        status: "5xx",
      },
    },
    observabilityUtils: ObservabilityUtils,
  });
  const eventQuery = ObservabilityRuntimeUtils.buildEventQuery({
    state: {
      eventFilters: {
        q: "failover",
        actor: "system",
        backend: "edge-a",
        category: "backend",
        severity: "warn",
        dateFrom: "2026-06-18",
        dateTo: "2026-06-19",
      },
    },
    observabilityUtils: ObservabilityUtils,
  });

  assert.match(usageLogQuery, /^&q=gpt-4/);
  assert.match(usageLogQuery, /backend=edge-a/);
  assert.match(usageLogQuery, /status=5xx/);
  assert.equal(usageStatsQuery, "q=gpt-4&status=5xx");
  assert.match(eventQuery, /^&q=failover/);
  assert.match(eventQuery, /severity=warn/);
  assert.equal(
    ObservabilityRuntimeUtils.buildEventSummaryQuery({
      state: {
        eventFilters: {
          q: "failover",
        },
      },
      observabilityUtils: ObservabilityUtils,
    }),
    "q=failover",
  );
});

test("observability runtime applies and resets filters through state and refresh callback", async () => {
  const state = {
    eventFilters: {
      q: "",
      actor: "",
      backend: "",
      category: "",
      severity: "",
      dateFrom: "",
      dateTo: "",
    },
    usageLogFilters: {
      q: "",
      dateFrom: "",
      dateTo: "",
      backend: "",
      model: "",
      clientKey: "",
      proxy: "",
      status: "",
    },
    pagination: {
      events: { page: 4 },
      usageLogs: { page: 3 },
    },
  };
  const inputs = {
    eventQueryFilter: { value: " failover " },
    eventActorFilter: { value: " system " },
    eventBackendFilter: { value: " edge-a " },
    eventCategoryFilter: { value: " backend " },
    eventSeverityFilter: { value: " warning " },
    eventDateFromFilter: { value: "2026-06-18" },
    eventDateToFilter: { value: "2026-06-19" },
    usageLogQueryFilter: { value: " chat " },
    usageLogDateFromFilter: { value: "2026-06-18" },
    usageLogDateToFilter: { value: "2026-06-19" },
    usageLogBackendFilter: { value: " edge-a " },
    usageLogModelFilter: { value: " gpt-4.1 " },
    usageLogClientKeyFilter: { value: " client-a " },
    usageLogProxyFilter: { value: " tokyo " },
    usageLogStatusFilter: { value: " 5xx " },
  };
  let refreshCalls = 0;

  await ObservabilityRuntimeUtils.applyEventFilters({
    state,
    refreshAll: async () => {
      refreshCalls += 1;
    },
    ...inputs,
  });
  await ObservabilityRuntimeUtils.applyUsageLogFilters({
    state,
    refreshAll: async () => {
      refreshCalls += 1;
    },
    ...inputs,
  });

  assert.deepEqual(state.eventFilters, {
    q: "failover",
    actor: "system",
    backend: "edge-a",
    category: "backend",
    severity: "warning",
    dateFrom: "2026-06-18",
    dateTo: "2026-06-19",
  });
  assert.deepEqual(state.usageLogFilters, {
    q: "chat",
    dateFrom: "2026-06-18",
    dateTo: "2026-06-19",
    backend: "edge-a",
    model: "gpt-4.1",
    clientKey: "client-a",
    proxy: "tokyo",
    status: "5xx",
  });
  assert.equal(state.pagination.events.page, 1);
  assert.equal(state.pagination.usageLogs.page, 1);
  assert.equal(refreshCalls, 2);

  await ObservabilityRuntimeUtils.resetEventFilters({
    state,
    refreshAll: async () => {
      refreshCalls += 1;
    },
    ...inputs,
  });
  await ObservabilityRuntimeUtils.resetUsageLogFilters({
    state,
    refreshAll: async () => {
      refreshCalls += 1;
    },
    ...inputs,
  });

  assert.deepEqual(state.eventFilters, {
    q: "",
    actor: "",
    backend: "",
    category: "",
    severity: "",
    dateFrom: "",
    dateTo: "",
  });
  assert.deepEqual(state.usageLogFilters, {
    q: "",
    dateFrom: "",
    dateTo: "",
    backend: "",
    model: "",
    clientKey: "",
    proxy: "",
    status: "",
  });
  assert.equal(inputs.eventQueryFilter.value, "");
  assert.equal(inputs.usageLogBackendFilter.value, "");
  assert.equal(refreshCalls, 4);
});

test("observability runtime renders event and usage log pages with real view helpers", () => {
  const eventList = createContainer();
  const usageLogList = createContainer();
  const deleteUsageLogsBtn = { disabled: false };
  const state = {
    events: [
      {
        id: "evt-1",
        type: "backend.failover",
        message: "edge-a switched",
        actor: "system",
        created_at: "2026-06-19T10:00:00Z",
        category: "backend",
        severity: "warning",
        backend_name: "edge-a",
      },
    ],
    usageLogs: [
      {
        id: "log-1",
        request_id: "req-1",
        created_at: "2026-06-19T10:00:00Z",
        method: "POST",
        path: "/v1/chat/completions",
        status_code: 200,
        duration_ms: 120,
        client_name: "client-a",
        client_ip: "127.0.0.1",
        backend_name: "edge-a",
        proxy_name: "tokyo",
        model: "gpt-4.1",
        trace_id: "trace-1",
        request_headers_json: "{\"x\":1}",
        request_body_preview: "{\"m\":1}",
        response_body_preview: "{\"ok\":true}",
        status_family: "2xx",
      },
    ],
    eventSummary: {
      total: 1,
      categories: [{ category: "backend", count: 1 }],
      severities: [{ severity: "warning", count: 1 }],
    },
    usageLogStats: {
      totals: { requests: 1, successes: 1, failures: 0 },
      latency: { avg_ms: 120, p95_ms: 120 },
      status_families: [{ family: "2xx", count: 1 }],
    },
    usageLogOptions: {
      backends: ["edge-a"],
      models: ["gpt-4.1"],
      clientKeys: ["client-a"],
      proxies: ["tokyo"],
    },
    usageLogFilters: {
      q: "",
      dateFrom: "",
      dateTo: "",
      backend: "edge-a",
      model: "",
      clientKey: "",
      proxy: "",
      status: "",
    },
    eventFilters: {
      q: "failover",
      actor: "",
      backend: "",
      category: "",
      severity: "",
      dateFrom: "",
      dateTo: "",
    },
    usageLogDetailCache: new Map([
      ["log-1", { trace_id: "trace-1", request: { method: "POST", path: "/v1/chat/completions" }, response: { body_preview: "{\"ok\":true}" } }],
    ]),
    expandedUsageLogs: new Set(["log-1"]),
    pagination: {
      events: { page: 1, size: 10, total: 1 },
      usageLogs: { page: 1, size: 10, total: 1 },
    },
  };
  const inputs = {
    eventQueryFilter: { value: "" },
    eventActorFilter: { value: "" },
    eventBackendFilter: { value: "" },
    eventCategoryFilter: { value: "" },
    eventSeverityFilter: { value: "" },
    eventDateFromFilter: { value: "" },
    eventDateToFilter: { value: "" },
    usageLogQueryFilter: { value: "" },
    usageLogDateFromFilter: { value: "" },
    usageLogDateToFilter: { value: "" },
    usageLogBackendFilter: { value: "" },
    usageLogModelFilter: { value: "" },
    usageLogClientKeyFilter: { value: "" },
    usageLogProxyFilter: { value: "" },
    usageLogStatusFilter: { value: "" },
  };

  ObservabilityRuntimeUtils.renderEvents({
    state,
    eventList,
    observabilityUtils: ObservabilityUtils,
    observabilityViewUtils: ObservabilityViewUtils,
    paginationUtils: PaginationUtils,
    resourceStateUtils: ResourceStateUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: [10, 20, 50],
    refreshAll() {},
    reportError(error) {
      throw error;
    },
    feedToneClass,
    openResourceDrawer() {
      return Promise.resolve();
    },
    ...inputs,
  });
  ObservabilityRuntimeUtils.renderUsageLogs({
    state,
    usageLogList,
    deleteUsageLogsBtn,
    observabilityUtils: ObservabilityUtils,
    observabilityViewUtils: ObservabilityViewUtils,
    paginationUtils: PaginationUtils,
    resourceStateUtils: ResourceStateUtils,
    displayUtils: DisplayUtils,
    pageSizeOptions: [10, 20, 50],
    refreshAll() {},
    reportError(error) {
      throw error;
    },
    openResourceDrawer() {
      return Promise.resolve();
    },
    renderUsageLogInlineDetail(row) {
      return ObservabilityRuntimeUtils.renderUsageLogInlineDetail({
        row,
        state,
        observabilityUtils: ObservabilityUtils,
        observabilityViewUtils: ObservabilityViewUtils,
        displayUtils: DisplayUtils,
        primeUsageLogDetail() {
          return Promise.resolve();
        },
      });
    },
    toggleExpanded(set, id) {
      if (set.has(String(id))) {
        set.delete(String(id));
        return;
      }
      set.add(String(id));
    },
    ...inputs,
  });
  ObservabilityRuntimeUtils.renderUsageLogFilterOptions({
    state,
    displayUtils: DisplayUtils,
    usageLogBackendOptions: { innerHTML: "" },
    usageLogModelOptions: { innerHTML: "" },
    usageLogClientKeyOptions: { innerHTML: "" },
    usageLogProxyOptions: { innerHTML: "" },
  });

  assert.match(eventList.innerHTML, /backend\.failover/);
  assert.match(eventList.innerHTML, /Event Summary/);
  assert.match(usageLogList.innerHTML, /Requests/);
  assert.match(usageLogList.innerHTML, /trace-1/);
  assert.equal(deleteUsageLogsBtn.disabled, false);
  assert.equal(inputs.eventQueryFilter.value, "failover");
  assert.equal(inputs.usageLogBackendFilter.value, "edge-a");
});

test("observability runtime primes and deletes usage log details with real query helpers", async () => {
  const state = {
    usageLogFilters: {
      q: "edge",
      dateFrom: "",
      dateTo: "",
      backend: "",
      model: "",
      clientKey: "",
      proxy: "",
      status: "",
    },
    usageLogDetailCache: new Map(),
    expandedUsageLogs: new Set(["log-1"]),
    pagination: {
      usageLogs: { page: 3 },
    },
  };
  const apiCalls = [];
  let refreshed = 0;
  const alerts = [];

  await ObservabilityRuntimeUtils.primeUsageLogDetail({
    id: "log-1",
    state,
    api(path) {
      apiCalls.push([path, "GET"]);
      return Promise.resolve({ request: { method: "POST", path: "/v1/chat/completions" } });
    },
    renderUsageLogs() {
      refreshed += 1;
    },
  });

  assert.deepEqual(state.usageLogDetailCache.get("log-1"), {
    request: { method: "POST", path: "/v1/chat/completions" },
  });
  assert.equal(refreshed, 1);

  await ObservabilityRuntimeUtils.deleteFilteredUsageLogs({
    state,
    observabilityUtils: ObservabilityUtils,
    confirm() {
      return true;
    },
    alert(message) {
      alerts.push(message);
    },
    api(path, method) {
      apiCalls.push([path, method]);
      return Promise.resolve({ deleted: 2 });
    },
    refreshAll: async () => {
      refreshed += 1;
    },
  });

  assert.deepEqual(apiCalls[1], ["/admin/api/usage-logs?q=edge", "DELETE"]);
  assert.equal(state.pagination.usageLogs.page, 1);
  assert.equal(refreshed, 2);
  assert.deepEqual(alerts, ["已删除 2 条符合条件的使用日志。"]);
});

function createContainer() {
  return {
    innerHTML: "",
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      const match = selector.match(/^\[data-([a-z-]+)\]$/);
      if (!match) {
        return [];
      }
      const matches = [];
      const attrName = match[1];
      const regex = new RegExp(`data-${attrName}="([^"]*)"`, "g");
      let found = regex.exec(this.innerHTML);
      while (found) {
        matches.push(createInteractiveStub(found[1] || ""));
        found = regex.exec(this.innerHTML);
      }
      return matches;
    },
  };
}

function createInteractiveStub(id) {
  return {
    dataset: {
      eventRow: id,
      eventTitle: "Event",
      usageLogRow: id,
      usageLogTitle: "Usage Log",
      toggleUsageLog: id,
    },
    addEventListener() {},
  };
}

function feedToneClass(tone) {
  if (tone === "danger") {
    return "off";
  }
  if (tone === "warning") {
    return "";
  }
  return "ok";
}
