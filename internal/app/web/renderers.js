(function initRenderersModule(globalScope) {
  function createResourceToolbarModel({ resourceKey, searchPlaceholder = "", count = 0, activeFilters = 0, hasChanges = false }) {
    const normalizedResourceKey = String(resourceKey || "").trim();
    return {
      resourceKey: normalizedResourceKey,
      searchPlaceholder: String(searchPlaceholder || "").trim(),
      count: Math.max(0, Number(count) || 0),
      activeFilters: Math.max(0, Number(activeFilters) || 0),
      hasChanges: Boolean(hasChanges),
      createLabel: resourceCreateLabel(normalizedResourceKey),
      actions: ["search", "filters", "sort", "reset", "refresh", "create"],
    };
  }

  function createResourceTableModel({ columns = [], rows = [] }) {
    return {
      columns: Array.isArray(columns) ? columns.map((column) => ({
        key: String(column?.key || "").trim(),
        label: String(column?.label || "").trim(),
      })).filter((column) => column.key && column.label) : [],
      rows: Array.isArray(rows) ? rows.map((row) => ({
        id: String(row?.id ?? "").trim(),
        values: row && typeof row === "object" ? row : {},
      })).filter((row) => row.id) : [],
    };
  }

  function createQuickDetailSections(resourceKey, record) {
    const kind = String(resourceKey || "").trim();
    const source = record && typeof record === "object" ? record : {};
    if (kind === "backends") {
      return compactSections([
        detailSection("Console Access", "primary", [
          detailItem("Username", source.console_username),
          detailItem("Password", source.console_password ? "set" : ""),
          detailItem("Notes", source.notes),
        ]),
        detailSection("Routing", "success", [
          detailItem("Proxy", source.proxy?.name),
          detailItem("Base URL", source.base_url),
        ]),
        detailSection("Capabilities", "neutral", [
          detailItem("Endpoints", Array.isArray(source.endpoints) ? source.endpoints.join(", ") : ""),
          detailItem("Mapping", objectPreview(source.model_mapping)),
        ]),
        detailSection("Recent Usage", "warning", [
          detailItem("Last used", source.last_used_at),
          detailItem("1h", hourlySnapshot(source.hourly_requests, source.hourly_failures)),
          detailItem("30m", source.recent_stats ? recentStatsPreview(source.recent_stats) : ""),
        ]),
      ]);
    }

    if (kind === "clients") {
      return compactSections([
        detailSection("Usage", "success", [
          detailItem("Requests", finiteCount(source.usage_count)),
          detailItem("Last used", source.last_used_at),
        ]),
        detailSection("Client Key", "neutral", [
          detailItem("Masked", source.masked_token),
          detailItem("Visible", source.token),
          detailItem("Prefix", source.token_prefix ? `${source.token_prefix} (历史记录仅保存 prefix)` : ""),
        ]),
      ]);
    }

    if (kind === "proxies") {
      return compactSections([
        detailSection("Relationships", "primary", [
          detailItem("Bound backends", finiteCount(source.bound_backend_count)),
          detailItem("Address", source.address),
        ]),
        detailSection("Usage", "warning", [
          detailItem("Requests", finiteCount(source.request_count)),
          detailItem("Avg latency", positiveRoundedMS(source.avg_latency_ms)),
          detailItem("Last used", source.last_used_at),
        ]),
        detailSection("Access", "success", [
          detailItem("Auth", source.username || "none"),
          detailItem("Password", source.password ? "set" : "none"),
          detailItem("Status", source.enabled ? "enabled" : "disabled"),
        ]),
      ]);
    }

    return [];
  }

  function paginateResourceRows(items, pagination) {
    const rows = Array.isArray(items) ? items.slice() : [];
    const requestedSize = Number(pagination?.size);
    const size = Number.isFinite(requestedSize) && requestedSize > 0 ? Math.floor(requestedSize) : 10;
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const requestedPage = Math.max(1, Math.floor(Number(pagination?.page) || 1));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * size;

    return {
      items: rows.slice(start, start + size),
      page,
      size,
      total,
      totalPages,
    };
  }

  function arrayCount(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function numericCount(countValue, fallbackValue) {
    const count = Number(countValue);
    if (Number.isFinite(count) && count >= 0) {
      return Math.floor(count);
    }
    return arrayCount(fallbackValue);
  }

  function objectPreview(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return "";
    }
    const [firstKey] = Object.keys(value);
    if (!firstKey) {
      return "";
    }
    return `"${firstKey}":"${value[firstKey]}"`;
  }

  function recentStatsPreview(stats) {
    const successes = Number(stats?.successes);
    const failures = Number(stats?.failures);
    const hasSuccesses = Number.isFinite(successes) && successes > 0;
    const hasFailures = Number.isFinite(failures) && failures > 0;
    if (!hasSuccesses && !hasFailures) {
      return "";
    }
    return `${hasSuccesses ? successes : 0} ok / ${hasFailures ? failures : 0} fail (30m)`;
  }

  function hourlySnapshot(requestsValue, failuresValue) {
    const requests = Number(requestsValue);
    const failures = Number(failuresValue);
    const hasRequests = Number.isFinite(requests) && requests > 0;
    const hasFailures = Number.isFinite(failures) && failures > 0;
    if (!hasRequests && !hasFailures) {
      return "";
    }
    return `${hasRequests ? Math.floor(requests) : 0} req / ${hasFailures ? Math.floor(failures) : 0} fail`;
  }

  function detailSection(title, tone, items) {
    return {
      title,
      tone,
      items: compactDetailItems(items),
    };
  }

  function detailItem(label, value) {
    const normalizedLabel = String(label || "").trim();
    const normalizedValue = String(value || "").trim();
    if (!normalizedLabel || !normalizedValue) {
      return null;
    }
    return {
      label: normalizedLabel,
      value: normalizedValue,
    };
  }

  function compactDetailItems(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean);
  }

  function compactSections(sections) {
    return (Array.isArray(sections) ? sections : []).filter((section) => section && section.items.length);
  }

  function finiteCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count)) {
      return "";
    }
    return String(Math.floor(count));
  }

  function positiveRoundedMS(value) {
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration <= 0) {
      return "";
    }
    return `${Math.round(duration)} ms`;
  }

  function resourceCreateLabel(resourceKey) {
    const labels = {
      backends: "新增 Backend",
      clients: "新增 Client Key",
      proxies: "新增 Proxy",
    };
    return labels[resourceKey] || "新增";
  }

  const api = {
    createQuickDetailSections,
    createResourceTableModel,
    createResourceToolbarModel,
    paginateResourceRows,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RendererUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
