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
  const REQUIRED_SHELL_STATE_METHODS = [
    "buildPageNavigation",
    "createSettingsSnapshot",
    "createThemeRuntimeState",
    "createThemeStorageOperation",
  ];
  const REQUIRED_SHELL_VIEW_METHODS = [
    "activatePageView",
    "pageIDFromHash",
    "renderSearchResults",
    "renderSearchShellView",
    "renderThemeView",
  ];
  const REQUIRED_DRAWER_VIEW_METHODS = [
    "drawerDisplayTitle",
    "renderDrawerShell",
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

  function requireShellStateUtils(shellStateUtils) {
    const candidate = shellStateUtils && typeof shellStateUtils === "object"
      ? shellStateUtils
      : null;
    const missing = REQUIRED_SHELL_STATE_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `shell-state.js failed to load before app.js; missing ShellStateUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireShellViewUtils(shellViewUtils) {
    const candidate = shellViewUtils && typeof shellViewUtils === "object"
      ? shellViewUtils
      : null;
    const missing = REQUIRED_SHELL_VIEW_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `shell-view.js failed to load before app.js; missing ShellViewUtils methods: ${missing.join(", ")}`,
    );
  }

  function requireDrawerViewUtils(drawerViewUtils) {
    const candidate = drawerViewUtils && typeof drawerViewUtils === "object"
      ? drawerViewUtils
      : null;
    const missing = REQUIRED_DRAWER_VIEW_METHODS.filter((key) => typeof candidate?.[key] !== "function");
    if (!missing.length) {
      return candidate;
    }

    throw new Error(
      `drawer-view.js failed to load before app.js; missing DrawerViewUtils methods: ${missing.join(", ")}`,
    );
  }

  const api = {
    requireDrawerViewUtils,
    requireResourceCrudUtils,
    requireResourceStateUtils,
    requireResourceViewUtils,
    requireShellStateUtils,
    requireShellViewUtils,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
