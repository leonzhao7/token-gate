(function initDrawerModule(globalScope) {
  const RESOURCE_DEFINITIONS = {
    backends: {
      title: "Backend",
      detailPath: (id) => `/admin/api/backends/${id}/detail`,
      deletePath: (id) => `/admin/api/backends/${id}`,
      page: "backends",
    },
    clients: {
      title: "Client Key",
      detailPath: (id) => `/admin/api/client-keys/${id}/detail`,
      deletePath: (id) => `/admin/api/client-keys/${id}`,
      page: "client-keys",
    },
    policies: {
      title: "Policy",
      detailPath: (id) => `/admin/api/model-policies/${id}/detail`,
      deletePath: (id) => `/admin/api/model-policies/${id}`,
      page: "model-policies",
    },
    proxies: {
      title: "Proxy",
      detailPath: (id) => `/admin/api/socks-proxies/${id}/detail`,
      deletePath: (id) => `/admin/api/socks-proxies/${id}`,
      page: "socks-proxies",
    },
    events: {
      title: "Event",
      detailPath: (id) => `/admin/api/events/${id}`,
      deletePath: () => "",
      page: "events",
    },
    usage_logs: {
      title: "Usage Log",
      detailPath: (id) => `/admin/api/usage-logs/${id}`,
      deletePath: () => "",
      page: "usage-logs",
    },
  };

  const RESOURCE_ALIASES = {
    backend: "backends",
    backends: "backends",
    client: "clients",
    clients: "clients",
    client_key: "clients",
    "client-key": "clients",
    "client-keys": "clients",
    policy: "policies",
    policies: "policies",
    model_policy: "policies",
    "model-policy": "policies",
    "model-policies": "policies",
    proxy: "proxies",
    proxies: "proxies",
    socks_proxy: "proxies",
    "socks-proxy": "proxies",
    "socks-proxies": "proxies",
    event: "events",
    events: "events",
    usage_log: "usage_logs",
    usage_logs: "usage_logs",
    "usage-log": "usage_logs",
    "usage-logs": "usage_logs",
  };

  const DRAWER_TABS = [
    { key: "overview", label: "Overview" },
    { key: "configuration", label: "Configuration" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
    { key: "activity", label: "Activity" },
  ];

  const USAGE_LOG_TABS = [
    { key: "overview", label: "Overview" },
    { key: "request", label: "Request" },
    { key: "response", label: "Response" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
  ];

  const DRAWER_FOOTER_ACTIONS = [
    { key: "edit", label: "Edit", tone: "ghost", disabled: false },
    { key: "delete", label: "Delete", tone: "danger", disabled: false },
    { key: "save", label: "Save", tone: "primary", disabled: true },
  ];

  function normalizeResourceKind(kind) {
    const normalized = String(kind || "").trim().toLowerCase().replace(/\s+/g, "_");
    return RESOURCE_ALIASES[normalized] || "";
  }

  function buildDrawerTarget({ kind, page, id, title = "" }) {
    const resourceKey = normalizeResourceKind(kind) || normalizeResourceKind(page);
    const definition = RESOURCE_DEFINITIONS[resourceKey];
    const normalizedID = String(id || "").trim();
    if (!definition || !normalizedID) {
      return null;
    }
    return {
      kind: resourceKey,
      id: normalizedID,
      title: String(title || definition.title).trim() || definition.title,
      detailPath: definition.detailPath(normalizedID),
      deletePath: definition.deletePath(normalizedID),
      page: definition.page,
    };
  }

  function drawerDisplayTitle(resourceKey) {
    const normalized = normalizeResourceKind(resourceKey);
    return RESOURCE_DEFINITIONS[normalized]?.title || "Resource";
  }

  function drawerTabsForResource(resourceKey) {
    const normalized = normalizeResourceKind(resourceKey);
    if (normalized === "usage_logs") {
      return USAGE_LOG_TABS.slice();
    }
    return normalized ? DRAWER_TABS.slice() : [];
  }

  function normalizeDrawerPayload(payload) {
    const normalized = payload && typeof payload === "object" ? payload : {};
    return {
      overview: plainObject(normalized.overview),
      configuration: plainObject(normalized.configuration),
      metadata: plainObject(normalized.metadata),
      raw: normalized.raw ?? {},
      request: plainObject(normalized.request),
      response: plainObject(normalized.response),
      activity: plainObject(normalized.activity),
    };
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function drawerFooterActions() {
    return DRAWER_FOOTER_ACTIONS.map((action) => ({ ...action }));
  }

  function buildDrawerActivitySections(activity) {
    const normalized = plainObject(activity);
    return [
      buildActivitySection("events", "Events", ensureArray(normalized.events), normalizeEventActivityItem),
      buildActivitySection("usage", "Usage", ensureArray(normalized.usage), normalizeUsageActivityItem),
      buildActivitySection("backends", "Backends", ensureArray(normalized.backends), normalizeBackendActivityItem),
    ].filter(Boolean);
  }

  function buildActivitySection(key, title, values, formatter) {
    const items = values
      .map((value) => formatter(value))
      .filter(Boolean);
    if (!items.length) {
      return null;
    }
    return {
      key,
      title,
      count: items.length,
      items,
    };
  }

  function normalizeEventActivityItem(event) {
    const message = stringValue(event?.message);
    const type = stringValue(event?.type);
    const severity = stringValue(event?.severity || event?.level).toLowerCase();
    const category = stringValue(event?.category).toLowerCase();
    return {
      title: message || type || "Event",
      summary: type || "-",
      tone: toneFromSeverity(severity),
      chips: compactStrings([severity, category]),
      meta: compactMeta([
        { label: "Actor", value: stringValue(event?.actor) },
        { label: "Time", value: stringValue(event?.created_at), format: "datetime" },
      ]),
    };
  }

  function normalizeUsageActivityItem(entry) {
    const requestID = stringValue(entry?.request_id || entry?.requestId);
    const model = stringValue(entry?.model);
    const method = stringValue(entry?.method).toUpperCase();
    const path = stringValue(entry?.path);
    const statusCode = Number(entry?.status_code);
    const endpoint = stringValue(entry?.endpoint);
    const durationMS = Number(entry?.duration_ms);
    return {
      title: requestID || model || "Usage request",
      summary: model || "-",
      tone: toneFromStatus(statusCode),
      chips: compactStrings([
        Number.isFinite(statusCode) && statusCode > 0 ? String(statusCode) : "",
        endpoint,
      ]),
      meta: compactMeta([
        { label: "Route", value: method && path ? `${method} ${path}` : "" },
        { label: "Backend", value: stringValue(entry?.backend_name || entry?.backendName) },
        { label: "Client", value: stringValue(entry?.client_name || entry?.clientName) },
        { label: "Latency", value: Number.isFinite(durationMS) && durationMS > 0 ? `${durationMS} ms` : "" },
        { label: "Time", value: stringValue(entry?.created_at), format: "datetime" },
      ]),
    };
  }

  function normalizeBackendActivityItem(backend) {
    const name = stringValue(backend?.name);
    const baseURL = stringValue(backend?.base_url || backend?.baseURL);
    const pool = stringValue(backend?.pool);
    const protocol = stringValue(backend?.protocol);
    const enabled = typeof backend?.enabled === "boolean" ? backend.enabled : null;
    const proxyName = stringValue(backend?.socks_proxy?.name || backend?.proxy?.name || backend?.proxy_name || backend?.proxyName);
    const models = ensureArray(backend?.models);
    const endpoints = ensureArray(backend?.endpoints);
    return {
      title: name || baseURL || "Backend",
      summary: baseURL || "-",
      tone: enabled === true ? "success" : enabled === false ? "danger" : "neutral",
      chips: compactStrings([
        pool,
        protocol,
        enabled === true ? "enabled" : enabled === false ? "disabled" : "",
      ]),
      meta: compactMeta([
        { label: "Proxy", value: proxyName },
        { label: "Models", value: models.length ? String(models.length) : "" },
        { label: "Endpoints", value: endpoints.length ? String(endpoints.length) : "" },
      ]),
    };
  }

  function toneFromSeverity(value) {
    if (value === "error" || value === "danger" || value === "critical") {
      return "danger";
    }
    if (value === "warning" || value === "warn") {
      return "warning";
    }
    if (value === "success") {
      return "success";
    }
    if (value === "info") {
      return "primary";
    }
    return "neutral";
  }

  function toneFromStatus(value) {
    if (!Number.isFinite(value) || value <= 0) {
      return "neutral";
    }
    if (value >= 500) {
      return "danger";
    }
    if (value >= 400) {
      return "warning";
    }
    if (value >= 200 && value < 300) {
      return "success";
    }
    return "primary";
  }

  function compactMeta(items) {
    return items.filter((item) => stringValue(item?.value));
  }

  function compactStrings(values) {
    return values.map((value) => stringValue(value)).filter(Boolean);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function stringValue(value) {
    return String(value ?? "").trim();
  }

  const api = {
    buildDrawerActivitySections,
    drawerDisplayTitle,
    buildDrawerTarget,
    drawerFooterActions,
    drawerTabsForResource,
    normalizeDrawerPayload,
    normalizeResourceKind,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DrawerUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
