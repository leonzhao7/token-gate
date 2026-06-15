const tokenInput = document.querySelector("#adminToken");
const saveTokenBtn = document.querySelector("#saveTokenBtn");
const refreshBtn = document.querySelector("#refreshBtn");
const stats = document.querySelector("#stats");
const proxyList = document.querySelector("#proxyList");
const backendList = document.querySelector("#backendList");
const clientList = document.querySelector("#clientList");
const policyList = document.querySelector("#policyList");
const eventList = document.querySelector("#eventList");

const proxyForm = document.querySelector("#proxyForm");
const backendForm = document.querySelector("#backendForm");
const clientForm = document.querySelector("#clientForm");
const policyForm = document.querySelector("#policyForm");

const proxySubmitBtn = document.querySelector("#proxySubmitBtn");
const proxyCancelBtn = document.querySelector("#proxyCancelBtn");
const proxyEditBanner = document.querySelector("#proxyEditBanner");
const backendSubmitBtn = document.querySelector("#backendSubmitBtn");
const backendCancelBtn = document.querySelector("#backendCancelBtn");
const backendEditBanner = document.querySelector("#backendEditBanner");
const clientSubmitBtn = document.querySelector("#clientSubmitBtn");
const clientCancelBtn = document.querySelector("#clientCancelBtn");
const clientEditBanner = document.querySelector("#clientEditBanner");
const policySubmitBtn = document.querySelector("#policySubmitBtn");
const policyCancelBtn = document.querySelector("#policyCancelBtn");
const policyEditBanner = document.querySelector("#policyEditBanner");

const ADMIN_TOKEN_KEY = "token-gate-admin-token";
const state = {
  proxies: [],
  backends: [],
  clients: [],
  policies: [],
  editingProxyID: null,
  editingBackendID: null,
  editingClientID: null,
  editingPolicyID: null,
  expandedProxies: new Set(),
  expandedBackends: new Set(),
  expandedClients: new Set(),
  expandedPolicies: new Set(),
};

tokenInput.value = localStorage.getItem(ADMIN_TOKEN_KEY) || "";

saveTokenBtn.addEventListener("click", () => {
  localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.value.trim());
});

refreshBtn.addEventListener("click", () => {
  refreshAll().catch(reportError);
});

proxyCancelBtn.addEventListener("click", () => {
  resetProxyForm();
});

backendCancelBtn.addEventListener("click", () => {
  resetBackendForm();
});

clientCancelBtn.addEventListener("click", () => {
  resetClientForm();
});

policyCancelBtn.addEventListener("click", () => {
  resetPolicyForm();
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
  const [overview, proxies, backends, clients, policies, events] = await Promise.all([
    api("/admin/api/overview"),
    api("/admin/api/socks-proxies"),
    api("/admin/api/backends"),
    api("/admin/api/client-keys"),
    api("/admin/api/model-policies"),
    api("/admin/api/events?limit=20"),
  ]);

  overview.backends = ensureArray(overview.backends);
  overview.events = ensureArray(overview.events);
  state.proxies = ensureArray(proxies);
  state.backends = ensureArray(backends);
  state.clients = ensureArray(clients);
  state.policies = ensureArray(policies);

  renderStats(overview);
  renderProxyOptions();
  renderProxies(state.proxies);
  renderBackends(state.backends);
  renderClients(state.clients);
  renderPolicies(state.policies);
  renderEvents(ensureArray(events));
}

function renderStats(overview) {
  const ready = overview.backends.filter((backend) => backend.enabled && !isCoolingDown(backend.runtime)).length;
  const active = overview.backends.reduce((sum, backend) => sum + (backend.runtime.active_requests || 0), 0);
  stats.innerHTML = `
    <article class="metric-card">
      <strong>${overview.backends.length}</strong>
      <span>Backends</span>
      <span class="metric-copy">已登记的真实上游节点数量。</span>
    </article>
    <article class="metric-card">
      <strong>${ready}</strong>
      <span>Ready</span>
      <span class="metric-copy">已启用且当前不在请求失败冷却期的节点。</span>
    </article>
    <article class="metric-card">
      <strong>${overview.socks_proxies || 0}</strong>
      <span>SOCKS5</span>
      <span class="metric-copy">可被 Backend 绑定的出口代理数量。</span>
    </article>
    <article class="metric-card">
      <strong>${overview.client_keys}</strong>
      <span>Client Keys</span>
      <span class="metric-copy">当前可管理的客户端身份数量。</span>
    </article>
    <article class="metric-card">
      <strong>${active}</strong>
      <span>Active Requests</span>
      <span class="metric-copy">正在转发中的活动请求数。</span>
    </article>
  `;
}

function renderProxies(proxies) {
  if (proxies.length === 0) {
    proxyList.innerHTML = emptyState(
      "还没有 SOCKS5 Proxy",
      "如果某些 Backend 需要固定出口代理，先在这里添加 SOCKS5 节点，再回到 Backend 里绑定。",
    );
    return;
  }

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
          ${proxies.map(renderProxyRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  proxyList.querySelectorAll("[data-toggle-proxy]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedProxies, button.dataset.toggleProxy);
      renderProxies(state.proxies);
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
}

function renderBackends(backends) {
  if (backends.length === 0) {
    backendList.innerHTML = emptyState(
      "还没有 Backend",
      "先配置至少一个兼容 OpenAI API 的上游节点，之后模型路由和故障切换才会生效。",
    );
    return;
  }

  backendList.innerHTML = `
    <div class="table-shell">
      <table class="resource-table">
        <thead>
          <tr>
            <th>Backend</th>
            <th>Status</th>
            <th>Pool</th>
            <th>Proxy</th>
            <th>Models</th>
            <th>Runtime</th>
            <th>State</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${backends.map(renderBackendRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  backendList.querySelectorAll("[data-toggle-backend]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedBackends, button.dataset.toggleBackend);
      renderBackends(state.backends);
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
}

function renderClients(clients) {
  if (clients.length === 0) {
    clientList.innerHTML = emptyState(
      "还没有 Client Key",
      "创建一个客户端 key 后，外部 SDK 或 AI 客户端才能通过 Token Gate 访问后端模型。",
    );
    return;
  }

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
          ${clients.map(renderClientRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  clientList.querySelectorAll("[data-toggle-client]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedClients, button.dataset.toggleClient);
      renderClients(state.clients);
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
}

function renderPolicies(policies) {
  if (policies.length === 0) {
    policyList.innerHTML = emptyState(
      "还没有 Model Policy",
      "定义模型模式、端点和 placement 策略后，路由行为才会按业务意图收敛。",
    );
    return;
  }

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
          ${policies.map(renderPolicyRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  policyList.querySelectorAll("[data-toggle-policy]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleExpanded(state.expandedPolicies, button.dataset.togglePolicy);
      renderPolicies(state.policies);
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
      <td>${escapeHTML(proxy.updated_at || "-")}</td>
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
              <div><strong>Created</strong><span>${escapeHTML(proxy.created_at || "-")}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(proxy.updated_at || "-")}</span></div>
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
  const runtime = backend.runtime || {};
  const runtimeState = backendRuntimeLabel(runtime);
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
      <td>${escapeHTML(backend.pool || "-")}</td>
      <td>${escapeHTML(proxyLabel(backend.proxy_id, backend.proxy))}</td>
      <td>${compactList(backend.models)}</td>
      <td>${runtime.active_requests || 0} active / ${runtime.consecutive_failures || 0} fails</td>
      <td>${escapeHTML(runtimeState)}</td>
      <td>${tableActions("backend", backend.id)}</td>
    </tr>
    ${expanded ? `
      <tr class="detail-row">
        <td colspan="8">
          <div class="detail-panel">
            <div class="detail-grid">
              <div><strong>Base URL</strong><span>${escapeHTML(backend.base_url)}</span></div>
              <div><strong>API Key</strong><span>${escapeHTML(backend.api_key || "-")}</span></div>
              <div><strong>SOCKS5 Proxy</strong><span>${escapeHTML(proxyLabel(backend.proxy_id, backend.proxy))}</span></div>
              <div><strong>Proxy Address</strong><span>${escapeHTML(backend.proxy?.address || "-")}</span></div>
              <div><strong>Pool</strong><span>${escapeHTML(backend.pool || "-")}</span></div>
              <div><strong>Weight</strong><span>${backend.weight}</span></div>
              <div><strong>Cooldown Until</strong><span>${escapeHTML(runtime.cooldown_until || "-")}</span></div>
              <div><strong>Last Error</strong><span>${escapeHTML(runtime.last_error || "-")}</span></div>
              <div><strong>Created</strong><span>${escapeHTML(backend.created_at || "-")}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(backend.updated_at || "-")}</span></div>
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
      <td>${escapeHTML(client.updated_at || "-")}</td>
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
              <div><strong>Created</strong><span>${escapeHTML(client.created_at || "-")}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(client.updated_at || "-")}</span></div>
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
              <div><strong>Created</strong><span>${escapeHTML(policy.created_at || "-")}</span></div>
              <div><strong>Updated</strong><span>${escapeHTML(policy.updated_at || "-")}</span></div>
            </div>
          </div>
        </td>
      </tr>
    ` : ""}
  `;
}

function renderEvents(events) {
  if (events.length === 0) {
    eventList.innerHTML = emptyState(
      "还没有事件",
      "配置变更、backend failover 或上游异常会出现在这里。",
    );
    return;
  }

  eventList.innerHTML = events.map((event) => `
    <article class="event-item">
      <h4>${escapeHTML(event.type)}</h4>
      <div>${escapeHTML(event.message)}</div>
      <div class="event-line">
        ${escapeHTML(event.created_at)}
      </div>
      <div class="event-line">
        client=${escapeHTML(event.client_name || "-")} | backend=${escapeHTML(event.backend_name || "-")} | model=${escapeHTML(event.model || "-")}
      </div>
    </article>
  `).join("");
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
  proxyForm.scrollIntoView({ behavior: "smooth", block: "start" });
  renderProxies(state.proxies);
}

function startEditBackend(id) {
  const backend = state.backends.find((item) => String(item.id) === String(id));
  if (!backend) {
    return;
  }

  state.editingBackendID = backend.id;
  backendForm.elements.name.value = backend.name || "";
  backendForm.elements.pool.value = backend.pool || "";
  backendForm.elements.base_url.value = backend.base_url || "";
  backendForm.elements.api_key.value = backend.api_key || "";
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = String(backend.proxy_id || 0);
  backendForm.elements.models.value = (backend.models || []).join(", ");
  backendForm.elements.endpoints.value = (backend.endpoints || []).join(", ");
  backendForm.elements.weight.value = backend.weight || 1;
  backendForm.elements.enabled.checked = Boolean(backend.enabled);

  backendSubmitBtn.textContent = "保存 Backend";
  backendCancelBtn.classList.remove("hidden");
  backendEditBanner.textContent = `正在编辑 Backend: ${backend.name}`;
  backendEditBanner.classList.remove("hidden");
  backendForm.scrollIntoView({ behavior: "smooth", block: "start" });
  renderBackends(state.backends);
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
  clientForm.scrollIntoView({ behavior: "smooth", block: "start" });
  renderClients(state.clients);
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
  policyForm.scrollIntoView({ behavior: "smooth", block: "start" });
  renderPolicies(state.policies);
}

function resetProxyForm() {
  state.editingProxyID = null;
  proxyForm.reset();
  proxyForm.elements.enabled.checked = true;
  proxySubmitBtn.textContent = "新增 Proxy";
  proxyCancelBtn.classList.add("hidden");
  proxyEditBanner.classList.add("hidden");
  renderProxies(state.proxies);
}

function resetBackendForm() {
  state.editingBackendID = null;
  backendForm.reset();
  backendForm.elements.api_key.placeholder = "Backend API key";
  backendForm.elements.proxy_id.value = "0";
  backendForm.elements.weight.value = 1;
  backendForm.elements.enabled.checked = true;
  backendSubmitBtn.textContent = "新增 Backend";
  backendCancelBtn.classList.add("hidden");
  backendEditBanner.classList.add("hidden");
  renderBackends(state.backends);
}

function resetClientForm() {
  state.editingClientID = null;
  clientForm.reset();
  clientForm.elements.token.placeholder = "Leave blank to auto-generate";
  clientForm.elements.enabled.checked = true;
  clientSubmitBtn.textContent = "新增 Client Key";
  clientCancelBtn.classList.add("hidden");
  clientEditBanner.classList.add("hidden");
  renderClients(state.clients);
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
  renderPolicies(state.policies);
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

function isCoolingDown(runtime = {}) {
  if (!runtime.cooldown_until) {
    return false;
  }
  const timestamp = Date.parse(runtime.cooldown_until);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function backendRuntimeLabel(runtime = {}) {
  if (isCoolingDown(runtime)) {
    return `cooldown until ${runtime.cooldown_until}`;
  }
  if (runtime.last_error) {
    return runtime.last_error;
  }
  return "ready";
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

refreshAll().catch(reportError);
