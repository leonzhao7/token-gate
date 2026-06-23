(function initObservabilityRuntimeModule(globalScope) {
  function buildUsageLogQuery({
    state,
    observabilityUtils,
  }) {
    const query = observabilityUtils.buildUsageLogQueryParams(state.usageLogFilters);
    return query ? `&${query}` : "";
  }

  function buildUsageLogStatsQuery({
    state,
    observabilityUtils,
  }) {
    return observabilityUtils.buildUsageLogQueryParams(state.usageLogFilters);
  }

  function buildEventQuery({
    state,
    observabilityUtils,
  }) {
    const query = observabilityUtils.buildEventQueryParams(state.eventFilters);
    return query ? `&${query}` : "";
  }

  function buildEventSummaryQuery({
    state,
    observabilityUtils,
  }) {
    const query = buildEventQuery({ state, observabilityUtils });
    return query.startsWith("&") ? query.slice(1) : query;
  }

  function syncEventFilterInputs({
    state,
    eventQueryFilter,
    eventActorFilter,
    eventBackendFilter,
    eventCategoryFilter,
    eventSeverityFilter,
    eventDateFromFilter,
    eventDateToFilter,
  }) {
    if (eventQueryFilter) {
      eventQueryFilter.value = state.eventFilters.q;
    }
    if (eventActorFilter) {
      eventActorFilter.value = state.eventFilters.actor;
    }
    if (eventBackendFilter) {
      eventBackendFilter.value = state.eventFilters.backend;
    }
    if (eventCategoryFilter) {
      eventCategoryFilter.value = state.eventFilters.category;
    }
    if (eventSeverityFilter) {
      eventSeverityFilter.value = state.eventFilters.severity;
    }
    if (eventDateFromFilter) {
      eventDateFromFilter.value = state.eventFilters.dateFrom;
    }
    if (eventDateToFilter) {
      eventDateToFilter.value = state.eventFilters.dateTo;
    }
  }

  async function applyEventFilters({
    state,
    refreshAll,
    eventQueryFilter,
    eventActorFilter,
    eventBackendFilter,
    eventCategoryFilter,
    eventSeverityFilter,
    eventDateFromFilter,
    eventDateToFilter,
  }) {
    state.eventFilters.q = String(eventQueryFilter?.value || "").trim();
    state.eventFilters.actor = String(eventActorFilter?.value || "").trim();
    state.eventFilters.backend = String(eventBackendFilter?.value || "").trim();
    state.eventFilters.category = String(eventCategoryFilter?.value || "").trim();
    state.eventFilters.severity = String(eventSeverityFilter?.value || "").trim();
    state.eventFilters.dateFrom = String(eventDateFromFilter?.value || "").trim();
    state.eventFilters.dateTo = String(eventDateToFilter?.value || "").trim();
    state.pagination.events.page = 1;
    await refreshAll();
  }

  async function resetEventFilters(input) {
    const { state, refreshAll } = input;
    state.eventFilters.q = "";
    state.eventFilters.actor = "";
    state.eventFilters.backend = "";
    state.eventFilters.category = "";
    state.eventFilters.severity = "";
    state.eventFilters.dateFrom = "";
    state.eventFilters.dateTo = "";
    syncEventFilterInputs(input);
    state.pagination.events.page = 1;
    await refreshAll();
  }

  async function refreshEvents({
    refreshAll,
  }) {
    await refreshAll();
  }

  function syncUsageLogFilterInputs({
    state,
    usageLogQueryFilter,
    usageLogDateFromFilter,
    usageLogDateToFilter,
    usageLogBackendFilter,
    usageLogModelFilter,
    usageLogClientKeyFilter,
    usageLogProxyFilter,
    usageLogStatusFilter,
  }) {
    if (usageLogQueryFilter) {
      usageLogQueryFilter.value = state.usageLogFilters.q;
    }
    if (usageLogDateFromFilter) {
      usageLogDateFromFilter.value = state.usageLogFilters.dateFrom;
    }
    if (usageLogDateToFilter) {
      usageLogDateToFilter.value = state.usageLogFilters.dateTo;
    }
    usageLogBackendFilter.value = state.usageLogFilters.backend;
    usageLogModelFilter.value = state.usageLogFilters.model;
    usageLogClientKeyFilter.value = state.usageLogFilters.clientKey;
    if (usageLogProxyFilter) {
      usageLogProxyFilter.value = state.usageLogFilters.proxy;
    }
    if (usageLogStatusFilter) {
      usageLogStatusFilter.value = state.usageLogFilters.status;
    }
  }

  async function applyUsageLogFilters({
    state,
    refreshAll,
    usageLogQueryFilter,
    usageLogDateFromFilter,
    usageLogDateToFilter,
    usageLogBackendFilter,
    usageLogModelFilter,
    usageLogClientKeyFilter,
    usageLogProxyFilter,
    usageLogStatusFilter,
  }) {
    state.usageLogFilters.q = String(usageLogQueryFilter?.value || "").trim();
    state.usageLogFilters.dateFrom = String(usageLogDateFromFilter?.value || "").trim();
    state.usageLogFilters.dateTo = String(usageLogDateToFilter?.value || "").trim();
    state.usageLogFilters.backend = String(usageLogBackendFilter.value || "").trim();
    state.usageLogFilters.model = String(usageLogModelFilter.value || "").trim();
    state.usageLogFilters.clientKey = String(usageLogClientKeyFilter.value || "").trim();
    state.usageLogFilters.proxy = String(usageLogProxyFilter?.value || "").trim();
    state.usageLogFilters.status = String(usageLogStatusFilter?.value || "").trim();
    state.pagination.usageLogs.page = 1;
    await refreshAll();
  }

  async function resetUsageLogFilters(input) {
    const { state, refreshAll } = input;
    state.usageLogFilters.q = "";
    state.usageLogFilters.dateFrom = "";
    state.usageLogFilters.dateTo = "";
    state.usageLogFilters.backend = "";
    state.usageLogFilters.model = "";
    state.usageLogFilters.clientKey = "";
    state.usageLogFilters.proxy = "";
    state.usageLogFilters.status = "";
    syncUsageLogFilterInputs(input);
    state.pagination.usageLogs.page = 1;
    await refreshAll();
  }

  async function refreshUsageLogs({
    refreshAll,
  }) {
    await refreshAll();
  }

  async function clearUsageLogs({
    state,
    confirm,
    alert,
    api,
    refreshAll,
  }) {
    if (!confirm("确认清空所有使用日志？")) {
      return;
    }
    const response = await api("/admin/api/usage-logs", "DELETE");
    state.pagination.usageLogs.page = 1;
    await refreshAll();
    alert(`已清空 ${Number(response?.deleted || 0)} 条使用日志。`);
  }

  async function deleteFilteredUsageLogs({
    state,
    observabilityUtils,
    confirm,
    alert,
    api,
    refreshAll,
  }) {
    const query = buildUsageLogStatsQuery({ state, observabilityUtils });
    if (!query) {
      throw new Error("请先设置查询条件，再删除查询结果");
    }
    if (!confirm("确认删除当前查询条件命中的使用日志？")) {
      return;
    }
    const response = await api(`/admin/api/usage-logs?${query}`, "DELETE");
    state.pagination.usageLogs.page = 1;
    await refreshAll();
    alert(`已删除 ${Number(response?.deleted || 0)} 条符合条件的使用日志。`);
  }

  function renderUsageLogFilterOptions({
    state,
    displayUtils,
    usageLogBackendOptions,
    usageLogModelOptions,
    usageLogClientKeyOptions,
    usageLogProxyOptions,
  }) {
    displayUtils.renderDatalist(usageLogBackendOptions, state.usageLogOptions.backends);
    displayUtils.renderDatalist(usageLogModelOptions, state.usageLogOptions.models);
    displayUtils.renderDatalist(usageLogClientKeyOptions, state.usageLogOptions.clientKeys);
    displayUtils.renderDatalist(usageLogProxyOptions, state.usageLogOptions.proxies);
  }

  function renderEvents(input) {
    const {
      state,
      eventList,
      observabilityUtils,
      observabilityViewUtils,
      paginationUtils,
      resourceStateUtils,
      displayUtils,
      pageSizeOptions,
      refreshAll,
      reportError,
      feedToneClass,
      openResourceDrawer,
    } = input;

    const events = state.events;
    syncEventFilterInputs(input);
    const pageData = paginationUtils.currentRemotePageData("events", events, state, {
      pageSizeOptions,
      resourceStateUtils,
    });
    const pageTimeline = observabilityUtils.createEventTimelineItems(pageData.items);
    const summary = observabilityUtils.createEventSummaryModel(state.eventSummary);

    eventList.innerHTML = observabilityViewUtils.renderEventsPage({
      events,
      pageData,
      timelineItems: pageTimeline,
      summary,
      formatDateTime: displayUtils.formatDateTime,
      renderPagination(key, data) {
        return paginationUtils.renderPagination(key, data, {
          pageSizeOptions,
          paginationPageNumbers: resourceStateUtils.paginationPageNumbers,
        });
      },
      emptyState: displayUtils.emptyState,
      feedToneClass,
      escapeHTML: displayUtils.escapeHTML,
    });

    paginationUtils.bindPagination(eventList, "events", refreshAll, state, { reportError });
    eventList.querySelectorAll("[data-event-row]").forEach((row) => {
      const openEventDrawer = () => {
        openResourceDrawer({
          kind: "event",
          page: "events",
          id: row.dataset.eventRow || "",
          title: row.dataset.eventTitle || "Event",
          triggerElement: row,
        }).catch(reportError);
      };
      row.addEventListener("click", openEventDrawer);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        openEventDrawer();
      });
    });
  }

  function renderUsageLogs(input) {
    const {
      state,
      usageLogList,
      deleteUsageLogsBtn,
      observabilityUtils,
      observabilityViewUtils,
      paginationUtils,
      resourceStateUtils,
      displayUtils,
      pageSizeOptions,
      refreshAll,
      reportError,
      openResourceDrawer,
      renderUsageLogInlineDetail,
      toggleExpanded,
    } = input;

    const logs = state.usageLogs;
    syncUsageLogFilterInputs(input);
    deleteUsageLogsBtn.disabled = logs.length === 0;
    const statsCards = observabilityUtils.createUsageStatsCards(state.usageLogStats);
    const pageData = paginationUtils.currentRemotePageData("usageLogs", logs, state, {
      pageSizeOptions,
      resourceStateUtils,
    });
    const pageRows = observabilityUtils.createUsageLogRows(pageData.items);

    usageLogList.innerHTML = observabilityViewUtils.renderUsageLogsPage({
      logs,
      pageData,
      statsCards,
      pageRows,
      expandedUsageLogs: state.expandedUsageLogs,
      formatDateTime: displayUtils.formatDateTime,
      renderPagination(key, data) {
        return paginationUtils.renderPagination(key, data, {
          pageSizeOptions,
          paginationPageNumbers: resourceStateUtils.paginationPageNumbers,
        });
      },
      emptyState: displayUtils.emptyState,
      renderUsageLogInlineDetail,
      escapeHTML: displayUtils.escapeHTML,
    });

    paginationUtils.bindPagination(usageLogList, "usageLogs", refreshAll, state, { reportError });
    usageLogList.querySelectorAll("[data-toggle-usage-log]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleExpanded(state.expandedUsageLogs, button.dataset.toggleUsageLog);
        renderUsageLogs(input);
      });
    });
    usageLogList.querySelectorAll("[data-usage-log-row]").forEach((row) => {
      const openUsageLogDrawer = () => {
        openResourceDrawer({
          kind: "usage_log",
          page: "usage-logs",
          id: row.dataset.usageLogRow || "",
          title: row.dataset.usageLogTitle || "Usage Log",
          triggerElement: row,
        }).catch(reportError);
      };
      row.addEventListener("click", openUsageLogDrawer);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        openUsageLogDrawer();
      });
    });
  }

  function renderUsageLogInlineDetail({
    row,
    state,
    observabilityUtils,
    observabilityViewUtils,
    displayUtils,
    primeUsageLogDetail,
  }) {
    const detail = state.usageLogDetailCache.get(String(row.id));
    if (!detail) {
      primeUsageLogDetail(row.id);
    }
    const previewItems = observabilityUtils.createUsageLogDetailPreview(detail, row);
    return observabilityViewUtils.renderUsageLogInlineDetail({
      detail,
      row,
      previewItems,
      formatInlinePreview: observabilityViewUtils.formatInlinePreview,
      escapeHTML: displayUtils.escapeHTML,
    });
  }

  async function primeUsageLogDetail({
    id,
    state,
    api,
    renderUsageLogs,
  }) {
    const key = String(id || "").trim();
    if (!key || state.usageLogDetailCache.has(key)) {
      return;
    }
    try {
      const payload = await api(`/admin/api/usage-logs/${encodeURIComponent(key)}`);
      state.usageLogDetailCache.set(key, payload && typeof payload === "object" ? payload : {});
      if (state.expandedUsageLogs.has(key)) {
        renderUsageLogs();
      }
    } catch (error) {
      state.usageLogDetailCache.set(key, { error: error?.message || "Failed to load usage log detail" });
      if (state.expandedUsageLogs.has(key)) {
        renderUsageLogs();
      }
    }
  }

  const api = {
    buildUsageLogQuery,
    buildUsageLogStatsQuery,
    buildEventQuery,
    buildEventSummaryQuery,
    syncEventFilterInputs,
    applyEventFilters,
    resetEventFilters,
    refreshEvents,
    syncUsageLogFilterInputs,
    applyUsageLogFilters,
    resetUsageLogFilters,
    refreshUsageLogs,
    clearUsageLogs,
    deleteFilteredUsageLogs,
    renderUsageLogFilterOptions,
    renderEvents,
    renderUsageLogs,
    renderUsageLogInlineDetail,
    primeUsageLogDetail,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ObservabilityRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
