# Themes and fonts

## Themes

The palette button in the top bar opens the theme list, dark themes first, then light ones. Each theme is generated from the official palette or editor theme it is named after, so it matches what you know from those projects:

- **Tokyo Night:** Night, Storm, Moon, Light
- **Catppuccin:** Mocha, Macchiato, Frappé, Latte
- **Dracula:** Dracula, Alucard
- **GitHub:** Dark, Dark Dimmed, Light
- **Monokai:** Monokai, Monokai Dimmed
- **Rosé Pine:** Rosé Pine, Moon, Dawn
- **One Dark Pro:** One Dark Pro, Night Flat
- **Nord**

A theme sets the colors of the reader, the editor, code blocks, callouts and the app itself. Headings use a different color for each level, in an order that follows the theme's own conventions. `design/theme-sheet.html` in the repository lists every color of every theme with its source and contrast ratio.

## Contrast mode

Several official themes use colors that are hard to read, such as pale text on a light background. By default ArkMD makes every text color reach at least a 4.5:1 contrast ratio (WCAG 2.2 level AA). It changes only the lightness of a color, so its hue stays, and only when a color falls below that ratio.

To see the official colors exactly, switch it off: **More** > **Contrast (WCAG AA)**. The setting applies to every theme.

## Fonts

**More** > **Reading font** and **More** > **Editing font** are separate, so you can read in a serif and edit in a monospace font. Each option in the list is shown in its own typeface.

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

## Text size

**More** > **Text size** offers sizes from 14 to 28. The default is 18 on Android and 16 on desktop. On Android the text also follows the font size set in the system settings. On desktop, Ctrl + and Ctrl − make the whole window larger or smaller.

Theme, fonts, text size and contrast are remembered on each device.
