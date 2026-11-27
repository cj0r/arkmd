// Smoke and accessibility test of the real UI. It serves the built app (dist/) with the CSP from tauri.conf.json,
// replaces Tauri's IPC with an in-memory file system, and drives the page in headless Chrome the way a user would:
// open a file, read, edit, save, rename, menus, dialogs (Esc goes back one page), flyouts, themes. axe-core checks
// the main screens for accessibility problems. Run: `npm run build && npm run smoke`.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const conf = JSON.parse(fs.readFileSync(path.join(here, "..", "src-tauri", "tauri.conf.json"), "utf8"));
const csp = conf.app.security.csp;
const axeSource = fs.readFileSync(path.join(here, "..", "node_modules", "axe-core", "axe.min.js"), "utf8");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".md": "text/markdown", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  if (p === "/favicon.ico") { res.writeHead(204).end(); return; }
  const file = path.join(dist, path.normalize(p));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "content-security-policy": csp });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const NOTE = "# Smoke test\n\nSome **bold** text.\n\n## Second heading\n\n- [ ] a task\n\n```js\nconst x = 1;\n```\n\n[Other note](other.md)\n";

/** Stands in for Tauri's IPC. Files live in `files`; every call is recorded in `calls`. */
function installMock({ note }) {
  const files = { "/docs/notes.md": note, "/docs/other.md": "# Other\n", "/docs/hostile.md": "# Hostile\n\n<script>window.__pwned = 1</script>\n\n<img src=x onerror=\"window.__pwned = 2\">\n\n[js link](javascript:window.__pwned=3)\n\n[data link](data:text/html,<script>parent.__pwned=4</script>)\n\n```\nunclosed fence\n\n> > > > > > > > > > nested\n\n![remote](http://127.0.0.1:1/track.png)\n\n```mermaid\ngraph TD; A-->\n```\n\n\u202e bidi text\n", "/docs/big.md": "# Big\n\n" + "A line of text in a very large file.\n\n".repeat(250000), "/notes/readme.md": "# Folder Note\n\nOpened from an added folder.\n", "/notes/sub/child.md": "# Subfolder Note\n\nInside a subfolder.\n" };
  const folders = {
    "/notes|": {
      entries: [
        { name: ".hidden.md", is_dir: false },
        { name: "photo.png", is_dir: false },
        { name: "readme.md", is_dir: false },
        { name: "sub", is_dir: true },
      ],
      truncated: false,
    },
    "/notes|sub": {
      entries: [
        { name: "child.md", is_dir: false },
      ],
      truncated: false,
    },
  };
  const calls = [];
  window.__mock = { files, folders, calls };
  const enc = new TextEncoder();
  let id = 1;
  const handlers = {
    take_launch_file: () => "/docs/notes.md",
    "plugin:fs|read_text_file": ({ path }) => { if (!(path in files)) throw new Error("missing " + path); return enc.encode(files[path]).buffer; },
    save_text_file: ({ path, text }) => { files[path] = text; },
    rename_file: ({ path, name }) => { const to = path.replace(/[^/]*$/, name); if (to in files) throw new Error("a file with that name already exists"); files[to] = files[path]; delete files[path]; return to; },
    open_linked: ({ rel, outside }) => { if (rel === "other.md" && !outside) throw new Error("outside:/docs/other.md"); return "/docs/" + rel; },
    list_folder: ({ root, rel }) => { const key = `${root}|${rel || ""}`; if (!(key in folders)) throw new Error("folder not found: " + key); return folders[key]; },
    "plugin:dialog|open": ({ options } = {}) => (options?.directory ? (window.__mock.nextDir || "/notes") : (window.__mock.next || "/docs/big.md")),
    "plugin:dialog|message": ({ buttons } = {}) => (window.__mock.ask ? (buttons?.OkCancelCustom?.[0] ?? "Yes") : "Cancel"),   // confirm dialogs answer no unless a step sets __mock.ask
    trash_file: ({ path }) => {
      if (window.__mock.trashFail) throw new Error("no trash is available here");
      (window.__mock.trashed ||= []).push(path);
      delete files[path];
      const dir = path.replace(/\/[^/]*$/, ""), name = path.replace(/^.*\//, "");
      for (const [key, listing] of Object.entries(folders)) {
        const [root, rel] = key.split("|");
        if ((rel ? root + "/" + rel : root) === dir) listing.entries = listing.entries.filter((e) => e.name !== name);
      }
    },
    "plugin:app|version": () => "9.9.9",
    "plugin:window|is_decorated": () => true,
    "plugin:window|is_maximized": () => false,
    copy_text: () => null,
    log_event: () => null,
  };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    convertFileSrc: (p) => p,
    transformCallback: () => id++,
    unregisterCallback: () => {},
    invoke: async (cmd, args) => {
      calls.push({ cmd, args });
      const h = handlers[cmd];
      return h ? h(args || {}) : null;
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
}

const results = [];
let failures = 0;
async function step(name, fn) {
  try { await fn(); results.push(`ok    ${name}`); }
  catch (e) {
    failures++; results.push(`FAIL  ${name}\n        ${String(e.message || e).split("\n").slice(0, 4).join("\n        ")}`);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Escape");       // leave no dialog or menu open for the next step
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : "chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("page error: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console error: " + m.text()); });
page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) problems.push(`${r.status()} ${r.url()}`); });
page.on("requestfailed", (r) => problems.push("request failed: " + r.url()));
await page.addInitScript(installMock, { note: NOTE });
const reader = () => page.frameLocator("#reader");
const call = (cmd) => page.evaluate((c) => window.__mock.calls.filter((x) => x.cmd === c), cmd);
const menuItem = (label) => page.locator("#menu button", { hasText: label }).first();
const openMenu = async () => { await page.click("#btn-more"); await page.waitForSelector("#menu:not([hidden])"); };
const dialogOpen = () => page.locator("#dialog-backdrop:not([hidden])").count().then((n) => n > 0);

async function axe(label, include) {
  // evaluated through the debugger protocol: the page's own CSP (rightly) refuses an injected inline script
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(axeSource);
  const out = await page.evaluate(async (inc) => {
    const r = await window.axe.run(inc ? { include: [inc] } : document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  }, include || null);
  const bad = out.filter((v) => v.impact === "critical" || v.impact === "serious" || v.impact === "moderate");
  expect(bad.length === 0, `${label}: ` + bad.map((v) => `${v.id} (${v.impact}) ${v.help} @ ${v.nodes.join(" | ")}`).join("; "));
}

await page.goto(url);

await step("opens the launch file and shows it rendered", async () => {
  await reader().locator("h1", { hasText: "Smoke test" }).waitFor({ timeout: 15000 });
  expect(await reader().locator("pre code").count() === 1, "code block missing");
  expect(await page.locator(".tab.active").innerText().then((t) => t.includes("notes.md")), "tab name");
});

await step("accessibility: reader screen", () => axe("reader screen"));

await step("outline flyout opens and closes", async () => {
  await page.click("#btn-outline");
  await page.locator("#outline:not([hidden])").waitFor();
  expect(await page.locator("#outline").innerText().then((t) => t.includes("Second heading")), "outline entries");
  await axe("outline flyout");
  await page.click("#btn-outline");
  await page.locator("#outline[hidden]").waitFor({ state: "attached" });
});

await step("a link to a file outside the folder asks first, and Cancel opens nothing", async () => {
  await reader().locator("a", { hasText: "Other note" }).click();
  await page.locator("#dialog h2", { hasText: "outside this folder" }).waitFor();
  await page.locator("#dialog button", { hasText: "Cancel" }).click();
  await page.waitForTimeout(200);
  expect((await call("open_linked")).length === 1, "the link was retried without asking");
  expect(await page.locator(".tab").count() === 1, "a tab was opened");
  await reader().locator("a", { hasText: "Other note" }).click();
  await page.locator("#dialog button", { hasText: "Open it" }).click();
  await page.locator(".tab", { hasText: "other.md" }).waitFor({ timeout: 5000 });
  const calls = await call("open_linked");
  expect(calls.at(-1).args.outside === true, "the confirmed open did not say so");
  await page.keyboard.press("Control+w");
  await page.locator(".tab.active", { hasText: "notes.md" }).waitFor();
});

await step("editing and saving writes the file", async () => {
  await page.click("#toggle");
  await page.locator("#editor .cm-content").waitFor();
  await page.click("#editor .cm-content");
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nAdded by the smoke test\n");
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() => window.__mock.calls.some((c) => c.cmd === "save_text_file"));
  const saved = await page.evaluate(() => window.__mock.files["/docs/notes.md"]);
  expect(saved.includes("Added by the smoke test") && saved.startsWith("# Smoke test"), "saved text wrong: " + saved.slice(0, 80));
});

await step("accessibility: editor screen", () => axe("editor screen"));

await step("redo works with Ctrl+Shift+Z and Ctrl+Y; browser reload keys are blocked; the title shows the version", async () => {
  await page.click("#editor .cm-content");
  await page.keyboard.press("Control+End");
  const before = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  await page.keyboard.type("REDOMARK");
  const typed = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  const has = async () => (await page.evaluate(() => document.querySelector("#editor .cm-content").innerText)).includes("REDOMARK");
  await page.keyboard.press("Control+z");
  expect(!(await has()), "undo did not remove the typed text");
  await page.keyboard.press("Control+Shift+Z");
  expect(await has(), "Ctrl+Shift+Z did not redo");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  expect(await has(), "Ctrl+Y did not redo");
  const blocked = await page.evaluate(() => ["Control+r", "F5", "Control+u"].map((c) => {
    const [mod, key] = c.includes("+") ? c.split("+") : [null, c];
    const e = new KeyboardEvent("keydown", { key, ctrlKey: !!mod, bubbles: true, cancelable: true });
    document.dispatchEvent(e); return e.defaultPrevented;
  }));
  expect(blocked.every(Boolean), "a browser key was not blocked: " + blocked);
  const titles = await page.evaluate(() => window.__mock.calls.filter((c) => /set_title/.test(c.cmd)).map((c) => JSON.stringify(c.args)));
  expect(titles.some((t) => t.includes("ArkMD 9.9.9")), "title has no version: " + titles.slice(-2));
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+s");          // leave the tab clean for the steps that follow
  void before; void typed;
});

await step("deleting a numbered item renumbers the list", async () => {
  await page.click("#editor .cm-content");
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\n1. one\ntwo\nthree");          // Enter continues the numbering itself
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Delete");
  const t = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  expect(/1\. one\s+2\. three/.test(t) && !/3\. three/.test(t), "list not renumbered: " + JSON.stringify(t.slice(-40)));
  await page.keyboard.press("Control+z");
  const u = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  expect(/1\. one\s+2\. two\s+3\. three/.test(u), "undo did not restore the list: " + JSON.stringify(u.slice(-40)));
  await page.keyboard.press("Control+s");
});

await step("right-click menus: tab, editor, reader and title bar", async () => {
  const items = async () => page.evaluate(() => [...document.querySelectorAll("#menu button")].map((b) => b.textContent));
  const menuOpen = async () => !(await page.evaluate(() => document.querySelector("#menu").hidden));
  // tab
  await page.click(".tab .tab-main", { button: "right" });
  let m = await items();
  expect(m.some((x) => x.startsWith("Close")) && m.some((x) => x.startsWith("Save as")) && m.some((x) => x.startsWith("Copy file path")), "tab menu: " + m);
  await page.keyboard.press("Escape");
  // editor (the tab is in edit mode here)
  const inEdit = await page.locator("#editor .cm-content").isVisible();
  if (!inEdit) { await page.click("#toggle"); await page.locator("#editor .cm-content").waitFor(); }
  await page.click("#editor .cm-content", { button: "right" });
  m = await items();
  expect(["Cut", "Copy", "Paste", "Bold", "Callout…", "Find and replace", "Outline", "Switch to reading"].every((n) => m.some((x) => x.startsWith(n))), "editor menu: " + m);
  await page.getByRole("menuitem", { name: /^Callout/ }).click();
  m = await items();
  expect(m.includes("Warning") && m.includes("Back"), "callout submenu: " + m);
  await page.getByRole("menuitem", { name: "Back" }).click();
  expect((await items()).some((x) => x.startsWith("Bold")), "Back did not return to the editor menu");
  await page.keyboard.press("Escape");
  // reader
  await page.click("#toggle");
  await page.waitForTimeout(400);
  await page.frameLocator("#reader").locator("body").click({ button: "right", position: { x: 200, y: 200 } });
  m = await items();
  expect(m.some((x) => x.startsWith("Edit this document")) && m.some((x) => x.startsWith("Find")), "reader menu: " + m);
  await page.keyboard.press("Escape");
  // title bar
  await page.click("#bar .spacer", { button: "right" });
  m = await items();
  expect(m.some((x) => x.startsWith("New file")) && m.some((x) => x.startsWith("Settings")), "title bar menu: " + m);
  await page.keyboard.press("Escape");
  expect(!(await menuOpen()), "menu stayed open");
});

await step("Tab nests a numbered item (shown a., i. like the reader) and Shift+Tab moves it back", async () => {
  if (!(await page.locator("#editor .cm-content").isVisible())) { await page.click("#toggle"); await page.locator("#editor .cm-content").waitFor(); }
  await page.click("#editor .cm-content");
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\n1. top\nsub\nsub2\nthird");
  await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Tab");                       // sub -> level 2
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Tab");                       // sub2 -> level 2
  await page.keyboard.press("Tab");                       // sub2 -> level 3
  const text = () => page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  let t = await text();
  expect(/a\. sub\s+i\. sub2/.test(t), "nested markers wrong: " + JSON.stringify(t.slice(-60)));
  const raw = await page.evaluate(() => window.__mock && 0);
  await page.keyboard.press("Shift+Tab");                 // sub2 back to level 2
  t = await text();
  expect(/a\. sub\s+b\. sub2/.test(t), "Shift+Tab did not move sub2 back: " + JSON.stringify(t.slice(-60)));
  await page.click("#toggle");
  await page.waitForTimeout(400);
  const style = await page.frameLocator("#reader").locator("ol ol").first().evaluate((el) => getComputedStyle(el).listStyleType);
  expect(style === "lower-alpha", "reader nested list style: " + style);
  await page.click("#toggle");
  await page.locator("#editor .cm-content").waitFor();
  await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z"); await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+s");
  await page.click("#toggle");                            // leave the tab in reading mode, as the next step expects
  void raw;
});

await step("typing ( in a code block with a language closes it; in ordinary text it does not", async () => {
  if (!(await page.locator("#editor .cm-content").isVisible())) { await page.click("#toggle"); await page.locator("#editor .cm-content").waitFor(); }
  await page.click("#editor .cm-content");
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\nnote (aside\n\n```js\n");
  await page.waitForTimeout(1500);                        // the JavaScript language loads on first use
  await page.keyboard.type("const x = f(");
  const t = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  expect(/note \(aside\s/.test(t) && !/note \(aside\)/.test(t), "text got a closing bracket: " + JSON.stringify(t.slice(-60)));
  expect(/const x = f\(\)/.test(t), "code did not get a closing bracket: " + JSON.stringify(t.slice(-60)));
  await page.keyboard.press("Shift+Home");                // select the code line: it must show a highlight over the code block's background
  const sel = await page.evaluate(() => {
    const el = document.querySelector(".cm-ark-selected");
    if (!el) return null;
    const line = el.closest(".cm-line");
    return { mark: getComputedStyle(el).backgroundColor, block: getComputedStyle(line).backgroundColor };
  });
  expect(sel && sel.mark !== "rgba(0, 0, 0, 0)" && sel.mark !== sel.block, "no selection highlight in a code block: " + JSON.stringify(sel));
  if (process.env.SMOKE_SHOT) { const b = await page.locator(".cm-ark-codeblock").last().boundingBox(); await page.screenshot({ path: process.env.SMOKE_SHOT, clip: { x: b.x, y: b.y - 40, width: Math.min(b.width, 700), height: 120 } }); }
  await page.keyboard.press("ArrowRight");                // back to where the cursor was, inside the brackets
  await page.keyboard.type("1");
  await page.keyboard.press("ArrowRight");               // steps over the closing bracket
  await page.keyboard.type(";");
  const u = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  expect(/const x = f\(1\);/.test(u), "typing past the closing bracket failed: " + JSON.stringify(u.slice(-40)));
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n```\n\nuse <b>bold\n\n```html\n");
  await page.waitForTimeout(1500);                        // the HTML language loads on first use
  await page.keyboard.type("<div>");
  const h = await page.evaluate(() => document.querySelector("#editor .cm-content").innerText);
  expect(/<div><\/div>/.test(h), "html tag was not closed in a code block: " + JSON.stringify(h.slice(-50)));
  expect(/use <b>bold\s/.test(h) && !/<b><\/b>/.test(h), "a tag was closed in ordinary text: " + JSON.stringify(h.slice(-80)));
  for (let i = 0; i < 40; i++) await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+s");
  await page.click("#toggle");                            // leave the tab in reading mode, as the next step expects
});

await step("rename changes the file and the tab", async () => {
  await openMenu();
  await menuItem("Rename file").click();
  const input = page.locator("#dialog input.dialog-input");
  await input.waitFor();
  await input.fill("bad/name");
  await page.keyboard.press("Enter");
  expect(await page.locator("#dialog .dialog-problem").innerText().then((t) => t.length > 0), "no message for an invalid name");
  await axe("rename dialog", "#dialog");
  await input.fill("renamed");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__mock.files["/docs/renamed.md"] !== undefined);
  await page.locator(".tab.active", { hasText: "renamed.md" }).waitFor({ timeout: 5000 });
  expect(!(await dialogOpen()), "dialog still open");
});

await step("menu is accessible", async () => {
  await openMenu();
  await axe("more menu", "#menu");
  await page.keyboard.press("Escape");
});

await step("status bar and line numbers can be switched on and off in Settings", async () => {
  const flip = async (label) => {
    await openMenu();
    await menuItem("Settings").click();
    await page.locator("#dialog h2", { hasText: "Settings" }).waitFor();
    await page.locator("#dialog button.row", { hasText: label }).click();
    await page.locator("#dialog button", { hasText: "Done" }).click();
  };
  await flip("Status bar");
  await page.locator("#statusbar:not([hidden])").waitFor();
  const read = await page.locator("#statusbar").innerText();
  expect(/words?/.test(read) && /\bKB\b|\bB\b/.test(read) && !/Line \d/.test(read), "reading status: " + read);
  await page.click("#btn-outline");                         // its own counts would repeat the bar's
  await page.locator("#outline:not([hidden])").waitFor();
  expect(await page.locator(".outline-foot").isHidden(), "outline repeats the counts shown in the status bar");
  await page.click("#btn-outline");
  await page.click("#toggle");                              // edit mode adds the cursor position
  await page.locator("#statusbar", { hasText: /Line \d+, column \d+/ }).waitFor();
  await flip("Line numbers");
  await page.locator("#editor .cm-lineNumbers").waitFor();
  await flip("Line numbers");
  expect((await page.locator("#editor .cm-lineNumbers").count()) === 0, "line numbers did not turn off");
  await flip("Status bar");
  await page.locator("#statusbar[hidden]").waitFor({ state: "attached" });
  await page.click("#toggle");                              // back to reading, as the next step expects
});

await step("Esc steps back one dialog page, then closes", async () => {
  await openMenu();
  await menuItem("Settings").click();
  await page.locator("#dialog h2", { hasText: "Settings" }).waitFor();
  await axe("settings dialog", "#dialog");
  await page.locator("#dialog button", { hasText: "Keyboard shortcuts" }).click();
  await page.locator("#dialog h2", { hasText: /shortcuts/i }).waitFor();
  await axe("shortcuts dialog", "#dialog");
  await page.keyboard.press("Escape");
  await page.locator("#dialog h2", { hasText: "Settings" }).waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#dialog-backdrop[hidden]").waitFor({ state: "attached" });
});

await step("keyboard focus stays inside an open dialog", async () => {
  await openMenu();
  await menuItem("Settings").click();
  await page.locator("#dialog h2", { hasText: "Settings" }).waitFor();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(i % 2 ? "Tab" : "Shift+Tab");
    const inside = await page.evaluate(() => !!document.activeElement?.closest("#dialog"));
    expect(inside, `focus left the dialog after ${i + 1} Tab presses (on ${await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName)})`);
  }
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("#dialog")), `focus left the dialog going forward (${i + 1})`);
  }
  await page.keyboard.press("Escape");
});

await step("Support and About dialogs open and go back", async () => {
  await openMenu();
  await menuItem("Support").click();
  await page.locator("#dialog h2", { hasText: "Support" }).waitFor();
  await axe("support dialog", "#dialog");
  await page.keyboard.press("Escape");
  await page.locator("#dialog-backdrop[hidden]").waitFor({ state: "attached" });
  await openMenu();
  await menuItem("About").click();
  await page.locator("#dialog h2").first().waitFor();
  await axe("about dialog", "#dialog");
  await page.keyboard.press("Escape");
});

await step("theme picker changes the theme", async () => {
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg"));
  await page.click("#btn-theme");
  await page.locator("#dialog .opt").nth(3).waitFor();
  await axe("theme picker", "#dialog");
  await page.locator("#dialog .opt").nth(3).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg"));
  expect(before !== after || (await dialogOpen()) === false, "theme unchanged");
  if (await dialogOpen()) await page.keyboard.press("Escape");
});

await step("recent files flyout lists the opened files", async () => {
  await page.keyboard.press("Control+Shift+R");
  await page.locator("#files:not([hidden])").waitFor();
  expect(await page.locator("#files-list").innerText().then((t) => t.includes("renamed")), "renamed file missing from recent list");
  await axe("recent files flyout", "#files");
  await page.keyboard.press("Escape");
});

await step("added folders tree: add, expand, subfolder, open nested file, collapse, keyboard navigation, remove", async () => {
  await page.keyboard.press("Control+Shift+R");
  await page.locator("#files:not([hidden])").waitFor();
  await page.click("#files-add-folder");
  const rootItem = page.locator('#folders-tree [role="treeitem"].tree-root', { hasText: "notes" });
  await rootItem.waitFor();
  expect(await rootItem.getAttribute("aria-expanded") === "false", "root folder should start collapsed");
  const openCalls = await call("plugin:dialog|open");
  expect(openCalls.at(-1)?.args?.options?.directory === true && openCalls.at(-1)?.args?.options?.recursive === true, "folder pick did not request recursive scope");
  await axe("recent files flyout with collapsed folder", "#files");

  // Expand root folder in place.
  await rootItem.click();
  const subItem = page.locator('#folders-tree [role="treeitem"].tree-folder[aria-level="2"]', { hasText: "sub" });
  await subItem.waitFor();
  expect(await rootItem.getAttribute("aria-expanded") === "true", "root folder did not expand");
  const level2Names = await page.locator('#folders-tree [role="treeitem"][aria-level="2"] .tree-label').allInnerTexts();
  expect(JSON.stringify(level2Names) === JSON.stringify(["sub", "readme.md"]), "unexpected root entries: " + JSON.stringify(level2Names));

  // Expand subfolder in place and see nested file.
  await subItem.click();
  const childFile = page.locator('#folders-tree [role="treeitem"].tree-file[aria-level="3"]', { hasText: "child.md" });
  await childFile.waitFor();
  expect(await subItem.getAttribute("aria-expanded") === "true", "subfolder did not expand");
  await axe("expanded multi-level folder tree", "#files");

  // Open the nested file and verify its full path is read.
  await childFile.click();
  await page.locator("#files[hidden]").waitFor({ state: "attached" });
  await page.locator(".tab.active", { hasText: "child.md" }).waitFor({ timeout: 5000 });
  await reader().locator("h1", { hasText: "Subfolder Note" }).waitFor({ timeout: 5000 });
  const reads = await call("plugin:fs|read_text_file");
  expect(reads.some((c) => c.args?.path === "/notes/sub/child.md"), "opening nested file did not read /notes/sub/child.md");

  // Reopen flyout: expanded state is remembered and open file is marked.
  await page.keyboard.press("Control+Shift+R");
  await page.locator("#files:not([hidden])").waitFor();
  await childFile.waitFor();
  expect(await childFile.evaluate((el) => el.classList.contains("current")), "currently open file not marked in tree");

  // Collapse the subfolder and verify its children disappear.
  await subItem.click();
  await page.waitForFunction(() => document.querySelectorAll('#folders-tree [aria-level="3"]').length === 0);
  expect(await subItem.getAttribute("aria-expanded") === "false", "subfolder did not collapse");

  // Keyboard navigation: ArrowRight expands, ArrowRight again moves to first child, ArrowLeft returns to parent and collapses.
  await subItem.focus();
  await page.keyboard.press("ArrowRight");
  await childFile.waitFor();
  expect(await subItem.getAttribute("aria-expanded") === "true", "ArrowRight did not expand subfolder");
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim()) === "child.md", "ArrowRight on expanded folder did not focus first child");
  await page.keyboard.press("ArrowLeft");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim()) === "sub", "ArrowLeft on child did not focus parent folder");
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelectorAll('#folders-tree [aria-level="3"]').length === 0);
  expect(await subItem.getAttribute("aria-expanded") === "false", "ArrowLeft on expanded subfolder did not collapse it");
  await page.keyboard.press("ArrowLeft");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim()) === "notes", "ArrowLeft on collapsed subfolder did not focus root");

  // Collapse the root with ArrowLeft.
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelectorAll('#folders-tree [aria-level="2"]').length === 0);
  expect(await rootItem.getAttribute("aria-expanded") === "false", "ArrowLeft did not collapse root folder");

  // Remove the folder and restore previous tab.
  await page.locator('#folders-actions button[aria-label="Remove folder notes from the list"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#folders-tree [role="treeitem"]').length === 0);
  await page.keyboard.press("Escape");
  await page.locator("#files[hidden]").waitFor({ state: "attached" });
  await page.keyboard.press("Control+w");
  await page.locator(".tab.active", { hasText: "renamed.md" }).waitFor({ timeout: 5000 });
});

await step("pinned recent files pane stays open beside the document; a narrow window overlays it; the pin is remembered", async () => {
  await page.keyboard.press("Control+Shift+R");
  await page.locator("#files:not([hidden])").waitFor();
  await page.click("#files-dock");
  await page.locator("#content.docked").waitFor();
  const pane = await page.locator("#files").boundingBox();
  const doc = await page.locator("#reader:not([hidden]), #editor:not([hidden])").first().boundingBox();
  expect(doc.x >= pane.x + pane.width - 1, `the document starts at ${doc.x}, under the pane that ends at ${pane.x + pane.width}`);
  await axe("pinned recent files pane", "#files");
  if (process.env.SMOKE_DOCK_SHOT) await page.screenshot({ path: process.env.SMOKE_DOCK_SHOT });
  await page.keyboard.press("Escape");
  await page.mouse.click(doc.x + doc.width / 2, doc.y + 150);
  expect(await page.locator("#files:not([hidden])").count() === 1, "a pinned pane closed after Escape or a click in the document");
  await page.locator("#files-list .file-row", { hasText: "renamed.md" }).locator(".file-main").click();
  expect(await page.locator("#files:not([hidden])").count() === 1, "a pinned pane closed after opening a file from it");
  await page.setViewportSize({ width: 700, height: 760 });
  await page.waitForFunction(() => !document.querySelector("#content.docked"));
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.locator("#content.docked").waitFor();
  const second = await ctx.newPage();                       // a second start of the app (same stored settings)
  await second.addInitScript(installMock, { note: NOTE });
  await second.goto(url);
  await second.locator("#content.docked").waitFor({ timeout: 10000 });
  expect(await second.locator("#files:not([hidden])").count() === 1, "a pinned pane was not open after a restart");
  await second.close();
  await page.click("#files-dock");
  await page.waitForFunction(() => !document.querySelector("#content.docked"));
  await page.keyboard.press("Escape");
  await page.locator("#files[hidden]").waitFor({ state: "attached" });
});

await step("a file can be moved to the Recycle Bin or Trash from the folder tree (Delete key) and from the recent files list", async () => {
  await page.evaluate(() => { window.__mock.ask = false; window.__mock.nextDir = "/notes"; });
  await page.keyboard.press("Control+Shift+R");
  await page.locator("#files:not([hidden])").waitFor();
  await page.click("#files-add-folder");
  const root = page.locator('#folders-tree [role="treeitem"].tree-root', { hasText: "notes" });
  await root.waitFor();
  await root.click();
  const readme = page.locator('#folders-tree [role="treeitem"].tree-file', { hasText: "readme.md" });
  await readme.waitFor();
  await readme.focus();
  await page.keyboard.press("Delete");                      // the confirm answers no: nothing happens
  await page.waitForFunction(() => window.__mock.calls.some((c) => c.cmd === "plugin:dialog|message"), null, { timeout: 4000 })
  expect(!(await page.evaluate(() => window.__mock.trashed))?.length, "a file was moved to the trash although the confirm was declined");
  await page.evaluate(() => { window.__mock.ask = true; window.__mock.trashFail = true; });
  await readme.focus();
  await page.keyboard.press("Delete");                      // the system can't move it: the file stays and the page says so
  await page.locator("#toast", { hasText: "was not deleted" }).waitFor({ timeout: 5000 })
  expect(await readme.count() === 1, "the row disappeared although the trash failed");
  await page.evaluate(() => { window.__mock.trashFail = false; });
  await readme.focus();
  await page.keyboard.press("Delete");
  await readme.waitFor({ state: "detached", timeout: 5000 });
  const trashed = await page.evaluate(() => window.__mock.trashed);
  expect(trashed.length === 1 && trashed[0] === "/notes/readme.md", "the wrong path was moved to the trash: " + JSON.stringify(trashed));
  const message = (await call("plugin:dialog|message")).at(-1).args;
  expect(/readme\.md/.test(String(message.message ?? message)), "the confirm did not name the file");
  // from the recent files list
  await page.evaluate(() => { window.__mock.files["/docs/zzz-delete-me.md"] = "# Delete me\n"; window.__mock.next = "/docs/zzz-delete-me.md"; });
  await page.click("#files-open");
  await page.locator(".tab.active", { hasText: "zzz-delete-me.md" }).waitFor({ timeout: 5000 });
  await page.keyboard.press("Control+Shift+R");
  await page.locator("#files:not([hidden])").waitFor();
  const row = page.locator("#files-list .file-row", { hasText: "zzz-delete-me.md" });
  await row.hover();
  if (process.env.SMOKE_DEL_SHOT) await page.screenshot({ path: process.env.SMOKE_DEL_SHOT });
  await row.locator(".file-del").click();
  await row.waitFor({ state: "detached", timeout: 5000 });
  expect((await page.evaluate(() => window.__mock.trashed)).length === 2, "the recent files list's delete did not move the file");
  expect(await page.locator(".tab", { hasText: "zzz-delete-me.md" }).count() === 0, "the deleted file's tab stayed open");
  await page.locator('#folders-actions button[aria-label="Remove folder notes from the list"]').click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => { window.__mock.ask = false; });
  await page.locator(".tab", { hasText: "renamed.md" }).first().click();
  await page.locator(".tab.active", { hasText: "renamed.md" }).waitFor({ timeout: 5000 });
});

await step("a hostile document renders as text and runs nothing", async () => {
  await page.evaluate(() => { window.__mock.next = "/docs/hostile.md"; });
  await page.keyboard.press("Control+o");
  await page.locator(".tab.active", { hasText: "hostile.md" }).waitFor({ timeout: 10000 });
  await reader().locator("h1", { hasText: "Hostile" }).waitFor({ timeout: 10000 });
  await reader().locator("a", { hasText: "js link" }).click({ force: true }).catch(() => {});
  await reader().locator("a", { hasText: "data link" }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  const flags = await page.evaluate(() => [window.__pwned, document.getElementById("reader").contentWindow.__pwned]);
  expect(flags.every((f) => f === undefined), "script ran: " + JSON.stringify(flags));
  expect(await reader().locator("#doc script, #doc img[onerror]").count() === 0, "raw HTML was kept");
  expect(await page.evaluate(() => window.__mock.calls.every((c) => c.cmd !== "open_external")), "a link was opened");
  await page.evaluate(() => { window.__mock.next = null; });
  await page.keyboard.press("Control+w");
  await page.locator(".tab.active", { hasText: "renamed.md" }).waitFor({ timeout: 5000 });
});

await step("a very large file opens in the editor within seconds", async () => {
  const started = Date.now();
  await page.keyboard.press("Control+o");
  await page.locator(".tab.active", { hasText: "big.md" }).waitFor({ timeout: 20000 });
  await page.locator("#editor .cm-content").waitFor({ timeout: 20000 });
  expect(Date.now() - started < 15000, `took ${Date.now() - started} ms`);
  await page.keyboard.press("Control+w");
  await page.locator(".tab.active", { hasText: "renamed.md" }).waitFor({ timeout: 5000 });
});

await step("closing the tab returns to the home screen", async () => {
  await page.keyboard.press("Control+w");
  await page.locator("#home").waitFor({ state: "visible" });
  await axe("home screen");
});

await step("phone-sized window: top bar, menu and dialogs are accessible", async () => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.keyboard.press("Control+Shift+T");          // reopen the closed file
  await page.locator(".tab.active", { hasText: "renamed.md" }).waitFor({ timeout: 10000 });
  await axe("compact editor screen");
  await openMenu();
  await axe("compact more menu", "#menu");
  await menuItem("Settings").click();
  await page.locator("#dialog h2", { hasText: "Settings" }).waitFor();
  await axe("compact settings", "#dialog");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1100, height: 760 });
});

await step("a phone on its side: the menu stays on screen; with the keyboard open the Read/Edit button stays below the top bar and the bars that need room are hidden", async () => {
  await page.setViewportSize({ width: 915, height: 412 });
  await openMenu();
  const box = await page.locator("#menu").boundingBox();
  expect(box.y >= 0 && box.y + box.height <= 413 && box.x >= 0 && box.x + box.width <= 916, "menu off screen: " + JSON.stringify(box));
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.documentElement.style.setProperty("--inset-bottom", "270px"));     // the keyboard, as MainActivity reports it
  await page.waitForFunction(() => document.body.classList.contains("short"));
  const bar = await page.locator("#bar").boundingBox();
  const fab = await page.locator("#toggle").boundingBox();
  expect(fab.y >= bar.y + bar.height - 1, "button covers the top bar: " + JSON.stringify([bar, fab]));
  expect(await page.locator("#statusbar").isHidden() && await page.locator("#formatbar").isHidden(), "bars still shown with the keyboard open");
  await page.evaluate(() => document.documentElement.style.removeProperty("--inset-bottom"));
  await page.waitForFunction(() => !document.body.classList.contains("short"));
  await page.setViewportSize({ width: 1100, height: 760 });
});

await step("every built-in theme meets the contrast rules (app and reader)", async () => {
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(dist, "themes.json"), "utf8")));
  const failing = [];
  for (const key of keys) {
    await page.evaluate(([k, aa]) => { localStorage.setItem("ark.theme", JSON.stringify(k)); if (aa) localStorage.setItem("ark.contrastAA", "false"); }, [key, !!process.env.SMOKE_NO_AA]);
    await page.reload();
    await reader().locator("h1", { hasText: "Smoke test" }).waitFor({ timeout: 15000 });
    const found = [];
    for (const frame of [page.mainFrame(), page.frames().find((f) => f.url().endsWith("viewer.html"))]) {
      if (!(await frame.evaluate(() => !!window.axe))) await frame.evaluate(axeSource);
      const r = await frame.evaluate(() => window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] } }).then((x) => x.violations.flatMap((v) => v.nodes.slice(0, 2).map((n) => n.target.join(" ")))));
      found.push(...r.map((t) => (frame === page.mainFrame() ? "app " : "reader ") + t));
    }
    if (found.length) failing.push(`${key}: ${found.join(", ")}`);
  }
  await page.evaluate(() => localStorage.removeItem("ark.theme"));
  await page.reload();
  expect(!failing.length, `${failing.length} theme(s): ` + failing.slice(0, 8).join(" | "));
});

await step("a history dialog closes with its tab, so Restore cannot land in another tab; Reopen closed tab still works", async () => {
  const tabs = page.locator(".tab");
  const openDoc = async (path, heading) => {
    await page.evaluate((p) => { window.__mock.next = p; }, path);
    await page.keyboard.press("Control+o");
    await reader().locator("h1", { hasText: heading }).waitFor({ timeout: 15000 });
  };
  await page.evaluate(() => { window.__mock.files["/docs/history-a.md"] = "# History A\n\nfirst text\n"; window.__mock.files["/docs/history-b.md"] = "# History B\n\nother file\n"; });
  await openDoc("/docs/history-a.md", "History A");
  await page.keyboard.press("Control+e"); await page.waitForTimeout(200);
  await page.keyboard.type("ONE "); await page.keyboard.press("Control+s"); await page.waitForTimeout(600);
  await page.keyboard.type("TWO "); await page.keyboard.press("Control+s"); await page.waitForTimeout(600);
  await page.keyboard.press("Control+e"); await page.waitForTimeout(200);
  await openDoc("/docs/history-b.md", "History B");
  await tabs.filter({ hasText: "history-a.md" }).first().click(); await page.waitForTimeout(300);
  await openMenu();
  await menuItem("File history").click();
  await page.locator("#dialog button.row").first().click();
  await page.locator("#dialog button", { hasText: "Restore into the editor" }).waitFor();
  await page.keyboard.press("Control+w"); await page.waitForTimeout(400);
  expect(!(await dialogOpen()), "the history dialog stayed open after its tab was closed");
  expect((await page.locator(".tab.active").innerText()).includes("history-b.md"), "the other tab should be active");
  await page.keyboard.press("Control+e"); await page.waitForTimeout(300);
  const text = await page.evaluate(() => document.querySelector(".cm-content")?.innerText ?? "");
  expect(text.includes("History B") && !text.includes("ONE") && !text.includes("TWO"), "the other tab's text changed: " + text.slice(0, 60));
  expect((await page.locator(".tab.active").innerText()).indexOf("unsaved") < 0, "the other tab is marked as changed");
  await page.keyboard.press("Control+e"); await page.waitForTimeout(200);
  const before = await tabs.count();
  await page.keyboard.press("Control+Shift+T"); await page.waitForTimeout(500);
  expect(await tabs.count() === before + 1 && (await page.locator(".tab.active").innerText()).includes("history-a.md"), "Reopen closed tab did not bring history-a.md back");
  for (const name of ["history-a.md", "history-b.md"]) {            // close only the two tabs this step opened
    await tabs.filter({ hasText: name }).first().click(); await page.waitForTimeout(200);
    await page.keyboard.press("Control+w"); await page.waitForTimeout(300);
  }
});

await step("Ctrl+Shift+C copies the selection like Ctrl+C: in the reader, the editor and a text field; nothing selected copies nothing", async () => {
  await page.evaluate(() => { window.__mock.files["/docs/copy.md"] = "# Copy test\n\nParagraph to copy.\n"; window.__mock.next = "/docs/copy.md"; });
  await page.keyboard.press("Control+o");
  await reader().locator("h1", { hasText: "Copy test" }).waitFor({ timeout: 15000 });
  const copies = async () => (await call("copy_text")).map((c) => c.args.text);
  const start = (await copies()).length;
  await reader().locator("p", { hasText: "Paragraph to copy." }).click({ clickCount: 3 });          // select the paragraph in the reader
  await page.keyboard.press("Control+Shift+C"); await page.waitForTimeout(200);
  let now = await copies();
  expect(now.length === start + 1 && now.at(-1).includes("Paragraph to copy."), "the reader selection was not copied: " + JSON.stringify(now.slice(start)));
  await reader().locator("h1").click();                                                              // a click leaves nothing selected
  await page.keyboard.press("Control+Shift+C"); await page.keyboard.press("Control+c"); await page.waitForTimeout(200);
  expect((await copies()).length === start + 1, "something was copied with nothing selected");
  await page.keyboard.press("Control+e"); await page.waitForTimeout(300);                            // the editor
  await page.keyboard.press("Control+a"); await page.keyboard.press("Control+Shift+C"); await page.waitForTimeout(200);
  now = await copies();
  expect(now.length === start + 2 && now.at(-1) === "# Copy test\n\nParagraph to copy.\n", "the editor selection was not copied: " + JSON.stringify(now.at(-1)));
  await page.keyboard.press("Control+f"); await page.keyboard.type("needle"); await page.keyboard.press("Control+a");   // a text field
  await page.keyboard.press("Control+Shift+C"); await page.waitForTimeout(200);
  now = await copies();
  expect(now.length === start + 3 && now.at(-1) === "needle", "the text field selection was not copied: " + JSON.stringify(now.at(-1)));
  await page.keyboard.press("Escape"); await page.keyboard.press("Control+e"); await page.waitForTimeout(200);
  await page.keyboard.press("Control+w"); await page.waitForTimeout(300);
});

await step("Settings > Close tags in code: off adds no closing tag in an html block, on adds it", async () => {
  await page.evaluate(() => { window.__mock.files["/docs/tags.md"] = "```html\n\n```\n"; window.__mock.next = "/docs/tags.md"; });
  await page.keyboard.press("Control+o");
  await page.locator(".tab.active", { hasText: "tags.md" }).waitFor({ timeout: 15000 });
  await page.keyboard.press("Control+e"); await page.waitForTimeout(500);
  const text = () => page.evaluate(() => document.querySelector(".cm-content")?.innerText ?? "");
  const setTags = async (want) => {
    await openMenu(); await menuItem("Settings").click();
    const row = page.locator("#dialog .row", { hasText: "Close tags in code" });
    await row.waitFor();
    if ((await row.getAttribute("aria-checked")) !== String(want)) await row.click();
    expect((await row.getAttribute("aria-checked")) === String(want), "the switch did not change");
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  };
  await page.keyboard.press("Control+Home"); await page.keyboard.press("ArrowDown");
  await page.keyboard.type("<div>"); await page.waitForTimeout(300);
  expect((await text()).includes("</div>"), "with the switch on, <div> did not get its closing tag: " + JSON.stringify(await text()));
  await setTags(false);
  await page.locator(".cm-content").click(); await page.keyboard.press("Control+Home"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("End");
  await page.keyboard.press("Enter"); await page.keyboard.type("<q>"); await page.waitForTimeout(300);
  let t = await text();
  expect(t.includes("<q>") && !t.includes("</q>"), "with the switch off, <q> still got a closing tag: " + JSON.stringify(t));
  await setTags(true);
  await page.locator(".cm-content").click(); await page.keyboard.press("Control+Home"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("End");
  await page.keyboard.press("Enter"); await page.keyboard.type("<b>"); await page.waitForTimeout(300);
  t = await text();
  expect(t.includes("<b></b>"), "with the switch back on, <b> did not get its closing tag: " + JSON.stringify(t));
  await page.keyboard.press("Control+e"); await page.waitForTimeout(200);
  await page.keyboard.press("Control+w"); await page.waitForTimeout(300);
});

await step("a large document's rendered page is released while the reader is hidden", async () => {
  await page.evaluate(() => { window.__mock.files["/docs/mid.md"] = "# Mid\n\n" + "A paragraph of text.\n\n".repeat(3000); window.__mock.next = "/docs/mid.md"; });
  await page.keyboard.press("Control+o");
  await page.locator(".tab.active", { hasText: "mid.md" }).waitFor({ timeout: 15000 });
  const blocks = () => page.evaluate(() => document.querySelector("#reader").contentDocument.querySelectorAll("#doc > *").length);
  if (await page.locator("#editor .cm-content").isVisible().catch(() => false)) await page.keyboard.press("Control+e");   // into reading mode
  await reader().locator("h1", { hasText: "Mid" }).waitFor({ timeout: 15000 });
  expect(await blocks() > 3000, "the document was not rendered: " + await blocks());
  await page.keyboard.press("Control+e"); await page.waitForTimeout(400);                        // editing: the reader is hidden
  expect(await blocks() < 10, "the reader still holds the page while editing: " + await blocks());
  await page.keyboard.press("Control+e"); await page.waitForTimeout(800);                        // reading again renders it again
  expect(await blocks() > 3000, "the page was not rendered again after editing: " + await blocks());
  await page.keyboard.press("Control+w"); await page.waitForTimeout(300);
});

await step("Ctrl+Shift+V: with no paste event the clipboard is asked for a picture; a text paste does not ask", async () => {
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.evaluate(() => { window.__mock.files["/docs/paste.md"] = "# Paste\n\n"; window.__mock.next = "/docs/paste.md"; });
  await page.keyboard.press("Control+o");
  await page.locator(".tab.active", { hasText: "paste.md" }).waitFor({ timeout: 15000 });
  if (!(await page.locator("#editor .cm-content").isVisible().catch(() => false))) await page.keyboard.press("Control+e");
  await page.waitForTimeout(400);
  const asked = async () => (await call("paste_clipboard_image")).length;
  const before = await asked();
  await page.evaluate(() => document.querySelector(".cm-content").dispatchEvent(new KeyboardEvent("keydown", { key: "V", ctrlKey: true, shiftKey: true, bubbles: true })));
  await page.waitForTimeout(600);
  expect(await asked() === before + 1, "no picture request after Ctrl+Shift+V without a paste event");
  const wrote = await page.evaluate(() => navigator.clipboard.writeText("some text").then(() => true, () => false));
  if (wrote) {
    await page.locator(".cm-content").click();
    await page.keyboard.press("Control+Shift+V"); await page.waitForTimeout(700);
    expect(await asked() === before + 1, "a text paste also asked for a picture");
  }
  await page.keyboard.press("Control+e"); await page.waitForTimeout(200);
  await page.keyboard.press("Control+w"); await page.waitForTimeout(300);
});

await step("no script errors or blocked requests", async () => {
  expect(problems.length === 0, problems.join("\n"));
});

console.log(results.join("\n"));
await browser.close();
server.close();
if (failures) { console.log(`\n${failures} step(s) failed`); process.exit(1); }
console.log("\nsmoke test passed");
