import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ShellRuntimeUtils = require("./shell-runtime.js");

test("page helpers delegate navigation state and page activation", () => {
  const calls = [];
  const pages = [{ id: "overview" }, { id: "settings" }];
  const pageLinks = [{ dataset: { pageLink: "overview" } }, { dataset: { pageLink: "settings" } }];
  const pageTitle = { textContent: "" };
  const pageBreadcrumb = { textContent: "" };
  const windowObject = { location: { hash: "#overview" } };
  const shellViewUtils = {
    pageIDFromHash(hash, inputPages) {
      calls.push(["pageIDFromHash", hash, inputPages]);
      return "settings";
    },
    activatePageView(input) {
      calls.push(["activatePageView", input]);
      return input.id;
    },
  };
  const shellStateUtils = {
    buildPageNavigation(input) {
      calls.push(["buildPageNavigation", input]);
      return { nextID: "settings", nextHash: "#settings", shouldUpdateHash: true };
    },
  };

  assert.equal(ShellRuntimeUtils.pageIDFromHash({ windowObject, pages, shellViewUtils }), "settings");
  ShellRuntimeUtils.activatePage({
    id: "settings",
    pages,
    pageLinks,
    pageTitle,
    pageBreadcrumb,
    shellViewUtils,
  });
  ShellRuntimeUtils.navigateToPage({
    id: "settings",
    windowObject,
    pages,
    pageLinks,
    pageTitle,
    pageBreadcrumb,
    shellStateUtils,
    shellViewUtils,
  });

  assert.deepEqual(calls[0], ["pageIDFromHash", "#overview", pages]);
  assert.equal(calls[1][0], "activatePageView");
  assert.deepEqual(calls[2], ["buildPageNavigation", { currentHash: "#overview", requestedID: "settings", pages }]);
  assert.equal(windowObject.location.hash, "#settings");
});

test("theme helpers initialize persist resolve and apply theme state", () => {
  const state = { ui: { themePreference: "system", theme: "light" } };
  const rootElement = { dataset: {} };
  const storageCalls = [];
  const localStorage = {
    getItem(key) {
      if (key === "theme-key") {
        return "dark";
      }
      if (key === "admin-key") {
        return "admin-token";
      }
      assert.fail(`unexpected localStorage.getItem key: ${key}`);
    },
    setItem(key, value) {
      storageCalls.push(["set", key, value]);
    },
    removeItem(key) {
      storageCalls.push(["remove", key]);
    },
  };
  const shellStateUtils = {
    createThemeRuntimeState(input) {
      return input.resolveThemeState({
        storedPreference: input.storedPreference,
        systemPrefersDark: input.systemPrefersDark,
      });
    },
    createThemeStorageOperation(preference) {
      return preference === "system"
        ? { type: "remove", value: "" }
        : { type: "set", value: preference };
    },
    createSettingsSnapshot(input) {
      return {
        themePreference: input.themePreference,
        resolvedTheme: input.resolvedTheme,
        sidebarCollapsed: input.sidebarCollapsed,
      };
    },
  };
  const themeUtils = {
    resolveThemeState({ storedPreference, systemPrefersDark }) {
      const preference = storedPreference || "system";
      return {
        preference,
        theme: preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference,
        isAuto: preference === "system",
      };
    },
    nextThemePreference(currentPreference) {
      return currentPreference === "dark" ? "system" : "dark";
    },
    getThemeToggleState({ theme }) {
      return { label: theme, hint: "toggle", pressed: theme === "dark" };
    },
  };
  const settingsUtils = {
    createSettingsViewModel(snapshot) {
      return snapshot;
    },
    renderSettingsPage(viewModel) {
      return `<section>${viewModel.themePreference}:${viewModel.resolvedTheme}:${viewModel.sidebarCollapsed}</section>`;
    },
  };
  const appShell = createClassToggleElement(["sidebar-collapsed"]);
  const sidebarRoot = createClassToggleElement();
  const settingsRoot = { innerHTML: "" };
  const themeToggleBtn = createAttributeElement();
  const themeToggleLabel = { textContent: "" };
  const formatDateTime = (value) => `formatted:${value}`;
  const buildSnapshot = () => ShellRuntimeUtils.buildSettingsSnapshot({
    shellStateUtils,
    localStorage,
    adminTokenKey: "admin-key",
    themePreference: state.ui.themePreference,
    resolvedTheme: state.ui.theme,
    appShell,
    lastRefreshAt: "2026-06-20T10:00:00Z",
    formatDateTime,
    backends: [{ id: 1 }],
    clients: [],
    policies: [],
    proxies: [],
    usageLogStats: { total: 1 },
    usageLogMeta: { total: 1 },
    eventSummary: { total: 2 },
  });

  ShellRuntimeUtils.initializeThemeState({
    state,
    rootElement,
    localStorage,
    themePreferenceKey: "theme-key",
    systemThemeQuery: { matches: false },
    shellStateUtils,
    themeUtils,
  });
  assert.deepEqual(state.ui, { themePreference: "dark", theme: "dark" });
  assert.deepEqual(rootElement.dataset, { themePreference: "dark", theme: "dark" });

  assert.deepEqual(ShellRuntimeUtils.resolveThemeState({
    storedPreference: "system",
    systemPrefersDark: true,
    themeUtils,
  }), { preference: "system", theme: "dark", isAuto: true });

  ShellRuntimeUtils.persistThemePreference({
    preference: "dark",
    localStorage,
    themePreferenceKey: "theme-key",
    shellStateUtils,
  });
  ShellRuntimeUtils.persistThemePreference({
    preference: "system",
    localStorage,
    themePreferenceKey: "theme-key",
    shellStateUtils,
  });
  assert.deepEqual(storageCalls, [
    ["set", "theme-key", "dark"],
    ["remove", "theme-key"],
  ]);

  ShellRuntimeUtils.applyResolvedTheme({
    state,
    systemThemeQuery: { matches: true },
    themeUtils,
  });
  assert.deepEqual(state.ui, { themePreference: "dark", theme: "dark" });

  ShellRuntimeUtils.renderTheme({
    rootElement,
    appShell,
    themeToggleBtn,
    themeToggleLabel,
    theme: state.ui.theme,
    preference: state.ui.themePreference,
    shellViewUtils: {
      renderThemeView(input) {
        input.rootElement.dataset.theme = input.theme;
        input.rootElement.dataset.themePreference = input.preference;
        input.themeToggleLabel.textContent = input.getThemeToggleState({ theme: input.theme, preference: input.preference }).label;
      },
    },
    themeUtils,
  });
  assert.equal(themeToggleLabel.textContent, "dark");

  ShellRuntimeUtils.renderSettings({
    settingsRoot,
    settingsUtils,
    buildSettingsSnapshot: buildSnapshot,
  });
  assert.match(settingsRoot.innerHTML, /dark:dark:true/);

  const cycledPreference = ShellRuntimeUtils.cycleThemePreference({
    currentPreference: state.ui.themePreference,
    themeUtils,
  });
  assert.equal(cycledPreference, "system");

  const collapsed = ShellRuntimeUtils.toggleSidebarCollapsed({ appShell, sidebarRoot });
  assert.equal(collapsed, false);
  assert.equal(appShell.classList.contains("sidebar-collapsed"), false);
  assert.equal(sidebarRoot.classList.contains("is-collapsed"), false);
});

test("sidebar runtime initializes and persists collapsed preference", () => {
  const calls = [];
  const appShell = createClassToggleElement();
  const sidebarRoot = createClassToggleElement();
  const localStorage = {
    getItem(key) {
      calls.push(["get", key]);
      return "collapsed";
    },
    setItem(key, value) {
      calls.push(["set", key, value]);
    },
    removeItem(key) {
      calls.push(["remove", key]);
    },
  };
  const shellStateUtils = {
    parseSidebarCollapsedPreference(value) {
      return value === "collapsed";
    },
    createSidebarStorageOperation(collapsed) {
      return collapsed
        ? { type: "set", value: "collapsed" }
        : { type: "remove", value: "" };
    },
  };

  const initialized = ShellRuntimeUtils.initializeSidebarState({
    appShell,
    sidebarRoot,
    localStorage,
    sidebarCollapsedKey: "sidebar-key",
    shellStateUtils,
  });
  assert.equal(initialized, true);
  assert.equal(appShell.classList.contains("sidebar-collapsed"), true);
  assert.equal(sidebarRoot.classList.contains("is-collapsed"), true);

  const nextState = ShellRuntimeUtils.toggleSidebarCollapsed({
    appShell,
    sidebarRoot,
    localStorage,
    sidebarCollapsedKey: "sidebar-key",
    shellStateUtils,
  });
  assert.equal(nextState, false);
  assert.deepEqual(calls, [
    ["get", "sidebar-key"],
    ["remove", "sidebar-key"],
  ]);
});

test("header panel runtime renders utility popovers and toggles active panel", () => {
  const state = { ui: { headerPanels: { active: "" } } };
  const headerPanelRoot = { innerHTML: "" };
  const notificationMenuBtn = createAttributeElement();
  const profileMenuBtn = createAttributeElement();
  const renderCalls = [];

  ShellRuntimeUtils.renderHeaderPanels({
    headerPanelRoot,
    notificationMenuBtn,
    profileMenuBtn,
    shellViewUtils: {
      renderHeaderPanels(input) {
        renderCalls.push(input.viewModel.activePanel);
        return `<div>${input.viewModel.activePanel}</div>`;
      },
    },
    viewModel: { activePanel: "profile" },
  });

  assert.equal(headerPanelRoot.innerHTML, "<div>profile</div>");
  assert.equal(notificationMenuBtn.attributes["aria-expanded"], "false");
  assert.equal(profileMenuBtn.attributes["aria-expanded"], "true");

  ShellRuntimeUtils.toggleHeaderPanel({
    state,
    panel: "notifications",
    renderHeaderPanels() {
      renderCalls.push(state.ui.headerPanels.active);
    },
  });
  assert.equal(state.ui.headerPanels.active, "notifications");

  ShellRuntimeUtils.toggleHeaderPanel({
    state,
    panel: "notifications",
    renderHeaderPanels() {
      renderCalls.push(state.ui.headerPanels.active);
    },
  });
  assert.equal(state.ui.headerPanels.active, "");
  assert.deepEqual(renderCalls, ["profile", "notifications", ""]);
});

function createClassToggleElement(initial = []) {
  const tokens = new Set(initial);
  return {
    classList: {
      contains(token) {
        return tokens.has(token);
      },
      toggle(token, force) {
        if (force === true) {
          tokens.add(token);
          return true;
        }
        if (force === false) {
          tokens.delete(token);
          return false;
        }
        if (tokens.has(token)) {
          tokens.delete(token);
          return false;
        }
        tokens.add(token);
        return true;
      },
    },
  };
}

function createAttributeElement() {
  return {
    attributes: {},
    title: "",
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}
