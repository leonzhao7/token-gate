(function initResourceRuntimeModule(globalScope) {
  const REQUIRED_METHODS = [
    "renderResourceToolbar",
    "createQuickDetailMarkup",
    "renderProxyRow",
    "renderBackendRow",
    "renderClientRow",
    "renderPolicyRow",
    "renderResourceTablePage",
  ];
  const REQUIRED_STATE_METHODS = [
    "defaultResourceView",
    "toolbarStatusLabel",
    "applyResourceView",
    "currentLocalPageData",
    "currentRemotePageData",
    "applyPagedResponse",
    "paginationPageNumbers",
  ];
  const REQUIRED_CRUD_METHODS = [
    "createResourceCrud",
    "parseModelMapping",
    "formatModelMappingInput",
    "readForm",
    "splitList",
  ];

  function requireResourceViewUtils(resourceViewUtils) {
    const candidate = resourceViewUtils && typeof resourceViewUtils === "object"
      ? resourceViewUtils
      : null;
    const missing = REQUIRED_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-view.js failed to load before app.js; missing ResourceViewUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceStateUtils(resourceStateUtils) {
    const candidate = resourceStateUtils && typeof resourceStateUtils === "object"
      ? resourceStateUtils
      : null;
    const missing = REQUIRED_STATE_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-state.js failed to load before app.js; missing ResourceStateUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireResourceCrudUtils(resourceCrudUtils) {
    const candidate = resourceCrudUtils && typeof resourceCrudUtils === "object"
      ? resourceCrudUtils
      : null;
    const missing = REQUIRED_CRUD_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `resource-crud.js failed to load before app.js; missing ResourceCrudUtils methods: ${missing.join(", ")}`,
    );
  }

  const api = {
    requireResourceCrudUtils,
    requireResourceStateUtils,
    requireResourceViewUtils,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
