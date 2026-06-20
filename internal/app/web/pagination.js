(function initPaginationModule(globalScope) {
  function bindPagination(container, key, rerender, state, { reportError = defaultReportError } = {}) {
    container.querySelector(`[data-page-size="${key}"]`)?.addEventListener("change", async (event) => {
      state.pagination[key].size = Number(event.currentTarget.value || 10);
      state.pagination[key].page = 1;
      await Promise.resolve(rerender()).catch(reportError);
    });

    container.querySelector(`[data-page-prev="${key}"]`)?.addEventListener("click", async () => {
      state.pagination[key].page = Math.max(1, state.pagination[key].page - 1);
      await Promise.resolve(rerender()).catch(reportError);
    });

    container.querySelector(`[data-page-next="${key}"]`)?.addEventListener("click", async () => {
      state.pagination[key].page += 1;
      await Promise.resolve(rerender()).catch(reportError);
    });

    container.querySelectorAll(`[data-page-number="${key}"]`).forEach((button) => {
      button.addEventListener("click", async () => {
        state.pagination[key].page = Number(button.dataset.pageValue || 1);
        await Promise.resolve(rerender()).catch(reportError);
      });
    });
  }

  function currentLocalPageData(key, items, state, {
    pageSizeOptions,
    resourceStateUtils,
  } = {}) {
    return resourceStateUtils.currentLocalPageData(key, items, state, { pageSizeOptions });
  }

  function currentRemotePageData(key, items, state, {
    pageSizeOptions,
    resourceStateUtils,
  } = {}) {
    return resourceStateUtils.currentRemotePageData(key, items, state, { pageSizeOptions });
  }

  function applyPagedResponse(key, payload, state, {
    pageSizeOptions,
    resourceStateUtils,
  } = {}) {
    return resourceStateUtils.applyPagedResponse(key, payload, state, { pageSizeOptions });
  }

  function renderPagination(key, pageData, {
    pageSizeOptions,
    paginationPageNumbers = defaultPaginationPageNumbers,
  } = {}) {
    if (Number(pageData?.total) <= 0) {
      return "";
    }

    return `
      <div class="pagination-bar" data-pagination="${key}">
        <div class="pagination-meta">
          <span>共 ${pageData.total} 条</span>
          <span>第 ${pageData.page} / ${pageData.totalPages} 页</span>
        </div>
        <div class="pagination-controls">
          <label class="pagination-size">
            <span>每页</span>
            <select data-page-size="${key}">
              ${ensureArray(pageSizeOptions).map((size) => `<option value="${size}" ${pageData.size === size ? "selected" : ""}>${size}</option>`).join("")}
            </select>
          </label>
          <div class="pagination-pages">
            <button class="small-button ghost-button pagination-arrow" data-page-prev="${key}" type="button" aria-label="上一页" ${pageData.page <= 1 ? "disabled" : ""}>&lsaquo;</button>
            ${paginationPageNumbers(pageData).map((page) => {
              if (page === "...") {
                return `<span class="pagination-ellipsis">...</span>`;
              }
              return `<button class="small-button ${page === pageData.page ? "pagination-number active" : "ghost-button pagination-number"}" data-page-number="${key}" data-page-value="${page}" type="button">${page}</button>`;
            }).join("")}
            <button class="small-button ghost-button pagination-arrow" data-page-next="${key}" type="button" aria-label="下一页" ${pageData.page >= pageData.totalPages ? "disabled" : ""}>&rsaquo;</button>
          </div>
        </div>
      </div>
    `;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultPaginationPageNumbers(pageData) {
    const totalPages = Math.max(1, Number(pageData?.totalPages) || 1);
    const current = Math.max(1, Number(pageData?.page) || 1);
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_value, index) => index + 1);
    }

    if (current <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (current >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", current - 1, current, current + 1, "...", totalPages];
  }

  function defaultReportError(error) {
    throw error;
  }

  const api = {
    applyPagedResponse,
    bindPagination,
    currentLocalPageData,
    currentRemotePageData,
    renderPagination,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.PaginationUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
