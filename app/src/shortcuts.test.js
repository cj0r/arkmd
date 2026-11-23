import { test } from "node:test";
import assert from "node:assert/strict";
import { KEY, SHORTCUTS } from "./shortcuts.js";

test("every shortcut a menu shows is in the shortcut list", () => {
  const listed = SHORTCUTS.flatMap(([, rows]) => rows.map(([keys]) => keys)).join(" | ");
  for (const [name, keys] of Object.entries(KEY)) assert.ok(listed.includes(keys), `${name} (${keys}) is missing from SHORTCUTS`);
});

test("shortcuts are written the same way everywhere", () => {
  for (const keys of Object.values(KEY)) assert.match(keys, /^Ctrl(\+Shift)?\+[A-Z,]$/);
});
