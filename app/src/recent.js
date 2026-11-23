// The recent files list: what is remembered about each file (title, a preview, when it was last opened), and how it is
// ordered, pinned, searched and grouped for the Recent files flyout. Pure logic (see recent.test.js).
import { outline, plainHeading } from "./outline.js";
import { stats } from "./stats.js";

export const LIMIT = 200;          // files remembered, not counting pinned ones
const DAY = 24 * 60 * 60 * 1000;

/** One line of Markdown as plain text: list, quote and heading markers, links and emphasis removed. */
function plain(line) {
  return String(line)
    .replace(/^\s*(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)+/, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/[`*~=]+/g, "")
    .replace(/(^|\s)_+|_+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** { title, preview, words } for a document: the first heading (or first line) as the title, then the opening text. */
export function summarize(text) {
  const src = String(text ?? "").replace(/^\uFEFF/, "");
  const lines = src.split(/\r\n|\r|\n/);
  let i = 0;
  if (lines[0] === "---") {
    const end = lines.findIndex((l, n) => n > 0 && l === "---");
    if (end > 0) i = end + 1;
  }
  const first = outline(src)[0];
  let title = first ? plainHeading(first.text) : "";
  const body = [];
  let fence = null, length = 0, newBlock = true;
  for (; i < lines.length && length < 240; i++) {
    const line = lines[i];
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) { if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null; continue; }
    if (f) { fence = f[1]; continue; }
    if (!line.trim() || /^ {0,3}#{1,6}([ \t]|$)/.test(line) || /^ {0,3}(=+|-+)[ \t]*$/.test(line)) { newBlock = true; continue; }
    const text1 = plain(line);
    if (!text1) continue;
    if (!title) { title = text1; continue; }              // no heading: the first line is the title
    if (first && line === lines[first.line]) continue;
    body.push({ text: text1, split: newBlock || /^\s*(?:[-*+]|\d+[.)])[ \t]/.test(line) });
    newBlock = false;
    length += text1.length + 3;
  }
  return { title: clip(title, 90), preview: clip(body.map((b, k) => (k ? (b.split ? " · " : " ") : "") + b.text).join(""), 160), words: stats(src).words };
}

/** Entries from storage, with the older { path, name } and { ref, name, t } shapes filled in. */
export function normalize(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      ref: r?.ref ?? r?.path, name: r?.name, t: Number(r?.t) || 0, title: r?.title || "", preview: r?.preview || "",
      words: Number(r?.words) || 0, pinned: !!r?.pinned,
    }))
    .filter((r) => typeof r.ref === "string" && r.ref && typeof r.name === "string");
}

/** The list with `entry` moved to the front. Pin state and an earlier preview are kept unless the entry brings new ones. */
export function touch(list, entry, limit = LIMIT) {
  const old = list.find((r) => r.ref === entry.ref);
  const merged = { title: "", preview: "", words: 0, pinned: false, ...old };
  for (const [k, v] of Object.entries(entry)) if (v !== undefined && v !== null) merged[k] = v;
  let others = 0;
  return [merged, ...list.filter((r) => r.ref !== entry.ref)].filter((r) => r.pinned || ++others <= limit);
}

export const setPinned = (list, ref, pinned) => list.map((r) => (r.ref === ref ? { ...r, pinned: !!pinned } : r));
/** Whether the file is pinned. */
export const isPinned = (list, ref) => !!list.find((r) => r.ref === ref)?.pinned;
export const pinned = (list) => list.filter((r) => r.pinned);
/** The list with the entry for `ref` pointing at the renamed file; its place, pin and preview stay. */
export const rename = (list, ref, newRef, newName) =>
  list.filter((r) => r.ref !== newRef || r.ref === ref).map((r) => (r.ref === ref ? { ...r, ref: newRef, name: newName } : r));
export const remove = (list, ref) => list.filter((r) => r.ref !== ref);

/** The folder a file is in, as the last two folder names ("Documents/Notes"); "" when it can't be told. */
export function folderOf(ref) {
  let s = String(ref ?? "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {            // content:// or file:// address: use the part after the last "/document/"
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
    try { s = decodeURIComponent(s); } catch { /* keep as is */ }
    s = s.replace(/^.*\/document\//, "").replace(/^[^:/]*:/, "");
  }
  const parts = s.split(/[\\/]/).filter(Boolean);
  parts.pop();
  return parts.slice(-2).join("/");
}

/** The entries that match every word of `query` in the name, title, preview or folder. */
export function search(list, query) {
  const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((r) => {
    const hay = `${r.name}\n${r.title}\n${r.preview}\n${folderOf(r.ref)}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** [{ label, items }]: Pinned first, then by when the file was last opened. Empty groups are left out. */
export function group(list, now = Date.now()) {
  const midnight = (x) => { const d = new Date(x); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const today = midnight(now);
  const groups = [["Pinned", []], ["Today", []], ["Yesterday", []], ["Previous 7 days", []], ["Previous 30 days", []], ["Older", []]];
  for (const r of list) {
    if (r.pinned) { groups[0][1].push(r); continue; }
    const days = Math.round((today - midnight(r.t)) / DAY);
    groups[days <= 0 ? 1 : days === 1 ? 2 : days <= 7 ? 3 : days <= 30 ? 4 : 5][1].push(r);
  }
  return groups.filter(([, items]) => items.length).map(([label, items]) => ({ label, items }));
}

/** "just now", "5 min ago", "3 h ago", "Yesterday", "3 days ago" or a date. */
export function ago(t, now = Date.now()) {
  if (!t) return "";
  const diff = now - t;
  if (diff < 60 * 1000) return "just now";
  if (diff < 3600 * 1000) return `${Math.floor(diff / 60000)} min ago`;
  const midnight = (x) => { const d = new Date(x); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const days = Math.round((midnight(now) - midnight(t)) / DAY);
  if (days === 0) return `${Math.floor(diff / 3600000)} h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const d = new Date(t), n = new Date(now);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}${d.getFullYear() === n.getFullYear() ? "" : ", " + d.getFullYear()}`;
}

/** The name shown for a recent file: its title (first heading) when it has one, otherwise the file name without its extension. */
export function displayName(entry) {
  return entry.title || String(entry.name ?? "").replace(/\.(md|markdown|mdown|mkd|txt)$/i, "");
}
