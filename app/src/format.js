/**
 * Pure Markdown formatting operations used by the format panel. Each takes the text and the
 * selection and returns one replacement plus the new selection, so it can be unit-tested and
 * applied to the editor as a single edit.
 */

const LIST_MARK = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;
const BULLET = /^\s*[-*+] (?!\[[ xX]\] )/;
const TASK = /^\s*[-*+] \[[ xX]\] /;
const NUMBERED = /^\s*\d+[.)] /;

export const TABLE = "| Column | Column |\n| --- | --- |\n| Cell | Cell |";
export const RULE = "---";
export const CALLOUTS = ["note", "tip", "info", "warning", "danger", "question", "example", "quote"];

/** Wrap the selection in `m`; if it is already wrapped (inside or outside), unwrap it. */
export function wrap(src, s, e, m) {
  const str = String(src);
  const n = m.length;
  if (s >= n && e + n <= str.length && str.substring(s - n, s) === m && str.substring(e, e + n) === m) {
    return { start: s - n, end: e + n, text: str.substring(s, e), selStart: s - n, selEnd: e - n };
  }
  if (e - s >= 2 * n && str.substring(s, s + n) === m && str.substring(e - n, e) === m) {
    return { start: s, end: e, text: str.substring(s + n, e - n), selStart: s, selEnd: e - 2 * n };
  }
  // Nothing selected and the cursor is just before the closing mark of a style opened earlier on the line
  // ("**bold|**"): step out past it instead of starting a new pair.
  if (s === e && str.substring(s, s + n) === m && str[s + n] !== m[0]) {
    const lineStart = s === 0 ? 0 : str.lastIndexOf("\n", s - 1) + 1;
    if (str.substring(lineStart, s).includes(m)) {
      return { start: s, end: s, text: "", selStart: s + n, selEnd: s + n };
    }
  }
  const inner = str.substring(s, e);
  return { start: s, end: e, text: m + inner + m, selStart: s + n, selEnd: e + n };
}

/** `[selection](https://)` with the URL selected, or `[text](https://)` with "text" selected. */
export function link(src, s, e) {
  const str = String(src);
  if (s === e) return { start: s, end: e, text: "[text](https://)", selStart: s + 1, selEnd: s + 5 };
  const label = str.substring(s, e);
  const urlStart = s + label.length + 3;
  return { start: s, end: e, text: `[${label}](https://)`, selStart: urlStart, selEnd: urlStart + 8 };
}

/** Start and end of the full lines covered by the selection. */
export function lineRange(src, s, e) {
  const str = String(src);
  const start = s === 0 ? 0 : str.lastIndexOf("\n", s - 1) + 1;
  const nl = str.indexOf("\n", e);
  const end = nl < 0 ? str.length : nl;
  const pair = [start, end];
  pair.start = start;
  pair.end = end;
  return pair;
}

function mapLines(src, s, e, f) {
  const str = String(src);
  const [start, end] = lineRange(str, s, e);
  const next = f(str.substring(start, end).split("\n")).join("\n");
  return s === e
    ? { start, end, text: next, selStart: start + next.length, selEnd: start + next.length }
    : { start, end, text: next, selStart: start, selEnd: start + next.length };
}

/** Toggle a list marker on every selected line; swaps a different list marker in place. */
export function list(src, s, e, kind) {
  const k = String(kind).toLowerCase();
  const target = k === "numbered" ? NUMBERED : k === "task" ? TASK : BULLET;
  return mapLines(src, s, e, (lines) => {
    const content = lines.filter((it) => it.trim().length > 0);
    const remove = content.length > 0 && content.every((it) => target.test(it));
    let n = 0;
    return lines.map((line) => {
      if (line.trim().length === 0 && lines.length > 1) return line;
      const m = LIST_MARK.exec(line);
      const indent = m ? m[1] : (line.match(/^[ \t]*/)?.[0] ?? "");
      const body = m ? line.substring(m[0].length) : line.trimStart();
      if (remove) return indent + body;
      if (k === "numbered") return `${indent}${++n}. ${body}`;
      if (k === "task") return `${indent}- [ ] ${body}`;
      return `${indent}- ${body}`;
    });
  });
}

export function quote(src, s, e) {
  return mapLines(src, s, e, (lines) => {
    const content = lines.filter((it) => it.trim().length > 0);
    const remove = content.length > 0 && content.every((it) => it.trimStart().startsWith(">"));
    return lines.map((it) => (remove ? it.replace(/^(\s*)> ?/, "$1") : `> ${it}`));
  });
}

/** Set heading `level` (1–6) on the selected lines; 0 makes them normal text. */
export function heading(src, s, e, level) {
  return mapLines(src, s, e, (lines) =>
    lines.map((it) => {
      const body = it.replace(/^#{1,6}\s+/, "");
      return level === 0 ? body : `${"#".repeat(level)} ${body}`;
    }),
  );
}

/** Like heading(), but pressing the same level again turns the lines back into normal text. */
export function toggleHeading(src, s, e, level) {
  const [start, end] = lineRange(src, s, e);
  const lines = String(src).substring(start, end).split("\n").filter((it) => it.trim().length > 0);
  const same = level > 0 && lines.length > 0 && lines.every((it) => new RegExp(`^#{${level}} `).test(it));
  return heading(src, s, e, same ? 0 : level);
}

/**
 * Tab / Shift+Tab on a heading line: one level deeper (delta 1) or shallower (-1), keeping the cursor in place.
 * At the limit (6 or 1) nothing changes. Returns null when the cursor isn't on a single heading line.
 */
export function shiftHeading(src, s, e, delta) {
  const str = String(src);
  const [ls, le] = lineRange(str, s, e);
  if (str.substring(ls, le).includes("\n") || str.indexOf("\n", s) < e && str.indexOf("\n", s) >= 0) return null;
  const m = /^(#{1,6}) /.exec(str.substring(ls, le));
  if (!m) return null;
  const level = Math.max(1, Math.min(6, m[1].length + delta));
  const next = "#".repeat(level) + " ";
  const shift = next.length - (m[1].length + 1);
  const after = ls + m[1].length + 1;
  const move = (p) => (p >= after ? p + shift : ls + next.length);
  return { start: ls, end: after, text: next, selStart: move(s), selEnd: move(e) };
}

/**
 * Tab / Shift+Tab on list items: nest or un-nest by the width of the item's marker ("- " is 2, "1. " is 3), so the
 * result is a valid nested list. Returns null unless every non-empty selected line is a list item.
 */
export function indentList(src, s, e, dir) {
  const str = String(src);
  const [start, end] = lineRange(str, s, e);
  const lines = str.substring(start, end).split("\n");
  const content = lines.filter((it) => it.trim().length > 0);
  if (!content.length || !content.every((it) => LIST_MARK.test(it))) return null;
  const out = lines.map((line) => {
    if (!line.trim()) return line;
    const m = LIST_MARK.exec(line);
    const width = /\d/.test(m[0].trim()[0]) ? m[0].length - m[1].length : 2;
    if (dir > 0) return " ".repeat(width) + line;
    return line.substring(Math.min(width, line.length - line.trimStart().length));
  });
  const text = out.join("\n");
  const delta = text.length - (end - start);
  return s === e
    ? { start, end, text, selStart: Math.max(start, s + (out[0].length - lines[0].length)), selEnd: Math.max(start, e + (out[0].length - lines[0].length)) }
    : { start, end, text, selStart: start, selEnd: end + delta };
}

/**
 * Enter on an empty task item ("- [ ] ") ends the list, like Enter on an empty bullet. The editor's own handling
 * treats "[ ]" as content and starts another task. An indented empty item moves out one level instead.
 * Returns null unless the cursor is at the end of an empty task item.
 */
export function endEmptyTask(src, s, e) {
  const str = String(src);
  if (s !== e) return null;
  const [ls, le] = lineRange(str, s, e);
  const m = /^(\s*)[-*+] \[[ xX]\] ?$/.exec(str.substring(ls, le));
  if (!m || s !== le) return null;
  if (m[1].length > 0) return indentList(str, s, e, -1);
  return { start: ls, end: le, text: "", selStart: ls, selEnd: ls };
}

/** Insert `content` as its own block; selects `selFrom`..`selTo` inside it, or puts the cursor after it. */
export function block(src, s, e, content, selFrom = -1, selTo = -1) {
  const str = String(src);
  const before = s === 0 || str[s - 1] === "\n" ? "" : "\n";
  const after = e < str.length && str[e] !== "\n" ? "\n" : "";
  const base = s + before.length;
  return selFrom >= 0
    ? { start: s, end: e, text: before + content + after, selStart: base + selFrom, selEnd: base + selTo }
    : { start: s, end: e, text: before + content + after, selStart: base + content.length, selEnd: base + content.length };
}

export function codeBlock(src, s, e) {
  const inner = String(src).substring(s, e);
  return block(src, s, e, `\`\`\`\n${inner}\n\`\`\``, 4, 4 + inner.length);
}

/** Obsidian callout; the selection (if any) becomes its body and the title is selected. */
export function callout(src, s, e, type) {
  const title = type.length > 0 ? type[0].toUpperCase() + type.slice(1) : "";
  const raw = String(src).substring(s, e);
  const body = (raw.length === 0 ? "Text" : raw)
    .split(/\r?\n/)
    .map((it) => `> ${it}`)
    .join("\n");
  const head = `> [!${type}] `;
  return block(src, s, e, `${head}${title}\n${body}`, head.length, head.length + title.length);
}

export const MarkdownFormat = {
  wrap,
  link,
  lineRange,
  list,
  quote,
  heading,
  toggleHeading,
  shiftHeading,
  indentList,
  endEmptyTask,
  block,
  codeBlock,
  callout,
  TABLE,
  RULE,
  CALLOUTS,
};

export default MarkdownFormat;
