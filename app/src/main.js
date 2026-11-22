// ArkMD UI, shared by desktop and Android (and iOS later). The reader is the shared viewer.html in an
// iframe; the editor is CodeMirror 6. Files, dialogs and the window go through platform.js.
import { createEditor } from "./editor.js";
import { platform, baseName } from "./platform.js";
import * as F from "./format.js";
import { svg } from "./icons.js";
import { createTabs } from "./tabs.js";
import { docText } from "./eol.js";
import { shouldAutoCheck, summarizeNotes } from "./updates.js";
import { parseThemeCss, newThemeId } from "./usertheme.js";
import { SHORTCUTS } from "./shortcuts.js";
import { outline as parseOutline, currentIndex } from "./outline.js";
import { stats, formatStats } from "./stats.js";
import { parseLink, wikilinkTarget, imageType } from "./links.js";
import { findMatches, buildPattern, expandReplacement, nextIndex } from "./find.js";
import { fileKey, formatWhen, formatSize, lineDelta, draftsToOffer, pushClosed } from "./history.js";
import * as hdb from "./historydb.js";

const $ = (id) => document.getElementById(id);

// Same set and order as the Android app (app/src/main/java/app/arkmd/Fonts.kt).
const FONTS = [
  { id: "system", name: "System", dir: null, note: "Platform default" },
  { id: "firasans", name: "Fira Sans", dir: "firasans", note: "Humanist sans-serif, easy reading" },
  { id: "atkinsonhyperlegible", name: "Atkinson Hyperlegible", dir: "atkinsonhyperlegible", note: "Designed for maximum legibility" },
  { id: "sourceserif4", name: "Source Serif 4", dir: "sourceserif4", note: "Classic serif for long reading" },
  { id: "lora", name: "Lora", dir: "lora", note: "Warm contemporary serif", kind: "variable" },
  { id: "quattro", name: "iA Writer Quattro", dir: "quattro", note: "The iA Writer writing font" },
  { id: "jetbrainsmono", name: "JetBrains Mono", dir: "jetbrainsmono", note: "Modern coding monospace", kind: "mono" },
  { id: "meslo", name: "Meslo LG", dir: "meslo", note: "Classic terminal monospace (Menlo)", kind: "mono" },
];
const fontById = (id) => FONTS.find((f) => f.id === id) || FONTS[0];

// ------------------------------------------------------------------ settings (per-device, local)
const store = {
  get(k, d) { try { const v = localStorage.getItem("ark." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ark." + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ------------------------------------------------------------------ state
let themes = {};
let theme = null;
let readerReady = false;
const tabs = createTabs();
const cur = () => tabs.active;
const mode = () => cur()?.mode ?? "home";

const editor = createEditor($("editor"), {
  onChange(text) { const t = cur(); if (t) { setDirty(t, text !== t.saved); scheduleDraft(); scheduleAutosave(); } updateUndoButtons(); refreshFindSoon(); },
  extraKeys: [
    { key: "Mod-b", run: () => (format((t, s, e) => F.wrap(t, s, e, "**")), true) },
    { key: "Mod-i", run: () => (format((t, s, e) => F.wrap(t, s, e, "*")), true) },
    { key: "Mod-k", run: () => (format(F.link), true) },
    { key: "Mod-Shift-x", run: () => (format((t, s, e) => F.wrap(t, s, e, "~~")), true) },
    { key: "Mod-Shift-h", run: () => (format((t, s, e) => F.wrap(t, s, e, "==")), true) },
    { key: "Mod-`", run: () => (format((t, s, e) => F.wrap(t, s, e, "`")), true) },
    { key: "Mod-Shift-8", run: () => (format((t, s, e) => F.list(t, s, e, "bullet")), true) },
    { key: "Mod-Shift-7", run: () => (format((t, s, e) => F.list(t, s, e, "numbered")), true) },
    { key: "Mod-Shift-9", run: () => (format((t, s, e) => F.list(t, s, e, "task")), true) },
    { key: "Mod-Shift-q", run: () => (format(F.quote), true) },
    { key: "Mod-Shift-k", run: () => (format(F.codeBlock), true) },
    ...[1, 2, 3, 4, 5, 6].map((n) => ({ key: `Mod-${n}`, run: () => (format((t, s, e) => F.toggleHeading(t, s, e, n)), true) })),
    { key: "Mod-0", run: () => (format((t, s, e) => F.heading(t, s, e, 0)), true) },
    { key: "Enter", run: () => { const [s, e] = editor.selection(); const ed = F.endEmptyTask(editor.docString(), s, e); if (!ed) return false; editor.applyEdit(ed); return true; } },
    // Tab on a heading goes one level deeper and on a list item nests it; anywhere else it indents as usual.
    { key: "Tab", run: () => tabEdit(1) },
    { key: "Shift-Tab", run: () => tabEdit(-1) },
  ],
});

// ------------------------------------------------------------------ theme + fonts
function cssVars(t, size) {
  const map = { bg: "bg", "bg-alt": "bgAlt", surface: "surface", fg: "fg", "fg-muted": "fgMuted", accent: "accent",
    link: "link", selection: "selection", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", bold: "bold",
    italic: "italic", "code-fg": "codeFg", "quote-border": "quoteBorder", checkbox: "checkbox", tag: "tag", red: "red",
    orange: "orange", yellow: "yellow", green: "green", cyan: "cyan", purple: "purple" };
  const v = {};
  for (const [css, key] of Object.entries(map)) v[css] = t[key];
  for (const [k, c] of Object.entries(t.hljs)) v["hl-" + k] = c;
  if (t.soft) v["fg-soft"] = t.soft;
  v["font-size"] = size + "px";
  v["content-width"] = widthCss(contentWidth());
  return v;
}

function fontFaces(family, f) {
  if (!f.dir) return "";
  const face = (file, weight, style) =>
    `@font-face{font-family:${family};src:url('/fonts/${f.dir}/${file}.ttf');font-weight:${weight};font-style:${style};}`;
  if (f.kind === "variable") return face("regular", "400 700", "normal") + face("italic", "400 700", "italic");
  return face("regular", 400, "normal") + face("bold", 700, "normal") +
    (f.kind === "mono" ? "" : face("italic", 400, "italic") + face("bolditalic", 700, "italic"));
}

/** The theme as displayed: official colours, plus WCAG AA adjustments unless contrast mode is off. */
function effective(t) {
  if (!store.get("contrastAA", true) || !t.aa) return t;
  const { hljs, ...rest } = t.aa;
  return { ...t, ...rest, hljs: { ...t.hljs, ...(hljs || {}) } };
}

const DEFAULT_THEME = "one-dark-pro";       // the most widely installed editor theme; only new installs use it
const WIDTHS = [
  { key: "narrow", label: "Narrow", sub: "A narrow column, about 760 px", px: 760 },
  { key: "medium", label: "Medium", sub: "About 960 px", px: 960 },
  { key: "wide", label: "Wide", sub: "About 1200 px", px: 1200 },
  { key: "wider", label: "Wider", sub: "About 1500 px", px: 1500 },
  { key: "full", label: "Full width", sub: "Fills the window", px: null },
];
const contentWidth = () => WIDTHS.find((w) => w.key === store.get("contentWidth", "wide")) || WIDTHS[2];
const widthCss = (w) => (w.px ? `${w.px}px` : "100%");
const SIZES = [14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28];
const textSize = () => store.get("fontSize", platform.mobile ? 18 : 16);

function applyLook() {
  const t = effective(theme);
  const size = textSize();
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries({ bg: t.bg, "bg-alt": t.bgAlt, surface: t.surface, fg: t.fg, "fg-muted": t.fgMuted, accent: t.accent, h1: t.h1 }))
    root.setProperty("--" + k, v);
  root.setProperty("--content-width", widthCss(contentWidth()));
  document.documentElement.style.colorScheme = t.dark ? "dark" : "light";
  platform.setChrome(t.bg, t.dark);

  const editFont = fontById(store.get("editFont", "system"));
  $("fontfaces").textContent =
    fontFaces("ArkEdit", editFont) +
    fontFaces("ArkMono", { dir: "jetbrainsmono", kind: "mono" }) +
    FONTS.filter((f) => f.dir).map((f) => fontFaces("ArkPrev-" + f.id, { ...f, kind: f.kind === "variable" ? "variable" : "mono" })).join("");
  editor.setLook(t, editFont.dir ? "ArkEdit, var(--font-ui)" : "var(--font-ui)", size);

  if (readerReady) {
    const w = $("reader").contentWindow;
    w.applyTheme(cssVars(t, size));
    const rf = fontById(store.get("readFont", "system"));
    w.setFont(rf.dir, rf.kind || "static");
  }
}

// ------------------------------------------------------------------ tabs and documents
function setDirty(t, d) {
  if (t.dirty === d) return;
  t.dirty = d;
  updateChrome();
}

const textOf = (t) => (t === cur() ? editor.getText() : docText(t.state));

function updateChrome() {
  const t = cur();
  const open = !!t;
  platform.setTitle(open ? `${t.dirty ? "• " : ""}${t.name} — ArkMD` : "ArkMD");
  $("btn-save").hidden = !(open && t.dirty);
  $("btn-format").hidden = mode() !== "edit";
  $("btn-outline").hidden = !open;
  $("btn-find").hidden = !open;
  if (!open) closeFind();
  $("find-more").hidden = mode() !== "edit";
  if (!open) closeOutline();
  for (const id of ["btn-undo", "btn-redo"]) $(id).hidden = mode() !== "edit";
  updateUndoButtons();
  $("btn-format").classList.toggle("on", store.get("formatBar", true));
  $("btn-format").setAttribute("aria-pressed", String(store.get("formatBar", true)));
  $("home").hidden = open;
  $("reader").hidden = mode() !== "read";
  $("editor").hidden = mode() !== "edit";
  $("toggle").hidden = !open;
  const showBar = mode() === "edit" && store.get("formatBar", true);
  $("formatbar").hidden = !showBar;
  $("toggle").classList.toggle("raised", showBar);
  $("toggle").innerHTML = svg(mode() === "edit" ? "view" : "edit");
  $("toggle").title = mode() === "edit" ? "Read (Ctrl+E)" : "Edit (Ctrl+E)";
  $("toggle").setAttribute("aria-label", mode() === "edit" ? "Switch to reading" : "Switch to editing");
  renderTabs();
}

let tabDragged = false;      // true just after a drag, so the click that ends it doesn't also switch tabs

/** Drag a tab sideways to reorder it (mouse and pen; touch keeps scrolling the strip). */
function startTabDrag(e, t) {
  if (e.button !== 0 || e.pointerType === "touch" || tabs.count < 2) return;
  const strip = $("tabs");
  const startX = e.clientX;
  let dragging = false, target = tabs.all.indexOf(t);
  const mark = (to) => strip.querySelectorAll(".tab").forEach((el, i) => {
    el.classList.toggle("drop-before", dragging && i === to && to <= tabs.all.indexOf(t));
    el.classList.toggle("drop-after", dragging && i === to && to > tabs.all.indexOf(t));
  });
  const move = (ev) => {
    if (!dragging && Math.abs(ev.clientX - startX) < 6) return;
    dragging = true;
    strip.classList.add("reordering");
    const els = [...strip.querySelectorAll(".tab")];
    target = els.findIndex((el) => ev.clientX < el.getBoundingClientRect().right);
    if (target < 0) target = els.length - 1;
    mark(target);
  };
  const up = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", up);
    strip.classList.remove("reordering");
    if (!dragging) return;
    tabDragged = true; setTimeout(() => { tabDragged = false; }, 0);
    tabs.move(t.id, target);
    renderTabs();
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", up);
}

/** Move the active tab one place left (-1) or right (+1). */
function moveTab(dir) {
  const t = cur();
  if (!t) return;
  const to = tabs.all.indexOf(t) + dir;
  if (to < 0 || to >= tabs.count) return;
  tabs.move(t.id, to);
  renderTabs();
}

/** The tab strip: one button per open file with a close (x) button; rebuilt on every change. */
function renderTabs() {
  const strip = $("tabs");
  const hadFocus = strip.contains(document.activeElement);
  const active = cur();
  strip.replaceChildren(...tabs.all.map((t) => {
    const el = document.createElement("div");
    el.className = "tab" + (t === active ? " active" : "");
    el.title = platform.mobile ? t.name : t.ref || t.name;
    const main = document.createElement("button");
    main.className = "tab-main"; main.dataset.tab = t.id;
    if (t === active) main.setAttribute("aria-current", "true");
    if (t.dirty) {
      const dot = document.createElement("span"); dot.className = "dot"; dot.setAttribute("aria-hidden", "true"); dot.textContent = "●";
      main.append(dot);
    }
    main.append(t.name);
    if (t.dirty) { const sr = document.createElement("span"); sr.className = "sr-only"; sr.textContent = " (unsaved changes)"; main.append(sr); }
    main.onclick = () => { if (!tabDragged) activateTab(t.id); };
    main.onpointerdown = (e) => startTabDrag(e, t);
    main.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t.id); } };
    main.onmousedown = (e) => { if (e.button === 1) e.preventDefault(); };   // no middle-click autoscroll
    main.onkeydown = (e) => {
      const i = tabs.all.indexOf(t);
      const go = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.count - 1 }[e.key];
      if (go !== undefined && tabs.all[go]) { e.preventDefault(); activateTab(tabs.all[go].id); }
      if (e.key === "Delete") { e.preventDefault(); closeTab(t.id); }
    };
    const x = document.createElement("button");
    x.className = "tab-x"; x.innerHTML = svg("close"); x.title = "Close"; x.setAttribute("aria-label", `Close ${t.name}`);
    x.onclick = (e) => { e.stopPropagation(); closeTab(t.id); };
    el.append(main, x);
    return el;
  }));
  const activeMain = strip.querySelector(".tab.active .tab-main");
  activeMain?.scrollIntoView({ inline: "nearest", block: "nearest" });
  if (hadFocus) activeMain?.focus({ preventScroll: true });
}

const imageBlobs = new Map();
let imageUrls = [];      // temporary addresses of the images shown in the reader, released on the next render

/** Open a file linked from the document (a relative link or a [[wikilink]]), then jump to its heading if one was given. */
async function openLinkedFile(path, fragment = "") {
  const t = cur();
  if (!t?.ref || !platform.openLinked) { toast("Linked files open on desktop only, from a saved file."); return; }
  try {
    const abs = await platform.openLinked(t.ref, path);
    await openRef(abs, baseName(abs));
    if (fragment && cur()?.mode === "read" && readerReady) setTimeout(() => $("reader").contentWindow.scrollToAnchor(fragment), 150);
  } catch (e) {
    logError("Open linked file", e);
    toast(`Could not open ${path}: ${e.message || e}`);
  }
}

function render(scroll = 0) {
  imageUrls.forEach((u) => URL.revokeObjectURL(u)); imageUrls = []; imageBlobs.clear();
  if (readerReady && cur()) { $("reader").contentWindow.render(editor.getText(), scroll); refreshFindSoon(); }
}

/** Store the visible editor/reader view in the active tab before leaving it. */
function snapshot() {
  const t = cur();
  if (!t) return;
  t.state = editor.getState();
  t.scroll = t.mode === "edit" ? editor.scrollFraction() : readerReady ? $("reader").contentWindow.scrollFraction() : 0;
}

/** Make the active tab visible: load its state into the editor and render or focus it. */
function show() {
  const t = cur();
  if (!t) { editor.setText(""); renderRecents(); updateChrome(); return; }
  editor.setState(t.state);
  updateChrome();
  if (t.mode === "read") render(t.scroll);
  else { editor.scrollToFraction(t.scroll); editor.view.focus(); refreshFindSoon(); }
}

function openTab(props) {
  snapshot();
  const text = props.text ?? "";
  const saved = props.saved ?? text;     // a recovered draft opens with its unsaved text and the text it was based on
  tabs.add({ ...props, saved, dirty: text !== saved, draftKey: props.draftKey || newDraftKey(), state: editor.newState(text) });
  show();
}

function activateTab(id) {
  if (cur()?.id === id) { updateChrome(); return; }
  snapshot();
  tabs.activate(id);
  show();
  checkExternal();
}

function cycleTab(dir) {
  if (tabs.count < 2) return;
  snapshot();
  tabs.cycle(dir);
  show();
}

async function closeTab(id = cur()?.id) {
  const t = tabs.find(id);
  if (!t) return;
  if (t.dirty && !(await platform.confirm(`"${t.name}" has unsaved changes. Discard them?`, "Unsaved changes"))) return;
  const wasActive = t === cur();
  if (wasActive) snapshot();
  if (t.ref || t.saved || t.dirty) closed = pushClosed(closed, { ref: t.ref, name: t.name, saved: t.saved, dirty: t.dirty, mode: t.mode, scroll: t.scroll, state: t.state, draftKey: t.draftKey });
  hdb.deleteDraft(t.draftKey);
  tabs.close(id);
  if (wasActive) show(); else updateChrome();
}

// ------------------------------------------------------------------ undo, history and recovery
let closed = [];                                   // recently closed tabs, kept for this session: "Reopen closed tab"
const newDraftKey = () => (crypto.randomUUID ? crypto.randomUUID() : `d${Date.now()}${Math.random()}`);
const historyOn = () => store.get("history", true);
const recoverOn = () => store.get("recover", true);
const withTimeout = (p, ms = 1500) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

function updateUndoButtons() {
  if (mode() !== "edit") return;
  $("btn-undo").disabled = !editor.canUndo();
  $("btn-redo").disabled = !editor.canRedo();
}

function reopenClosed() {
  const c = closed.pop();
  if (!c) { toast("No closed tabs to reopen"); return; }
  const open = tabs.findByRef(c.ref);
  if (open) { activateTab(open.id); return; }
  snapshot();
  tabs.add({ ...c });
  show();
}

let draftTimer = null;
function scheduleDraft() {
  if (!recoverOn()) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(flushDrafts, 2500);
}
/** Write a draft for every tab with unsaved changes (and drop the drafts of tabs that are clean). */
function flushDrafts() {
  clearTimeout(draftTimer);
  if (!recoverOn()) return;
  for (const t of tabs.all) {
    if (t.dirty) { hdb.putDraft({ key: t.draftKey, ref: t.ref, name: t.name, text: textOf(t), saved: t.saved, t: Date.now() }); t.hasDraft = true; }
    else if (t.hasDraft) { hdb.deleteDraft(t.draftKey); t.hasDraft = false; }
  }
}

async function offerRecovery() {
  const all = await hdb.allDrafts();
  const drafts = draftsToOffer(all);
  for (const d of all) if (!drafts.includes(d)) hdb.deleteDraft(d.key);
  if (!drafts.length || !recoverOn()) return;
  const d = $("dialog");
  dialogReturn = document.activeElement;
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = "Recover unsaved work?";
  const p = document.createElement("p"); p.className = "about";
  p.textContent = `ArkMD closed with unsaved changes in ${drafts.length === 1 ? "this file" : `these ${drafts.length} files`}. Restoring opens each with its unsaved text; saving writes it over the file.`;
  const rows = drafts.map((x) => { const r = document.createElement("div"); r.className = "keyrow"; r.innerHTML = `<span class="what"></span><span class="keys"></span>`; r.querySelector(".what").textContent = x.name; r.querySelector(".keys").textContent = formatWhen(x.t, Date.now()); return r; });
  const button = (label, fn) => { const b = document.createElement("button"); b.className = "opt"; b.textContent = label; b.onclick = fn; return b; };
  const restore = button(drafts.length === 1 ? "Restore" : "Restore all", () => {
    closeDialog();
    for (const x of drafts) openTab({ ref: x.ref, name: x.name, text: x.text, saved: x.saved, draftKey: x.key, mode: "edit" });
    toast("Unsaved work restored");
  });
  const discard = button("Discard", async () => { closeDialog(); await hdb.clearDrafts(); });
  d.className = "settings";
  d.replaceChildren(h, p, ...rows, restore, discard);
  $("dialog-backdrop").hidden = false;
  restore.focus({ preventScroll: true });
}

/** The history dialog for the current file: earlier versions kept each time it was saved. */
async function showHistory() {
  const t = cur();
  if (!t) return;
  const d = $("dialog");
  dialogReturn = document.activeElement;
  d.className = "settings";
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = `History: ${t.name}`;
  const msg = (text) => { const p = document.createElement("p"); p.className = "about"; p.textContent = text; return p; };
  const close = document.createElement("button"); close.className = "opt done"; close.textContent = "Close"; close.onclick = closeDialog;
  const nodes = [h];
  let versions = [];
  if (!t.ref) nodes.push(msg("This file hasn't been saved yet. Once it has, ArkMD keeps the earlier text each time you save."));
  else if (!historyOn()) nodes.push(msg("File history is off. Turn it on in Settings."));
  else {
    versions = await hdb.versionsFor(fileKey(t.ref));
    if (!versions.length) nodes.push(msg("No earlier versions yet. ArkMD keeps the previous text each time you save."));
    else nodes.push(msg("Earlier versions of this file, kept on this device each time you saved. Choose one to preview it."));
  }
  for (const v of versions) {
    const b = document.createElement("button"); b.className = "opt row";
    b.innerHTML = `<span class="label"></span><span class="value"></span>`;
    b.querySelector(".label").textContent = formatWhen(v.t, Date.now());
    b.querySelector(".value").textContent = formatSize(v.size) + "  ›";
    b.onclick = () => showVersion(t, v);
    nodes.push(b);
  }
  nodes.push(close);
  d.replaceChildren(...nodes);
  $("dialog-backdrop").hidden = false;
  d.querySelector(".opt")?.focus({ preventScroll: true });
}

async function showVersion(t, v) {
  const rec = await hdb.getVersion(v.id);
  if (!rec) { toast("That version is no longer available"); return showHistory(); }
  const d = $("dialog");
  d.className = "settings";
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = formatWhen(v.t, Date.now());
  const { added, removed } = lineDelta(rec.text, t === cur() ? editor.getText() : docText(t.state));
  const p = document.createElement("p"); p.className = "about";
  p.textContent = added || removed ? `Compared with the text now open: ${added} ${added === 1 ? "line differs" : "lines differ"} here, ${removed} in the open text.` : "The same as the text now open.";
  const pre = document.createElement("pre"); pre.className = "preview"; pre.textContent = rec.text; pre.tabIndex = 0; pre.setAttribute("aria-label", "Version text");
  const button = (label, fn) => { const b = document.createElement("button"); b.className = "opt"; b.textContent = label; b.onclick = fn; return b; };
  const restore = button("Restore into the editor", () => {
    closeDialog();
    if (t !== cur()) activateTab(t.id);
    if (t.mode === "read") toggleMode();
    editor.replaceAll(rec.text);
    toast("Restored. Undo goes back; Save keeps it.");
  });
  const asTab = button("Open as a new tab", () => {
    closeDialog();
    openTab({ ref: null, name: t.name.replace(/\.[^.]*$/, "") + " (earlier version).md", text: rec.text, mode: "read" });
  });
  const back = button("Back to the list", showHistory);
  d.replaceChildren(h, p, pre, restore, asTab, back);
  restore.focus({ preventScroll: true });
}

/** Used when the whole window closes: one question covering every file with unsaved changes. */
async function confirmQuit() {
  const dirty = tabs.dirty();
  if (!dirty.length) return true;
  return platform.confirm(
    dirty.length === 1 ? `"${dirty[0].name}" has unsaved changes. Discard them?` : `${dirty.length} files have unsaved changes. Discard them?`,
    "Unsaved changes");
}

const opening = new Set();
async function openRef(ref, name) {
  const existing = tabs.findByRef(ref);
  if (existing) { activateTab(existing.id); addRecent(ref, name); return; }   // already open: switch to it
  if (opening.has(ref)) return;
  opening.add(ref);
  try {
    const text = (await platform.readFile(ref)).replace(/^\uFEFF/, "");
    const same = tabs.findSame(name, text);
    if (same) { activateTab(same.id); addRecent(ref, name); return; }   // same file via another reference
    openTab({ ref, name, text, mode: "read" });
    addRecent(ref, name);
  } catch (e) {
    logError("Open file", e);
    toast(`Could not open ${name}: ${e.message || e}`);
    removeRecent(ref);
    renderRecents();
  } finally {
    opening.delete(ref);
  }
}

async function openFile() {
  const picked = await platform.openFile().catch((e) => (toast(String(e.message || e)), null));
  if (picked) await openRef(picked.ref, picked.name);
}

function newFile() {
  openTab({ ref: null, name: tabs.untitledName(), text: "", mode: "edit" });
}

const readDisk = async (t) => (await platform.readFile(t.ref)).replace(/^\uFEFF/, "");

/** Whether the file now holds something other than what ArkMD loaded or last wrote (another program changed it). */
async function changedOnDisk(t) {
  if (!t.ref) return false;
  try { return (await readDisk(t)) !== t.saved; } catch { return false; }      // unreadable or gone: nothing to compare
}

async function save(as = false, quiet = false) {
  const t = cur();
  if (!t) return;
  if (t.ref && !as && !quiet && await changedOnDisk(t)) {
    const choice = await ask("File changed on disk", `${t.name} was changed by another program after ArkMD opened it. Saving replaces those changes with yours.`,
      ["Save anyway", "Save as a copy…", "Cancel"]);
    if (choice === 1) return save(true);
    if (choice !== 0) return;
    t.warnedDisk = false;
  }
  const text = editor.getText();
  t.saving = true;
  try {
    if (!t.ref || as) {
      const r = await platform.saveAs(t.name.includes(".") ? t.name : t.name + ".md", text);
      if (!r) return;
      t.ref = r.ref; t.name = r.name;
    } else {
      // Keep the text being replaced as a version first; a history problem never blocks the save.
      // An autosave keeps a version at most every few minutes, so history isn't filled by every pause in typing.
      if (historyOn() && (!quiet || Date.now() - (t.versionAt || 0) > 5 * 60 * 1000)) {
        t.versionAt = Date.now();
        await withTimeout(hdb.addVersion(fileKey(t.ref), t.name, t.saved)).catch(() => {});
      }
      await platform.writeFile(t.ref, text);
    }
    t.saved = text;
    t.dirty = textOf(t) !== text;            // typing may have continued while a dialog was open
    addRecent(t.ref, t.name);
    if (!t.dirty) { hdb.deleteDraft(t.draftKey); t.hasDraft = false; }
    updateChrome();
    if (!quiet) toast("Saved");
  } catch (e) {
    logError("Save", e);
    toast(`Could not save: ${e.message || e}`);
  } finally {
    t.saving = false;
  }
}

/** When the window or a tab comes back into view: reload an unchanged tab whose file changed, or warn about a changed one. */
async function checkExternal(t = cur()) {
  if (!t || !t.ref || t.checking || t.saving) return;
  t.checking = true;
  try {
    let disk;
    try { disk = await readDisk(t); } catch { return; }
    if (disk === t.saved) { t.warnedDisk = false; return; }
    if (!t.dirty) {
      t.saved = disk;
      t.state = editor.newState(disk);
      if (cur() === t) {
        const f = t.mode === "edit" ? editor.scrollFraction() : readerReady ? $("reader").contentWindow.scrollFraction() : 0;
        editor.setState(t.state);
        if (t.mode === "read") render(f); else editor.scrollToFraction(f);
        updateChrome();
      }
      toast(`${t.name} changed on disk and was reloaded`);
    } else if (!t.warnedDisk) {
      t.warnedDisk = true;
      toast(`${t.name} changed on disk. Saving will ask before replacing it.`);
    }
  } finally { t.checking = false; }
}

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  const t = cur();
  if (!t || !t.ref || !t.dirty || !store.get("autosave", false)) return;
  autosaveTimer = setTimeout(async () => {
    if (cur() !== t || !t.dirty || !store.get("autosave", false)) return;
    if (await changedOnDisk(t)) { if (!t.warnedDisk) { t.warnedDisk = true; toast(`${t.name} changed on disk, so it wasn't autosaved. Save to choose what to keep.`); } return; }
    await save(false, true);
  }, 2500);
}

function toggleMode() {
  const t = cur();
  if (!t) return;
  if (t.mode === "read") {
    const f = readerReady ? $("reader").contentWindow.scrollFraction() : 0;
    t.mode = "edit";
    updateChrome();
    editor.scrollToFraction(f);
    editor.view.focus();
    refreshFindSoon();
  } else {
    const f = editor.scrollFraction();
    t.mode = "read";
    render(f);
    updateChrome();
  }
}

// ------------------------------------------------------------------ recents
function recents() { return store.get("recent", []).map((r) => ({ ref: r.ref ?? r.path, name: r.name })); }
function addRecent(ref, name) {
  store.set("recent", [{ ref, name, t: Date.now() }, ...recents().filter((r) => r.ref !== ref)].slice(0, 20));
}
function removeRecent(ref) { store.set("recent", recents().filter((r) => r.ref !== ref)); }
function renderRecents() {
  const list = $("recent");
  list.replaceChildren();
  for (const r of recents()) {
    const li = document.createElement("li");
    const b = document.createElement("button"); b.className = "recent-item";
    const name = document.createElement("span"); name.className = "name"; name.textContent = r.name;
    b.append(name);
    if (!platform.mobile) {
      const where = document.createElement("span"); where.className = "path"; where.textContent = r.ref;
      b.append(where);
    }
    b.onclick = () => openRef(r.ref, r.name);
    li.append(b);
    list.append(li);
  }
  $("no-recent").hidden = recents().length > 0;
  $("clear-recent").hidden = recents().length === 0;
}

// ------------------------------------------------------------------ formatting panel
function tabEdit(dir) {
  const [s, e] = editor.selection();
  const text = editor.docString();
  const edit = F.shiftHeading(text, s, e, dir) || F.indentList(text, s, e, dir) || (text.slice(s, e).includes("\n") ? null : F.tableTab(text, dir > 0 ? e : s, dir > 0 ? e : s, dir));
  if (!edit) return false;
  editor.applyEdit(edit);
  return true;
}

function format(op) {
  const [s, e] = editor.selection();
  editor.applyEdit(op(editor.docString(), s, e));   // docString: the same character positions as the selection, also in CRLF files
}

function buildFormatBar() {
  const bar = $("formatbar");
  const items = [
    ["heading", "Heading (Ctrl+1 to 6)", (b) => menu(b, [1, 2, 3, 4, 5, 6].map((n) => [`Heading ${n}`, () => format((t, s, e) => F.heading(t, s, e, n))])
      .concat([["Normal text", () => format((t, s, e) => F.heading(t, s, e, 0))]]))],
    ["bold", "Bold (Ctrl+B)", () => format((t, s, e) => F.wrap(t, s, e, "**"))],
    ["italic", "Italic (Ctrl+I)", () => format((t, s, e) => F.wrap(t, s, e, "*"))],
    ["strike", "Strikethrough (Ctrl+Shift+X)", () => format((t, s, e) => F.wrap(t, s, e, "~~"))],
    ["highlight", "Highlight (Ctrl+Shift+H)", () => format((t, s, e) => F.wrap(t, s, e, "=="))],
    ["code", "Inline code (Ctrl+`)", () => format((t, s, e) => F.wrap(t, s, e, "`"))],
    ["link", "Link (Ctrl+K)", () => format(F.link)],
    ["bullets", "Bulleted list (Ctrl+Shift+8)", () => format((t, s, e) => F.list(t, s, e, "bullet"))],
    ["numbers", "Numbered list (Ctrl+Shift+7)", () => format((t, s, e) => F.list(t, s, e, "numbered"))],
    ["task", "Task (Ctrl+Shift+9)", () => format((t, s, e) => F.list(t, s, e, "task"))],
    ["quote", "Quote (Ctrl+Shift+Q)", () => format(F.quote)],
    ["callout", "Callout", (b) => menu(b, F.CALLOUTS.map((c) => [c[0].toUpperCase() + c.slice(1), () => format((t, s, e) => F.callout(t, s, e, c))]))],
    ["codeblock", "Code block (Ctrl+Shift+K)", () => format(F.codeBlock)],
    ["table", "Table", () => format((t, s, e) => F.block(t, s, e, F.TABLE))],
    ["rule", "Divider", () => format((t, s, e) => F.block(t, s, e, F.RULE))],
  ];
  for (const [icon, label, run] of items) {
    const b = document.createElement("button");
    b.innerHTML = svg(icon); b.title = label; b.setAttribute("aria-label", label);
    b.onmousedown = (e) => e.preventDefault();          // keep the editor selection
    b.onclick = () => run(b);
    bar.append(b);
  }
}

// ------------------------------------------------------------------ menus and dialogs
function menu(anchor, entries) {
  const m = $("menu");
  menuReturn = anchor;
  m.replaceChildren(...entries.map(([label, fn]) => {
    if (fn === null) { const h = document.createElement("div"); h.className = "menu-head"; h.setAttribute("role", "presentation"); h.textContent = label; return h; }
    const b = document.createElement("button"); b.textContent = label; b.setAttribute("role", "menuitem");
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => { m.hidden = true; fn(); };
    return b;
  }));
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
  m.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 6 : r.bottom + 6) + "px";
  m.querySelector("button")?.focus({ preventScroll: true });
}
let menuReturn = null;
function closeMenu() { if ($("menu").hidden) return; $("menu").hidden = true; menuReturn?.focus?.({ preventScroll: true }); }

const HOLD = Symbol("hold");   // an onPick that opens another dialog returns this so `after` doesn't run yet

/** A list dialog. `after` runs once a choice has been applied (the Settings dialog uses it to come back). */
function choose(title, sections, selected, onPick, after) {
  const d = $("dialog");
  const h = document.createElement("h2"); h.textContent = title; h.id = "dialog-title";
  dialogReturn = document.activeElement;
  const nodes = [h];
  for (const [header, items] of sections) {
    if (header) { const s = document.createElement("div"); s.className = "section"; s.textContent = header; nodes.push(s); }
    for (const it of items) {
      const b = document.createElement("button");
      if (it.action) {
        b.className = "opt act";
        b.innerHTML = `<span><div class="label"></div></span>`;
      } else {
        b.className = "opt" + (it.key === selected ? " sel" : "");
        b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(it.key === selected));
        b.innerHTML = `<span class="dot"></span><span><div class="label"></div>${it.sub ? '<div class="sub"></div>' : ""}</span>`;
      }
      b.querySelector(".label").textContent = it.label;
      if (it.font) b.querySelector(".label").style.fontFamily = it.font;
      if (it.sub) b.querySelector(".sub").textContent = it.sub;
      if (it.swatch) {
        const sw = document.createElement("span"); sw.className = "swatch";
        sw.innerHTML = it.swatch.map((c) => `<i style="background:${c}"></i>`).join("");
        b.append(sw);
      }
      b.onclick = async () => { closeDialog(); const r = await onPick(it.key); if (r !== HOLD) after?.(); };
      nodes.push(b);
    }
  }
  d.replaceChildren(...nodes);
  $("dialog-backdrop").hidden = false;
  const sel = d.querySelector(".sel") || d.querySelector(".opt");
  sel?.scrollIntoView({ block: "center" });
  sel?.focus({ preventScroll: true });
}
let dialogReturn = null;
let pendingAsk = null;
function closeDialog() {
  if (pendingAsk) { const r = pendingAsk; pendingAsk = null; r(-1); }
  if ($("dialog-backdrop").hidden) return;
  $("dialog-backdrop").hidden = true;
  $("dialog").className = "";
  dialogReturn?.focus?.({ preventScroll: true });
}

/** A message with a few buttons; resolves with the index of the one chosen, or -1 for Esc or a click outside. */
function ask(title, message, buttons) {
  const d = $("dialog");
  dialogReturn = document.activeElement;
  d.className = "";
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = title;
  const p = document.createElement("p"); p.className = "about"; p.textContent = message;
  return new Promise((resolve) => {
    pendingAsk = resolve;
    const items = buttons.map((label, i) => {
      const b = document.createElement("button"); b.className = "opt"; b.textContent = label;
      b.onclick = () => { pendingAsk = null; closeDialog(); resolve(i); };
      return b;
    });
    d.replaceChildren(h, p, ...items);
    $("dialog-backdrop").hidden = false;
    items[0].focus({ preventScroll: true });
  });
}

// Custom themes: the CSS files the user imported, kept as text in settings and read again at start.
const userKeys = () => Object.keys(themes).filter((k) => k.startsWith("user:"));
const swatchOf = (raw) => { const t = effective(raw); return { label: t.name, swatch: [t.bg, t.h1, t.h2, t.h3, t.h4] }; };

function loadUserThemes() {
  for (const { id, css, file } of store.get("userThemes", [])) {
    try { themes[id] = parseThemeCss(css, themes, file).theme; } catch { /* a stored file that no longer reads is skipped */ }
  }
}

async function importTheme() {   // resolves when done, or when the picker was cancelled
  const file = await platform.openThemeFile();
  if (!file) return;
  try {
    const css = await platform.readFile(file.ref);
    const { theme: t, ignored } = parseThemeCss(css, themes, file.name);
    const saved = store.get("userThemes", []);
    const id = newThemeId(t.name, saved.map((s) => s.id));
    store.set("userThemes", [...saved, { id, css, file: file.name }]);
    themes[id] = t;
    store.set("theme", id); theme = t; applyLook();
    toast(`Theme "${t.name}" added` + (ignored.length ? ` (${ignored.length} unsupported ${ignored.length === 1 ? "setting" : "settings"} ignored)` : ""));
  } catch (e) {
    toast(`Couldn't use that file: ${e.message || e}`);
  }
}

function removeTheme(after) {
  const items = userKeys().map((key) => ({ key, ...swatchOf(themes[key]) }));
  choose("Remove a custom theme", [[null, items]], null, async (key) => {
    if (!(await platform.confirm(`Remove the theme "${themes[key].name}"?`, "Remove theme"))) return;
    store.set("userThemes", store.get("userThemes", []).filter((s) => s.id !== key));
    delete themes[key];
    if (store.get("theme", DEFAULT_THEME) === key) { store.set("theme", DEFAULT_THEME); theme = themes[DEFAULT_THEME]; applyLook(); }
    toast("Theme removed");
  }, after);
}

function pickTheme(after) {
  const builtin = (dark) => Object.entries(themes).filter(([k, t]) => !k.startsWith("user:") && !!t.dark === dark)
    .map(([key, raw]) => ({ key, ...swatchOf(raw) })).sort((a, b) => a.label.localeCompare(b.label));
  const custom = userKeys().map((key) => ({ key, ...swatchOf(themes[key]) }));
  const actions = [{ key: "__import", label: "Add a theme from a CSS file…", action: true }];
  if (custom.length) actions.push({ key: "__remove", label: "Remove a custom theme…", action: true });
  const sections = [["Dark", builtin(true)], ["Light", builtin(false)]];
  if (custom.length) sections.push(["Custom", custom]);
  sections.push([null, actions]);
  choose("Theme", sections, store.get("theme", DEFAULT_THEME), (key) => {
    if (key === "__import") return importTheme();
    if (key === "__remove") { removeTheme(after); return HOLD; }
    store.set("theme", key); theme = themes[key]; applyLook();
  }, after);
}

function pickFont(title, setting, after) {
  const ordered = [...FONTS].sort((a, b) => (a.id === "system" ? -1 : b.id === "system" ? 1 : a.name.localeCompare(b.name)));   // System first, then A to Z
  const items = ordered.map((f) => ({ key: f.id, label: f.name, sub: f.note, font: f.dir ? `ArkPrev-${f.id}, var(--font-ui)` : "var(--font-ui)" }));
  choose(title, [[null, items]], store.get(setting, "system"), (id) => { store.set(setting, id); applyLook(); }, after);
}

function pickWidth(after) {
  choose("Content width", [[null, WIDTHS.map((w) => ({ key: w.key, label: w.key === "wide" ? "Wide (default)" : w.label, sub: w.sub }))]], contentWidth().key, (key) => {
    store.set("contentWidth", key); applyLook();
  }, after);
}

function pickSize(after) {
  const def = platform.mobile ? 18 : 16;
  choose("Text size", [[null, SIZES.map((s) => ({ key: s, label: s === def ? `${s} (default)` : `${s}` }))]], textSize(), (s) => {
    store.set("fontSize", s); applyLook();
  }, after);
}

function addMenu() {
  const hint = (label, keys) => (platform.mobile ? label : `${label}    ${keys}`);
  const entries = [[hint("New file", "Ctrl+N"), newFile], [hint("Open file…", "Ctrl+O"), openFile]];
  const rec = recents().slice(0, 8);
  if (rec.length) { entries.push(["Recent", null]); for (const r of rec) entries.push([r.name, () => openRef(r.ref, r.name)]); }
  if (closed.length) entries.push([hint("Reopen closed tab", "Ctrl+Shift+T"), reopenClosed]);
  menu($("btn-add"), entries);
}

const REPO_URL = "https://github.com/cj0r/arkmd";

// ------------------------------------------------------------------ updates
let pendingUpdate = null;      // { version, notes } found by a check and not yet installed
let checking = false;

function updateBadge() {
  const more = $("btn-more");
  more.classList.toggle("badge", !!pendingUpdate);
  more.setAttribute("aria-label", pendingUpdate ? `More (update ${pendingUpdate.version} available)` : "More");
}

/** Ask the platform for a newer release. A quiet check (the automatic one) only marks the More button. */
async function checkForUpdates(quiet = false) {
  if (!platform.update || checking) return;
  checking = true;
  if (!quiet) toast("Checking for updates…");
  try {
    const found = await platform.update.check();
    store.set("updateChecked", Date.now());
    pendingUpdate = found;
    updateBadge();
    if (!found) { if (!quiet) toast(`ArkMD ${await platform.version()} is up to date`); return; }
    if (!quiet) showUpdate();
  } catch (e) {
    logError("Update check", e);
    if (!quiet) toast(`Could not check for updates: ${e.message || e}`);
  } finally {
    checking = false;
  }
}

function showUpdate() {
  if (!pendingUpdate) return;
  const d = $("dialog");
  dialogReturn = document.activeElement;
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = `ArkMD ${pendingUpdate.version} is available`;
  const para = (text, cls = "about") => { const p = document.createElement("p"); p.className = cls; p.textContent = text; return p; };
  const notes = para(summarizeNotes(pendingUpdate.notes), "about notes");
  const status = para("", "about"); status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  const button = (label, fn) => { const b = document.createElement("button"); b.className = "opt"; b.textContent = label; b.onclick = fn; return b; };
  const now = button("Update now", () => installUpdate(status, [now, later, notesBtn]));
  const later = button("Later", closeDialog);
  const notesBtn = button("Release notes", () => { platform.openUrl(`${REPO_URL}/releases/tag/v${pendingUpdate.version}`).catch(() => {}); });
  d.replaceChildren(h, para(`You have ${shownVersion}.`), notes, status, now, later, notesBtn);
  $("dialog-backdrop").hidden = false;
  now.focus({ preventScroll: true });
}

let shownVersion = "";
async function installUpdate(status, buttons) {
  const dirty = tabs.dirty();
  if (dirty.length && !(await platform.confirm(
    `${dirty.length === 1 ? `"${dirty[0].name}" has` : `${dirty.length} files have`} unsaved changes, and ArkMD restarts to finish the update. Discard them and update?`, "Unsaved changes"))) return;
  buttons.forEach((b) => (b.disabled = true));
  status.textContent = "Downloading…";
  try {
    const result = await platform.update.install((done, total) => {
      status.textContent = total ? `Downloading… ${Math.min(100, Math.round((done / total) * 100))}%` : `Downloading… ${(done / 1048576).toFixed(1)} MB`;
    });
    if (result.needsPermission) {
      status.textContent = "Allow ArkMD to install updates in the settings that just opened, then choose Update now again.";
      buttons.forEach((b) => (b.disabled = false));
      return;
    }
    status.textContent = "Installing…";
  } catch (e) {
    logError("Update install", e);
    status.textContent = `The update failed: ${e.message || e}`;
    buttons.forEach((b) => (b.disabled = false));
  }
}

/** The bundled third-party notices, opened as a tab. */
async function openNotices() {
  const name = "Third-party notices.md";
  const open = tabs.all.find((t) => t.name === name && !t.ref);
  if (open) { activateTab(open.id); return; }
  try {
    const text = await (await fetch("/third-party-notices.md")).text();
    openTab({ ref: null, name, text, mode: "read" });
  } catch (e) {
    toast(`Could not open the notices: ${e.message || e}`);
  }
}

async function about() {
  const d = $("dialog");
  dialogReturn = document.activeElement;
  const v = await platform.version();
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = "ArkMD";
  const line = (text) => { const p = document.createElement("p"); p.className = "about"; p.textContent = text; return p; };
  const button = (label, fn) => { const b = document.createElement("button"); b.className = "opt"; b.textContent = label; b.onclick = fn; return b; };
  shownVersion = v;
  d.replaceChildren(h, line(v ? `Version ${v}` : "Version unknown"), line("A lightweight Markdown viewer and editor."),
    line("Released under the GNU General Public License v3.0."),
    button("Project page", () => { platform.openUrl(REPO_URL).catch(() => {}); }),
    button("Third-party notices", () => { closeDialog(); openNotices(); }),
    ...(platform.update ? [button("Check for updates", () => { closeDialog(); checkForUpdates(); })] : []),
    button("Close", closeDialog));
  $("dialog-backdrop").hidden = false;
  d.querySelector(".opt")?.focus({ preventScroll: true });
}

// ------------------------------------------------------------------ settings
/** The Settings dialog: appearance, updates and About in one place. Rows that pick from a list come back here. */
function openSettings() {
  const d = $("dialog");
  dialogReturn = dialogReturn && !$("dialog-backdrop").hidden ? dialogReturn : document.activeElement;
  d.className = "settings";
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = "Settings";
  const nodes = [h];
  const section = (t) => { const s = document.createElement("div"); s.className = "section"; s.textContent = t; nodes.push(s); };
  const row = (label, value, fn) => {
    const b = document.createElement("button"); b.className = "opt row";
    b.innerHTML = `<span class="label"></span><span class="value"></span>`;
    b.querySelector(".label").textContent = label;
    b.querySelector(".value").textContent = value ? value + "  ›" : "›";
    b.onclick = () => { closeDialog(); fn(); };
    nodes.push(b);
  };
  const toggle = (label, sub, key, dflt, apply) => {
    const b = document.createElement("button"); b.className = "opt row"; b.setAttribute("role", "switch");
    b.innerHTML = `<span><div class="label"></div><div class="sub"></div></span><span class="switch"></span>`;
    b.querySelector(".label").textContent = label; b.querySelector(".sub").textContent = sub;
    const show = () => b.setAttribute("aria-checked", String(!!store.get(key, dflt)));
    show();
    b.onclick = () => { store.set(key, !store.get(key, dflt)); show(); apply?.(store.get(key, dflt)); };
    nodes.push(b);
  };
  const back = () => openSettings();

  section("Appearance");
  row("Theme", effective(theme).name, () => pickTheme(back));
  row("Text size", String(textSize()), () => pickSize(back));
  row("Content width", contentWidth().label, () => pickWidth(back));
  row("Reading font", fontById(store.get("readFont", "system")).name, () => pickFont("Reading font", "readFont", back));
  row("Editing font", fontById(store.get("editFont", "system")).name, () => pickFont("Editing font", "editFont", back));
  toggle("Contrast (WCAG AA)", "Adjust text colors that fall below 4.5:1 contrast. Off shows the official colors.", "contrastAA", true, () => applyLook());

  section("Saving");
  toggle("Autosave", "Saves a file a few seconds after you stop typing. Off by default. Earlier versions are still kept.", "autosave", false,
    (on) => { if (on) scheduleAutosave(); });

  section("History and recovery");
  toggle("Keep file history", "Keeps the previous text each time you save, on this device only.", "history", true);
  toggle("Recover unsaved work", "Saves a draft of unsaved changes every few seconds, so a crash doesn't lose them.", "recover", true,
    (on) => { if (on) flushDrafts(); else hdb.clearDrafts(); });
  row("Clear history and drafts", "", async () => {
    if (await platform.confirm("Delete every saved version and unsaved-work draft kept by ArkMD? Your files aren't touched.", "Clear history")) {
      await hdb.clearVersions(); await hdb.clearDrafts(); for (const t of tabs.all) t.hasDraft = false; toast("History cleared");
    }
  });

  if (platform.update) {
    section("Updates");
    if (pendingUpdate) row(`Update to ${pendingUpdate.version}`, "", showUpdate);
    toggle("Check for updates automatically", "Once a day, a few seconds after ArkMD starts. Off by default.", "autoUpdate", false);
    row("Check for updates now", shownVersion ? `Version ${shownVersion}` : "", () => checkForUpdates());
  }

  if (!platform.mobile) { section("Keyboard"); row("Keyboard shortcuts", "F1", showShortcuts); }

  section("Troubleshooting");
  row("Copy diagnostic information", "", copyDiagnostics);
  if (platform.openLogFolder) row("Open the log folder", "", () => platform.openLogFolder().catch((e) => toast(`Could not open the folder: ${e.message || e}`)));

  section("About");
  row("About ArkMD", "", about);

  const done = document.createElement("button"); done.className = "opt done"; done.textContent = "Done"; done.onclick = closeDialog;
  nodes.push(done);
  d.replaceChildren(...nodes);
  $("dialog-backdrop").hidden = false;
  d.querySelector(".opt")?.focus({ preventScroll: true });
}

function showShortcuts() {
  const d = $("dialog");
  dialogReturn = document.activeElement;
  d.className = "settings";
  const h = document.createElement("h2"); h.id = "dialog-title"; h.textContent = "Keyboard shortcuts";
  const nodes = [h];
  for (const [title, rows] of SHORTCUTS) {
    const s = document.createElement("div"); s.className = "section"; s.textContent = title; nodes.push(s);
    for (const [keys, what] of rows) {
      const r = document.createElement("div"); r.className = "keyrow";
      r.innerHTML = `<span class="what"></span><span class="keys"></span>`;
      r.querySelector(".what").textContent = what;
      r.querySelector(".keys").textContent = keys;
      nodes.push(r);
    }
  }
  const back = document.createElement("button"); back.className = "opt done"; back.textContent = "Back to settings"; back.onclick = () => { closeDialog(); openSettings(); };
  const close = document.createElement("button"); close.className = "opt done"; close.textContent = "Close"; close.onclick = closeDialog;
  nodes.push(back, close);
  d.replaceChildren(...nodes);
  $("dialog-backdrop").hidden = false;
  back.focus({ preventScroll: true });
}

/** The rendered document, ready to print or export: switch to reading mode and wait for the render. */
async function readerForOutput() {
  const t = cur();
  if (!t || !readerReady) return null;
  if (t.mode === "edit") toggleMode(); else render(readerScrollFraction());
  await new Promise((r) => setTimeout(r, 250));
  return $("reader").contentWindow;
}
const readerScrollFraction = () => ($("reader").contentWindow.scrollFraction?.() ?? 0);

async function printDoc() {
  const w = await readerForOutput();
  if (!w) return;
  try { w.focus(); w.print(); } catch (e) { logError("Print", e); toast(`Could not print: ${e.message || e}`); }
}

async function exportHtml() {
  const t = cur();
  const w = await readerForOutput();
  if (!w) return;
  try {
    const name = t.name.replace(/\.(md|markdown|mdown|mkd|txt)$/i, "") + ".html";
    const r = await platform.saveAs(name, await w.exportHtml(t.name), [{ name: "HTML page", extensions: ["html"] }]);
    if (r) toast(`Exported ${r.name}`);
  } catch (e) { logError("Export", e); toast(`Could not export: ${e.message || e}`); }
}

function moreMenu() {
  const open = !!cur();
  const entries = [];
  if (open) entries.push([platform.mobile ? "Save as…" : "Save as…  (Ctrl+Shift+S)", () => save(true)]);
  if (open) entries.push([platform.mobile ? "Close file" : "Close file  (Ctrl+W)", () => closeTab()]);
  if (open) entries.push(["File history…", showHistory]);
  if (open && !platform.mobile) entries.push(["Print…  (Ctrl+P)", printDoc], ["Export as HTML…", exportHtml]);
  if (platform.update && pendingUpdate) entries.push([`Update to ${pendingUpdate.version}…`, showUpdate]);
  entries.push([platform.mobile ? "Settings" : "Settings  (Ctrl+,)", openSettings], ["About", about]);
  menu($("btn-more"), entries);
}

/** Record a failure in the troubleshooting log: what was being done and the error, never document text. */
function logError(context, error, where = "") {
  const text = error instanceof Error ? `${error.message}${error.stack ? "\n" + error.stack.split("\n").slice(0, 4).join("\n") : ""}` : String(error);
  platform.logEvent("error", `${context}: ${text}${where ? " @ " + where : ""}`);
}

/** App version, platform, settings and the end of the log, as text to paste into a bug report. No document text or file paths. */
async function copyDiagnostics() {
  const lines = [
    `ArkMD ${await platform.version()} (${platform.name})`,
    `System: ${navigator.userAgent}`,
    `Window: ${innerWidth}x${innerHeight} at ${devicePixelRatio}x`,
    `Theme: ${effective(theme).name}; text size ${textSize()}; content width ${contentWidth().key}; contrast ${store.get("contrastAA", true) ? "on" : "off"}`,
    `Autosave: ${store.get("autosave", false) ? "on" : "off"}; history: ${historyOn() ? "on" : "off"}; open tabs: ${tabs.count}`,
  ];
  const tail = await platform.logTail();
  const text = lines.join("\n") + (tail ? "\n\nRecent log:\n" + tail : "");
  try { await navigator.clipboard.writeText(text); toast("Diagnostic information copied"); }
  catch { toast("Could not copy to the clipboard"); }
}

let toastTimer;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

// ------------------------------------------------------------------ wiring
function wire() {
  $("btn-add").innerHTML = svg("add");
  $("btn-add").onclick = addMenu;
  $("home-open").onclick = openFile;
  $("home-new").onclick = newFile;
  $("btn-save").onclick = () => save();
  $("btn-undo").onclick = () => editor.undo();
  $("btn-redo").onclick = () => editor.redo();
  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushDrafts(); });
  addEventListener("pagehide", flushDrafts);
  addEventListener("focus", () => checkExternal());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkExternal(); });
  $("btn-theme").onclick = () => pickTheme();   // not pickTheme itself: it would receive the click event as its `after` callback
  $("btn-more").onclick = moreMenu;
  $("btn-outline").innerHTML = svg("outline");
  $("btn-outline").onclick = toggleOutline;
  wireFind();
  $("outline").addEventListener("keydown", outlineKey);
  $("btn-format").onclick = () => { store.set("formatBar", !store.get("formatBar", true)); updateChrome(); };
  $("toggle").onclick = toggleMode;
  $("clear-recent").onclick = () => { store.set("recent", []); renderRecents(); };
  $("dialog-backdrop").onclick = (e) => { if (e.target.id === "dialog-backdrop") closeDialog(); };
  // Close the menu on any tap or click outside it (pointerdown works for touch and mouse).
  document.addEventListener("pointerdown", (e) => { if (!$("menu").contains(e.target)) $("menu").hidden = true; });
  // The outline closes on a tap or click outside it (the toggle button handles its own click).
  document.addEventListener("pointerdown", (e) => { if (!$("outline").contains(e.target) && !$("btn-outline").contains(e.target)) closeOutline(); });

  document.addEventListener("keydown", onKey);

  // Links in the reader open in the system browser (viewer.html calls this when embedded).
  window.arkToggleTask = (line, checked) => editor.setTask(line, checked);
  window.arkOpenLink = (href) => {
    const link = parseLink(href);
    if (link?.kind === "external") platform.openUrl(link.url).catch(() => {});
    else if (link?.kind === "file") openLinkedFile(link.path, link.fragment);
  };
  window.arkOpenWikilink = (text) => { const w = wikilinkTarget(text); if (w) openLinkedFile(w.path, w.fragment); };
  // Images next to the document: read by the app (desktop only) and shown from a temporary address.
  window.arkLoadImage = async (src) => {
    const t = cur();
    const link = parseLink(src);
    const type = link?.kind === "file" && imageType(link.path);
    if (!t?.ref || !platform.readLinkedImage || !type) throw new Error("not available");
    const bytes = await platform.readLinkedImage(t.ref, link.path);
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    imageUrls.push(url); imageBlobs.set(url, blob);
    return url;
  };
  // For Export as HTML: an image shown from a temporary address, as a data: address that works in the saved file.
  window.arkImageData = (url) => new Promise((resolve, reject) => {
    const blob = imageBlobs.get(url);
    if (!blob) return reject(new Error("unknown image"));
    const r = new FileReader();
    r.onload = () => resolve(r.result); r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

  // The reader may finish loading before this runs, so check as well as listen.
  $("reader").addEventListener("load", onReaderLoad);
  if ($("reader").contentDocument?.readyState === "complete" && $("reader").contentWindow?.render) onReaderLoad();

  platform.onCloseRequested(async () => {
    const ok = await confirmQuit();
    if (ok) await withTimeout(hdb.clearDrafts());      // quitting on purpose: nothing to recover next time
    return ok;
  });
  // Android back button: close menus/dialogs, then the current tab; with no tabs, let the system handle it.
  platform.onBack(() => {
    if (!$("menu").hidden) { $("menu").hidden = true; return true; }
    if (!$("dialog-backdrop").hidden) { closeDialog(); return true; }
    if (tabs.count) { closeTab(); return true; }
    return false;
  });
  // A second launch of the app (file manager "Open with") adds its file here as a tab.
  platform.onOpenRequest((path) => openRef(path, path.split(/[\\/]/).pop()));
}

function onKey(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === "Escape") { closeMenu(); closeDialog(); closeOutline(); }
  // Arrow keys move between menu items / dialog options.
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && (!$("menu").hidden || !$("dialog-backdrop").hidden)) {
    const items = [...(!$("menu").hidden ? $("menu") : $("dialog")).querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    e.preventDefault();
  }
  if (e.key === "F1") { e.preventDefault(); showShortcuts(); return; }
  if (e.key === "F3" && find.open) { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); return; }
  if (!mod) return;
  if (e.shiftKey && (e.key === "PageDown" || e.key === "PageUp")) { e.preventDefault(); moveTab(e.key === "PageUp" ? -1 : 1); return; }
  if (e.key === "Tab" || e.key === "PageDown" || e.key === "PageUp") {
    e.preventDefault(); cycleTab(e.key === "PageUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 1); return;
  }
  if (e.shiftKey && e.key.toLowerCase() === "t") { e.preventDefault(); reopenClosed(); return; }
  if (e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); toggleOutline(); return; }
  if (!e.shiftKey && !e.altKey && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "h")) {
    e.preventDefault(); if (cur()) openFind(e.key.toLowerCase() === "h"); return;
  }
  const act = { o: openFile, p: () => { if (!platform.mobile && cur()) printDoc(); }, n: newFile, t: newFile, w: () => closeTab(), e: toggleMode, s: () => save(e.shiftKey), ",": openSettings }[e.key.toLowerCase()];
  if (act) { e.preventDefault(); act(); }
}

// ---- Find and replace --------------------------------------------------------------------------------------
// One bar for both modes. While editing, matches are drawn in the editor and can be replaced; while reading,
// matches are highlighted in the page (find only; the replace row appears in the editor).
const find = { open: false, replace: false, q: "", r: "", opts: store.get("findOpts", {}), matches: [], count: 0, idx: -1, error: null };
let findTimer;

function findPattern() { return buildPattern(find.q, find.opts); }

function updateFindUi() {
  const label = $("find-count");
  const empty = !find.q;
  label.textContent = empty ? "" : find.error ? "Invalid pattern" : find.count ? `${find.idx + 1} of ${find.count}` : "No results";
  label.title = find.error || "";
  $("find-q").classList.toggle("bad", !!find.error);
  const edit = mode() === "edit";
  $("find-replace-row").hidden = !(find.replace && edit);
  $("find-more").hidden = !edit;
  $("find-more").setAttribute("aria-expanded", String(find.replace && edit));
  $("find-replace-one").disabled = !find.count;
  $("find-replace-all").disabled = !find.count;
  for (const [id, key] of [["find-case", "caseSensitive"], ["find-word", "wholeWord"], ["find-regex", "regex"]]) $(id).setAttribute("aria-pressed", String(!!find.opts[key]));
}

/** Search again. `from`: a position to start from, "keep" to stay on the current match, or null to start at the cursor. */
function runFind(from = null) {
  if (!find.open || !cur()) return;
  if (mode() === "edit") {
    const r = findMatches(editor.docString(), find.q, find.opts);
    find.matches = r.matches; find.error = r.error; find.count = r.matches.length;
    if (from === "keep") find.idx = find.count ? Math.min(Math.max(find.idx, 0), find.count - 1) : -1;
    else find.idx = nextIndex(find.matches, from ?? editor.selection()[0]);
    editor.setFind(find.matches, find.idx, from !== "keep");
  } else if (readerReady) {
    const w = $("reader").contentWindow;
    const p = findPattern();
    find.error = p.error || null; find.matches = [];
    find.count = p.source ? w.findAll(p.source, p.flags) : (w.findClear(), 0);
    find.idx = find.count ? (from === "keep" ? Math.min(Math.max(find.idx, 0), find.count - 1) : 0) : -1;
    if (find.count) w.findStep(find.idx);
  }
  updateFindUi();
}

function findStep(dir) {
  if (!find.count) return;
  find.idx = (find.idx + dir + find.count) % find.count;
  if (mode() === "edit") editor.setFind(find.matches, find.idx, true);
  else $("reader").contentWindow.findStep(find.idx);
  updateFindUi();
}

function selectedText() {
  let s = "";
  if (mode() === "edit") { const [a, b] = editor.selection(); s = editor.docString().slice(a, b); }
  else if (readerReady) s = $("reader").contentWindow.getSelection()?.toString() ?? "";
  return /^[^\n\r]{1,120}$/.test(s) ? s : "";
}

function openFind(withReplace = false) {
  if (!cur()) return;
  closeMenu(); closeOutline();
  if (withReplace && mode() === "read") toggleMode();      // replacing needs the editor
  const seed = selectedText();
  if (seed) { find.q = seed; $("find-q").value = seed; }
  find.open = true;
  find.replace = withReplace || (find.replace && mode() === "edit");
  $("findbar").hidden = false;
  $("btn-find").setAttribute("aria-expanded", "true"); $("btn-find").classList.add("on");
  runFind();
  const input = withReplace && find.q ? $("find-r") : $("find-q");
  input.focus(); input.select();
}

function closeFind(restoreFocus = false) {
  if (!find.open) return;
  find.open = false;
  clearTimeout(findTimer);
  $("findbar").hidden = true;
  $("btn-find").setAttribute("aria-expanded", "false"); $("btn-find").classList.remove("on");
  if (cur()) {
    if (mode() === "edit") { editor.setFind([], -1); if (restoreFocus) editor.view.focus(); }
    else if (readerReady) $("reader").contentWindow.findClear();
  }
}

/** Re-run the search shortly after the document or the view changed. */
function refreshFindSoon() {
  if (!find.open) return;
  clearTimeout(findTimer);
  findTimer = setTimeout(() => { updateFindUi(); runFind("keep"); }, 120);
}

function replaceOne() {
  if (mode() !== "edit" || !find.count) return;
  if (find.idx < 0) find.idx = 0;
  const m = find.matches[find.idx];
  const insert = expandReplacement(m, find.r, find.opts);
  editor.replaceRanges([{ from: m.from, to: m.to, insert }]);
  runFind(m.from + insert.length);
}

function replaceAllMatches() {
  if (mode() !== "edit" || !find.count) return;
  const n = find.count;
  editor.replaceRanges(find.matches.map((m) => ({ from: m.from, to: m.to, insert: expandReplacement(m, find.r, find.opts) })));
  runFind("keep");
  toast(`Replaced ${n} ${n === 1 ? "match" : "matches"}`);
}

function wireFind() {
  $("btn-find").innerHTML = svg("search");
  $("btn-find").onclick = () => (find.open ? closeFind(true) : openFind());
  $("find-q").value = find.q;
  $("find-q").oninput = () => { find.q = $("find-q").value; runFind(); };
  $("find-r").oninput = () => { find.r = $("find-r").value; };
  $("find-next").onclick = () => findStep(1);
  $("find-prev").onclick = () => findStep(-1);
  $("find-close").onclick = () => closeFind(true);
  $("find-more").onclick = () => {
    if (mode() !== "edit") return;
    find.replace = !find.replace; updateFindUi();
    if (find.replace) $("find-r").focus();
  };
  $("find-replace-one").onclick = replaceOne;
  $("find-replace-all").onclick = replaceAllMatches;
  for (const [id, key] of [["find-case", "caseSensitive"], ["find-word", "wholeWord"], ["find-regex", "regex"]]) {
    $(id).onclick = () => { find.opts = { ...find.opts, [key]: !find.opts[key] }; store.set("findOpts", find.opts); runFind(); };
  }
  $("findbar").addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeFind(true); }
    else if (e.key === "Enter" && e.target.id === "find-q") { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
    else if (e.key === "Enter" && e.target.id === "find-r") { e.preventDefault(); if (e.ctrlKey || e.metaKey) replaceAllMatches(); else replaceOne(); }
  });
}

// ---- Outline flyout: the document's headings, to jump to a section ----------------------------------------

/** The headings of the open file: from the text while editing, from the rendered page while reading. */
function outlineItems() {
  if (mode() === "edit") return parseOutline(editor.getText());
  return readerReady ? $("reader").contentWindow.headings() : [];
}

function outlineCurrent(items) {
  if (mode() === "edit") return currentIndex(items, editor.cursorLine());
  return readerReady ? $("reader").contentWindow.currentHeading() : -1;
}

function openOutline() {
  if (!cur()) return;
  closeMenu();
  const panel = $("outline");
  const items = outlineItems();
  const at = outlineCurrent(items);
  panel.replaceChildren();
  const head = document.createElement("div");
  head.className = "outline-head";
  head.textContent = "Outline";
  panel.append(head);
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "muted outline-empty";
    p.textContent = "No headings yet. Start a line with # to add one.";
    panel.append(p);
  }
  const base = items.length ? Math.min(...items.map((h) => h.level)) : 1;   // indent from the shallowest level used
  items.forEach((h, i) => {
    const b = document.createElement("button");
    b.className = "outline-item" + (i === at ? " current" : "");
    b.style.paddingLeft = `${14 + (h.level - base) * 14}px`;
    b.textContent = h.text || "(empty heading)";
    b.title = h.text;
    b.dataset.level = h.level;
    if (i === at) b.setAttribute("aria-current", "location");
    b.onclick = () => { goToHeading(i, items); };
    panel.append(b);
  });
  const foot = document.createElement("div");
  foot.className = "outline-foot";
  foot.textContent = formatStats(stats(editor.getText()));
  panel.append(foot);
  panel.hidden = false;
  $("btn-outline").setAttribute("aria-expanded", "true");
  $("btn-outline").classList.add("on");
  (panel.querySelector(".current") || panel.querySelector(".outline-item"))?.focus({ preventScroll: false });
  panel.querySelector(".current")?.scrollIntoView({ block: "center" });
}

function closeOutline(restoreFocus = false) {
  const panel = $("outline");
  if (panel.hidden) return;
  panel.hidden = true;
  $("btn-outline").setAttribute("aria-expanded", "false");
  $("btn-outline").classList.remove("on");
  if (restoreFocus) $("btn-outline").focus({ preventScroll: true });
}

function toggleOutline() { if ($("outline").hidden) openOutline(); else closeOutline(true); }

function goToHeading(i, items) {
  closeOutline();
  if (mode() === "edit") editor.goToLine(items[i].line);
  else $("reader").contentWindow.scrollToHeading(i);
}

/** Arrow keys, Home and End move through the list; Escape closes it. */
function outlineKey(e) {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeOutline(true); return; }
  const list = [...$("outline").querySelectorAll(".outline-item")];
  const i = list.indexOf(document.activeElement);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
  if (to === undefined || !list.length) return;
  e.preventDefault();
  list[(to + list.length) % list.length].focus();
}

function onReaderLoad() {
  if (readerReady) return;
  readerReady = true;
  // Shortcuts keep working after clicking into the reader (its keys go to the iframe document).
  $("reader").contentDocument.addEventListener("keydown", onKey);
  // Taps inside the reader land in the iframe document, so close the menu from there too.
  $("reader").contentDocument.addEventListener("pointerdown", () => { $("menu").hidden = true; closeOutline(); });
  applyLook();
  if (cur()) render(cur().scroll);
}

// Never fail silently: surface unexpected errors to the user.
window.addEventListener("error", (e) => { logError("Unhandled error", e.error || e.message, `${e.filename || ""}:${e.lineno || 0}`); toast(`Error: ${e.message}`); });
window.addEventListener("unhandledrejection", (e) => { logError("Unhandled promise rejection", e.reason); toast(`Error: ${e.reason?.message || e.reason}`); });

async function init() {
  const style = document.createElement("style"); style.id = "fontfaces"; document.head.append(style);
  themes = await (await fetch("/themes.json")).json();
  const renamed = { "tokyo-night-day": "tokyo-night-light" };   // keys from earlier versions
  loadUserThemes();
  const saved = store.get("theme", DEFAULT_THEME);
  if (renamed[saved]) store.set("theme", renamed[saved]);
  theme = themes[renamed[saved] || saved] || themes[DEFAULT_THEME];
  platform.ready();
  buildFormatBar();
  wire();
  applyLook();
  renderRecents();
  updateChrome();
  setupWindowControls();
  await openLaunch();
  platform.onLaunch(openLaunch);
  shownVersion = await platform.version();
  offerRecovery();
  // The automatic check is off unless the user turned it on; it runs once a day, a few seconds after start.
  if (platform.update && shouldAutoCheck(store.get("autoUpdate", false), store.get("updateChecked", 0), Date.now())) {
    setTimeout(() => checkForUpdates(true), 4000);
  }
}

/** Minimize / maximize / close for windows without a native frame, plus edge handles to resize them. */
async function setupWindowControls() {
  const w = platform.window;
  if (!w || (await w.isDecorated().catch(() => true))) return;
  document.body.classList.add("frameless");
  $("winctl").hidden = false;
  $("win-min").innerHTML = svg("minimize");
  $("win-close").innerHTML = svg("close");
  $("win-min").onclick = () => w.minimize();
  $("win-max").onclick = () => w.toggleMaximize();
  $("win-close").onclick = () => w.close();
  const sync = async () => {
    const max = await w.isMaximized().catch(() => false);
    document.body.classList.toggle("maximized", max);
    $("win-max").innerHTML = svg(max ? "restore" : "maximize");
    $("win-max").title = max ? "Restore" : "Maximize";
    $("win-max").setAttribute("aria-label", max ? "Restore" : "Maximize");
  };
  w.onResized(sync); sync();
  for (const dir of ["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"]) {
    const h = document.createElement("div");
    h.className = "resize"; h.dataset.dir = dir; h.setAttribute("aria-hidden", "true");
    h.onpointerdown = (e) => { e.preventDefault(); w.startResize(dir); };
    document.body.append(h);
  }
}

/** Document the app was opened with (file association, Open with, Share). */
async function openLaunch() {
  const l = await platform.launchFile().catch((e) => (toast(`Could not open file: ${e.message || e}`), null));
  if (!l) return;
  const known = tabs.findByRef(l.ref);
  if (known) { activateTab(known.id); return; }
  openTab({ ref: l.ref, name: l.ref ? l.name : tabs.untitledName(), text: l.text.replace(/^\uFEFF/, ""), mode: "read" });
  if (l.ref) addRecent(l.ref, l.name);
}

init();
