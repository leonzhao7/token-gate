(function initDrawerViewModule(globalScope) {
  const OVERVIEW_TITLE_KEYS = ["name", "pattern", "message", "request_id", "type", "model", "address", "base_url", "token_prefix"];
  const OVERVIEW_SUBTITLE_KEYS = ["base_url", "endpoint", "pool", "backend_pool", "route_group", "protocol", "actor", "client_name"];
  const OVERVIEW_HIGHLIGHT_KEYS = ["enabled", "pool", "backend_pool", "protocol", "weight", "proxy_id", "usage_count", "last_used_at", "endpoint"];
  const METADATA_PRIORITY_KEYS = ["id", "resource_type", "resource_id", "created_at", "updated_at", "last_used_at"];

  function drawerDisplayTitle(kind, { resolveTitle = defaultResolveTitle } = {}) {
    return resolveTitle(kind);
  }

  function formatDrawerValue(value) {
    if (Array.isArray(value)) {
      return value.join(", ") || "-";
    }
    if (value && typeof value === "object") {
      return JSON.stringify(value);
    }
    if (value === null || typeof value === "undefined" || value === "") {
      return "-";
    }
    return String(value);
  }

  function humanizeKey(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDrawerActivityMetaValue(entry, { formatDateTime = identity } = {}) {
    if (!entry || typeof entry !== "object") {
      return "-";
    }
    if (entry.format === "datetime") {
      return formatDateTime(entry.value);
    }
    return String(entry.value || "-");
  }

  function renderDrawerActivityCard(item, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
  } = {}) {
    const chips = ensureArray(item?.chips).filter(Boolean);
    const meta = ensureArray(item?.meta).filter((entry) => entry && entry.label && entry.value);
    return `
      <article class="drawer-activity-card tone-${escapeHTML(item?.tone || "neutral")}">
        <div class="drawer-activity-card-top">
          <strong>${escapeHTML(item?.title || "-")}</strong>
          ${chips.length ? `
            <div class="drawer-activity-chip-row">
              ${chips.map((chip) => `<span class="drawer-activity-chip">${escapeHTML(chip)}</span>`).join("")}
            </div>
          ` : ""}
        </div>
        <p>${escapeHTML(item?.summary || "-")}</p>
        ${meta.length ? `
          <dl class="drawer-activity-meta">
            ${meta.map((entry) => `
              <div>
                <dt>${escapeHTML(entry.label)}</dt>
                <dd>${escapeHTML(formatDrawerActivityMetaValue(entry, { formatDateTime }))}</dd>
              </div>
            `).join("")}
          </dl>
        ` : ""}
      </article>
    `;
  }

  function renderDrawerActivitySection(section, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
  } = {}) {
    if (!section || !Array.isArray(section.items) || !section.items.length) {
      return "";
    }
    return `
      <section class="drawer-activity-section">
        <header>
          <strong>${escapeHTML(section.title || "Activity")}</strong>
          <span>${escapeHTML(String(section.count || section.items.length || 0))}</span>
        </header>
        <div class="drawer-activity-grid">
          ${section.items.slice(0, 8).map((item) => renderDrawerActivityCard(item, { escapeHTML, formatDateTime })).join("")}
        </div>
      </section>
    `;
  }

  function renderDrawerTabPanel(tab, value, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
    activitySections = [],
  } = {}) {
    if (tab === "raw") {
      const raw = value == null ? {} : value;
      return `
        <div class="drawer-code-block">
          <pre>${escapeHTML(JSON.stringify(raw, null, 2))}</pre>
        </div>
      `;
    }

    if (tab === "activity") {
      const sections = ensureArray(activitySections)
        .map((section) => renderDrawerActivitySection(section, { escapeHTML, formatDateTime }))
        .filter(Boolean);
      if (!sections.length) {
        return `<div class="drawer-state"><strong>No activity</strong><p class="muted-text">No related activity for this resource yet.</p></div>`;
      }
      return `<div class="drawer-section-stack">${sections.join("")}</div>`;
    }

    const objectValue = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const entries = Object.entries(objectValue);
    if (!entries.length) {
      return `<div class="drawer-state"><strong>No ${escapeHTML(tab)}</strong><p class="muted-text">This tab has no data yet.</p></div>`;
    }

    if (tab === "overview") {
      return renderDrawerOverviewPanel(objectValue, { escapeHTML, formatDateTime });
    }

    if (tab === "configuration") {
      return renderDrawerConfigurationPanel(objectValue, { escapeHTML, formatDateTime });
    }

    if (tab === "metadata") {
      return renderDrawerMetadataPanel(objectValue, { escapeHTML, formatDateTime });
    }

    if (tab === "request" || tab === "response") {
      return renderDrawerHTTPPanel(tab, objectValue, { escapeHTML });
    }

    return renderDrawerKVGrid(entries, { escapeHTML, formatDateTime });
  }

  function renderDrawerHTTPPanel(tab, value, {
    escapeHTML = defaultEscapeHTML,
  } = {}) {
    const isRequest = tab === "request";
    const summaryCards = isRequest
      ? [
        { label: "Method", value: value?.method || "-" },
        { label: "Request Bytes", value: formatByteCount(value?.bytes) },
      ]
      : [
        { label: "Status Family", value: value?.status_family || "-" },
        { label: "Streaming", value: formatStreamState(value?.is_stream) },
        { label: "Response Bytes", value: formatByteCount(value?.bytes) },
      ];
    const lineLabel = isRequest ? "Request Line" : "Response Summary";
    const lineValue = isRequest
      ? formatRequestLine(value)
      : value?.status_family || "-";

    return `
      <div class="drawer-section-stack drawer-http-panel">
        <section class="drawer-overview-hero drawer-http-hero">
          <div class="drawer-overview-copy">
            <small>${escapeHTML(lineLabel)}</small>
            <strong class="drawer-overview-title drawer-http-line">${escapeHTML(lineValue)}</strong>
          </div>
        </section>
        <div class="drawer-http-summary-grid">
          ${summaryCards.map((item) => `
            <article class="drawer-highlight-card drawer-http-summary-card">
              <small>${escapeHTML(item.label)}</small>
              <strong>${escapeHTML(item.value)}</strong>
            </article>
          `).join("")}
        </div>
        ${renderDrawerTextSection({
          title: "Headers",
          body: value?.headers_json,
          emptyMessage: "-",
          escapeHTML,
        })}
        ${renderDrawerTextSection({
          title: isRequest ? "Payload Preview" : "Response Preview",
          body: value?.body_preview,
          emptyMessage: "-",
          escapeHTML,
        })}
      </div>
    `;
  }

  function renderDrawerOverviewPanel(value, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
  } = {}) {
    const entries = Object.entries(value || {});
    const titleKey = firstPresentKey(value, OVERVIEW_TITLE_KEYS) || entries[0]?.[0] || "resource";
    const titleValue = formatDrawerFieldValue(titleKey, value?.[titleKey], { formatDateTime });
    const subtitleKeys = OVERVIEW_SUBTITLE_KEYS.filter((key) => key !== titleKey && hasDisplayValue(value?.[key])).slice(0, 3);
    const subtitle = subtitleKeys.map((key) => formatDrawerFieldValue(key, value[key], { formatDateTime })).join(" · ");
    const consumed = new Set([titleKey, ...subtitleKeys]);
    const highlights = entries
      .filter(([key, entryValue]) => !consumed.has(key) && hasDisplayValue(entryValue) && OVERVIEW_HIGHLIGHT_KEYS.includes(key))
      .slice(0, 4);
    highlights.forEach(([key]) => consumed.add(key));
    const remaining = entries.filter(([key, entryValue]) => !consumed.has(key) && hasDisplayValue(entryValue));

    return `
      <div class="drawer-section-stack">
        <section class="drawer-overview-hero">
          <div class="drawer-overview-copy">
            <small>${escapeHTML(humanizeKey(titleKey))}</small>
            <strong class="drawer-overview-title">${escapeHTML(titleValue)}</strong>
            <p class="drawer-overview-subtitle">${escapeHTML(subtitle || "Inspect live routing, access, and audit context for this resource.")}</p>
          </div>
        </section>
        ${highlights.length ? `
          <div class="drawer-highlight-grid">
            ${highlights.map(([key, entryValue]) => `
              <article class="drawer-highlight-card">
                <small>${escapeHTML(humanizeKey(key))}</small>
                <strong>${escapeHTML(formatDrawerFieldValue(key, entryValue, { formatDateTime }))}</strong>
              </article>
            `).join("")}
          </div>
        ` : ""}
        ${remaining.length ? renderDrawerKVGrid(remaining, { escapeHTML, formatDateTime }) : ""}
      </div>
    `;
  }

  function renderDrawerConfigurationPanel(value, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
  } = {}) {
    const arrayEntries = [];
    const objectEntries = [];
    const scalarEntries = [];

    Object.entries(value || {}).forEach(([key, entryValue]) => {
      if (!hasDisplayValue(entryValue)) {
        return;
      }
      if (Array.isArray(entryValue)) {
        arrayEntries.push([key, entryValue]);
        return;
      }
      if (isPlainObject(entryValue)) {
        objectEntries.push([key, entryValue]);
        return;
      }
      scalarEntries.push([key, entryValue]);
    });

    return `
      <div class="drawer-section-stack">
        ${arrayEntries.map(([key, entryValue]) => renderDrawerDetailSection({
          title: humanizeKey(key),
          countLabel: `${entryValue.length} items`,
          body: `
            <div class="drawer-list-grid">
              ${entryValue.map((item) => `
                <article class="drawer-list-item">
                  <strong>${escapeHTML(formatDrawerFieldValue(key, item, { formatDateTime }))}</strong>
                </article>
              `).join("")}
            </div>
          `,
          escapeHTML,
        })).join("")}
        ${objectEntries.map(([key, entryValue]) => renderDrawerDetailSection({
          title: humanizeKey(key),
          countLabel: `${Object.keys(entryValue).length} fields`,
          body: `
            <div class="drawer-list-grid">
              ${Object.entries(entryValue).map(([childKey, childValue]) => `
                <article class="drawer-list-item">
                  <small>${escapeHTML(humanizeKey(childKey))}</small>
                  <strong>${escapeHTML(formatDrawerFieldValue(childKey, childValue, { formatDateTime }))}</strong>
                </article>
              `).join("")}
            </div>
          `,
          escapeHTML,
        })).join("")}
        ${scalarEntries.length ? renderDrawerDetailSection({
          title: "Parameters",
          countLabel: `${scalarEntries.length} fields`,
          body: renderDrawerKVGrid(scalarEntries, { escapeHTML, formatDateTime }),
          escapeHTML,
        }) : ""}
      </div>
    `;
  }

  function renderDrawerMetadataPanel(value, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
  } = {}) {
    const entries = Object.entries(value || {}).filter(([, entryValue]) => hasDisplayValue(entryValue));
    const ordered = sortEntriesByPriority(entries, METADATA_PRIORITY_KEYS);
    const primary = ordered.slice(0, 6);
    const supplemental = ordered.slice(6);

    return `
      <div class="drawer-section-stack">
        <section class="drawer-detail-section">
          <header class="drawer-detail-section-head">
            <strong>Audit Information</strong>
            <span>${escapeHTML(`${primary.length} fields`)}</span>
          </header>
          <div class="drawer-audit-grid">
            ${primary.map(([key, entryValue]) => `
              <article class="drawer-audit-item">
                <small>${escapeHTML(humanizeKey(key))}</small>
                <strong>${escapeHTML(formatDrawerFieldValue(key, entryValue, { formatDateTime }))}</strong>
              </article>
            `).join("")}
          </div>
        </section>
        ${supplemental.length ? renderDrawerDetailSection({
          title: "Supplemental Metadata",
          countLabel: `${supplemental.length} fields`,
          body: renderDrawerKVGrid(supplemental, { escapeHTML, formatDateTime }),
          escapeHTML,
        }) : ""}
      </div>
    `;
  }

  function renderDrawerDetailSection({
    title,
    countLabel = "",
    body = "",
    escapeHTML = defaultEscapeHTML,
  }) {
    return `
      <section class="drawer-detail-section">
        <header class="drawer-detail-section-head">
          <strong>${escapeHTML(title || "Details")}</strong>
          ${countLabel ? `<span>${escapeHTML(countLabel)}</span>` : ""}
        </header>
        ${body}
      </section>
    `;
  }

  function renderDrawerTextSection({
    title,
    body,
    emptyMessage = "-",
    escapeHTML = defaultEscapeHTML,
  } = {}) {
    const hasBody = typeof body === "string" ? body.trim() !== "" : body != null && String(body).trim() !== "";
    return renderDrawerDetailSection({
      title,
      body: `
        <div class="drawer-code-block drawer-inline-code-block">
          <pre>${escapeHTML(hasBody ? String(body) : emptyMessage)}</pre>
        </div>
      `,
      escapeHTML,
    });
  }

  function renderDrawerKVGrid(entries, {
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
  } = {}) {
    return `
      <div class="drawer-kv-grid">
        ${ensureArray(entries).map(([key, entryValue]) => `
          <article class="drawer-kv-card">
            <small>${escapeHTML(humanizeKey(key))}</small>
            <strong>${escapeHTML(formatDrawerFieldValue(key, entryValue, { formatDateTime }))}</strong>
          </article>
        `).join("")}
      </div>
    `;
  }

  function formatDrawerFieldValue(key, value, { formatDateTime = identity } = {}) {
    if (typeof value === "boolean") {
      if (key === "enabled") {
        return value ? "Enabled" : "Disabled";
      }
      return value ? "Yes" : "No";
    }
    if (isDateTimeKey(key)) {
      return formatDateTime(value);
    }
    return formatDrawerValue(value);
  }

  function isDateTimeKey(key) {
    const normalized = String(key || "").trim().toLowerCase();
    return normalized.endsWith("_at") || normalized.endsWith("_time") || normalized === "timestamp";
  }

  function firstPresentKey(value, keys) {
    return ensureArray(keys).find((key) => hasDisplayValue(value?.[key])) || "";
  }

  function hasDisplayValue(value) {
    if (value === null || typeof value === "undefined") {
      return false;
    }
    if (typeof value === "string") {
      return value.trim() !== "";
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isPlainObject(value)) {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function sortEntriesByPriority(entries, priorityKeys) {
    const priority = new Map(ensureArray(priorityKeys).map((key, index) => [key, index]));
    return ensureArray(entries).slice().sort(([leftKey], [rightKey]) => {
      const leftRank = priority.has(leftKey) ? priority.get(leftKey) : Number.MAX_SAFE_INTEGER;
      const rightRank = priority.has(rightKey) ? priority.get(rightKey) : Number.MAX_SAFE_INTEGER;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return String(leftKey).localeCompare(String(rightKey));
    });
  }

  function renderDrawerTabs({
    tabs,
    activeTab,
    escapeHTML = defaultEscapeHTML,
  }) {
    return ensureArray(tabs).map((tab) => `
      <button class="ghost-button ${tab.key === activeTab ? "active" : ""}" type="button" data-drawer-tab="${escapeHTML(tab.key)}">
        ${escapeHTML(tab.label)}
      </button>
    `).join("");
  }

  function renderDrawerBody({
    drawer,
    activitySections = [],
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
    resolveTitle = defaultResolveTitle,
  }) {
    if (drawer?.loading) {
      return `
        <div class="drawer-state">
          <strong>Loading detail</strong>
          <p class="muted-text">Fetching ${escapeHTML(drawerDisplayTitle(drawer?.kind, { resolveTitle }))} detail.</p>
        </div>
      `;
    }
    if (drawer?.error) {
      return `
        <div class="drawer-state drawer-state-error">
          <strong>Drawer unavailable</strong>
          <p class="muted-text">${escapeHTML(drawer.error)}</p>
        </div>
      `;
    }
    const data = drawer?.data || {};
    const activeTab = drawer?.tab || "overview";
    return renderDrawerTabPanel(activeTab, data[activeTab], { escapeHTML, formatDateTime, activitySections });
  }

  function renderDrawerFooter({
    isOpen,
    kind,
    footerActions = [],
    escapeHTML = defaultEscapeHTML,
  }) {
    if (!isOpen) {
      return "";
    }
    const visibleActions = kind === "usage_logs"
      ? [{ key: "save", label: "Save", tone: "primary", disabled: true }]
      : ensureArray(footerActions);
    return visibleActions.map((action) => `
      <button
        class="${action.tone === "ghost" ? "ghost-button" : action.tone === "danger" ? "danger-button" : ""}"
        type="button"
        data-drawer-footer="${escapeHTML(action.key)}"
        ${action.disabled ? "disabled aria-disabled=\"true\" title=\"Read-only detail drawer\"" : ""}
      >
        ${escapeHTML(action.label)}
      </button>
    `).join("");
  }

  function renderDrawerShell({
    drawer,
    tabs = [],
    footerActions = [],
    activitySections = [],
    escapeHTML = defaultEscapeHTML,
    formatDateTime = identity,
    resolveTitle = defaultResolveTitle,
  }) {
    const detailTitle = drawer?.title || drawerDisplayTitle(drawer?.kind, { resolveTitle });
    return {
      isOpen: Boolean(drawer?.open),
      ariaHidden: String(!drawer?.open),
      title: detailTitle ? `${detailTitle} Detail` : "Detail Drawer",
      tabs: renderDrawerTabs({
        tabs,
        activeTab: drawer?.tab || "overview",
        escapeHTML,
      }),
      body: renderDrawerBody({
        drawer,
        activitySections,
        escapeHTML,
        formatDateTime,
        resolveTitle,
      }),
      footer: renderDrawerFooter({
        isOpen: Boolean(drawer?.open),
        kind: drawer?.kind || "",
        footerActions,
        escapeHTML,
      }),
    };
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function formatRequestLine(value) {
    const method = String(value?.method || "").trim().toUpperCase();
    const path = String(value?.path || "").trim() || "-";
    const query = String(value?.query || "").trim();
    return [method, query ? `${path}?${query}` : path].filter(Boolean).join(" ").trim() || "-";
  }

  function formatByteCount(value) {
    if (value === null || typeof value === "undefined" || value === "") {
      return "-";
    }
    return String(value);
  }

  function formatStreamState(value) {
    if (value === true) {
      return "Streamed";
    }
    if (value === false) {
      return "Buffered";
    }
    return "-";
  }

  function identity(value) {
    return value;
  }

  function defaultResolveTitle(kind) {
    return String(kind || "").trim() ? "Resource" : "Resource";
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
    drawerDisplayTitle,
    formatDrawerValue,
    humanizeKey,
    formatDrawerActivityMetaValue,
    renderDrawerActivityCard,
    renderDrawerActivitySection,
    renderDrawerTabPanel,
    renderDrawerTabs,
    renderDrawerBody,
    renderDrawerFooter,
    renderDrawerShell,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DrawerViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
