(function initRenderersModule(globalScope) {
  function createResourceToolbarModel({ resourceKey, searchPlaceholder = "", count = 0, activeFilters = 0, hasChanges = false }) {
    return {
      resourceKey: String(resourceKey || "").trim(),
      searchPlaceholder: String(searchPlaceholder || "").trim(),
      count: Math.max(0, Number(count) || 0),
      activeFilters: Math.max(0, Number(activeFilters) || 0),
      hasChanges: Boolean(hasChanges),
      actions: ["search", "filters", "sort", "reset", "refresh"],
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
      const modelCount = numericCount(source.model_count, source.models);
      const endpointCount = numericCount(source.endpoint_count, source.endpoints);
      return [
        {
          title: "Relationships",
          items: compactItems([
            source.pool ? `Pool ${source.pool}` : "",
            source.proxy?.name ? `Proxy ${source.proxy.name}` : "",
            source.protocol ? `Protocol ${source.protocol}` : "",
          ]),
        },
        {
          title: "Capabilities",
          items: compactItems([
            modelCount > 0 ? `${modelCount} models` : "",
            endpointCount > 0 ? `${endpointCount} endpoints` : "",
          ]),
        },
        {
          title: "Usage",
          items: compactItems([
            Number.isFinite(Number(source.request_count)) ? `${Number(source.request_count)} requests` : "",
            Number.isFinite(Number(source.avg_latency_ms)) && Number(source.avg_latency_ms) > 0 ? `${Math.round(Number(source.avg_latency_ms))} ms avg latency` : "",
            source.last_used_at ? `Last used ${source.last_used_at}` : "",
            source.recent_stats ? recentStatsPreview(source.recent_stats) : "",
          ]),
        },
        {
          title: "JSON Preview",
          items: compactItems([
            source.base_url ? `"base_url":"${source.base_url}"` : "",
            objectPreview(source.model_mapping),
          ]),
        },
      ];
    }

    if (kind === "clients") {
      return [
        {
          title: "Routing",
          items: compactItems([
            source.route_mode_override ? `Route ${source.route_mode_override}` : "Route default",
            source.route_group ? `Group ${source.route_group}` : "",
          ]),
        },
        {
          title: "Usage",
          items: compactItems([
            Number.isFinite(Number(source.usage_count)) ? `${Number(source.usage_count)} requests` : "",
            source.last_used_at ? `Last used ${source.last_used_at}` : "",
          ]),
        },
        {
          title: "Client Key",
          items: compactItems([
            source.masked_token || (source.token_prefix ? `Prefix ${source.token_prefix} (历史记录仅保存 prefix)` : ""),
            source.token || "",
          ]),
        },
      ];
    }

    if (kind === "policies") {
      return [
        {
          title: "Relationships",
          items: compactItems([
            source.backend_pool ? `Pool ${source.backend_pool}` : "",
            source.endpoint ? `Endpoint ${source.endpoint}` : "",
          ]),
        },
        {
          title: "Routing",
          items: compactItems([
            source.placement_policy ? `Placement ${source.placement_policy}` : "",
            typeof source.priority !== "undefined" ? `Priority ${source.priority}` : "",
            typeof source.failover_enabled === "boolean" ? `Failover ${source.failover_enabled ? "on" : "off"}` : "",
          ]),
        },
        {
          title: "Usage",
          items: compactItems([
            Number.isFinite(Number(source.request_count)) ? `${Number(source.request_count)} requests` : "",
            Number.isFinite(Number(source.backend_count)) ? `${Number(source.backend_count)} backends` : "",
            Number.isFinite(Number(source.model_count)) ? `${Number(source.model_count)} models` : "",
            source.last_used_at ? `Last used ${source.last_used_at}` : "",
          ]),
        },
        {
          title: "JSON Preview",
          items: compactItems([
            source.pattern ? `"pattern":"${source.pattern}"` : "",
            typeof source.failover_enabled === "boolean" ? `"failover_enabled":${String(source.failover_enabled)}` : "",
          ]),
        },
      ];
    }

    if (kind === "proxies") {
      return [
        {
          title: "Relationships",
          items: compactItems([
            Number.isFinite(Number(source.bound_backend_count)) ? `${Number(source.bound_backend_count)} bound backends` : "",
            source.address ? `Address ${source.address}` : "",
          ]),
        },
        {
          title: "Usage",
          items: compactItems([
            Number.isFinite(Number(source.request_count)) ? `${Number(source.request_count)} requests` : "",
            Number.isFinite(Number(source.avg_latency_ms)) && Number(source.avg_latency_ms) > 0 ? `${Math.round(Number(source.avg_latency_ms))} ms avg latency` : "",
            source.last_used_at ? `Last used ${source.last_used_at}` : "",
          ]),
        },
        {
          title: "Access",
          items: compactItems([
            source.username ? `Auth user ${source.username}` : "Auth none",
            source.password ? "Password set" : "No password",
            source.enabled ? "Enabled" : "Disabled",
          ]),
        },
      ];
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

  function compactItems(items) {
    return items.filter((item) => String(item || "").trim());
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
