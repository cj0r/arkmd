#!/usr/bin/env python3
"""Generate app/src/main/assets/themes.json from official palettes.

Palettes come from tools/palettes-extracted.json (extracted from each theme's official source, see
SOURCES) plus the small fixed palettes below. Each family maps palette roles to ArkMD fields once,
so every variant of a family gets the same heading order and syntax roles.

    python3 tools/gen_themes.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(HERE, "palettes-extracted.json")))

SOURCES = {
    "tokyonight": "folke/tokyonight.nvim extras/lua (night, storm, moon, day)",
    "catppuccin": "catppuccin/palette palette.json; heading order from catppuccin/vscode",
    "rosepine": "@rose-pine/palette; heading order from rose-pine/obsidian",
    "dracula": "draculatheme.com/spec (Dracula Classic, Alucard Classic); heading order from dracula/obsidian",
    "github": "@primer/primitives 7.17.1 (prettylights syntax colours)",
    "monokai": "VS Code built-in Monokai / Monokai Dimmed themes",
    "onedark": "Binaryify/OneDark-Pro themes (default, night-flat)",
    "nord": "nordtheme.com palette; frost-first headings",
}

# Fixed palettes (small, read from the sources above).
# Roles read from VS Code's built-in Monokai / Monokai Dimmed token colours (tokenColors by scope).
MONOKAI = {
    "classic": dict(bg="#272822", bgAlt="#1e1f1c", surface="#3e3d32", fg="#f8f8f2", comment="#88846f",
                    selection="#57595a",  # #878b91 @ 50% over the background
                    keyword="#f92672", string="#e6db74", number="#ae81ff", function="#a6e22e", type="#66d9ef",
                    attr="#a6e22e", builtin="#66d9ef", literal="#ae81ff", param="#fd971f", deleted="#f92672",
                    inserted="#a6e22e", emphasis="#66d9ef",
                    # heading = official markup.heading green first, then the rest of the palette
                    headings=["#a6e22e", "#66d9ef", "#ae81ff", "#f92672", "#fd971f", "#e6db74"],
                    red="#f92672", orange="#fd971f", yellow="#e6db74", green="#a6e22e", blue="#66d9ef", purple="#ae81ff"),
    "dimmed": dict(bg="#1e1e1e", bgAlt="#272727", surface="#303030", fg="#c5c8c6", comment="#9a9b99",
                   selection="#434547",  # #676b71 @ 50% over the background
                   keyword="#9872a2", string="#9aa83a", number="#6089b4", function="#ce6700", type="#c7444a",
                   attr="#d0b344", builtin="#9872a2", literal="#408080", param="#6089b4", deleted="#dc322f",
                   inserted="#219186", emphasis="#6089b4",
                   headings=["#d0b344", "#ce6700", "#c7444a", "#9872a2", "#6089b4", "#9aa83a"],
                   red="#c7444a", orange="#ce6700", yellow="#d0b344", green="#9aa83a", blue="#6089b4", purple="#9872a2"),
}
ONEDARK = dict(fg="#abb2bf", comment="#7f848e", surface="#3e4451", selection="#3e4451", red="#e06c75", orange="#d19a66",
               yellow="#e5c07b", green="#98c379", cyan="#56b6c2", blue="#61afef", purple="#c678dd")
ONEDARK_BG = {"": ("#282c34", "#21252b"), "-night-flat": ("#16191d", "#1e2227")}
NORD = {f"nord{i}": h for i, h in enumerate(
    ["#2e3440", "#3b4252", "#434c5e", "#4c566a", "#d8dee9", "#e5e9f0", "#eceff4", "#8fbcbb",
     "#88c0d0", "#81a1c1", "#5e81ac", "#bf616a", "#d08770", "#ebcb8b", "#a3be8c", "#b48ead"])}
NORD_COMMENT = "#616e88"  # nord3 brightened; the comment colour of nordtheme/visual-studio-code


def theme(name, dark, *, bg, bgAlt, surface, fg, fgMuted, accent, link, selection, headings, bold, italic, codeFg,
          quoteBorder, checkbox, tag, red, orange, yellow, green, cyan, purple, hljs, source):
    t = dict(name=name, dark=dark, source=source, bg=bg, bgAlt=bgAlt, surface=surface, fg=fg, fgMuted=fgMuted,
             accent=accent, link=link, selection=selection, bold=bold, italic=italic, codeFg=codeFg,
             quoteBorder=quoteBorder, checkbox=checkbox, tag=tag, red=red, orange=orange, yellow=yellow, green=green,
             cyan=cyan, purple=purple, hljs=hljs)
    for i, h in enumerate(headings, 1):
        t[f"h{i}"] = h
    return t


def hl(keyword, string, number, comment, function, title, type_, variable, attr, builtin, literal, meta, operator,
       punctuation, regexp, deletion, addition):
    return dict(keyword=keyword, string=string, number=number, comment=comment, function=function, title=title,
                type=type_, variable=variable, attr=attr, builtin=builtin, literal=literal, meta=meta,
                operator=operator, punctuation=punctuation, regexp=regexp, deletion=deletion, addition=addition)


def tokyonight(v, label):
    p = P[f"tokyonight-{v}"]
    return theme(label, v != "day", bg=p["bg"], bgAlt=p["bg_dark"], surface=p["bg_highlight"], fg=p["fg"],
                 fgMuted=p["comment"], accent=p["blue"], link=p["blue"], selection=p["bg_visual"],
                 headings=[p["red"], p["yellow"], p["green"], p["cyan"], p["blue"], p["magenta"]],
                 bold=p["orange"], italic=p["magenta"], codeFg=p["green"], quoteBorder=p["blue"],
                 checkbox=p["blue"], tag=p["cyan"], red=p["red"], orange=p["orange"], yellow=p["yellow"],
                 green=p["green"], cyan=p["cyan"], purple=p["magenta"],
                 hljs=hl(p["magenta"], p["green"], p["orange"], p["comment"], p["blue"], p["blue"], p["blue1"],
                         p["fg"], p["green1"], p["blue1"], p["orange"], p["cyan"], p["blue5"], p["fg_dark"],
                         p["blue6"], p["red"], p["green"]),
                 source=SOURCES["tokyonight"])


def catppuccin(v, label):
    p = P[f"catppuccin-{v}"]
    return theme(label, v != "latte", bg=p["base"], bgAlt=p["mantle"], surface=p["surface0"], fg=p["text"],
                 fgMuted=p["overlay1"], accent=p["mauve"], link=p["blue"], selection=p["surface1"],
                 headings=[p["red"], p["peach"], p["yellow"], p["green"], p["sapphire"], p["lavender"]],
                 bold=p["peach"], italic=p["pink"], codeFg=p["green"], quoteBorder=p["lavender"],
                 checkbox=p["green"], tag=p["sky"], red=p["red"], orange=p["peach"], yellow=p["yellow"],
                 green=p["green"], cyan=p["sky"], purple=p["mauve"],
                 hljs=hl(p["mauve"], p["green"], p["peach"], p["overlay2"], p["blue"], p["blue"], p["yellow"],
                         p["text"], p["yellow"], p["red"], p["peach"], p["pink"], p["sky"], p["overlay2"],
                         p["pink"], p["red"], p["green"]),
                 source=SOURCES["catppuccin"])


def rosepine(v, label):
    p = P[f"rosepine-{v}"]
    return theme(label, v != "dawn", bg=p["base"], bgAlt=p["surface"], surface=p["highlightMed"], fg=p["text"],
                 fgMuted=p["muted"], accent=p["iris"], link=p["foam"], selection=p["highlightMed"],
                 headings=[p["love"], p["iris"], p["rose"], p["gold"], p["foam"], p["pine"]],
                 bold=p["rose"], italic=p["iris"], codeFg=p["rose"], quoteBorder=p["iris"], checkbox=p["foam"],
                 tag=p["foam"], red=p["love"], orange=p["rose"], yellow=p["gold"], green=p["pine"],
                 cyan=p["foam"], purple=p["iris"],
                 hljs=hl(p["pine"], p["gold"], p["gold"], p["muted"], p["rose"], p["foam"], p["foam"], p["text"],
                         p["iris"], p["love"], p["gold"], p["iris"], p["subtle"], p["subtle"], p["gold"],
                         p["love"], p["foam"]),
                 source=SOURCES["rosepine"])


def dracula(key, label):
    p = P[key]
    return theme(label, key == "dracula", bg=p["background"], bgAlt=shade(p["background"], key == "dracula"),
                 surface=p["selection"], fg=p["foreground"], fgMuted=p["comment"], accent=p["purple"],
                 link=p["cyan"], selection=p["selection"],
                 headings=[p["purple"], p["orange"], p["green"], p["red"], p["yellow"], p["purple"]],
                 bold=p["orange"], italic=p["yellow"], codeFg=p["green"], quoteBorder=p["purple"],
                 checkbox=p["green"], tag=p["pink"], red=p["red"], orange=p["orange"], yellow=p["yellow"],
                 green=p["green"], cyan=p["cyan"], purple=p["purple"],
                 hljs=hl(p["pink"], p["yellow"], p["purple"], p["comment"], p["green"], p["green"], p["cyan"],
                         p["foreground"], p["green"], p["cyan"], p["purple"], p["pink"], p["pink"],
                         p["foreground"], p["red"], p["red"], p["green"]),
                 source=SOURCES["dracula"])


def github(v, label):
    p = P[f"github-{v}"]
    s = lambda k: p["prettylights.syntax." + k]
    return theme(label, v != "light", bg=p["canvas.default"], bgAlt=p["canvas.subtle"], surface=p["border.default"],
                 fg=p["fg.default"], fgMuted=p["fg.muted"], accent=p["accent.fg"], link=p["accent.fg"],
                 selection=p["accent.muted"] if "accent.muted" in p else p["border.default"],
                 headings=[s("constant"), s("entity"), s("entityTag"), s("variable"), s("keyword"), s("string")],
                 bold=p["fg.default"], italic=p["fg.default"], codeFg=s("string"), quoteBorder=p["border.default"],
                 checkbox=p["accent.fg"], tag=p["accent.fg"], red=p["danger.fg"], orange=p["severe.fg"],
                 yellow=p["attention.fg"], green=p["success.fg"], cyan=s("constant"), purple=p["done.fg"],
                 hljs=hl(s("keyword"), s("string"), s("constant"), s("comment"), s("entity"), s("entity"),
                         s("constant"), s("variable"), s("constant"), s("constant"), s("constant"), s("constant"),
                         s("constant"), p["fg.default"], s("stringRegexp"), s("markupDeletedText"),
                         s("markupInsertedText")),
                 source=SOURCES["github"])


def monokai(v, label):
    p = MONOKAI[v]
    return theme(label, True, bg=p["bg"], bgAlt=p["bgAlt"], surface=p["surface"], fg=p["fg"], fgMuted=p["comment"],
                 accent=p["keyword"], link=p["blue"], selection=p["selection"], headings=p["headings"],
                 bold=p["emphasis"], italic=p["emphasis"], codeFg=p["string"], quoteBorder=p["comment"],
                 checkbox=p["green"], tag=p["blue"], red=p["red"], orange=p["orange"], yellow=p["yellow"],
                 green=p["green"], cyan=p["blue"], purple=p["purple"],
                 hljs=hl(p["keyword"], p["string"], p["number"], p["comment"], p["function"], p["function"],
                         p["type"], p["fg"], p["attr"], p["builtin"], p["literal"], p["comment"], p["keyword"],
                         p["fg"], p["string"], p["deleted"], p["inserted"]),
                 source=SOURCES["monokai"])


def onedark(suffix, label):
    p = ONEDARK
    bg, bgAlt = ONEDARK_BG[suffix]
    return theme(label, True, bg=bg, bgAlt=bgAlt, surface=p["surface"], fg=p["fg"], fgMuted=p["comment"],
                 accent=p["blue"], link=p["blue"], selection=p["selection"],
                 headings=[p["red"], p["orange"], p["yellow"], p["green"], p["blue"], p["purple"]],
                 bold=p["orange"], italic=p["purple"], codeFg=p["green"], quoteBorder=p["blue"],
                 checkbox=p["blue"], tag=p["cyan"], red=p["red"], orange=p["orange"], yellow=p["yellow"],
                 green=p["green"], cyan=p["cyan"], purple=p["purple"],
                 hljs=hl(p["purple"], p["green"], p["orange"], p["comment"], p["blue"], p["blue"], p["yellow"],
                         p["red"], p["orange"], p["cyan"], p["orange"], p["cyan"], p["cyan"], p["fg"], p["cyan"],
                         p["red"], p["green"]),
                 source=SOURCES["onedark"])


def nord():
    n = NORD
    return theme("Nord", True, bg=n["nord0"], bgAlt=n["nord1"], surface=n["nord2"], fg=n["nord4"], fgMuted=NORD_COMMENT,
                 accent=n["nord8"], link=n["nord8"], selection=n["nord2"],
                 headings=[n["nord8"], n["nord9"], n["nord7"], n["nord10"], n["nord15"], n["nord14"]],
                 bold=n["nord6"], italic=n["nord7"], codeFg=n["nord7"], quoteBorder=n["nord9"],
                 checkbox=n["nord8"], tag=n["nord9"], red=n["nord11"], orange=n["nord12"], yellow=n["nord13"],
                 green=n["nord14"], cyan=n["nord8"], purple=n["nord15"],
                 hljs=hl(n["nord9"], n["nord14"], n["nord15"], NORD_COMMENT, n["nord8"], n["nord7"], n["nord7"],
                         n["nord4"], n["nord7"], n["nord9"], n["nord9"], n["nord10"], n["nord9"], n["nord6"],
                         n["nord13"], n["nord11"], n["nord14"]),
                 source=SOURCES["nord"])


# Light themes: every colour except the heading rainbow comes from the official VS Code extension's theme JSON
# (downloaded from Open VSX): editor/sidebar/code-block/border colours, comment, link, selection, markup roles
# (bold, italic, inline code, quote, list) and token colours. Headings keep the family's rainbow order using the
# theme's own palette. Alucard has no VS Code theme and stays on the Dracula spec.
LIGHT_SOURCES = {
    "tokyo-night-light": "enkia.tokyo-night 1.1.2, themes/tokyo-night-light-color-theme.json",
    "catppuccin-latte": "Catppuccin.catppuccin-vsc 3.19.0, themes/latte.json",
    "github-light": "GitHub.github-vscode-theme 6.3.5, themes/light-default.json",
    "rose-pine-dawn": "mvllow.rose-pine 2.15.2, themes/rose-pine-dawn-color-theme.json",
}
LIGHT = {
    "tokyo-night-light": dict(
        name="Tokyo Night Light", bg="#e6e7ed", bgAlt="#d6d8df", surface="#c1c2c7", fg="#343b59", fgMuted="#888b94",
        accent="#2959aa", link="#2959aa", selection=("#acb0bf", 0.25),
        headings=["#8c4351", "#8f5e15", "#385f0d", "#0f4b6e", "#2959aa", "#65359d"],  # red yellow green cyan blue magenta
        bold="#343b59", italic="#343b59", codeFg="#363c4d", quoteBorder="#2959aa", checkbox="#2959aa", tag="#0f4b6e",
        named=["#8c4351", "#965027", "#8f5e15", "#385f0d", "#0f4b6e", "#65359d"],
        hljs=["#65359d", "#385f0d", "#965027", "#888b94", "#2959aa", "#2959aa", "#006c86", "#343b58", "#65359d",
              "#006c86", "#965027", "#0f4b6e", "#006c86", "#006c86", "#3e6968", "#914c54", "#449dab"]),
    "catppuccin-latte": dict(
        name="Catppuccin Latte", bg="#eff1f5", bgAlt="#e6e9ef", surface="#acb0be", fg="#4c4f69", fgMuted="#7c7f93",
        accent="#8839ef", link="#1e66f5", selection=("#7c7f93", 0.30),
        headings=["#d20f39", "#fe640b", "#df8e1d", "#40a02b", "#209fb5", "#7287fd"],  # official per-level colours
        bold="#d20f39", italic="#d20f39", codeFg="#40a02b", quoteBorder="#ea76cb", checkbox="#179299", tag="#04a5e5",
        named=["#d20f39", "#fe640b", "#df8e1d", "#40a02b", "#04a5e5", "#8839ef"],
        hljs=["#8839ef", "#40a02b", "#fe640b", "#7c7f93", "#1e66f5", "#1e66f5", "#df8e1d", "#4c4f69", "#df8e1d",
              "#1e66f5", "#d20f39", "#ea76cb", "#179299", "#7c7f93", "#ea76cb", "#d20f39", "#40a02b"]),
    "github-light": dict(
        name="GitHub Light", bg="#ffffff", bgAlt="#f6f8fa", surface="#d0d7de", fg="#1f2328", fgMuted="#6e7781",
        accent="#0969da", link="#0969da", selection=("#0969da", 0.20),
        headings=["#0550ae", "#8250df", "#116329", "#953800", "#cf222e", "#0a3069"],  # Primer syntax colours
        bold="#1f2328", italic="#1f2328", codeFg="#0550ae", quoteBorder="#d0d7de", checkbox="#0969da", tag="#0969da",
        named=["#cf222e", "#953800", "#9a6700", "#116329", "#0550ae", "#8250df"],
        hljs=["#cf222e", "#0a3069", "#0550ae", "#6e7781", "#8250df", "#8250df", "#953800", "#953800", "#0550ae",
              "#0550ae", "#0550ae", "#0550ae", "#0550ae", "#1f2328", "#0a3069", "#82071e", "#116329"]),
    "rose-pine-dawn": dict(
        name="Rosé Pine Dawn", bg="#faf4ed", bgAlt="#fffaf3", surface="#dfdad9", fg="#575279", fgMuted="#9893a5",
        accent="#907aa9", link="#907aa9", selection=("#6e6a86", 0.15),
        headings=["#b4637a", "#907aa9", "#d7827e", "#ea9d34", "#56949f", "#286983"],  # love iris rose gold foam pine
        bold="#575279", italic="#575279", codeFg="#575279", quoteBorder="#907aa9", checkbox="#56949f", tag="#56949f",
        named=["#b4637a", "#d7827e", "#ea9d34", "#286983", "#56949f", "#907aa9"],
        hljs=["#286983", "#ea9d34", "#d7827e", "#9893a5", "#b4637a", "#b4637a", "#56949f", "#d7827e", "#907aa9",
              "#b4637a", "#d7827e", "#907aa9", "#286983", "#797593", "#ea9d34", "#b4637a", "#286983"]),
}


def blend(hex_, alpha, over):
    a = [int(hex_[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(over[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02x%02x%02x" % tuple(round(x * alpha + y * (1 - alpha)) for x, y in zip(a, b))


def light(key):
    p = LIGHT[key]
    red, orange, yellow, green, cyan, purple = p["named"]
    return theme(p["name"], False, bg=p["bg"], bgAlt=p["bgAlt"], surface=p["surface"], fg=p["fg"], fgMuted=p["fgMuted"],
                 accent=p["accent"], link=p["link"], selection=blend(*p["selection"], p["bg"]), headings=p["headings"],
                 bold=p["bold"], italic=p["italic"], codeFg=p["codeFg"], quoteBorder=p["quoteBorder"],
                 checkbox=p["checkbox"], tag=p["tag"], red=red, orange=orange, yellow=yellow, green=green, cyan=cyan,
                 purple=purple, hljs=hl(*p["hljs"]), source=LIGHT_SOURCES[key])


def shade(hex_, darker):
    """Code-block background a step away from the page background (Dracula has none in its spec)."""
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    f = 0.82 if darker else 0.95
    return "#%02x%02x%02x" % (int(r * f), int(g * f), int(b * f))


# ---------------------------------------------------------------- WCAG AA contrast
# Official colours stay the source. For each theme we also emit "aa": the text colours that fall below 4.5:1
# (WCAG AA for normal text, so it holds at every font size), moved in OKLab lightness only as far as needed to
# pass, keeping hue and chroma. The app applies "aa" unless the user turns contrast mode off.
AA = 4.5
TEXT_ROLES = ["fg", "fgMuted", "accent", "link", "h1", "h2", "h3", "h4", "h5", "h6", "bold", "italic", "codeFg",
              "checkbox", "tag", "red", "orange", "yellow", "green", "cyan", "purple"]


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _unlin(c):
    c = 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return max(0, min(255, round(c * 255)))


def _rgb(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def luminance(h):
    r, g, b = (_lin(x) for x in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def _to_oklab(h):
    r, g, b = (_lin(x) for x in _rgb(h))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s_,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s_,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s_)


def _from_oklab(L, A, B):
    l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s_ = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s_
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s_
    b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s_
    return "#%02x%02x%02x" % (_unlin(r), _unlin(g), _unlin(b))


def meet(color, bg, target=AA):
    """Smallest OKLab lightness change (darker on light backgrounds, lighter on dark) that reaches target."""
    if contrast(color, bg) >= target:
        return color
    L, A, B = _to_oklab(color)
    step = -0.005 if luminance(bg) > 0.18 else 0.005
    out = color
    for _ in range(200):
        L = max(0.0, min(1.0, L + step))
        shrink = 1.0 if 0.02 < L < 0.98 else 0.5          # keep extreme lightness in gamut
        out = _from_oklab(L, A * shrink, B * shrink)
        if contrast(out, bg) >= target:
            break
    return out


def mix(a, b, wa):
    return "#%02x%02x%02x" % tuple(round(x * wa + y * (1 - wa)) for x, y in zip(_rgb(a), _rgb(b)))


def meet_all(color, bgs, target=AA):
    """Adjust until the colour passes against every background it is drawn on."""
    for _ in range(8):
        for bg in bgs:
            color = meet(color, bg, target)
        if all(contrast(color, bg) >= target for bg in bgs):
            break
    return color


def with_aa(t):
    """WCAG AA overrides. Each text role is checked against every surface it is drawn on in the reader/editor,
    using the displayed (already adjusted) colours for tinted surfaces: callout titles on a 10% tint of their
    colour, tag chips on a 14% tint, ==mark== text on a 35% yellow tint, table headers and code labels on the
    code-block background. Repeats until stable, since adjusting a colour also changes its tint."""
    bg, alt = t["bg"], t["bgAlt"]
    eff = {k: t[k] for k in TEXT_ROLES}
    callouts = ["red", "orange", "yellow", "green", "cyan", "purple", "accent"]
    for _ in range(8):
        # Any text can appear on the page, in a code block, or inside any callout (10% tint of its colour).
        common = [bg, alt] + [mix(eff[c], bg, 0.10) for c in callouts]
        surfaces = {k: list(common) for k in TEXT_ROLES}
        surfaces["tag"] += [mix(eff["tag"], bg, 0.14)]
        surfaces["fg"] += [mix(eff["yellow"], bg, 0.35)]     # ==mark== text on a 35% yellow tint
        new = {k: meet_all(eff[k], surfaces[k]) for k in TEXT_ROLES}
        if new == eff:
            break
        eff = new
    aa = {k: v for k, v in eff.items() if v != t[k]}
    # Secondary prose (quotes, front matter, footnotes, done tasks): 68% fg over bg, raised to AA if needed.
    soft = mix(eff["fg"], bg, 0.68)
    t["soft"] = soft
    soft_aa = meet_all(soft, [bg, alt] + [mix(eff[c], bg, 0.10) for c in callouts] + [mix(soft, bg, 0.10)])
    if soft_aa != soft:
        aa["soft"] = soft_aa
    hl = {k: meet(v, alt) for k, v in t["hljs"].items() if meet(v, alt) != v}
    if hl:
        aa["hljs"] = hl
    t["aa"] = aa
    return t


THEMES = {
    "tokyo-night": tokyonight("night", "Tokyo Night"),
    "tokyo-night-storm": tokyonight("storm", "Tokyo Night Storm"),
    "tokyo-night-moon": tokyonight("moon", "Tokyo Night Moon"),
    "tokyo-night-light": light("tokyo-night-light"),
    "catppuccin-mocha": catppuccin("mocha", "Catppuccin Mocha"),
    "catppuccin-macchiato": catppuccin("macchiato", "Catppuccin Macchiato"),
    "catppuccin-frappe": catppuccin("frappe", "Catppuccin Frappé"),
    "catppuccin-latte": light("catppuccin-latte"),
    "dracula": dracula("dracula", "Dracula"),
    "alucard": dracula("alucard", "Dracula Alucard"),
    "github-dark": github("dark", "GitHub Dark"),
    "github-dark-dimmed": github("dark_dimmed", "GitHub Dark Dimmed"),
    "github-light": light("github-light"),
    "monokai": monokai("classic", "Monokai"),
    "monokai-dimmed": monokai("dimmed", "Monokai Dimmed"),
    "rose-pine": rosepine("main", "Rosé Pine"),
    "rose-pine-moon": rosepine("moon", "Rosé Pine Moon"),
    "rose-pine-dawn": light("rose-pine-dawn"),
    "one-dark-pro": onedark("", "One Dark Pro"),
    "one-dark-pro-night-flat": onedark("-night-flat", "One Dark Pro Night Flat"),
    "nord": nord(),
}

THEMES = {k: with_aa(v) for k, v in THEMES.items()}

if __name__ == "__main__":
    out = os.path.join(HERE, "..", "shared", "web", "themes.json")
    with open(out, "w") as f:
        json.dump(THEMES, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {len(THEMES)} themes")
    import runpy
    runpy.run_path(os.path.join(HERE, "theme_sheet.py"), run_name="__main__")
