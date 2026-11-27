import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTOSAVE_DELAYS, AUTOSAVE_DEFAULT, AUTOSAVE_MAX_WAIT, normalizeDelay, autosaveWaitMs, delayLabel } from "./autosave.js";

test("normalizeDelay keeps the offered delays and falls back to the default", () => {
  for (const d of AUTOSAVE_DELAYS) assert.equal(normalizeDelay(d), d);
  assert.equal(normalizeDelay("30"), 30);
  for (const bad of [undefined, null, 0, 5, -3, "x", NaN]) assert.equal(normalizeDelay(bad), AUTOSAVE_DEFAULT);
});

test("autosaveWaitMs waits for the chosen pause when the file has only just become unsaved", () => {
  assert.equal(autosaveWaitMs(10, 1000, 1000), 10000);
  assert.equal(autosaveWaitMs(30, 0, 5000), 30000);          // no start time known
  assert.equal(autosaveWaitMs(3, 1000, 3000), 3000);
});

test("autosaveWaitMs saves once continuous typing reaches the maximum wait", () => {
  const start = 1_000_000;
  const max = AUTOSAVE_MAX_WAIT * 1000;
  assert.equal(autosaveWaitMs(60, start, start + max - 20_000), 20_000, "cut short to the time that is left");
  assert.equal(autosaveWaitMs(60, start, start + max - 90_000), 60_000, "the pause is shorter than what is left");
  assert.equal(autosaveWaitMs(60, start, start + max), 0, "due now");
  assert.equal(autosaveWaitMs(60, start, start + max + 5000), 0, "already overdue");
});

test("delayLabel names each choice", () => {
  assert.deepEqual(AUTOSAVE_DELAYS.map(delayLabel), ["3 seconds", "10 seconds", "30 seconds", "1 minute"]);
});
