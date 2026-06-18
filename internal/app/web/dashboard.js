(function attachDashboardUtils(root, factory) {
  const exported = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
  root.DashboardUtils = exported;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const SUMMARY_CARD_DEFINITIONS = [
    {
      key: "backends",
      label: "Backends",
      countKey: "backends",
      growthKey: "requests",
      detail(summary) {
        const total = numberValue(summary?.counts?.backends);
        const healthy = numberValue(summary?.status?.healthy_backends);
        return `${healthy} healthy / ${Math.max(0, total - healthy)} attention`;
      },
    },
    {
      key: "client_keys",
      label: "Client Keys",
      countKey: "client_keys",
      growthKey: "requests",
      detail(summary) {
        return `${numberValue(summary?.status?.active_clients)} active clients`;
      },
    },
    {
      key: "policies",
      label: "Policies",
      countKey: "model_policies",
      growthKey: "errors",
      detail(summary) {
        return `${numberValue(summary?.status?.recent_errors)} recent errors`;
      },
    },
    {
      key: "proxies",
      label: "Proxies",
      countKey: "socks_proxies",
      growthKey: "errors",
      detail(summary) {
        return `${numberValue(summary?.status?.active_clients)} active clients`;
      },
    },
  ];

  const ACTIVITY_COUNTER_DEFINITIONS = [
    { key: "warning", label: "Warnings", tone: "warning" },
    { key: "error", label: "Errors", tone: "danger" },
    { key: "policy", label: "Policy Changes", tone: "primary" },
    { key: "key", label: "Key Creations", tone: "neutral" },
    { key: "backend", label: "Backend Updates", tone: "success" },
  ];

  function createDashboardState() {
    return {
      summaryCards: {
        backends: createPanelState(),
        client_keys: createPanelState(),
        policies: createPanelState(),
        proxies: createPanelState(),
      },
      usage: createPanelState({ metric: "requests", range: "7d" }),
      eventsSummary: createPanelState(),
      recentEvents: createPanelState(),
      recentUsage: createPanelState(),
    };
  }

  function createDashboardSummaryCards(summary) {
    const sparkline = ensureArray(summary?.sparkline).map((point) => numberValue(point?.requests));
    return SUMMARY_CARD_DEFINITIONS.map((definition) => {
      const rawTrend = numberValue(summary?.growth?.[definition.growthKey]);
      return {
        key: definition.key,
        label: definition.label,
        value: numberValue(summary?.counts?.[definition.countKey]),
        trend: formatSignedPercent(rawTrend),
        tone: rawTrend >= 0 ? "positive" : "warning",
        detail: definition.detail(summary),
        sparkline,
      };
    });
  }

  function createDashboardUsageState(usage) {
    const points = ensureArray(usage?.series).map((point) => ({
      label: String(point?.label || ""),
      requests: numberValue(point?.requests),
      trafficBytes: numberValue(point?.traffic_bytes),
      errorRate: decimalValue(point?.error_rate),
    }));
    const requestValues = points.map((point) => point.requests);
    const trafficValues = points.map((point) => point.trafficBytes);
    const errorValues = points.map((point) => point.errorRate * 100);

    return {
      range: String(usage?.range || "7d"),
      points,
      metrics: {
        requests: {
          key: "requests",
          label: "Daily Requests",
          value: requestValues.reduce((total, value) => total + value, 0),
          delta: formatSignedNumber(rangeDelta(requestValues)),
        },
        traffic: {
          key: "traffic",
          label: "Traffic",
          value: formatBytes(trafficValues.reduce((total, value) => total + value, 0)),
          delta: formatSignedBytes(rangeDelta(trafficValues)),
        },
        errors: {
          key: "errors",
          label: "Error Rate",
          value: formatPercent(errorValues[errorValues.length - 1] || 0),
          delta: formatSignedPercent(-rangeDelta(errorValues), 1),
        },
      },
    };
  }

  function createDashboardActivityState(activity) {
    const counts = ACTIVITY_COUNTER_DEFINITIONS.reduce((accumulator, definition) => {
      accumulator[definition.key] = 0;
      return accumulator;
    }, {});

    ensureArray(activity?.summary).forEach((item) => {
      const key = normalizeActivityCategory(item?.category);
      if (key) {
        counts[key] += numberValue(item?.count);
      }
    });

    return {
      counters: ACTIVITY_COUNTER_DEFINITIONS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        count: counts[definition.key] || 0,
        tone: definition.tone,
      })),
      events: ensureArray(activity?.events).slice(0, 5).map((event) => ({
        id: event?.id ?? null,
        title: String(event?.type || "event"),
        message: String(event?.message || ""),
        createdAt: String(event?.created_at || ""),
        tone: eventTone(event),
      })),
      usage: ensureArray(activity?.usage).slice(0, 5).map((entry) => ({
        id: entry?.id ?? null,
        requestId: String(entry?.request_id || "-"),
        client: String(entry?.client_name || "-"),
        model: String(entry?.model || "-"),
        backend: String(entry?.backend_name || "-"),
        status: String(entry?.status_code || "-"),
        duration: numberValue(entry?.duration_ms),
        createdAt: String(entry?.created_at || ""),
      })),
    };
  }

  function applyDashboardSummaryPayload(state, summary) {
    const cards = createDashboardSummaryCards(summary);
    const cardMap = cards.reduce((accumulator, card) => {
      accumulator[card.key] = card;
      return accumulator;
    }, {});

    Object.keys(state?.summaryCards || {}).forEach((key) => {
      const nextCard = cardMap[key] || null;
      state.summaryCards[key].data = nextCard;
      state.summaryCards[key].error = "";
      state.summaryCards[key].status = nextCard ? "ready" : "empty";
    });
  }

  function applyDashboardSummaryError(state, message) {
    Object.keys(state?.summaryCards || {}).forEach((key) => {
      state.summaryCards[key].data = null;
      state.summaryCards[key].error = String(message || "Failed to load summary");
      state.summaryCards[key].status = "failed";
    });
  }

  function applyDashboardActivityPayload(state, activity) {
    const normalized = createDashboardActivityState(activity);
    applyPanelState(state?.eventsSummary, normalized.counters, (items) => ensureArray(items).some((item) => numberValue(item?.count) > 0));
    applyPanelState(state?.recentEvents, normalized.events, (items) => ensureArray(items).length > 0);
    applyPanelState(state?.recentUsage, normalized.usage, (items) => ensureArray(items).length > 0);
  }

  function applyDashboardActivityError(state, message) {
    [state?.eventsSummary, state?.recentEvents, state?.recentUsage].forEach((panelState) => {
      if (!panelState) {
        return;
      }
      panelState.data = null;
      panelState.error = String(message || "Failed to load activity");
      panelState.status = "failed";
    });
  }

  function createPanelState(extra = {}) {
    return {
      status: "loading",
      data: null,
      error: "",
      ...extra,
    };
  }

  function applyPanelState(panelState, data, hasContent) {
    if (!panelState) {
      return;
    }
    panelState.data = data;
    panelState.error = "";
    panelState.status = hasContent(data) ? "ready" : "empty";
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function numberValue(value) {
    return Number(value) || 0;
  }

  function decimalValue(value) {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  function rangeDelta(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    return Math.max(...values) - Math.min(...values);
  }

  function formatSignedNumber(value) {
    const normalized = numberValue(value);
    const prefix = normalized >= 0 ? "+" : "";
    return `${prefix}${Math.round(normalized)}`;
  }

  function formatSignedPercent(value, precision = 1) {
    const normalized = decimalValue(value);
    const prefix = normalized >= 0 ? "+" : "";
    return `${prefix}${normalized.toFixed(precision)}%`;
  }

  function formatPercent(value) {
    return `${decimalValue(value).toFixed(1)}%`;
  }

  function formatSignedBytes(value) {
    const normalized = numberValue(value);
    const prefix = normalized >= 0 ? "+" : "";
    return `${prefix}${formatBytes(Math.abs(normalized))}`;
  }

  function formatBytes(value) {
    const normalized = Math.max(0, numberValue(value));
    if (normalized < 1024) {
      return `${normalized} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let size = normalized / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  function normalizeActivityCategory(category) {
    const normalized = String(category || "").trim().toLowerCase();
    if (!normalized) {
      return "";
    }
    if (normalized === "warning" || normalized === "warn") {
      return "warning";
    }
    if (normalized === "error" || normalized === "errors") {
      return "error";
    }
    if (normalized === "policy" || normalized.startsWith("policy.")) {
      return "policy";
    }
    if (normalized === "key" || normalized.startsWith("key.") || normalized.startsWith("client")) {
      return "key";
    }
    if (normalized === "backend" || normalized.startsWith("backend.")) {
      return "backend";
    }
    return "";
  }

  function eventTone(event) {
    const level = String(event?.level || "").trim().toLowerCase();
    if (level === "error") {
      return "danger";
    }
    if (level === "warn" || level === "warning") {
      return "warning";
    }
    return "neutral";
  }

  return {
    applyDashboardActivityError,
    applyDashboardActivityPayload,
    applyDashboardSummaryError,
    applyDashboardSummaryPayload,
    createDashboardState,
    createDashboardActivityState,
    createDashboardSummaryCards,
    createDashboardUsageState,
  };
});
