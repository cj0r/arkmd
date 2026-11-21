// File history and unsaved-work recovery: the pure rules (what to keep, how to describe a version).
// Storage is in historydb.js. Everything here is unit-tested in history.test.js.

export const LIMITS = {
  perFile: 30,                       // versions kept for one file
  totalBytes: 50 * 1024 * 1024,      // across all files
  maxDocBytes: 2 * 1024 * 1024,      // larger documents are not versioned
  closedTabs: 10,                    // tabs that "Reopen closed tab" remembers
};
const DAY = 24 * 60 * 60 * 1000;

/** What a file's history is filed under: its reference (path or Android URI). Unsaved new files have none. */
export const fileKey = (ref) => (ref ? String(ref) : null);

export const byteLength = (text) => new TextEncoder().encode(String(text)).length;

/** Should this text be stored as a new version? Not if it's empty, too large, or equal to the newest one. */
export function worthKeeping(text, newestText) {
  if (typeof text !== "string" || text.length === 0) return false;
  if (byteLength(text) > LIMITS.maxDocBytes) return false;
  return text !== newestText;
}

/**
 * Which versions of one file to delete. Everything from the last 24 hours stays; older versions are thinned to
 * the newest one per 24-hour period; then the oldest go until at most `perFile` remain.
 * `versions` are { id, t } in any order.
 */
export function planPrune(versions, now, perFile = LIMITS.perFile) {
  const sorted = [...versions].sort((a, b) => b.t - a.t);
  const keep = [];
  const seenDays = new Set();
  for (const v of sorted) {
    const age = now - v.t;
    if (age < DAY) { keep.push(v); continue; }
    const day = Math.floor(age / DAY);
    if (!seenDays.has(day)) { seenDays.add(day); keep.push(v); }
  }
  const kept = new Set(keep.slice(0, perFile).map((v) => v.id));
  return sorted.filter((v) => !kept.has(v.id)).map((v) => v.id);
}

/** Which versions (across all files) to delete, oldest first, to get under the size cap. `entries` are { id, t, size }. */
export function planTotalPrune(entries, maxBytes = LIMITS.totalBytes) {
  let total = entries.reduce((n, e) => n + e.size, 0);
  const out = [];
  for (const e of [...entries].sort((a, b) => a.t - b.t)) {
    if (total <= maxBytes) break;
    out.push(e.id);
    total -= e.size;
  }
  return out;
}

/** Lines added and removed going from `oldText` to `newText` (a count of differing lines, not a real diff). */
export function lineDelta(oldText, newText) {
  const count = new Map();
  for (const l of String(oldText).split("\n")) count.set(l, (count.get(l) || 0) + 1);
  let added = 0;
  for (const l of String(newText).split("\n")) {
    const n = count.get(l) || 0;
    if (n > 0) count.set(l, n - 1); else added++;
  }
  let removed = 0;
  for (const n of count.values()) removed += n;
  return { added, removed };
}

const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today 14:32", "Yesterday 09:10", "Nov 18, 14:32" (or with the year when it isn't this year). */
export function formatWhen(t, now) {
  const d = new Date(t), n = new Date(now);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(n) - midnight(d)) / DAY);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}${d.getFullYear() === n.getFullYear() ? "" : ", " + d.getFullYear()}`;
  return `${date}, ${time}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Drafts worth offering after a restart: text that differs from the saved text, newest first. */
export function draftsToOffer(drafts) {
  return drafts
    .filter((d) => typeof d.text === "string" && d.text !== d.saved && (d.text.trim() || (d.saved || "").trim()))
    .sort((a, b) => b.t - a.t);
}

/** A closed tab to remember for "Reopen closed tab": keeps the stack within its limit, newest last. */
export function pushClosed(stack, tab, limit = LIMITS.closedTabs) {
  const next = [...stack, tab];
  return next.length > limit ? next.slice(next.length - limit) : next;
}
