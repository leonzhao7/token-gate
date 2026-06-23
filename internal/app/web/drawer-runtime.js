(function initDrawerRuntimeModule(globalScope) {
  function defaultFooterActions() {
    return [
      { key: "edit", label: "Edit", tone: "ghost", disabled: false },
      { key: "delete", label: "Delete", tone: "danger", disabled: false },
      { key: "save", label: "Save", tone: "primary", disabled: true },
    ];
  }

  function renderDrawerShell({
    state,
    drawerRoot,
    drawerTitle,
    drawerTabRoot,
    drawerBodyRoot,
    drawerFooterRoot,
    drawerUtils,
    drawerViewUtils,
    escapeHTML,
    formatDateTime,
    openDrawerEditor,
    deleteDrawerResource,
    reportError,
    rerender,
  }) {
    if (!drawerRoot) {
      return;
    }

    const drawer = state?.ui?.drawer || {};
    const tabs = typeof drawerUtils?.drawerTabsForResource === "function"
      ? drawerUtils.drawerTabsForResource(drawer.kind)
      : [];
    const footerActions = typeof drawerUtils?.drawerFooterActions === "function"
      ? drawerUtils.drawerFooterActions()
      : defaultFooterActions();
    const activitySections = drawer.tab === "activity" && typeof drawerUtils?.buildDrawerActivitySections === "function"
      ? drawerUtils.buildDrawerActivitySections(drawer.data?.activity || {})
      : [];
    const resolveDrawerTitle = typeof drawerUtils?.drawerDisplayTitle === "function"
      ? drawerUtils.drawerDisplayTitle
      : undefined;
    const shell = drawerViewUtils.renderDrawerShell({
      drawer,
      tabs,
      footerActions,
      activitySections,
      escapeHTML,
      formatDateTime,
      resolveTitle: resolveDrawerTitle,
    });

    drawerRoot.classList.toggle("hidden", !shell.isOpen);
    drawerRoot.setAttribute("aria-hidden", shell.ariaHidden);
    if (drawerTitle) {
      drawerTitle.textContent = shell.title;
    }
    if (drawerTabRoot) {
      drawerTabRoot.innerHTML = shell.tabs;
      drawerTabRoot.querySelectorAll("[data-drawer-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          state.ui.drawer.tab = button.dataset.drawerTab || "overview";
          rerender?.();
        });
      });
    }
    if (drawerBodyRoot) {
      drawerBodyRoot.innerHTML = shell.body;
    }
    if (drawerFooterRoot) {
      drawerFooterRoot.innerHTML = shell.footer;
      drawerFooterRoot.querySelector('[data-drawer-footer="edit"]')?.addEventListener("click", () => {
        openDrawerEditor?.();
      });
      drawerFooterRoot.querySelector('[data-drawer-footer="delete"]')?.addEventListener("click", () => {
        Promise.resolve(deleteDrawerResource?.()).catch(reportError);
      });
    }
  }

  function closeDrawerShell({
    state,
    renderDrawerShell,
    HTMLElementClass,
  }) {
    const previousTrigger = state?.ui?.drawer?.triggerElement;
    state.ui.drawer.open = false;
    state.ui.drawer.kind = "";
    state.ui.drawer.id = null;
    state.ui.drawer.title = "";
    state.ui.drawer.tab = "overview";
    state.ui.drawer.loading = false;
    state.ui.drawer.data = null;
    state.ui.drawer.error = "";
    state.ui.drawer.detailPath = "";
    state.ui.drawer.deletePath = "";
    state.ui.drawer.page = "";
    state.ui.drawer.triggerElement = null;
    renderDrawerShell?.();
    if (previousTrigger instanceof HTMLElementClass) {
      previousTrigger.focus();
    }
  }

  async function openResourceDrawer({
    target,
    state,
    drawerUtils,
    api,
    renderDrawerShell,
    drawerPanel,
    documentObject,
    HTMLElementClass,
  }) {
    const normalized = typeof drawerUtils?.buildDrawerTarget === "function"
      ? drawerUtils.buildDrawerTarget(target)
      : null;
    if (!normalized) {
      return;
    }

    state.ui.drawer.open = true;
    state.ui.drawer.kind = normalized.kind;
    state.ui.drawer.id = normalized.id;
    state.ui.drawer.title = normalized.title;
    state.ui.drawer.page = normalized.page;
    state.ui.drawer.detailPath = normalized.detailPath;
    state.ui.drawer.deletePath = normalized.deletePath;
    state.ui.drawer.triggerElement = target?.triggerElement instanceof HTMLElementClass
      ? target.triggerElement
      : documentObject?.activeElement || null;
    state.ui.drawer.tab = "overview";
    state.ui.drawer.loading = true;
    state.ui.drawer.data = null;
    state.ui.drawer.error = "";
    renderDrawerShell?.();
    drawerPanel?.focus();

    try {
      const payload = await api?.(normalized.detailPath);
      state.ui.drawer.data = typeof drawerUtils?.normalizeDrawerPayload === "function"
        ? drawerUtils.normalizeDrawerPayload(payload)
        : payload;
      state.ui.drawer.error = "";
    } catch (error) {
      state.ui.drawer.error = error?.message || "Failed to load detail";
      state.ui.drawer.data = null;
    } finally {
      state.ui.drawer.loading = false;
      renderDrawerShell?.();
    }
  }

  function openDrawerEditor({
    state,
    closeDrawerShell,
    startEditBackend,
    startEditClient,
    startEditProxy,
  }) {
    const drawer = state?.ui?.drawer || {};
    if (drawer.kind === "backends") {
      closeDrawerShell?.();
      startEditBackend?.(drawer.id);
      return;
    }
    if (drawer.kind === "clients") {
      closeDrawerShell?.();
      startEditClient?.(drawer.id);
      return;
    }
    if (drawer.kind === "proxies") {
      closeDrawerShell?.();
      startEditProxy?.(drawer.id);
    }
  }

  async function deleteDrawerResource({
    state,
    drawerUtils,
    drawerViewUtils,
    confirm,
    api,
    closeDrawerShell,
    refreshAll,
  }) {
    if (!state?.ui?.drawer?.deletePath) {
      return;
    }
    const resourceTitle = typeof drawerUtils?.drawerDisplayTitle === "function"
      ? drawerUtils.drawerDisplayTitle(state.ui.drawer.kind)
      : drawerViewUtils?.drawerDisplayTitle(state.ui.drawer.kind);
    if (!confirm?.(`确认删除 ${resourceTitle}？`)) {
      return;
    }
    await api?.(state.ui.drawer.deletePath, "DELETE");
    closeDrawerShell?.();
    await refreshAll?.();
  }

  const api = {
    closeDrawerShell,
    deleteDrawerResource,
    openDrawerEditor,
    openResourceDrawer,
    renderDrawerShell,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DrawerRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
