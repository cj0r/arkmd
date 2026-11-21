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
  block,
  codeBlock,
  callout,
  TABLE,
  RULE,
  CALLOUTS,
};

export default MarkdownFormat;
