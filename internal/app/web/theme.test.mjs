import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  normalizeThemePreference,
  resolveThemeState,
  nextThemePreference,
  getThemeToggleState,
} = require("./theme.js");

test("normalizeThemePreference falls back to system", () => {
  assert.equal(normalizeThemePreference(undefined), "system");
  assert.equal(normalizeThemePreference(""), "system");
  assert.equal(normalizeThemePreference("custom"), "system");
});

test("resolveThemeState follows system when there is no override", () => {
  assert.deepEqual(resolveThemeState({ storedPreference: null, systemPrefersDark: true }), {
    preference: "system",
    theme: "dark",
    isAuto: true,
  });

  assert.deepEqual(resolveThemeState({ storedPreference: null, systemPrefersDark: false }), {
    preference: "system",
    theme: "light",
    isAuto: true,
  });
});

test("resolveThemeState keeps explicit light or dark overrides", () => {
  assert.deepEqual(resolveThemeState({ storedPreference: "light", systemPrefersDark: true }), {
    preference: "light",
    theme: "light",
    isAuto: false,
  });

  assert.deepEqual(resolveThemeState({ storedPreference: "dark", systemPrefersDark: false }), {
    preference: "dark",
    theme: "dark",
    isAuto: false,
  });
});

test("nextThemePreference cycles system, light, dark", () => {
  assert.equal(nextThemePreference("system"), "light");
  assert.equal(nextThemePreference("light"), "dark");
  assert.equal(nextThemePreference("dark"), "system");
  assert.equal(nextThemePreference("invalid"), "light");
});

test("getThemeToggleState exposes button label and hint", () => {
  assert.deepEqual(getThemeToggleState({ preference: "system", theme: "dark" }), {
    label: "Auto",
    hint: "Follow system theme",
    pressed: "mixed",
  });

  assert.deepEqual(getThemeToggleState({ preference: "light", theme: "light" }), {
    label: "Light",
    hint: "Switch theme mode",
    pressed: false,
  });

  assert.deepEqual(getThemeToggleState({ preference: "dark", theme: "dark" }), {
    label: "Dark",
    hint: "Switch theme mode",
    pressed: true,
  });
});
