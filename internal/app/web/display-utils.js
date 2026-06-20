(function initDisplayUtilsModule(globalScope) {
  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
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
    if (client?.masked_token) {
      return client.masked_token;
    }
    if (client?.token) {
      return client.token;
    }
    if (client?.token_prefix) {
      return client.token_prefix;
    }
    return "-";
  }

  function formatUsageCount(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) {
      return "0 requests";
    }
    return `${count} requests`;
  }

  function formatBindingCount(value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) {
      return "0 backends";
    }
    return `${count} backends`;
  }

  function formatBackendCoverage(backend) {
    const modelCount = Number.isFinite(Number(backend?.model_count))
      ? Number(backend.model_count)
      : ensureArray(backend?.models).filter(Boolean).length;
    const endpointCount = Number.isFinite(Number(backend?.endpoint_count))
      ? Number(backend.endpoint_count)
      : ensureArray(backend?.endpoints).filter(Boolean).length;
    return `${modelCount} models / ${endpointCount} endpoints`;
  }

  function formatPolicyCoverage(policy) {
    const backendCount = Number(policy?.backend_count || 0);
    const modelCount = Number(policy?.model_count || 0);
    return `${Number.isFinite(backendCount) ? backendCount : 0} backends / ${Number.isFinite(modelCount) ? modelCount : 0} models`;
  }

  function formatLatency(value) {
    const latency = Number(value || 0);
    if (!Number.isFinite(latency) || latency <= 0) {
      return "-";
    }
    return `${Math.round(latency)} ms`;
  }

  function formatDataSize(value) {
    const size = Number(value || 0);
    if (!Number.isFinite(size) || size <= 0) {
      return "0 B";
    }
    const units = ["B", "KB", "MB", "GB"];
    let amount = size;
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
      amount /= 1024;
      unitIndex += 1;
    }
    const rounded = amount >= 10 || unitIndex === 0 ? Math.round(amount) : Math.round(amount * 10) / 10;
    return `${rounded} ${units[unitIndex]}`;
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

  function formatBackendRouting(backend) {
    const parts = [
      backend?.pool ? `pool ${backend.pool}` : "",
      proxyLabel(backend?.proxy_id, backend?.proxy),
    ].filter(Boolean);
    return parts.join(" | ") || "-";
  }

  function formatPolicyRouting(policy) {
    const parts = [
      policy?.backend_pool ? `pool ${policy.backend_pool}` : "",
      Number.isFinite(Number(policy?.priority)) ? `priority ${policy.priority}` : "",
      policy?.failover_enabled ? "failover on" : "failover off",
    ].filter(Boolean);
    return parts.join(" | ") || "-";
  }

  function backendProtocolLabel(protocol) {
    return protocol === "anthropic" ? "Claude / Anthropic" : "OpenAI";
  }

  function statusPill(enabled, onText, offText) {
    const active = Boolean(enabled);
    return `<span class="status-pill ${active ? "ok" : "off"}">${escapeHTML(active ? onText : offText)}</span>`;
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

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  const api = {
    backendProtocolLabel,
    clientTokenDisplay,
    emptyState,
    ensureArray,
    escapeHTML,
    formatBackendCoverage,
    formatBackendRecentStats,
    formatBackendRouting,
    formatBindingCount,
    formatDataSize,
    formatDateTime,
    formatLatency,
    formatPolicyCoverage,
    formatPolicyRouting,
    formatUsageCount,
    renderDatalist,
    statusPill,
    tableActions,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.DisplayUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
