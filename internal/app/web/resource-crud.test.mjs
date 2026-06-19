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

test("createResourceCrud drives backend create, edit, reset, and proxy option rendering", () => {
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
    escapeHTML(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    },
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
  crud.renderProxyOptions();
  assert.match(backendForm.elements.proxy_id.innerHTML, /Direct connection/);
  assert.match(backendForm.elements.proxy_id.innerHTML, /tokyo \(10\.0\.0\.7:1080\)/);
  assert.match(backendForm.elements.proxy_id.innerHTML, /sydney \(10\.0\.0\.8:1080\) - disabled/);
  assert.equal(backendForm.elements.proxy_id.value, "7");

  backendForm.elements.proxy_id.value = "999";
  crud.renderProxyOptions();
  assert.equal(backendForm.elements.proxy_id.value, "0");

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
