// Tab list model: pure logic with no DOM, so it can be unit-tested (tabs.test.js).
// A tab is { id, ref, name, saved, dirty, mode: "read" | "edit", state, scroll }; `state` is the editor
// state (text, undo history, cursor) kept while the tab is in the background.

export function createTabs() {
  const list = [];
  let activeId = null;
  let seq = 0;

  const api = {
    get all() { return list; },
    get count() { return list.length; },
    get active() { return list.find((t) => t.id === activeId) || null; },

    find(id) { return list.find((t) => t.id === id) || null; },
    findByRef(ref) { return ref ? list.find((t) => t.ref === ref) || null : null; },

    /**
     * A tab that is almost certainly the same file reached through a different reference: same name and the
     * same content as it had when loaded or last saved. Android's file picker returns different URIs for one
     * file depending on where you pick it from (Recent vs a folder), so the reference alone is not enough.
     */
    findSame(name, text) { return list.find((t) => t.name === name && t.saved === text) || null; },

    /** Add a tab at the end and make it active. */
    add(props = {}) {
      const tab = { id: ++seq, ref: null, name: "Untitled.md", saved: "", dirty: false, mode: "read", state: null, scroll: 0, ...props };
      list.push(tab);
      activeId = tab.id;
      return tab;
    },

    activate(id) {
      if (list.some((t) => t.id === id)) activeId = id;
      return api.active;
    },

    /** Remove a tab. If it was active, its right neighbour (else the left one) becomes active. */
    close(id) {
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) return api.active;
      const wasActive = id === activeId;
      list.splice(i, 1);
      if (wasActive) activeId = list.length ? list[Math.min(i, list.length - 1)].id : null;
      return api.active;
    },

    /** Activate the next (+1) or previous (-1) tab, wrapping around. */
    cycle(dir) {
      if (list.length < 2) return api.active;
      const i = list.findIndex((t) => t.id === activeId);
      activeId = list[(i + dir + list.length) % list.length].id;
      return api.active;
    },

    /** Move a tab to a new index (for drag-to-reorder). */
    move(id, to) {
      const i = list.findIndex((t) => t.id === id);
      if (i < 0) return;
      const [tab] = list.splice(i, 1);
      list.splice(Math.max(0, Math.min(to, list.length)), 0, tab);
    },

    /** "Untitled.md", then "Untitled 2.md", "Untitled 3.md"... skipping names already in use. */
    untitledName() {
      const used = new Set(list.filter((t) => !t.ref).map((t) => t.name));
      if (!used.has("Untitled.md")) return "Untitled.md";
      for (let n = 2; ; n++) {
        const name = `Untitled ${n}.md`;
        if (!used.has(name)) return name;
      }
    },

    dirty() { return list.filter((t) => t.dirty); },
  };
  return api;
}
