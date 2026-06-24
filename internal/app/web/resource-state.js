(function initResourceStateModule(globalScope) {
  function defaultResourceView(resourceKey) {
    return {
      query: "",
      filter: "all",
      sort: defaultSortForResource(resourceKey),
    };
  }

  function toolbarStatusLabel(activeFilters, hasChanges) {
    if (!hasChanges || activeFilters <= 0) {
      return "Default view";
    }
    if (activeFilters === 1) {
      return "1 active control";
    }
    return `${activeFilters} active controls`;
  }

  function applyResourceView(resourceKey, items, resourceViews) {
    const source = ensureArray(items).slice();
    const viewState = normalizeViewState(resourceKey, resourceViews?.[resourceKey]);
    const query = String(viewState.query || "").trim().toLowerCase();
    let filtered = source.filter((item) => resourceFilterPredicate(resourceKey, item, viewState.filter));
    if (query) {
      filtered = filtered.filter((item) => resourceSearchText(resourceKey, item).includes(query));
    }
    filtered.sort(resourceSorter(resourceKey, viewState.sort));
    return filtered;
  }

  function currentLocalPageData(key, items, state, options = {}) {
    const normalized = ensureArray(items);
    const pageState = state?.pagination?.[key] || { page: 1, size: 10 };
    const paginated = paginateResourceRows(normalized, pageState, options.pageSizeOptions);
    if (state?.pagination?.[key]) {
      state.pagination[key].page = paginated.page;
      state.pagination[key].size = paginated.size;
    }
    return paginated;
  }

  function currentRemotePageData(key, items, state, options = {}) {
    const normalized = ensureArray(items);
    const pageState = state?.pagination?.[key] || { page: 1, size: 10 };
    const meta = state?.paginationMeta?.[key] || {};
    const size = allowedPageSize(pageState?.size, options.pageSizeOptions);
    const total = Number(meta.total) || 0;
    const page = Math.max(1, Number(meta.page) || 1);
    const totalPages = Math.max(1, Math.ceil(total / size));
    return {
      items: normalized,
      page,
      size,
      total,
      totalPages,
    };
  }

  function applyPagedResponse(key, payload, state, options = {}) {
    const pageState = state?.pagination?.[key] || { page: 1, size: 10 };
    const metaState = state?.paginationMeta?.[key] || { total: 0, page: 1, limit: pageState.size };
    const items = ensureArray(payload?.items);
    const total = Number(payload?.total) || 0;
    const limit = allowedPageSize(payload?.limit, options.pageSizeOptions, pageState.size);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(1, Number(payload?.page) || 1), totalPages);

    pageState.page = page;
    pageState.size = limit;
    metaState.total = total;
    metaState.page = page;
    metaState.limit = limit;
    state[key] = items;
  }

  function paginationPageNumbers(pageData) {
    const totalPages = Math.max(1, Number(pageData?.totalPages) || 1);
    const current = Math.max(1, Number(pageData?.page) || 1);
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (current <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (current >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", current - 1, current, current + 1, "...", totalPages];
  }

  function normalizeViewState(resourceKey, value) {
    const base = defaultResourceView(resourceKey);
    const source = value && typeof value === "object" ? value : {};
    return {
      query: String(source.query || ""),
      filter: String(source.filter || base.filter),
      sort: String(source.sort || base.sort),
    };
  }

  function resourceFilterPredicate(resourceKey, item, filter) {
    if (filter === "all" || !filter) {
      return true;
    }
    if (resourceKey === "backends") {
      return String(item?.status || "").toLowerCase() === filter;
    }
    return filter === "enabled" ? Boolean(item?.enabled) : !item?.enabled;
  }

  function resourceSearchText(resourceKey, item) {
    const source = item && typeof item === "object" ? item : {};
    const parts = [];
    if (resourceKey === "proxies") {
      parts.push(source.name, source.address, source.username);
    }
    if (resourceKey === "backends") {
      parts.push(
        source.name,
        source.base_url,
        source.console_url,
        source.status,
        source.console_username,
        source.notes,
        ...ensureArray(source.tags),
        ...ensureArray(source.models),
        ...ensureArray(source.endpoints),
      );
    }
    if (resourceKey === "clients") {
      parts.push(source.name, source.token_prefix);
    }
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  function resourceSorter(resourceKey, sortKey) {
    return (left, right) => {
      if (sortKey === "name_asc") {
        return String(left?.name || "").localeCompare(String(right?.name || ""));
      }
      if (sortKey === "weight_desc") {
        return Number(right?.weight || 0) - Number(left?.weight || 0);
      }
      return String(right?.updated_at || "").localeCompare(String(left?.updated_at || ""));
    };
  }

  function defaultSortForResource(resourceKey) {
    return "updated_desc";
  }

  function paginateResourceRows(items, pagination, pageSizeOptions) {
    const rows = ensureArray(items).slice();
    const size = allowedPageSize(pagination?.size, pageSizeOptions);
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const requestedPage = Math.max(1, Math.floor(Number(pagination?.page) || 1));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * size;

    return {
      items: rows.slice(start, start + size),
      page,
      size,
      total,
      totalPages,
    };
  }

  function allowedPageSize(value, pageSizeOptions, fallback = 10) {
    const options = Array.isArray(pageSizeOptions) && pageSizeOptions.length ? pageSizeOptions : [10, 20, 50];
    const size = Number(value);
    if (options.includes(size)) {
      return size;
    }
    const normalizedFallback = Number(fallback);
    return options.includes(normalizedFallback) ? normalizedFallback : options[0];
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {
    defaultResourceView,
    toolbarStatusLabel,
    applyResourceView,
    currentLocalPageData,
    currentRemotePageData,
    applyPagedResponse,
    paginationPageNumbers,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceStateUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
