// Custom themes from a user's CSS file. Pure logic (no DOM), unit-tested in usertheme.test.js.
//
// A theme file sets colour variables in a :root block (see samples/custom-theme.css). Only colour values are read,
// and nothing else in the file is applied, so a theme can't load remote content or change the layout.
// The WCAG AA adjustment is the same algorithm tools/gen_themes.py runs for the built-in themes.

export const MAX_CSS_BYTES = 64 * 1024;

// css variable -> theme key
export const VARS = {
  bg: "bg", "bg-alt": "bgAlt", surface: "surface", fg: "fg", "fg-muted": "fgMuted", accent: "accent", link: "link",
  selection: "selection", h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6", bold: "bold", italic: "italic",
  "code-fg": "codeFg", "quote-border": "quoteBorder", checkbox: "checkbox", tag: "tag", red: "red", orange: "orange",
  yellow: "yellow", green: "green", cyan: "cyan", purple: "purple",
};
export const HLJS = ["keyword", "string", "number", "comment", "function", "title", "type", "variable", "attr", "builtin",
  "literal", "meta", "operator", "punctuation", "regexp", "deletion", "addition"];
const TEXT_ROLES = ["fg", "fgMuted", "accent", "link", "h1", "h2", "h3", "h4", "h5", "h6", "bold", "italic", "codeFg",
  "checkbox", "tag", "red", "orange", "yellow", "green", "cyan", "purple"];

// ---------------------------------------------------------------- colours
const AA = 4.5;
const hex2 = (n) => n.toString(16).padStart(2, "0");
const toHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);
const clamp8 = (x) => Math.max(0, Math.min(255, Math.round(x)));
/** Python's round(): halves go to the even neighbour, which keeps this port identical to gen_themes.py. */
function roundEven(x) {
  const f = Math.floor(x), d = x - f;
  return d < 0.5 ? f : d > 0.5 ? f + 1 : (f % 2 === 0 ? f : f + 1);
}
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const unlin = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, roundEven(c * 255))); };

export function luminance(h) {
  const [r, g, b] = rgbOf(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [la, lb] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}
const cbrt = Math.cbrt;
function toOklab(h) {
  const [r, g, b] = rgbOf(h).map(lin);
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function fromOklab(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return toHex(
    unlin(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    unlin(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    unlin(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s));
}
/** Smallest OKLab lightness change (darker on light backgrounds, lighter on dark) that reaches the target. */
export function meet(color, bg, target = AA) {
  if (contrast(color, bg) >= target) return color;
  let [L, A, B] = toOklab(color);
  const step = luminance(bg) > 0.18 ? -0.005 : 0.005;
  let out = color;
  for (let i = 0; i < 200; i++) {
    L = Math.max(0, Math.min(1, L + step));
    const shrink = L > 0.02 && L < 0.98 ? 1 : 0.5;
    out = fromOklab(L, A * shrink, B * shrink);
    if (contrast(out, bg) >= target) break;
  }
  return out;
}
/** wa parts of a over (1 - wa) parts of b. */
export function mix(a, b, wa) {
  const x = rgbOf(a), y = rgbOf(b);
  return toHex(...x.map((v, i) => roundEven(v * wa + y[i] * (1 - wa))));
}
function meetAll(color, bgs, target = AA) {
  for (let i = 0; i < 8; i++) {
    for (const bg of bgs) color = meet(color, bg, target);
    if (bgs.every((bg) => contrast(color, bg) >= target)) break;
  }
  return color;
}

/** WCAG AA overrides for a complete theme, as in gen_themes.py: sets t.soft and t.aa. */
export function withAA(t) {
  const { bg, bgAlt: alt } = t;
  let eff = Object.fromEntries(TEXT_ROLES.map((k) => [k, t[k]]));
  const callouts = ["red", "orange", "yellow", "green", "cyan", "purple", "accent"];
  for (let i = 0; i < 8; i++) {
    const common = [bg, alt, ...callouts.map((c) => mix(eff[c], bg, 0.10))];
    const next = {};
    for (const k of TEXT_ROLES) {
      const surfaces = [...common];
      if (k === "tag") surfaces.push(mix(eff.tag, bg, 0.14));
      if (k === "fg") surfaces.push(mix(eff.yellow, bg, 0.35));
      next[k] = meetAll(eff[k], surfaces);
    }
    const same = TEXT_ROLES.every((k) => next[k] === eff[k]);
    eff = next;
    if (same) break;
  }
  const aa = {};
  for (const k of TEXT_ROLES) if (eff[k] !== t[k]) aa[k] = eff[k];
  const soft = mix(eff.fg, bg, 0.68);
  t.soft = soft;
  const softAA = meetAll(soft, [bg, alt, ...callouts.map((c) => mix(eff[c], bg, 0.10)), mix(soft, bg, 0.10)]);
  if (softAA !== soft) aa.soft = softAA;
  const hl = {};
  for (const [k, v] of Object.entries(t.hljs)) { const m = meet(v, alt); if (m !== v) hl[k] = m; }
  if (Object.keys(hl).length) aa.hljs = hl;
  t.aa = aa;
  return t;
}

// ---------------------------------------------------------------- reading CSS colours
const NAMED = { black: "#000000", white: "#ffffff" };

function channel(s, max) {
  s = s.trim();
  if (/^[+-]?\d*\.?\d+%$/.test(s)) return (parseFloat(s) / 100) * max;
  return /^[+-]?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN;
}
function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((x) => x * 255);
}

/** [r, g, b, alpha] from #rgb, #rrggbb, #rgba, #rrggbbaa, rgb()/rgba(), hsl()/hsla(), black or white; else null. */
export function parseColor(v) {
  v = String(v).trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  if (NAMED[v]) return [...rgbOf(NAMED[v]), 1];
  m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(v);
  if (!m) return null;
  const parts = m[2].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  let alpha = 1;
  if (parts.length === 4) { alpha = channel(parts[3], 1); if (Number.isNaN(alpha)) return null; alpha = Math.max(0, Math.min(1, alpha)); }
  let rgb;
  if (m[1].startsWith("rgb")) rgb = parts.slice(0, 3).map((p) => channel(p, 255));
  else {
    const hue = parseFloat(parts[0]);
    rgb = hslToRgb(hue, channel(parts[1], 1), channel(parts[2], 1));
    if (Number.isNaN(hue)) return null;
  }
  return rgb.some((x) => Number.isNaN(x)) ? null : [...rgb.map(clamp8), alpha];
}

// ---------------------------------------------------------------- the theme file
function declarations(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const block = /(?<![\w.#:-])(?::root|html)\s*\{([^{}]*)\}/g;
  let b;
  while ((b = block.exec(text))) {
    for (const d of b[1].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) out.push([d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()]);
    }
  }
  return out;
}

const unquote = (s) => s.replace(/^(["'])(.*)\1$/, "$2");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "theme";

/**
 * Read a theme file. `bases` is the built-in theme map (themes.json); `fileName` names the theme when the file
 * doesn't. Returns { theme, ignored } or throws an Error with a message for the user.
 * --bg and --fg are required; the rest comes from the file, then from a built-in theme of the same kind
 * (--theme-base, or Tokyo Night / Tokyo Night Light), with the page-tone colours derived from --bg and --fg.
 */
export function parseThemeCss(css, bases, fileName = "") {
  if (typeof css !== "string" || !css.trim()) throw new Error("The file is empty");
  if (new TextEncoder().encode(css).length > MAX_CSS_BYTES) throw new Error("The file is too large for a theme (over 64 KB)");
  const decls = declarations(css);
  if (!decls.length) throw new Error("No theme found: put the colours in a :root { } block");

  const given = {}, hl = {}, ignored = [];
  let name = "", baseKey = "", mode = "";
  for (const [prop, value] of decls) {
    if (prop === "--theme-name") { name = unquote(value).slice(0, 40); continue; }
    if (prop === "--theme-base") { baseKey = unquote(value).trim(); continue; }
    if (prop === "--theme-mode" || prop === "color-scheme") { mode = /light/.test(value) && !/dark/.test(value) ? "light" : /dark/.test(value) ? "dark" : mode; continue; }
    if (!prop.startsWith("--")) { ignored.push(prop); continue; }
    const key = prop.slice(2);
    const hlKey = key.startsWith("hl-") ? key.slice(3) : null;
    if (!(key in VARS) && !(hlKey && HLJS.includes(hlKey))) { ignored.push(prop); continue; }
    const c = parseColor(value);
    if (!c) { ignored.push(prop); continue; }
    if (hlKey) hl[hlKey] = c; else given[VARS[key]] = c;
  }
  if (!given.bg || !given.fg) throw new Error("A theme needs at least --bg and --fg");

  // Flatten translucent colours over the page colour.
  const bg = toHex(...given.bg.slice(0, 3));
  const flat = (c) => (c[3] >= 1 ? toHex(c[0], c[1], c[2]) : mix(toHex(c[0], c[1], c[2]), bg, c[3]));
  const fg = flat(given.fg);
  const dark = mode ? mode === "dark" : luminance(bg) < 0.4;
  const base = bases[baseKey] && !!bases[baseKey].dark === dark ? bases[baseKey] : bases[dark ? "tokyo-night" : "tokyo-night-light"];
  if (!base) throw new Error("The built-in themes aren't loaded");

  const t = { ...base, hljs: { ...base.hljs } };
  delete t.aa; delete t.soft;
  const accent = given.accent ? flat(given.accent) : base.accent;
  Object.assign(t, {
    name: name || fileName.replace(/\.[^.]*$/, "").replace(/[-_]+/g, " ").trim() || "Custom theme",
    dark, source: "Custom theme file", bg, fg, accent,
    bgAlt: mix(fg, bg, 0.05), surface: mix(fg, bg, 0.12), fgMuted: mix(fg, bg, 0.55), selection: mix(accent, bg, 0.28),
  });
  if (!given.link) t.link = accent;
  if (!given.quoteBorder) t.quoteBorder = accent;
  if (!given.checkbox) t.checkbox = accent;
  for (const [k, c] of Object.entries(given)) if (!["bg", "fg", "accent"].includes(k)) t[k] = flat(c);
  for (const [k, c] of Object.entries(hl)) t.hljs[k] = flat(c);
  return { theme: withAA(t), ignored };
}

/** A unique id for a new custom theme among the existing ids. */
export function newThemeId(name, existing) {
  const base = "user:" + slug(name);
  let id = base, n = 2;
  while (existing.includes(id)) id = `${base}-${n++}`;
  return id;
}
