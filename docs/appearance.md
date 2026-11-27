# Themes and fonts

## Themes

The palette button in the top bar opens the theme list: dark themes first, then light ones, each group in alphabetical order. A new install starts with One Dark Pro. Themes are built from each project's published palette, so they match what you know from those projects:

- **Basic:** Basic Light and Basic Dark, plain low-saturation themes in the style of a word processor or a basic editor: a white or near-black page, navy and slate headings, a single muted blue accent, and bold and italic without color
- **Atom:** One Dark Pro, One Dark Pro Night Flat, One Light
- **Ayu:** Dark, Mirage, Light
- **Catppuccin:** Mocha, Macchiato, Frappé, Latte
- **Dracula:** Dracula, Alucard
- **Everforest:** Dark, Light
- **GitHub:** Dark, Dark Dimmed, Light
- **Gruvbox:** Dark, Light
- **Material:** Palenight, Ocean, Lighter
- **Monokai:** Monokai, Monokai Dimmed
- **Night Owl:** Night Owl, Night Owl Light
- **Nightfox:** Nightfox, Dayfox
- **Nord** and **Nordic**
- **Panda**, **SynthWave '84** and **Vaporwave**
- **Rosé Pine:** Rosé Pine, Moon, Dawn
- **Solarized:** Dark, Light
- **Tokyo Night:** Night, Storm, Moon, Light
- **VS Code:** Dark+, Light+

A theme sets the colors of the reader, the editor, code blocks, callouts and the app itself. Headings use a different color for each level, in an order that follows the theme's own conventions.

### Match the system light/dark setting

**Settings** > **Match system light/dark** switches between a dark and a light theme with the device's own setting. With it on, choose each theme from **Theme**: a dark theme you pick becomes the dark one, a light theme the light one. Until you choose, ArkMD uses Basic Dark and Basic Light (or your current theme, for whichever side it belongs to).

## Your own theme

Write a CSS file that sets colors, then add it: **Theme** > **Add a theme from a CSS file…**. The theme appears under **Custom** in the theme list and is selected right away. **Remove a custom theme…** in the same list deletes it. [`samples/custom-theme.css`](../samples/custom-theme.css) is a complete example with every variable.

```css
:root {
  --theme-name: "Paper";
  --bg: #fbf7ef;
  --fg: #2b2b2b;
  --accent: #b4540a;
}
```

- **Required:** `--bg` and `--fg`. Everything else is optional.
- **Defaults:** a color you leave out comes from a built-in theme of the same kind (Tokyo Night for dark, Tokyo Night Light for light, or the one named in `--theme-base`). `--bg-alt`, `--surface`, `--fg-muted` and `--selection` are derived from `--bg`, `--fg` and `--accent`.
- **Variables:** `--bg`, `--bg-alt`, `--surface`, `--fg`, `--fg-muted`, `--selection`, `--accent`, `--link`, `--quote-border`, `--checkbox`, `--tag`, `--h1` to `--h6`, `--bold`, `--italic`, `--code-fg`, `--red`, `--orange`, `--yellow`, `--green`, `--cyan`, `--purple`, and `--hl-keyword`, `--hl-string`, `--hl-number`, `--hl-comment`, `--hl-function`, `--hl-title`, `--hl-type`, `--hl-variable`, `--hl-attr`, `--hl-builtin`, `--hl-literal`, `--hl-meta`, `--hl-operator`, `--hl-punctuation`, `--hl-regexp`, `--hl-deletion`, `--hl-addition` for code.
- **Colors:** `#rgb`, `#rrggbb`, `rgb()`, `hsl()` (with or without alpha), `black` or `white`. Translucent colors are blended over `--bg`.
- **Options:** `--theme-name` (otherwise the file name), `--theme-base`, and `--theme-mode: dark` or `light` (otherwise decided from `--bg`).
- **Only colors are read.** Other rules, `@import`, `url()` and fonts in the file are ignored, so a theme can't load anything from the web or change the layout. ArkMD tells you how many settings it ignored. A file must be under 64 KB.
- **Contrast mode applies** to custom themes like built-in ones, so a low-contrast color is adjusted unless you switch it off.

ArkMD stores the file's text in its settings, so the theme keeps working if you move or delete the original file. To change a theme, add the edited file again and remove the old one.

## Contrast mode

Several official themes use colors that are hard to read, such as pale text on a light background. By default ArkMD makes every text color reach at least a 4.5:1 contrast ratio (WCAG 2.2 level AA). It changes only the lightness of a color, so its hue stays, and only when a color falls below that ratio. Selected text uses inverted colors in both the editor and the reader: the theme's text color is the fill and selected text takes the page color (at least 7.5:1 contrast in every built-in theme).

To see the official colors exactly, switch it off: **More** > **Settings** > **Contrast (WCAG AA)**. The setting applies to every theme.

## Fonts

**More** > **Settings** > **Reading font** and **Editing font** are separate, so you can read in a serif and edit in a monospace font. Each option in the list is shown in its own typeface; System comes first (and is the default), the rest are in alphabetical order.

| Font | Character |
|---|---|
| System | The platform default |
| Fira Sans | Humanist sans-serif, easy to read |
| Atkinson Hyperlegible | Designed for maximum legibility |
| Source Serif 4 | Classic serif for long reading |
| Lora | Warm, contemporary serif |
| iA Writer Quattro | The writing font from iA Writer |
| JetBrains Mono | Modern coding monospace |
| Meslo LG | Classic terminal monospace |

Code blocks in the reader always use JetBrains Mono. The fonts ship with the app, and their licenses are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Content width

**More** > **Settings** > **Content width** sets how wide the text column grows on a large window: Narrow (about 760 px), Medium (960), Wide (1200, the default), Wider (1500) or Full width. The column always shrinks to fit a smaller window or a phone. It applies to reading and editing.

## Text size

**More** > **Settings** > **Text size** offers sizes from 14 to 28. The default is 18 on Android and 16 on desktop. On Android the text also follows the font size set in the system settings. On desktop, Ctrl + and Ctrl − make the whole window larger or smaller.

Theme, fonts, text size and contrast are remembered on each device.
