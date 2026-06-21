(function initDashboardRuntimeModule(globalScope) {
  function setPanelLoading(panelState) {
    if (!panelState) {
      return;
    }
    panelState.status = "loading";
    panelState.error = "";
    panelState.data = null;
  }

  function setPanelFailure(panelState, message) {
    if (!panelState) {
      return;
    }
    panelState.status = "failed";
    panelState.error = message;
    panelState.data = null;
  }

  function startDashboardLoading({ state }) {
    Object.values(state?.dashboard?.summaryCards || {}).forEach((cardState) => {
      setPanelLoading(cardState);
    });

    if (state?.dashboard?.usage) {
      setPanelLoading(state.dashboard.usage);
    }

    [state?.dashboard?.eventsSummary, state?.dashboard?.recentEvents, state?.dashboard?.recentUsage].forEach((panelState) => {
      setPanelLoading(panelState);
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

  function renderDashboardPanels({
    dashboard,
    dashboardUtils,
    dashboardViewUtils,
    renderSparkline,
    renderAreaChart,
    formatDateTime,
    feedToneClass,
    escapeHTML,
  }) {
    return {
      summary: typeof dashboardViewUtils?.renderDashboardSummaryRow === "function"
        ? dashboardViewUtils.renderDashboardSummaryRow({
          dashboard,
          renderSparkline,
          escapeHTML,
        })
        : "",
      usage: typeof dashboardViewUtils?.renderDashboardUsageCard === "function"
        ? dashboardViewUtils.renderDashboardUsageCard({
          dashboard,
          createDashboardRangeOptions: dashboardUtils?.createDashboardRangeOptions,
          renderAreaChart,
          escapeHTML,
        })
        : "",
      eventsSummary: typeof dashboardViewUtils?.renderDashboardEventsSummaryCard === "function"
        ? dashboardViewUtils.renderDashboardEventsSummaryCard({
          dashboard,
          escapeHTML,
        })
        : "",
      recentEvents: typeof dashboardViewUtils?.renderDashboardRecentEventsCard === "function"
        ? dashboardViewUtils.renderDashboardRecentEventsCard({
          dashboard,
          formatDateTime,
          escapeHTML,
          feedToneClass,
        })
        : "",
      recentUsage: typeof dashboardViewUtils?.renderDashboardRecentUsageCard === "function"
        ? dashboardViewUtils.renderDashboardRecentUsageCard({
          dashboard,
          formatDateTime,
          escapeHTML,
        })
        : "",
    };
  }

  function bindDashboardInteractions({
    dashboardRoot,
    state,
    renderDashboardShell,
    refreshDashboardUsagePanel,
    retryDashboardSection,
    reportError,
  }) {
    dashboardRoot?.querySelectorAll("[data-dashboard-range]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextRange = button.dataset.dashboardRange || "7d";
        if (state?.dashboard?.usage?.range === nextRange) {
          return;
        }
        state.dashboard.usage.range = nextRange;
        Promise.resolve(refreshDashboardUsagePanel?.()).catch(reportError);
      });
    });

    dashboardRoot?.querySelectorAll("[data-dashboard-metric]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!state?.dashboard?.usage) {
          return;
        }
        state.dashboard.usage.metric = button.dataset.dashboardMetric || "requests";
        renderDashboardShell?.();
      });
    });

    dashboardRoot?.querySelectorAll("[data-dashboard-retry]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.dashboardRetry || "";
        Promise.resolve(retryDashboardSection?.(target)).catch(reportError);
      });
    });
  }

  async function refreshDashboardUsagePanel({
    state,
    api,
    dashboardUtils,
    renderDashboardShell,
  }) {
    const usageState = state?.dashboard?.usage;
    if (!usageState) {
      return;
    }

    setPanelLoading(usageState);
    renderDashboardShell?.();
    try {
      const payload = await api?.(`/admin/api/dashboard/usage?range=${encodeURIComponent(usageState.range)}`);
      usageState.data = typeof dashboardUtils?.createDashboardUsageState === "function"
        ? dashboardUtils.createDashboardUsageState(payload)
        : null;
      usageState.status = (usageState.data?.points || []).length ? "ready" : "empty";
      usageState.error = "";
    } catch (error) {
      usageState.status = "failed";
      usageState.error = error?.message || "Failed to load usage";
      usageState.data = null;
    }
    renderDashboardShell?.();
  }

  async function retryDashboardSection({
    target,
    state,
    api,
    dashboardUtils,
    startDashboardLoading: startDashboardLoadingFn,
    renderDashboardShell,
    refreshDashboardData,
  }) {
    if (target.startsWith("summary:")) {
      const targetKey = target.slice("summary:".length);
      const cardState = state?.dashboard?.summaryCards?.[targetKey];
      if (!cardState) {
        return;
      }
      setPanelLoading(cardState);
      renderDashboardShell?.();
      try {
        const payload = await api?.("/admin/api/dashboard/summary");
        if (typeof dashboardUtils?.applyDashboardSummaryPayload === "function") {
          dashboardUtils.applyDashboardSummaryPayload(state.dashboard, payload, targetKey);
        } else {
          const cards = typeof dashboardUtils?.createDashboardSummaryCards === "function"
            ? dashboardUtils.createDashboardSummaryCards(payload)
            : [];
          const cardsByKey = cards.reduce((accumulator, card) => {
            accumulator[card.key] = card;
            return accumulator;
          }, {});
          cardState.data = cardsByKey[targetKey] || null;
          cardState.error = "";
          cardState.status = cardState.data ? "ready" : "empty";
        }
      } catch (error) {
        if (typeof dashboardUtils?.applyDashboardSummaryError === "function") {
          dashboardUtils.applyDashboardSummaryError(state.dashboard, error?.message || "Failed to load summary", targetKey);
        } else {
          setPanelFailure(cardState, error?.message || "Failed to load summary");
        }
      }
      renderDashboardShell?.();
      return;
    }

    if (target === "usage") {
      const usageState = state?.dashboard?.usage;
      if (!usageState) {
        return;
      }
      usageState.status = "loading";
      renderDashboardShell?.();
      try {
        const payload = await api?.(`/admin/api/dashboard/usage?range=${encodeURIComponent(usageState.range)}`);
        usageState.data = typeof dashboardUtils?.createDashboardUsageState === "function"
          ? dashboardUtils.createDashboardUsageState(payload)
          : null;
        usageState.status = (usageState.data?.points || []).length ? "ready" : "empty";
        usageState.error = "";
      } catch (error) {
        usageState.status = "failed";
        usageState.error = error?.message || "Failed to load usage";
      }
      renderDashboardShell?.();
      return;
    }

    if (target.startsWith("activity:")) {
      const targetKey = target.slice("activity:".length);
      const panelState = state?.dashboard?.[targetKey];
      if (!panelState) {
        return;
      }
      setPanelLoading(panelState);
      renderDashboardShell?.();
      try {
        const payload = await api?.("/admin/api/dashboard/activity");
        if (typeof dashboardUtils?.applyDashboardActivityPayload === "function") {
          dashboardUtils.applyDashboardActivityPayload(state.dashboard, payload, targetKey);
        } else {
          const activityData = typeof dashboardUtils?.createDashboardActivityState === "function"
            ? dashboardUtils.createDashboardActivityState(payload)
            : { counters: [], events: [], usage: [] };
          if (targetKey === "eventsSummary") {
            panelState.data = activityData.counters;
            panelState.error = "";
            panelState.status = (activityData.counters || []).some((item) => Number(item.count) > 0) ? "ready" : "empty";
          }
          if (targetKey === "recentEvents") {
            panelState.data = activityData.events;
            panelState.error = "";
            panelState.status = (activityData.events || []).length ? "ready" : "empty";
          }
          if (targetKey === "recentUsage") {
            panelState.data = activityData.usage;
            panelState.error = "";
            panelState.status = (activityData.usage || []).length ? "ready" : "empty";
          }
        }
      } catch (error) {
        if (typeof dashboardUtils?.applyDashboardActivityError === "function") {
          dashboardUtils.applyDashboardActivityError(state.dashboard, error?.message || "Failed to load activity", targetKey);
        } else {
          setPanelFailure(panelState, error?.message || "Failed to load activity");
        }
      }
      renderDashboardShell?.();
      return;
    }

    startDashboardLoadingFn?.();
    renderDashboardShell?.();
    await refreshDashboardData?.();
  }

  const api = {
    bindDashboardInteractions,
    refreshDashboardUsagePanel,
    renderDashboardPanels,
    renderDashboardShell,
    retryDashboardSection,
    startDashboardLoading,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DashboardRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
