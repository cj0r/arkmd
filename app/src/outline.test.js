import { test } from "node:test";
import assert from "node:assert/strict";
import { outline, currentIndex, plainHeading } from "./outline.js";

const lv = (t) => outline(t).map((h) => `${h.level}:${h.text}`);

test("finds headings of every level", () => {
  assert.deepEqual(lv("# A\ntext\n## B\n### C\n###### F\n####### no\n#nospace"), ["1:A", "2:B", "3:C", "6:F"]);
});

test("skips front matter and fenced code", () => {
  assert.deepEqual(lv("---\ntitle: x\n# not\n---\n# Real\n```\n# code\n```\n~~~md\n# tilde\n~~~\n## After"), ["1:Real", "2:After"]);
  assert.deepEqual(lv("````\n```\n# inner\n````\n# Out"), ["1:Out"]);
});

test("reads closing hashes, empty headings and inline markup", () => {
  assert.deepEqual(lv("## Title ##\n#\n# **Bold** and `code` [link](http://x) [[Page|Alias]]"), ["2:Title", "1:", "1:Bold and code link Alias"]);
  assert.equal(plainHeading("snake_case_name"), "snake_case_name");
});

test("reads underlined headings but not rules, lists or tables", () => {
  assert.deepEqual(lv("Title\n=====\n\nSub\n---\n\n- item\n---\n\n***\n"), ["1:Title", "2:Sub"]);
});

test("records line numbers, also for CRLF text", () => {
  assert.deepEqual(outline("# A\r\nx\r\n## B").map((x) => x.line), [0, 2]);
  assert.deepEqual(outline("Title\n===").map((x) => x.line), [0]);
});

test("currentIndex picks the section holding a line", () => {
  const h = outline("intro\n# A\nx\n## B\ny");
  assert.equal(currentIndex(h, 0), -1);
  assert.equal(currentIndex(h, 2), 0);
  assert.equal(currentIndex(h, 4), 1);
  assert.equal(currentIndex([], 5), -1);
});

test("empty input has no outline", () => { assert.deepEqual(outline(""), []); assert.deepEqual(outline(undefined), []); });
