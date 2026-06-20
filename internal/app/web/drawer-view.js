(function initDrawerViewModule(globalScope) {
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

    return `
      <div class="drawer-kv-grid">
        ${entries.map(([key, entryValue]) => `
          <article class="drawer-kv-card">
            <small>${escapeHTML(humanizeKey(key))}</small>
            <strong>${escapeHTML(formatDrawerValue(entryValue))}</strong>
          </article>
        `).join("")}
      </div>
    `;
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
