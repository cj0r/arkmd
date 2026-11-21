# Changelog

Versions follow [semantic versioning](https://semver.org).

## 0.5.0 (2026-11-21)

First public release.

### Added
- **Reader** with Obsidian-style rendering: callouts (including foldable ones), `==highlights==`, `[[wikilinks]]`, `#tags`, task lists, tables, footnotes, front matter and syntax-highlighted code blocks.
- **Editor** (CodeMirror 6) with live Markdown highlighting, syntax highlighting inside fenced code blocks, and one-step switching between reading and editing that keeps the scroll position.
- **Tabs.** Several files can be open at once, each keeping its own text, undo history, cursor, scroll position and mode. Tabs close with their ✕, middle-click, Ctrl+W or the Android back button; Ctrl+Tab and Ctrl+PageUp/Down switch. A "+" menu offers New, Open and recent files. Closing a tab or the window with unsaved changes asks first.
- **Formatting panel** for the editor: headings, bold, italic, strikethrough, highlight, inline code, links, lists, tasks, quotes, callouts, code blocks, tables and dividers. Applying a format again removes it.
- **21 themes** in eight families (Tokyo Night, Catppuccin, Dracula, GitHub, Monokai, Rosé Pine, One Dark Pro, Nord), generated from the official palettes, with dark and light variants.
- **Fonts:** separate reading and editing fonts from the system font and eight bundled open-source fonts (Fira Sans, Atkinson Hyperlegible, Source Serif 4, Lora, iA Writer Quattro, JetBrains Mono, Meslo LG), plus text sizes from 14 to 28.
- **WCAG 2.2 AA contrast mode,** on by default: text colors below 4.5:1 are adjusted in lightness only, with an option to use the official theme colors.
- **Android:** opens files through Open with and Share, saves back to the original file, follows the system font size and uses the system file picker without a storage permission.
- **Linux and Windows:** `.md`, `.markdown`, `.mdown` and `.mkd` file associations; installers for Windows (NSIS, MSI) and packages for Linux (deb, rpm, AppImage). A second launch adds its file as a tab in the running window. On Linux the window has its own minimize, maximize and close buttons.
- **About** dialog with the version and the third-party notices.
