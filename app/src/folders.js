// Added folders in the recent files flyout: list management (de-duplication, 20-folder cap), entry filtering and
// natural sorting, cross-platform path joining, visible tree-row flattening, keyboard navigation lookups, and
// expanded-state pruning/capping. Pure logic (see folders.test.js).

export const MAX_FOLDERS = 20;
export const MAX_EXPANDED = 200;
export const MARKDOWN_EXTS = ["md", "markdown", "mdown", "mkd", "txt"];

const MD_RE = new RegExp(`\\.(${MARKDOWN_EXTS.join("|")})$`, "i");
const naturalCompare = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Whether a file or folder name is hidden (starts with "."). */
export const isHiddenName = (name) => String(name ?? "").startsWith(".");

/** Whether a file name is a non-hidden Markdown file supported by ArkMD. */
export function isMarkdownFile(name) {
  const s = String(name ?? "");
  return !!s && !isHiddenName(s) && MD_RE.test(s);
}

/** Trim trailing path separators while keeping filesystem roots ("/", "C:\\", "C:/") intact. */
export function normalizeFolderPath(path) {
  if (typeof path !== "string" || !path) return "";
  if (/^[a-zA-Z]:[\\/]+$/.test(path)) return path.slice(0, 3);
  if (/^[\\/]+$/.test(path)) return path[0];
  return path.replace(/[\\/]+$/, "");
}

/** Display name for a folder path (its last segment, or the root itself). */
export function folderName(path) {
  const clean = normalizeFolderPath(path);
  if (!clean) return "";
  if (/^[a-zA-Z]:[\\/]$/.test(clean)) return clean;
  const parts = clean.split(/[\\/]/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : clean;
}

/** Canonical comparison key: Windows drive/UNC paths fold slashes and case; POSIX paths keep case. */
export function pathKey(path) {
  const clean = normalizeFolderPath(path);
  if (!clean) return "";
  if (/^[a-zA-Z]:/.test(clean) || clean.startsWith("\\\\")) {
    return clean.replace(/\//g, "\\").toLowerCase();
  }
  return clean;
}

/** Whether two folder paths refer to the same folder. */
export function samePath(a, b) {
  const ka = pathKey(a);
  return !!ka && ka === pathKey(b);
}

/** Sanitize stored folder entries, removing duplicates and enforcing the 20-folder limit. */
export function normalizeFolders(raw, limit = MAX_FOLDERS) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const clean = normalizeFolderPath(item?.path);
    if (!clean) continue;
    const key = pathKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    const name = typeof item?.name === "string" && item.name ? item.name : folderName(clean);
    out.push({ path: clean, name });
    if (out.length >= limit) break;
  }
  return out;
}

/** Add a folder path to the list. Duplicates do nothing; refuses additions past the limit. */
export function addFolder(list, path, limit = MAX_FOLDERS) {
  const clean = normalizeFolderPath(path);
  if (!clean) return { list, status: "invalid" };
  if (list.some((f) => samePath(f.path, clean))) return { list, status: "duplicate" };
  if (list.length >= limit) return { list, status: "limit" };
  return { list: [...list, { path: clean, name: folderName(clean) }], status: "added" };
}

/** Remove a folder from the list by path (nothing on disk is touched). */
export const removeFolder = (list, path) => list.filter((f) => !samePath(f.path, path));

/** Filter out hidden entries and non-Markdown files, then put subfolders first and files after,
 *  each group sorted case-insensitively with natural number order ("2" before "10"). */
export function sortEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const dirs = [];
  const files = [];
  for (const e of entries) {
    if (!e || typeof e.name !== "string" || !e.name || isHiddenName(e.name)) continue;
    if (e.is_dir) dirs.push({ name: e.name, is_dir: true });
    else if (isMarkdownFile(e.name)) files.push({ name: e.name, is_dir: false });
  }
  const byName = (a, b) => naturalCompare.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  dirs.sort(byName);
  files.sort(byName);
  return [...dirs, ...files];
}

/** Normalize a relative subfolder path inside an added root to "/"-separated segments.
 *  Returns null if the path is absolute, has a drive prefix, or contains "..". */
export function normalizeRel(rel) {
  const s = String(rel ?? "");
  if (!s) return "";
  if (s.startsWith("/") || s.startsWith("\\") || /^[a-zA-Z]:/.test(s)) return null;
  const parts = [];
  for (const seg of s.split(/[\\/]+/)) {
    if (!seg || seg === ".") continue;
    if (seg === "..") return null;
    parts.push(seg);
  }
  return parts.join("/");
}

/** Descend one folder level from `rel` into `segment`. Returns null for invalid segments. */
export function joinRel(rel, segment) {
  const seg = String(segment ?? "");
  if (!seg || seg === "." || seg === ".." || /[\\/]/.test(seg)) return null;
  const base = normalizeRel(rel);
  if (base === null) return null;
  return base ? `${base}/${seg}` : seg;
}

/** Join an added folder root, an optional relative subfolder path, and an optional file name,
 *  using the separator convention of `root` ("\\" on Windows-style paths, "/" otherwise). */
export function joinPath(root, rel = "", name = "") {
  const base = normalizeFolderPath(root);
  if (!base) return "";
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  const cleanRel = normalizeRel(rel);
  if (cleanRel === null) return null;
  const parts = cleanRel ? cleanRel.split("/") : [];
  if (name) {
    if (name === "." || name === ".." || /[\\/]/.test(name)) return null;
    parts.push(name);
  }
  if (!parts.length) return base;
  const prefix = base.endsWith(sep) ? base : base + sep;
  return prefix + parts.join(sep);
}

/** Stable key for a folder node in the tree ("<rootKey>|<rel>"). Returns null for invalid inputs. */
export function folderKey(rootPath, rel = "") {
  const rk = pathKey(rootPath);
  if (!rk) return null;
  const cleanRel = normalizeRel(rel);
  if (cleanRel === null) return null;
  return `${rk}|${cleanRel}`;
}

/** Sanitize, deduplicate, prune to current `folders`, and cap the list of expanded folder keys.
 *  When over `limit`, keeps the most recently expanded keys (the tail of the list). */
export function pruneExpanded(raw, folders, limit = MAX_EXPANDED) {
  if (!raw || !Array.isArray(folders) || !folders.length || limit <= 0) return [];
  const rootKeySet = new Set(folders.map((f) => pathKey(f?.path)).filter(Boolean));
  if (!rootKeySet.size) return [];
  const sortedRootKeys = [...rootKeySet].sort((a, b) => b.length - a.length);

  const matchRoot = (rawKey) => {
    for (const rk of sortedRootKeys) {
      if (rawKey === `${rk}|` || rawKey.startsWith(`${rk}|`)) {
        return { rk, rawRel: rawKey.slice(rk.length + 1) };
      }
    }
    const sep = rawKey.indexOf("|");
    if (sep <= 0) return null;
    const rk = pathKey(rawKey.slice(0, sep));
    if (!rootKeySet.has(rk)) return null;
    return { rk, rawRel: rawKey.slice(sep + 1) };
  };

  const ordered = new Set();
  for (const item of raw) {
    if (typeof item !== "string" || !item) continue;
    const m = matchRoot(item);
    if (!m) continue;
    const rel = normalizeRel(m.rawRel);
    if (rel === null) continue;
    const canon = `${m.rk}|${rel}`;
    // Refresh insertion order so deduplicated keys count as most recent when capping.
    ordered.delete(canon);
    ordered.add(canon);
  }
  const out = [...ordered];
  return out.length > limit ? out.slice(-limit) : out;
}

/** Return a new expanded-key array with `key` added (at the tail, capped at `limit`) or removed. */
export function setFolderExpanded(expanded, key, isExpanded, limit = MAX_EXPANDED) {
  if (!key) return Array.isArray(expanded) ? [...expanded] : [];
  const next = new Set(Array.isArray(expanded) ? expanded : []);
  next.delete(key);
  if (isExpanded) next.add(key);
  const out = [...next];
  return out.length > limit ? out.slice(-limit) : out;
}

/** Build the flat list of visible tree rows from added root folders, expanded folder keys, and
 *  in-memory loaded listings (`Map` or plain object keyed by `folderKey`). */
export function buildTreeRows(folders, expanded, loaded) {
  if (!Array.isArray(folders) || !folders.length) return [];
  const expandedSet = expanded instanceof Set ? expanded : new Set(expanded || []);
  const getLoaded = (k) => (loaded instanceof Map ? loaded.get(k) : loaded?.[k]);
  const rows = [];

  const pushChildren = (folder, rel, parentKey, level) => {
    const state = getLoaded(parentKey);
    if (!state || (state.loading && !Array.isArray(state.entries) && !state.error)) {
      rows.push({
        key: `msg:loading:${parentKey}`,
        kind: "message",
        messageKind: "loading",
        text: "Loading…",
        rootPath: folder.path,
        rel,
        level,
        parentKey,
      });
      return;
    }
    if (state.error) {
      rows.push({
        key: `msg:error:${parentKey}`,
        kind: "message",
        messageKind: "error",
        text: typeof state.error === "string" && state.error
          ? state.error
          : "This folder could not be opened. It may have been moved or removed.",
        rootPath: folder.path,
        rel,
        level,
        parentKey,
      });
      return;
    }
    const entries = sortEntries(state.entries);
    if (!entries.length) {
      rows.push({
        key: `msg:empty:${parentKey}`,
        kind: "message",
        messageKind: "empty",
        text: "No Markdown files or subfolders.",
        rootPath: folder.path,
        rel,
        level,
        parentKey,
      });
      return;
    }
    for (const entry of entries) {
      if (entry.is_dir) {
        const childRel = joinRel(rel, entry.name);
        if (childRel === null) continue;
        const childKey = folderKey(folder.path, childRel);
        if (!childKey) continue;
        const isExp = expandedSet.has(childKey);
        rows.push({
          key: childKey,
          kind: "folder",
          isRoot: false,
          rootPath: folder.path,
          rel: childRel,
          name: entry.name,
          path: joinPath(folder.path, childRel),
          level,
          parentKey,
          expanded: isExp,
        });
        if (isExp) pushChildren(folder, childRel, childKey, level + 1);
      } else {
        const fullPath = joinPath(folder.path, rel, entry.name);
        if (!fullPath) continue;
        rows.push({
          key: `file:${parentKey}/${entry.name}`,
          kind: "file",
          isRoot: false,
          rootPath: folder.path,
          rel,
          name: entry.name,
          path: fullPath,
          level,
          parentKey,
        });
      }
    }
    if (state.truncated) {
      rows.push({
        key: `msg:truncated:${parentKey}`,
        kind: "message",
        messageKind: "truncated",
        text: "Showing the first 5,000 items.",
        rootPath: folder.path,
        rel,
        level,
        parentKey,
      });
    }
  };

  for (const folder of folders) {
    const key = folderKey(folder?.path, "");
    if (!key) continue;
    const isExp = expandedSet.has(key);
    rows.push({
      key,
      kind: "folder",
      isRoot: true,
      rootPath: folder.path,
      rel: "",
      name: folder.name || folderName(folder.path),
      path: folder.path,
      level: 1,
      parentKey: null,
      expanded: isExp,
    });
    if (isExp) pushChildren(folder, "", key, 2);
  }
  return rows;
}

/** Index of the parent row of `rows[index]` for ArrowLeft navigation, or -1 for top-level rows. */
export function parentRowIndex(rows, index) {
  if (!Array.isArray(rows) || index < 0 || index >= rows.length) return -1;
  const parentKey = rows[index]?.parentKey;
  if (!parentKey) return -1;
  for (let i = index - 1; i >= 0; i--) {
    if (rows[i].key === parentKey) return i;
  }
  return -1;
}

/** Index of the first visible child row of `rows[index]` for ArrowRight navigation, or -1 if none. */
export function firstChildRowIndex(rows, index) {
  if (!Array.isArray(rows) || index < 0 || index >= rows.length - 1) return -1;
  const key = rows[index]?.key;
  if (!key) return -1;
  return rows[index + 1]?.parentKey === key ? index + 1 : -1;
}
