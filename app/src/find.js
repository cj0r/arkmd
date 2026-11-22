// Find and replace: matching logic with no DOM, shared by the editor and the reader (see find.test.js).

export const MAX_MATCHES = 10000;

/**
 * The regular expression for a search: { source, flags } or { error }.
 * `opts`: caseSensitive, wholeWord, regex. Plain searches are escaped, so every character means itself.
 */
export function buildPattern(query, opts = {}) {
  if (!query) return { empty: true };
  const word = !!opts.wholeWord;
  let source, flags;
  if (opts.regex) {
    source = word ? `\\b(?:${query})\\b` : query;
    flags = "gm";
  } else {
    const esc = query.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    source = word ? `(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])` : esc;
    flags = "gu";
  }
  if (!opts.caseSensitive) flags += "i";
  try { new RegExp(source, flags); } catch (e) { return { error: String(e.message || e).replace(/^Invalid regular expression:\s*/, "") }; }
  return { source, flags };
}

/** Every match in `text`: [{ from, to, groups }] (groups[0] is the whole match). Empty matches are skipped. */
export function findMatches(text, query, opts = {}) {
  const p = buildPattern(query, opts);
  if (p.empty || p.error) return { matches: [], error: p.error || null };
  const re = new RegExp(p.source, p.flags);
  const matches = [];
  let m;
  while ((m = re.exec(text)) && matches.length < MAX_MATCHES) {
    if (m[0] === "") { re.lastIndex++; continue; }
    matches.push({ from: m.index, to: m.index + m[0].length, groups: [...m] });
  }
  return { matches, error: null, truncated: matches.length >= MAX_MATCHES };
}

/** The text that replaces a match. A plain search inserts the replacement as typed; a regex one expands $1, $& and $$. */
export function expandReplacement(match, replacement, opts = {}) {
  if (!opts.regex) return replacement;
  return replacement.replace(/\$(\$|&|\d{1,2})/g, (all, k) => {
    if (k === "$") return "$";
    if (k === "&") return match.groups[0];
    const g = match.groups[Number(k)];
    return g === undefined ? (Number(k) < match.groups.length ? "" : all) : g;
  });
}

/** Replace every match: { text, count }. */
export function replaceAll(text, query, replacement, opts = {}) {
  const { matches } = findMatches(text, query, opts);
  let out = "", at = 0;
  for (const m of matches) { out += text.slice(at, m.from) + expandReplacement(m, replacement, opts); at = m.to; }
  return { text: out + text.slice(at), count: matches.length };
}

/** Index of the first match that starts at or after `pos`, wrapping to 0; -1 when there are none. */
export function nextIndex(matches, pos) {
  if (!matches.length) return -1;
  const i = matches.findIndex((m) => m.from >= pos);
  return i < 0 ? 0 : i;
}
