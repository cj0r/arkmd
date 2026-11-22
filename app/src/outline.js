// The document outline: the headings of a Markdown text, for the Outline flyout. Pure logic (see outline.test.js).
// Fenced code and front matter are skipped; both "# Title" and underlined (setext) headings count.

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const NOT_PARAGRAPH = /^ {0,3}(#|>|[-*+][ \t]|\d+[.)][ \t]|\||```|~~~|<)/;

/** Heading text without the inline markup that makes no sense in a list. */
export function plainHeading(s) {
  return String(s ?? "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[`*~=]+/g, "")
    .replace(/(^|\s)_+|_+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** [{ level 1-6, text, line (0-based) }] in document order. */
export function outline(text) {
  const lines = String(text ?? "").split(/\r\n|\r|\n/);
  const out = [];
  let i = 0;
  if (lines[0] === "---") {                       // front matter
    const end = lines.findIndex((l, n) => n > 0 && l === "---");
    if (end > 0) i = end + 1;
  }
  let fence = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && /^[ \t]*$/.test(line.slice(f[0].length))) fence = null;
      continue;
    }
    if (f) { fence = f[1]; continue; }
    const a = ATX.exec(line);
    if (a) { out.push({ level: a[1].length, text: plainHeading(a[2]), line: i }); continue; }
    const u = UNDERLINE.exec(line);
    const prev = lines[i - 1];
    if (u && i > 0 && prev.trim() && !NOT_PARAGRAPH.test(prev) && !UNDERLINE.test(prev) && !(out.length && out[out.length - 1].line === i - 1)) {
      out.push({ level: u[1][0] === "=" ? 1 : 2, text: plainHeading(prev), line: i - 1 });
    }
  }
  return out;
}

/** Index of the heading a line belongs to (the last one at or before `line`), or -1. */
export function currentIndex(items, line) {
  let at = -1;
  for (let i = 0; i < items.length; i++) { if (items[i].line <= line) at = i; else break; }
  return at;
}
