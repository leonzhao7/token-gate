(function initObservabilityModule(globalScope) {
  const EVENT_CATEGORIES = [
    { key: "system", label: "System", tone: "neutral" },
    { key: "backend", label: "Backend", tone: "success" },
    { key: "proxy", label: "Proxy", tone: "neutral" },
    { key: "client_key", label: "Client Key", tone: "primary" },
    { key: "security", label: "Security", tone: "danger" },
  ];

  const EVENT_SEVERITIES = [
    { key: "error", label: "Errors", tone: "danger" },
    { key: "warning", label: "Warnings", tone: "warning" },
    { key: "info", label: "Info", tone: "primary" },
  ];
  const USAGE_LOG_STATUS_FAMILIES = new Set(["2xx", "3xx", "4xx", "5xx"]);

  function buildUsageLogQueryParams(filters) {
    const params = new URLSearchParams();
    const normalized = plainObject(filters);
    appendParam(params, "q", normalized.q);
    appendDateParam(params, "date_from", normalized.dateFrom);
    appendDateParam(params, "date_to", normalized.dateTo, true);
    appendParam(params, "backend", normalized.backend);
    appendParam(params, "model", normalized.model);
    appendParam(params, "client_key", normalized.clientKey);
    appendParam(params, "proxy", normalized.proxy);
    appendParam(params, "status", normalizeUsageLogStatus(normalized.status));
    return params.toString();
  }

  function buildEventQueryParams(filters) {
    const params = new URLSearchParams();
    const normalized = plainObject(filters);
    appendParam(params, "q", normalized.q);
    appendParam(params, "actor", normalized.actor);
    appendParam(params, "backend", normalized.backend);
    appendParam(params, "category", normalized.category);
    appendParam(params, "severity", normalized.severity);
    appendDateParam(params, "date_from", normalized.dateFrom);
    appendDateParam(params, "date_to", normalized.dateTo, true);
    return params.toString();
  }

  function createUsageStatsCards(payload) {
    const totals = plainObject(payload?.totals);
    const latency = plainObject(payload?.latency);
    const requests = numberValue(totals.requests);
    const successes = numberValue(totals.successes);
    const failures = numberValue(totals.failures);
    const successRate = requests > 0 ? (successes / requests) * 100 : 0;
    const families = Array.isArray(payload?.status_families) ? payload.status_families : [];
    const firstFamily = families[0];
    const remainingFamilies = families.slice(1);

    return [
      {
        key: "requests",
        label: "Requests",
        value: formatInteger(requests),
        detail: `${formatInteger(successes)} success / ${formatInteger(failures)} failed`,
        tone: "primary",
      },
      {
        key: "success_rate",
        label: "Success Rate",
        value: `${successRate.toFixed(1)}%`,
        detail: `${formatInteger(failures)} failures`,
        tone: failures > 0 ? "success" : "success",
      },
      {
        key: "avg_latency",
        label: "Avg Latency",
        value: `${formatInteger(Math.round(numberValue(latency.avg_ms)))} ms`,
        detail: `p95 ${formatInteger(Math.round(numberValue(latency.p95_ms)))} ms`,
        tone: "neutral",
      },
      {
        key: "status_mix",
        label: "Status Mix",
        value: firstFamily ? `${firstFamily.family} ${formatInteger(firstFamily.count)}` : "-",
        detail: remainingFamilies.length ? remainingFamilies.map((item) => `${item.family} ${formatInteger(item.count)}`).join(" · ") : "No secondary status",
        tone: families.some((item) => String(item.family || "").startsWith("4") || String(item.family || "").startsWith("5")) ? "warning" : "neutral",
      },
    ];
  }

  function createUsageLogRows(logs) {
    return Array.isArray(logs) ? logs.map((log) => ({
      id: String(log?.id ?? "").trim(),
      requestId: stringValue(log?.request_id),
      timestamp: stringValue(log?.created_at),
      method: stringValue(log?.method || "POST"),
      path: stringValue(log?.path || "-"),
      status: String(log?.status_code ?? "").trim() || "-",
      tone: statusTone(log?.status_code),
      latency: `${formatInteger(log?.duration_ms)} ms`,
      clientKey: stringValue(log?.client_name || "-"),
      client: stringValue(log?.client_ip || "-"),
      backend: stringValue(log?.backend_name || "-"),
      proxy: stringValue(log?.proxy_name || "-"),
      model: stringValue(log?.model || "-"),
      traceId: stringValue(log?.trace_id || "-"),
      requestMetadata: [stringValue(log?.method || "POST"), requestPath(log)].filter(Boolean).join(" "),
      headersPreview: stringValue(log?.request_headers_json || "-"),
      payloadPreview: stringValue(log?.request_body_preview || "-"),
      responsePreview: stringValue(log?.response_body_preview || "-"),
      statusFamily: stringValue(log?.status_family || "-"),
    })).filter((row) => row.id) : [];
  }

  function createUsageLogDetailPreview(detail, row) {
    const request = detail?.request && typeof detail.request === "object" ? detail.request : {};
    const response = detail?.response && typeof detail.response === "object" ? detail.response : {};
    return [
      { key: "trace", label: "Trace ID", value: stringValue(row?.traceId || detail?.trace_id || "-") },
      { key: "request", label: "Request", value: formatUsageLogRequestLine(request, row || {}) || "-" },
      { key: "headers", label: "Headers", value: stringValue(request.headers || row?.headersPreview || "-") },
      { key: "payload", label: "Payload", value: stringValue(request.body_preview || row?.payloadPreview || "-") },
      { key: "response", label: "Response", value: stringValue(response.body_preview || row?.responsePreview || "-") },
    ];
  }

  function createEventSummaryModel(payload) {
    const categoryCounts = mapCounts(payload?.categories, "category");
    const severityCounts = mapCounts(payload?.severities, "severity");
    return {
      total: numberValue(payload?.total),
      categories: EVENT_CATEGORIES.map((item) => ({
        ...item,
        count: categoryCounts.get(item.key) || 0,
      })),
      severities: EVENT_SEVERITIES.map((item) => ({
        ...item,
        count: severityCountFor(severityCounts, item.key),
      })),
    };
  }

  function createEventTimelineItems(events) {
    return Array.isArray(events) ? events.map((event) => {
      const category = stringValue(event?.category || "system");
      const severity = normalizeEventSeverity(event?.severity || event?.level || "info");
      return {
        id: String(event?.id ?? "").trim(),
        icon: eventIcon(category),
        title: stringValue(event?.type || "event"),
        description: stringValue(event?.message || "-"),
        actor: stringValue(event?.actor || "system"),
        timestamp: stringValue(event?.created_at),
        category,
        severity,
        tone: eventTone(severity, category),
        meta: [event?.backend_name, event?.client_name, event?.model].filter(Boolean).join(" · ") || "-",
      };
    }).filter((item) => item.id) : [];
  }

  function statusTone(statusCode) {
    const code = Number(statusCode);
    if (code >= 200 && code < 300) {
      return "success";
    }
    if (code >= 300 && code < 400) {
      return "primary";
    }
    if (code >= 400 && code < 500) {
      return "warning";
    }
    if (code >= 500) {
      return "danger";
    }
    return "neutral";
  }

  function toAPIDateTime(value, endOfDay = false) {
    const input = stringValue(value);
    if (!input) {
      return "";
    }
    const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
    const date = new Date(`${input}${suffix}`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function normalizeUsageLogStatus(value) {
    const normalized = stringValue(value).toLowerCase();
    return USAGE_LOG_STATUS_FAMILIES.has(normalized) ? normalized : "";
  }

  function formatUsageLogRequestLine(request, fallback = {}) {
    const method = stringValue(request?.method || fallback?.method);
    const path = requestPath({
      path: request?.path || fallback?.path,
      query: request?.query || fallback?.query,
    });
    return [method, path].filter(Boolean).join(" ").trim();
  }

  function eventTone(severity, category) {
    const normalized = normalizeEventSeverity(severity);
    if (normalized === "error") {
      return "danger";
    }
    if (normalized === "warning") {
      return "warning";
    }
    if (category === "backend") {
      return "success";
    }
    if (category === "security") {
      return "danger";
    }
    return "primary";
  }

  function eventIcon(category) {
    const normalized = stringValue(category || "system");
    const icons = {
      system: "system",
      backend: "backend",
      proxy: "proxy",
      client_key: "client-key",
      security: "security",
    };
    return icons[normalized] || "system";
  }

  function mapCounts(items, keyName) {
    const counts = new Map();
    if (!Array.isArray(items)) {
      return counts;
    }
    items.forEach((item) => {
      const key = stringValue(item?.[keyName]);
      if (key) {
        counts.set(key, numberValue(item?.count));
      }
    });
    return counts;
  }

  function requestPath(log) {
    const path = stringValue(log?.path || "-");
    const query = stringValue(log?.query);
    if (!query || query === "-") {
      return path;
    }
    return `${path}?${query}`;
  }

  function severityCountFor(counts, key) {
    if (key === "warning") {
      return numberValue(counts.get("warning")) + numberValue(counts.get("warn"));
    }
    return numberValue(counts.get(key));
  }

  function normalizeEventSeverity(value) {
    const normalized = stringValue(value).toLowerCase();
    if (normalized === "warn") {
      return "warning";
    }
    return normalized;
  }

  function appendParam(params, key, value) {
    const normalized = stringValue(value);
    if (normalized) {
      params.set(key, normalized);
    }
  }

  function appendDateParam(params, key, value, endOfDay = false) {
    const normalized = toAPIDateTime(value, endOfDay);
    if (normalized) {
      params.set(key, normalized);
    }
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function stringValue(value) {
    return String(value || "").trim();
  }

  function numberValue(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  function formatInteger(value) {
    return String(Math.round(numberValue(value)));
  }

  const api = {
    buildEventQueryParams,
    buildUsageLogQueryParams,
    createEventSummaryModel,
    createUsageLogDetailPreview,
    createEventTimelineItems,
    createUsageLogRows,
    createUsageStatsCards,
    formatUsageLogRequestLine,
    normalizeUsageLogStatus,
    statusTone,
    toAPIDateTime,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ObservabilityUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
