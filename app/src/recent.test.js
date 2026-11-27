import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, normalize, cleanRef, touch, mergeAliases, setPinned, rename, remove, folderOf, search, group, ago } from "./recent.js";

test("summarize takes the first heading as the title and the opening text as the preview", () => {
  const s = summarize("---\ntags: x\n---\n# Trip plan\n\nBook the **ferry** and [hotel](https://x.y).\n\n## Day one\n\n- [ ] Pack\n- Passports\n");
  assert.equal(s.title, "Trip plan");
  assert.equal(s.preview, "Book the ferry and hotel. · Pack · Passports");
  assert.ok(s.words >= 8);
});

test("summarize uses the first line when there is no heading, and skips code", () => {
  const s = summarize("Groceries for the week\n\n```\nnot this\n```\n\nmilk and eggs\n");
  assert.equal(s.title, "Groceries for the week");
  assert.equal(s.preview, "milk and eggs");
  assert.equal(summarize("# T\n\nfirst line\nsecond line\n\n- one\n- two\n").preview, "first line second line · one · two");
});

test("summarize copes with empty text and long lines", () => {
  assert.deepEqual(summarize(""), { title: "", preview: "", words: 0 });
  const s = summarize("# " + "a".repeat(200) + "\n\n" + "word ".repeat(100));
  assert.ok(s.title.length <= 90 && s.title.endsWith("…"));
  assert.ok(s.preview.length <= 160 && s.preview.endsWith("…"));
});

test("normalize reads older entry shapes and drops broken ones", () => {
  const list = normalize([{ path: "/a.md", name: "a.md", t: 5 }, { ref: "b", name: "b.md" }, { name: "x" }, null, { ref: "c", name: "c.md", pinned: 1, title: "T" }]);
  assert.deepEqual(list.map((r) => r.ref), ["/a.md", "b", "c"]);
  assert.equal(list[2].pinned, true);
  assert.equal(list[0].t, 5);
  assert.deepEqual(normalize("nope"), []);
});

test("touch moves a file to the front, keeping its pin and earlier preview", () => {
  let list = touch([], { ref: "a", name: "a.md", t: 1, title: "A", preview: "first" });
  list = touch(list, { ref: "b", name: "b.md", t: 2 });
  list = setPinned(list, "a", true);
  list = touch(list, { ref: "a", name: "a.md", t: 3 });
  assert.deepEqual(list.map((r) => r.ref), ["a", "b"]);
  assert.equal(list[0].pinned, true);
  assert.equal(list[0].preview, "first");
  assert.equal(list[0].t, 3);
  list = touch(list, { ref: "a", name: "a.md", t: 4, preview: "new text" });
  assert.equal(list[0].preview, "new text");
});

test("touch trims to the limit but never drops a pinned file", () => {
  let list = [];
  for (let i = 0; i < 6; i++) list = touch(list, { ref: `f${i}`, name: `f${i}.md`, t: i }, 3);
  assert.deepEqual(list.map((r) => r.ref), ["f5", "f4", "f3"]);
  list = setPinned(list, "f3", true);
  for (let i = 6; i < 9; i++) list = touch(list, { ref: `f${i}`, name: `f${i}.md`, t: i }, 3);
  assert.ok(list.some((r) => r.ref === "f3"));
  assert.equal(list.filter((r) => !r.pinned).length, 3);
});

test("remove drops a file", () => {
  assert.deepEqual(remove([{ ref: "a" }, { ref: "b" }], "a"), [{ ref: "b" }]);
});

test("folderOf shows the last two folders of a path or a content address", () => {
  assert.equal(folderOf("/Users/me/Documents/Notes/todo.md"), "Documents/Notes");
  assert.equal(folderOf("C:\\Users\\me\\Notes\\todo.md"), "me/Notes");
  assert.equal(folderOf("/todo.md"), "");
  assert.equal(folderOf("content://com.android.externalstorage.documents/document/primary%3ADocuments%2FNotes%2Ftodo.md"), "Documents/Notes");
  assert.equal(folderOf(""), "");
});

test("search needs every word to match the name, title, preview or folder", () => {
  const list = [
    { ref: "/x/Work/plan.md", name: "plan.md", title: "Quarterly plan", preview: "budget and hiring" },
    { ref: "/x/Home/list.md", name: "list.md", title: "Shopping", preview: "milk" },
  ];
  assert.deepEqual(search(list, "plan budget").map((r) => r.name), ["plan.md"]);
  assert.deepEqual(search(list, "WORK").map((r) => r.name), ["plan.md"]);
  assert.deepEqual(search(list, "milk hiring"), []);
  assert.equal(search(list, "  ").length, 2);
});

test("group puts pinned files first, then by how long ago", () => {
  const now = new Date(2026, 10, 23, 15, 0).getTime();
  const at = (d, h = 12) => new Date(2026, 10, d, h, 0).getTime();
  const list = [
    { ref: "p", pinned: true, t: at(1) }, { ref: "a", t: at(23, 9) }, { ref: "b", t: at(22) },
    { ref: "c", t: at(19) }, { ref: "d", t: at(5) }, { ref: "e", t: new Date(2026, 8, 1).getTime() },
  ];
  assert.deepEqual(group(list, now).map((g) => [g.label, g.items.map((r) => r.ref)]), [
    ["Pinned", ["p"]], ["Today", ["a"]], ["Yesterday", ["b"]], ["Previous 7 days", ["c"]], ["Previous 30 days", ["d"]], ["Older", ["e"]],
  ]);
  assert.deepEqual(group([], now), []);
});

test("ago gives a short relative time", () => {
  const now = new Date(2026, 10, 23, 15, 0, 0).getTime();
  assert.equal(ago(now - 20000, now), "just now");
  assert.equal(ago(now - 5 * 60000, now), "5 min ago");
  assert.equal(ago(now - 3 * 3600000, now), "3 h ago");
  assert.equal(ago(new Date(2026, 10, 22, 8, 0).getTime(), now), "Yesterday");
  assert.equal(ago(new Date(2026, 10, 19, 8, 0).getTime(), now), "4 days ago");
  assert.equal(ago(new Date(2026, 8, 3, 8, 0).getTime(), now), "Sep 3");
  assert.equal(ago(new Date(2025, 8, 3, 8, 0).getTime(), now), "Sep 3, 2025");
  assert.equal(ago(0, now), "");
});

import { isPinned, pinned } from "./recent.js";
test("isPinned and pinned look at the pin flag", () => {
  const list = setPinned([{ ref: "a" }, { ref: "b" }], "b", true);
  assert.equal(isPinned(list, "b"), true);
  assert.equal(isPinned(list, "a"), false);
  assert.equal(isPinned(list, "zzz"), false);
  assert.deepEqual(pinned(list).map((r) => r.ref), ["b"]);
});

import { displayName } from "./recent.js";
test("displayName prefers the title and drops a Markdown extension", () => {
  assert.equal(displayName({ title: "Trip to Bergen", name: "bergen-trip.md" }), "Trip to Bergen");
  assert.equal(displayName({ name: "groceries.md" }), "groceries");
  assert.equal(displayName({ name: "notes.txt" }), "notes");
  assert.equal(displayName({ name: "archive.tar" }), "archive.tar");
});

test("rename keeps the place, pin and preview of the entry", () => {
  const list = [{ ref: "/a/one.md", name: "one.md", pinned: true, preview: "x" }, { ref: "/a/two.md", name: "two.md" }];
  const out = rename(list, "/a/one.md", "/a/uno.md", "uno.md");
  assert.deepEqual(out.map((r) => r.ref), ["/a/uno.md", "/a/two.md"]);
  assert.equal(out[0].pinned, true);
  assert.equal(out[0].preview, "x");
  assert.equal(out[0].name, "uno.md");
});

test("rename onto an existing entry leaves one entry", () => {
  const list = [{ ref: "/a/one.md", name: "one.md" }, { ref: "/a/two.md", name: "two.md" }];
  assert.deepEqual(rename(list, "/a/one.md", "/a/two.md", "two.md").map((r) => r.ref), ["/a/two.md"]);
});

test("touch with aliases merges the same file reached under another address", () => {
  const a = { ref: "content://x/document/1", name: "Untitled2.md", t: 1, title: "Testing 2", preview: "two words", words: 2 };
  const b = { ref: "content://y/document/9", name: "Untitled2.md", t: 2, title: "Testing 2", preview: "two words", words: 2 };
  let list = touch([], a);
  assert.equal(touch(list, b).length, 2, "without aliases the two addresses stay two entries");
  list = touch(setPinned(list, a.ref, true), b, 50, true);
  assert.deepEqual(list.map((r) => r.ref), [b.ref]);
  assert.equal(list[0].pinned, true, "the pin of the merged entry is kept");
  const other = { ...b, ref: "content://y/document/10", title: "Different", preview: "other", words: 5 };
  assert.equal(touch(list, other, 50, true).length, 2, "a different text is a different file");
  const empty = { ref: "e1", name: "Untitled.md", t: 3, words: 0 };
  assert.equal(touch(touch([], empty, 50, true), { ...empty, ref: "e2" }, 50, true).length, 2, "files with no text are never merged");
});

test("mergeAliases cleans a stored list of same-file entries and leaves other lists alone", () => {
  const base = { name: "T.md", title: "T", preview: "p", words: 1, t: 1 };
  const list = [{ ...base, ref: "a" }, { ...base, ref: "b", pinned: true }, { ...base, name: "U.md", ref: "c" }];
  const merged = mergeAliases(list);
  assert.deepEqual(merged.map((r) => r.ref), ["a", "c"]);
  assert.equal(merged[0].pinned, true);
  const plain = [{ ...base, ref: "a" }, { ...base, name: "U.md", ref: "c" }];
  assert.equal(mergeAliases(plain), plain);
});

test("cleanRef removes the Windows verbatim prefix and leaves other addresses alone", () => {
  assert.equal(cleanRef("\\\\?\\C:\\Users\\me\\a.md"), "C:\\Users\\me\\a.md");
  assert.equal(cleanRef("\\\\?\\UNC\\server\\share\\a.md"), "\\\\server\\share\\a.md");
  for (const same of ["C:\\Users\\me\\a.md", "/data/me/a.md", "content://x/document/1", "", undefined]) assert.equal(cleanRef(same), same);
});

test("normalize merges a file stored with and without the verbatim prefix, keeping the newer entry, its pin and a preview", () => {
  const raw = [
    { ref: "C:\\r6\\c.md", name: "c.md", t: 5 },                                                  // newer, no preview
    { ref: "\\\\?\\C:\\r6\\c.md", name: "c.md", t: 4, title: "File c", preview: "some text c", words: 5, pinned: true },
    { ref: "C:\\r6\\d.md", name: "d.md", t: 3 },
  ];
  const list = normalize(raw);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((r) => r.ref), ["C:\\r6\\c.md", "C:\\r6\\d.md"]);
  assert.equal(list[0].t, 5);
  assert.equal(list[0].pinned, true);
  assert.equal(list[0].preview, "some text c");
  assert.equal(list[0].title, "File c");
});
