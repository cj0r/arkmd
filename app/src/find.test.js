import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPattern, findMatches, expandReplacement, replaceAll, nextIndex } from "./find.js";

const spans = (t, q, o) => findMatches(t, q, o).matches.map((m) => [m.from, m.to]);

test("plain search is literal and ignores case by default", () => {
  assert.deepEqual(spans("Foo foo FOO", "foo"), [[0, 3], [4, 7], [8, 11]]);
  assert.deepEqual(spans("a.b axb", "a.b"), [[0, 3]]);
  assert.deepEqual(spans("1+1=2 (x)", "1+1"), [[0, 3]]);
  assert.deepEqual(spans("Foo foo", "foo", { caseSensitive: true }), [[4, 7]]);
});

test("whole word matches only whole words", () => {
  assert.deepEqual(spans("cat concat cat.", "cat", { wholeWord: true }), [[0, 3], [11, 14]]);
  assert.deepEqual(spans("été été2", "été", { wholeWord: true }), [[0, 3]]);
});

test("regex search, with groups and line anchors", () => {
  assert.deepEqual(spans("a1 b22", "\\d+", { regex: true }), [[1, 2], [4, 6]]);
  assert.deepEqual(spans("x\ny\nx", "^x$", { regex: true }), [[0, 1], [4, 5]]);
  assert.deepEqual(spans("cat concat", "cat", { regex: true, wholeWord: true }), [[0, 3]]);
});

test("a bad regex reports an error instead of throwing", () => {
  const r = findMatches("abc", "(", { regex: true });
  assert.deepEqual(r.matches, []);
  assert.ok(r.error);
  assert.deepEqual(buildPattern("").empty, true);
});

test("empty matches are skipped and the count is capped", () => {
  assert.deepEqual(spans("abc", "x*", { regex: true }), []);
  const r = findMatches("a".repeat(20000), "a");
  assert.equal(r.matches.length, 10000);
  assert.equal(r.truncated, true);
});

test("replacement expands groups only in regex mode", () => {
  const m = findMatches("John Smith", "(\\w+) (\\w+)", { regex: true }).matches[0];
  assert.equal(expandReplacement(m, "$2, $1 [$&] $$ $9", { regex: true }), "Smith, John [John Smith] $ $9");
  assert.equal(expandReplacement(m, "$2, $1", {}), "$2, $1");
});

test("replaceAll replaces every match and counts them", () => {
  assert.deepEqual(replaceAll("a b a", "a", "xy"), { text: "xy b xy", count: 2 });
  assert.deepEqual(replaceAll("a-1 b-22", "(\\w)-(\\d+)", "$2$1", { regex: true }), { text: "1a 22b", count: 2 });
  assert.deepEqual(replaceAll("none", "zzz", "q"), { text: "none", count: 0 });
  assert.deepEqual(replaceAll("aaa", "a", ""), { text: "", count: 3 });
});

test("nextIndex finds the first match from a position and wraps", () => {
  const ms = [{ from: 2 }, { from: 10 }];
  assert.equal(nextIndex(ms, 0), 0);
  assert.equal(nextIndex(ms, 3), 1);
  assert.equal(nextIndex(ms, 11), 0);
  assert.equal(nextIndex([], 5), -1);
});

test("plain search copes with punctuation", () => {
  assert.deepEqual(spans("a-b a/b [x] \\", "a-b"), [[0, 3]]);
  assert.deepEqual(spans("a/b [x] \\", "a/b"), [[0, 3]]);
  assert.deepEqual(spans("a/b [x] \\", "[x]"), [[4, 7]]);
  assert.deepEqual(spans("a/b [x] \\", "\\"), [[8, 9]]);
});
