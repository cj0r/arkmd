import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLink, wikilinkTarget, slugify, imageType } from "./links.js";

test("web and mail links are external", () => {
  assert.deepEqual(parseLink("https://example.com/a?b#c"), { kind: "external", url: "https://example.com/a?b#c" });
  assert.equal(parseLink("mailto:a@b.c").kind, "external");
});

test("a fragment alone jumps within the page", () => {
  assert.deepEqual(parseLink("#My%20Heading"), { kind: "anchor", fragment: "My Heading" });
});

test("relative links point at files next to the document", () => {
  assert.deepEqual(parseLink("notes/other.md"), { kind: "file", path: "notes/other.md", fragment: "" });
  assert.deepEqual(parseLink("../a%20b.md#Some%20Part"), { kind: "file", path: "../a b.md", fragment: "Some Part" });
  assert.deepEqual(parseLink("dir\\file.md?x=1"), { kind: "file", path: "dir/file.md", fragment: "" });
});

test("other schemes and absolute paths are refused", () => {
  for (const h of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "/etc/passwd", "C:\\x.md", "\\\\server\\share", "//host/x", "", null]) assert.equal(parseLink(h), null, String(h));
});

test("wikilinks name a file and an optional heading", () => {
  assert.deepEqual(wikilinkTarget("Note"), { path: "Note.md", fragment: "" });
  assert.deepEqual(wikilinkTarget(" folder/Note#Part | alias "), { path: "folder/Note.md", fragment: "Part" });
  assert.deepEqual(wikilinkTarget("diagram.png"), { path: "diagram.png", fragment: "" });
  assert.equal(wikilinkTarget("  "), null);
});

test("slugify matches GitHub-style anchors", () => {
  assert.equal(slugify("H2: Lists & Task Checklists"), "h2-lists--task-checklists");
  assert.equal(slugify("  Été   d'or "), "été---dor");
});

test("imageType recognises image files", () => {
  assert.equal(imageType("a/b.PNG"), "image/png");
  assert.equal(imageType("x.svg"), "image/svg+xml");
  assert.equal(imageType("x.md"), null);
});
