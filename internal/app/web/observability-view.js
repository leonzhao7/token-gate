(function initObservabilityViewModule(globalScope) {
  function renderEventsPage({
    events,
    pageData,
    timelineItems,
    summary,
    formatDateTime = identity,
    renderPagination = () => "",
    emptyState = defaultEmptyState,
    feedToneClass = defaultFeedToneClass,
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <div class="observability-shell">
        <section class="observability-main">
          <header class="observability-section-head">
            <div>
              <span class="section-label">Timeline</span>
              <strong>Events timeline</strong>
            </div>
            <p>按时间顺序查看配置变更、故障转移和上游异常，保留关键 actor、backend 与 severity 上下文。</p>
          </header>
          ${ensureArray(events).length === 0
    ? emptyState(
      "还没有事件",
      "配置变更、backend failover 或上游异常会出现在这里。",
    )
    : `
            <div class="timeline-list">
              ${ensureArray(timelineItems).map((item) => `
                <article class="timeline-item tone-${escapeHTML(item.tone)}">
                  <div class="timeline-rail">
                    <span class="timeline-icon" data-event-icon="${escapeHTML(item.icon)}">
                      ${renderTimelineIcon(item.icon)}
                    </span>
                  </div>
                  <div
                    class="timeline-card"
                    tabindex="0"
                    role="button"
                    data-event-row="${escapeHTML(item.id)}"
                    data-event-title="${escapeHTML(item.title || "Event")}"
                  >
                    <div class="timeline-card-head">
                      <div>
                        <strong>${escapeHTML(item.title)}</strong>
                        <p>${escapeHTML(item.description)}</p>
                      </div>
                      <span class="timeline-stamp">${escapeHTML(formatDateTime(item.timestamp))}</span>
                    </div>
                    <div class="timeline-meta">
                      <span class="status-pill ${feedToneClass(item.tone)}">${escapeHTML(item.category)}</span>
                      <span>${escapeHTML(item.meta)}</span>
                      <span>${escapeHTML(item.actor)}</span>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          `}
        </section>
        <aside class="observability-side">
          <section class="observability-summary-card">
            <header class="observability-panel-head">
              <div>
                <span class="section-label">Event Summary</span>
                <strong>${escapeHTML(String(summary?.total || 0))} events</strong>
              </div>
              <p>按类别与严重级别汇总近期事件密度，便于快速判断是否需要深入排查。</p>
            </header>
            <div class="summary-stack">
              ${ensureArray(summary?.categories).map((item) => `
                <div class="summary-row">
                  <span>${escapeHTML(item.label)}</span>
                  <strong class="tone-${escapeHTML(item.tone)}">${escapeHTML(String(item.count))}</strong>
                </div>
              `).join("")}
            </div>
            <div class="summary-stack">
              ${ensureArray(summary?.severities).map((item) => `
                <div class="summary-row">
                  <span>${escapeHTML(item.label)}</span>
                  <strong class="tone-${escapeHTML(item.tone)}">${escapeHTML(String(item.count))}</strong>
                </div>
              `).join("")}
            </div>
          </section>
        </aside>
      </div>
      ${renderPagination("events", pageData)}
    `;
  }

  function renderUsageLogsPage({
    logs,
    pageData,
    statsCards,
    pageRows,
    expandedUsageLogs,
    formatDateTime = identity,
    renderPagination = () => "",
    emptyState = defaultEmptyState,
    renderUsageLogInlineDetail = () => "",
    escapeHTML = defaultEscapeHTML,
  }) {
    const statsMarkup = `
      <div class="observability-stats-grid">
        ${ensureArray(statsCards).map((card) => `
          <article class="observability-stat-card">
            <span class="section-label">${escapeHTML(card.label)}</span>
            <strong>${escapeHTML(card.value)}</strong>
            <p class="tone-${escapeHTML(card.tone)}">${escapeHTML(card.detail)}</p>
          </article>
        `).join("")}
      </div>
    `;

    if (ensureArray(logs).length === 0) {
      return `
        ${statsMarkup}
        ${emptyState(
      "还没有使用日志",
      "有客户端通过 Token Gate 发起请求后，这里会按请求维度记录一条 usage log。",
    )}
      `;
    }

    return `
      ${statsMarkup}
      <header class="observability-section-head">
        <div>
          <span class="section-label">Request Stream</span>
          <strong>Usage log table</strong>
        </div>
        <p>聚合请求统计后下钻到逐条日志，核对模型、后端、代理链路和请求细节。</p>
      </header>
      <div class="event-table-shell">
        <div class="event-table usage-log-table">
          <div class="event-table-head usage-log-head">
            <span>Timestamp</span>
            <span>Path</span>
            <span>Model</span>
            <span>Status</span>
            <span>Latency</span>
            <span>Client Key</span>
            <span>Backend</span>
            <span>Proxy</span>
          </div>
          <div class="event-table-body">
            ${ensureArray(pageRows).map((row) => renderUsageLogRow({
              row,
              expanded: expandedUsageLogs?.has(String(row.id)),
              formatDateTime,
              renderInlineDetail: () => renderUsageLogInlineDetail(row),
              escapeHTML,
            })).join("")}
          </div>
        </div>
      </div>
      ${renderPagination("usageLogs", pageData)}
    `;
  }

  function renderUsageLogRow({
    row,
    expanded,
    formatDateTime = identity,
    renderInlineDetail = () => "",
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <div class="usage-log-block ${expanded ? "is-expanded" : ""}">
        <div
          class="event-row usage-log-row usage-log-row-button"
          tabindex="0"
          data-usage-log-row="${escapeHTML(row.id)}"
          data-usage-log-title="${escapeHTML(row.requestId || row.model || "Usage Log")}"
        >
          <span>
            <button class="row-title inline-row-toggle" data-toggle-usage-log="${escapeHTML(row.id)}" type="button">
              ${renderRowChevron(expanded)}
              <span>${escapeHTML(formatDateTime(row.timestamp))}</span>
            </button>
          </span>
          <span>${escapeHTML(row.path)}</span>
          <span>${escapeHTML(row.model)}</span>
          <span><em class="search-status-pill tone-${escapeHTML(row.tone)}">${escapeHTML(row.status)}</em></span>
          <span>${escapeHTML(row.latency)}</span>
          <span>${escapeHTML(row.clientKey)}</span>
          <span>${escapeHTML(row.backend)}</span>
          <span>${escapeHTML(row.proxy)}</span>
        </div>
        ${expanded ? `
          <div class="usage-log-inline-detail">
            ${renderInlineDetail()}
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderUsageLogInlineDetail({
    detail,
    row,
    previewItems,
    formatInlinePreview: previewFormatter = formatInlinePreview,
    escapeHTML = defaultEscapeHTML,
  }) {
    if (detail?.error) {
      return `
        <div class="usage-log-inline-grid">
          <article class="usage-log-inline-card">
            <span class="section-label">Trace ID</span>
            <strong>${escapeHTML(row.traceId || "-")}</strong>
          </article>
          <article class="usage-log-inline-card usage-log-inline-card-wide">
            <span class="section-label tone-danger">Detail</span>
            <strong class="tone-danger">${escapeHTML(detail.error)}</strong>
          </article>
          <article class="usage-log-inline-card usage-log-inline-card-wide">
            <span class="section-label">Request</span>
            <strong>${escapeHTML(row.requestMetadata || "-")}</strong>
          </article>
        </div>
      `;
    }

    const items = ensureArray(previewItems);
    return `
      <div class="usage-log-inline-grid">
        ${items.map((item) => `
          <article class="usage-log-inline-card ${item.key === "headers" || item.key === "payload" || item.key === "response" ? "usage-log-inline-card-wide" : ""}">
            <span class="section-label">${escapeHTML(item.label)}</span>
            <strong>${escapeHTML(item.key === "headers" || item.key === "payload" || item.key === "response" ? previewFormatter(item.value) : item.value || "-")}</strong>
          </article>
        `).join("")}
      </div>
    `;
  }

  function formatInlinePreview(value) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      return "-";
    }
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
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

  function renderTimelineIcon(name) {
    const icons = {
      system: [
        "M12 4v16",
        "M4 12h16",
        "M6.5 6.5l11 11",
        "M17.5 6.5l-11 11",
      ],
      backend: [
        "M5 6h14",
        "M5 18h14",
        "M7 10h10",
        "M7 14h10",
      ],
      proxy: [
        "M6 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
        "M18 23a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
        "M18 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z",
        "M8.6 6.5h6.8",
        "M8.5 7.5 15.5 16",
      ],
      client_key: [
        "M8 15a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z",
        "m11 12 8-8",
        "m15 8 3 3",
      ],
      security: [
        "M12 2 20 6v6c0 5.2-3.4 9.8-8 10-4.6-.2-8-4.8-8-10V6l8-4Z",
        "M9 12l2 2 4-5",
      ],
    };

    return `
      <svg class="timeline-icon-svg" data-event-icon-svg="${defaultEscapeHTML(name || "system")}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        ${(icons[name] || icons.system).map((path) => `<path d="${path}"></path>`).join("")}
      </svg>
    `;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultFeedToneClass(tone) {
    if (tone === "danger") {
      return "off";
    }
    if (tone === "warning") {
      return "";
    }
    return "ok";
  }

  function defaultEmptyState(title, description) {
    return `
      <article class="empty-state">
        <strong>${defaultEscapeHTML(title)}</strong>
        <p class="empty-copy">${defaultEscapeHTML(description)}</p>
      </article>
    `;
  }

  function defaultEscapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function identity(value) {
    return value;
  }

  const api = {
    renderEventsPage,
    renderUsageLogsPage,
    renderUsageLogRow,
    renderUsageLogInlineDetail,
    formatInlinePreview,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ObservabilityViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
