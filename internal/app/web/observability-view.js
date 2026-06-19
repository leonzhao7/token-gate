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
                    <span class="timeline-icon">${escapeHTML(item.icon)}</span>
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
            <header>
              <span class="section-label">Event Summary</span>
              <strong>${escapeHTML(String(summary?.total || 0))} events</strong>
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
      <div class="event-table-shell">
        <div class="event-table usage-log-table">
          <div class="event-table-head usage-log-head">
            <span>Timestamp</span>
            <span>Method</span>
            <span>Path</span>
            <span>Status</span>
            <span>Latency</span>
            <span>Client Key</span>
            <span>Backend</span>
            <span>Proxy</span>
            <span>Trace ID</span>
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
              <span class="chevron">${expanded ? "收起" : "展开"}</span>
              <span>${escapeHTML(formatDateTime(row.timestamp))}</span>
            </button>
          </span>
          <span>${escapeHTML(row.method)}</span>
          <span>${escapeHTML(row.path)}</span>
          <span><em class="search-status-pill tone-${escapeHTML(row.tone)}">${escapeHTML(row.status)}</em></span>
          <span>${escapeHTML(row.latency)}</span>
          <span>${escapeHTML(row.clientKey)}</span>
          <span>${escapeHTML(row.backend)}</span>
          <span>${escapeHTML(row.proxy)}</span>
          <span>${escapeHTML(row.traceId)}</span>
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
