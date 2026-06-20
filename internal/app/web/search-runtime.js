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
    const openState = typeof searchUtils?.openSearchState === "function"
      ? searchUtils.openSearchState(state.ui.search, {
        triggerElement: activeElement instanceof HTMLElementClass ? activeElement : searchOpenBtn,
      })
      : {
        shouldTriggerSearch: Boolean(
          state.ui.search.query.trim()
          && !state.ui.search.results.total
          && !state.ui.search.loading
        ),
      };
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
    const closeState = typeof searchUtils?.closeSearchState === "function"
      ? searchUtils.closeSearchState(state.ui.search)
      : { previousTrigger: state.ui.search.triggerElement };
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
    const updateState = typeof searchUtils?.updateSearchQueryState === "function"
      ? searchUtils.updateSearchQueryState(state.ui.search, value)
      : { shouldTriggerSearch: Boolean(String(value || "").trim()) };
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
    const request = typeof searchUtils?.startSearchRequestState === "function"
      ? searchUtils.startSearchRequestState(state.ui.search)
      : (typeof searchUtils?.createSearchRequest === "function"
        ? searchUtils.createSearchRequest(state.ui.search.query, state.ui.search.requestSequence)
        : {
          sequence: (Number(state.ui.search.requestSequence) || 0) + 1,
          query: String(state.ui.search.query || "").trim(),
        });
    state.ui.search.requestSequence = request.sequence;
    state.ui.search.activeSequence = request.sequence;
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
      if (typeof searchUtils?.clearSearchState === "function") {
        searchUtils.clearSearchState(state.ui.search);
      } else {
        state.ui.search.loading = false;
        state.ui.search.activeIndex = -1;
        state.ui.search.results = {
          query: "",
          total: 0,
          groups: [],
        };
      }
      renderSearchShell();
      return;
    }

    state.ui.search.loading = true;
    renderSearchShell();
    const path = typeof searchUtils?.buildSearchRequestPath === "function"
      ? searchUtils.buildSearchRequestPath(trimmedQuery, searchLimit)
      : `/admin/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=${searchLimit}`;
    try {
      const response = await api(path);
      const applied = typeof searchUtils?.resolveSearchResponseState === "function"
        ? searchUtils.resolveSearchResponseState(state.ui.search, requestID, response)
        : null;
      if (applied === false) {
        return;
      }
      if (applied === null) {
        if (requestID !== state.ui.search.activeSequence) {
          return;
        }
        state.ui.search.results = typeof searchUtils?.normalizeSearchResponse === "function"
          ? searchUtils.normalizeSearchResponse(response)
          : { query: trimmedQuery, total: 0, groups: [] };
        const keyboardState = currentSearchKeyboardState();
        state.ui.search.activeIndex = keyboardState.activeIndex;
      }
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
    const normalized = typeof searchUtils?.getSearchResultTarget === "function"
      ? searchUtils.getSearchResultTarget(payload)
      : null;
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
    return typeof searchUtils?.createSearchKeyboardState === "function"
      ? searchUtils.createSearchKeyboardState({
        results: state.ui.search.results,
        activeIndex: state.ui.search.activeIndex,
      })
      : { items: [], activeIndex: -1, activeItem: null };
  }

  function moveSearchSelection({
    state,
    delta,
    searchUtils,
    currentSearchKeyboardState,
    renderSearchShell,
  }) {
    const keyboardState = currentSearchKeyboardState();
    state.ui.search.activeIndex = typeof searchUtils?.moveSearchSelection === "function"
      ? searchUtils.moveSearchSelection({
        currentIndex: keyboardState.activeIndex,
        delta,
        itemCount: keyboardState.items.length,
      })
      : -1;
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
