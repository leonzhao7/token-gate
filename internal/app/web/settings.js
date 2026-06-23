(function attachSettingsUtils(root, factory) {
  const exported = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
  root.SettingsUtils = exported;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createSettingsViewModel(snapshot) {
    const input = plainObject(snapshot);
    const backends = ensureArray(input.backends);
    const clients = ensureArray(input.clients);
    const proxies = ensureArray(input.proxies);
    const usageLogStats = plainObject(input.usageLogStats);
    const usageLogMeta = plainObject(input.usageLogMeta);
    const eventSummary = plainObject(input.eventSummary);

    const alerts = createAlerts({
      adminTokenPresent: Boolean(input.adminTokenPresent),
      backends,
      clients,
    });
    const normalBackends = countBackendsByStatus(backends, "normal");
    const abnormalBackends = countBackendsByStatus(backends, "abnormal");
    const disabledBackends = countBackendsByStatus(backends, "disabled");
    const enabledClients = countEnabled(clients);
    const enabledProxies = countEnabled(proxies);
    const backendsWithProxy = backends.filter((backend) => Number(backend?.proxy_id) > 0).length;
    const modelMappings = backends.reduce((total, backend) => total + objectSize(backend?.model_mapping), 0);
    const successCount = familyCount(usageLogStats.status_families, "2xx");
    const errorCount = familyCount(usageLogStats.status_families, "5xx");

    return {
      hero: {
        tone: alerts.length ? "warning" : "success",
        title: alerts.length ? "Configuration attention required" : "Control plane ready",
        description: alerts.length
          ? "Core access or backend configuration is incomplete. Resolve the highlighted setup items before relying on the console."
          : "Access, backend scheduling, and observability controls are aligned for day-to-day proxy operations.",
        badges: [
          {
            label: "Admin token",
            value: input.adminTokenPresent ? "Saved" : "Missing",
            tone: input.adminTokenPresent ? "success" : "warning",
          },
          {
            label: "Theme",
            value: themeDisplay(input.themePreference, input.resolvedTheme),
            tone: "neutral",
          },
          {
            label: "Sidebar",
            value: input.sidebarCollapsed ? "Collapsed" : "Expanded",
            tone: "primary",
          },
          {
            label: "Last sync",
            value: stringValue(input.lastRefreshLabel) || "Not synced yet",
            tone: input.lastRefreshLabel ? "neutral" : "warning",
          },
        ],
        actions: [
          { key: "refresh-data", label: "Refresh Data", tone: "primary" },
          { key: "focus-token", label: "Admin Session", tone: "ghost" },
          { key: "open-search", label: "Open Search", tone: "ghost" },
        ],
      },
      summaryCards: [
        {
          key: "backends",
          label: "Backends",
          value: backends.length,
          detail: `${normalBackends} normal / ${abnormalBackends} abnormal / ${disabledBackends} disabled`,
        },
        {
          key: "clients",
          label: "Client Keys",
          value: clients.length,
          detail: `${enabledClients} enabled / ${Math.max(0, clients.length - enabledClients)} disabled`,
        },
        {
          key: "proxies",
          label: "Proxies",
          value: proxies.length,
          detail: `${enabledProxies} enabled / ${Math.max(0, proxies.length - enabledProxies)} disabled`,
        },
      ],
      alerts,
      panels: [
        {
          key: "session",
          eyebrow: "Access",
          title: "Admin Session",
          description: "Store TG_ADMIN_TOKEN locally, keep inventory fresh, and recover quickly when access expires.",
          metrics: [
            { label: "Status", value: input.adminTokenPresent ? "Saved" : "Missing" },
            { label: "Last sync", value: stringValue(input.lastRefreshLabel) || "Not synced yet" },
            { label: "Inventory", value: inventoryLabel(backends.length, clients.length, proxies.length) },
            { label: "Scope", value: "Resources, usage, events" },
          ],
          actions: [
            { key: "focus-token", label: "Focus Token" },
            { key: "refresh-data", label: "Refresh Data" },
          ],
        },
        {
          key: "workspace",
          eyebrow: "Workspace",
          title: "Workspace Preferences",
          description: "Keep the shell compact, searchable, and theme-aware for long-running operator sessions.",
          metrics: [
            { label: "Theme", value: themeDisplay(input.themePreference, input.resolvedTheme) },
            { label: "Sidebar", value: input.sidebarCollapsed ? "Collapsed" : "Expanded" },
            { label: "Search", value: "Ctrl / Cmd + K" },
            { label: "Surface", value: input.resolvedTheme === "dark" ? "Dark console" : "Light console" },
          ],
          actions: [
            { key: "cycle-theme", label: "Cycle Theme" },
            { key: "toggle-sidebar", label: "Toggle Sidebar" },
            { key: "open-search", label: "Open Search" },
          ],
        },
        {
          key: "observability",
          eyebrow: "Observability",
          title: "Traffic Snapshot",
          description: "Review usage volume, event volume, and the latest status-family distribution without leaving Settings.",
          metrics: [
            { label: "Usage logs", value: integerLabel(usageLogMeta.total) },
            { label: "Events", value: integerLabel(eventSummary.total) },
            { label: "2xx success", value: integerLabel(successCount) },
            { label: "5xx errors", value: integerLabel(errorCount) },
          ],
          actions: [
            { key: "view-usage-logs", label: "Usage Logs" },
            { key: "view-events", label: "Events" },
          ],
        },
        {
          key: "routing",
          eyebrow: "Scheduling",
          title: "Backend Scheduling",
          description: "Track backend readiness, proxy attachment, model aliasing, and automatic recovery state from one place.",
          metrics: [
            { label: "Normal backends", value: integerLabel(normalBackends) },
            { label: "Abnormal backends", value: integerLabel(abnormalBackends) },
            { label: "Backends with proxy", value: integerLabel(backendsWithProxy) },
            { label: "Model mappings", value: integerLabel(modelMappings) },
          ],
          actions: [
            { key: "open-backends", label: "Backends" },
          ],
        },
      ],
    };
  }

  function renderSettingsPage(model) {
    const view = model && typeof model === "object" ? model : createSettingsViewModel({});
    const heroBadges = ensureArray(view.hero?.badges).map((badge) => `
      <article class="settings-hero-badge tone-${escapeHTML(badge.tone || "neutral")}">
        <span>${escapeHTML(badge.label || "-")}</span>
        <strong>${escapeHTML(badge.value || "-")}</strong>
      </article>
    `).join("");
    const heroActions = ensureArray(view.hero?.actions).map((action) => `
      <button
        class="${action.tone === "primary" ? "" : "ghost-button " }settings-action-button"
        type="button"
        data-settings-action="${escapeHTML(action.key || "")}"
      >
        ${escapeHTML(action.label || "Action")}
      </button>
    `).join("");
    const summaryCards = ensureArray(view.summaryCards).map((card) => `
      <article class="settings-summary-card">
        <span class="section-label">${escapeHTML(card.label || "-")}</span>
        <strong>${escapeHTML(integerLabel(card.value))}</strong>
        <p>${escapeHTML(card.detail || "-")}</p>
      </article>
    `).join("");
    const alerts = ensureArray(view.alerts).map((alert) => `
      <article class="settings-alert tone-${escapeHTML(alert.tone || "warning")}">
        <div class="settings-alert-copy">
          <strong>${escapeHTML(alert.title || "-")}</strong>
          <p>${escapeHTML(alert.body || "-")}</p>
        </div>
      </article>
    `).join("");
    const panels = ensureArray(view.panels).map((panel) => `
      <article class="settings-panel-card">
        <div class="settings-panel-head">
          <div>
            <span class="section-label">${escapeHTML(panel.eyebrow || "")}</span>
            <h3>${escapeHTML(panel.title || "-")}</h3>
          </div>
          <p>${escapeHTML(panel.description || "-")}</p>
        </div>
        <div class="settings-panel-metrics">
          ${ensureArray(panel.metrics).map((metric) => `
            <div class="settings-panel-metric">
              <span>${escapeHTML(metric.label || "-")}</span>
              <strong>${escapeHTML(metric.value || "-")}</strong>
            </div>
          `).join("")}
        </div>
        <div class="button-row compact settings-panel-actions">
          ${ensureArray(panel.actions).map((action) => `
            <button
              class="ghost-button settings-inline-action"
              type="button"
              data-settings-action="${escapeHTML(action.key || "")}"
            >
              ${escapeHTML(action.label || "Open")}
            </button>
          `).join("")}
        </div>
      </article>
    `).join("");

    return `
      <div class="settings-page-root">
        <section class="settings-hero tone-${escapeHTML(view.hero?.tone || "neutral")}">
          <div class="settings-hero-copy">
            <span class="section-label">System Overview</span>
            <h3>${escapeHTML(view.hero?.title || "Settings")}</h3>
            <p>${escapeHTML(view.hero?.description || "-")}</p>
          </div>
          <div class="settings-hero-side">
            <div class="settings-hero-badges">${heroBadges}</div>
            <div class="button-row compact settings-hero-actions">${heroActions}</div>
          </div>
        </section>
        <section class="settings-summary-grid">
          ${summaryCards}
        </section>
        ${alerts ? `
          <section class="settings-alert-stack">
            ${alerts}
          </section>
        ` : ""}
        <section class="settings-panel-grid">
          ${panels}
        </section>
      </div>
    `;
  }

  function createAlerts(input) {
    const alerts = [];
    if (!input.adminTokenPresent) {
      alerts.push({
        tone: "warning",
        title: "Save an admin token",
        body: "Store TG_ADMIN_TOKEN in the console before relying on resource or observability data.",
      });
    }
    if (!countBackendsByStatus(input.backends, "normal")) {
      alerts.push({
        tone: "warning",
        title: "Add a normal backend",
        body: "At least one normal backend is required before upstream traffic can be routed successfully.",
      });
    }
    if (!ensureArray(input.clients).length) {
      alerts.push({
        tone: "warning",
        title: "Create a client key",
        body: "Issue a client key so traffic can authenticate through the proxy layer.",
      });
    }
    return alerts;
  }

  function inventoryLabel(backends, clients, proxies) {
    return [
      `${integerLabel(backends)} backends`,
      `${integerLabel(clients)} keys`,
      `${integerLabel(proxies)} proxies`,
    ].join(" · ");
  }

  function themeDisplay(preference, resolvedTheme) {
    const resolved = stringValue(resolvedTheme) || "light";
    const normalizedPreference = stringValue(preference).toLowerCase();
    if (normalizedPreference === "system" || !normalizedPreference) {
      return `System / ${resolved}`;
    }
    return `${capitalize(normalizedPreference)} / ${resolved}`;
  }

  function familyCount(items, family) {
    return ensureArray(items).reduce((total, item) => {
      if (stringValue(item?.family).toLowerCase() === String(family || "").toLowerCase()) {
        return total + numberValue(item?.count);
      }
      return total;
    }, 0);
  }

  function countEnabled(items) {
    return ensureArray(items).filter((item) => Boolean(item?.enabled)).length;
  }

  function countBackendsByStatus(items, status) {
    return ensureArray(items).filter((item) => stringValue(item?.status || "normal").toLowerCase() === status).length;
  }

  function objectSize(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return 0;
    }
    return Object.keys(value).length;
  }

  function integerLabel(value) {
    return String(numberValue(value));
  }

  function capitalize(value) {
    const normalized = stringValue(value);
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
  }

  function plainObject(value) {
    return value && typeof value === "object" ? value : {};
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function stringValue(value) {
    return String(value || "").trim();
  }

  function numberValue(value) {
    return Number(value) || 0;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  return {
    createSettingsViewModel,
    renderSettingsPage,
  };
});
