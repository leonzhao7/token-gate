import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  pageIDFromHash,
  activatePageView,
  renderHeaderPanels,
  renderThemeView,
  renderSearchShellView,
  renderSearchResults,
} = require("./shell-view.js");

test("pageIDFromHash resolves known hashes and falls back to overview", () => {
  const pages = [
    { id: "overview" },
    { id: "backends" },
    { id: "usage-logs" },
  ];

  assert.equal(pageIDFromHash("#backends", pages), "backends");
  assert.equal(pageIDFromHash("#missing", pages), "overview");
  assert.equal(pageIDFromHash("", pages), "overview");
});

test("activatePageView toggles active page and updates title plus breadcrumb", () => {
  const overviewPage = createPage("overview", "Dashboard", "Dashboard / Overview");
  const backendPage = createPage("backends", "Backends", "Dashboard / Backends");
  const usagePage = createPage("usage-logs", "Usage Logs", "Observability / Usage Logs");
  const overviewLink = createNavLink("overview");
  const backendLink = createNavLink("backends");
  const usageLink = createNavLink("usage-logs");
  const pageTitle = { textContent: "" };
  const pageBreadcrumb = { textContent: "" };

  const nextID = activatePageView({
    pages: [overviewPage, backendPage, usagePage],
    pageLinks: [overviewLink, backendLink, usageLink],
    id: "usage-logs",
    pageTitle,
    pageBreadcrumb,
  });

  assert.equal(nextID, "usage-logs");
  assert.equal(overviewPage.classList.contains("active"), false);
  assert.equal(usagePage.classList.contains("active"), true);
  assert.equal(backendLink.classList.contains("active"), false);
  assert.equal(usageLink.classList.contains("active"), true);
  assert.equal(pageTitle.textContent, "Usage Logs");
  assert.equal(pageBreadcrumb.textContent, "Observability / Usage Logs");
});

test("renderThemeView syncs theme datasets and mixed toggle state", () => {
  const rootElement = { dataset: {} };
  const appShell = createAttributeElement();
  const themeToggleBtn = createAttributeElement();
  const themeToggleLabel = { textContent: "" };

  renderThemeView({
    rootElement,
    appShell,
    themeToggleBtn,
    themeToggleLabel,
    theme: "dark",
    preference: "system",
    getThemeToggleState() {
      return {
        label: "Auto",
        hint: "Follow system theme",
        pressed: "mixed",
      };
    },
  });

  assert.equal(rootElement.dataset.theme, "dark");
  assert.equal(rootElement.dataset.themePreference, "system");
  assert.equal(appShell.attributes["data-theme"], "dark");
  assert.equal(themeToggleLabel.textContent, "Auto");
  assert.equal(themeToggleBtn.title, "Follow system theme");
  assert.equal(themeToggleBtn.attributes["aria-pressed"], "mixed");
});

test("renderSearchShellView syncs visibility query and results markup", () => {
  const searchModalRoot = createVisibilityElement();
  const searchOpenBtn = createAttributeElement();
  const searchInput = { value: "" };
  const searchResultsRoot = { innerHTML: "" };

  renderSearchShellView({
    searchModalRoot,
    searchOpenBtn,
    searchInput,
    searchResultsRoot,
    isOpen: true,
    query: "gpt-5",
    resultsMarkup: "<div>results</div>",
  });

  assert.equal(searchModalRoot.classList.contains("hidden"), false);
  assert.equal(searchModalRoot.attributes["aria-hidden"], "false");
  assert.equal(searchOpenBtn.attributes["aria-expanded"], "true");
  assert.equal(searchOpenBtn.value, "gpt-5");
  assert.equal(searchInput.value, "gpt-5");
  assert.equal(searchResultsRoot.innerHTML, "<div>results</div>");
});

test("renderSearchResults renders empty loading and active grouped rows", () => {
  assert.match(
    renderSearchResults({
      query: "",
      loading: false,
      results: { total: 0, groups: [] },
      keyboardState: { activeItem: null },
    }),
    /Search everything/,
  );

  assert.match(
    renderSearchResults({
      query: "gpt",
      loading: true,
      results: { total: 0, groups: [] },
      keyboardState: { activeItem: null },
    }),
    /Searching/,
  );

  const html = renderSearchResults({
    query: "gpt",
    loading: false,
    results: {
      total: 1,
      groups: [{
        key: "backends",
        label: "Backends",
        items: [{
          kind: "backend",
          title: "edge-a",
          subtitle: "premium",
          meta: "healthy",
          status: "ok",
          targetPage: "backends",
          targetId: "7",
        }],
      }],
    },
    keyboardState: {
      activeItem: {
        groupKey: "backends",
        itemIndex: 0,
      },
    },
  });

  assert.match(html, /search-result-item active/);
  assert.match(html, /data-search-group="backends"/);
  assert.match(html, /data-search-kind="backend"/);
  assert.match(html, /data-search-page="backends"/);
  assert.match(html, /edge-a/);
  assert.match(html, /search-result-kind/);
  assert.match(html, /Backend/);
  assert.match(html, /Opens Backends page and detail drawer/);
  assert.match(html, /healthy/);
  assert.match(html, /1 result/);
  assert.match(html, /<kbd>↑<\/kbd>/);
  assert.match(html, /<kbd>Enter<\/kbd>/);
  assert.match(html, /<kbd>Esc<\/kbd>/);
});

test("renderHeaderPanels renders notifications and profile utility panels", () => {
  const html = renderHeaderPanels({
    viewModel: {
      activePanel: "notifications",
      notifications: {
        count: 2,
        items: [{
          title: "backend.failover",
          description: "edge-a switched",
          meta: "edge-a · gpt-5.4",
          timestamp: "2026-06-22 10:11:12.123",
          tone: "warning",
        }],
        actions: [{ key: "view-events", label: "View Events" }],
      },
      profile: {
        title: "Admin",
        subtitle: "Proxy Ops",
        items: [
          { label: "Theme", value: "Auto · Dark" },
          { label: "Last sync", value: "2026-06-22 10:12:13.123" },
        ],
        actions: [{ key: "open-search", label: "Open Search" }],
      },
    },
  });

  assert.match(html, /data-header-panel="notifications"/);
  assert.match(html, /data-header-panel="profile"/);
  assert.match(html, /backend\.failover/);
  assert.match(html, /Auto · Dark/);
  assert.match(html, /data-header-action="view-events"/);
  assert.match(html, /data-header-action="open-search"/);
  assert.match(html, /is-visible/);
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
    toggle(item, force) {
      if (force === true) {
        tokens.add(item);
        return true;
      }
      if (force === false) {
        tokens.delete(item);
        return false;
      }
      if (tokens.has(item)) {
        tokens.delete(item);
        return false;
      }
      tokens.add(item);
      return true;
    },
  };
}

function createPage(id, title, breadcrumb) {
  return {
    id,
    dataset: {
      pageTitle: title,
      pageBreadcrumb: breadcrumb,
    },
    classList: createClassList(),
  };
}

function createNavLink(pageLink) {
  return {
    dataset: {
      pageLink,
    },
    classList: createClassList(),
  };
}

function createAttributeElement() {
  return {
    attributes: {},
    title: "",
    value: "",
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}

function createVisibilityElement() {
  return {
    attributes: {},
    classList: createClassList(["hidden"]),
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}
