// ArkMD UI, shared by desktop and Android (and iOS later). The reader is the shared viewer.html in an
// iframe; the editor is CodeMirror 6. Files, dialogs and the window go through platform.js.
import { createEditor } from "./editor.js";
import { platform } from "./platform.js";
import * as F from "./format.js";
import { svg } from "./icons.js";
import { createTabs } from "./tabs.js";
import { docText } from "./eol.js";
import { shouldAutoCheck, summarizeNotes } from "./updates.js";
import { parseThemeCss, newThemeId } from "./usertheme.js";

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
  onChange(text) { const t = cur(); if (t) setDirty(t, text !== t.saved); },
  extraKeys: [
    { key: "Mod-b", run: () => (format((t, s, e) => F.wrap(t, s, e, "**")), true) },
    { key: "Mod-i", run: () => (format((t, s, e) => F.wrap(t, s, e, "*")), true) },
    { key: "Mod-k", run: () => (format(F.link), true) },
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

const SIZES = [14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28];
const textSize = () => store.get("fontSize", platform.mobile ? 18 : 16);

function applyLook() {
  const t = effective(theme);
  const size = textSize();
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries({ bg: t.bg, "bg-alt": t.bgAlt, surface: t.surface, fg: t.fg, "fg-muted": t.fgMuted, accent: t.accent, h1: t.h1 }))
    root.setProperty("--" + k, v);
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
    main.onclick = () => activateTab(t.id);
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

function render(scroll = 0) {
  if (readerReady && cur()) $("reader").contentWindow.render(editor.getText(), scroll);
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
  else { editor.scrollToFraction(t.scroll); editor.view.focus(); }
}

function openTab(props) {
  snapshot();
  const text = props.text ?? "";
  tabs.add({ ...props, saved: text, state: editor.newState(text) });
  show();
}

function activateTab(id) {
  if (cur()?.id === id) { updateChrome(); return; }
  snapshot();
  tabs.activate(id);
  show();
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
  tabs.close(id);
  if (wasActive) show(); else updateChrome();
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

async function save(as = false) {
  const t = cur();
  if (!t) return;
  const text = editor.getText();
  try {
    if (!t.ref || as) {
      const r = await platform.saveAs(t.name.includes(".") ? t.name : t.name + ".md", text);
      if (!r) return;
      t.ref = r.ref; t.name = r.name;
    } else {
      await platform.writeFile(t.ref, text);
    }
    t.saved = text;
    t.dirty = textOf(t) !== text;            // typing may have continued while a dialog was open
    addRecent(t.ref, t.name);
    updateChrome();
    toast("Saved");
  } catch (e) {
    toast(`Could not save: ${e.message || e}`);
  }
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
function format(op) {
  const [s, e] = editor.selection();
  editor.applyEdit(op(editor.getText(), s, e));
}

function buildFormatBar() {
  const bar = $("formatbar");
  const items = [
    ["heading", "Heading", (b) => menu(b, [1, 2, 3, 4, 5, 6].map((n) => [`Heading ${n}`, () => format((t, s, e) => F.heading(t, s, e, n))])
      .concat([["Normal text", () => format((t, s, e) => F.heading(t, s, e, 0))]]))],
    ["bold", "Bold (Ctrl+B)", () => format((t, s, e) => F.wrap(t, s, e, "**"))],
    ["italic", "Italic (Ctrl+I)", () => format((t, s, e) => F.wrap(t, s, e, "*"))],
    ["strike", "Strikethrough", () => format((t, s, e) => F.wrap(t, s, e, "~~"))],
    ["highlight", "Highlight", () => format((t, s, e) => F.wrap(t, s, e, "=="))],
    ["code", "Inline code", () => format((t, s, e) => F.wrap(t, s, e, "`"))],
    ["link", "Link (Ctrl+K)", () => format(F.link)],
    ["bullets", "Bulleted list", () => format((t, s, e) => F.list(t, s, e, "bullet"))],
    ["numbers", "Numbered list", () => format((t, s, e) => F.list(t, s, e, "numbered"))],
    ["task", "Task", () => format((t, s, e) => F.list(t, s, e, "task"))],
    ["quote", "Quote", () => format(F.quote)],
    ["callout", "Callout", (b) => menu(b, F.CALLOUTS.map((c) => [c[0].toUpperCase() + c.slice(1), () => format((t, s, e) => F.callout(t, s, e, c))]))],
    ["codeblock", "Code block", () => format(F.codeBlock)],
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
function closeDialog() {
  if ($("dialog-backdrop").hidden) return;
  $("dialog-backdrop").hidden = true;
  $("dialog").className = "";
  dialogReturn?.focus?.({ preventScroll: true });
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
    if (store.get("theme", "tokyo-night") === key) { store.set("theme", "tokyo-night"); theme = themes["tokyo-night"]; applyLook(); }
    toast("Theme removed");
  }, after);
}

function pickTheme(after) {
  const builtin = (dark) => Object.entries(themes).filter(([k, t]) => !k.startsWith("user:") && !!t.dark === dark)
    .map(([key, raw]) => ({ key, ...swatchOf(raw) }));
  const custom = userKeys().map((key) => ({ key, ...swatchOf(themes[key]) }));
  const actions = [{ key: "__import", label: "Add a theme from a CSS file…", action: true }];
  if (custom.length) actions.push({ key: "__remove", label: "Remove a custom theme…", action: true });
  const sections = [["Dark", builtin(true)], ["Light", builtin(false)]];
  if (custom.length) sections.push(["Custom", custom]);
  sections.push([null, actions]);
  choose("Theme", sections, store.get("theme", "tokyo-night"), (key) => {
    if (key === "__import") return importTheme();
    if (key === "__remove") { removeTheme(after); return HOLD; }
    store.set("theme", key); theme = themes[key]; applyLook();
  }, after);
}

function pickFont(title, setting, after) {
  const items = FONTS.map((f) => ({ key: f.id, label: f.name, sub: f.note, font: f.dir ? `ArkPrev-${f.id}, var(--font-ui)` : "var(--font-ui)" }));
  choose(title, [[null, items]], store.get(setting, "system"), (id) => { store.set(setting, id); applyLook(); }, after);
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
  row("Reading font", fontById(store.get("readFont", "system")).name, () => pickFont("Reading font", "readFont", back));
  row("Editing font", fontById(store.get("editFont", "system")).name, () => pickFont("Editing font", "editFont", back));
  toggle("Contrast (WCAG AA)", "Adjust text colors that fall below 4.5:1 contrast. Off shows the official colors.", "contrastAA", true, () => applyLook());

  if (platform.update) {
    section("Updates");
    if (pendingUpdate) row(`Update to ${pendingUpdate.version}`, "", showUpdate);
    toggle("Check for updates automatically", "Once a day, a few seconds after ArkMD starts. Off by default.", "autoUpdate", false);
    row("Check for updates now", shownVersion ? `Version ${shownVersion}` : "", () => checkForUpdates());
  }

  section("About");
  row("About ArkMD", "", about);

  const done = document.createElement("button"); done.className = "opt done"; done.textContent = "Done"; done.onclick = closeDialog;
  nodes.push(done);
  d.replaceChildren(...nodes);
  $("dialog-backdrop").hidden = false;
  d.querySelector(".opt")?.focus({ preventScroll: true });
}

function moreMenu() {
  const open = !!cur();
  const entries = [];
  if (open) entries.push([platform.mobile ? "Save as…" : "Save as…  (Ctrl+Shift+S)", () => save(true)]);
  if (open) entries.push([platform.mobile ? "Close file" : "Close file  (Ctrl+W)", () => closeTab()]);
  if (platform.update && pendingUpdate) entries.push([`Update to ${pendingUpdate.version}…`, showUpdate]);
  entries.push([platform.mobile ? "Settings" : "Settings  (Ctrl+,)", openSettings], ["About", about]);
  menu($("btn-more"), entries);
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
  $("btn-theme").onclick = pickTheme;
  $("btn-more").onclick = moreMenu;
  $("btn-format").onclick = () => { store.set("formatBar", !store.get("formatBar", true)); updateChrome(); };
  $("toggle").onclick = toggleMode;
  $("clear-recent").onclick = () => { store.set("recent", []); renderRecents(); };
  $("dialog-backdrop").onclick = (e) => { if (e.target.id === "dialog-backdrop") closeDialog(); };
  // Close the menu on any tap or click outside it (pointerdown works for touch and mouse).
  document.addEventListener("pointerdown", (e) => { if (!$("menu").contains(e.target)) $("menu").hidden = true; });

  document.addEventListener("keydown", onKey);

  // Links in the reader open in the system browser (viewer.html calls this when embedded).
  window.arkOpenLink = (url) => { if (/^(https?:|mailto:)/i.test(url)) platform.openUrl(url).catch(() => {}); };

  // The reader may finish loading before this runs, so check as well as listen.
  $("reader").addEventListener("load", onReaderLoad);
  if ($("reader").contentDocument?.readyState === "complete" && $("reader").contentWindow?.render) onReaderLoad();

  platform.onCloseRequested(confirmQuit);
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
  if (e.key === "Escape") { closeMenu(); closeDialog(); }
  // Arrow keys move between menu items / dialog options.
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && (!$("menu").hidden || !$("dialog-backdrop").hidden)) {
    const items = [...(!$("menu").hidden ? $("menu") : $("dialog")).querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    e.preventDefault();
  }
  if (!mod) return;
  if (e.key === "Tab" || e.key === "PageDown" || e.key === "PageUp") {
    e.preventDefault(); cycleTab(e.key === "PageUp" || (e.key === "Tab" && e.shiftKey) ? -1 : 1); return;
  }
  const act = { o: openFile, n: newFile, t: newFile, w: () => closeTab(), e: toggleMode, s: () => save(e.shiftKey), ",": openSettings }[e.key.toLowerCase()];
  if (act) { e.preventDefault(); act(); }
}

function onReaderLoad() {
  if (readerReady) return;
  readerReady = true;
  // Shortcuts keep working after clicking into the reader (its keys go to the iframe document).
  $("reader").contentDocument.addEventListener("keydown", onKey);
  // Taps inside the reader land in the iframe document, so close the menu from there too.
  $("reader").contentDocument.addEventListener("pointerdown", () => { $("menu").hidden = true; });
  applyLook();
  if (cur()) render(cur().scroll);
}

// Never fail silently: surface unexpected errors to the user.
window.addEventListener("error", (e) => toast(`Error: ${e.message}`));
window.addEventListener("unhandledrejection", (e) => toast(`Error: ${e.reason?.message || e.reason}`));

async function init() {
  const style = document.createElement("style"); style.id = "fontfaces"; document.head.append(style);
  themes = await (await fetch("/themes.json")).json();
  const renamed = { "tokyo-night-day": "tokyo-night-light" };   // keys from earlier versions
  loadUserThemes();
  const saved = store.get("theme", "tokyo-night");
  if (renamed[saved]) store.set("theme", renamed[saved]);
  theme = themes[renamed[saved] || saved] || themes["tokyo-night"];
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
