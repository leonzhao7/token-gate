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

  function buildSettingsSnapshot({
    shellStateUtils,
    localStorage,
    adminTokenKey,
    themePreference,
    resolvedTheme,
    appShell,
    lastRefreshAt,
    formatDateTime = identity,
    backends,
    clients,
    policies,
    proxies,
    usageLogStats,
    usageLogMeta,
    eventSummary,
  }) {
    return shellStateUtils.createSettingsSnapshot({
      adminTokenValue: localStorage.getItem(adminTokenKey) || "",
      themePreference,
      resolvedTheme,
      sidebarCollapsed: appShell?.classList.contains("sidebar-collapsed"),
      lastRefreshLabel: lastRefreshAt ? formatDateTime(lastRefreshAt) : "",
      backends,
      clients,
      policies,
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
  }) {
    const nextState = typeof forceState === "boolean"
      ? forceState
      : !appShell?.classList.contains("sidebar-collapsed");
    appShell?.classList.toggle("sidebar-collapsed", nextState);
    sidebarRoot?.classList.toggle("is-collapsed", nextState);
    return nextState;
  }

  function identity(value) {
    return value;
  }

  const api = {
    activatePage,
    applyResolvedTheme,
    buildSettingsSnapshot,
    cycleThemePreference,
    initializeThemeState,
    navigateToPage,
    pageIDFromHash,
    persistThemePreference,
    renderSettings,
    renderTheme,
    resolveThemeState,
    toggleSidebarCollapsed,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ShellRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
