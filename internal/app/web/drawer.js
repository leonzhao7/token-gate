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
  };

  const DRAWER_TABS = [
    { key: "overview", label: "Overview" },
    { key: "configuration", label: "Configuration" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
    { key: "activity", label: "Activity" },
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

  function drawerTabsForResource(resourceKey) {
    return normalizeResourceKind(resourceKey) ? DRAWER_TABS.slice() : [];
  }

  function normalizeDrawerPayload(payload) {
    const normalized = payload && typeof payload === "object" ? payload : {};
    return {
      overview: plainObject(normalized.overview),
      configuration: plainObject(normalized.configuration),
      metadata: plainObject(normalized.metadata),
      raw: normalized.raw ?? {},
      activity: plainObject(normalized.activity),
    };
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function drawerFooterActions() {
    return DRAWER_FOOTER_ACTIONS.map((action) => ({ ...action }));
  }

  const api = {
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
