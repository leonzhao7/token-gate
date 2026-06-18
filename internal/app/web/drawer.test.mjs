import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildDrawerTarget,
  drawerFooterActions,
  drawerTabsForResource,
  normalizeDrawerPayload,
  normalizeResourceKind,
} = require("./drawer.js");

test("normalizeResourceKind maps aliases and page ids to canonical resource keys", () => {
  assert.equal(normalizeResourceKind("backend"), "backends");
  assert.equal(normalizeResourceKind("client_key"), "clients");
  assert.equal(normalizeResourceKind("client-keys"), "clients");
  assert.equal(normalizeResourceKind("policy"), "policies");
  assert.equal(normalizeResourceKind("model-policies"), "policies");
  assert.equal(normalizeResourceKind("proxy"), "proxies");
  assert.equal(normalizeResourceKind("socks-proxies"), "proxies");
  assert.equal(normalizeResourceKind("usage_log"), "");
});

test("buildDrawerTarget returns detail and delete endpoints for supported resources", () => {
  assert.deepEqual(buildDrawerTarget({ kind: "backend", page: "backends", id: "7" }), {
    kind: "backends",
    id: "7",
    title: "Backend",
    detailPath: "/admin/api/backends/7/detail",
    deletePath: "/admin/api/backends/7",
    page: "backends",
  });

  assert.deepEqual(buildDrawerTarget({ kind: "client_key", page: "client-keys", id: "12" }), {
    kind: "clients",
    id: "12",
    title: "Client Key",
    detailPath: "/admin/api/client-keys/12/detail",
    deletePath: "/admin/api/client-keys/12",
    page: "client-keys",
  });
});

test("drawerTabsForResource returns the premium drawer tab order", () => {
  assert.deepEqual(drawerTabsForResource("backends"), [
    { key: "overview", label: "Overview" },
    { key: "configuration", label: "Configuration" },
    { key: "metadata", label: "Metadata" },
    { key: "raw", label: "Raw JSON" },
    { key: "activity", label: "Activity" },
  ]);
});

test("normalizeDrawerPayload guarantees all tab payload buckets", () => {
  assert.deepEqual(normalizeDrawerPayload({
    overview: { name: "edge-a" },
    raw: { id: 7 },
  }), {
    overview: { name: "edge-a" },
    configuration: {},
    metadata: {},
    raw: { id: 7 },
    activity: {},
  });
});

test("drawerFooterActions keeps save disabled for read-only drawer detail", () => {
  assert.deepEqual(drawerFooterActions(), [
    { key: "edit", label: "Edit", tone: "ghost", disabled: false },
    { key: "delete", label: "Delete", tone: "danger", disabled: false },
    { key: "save", label: "Save", tone: "primary", disabled: true },
  ]);
});
