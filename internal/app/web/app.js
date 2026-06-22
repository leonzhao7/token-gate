const tokenInput = document.querySelector("#adminToken");
const saveTokenBtn = document.querySelector("#saveTokenBtn");
const refreshBtn = document.querySelector("#refreshBtn");
const globalSearchBtn = document.querySelector("#globalSearchBtn");
const themeToggleBtn = document.querySelector("#themeToggleBtn");
const pageTitle = document.querySelector("#pageTitle");
const pageBreadcrumb = document.querySelector("#pageBreadcrumb");
const searchModal = document.querySelector("#searchModal");
const searchModalCloseBtn = document.querySelector("#searchModalCloseBtn");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
const drawer = document.querySelector("#detailDrawer");
const drawerTitle = document.querySelector("#drawerTitle");
const drawerBody = document.querySelector("#drawerBody");
const drawerCloseBtn = document.querySelector("#drawerCloseBtn");
const usageOverviewChart = document.querySelector("#usageOverviewChart");
const usageChartTabs = document.querySelector("#usageChartTabs");
const eventsSummaryCards = document.querySelector("#eventsSummaryCards");
const recentEventsPanel = document.querySelector("#recentEventsPanel");
const recentUsageLogsPanel = document.querySelector("#recentUsageLogsPanel");
const stats = document.querySelector("#stats");
const proxyList = document.querySelector("#proxyList");
const backendList = document.querySelector("#backendList");
const clientList = document.querySelector("#clientList");
const policyList = document.querySelector("#policyList");
const eventList = document.querySelector("#eventList");
const usageLogList = document.querySelector("#usageLogList");
const deleteUsageLogsBtn = document.querySelector("#deleteUsageLogsBtn");
const clearUsageLogsBtn = document.querySelector("#clearUsageLogsBtn");
const usageLogBackendFilter = document.querySelector("#usageLogBackendFilter");
const usageLogModelFilter = document.querySelector("#usageLogModelFilter");
const usageLogClientKeyFilter = document.querySelector("#usageLogClientKeyFilter");
const usageLogBackendOptions = document.querySelector("#usageLogBackendOptions");
const usageLogModelOptions = document.querySelector("#usageLogModelOptions");
const usageLogClientKeyOptions = document.querySelector("#usageLogClientKeyOptions");
const applyUsageLogFiltersBtn = document.querySelector("#applyUsageLogFiltersBtn");
const resetUsageLogFiltersBtn = document.querySelector("#resetUsageLogFiltersBtn");
const pages = Array.from(document.querySelectorAll(".page"));
const pageLinks = Array.from(document.querySelectorAll("[data-page-link]"));

const proxyForm = document.querySelector("#proxyForm");
const backendForm = document.querySelector("#backendForm");
const clientForm = document.querySelector("#clientForm");
const policyForm = document.querySelector("#policyForm");

const addProxyBtn = document.querySelector("#addProxyBtn");
const addBackendBtn = document.querySelector("#addBackendBtn");
const addClientBtn = document.querySelector("#addClientBtn");
const addPolicyBtn = document.querySelector("#addPolicyBtn");
const proxyModal = document.querySelector("#proxyModal");
const proxyModalCloseBtn = document.querySelector("#proxyModalCloseBtn");
const proxyModalTitle = document.querySelector("#proxyModalTitle");
const proxySubmitBtn = document.querySelector("#proxySubmitBtn");
const proxyCancelBtn = document.querySelector("#proxyCancelBtn");
const proxyEditBanner = document.querySelector("#proxyEditBanner");
const backendModal = document.querySelector("#backendModal");
const backendModalCloseBtn = document.querySelector("#backendModalCloseBtn");
const backendModalTitle = document.querySelector("#backendModalTitle");
const backendSubmitBtn = document.querySelector("#backendSubmitBtn");
const backendCancelBtn = document.querySelector("#backendCancelBtn");
const backendEditBanner = document.querySelector("#backendEditBanner");
const clientModal = document.querySelector("#clientModal");
const clientModalCloseBtn = document.querySelector("#clientModalCloseBtn");
const clientModalTitle = document.querySelector("#clientModalTitle");
const clientSubmitBtn = document.querySelector("#clientSubmitBtn");
const clientCancelBtn = document.querySelector("#clientCancelBtn");
const clientEditBanner = document.querySelector("#clientEditBanner");
const policyModal = document.querySelector("#policyModal");
const policyModalCloseBtn = document.querySelector("#policyModalCloseBtn");
const policyModalTitle = document.querySelector("#policyModalTitle");
const policySubmitBtn = document.querySelector("#policySubmitBtn");
const policyCancelBtn = document.querySelector("#policyCancelBtn");
const policyEditBanner = document.querySelector("#policyEditBanner");

const ADMIN_TOKEN_KEY = "token-gate-admin-token";
const THEME_KEY = "token-gate-theme";
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SEARCH_GROUPS = [
  { key: "backends", label: "Backends", resourceType: "backend" },
  { key: "client_keys", label: "Client Keys", resourceType: "client" },
  { key: "policies", label: "Policies", resourceType: "policy" },
  { key: "proxies", label: "Proxies", resourceType: "proxy" },
  { key: "events", label: "Events", resourceType: "event" },
  { key: "usage_logs", label: "Usage Logs", resourceType: "usage_log" },
];
const RESOURCE_DETAIL_ENDPOINTS = {
  backend: (id) => `/admin/api/backends/${id}/detail`,
  client: (id) => `/admin/api/client-keys/${id}/detail`,
  policy: (id) => `/admin/api/model-policies/${id}/detail`,
  proxy: (id) => `/admin/api/socks-proxies/${id}/detail`,
};
const state = {
  proxies: [],
  backends: [],
  clients: [],
  policies: [],
  events: [],
  usageLogs: [],
  dashboard: {
    summary: null,
    usage: null,
    activity: null,
  },
  usageLogOptions: {
    backends: [],
    models: [],
    clientKeys: [],
  },
  paginationMeta: {
    proxies: { total: 0, page: 1, limit: 10 },
    backends: { total: 0, page: 1, limit: 10 },
    clients: { total: 0, page: 1, limit: 10 },
    policies: { total: 0, page: 1, limit: 10 },
    events: { total: 0, page: 1, limit: 10 },
    usageLogs: { total: 0, page: 1, limit: 10 },
  },
  editingProxyID: null,
  editingBackendID: null,
  editingClientID: null,
  editingPolicyID: null,
  expandedProxies: new Set(),
  expandedBackends: new Set(),
  expandedClients: new Set(),
  expandedPolicies: new Set(),
  expandedUsageLogs: new Set(),
  usageLogFilters: {
    backend: "",
    model: "",
    clientKey: "",
  },
  pagination: {
    proxies: { page: 1, size: 10 },
    backends: { page: 1, size: 10 },
    clients: { page: 1, size: 10 },
    policies: { page: 1, size: 10 },
    events: { page: 1, size: 10 },
    usageLogs: { page: 1, size: 10 },
  },
  ui: {
    theme: "light",
    search: { open: false, query: "", results: null, loading: false },
    drawer: { open: false, title: "", content: "" },
    usageChartMode: "requests",
  },
};

let searchDebounceTimer = null;
let searchRequestSeq = 0;

tokenInput.value = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
applyTheme(resolveInitialTheme());

window.addEventListener("hashchange", () => {
  activatePage(pageIDFromHash());
});

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openSearchModal();
  }
  if (event.key === "Escape") {
    closeSearchModal();
    closeDrawer();
  }
});

saveTokenBtn.addEventListener("click", () => {
  localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.value.trim());
});

globalSearchBtn.addEventListener("click", () => {
  openSearchModal();
});

themeToggleBtn.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

refreshBtn.addEventListener("click", () => {
  refreshAll().catch(reportError);
});

usageChartTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-chart-mode]");
  if (!button) {
    return;
  }
  state.ui.usageChartMode = button.dataset.chartMode || "requests";
  renderUsageChart();
});

searchModalCloseBtn.addEventListener("click", () => {
  closeSearchModal();
});

searchModal.addEventListener("click", (event) => {
  if (event.target === searchModal) {
    closeSearchModal();
  }
});

searchInput.addEventListener("input", () => {
  state.ui.search.query = searchInput.value;
  scheduleSearch();
});

searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-result]");
  if (!button) {
    return;
  }
  closeSearchModal();
  openSearchResultDetail(button.dataset.searchType, button.dataset.searchId).catch(reportError);
});

drawerCloseBtn.addEventListener("click", () => {
  closeDrawer();
});

addProxyBtn.addEventListener("click", () => {
  startCreateProxy();
});

proxyModalCloseBtn.addEventListener("click", () => {
  resetProxyForm();
});

proxyModal.addEventListener("click", (event) => {
  if (event.target === proxyModal) {
    resetProxyForm();
  }
});

proxyCancelBtn.addEventListener("click", () => {
  resetProxyForm();
});

addBackendBtn.addEventListener("click", () => {
  startCreateBackend();
});

backendModalCloseBtn.addEventListener("click", () => {
  resetBackendForm();
});

backendModal.addEventListener("click", (event) => {
  if (event.target === backendModal) {
    resetBackendForm();
  }
});

backendCancelBtn.addEventListener("click", () => {
  resetBackendForm();
});

addClientBtn.addEventListener("click", () => {
  startCreateClient();
});

clientModalCloseBtn.addEventListener("click", () => {
  resetClientForm();
});

clientModal.addEventListener("click", (event) => {
  if (event.target === clientModal) {
    resetClientForm();
  }
});

clientCancelBtn.addEventListener("click", () => {
  resetClientForm();
});

addPolicyBtn.addEventListener("click", () => {
  startCreatePolicy();
});

policyModalCloseBtn.addEventListener("click", () => {
  resetPolicyForm();
});

policyModal.addEventListener("click", (event) => {
  if (event.target === policyModal) {
    resetPolicyForm();
  }
});

policyCancelBtn.addEventListener("click", () => {
  resetPolicyForm();
});

applyUsageLogFiltersBtn.addEventListener("click", () => {
  applyUsageLogFilters().catch(reportError);
});

resetUsageLogFiltersBtn.addEventListener("click", () => {
  resetUsageLogFilters().catch(reportError);
});

clearUsageLogsBtn.addEventListener("click", () => {
  clearUsageLogs().catch(reportError);
});

deleteUsageLogsBtn.addEventListener("click", () => {
  deleteFilteredUsageLogs().catch(reportError);
});

[usageLogBackendFilter, usageLogModelFilter, usageLogClientKeyFilter].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyUsageLogFilters().catch(reportError);
    }
  });
});

proxyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingProxyID !== null;
    const data = readForm(event.currentTarget);
    data.enabled = Boolean(data.enabled);

    const path = editing ? `/admin/api/socks-proxies/${state.editingProxyID}` : "/admin/api/socks-proxies";
    const method = editing ? "PUT" : "POST";
    await api(path, method, data);
    resetProxyForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

backendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingBackendID !== null;
    const data = readForm(event.currentTarget);
    data.models = splitList(data.models);
    data.model_mapping = parseModelMapping(data.model_mapping);
    data.endpoints = splitList(data.endpoints);
    data.weight = Number(data.weight || 1);
    data.proxy_id = Number(data.proxy_id || 0);
    data.enabled = Boolean(data.enabled);

    if (!editing && !String(data.api_key || "").trim()) {
      throw new Error("新增 Backend 必须填写 API key");
    }

    const path = editing ? `/admin/api/backends/${state.editingBackendID}` : "/admin/api/backends";
    const method = editing ? "PUT" : "POST";
    await api(path, method, data);
    resetBackendForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingClientID !== null;
    const data = readForm(event.currentTarget);
    data.enabled = Boolean(data.enabled);

    const path = editing ? `/admin/api/client-keys/${state.editingClientID}` : "/admin/api/client-keys";
    const method = editing ? "PUT" : "POST";
    const response = await api(path, method, data);

    if (response.issued_token) {
      alert(`Issued token: ${response.issued_token}`);
    }
    resetClientForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

policyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const editing = state.editingPolicyID !== null;
    const data = readForm(event.currentTarget);
    data.priority = Number(data.priority || 100);
    data.failover_enabled = Boolean(data.failover_enabled);

    const path = editing ? `/admin/api/model-policies/${state.editingPolicyID}` : "/admin/api/model-policies";
    const method = editing ? "PUT" : "POST";
    await api(path, method, data);
    resetPolicyForm();
    await refreshAll();
  } catch (error) {
    reportError(error);
  }
});

async function refreshAll() {
  const proxyPage = state.pagination.proxies;
  const backendPage = state.pagination.backends;
  const clientPage = state.pagination.clients;
  const policyPage = state.pagination.policies;
  const eventPage = state.pagination.events;
  const usageLogPage = state.pagination.usageLogs;
  const usageLogQuery = buildUsageLogQuery();
  const [overview, proxies, backends, clients, policies, events, usageLogs, usageLogOptions, dashboardSummary, dashboardUsage, dashboardActivity] = await Promise.all([
    api("/admin/api/overview"),
    api(`/admin/api/socks-proxies?page=${proxyPage.page}&limit=${proxyPage.size}`),
    api(`/admin/api/backends?page=${backendPage.page}&limit=${backendPage.size}`),
    api(`/admin/api/client-keys?page=${clientPage.page}&limit=${clientPage.size}`),
    api(`/admin/api/model-policies?page=${policyPage.page}&limit=${policyPage.size}`),
    api(`/admin/api/events?page=${eventPage.page}&limit=${eventPage.size}`),
    api(`/admin/api/usage-logs?page=${usageLogPage.page}&limit=${usageLogPage.size}${usageLogQuery}`),
    api("/admin/api/usage-log-options"),
    api("/admin/api/dashboard/summary"),
    api("/admin/api/dashboard/usage?range=7d"),
    api("/admin/api/dashboard/activity"),
  ]);

  overview.backends = ensureArray(overview.backends);
  overview.events = ensureArray(overview.events);
  applyPagedResponse("proxies", proxies);
  applyPagedResponse("backends", backends);
  applyPagedResponse("clients", clients);
  applyPagedResponse("policies", policies);
  applyPagedResponse("events", events);
  applyPagedResponse("usageLogs", usageLogs);
  state.usageLogOptions.backends = ensureArray(usageLogOptions?.backends);
  state.usageLogOptions.models = ensureArray(usageLogOptions?.models);
  state.usageLogOptions.clientKeys = ensureArray(usageLogOptions?.client_keys);
  state.dashboard.summary = dashboardSummary || null;
  state.dashboard.usage = dashboardUsage || null;
  state.dashboard.activity = dashboardActivity || null;

  renderStats(overview);
  renderProxyOptions();
  renderUsageLogFilterOptions();
  renderProxies();
  renderBackends();
  renderClients();
  renderPolicies();
  renderEvents();
  renderUsageLogs();
  renderDashboardPanels(overview);
  renderSearchResults();
}

function buildUsageLogQuery() {
  const params = new URLSearchParams();
  if (state.usageLogFilters.backend) {
    params.set("backend", state.usageLogFilters.backend);
  }
  if (state.usageLogFilters.model) {
    params.set("model", state.usageLogFilters.model);
  }
  if (state.usageLogFilters.clientKey) {
    params.set("client_key", state.usageLogFilters.clientKey);
  }
  const query = params.toString();
  return query ? `&${query}` : "";
}

function syncUsageLogFilterInputs() {
  usageLogBackendFilter.value = state.usageLogFilters.backend;
  usageLogModelFilter.value = state.usageLogFilters.model;
  usageLogClientKeyFilter.value = state.usageLogFilters.clientKey;
}

async function applyUsageLogFilters() {
  state.usageLogFilters.backend = String(usageLogBackendFilter.value || "").trim();
  state.usageLogFilters.model = String(usageLogModelFilter.value || "").trim();
  state.usageLogFilters.clientKey = String(usageLogClientKeyFilter.value || "").trim();
  state.pagination.usageLogs.page = 1;
  await refreshAll();
}

async function resetUsageLogFilters() {
  state.usageLogFilters.backend = "";
  state.usageLogFilters.model = "";
  state.usageLogFilters.clientKey = "";
  syncUsageLogFilterInputs();
  state.pagination.usageLogs.page = 1;
  await refreshAll();
}

async function clearUsageLogs() {
  if (!confirm("确认清空所有使用日志？")) {
    return;
  }
  await api("/admin/api/usage-logs", "DELETE");
  state.pagination.usageLogs.page = 1;
  await refreshAll();
}

async function deleteFilteredUsageLogs() {
  if (!state.usageLogFilters.backend && !state.usageLogFilters.model && !state.usageLogFilters.clientKey) {
    throw new Error("请先设置查询条件，再删除查询结果");
  }
  if (!confirm("确认删除当前查询条件命中的使用日志？")) {
    return;
  }
  await api(`/admin/api/usage-logs?${buildUsageLogDeleteQuery()}`, "DELETE");
  state.pagination.usageLogs.page = 1;
  await refreshAll();
}

function buildUsageLogDeleteQuery() {
  const params = new URLSearchParams();
  if (state.usageLogFilters.backend) {
    params.set("backend", state.usageLogFilters.backend);
  }
  if (state.usageLogFilters.model) {
    params.set("model", state.usageLogFilters.model);
  }
  if (state.usageLogFilters.clientKey) {
    params.set("client_key", state.usageLogFilters.clientKey);
  }
  return params.toString();
}

function renderUsageLogFilterOptions() {
  renderDatalist(usageLogBackendOptions, state.usageLogOptions.backends);
  renderDatalist(usageLogModelOptions, state.usageLogOptions.models);
  renderDatalist(usageLogClientKeyOptions, state.usageLogOptions.clientKeys);
}

function renderStats(overview) {
  const dashboardCards = normalizedDashboardCards(overview);
  const backendCard = dashboardCards.backends;
  const clientCard = dashboardCards.client_keys;
  const policyCard = dashboardCards.policies;
  const proxyCard = dashboardCards.proxies;
  stats.innerHTML = `
    <article class="metric-card">
      <strong>${backendCard.count}</strong>
      <span>Backends</span>
      <span class="metric-copy">${escapeHTML(formatBackendCardCopy(backendCard))}</span>
    </article>
    <article class="metric-card">
      <strong>${clientCard.count}</strong>
      <span>Client Keys</span>
      <span class="metric-copy">当前可管理的客户端身份数量。</span>
    </article>
    <article class="metric-card">
      <strong>${policyCard.count}</strong>
      <span>Policies</span>
      <span class="metric-copy">正在生效的模型调度规则数量。</span>
    </article>
    <article class="metric-card">
      <strong>${proxyCard.count}</strong>
      <span>Proxies</span>
      <span class="metric-copy">可被 Backend 绑定的出口代理数量。</span>
    </article>
  `;
}

function normalizedDashboardCards(overview) {
  const cards = state.dashboard.summary?.cards || {};
  return {
    backends: normalizedDashboardCard(cards.backends, {
      count: ensureArray(overview?.backends).length,
      enabled: ensureArray(overview?.backends).filter((backend) => backend.enabled).length,
    }),
    client_keys: normalizedDashboardCard(cards.client_keys, {
      count: Number(overview?.client_keys) || 0,
    }),
    policies: normalizedDashboardCard(cards.policies, {
      count: Number(overview?.model_policies) || 0,
    }),
    proxies: normalizedDashboardCard(cards.proxies, {
      count: Number(overview?.socks_proxies) || 0,
    }),
  };
}

function normalizedDashboardCard(card, fallback) {
  const count = asFiniteNumber(card?.count);
  const enabled = asFiniteNumber(card?.enabled);
  return {
    count: count !== null ? count : asFiniteNumber(fallback?.count) || 0,
    enabled: enabled !== null ? enabled : asFiniteNumber(fallback?.enabled) || 0,
    successes: asFiniteNumber(card?.successes) || 0,
    failures: asFiniteNumber(card?.failures) || 0,
  };
}

function formatBackendCardCopy(card) {
  const enabledText = card.enabled > 0 ? `${card.enabled} enabled` : "0 enabled";
  const successText = `${card.successes} ok`;
  const failureText = `${card.failures} fail`;
  return `${enabledText} · ${successText} / ${failureText}`;
}

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pageIDFromHash() {
  const id = window.location.hash.slice(1);
  return pages.some((page) => page.id === id) ? id : "overview";
}

function activatePage(id) {
  const nextID = pages.some((page) => page.id === id) ? id : "overview";
  for (const page of pages) {
    page.classList.toggle("active", page.id === nextID);
  }
  for (const link of pageLinks) {
    link.classList.toggle("active", link.dataset.pageLink === nextID);
  }

  const activePage = pages.find((page) => page.id === nextID);
  if (activePage) {
    pageTitle.textContent = activePage.dataset.pageTitle || "Token Gate - AI Proxy Center";
    pageBreadcrumb.textContent = activePage.dataset.pageBreadcrumb || "Dashboard";
  }
}

function renderProxies() {
  const proxies = state.proxies;
  if (proxies.length === 0) {
    proxyList.innerHTML = emptyState(
      "还没有 SOCKS5 Proxy",
      "如果某些 Backend 需要固定出口代理，先在这里添加 SOCKS5 节点，再回到 Backend 里绑定。",
    );
    return;
  }
  const pageData = currentPageData("proxies", proxies);

  proxyList.innerHTML = `
    <div class="table-shell">
      <table class="resource-table">
        <thead>
          <tr>
            <th>Proxy</th>
            <th>Status</th>
            <th>Address</th>
            <th>Auth</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.items.map(renderProxyRow).join("")}
        </tbody>
      </table>
    </div>
    ${renderPagination("proxies", pageData)}
  `;

  proxyList.querySelectorAll("[data-toggle-proxy]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedProxies, button.dataset.toggleProxy);
      renderProxies();
    });
  });

  proxyList.querySelectorAll("[data-edit-proxy]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditProxy(button.dataset.editProxy);
    });
  });

  proxyList.querySelectorAll("[data-delete-proxy]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 SOCKS5 Proxy？已绑定的 Backend 会自动改为直连。")) {
          return;
        }
        await api(`/admin/api/socks-proxies/${button.dataset.deleteProxy}`, "DELETE");
        if (String(state.editingProxyID) === button.dataset.deleteProxy) {
          resetProxyForm();
        }
        state.expandedProxies.delete(button.dataset.deleteProxy);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(proxyList, "proxies", refreshAll);
}

function renderBackends() {
  const backends = state.backends;
  if (backends.length === 0) {
    backendList.innerHTML = emptyState(
      "还没有 Backend",
      "先配置至少一个 OpenAI 或 Claude/Anthropic 上游节点，之后模型路由和故障切换才会生效。",
    );
    return;
  }
  const pageData = currentPageData("backends", backends);

  backendList.innerHTML = `
    <div class="table-shell">
      <table class="resource-table">
        <thead>
          <tr>
            <th>Backend</th>
            <th>Status</th>
            <th>Protocol</th>
            <th>Pool</th>
            <th>Proxy</th>
            <th>Models</th>
            <th>Recent 30m</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.items.map(renderBackendRow).join("")}
        </tbody>
      </table>
    </div>
    ${renderPagination("backends", pageData)}
  `;

  backendList.querySelectorAll("[data-toggle-backend]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedBackends, button.dataset.toggleBackend);
      renderBackends();
    });
  });

  backendList.querySelectorAll("[data-edit-backend]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditBackend(button.dataset.editBackend);
    });
  });

  backendList.querySelectorAll("[data-delete-backend]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 Backend？")) {
          return;
        }
        await api(`/admin/api/backends/${button.dataset.deleteBackend}`, "DELETE");
        if (String(state.editingBackendID) === button.dataset.deleteBackend) {
          resetBackendForm();
        }
        state.expandedBackends.delete(button.dataset.deleteBackend);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(backendList, "backends", refreshAll);
}

function renderClients() {
  const clients = state.clients;
  if (clients.length === 0) {
    clientList.innerHTML = emptyState(
      "还没有 Client Key",
      "创建一个客户端 key 后，外部 SDK 或 AI 客户端才能通过 Token Gate 访问后端模型。",
    );
    return;
  }
  const pageData = currentPageData("clients", clients);

  clientList.innerHTML = `
    <div class="table-shell">
      <table class="resource-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Status</th>
            <th>Client Key</th>
            <th>Route Mode</th>
            <th>Route Group</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.items.map(renderClientRow).join("")}
        </tbody>
      </table>
    </div>
    ${renderPagination("clients", pageData)}
  `;

  clientList.querySelectorAll("[data-toggle-client]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedClients, button.dataset.toggleClient);
      renderClients();
    });
  });

  clientList.querySelectorAll("[data-edit-client]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditClient(button.dataset.editClient);
    });
  });

  clientList.querySelectorAll("[data-delete-client]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 Client Key？")) {
          return;
        }
        await api(`/admin/api/client-keys/${button.dataset.deleteClient}`, "DELETE");
        if (String(state.editingClientID) === button.dataset.deleteClient) {
          resetClientForm();
        }
        state.expandedClients.delete(button.dataset.deleteClient);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(clientList, "clients", refreshAll);
}

function renderPolicies() {
  const policies = state.policies;
  if (policies.length === 0) {
    policyList.innerHTML = emptyState(
      "还没有 Model Policy",
      "定义模型模式、端点和 placement 策略后，路由行为才会按业务意图收敛。",
    );
    return;
  }
  const pageData = currentPageData("policies", policies);

  policyList.innerHTML = `
    <div class="table-shell">
      <table class="resource-table">
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Endpoint</th>
            <th>Placement</th>
            <th>Pool</th>
            <th>Priority</th>
            <th>Failover</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.items.map(renderPolicyRow).join("")}
        </tbody>
      </table>
    </div>
    ${renderPagination("policies", pageData)}
  `;

  policyList.querySelectorAll("[data-toggle-policy]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedPolicies, button.dataset.togglePolicy);
      renderPolicies();
    });
  });

  policyList.querySelectorAll("[data-edit-policy]").forEach((button) => {
    button.addEventListener("click", () => {
      startEditPolicy(button.dataset.editPolicy);
    });
  });

  policyList.querySelectorAll("[data-delete-policy]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        if (!confirm("确认删除这个 Model Policy？")) {
          return;
        }
        await api(`/admin/api/model-policies/${button.dataset.deletePolicy}`, "DELETE");
        if (String(state.editingPolicyID) === button.dataset.deletePolicy) {
          resetPolicyForm();
        }
        state.expandedPolicies.delete(button.dataset.deletePolicy);
        await refreshAll();
      } catch (error) {
        reportError(error);
      }
    });
  });

  bindPagination(policyList, "policies", refreshAll);
}

function renderProxyRow(proxy) {
  const id = String(proxy.id);
  const expanded = state.expandedProxies.has(id);
  const editing = String(state.editingProxyID) === id;
  return `
    <tr class="${editing ? "is-editing" : ""}">
      <td>
        <button class="row-title" data-toggle-proxy="${proxy.id}" type="button">
          <span class="chevron">${expanded ? "收起" : "展开"}</span>
          <span>${escapeHTML(proxy.name)}</span>
        </button>
      </td>
      <td>${statusPill(proxy.enabled, "enabled", "disabled")}</td>
      <td><span class="secret-text">${escapeHTML(proxy.address)}</span></td>
      <td>${escapeHTML(proxy.username ? `user: ${proxy.username}` : "none")}</td>
      <td>${escapeHTML(formatDateTime(proxy.updated_at))}</td>
      <td>${tableActions("proxy", proxy.id)}</td>
    </tr>
    ${expanded ? `
      <tr class="detail-row">
        <td colspan="6">
          <div class="detail-panel">
            <div class="detail-grid">
              <div><strong>Name</strong><span>${escapeHTML(proxy.name)}</span></div>
              <div><strong>Address</strong><span>${escapeHTML(proxy.address)}</span></div>
              <div><strong>Username</strong><span>${escapeHTML(proxy.username || "-")}</span></div>
              <div><strong>Password</strong><span>${escapeHTML(proxy.password || "-")}</span></div>
              <div><strong>Created</strong><span>${escapeHTML(formatDateTime(proxy.created_at))}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(formatDateTime(proxy.updated_at))}</span></div>
            </div>
          </div>
        </td>
      </tr>
    ` : ""}
  `;
}

function renderBackendRow(backend) {
  const id = String(backend.id);
  const expanded = state.expandedBackends.has(id);
  const editing = String(state.editingBackendID) === id;
  const recentStats = backend.recent_stats || {};
  return `
    <tr class="${editing ? "is-editing" : ""}">
      <td>
        <button class="row-title" data-toggle-backend="${backend.id}" type="button">
          <span class="chevron">${expanded ? "收起" : "展开"}</span>
          <span>${escapeHTML(backend.name)}</span>
        </button>
        <div class="cell-subtitle">${escapeHTML(backend.base_url)}</div>
      </td>
      <td>${statusPill(backend.enabled, "enabled", "disabled")}</td>
      <td>${escapeHTML(backendProtocolLabel(backend.protocol))}</td>
      <td>${escapeHTML(backend.pool || "-")}</td>
      <td>${escapeHTML(proxyLabel(backend.proxy_id, backend.proxy))}</td>
      <td>${compactList(backend.models)}</td>
      <td>${escapeHTML(formatBackendRecentStats(recentStats))}</td>
      <td>${tableActions("backend", backend.id)}</td>
    </tr>
    ${expanded ? `
      <tr class="detail-row">
        <td colspan="8">
          <div class="detail-panel">
            <div class="detail-grid">
              <div><strong>Protocol</strong><span>${escapeHTML(backendProtocolLabel(backend.protocol))}</span></div>
              <div><strong>Base URL</strong><span>${escapeHTML(backend.base_url)}</span></div>
              <div><strong>API Key</strong><span>${escapeHTML(backend.api_key || "-")}</span></div>
              <div><strong>SOCKS5 Proxy</strong><span>${escapeHTML(proxyLabel(backend.proxy_id, backend.proxy))}</span></div>
              <div><strong>Proxy Address</strong><span>${escapeHTML(backend.proxy?.address || "-")}</span></div>
              <div><strong>Pool</strong><span>${escapeHTML(backend.pool || "-")}</span></div>
              <div><strong>Weight</strong><span>${backend.weight}</span></div>
              <div><strong>Model Mapping</strong><span>${escapeHTML(formatModelMapping(backend.model_mapping))}</span></div>
              <div><strong>Recent 30m</strong><span>${escapeHTML(formatBackendRecentStats(recentStats))}</span></div>
              <div><strong>Created</strong><span>${escapeHTML(formatDateTime(backend.created_at))}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(formatDateTime(backend.updated_at))}</span></div>
            </div>
            <div class="detail-section">
              <strong>Models</strong>
              <div class="chip-row">${chipList(backend.models)}</div>
            </div>
            <div class="detail-section">
              <strong>Endpoints</strong>
              <div class="chip-row">${chipList(backend.endpoints, "alt")}</div>
            </div>
          </div>
        </td>
      </tr>
    ` : ""}
  `;
}

function renderClientRow(client) {
  const id = String(client.id);
  const expanded = state.expandedClients.has(id);
  const editing = String(state.editingClientID) === id;
  return `
    <tr class="${editing ? "is-editing" : ""}">
      <td>
        <button class="row-title" data-toggle-client="${client.id}" type="button">
          <span class="chevron">${expanded ? "收起" : "展开"}</span>
          <span>${escapeHTML(client.name)}</span>
        </button>
      </td>
      <td>${statusPill(client.enabled, "enabled", "disabled")}</td>
      <td><span class="secret-text">${escapeHTML(clientTokenDisplay(client))}</span></td>
      <td>${escapeHTML(client.route_mode_override || "default")}</td>
      <td>${escapeHTML(client.route_group || "-")}</td>
      <td>${escapeHTML(formatDateTime(client.updated_at))}</td>
      <td>${tableActions("client", client.id)}</td>
    </tr>
    ${expanded ? `
      <tr class="detail-row">
        <td colspan="7">
          <div class="detail-panel">
            <div class="detail-grid">
              <div><strong>Name</strong><span>${escapeHTML(client.name)}</span></div>
              <div><strong>Client Key</strong><span>${escapeHTML(clientTokenDisplay(client))}</span></div>
              <div><strong>Token Prefix</strong><span>${escapeHTML(client.token_prefix || "-")}</span></div>
              <div><strong>Route Override</strong><span>${escapeHTML(client.route_mode_override || "policy default")}</span></div>
              <div><strong>Route Group</strong><span>${escapeHTML(client.route_group || "-")}</span></div>
              <div><strong>Created</strong><span>${escapeHTML(formatDateTime(client.created_at))}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(formatDateTime(client.updated_at))}</span></div>
            </div>
          </div>
        </td>
      </tr>
    ` : ""}
  `;
}

function renderPolicyRow(policy) {
  const id = String(policy.id);
  const expanded = state.expandedPolicies.has(id);
  const editing = String(state.editingPolicyID) === id;
  return `
    <tr class="${editing ? "is-editing" : ""}">
      <td>
        <button class="row-title" data-toggle-policy="${policy.id}" type="button">
          <span class="chevron">${expanded ? "收起" : "展开"}</span>
          <span>${escapeHTML(policy.pattern)}</span>
        </button>
      </td>
      <td>${escapeHTML(policy.endpoint)}</td>
      <td><span class="chip">${escapeHTML(policy.placement_policy)}</span></td>
      <td>${escapeHTML(policy.backend_pool || "-")}</td>
      <td>${policy.priority}</td>
      <td>${statusPill(policy.failover_enabled, "on", "off")}</td>
      <td>${tableActions("policy", policy.id)}</td>
    </tr>
    ${expanded ? `
      <tr class="detail-row">
        <td colspan="7">
          <div class="detail-panel">
            <div class="detail-grid">
              <div><strong>Pattern</strong><span>${escapeHTML(policy.pattern)}</span></div>
              <div><strong>Endpoint</strong><span>${escapeHTML(policy.endpoint)}</span></div>
              <div><strong>Placement</strong><span>${escapeHTML(policy.placement_policy)}</span></div>
              <div><strong>Backend Pool</strong><span>${escapeHTML(policy.backend_pool || "-")}</span></div>
              <div><strong>Priority</strong><span>${policy.priority}</span></div>
              <div><strong>Failover</strong><span>${policy.failover_enabled ? "enabled" : "disabled"}</span></div>
              <div><strong>Created</strong><span>${escapeHTML(formatDateTime(policy.created_at))}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(formatDateTime(policy.updated_at))}</span></div>
            </div>
          </div>
        </td>
      </tr>
    ` : ""}
  `;
}

function renderEvents() {
  const events = state.events;
  if (events.length === 0) {
    eventList.innerHTML = emptyState(
      "还没有事件",
      "配置变更、backend failover 或上游异常会出现在这里。",
    );
    return;
  }
  const pageData = currentPageData("events", events);

  eventList.innerHTML = `
    <div class="timeline-shell">
      ${pageData.items.map(renderEventRow).join("")}
    </div>
    ${renderPagination("events", pageData)}
  `;

  bindPagination(eventList, "events", refreshAll);
}

function renderUsageLogs() {
  const logs = state.usageLogs;
  syncUsageLogFilterInputs();
  deleteUsageLogsBtn.disabled = logs.length === 0;
  if (logs.length === 0) {
    usageLogList.innerHTML = emptyState(
      "还没有使用日志",
      "有客户端通过 Token Gate 发起请求后，这里会按请求维度记录一条 usage log。",
    );
    return;
  }
  const pageData = currentPageData("usageLogs", logs);

  usageLogList.innerHTML = `
    <div class="timeline-shell">
      ${pageData.items.map(renderUsageLogRow).join("")}
    </div>
    ${renderPagination("usageLogs", pageData)}
  `;

  usageLogList.querySelectorAll("[data-toggle-usage-log]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedUsageLogs, button.dataset.toggleUsageLog);
      renderUsageLogs();
    });
  });

  bindPagination(usageLogList, "usageLogs", refreshAll);
}

function renderDashboardPanels(overview) {
  renderUsageChart();
  renderEventsSummary(normalizedDashboardActivity(overview));
  renderRecentEvents(state.dashboard.activity);
  renderRecentUsageLogs(state.dashboard.activity);
}

function normalizedDashboardActivity(overview) {
  if (state.dashboard.activity) {
    return state.dashboard.activity;
  }
  return {
    events: ensureArray(overview?.events),
    usage_logs: [],
  };
}

function renderUsageChart() {
  if (!usageOverviewChart) {
    return;
  }
  const usageSeries = ensureArray(state.dashboard.usage?.series);
  const data = usageSeries.length > 0
    ? buildDashboardUsageChartSeries(usageSeries, state.ui.usageChartMode)
    : buildUsageChartSeries(state.usageLogs, state.ui.usageChartMode);
  usageOverviewChart.innerHTML = data.points.length === 0
    ? emptyState("暂无图表数据", "先加载几条使用日志，Usage Overview 会自动呈现趋势。")
    : renderSparkAreaChart(data.points, data.label, data.color, data.subtitle);
  usageChartTabs.querySelectorAll("[data-chart-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartMode === state.ui.usageChartMode);
  });
}

function renderEventsSummary(overview) {
  if (!eventsSummaryCards) {
    return;
  }
  const events = ensureArray(overview?.events);
  const counts = countEventsByCategory(events);
  eventsSummaryCards.innerHTML = [
    ["Warnings", counts.warning, "System and upstream warnings"],
    ["Errors", counts.error, "Backend or client failures"],
    ["Policy Changes", counts.policy, "Policy create/update/delete"],
    ["Key Creations", counts.client, "Client key provisioning"],
    ["Backend Updates", counts.backend, "Backend configuration changes"],
  ].map(([title, value, detail]) => `
    <article class="summary-item">
      <strong>${escapeHTML(title)}</strong>
      <span class="metric-copy">${escapeHTML(String(value))}</span>
      <small>${escapeHTML(detail)}</small>
    </article>
  `).join("");
}

function renderRecentEvents(activity) {
  if (!recentEventsPanel) {
    return;
  }
  const items = ensureArray(activity?.events).slice(0, 5);
  recentEventsPanel.innerHTML = items.length === 0
    ? emptyState("暂无事件", "最新的配置变更和上游事件会显示在这里。")
    : items.map((event) => `
        <article class="feed-item">
          <strong>${escapeHTML(eventTitle(event))}</strong>
          <small>${escapeHTML(event.message || "-")}</small>
          <small>${escapeHTML(formatDateTime(event.created_at))}</small>
        </article>
      `).join("");
}

function renderRecentUsageLogs(activity) {
  if (!recentUsageLogsPanel) {
    return;
  }
  const items = ensureArray(activity?.usage_logs).slice(0, 5);
  recentUsageLogsPanel.innerHTML = items.length === 0
    ? emptyState("暂无使用日志", "客户端通过代理发起请求后会在这里看到最近记录。")
    : items.map((log) => `
        <article class="feed-item">
          <strong>${escapeHTML(formatUsageRequest(log))}</strong>
          <small>${escapeHTML(log.client_name || "-")} · ${escapeHTML(log.backend_name || "-")}</small>
          <small>${escapeHTML(formatDateTime(log.created_at))}</small>
        </article>
      `).join("");
}

function renderSearchResults() {
  if (!searchResults) {
    return;
  }
  const query = String(state.ui.search.query || "").trim().toLowerCase();
  if (!state.ui.search.open) {
    searchResults.innerHTML = "";
    return;
  }
  if (state.ui.search.loading) {
    searchResults.innerHTML = emptyState("正在搜索", "Token Gate 正在查询资源和活动记录。");
    return;
  }

  const results = state.ui.search.results;
  if (!results) {
    searchResults.innerHTML = emptyState("开始搜索", "输入 backend、client key、policy、proxy、event 或日志关键字。");
    return;
  }

  const groups = SEARCH_GROUPS.map((group) => {
    const items = ensureArray(results[group.key]);
    return {
      ...group,
      items,
    };
  }).filter((group) => !query || group.items.length > 0);

  const hasAny = groups.some((group) => group.items.length > 0);
  if (!hasAny) {
    searchResults.innerHTML = emptyState("没有匹配结果", "试试输入 backend、client key、policy、proxy、event 或日志里的任意关键词。");
    return;
  }

  searchResults.innerHTML = groups.map((group) => `
    <section class="search-group">
      <div class="search-group-head">
        <strong>${escapeHTML(group.label)}</strong>
        <span>${group.items.length}</span>
      </div>
      <div class="search-group-list">
        ${group.items.slice(0, 4).map((item) => {
          const record = searchResultRecord(item);
          return `
          <button class="search-result" type="button" data-search-type="${escapeHTML(group.resourceType)}" data-search-id="${escapeHTML(record.id)}">
            <span>${escapeHTML(record.title)}</span>
            <strong>${escapeHTML(record.detail)}</strong>
            <small>${escapeHTML(record.summary)}</small>
          </button>
        `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

function searchResultRecord(item) {
  const raw = item?.raw || item || {};
  return {
    id: item?.target_id ?? item?.id ?? raw.id ?? "",
    title: item?.title || item?.name || raw.name || raw.pattern || raw.request_id || `#${item?.id ?? raw.id ?? "-"}`,
    detail: item?.subtitle || item?.detail || item?.meta || raw.detail || raw.summary || "-",
    summary: item?.meta || item?.summary || item?.status || raw.summary || raw.status || "-",
  };
}

function scheduleSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  const query = String(state.ui.search.query || "").trim();
  if (!state.ui.search.open) {
    return;
  }
  if (!query) {
    state.ui.search.results = null;
    state.ui.search.loading = false;
    renderSearchResults();
    return;
  }

  state.ui.search.loading = true;
  renderSearchResults();
  const requestID = ++searchRequestSeq;
  searchDebounceTimer = window.setTimeout(async () => {
    try {
      const response = await api(`/admin/api/search?q=${encodeURIComponent(query)}`);
      if (requestID !== searchRequestSeq) {
        return;
      }
      state.ui.search.results = response?.results || null;
      state.ui.search.loading = false;
      renderSearchResults();
    } catch (error) {
      if (requestID !== searchRequestSeq) {
        return;
      }
      state.ui.search.loading = false;
      reportError(error);
    }
  }, 150);
}

function bindPagination(container, key, rerender) {
  container.querySelector(`[data-page-size="${key}"]`)?.addEventListener("change", async (event) => {
    state.pagination[key].size = Number(event.currentTarget.value || 10);
    state.pagination[key].page = 1;
    await rerender().catch(reportError);
  });

  container.querySelector(`[data-page-prev="${key}"]`)?.addEventListener("click", async () => {
    state.pagination[key].page = Math.max(1, state.pagination[key].page - 1);
    await rerender().catch(reportError);
  });

  container.querySelector(`[data-page-next="${key}"]`)?.addEventListener("click", async () => {
    state.pagination[key].page += 1;
    await rerender().catch(reportError);
  });

  container.querySelectorAll(`[data-page-number="${key}"]`).forEach((button) => {
    button.addEventListener("click", async () => {
      state.pagination[key].page = Number(button.dataset.pageValue || 1);
      await rerender().catch(reportError);
    });
  });
}

function currentPageData(key, items) {
  const normalized = ensureArray(items);
  const pageState = state.pagination[key];
  const meta = state.paginationMeta[key];
  const size = PAGE_SIZE_OPTIONS.includes(Number(pageState?.size)) ? Number(pageState.size) : 10;
  const total = Number(meta?.total) || 0;
  const page = Math.max(1, Number(meta?.page) || 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    items: normalized,
    page,
    size,
    total,
    totalPages,
  };
}

function applyPagedResponse(key, payload) {
  const pageState = state.pagination[key];
  const metaState = state.paginationMeta[key];
  const items = ensureArray(payload?.items);
  const total = Number(payload?.total) || 0;
  const limit = PAGE_SIZE_OPTIONS.includes(Number(payload?.limit)) ? Number(payload.limit) : pageState.size;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Number(payload?.page) || 1), totalPages);

  pageState.page = page;
  pageState.size = limit;
  metaState.total = total;
  metaState.page = page;
  metaState.limit = limit;

  state[key] = items;
}

function renderPagination(key, pageData) {
  const pageState = state.pagination[key];
  if (!pageState || pageData.total <= 0) {
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
            ${PAGE_SIZE_OPTIONS.map((size) => `<option value="${size}" ${pageData.size === size ? "selected" : ""}>${size}</option>`).join("")}
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

function paginationPageNumbers(pageData) {
  const totalPages = Math.max(1, Number(pageData.totalPages) || 1);
  const current = Math.max(1, Number(pageData.page) || 1);
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

function formatUsageRequest(log) {
  const method = String(log.method || "").toUpperCase();
  const path = log.path || "-";
  const requestID = log.request_id || "-";
  return `${method} ${path} · ${requestID}`;
}

function formatUsageStatus(log) {
  const status = Number(log.status_code) || 0;
  const attempts = Number(log.attempts) || 0;
  const duration = Number(log.duration_ms) || 0;
  const statusText = status > 0 ? String(status) : "failed";
  return `${statusText} · ${attempts} try · ${duration} ms`;
}

function formatUsageDetail(log) {
  const parts = [];
  if (log.error_message) {
    parts.push(`err ${log.error_message}`);
  }
  return parts.join(" · ") || "-";
}

function buildUsageChartSeries(logs, mode) {
  const buckets = new Map();
  for (const log of ensureArray(logs)) {
    const key = formatDayBucket(log.created_at);
    const bucket = buckets.get(key) || { key, requests: 0, failures: 0, latency: 0, count: 0 };
    bucket.requests += 1;
    bucket.failures += isUsageFailure(log) ? 1 : 0;
    bucket.latency += Number(log.duration_ms) || 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  const points = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-14);
  const selected = mode === "failures" ? "failures" : mode === "latency" ? "latency" : "requests";
  const color = selected === "failures" ? "#ef4444" : selected === "latency" ? "#f59e0b" : "#3b82f6";
  const subtitle = selected === "failures" ? "Failure rate over time" : selected === "latency" ? "Average latency over time" : "Request volume over time";
  return {
    label: selected,
    color,
    subtitle,
    points: points.map((bucket) => ({
      x: bucket.key.slice(5),
      y: selected === "failures" ? bucket.failures : selected === "latency" ? Math.round(bucket.latency / Math.max(1, bucket.count)) : bucket.requests,
    })),
  };
}

function buildDashboardUsageChartSeries(series, mode) {
  const points = ensureArray(series);
  const selected = mode === "failures" ? "failures" : mode === "latency" ? "latency" : "requests";
  const color = selected === "failures" ? "#ef4444" : selected === "latency" ? "#f59e0b" : "#3b82f6";
  const subtitle = selected === "failures" ? "Failure rate over time" : selected === "latency" ? "Average latency over time" : "Request volume over time";
  return {
    label: selected,
    color,
    subtitle,
    points: points.map((point) => ({
      x: String(point.label || "-").slice(5),
      y: selected === "failures" ? Number(point.failures) || 0 : selected === "latency" ? Math.round(Number(point.latency_ms) / Math.max(1, Number(point.requests) || 1)) : Number(point.requests) || 0,
    })),
  };
}

function renderSparkAreaChart(points, label, color, subtitle) {
  const width = 640;
  const height = 240;
  const values = points.map((point) => Number(point.y) || 0);
  const max = Math.max(1, ...values);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => {
    const x = Math.round(index * step);
    const y = Math.round(height - ((Number(point.y) || 0) / max) * (height - 26) - 10);
    return { ...point, x, y };
  });
  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return `
    <div class="chart-wrap">
      <div class="chart-copy">
        <strong>${escapeHTML(subtitle)}</strong>
        <small>${escapeHTML(label)}</small>
      </div>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(subtitle)}" style="color: ${color};">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
            <stop offset="100%" stop-color="currentColor" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#chartFill)"></path>
        <path d="${linePath}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
        ${coords.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="currentColor"></circle>`).join("")}
      </svg>
      <div class="chart-foot">
        ${points.map((point) => `<span>${escapeHTML(point.x)} · ${escapeHTML(String(point.y))}</span>`).join("")}
      </div>
    </div>
  `;
}

function countEventsByCategory(events) {
  const counts = { warning: 0, error: 0, policy: 0, client: 0, backend: 0 };
  for (const event of ensureArray(events)) {
    const type = String(event.type || "").toLowerCase();
    const level = String(event.level || "").toLowerCase();
    if (level.includes("warn") || type.includes("warn")) counts.warning += 1;
    if (level.includes("error") || type.includes("error")) counts.error += 1;
    if (type.includes("policy")) counts.policy += 1;
    if (type.includes("client")) counts.client += 1;
    if (type.includes("backend")) counts.backend += 1;
  }
  return counts;
}

function formatDayBucket(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "unknown";
  }
  return date.toISOString().slice(0, 10);
}

function isUsageFailure(log) {
  const status = Number(log.status_code) || 0;
  return status >= 500 || (status >= 401 && status !== 400);
}

function resolveInitialTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  state.ui.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  themeToggleBtn.textContent = nextTheme === "dark" ? "Dark" : "Light";
}

function openSearchModal() {
  state.ui.search.open = true;
  searchModal.classList.remove("hidden");
  searchInput.value = state.ui.search.query || "";
  searchInput.focus();
  scheduleSearch();
}

function closeSearchModal() {
  if (!state.ui.search.open) {
    return;
  }
  state.ui.search.open = false;
  searchModal.classList.add("hidden");
}

function openDrawer(title, content) {
  state.ui.drawer.open = true;
  state.ui.drawer.title = title;
  state.ui.drawer.content = content;
  drawerTitle.textContent = title;
  drawerBody.innerHTML = content;
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  if (!state.ui.drawer.open) {
    return;
  }
  state.ui.drawer.open = false;
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
}

async function openSearchResultDetail(type, id) {
  const endpointFactory = RESOURCE_DETAIL_ENDPOINTS[type];
  if (!endpointFactory) {
    const record = findSearchResultRecord(type, id);
    if (!record) {
      return;
    }
    const payload = searchResultDrawerPayload(type, record);
    openDrawer(payload.title, renderDrawerPayload(payload));
    return;
  }
  const response = await api(endpointFactory(id));
  const title = response?.overview?.find?.((item) => item.label === "Name")?.value || response?.raw?.name || response?.raw?.pattern || response?.raw?.request_id || `${type} #${id}`;
  openDrawer(title, renderDrawerPayload(response));
}

function findSearchResultRecord(type, id) {
  const group = SEARCH_GROUPS.find((entry) => entry.resourceType === type);
  if (!group || !state.ui.search.results) {
    return null;
  }
  return ensureArray(state.ui.search.results[group.key]).find((item) => {
    const record = searchResultRecord(item);
    return String(record.id) === String(id);
  }) || null;
}

function searchResultDrawerPayload(type, record) {
  const raw = record?.raw || record || {};
  if (type === "event") {
    return {
      title: record?.title || record?.name || raw.type || "Event",
      overview: [
        { label: "Type", value: raw.type || "-" },
        { label: "Level", value: raw.level || "-" },
        { label: "Actor", value: raw.client_name || raw.backend_name || "system" },
        { label: "Message", value: raw.message || "-" },
      ],
      configuration: [
        { label: "Client", value: raw.client_name || "-" },
        { label: "Backend", value: raw.backend_name || "-" },
        { label: "Model", value: raw.model || "-" },
        { label: "Endpoint", value: raw.endpoint || "-" },
      ],
      metadata: [
        { label: "ID", value: String(raw.id || "-") },
        { label: "Timestamp", value: formatDateTime(raw.created_at) },
      ],
      activity: { events: [], usage_logs: [] },
      raw,
    };
  }
  return {
    title: record?.title || record?.name || raw.request_id || "Usage Log",
    overview: [
      { label: "Request", value: formatUsageRequest(raw) },
      { label: "Status", value: formatUsageStatus(raw) },
      { label: "Client", value: raw.client_name || "-" },
      { label: "Backend", value: raw.backend_name || "-" },
    ],
    configuration: [
      { label: "Model", value: raw.model || "-" },
      { label: "Route Override", value: raw.route_mode_override || "-" },
      { label: "Route Group", value: raw.route_group || "-" },
      { label: "Path", value: (raw.path || "-") + (raw.query ? `?${raw.query}` : "") },
    ],
    metadata: [
      { label: "Request ID", value: raw.request_id || "-" },
      { label: "Attempts", value: String(raw.attempts || 0) },
      { label: "Duration", value: `${Number(raw.duration_ms) || 0} ms` },
      { label: "Timestamp", value: formatDateTime(raw.created_at) },
    ],
    activity: { events: [], usage_logs: [] },
    raw,
  };
}

function renderDrawerPayload(payload) {
  const overview = ensureArray(payload?.overview);
  const configuration = ensureArray(payload?.configuration);
  const metadata = ensureArray(payload?.metadata);
  const raw = payload?.raw || {};
  const activityEvents = ensureArray(payload?.activity?.events);
  const activityLogs = ensureArray(payload?.activity?.usage_logs);
  return `
    <div class="drawer-section">
      <strong>Overview</strong>
      <div class="detail-grid">
        ${overview.map(renderDetailEntry).join("")}
      </div>
    </div>
    <div class="drawer-section">
      <strong>Configuration</strong>
      <div class="detail-grid">
        ${configuration.map(renderDetailEntry).join("")}
      </div>
    </div>
    <div class="drawer-section">
      <strong>Metadata</strong>
      <div class="detail-grid">
        ${metadata.map(renderDetailEntry).join("")}
      </div>
    </div>
    <div class="drawer-section">
      <strong>Activity</strong>
      ${activityEvents.length === 0 && activityLogs.length === 0 ? emptyState("暂无活动", "当前没有关联事件或日志。") : `
        <div class="drawer-activity-grid">
          ${activityEvents.slice(0, 4).map((event) => `
            <article class="feed-item">
              <strong>${escapeHTML(eventTitle(event))}</strong>
              <small>${escapeHTML(event.message || "-")}</small>
              <small>${escapeHTML(formatDateTime(event.created_at))}</small>
            </article>
          `).join("")}
          ${activityLogs.slice(0, 4).map((log) => `
            <article class="feed-item">
              <strong>${escapeHTML(formatUsageRequest(log))}</strong>
              <small>${escapeHTML(log.backend_name || "-")} · ${escapeHTML(log.model || "-")}</small>
              <small>${escapeHTML(formatDateTime(log.created_at))}</small>
            </article>
          `).join("")}
        </div>
      `}
    </div>
    <div class="drawer-section">
      <strong>Raw JSON</strong>
      <pre class="json-preview">${escapeHTML(JSON.stringify(raw, null, 2))}</pre>
    </div>
  `;
}

function renderDetailEntry(entry) {
  return `
    <div>
      <strong>${escapeHTML(entry.label || "-")}</strong>
      <span>${escapeHTML(entry.value || "-")}</span>
    </div>
  `;
}

function renderEventRow(event) {
  const level = String(event.level || "info").toLowerCase();
  const category = eventCategoryLabel(event.type);
  return `
    <article class="timeline-row event-card level-${escapeHTML(level)}">
      <div class="timeline-icon">
        <span class="timeline-dot"></span>
      </div>
      <div class="timeline-content">
        <div class="timeline-grid">
          <div>
            <strong>${escapeHTML(eventTitle(event))}</strong>
            <p>${escapeHTML(event.message || "-")}</p>
          </div>
          <div>
            <span class="timeline-label">Actor</span>
            <span>${escapeHTML(event.client_name || event.backend_name || "system")}</span>
          </div>
          <div>
            <span class="timeline-label">Timestamp</span>
            <span>${escapeHTML(formatDateTime(event.created_at))}</span>
          </div>
          <div>
            <span class="timeline-label">Category</span>
            <span>${escapeHTML(category)}</span>
          </div>
          <div>
            <span class="timeline-label">Client</span>
            <span>${escapeHTML(event.client_name || "-")}</span>
          </div>
          <div>
            <span class="timeline-label">Backend</span>
            <span>${escapeHTML(event.backend_name || "-")}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderUsageLogRow(log) {
  const id = String(log.id);
  const expanded = state.expandedUsageLogs.has(id);
  return `
    <article class="timeline-row usage-log-row-card ${expanded ? "is-open" : ""}">
      <button class="timeline-icon toggle-row" data-toggle-usage-log="${log.id}" type="button" aria-expanded="${expanded ? "true" : "false"}">
        <span class="timeline-dot"></span>
        <span class="toggle-indicator">${expanded ? "收起" : "展开"}</span>
      </button>
      <div class="timeline-content">
        <div class="timeline-grid usage-grid">
          <div>
            <strong>${escapeHTML(formatUsageRequest(log))}</strong>
            <p>${escapeHTML(formatUsageDetail(log))}</p>
          </div>
          <div>
            <span class="timeline-label">Client Key</span>
            <span>${escapeHTML(log.client_name || "-")}</span>
          </div>
          <div>
            <span class="timeline-label">Client</span>
            <span>${escapeHTML(log.client_ip || "-")}</span>
          </div>
          <div>
            <span class="timeline-label">Model</span>
            <span>${escapeHTML(log.model || "-")}</span>
          </div>
          <div>
            <span class="timeline-label">Backend</span>
            <span>${escapeHTML(log.backend_name || "-")}</span>
          </div>
          <div>
            <span class="timeline-label">Status</span>
            <span>${escapeHTML(formatUsageStatus(log))}</span>
          </div>
          <div>
            <span class="timeline-label">Timestamp</span>
            <span>${escapeHTML(formatDateTime(log.created_at))}</span>
          </div>
          <div>
            <span class="timeline-label">Trace</span>
            <span>${escapeHTML(log.request_id || "-")}</span>
          </div>
        </div>
        ${expanded ? renderUsageLogDetail(log) : ""}
      </div>
    </article>
  `;
}

function renderUsageLogDetail(log) {
  return `
    <div class="timeline-detail">
      <div class="detail-grid usage-detail-grid">
        <div><strong>Request ID</strong><span>${escapeHTML(log.request_id || "-")}</span></div>
        <div><strong>Client ID</strong><span>${escapeHTML(log.client_id || "-")}</span></div>
        <div><strong>Route Override</strong><span>${escapeHTML(log.route_mode_override || "-")}</span></div>
        <div><strong>Route Group</strong><span>${escapeHTML(log.route_group || "-")}</span></div>
        <div><strong>Method</strong><span>${escapeHTML(log.method || "-")}</span></div>
        <div><strong>Path</strong><span>${escapeHTML((log.path || "-") + (log.query ? `?${log.query}` : ""))}</span></div>
        <div><strong>Attempts</strong><span>${escapeHTML(log.attempts || 0)}</span></div>
        <div><strong>Status Code</strong><span>${escapeHTML(log.status_code || 0)}</span></div>
        <div><strong>Duration</strong><span>${escapeHTML(`${Number(log.duration_ms) || 0} ms`)}</span></div>
        <div><strong>Client IP</strong><span>${escapeHTML(log.client_ip || "-")}</span></div>
        <div><strong>User Agent</strong><span>${escapeHTML(log.user_agent || "-")}</span></div>
        <div><strong>Error</strong><span>${escapeHTML(log.error_message || "-")}</span></div>
      </div>
      <div class="detail-section">
        <strong>Raw JSON</strong>
        <pre class="json-preview">${escapeHTML(JSON.stringify(log, null, 2))}</pre>
      </div>
    </div>
  `;
}

function eventCategoryLabel(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("backend")) {
    return "Backend";
  }
  if (normalized.includes("client")) {
    return "Client Key";
  }
  if (normalized.includes("proxy")) {
    return "Proxy";
  }
  if (normalized.includes("security") || normalized.includes("auth")) {
    return "Security";
  }
  if (normalized.includes("policy")) {
    return "Policy";
  }
  return "System";
}

function eventTitle(event) {
  return String(event.type || "event")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseModelMapping(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }
  const mapping = {};
  raw.split(",").forEach((item) => {
    const [from, to] = item.split("=").map((part) => String(part || "").trim());
    if (from && to) {
      mapping[from] = to;
    }
  });
  return mapping;
}

function formatModelMapping(mapping) {
  if (!mapping || typeof mapping !== "object") {
    return "-";
  }
  const items = Object.entries(mapping).map(([from, to]) => `${from} -> ${to}`);
  return items.length === 0 ? "-" : items.join(", ");
}

function formatModelMappingInput(mapping) {
  if (!mapping || typeof mapping !== "object") {
    return "";
  }
  return Object.entries(mapping).map(([from, to]) => `${from}=${to}`).join(", ");
}

function startEditProxy(id) {
  const proxy = state.proxies.find((item) => String(item.id) === String(id));
  if (!proxy) {
    return;
  }

  state.editingProxyID = proxy.id;
  proxyForm.elements.name.value = proxy.name || "";
  proxyForm.elements.address.value = proxy.address || "";
  proxyForm.elements.username.value = proxy.username || "";
  proxyForm.elements.password.value = proxy.password || "";
  proxyForm.elements.enabled.checked = Boolean(proxy.enabled);

  proxySubmitBtn.textContent = "保存 Proxy";
  proxyCancelBtn.classList.remove("hidden");
  proxyEditBanner.textContent = `正在编辑 SOCKS5 Proxy: ${proxy.name}`;
  proxyEditBanner.classList.remove("hidden");
  proxyModalTitle.textContent = "编辑 Proxy";
  showProxyModal();
  renderProxies();
}

function startCreateProxy() {
  state.editingProxyID = null;
  proxyForm.reset();
  proxyForm.elements.enabled.checked = true;
  proxySubmitBtn.textContent = "新增 Proxy";
  proxyCancelBtn.classList.remove("hidden");
  proxyEditBanner.classList.add("hidden");
  proxyModalTitle.textContent = "新增 Proxy";
  showProxyModal();
  renderProxies();
}

function startCreateBackend() {
  state.editingBackendID = null;
  backendForm.reset();
  backendForm.elements.protocol.value = "openai";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = "0";
  backendForm.elements.model_mapping.value = "";
  backendForm.elements.weight.value = 1;
  backendForm.elements.enabled.checked = true;
  backendSubmitBtn.textContent = "新增 Backend";
  backendCancelBtn.classList.remove("hidden");
  backendEditBanner.classList.add("hidden");
  backendModalTitle.textContent = "新增 Backend";
  showBackendModal();
  renderBackends();
}

function startEditBackend(id) {
  const backend = state.backends.find((item) => String(item.id) === String(id));
  if (!backend) {
    return;
  }

  state.editingBackendID = backend.id;
  backendForm.elements.name.value = backend.name || "";
  backendForm.elements.pool.value = backend.pool || "";
  backendForm.elements.protocol.value = backend.protocol || "openai";
  backendForm.elements.base_url.value = backend.base_url || "";
  backendForm.elements.api_key.value = backend.api_key || "";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = String(backend.proxy_id || 0);
  backendForm.elements.models.value = (backend.models || []).join(", ");
  backendForm.elements.model_mapping.value = formatModelMappingInput(backend.model_mapping);
  backendForm.elements.endpoints.value = (backend.endpoints || []).join(", ");
  backendForm.elements.weight.value = backend.weight || 1;
  backendForm.elements.enabled.checked = Boolean(backend.enabled);

  backendSubmitBtn.textContent = "保存 Backend";
  backendCancelBtn.classList.remove("hidden");
  backendEditBanner.textContent = `正在编辑 Backend: ${backend.name}`;
  backendEditBanner.classList.remove("hidden");
  backendModalTitle.textContent = "编辑 Backend";
  showBackendModal();
  renderBackends();
}

function startCreateClient() {
  state.editingClientID = null;
  clientForm.reset();
  clientForm.elements.token.placeholder = "Leave blank to auto-generate";
  clientForm.elements.enabled.checked = true;
  clientSubmitBtn.textContent = "新增 Client Key";
  clientCancelBtn.classList.remove("hidden");
  clientEditBanner.classList.add("hidden");
  clientModalTitle.textContent = "新增 Client Key";
  showClientModal();
  renderClients();
}

function startEditClient(id) {
  const client = state.clients.find((item) => String(item.id) === String(id));
  if (!client) {
    return;
  }

  state.editingClientID = client.id;
  clientForm.elements.name.value = client.name || "";
  clientForm.elements.token.value = client.token || "";
  clientForm.elements.token.placeholder = client.token ? "Client token" : "历史 key 仅保存了 hash；重新填写后可显示";
  clientForm.elements.route_mode_override.value = client.route_mode_override || "";
  clientForm.elements.route_group.value = client.route_group || "";
  clientForm.elements.enabled.checked = Boolean(client.enabled);

  clientSubmitBtn.textContent = "保存 Client Key";
  clientCancelBtn.classList.remove("hidden");
  clientEditBanner.textContent = `正在编辑 Client Key: ${client.name}`;
  clientEditBanner.classList.remove("hidden");
  clientModalTitle.textContent = "编辑 Client Key";
  showClientModal();
  renderClients();
}

function showBackendModal() {
  backendModal.classList.remove("hidden");
  backendForm.elements.name.focus();
}

function showProxyModal() {
  proxyModal.classList.remove("hidden");
  proxyForm.elements.name.focus();
}

function hideProxyModal() {
  proxyModal.classList.add("hidden");
}

function hideBackendModal() {
  backendModal.classList.add("hidden");
}

function showClientModal() {
  clientModal.classList.remove("hidden");
  clientForm.elements.name.focus();
}

function hideClientModal() {
  clientModal.classList.add("hidden");
}

function startCreatePolicy() {
  state.editingPolicyID = null;
  policyForm.reset();
  policyForm.elements.endpoint.value = "chat";
  policyForm.elements.placement_policy.value = "sticky";
  policyForm.elements.priority.value = 100;
  policyForm.elements.failover_enabled.checked = true;
  policySubmitBtn.textContent = "新增 Policy";
  policyCancelBtn.classList.remove("hidden");
  policyEditBanner.classList.add("hidden");
  policyModalTitle.textContent = "新增 Policy";
  showPolicyModal();
  renderPolicies();
}

function startEditPolicy(id) {
  const policy = state.policies.find((item) => String(item.id) === String(id));
  if (!policy) {
    return;
  }

  state.editingPolicyID = policy.id;
  policyForm.elements.pattern.value = policy.pattern || "";
  policyForm.elements.endpoint.value = policy.endpoint || "chat";
  policyForm.elements.placement_policy.value = policy.placement_policy || "sticky";
  policyForm.elements.backend_pool.value = policy.backend_pool || "";
  policyForm.elements.priority.value = policy.priority || 100;
  policyForm.elements.failover_enabled.checked = Boolean(policy.failover_enabled);

  policySubmitBtn.textContent = "保存 Policy";
  policyCancelBtn.classList.remove("hidden");
  policyEditBanner.textContent = `正在编辑 Model Policy: ${policy.pattern}`;
  policyEditBanner.classList.remove("hidden");
  policyModalTitle.textContent = "编辑 Policy";
  showPolicyModal();
  renderPolicies();
}

function resetProxyForm() {
  state.editingProxyID = null;
  proxyForm.reset();
  proxyForm.elements.enabled.checked = true;
  proxySubmitBtn.textContent = "新增 Proxy";
  proxyCancelBtn.classList.add("hidden");
  proxyEditBanner.classList.add("hidden");
  proxyModalTitle.textContent = "新增 Proxy";
  hideProxyModal();
  renderProxies();
}

function resetBackendForm() {
  state.editingBackendID = null;
  backendForm.reset();
  backendForm.elements.protocol.value = "openai";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = "0";
  backendForm.elements.model_mapping.value = "";
  backendForm.elements.weight.value = 1;
  backendForm.elements.enabled.checked = true;
  backendSubmitBtn.textContent = "新增 Backend";
  backendCancelBtn.classList.add("hidden");
  backendEditBanner.classList.add("hidden");
  backendModalTitle.textContent = "新增 Backend";
  hideBackendModal();
  renderBackends();
}

function resetClientForm() {
  state.editingClientID = null;
  clientForm.reset();
  clientForm.elements.token.placeholder = "Leave blank to auto-generate";
  clientForm.elements.enabled.checked = true;
  clientSubmitBtn.textContent = "新增 Client Key";
  clientCancelBtn.classList.add("hidden");
  clientEditBanner.classList.add("hidden");
  clientModalTitle.textContent = "新增 Client Key";
  hideClientModal();
  renderClients();
}

function resetPolicyForm() {
  state.editingPolicyID = null;
  policyForm.reset();
  policyForm.elements.endpoint.value = "chat";
  policyForm.elements.placement_policy.value = "sticky";
  policyForm.elements.priority.value = 100;
  policyForm.elements.failover_enabled.checked = true;
  policySubmitBtn.textContent = "新增 Policy";
  policyCancelBtn.classList.add("hidden");
  policyEditBanner.classList.add("hidden");
  policyModalTitle.textContent = "新增 Policy";
  hidePolicyModal();
  renderPolicies();
}

function showPolicyModal() {
  policyModal.classList.remove("hidden");
  policyForm.elements.pattern.focus();
}

function hidePolicyModal() {
  policyModal.classList.add("hidden");
}

function readForm(form) {
  const formData = new FormData(form);
  const payload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }
  for (const input of form.querySelectorAll("input[type=checkbox]")) {
    payload[input.name] = input.checked;
  }
  return payload;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function renderProxyOptions() {
  const selected = backendForm.elements.proxy_id?.value || "0";
  backendForm.elements.proxy_id.innerHTML = `
    <option value="0">Direct connection</option>
    ${state.proxies.map((proxy) => `
      <option value="${proxy.id}">${escapeHTML(proxy.name)} (${escapeHTML(proxy.address)})${proxy.enabled ? "" : " - disabled"}</option>
    `).join("")}
  `;
  backendForm.elements.proxy_id.value = state.proxies.some((proxy) => String(proxy.id) === selected) ? selected : "0";
}

function formatBackendRecentStats(stats = {}) {
  const windowMinutes = Number(stats.window_minutes) || 30;
  const successes = Number(stats.successes) || 0;
  const failures = Number(stats.failures) || 0;
  return `${windowMinutes}m ${successes} ok / ${failures} fail`;
}

function formatDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "-";
  }

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return raw;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function clientTokenDisplay(client) {
  if (client.token) {
    return client.token;
  }
  if (client.token_prefix) {
    return `${client.token_prefix} (历史记录仅保存 prefix)`;
  }
  return "-";
}

function proxyLabel(proxyID, proxy) {
  if (!proxyID || Number(proxyID) === 0) {
    return "direct";
  }
  if (!proxy) {
    return `missing proxy #${proxyID}`;
  }
  return `${proxy.name}${proxy.enabled ? "" : " (disabled)"}`;
}

function backendProtocolLabel(protocol) {
  return protocol === "anthropic" ? "Claude / Anthropic" : "OpenAI";
}

function toggleExpanded(set, id) {
  const normalizedID = String(id);
  if (set.has(normalizedID)) {
    set.delete(normalizedID);
    return;
  }
  set.add(normalizedID);
}

function statusPill(enabled, onText, offText) {
  const active = Boolean(enabled);
  return `<span class="status-pill ${active ? "ok" : "off"}">${escapeHTML(active ? onText : offText)}</span>`;
}

function compactList(values) {
  const items = ensureArray(values).filter(Boolean);
  if (items.length === 0) {
    return `<span class="muted-text">-</span>`;
  }

  const visible = items.slice(0, 2);
  const rest = items.length - visible.length;
  return `
    <div class="compact-list">
      ${visible.map((item) => `<span>${escapeHTML(item)}</span>`).join("")}
      ${rest > 0 ? `<span class="more-count">+${rest}</span>` : ""}
    </div>
  `;
}

function chipList(values, className = "") {
  const items = ensureArray(values).filter(Boolean);
  if (items.length === 0) {
    return `<span class="muted-text">-</span>`;
  }

  const modifier = className ? ` ${escapeHTML(className)}` : "";
  return items.map((item) => `<span class="chip${modifier}">${escapeHTML(item)}</span>`).join("");
}

function tableActions(type, id) {
  const normalizedID = escapeHTML(id);
  const attributes = {
    proxy: ["data-edit-proxy", "data-delete-proxy"],
    backend: ["data-edit-backend", "data-delete-backend"],
    client: ["data-edit-client", "data-delete-client"],
    policy: ["data-edit-policy", "data-delete-policy"],
  }[type];

  if (!attributes) {
    return "";
  }

  const [editAttribute, deleteAttribute] = attributes;
  return `
    <div class="table-actions">
      <button class="small-button" ${editAttribute}="${normalizedID}" type="button">编辑</button>
      <button class="small-button danger-button" ${deleteAttribute}="${normalizedID}" type="button">删除</button>
    </div>
  `;
}

function emptyState(title, description) {
  return `
    <article class="empty-state">
      <strong>${escapeHTML(title)}</strong>
      <p class="empty-copy">${escapeHTML(description)}</p>
    </article>
  `;
}

function renderDatalist(element, values) {
  element.innerHTML = ensureArray(values)
    .filter(Boolean)
    .map((value) => `<option value="${escapeHTML(value)}"></option>`)
    .join("");
}

async function api(path, method = "GET", body) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

function reportError(error) {
  console.error(error);
  alert(error?.message || "操作失败");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

activatePage(pageIDFromHash());
refreshAll().catch(reportError);
