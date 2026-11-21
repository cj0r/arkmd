import { test } from "node:test";
import assert from "node:assert/strict";
import { createTabs } from "./tabs.js";

const names = (t) => t.all.map((x) => x.name);

test("add makes the new tab active and appends it", () => {
  const t = createTabs();
  const a = t.add({ name: "a.md", ref: "/a" });
  const b = t.add({ name: "b.md", ref: "/b" });
  assert.deepEqual(names(t), ["a.md", "b.md"]);
  assert.equal(t.active.id, b.id);
  assert.equal(t.count, 2);
  assert.notEqual(a.id, b.id);
});

test("findByRef finds an open file and ignores empty refs", () => {
  const t = createTabs();
  t.add({ name: "a.md", ref: "/a" });
  t.add({ name: "Untitled.md", ref: null });
  assert.equal(t.findByRef("/a").name, "a.md");
  assert.equal(t.findByRef("/nope"), null);
  assert.equal(t.findByRef(null), null);
});

test("closing the active tab activates its right neighbour", () => {
  const t = createTabs();
  const a = t.add({ name: "a" }); t.add({ name: "b" }); t.add({ name: "c" });
  t.activate(a.id);
  t.close(a.id);
  assert.equal(t.active.name, "b");
});

test("closing the last tab in the list activates the left neighbour", () => {
  const t = createTabs();
  t.add({ name: "a" }); t.add({ name: "b" });
  const c = t.add({ name: "c" });
  t.close(c.id);
  assert.equal(t.active.name, "b");
});

test("closing a background tab keeps the active tab", () => {
  const t = createTabs();
  const a = t.add({ name: "a" }); t.add({ name: "b" });
  const c = t.add({ name: "c" });
  t.close(a.id);
  assert.equal(t.active.id, c.id);
  assert.deepEqual(names(t), ["b", "c"]);
});

test("closing the only tab leaves no active tab", () => {
  const t = createTabs();
  const a = t.add({ name: "a" });
  t.close(a.id);
  assert.equal(t.active, null);
  assert.equal(t.count, 0);
});

test("closing an unknown id changes nothing", () => {
  const t = createTabs();
  t.add({ name: "a" });
  t.close(999);
  assert.deepEqual(names(t), ["a"]);
});

test("cycle wraps in both directions and is a no-op with one tab", () => {
  const t = createTabs();
  const a = t.add({ name: "a" });
  t.cycle(1);
  assert.equal(t.active.id, a.id);
  t.add({ name: "b" }); t.add({ name: "c" });
  assert.equal(t.cycle(1).name, "a");
  assert.equal(t.cycle(-1).name, "c");
  assert.equal(t.cycle(-1).name, "b");
});

test("activate ignores unknown ids", () => {
  const t = createTabs();
  const a = t.add({ name: "a" });
  t.add({ name: "b" });
  t.activate(a.id);
  t.activate(12345);
  assert.equal(t.active.name, "a");
});

test("untitledName numbers new documents and reuses freed names", () => {
  const t = createTabs();
  assert.equal(t.untitledName(), "Untitled.md");
  const first = t.add({ name: t.untitledName() });
  assert.equal(t.untitledName(), "Untitled 2.md");
  t.add({ name: t.untitledName() });
  assert.equal(t.untitledName(), "Untitled 3.md");
  t.close(first.id);
  assert.equal(t.untitledName(), "Untitled.md");
});

test("saved files named Untitled do not block the untitled counter", () => {
  const t = createTabs();
  t.add({ name: "Untitled.md", ref: "/docs/Untitled.md" });
  assert.equal(t.untitledName(), "Untitled.md");
});

test("dirty lists only tabs with unsaved changes", () => {
  const t = createTabs();
  t.add({ name: "a" }); const b = t.add({ name: "b" }); t.add({ name: "c" });
  b.dirty = true;
  assert.deepEqual(t.dirty().map((x) => x.name), ["b"]);
});

test("move reorders tabs and clamps the index", () => {
  const t = createTabs();
  const a = t.add({ name: "a" }); t.add({ name: "b" }); t.add({ name: "c" });
  t.move(a.id, 2);
  assert.deepEqual(names(t), ["b", "c", "a"]);
  t.move(a.id, -5);
  assert.deepEqual(names(t), ["a", "b", "c"]);
  t.move(a.id, 99);
  assert.deepEqual(names(t), ["b", "c", "a"]);
});

test("findSame matches the same name and loaded content under a different ref", () => {
  const t = createTabs();
  const a = t.add({ name: "notes.md", ref: "content://recent/1", saved: "hello" });
  assert.equal(t.findSame("notes.md", "hello").id, a.id);
  assert.equal(t.findSame("notes.md", "different"), null);   // another file with the same name
  assert.equal(t.findSame("other.md", "hello"), null);
});

test("findSame compares against the saved text, not unsaved edits", () => {
  const t = createTabs();
  const a = t.add({ name: "notes.md", ref: "x", saved: "on disk" });
  a.dirty = true;                                            // edited in the tab, disk unchanged
  assert.equal(t.findSame("notes.md", "on disk").id, a.id);
});
