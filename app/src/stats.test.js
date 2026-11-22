import { test } from "node:test";
import assert from "node:assert/strict";
import { stats, formatStats } from "./stats.js";

test("counts words, ignoring markup, front matter and link targets", () => {
  assert.equal(stats("# Title here\n\nOne **two** three.").words, 5);
  assert.equal(stats("---\ntitle: x y z\n---\nHello world").words, 2);
  assert.equal(stats("See [the docs](https://example.com/very/long) now").words, 4);
  assert.equal(stats("- [ ] one\n- [x] two\n1. three").words, 3);
  assert.equal(stats("```js\ncode here\n```").words, 2);
});

test("handles contractions, hyphens and other scripts", () => {
  assert.equal(stats("don't well-known état 日本語").words, 4);
});

test("counts characters without line breaks and estimates reading time", () => {
  assert.equal(stats("ab\r\ncd\n").characters, 4);
  assert.equal(stats("").minutes, 0);
  assert.equal(stats("word ".repeat(440)).minutes, 2);
  assert.equal(stats("one").minutes, 1);
});

test("formats the summary", () => {
  assert.equal(formatStats({ words: 1234, characters: 7890, minutes: 6 }), "1,234 words · 7,890 characters · 6 min read");
  assert.equal(formatStats({ words: 1, characters: 1, minutes: 1 }), "1 word · 1 character · 1 min read");
  assert.equal(formatStats(stats("")), "0 words · 0 characters");
});
