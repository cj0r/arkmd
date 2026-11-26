import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FOLDERS,
  MAX_EXPANDED,
  isHiddenName,
  isMarkdownFile,
  normalizeFolderPath,
  folderName,
  samePath,
  normalizeFolders,
  addFolder,
  removeFolder,
  sortEntries,
  normalizeRel,
  joinRel,
  joinPath,
  folderKey,
  pruneExpanded,
  setFolderExpanded,
  buildTreeRows,
  parentRowIndex,
  firstChildRowIndex,
} from "./folders.js";

test("isHiddenName and isMarkdownFile filter hidden files and non-Markdown extensions", () => {
  assert.equal(isHiddenName(".git"), true);
  assert.equal(isHiddenName(".hidden.md"), true);
  assert.equal(isHiddenName("notes.md"), false);

  for (const ok of ["a.md", "README.MD", "doc.markdown", "x.Mdown", "y.mkd", "todo.TXT", "a.b.md"]) {
    assert.equal(isMarkdownFile(ok), true, ok);
  }
  for (const bad of ["", null, "md", "notes.pdf", "image.png", "file.md.bak", ".secret.md"]) {
    assert.equal(isMarkdownFile(bad), false, String(bad));
  }
});

test("normalizeFolderPath and folderName handle POSIX, Windows, UNC and root paths", () => {
  assert.equal(normalizeFolderPath("/data/Notes/"), "/data/Notes");
  assert.equal(normalizeFolderPath("C:\\Users\\me\\Notes\\"), "C:\\Users\\me\\Notes");
  assert.equal(normalizeFolderPath("/"), "/");
  assert.equal(normalizeFolderPath("C:\\"), "C:\\");
  assert.equal(normalizeFolderPath("C:/"), "C:/");
  assert.equal(folderName("/data/Notes/"), "Notes");
  assert.equal(folderName("C:\\Users\\me\\Work Notes\\"), "Work Notes");
  assert.equal(folderName("/"), "/");
  assert.equal(folderName("C:\\"), "C:\\");
});

test("samePath de-duplicates trailing slashes and Windows path case/separators", () => {
  assert.equal(samePath("/home/Notes", "/home/Notes/"), true);
  assert.equal(samePath("/home/Notes", "/home/notes"), false);
  assert.equal(samePath("C:\\Users\\Notes\\", "c:/users/notes"), true);
  assert.equal(samePath("\\\\Server\\Share\\Docs\\", "\\\\server\\share\\docs"), true);
  assert.equal(samePath("", ""), false);
});

test("addFolder, removeFolder and normalizeFolders enforce deduplication and the 20-folder limit", () => {
  let list = [];
  let r = addFolder(list, "/docs/Notes/");
  assert.equal(r.status, "added");
  assert.deepEqual(r.list, [{ path: "/docs/Notes", name: "Notes" }]);
  list = r.list;

  // adding the same folder twice does nothing
  r = addFolder(list, "/docs/Notes");
  assert.equal(r.status, "duplicate");
  assert.deepEqual(r.list, list);

  // fill to MAX_FOLDERS (20)
  for (let i = 1; i < MAX_FOLDERS; i++) {
    r = addFolder(list, `/docs/folder-${i}`);
    assert.equal(r.status, "added");
    list = r.list;
  }
  assert.equal(list.length, 20);

  // 21st folder is refused
  r = addFolder(list, "/docs/folder-extra");
  assert.equal(r.status, "limit");
  assert.equal(r.list.length, 20);

  // removing forgets only that folder
  list = removeFolder(list, "/docs/Notes/");
  assert.equal(list.length, 19);
  assert.equal(list.some((f) => f.name === "Notes"), false);

  // normalizeFolders drops invalid/duplicate entries and caps at 20
  const raw = [null, { path: "" }, { path: "/a/" }, { path: "/a" }, ...Array.from({ length: 25 }, (_, i) => ({ path: `/f${i}` }))];
  const norm = normalizeFolders(raw);
  assert.equal(norm.length, 20);
  assert.deepEqual(norm[0], { path: "/a", name: "a" });
});

test("sortEntries puts subfolders first and Markdown files after, natural case-insensitive order, skipping hidden", () => {
  const entries = [
    { name: "note10.md", is_dir: false },
    { name: "note2.md", is_dir: false },
    { name: "Alpha.MD", is_dir: false },
    { name: "beta.txt", is_dir: false },
    { name: "photo.png", is_dir: false },
    { name: ".hidden.md", is_dir: false },
    { name: ".git", is_dir: true },
    { name: "Chapter 10", is_dir: true },
    { name: "chapter 2", is_dir: true },
    { name: "Archive", is_dir: true },
  ];
  assert.deepEqual(sortEntries(entries), [
    { name: "Archive", is_dir: true },
    { name: "chapter 2", is_dir: true },
    { name: "Chapter 10", is_dir: true },
    { name: "Alpha.MD", is_dir: false },
    { name: "beta.txt", is_dir: false },
    { name: "note2.md", is_dir: false },
    { name: "note10.md", is_dir: false },
  ]);
});

test("normalizeRel and joinRel handle POSIX/Windows separators and never escape the added root", () => {
  assert.equal(normalizeRel(""), "");
  assert.equal(normalizeRel("a/b"), "a/b");
  assert.equal(normalizeRel("a\\b\\c"), "a/b/c");
  assert.equal(normalizeRel("./a/./b"), "a/b");
  for (const bad of ["..", "a/../b", "/etc", "\\windows", "C:\\foo", "c:/bar"]) {
    assert.equal(normalizeRel(bad), null, bad);
  }

  assert.equal(joinRel("", "sub"), "sub");
  assert.equal(joinRel("sub", "deep"), "sub/deep");
  assert.equal(joinRel("sub\\nested", "deep"), "sub/nested/deep");
  assert.equal(joinRel("sub", ".."), null);
  assert.equal(joinRel("sub", "a/b"), null);
  assert.equal(joinRel("sub", "a\\b"), null);
});

test("joinPath preserves POSIX and Windows separators and rejects traversal", () => {
  assert.equal(joinPath("/data/Notes", "", "todo.md"), "/data/Notes/todo.md");
  assert.equal(joinPath("/data/Notes/", "2026/work", "plan.md"), "/data/Notes/2026/work/plan.md");
  assert.equal(joinPath("/", "etc", "note.md"), "/etc/note.md");
  assert.equal(joinPath("C:\\Users\\me\\Notes", "2026/work", "plan.md"), "C:\\Users\\me\\Notes\\2026\\work\\plan.md");
  assert.equal(joinPath("C:\\Users\\me\\Notes\\", "", "plan.md"), "C:\\Users\\me\\Notes\\plan.md");
  assert.equal(joinPath("C:\\", "sub", "plan.md"), "C:\\sub\\plan.md");
  assert.equal(joinPath("\\\\server\\share\\Notes", "sub", "a.md"), "\\\\server\\share\\Notes\\sub\\a.md");
  assert.equal(joinPath("/docs", "../escape", "a.md"), null);
  assert.equal(joinPath("/docs", "sub", "../a.md"), null);
});

test("folderKey, pruneExpanded and setFolderExpanded prune removed roots and cap at 200", () => {
  assert.equal(folderKey("/notes/", ""), "/notes|");
  assert.equal(folderKey("/notes", "sub\\deep"), "/notes|sub/deep");
  assert.equal(folderKey("C:\\Users\\Notes\\", "sub"), "c:\\users\\notes|sub");
  assert.equal(folderKey("/notes", "../bad"), null);
  assert.equal(folderKey("", "sub"), null);

  const folders = [
    { path: "/notes", name: "notes" },
    { path: "C:\\Users\\Work", name: "Work" },
  ];
  const pruned = pruneExpanded(
    [
      null,
      "",
      "no-pipe",
      "/notes|",
      "/notes|sub",
      "/notes|sub/../escape",
      "/removed|",
      "/removed|child",
      "C:/Users/Work/|a\\b",
      "/notes|sub",
    ],
    folders,
  );
  assert.deepEqual(pruned, ["/notes|", "c:\\users\\work|a/b", "/notes|sub"]);

  // Removing a root prunes both the root key and all of its descendant keys.
  const afterRemove = pruneExpanded(pruned, removeFolder(folders, "/notes"));
  assert.deepEqual(afterRemove, ["c:\\users\\work|a/b"]);

  // Capping at MAX_EXPANDED (200) keeps the most recently expanded keys.
  const many = Array.from({ length: MAX_EXPANDED + 25 }, (_, i) => `/notes|dir-${i}`);
  const capped = pruneExpanded(many, folders);
  assert.equal(capped.length, MAX_EXPANDED);
  assert.equal(capped[0], `/notes|dir-25`);
  assert.equal(capped.at(-1), `/notes|dir-${MAX_EXPANDED + 24}`);

  // setFolderExpanded toggles keys and respects the cap.
  let exp = setFolderExpanded(capped, "/notes|newest", true);
  assert.equal(exp.length, MAX_EXPANDED);
  assert.equal(exp.at(-1), "/notes|newest");
  assert.equal(exp[0], "/notes|dir-26");
  exp = setFolderExpanded(exp, "/notes|newest", false);
  assert.equal(exp.length, MAX_EXPANDED - 1);
  assert.equal(exp.includes("/notes|newest"), false);
});

test("buildTreeRows builds multi-level visible rows and handles loading, empty, error and truncated states", () => {
  const roots = [
    { path: "/notes", name: "notes" },
    { path: "/empty", name: "empty" },
    { path: "/broken", name: "broken" },
    { path: "/pending", name: "pending" },
  ];
  const expanded = new Set([
    folderKey("/notes", ""),
    folderKey("/notes", "sub"),
    folderKey("/notes", "collapsed/ignored"),
    folderKey("/empty", ""),
    folderKey("/broken", ""),
    folderKey("/pending", ""),
  ]);
  const loaded = new Map([
    [folderKey("/notes", ""), {
      entries: [
        { name: "readme.md", is_dir: false },
        { name: "sub", is_dir: true },
        { name: "collapsed", is_dir: true },
        { name: ".hidden.md", is_dir: false },
      ],
      truncated: true,
    }],
    [folderKey("/notes", "sub"), {
      entries: [{ name: "child.md", is_dir: false }],
      truncated: false,
    }],
    [folderKey("/notes", "collapsed"), {
      entries: [{ name: "ignored", is_dir: true }],
      truncated: false,
    }],
    [folderKey("/empty", ""), { entries: [], truncated: false }],
    [folderKey("/broken", ""), { error: "Could not read folder." }],
  ]);

  const rows = buildTreeRows(roots, expanded, loaded);
  assert.deepEqual(
    rows.map((r) => ({ kind: r.kind, level: r.level, label: r.name ?? r.text, parentKey: r.parentKey, messageKind: r.messageKind })),
    [
      { kind: "folder", level: 1, label: "notes", parentKey: null, messageKind: undefined },
      { kind: "folder", level: 2, label: "collapsed", parentKey: "/notes|", messageKind: undefined },
      { kind: "folder", level: 2, label: "sub", parentKey: "/notes|", messageKind: undefined },
      { kind: "file", level: 3, label: "child.md", parentKey: "/notes|sub", messageKind: undefined },
      { kind: "file", level: 2, label: "readme.md", parentKey: "/notes|", messageKind: undefined },
      { kind: "message", level: 2, label: "Showing the first 5,000 items.", parentKey: "/notes|", messageKind: "truncated" },
      { kind: "folder", level: 1, label: "empty", parentKey: null, messageKind: undefined },
      { kind: "message", level: 2, label: "No Markdown files or subfolders.", parentKey: "/empty|", messageKind: "empty" },
      { kind: "folder", level: 1, label: "broken", parentKey: null, messageKind: undefined },
      { kind: "message", level: 2, label: "Could not read folder.", parentKey: "/broken|", messageKind: "error" },
      { kind: "folder", level: 1, label: "pending", parentKey: null, messageKind: undefined },
      { kind: "message", level: 2, label: "Loading…", parentKey: "/pending|", messageKind: "loading" },
    ],
  );

  // Keeps old children visible while re-reading (loading: true with existing entries).
  loaded.set(folderKey("/notes", "sub"), { entries: [{ name: "child.md", is_dir: false }], loading: true, truncated: false });
  const duringRefresh = buildTreeRows([roots[0]], new Set([folderKey("/notes", ""), folderKey("/notes", "sub")]), loaded);
  assert.equal(duringRefresh.some((r) => r.kind === "file" && r.name === "child.md"), true);
  assert.equal(duringRefresh.some((r) => r.messageKind === "loading"), false);
});

test("parentRowIndex and firstChildRowIndex support ArrowLeft and ArrowRight navigation", () => {
  const roots = [{ path: "/notes", name: "notes" }];
  const expanded = new Set([folderKey("/notes", ""), folderKey("/notes", "sub")]);
  const loaded = {
    "/notes|": { entries: [{ name: "sub", is_dir: true }, { name: "leaf.md", is_dir: false }], truncated: false },
    "/notes|sub": { entries: [{ name: "child.md", is_dir: false }], truncated: false },
  };
  const rows = buildTreeRows(roots, expanded, loaded);
  // 0: notes (root), 1: sub, 2: child.md, 3: leaf.md
  assert.equal(rows.length, 4);

  assert.equal(parentRowIndex(rows, 0), -1);
  assert.equal(parentRowIndex(rows, 1), 0);
  assert.equal(parentRowIndex(rows, 2), 1);
  assert.equal(parentRowIndex(rows, 3), 0);

  assert.equal(firstChildRowIndex(rows, 0), 1);
  assert.equal(firstChildRowIndex(rows, 1), 2);
  assert.equal(firstChildRowIndex(rows, 2), -1);
  assert.equal(firstChildRowIndex(rows, 3), -1);
});

test("folderName reads the folder name out of an Android tree address", () => {
  assert.equal(folderName("content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FNotes"), "Notes");
  assert.equal(folderName("content://com.android.externalstorage.documents/tree/primary%3ANotes"), "Notes");
  assert.equal(folderName("content://com.android.externalstorage.documents/tree/1A2B-3C4D%3A"), "1A2B-3C4D");
  assert.equal(folderName("content://x/tree/%E0%A4%A"), "%E0%A4%A");   // an invalid escape keeps the raw text
});

test("file rows carry the document address the listing gave them", () => {
  const root = "content://com.android.externalstorage.documents/tree/primary%3ANotes";
  const ref = root + "/document/primary%3ANotes%2Fa.md";
  const folders = [{ path: root, name: "Notes" }];
  const key = folderKey(root, "");
  const rows = buildTreeRows(folders, [key], new Map([[key, {
    entries: [{ name: "a.md", is_dir: false, ref }, { name: "b.md", is_dir: false }],
  }]]));
  const files = rows.filter((r) => r.kind === "file");
  assert.equal(files[0].ref, ref);
  assert.equal(files[1].ref, null);          // desktop listings have no address: the path is used
});
