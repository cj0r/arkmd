# Changelog

Versions follow [semantic versioning](https://semver.org).

## 0.15.0 (2026-11-22)

### Added
- **F-Droid repository** at https://cj0r.github.io/arkmd/fdroid/repo, rebuilt after each release from the signed APKs (0.14.1 and later), so F-Droid, Droid-ify or Neo Store can keep ArkMD up to date on Android. The repository page shows the signing fingerprint.
- Store metadata (descriptions, changelog, icon) in `fastlane/metadata/android/en-US/`.
- **Welcome tour.** A document built into the app, with a welcome and a warning at the top, every kind of formatting ArkMD draws and twelve Mermaid diagrams. It opens on a fresh install, and from More > Welcome tour or the home screen at any time. It has no file behind it: Save as keeps a copy, and closing it changes nothing.

## 0.14.1 (2026-11-22)

### Changed
- **Android:** the app no longer installs updates itself and no longer asks for the permission to install apps, which Google Play Protect blocked as harmful on every version since 0.6.0. Settings > Check for updates now still reports a newer version; its button opens the download in the browser and the dialog shows the file's SHA-256. Android's own installer then installs it. Windows and Linux updating is unchanged.
- The README describes keeping Android up to date with Obtainium, which can check this repository's releases and update the app in the background.

## 0.14.0 (2026-11-22)

### Added
- **Insert pictures** (Windows and Linux). The image button in the formatting panel (Ctrl+Shift+I), pasting a picture, or dropping image files copies them into an `images` folder next to the document and links them at the cursor as their own paragraph. Pasting from the clipboard needs a web view that passes pictures to the page, which Windows has and Linux does not.
- **Drop Markdown files** on the window to open them as tabs.

## 0.13.0 (2026-11-22)

### Added
- **Mermaid diagrams.** A fenced block tagged `mermaid` is drawn as a diagram (Mermaid 11: flowcharts, sequence, class, state, entity-relationship, Gantt, pie, mind map, timeline and more) in the theme's colors, and redrawn when the theme changes. A mistake in a diagram shows Mermaid's error above its source. Diagrams use Mermaid's strict security level, work offline, print and export with the page, and the library is only loaded when a document has a diagram. It adds about 1 MB to each download.

### Fixed
- Styles that scripts add to the reader (used by diagrams) were blocked by the app's content security policy.

## 0.12.0 (2026-11-22)

### Added
- **23 more themes**, 9 of them light: Ayu (Dark, Mirage, Light), Dayfox, Everforest (Dark, Light), Gruvbox (Dark, Light), Material (Palenight, Ocean, Lighter), Night Owl (Night Owl, Night Owl Light), Nightfox, Nordic, One Light, Panda, Solarized (Dark, Light), SynthWave '84, Vaporwave and VS Code (Dark+, Light+).
- **Content width** setting (Settings > Content width): Narrow, Medium, Wide, Wider or Full width. The default is Wide, up to 1200 px, instead of the earlier fixed 760 px column.
- **Troubleshooting log.** On Windows and Linux ArkMD writes errors and crashes to a log file (up to about 1 MB, home folder shown as ~, no document text). Settings > Troubleshooting has Copy diagnostic information, which also works on Android, and Open the log folder.

### Changed
- The theme and font lists are in alphabetical order (System stays first). New installs start with One Dark Pro; existing choices are kept.
- Catppuccin Latte uses a cooler heading order (mauve, blue, sapphire, teal, green, lavender) and plain bold text instead of the red and brown of the official per-level colors.
- Scroll bars follow the theme, and look the same in reading mode, the editor and dialogs.

## 0.11.0 (2026-11-22)

### Added
- **Find and replace.** Ctrl+F (or the magnifier in the top bar) finds text in reading and editing mode, with match case, whole word and regular expression options and a match count. Ctrl+H adds a replace row in the editor; Replace all is a single undo step. Regular expression replacements accept `$1` to `$9` and `$&`.
- **Links and images next to a document (Windows and Linux).** Relative images such as `![](images/pic.png)` are shown; relative links to Markdown files and `[[wikilinks]]` open that file in a tab, and `[text](#heading)` and `[[Note#Heading]]` jump to the heading.
- **Autosave** in Settings, off by default.
- **Changes on disk.** ArkMD reloads an unmodified file that another program changed, warns when a file with unsaved changes did, and asks before Save replaces a file that changed.
- **Print and Export as HTML** in the More menu (Windows and Linux).
- **Word and character counts and reading time** at the bottom of the outline.
- **Tab in tables** moves between cells and adds a row from the last cell.
- **Reorder tabs** by dragging, or with Ctrl+Shift+PageUp and Ctrl+Shift+PageDown.

### Fixed
- Formatting shortcuts and Enter on empty list items used the wrong positions in files with Windows line endings (CRLF), and inserted line breaks without the carriage return.
- Task list checkboxes in the reader can be ticked and unticked. The change is made in the file's text (undoable, saved with Save), including nested, numbered and quoted items; items inside code blocks are untouched.
- A ticked task no longer strikes through the items nested under it.
- Choosing a theme from the palette button no longer shows an "r is not a function" error.
- Ctrl + and Ctrl − (window zoom) work on desktop; they were refused by the app's permissions.

## 0.10.0 (2026-11-21)

### Added
- **Outline.** A flyout (the list button in the top bar, or Ctrl+Shift+O) lists the document's headings, indented by level, and jumps to the one you choose, in both reading and editing mode. The current section is marked.

## 0.9.0 (2026-11-21)

### Added
- **File history.** The text a save replaces is kept as an earlier version, in ArkMD's own storage on the device. More > File history… previews a version and loads it into the editor (undoable) or opens it as a new tab. Versions from the last day are kept, older ones thinned to one a day, up to 30 per file and about 50 MB in total.
- **Recovery of unsaved work.** A draft of unsaved changes is saved every few seconds; after a crash ArkMD offers to restore it.
- **Undo and Redo buttons** in the top bar while editing, and **Ctrl+Shift+T** to reopen the last closed tab with its text and undo history.
- Settings > History and recovery turns file history and recovery off and clears them.

## 0.8.0 (2026-11-21)

### Added
- **Formatting shortcuts** while editing: Ctrl+1 to 6 for headings (again to clear) and Ctrl+0 for normal text; Ctrl+Shift+8, 7 and 9 for bulleted, numbered and task lists; Ctrl+Shift+Q for a quote, Ctrl+Shift+K for a code block, Ctrl+Shift+X for strikethrough, Ctrl+Shift+H for highlight and Ctrl+` for inline code. The format panel's tooltips show them.
- **Tab on a heading line** makes it one level deeper and Shift+Tab one level shallower. On a list item, Tab and Shift+Tab nest and un-nest it by the width of its marker, so numbered lists nest correctly.
- **Keyboard shortcuts list** (F1, or Settings > Keyboard shortcuts).

### Changed
- Pressing a style shortcut such as Ctrl+B again with nothing selected steps out past the closing marks instead of adding another pair.
- Enter on an empty task item ends the list, as it does for an empty bullet.

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
