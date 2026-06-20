(function initResourceCrudModule(globalScope) {
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

  function formatModelMappingInput(mapping) {
    if (!mapping || typeof mapping !== "object") {
      return "";
    }
    return Object.entries(mapping).map(([from, to]) => `${from}=${to}`).join(", ");
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

  function createResourceCrud({ state, resources }) {
    function applyDefaults(resource) {
      Object.entries(resource.defaults || {}).forEach(([key, defaultValue]) => {
        const element = resource.form.elements[key];
        if (!element) {
          return;
        }
        if (defaultValue && typeof defaultValue === "object" && !Array.isArray(defaultValue)) {
          if (Object.prototype.hasOwnProperty.call(defaultValue, "value")) {
            element.value = defaultValue.value;
          }
          if (Object.prototype.hasOwnProperty.call(defaultValue, "placeholder")) {
            element.placeholder = defaultValue.placeholder;
          }
          if (Object.prototype.hasOwnProperty.call(defaultValue, "checked")) {
            element.checked = Boolean(defaultValue.checked);
          }
          return;
        }
        if (typeof defaultValue === "boolean") {
          element.checked = defaultValue;
          return;
        }
        element.value = defaultValue;
      });
    }

    function showModal(resourceKey) {
      const resource = resources[resourceKey];
      resource.modal.classList.remove("hidden");
      const focusElement = resource.form.elements[resource.focusField];
      if (focusElement && typeof focusElement.focus === "function") {
        focusElement.focus();
      }
    }

    function hideModal(resourceKey) {
      resources[resourceKey].modal.classList.add("hidden");
    }

    function startCreate(resourceKey) {
      const resource = resources[resourceKey];
      state[resource.editingStateKey] = null;
      resource.form.reset();
      applyDefaults(resource);
      resource.submitButton.textContent = resource.createSubmitLabel;
      resource.cancelButton.classList.remove("hidden");
      resource.editBanner.classList.add("hidden");
      resource.title.textContent = resource.createTitle;
      showModal(resourceKey);
      resource.render();
    }

    function startEdit(resourceKey, id) {
      const resource = resources[resourceKey];
      const item = state[resource.collectionStateKey].find((entry) => String(entry.id) === String(id));
      if (!item) {
        return;
      }

      state[resource.editingStateKey] = item.id;
      resource.assignEditValues(resource.form, item, { formatModelMappingInput });
      resource.submitButton.textContent = resource.editSubmitLabel;
      resource.cancelButton.classList.remove("hidden");
      resource.editBanner.textContent = resource.editBannerText(item);
      resource.editBanner.classList.remove("hidden");
      resource.title.textContent = resource.editTitle;
      showModal(resourceKey);
      resource.render();
    }

    function reset(resourceKey) {
      const resource = resources[resourceKey];
      state[resource.editingStateKey] = null;
      resource.form.reset();
      applyDefaults(resource);
      resource.submitButton.textContent = resource.createSubmitLabel;
      resource.cancelButton.classList.add("hidden");
      resource.editBanner.classList.add("hidden");
      resource.title.textContent = resource.createTitle;
      hideModal(resourceKey);
      resource.render();
    }

    return {
      hideModal,
      readForm,
      reset,
      showModal,
      splitList,
      startCreate,
      startEdit,
    };
  }

  const api = {
    createResourceCrud,
    formatModelMappingInput,
    parseModelMapping,
    readForm,
    splitList,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.ResourceCrudUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
