// Measures what opening a large document in the reading view costs (not part of the smoke test).
//   npm run build && SIZES=1,5,15 CHROME_PATH=/usr/bin/chromium node smoke/memory.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "..", "dist");
const conf = JSON.parse(fs.readFileSync(path.join(here, "..", "src-tauri", "tauri.conf.json"), "utf8"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".md": "text/markdown", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html";
  const file = path.join(dist, path.normalize(p));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "content-security-policy": conf.app.security.csp });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const block = (n) => `## Section ${n}\n\nLorem ipsum **dolor** sit amet, [a link](https://example.com/${n}) consectetur *adipiscing* elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\n- item one ${n}\n- item two with \`code\`\n- [ ] a task\n\n| a | b |\n|---|---|\n| ${n} | ${n * 2} |\n\n\`\`\`js\nconst x${n} = ${n};\n\`\`\`\n\n> A quote ${n}\n\n`;
function makeDoc(mb) { const parts = []; let size = 0, n = 0; while (size < mb * 1024 * 1024) { const b = block(n++); parts.push(b); size += b.length; } return parts.join(""); }

function rssMb(pids) { let kb = 0; for (const pid of pids) { try { kb = Math.max(kb, Number(execSync(`ps -o rss= -p ${pid}`).toString().trim() || 0)); } catch {} } return Math.round(kb / 1024); }   // the biggest process: the page renderer
function browserPid() {
  // Playwright starts Chromium with --remote-debugging-pipe; the browser process is the one without --type=
  const out = execSync("ps -eo pid,args").toString().split("\n");
  const hit = out.filter((l) => /remote-debugging-pipe/.test(l) && !/--type=/.test(l) && /chrom/.test(l)).map((l) => Number(l.trim().split(/\s+/)[0]));
  return hit.at(-1);
}
function chromePids(rootPid) { try { return execSync(`pgrep -P ${rootPid}; echo ${rootPid}`).toString().split("\n").filter(Boolean).flatMap((p) => { try { return [p, ...execSync(`pgrep -P ${p}`).toString().split("\n").filter(Boolean)]; } catch { return [p]; } }); } catch { return [String(rootPid)]; } }

for (const mb of (process.env.SIZES || "1,5,15").split(",").map(Number)) {
  const text = makeDoc(mb);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  const page = await ctx.newPage();
  await page.addInitScript(({ text }) => {
    const enc = new TextEncoder();
    const handlers = {
      take_launch_file: () => "/docs/big.md",
      "plugin:fs|read_text_file": () => enc.encode(text).buffer,
      "plugin:app|version": () => "9.9.9", "plugin:window|is_decorated": () => true, "plugin:window|is_maximized": () => false,
      log_event: () => null,
    };
    window.__TAURI_INTERNALS__ = { metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } }, convertFileSrc: (p) => p, transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (cmd, args) => { const h = handlers[cmd]; return h ? h(args || {}) : null; } };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, { text });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Performance.enable");
  const pids = chromePids(browserPid());
  const base = rssMb(pids);
  const t0 = Date.now();
  await page.goto(url);
  // large files open in the editor; switch to reading
  await page.locator(".tab.active").waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const m0 = await metrics(); const rssEdit = rssMb(chromePids(browserPid()));
  await page.keyboard.press("Control+e");           // to reading mode if it opened in the editor
  await page.waitForTimeout(500);
  const reading = await page.evaluate(() => !document.querySelector("#reader")?.hidden);
  if (!reading) { await page.keyboard.press("Control+e"); }
  const tRead = Date.now();
  await page.frameLocator("#reader").locator("#doc h2").first().waitFor({ timeout: 180000 });
  const renderMs = Date.now() - tRead;
  await page.waitForTimeout(2000);
  const m1 = await metrics(); const rssRead = rssMb(chromePids(browserPid()));
  const nodes = await page.frameLocator("#reader").locator("body").evaluate(() => document.querySelectorAll("*").length);
  console.log(`${String(mb).padStart(3)} MB doc: baseline ${base} MB, editor ${rssEdit} MB, reading ${rssRead} MB (+${rssRead - rssEdit} over the editor); render ${renderMs} ms; reader elements ${nodes}; Nodes ${m1.Nodes}; LayoutObjects ${m1.LayoutObjects ?? '-'}; JS heap ${(m1.JSHeapUsedSize / 1048576).toFixed(0)} MB (editor ${(m0.JSHeapUsedSize / 1048576).toFixed(0)} MB)`);
  await browser.close();
}
server.close();
