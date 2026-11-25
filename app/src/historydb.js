// IndexedDB storage for file versions and unsaved-work drafts. Works the same in the desktop webview and in
// Android's WebView, and stays on the device. Every call resolves to a harmless default when storage is
// unavailable, so history problems never get in the way of opening or saving a file.
import { LIMITS, byteLength, worthKeeping, planPrune, planTotalPrune } from "./history.js";

let dbPromise = null;
/** The open database. A failed open, a connection the browser closed, or another window upgrading the database all
 *  clear the cached promise, so the next call opens it again instead of history and drafts staying off for the session. */
function db() {
  if (!dbPromise) {
    const p = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
      const r = indexedDB.open("arkmd-history", 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore("versions", { keyPath: "id", autoIncrement: true }).createIndex("key", "key");
        d.createObjectStore("drafts", { keyPath: "key" });
      };
      r.onsuccess = () => {
        const d = r.result;
        d.onversionchange = () => { d.close(); if (dbPromise === p) dbPromise = null; };
        d.onclose = () => { if (dbPromise === p) dbPromise = null; };
        resolve(d);
      };
      r.onerror = () => reject(r.error);
    });
    p.catch(() => { if (dbPromise === p) dbPromise = null; });
    dbPromise = p;
  }
  return dbPromise;
}

/** Run `fn(store)` in a transaction; resolves with fn's request result (or its return value) once committed. */
async function run(storeName, mode, fn, fallback, retried = false) {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const tx = d.transaction(storeName, mode);
      const out = fn(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(out && "result" in out ? out.result : out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    // a connection that was closed under us: open it again once and repeat
    if (!retried && e?.name === "InvalidStateError") { dbPromise = null; return run(storeName, mode, fn, fallback, true); }
    return fallback;
  }
}

/** All records of a store (or of an index range), via a cursor, as an array. */
function collect(store, query, direction = "next", limit = Infinity) {
  const out = [];
  const req = (query ? store.index("key").openCursor(query, direction) : store.openCursor(null, direction));
  const done = { result: out };
  req.onsuccess = () => {
    const c = req.result;
    if (c && out.length < limit) { out.push(c.value); c.continue(); }
  };
  return done;
}

// ---------------------------------------------------------------- versions
/** Store `text` as a version of the file under `key`, unless it equals the newest one; then prune. */
export async function addVersion(key, name, text, now = Date.now()) {
  if (!key) return false;
  const newest = (await run("versions", "readonly", (s) => collect(s, IDBKeyRange.only(key), "prev", 1), []))[0];
  if (!worthKeeping(text, newest?.text)) return false;
  await run("versions", "readwrite", (s) => s.add({ key, name, text, t: now, size: byteLength(text) }));
  await prune(key, now);
  return true;
}

async function prune(key, now) {
  const mine = await versionsFor(key);
  const drop = planPrune(mine, now);
  const all = await run("versions", "readonly", (s) => collect(s), []);
  const rest = all.filter((v) => !drop.includes(v.id)).map(({ id, t, size }) => ({ id, t, size }));
  drop.push(...planTotalPrune(rest, LIMITS.totalBytes));
  if (drop.length) await run("versions", "readwrite", (s) => { for (const id of drop) s.delete(id); });
}

/** Versions of a file, newest first, without their text: [{ id, t, size, name }]. */
export async function versionsFor(key) {
  if (!key) return [];
  const rows = await run("versions", "readonly", (s) => collect(s, IDBKeyRange.only(key)), []);
  return rows.map(({ id, t, size, name }) => ({ id, t, size, name })).sort((a, b) => b.t - a.t);
}

/** A renamed file keeps its versions: they move to the new key. */
export async function moveVersions(oldKey, newKey, newName) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  const rows = await run("versions", "readonly", (s) => collect(s, IDBKeyRange.only(oldKey)), []);
  if (!rows.length) return;
  await run("versions", "readwrite", (s) => { for (const v of rows) s.put({ ...v, key: newKey, name: newName }); });
}

export async function getVersion(id) {
  return run("versions", "readonly", (s) => s.get(id), null);
}

export async function clearVersions() {
  await run("versions", "readwrite", (s) => s.clear());
}

export async function storageSummary() {
  const rows = await run("versions", "readonly", (s) => collect(s), []);
  return { versions: rows.length, files: new Set(rows.map((r) => r.key)).size, bytes: rows.reduce((n, r) => n + r.size, 0) };
}

// ---------------------------------------------------------------- drafts (unsaved work)
export const putDraft = (draft) => run("drafts", "readwrite", (s) => s.put(draft));
export const deleteDraft = (key) => run("drafts", "readwrite", (s) => s.delete(key));
export const allDrafts = () => run("drafts", "readonly", (s) => collect(s), []);
export const clearDrafts = () => run("drafts", "readwrite", (s) => s.clear());
