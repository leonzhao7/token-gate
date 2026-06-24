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
    const filterOptions = ensureArray(config?.filterOptions);
    const sortOptions = ensureArray(config?.sortOptions);
    const createLabel = String(model?.createLabel || "新增").trim();
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
          ${filterOptions.length ? `
            <label class="resource-toolbar-control">
              <span class="field-label">Filter</span>
              <select data-toolbar-filter="${escapeHTML(resourceKey)}">
                ${filterOptions.map((option) => `<option value="${escapeHTML(option.value)}" ${option.value === viewState?.filter ? "selected" : ""}>${escapeHTML(option.label)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
          ${sortOptions.length ? `
            <label class="resource-toolbar-control">
              <span class="field-label">Sort</span>
              <select data-toolbar-sort="${escapeHTML(resourceKey)}">
                ${sortOptions.map((option) => `<option value="${escapeHTML(option.value)}" ${option.value === viewState?.sort ? "selected" : ""}>${escapeHTML(option.label)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
          <button class="ghost-button small-button resource-toolbar-button" type="button" data-toolbar-reset="${escapeHTML(resourceKey)}" ${hasChanges ? "" : "disabled"}>${renderToolbarIcon("reset")}<span>Reset</span></button>
          <button class="ghost-button small-button resource-toolbar-button" type="button" data-toolbar-refresh="${escapeHTML(resourceKey)}">${renderToolbarIcon("refresh")}<span>Refresh</span></button>
          <button class="small-button resource-toolbar-button" type="button" data-toolbar-create="${escapeHTML(resourceKey)}">${renderToolbarIcon("create")}<span>${escapeHTML(createLabel)}</span></button>
        </div>
      </div>
    `;
  }

  function renderToolbarIcon(name) {
    const paths = {
      reset: [
        "M4 4v6h6",
        "M20 20v-6h-6",
        "M5 15a7 7 0 0 0 11 4",
        "M19 9A7 7 0 0 0 8 5",
      ],
      refresh: [
        "M20 6v6h-6",
        "M4 18v-6h6",
        "M18 12a6 6 0 0 0-10-4.5",
        "M6 12a6 6 0 0 0 10 4.5",
      ],
      create: [
        "M12 5v14",
        "M5 12h14",
      ],
    };
    return `
      <svg class="shell-icon toolbar-button-icon" data-shell-icon="toolbar-${name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${(paths[name] || paths.create).map((path) => `<path d="${path}"></path>`).join("")}
      </svg>
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
          <button class="row-title" data-toggle-proxy="${proxy.id}" type="button" aria-expanded="${String(Boolean(expanded))}">
            ${renderRowChevron(expanded)}
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
    formatTagList = defaultListValue,
    formatModelList = defaultListValue,
    formatHourlyCount = defaultHourlyCount,
    formatLatency,
    tableActions,
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <tr class="${editing ? "is-editing" : ""} clickable-row" data-row-open="backend" data-row-id="${escapeHTML(backend.id)}" data-row-title="${escapeHTML(backend.name)}">
        <td>
          <button class="row-title" data-toggle-backend="${backend.id}" type="button" aria-expanded="${String(Boolean(expanded))}">
            ${renderRowChevron(expanded)}
            <span>${escapeHTML(backend.name)}</span>
          </button>
        </td>
        <td>${escapeHTML(backend.console_url || "-")}</td>
        <td>${statusPill(backend.status || "normal", backend.status || "normal", "unknown")}</td>
        <td>${escapeHTML(formatTagList(backend.tags))}</td>
        <td>${escapeHTML(formatModelList(backend.models))}</td>
        <td>${escapeHTML(formatHourlyCount(backend.hourly_requests))}</td>
        <td>${escapeHTML(formatHourlyCount(backend.hourly_failures))}</td>
        <td>${escapeHTML(formatLatency(backend.avg_latency_ms))}</td>
        <td>${tableActions("backend", backend.id)}</td>
      </tr>
      ${expanded ? `
        <tr class="detail-row">
          <td colspan="9">
            ${quickDetails}
          </td>
        </tr>
      ` : ""}
    `;
  }

  function defaultListValue(value) {
    const items = Array.isArray(value) ? value.filter(Boolean) : [];
    return items.length ? items.join(", ") : "-";
  }

  function defaultHourlyCount(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) {
      return "0";
    }
    return String(Math.floor(count));
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
          <button class="row-title" data-toggle-client="${client.id}" type="button" aria-expanded="${String(Boolean(expanded))}">
            ${renderRowChevron(expanded)}
            <span>${escapeHTML(client.name)}</span>
          </button>
          <div class="cell-subtitle"><span class="secret-text">${escapeHTML(clientTokenText || "-")}</span></div>
        </td>
        <td>${statusPill(client.enabled, "enabled", "disabled")}</td>
        <td>${escapeHTML(formatUsageCount(client.usage_count))}</td>
        <td>${escapeHTML(formatDateTime(client.last_used_at))}</td>
        <td>${escapeHTML(formatDateTime(client.updated_at))}</td>
        <td>${tableActions("client", client.id)}</td>
      </tr>
      ${expanded ? `
        <tr class="detail-row">
          <td colspan="6">
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

  function renderRowChevron(expanded) {
    const iconName = expanded ? "row-collapse" : "row-expand";
    const label = expanded ? "Collapse row" : "Expand row";
    return `
      <span class="chevron" aria-label="${label}">
        <svg class="shell-icon row-chevron-icon" data-shell-icon="${iconName}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${expanded ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"}"></path>
        </svg>
      </span>
    `;
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
    renderResourceTablePage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
