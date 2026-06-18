(function initSearchModule(globalScope) {
  const SEARCH_GROUPS = [
    { key: "backends", label: "Backends" },
    { key: "client_keys", label: "Client Keys" },
    { key: "policies", label: "Policies" },
    { key: "proxies", label: "Proxies" },
    { key: "usage_logs", label: "Usage Logs" },
    { key: "events", label: "Events" },
  ];

  const SEARCH_GROUP_MAP = SEARCH_GROUPS.reduce((accumulator, group) => {
    accumulator[group.key] = group;
    return accumulator;
  }, {});

  function clampSearchLimit(limit) {
    const normalized = Number(limit);
    if (!Number.isFinite(normalized)) {
      return 8;
    }
    return Math.min(50, Math.max(1, Math.round(normalized)));
  }

  function buildSearchRequestPath(query, limit = 8) {
    const params = new URLSearchParams();
    params.set("q", String(query || "").trim());
    params.set("limit", String(clampSearchLimit(limit)));
    return `/admin/api/search?${params.toString()}`;
  }

  function normalizeSearchItem(groupKey, item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const title = String(item.title || "").trim();
    const targetPage = String(item.target_page || "").trim();
    const rawTargetID = item.target_id ?? item.id;
    const targetId = String(rawTargetID || "").trim();
    const id = String(item.id || rawTargetID || "").trim();
    if (!title || !targetPage || !targetId || !id) {
      return null;
    }

    return {
      group: groupKey,
      kind: String(item.kind || "").trim() || groupKey.replace(/s$/, ""),
      id,
      title,
      subtitle: String(item.subtitle || "").trim(),
      meta: String(item.meta || "").trim(),
      status: String(item.status || "").trim(),
      targetPage,
      targetId,
    };
  }

  function normalizeSearchResponse(payload) {
    const query = String(payload?.query || "").trim();
    const source = payload?.results && typeof payload.results === "object" ? payload.results : {};
    const groups = [];
    let total = 0;

    SEARCH_GROUPS.forEach((group) => {
      const items = Array.isArray(source[group.key])
        ? source[group.key].map((entry) => normalizeSearchItem(group.key, entry)).filter(Boolean)
        : [];

      if (items.length > 0) {
        total += items.length;
        groups.push({
          key: group.key,
          label: group.label,
          items,
        });
      }
    });

    return { query, total, groups };
  }

  function isSearchShortcut(event) {
    if (!event || event.altKey || event.shiftKey) {
      return false;
    }
    const key = String(event.key || "").toLowerCase();
    return key === "k" && Boolean(event.ctrlKey || event.metaKey);
  }

  function isSearchDismissKey(event) {
    return String(event?.key || "") === "Escape";
  }

  function getSearchResultTarget(item) {
    if (!item) {
      return null;
    }
    return {
      page: item.targetPage,
      drawer: {
        kind: item.kind,
        id: item.targetId,
        title: item.title,
      },
    };
  }

  function nextSearchSequence(currentSequence = 0) {
    const normalized = Number(currentSequence);
    if (!Number.isFinite(normalized) || normalized < 0) {
      return 1;
    }
    return Math.floor(normalized) + 1;
  }

  function createSearchRequest(query, currentSequence = 0) {
    return {
      sequence: nextSearchSequence(currentSequence),
      query: String(query || "").trim(),
    };
  }

  function createDebouncedTask(task, wait = 250, timerAPI = {}) {
    const schedule = typeof timerAPI.schedule === "function" ? timerAPI.schedule : (callback, delay) => setTimeout(callback, delay);
    const cancel = typeof timerAPI.cancel === "function" ? timerAPI.cancel : (handle) => clearTimeout(handle);
    let pending = null;

    function debouncedTask(...args) {
      if (pending) {
        cancel(pending);
      }
      pending = schedule(() => {
        pending = null;
        task(...args);
      }, wait);
    }

    debouncedTask.cancel = () => {
      if (pending) {
        cancel(pending);
        pending = null;
      }
    };

    return debouncedTask;
  }

  const api = {
    SEARCH_GROUPS,
    SEARCH_GROUP_MAP,
    buildSearchRequestPath,
    clampSearchLimit,
    createSearchRequest,
    createDebouncedTask,
    getSearchResultTarget,
    isSearchDismissKey,
    isSearchShortcut,
    nextSearchSequence,
    normalizeSearchResponse,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.SearchUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
