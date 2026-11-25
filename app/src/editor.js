// CodeMirror 6 Markdown editor, themed from shared/web/themes.json (same roles as the Android editor).
import { EditorState, Compartment, RangeSetBuilder, Prec, StateField, StateEffect } from "@codemirror/state";
import { EditorView, keymap, drawSelection, ViewPlugin, Decoration, WidgetType, highlightActiveLine, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { codeLanguages } from "./languages.js";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { renumber, markerLabels } from "./format.js";
import { lineSeparatorFor, docText, withLineBreak } from "./eol.js";

const look = new Compartment();

// Find: the matches of the open find bar, drawn behind the text; the current one stands out.
const setFindEffect = StateEffect.define();
const findField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const ef of tr.effects) {
      if (!ef.is(setFindEffect)) continue;
      const { matches, current } = ef.value;
      deco = Decoration.set(matches.map((m, i) => Decoration.mark({ class: i === current ? "cm-find-hit cm-find-current" : "cm-find-hit" }).range(m.from, m.to)));
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});
const findTheme = EditorView.baseTheme({
  ".cm-find-hit": { backgroundColor: "rgba(255, 213, 79, 0.35)", borderRadius: "2px" },
  ".cm-find-current": { backgroundColor: "rgba(255, 152, 0, 0.65)", outline: "1px solid #ff9800" },
});
const HEADING_SIZES = [1.6, 1.4, 1.25, 1.12, 1.05, 1.0];

/** 68% fg over bg: readable secondary text (theme comment colours are too faint for prose). */
export function soft(theme) {
  if (theme.soft) return theme.soft;
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [f, b] = [p(theme.fg), p(theme.bg)];
  return "#" + f.map((c, i) => Math.round(c * 0.68 + b[i] * 0.32).toString(16).padStart(2, "0")).join("");
}

function themeExtensions(theme, font, size) {
  const muted = theme.fgMuted;
  const hl = theme.hljs;
  const headings = [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6].map((tag, i) => ({
    tag, color: theme[`h${i + 1}`], fontWeight: "700", fontSize: `${HEADING_SIZES[i]}em`,
  }));
  const style = HighlightStyle.define([
    ...headings,
    { tag: t.processingInstruction, color: muted },          // # * _ ` > markers
    { tag: t.strong, color: theme.bold, fontWeight: "700" },
    { tag: t.emphasis, color: theme.italic, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through", color: muted },
    { tag: t.link, color: theme.link },
    { tag: t.url, color: muted },
    { tag: t.monospace, color: theme.codeFg, fontFamily: "ArkMono, monospace" },
    // Code inside fenced blocks: the same syntax palette as the reader (highlight.js colours).
    { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword], color: hl.keyword },
    { tag: [t.string, t.special(t.string), t.character], color: hl.string },
    { tag: [t.number, t.integer, t.float], color: hl.number },
    { tag: [t.lineComment, t.blockComment, t.docComment], color: hl.comment, fontStyle: "italic" },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))], color: hl.function },
    { tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName)], color: hl.type },
    { tag: [t.variableName, t.definition(t.variableName)], color: hl.variable },
    { tag: [t.propertyName, t.attributeName], color: hl.attr },
    { tag: [t.standard(t.variableName), t.standard(t.name), t.tagName], color: hl.builtin },
    { tag: [t.bool, t.null, t.atom, t.self], color: hl.literal },
    { tag: [t.annotation, t.processingInstruction, t.meta], color: muted },
    { tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator, t.compareOperator], color: hl.operator },
    { tag: [t.punctuation, t.bracket, t.separator], color: hl.punctuation },
    { tag: t.regexp, color: hl.regexp },
    { tag: t.deleted, color: hl.deletion },
    { tag: t.inserted, color: hl.addition },
    { tag: t.quote, color: soft(theme) },
    { tag: t.list, color: theme.accent },
    { tag: t.contentSeparator, color: muted },
    { tag: t.labelName, color: theme.link },
    { tag: t.meta, color: muted },
    { tag: t.comment, color: muted },
  ]);
  const view = EditorView.theme({
    "&": { backgroundColor: theme.bg, color: theme.fg, fontSize: `${size}px` },
    ".cm-content": { fontFamily: font, lineHeight: "1.6", caretColor: theme.accent },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: theme.accent, borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: theme.selection + " !important" },
    ".cm-activeLine": { backgroundColor: "transparent" },
    ".cm-ark-mark": { backgroundColor: theme.yellow + "55", borderRadius: "3px" },
    ".cm-ark-wiki": { color: theme.accent },
    ".cm-ark-tag": { color: theme.tag },
    ".cm-ark-callout": { color: theme.accent, fontWeight: "700" },
    ".cm-ark-front": { color: soft(theme), fontFamily: "ArkMono, monospace", fontSize: ".9em" },
    ".cm-ark-codeblock": { backgroundColor: theme.bgAlt, fontFamily: "ArkMono, monospace", fontSize: ".92em" },
    // The drawn selection sits behind the lines, so a code line (which has its own background) hides it: the selected part of
    // a code line is marked instead (see codeSelection), in the selection colour with the main text colour.
    ".cm-ark-selected, .cm-ark-selected span": { backgroundColor: theme.selection, color: theme.fg + " !important" },
  }, { dark: !!theme.dark });
  return [view, syntaxHighlighting(style)];
}

/** Obsidian extras the Markdown grammar doesn't know: ==mark==, [[wikilinks]], #tags, [!callout], front matter. */
const extras = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view); }
  build(view) {
    const marks = [];
    const doc = view.state.doc;
    const text = doc.toString();
    const fm = /^---\n[\s\S]*?\n---(?:\n|$)/.exec(text);
    if (fm) marks.push([0, fm[0].length, "cm-ark-front"]);
    for (const { from, to } of view.visibleRanges) {
      const chunk = doc.sliceString(from, to);
      const add = (re, cls, group = 0) => {
        for (const m of chunk.matchAll(re)) {
          const start = from + m.index + (group ? m[0].indexOf(m[group]) : 0);
          marks.push([start, start + m[group].length, cls]);
        }
      };
      add(/==[^=\n]+==/g, "cm-ark-mark");
      add(/\[\[[^\]\n]+\]\]/g, "cm-ark-wiki");
      add(/(?:^|\s)(#[A-Za-z0-9_\-/]*[A-Za-z_\-/][A-Za-z0-9_\-/]*)/gm, "cm-ark-tag", 1);
      add(/^>\s*(\[![A-Za-z-]+\][+-]?)/gm, "cm-ark-callout", 1);
      for (const m of chunk.matchAll(/^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[ \t]*$|$(?![\s\S]))/gm)) {
        const startLine = doc.lineAt(from + m.index).number;
        const endLine = doc.lineAt(Math.min(from + m.index + m[0].length, doc.length)).number;
        for (let n = startLine; n <= endLine; n++) marks.push([doc.line(n).from, doc.line(n).from, "line"]);
      }
    }
    marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const builder = new RangeSetBuilder();
    const line = Decoration.line({ class: "cm-ark-codeblock" });
    for (const [a, b, cls] of marks) {
      if (cls === "line") builder.add(a, a, line);
      else if (b > a) builder.add(a, b, Decoration.mark({ class: cls }));
    }
    return builder.finish();
  }
}, { decorations: (v) => v.decorations });

/** Marks the selected text inside code blocks so it can be painted over the block's background (see the theme above). */
const codeSelection = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) { if (u.selectionSet || u.docChanged || u.viewportChanged) this.decorations = this.build(u.view); }
  build(view) {
    const sel = view.state.selection.main;
    const lines = view.plugin(extras)?.decorations;
    if (sel.empty || !lines) return Decoration.none;
    const doc = view.state.doc, b = new RangeSetBuilder(), mark = Decoration.mark({ class: "cm-ark-selected" });
    for (const { from, to } of view.visibleRanges) {
      const a = Math.max(from, sel.from), z = Math.min(to, sel.to);
      if (a >= z) continue;
      for (let n = doc.lineAt(a).number, last = doc.lineAt(z).number; n <= last; n++) {
        const line = doc.line(n);
        let isCode = false;
        lines.between(line.from, line.from, (_f, _t, v) => { if (v.spec.class === "cm-ark-codeblock") isCode = true; });
        const s = Math.max(line.from, a), e = Math.min(line.to, z);
        if (isCode && e > s) b.add(s, e, mark);
      }
    }
    return b.finish();
  }
}, { decorations: (v) => v.decorations });

class MarkerLabel extends WidgetType {
  constructor(label) { super(); this.label = label; }
  eq(o) { return o.label === this.label; }
  toDOM() { const el = document.createElement("span"); el.textContent = this.label; return el; }
}
/** Nested numbered lists show a. b. c. and i. ii. iii. like the reader does; the file keeps its numbers (see markerLabels). */
const nestedMarkers = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.build(view); }
  update(u) { if (u.docChanged) this.decorations = this.build(u.view); }
  build(view) {
    if (view.state.doc.length > 300000) return Decoration.none;
    const b = new RangeSetBuilder();
    for (const m of markerLabels(view.state.doc.toString())) b.add(m.from, m.to, Decoration.replace({ widget: new MarkerLabel(m.label) }));
    return b.finish();
  }
}, { decorations: (v) => v.decorations, provide: (p) => EditorView.atomicRanges.of((v) => v.plugin(p)?.decorations || Decoration.none) });

/**
 * Create the editor. onChange(doc) fires on every edit; extraKeys are extra keymap bindings.
 * Returns { view, setText, getText, setLook(theme, font, size), scrollFraction(), scrollToFraction(f) }.
 */
const typing = new Compartment();
const gutter = new Compartment();
const autoClose = new Compartment();
const tagClose = new Compartment();
/**
 * Closing brackets and quotes while typing code: "(" gives "()", typing ")" steps over it, Backspace removes the pair.
 * It applies inside fenced code blocks whose language is known (that language's own settings are used); prose, inline
 * code and fences without a language get nothing, so apostrophes and quotes in text are left alone.
 */
const autoCloseExt = (on) => (on ? [closeBrackets(), markdownLanguage.data.of({ closeBrackets: { brackets: [] } }), keymap.of(closeBracketsKeymap)] : []);
const MARKER = /^\s*\d+[.)] /;
/**
 * After typing or deleting, a numbered list that is out of sequence is renumbered: a new "2." inserted into 1, 2, 3
 * renumbers what follows, and deleting an item closes the gap. It runs only when lines were added or removed or a line
 * just became a list item, so editing a number in place is left alone (see renumber in format.js).
 */
const renumberLists = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent("input") || tr.isUserEvent("delete"))) return tr;
  const before = tr.startState.doc, after = tr.newDoc, linesChanged = before.lines !== after.lines;
  const idx = new Set();
  tr.changes.iterChangedRanges((fromA, _toA, fromB) => {
    const line = after.lineAt(Math.min(fromB, after.length));
    const created = MARKER.test(line.text) && !MARKER.test(before.lineAt(Math.min(fromA, before.length)).text);
    if (!linesChanged && !created) return;
    idx.add(line.number - 1);
    if (line.number > 1) idx.add(line.number - 2);
    if (line.number < after.lines) idx.add(line.number);
  });
  if (!idx.size) return tr;
  const edits = renumber(after.toString(), [...idx]);
  if (!edits.length) return tr;
  return [tr, { changes: edits.map((e) => ({ from: e.from, to: e.to, insert: e.text })), sequential: true }];
});
/** Spell check, autocorrect and sentence capitals. CodeMirror turns all three off; writing prose wants them on. */
const typingAttrs = (on) => EditorView.contentAttributes.of(on
  ? { spellcheck: "true", autocorrect: "on", autocapitalize: "sentences" }
  : { spellcheck: "false", autocorrect: "off", autocapitalize: "off" });

export function createEditor(parent, { onChange, onCursor = () => {}, extraKeys = [] }) {
  const extensions = [
        history(),
        renumberLists,
        nestedMarkers,
        drawSelection(),
        highlightActiveLine(),
        findField,
        findTheme,
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages }),
        extras,
        codeSelection,
        EditorView.contentAttributes.of({ "aria-label": "Markdown editor", "aria-multiline": "true", tabindex: "0" }),
        Prec.highest(keymap.of(extraKeys)),     // ahead of the Markdown language's own Enter handling
        keymap.of([indentWithTab, { key: "Mod-Shift-z", run: redo, preventDefault: true }, { key: "Mod-y", run: redo, preventDefault: true }, ...defaultKeymap, ...historyKeymap]),
        look.of([]),
        typing.of(typingAttrs(true)),
        gutter.of([]),
        autoClose.of(autoCloseExt(true)),
        tagClose.of([]),
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(docText(u.state)); if (u.docChanged || u.selectionSet) onCursor(); }),
  ];
  /** A fresh state for a document, keeping its line endings (see eol.js). */
  const stateFor = (text) => {
    const sep = lineSeparatorFor(text);
    return EditorState.create({ doc: text, extensions: sep ? [...extensions, EditorState.lineSeparator.of(sep)] : extensions });
  };
  const view = new EditorView({ parent, state: stateFor("") });
  let currentLook = [];
  let currentTyping = true;
  let currentGutter = false;
  let currentAutoClose = true;
  let currentTagClose = false;
  let tagCloseModule = null;      // the HTML language package, loaded the first time tag closing is switched on
  const tagCloseExt = () => (currentTagClose && tagCloseModule ? tagCloseModule.autoCloseTags : []);
  const gutterExt = () => (currentGutter ? lineNumbers() : []);
  return {
    view,
    getText: () => docText(view.state),
    /** Load a document: fresh state, so undo history starts here. */
    setText(text) {
      view.setState(stateFor(text));
      view.dispatch({ effects: [look.reconfigure(currentLook), typing.reconfigure(typingAttrs(currentTyping)), gutter.reconfigure(gutterExt()), autoClose.reconfigure(autoCloseExt(currentAutoClose)), tagClose.reconfigure(tagCloseExt())] });
    },
    /** Fresh editor state for a document (own undo history); used per tab. */
    newState(text) { return stateFor(text); },
    getState() { return view.state; },
    undo() { undo(view); view.focus(); },
    redo() { redo(view); view.focus(); },
    /** Whether there is anything to undo or redo, for the toolbar buttons. */
    canUndo: () => undoDepth(view.state) > 0,
    canRedo: () => redoDepth(view.state) > 0,
    /** Swap in another tab's state, keeping the current theme and font. */
    setState(state) {
      view.setState(state);
      view.dispatch({ effects: [look.reconfigure(currentLook), typing.reconfigure(typingAttrs(currentTyping)), gutter.reconfigure(gutterExt()), autoClose.reconfigure(autoCloseExt(currentAutoClose)), tagClose.reconfigure(tagCloseExt())] });
    },
    replaceAll(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    /** Turn spell check, autocorrect and sentence capitals on or off. */
    setTyping(on) {
      currentTyping = !!on;
      view.dispatch({ effects: typing.reconfigure(typingAttrs(currentTyping)) });
    },
    /** Close brackets and quotes while typing in code blocks (see autoCloseExt). */
    setAutoClose(on) {
      currentAutoClose = !!on;
      view.dispatch({ effects: autoClose.reconfigure(autoCloseExt(currentAutoClose)) });
    },
    /** Close HTML and XML tags while typing in code blocks: typing <div> adds </div>. Loads the HTML package on first use. */
    async setTagClose(on) {
      currentTagClose = !!on;
      if (currentTagClose && !tagCloseModule) tagCloseModule = await import("@codemirror/lang-html");
      view.dispatch({ effects: tagClose.reconfigure(tagCloseExt()) });
    },
    /** Show or hide the line numbers on the left. */
    setLineNumbers(on) {
      currentGutter = !!on;
      view.dispatch({ effects: gutter.reconfigure(gutterExt()) });
    },
    /** 1-based line and column of the cursor, and the selected text ("" when nothing is selected). */
    cursorInfo() {
      const sel = view.state.selection.main;
      const line = view.state.doc.lineAt(sel.head);
      return { line: line.number, column: sel.head - line.from + 1, selected: sel.empty ? "" : view.state.sliceDoc(sel.from, sel.to) };
    },
    setLook(theme, font, size) {
      currentLook = themeExtensions(theme, font, size);
      view.dispatch({ effects: look.reconfigure(currentLook) });
    },
    scrollFraction() {
      const s = view.scrollDOM; const max = s.scrollHeight - s.clientHeight;
      return max > 0 ? s.scrollTop / max : 0;
    },
    scrollToFraction(f) {
      requestAnimationFrame(() => { const s = view.scrollDOM; s.scrollTop = f * (s.scrollHeight - s.clientHeight); });
    },
    /** Put the cursor at the start of a 0-based line and scroll it to the top. */
    goToLine(n) {
      const line = view.state.doc.line(Math.min(Math.max(n + 1, 1), view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 8 }) });
      view.focus();
    },
    /** Tick or untick the task item on a 0-based line as one undoable change; false if the line isn't a task item. */
    setTask(n, checked) {
      if (n < 0 || n >= view.state.doc.lines) return false;
      const line = view.state.doc.line(n + 1);
      const m = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)[ xX](\])/.exec(line.text);
      if (!m) return false;
      const at = line.from + m[1].length;
      view.dispatch({ changes: { from: at, to: at + 1, insert: checked ? "x" : " " }, userEvent: "input.task" });
      return true;
    },
    /** The document with plain "\n" breaks: the character positions the editor itself uses. */
    docString: () => view.state.doc.toString(),
    /** Draw find matches ([{from,to}]) and mark index `current`; `reveal` scrolls to it and moves the cursor there. */
    setFind(matches, current, reveal = false) {
      const m = matches[current];
      const effects = [setFindEffect.of({ matches, current })];
      const spec = { effects };
      if (reveal && m) { spec.selection = { anchor: m.from, head: m.to }; effects.push(EditorView.scrollIntoView(m.from, { y: "center" })); }
      view.dispatch(spec);
    },
    /** Replace one or several ranges ([{from,to,insert}]) as a single undoable change. */
    replaceRanges(changes) {
      const lb = view.state.lineBreak;
      view.dispatch({ changes: changes.map((c) => ({ ...c, insert: withLineBreak(c.insert, lb) })), userEvent: "input.replace", scrollIntoView: true });
    },
    cursorLine() { return view.state.doc.lineAt(view.state.selection.main.head).number - 1; },
    /** Apply a format.js edit {start,end,text,selStart,selEnd} as one undoable change. */
    applyEdit(e) {
      view.dispatch({
        changes: { from: e.start, to: e.end, insert: withLineBreak(e.text, view.state.lineBreak) },
        selection: { anchor: e.selStart, head: e.selEnd },
        scrollIntoView: true,
        userEvent: "input.format",
      });
      view.focus();
    },
    selection() { const r = view.state.selection.main; return [r.from, r.to]; },
    /** The selected text, every range of a multiple selection joined with line breaks like the browser's own copy. */
    selectedText() { const st = view.state; return st.selection.ranges.filter((r) => !r.empty).map((r) => st.sliceDoc(r.from, r.to)).join(st.lineBreak); },
  };
}
