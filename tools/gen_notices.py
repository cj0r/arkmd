#!/usr/bin/env python3
"""Write THIRD_PARTY_NOTICES.md (and the copy the app ships in shared/web/).

    python3 tools/gen_notices.py

Lists what ArkMD bundles or derives from, with licenses: web libraries, fonts, icons, theme palettes, and the npm
and Rust dependencies in the release builds. Dependency lists come from `npm ls` and `cargo tree` (run `npm ci`
in app/ first; cargo needs network access the first time it resolves every platform's crates).
"""
import json
import os
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "app"
FONTS = ROOT / "shared" / "web" / "fonts"
APACHE_TEXT = pathlib.Path("/usr/share/licenses/spdx/Apache-2.0.txt")

WEB_LIBS = [
    ("markdown-it", "14.1.0", "MIT", "https://github.com/markdown-it/markdown-it"),
    ("markdown-it-task-lists", "2.1.1", "ISC", "https://github.com/revin/markdown-it-task-lists"),
    ("markdown-it-footnote", "4.0.0", "MIT", "https://github.com/markdown-it/markdown-it-footnote"),
    ("highlight.js", "11.10.0", "BSD-3-Clause", "https://github.com/highlightjs/highlight.js"),
]

FONT_INFO = [  # dir, name, license, source, note
    ("firasans", "Fira Sans", "OFL-1.1", "https://github.com/mozilla/Fira", "subset to Latin"),
    ("atkinsonhyperlegible", "Atkinson Hyperlegible", "OFL-1.1", "https://github.com/googlefonts/atkinson-hyperlegible", "subset to Latin"),
    ("sourceserif4", "Source Serif 4", "OFL-1.1", "https://github.com/adobe-fonts/source-serif", "subset to Latin"),
    ("lora", "Lora", "OFL-1.1", "https://github.com/cyrealtype/Lora-Cyrillic", "unmodified (Reserved Font Name)"),
    ("quattro", "iA Writer Quattro", "OFL-1.1", "https://github.com/iaolo/iA-Fonts", "unmodified (Reserved Font Name)"),
    ("jetbrainsmono", "JetBrains Mono", "OFL-1.1", "https://github.com/JetBrains/JetBrainsMono", "subset to Latin"),
    ("meslo", "Meslo LG", "Apache-2.0", "https://github.com/andreberg/Meslo-Font", "subset to Latin"),
]

PALETTES = [
    ("Tokyo Night", "folke/tokyonight.nvim (Apache-2.0); enkia/tokyo-night-vscode-theme (MIT)"),
    ("Catppuccin", "catppuccin/palette and catppuccin/vscode (MIT)"),
    ("Dracula", "Dracula theme specification, dracula/visual-studio-code (MIT)"),
    ("GitHub", "primer/primitives and primer/github-vscode-theme (MIT)"),
    ("Monokai", "microsoft/vscode built-in Monokai themes (MIT)"),
    ("Rosé Pine", "rose-pine/vscode, rose-pine/neovim and mvllow/rose-pine (MIT)"),
    ("One Dark Pro", "Binaryify/OneDark-Pro (MIT)"),
    ("Nord", "nordtheme/nord and nordtheme/visual-studio-code (MIT)"),
]

MIT = """Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."""

ISC = """Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE."""

BSD3 = """Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE."""


def font_copyright(directory):
    """The copyright line from the license file that ships with the font."""
    for name in ("OFL.txt", "LICENSE.md", "LICENSE.txt"):
        path = FONTS / directory / name
        if path.exists():
            for line in path.read_text(errors="replace").splitlines():
                if re.search(r"copyright", line, re.I) and re.search(r"\d{4}", line):
                    return line.strip().lstrip("#").strip()
    return ""


def npm_packages():
    out = subprocess.run(["npm", "ls", "--omit=dev", "--all", "--json"], cwd=APP, capture_output=True, text=True).stdout
    seen = {}

    def walk(node):
        for name, info in (node.get("dependencies") or {}).items():
            seen[name] = info.get("version", "")
            walk(info)

    walk(json.loads(out))
    rows = []
    for name, version in sorted(seen.items()):
        pkg = json.loads((APP / "node_modules" / name / "package.json").read_text())
        lic = pkg.get("license") or "see package"
        repo = pkg.get("repository")
        url = repo.get("url") if isinstance(repo, dict) else repo
        url = re.sub(r"^(git\+)?", "", url or "").removesuffix(".git").replace("git://", "https://").replace("ssh://git@", "https://")
        rows.append((name, version, lic, url or ""))
    return rows


def rust_crates():
    env = dict(os.environ)
    out = subprocess.run(["cargo", "tree", "--locked", "--edges", "normal", "--target", "all", "--prefix", "none",
                          "--format", "{p}|{l}|{r}"], cwd=APP / "src-tauri", capture_output=True, text=True, env=env).stdout
    rows = {}
    for line in out.splitlines():
        if line.count("|") != 2:
            continue
        pkg, lic, repo = (x.strip() for x in line.split("|"))
        name, _, version = pkg.partition(" v")
        if name == "arkmd":
            continue
        rows[(name, version.split(" ")[0])] = (lic or "see crate", repo)
    return [(n, v, *rows[(n, v)]) for n, v in sorted(rows)]


def main():
    version = json.loads((APP / "src-tauri" / "tauri.conf.json").read_text())["version"]
    L = []
    w = L.append
    w("# Third-party notices\n")
    w(f"ArkMD {version} is released under the GNU General Public License v3.0 (see `LICENSE`). It includes and builds on the "
      "components below, each under its own license. Generated by `tools/gen_notices.py`.\n")

    w("## Web libraries in the reader\n")
    w("| Component | Version | License | Source |\n|---|---|---|---|")
    for n, v, lic, url in WEB_LIBS:
        w(f"| {n} | {v} | {lic} | {url} |")

    w("\n## Fonts\n")
    w("Bundled under their own licenses; each license file ships with the font in `shared/web/fonts/<font>/`. "
      "The SIL Open Font License 1.1 is available at https://openfontlicense.org.\n")
    w("| Font | License | Copyright | Form | Source |\n|---|---|---|---|---|")
    for d, name, lic, url, note in FONT_INFO:
        w(f"| {name} | {lic} | {font_copyright(d)} | {note} | {url} |")

    w("\n## Icons\n")
    w("The toolbar, formatting and window-control icons are from Material Design Icons (Apache-2.0), "
      "https://github.com/google/material-design-icons.\n")

    w("## Theme palettes\n")
    w("Colors are taken from the official palettes and editor themes below; no theme code is copied.\n")
    w("| Theme family | Sources (license) |\n|---|---|")
    for name, src in PALETTES:
        w(f"| {name} | {src} |")

    npm = npm_packages()
    w(f"\n## npm packages ({len(npm)})\n")
    w("Bundled into the app's front end by the build.\n")
    w("| Package | Version | License | Source |\n|---|---|---|---|")
    for n, v, lic, url in npm:
        w(f"| {n} | {v} | {lic} | {url} |")

    crates = rust_crates()
    w(f"\n## Rust crates ({len(crates)})\n")
    w("Linked into the desktop and Android builds, across all platforms. Where a crate offers a choice of licenses "
      "(for example `MIT OR Apache-2.0`), ArkMD uses it under the terms that fit the GNU GPL v3.0. "
      "Crates under MPL-2.0 are used unmodified; their source is available from the repositories listed.\n")
    w("| Crate | Version | License | Source |\n|---|---|---|---|")
    for n, v, lic, url in crates:
        w(f"| {n} | {v} | {lic} | {url} |")

    w("\n## License texts\n")
    w("The copyright holders of each component are named in its source repository and in the notices that ship with it. "
      "Texts for the licenses above that are not linked:\n")
    for title, text in (("MIT License", MIT), ("ISC License", ISC), ("BSD 3-Clause License", BSD3)):
        w(f"### {title}\n\n```text\n{text}\n```\n")
    if APACHE_TEXT.exists():
        w(f"### Apache License 2.0\n\n```text\n{APACHE_TEXT.read_text().strip()}\n```\n")
    w("MPL-2.0: https://www.mozilla.org/MPL/2.0/ · Unicode-3.0: https://www.unicode.org/license.txt · "
      "Zlib: https://zlib.net/zlib_license.html · Unlicense: https://unlicense.org · 0BSD: https://opensource.org/license/0bsd\n")

    text = "\n".join(L)
    (ROOT / "THIRD_PARTY_NOTICES.md").write_text(text)
    (ROOT / "shared" / "web" / "third-party-notices.md").write_text(text)
    print(f"wrote THIRD_PARTY_NOTICES.md: {len(text) // 1024} KB, {len(npm)} npm packages, {len(crates)} crates")


if __name__ == "__main__":
    main()
