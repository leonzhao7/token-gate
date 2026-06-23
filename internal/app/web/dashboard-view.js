(function initDashboardViewModule(globalScope) {
  const SUMMARY_ORDER = ["backends", "client_keys", "proxies"];

  function renderDashboardSummaryRow({ dashboard, renderSparkline, escapeHTML = defaultEscapeHTML }) {
    return SUMMARY_ORDER.map((key, index) => {
      const cardState = dashboard?.summaryCards?.[key];
      if (!cardState || cardState.status === "loading") {
        return renderDashboardLoadingCard("Loading summary", escapeHTML);
      }
      if (cardState.status === "failed") {
        return renderDashboardFailedCard({
          title: `Summary ${index + 1}`,
          description: cardState.error || "Summary unavailable",
          action: `summary:${key}`,
          escapeHTML,
        });
      }
      if (cardState.status === "empty" || !cardState.data) {
        return renderDashboardEmptyCard({
          title: `Summary ${index + 1}`,
          description: "No dashboard summary data yet.",
          escapeHTML,
        });
      }

      const card = cardState.data;
      const sparkline = typeof renderSparkline === "function"
        ? renderSparkline(card.sparkline, {
          width: 150,
          height: 54,
          padding: 5,
          className: `sparkline-chart tone-${escapeHTML(card.tone)}`,
        })
        : "";
      return `
        <article class="dashboard-card dashboard-summary-card">
          <div class="dashboard-card-head">
            <span class="section-label">Signal</span>
            <span class="dashboard-trend tone-${escapeHTML(card.tone)}">${escapeHTML(card.trend)}</span>
          </div>
          <div class="dashboard-card-value-row">
            <div>
              <strong>${escapeHTML(card.value)}</strong>
              <h3>${escapeHTML(card.label)}</h3>
              <p>${escapeHTML(card.detail)}</p>
            </div>
            ${sparkline}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderDashboardUsageCard({
    dashboard,
    createDashboardRangeOptions,
    renderAreaChart,
    escapeHTML = defaultEscapeHTML,
  }) {
    const usageState = dashboard?.usage || {};
    if (usageState.status === "loading") {
      return renderDashboardPanelFrame({
        eyebrow: "Usage Overview",
        title: "Traffic intelligence",
        body: renderDashboardLoadingCard("Loading usage", escapeHTML),
        escapeHTML,
      });
    }
    if (usageState.status === "failed") {
      return renderDashboardPanelFrame({
        eyebrow: "Usage Overview",
        title: "Traffic intelligence",
        body: renderDashboardFailedCard({
          title: "Usage unavailable",
          description: usageState.error || "Unable to fetch usage series.",
          action: "usage",
          escapeHTML,
        }),
        escapeHTML,
      });
    }
    if (usageState.status === "empty") {
      return renderDashboardPanelFrame({
        eyebrow: "Usage Overview",
        title: "Traffic intelligence",
        body: renderDashboardEmptyCard({
          title: "No usage yet",
          description: "Requests, traffic, and error rates will appear after proxy traffic arrives.",
          escapeHTML,
        }),
        escapeHTML,
      });
    }

    const usageData = usageState.data || { points: [], metrics: {} };
    const metrics = Object.values(usageData.metrics || {});
    const activeMetric = usageState.metric in (usageData.metrics || {}) ? usageState.metric : "requests";
    const selectedMetric = usageData.metrics?.[activeMetric];
    const values = usageData.points.map((point) => usageValueForMetric(point, activeMetric));
    const chart = typeof renderAreaChart === "function"
      ? renderAreaChart(values, usageData.points.map((point) => point.label), { width: 720, height: 260, padding: 22 })
      : "";
    const rangeOptions = typeof createDashboardRangeOptions === "function"
      ? createDashboardRangeOptions(usageData.range || usageState.range)
      : [];

    return renderDashboardPanelFrame({
      eyebrow: "Usage Overview",
      title: "Traffic intelligence",
      subtitle: `Range ${escapeHTML(usageData.range || usageState.range || "7d")}`,
      body: `
        <div class="dashboard-range-switch" role="tablist" aria-label="Usage range">
          ${ensureArray(rangeOptions).map((option) => `
            <button
              class="dashboard-range-chip ${option.active ? "active" : ""}"
              type="button"
              data-dashboard-range="${escapeHTML(option.key)}"
              aria-pressed="${String(option.active)}"
            >
              ${escapeHTML(option.label)}
            </button>
          `).join("")}
        </div>
        <div class="dashboard-metric-tabs" role="tablist" aria-label="Usage metrics">
          ${metrics.map((metric) => `
            <button
              class="dashboard-metric-tab ${metric.key === activeMetric ? "active" : ""}"
              type="button"
              data-dashboard-metric="${escapeHTML(metric.key)}"
              aria-pressed="${String(metric.key === activeMetric)}"
            >
              <span>${escapeHTML(metric.label)}</span>
              <strong>${escapeHTML(metric.value)}</strong>
              <small>${escapeHTML(metric.delta)}</small>
            </button>
          `).join("")}
        </div>
        <div class="dashboard-chart-stage">
          <div class="dashboard-chart-meta">
            <div>
              <span class="dashboard-chart-label">${escapeHTML(selectedMetric?.label || "Metric")}</span>
              <strong>${escapeHTML(selectedMetric?.value ?? "-")}</strong>
            </div>
            <span class="dashboard-chart-delta">${escapeHTML(selectedMetric?.delta || "")}</span>
          </div>
          ${chart}
        </div>
      `,
      escapeHTML,
    });
  }

  function renderDashboardEventsSummaryCard({ dashboard, escapeHTML = defaultEscapeHTML }) {
    const panelState = dashboard?.eventsSummary || {};
    if (panelState.status === "loading") {
      return renderDashboardPanelFrame({
        eyebrow: "Events Summary",
        title: "Control plane activity",
        body: renderDashboardLoadingCard("Loading events summary", escapeHTML),
        escapeHTML,
      });
    }
    if (panelState.status === "failed") {
      return renderDashboardPanelFrame({
        eyebrow: "Events Summary",
        title: "Control plane activity",
        body: renderDashboardFailedCard({
          title: "Events summary unavailable",
          description: panelState.error || "Unable to fetch recent activity.",
          action: "activity:eventsSummary",
          escapeHTML,
        }),
        escapeHTML,
      });
    }
    if (panelState.status === "empty") {
      return renderDashboardPanelFrame({
        eyebrow: "Events Summary",
        title: "Control plane activity",
        body: renderDashboardEmptyCard({
          title: "No recent control plane changes",
          description: "Warnings, errors, and change events will collect here.",
          escapeHTML,
        }),
        escapeHTML,
      });
    }

    const counters = ensureArray(panelState.data);
    return renderDashboardPanelFrame({
      eyebrow: "Events Summary",
      title: "Control plane activity",
      body: `
        <div class="dashboard-counter-grid">
          ${counters.map((counter) => `
            <article class="dashboard-counter tone-${escapeHTML(counter.tone)}">
              <small>${escapeHTML(counter.label)}</small>
              <strong>${escapeHTML(counter.count)}</strong>
            </article>
          `).join("")}
        </div>
      `,
      escapeHTML,
    });
  }

  function renderDashboardRecentEventsCard({
    dashboard,
    formatDateTime = identity,
    escapeHTML = defaultEscapeHTML,
    feedToneClass = defaultFeedToneClass,
  }) {
    return renderDashboardFeedPanel({
      eyebrow: "Recent Events",
      title: "Audit trail",
      stateValue: dashboard?.recentEvents || {},
      action: "activity:recentEvents",
      emptyTitle: "No recent events",
      emptyDescription: "Policy, backend, and key changes will surface here.",
      items: ensureArray(dashboard?.recentEvents?.data).map((event) => `
        <li class="dashboard-feed-item">
          <div class="dashboard-feed-copy">
            <strong>${escapeHTML(event.title)}</strong>
            <p>${escapeHTML(event.message || "No event message")}</p>
          </div>
          <div class="dashboard-feed-meta">
            <span class="status-pill ${feedToneClass(event.tone)}">${escapeHTML(formatDateTime(event.createdAt))}</span>
          </div>
        </li>
      `),
      escapeHTML,
    });
  }

  function renderDashboardRecentUsageCard({
    dashboard,
    formatDateTime = identity,
    escapeHTML = defaultEscapeHTML,
  }) {
    return renderDashboardFeedPanel({
      eyebrow: "Recent Usage",
      title: "Latest request samples",
      stateValue: dashboard?.recentUsage || {},
      action: "activity:recentUsage",
      emptyTitle: "No recent usage logs",
      emptyDescription: "Recent request samples will appear after traffic is proxied.",
      items: ensureArray(dashboard?.recentUsage?.data).map((entry) => `
        <li class="dashboard-feed-item">
          <div class="dashboard-feed-copy">
            <strong>${escapeHTML(entry.client)} · ${escapeHTML(entry.model)}</strong>
            <p>${escapeHTML(entry.backend)} · ${escapeHTML(entry.requestId)} · ${escapeHTML(entry.duration)} ms</p>
          </div>
          <div class="dashboard-feed-meta">
            <span class="status-pill ${Number(entry.status) >= 400 ? "off" : "ok"}">${escapeHTML(entry.status)}</span>
            <small>${escapeHTML(formatDateTime(entry.createdAt))}</small>
          </div>
        </li>
      `),
      escapeHTML,
    });
  }

  function renderDashboardFeedPanel({ eyebrow, title, stateValue, action, emptyTitle, emptyDescription, items, escapeHTML }) {
    let body = "";
    if (stateValue.status === "loading") {
      body = renderDashboardLoadingCard(`Loading ${title}`, escapeHTML);
    } else if (stateValue.status === "failed") {
      body = renderDashboardFailedCard({
        title: `${title} unavailable`,
        description: stateValue.error || `Unable to fetch ${title.toLowerCase()}.`,
        action,
        escapeHTML,
      });
    } else if (stateValue.status === "empty" || ensureArray(items).length === 0) {
      body = renderDashboardEmptyCard({
        title: emptyTitle,
        description: emptyDescription,
        escapeHTML,
      });
    } else {
      body = `<ul class="dashboard-feed-list">${items.join("")}</ul>`;
    }

    return renderDashboardPanelFrame({ eyebrow, title, body, escapeHTML });
  }

  function renderDashboardPanelFrame({ eyebrow, title, subtitle = "", body, escapeHTML }) {
    return `
      <div class="dashboard-panel-head">
        <div>
          <span class="section-label">${escapeHTML(eyebrow)}</span>
          <h3>${escapeHTML(title)}</h3>
          ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ""}
        </div>
      </div>
      <div class="dashboard-panel-body">
        ${body}
      </div>
    `;
  }

  function renderDashboardLoadingCard(label, escapeHTML) {
    return `
      <div class="dashboard-state dashboard-state-loading" aria-busy="true">
        <span class="dashboard-state-shimmer"></span>
        <strong>${escapeHTML(label)}</strong>
        <p>Fetching the latest dashboard data.</p>
      </div>
    `;
  }

  function renderDashboardFailedCard({ title, description, action, escapeHTML }) {
    return `
      <div class="dashboard-state dashboard-state-failed">
        <strong>${escapeHTML(title)}</strong>
        <p>${escapeHTML(description)}</p>
        <button class="ghost-button" type="button" data-dashboard-retry="${escapeHTML(action)}">Retry</button>
      </div>
    `;
  }

  function renderDashboardEmptyCard({ title, description, escapeHTML }) {
    return `
      <div class="dashboard-state dashboard-state-empty">
        <strong>${escapeHTML(title)}</strong>
        <p>${escapeHTML(description)}</p>
      </div>
    `;
  }

  function renderSparkline(values, { width, height, padding, className = "" }, chartsUtils = {}) {
    const points = typeof chartsUtils.createSparklinePoints === "function"
      ? chartsUtils.createSparklinePoints(values, { width, height, padding })
      : [];
    if (points.length === 0) {
      return `<div class="dashboard-chart-empty">No trend</div>`;
    }
    const linePath = typeof chartsUtils.createLinePath === "function" ? chartsUtils.createLinePath(points) : "";
    const areaPath = typeof chartsUtils.createAreaPath === "function" ? chartsUtils.createAreaPath(points, { height, padding }) : "";
    return `
      <svg class="${defaultEscapeHTML(className)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend sparkline">
        <path class="sparkline-area" d="${defaultEscapeHTML(areaPath)}"></path>
        <path class="sparkline-line" d="${defaultEscapeHTML(linePath)}"></path>
      </svg>
    `;
  }

  function renderAreaChart(values, labels, { width, height, padding }, chartsUtils = {}) {
    const points = typeof chartsUtils.createSparklinePoints === "function"
      ? chartsUtils.createSparklinePoints(values, { width, height, padding })
      : [];
    if (points.length === 0) {
      return `<div class="dashboard-chart-empty">No chart data</div>`;
    }
    const linePath = typeof chartsUtils.createLinePath === "function" ? chartsUtils.createLinePath(points) : "";
    const areaPath = typeof chartsUtils.createAreaPath === "function" ? chartsUtils.createAreaPath(points, { height, padding }) : "";
    return `
      <div class="dashboard-area-chart">
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Usage overview chart">
          <defs>
            <linearGradient id="usageAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.28"></stop>
              <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.02"></stop>
            </linearGradient>
          </defs>
          <path class="usage-area-path" d="${defaultEscapeHTML(areaPath)}"></path>
          <path class="usage-line-path" d="${defaultEscapeHTML(linePath)}"></path>
          ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="3.2"></circle>`).join("")}
        </svg>
        <div class="dashboard-chart-axis">
          ${labels.map((label) => `<span>${defaultEscapeHTML(label)}</span>`).join("")}
        </div>
      </div>
    `;
  }

  function usageValueForMetric(point, metric) {
    if (metric === "traffic") {
      return Number(point?.trafficBytes) || 0;
    }
    if (metric === "errors") {
      return (Number(point?.errorRate) || 0) * 100;
    }
    return Number(point?.requests) || 0;
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
    renderAreaChart,
    renderDashboardSummaryRow,
    renderDashboardUsageCard,
    renderDashboardEventsSummaryCard,
    renderDashboardRecentEventsCard,
    renderDashboardRecentUsageCard,
    renderSparkline,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DashboardViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
