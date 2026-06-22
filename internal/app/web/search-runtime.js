(function initSearchRuntimeModule(globalScope) {
  function openSearchShell({
    state,
    searchUtils,
    renderSearchShell,
    searchInput,
    searchModalPanel,
    searchOpenBtn,
    documentObject,
    HTMLElementClass,
    triggerSearch,
  }) {
    const activeElement = documentObject?.activeElement;
    const openState = searchUtils.openSearchState(state.ui.search, {
      triggerElement: activeElement instanceof HTMLElementClass ? activeElement : searchOpenBtn,
    });
    renderSearchShell();
    if (searchInput) {
      searchInput.focus();
    } else {
      searchModalPanel?.focus?.();
    }
    if (state.ui.search.query.trim()) {
      searchInput?.select?.();
      if (openState.shouldTriggerSearch) {
        triggerSearch();
      }
    }
  }

  function closeSearchShell({
    state,
    searchUtils,
    searchDebounce,
    renderSearchShell,
    HTMLElementClass,
  }) {
    const closeState = searchUtils.closeSearchState(state.ui.search);
    const previousTrigger = closeState.previousTrigger;
    searchDebounce?.cancel?.();
    renderSearchShell();
    if (previousTrigger instanceof HTMLElementClass) {
      previousTrigger.focus();
    }
  }

  function updateSearchQuery({
    state,
    value,
    searchUtils,
    searchDebounce,
    triggerSearch,
  }) {
    const updateState = searchUtils.updateSearchQueryState(state.ui.search, value);
    if (!updateState.shouldTriggerSearch) {
      searchDebounce?.cancel?.();
      return;
    }
    triggerSearch();
  }

  function triggerSearch({
    state,
    searchUtils,
    searchDebounce,
    reportError,
    executeSearch,
    renderSearchShell,
  }) {
    const request = searchUtils.startSearchRequestState(state.ui.search);
    if (!searchDebounce) {
      executeSearch(request).catch(reportError);
      return;
    }
    renderSearchShell();
    searchDebounce(request);
  }

  async function executeSearch({
    state,
    request,
    searchUtils,
    api,
    searchLimit,
    renderSearchShell,
    currentSearchKeyboardState,
  }) {
    const requestID = Number(request?.sequence) || 0;
    const trimmedQuery = String(request?.query || "").trim();
    if (!trimmedQuery) {
      searchUtils.clearSearchState(state.ui.search);
      renderSearchShell();
      return;
    }

    renderSearchShell();
    const path = searchUtils.buildSearchRequestPath(trimmedQuery, searchLimit);
    try {
      const response = await api(path);
      const applied = searchUtils.resolveSearchResponseState(state.ui.search, requestID, response);
      if (applied === false) {
        return;
      }
      const keyboardState = currentSearchKeyboardState();
      state.ui.search.activeIndex = keyboardState.activeIndex;
    } finally {
      if (requestID === state.ui.search.activeSequence) {
        state.ui.search.loading = false;
        renderSearchShell();
      }
    }
  }

  function renderSearchResults({
    state,
    shellViewUtils,
    currentSearchKeyboardState,
    escapeHTML,
  }) {
    return shellViewUtils.renderSearchResults({
      query: state.ui.search.query,
      loading: state.ui.search.loading,
      results: state.ui.search.results || { total: 0, groups: [] },
      keyboardState: currentSearchKeyboardState(),
      escapeHTML,
    });
  }

  function navigateToSearchResult({
    payload,
    searchUtils,
    windowObject,
    activatePage,
    closeSearchShell,
    openResourceDrawer,
    reportError,
  }) {
    const normalized = searchUtils.getSearchResultTarget(payload);
    if (!normalized?.page) {
      return;
    }

    windowObject.location.hash = `#${normalized.page}`;
    activatePage(normalized.page);
    closeSearchShell();
    openResourceDrawer({
      kind: normalized.drawer.kind || payload.group || "",
      page: normalized.page,
      id: normalized.drawer.id || payload.targetId || payload.id || null,
      title: normalized.drawer.title || payload.title || "",
    }).catch(reportError);
  }

  function currentSearchKeyboardState({
    state,
    searchUtils,
  }) {
    return searchUtils.createSearchKeyboardState({
      results: state.ui.search.results,
      activeIndex: state.ui.search.activeIndex,
    });
  }

  function moveSearchSelection({
    state,
    delta,
    searchUtils,
    currentSearchKeyboardState,
    renderSearchShell,
  }) {
    const keyboardState = currentSearchKeyboardState();
    state.ui.search.activeIndex = searchUtils.moveSearchSelection({
      currentIndex: keyboardState.activeIndex,
      delta,
      itemCount: keyboardState.items.length,
    });
    renderSearchShell();
  }

  const api = {
    openSearchShell,
    closeSearchShell,
    updateSearchQuery,
    triggerSearch,
    executeSearch,
    renderSearchResults,
    navigateToSearchResult,
    currentSearchKeyboardState,
    moveSearchSelection,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.SearchRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
