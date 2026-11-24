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

const indentOf = (line) => line.length - line.trimStart().length;
/** Width of a list item's marker as nesting needs it: "1. " is 3, "10. " is 4, "- " and "- [ ] " are 2. */
function markerWidth(line) {
  const m = LIST_MARK.exec(line);
  if (!m) return 2;
  return /\d/.test(m[0].trim()[0]) ? m[0].length - m[1].length : 2;
}

/**
 * Tab / Shift+Tab on list items: move the item one level in or out. Nesting indents by the width of the marker of the
 * item above it at the same level ("1. " is 3, "- " is 2), so the result is a valid nested list; moving out lines the
 * item up with its parent's siblings. Numbered lists are then renumbered: a nested list starts at 1 and an item moved
 * out continues the outer list. Returns null unless every non-empty selected line is a list item.
 */
export function indentList(src, s, e, dir) {
  const str = String(src);
  const [start, end] = lineRange(str, s, e);
  const lines = str.substring(start, end).split("\n");
  const content = lines.filter((it) => it.trim().length > 0);
  if (!content.length || !content.every((it) => LIST_MARK.test(it))) return null;
  const above = str.substring(0, start).split("\n");
  above.pop();                                                    // the text before the first selected line, line by line
  const firstIndent = indentOf(content[0]);
  let width = markerWidth(content[0]);
  if (dir > 0) {
    for (let i = above.length - 1; i >= 0; i--) {
      const l = above[i];
      if (!l.trim()) continue;
      const ind = indentOf(l);
      if (ind > firstIndent) continue;
      if (ind === firstIndent && LIST_MARK.test(l)) width = markerWidth(l);
      break;
    }
  } else {
    let target = 0;
    for (let i = above.length - 1; i >= 0; i--) {
      const l = above[i];
      if (l.trim() && indentOf(l) < firstIndent && LIST_MARK.test(l)) { target = indentOf(l); break; }
    }
    width = firstIndent - target;
  }
  const out = lines.map((line) => {
    if (!line.trim()) return line;
    return dir > 0 ? " ".repeat(width) + line : line.substring(Math.min(width, indentOf(line)));
  });
  const text = out.join("\n");
  const delta = text.length - (end - start);
  const first = out[0].length - lines[0].length;
  let edit = s === e
    ? { start, end, text, selStart: Math.max(start, s + first), selEnd: Math.max(start, e + first) }
    : { start, end, text, selStart: start, selEnd: end + delta };
  // Renumber the numbered lists touched by the move.
  const full = str.slice(0, start) + text + str.slice(end);
  const firstLine = str.slice(0, start).split("\n").length - 1;
  const idx = [];
  for (let i = firstLine - 1; i <= firstLine + lines.length; i++) idx.push(i);
  const fixes = renumber(full, idx, true);        // after a move, also a list numbered 1. 1. is put in order
  if (!fixes.length) return edit;
  let fixed = full;
  for (const x of [...fixes].reverse()) fixed = fixed.slice(0, x.from) + x.text + fixed.slice(x.to);
  const shift = (p) => p + fixes.reduce((n, x) => (x.from < p ? n + x.text.length - (x.to - x.from) : n), 0);
  const selStart = shift(edit.selStart), selEnd = shift(edit.selEnd);
  let from = 0;
  while (from < str.length && from < fixed.length && str[from] === fixed[from]) from++;
  let tail = 0;
  while (tail < str.length - from && tail < fixed.length - from && str[str.length - 1 - tail] === fixed[fixed.length - 1 - tail]) tail++;
  return { start: from, end: str.length - tail, text: fixed.slice(from, fixed.length - tail), selStart, selEnd };
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

/**
 * The callout header line the range sits in, if any: the quote block ("> ...") around `s`..`e` whose first line is
 * "> [!type]". Returns { from, to, indent, type, fold, rest } for that first line, or null.
 */
function calloutAt(str, s, e) {
  const lines = str.split("\n");
  let pos = 0, at = -1, from = 0;
  const starts = [];
  for (let i = 0; i < lines.length; i++) { starts.push(pos); pos += lines[i].length + 1; }
  const lineOf = (p) => { let i = 0; while (i + 1 < lines.length && starts[i + 1] <= p) i++; return i; };
  const a = lineOf(s), b = lineOf(Math.max(s, e - (e > s && str[e - 1] === "\n" ? 1 : 0)));
  const quoted = (i) => /^\s*>/.test(lines[i]);
  if (!quoted(a)) return null;
  let top = a;
  while (top > 0 && quoted(top - 1)) top--;
  for (let i = a; i <= b; i++) if (!quoted(i)) return null;
  const m = /^(\s*>\s*)\[!([A-Za-z-]+)\]([+-]?)(.*)$/.exec(lines[top]);
  if (!m) return null;
  at = top; from = starts[at];
  return { from, to: from + lines[at].length, indent: m[1], type: m[2], fold: m[3], rest: m[4] };
}

/**
 * Obsidian callout. With the cursor or selection inside an existing callout, the callout changes type in place (and its
 * title with it when the title is still the old type's default); otherwise a new callout wraps the selection (if any)
 * and the title is selected.
 */
export function callout(src, s, e, type) {
  const str = String(src);
  const found = calloutAt(str, s, e);
  if (found) {
    const cap = (t) => (t.length ? t[0].toUpperCase() + t.slice(1) : "");
    const title = found.rest.trim();
    const restNew = title === "" || title.toLowerCase() === found.type.toLowerCase() ? ` ${cap(type)}` : found.rest;
    const text = `${found.indent}[!${type}]${found.fold}${restNew}`;
    const shift = text.length - (found.to - found.from);
    const mv = (p) => (p <= found.to ? Math.min(p, found.from + text.length) : p + shift);
    return { start: found.from, end: found.to, text, selStart: mv(s), selEnd: mv(e) };
  }
  const title = type.length > 0 ? type[0].toUpperCase() + type.slice(1) : "";
  const raw = str.substring(s, e);
  const body = (raw.length === 0 ? "Text" : raw)
    .split(/\r?\n/)
    .map((it) => `> ${it}`)
    .join("\n");
  const head = `> [!${type}] `;
  return block(src, s, e, `${head}${title}\n${body}`, head.length, head.length + title.length);
}

const NUMBERED_ITEM = /^(\s*)(\d+)([.)])( .*|)$/;

/**
 * Renumber numbered lists after an edit. `lines` are indexes of lines that were just edited or joined (the new text
 * `src`). For each, the list around it (items at the same indent, nested lines and single blank lines between them)
 * is renumbered 1, 2, 3 … from its first number. Lists whose items all carry the same number ("1." everywhere) are left
 * alone unless `force`. Returns edits [{ from, to, text }] over `src`, in ascending order, or [].
 */
export function renumber(src, lineIdx, force = false) {
  const lines = String(src).split("\n");
  const starts = [];
  let pos = 0;
  for (const l of lines) { starts.push(pos); pos += l.length + 1; }
  const edits = new Map();
  const done = new Set();
  for (const idx of lineIdx) {
    if (idx < 0 || idx >= lines.length) continue;
    const m0 = NUMBERED_ITEM.exec(lines[idx]);
    if (!m0) continue;
    const indent = m0[1].length;
    const items = [];
    const walk = (dir) => {
      let i = idx, blank = 0;
      for (i = idx + dir; i >= 0 && i < lines.length; i += dir) {
        const l = lines[i];
        if (l.trim() === "") { if (++blank > 1) break; continue; }
        blank = 0;
        const m = NUMBERED_ITEM.exec(l);
        const ind = l.length - l.trimStart().length;
        if (m && m[1].length === indent) items.push(i);
        else if (ind <= indent) break;
      }
    };
    items.push(idx); walk(-1); walk(1);
    items.sort((a, b) => a - b);
    if (done.has(items[0])) continue;
    let nested = false;                                       // a list inside a list item starts at 1
    for (let i = items[0] - 1; i >= 0; i--) {
      if (!lines[i].trim()) continue;
      nested = /^\s*(?:[-*+] |\d+[.)] )/.test(lines[i]) && lines[i].length - lines[i].trimStart().length < indent;
      break;
    }
    if (items.length < 2 && !nested) continue;
    done.add(items[0]);
    const nums = items.map((i) => Number(NUMBERED_ITEM.exec(lines[i])[2]));
    if (!force && nums.every((n) => n === nums[0]) && !(nested && nums[0] !== 1)) continue;
    const first = nested ? 1 : nums[0];
    items.forEach((i, k) => {
      const m = NUMBERED_ITEM.exec(lines[i]);
      if (Number(m[2]) === first + k) return;
      const from = starts[i] + m[1].length;
      edits.set(from, { from, to: from + m[2].length, text: String(first + k) });
    });
  }
  return [...edits.values()].sort((a, b) => a.from - b.from);
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*(?::?-+:?\s*)?$/;

/** The cells of a table row: [{ from, to, pipe }] with `from`/`to` bounding the cell's text within the line. */
function tableCells(line) {
  const pipes = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\") i++;
    else if (line[i] === "|") pipes.push(i);
  }
  const cells = [];
  for (let k = 0; k + 1 < pipes.length; k++) {
    const raw = line.substring(pipes[k] + 1, pipes[k + 1]);
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    const from = pipes[k] + 1 + (body ? lead : Math.min(1, raw.length));
    cells.push({ left: pipes[k] + 1, right: pipes[k + 1], from, to: from + body.length });
  }
  return cells;
}

/**
 * Tab / Shift+Tab inside a table: move to the next or previous cell and select its text. Tab in the last cell of
 * the last row adds a new row. Separator rows (| --- |) are skipped. Returns null outside a table, and for
 * Shift+Tab in the very first cell, so the editor's own handling applies.
 */
export function tableTab(src, s, e, dir) {
  const str = String(src);
  const lines = str.split("\n");
  let offset = 0, at = 0;
  const starts = lines.map((l) => { const o = offset; offset += l.length + 1; return o; });
  while (at + 1 < lines.length && starts[at + 1] <= s) at++;
  if (!TABLE_ROW.test(lines[at])) return null;
  const cells = tableCells(lines[at]);
  if (!cells.length) return null;
  const col = s - starts[at];
  let c = cells.findIndex((cell) => col >= cell.left && col <= cell.right);
  if (c < 0) c = col < cells[0].left ? 0 : cells.length - 1;
  const go = (row, cell) => {
    const target = tableCells(lines[row])[cell];
    return { start: starts[row] + target.from, end: starts[row] + target.from, text: "", selStart: starts[row] + target.from, selEnd: starts[row] + target.to };
  };
  const isRow = (n) => n >= 0 && n < lines.length && TABLE_ROW.test(lines[n]) && !TABLE_SEPARATOR.test(lines[n]);
  if (dir > 0) {
    if (c + 1 < cells.length) return go(at, c + 1);
    let n = at + 1;
    if (n < lines.length && TABLE_SEPARATOR.test(lines[n]) && TABLE_ROW.test(lines[n])) n++;
    if (isRow(n)) return go(n, 0);
    const row = "| " + cells.map(() => "").join(" | ") + " |";
    const end = starts[at] + lines[at].length;
    const first = end + 1 + 2;
    return { start: end, end, text: "\n" + row, selStart: first, selEnd: first };
  }
  if (c > 0) return go(at, c - 1);
  let n = at - 1;
  if (n >= 0 && TABLE_SEPARATOR.test(lines[n])) n--;
  if (isRow(n)) return go(n, tableCells(lines[n]).length - 1);
  return null;
}

/**
 * Insert a picture link, `![alt](path)`, as a paragraph of its own: blank lines are added around it when it would
 * otherwise run into neighbouring text. A selection becomes the alt text; with none, the alt text is suggested from
 * the file name and selected so it can be replaced by typing.
 */
export function image(src, s, e, path, suggested = "image") {
  const str = String(src);
  const alt = e > s ? str.substring(s, e) : suggested;
  const lineStart = str.lastIndexOf("\n", s - 1) + 1;
  let lineEnd = str.indexOf("\n", e);
  if (lineEnd < 0) lineEnd = str.length;
  const blank = (from, to) => !str.substring(from, to).trim();
  let lead = "";
  if (!blank(lineStart, s)) lead = "\n\n";
  else if (lineStart > 0) {
    const prevStart = str.lastIndexOf("\n", lineStart - 2) + 1;
    if (!blank(prevStart, lineStart - 1)) lead = "\n";
  }
  let trail = "";
  if (!blank(e, lineEnd)) trail = "\n\n";
  else if (lineEnd < str.length) {
    let nextEnd = str.indexOf("\n", lineEnd + 1);
    if (nextEnd < 0) nextEnd = str.length;
    if (!blank(lineEnd + 1, nextEnd)) trail = "\n";
  }
  const link = `![${alt}](${path})`;
  const at = s + lead.length + 2;
  return { start: s, end: e, text: lead + link + trail, selStart: at, selEnd: at + alt.length };
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
  tableTab,
  image,
  endEmptyTask,
  block,
  codeBlock,
  callout,
  TABLE,
  RULE,
  CALLOUTS,
};

export default MarkdownFormat;

const alpha = (n) => { let out = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(97 + ((n - 1) % 26)) + out; return out; };
const roman = (n) => {
  if (n < 1 || n > 3999) return String(n);
  let out = "";
  for (const [v, r] of [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]) while (n >= v) { out += r; n -= v; }
  return out;
};

/**
 * How the numbers of nested numbered lists are shown, matching the reader: the first level 1. 2. 3., the second a. b. c.,
 * the third i. ii. iii., then the pattern repeats. Levels count numbered ancestors only (a bullet in between does not
 * add one), as the reader's CSS does. Returns [{ from, to, label }] for the digits to display differently; the text of
 * the file is not changed. Code blocks are skipped.
 */
export function markerLabels(src) {
  const out = [];
  const stack = [];
  let pos = 0, fence = null;
  for (const line of String(src).split("\n")) {
    const start = pos;
    pos += line.length + 1;
    const f = /^\s*(```|~~~)/.exec(line);
    if (f) { fence = fence === null ? f[1] : fence === f[1] ? null : fence; continue; }
    if (fence !== null || !line.trim()) continue;
    const m = /^(\s*)(?:([-*+]) |(\d+)([.)]) )/.exec(line);
    const indent = line.length - line.trimStart().length;
    if (!m) { if (indent === 0) stack.length = 0; continue; }
    while (stack.length && stack[stack.length - 1].indent >= m[1].length) stack.pop();
    const ordered = m[3] !== undefined;
    if (ordered) {
      const depth = stack.filter((x) => x.ordered).length;
      const kind = depth % 3;
      if (kind !== 0) out.push({ from: start + m[1].length, to: start + m[1].length + m[3].length, label: (kind === 1 ? alpha : roman)(Number(m[3])) });
    }
    stack.push({ indent: m[1].length, ordered });
  }
  return out;
}
