(function initShellRuntimeModule(globalScope) {
  function pageIDFromHash({
    windowObject,
    pages,
    shellViewUtils,
  }) {
    return shellViewUtils.pageIDFromHash(windowObject.location.hash, pages);
  }

  function activatePage({
    id,
    pages,
    pageLinks,
    pageTitle,
    pageBreadcrumb,
    shellViewUtils,
  }) {
    return shellViewUtils.activatePageView({
      pages,
      pageLinks,
      id,
      pageTitle,
      pageBreadcrumb,
    });
  }

  function navigateToPage({
    id,
    windowObject,
    pages,
    pageLinks,
    pageTitle,
    pageBreadcrumb,
    shellStateUtils,
    shellViewUtils,
  }) {
    const navigation = shellStateUtils.buildPageNavigation({
      currentHash: windowObject.location.hash,
      requestedID: id,
      pages,
    });
    if (navigation.shouldUpdateHash) {
      windowObject.location.hash = navigation.nextHash;
      return navigation.nextID;
    }
    return activatePage({
      id: navigation.nextID,
      pages,
      pageLinks,
      pageTitle,
      pageBreadcrumb,
      shellViewUtils,
    });
  }

  function initializeThemeState({
    state,
    rootElement,
    localStorage,
    themePreferenceKey,
    systemThemeQuery,
    shellStateUtils,
    themeUtils,
  }) {
    const resolved = shellStateUtils.createThemeRuntimeState({
      storedPreference: localStorage.getItem(themePreferenceKey),
      systemPrefersDark: Boolean(systemThemeQuery?.matches),
      resolveThemeState(input) {
        return resolveThemeState({
          storedPreference: input.storedPreference,
          systemPrefersDark: input.systemPrefersDark,
          themeUtils,
        });
      },
    });
    state.ui.themePreference = resolved.preference;
    state.ui.theme = resolved.theme;
    rootElement.dataset.themePreference = resolved.preference;
    rootElement.dataset.theme = resolved.theme;
    return resolved;
  }

  function resolveThemeState({
    storedPreference,
    systemPrefersDark,
    themeUtils,
  }) {
    if (typeof themeUtils?.resolveThemeState === "function") {
      return themeUtils.resolveThemeState({
        storedPreference,
        systemPrefersDark,
      });
    }
    return {
      preference: "system",
      theme: systemPrefersDark ? "dark" : "light",
      isAuto: true,
    };
  }

  function persistThemePreference({
    preference,
    localStorage,
    themePreferenceKey,
    shellStateUtils,
  }) {
    const operation = shellStateUtils.createThemeStorageOperation(preference);
    if (operation.type === "remove") {
      localStorage.removeItem(themePreferenceKey);
      return operation;
    }
    localStorage.setItem(themePreferenceKey, operation.value);
    return operation;
  }

  function initializeSidebarState({
    appShell,
    sidebarRoot,
    localStorage,
    sidebarCollapsedKey,
    shellStateUtils,
  }) {
    const collapsed = typeof shellStateUtils?.parseSidebarCollapsedPreference === "function"
      ? shellStateUtils.parseSidebarCollapsedPreference(localStorage?.getItem?.(sidebarCollapsedKey) || "")
      : false;
    applySidebarCollapsed({ appShell, sidebarRoot, collapsed });
    return collapsed;
  }

  function applyResolvedTheme({
    state,
    systemThemeQuery,
    themeUtils,
  }) {
    const resolved = resolveThemeState({
      storedPreference: state.ui.themePreference,
      systemPrefersDark: Boolean(systemThemeQuery?.matches),
      themeUtils,
    });
    state.ui.themePreference = resolved.preference;
    state.ui.theme = resolved.theme;
    return resolved;
  }

  function renderTheme({
    rootElement,
    appShell,
    themeToggleBtn,
    themeToggleLabel,
    theme,
    preference,
    shellViewUtils,
    themeUtils,
  }) {
    return shellViewUtils.renderThemeView({
      rootElement,
      appShell,
      themeToggleBtn,
      themeToggleLabel,
      theme,
      preference,
      getThemeToggleState(input) {
        return typeof themeUtils?.getThemeToggleState === "function"
          ? themeUtils.getThemeToggleState(input)
          : {
            label: input.theme,
            hint: "Switch theme mode",
            pressed: input.theme === "dark",
          };
      },
    });
  }

  function renderSettings({
    settingsRoot,
    settingsUtils,
    buildSettingsSnapshot,
  }) {
    if (!settingsRoot) {
      return null;
    }
    const viewModel = typeof settingsUtils?.createSettingsViewModel === "function"
      ? settingsUtils.createSettingsViewModel(buildSettingsSnapshot())
      : null;
    if (!viewModel) {
      settingsRoot.innerHTML = "";
      return null;
    }
    settingsRoot.innerHTML = typeof settingsUtils?.renderSettingsPage === "function"
      ? settingsUtils.renderSettingsPage(viewModel)
      : "";
    return viewModel;
  }

  function renderHeaderPanels({
    headerPanelRoot,
    notificationMenuBtn,
    profileMenuBtn,
    shellViewUtils,
    viewModel,
  }) {
    if (!headerPanelRoot) {
      return null;
    }
    const activePanel = String(viewModel?.activePanel || "");
    headerPanelRoot.innerHTML = typeof shellViewUtils?.renderHeaderPanels === "function"
      ? shellViewUtils.renderHeaderPanels({ viewModel })
      : "";
    notificationMenuBtn?.setAttribute?.("aria-expanded", String(activePanel === "notifications"));
    profileMenuBtn?.setAttribute?.("aria-expanded", String(activePanel === "profile"));
    return viewModel;
  }

  function toggleHeaderPanel({
    state,
    panel,
    renderHeaderPanels,
  }) {
    const normalizedPanel = normalizeHeaderPanel(panel);
    if (!state?.ui?.headerPanels || !normalizedPanel) {
      return "";
    }
    state.ui.headerPanels.active = state.ui.headerPanels.active === normalizedPanel ? "" : normalizedPanel;
    renderHeaderPanels?.();
    return state.ui.headerPanels.active;
  }

  function closeHeaderPanel({
    state,
    renderHeaderPanels,
  }) {
    if (!state?.ui?.headerPanels || !state.ui.headerPanels.active) {
      return "";
    }
    state.ui.headerPanels.active = "";
    renderHeaderPanels?.();
    return "";
  }

  function buildSettingsSnapshot({
    shellStateUtils,
    themePreference,
    resolvedTheme,
    appShell,
    lastRefreshAt,
    formatDateTime = identity,
    backends,
    clients,
    proxies,
    usageLogStats,
    usageLogMeta,
    eventSummary,
  }) {
    return shellStateUtils.createSettingsSnapshot({
      themePreference,
      resolvedTheme,
      sidebarCollapsed: appShell?.classList.contains("sidebar-collapsed"),
      lastRefreshLabel: lastRefreshAt ? formatDateTime(lastRefreshAt) : "",
      backends,
      clients,
      proxies,
      usageLogStats,
      usageLogMeta,
      eventSummary,
    });
  }

  function cycleThemePreference({
    currentPreference,
    themeUtils,
  }) {
    return typeof themeUtils?.nextThemePreference === "function"
      ? themeUtils.nextThemePreference(currentPreference)
      : "light";
  }

  function toggleSidebarCollapsed({
    appShell,
    sidebarRoot,
    forceState,
    localStorage,
    sidebarCollapsedKey,
    shellStateUtils,
  }) {
    const nextState = typeof forceState === "boolean"
      ? forceState
      : !appShell?.classList.contains("sidebar-collapsed");
    applySidebarCollapsed({ appShell, sidebarRoot, collapsed: nextState });
    persistSidebarCollapsed({
      collapsed: nextState,
      localStorage,
      sidebarCollapsedKey,
      shellStateUtils,
    });
    return nextState;
  }

  function applySidebarCollapsed({
    appShell,
    sidebarRoot,
    collapsed,
  }) {
    appShell?.classList.toggle("sidebar-collapsed", Boolean(collapsed));
    sidebarRoot?.classList.toggle("is-collapsed", Boolean(collapsed));
  }

  function persistSidebarCollapsed({
    collapsed,
    localStorage,
    sidebarCollapsedKey,
    shellStateUtils,
  }) {
    if (!localStorage || !sidebarCollapsedKey || typeof shellStateUtils?.createSidebarStorageOperation !== "function") {
      return null;
    }
    const operation = shellStateUtils.createSidebarStorageOperation(Boolean(collapsed));
    if (operation.type === "remove") {
      localStorage.removeItem(sidebarCollapsedKey);
      return operation;
    }
    localStorage.setItem(sidebarCollapsedKey, operation.value);
    return operation;
  }

  function identity(value) {
    return value;
  }

  function normalizeHeaderPanel(value) {
    const normalized = String(value || "").trim();
    return normalized === "notifications" || normalized === "profile" ? normalized : "";
  }

  const api = {
    activatePage,
    applyResolvedTheme,
    buildSettingsSnapshot,
    closeHeaderPanel,
    cycleThemePreference,
    initializeThemeState,
    initializeSidebarState,
    navigateToPage,
    pageIDFromHash,
    persistThemePreference,
    renderHeaderPanels,
    renderSettings,
    renderTheme,
    resolveThemeState,
    toggleHeaderPanel,
    toggleSidebarCollapsed,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ShellRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
