import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { THEME_INIT_SCRIPT } from "../src/lib/theme";

function initialize(saved: string | null, systemDark: boolean, blockedStorage = false) {
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  runInNewContext(THEME_INIT_SCRIPT, {
    document,
    localStorage: { getItem: () => { if (blockedStorage) throw new Error("Storage blocked"); return saved; } },
    matchMedia: () => ({ matches: systemDark }),
  });
  return document.documentElement.dataset.theme;
}

test("applies the saved theme before hydration even when the system prefers the other theme", () => {
  assert.equal(initialize("dark", false), "dark");
  assert.equal(initialize("light", true), "light");
});

test("follows system preference without a valid saved theme, including blocked storage", () => {
  assert.equal(initialize(null, true), "dark");
  assert.equal(initialize(null, false), "light");
  assert.equal(initialize("invalid", true), "dark");
  assert.equal(initialize(null, true, true), "dark");
});
