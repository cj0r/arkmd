# Changelog

Versions follow [semantic versioning](https://semver.org).

## 0.7.0 (2026-11-21)

### Added
- **Custom themes.** Theme > Add a theme from a CSS file… imports a file of color variables as a theme (the example is `samples/custom-theme.css`). Custom themes appear under Custom, work with the contrast mode, and can be removed. Only colors are read from the file.
- **Settings dialog** (More > Settings, Ctrl+,) with the theme, text size, reading and editing fonts, contrast mode, update options and About, replacing the separate entries in the More menu.

## 0.6.1 (2026-11-21)

### Changed
- Tabs are flat with square corners and dividers; the active tab has an accent line along its bottom edge.

## 0.6.0 (2026-11-21)

### Added
- **In-app updates.** More > Check for updates installs the latest release. Windows and Linux (AppImage, .deb, .rpm) updates are signed and verified against a public key built into the app; .deb and .rpm installs ask for administrator rights. On Android the APK is checked against the release's SHA-256 and must carry the installed app's signing certificate before the system installer opens. A badge on the More button marks an available update.
- **Check automatically** setting in the More menu: a once-a-day check, off by default.
- Releases include `latest.json` and `android.json` for the updater, and an update signature for each Windows and Linux package.

## 0.5.1 (2026-11-21)

First public release.

### Added
- **Reader** with Obsidian-style rendering: callouts (including foldable ones), `==highlights==`, `[[wikilinks]]`, `#tags`, task lists, tables, footnotes, front matter and syntax-highlighted code blocks.
- **Editor** (CodeMirror 6) with live Markdown highlighting, syntax highlighting inside fenced code blocks, and one-step switching between reading and editing that keeps the scroll position. A file's line endings (LF or CRLF) are kept when it is saved.
- **Tabs.** Several files can be open at once, each keeping its own text, undo history, cursor, scroll position and mode. Tabs close with their ✕, middle-click, Ctrl+W or the Android back button; Ctrl+Tab and Ctrl+PageUp/Down switch. A "+" menu offers New, Open and recent files. Closing a tab or the window with unsaved changes asks first.
- **Formatting panel** for the editor: headings, bold, italic, strikethrough, highlight, inline code, links, lists, tasks, quotes, callouts, code blocks, tables and dividers. Applying a format again removes it.
- **21 themes** in eight families (Tokyo Night, Catppuccin, Dracula, GitHub, Monokai, Rosé Pine, One Dark Pro, Nord), generated from the official palettes, with dark and light variants.
- **Fonts:** separate reading and editing fonts from the system font and eight bundled open-source fonts (Fira Sans, Atkinson Hyperlegible, Source Serif 4, Lora, iA Writer Quattro, JetBrains Mono, Meslo LG), plus text sizes from 14 to 28.
- **WCAG 2.2 AA contrast mode,** on by default: text colors below 4.5:1 are adjusted in lightness only, with an option to use the official theme colors.
- **Android:** opens files through Open with and Share, saves back to the original file, follows the system font size and uses the system file picker without a storage permission.
- **Linux and Windows:** `.md`, `.markdown`, `.mdown` and `.mkd` file associations; installers for Windows (NSIS, MSI) and packages for Linux (deb, rpm, AppImage). A second launch adds its file as a tab in the running window. On Linux the window has its own minimize, maximize and close buttons.
- **About** dialog with the version and the third-party notices.
- **User guide** in `docs/`, and a disclaimer, security policy and contributing guide.
