(function initResourceViewModule(globalScope) {
  function renderResourceToolbar({
    resourceKey,
    viewState,
    model,
    config,
    activeFilters,
    hasChanges,
    escapeHTML = defaultEscapeHTML,
    toolbarStatusLabel = defaultToolbarStatusLabel,
  }) {
    return `
      <div class="resource-toolbar" data-resource-toolbar="${escapeHTML(resourceKey)}">
        <div class="resource-toolbar-main">
          <label class="resource-toolbar-search">
            <span class="field-label">Search</span>
            <input type="search" data-toolbar-search="${escapeHTML(resourceKey)}" placeholder="${escapeHTML(model?.searchPlaceholder || "")}" value="${escapeHTML(viewState?.query || "")}" />
          </label>
          <div class="resource-toolbar-meta">
            <span class="toolbar-pill">${escapeHTML(String(model?.count || 0))} items</span>
            <span class="toolbar-muted">${escapeHTML(toolbarStatusLabel(activeFilters, hasChanges))}</span>
          </div>
        </div>
        <div class="resource-toolbar-actions">
          ${ensureArray(config?.filterOptions).length ? `
            <select data-toolbar-filter="${escapeHTML(resourceKey)}">
              ${config.filterOptions.map((option) => `<option value="${escapeHTML(option.value)}" ${option.value === viewState?.filter ? "selected" : ""}>${escapeHTML(option.label)}</option>`).join("")}
            </select>
          ` : ""}
          ${ensureArray(config?.sortOptions).length ? `
            <select data-toolbar-sort="${escapeHTML(resourceKey)}">
              ${config.sortOptions.map((option) => `<option value="${escapeHTML(option.value)}" ${option.value === viewState?.sort ? "selected" : ""}>${escapeHTML(option.label)}</option>`).join("")}
            </select>
          ` : ""}
          <button class="ghost-button small-button" type="button" data-toolbar-reset="${escapeHTML(resourceKey)}" ${hasChanges ? "" : "disabled"}>Reset</button>
          <button class="ghost-button small-button" type="button" data-toolbar-refresh="${escapeHTML(resourceKey)}">Refresh</button>
        </div>
      </div>
    `;
  }

  function createQuickDetailMarkup({ sections, escapeHTML = defaultEscapeHTML }) {
    const normalized = ensureArray(sections);
    if (!normalized.length) {
      return `
        <div class="detail-panel">
          <p class="muted-text">No quick details for this row yet.</p>
        </div>
      `;
    }

    return `
      <div class="detail-panel compact-detail-panel">
        <div class="quick-detail-grid">
          ${normalized.map((section) => `
            <section class="quick-detail-card tone-${escapeHTML(section.tone || "neutral")}">
              <header class="quick-detail-head">
                <strong>${escapeHTML(section.title)}</strong>
                <span>${escapeHTML(String(ensureArray(section.items).length))}</span>
              </header>
              <dl class="quick-detail-list">
                ${ensureArray(section.items).map((item) => `
                  <div>
                    <dt>${escapeHTML(item.label || "-")}</dt>
                    <dd>${escapeHTML(item.value || "-")}</dd>
                  </div>
                `).join("")}
              </dl>
            </section>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderProxyRow({
    proxy,
    expanded,
    editing,
    quickDetails,
    statusPill,
    formatBindingCount,
    formatDataSize,
    formatLatency,
    formatDateTime,
    tableActions,
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <tr class="${editing ? "is-editing" : ""} clickable-row" data-row-open="proxy" data-row-id="${escapeHTML(proxy.id)}" data-row-title="${escapeHTML(proxy.name)}">
        <td>
          <button class="row-title" data-toggle-proxy="${proxy.id}" type="button">
            <span class="chevron">${expanded ? "收起" : "展开"}</span>
            <span>${escapeHTML(proxy.name)}</span>
          </button>
        </td>
        <td>${statusPill(proxy.enabled, "enabled", "disabled")}</td>
        <td>${escapeHTML(formatBindingCount(proxy.bound_backend_count))}</td>
        <td>${escapeHTML(formatDataSize(proxy.traffic_bytes))}</td>
        <td>${escapeHTML(formatLatency(proxy.avg_latency_ms))}</td>
        <td>${escapeHTML(formatDateTime(proxy.last_used_at))}</td>
        <td>${escapeHTML(formatDateTime(proxy.updated_at))}</td>
        <td>${tableActions("proxy", proxy.id)}</td>
      </tr>
      ${expanded ? `
        <tr class="detail-row">
          <td colspan="8">
            ${quickDetails}
          </td>
        </tr>
      ` : ""}
    `;
  }

  function renderBackendRow({
    backend,
    expanded,
    editing,
    quickDetails,
    statusPill,
    formatBackendRouting,
    formatBackendCoverage,
    backendProtocolLabel,
    formatUsageCount,
    formatLatency,
    formatDateTime,
    formatBackendRecentStats,
    tableActions,
    escapeHTML = defaultEscapeHTML,
  }) {
    const recentStats = backend?.recent_stats || {};
    return `
      <tr class="${editing ? "is-editing" : ""} clickable-row" data-row-open="backend" data-row-id="${escapeHTML(backend.id)}" data-row-title="${escapeHTML(backend.name)}">
        <td>
          <button class="row-title" data-toggle-backend="${backend.id}" type="button">
            <span class="chevron">${expanded ? "收起" : "展开"}</span>
            <span>${escapeHTML(backend.name)}</span>
          </button>
          <div class="cell-subtitle">${escapeHTML(backend.base_url)}</div>
        </td>
        <td>
          ${statusPill(backend.enabled, "enabled", "disabled")}
          <div class="cell-subtitle">${escapeHTML(formatBackendRouting(backend))}</div>
        </td>
        <td>
          <div>${escapeHTML(formatBackendCoverage(backend))}</div>
          <div class="cell-subtitle">${escapeHTML(backendProtocolLabel(backend.protocol))}</div>
        </td>
        <td>${escapeHTML(formatUsageCount(backend.request_count))}</td>
        <td>${escapeHTML(formatLatency(backend.avg_latency_ms))}</td>
        <td>${escapeHTML(formatDateTime(backend.last_used_at))}</td>
        <td>${escapeHTML(formatBackendRecentStats(recentStats))}</td>
        <td>${tableActions("backend", backend.id)}</td>
      </tr>
      ${expanded ? `
        <tr class="detail-row">
          <td colspan="8">
            ${quickDetails}
          </td>
        </tr>
      ` : ""}
    `;
  }

  function renderClientRow({
    client,
    expanded,
    editing,
    quickDetails,
    clientTokenText,
    statusPill,
    formatUsageCount,
    formatDateTime,
    tableActions,
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <tr class="${editing ? "is-editing" : ""} clickable-row" data-row-open="client" data-row-id="${escapeHTML(client.id)}" data-row-title="${escapeHTML(client.name)}">
        <td>
          <button class="row-title" data-toggle-client="${client.id}" type="button">
            <span class="chevron">${expanded ? "收起" : "展开"}</span>
            <span>${escapeHTML(client.name)}</span>
          </button>
          <div class="cell-subtitle"><span class="secret-text">${escapeHTML(clientTokenText || "-")}</span></div>
        </td>
        <td>${statusPill(client.enabled, "enabled", "disabled")}</td>
        <td>
          <div>${escapeHTML(client.route_mode_override || "default")}</div>
          <div class="cell-subtitle">${escapeHTML(client.route_group || "-")}</div>
        </td>
        <td>${escapeHTML(formatUsageCount(client.usage_count))}</td>
        <td>${escapeHTML(formatDateTime(client.last_used_at))}</td>
        <td>${escapeHTML(formatDateTime(client.updated_at))}</td>
        <td>${tableActions("client", client.id)}</td>
      </tr>
      ${expanded ? `
        <tr class="detail-row">
          <td colspan="7">
            ${quickDetails}
          </td>
        </tr>
      ` : ""}
    `;
  }

  function renderPolicyRow({
    policy,
    expanded,
    editing,
    quickDetails,
    formatPolicyRouting,
    formatUsageCount,
    formatPolicyCoverage,
    formatDateTime,
    tableActions,
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <tr class="${editing ? "is-editing" : ""} clickable-row" data-row-open="policy" data-row-id="${escapeHTML(policy.id)}" data-row-title="${escapeHTML(policy.pattern)}">
        <td>
          <button class="row-title" data-toggle-policy="${policy.id}" type="button">
            <span class="chevron">${expanded ? "收起" : "展开"}</span>
            <span>${escapeHTML(policy.pattern)}</span>
          </button>
          <div class="cell-subtitle">${escapeHTML(policy.endpoint)}</div>
        </td>
        <td>
          <div><span class="chip">${escapeHTML(policy.placement_policy)}</span></div>
          <div class="cell-subtitle">${escapeHTML(formatPolicyRouting(policy))}</div>
        </td>
        <td>${escapeHTML(formatUsageCount(policy.request_count))}</td>
        <td>${escapeHTML(formatPolicyCoverage(policy))}</td>
        <td>${escapeHTML(formatDateTime(policy.last_used_at))}</td>
        <td>${escapeHTML(formatDateTime(policy.updated_at))}</td>
        <td>${tableActions("policy", policy.id)}</td>
      </tr>
      ${expanded ? `
        <tr class="detail-row">
          <td colspan="7">
            ${quickDetails}
          </td>
        </tr>
      ` : ""}
    `;
  }

  function renderResourceTablePage({
    toolbar,
    isEmpty,
    emptyMarkup,
    headers,
    rowsMarkup,
    paginationMarkup,
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      ${toolbar || ""}
      ${isEmpty ? emptyMarkup : `
        <div class="table-shell">
          <table class="resource-table">
            <thead>
              <tr>
                ${ensureArray(headers).map((header) => `<th>${escapeHTML(header)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rowsMarkup || ""}
            </tbody>
          </table>
        </div>
      `}
      ${paginationMarkup || ""}
    `;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultToolbarStatusLabel(activeFilters, hasChanges) {
    if (!hasChanges || Number(activeFilters) <= 0) {
      return "Default view";
    }
    if (Number(activeFilters) === 1) {
      return "1 active control";
    }
    return `${activeFilters} active controls`;
  }

  function defaultEscapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const api = {
    renderResourceToolbar,
    createQuickDetailMarkup,
    renderProxyRow,
    renderBackendRow,
    renderClientRow,
    renderPolicyRow,
    renderResourceTablePage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
