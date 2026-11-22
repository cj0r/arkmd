// Word and character counts for the outline flyout. Pure logic (see stats.test.js).

/** The text a reader would read: front matter removed, code fences' markers and link targets dropped. */
function readable(text) {
  return String(text ?? "")
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "")
    .replace(/^ {0,3}(`{3,}|~{3,}).*$/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+(?:\[[ xX]\][ \t]+)?|\d+[.)][ \t]+)/gm, "")
    .replace(/[*_~=`|]+/g, " ");
}

/** { words, characters, minutes } where minutes is the reading time at 220 words a minute (0 for an empty text). */
export function stats(text) {
  const words = (readable(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const body = String(text ?? "").replace(/\r\n|\r/g, "\n");
  return { words, characters: [...body.replace(/\n/g, "")].length, minutes: words ? Math.max(1, Math.round(words / 220)) : 0 };
}

/** "1,234 words · 7,890 characters · 6 min read" */
export function formatStats(s) {
  const n = (v, one, many) => `${v.toLocaleString("en-US")} ${v === 1 ? one : many}`;
  const parts = [n(s.words, "word", "words"), n(s.characters, "character", "characters")];
  if (s.minutes) parts.push(`${s.minutes} min read`);
  return parts.join(" · ");
}
