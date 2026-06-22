import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseModelMapping,
  formatModelMappingInput,
  splitList,
  readForm,
  createResourceCrud,
} = require("./resource-crud.js");

test("parseModelMapping keeps only trimmed key-value pairs", () => {
  assert.deepEqual(
    parseModelMapping("gpt-4=gpt-4.1, invalid, claude = claude-sonnet-4, missing="),
    {
      "gpt-4": "gpt-4.1",
      claude: "claude-sonnet-4",
    },
  );
  assert.deepEqual(parseModelMapping(""), {});
});

test("formatModelMappingInput preserves backend edit formatting", () => {
  assert.equal(
    formatModelMappingInput({
      "gpt-4": "gpt-4.1",
      claude: "claude-sonnet-4",
    }),
    "gpt-4=gpt-4.1, claude=claude-sonnet-4",
  );
  assert.equal(formatModelMappingInput(null), "");
});

test("splitList trims items and removes empty entries", () => {
  assert.deepEqual(splitList(" gpt-4, , claude-sonnet-4 ,responses "), [
    "gpt-4",
    "claude-sonnet-4",
    "responses",
  ]);
});

test("readForm collects form data and checkbox states", () => {
  class FakeFormData {
    constructor(form) {
      this.form = form;
    }

    *entries() {
      for (const entry of this.form.__entries) {
        yield entry;
      }
    }
  }

  globalThis.FormData = FakeFormData;

  const checkboxA = { name: "enabled", checked: true };
  const checkboxB = { name: "failover_enabled", checked: false };
  const form = {
    __entries: [
      ["name", "edge-a"],
      ["pool", "premium"],
    ],
    querySelectorAll(selector) {
      assert.equal(selector, "input[type=checkbox]");
      return [checkboxA, checkboxB];
    },
  };

  assert.deepEqual(readForm(form), {
    name: "edge-a",
    pool: "premium",
    enabled: true,
    failover_enabled: false,
  });
});

test("createResourceCrud drives backend create, edit, and reset without backend-specific helpers", () => {
  const events = [];
  const state = {
    proxies: [
      { id: 7, name: "tokyo", address: "10.0.0.7:1080", enabled: true },
      { id: 8, name: "sydney", address: "10.0.0.8:1080", enabled: false },
    ],
    backends: [{
      id: 3,
      name: "edge-a",
      pool: "premium",
      protocol: "anthropic",
      base_url: "https://edge-a.example",
      api_key: "secret",
      proxy_id: 7,
      models: ["gpt-4.1", "claude-sonnet-4"],
      model_mapping: { "gpt-4": "gpt-4.1" },
      endpoints: ["responses", "messages"],
      weight: 9,
      enabled: false,
    }],
    clients: [],
    policies: [],
    editingBackendID: null,
  };

  function createClassList(initial = []) {
    const tokens = new Set(initial);
    return {
      add(...items) {
        items.forEach((item) => tokens.add(item));
      },
      remove(...items) {
        items.forEach((item) => tokens.delete(item));
      },
      contains(item) {
        return tokens.has(item);
      },
    };
  }

  function createInput(value = "") {
    return {
      value,
      checked: false,
      placeholder: "",
      innerHTML: "",
      focus() {
        events.push("focus:name");
      },
    };
  }

  const backendForm = {
    resetCalls: 0,
    reset() {
      this.resetCalls += 1;
      Object.values(this.elements).forEach((element) => {
        if ("checked" in element) {
          element.checked = false;
        }
        if ("value" in element) {
          element.value = "";
        }
      });
    },
    elements: {
      name: createInput(),
      pool: createInput(),
      protocol: createInput(),
      base_url: createInput(),
      api_key: createInput(),
      proxy_id: createInput(),
      models: createInput(),
      model_mapping: createInput(),
      endpoints: createInput(),
      weight: createInput(),
      enabled: createInput(),
    },
  };

  const backendModal = { classList: createClassList(["hidden"]) };
  const backendSubmitBtn = { textContent: "" };
  const backendCancelBtn = { classList: createClassList(["hidden"]) };
  const backendEditBanner = { textContent: "", classList: createClassList(["hidden"]) };
  const backendModalTitle = { textContent: "" };

  const crud = createResourceCrud({
    state,
    resources: {
      backends: {
        form: backendForm,
        modal: backendModal,
        title: backendModalTitle,
        submitButton: backendSubmitBtn,
        cancelButton: backendCancelBtn,
        editBanner: backendEditBanner,
        editingStateKey: "editingBackendID",
        collectionStateKey: "backends",
        render() {
          events.push("render:backends");
        },
        createTitle: "新增 Backend",
        editTitle: "编辑 Backend",
        createSubmitLabel: "新增 Backend",
        editSubmitLabel: "保存 Backend",
        editBannerText(item) {
          return `正在编辑 Backend: ${item.name}`;
        },
        focusField: "name",
        defaults: {
          protocol: "openai",
          api_key: { placeholder: "Backend API key" },
          proxy_id: "0",
          model_mapping: "",
          weight: 1,
          enabled: true,
        },
        assignEditValues(form, item, helpers) {
          form.elements.name.value = item.name || "";
          form.elements.pool.value = item.pool || "";
          form.elements.protocol.value = item.protocol || "openai";
          form.elements.base_url.value = item.base_url || "";
          form.elements.api_key.value = item.api_key || "";
          form.elements.api_key.placeholder = "Backend API key";
          form.elements.proxy_id.value = String(item.proxy_id || 0);
          form.elements.models.value = (item.models || []).join(", ");
          form.elements.model_mapping.value = helpers.formatModelMappingInput(item.model_mapping);
          form.elements.endpoints.value = (item.endpoints || []).join(", ");
          form.elements.weight.value = item.weight || 1;
          form.elements.enabled.checked = Boolean(item.enabled);
        },
      },
    },
  });

  assert.equal("renderProxyOptions" in crud, false);

  crud.startCreate("backends");
  assert.equal(state.editingBackendID, null);
  assert.equal(backendForm.elements.protocol.value, "openai");
  assert.equal(backendForm.elements.api_key.placeholder, "Backend API key");
  assert.equal(backendForm.elements.proxy_id.value, "0");
  assert.equal(backendForm.elements.weight.value, 1);
  assert.equal(backendForm.elements.enabled.checked, true);
  assert.equal(backendSubmitBtn.textContent, "新增 Backend");
  assert.equal(backendModalTitle.textContent, "新增 Backend");
  assert.equal(backendCancelBtn.classList.contains("hidden"), false);
  assert.equal(backendEditBanner.classList.contains("hidden"), true);
  assert.equal(backendModal.classList.contains("hidden"), false);

  crud.startEdit("backends", 3);
  assert.equal(state.editingBackendID, 3);
  assert.equal(backendForm.elements.name.value, "edge-a");
  assert.equal(backendForm.elements.protocol.value, "anthropic");
  assert.equal(backendForm.elements.models.value, "gpt-4.1, claude-sonnet-4");
  assert.equal(backendForm.elements.model_mapping.value, "gpt-4=gpt-4.1");
  assert.equal(backendForm.elements.endpoints.value, "responses, messages");
  assert.equal(backendSubmitBtn.textContent, "保存 Backend");
  assert.equal(backendEditBanner.textContent, "正在编辑 Backend: edge-a");
  assert.equal(backendEditBanner.classList.contains("hidden"), false);
  assert.equal(backendModalTitle.textContent, "编辑 Backend");

  backendForm.elements.proxy_id.value = "7";
  assert.equal(backendForm.elements.proxy_id.value, "7");

  crud.reset("backends");
  assert.equal(state.editingBackendID, null);
  assert.equal(backendForm.elements.protocol.value, "openai");
  assert.equal(backendForm.elements.enabled.checked, true);
  assert.equal(backendSubmitBtn.textContent, "新增 Backend");
  assert.equal(backendCancelBtn.classList.contains("hidden"), true);
  assert.equal(backendEditBanner.classList.contains("hidden"), true);
  assert.equal(backendModal.classList.contains("hidden"), true);
  assert.deepEqual(events, [
    "focus:name",
    "render:backends",
    "focus:name",
    "render:backends",
    "render:backends",
  ]);
});

test("createResourceCrud drives proxy create, edit, and reset defaults with banner visibility", () => {
  const events = [];
  const state = {
    proxies: [{
      id: 11,
      name: "tokyo",
      address: "10.0.0.7:1080",
      username: "alice",
      password: "secret",
      enabled: false,
    }],
    editingProxyID: null,
  };
  const resource = createCrudResourceHarness({
    focusEvent: "focus:proxy",
    renderEvent: "render:proxies",
    focusField: "name",
    defaults: {
      enabled: true,
    },
    fields: ["name", "address", "username", "password", "enabled"],
    assignEditValues(form, proxy) {
      form.elements.name.value = proxy.name || "";
      form.elements.address.value = proxy.address || "";
      form.elements.username.value = proxy.username || "";
      form.elements.password.value = proxy.password || "";
      form.elements.enabled.checked = Boolean(proxy.enabled);
    },
    createTitle: "新增 Proxy",
    editTitle: "编辑 Proxy",
    createSubmitLabel: "新增 Proxy",
    editSubmitLabel: "保存 Proxy",
    editBannerText(proxy) {
      return `正在编辑 SOCKS5 Proxy: ${proxy.name}`;
    },
    events,
  });
  const crud = createResourceCrud({
    state,
    resources: {
      proxies: {
        ...resource,
        editingStateKey: "editingProxyID",
        collectionStateKey: "proxies",
      },
    },
  });

  crud.startCreate("proxies");
  assert.equal(resource.form.elements.enabled.checked, true);
  assert.equal(resource.submitButton.textContent, "新增 Proxy");
  assert.equal(resource.cancelButton.classList.contains("hidden"), false);
  assert.equal(resource.editBanner.classList.contains("hidden"), true);
  assert.equal(resource.title.textContent, "新增 Proxy");

  crud.startEdit("proxies", 11);
  assert.equal(state.editingProxyID, 11);
  assert.equal(resource.form.elements.name.value, "tokyo");
  assert.equal(resource.form.elements.password.value, "secret");
  assert.equal(resource.form.elements.enabled.checked, false);
  assert.equal(resource.submitButton.textContent, "保存 Proxy");
  assert.equal(resource.editBanner.textContent, "正在编辑 SOCKS5 Proxy: tokyo");
  assert.equal(resource.editBanner.classList.contains("hidden"), false);
  assert.equal(resource.title.textContent, "编辑 Proxy");

  crud.reset("proxies");
  assert.equal(state.editingProxyID, null);
  assert.equal(resource.form.elements.name.value, "");
  assert.equal(resource.form.elements.password.value, "");
  assert.equal(resource.form.elements.enabled.checked, true);
  assert.equal(resource.submitButton.textContent, "新增 Proxy");
  assert.equal(resource.cancelButton.classList.contains("hidden"), true);
  assert.equal(resource.editBanner.classList.contains("hidden"), true);
  assert.equal(resource.modal.classList.contains("hidden"), true);
  assert.deepEqual(events, [
    "focus:proxy",
    "render:proxies",
    "focus:proxy",
    "render:proxies",
    "render:proxies",
  ]);
});

test("createResourceCrud sets client token placeholder for create and edit states", () => {
  const state = {
    clients: [
      { id: 21, name: "plain-token", token: "client-secret", enabled: true },
      { id: 22, name: "hashed-token", token_hash: "abc123", enabled: false },
    ],
    editingClientID: null,
  };
  const resource = createCrudResourceHarness({
    focusEvent: "focus:client",
    renderEvent: "render:clients",
    focusField: "name",
    defaults: {
      token: { placeholder: "Leave blank to auto-generate" },
      enabled: true,
    },
    fields: ["name", "token", "route_mode_override", "route_group", "enabled"],
    assignEditValues(form, client) {
      form.elements.name.value = client.name || "";
      form.elements.token.value = client.token || "";
      form.elements.token.placeholder = client.token ? "Client token" : "历史 key 仅保存了 hash；重新填写后可显示";
      form.elements.route_mode_override.value = client.route_mode_override || "";
      form.elements.route_group.value = client.route_group || "";
      form.elements.enabled.checked = Boolean(client.enabled);
    },
    createTitle: "新增 Client Key",
    editTitle: "编辑 Client Key",
    createSubmitLabel: "新增 Client Key",
    editSubmitLabel: "保存 Client Key",
    editBannerText(client) {
      return `正在编辑 Client Key: ${client.name}`;
    },
  });
  const crud = createResourceCrud({
    state,
    resources: {
      clients: {
        ...resource,
        editingStateKey: "editingClientID",
        collectionStateKey: "clients",
      },
    },
  });

  crud.startCreate("clients");
  assert.equal(resource.form.elements.token.value, "");
  assert.equal(resource.form.elements.token.placeholder, "Leave blank to auto-generate");

  crud.startEdit("clients", 21);
  assert.equal(resource.form.elements.token.value, "client-secret");
  assert.equal(resource.form.elements.token.placeholder, "Client token");

  crud.startEdit("clients", 22);
  assert.equal(resource.form.elements.token.value, "");
  assert.equal(resource.form.elements.token.placeholder, "历史 key 仅保存了 hash；重新填写后可显示");

  crud.reset("clients");
  assert.equal(resource.form.elements.token.value, "");
  assert.equal(resource.form.elements.token.placeholder, "Leave blank to auto-generate");
});

test("createResourceCrud drives policy create, edit, and reset defaults with banner visibility", () => {
  const events = [];
  const state = {
    policies: [{
      id: 31,
      pattern: "gpt-*",
      endpoint: "responses",
      placement_policy: "round_robin",
      backend_pool: "premium",
      priority: 7,
      failover_enabled: false,
    }],
    editingPolicyID: null,
  };
  const resource = createCrudResourceHarness({
    focusEvent: "focus:policy",
    renderEvent: "render:policies",
    focusField: "pattern",
    defaults: {
      endpoint: "chat",
      placement_policy: "sticky",
      priority: 100,
      failover_enabled: true,
    },
    fields: ["pattern", "endpoint", "placement_policy", "backend_pool", "priority", "failover_enabled"],
    assignEditValues(form, policy) {
      form.elements.pattern.value = policy.pattern || "";
      form.elements.endpoint.value = policy.endpoint || "chat";
      form.elements.placement_policy.value = policy.placement_policy || "sticky";
      form.elements.backend_pool.value = policy.backend_pool || "";
      form.elements.priority.value = policy.priority || 100;
      form.elements.failover_enabled.checked = Boolean(policy.failover_enabled);
    },
    createTitle: "新增 Policy",
    editTitle: "编辑 Policy",
    createSubmitLabel: "新增 Policy",
    editSubmitLabel: "保存 Policy",
    editBannerText(policy) {
      return `正在编辑 Model Policy: ${policy.pattern}`;
    },
    events,
  });
  const crud = createResourceCrud({
    state,
    resources: {
      policies: {
        ...resource,
        editingStateKey: "editingPolicyID",
        collectionStateKey: "policies",
      },
    },
  });

  crud.startCreate("policies");
  assert.equal(resource.form.elements.endpoint.value, "chat");
  assert.equal(resource.form.elements.placement_policy.value, "sticky");
  assert.equal(resource.form.elements.priority.value, 100);
  assert.equal(resource.form.elements.failover_enabled.checked, true);
  assert.equal(resource.editBanner.classList.contains("hidden"), true);

  crud.startEdit("policies", 31);
  assert.equal(state.editingPolicyID, 31);
  assert.equal(resource.form.elements.pattern.value, "gpt-*");
  assert.equal(resource.form.elements.endpoint.value, "responses");
  assert.equal(resource.form.elements.placement_policy.value, "round_robin");
  assert.equal(resource.form.elements.priority.value, 7);
  assert.equal(resource.form.elements.failover_enabled.checked, false);
  assert.equal(resource.editBanner.textContent, "正在编辑 Model Policy: gpt-*");
  assert.equal(resource.editBanner.classList.contains("hidden"), false);

  crud.reset("policies");
  assert.equal(state.editingPolicyID, null);
  assert.equal(resource.form.elements.pattern.value, "");
  assert.equal(resource.form.elements.endpoint.value, "chat");
  assert.equal(resource.form.elements.placement_policy.value, "sticky");
  assert.equal(resource.form.elements.priority.value, 100);
  assert.equal(resource.form.elements.failover_enabled.checked, true);
  assert.equal(resource.cancelButton.classList.contains("hidden"), true);
  assert.equal(resource.editBanner.classList.contains("hidden"), true);
  assert.equal(resource.modal.classList.contains("hidden"), true);
  assert.deepEqual(events, [
    "focus:policy",
    "render:policies",
    "focus:policy",
    "render:policies",
    "render:policies",
  ]);
});

function createClassList(initial = []) {
  const tokens = new Set(initial);
  return {
    add(...items) {
      items.forEach((item) => tokens.add(item));
    },
    remove(...items) {
      items.forEach((item) => tokens.delete(item));
    },
    contains(item) {
      return tokens.has(item);
    },
  };
}

function createInput(events, focusEvent, value = "") {
  return {
    value,
    checked: false,
    placeholder: "",
    innerHTML: "",
    focus() {
      if (events && focusEvent) {
        events.push(focusEvent);
      }
    },
  };
}

function createCrudResourceHarness({
  focusEvent,
  renderEvent,
  focusField,
  defaults,
  fields,
  assignEditValues,
  createTitle,
  editTitle,
  createSubmitLabel,
  editSubmitLabel,
  editBannerText,
  events = [],
}) {
  const elements = Object.fromEntries(fields.map((field) => [field, createInput(events, field === focusField ? focusEvent : null)]));
  const form = {
    resetCalls: 0,
    reset() {
      this.resetCalls += 1;
      Object.values(this.elements).forEach((element) => {
        if ("checked" in element) {
          element.checked = false;
        }
        if ("value" in element) {
          element.value = "";
        }
      });
    },
    elements,
  };
  return {
    form,
    modal: { classList: createClassList(["hidden"]) },
    title: { textContent: "" },
    submitButton: { textContent: "" },
    cancelButton: { classList: createClassList(["hidden"]) },
    editBanner: { textContent: "", classList: createClassList(["hidden"]) },
    render() {
      events.push(renderEvent);
    },
    focusField,
    defaults,
    assignEditValues,
    createTitle,
    editTitle,
    createSubmitLabel,
    editSubmitLabel,
    editBannerText,
  };
}
