import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("index.html renders structured events observability toolbar", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const section = matchSection(html, "events");
  const expectedIds = [
    "eventQueryFilter",
    "eventActorFilter",
    "eventBackendFilter",
    "eventCategoryFilter",
    "eventSeverityFilter",
    "eventDateFromFilter",
    "eventDateToFilter",
    "refreshEventsBtn",
    "applyEventFiltersBtn",
    "resetEventFiltersBtn",
  ];

  assert.match(section, /data-observability-toolbar="events"/);
  assert.match(section, /observability-toolbar-main/);
  assert.match(section, /observability-toolbar-grid/);
  assert.match(section, /observability-toolbar-actions/);
  assert.match(section, /Events timeline filters/);
  assertSectionIds(section, expectedIds);
  assert.match(section, /data-shell-icon="toolbar-refresh"/);
  assert.match(section, /data-shell-icon="toolbar-query"/);
  assert.match(section, /data-shell-icon="toolbar-reset"/);
  assert.match(section, /observability-toolbar-button/);
  assert.doesNotMatch(section, /<button[^>]*>(刷新|查询|重置)<\/button>/);
});

test("index.html renders structured usage log observability toolbar", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const section = matchSection(html, "usage-logs");
  const expectedIds = [
    "usageLogQueryFilter",
    "usageLogDateFromFilter",
    "usageLogDateToFilter",
    "usageLogBackendFilter",
    "usageLogModelFilter",
    "usageLogClientKeyFilter",
    "usageLogProxyFilter",
    "usageLogStatusFilter",
    "refreshUsageLogsBtn",
    "applyUsageLogFiltersBtn",
    "resetUsageLogFiltersBtn",
    "deleteUsageLogsBtn",
    "clearUsageLogsBtn",
  ];

  assert.match(section, /data-observability-toolbar="usage-logs"/);
  assert.match(section, /observability-toolbar-main/);
  assert.match(section, /observability-toolbar-grid/);
  assert.match(section, /observability-toolbar-actions/);
  assert.match(section, /Usage request filters/);
  assertSectionIds(section, expectedIds);
  assert.match(section, /data-shell-icon="toolbar-refresh"/);
  assert.match(section, /data-shell-icon="toolbar-query"/);
  assert.match(section, /data-shell-icon="toolbar-reset"/);
  assert.match(section, /data-shell-icon="toolbar-delete"/);
  assert.match(section, /data-shell-icon="toolbar-clear"/);
  assert.match(section, /observability-toolbar-button/);
  assert.doesNotMatch(section, /<button[^>]*>(刷新|查询|重置|删除|清空)<\/button>/);
});

function matchSection(html, id) {
  const match = html.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?<\\/section>`));
  assert.ok(match, `expected section ${id}`);
  return match[0];
}

function assertSectionIds(section, expectedIds) {
  for (const id of expectedIds) {
    assert.equal(countIdOccurrences(section, id), 1, `expected ${id} exactly once`);
  }
}

function countIdOccurrences(section, id) {
  return section.match(new RegExp(`id="${id}"`, "g"))?.length || 0;
}
