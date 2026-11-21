#!/usr/bin/env python3
"""Build app/src/main/assets/fonts/ from the official font sources.

    python3 tools/build_fonts.py <download-dir>

Inter is not included: it is the closest to the system font (Roboto), which costs nothing.
Subset fonts are cut to Latin + common symbols, basic OpenType features, with hinting removed (not needed on high-DPI
screens). Fonts with a Reserved Font Name (iA Writer Quattro, Lora) are copied unmodified, as
the OFL requires. Monospace fonts ship regular + bold only; italics are synthesised.
Needs fontTools (pip install fonttools).
"""
import os
import shutil
import sys
import urllib.request
import zipfile

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

GF = "https://raw.githubusercontent.com/google/fonts/main/ofl"
IA = "https://raw.githubusercontent.com/iaolo/iA-Fonts/master/iA%20Writer%20Quattro"
MESLO = "https://raw.githubusercontent.com/andreberg/Meslo-Font/master/dist/v1.2.1/Meslo%20LG%20v1.2.1.zip"
MESLO_LICENSE = """Meslo LG v1.2.1, Copyright 2009, 2010, 2013 André Berg.
Licensed under the Apache License, Version 2.0: http://www.apache.org/licenses/LICENSE-2.0
Based on Menlo (Copyright 2009 Apple Inc.) and Bitstream Vera Sans Mono
(Copyright 2003 Bitstream, Inc.; Bitstream Vera is a trademark of Bitstream, Inc.).
Subset to Latin for ArkMD.
"""
UNICODES = ("U+0000-024F,U+0259,U+02B0-02FF,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20A0-20CF,U+2100-214F,"
            "U+2190-21FF,U+2200-22FF,U+2300-23FF,U+2500-259F,U+25A0-25FF,U+2600-26FF,U+2713-2718,U+FB00-FB06,U+FFFD")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "shared", "web", "fonts")


def fetch(url, path):
    if not os.path.exists(path):
        with urllib.request.urlopen(url) as r, open(path, "wb") as f:
            f.write(r.read())
    return path


def subset_save(font, path):
    o = subset.Options()
    # fontTools' default feature list: kerning, ligatures, contextual alternates, marks, locl, etc.
    # Drops stylistic sets and alternates ArkMD never enables (large in Inter-class fonts).
    o.name_IDs = ["*"]
    o.notdef_outline = True
    o.hinting = False
    s = subset.Subsetter(o)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(font)
    font.save(path)


def variable(dl, fam, upright, italic, extra, styles):
    """Instance a Google Fonts variable family to static regular/bold(/italic/bolditalic), then subset."""
    files = {"regular": (upright, 400), "bold": (upright, 700), "italic": (italic, 400), "bolditalic": (italic, 700)}
    for label in styles:
        name, w = files[label]
        src = fetch(f"{GF}/{fam}/{name.replace('[', '%5B').replace(']', '%5D')}", os.path.join(dl, name))
        f = TTFont(src)
        axes = {a.axisTag for a in f["fvar"].axes}
        loc = {"wght": w, **{k: v for k, v in extra.items() if k in axes}}
        subset_save(instantiateVariableFont(f, loc, updateFontNames=False), f"{OUT}/{fam}/{label}.ttf")


def statics(dl, fam, pattern, styles):
    for label, style in styles.items():
        src = fetch(f"{GF}/{fam}/{pattern.format(style)}", os.path.join(dl, pattern.format(style)))
        subset_save(TTFont(src), f"{OUT}/{fam}/{label}.ttf")


def main(dl):
    os.makedirs(dl, exist_ok=True)
    shutil.rmtree(OUT, ignore_errors=True)
    four = ["regular", "bold", "italic", "bolditalic"]
    for fam in ["firasans", "atkinsonhyperlegible", "sourceserif4", "jetbrainsmono", "lora"]:
        os.makedirs(f"{OUT}/{fam}", exist_ok=True)
        shutil.copy(fetch(f"{GF}/{fam}/OFL.txt", os.path.join(dl, f"{fam}-OFL.txt")), f"{OUT}/{fam}/OFL.txt")

    variable(dl, "sourceserif4", "SourceSerif4[opsz,wght].ttf", "SourceSerif4-Italic[opsz,wght].ttf", {"opsz": 16}, four)
    variable(dl, "jetbrainsmono", "JetBrainsMono[wght].ttf", "JetBrainsMono-Italic[wght].ttf", {}, ["regular", "bold"])
    statics(dl, "firasans", "FiraSans-{}.ttf",
            {"regular": "Regular", "bold": "Bold", "italic": "Italic", "bolditalic": "BoldItalic"})
    statics(dl, "atkinsonhyperlegible", "AtkinsonHyperlegible-{}.ttf",
            {"regular": "Regular", "bold": "Bold", "italic": "Italic", "bolditalic": "BoldItalic"})

    # Reserved Font Name "Lora": ship the variable fonts unmodified (one file per style, wght 400-700).
    for name, label in [("Lora[wght].ttf", "regular"), ("Lora-Italic[wght].ttf", "italic")]:
        shutil.copy(fetch(f"{GF}/lora/{name.replace('[', '%5B').replace(']', '%5D')}", os.path.join(dl, name)),
                    f"{OUT}/lora/{label}.ttf")

    # Reserved Font Name "iA Writer": ship unmodified.
    os.makedirs(f"{OUT}/quattro", exist_ok=True)
    for style, label in [("Regular", "regular"), ("Bold", "bold"), ("Italic", "italic"), ("BoldItalic", "bolditalic")]:
        shutil.copy(fetch(f"{IA}/Static/iAWriterQuattroS-{style}.ttf", os.path.join(dl, f"quattro-{style}.ttf")),
                    f"{OUT}/quattro/{label}.ttf")
    shutil.copy(fetch(f"{IA}/LICENSE.md", os.path.join(dl, "quattro-LICENSE.md")), f"{OUT}/quattro/LICENSE.md")

    # Meslo LG M (Apache 2.0), regular + bold.
    os.makedirs(f"{OUT}/meslo", exist_ok=True)
    with zipfile.ZipFile(fetch(MESLO, os.path.join(dl, "meslo.zip"))) as z:
        for style, label in [("Regular", "regular"), ("Bold", "bold")]:
            with z.open(f"Meslo LG v1.2.1/MesloLGM-{style}.ttf") as src, open(os.path.join(dl, f"meslo-{style}.ttf"), "wb") as dst:
                dst.write(src.read())
            subset_save(TTFont(os.path.join(dl, f"meslo-{style}.ttf")), f"{OUT}/meslo/{label}.ttf")
    with open(f"{OUT}/meslo/LICENSE.txt", "w") as f:
        f.write(MESLO_LICENSE)

    total = sum(os.path.getsize(os.path.join(d, n)) for d, _, fs in os.walk(OUT) for n in fs if n.endswith(".ttf"))
    print(f"fonts: {total / 1024:.0f} KB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/arkmd-fonts")
