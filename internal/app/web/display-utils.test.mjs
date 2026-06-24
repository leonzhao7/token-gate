import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DisplayUtils = require("./display-utils.js");

test("formatDateTime formats ISO timestamps to millisecond precision", () => {
  assert.match(
    DisplayUtils.formatDateTime("2026-06-20T10:11:12.345Z"),
    /^2026-06-20 \d{2}:\d{2}:\d{2}\.345$/,
  );
});

test("formatDateTime returns raw value when parsing fails", () => {
  assert.equal(DisplayUtils.formatDateTime("not-a-date"), "not-a-date");
  assert.equal(DisplayUtils.formatDateTime(""), "-");
});

test("emptyState escapes title and description", () => {
  const html = DisplayUtils.emptyState("<Alert>", "\"Danger\"");

  assert.match(html, /&lt;Alert&gt;/);
  assert.match(html, /&quot;Danger&quot;/);
});

test("renderDatalist renders option markup with escaping", () => {
  const element = { innerHTML: "" };
  DisplayUtils.renderDatalist(element, ["gpt-5", "<unsafe>"]);

  assert.match(element.innerHTML, /option value="gpt-5"/);
  assert.match(element.innerHTML, /&lt;unsafe&gt;/);
});

test("statusPill escapes copy and toggles classes", () => {
  assert.equal(
    DisplayUtils.statusPill(true, "<on>", "off"),
    '<span class="status-pill ok">&lt;on&gt;</span>',
  );
  assert.equal(
    DisplayUtils.statusPill(false, "on", '"off"'),
    '<span class="status-pill off">&quot;off&quot;</span>',
  );
});

test("tableActions renders icon buttons for edit and delete", () => {
  const html = DisplayUtils.tableActions("backend", 7);

  assert.match(html, /data-edit-backend="7"/);
  assert.match(html, /data-delete-backend="7"/);
  assert.match(html, /data-shell-icon="table-action-edit"/);
  assert.match(html, /data-shell-icon="table-action-delete"/);
  assert.doesNotMatch(html, />编辑<|>删除</);
});

test("backend list helpers normalize empty and populated metadata values", () => {
  assert.equal(DisplayUtils.formatTagList(["hk", "priority"]), "hk, priority");
  assert.equal(DisplayUtils.formatTagList([]), "-");
  assert.equal(DisplayUtils.formatModelList(["gpt-4o"]), "gpt-4o");
  assert.equal(DisplayUtils.formatModelList(null), "-");
  assert.equal(DisplayUtils.formatHourlyCount(7), "7");
  assert.equal(DisplayUtils.formatHourlyCount(0), "0");
});

test("escapeHTML escapes reserved characters", () => {
  assert.equal(
    DisplayUtils.escapeHTML(`<'">&`),
    "&lt;&#39;&quot;&gt;&amp;",
  );
});
