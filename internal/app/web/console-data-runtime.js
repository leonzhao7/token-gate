(function initConsoleDataRuntimeModule(globalScope) {
  async function refreshDashboardData({
    state,
    api,
    dashboardUtils,
    renderDashboardShell,
  }) {
    const usageRange = state.dashboard.usage.range || "7d";
    const requests = [
      api("/admin/api/dashboard/summary")
        .then((payload) => {
          if (typeof dashboardUtils?.applyDashboardSummaryPayload === "function") {
            dashboardUtils.applyDashboardSummaryPayload(state.dashboard, payload);
            return;
          }
          const cards = typeof dashboardUtils?.createDashboardSummaryCards === "function"
            ? dashboardUtils.createDashboardSummaryCards(payload)
            : [];
          const cardsByKey = cards.reduce((accumulator, card) => {
            accumulator[card.key] = card;
            return accumulator;
          }, {});
          Object.entries(state.dashboard.summaryCards || {}).forEach(([key, cardState]) => {
            cardState.data = cardsByKey[key] || null;
            cardState.error = "";
            cardState.status = cardState.data ? "ready" : "empty";
          });
        })
        .catch((error) => {
          if (typeof dashboardUtils?.applyDashboardSummaryError === "function") {
            dashboardUtils.applyDashboardSummaryError(state.dashboard, error?.message || "Failed to load summary");
            return;
          }
          Object.values(state.dashboard.summaryCards || {}).forEach((cardState) => {
            cardState.status = "failed";
            cardState.error = error?.message || "Failed to load summary";
            cardState.data = null;
          });
        })
        .finally(() => {
          renderDashboardShell?.();
        }),
      api(`/admin/api/dashboard/usage?range=${encodeURIComponent(usageRange)}`)
        .then((payload) => {
          state.dashboard.usage.status = "ready";
          state.dashboard.usage.data = typeof dashboardUtils?.createDashboardUsageState === "function"
            ? dashboardUtils.createDashboardUsageState(payload)
            : null;
          state.dashboard.usage.error = "";
        })
        .catch((error) => {
          state.dashboard.usage.status = "failed";
          state.dashboard.usage.error = error?.message || "Failed to load usage";
          state.dashboard.usage.data = null;
        })
        .finally(() => {
          if (state.dashboard.usage.status === "ready" && !(state.dashboard.usage.data?.points || []).length) {
            state.dashboard.usage.status = "empty";
          }
          renderDashboardShell?.();
        }),
      api("/admin/api/dashboard/activity")
        .then((payload) => {
          if (typeof dashboardUtils?.applyDashboardActivityPayload === "function") {
            dashboardUtils.applyDashboardActivityPayload(state.dashboard, payload);
            return;
          }
          const activityState = typeof dashboardUtils?.createDashboardActivityState === "function"
            ? dashboardUtils.createDashboardActivityState(payload)
            : { counters: [], events: [], usage: [] };
          state.dashboard.eventsSummary.data = activityState.counters;
          state.dashboard.eventsSummary.error = "";
          state.dashboard.eventsSummary.status = (activityState.counters || []).some((item) => Number(item.count) > 0) ? "ready" : "empty";
          state.dashboard.recentEvents.data = activityState.events;
          state.dashboard.recentEvents.error = "";
          state.dashboard.recentEvents.status = (activityState.events || []).length ? "ready" : "empty";
          state.dashboard.recentUsage.data = activityState.usage;
          state.dashboard.recentUsage.error = "";
          state.dashboard.recentUsage.status = (activityState.usage || []).length ? "ready" : "empty";
        })
        .catch((error) => {
          if (typeof dashboardUtils?.applyDashboardActivityError === "function") {
            dashboardUtils.applyDashboardActivityError(state.dashboard, error?.message || "Failed to load activity");
            return;
          }
          [state.dashboard.eventsSummary, state.dashboard.recentEvents, state.dashboard.recentUsage].forEach((panelState) => {
            panelState.status = "failed";
            panelState.error = error?.message || "Failed to load activity";
            panelState.data = null;
          });
        })
        .finally(() => {
          renderDashboardShell?.();
        }),
    ];

    await Promise.allSettled(requests);
  }

  async function refreshAll({
    state,
    startDashboardLoading,
    renderDashboardShell,
    refreshDashboardData,
    reportError,
    buildUsageLogQuery,
    buildEventQuery,
    buildEventSummaryQuery,
    buildUsageLogStatsQuery,
    fetchAllCollectionPages,
    api,
    displayUtils,
    paginationUtils,
    resourceStateUtils,
    pageSizeOptions,
    renderProxyOptions,
    renderUsageLogFilterOptions,
    renderProxies,
    renderBackends,
    renderClients,
    renderPolicies,
    renderEvents,
    renderUsageLogs,
    renderDrawerShell,
    renderSearchShell,
    renderTheme,
  }) {
    startDashboardLoading?.();
    renderDashboardShell?.();
    const dashboardRefresh = Promise.resolve(refreshDashboardData?.()).catch(reportError);

    const eventPage = state.pagination.events;
    const usageLogPage = state.pagination.usageLogs;
    const usageLogQuery = buildUsageLogQuery?.() || "";
    const eventQuery = buildEventQuery?.() || "";
    const [proxies, backends, clients, policies, events, eventSummary, usageLogs, usageLogStats, usageLogOptions] = await Promise.all([
      fetchAllCollectionPages("/admin/api/socks-proxies"),
      fetchAllCollectionPages("/admin/api/backends"),
      fetchAllCollectionPages("/admin/api/client-keys"),
      fetchAllCollectionPages("/admin/api/model-policies"),
      api(`/admin/api/events?page=${eventPage.page}&limit=${eventPage.size}${eventQuery}`),
      api(`/admin/api/events/summary?${buildEventSummaryQuery?.() || ""}`),
      api(`/admin/api/usage-logs?page=${usageLogPage.page}&limit=${usageLogPage.size}${usageLogQuery}`),
      api(`/admin/api/usage-logs/stats?${buildUsageLogStatsQuery?.() || ""}`),
      api("/admin/api/usage-log-options"),
    ]);

    state.proxies = displayUtils.ensureArray(proxies);
    state.backends = displayUtils.ensureArray(backends);
    state.clients = displayUtils.ensureArray(clients);
    state.policies = displayUtils.ensureArray(policies);
    paginationUtils.applyPagedResponse("events", events, state, {
      pageSizeOptions,
      resourceStateUtils,
    });
    paginationUtils.applyPagedResponse("usageLogs", usageLogs, state, {
      pageSizeOptions,
      resourceStateUtils,
    });
    state.eventSummary = eventSummary;
    state.usageLogStats = usageLogStats;
    state.usageLogOptions.backends = displayUtils.ensureArray(usageLogOptions?.backends);
    state.usageLogOptions.models = displayUtils.ensureArray(usageLogOptions?.models);
    state.usageLogOptions.clientKeys = displayUtils.ensureArray(usageLogOptions?.client_keys);
    state.usageLogOptions.policies = displayUtils.ensureArray(usageLogOptions?.policies);
    state.usageLogOptions.proxies = displayUtils.ensureArray(usageLogOptions?.proxies);
    state.ui.lastRefreshAt = new Date().toISOString();

    renderProxyOptions?.();
    renderUsageLogFilterOptions?.();
    renderProxies?.();
    renderBackends?.();
    renderClients?.();
    renderPolicies?.();
    renderEvents?.();
    renderUsageLogs?.();
    renderDashboardShell?.();
    renderDrawerShell?.();
    renderSearchShell?.();
    renderTheme?.();
    await dashboardRefresh;
  }

  async function handleSettingsAction({
    action,
    tokenInput,
    refreshAll,
    cycleThemePreference,
    toggleSidebarCollapsed,
    openSearchShell,
    navigateToPage,
  }) {
    const normalized = String(action || "").trim();
    if (!normalized) {
      return;
    }
    if (normalized === "focus-token") {
      tokenInput?.focus();
      return;
    }
    if (normalized === "refresh-data") {
      await refreshAll?.();
      return;
    }
    if (normalized === "cycle-theme") {
      cycleThemePreference?.();
      return;
    }
    if (normalized === "toggle-sidebar") {
      toggleSidebarCollapsed?.();
      return;
    }
    if (normalized === "open-search") {
      openSearchShell?.();
      return;
    }
    if (normalized === "view-usage-logs") {
      navigateToPage?.("usage-logs");
      return;
    }
    if (normalized === "view-events") {
      navigateToPage?.("events");
      return;
    }
    if (normalized === "open-backends") {
      navigateToPage?.("backends");
      return;
    }
    if (normalized === "open-policies") {
      navigateToPage?.("model-policies");
    }
  }

  const api = {
    refreshDashboardData,
    refreshAll,
    handleSettingsAction,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ConsoleDataRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
