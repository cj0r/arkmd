import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLink, wikilinkTarget, slugify, imageType, isRelativePath } from "./links.js";

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

test("absolute and network paths are refused after percent-decoding too", () => {
  for (const h of ["%5C%5Cserver%5Cshare%5Ca.png", "%2F%2Fserver%2Fshare%2Fa.png", "%2Fhome%2Fuser%2Fa.png", "%43%3A%5CUsers%5Ca.png", "%5Cserver%5Cshare%5Ca.png", "c%3A/a.png"]) assert.equal(parseLink(h), null, h);
  assert.deepEqual(parseLink("images/a%20b.png"), { kind: "file", path: "images/a b.png", fragment: "" });
  assert.deepEqual(parseLink("../shared/a.png"), { kind: "file", path: "../shared/a.png", fragment: "" });
  assert.equal(isRelativePath("a/b.md"), true);
  assert.equal(isRelativePath("//host/x.md"), false);
});

test("wikilinks to absolute or network paths are refused", () => {
  for (const t of ["//server/share/Note", "\\\\server\\share\\Note", "/etc/Note", "C:/Users/Note", "c:\\Note"]) assert.equal(wikilinkTarget(t), null, t);
  assert.deepEqual(wikilinkTarget("folder\\Note"), { path: "folder/Note.md", fragment: "" });
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
