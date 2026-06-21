(function initShellViewModule(globalScope) {
  function pageIDFromHash(hash, pages) {
    const id = String(hash || "").replace(/^#/, "");
    return ensurePageExists(pages, id) ? id : "overview";
  }

  function activatePageView({
    pages,
    pageLinks,
    id,
    pageTitle,
    pageBreadcrumb,
  }) {
    const nextID = ensurePageExists(pages, id) ? id : "overview";
    ensureArray(pages).forEach((page) => {
      page.classList?.toggle?.("active", page.id === nextID);
    });
    ensureArray(pageLinks).forEach((link) => {
      link.classList?.toggle?.("active", link?.dataset?.pageLink === nextID);
    });

    const activePage = ensureArray(pages).find((page) => page.id === nextID);
    if (activePage) {
      if (pageTitle) {
        pageTitle.textContent = activePage.dataset?.pageTitle || "透明代理控制台";
      }
      if (pageBreadcrumb) {
        pageBreadcrumb.textContent = activePage.dataset?.pageBreadcrumb || "Dashboard";
      }
    }
    return nextID;
  }

  function renderThemeView({
    rootElement,
    appShell,
    themeToggleBtn,
    themeToggleLabel,
    theme,
    preference,
    getThemeToggleState,
  }) {
    if (rootElement?.dataset) {
      rootElement.dataset.theme = theme;
      rootElement.dataset.themePreference = preference;
    }
    appShell?.setAttribute?.("data-theme", theme);

    if (!themeToggleBtn) {
      return;
    }
    const buttonState = typeof getThemeToggleState === "function"
      ? getThemeToggleState({ preference, theme })
      : {
        label: theme === "dark" ? "Dark" : "Light",
        hint: "Switch theme mode",
        pressed: theme === "dark",
      };

    if (themeToggleLabel) {
      themeToggleLabel.textContent = buttonState.label;
    } else {
      themeToggleBtn.textContent = buttonState.label;
    }
    themeToggleBtn.title = buttonState.hint;
    themeToggleBtn.setAttribute(
      "aria-pressed",
      buttonState.pressed === "mixed" ? "mixed" : String(Boolean(buttonState.pressed)),
    );
  }

  function renderSearchShellView({
    searchModalRoot,
    searchOpenBtn,
    searchInput,
    searchResultsRoot,
    isOpen,
    query,
    resultsMarkup,
  }) {
    searchModalRoot?.classList?.toggle?.("hidden", !isOpen);
    searchModalRoot?.setAttribute?.("aria-hidden", String(!isOpen));
    searchOpenBtn?.setAttribute?.("aria-expanded", String(Boolean(isOpen)));
    if (searchOpenBtn && searchOpenBtn.value !== query) {
      searchOpenBtn.value = query;
    }
    if (searchInput && searchInput.value !== query) {
      searchInput.value = query;
    }
    if (searchResultsRoot) {
      searchResultsRoot.innerHTML = resultsMarkup;
    }
  }

  function renderSearchResults({
    query,
    loading,
    results,
    keyboardState,
    escapeHTML = defaultEscapeHTML,
  }) {
    const trimmedQuery = String(query || "").trim();
    const normalizedResults = results && typeof results === "object"
      ? results
      : { total: 0, groups: [] };
    const activeItem = keyboardState?.activeItem || null;

    if (!trimmedQuery) {
      return `
        <div class="search-empty-state">
          <strong>Search everything</strong>
          <p class="muted-text">按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 或 <kbd>⌘</kbd> + <kbd>K</kbd> 快速打开，支持资源与观测数据统一搜索。</p>
        </div>
      `;
    }

    if (loading) {
      return `
        <div class="search-empty-state">
          <strong>Searching “${escapeHTML(trimmedQuery)}”</strong>
          <p class="muted-text">正在查询 backends、keys、policies、proxies、usage logs 与 events。</p>
        </div>
      `;
    }

    if (!normalizedResults.total) {
      return `
        <div class="search-empty-state">
          <strong>No results</strong>
          <p class="muted-text">没有找到与 “${escapeHTML(trimmedQuery)}” 相关的结果。</p>
        </div>
      `;
    }

    const resultsMarkup = ensureArray(normalizedResults.groups).map((group) => `
      <section class="search-result-group">
        <header class="search-result-group-head">
          <span>${escapeHTML(group.label)}</span>
          <small>${ensureArray(group.items).length}</small>
        </header>
        <div class="search-result-list">
          ${ensureArray(group.items).map((item, itemIndex) => `
            <button
              class="search-result-item ${activeItem && activeItem.groupKey === group.key && activeItem.itemIndex === itemIndex ? "active" : ""}"
              type="button"
              data-search-result="true"
              data-search-group="${escapeHTML(group.key)}"
              data-search-kind="${escapeHTML(item.kind)}"
              data-search-page="${escapeHTML(item.targetPage)}"
              data-search-id="${escapeHTML(item.targetId)}"
              data-search-title="${escapeHTML(item.title)}"
              data-search-index="${escapeHTML(String(itemIndex))}"
            >
              <span class="search-result-copy">
                <span class="search-result-copy-head">
                  <strong>${escapeHTML(item.title)}</strong>
                  <span class="search-result-kind">${escapeHTML(formatSearchKind(item.kind))}</span>
                </span>
                ${item.subtitle ? `<span>${escapeHTML(item.subtitle)}</span>` : ""}
                <span class="search-result-destination">${escapeHTML(formatSearchDestination(item))}</span>
              </span>
              <span class="search-result-meta">
                ${item.status ? `<em class="search-status-pill">${escapeHTML(item.status)}</em>` : ""}
                ${item.meta ? `<small>${escapeHTML(item.meta)}</small>` : ""}
              </span>
            </button>
          `).join("")}
        </div>
      </section>
    `).join("");

    return `
      ${resultsMarkup}
      <footer class="search-results-footer">
        <small>${escapeHTML(formatResultCount(normalizedResults.total))}</small>
        <span class="search-results-footer-hint">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <span>Navigate</span>
          <kbd>Enter</kbd>
          <span>Open</span>
          <kbd>Esc</kbd>
          <span>Close</span>
        </span>
      </footer>
    `;
  }

  function ensurePageExists(pages, id) {
    return ensureArray(pages).some((page) => page?.id === id);
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultEscapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatSearchKind(kind) {
    const normalizedKind = String(kind || "").trim();
    if (!normalizedKind) {
      return "Item";
    }

    return normalizedKind
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function formatSearchDestination(item) {
    const pageLabel = formatSearchPage(item?.targetPage);
    const kindLabel = formatSearchKind(item?.kind);

    if (!pageLabel) {
      return `Opens ${kindLabel}`;
    }

    return item?.targetId
      ? `Opens page ${pageLabel} details`
      : `Opens page ${pageLabel}`;
  }

  function formatSearchPage(page) {
    const normalizedPage = String(page || "").trim();
    if (!normalizedPage) {
      return "";
    }

    return normalizedPage
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function formatResultCount(total) {
    const normalizedTotal = Number(total) || 0;
    return `${normalizedTotal} result${normalizedTotal === 1 ? "" : "s"}`;
  }

  const api = {
    activatePageView,
    pageIDFromHash,
    renderSearchResults,
    renderSearchShellView,
    renderThemeView,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ShellViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
