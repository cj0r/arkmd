import test from "node:test";
import assert from "node:assert/strict";
import { newFileName, fileNameProblem } from "./filename.js";

test("a name without an extension gets the old one", () => {
  assert.equal(newFileName("Notes", "plan.md"), "Notes.md");
  assert.equal(newFileName("  Notes  ", "plan.markdown"), "Notes.markdown");
  assert.equal(newFileName("Notes.txt", "plan.md"), "Notes.txt");
  assert.equal(newFileName("Notes", "plan"), "Notes");
  assert.equal(newFileName("", "plan.md"), "");
});

test("names that can't be files are explained", () => {
  for (const bad of ["", "  ", ".", "..", "a/b.md", "a\\b.md", "a:b.md", "a*.md", "a?.md", "tab\t.md", "end.", "end ", "CON.md", "nul", "lpt1.txt", "x".repeat(256)]) {
    assert.ok(fileNameProblem(bad), `should refuse ${JSON.stringify(bad)}`);
  }
});

test("ordinary names are accepted", () => {
  for (const ok of ["Notes.md", "my notes (2).md", "日本語.md", ".hidden.md", "a-b_c.markdown", "console.md"]) {
    assert.equal(fileNameProblem(ok), null, ok);
  }
});
