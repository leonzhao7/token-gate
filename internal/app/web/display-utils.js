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
      proxyLabel(backend?.proxy_id, backend?.proxy),
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
    }[type];

    if (!attributes) {
      return "";
    }

    const [editAttribute, deleteAttribute] = attributes;
    return `
      <div class="table-actions">
        <button class="small-button icon-action-button" ${editAttribute}="${normalizedID}" type="button" aria-label="编辑">
          ${tableActionIcon("edit")}
        </button>
        <button class="small-button icon-action-button danger-button" ${deleteAttribute}="${normalizedID}" type="button" aria-label="删除">
          ${tableActionIcon("delete")}
        </button>
      </div>
    `;
  }

  function tableActionIcon(name) {
    const icons = {
      edit: [
        "M4 20h4l10-10a2.5 2.5 0 0 0-4-4L4 16v4Z",
        "m13 7 4 4",
      ],
      delete: [
        "M5 7h14",
        "M10 11v6",
        "M14 11v6",
        "M7 7l1-3h8l1 3",
        "M6 7l1 12h10l1-12",
      ],
    };
    return `
      <svg class="shell-icon table-action-icon" data-shell-icon="table-action-${name}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${(icons[name] || icons.edit).map((path) => `<path d="${path}"></path>`).join("")}
      </svg>
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
