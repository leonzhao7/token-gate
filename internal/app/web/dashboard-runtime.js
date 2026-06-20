(function initDashboardRuntimeModule(globalScope) {
  function startDashboardLoading({ state }) {
    Object.values(state?.dashboard?.summaryCards || {}).forEach((cardState) => {
      cardState.status = "loading";
      cardState.error = "";
      cardState.data = null;
    });

    if (state?.dashboard?.usage) {
      state.dashboard.usage.status = "loading";
      state.dashboard.usage.error = "";
      state.dashboard.usage.data = null;
    }

    [state?.dashboard?.eventsSummary, state?.dashboard?.recentEvents, state?.dashboard?.recentUsage].forEach((panelState) => {
      if (!panelState) {
        return;
      }
      panelState.status = "loading";
      panelState.error = "";
      panelState.data = null;
    });
  }

  function renderDashboardShell({
    state,
    dashboardRoot,
    dashboardSummaryRow,
    dashboardUsageCard,
    dashboardEventsSummaryCard,
    dashboardRecentEventsCard,
    dashboardRecentUsageCard,
    renderSummaryRow,
    renderUsageCard,
    renderEventsSummaryCard,
    renderRecentEventsCard,
    renderRecentUsageCard,
    bindInteractions,
  }) {
    if (!dashboardRoot) {
      return;
    }

    dashboardRoot.dataset.theme = state?.ui?.theme || "";
    if (dashboardSummaryRow) {
      dashboardSummaryRow.innerHTML = typeof renderSummaryRow === "function" ? renderSummaryRow() : "";
    }
    if (dashboardUsageCard) {
      dashboardUsageCard.innerHTML = typeof renderUsageCard === "function" ? renderUsageCard() : "";
    }
    if (dashboardEventsSummaryCard) {
      dashboardEventsSummaryCard.innerHTML = typeof renderEventsSummaryCard === "function" ? renderEventsSummaryCard() : "";
    }
    if (dashboardRecentEventsCard) {
      dashboardRecentEventsCard.innerHTML = typeof renderRecentEventsCard === "function" ? renderRecentEventsCard() : "";
    }
    if (dashboardRecentUsageCard) {
      dashboardRecentUsageCard.innerHTML = typeof renderRecentUsageCard === "function" ? renderRecentUsageCard() : "";
    }
    if (typeof bindInteractions === "function") {
      bindInteractions({ dashboardRoot });
    }
  }

  const api = {
    renderDashboardShell,
    startDashboardLoading,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DashboardRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
