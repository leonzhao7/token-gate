(function initResourceRenderRuntimeModule(globalScope) {
  function buildQuickDetailMarkup({
    resourceKey,
    record,
    rendererUtils,
    resourceViewUtils,
    displayUtils,
  }) {
    const sections = typeof rendererUtils?.createQuickDetailSections === "function"
      ? rendererUtils.createQuickDetailSections(resourceKey, record)
      : [];
    return resourceViewUtils.createQuickDetailMarkup({
      sections,
      escapeHTML: displayUtils.escapeHTML,
    });
  }

  function renderProxyRow({
    proxy,
    state,
    buildQuickDetailMarkup: buildQuickDetailMarkupFn,
    resourceViewUtils,
    displayUtils,
  }) {
    return resourceViewUtils.renderProxyRow({
      proxy,
      expanded: state.expandedProxies.has(String(proxy.id)),
      editing: String(state.editingProxyID) === String(proxy.id),
      quickDetails: typeof buildQuickDetailMarkupFn === "function"
        ? buildQuickDetailMarkupFn("proxies", proxy)
        : "",
      statusPill: displayUtils.statusPill,
      formatBindingCount: displayUtils.formatBindingCount,
      formatDataSize: displayUtils.formatDataSize,
      formatLatency: displayUtils.formatLatency,
      formatDateTime: displayUtils.formatDateTime,
      tableActions: displayUtils.tableActions,
      escapeHTML: displayUtils.escapeHTML,
    });
  }

  function renderBackendRow({
    backend,
    state,
    buildQuickDetailMarkup: buildQuickDetailMarkupFn,
    resourceViewUtils,
    displayUtils,
  }) {
    return resourceViewUtils.renderBackendRow({
      backend,
      expanded: state.expandedBackends.has(String(backend.id)),
      editing: String(state.editingBackendID) === String(backend.id),
      quickDetails: typeof buildQuickDetailMarkupFn === "function"
        ? buildQuickDetailMarkupFn("backends", backend)
        : "",
      statusPill: displayUtils.statusPill,
      formatBackendRouting: displayUtils.formatBackendRouting,
      formatBackendCoverage: displayUtils.formatBackendCoverage,
      backendProtocolLabel: displayUtils.backendProtocolLabel,
      formatUsageCount: displayUtils.formatUsageCount,
      formatLatency: displayUtils.formatLatency,
      formatDateTime: displayUtils.formatDateTime,
      formatBackendRecentStats: displayUtils.formatBackendRecentStats,
      tableActions: displayUtils.tableActions,
      escapeHTML: displayUtils.escapeHTML,
    });
  }

  function renderClientRow({
    client,
    state,
    buildQuickDetailMarkup: buildQuickDetailMarkupFn,
    resourceViewUtils,
    displayUtils,
  }) {
    return resourceViewUtils.renderClientRow({
      client,
      expanded: state.expandedClients.has(String(client.id)),
      editing: String(state.editingClientID) === String(client.id),
      quickDetails: typeof buildQuickDetailMarkupFn === "function"
        ? buildQuickDetailMarkupFn("clients", client)
        : "",
      clientTokenText: displayUtils.clientTokenDisplay(client),
      statusPill: displayUtils.statusPill,
      formatUsageCount: displayUtils.formatUsageCount,
      formatDateTime: displayUtils.formatDateTime,
      tableActions: displayUtils.tableActions,
      escapeHTML: displayUtils.escapeHTML,
    });
  }

  function renderResourceListByKey({
    resourceKey,
    renderProxies,
    renderBackends,
    renderClients,
  }) {
    if (resourceKey === "proxies") {
      renderProxies();
      return;
    }
    if (resourceKey === "backends") {
      renderBackends();
      return;
    }
    if (resourceKey === "clients") {
      renderClients();
    }
  }

  const api = {
    buildQuickDetailMarkup,
    renderProxyRow,
    renderBackendRow,
    renderClientRow,
    renderResourceListByKey,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceRenderRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
