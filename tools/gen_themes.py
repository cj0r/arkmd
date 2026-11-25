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
        # Cool, cohesive heading order (mauve, blue, sapphire, teal, green, lavender) around the mauve accent; the
        # official per-level colours (red, peach, yellow) made a warm clash of red and brown on the light base.
        headings=["#8839ef", "#1e66f5", "#209fb5", "#179299", "#40a02b", "#7287fd"],
        bold="#4c4f69", italic="#8839ef", codeFg="#40a02b", quoteBorder="#7287fd", checkbox="#1e66f5", tag="#04a5e5",
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


# ---------------------------------------------------------------- more families (hand-entered palettes)
# Colours below are each project's published palette, entered by hand (unlike the extracted families above). One
# role mapping serves them all: headings run red, yellow, green, cyan, blue, purple unless a family sets its own;
# bold is the orange, italic the purple, code the green. Text colours that fall short of WCAG AA are adjusted by
# with_aa() like every other theme, which matters most for the light ones.
def simple(name, dark, source, *, bg, bgAlt, surface, selection, fg, comment, red, orange, yellow, green, cyan, blue,
           purple, accent=None, link=None, headings=None, bold=None, italic=None, tag=None, hl_over=None, code_fg=None,
           quote_border=None):
    h = dict(keyword=purple, string=green, number=orange, comment=comment, function=blue, title=blue, type=yellow,
             variable=fg, attr=yellow, builtin=cyan, literal=orange, meta=cyan, operator=cyan, punctuation=comment,
             regexp=cyan, deletion=red, addition=green)
    h.update(hl_over or {})
    return theme(name, dark, bg=bg, bgAlt=bgAlt, surface=surface, fg=fg, fgMuted=comment, accent=accent or blue,
                 link=link or blue, selection=selection,
                 headings=headings or [red, yellow, green, cyan, blue, purple], bold=bold or orange,
                 italic=italic or purple, codeFg=code_fg or green, quoteBorder=quote_border or accent or blue,
                 checkbox=accent or blue,
                 tag=tag or cyan, red=red, orange=orange, yellow=yellow, green=green, cyan=cyan, purple=purple,
                 hljs=hl(h["keyword"], h["string"], h["number"], h["comment"], h["function"],
                         h["title"], h["type"], h["variable"], h["attr"], h["builtin"], h["literal"], h["meta"],
                         h["operator"], h["punctuation"], h["regexp"], h["deletion"], h["addition"]),
                 source=source)


EXTRA = {
    "gruvbox-dark": simple("Gruvbox Dark", True, "morhetz/gruvbox palette, medium contrast", bg="#282828", bgAlt="#1d2021",
        surface="#3c3836", selection="#504945", fg="#ebdbb2", comment="#928374", red="#fb4934", orange="#fe8019",
        yellow="#fabd2f", green="#b8bb26", cyan="#8ec07c", blue="#83a598", purple="#d3869b", accent="#fabd2f",
        headings=["#fb4934", "#fe8019", "#fabd2f", "#b8bb26", "#8ec07c", "#83a598"]),
    "gruvbox-light": simple("Gruvbox Light", False, "morhetz/gruvbox palette, medium contrast", bg="#fbf1c7", bgAlt="#ebdbb2",
        surface="#d5c4a1", selection="#d5c4a1", fg="#3c3836", comment="#7c6f64", red="#9d0006", orange="#af3a03",
        yellow="#b57614", green="#79740e", cyan="#427b58", blue="#076678", purple="#8f3f71", accent="#b57614",
        headings=["#9d0006", "#af3a03", "#b57614", "#79740e", "#427b58", "#076678"]),
    "solarized-dark": simple("Solarized Dark", True, "Ethan Schoonover's Solarized palette", bg="#002b36", bgAlt="#00212b",
        surface="#073642", selection="#274642", fg="#839496", comment="#586e75", red="#dc322f", orange="#cb4b16",
        yellow="#b58900", green="#859900", cyan="#2aa198", blue="#268bd2", purple="#6c71c4", accent="#268bd2",
        headings=["#cb4b16", "#b58900", "#859900", "#2aa198", "#268bd2", "#6c71c4"]),
    "solarized-light": simple("Solarized Light", False, "Ethan Schoonover's Solarized palette", bg="#fdf6e3", bgAlt="#eee8d5",
        surface="#ddd6c1", selection="#eee8d5", fg="#657b83", comment="#93a1a1", red="#dc322f", orange="#cb4b16",
        yellow="#b58900", green="#859900", cyan="#2aa198", blue="#268bd2", purple="#6c71c4", accent="#268bd2",
        headings=["#cb4b16", "#b58900", "#859900", "#2aa198", "#268bd2", "#6c71c4"]),
    "everforest-dark": simple("Everforest Dark", True, "sainnhe/everforest palette, medium contrast", bg="#2d353b",
        bgAlt="#232a2e", surface="#3d484d", selection="#475258", fg="#d3c6aa", comment="#859289", red="#e67e80",
        orange="#e69875", yellow="#dbbc7f", green="#a7c080", cyan="#83c092", blue="#7fbbb3", purple="#d699b6",
        accent="#a7c080", headings=["#e67e80", "#e69875", "#dbbc7f", "#a7c080", "#83c092", "#7fbbb3"]),
    "everforest-light": simple("Everforest Light", False, "sainnhe/everforest palette, medium contrast", bg="#fdf6e3",
        bgAlt="#f4f0d9", surface="#e6e2cc", selection="#e6e2cc", fg="#5c6a72", comment="#939f91", red="#f85552",
        orange="#f57d26", yellow="#dfa000", green="#8da101", cyan="#35a77c", blue="#3a94c5", purple="#df69ba",
        accent="#8da101", headings=["#f85552", "#f57d26", "#dfa000", "#8da101", "#35a77c", "#3a94c5"]),
    "ayu-dark": simple("Ayu Dark", True, "ayu-theme/ayu-colors, dark", bg="#0b0e14", bgAlt="#0d1017", surface="#1b1f2a",
        selection="#202d3c", fg="#bfbdb6", comment="#626a73", red="#f07178", orange="#ff8f40", yellow="#e6b450",
        green="#aad94c", cyan="#95e6cb", blue="#59c2ff", purple="#d2a6ff", accent="#e6b450",
        headings=["#ff8f40", "#e6b450", "#aad94c", "#95e6cb", "#59c2ff", "#d2a6ff"]),
    "ayu-mirage": simple("Ayu Mirage", True, "ayu-theme/ayu-colors, mirage", bg="#1f2430", bgAlt="#1a1f29",
        surface="#2a3140", selection="#34455a", fg="#cccac2", comment="#707a8c", red="#f28779", orange="#ffad66",
        yellow="#ffd173", green="#d5ff80", cyan="#95e6cb", blue="#73d0ff", purple="#dfbfff", accent="#ffcc66",
        headings=["#ffad66", "#ffd173", "#d5ff80", "#95e6cb", "#73d0ff", "#dfbfff"]),
    "ayu-light": simple("Ayu Light", False, "ayu-theme/ayu-colors, light", bg="#fcfcfc", bgAlt="#f3f4f5", surface="#e7e8e9",
        selection="#d1e4f4", fg="#5c6166", comment="#8a9199", red="#e65050", orange="#fa8d3e", yellow="#f2ae49",
        green="#86b300", cyan="#4cbf99", blue="#399ee6", purple="#a37acc", accent="#ff9940",
        headings=["#fa8d3e", "#f2ae49", "#86b300", "#4cbf99", "#399ee6", "#a37acc"]),
    "one-light": simple("One Light", False, "Atom One Light (atom/one-light-syntax)", bg="#fafafa", bgAlt="#eaeaeb",
        surface="#dbdbdc", selection="#e5e5e6", fg="#383a42", comment="#a0a1a7", red="#e45649", orange="#986801",
        yellow="#c18401", green="#50a14f", cyan="#0184bc", blue="#4078f2", purple="#a626a4", accent="#4078f2",
        headings=["#e45649", "#986801", "#c18401", "#50a14f", "#0184bc", "#a626a4"]),
    "night-owl": simple("Night Owl", True, "sdras/night-owl-vscode-theme", bg="#011627", bgAlt="#010e1a", surface="#0b2942",
        selection="#1d3b53", fg="#d6deeb", comment="#637777", red="#ef5350", orange="#f78c6c", yellow="#ecc48d",
        green="#addb67", cyan="#7fdbca", blue="#82aaff", purple="#c792ea", accent="#7e57c2",
        headings=["#c792ea", "#ecc48d", "#addb67", "#7fdbca", "#82aaff", "#f78c6c"]),
    "light-owl": simple("Night Owl Light", False, "sdras/night-owl-vscode-theme, Light Owl", bg="#fbfbfb", bgAlt="#f0f0f0",
        surface="#e0e7ea", selection="#e0e7ea", fg="#403f53", comment="#989fb1", red="#de3d3b", orange="#c96765",
        yellow="#aa8b00", green="#08916a", cyan="#0c969b", blue="#4876d6", purple="#994cc3", accent="#2aa298",
        headings=["#994cc3", "#aa8b00", "#08916a", "#0c969b", "#4876d6", "#c96765"]),
    "synthwave-84": simple("SynthWave '84", True, "robb0wen/synthwave-vscode palette", bg="#262335", bgAlt="#1e1b2d",
        surface="#34294f", selection="#463465", fg="#ffffff", comment="#848bbd", red="#fe4450", orange="#f97e72",
        yellow="#fede5d", green="#72f1b8", cyan="#36f9f6", blue="#2ee2fa", purple="#b893ce", accent="#ff7edb",
        link="#36f9f6", headings=["#ff7edb", "#fede5d", "#72f1b8", "#36f9f6", "#b893ce", "#f97e72"]),
    "panda": simple("Panda", True, "PandaTheme/panda-syntax-vscode palette", bg="#292a2b", bgAlt="#242526",
        surface="#31353a", selection="#43474b", fg="#e6e6e6", comment="#757575", red="#ff2c6d", orange="#ffb86c",
        yellow="#ffcc95", green="#19f9d8", cyan="#45a9f9", blue="#6fc1ff", purple="#b084eb", accent="#ff75b5",
        headings=["#ff75b5", "#ffb86c", "#19f9d8", "#6fc1ff", "#b084eb", "#ff2c6d"]),
    "nightfox": simple("Nightfox", True, "EdenEast/nightfox.nvim, nightfox", bg="#192330", bgAlt="#131a24", surface="#29394f",
        selection="#2b3b51", fg="#cdcecf", comment="#738091", red="#c94f6d", orange="#f4a261", yellow="#dbc074",
        green="#81b29a", cyan="#63cdcf", blue="#719cd6", purple="#9d79d6", accent="#719cd6",
        headings=["#c94f6d", "#f4a261", "#dbc074", "#81b29a", "#719cd6", "#9d79d6"]),
    "dayfox": simple("Dayfox", False, "EdenEast/nightfox.nvim, dayfox", bg="#f6f2ee", bgAlt="#e4dcd4", surface="#d6d0cb",
        selection="#e7d2be", fg="#3d2b5a", comment="#837a72", red="#a5222f", orange="#955f61", yellow="#ac5402",
        green="#396847", cyan="#287980", blue="#2848a9", purple="#6e33ce", accent="#2848a9",
        headings=["#a5222f", "#ac5402", "#396847", "#287980", "#2848a9", "#6e33ce"]),
    "vscode-dark": simple("VS Code Dark+", True, "Visual Studio Code default Dark+ theme", bg="#1e1e1e", bgAlt="#252526",
        surface="#2d2d30", selection="#264f78", fg="#d4d4d4", comment="#6a9955", red="#f44747", orange="#ce9178",
        yellow="#dcdcaa", green="#b5cea8", cyan="#4ec9b0", blue="#569cd6", purple="#c586c0", accent="#007acc",
        link="#3794ff", headings=["#569cd6", "#c586c0", "#4ec9b0", "#dcdcaa", "#ce9178", "#9cdcfe"],
        bold="#569cd6", italic="#c586c0",
        hl_over=dict(string="#ce9178", number="#b5cea8", variable="#9cdcfe", keyword="#569cd6", function="#dcdcaa",
                     title="#dcdcaa", type="#4ec9b0", attr="#9cdcfe", builtin="#4ec9b0", literal="#569cd6",
                     meta="#c586c0", operator="#d4d4d4", regexp="#d16969")),
    "vscode-light": simple("VS Code Light+", False, "Visual Studio Code default Light+ theme", bg="#ffffff", bgAlt="#f3f3f3",
        surface="#e8e8e8", selection="#add6ff", fg="#1f1f1f", comment="#008000", red="#cd3131", orange="#a31515",
        yellow="#795e26", green="#098658", cyan="#267f99", blue="#0000ff", purple="#af00db", accent="#005fb8",
        link="#005fb8", headings=["#0000ff", "#af00db", "#267f99", "#795e26", "#a31515", "#001080"],
        bold="#0000ff", italic="#af00db",
        hl_over=dict(string="#a31515", number="#098658", variable="#001080", keyword="#0000ff", function="#795e26",
                     title="#795e26", type="#267f99", attr="#001080", builtin="#267f99", literal="#0000ff",
                     meta="#af00db", operator="#1f1f1f", regexp="#811f3f")),
    "material-palenight": simple("Material Palenight", True, "equinusocio/vsc-material-theme, Palenight", bg="#292d3e",
        bgAlt="#232635", surface="#32364a", selection="#444267", fg="#a6accd", comment="#676e95", red="#f07178",
        orange="#f78c6c", yellow="#ffcb6b", green="#c3e88d", cyan="#89ddff", blue="#82aaff", purple="#c792ea",
        accent="#ab47bc", headings=["#f07178", "#ffcb6b", "#c3e88d", "#89ddff", "#82aaff", "#c792ea"]),
    "material-ocean": simple("Material Ocean", True, "equinusocio/vsc-material-theme, Ocean", bg="#0f111a", bgAlt="#090b10",
        surface="#1a1c25", selection="#1f2233", fg="#8f93a2", comment="#464b5d", red="#f07178", orange="#f78c6c",
        yellow="#ffcb6b", green="#c3e88d", cyan="#89ddff", blue="#82aaff", purple="#c792ea", accent="#84ffff",
        headings=["#f07178", "#ffcb6b", "#c3e88d", "#89ddff", "#82aaff", "#c792ea"]),
    "material-lighter": simple("Material Lighter", False, "equinusocio/vsc-material-theme, Lighter", bg="#fafafa",
        bgAlt="#f4f4f4", surface="#e7eaec", selection="#d4ebe9", fg="#90a4ae", comment="#aabfc9", red="#e53935",
        orange="#f76d47", yellow="#ffb62c", green="#91b859", cyan="#39adb5", blue="#6182b8", purple="#7c4dff",
        accent="#00bcd4", headings=["#e53935", "#f76d47", "#91b859", "#39adb5", "#6182b8", "#7c4dff"]),
    # Plain, low-saturation themes for people who want an ordinary document look (a word processor, a basic Markdown
    # editor): near-white or near-black page, navy and slate headings, a single muted blue accent, bold and italic
    # without color, and code colors in the VS Code Light+/Dark+ family toned down.
    "basic-light": simple("Basic Light", False, "ArkMD's own neutral palette, modelled on word-processor and plain editor defaults",
        bg="#ffffff", bgAlt="#f4f5f7", surface="#dfe2e6", selection="#cfe2f6", fg="#222222", comment="#5f6368",
        red="#a4262c", orange="#8a4b08", yellow="#7a5d00", green="#2e6b34", cyan="#2b6f77", blue="#2b579a",
        purple="#5c2d91", accent="#2b579a", link="#0563c1", bold="#222222", italic="#222222", tag="#2b6f77",
        code_fg="#3d3d3d", quote_border="#c3c8ce",
        headings=["#1f3864", "#2f5496", "#44546a", "#595959", "#595959", "#6b6b6b"],
        hl_over=dict(keyword="#0451a5", string="#a31515", number="#098658", function="#795e26", title="#795e26",
                     type="#267f99", attr="#0451a5", builtin="#267f99", literal="#0451a5", meta="#5c2d91",
                     operator="#222222", regexp="#811f3f", comment="#5f6368", punctuation="#5f6368")),
    "basic-dark": simple("Basic Dark", True, "ArkMD's own neutral palette, modelled on common dark editor defaults",
        bg="#1f1f1f", bgAlt="#272727", surface="#3a3a3a", selection="#2f4a6b", fg="#d4d4d4", comment="#9a9a9a",
        red="#d27b7b", orange="#c99a6b", yellow="#c4b27a", green="#8dba8d", cyan="#7fb5bd", blue="#6aa0d6",
        purple="#b49bd0", accent="#6aa0d6", link="#7db3e6", bold="#ececec", italic="#d4d4d4", tag="#7fb5bd",
        code_fg="#c8c8c8", quote_border="#555555",
        headings=["#e3ebf6", "#a9c6e6", "#92a9c4", "#b0b6bd", "#b0b6bd", "#979da5"],
        hl_over=dict(keyword="#7aa7d8", string="#c49a7c", number="#a6bf9a", function="#c9c19b", title="#c9c19b",
                     type="#8fbfb7", attr="#7aa7d8", builtin="#8fbfb7", literal="#7aa7d8", meta="#b49bd0",
                     operator="#d4d4d4", regexp="#b78d8d", comment="#9a9a9a", punctuation="#9a9a9a")),
    "nordic": simple("Nordic", True, "AlexvZyl/nordic.nvim palette", bg="#242933", bgAlt="#1e222a", surface="#2e3440",
        selection="#434c5e", fg="#d8dee9", comment="#60728a", red="#bf616a", orange="#d08770", yellow="#ebcb8b",
        green="#a3be8c", cyan="#8fbcbb", blue="#81a1c1", purple="#b48ead", accent="#88c0d0", link="#88c0d0",
        headings=["#88c0d0", "#81a1c1", "#8fbcbb", "#a3be8c", "#ebcb8b", "#b48ead"]),
    "vaporwave": simple("Vaporwave", True, "the classic vaporwave palette (not an official editor theme)", bg="#2b213a",
        bgAlt="#221a2f", surface="#3b2d52", selection="#4a3a68", fg="#f2e9ff", comment="#9585b8", red="#ff5c8a",
        orange="#ffa56b", yellow="#fffb96", green="#05ffa1", cyan="#01cdfe", blue="#01cdfe", purple="#b967ff",
        accent="#ff71ce", link="#01cdfe", headings=["#ff71ce", "#fffb96", "#05ffa1", "#01cdfe", "#b967ff", "#ffa56b"]),
}


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


SELECTION_SEEN = 1.5      # contrast the selection needs against the page and the code-block background, to be seen
SELECTION_SYNTAX = 3.0    # contrast code colours keep on the selection (text itself stays at AA)


def selection_aa(t, eff, hljs):
    """The selection colour: the theme's own when text stays readable on it and it can be seen; otherwise moved in OKLab
    lightness away from the background (lighter on dark themes, darker on light ones), keeping hue and chroma, until
    it can be seen or the text on it would drop below AA (body text) or SELECTION_SYNTAX (code colours)."""
    bg, alt, fg = t["bg"], t["bgAlt"], eff["fg"]
    codes = list(hljs.values())

    def readable(c):
        return contrast(fg, c) >= AA and all(contrast(k, c) >= SELECTION_SYNTAX for k in codes)

    def seen(c):
        return min(contrast(c, bg), contrast(c, alt))

    cur = t["selection"]
    if seen(cur) >= SELECTION_SEEN and readable(cur):
        return cur
    L, A, B = _to_oklab(cur)
    step = -0.004 if luminance(bg) > 0.18 else 0.004
    best = cur
    for _ in range(300):
        L = max(0.0, min(1.0, L + step))
        shrink = 1.0 if 0.02 < L < 0.98 else 0.5
        cand = _from_oklab(L, A * shrink, B * shrink)
        if not readable(cand):
            break
        best = cand
        if seen(best) >= SELECTION_SEEN:
            break
    return best


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
    sel = selection_aa(t, eff, {**t["hljs"], **hl})
    if sel != t["selection"]:
        aa["selection"] = sel
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

THEMES.update(EXTRA)
THEMES = {k: with_aa(v) for k, v in THEMES.items()}

if __name__ == "__main__":
    out = os.path.join(HERE, "..", "shared", "web", "themes.json")
    with open(out, "w") as f:
        json.dump(THEMES, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {len(THEMES)} themes")
    sheet = os.path.join(HERE, "theme_sheet.py")      # a maintainer's aid; not part of every checkout
    if os.path.exists(sheet):
        import runpy
        runpy.run_path(sheet, run_name="__main__")
