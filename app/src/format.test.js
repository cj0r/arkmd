import test from "node:test";
import assert from "node:assert/strict";
import {
  wrap,
  link,
  list,
  quote,
  heading,
  block,
  codeBlock,
  callout,
  RULE,
} from "./format.js";

/** Apply an edit; returns the text with the new selection marked as [..] (or | for a cursor). */
function run(src, s, e, op) {
  const ed = op(src, s, e);
  const out = src.slice(0, ed.start) + ed.text + src.slice(ed.end);
  return ed.selStart === ed.selEnd
    ? out.slice(0, ed.selStart) + "|" + out.slice(ed.selStart)
    : out.slice(0, ed.selStart) + "[" + out.slice(ed.selStart, ed.selEnd) + "]" + out.slice(ed.selEnd);
}

/** Parse "a [bc] d" or "a| b" into [text, selStart, selEnd]. */
function sel(marked) {
  const c = marked.indexOf("|");
  if (c >= 0) return [marked.slice(0, c) + marked.slice(c + 1), c, c];
  const a = marked.indexOf("[");
  const b = marked.indexOf("]") - 1;
  return [marked.replaceAll("[", "").replaceAll("]", ""), a, b];
}

function check(input, expected, op) {
  const [t, s, e] = sel(input);
  assert.equal(run(t, s, e, op), expected);
}

test("boldWrapsSelection", () => {
  check("say [hi] now", "say **[hi]** now", (t, s, e) => wrap(t, s, e, "**"));
});

test("boldUnwrapsOutside", () => {
  check("say **[hi]** now", "say [hi] now", (t, s, e) => wrap(t, s, e, "**"));
});

test("boldUnwrapsInside", () => {
  check("say [**hi**] now", "say [hi] now", (t, s, e) => wrap(t, s, e, "**"));
});

test("boldEmptyInsertsPair", () => {
  check("a|b", "a**|**b", (t, s, e) => wrap(t, s, e, "**"));
});

test("highlight", () => {
  check("[x]", "==[x]==", (t, s, e) => wrap(t, s, e, "=="));
});

test("linkFromSelection", () => {
  check("see [docs]", "see [docs]([https://])", link);
});

test("linkEmpty", () => {
  check("|", "[[text]](https://)", link);
});

test("bulletCurrentLine", () => {
  check("one\ntw|o\nthree", "one\n- two|\nthree", (t, s, e) => list(t, s, e, "bullet"));
});

test("bulletToggleOff", () => {
  check("- tw|o", "two|", (t, s, e) => list(t, s, e, "bullet"));
});

test("bulletManyLines", () => {
  check("[a\nb]\nc", "[- a\n- b]\nc", (t, s, e) => list(t, s, e, "bullet"));
});

test("numberedSwapsBullets", () => {
  check("[- a\n- b]", "[1. a\n2. b]", (t, s, e) => list(t, s, e, "numbered"));
});

test("taskFromBullet", () => {
  check("- a|", "- [ ] a|", (t, s, e) => list(t, s, e, "task"));
});

test("taskToggleOff", () => {
  check("- [ ] a|", "a|", (t, s, e) => list(t, s, e, "task"));
});

test("bulletKeepsIndent", () => {
  check("  a|", "  - a|", (t, s, e) => list(t, s, e, "bullet"));
});

test("quoteOnAndOff", () => {
  check("[a\nb]", "[> a\n> b]", quote);
  check("[> a\n> b]", "[a\nb]", quote);
});

test("headingSetAndReplace", () => {
  check("tit|le", "## title|", (t, s, e) => heading(t, s, e, 2));
  check("### tit|le", "# title|", (t, s, e) => heading(t, s, e, 1));
  check("## tit|le", "title|", (t, s, e) => heading(t, s, e, 0));
});

test("codeBlockOnOwnLine", () => {
  check("x [y] z", "x \n```\n[y]\n```\n z", codeBlock);
});

test("calloutWrapsSelection", () => {
  check("[body]", "> [!tip] [Tip]\n> body", (t, s, e) => callout(t, s, e, "tip"));
});

test("dividerOwnLine", () => {
  check("ab|", "ab\n---|", (t, s, e) => block(t, s, e, RULE));
});
