import test from "node:test";
import assert from "node:assert/strict";
import {
  wrap,
  link,
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

test("toggleHeadingSetsThenClears", () => {
  check("ti|tle", "## ti|tle".replace("ti|tle", "title|"), (t, s, e) => toggleHeading(t, s, e, 2));
  check("## tit|le", "title|", (t, s, e) => toggleHeading(t, s, e, 2));
  check("# tit|le", "## title|", (t, s, e) => toggleHeading(t, s, e, 2));
});

test("shiftHeadingMovesOneLevelAndKeepsTheCursor", () => {
  check("## tit|le", "### tit|le", (t, s, e) => shiftHeading(t, s, e, 1));
  check("### tit|le", "## tit|le", (t, s, e) => shiftHeading(t, s, e, -1));
  // a cursor inside the "## " marks moves to just after them
  check("|## title", "### |title", (t, s, e) => shiftHeading(t, s, e, 1));
  check("#| title", "## |title", (t, s, e) => shiftHeading(t, s, e, 1));
});

test("shiftHeadingStopsAtTheEnds", () => {
  check("###### x|", "###### x|", (t, s, e) => shiftHeading(t, s, e, 1));
  check("# x|", "# x|", (t, s, e) => shiftHeading(t, s, e, -1));
});

test("shiftHeadingIsNullOffAHeading", () => {
  assert.equal(shiftHeading("plain text", 3, 3, 1), null);
  assert.equal(shiftHeading("#hashtag", 2, 2, 1), null);
  assert.equal(shiftHeading("## a\n## b", 1, 8, 1), null);   // a selection over several lines is left to the normal Tab
});

test("indentListNestsByMarkerWidth", () => {
  check("- it|em", "  - it|em", (t, s, e) => indentList(t, s, e, 1));
  check("1. it|em", "   1. it|em", (t, s, e) => indentList(t, s, e, 1));
  check("- [ ] ta|sk", "  - [ ] ta|sk", (t, s, e) => indentList(t, s, e, 1));
  check("  - it|em", "- it|em", (t, s, e) => indentList(t, s, e, -1));
  check("   1. it|em", "1. it|em", (t, s, e) => indentList(t, s, e, -1));
  check("- it|em", "- it|em", (t, s, e) => indentList(t, s, e, -1));
});

test("indentListWorksOnSeveralItemsAndSkipsOtherText", () => {
  check("[- a\n- b]", "[  - a\n  - b]", (t, s, e) => indentList(t, s, e, 1));
  assert.equal(indentList("plain", 2, 2, 1), null);
  assert.equal(indentList("- a\nplain", 0, 9, 1), null);
});

test("wrapAgainStepsOutOfTheStyle", () => {
  check("**bold|**", "**bold**|", (t, s, e) => wrap(t, s, e, "**"));
  check("a `code|`", "a `code`|", (t, s, e) => wrap(t, s, e, "`"));
  check("*it|*", "*it*|", (t, s, e) => wrap(t, s, e, "*"));
  check("x **b|** y", "x **b**| y", (t, s, e) => wrap(t, s, e, "**"));
});

test("wrapStillOpensAPairWhereNothingIsOpen", () => {
  check("a |", "a **|**", (t, s, e) => wrap(t, s, e, "**"));
  check("a |**", "a **|****", (t, s, e) => wrap(t, s, e, "**"));        // a mark after the cursor with no opening one before it
  check("**|**", "|", (t, s, e) => wrap(t, s, e, "**"));                 // the empty pair is removed
});

test("endEmptyTaskClearsTheMarker", () => {
  check("- [ ] done\n- [ ] |", "- [ ] done\n|", (t, s, e) => endEmptyTask(t, s, e));
  check("- [x] |", "|", (t, s, e) => endEmptyTask(t, s, e));
  check("  - [ ] |", "- [ ] |", (t, s, e) => endEmptyTask(t, s, e));
});

test("endEmptyTaskLeavesOtherLinesAlone", () => {
  assert.equal(endEmptyTask("- [ ] text|", 11, 11), null);
  assert.equal(endEmptyTask("- item|", 7, 7), null);
  assert.equal(endEmptyTask("- [ ] |text", 6, 6), null);
});

import { tableTab } from "./format.js";

const T = "| A | B |\n| --- | --- |\n| one | two |\n";
const cellSel = (r, src) => src.substring(r.selStart, r.selEnd);

test("Tab moves to the next cell and selects its text", () => {
  let r = tableTab(T, T.indexOf("A"), T.indexOf("A"), 1);
  assert.equal(cellSel(r, T), "B");
  r = tableTab(T, T.indexOf("B"), T.indexOf("B"), 1);       // last cell: next row, skipping the separator
  assert.equal(cellSel(r, T), "one");
  r = tableTab(T, T.indexOf("one"), T.indexOf("one"), 1);
  assert.equal(cellSel(r, T), "two");
});

test("Shift+Tab moves back, over the separator row, and stops at the first cell", () => {
  let r = tableTab(T, T.indexOf("two"), T.indexOf("two"), -1);
  assert.equal(cellSel(r, T), "one");
  r = tableTab(T, T.indexOf("one"), T.indexOf("one"), -1);
  assert.equal(cellSel(r, T), "B");
  assert.equal(tableTab(T, T.indexOf("A"), T.indexOf("A"), -1), null);
});

test("Tab in the last cell of the last row adds a row", () => {
  const src = "| A | B |\n| --- | --- |\n| one | two |";
  const r = tableTab(src, src.indexOf("two"), src.indexOf("two"), 1);
  assert.equal(r.text, "\n|  |  |");
  const out = src.slice(0, r.start) + r.text + src.slice(r.end);
  assert.equal(out.substring(r.selStart - 2, r.selStart + 1), "|  ");
  assert.equal(r.selStart, r.selEnd);
});

test("empty cells get the cursor, pipes inside escapes are not cell borders, other lines return null", () => {
  const src = "| a |  | c |\n";
  const r = tableTab(src, src.indexOf("a"), src.indexOf("a"), 1);
  assert.equal(r.selStart, r.selEnd);
  assert.equal(r.selStart, 6);
  const esc = "| a \\| b | c |\n";
  assert.equal(cellSel(tableTab(esc, 2, 2, 1), esc), "c");
  assert.equal(tableTab("plain text\n", 3, 3, 1), null);
});

test("Tab from a selected cell moves on, using the end of the selection", () => {
  const a = T.indexOf("one");
  const r = tableTab(T, a + 3, a + 3, 1);
  assert.equal(cellSel(r, T), "two");
});
