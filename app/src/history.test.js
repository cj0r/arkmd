import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, fileKey, worthKeeping, planPrune, planTotalPrune, lineDelta, formatWhen, formatSize, draftsToOffer, pushClosed } from "./history.js";

const H = 60 * 60 * 1000, D = 24 * H;
const NOW = new Date(2026, 10, 21, 15, 0).getTime();

test("files are filed under their reference; new files have no history", () => {
  assert.equal(fileKey("/home/a/notes.md"), "/home/a/notes.md");
  assert.equal(fileKey(null), null);
  assert.equal(fileKey(""), null);
});

test("a version is kept only when it is new, non-empty and small enough", () => {
  assert.equal(worthKeeping("a", "b"), true);
  assert.equal(worthKeeping("a", undefined), true);
  assert.equal(worthKeeping("a", "a"), false);
  assert.equal(worthKeeping("", "a"), false);
  assert.equal(worthKeeping("x".repeat(LIMITS.maxDocBytes + 1), "a"), false);
  assert.equal(worthKeeping(null, "a"), false);
});

test("pruning keeps everything from the last day", () => {
  const v = [1, 2, 3, 4].map((i) => ({ id: i, t: NOW - i * H }));
  assert.deepEqual(planPrune(v, NOW), []);
});

test("older versions are thinned to the newest one per day", () => {
  const v = [
    { id: 1, t: NOW - 1 * H },
    { id: 2, t: NOW - 2 * D },           // day 2: three versions
    { id: 3, t: NOW - 2 * D - 3 * H },
    { id: 4, t: NOW - 2 * D - 6 * H },
    { id: 5, t: NOW - 5 * D },           // day 5: one
  ];
  assert.deepEqual(planPrune(v, NOW).sort(), [3, 4]);
});

test("pruning also caps the count, dropping the oldest", () => {
  const v = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, t: NOW - (i + 1) * H }));
  assert.deepEqual(planPrune(v, NOW, 4).sort((a, b) => a - b), [5, 6, 7, 8, 9, 10]);
});

test("the size cap removes the oldest versions first", () => {
  const e = [{ id: 1, t: 1, size: 60 }, { id: 2, t: 2, size: 60 }, { id: 3, t: 3, size: 60 }];
  assert.deepEqual(planTotalPrune(e, 100), [1, 2]);
  assert.deepEqual(planTotalPrune(e, 1000), []);
  assert.deepEqual(planTotalPrune([], 10), []);
});

test("lineDelta counts changed lines", () => {
  assert.deepEqual(lineDelta("a\nb\nc", "a\nb\nc"), { added: 0, removed: 0 });
  assert.deepEqual(lineDelta("a\nb\nc", "a\nx\nc\nd"), { added: 2, removed: 1 });
  assert.deepEqual(lineDelta("", "a"), { added: 1, removed: 1 });          // "" is one empty line
  assert.deepEqual(lineDelta("a\na", "a"), { added: 0, removed: 1 });
});

test("times read as today, yesterday or a date", () => {
  assert.equal(formatWhen(new Date(2026, 10, 21, 9, 5).getTime(), NOW), "Today 09:05");
  assert.equal(formatWhen(new Date(2026, 10, 20, 23, 59).getTime(), NOW), "Yesterday 23:59");
  assert.equal(formatWhen(new Date(2026, 10, 18, 14, 32).getTime(), NOW), "Nov 18, 14:32");
  assert.equal(formatWhen(new Date(2025, 11, 31, 8, 0).getTime(), NOW), "Dec 31, 2025, 08:00");
});

test("sizes are short", () => {
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(2048), "2.0 KB");
  assert.equal(formatSize(50 * 1024), "50 KB");
  assert.equal(formatSize(3 * 1048576), "3.0 MB");
});

test("only drafts that differ from their saved text are offered, newest first", () => {
  const d = [
    { key: "a", text: "same", saved: "same", t: 5 },
    { key: "b", text: "new", saved: "old", t: 1 },
    { key: "c", text: "newer", saved: "", t: 9 },
    { key: "d", text: "  ", saved: "", t: 7 },
    { key: "e", text: 5, saved: "", t: 8 },
  ];
  assert.deepEqual(draftsToOffer(d).map((x) => x.key), ["c", "b"]);
});

test("the closed-tab stack keeps the most recent ones", () => {
  let s = [];
  for (let i = 1; i <= 12; i++) s = pushClosed(s, i);
  assert.equal(s.length, LIMITS.closedTabs);
  assert.equal(s.at(-1), 12);
  assert.equal(s[0], 3);
});

test("closed tabs are also limited by the text they hold, oldest first, and the newest is always kept", () => {
  const tab = (name, chars) => ({ name, chars });
  let s = [];
  for (const t of [tab("a", 2_000_000), tab("b", 2_000_000), tab("c", 2_000_000)]) s = pushClosed(s, t);
  assert.deepEqual(s.map((t) => t.name), ["a", "b", "c"]);               // exactly at the budget
  s = pushClosed(s, tab("d", 1_000_000));
  assert.deepEqual(s.map((t) => t.name), ["b", "c", "d"]);
  s = pushClosed(s, tab("huge", 50_000_000));
  assert.deepEqual(s.map((t) => t.name), ["huge"]);                         // alone, though over the budget
  s = pushClosed(s, tab("small", 10));
  assert.deepEqual(s.map((t) => t.name), ["small"]);                        // the huge one goes first
  assert.deepEqual(pushClosed([], { name: "no size" }).map((t) => t.name), ["no size"]);
  const many = Array.from({ length: 10 }, (_, i) => tab("t" + i, 100_000));
  assert.equal(many.reduce((acc, t) => pushClosed(acc, t), []).length, 10);                    // ordinary notes: all ten kept
});
