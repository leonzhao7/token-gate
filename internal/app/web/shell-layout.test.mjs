import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("sidebar navigation uses product SVG icons instead of letter placeholders", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const nav = matchSidebarNav(html);
  const iconNames = Array.from(nav.matchAll(/<svg\b[^>]*class="nav-icon"[^>]*data-nav-icon="([^"]+)"/g), (match) => match[1]);

  assert.deepEqual(iconNames, [
    "dashboard",
    "proxies",
    "backends",
    "client-keys",
    "policies",
    "usage-logs",
    "events",
    "settings",
  ]);
  assert.equal((nav.match(/<svg\b[^>]*class="nav-icon"/g) || []).length, 8);
  assert.equal((nav.match(/aria-hidden="true"/g) || []).length, 8);
  assert.equal((nav.match(/viewBox="0 0 24 24"/g) || []).length, 8);
  assert.doesNotMatch(nav, /<span class="nav-icon"/);
});

test("header shell controls use SVG icons instead of text glyph placeholders", () => {
  const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const header = matchShellHeader(html);
  const iconNames = Array.from(header.matchAll(/<svg\b[^>]*data-shell-icon="([^"]+)"/g), (match) => match[1]);

  assert.deepEqual(iconNames, [
    "search",
    "theme",
    "notifications",
    "profile-menu",
  ]);
  assert.equal((header.match(/<svg\b[^>]*class="[^"]*shell-icon/g) || []).length, 4);
  assert.doesNotMatch(header, /[⌕◐🔔]/u);
});

function matchSidebarNav(html) {
  const match = html.match(/<nav class="sidebar-nav"[\s\S]*?<\/nav>/);
  assert.ok(match, "expected sidebar navigation");
  return match[0];
}

function matchShellHeader(html) {
  const match = html.match(/<header class="topbar shell-header"[\s\S]*?<\/header>/);
  assert.ok(match, "expected shell header");
  return match[0];
}
