(function initResourceDataRuntimeModule(globalScope) {
  function renderProxyOptions({
    backendForm,
    state,
    displayUtils,
  }) {
    const proxyInput = backendForm?.elements?.proxy_id;
    if (!proxyInput) {
      return;
    }

    const selected = proxyInput.value || "0";
    proxyInput.innerHTML = `
    <option value="0">Direct connection</option>
    ${state.proxies.map((proxy) => `
      <option value="${proxy.id}">${displayUtils.escapeHTML(proxy.name)} (${displayUtils.escapeHTML(proxy.address)})${proxy.enabled ? "" : " - disabled"}</option>
    `).join("")}
  `;
    proxyInput.value = state.proxies.some((proxy) => String(proxy.id) === selected) ? selected : "0";
  }

  async function fetchAllCollectionPages({
    basePath,
    api,
    displayUtils,
    pageSizeOptions,
  }) {
    const firstPage = await api(`${basePath}?page=1&limit=50`);
    const items = displayUtils.ensureArray(firstPage?.items);
    const total = Number(firstPage?.total) || items.length;
    const limit = pageSizeOptions.includes(Number(firstPage?.limit)) ? Number(firstPage.limit) : 50;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (totalPages === 1) {
      return items;
    }

    const remaining = [];
    for (let page = 2; page <= totalPages; page += 1) {
      remaining.push(api(`${basePath}?page=${page}&limit=${limit}`));
    }
    const pages = await Promise.all(remaining);
    pages.forEach((payload) => {
      items.push(...displayUtils.ensureArray(payload?.items));
    });
    return items;
  }

  async function refreshResourceList({
    resourceKey,
    state,
    fetchAllCollectionPages: fetchAllCollectionPagesFn,
    renderProxies,
    renderBackends,
    renderClients,
  }) {
    if (resourceKey === "proxies") {
      state.proxies = await fetchAllCollectionPagesFn("/admin/api/socks-proxies");
      renderProxies();
      return;
    }
    if (resourceKey === "backends") {
      state.backends = await fetchAllCollectionPagesFn("/admin/api/backends");
      renderBackends();
      return;
    }
    if (resourceKey === "clients") {
      state.clients = await fetchAllCollectionPagesFn("/admin/api/client-keys");
      renderClients();
      return;
    }
  }

  const api = {
    renderProxyOptions,
    fetchAllCollectionPages,
    refreshResourceList,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceDataRuntimeUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
