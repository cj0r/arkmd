import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseColor, parseThemeCss, withAA, contrast, newThemeId, mix } from "./usertheme.js";

const themes = JSON.parse(readFileSync(new URL("../../shared/web/themes.json", import.meta.url), "utf8"));

test("the AA algorithm gives the same result as gen_themes.py for every built-in theme", () => {
  for (const [key, t] of Object.entries(themes)) {
    const { aa, soft, ...plain } = t;
    const mine = withAA(structuredClone(plain));
    assert.deepEqual(mine.aa, aa, key);
    assert.equal(mine.soft, soft, key);
  }
});

test("the selection in every built-in theme keeps text readable and can be seen", () => {
  for (const [key, t] of Object.entries(themes)) {
    const eff = { ...t, ...t.aa };
    const sel = eff.selection;
    assert.ok(contrast(eff.fg, sel) >= 4.5, `${key}: text on the selection ${contrast(eff.fg, sel).toFixed(2)}`);
    const seen = Math.min(contrast(sel, t.bg), contrast(sel, t.bgAlt));
    assert.ok(seen >= 1.4, `${key}: selection against the background ${seen.toFixed(2)}`);
  }
});

test("parseColor reads the supported notations", () => {
  assert.deepEqual(parseColor("#1a2b3c"), [26, 43, 60, 1]);
  assert.deepEqual(parseColor("#fff"), [255, 255, 255, 1]);
  assert.deepEqual(parseColor("#f008"), [255, 0, 0, 136 / 255]);
  assert.deepEqual(parseColor("rgb(10, 20, 30)"), [10, 20, 30, 1]);
  assert.deepEqual(parseColor("rgb(10 20 30 / 50%)"), [10, 20, 30, 0.5]);
  assert.deepEqual(parseColor("hsl(0, 100%, 50%)"), [255, 0, 0, 1]);
  assert.deepEqual(parseColor("BLACK"), [0, 0, 0, 1]);
});

test("parseColor rejects everything else", () => {
  for (const v of ["", "red", "#12", "#12345", "url(http://x/y.png)", "rgb(1,2)", "var(--x)", "calc(1+2)", "rgb(a,b,c)", "expression(alert(1))"])
    assert.equal(parseColor(v), null, v);
});

test("a minimal dark theme is completed from Tokyo Night and meets AA", () => {
  const { theme: t, ignored } = parseThemeCss(":root { --bg: #101418; --fg: #d8dee9; }", themes, "my-theme.css");
  assert.equal(t.name, "my theme");
  assert.equal(t.dark, true);
  assert.equal(t.bg, "#101418");
  assert.equal(t.h1, themes["tokyo-night"].h1);
  assert.deepEqual(ignored, []);
  const shown = { ...t, ...t.aa };
  for (const k of ["fg", "fgMuted", "link", "h1", "h2", "bold", "codeFg", "tag"]) assert.ok(contrast(shown[k], t.bg) >= 4.5, k);
});

test("a light background picks a light base and its own name", () => {
  const { theme: t } = parseThemeCss(":root { --theme-name: \"Paper\"; --bg: #fbf7ef; --fg: #2b2b2b; --accent: #b4540a; }", themes);
  assert.equal(t.dark, false);
  assert.equal(t.name, "Paper");
  assert.equal(t.accent, "#b4540a");
  assert.equal(t.link, "#b4540a");
  assert.equal(t.red, themes["tokyo-night-light"].red);
  assert.ok(contrast(t.fg, t.bg) >= 4.5);
});

test("--theme-base borrows another built-in theme of the same kind", () => {
  const { theme: t } = parseThemeCss(":root { --theme-base: dracula; --bg: #1e1f29; --fg: #f8f8f2; }", themes);
  assert.equal(t.red, themes.dracula.red);
  const wrongKind = parseThemeCss(":root { --theme-base: alucard; --bg: #1e1f29; --fg: #f8f8f2; }", themes).theme;   // a light base for a dark theme
  assert.equal(wrongKind.red, themes["tokyo-night"].red);
});

test("explicit values win, including highlight colours and translucent ones", () => {
  const { theme: t } = parseThemeCss(":root { --bg: #000000; --fg: #ffffff; --h1: #ff0000; --hl-keyword: hsl(120 100% 50%); --selection: rgba(255,255,255,0.5); --bg-alt: #111111; }", themes);
  assert.equal(t.h1, "#ff0000");
  assert.equal(t.hljs.keyword, "#00ff00");
  assert.equal(t.selection, mix("#ffffff", "#000000", 0.5));
  assert.equal(t.bgAlt, "#111111");
});

test("anything that isn't a colour variable is ignored and reported", () => {
  const css = `@import url(https://example.com/x.css);
    body { background: url(https://example.com/pixel.png); }
    :root { --bg: #101418; --fg: #d8dee9; --font: "Comic Sans"; --accent: url(https://example.com/a); --h2: nonsense; margin: 0; }`;
  const { theme: t, ignored } = parseThemeCss(css, themes);
  assert.deepEqual(ignored.sort(), ["--accent", "--font", "--h2", "margin"]);
  assert.equal(t.accent, themes["tokyo-night"].accent);
  assert.ok(!JSON.stringify(t).includes("example.com"));
});

test("comments are ignored and :root / html blocks are merged", () => {
  const css = "/* :root { --bg: #ffffff; } */ :root { --bg: #101418; }\nhtml { --fg: #d8dee9; }";
  const { theme: t } = parseThemeCss(css, themes);
  assert.equal(t.bg, "#101418");
  assert.equal(t.fg, "#d8dee9");
});

test("bad files fail with a clear message", () => {
  assert.throws(() => parseThemeCss("", themes), /empty/);
  assert.throws(() => parseThemeCss("body { color: red }", themes), /No theme found/);
  assert.throws(() => parseThemeCss(":root { --bg: #000000; }", themes), /--bg and --fg/);
  assert.throws(() => parseThemeCss(":root { --bg: nope; --fg: #fff; }", themes), /--bg and --fg/);
  assert.throws(() => parseThemeCss(":root{--bg:#000;--fg:#fff;}" + " ".repeat(70000), themes), /too large/);
});

test("color-scheme decides dark or light when the colours are ambiguous", () => {
  const { theme: t } = parseThemeCss(":root { color-scheme: light; --bg: #707070; --fg: #000000; }", themes);
  assert.equal(t.dark, false);
});

test("theme ids are unique and safe", () => {
  assert.equal(newThemeId("My Theme!", []), "user:my-theme");
  assert.equal(newThemeId("My Theme!", ["user:my-theme"]), "user:my-theme-2");
  assert.equal(newThemeId("???", []), "user:theme");
});
