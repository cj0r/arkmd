import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { lineSeparatorFor, docText } from "./eol.js";

const open = (text) => {
  const sep = lineSeparatorFor(text);
  return EditorState.create({ doc: text, extensions: sep ? [EditorState.lineSeparator.of(sep)] : [] });
};

test("CRLF is detected only when every line ending is CRLF", () => {
  assert.equal(lineSeparatorFor("a\r\nb\r\n"), "\r\n");
  assert.equal(lineSeparatorFor("a\nb\n"), null);
  assert.equal(lineSeparatorFor("one line"), null);
  assert.equal(lineSeparatorFor(""), null);
  assert.equal(lineSeparatorFor("a\r\nb\nc"), null);     // mixed
  assert.equal(lineSeparatorFor("a\r\nb\rc"), null);     // stray CR
});

test("a CRLF file comes back as CRLF", () => {
  const text = "# Title\r\n\r\nSome text\r\n- item\r\n";
  assert.equal(docText(open(text)), text);
});

test("edits keep the file's CRLF endings", () => {
  const state = open("one\r\ntwo\r\n");
  const next = state.update({ changes: { from: 3, insert: "!" } }).state;
  assert.equal(docText(next), "one!\r\ntwo\r\n");
});

test("an LF file stays LF", () => {
  const text = "one\ntwo\n";
  assert.equal(docText(open(text)), text);
});

test("a file without a trailing newline keeps that", () => {
  assert.equal(docText(open("a\r\nb")), "a\r\nb");
});

import { withLineBreak } from "./eol.js";
test("withLineBreak converts inserted text to the document's line break", () => {
  assert.equal(withLineBreak("a\nb\n", "\r\n"), "a\r\nb\r\n");
  assert.equal(withLineBreak("a\r\nb", "\r\n"), "a\r\nb");
  assert.equal(withLineBreak("a\nb", "\n"), "a\nb");
});
