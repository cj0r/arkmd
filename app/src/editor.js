// CodeMirror 6 Markdown editor, themed from shared/web/themes.json (same roles as the Android editor).
import { EditorState, Compartment, RangeSetBuilder } from "@codemirror/state";
import { EditorView, keymap, drawSelection, ViewPlugin, Decoration, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { codeLanguages } from "./languages.js";

const look = new Compartment();
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

/**
 * Create the editor. onChange(doc) fires on every edit; extraKeys are extra keymap bindings.
 * Returns { view, setText, getText, setLook(theme, font, size), scrollFraction(), scrollToFraction(f) }.
 */
export function createEditor(parent, { onChange, extraKeys = [] }) {
  const extensions = [
        history(),
        drawSelection(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        markdown({ base: markdownLanguage, codeLanguages }),
        extras,
        EditorView.contentAttributes.of({ "aria-label": "Markdown editor", "aria-multiline": "true", tabindex: "0" }),
        keymap.of([...extraKeys, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        look.of([]),
        EditorView.updateListener.of((u) => { if (u.docChanged) onChange(u.state.doc.toString()); }),
  ];
  const view = new EditorView({ parent, state: EditorState.create({ doc: "", extensions }) });
  let currentLook = [];
  return {
    view,
    getText: () => view.state.doc.toString(),
    /** Load a document: fresh state, so undo history starts here. */
    setText(text) {
      view.setState(EditorState.create({ doc: text, extensions }));
      view.dispatch({ effects: look.reconfigure(currentLook) });
    },
    /** Fresh editor state for a document (own undo history); used per tab. */
    newState(text) { return EditorState.create({ doc: text, extensions }); },
    getState() { return view.state; },
    /** Swap in another tab's state, keeping the current theme and font. */
    setState(state) {
      view.setState(state);
      view.dispatch({ effects: look.reconfigure(currentLook) });
    },
    replaceAll(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
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
    /** Apply a format.js edit {start,end,text,selStart,selEnd} as one undoable change. */
    applyEdit(e) {
      view.dispatch({
        changes: { from: e.start, to: e.end, insert: e.text },
        selection: { anchor: e.selStart, head: e.selEnd },
        scrollIntoView: true,
        userEvent: "input.format",
      });
      view.focus();
    },
    selection() { const r = view.state.selection.main; return [r.from, r.to]; },
  };
}
