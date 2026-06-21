(function initResourceListRuntimeModule(globalScope) {
  function buildResourceToolbarMarkup({
    resourceKey,
    searchPlaceholder,
    count,
    state,
    resourceViewConfig,
    rendererUtils,
    resourceViewUtils,
    resourceStateUtils,
    displayUtils,
  }) {
    const viewState = state.resourceViews[resourceKey] || resourceStateUtils.defaultResourceView(resourceKey);
    const defaultView = resourceStateUtils.defaultResourceView(resourceKey);
    const activeFilters = Number(Boolean(String(viewState.query || "").trim()))
      + Number((viewState.filter || "all") !== defaultView.filter)
      + Number((viewState.sort || "") !== defaultView.sort);
    const hasChanges = activeFilters > 0;
    const model = typeof rendererUtils?.createResourceToolbarModel === "function"
      ? rendererUtils.createResourceToolbarModel({ resourceKey, searchPlaceholder, count, activeFilters, hasChanges })
      : { searchPlaceholder, count, activeFilters, hasChanges, actions: ["search", "filters", "sort", "reset", "refresh"] };
    const config = resourceViewConfig[resourceKey] || { filterOptions: [], sortOptions: [] };

    return resourceViewUtils.renderResourceToolbar({
      resourceKey,
      viewState,
      model,
      config,
      activeFilters,
      hasChanges,
      escapeHTML: displayUtils.escapeHTML,
      toolbarStatusLabel: resourceStateUtils.toolbarStatusLabel,
    });
  }

  function bindResourceToolbar({
    container,
    resourceKey,
    state,
    resourceStateUtils,
    renderResourceListByKey,
    refreshResourceList,
    reportError,
    onCreate,
  }) {
    container.querySelector(`[data-toolbar-search="${resourceKey}"]`)?.addEventListener("input", (event) => {
      state.resourceViews[resourceKey].query = String(event.currentTarget.value || "");
      state.pagination[resourceKey].page = 1;
      renderResourceListByKey(resourceKey);
    });
    container.querySelector(`[data-toolbar-filter="${resourceKey}"]`)?.addEventListener("change", (event) => {
      state.resourceViews[resourceKey].filter = String(event.currentTarget.value || "all");
      state.pagination[resourceKey].page = 1;
      renderResourceListByKey(resourceKey);
    });
    container.querySelector(`[data-toolbar-sort="${resourceKey}"]`)?.addEventListener("change", (event) => {
      state.resourceViews[resourceKey].sort = String(event.currentTarget.value || "");
      state.pagination[resourceKey].page = 1;
      renderResourceListByKey(resourceKey);
    });
    container.querySelector(`[data-toolbar-reset="${resourceKey}"]`)?.addEventListener("click", () => {
      state.resourceViews[resourceKey] = resourceStateUtils.defaultResourceView(resourceKey);
      state.pagination[resourceKey].page = 1;
      renderResourceListByKey(resourceKey);
    });
    container.querySelector(`[data-toolbar-refresh="${resourceKey}"]`)?.addEventListener("click", () => {
      refreshResourceList(resourceKey).catch(reportError);
    });
    container.querySelector(`[data-toolbar-create="${resourceKey}"]`)?.addEventListener("click", () => {
      onCreate();
    });
  }

  function bindResourceRowOpen({
    container,
    kind,
    drawerViewUtils,
    drawerUtils,
    openResourceDrawer,
    reportError,
  }) {
    container.querySelectorAll("[data-row-open]").forEach((row) => {
      row.setAttribute("tabindex", "0");
      const resourceTitle = row.dataset.rowTitle || (
        typeof drawerUtils?.drawerDisplayTitle === "function"
          ? drawerUtils.drawerDisplayTitle(kind)
          : drawerViewUtils.drawerDisplayTitle(kind)
      );
      row.setAttribute("aria-label", `Open ${resourceTitle} detail`);
      row.setAttribute("aria-haspopup", "dialog");
      row.setAttribute("aria-controls", "drawerRoot");
      row.addEventListener("click", (event) => {
        if (event.target.closest("button")) {
          return;
        }
        openResourceDrawer({
          kind,
          page: row.closest(".page")?.id || "",
          id: row.dataset.rowId || "",
          title: row.dataset.rowTitle || "",
          triggerElement: row,
        }).catch(reportError);
      });
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        if (event.target.closest("button")) {
          return;
        }
        event.preventDefault();
        openResourceDrawer({
          kind,
          page: row.closest(".page")?.id || "",
          id: row.dataset.rowId || "",
          title: row.dataset.rowTitle || "",
          triggerElement: row,
        }).catch(reportError);
      });
    });
  }

  function bindButtons(container, selector, listener) {
    container.querySelectorAll(selector).forEach((button) => {
      button.addEventListener("click", () => {
        listener(button);
      });
    });
  }

  function readDatasetTargetID(button, action, kind) {
    const datasetKey = `${action}${capitalize(kind)}`;
    const targetID = String(button?.dataset?.[datasetKey] || "").trim();
    if (targetID) {
      return targetID;
    }
    throw new Error(`missing ${kind} ${action} target id on dataset key ${datasetKey}`);
  }

  function bindResourceListInteractions({
    container,
    resourceKey,
    kind,
    state,
    getExpandedSet,
    getEditingID,
    renderList,
    startEdit,
    resetForm,
    refreshAll,
    confirm,
    deleteMessage,
    deletePath,
    toggleExpanded,
    api,
    bindResourceRowOpen: bindRowOpen = bindResourceRowOpen,
    bindResourceToolbar: bindToolbar = bindResourceToolbar,
    paginationUtils,
    drawerUtils,
    drawerViewUtils,
    openResourceDrawer,
    resourceStateUtils,
    renderResourceListByKey,
    refreshResourceList,
    reportError,
    onCreate,
  }) {
    bindButtons(container, `[data-toggle-${kind}]`, (button) => {
      try {
        toggleExpanded(getExpandedSet(), readDatasetTargetID(button, "toggle", kind));
        renderList();
      } catch (error) {
        reportError(error);
      }
    });

    bindButtons(container, `[data-edit-${kind}]`, (button) => {
      try {
        startEdit(readDatasetTargetID(button, "edit", kind));
      } catch (error) {
        reportError(error);
      }
    });

    bindRowOpen({
      container,
      kind,
      drawerUtils,
      drawerViewUtils,
      openResourceDrawer,
      reportError,
    });

    bindButtons(container, `[data-delete-${kind}]`, (button) => {
      Promise.resolve().then(async () => {
        try {
          const targetID = readDatasetTargetID(button, "delete", kind);
          if (!confirm(deleteMessage)) {
            return;
          }
          await api(deletePath(targetID), "DELETE");
          if (String(getEditingID()) === String(targetID)) {
            resetForm();
          }
          getExpandedSet().delete(String(targetID));
          await refreshAll();
        } catch (error) {
          reportError(error);
        }
      });
    });

    paginationUtils.bindPagination(container, resourceKey, renderList, state, { reportError });
    bindToolbar({
      container,
      resourceKey,
      state,
      resourceStateUtils,
      renderResourceListByKey,
      refreshResourceList,
      reportError,
      onCreate,
    });
  }

  function renderLocalResourceTable({
    resourceKey,
    items,
    state,
    container,
    searchPlaceholder,
    emptyTitle,
    emptyDescription,
    headers,
    rowRenderer,
    resourceViewConfig,
    rendererUtils,
    resourceViewUtils,
    resourceStateUtils,
    paginationUtils,
    displayUtils,
    pageSizeOptions,
  }) {
    const filtered = resourceStateUtils.applyResourceView(resourceKey, items, state.resourceViews);
    const pageData = paginationUtils.currentLocalPageData(resourceKey, filtered, state, {
      pageSizeOptions,
      resourceStateUtils,
    });
    const toolbar = buildResourceToolbarMarkup({
      resourceKey,
      searchPlaceholder,
      count: pageData.total,
      state,
      resourceViewConfig,
      rendererUtils,
      resourceViewUtils,
      resourceStateUtils,
      displayUtils,
    });

    container.innerHTML = resourceViewUtils.renderResourceTablePage({
      toolbar,
      isEmpty: filtered.length === 0,
      emptyMarkup: displayUtils.emptyState(emptyTitle, emptyDescription),
      headers,
      rowsMarkup: pageData.items.map((item) => rowRenderer(item)).join(""),
      paginationMarkup: paginationUtils.renderPagination(resourceKey, pageData, {
        pageSizeOptions,
        paginationPageNumbers: resourceStateUtils.paginationPageNumbers,
      }),
      escapeHTML: displayUtils.escapeHTML,
    });

    return { filtered, pageData, toolbar };
  }

  function renderManagedResourceSection({
    bindResourceListInteractions: bindInteractions = bindResourceListInteractions,
    ...options
  }) {
    renderLocalResourceTable(options);
    bindInteractions({
      container: options.container,
      resourceKey: options.resourceKey,
      kind: options.kind,
      state: options.state,
      getExpandedSet: options.getExpandedSet,
      getEditingID: options.getEditingID,
      renderList: options.renderList,
      startEdit: options.startEdit,
      resetForm: options.resetForm,
      refreshAll: options.refreshAll,
      confirm: options.confirm,
      deleteMessage: options.deleteMessage,
      deletePath: options.deletePath,
      toggleExpanded: options.toggleExpanded,
      api: options.api,
      drawerUtils: options.drawerUtils,
      drawerViewUtils: options.drawerViewUtils,
      openResourceDrawer: options.openResourceDrawer,
      resourceStateUtils: options.resourceStateUtils,
      renderResourceListByKey: options.renderResourceListByKey,
      refreshResourceList: options.refreshResourceList,
      reportError: options.reportError,
      onCreate: options.onCreate,
      paginationUtils: options.paginationUtils,
    });
  }

  const api = {
    bindResourceListInteractions,
    bindResourceRowOpen,
    bindResourceToolbar,
    buildResourceToolbarMarkup,
    renderManagedResourceSection,
    renderLocalResourceTable,
  };

  function capitalize(value) {
    const raw = String(value || "");
    return raw ? raw[0].toUpperCase() + raw.slice(1) : "";
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceListRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
