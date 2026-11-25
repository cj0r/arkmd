# Changelog

Versions follow [semantic versioning](https://semver.org).

## 0.31.1 (2026-11-24)

### Added
- **Closing tags in code blocks.** Typing `<div>` inside a fenced code block that names a language, such as html, adds `</div>`, and typing `</` completes the closing tag. Ordinary text, inline code and fences without a language are not affected. Settings > Close tags in code turns it off.

### Fixed
- Selected text in a code block in the editor now shows a highlight. The code block's background covered it.

## 0.31.0 (2026-11-24)

### Added
- **Closing brackets in code blocks.** Typing ( [ { or a quote inside a fenced code block that names a language adds the closing one. Typing the closing character steps over it and Backspace removes an empty pair. Ordinary text, inline code and fences without a language are not affected. Settings > Close brackets in code turns it off.

## 0.30.4 (2026-11-24)

### Fixed
- Android, on its side with the keyboard open: the layout switched back and forth between its normal and compact forms, which showed the error "ResizeObserver loop completed with undelivered notifications". The compact form is now chosen from the height of the page, which the compact form does not change. That browser notice is no longer shown as an error.
- With the status bar on, the outline panel no longer repeats the word and character counts under the bar; the status bar now also shows the reading time.

## 0.30.3 (2026-11-24)

### Fixed
- Android, on its side with the keyboard open: the keyboard is not subtracted from the window height, so the 0.30.2 rule for short windows never applied. The layout now measures the room left for the document. When little is left, the Read/Edit button is smaller and stays inside the editor instead of covering the top bar's buttons, and the status bar and the formatting bar are hidden until the keyboard closes.

## 0.30.2 (2026-11-24)

### Fixed
- In a short window, such as a phone on its side, the menu is kept on the screen and scrolls when it is taller than the window. It could open above the top edge and leave only its last entry visible.
- In a very short window, such as a phone on its side with the keyboard open, the Read/Edit button is smaller and stays inside the editor instead of covering the top bar's buttons, and the status bar is hidden so it no longer covers lines of the document.

## 0.30.1 (2026-11-24)

### Fixed
- The status bar is no longer a live region, so a screen reader does not announce it each time the cursor moves or the text changes. It stays reachable as the "Document information" landmark.

## 0.30.0 (2026-11-24)

### Added
- **Status bar.** Settings > Status bar shows the line and column of the cursor (in the editor), word and character counts and the document size along the bottom of the window. With text selected, the counts are for the selection. Off by default.
- **Line numbers.** Settings > Line numbers shows the number of each line in the editor. Off by default.

### Changed
- Settings is grouped into Appearance, Editing and saving, Files, Privacy and history, Updates, Keyboard and About. Remote images moved to Privacy and history, Remember recent files to Files, and Autosave to Editing and saving.

## 0.29.0 (2026-11-24)

### Added
- **Allow multiple windows (Windows and Linux).** Settings > Allow multiple windows lets each launch open its own window. It is off by default: a second launch adds its file as a tab in the running window. The change applies the next time ArkMD starts.

## 0.28.0 (2026-11-24)

### Changed
- **Nested numbered lists.** Tab nests a list item one level and Shift+Tab moves it one level out, by the width of the marker of the item above it (a bullet under a numbered item nests correctly too). A nested numbered list starts at 1 and an item moved out continues the outer list; the numbers after it are corrected. Nested numbered lists show 1. 2. 3., then a. b. c., then i. ii. iii., and the pattern repeats, in the editor and in the reader. The file keeps ordinary numbers; editor labels are not drawn in documents over 300 KB.
- The editor's right-click menu starts with a Document section (Save when there are changes, Find and replace, Outline, Switch to reading, Undo, Redo, Cut, Copy, Paste, Select all), followed by Format, Paragraph and Insert.

## 0.27.1 (2026-11-24)

### Changed
- The editor's right-click menu has every command of the formatting panel, including Image, and adds Save (when there are changes), Find and replace, Outline and Switch to reading. A menu taller than the window scrolls.

## 0.27.0 (2026-11-24)

### Added
- **Right-click menus (Windows and Linux).** The editor menu has Undo, Redo, Cut, Copy, Paste, Select all and the formatting commands; the reader menu has Copy, Select all, Edit this document, Find, Outline, Print and Export as HTML; a tab menu has Close, Close other tabs, Close tabs to the right, Save as, Pin, Copy file path, Show in file manager and Rename; the title bar and home screen show the application commands. They replace the web engine's own menu (Reload, Inspect). Text fields keep the system menu.

## 0.26.0 (2026-11-24)

### Added
- **Callouts change type in place.** With the cursor inside a callout, choosing a type from the formatting panel changes that callout's type instead of inserting a new one. The title changes with it when it is still the old type's default title; a custom title is kept.
- **Numbered lists renumber.** Inserting or deleting a numbered item corrects the numbers of the list (1, 2, 3 …), and Undo restores them. Lists that use the same number on every line and numbers edited in place are left as they are.
- **Folder for new files (Windows and Linux).** Settings > Folder for new files sets the folder where the Save dialog starts for a file that has not been saved yet.

## 0.25.5 (2026-11-24)

### Fixed
- **Redo works with Ctrl+Shift+Z on Windows.** Windows only had Ctrl+Y. Both keys now redo on every platform, and Settings > Keyboard shortcuts lists both.
- **The browser's page keys no longer act on the document.** Ctrl+R and F5 (reload), Ctrl+U, Ctrl+L, Ctrl+G and Alt+Left/Right (back, forward) are disabled; reloading dropped the open view of the document.

### Changed
- The window title shows the version, for example "notes.md — ArkMD 0.25.5".

## 0.25.4 (2026-11-23)

### Changed
- Settings and other dialogs: more space below the title and section headings, and between an option and its description.

## 0.25.3 (2026-11-23)

### Fixed
- **Desktop: the window no longer runs off the bottom of the screen.** The window opened at a fixed 920 x 1000, which is taller than the usable area of a 1080p screen with a taskbar and of most laptops, so the bottom (formatting bar, messages) was cut off. It is now sized to fit the screen it opens on (up to 920 x 1000) and placed before it is shown. The Windows check in release builds verifies that the window fits the screen.

## 0.25.2 (2026-11-23)

### Changed
- **Very large files open faster.** A file over about 8 MB opens in the editor, which takes about a second, instead of the reading view, which took 20 to 40 seconds to draw at 20 MB. In documents over 1 MB the reading view skips drawing the parts that are off screen until they are scrolled to: a 5 MB document now opens in about 5 seconds instead of 13, and a 2 MB table-heavy one in 2 seconds instead of 7.
- The test run opens a 9 MB file and a document with scripts, raw HTML, `javascript:` and `data:` links, and checks that nothing runs and the large file opens in the editor.
- `THIRD_PARTY_NOTICES.md` is regenerated: it listed an older version of one dependency.

## 0.25.1 (2026-11-23)

### Fixed
- **Android: renaming a file in Downloads left the tab unable to save.** Some storage apps give a renamed file an address ArkMD has no access to, so the tab showed the provider's internal id as its name and Save failed. ArkMD now checks access after a rename. If it is lost, the tab keeps the new name, is marked unsaved, and Save as writes a copy; the file on the device is already renamed and unchanged.

### Changed
- **Release builds check the Windows installer.** Before a release is published, the Windows installer is installed on a Windows runner, a file is opened from the command line, a second launch must add its file to the same window, and the uninstaller must remove the program. The Rust tests also run on Windows.

## 0.25.0 (2026-11-23)

### Added
- **Rename file** (More menu). The file is renamed in its own folder; an existing file is never replaced, and names that are invalid on Windows are refused on every platform. The tab, the Recent files entry with its pin, and the file history follow the file. On Android it uses the document provider's rename, where the provider supports it.
- **Android: Share and Print or save as PDF** in the More menu. Share sends the document's text to another app; Print or save as PDF uses the system print dialog with the exported page.
- **macOS build (experimental, untested).** Each release attaches `ArkMD-<version>-macos-universal-experimental.dmg`, an Intel and Apple Silicon app that is ad-hoc signed, not notarized, and has not been run on a Mac. It has no in-app updater, and shortcuts are shown with Cmd.
- **UI smoke and accessibility test in CI.** The built app is loaded in headless Chrome under its own content security policy with a stand-in for the desktop backend. The test opens, edits, saves, renames, opens menus, dialogs and flyouts, checks the contrast of every built-in theme, and runs axe-core accessibility rules on the main screens at desktop and phone width. It runs on every push and before every release.

### Changed
- **A link to a Markdown file outside the document's folder asks first.** A relative link or wikilink that leaves the folder tree (`../`) shows the file's path and opens it only after confirmation. Files inside the folder tree open as before.
- **The content security policy no longer allows inline scripts.** The reader's script moved from `viewer.html` to its own file, and the policy now also sets `object-src 'none'` and `base-uri 'self'`.

### Fixed
- **Tab stays inside an open dialog.** Tab and Shift+Tab used to move focus to the page behind a dialog; they now go round the dialog's controls.

## 0.24.2 (2026-11-23)

### Fixed
- **Going back to Settings with Esc now returns to the row you came from.** The 0.24.1 change that does this was applied to the File history dialog instead of Settings, so Settings still focused its first row (Theme), and About did not scroll back to its own row. Settings now scrolls to and focuses Keyboard shortcuts or About after Esc, and File history is as it was.

## 0.24.1 (2026-11-23)

### Fixed
- **Stray lines around the first Settings row after pressing Esc.** Going back with Esc left the keyboard focus ring on the first row, drawn outside the row where the dialog clipped it into two lines. Going back now puts focus on the row you came from, and the focus ring in dialogs is drawn inside the row.

## 0.24.0 (2026-11-23)

### Changed
- **Esc and Back go back one page in a dialog.** From Keyboard shortcuts, About, a theme, font or other picker opened from Settings, or a version's text opened from File history, Esc (and Back on Android) returns to the page you came from, and only a dialog's first page closes. About and Support gain a Back button when they were opened from another page. Close, Done and a tap outside still close everything. Questions still treat Esc as No.

## 0.23.3 (2026-11-23)

### Fixed
- **An update found by a check is remembered.** The banner, the dot on More and the Update buttons used to disappear when the app was closed, and did not return until Check for updates was used again. They now come back at once on the next start, until the app is that version. With automatic checks on, the check also runs when the app is brought back to the front after a day, not only at start.
- In the update card the Update button now fills the card, and in About the card sits under the version instead of below the links.

### Changed
- The update buttons, banner and card are smaller.

## 0.23.2 (2026-11-23)

### Changed
- **Menus show shortcuts the same way.** The + and More menus used two different formats; both now show the shortcut at the right, muted. The shortcuts come from one table that a test checks against the keyboard shortcut list.
- Opening a link, reporting a failure, and the find and formatting-bar switches each use one function everywhere, so a failed link now always says so instead of doing nothing in some places.
- Recent files read the same in the home list, the + menu and the Recent files list: the title, or the file name without its extension.

## 0.23.1 (2026-11-23)

### Changed
- **An available update is now hard to miss.** The home screen shows a banner with an Update button, the More menu shows a highlighted "Update to X" entry, and Settings, Support and About show a card with an Update button. In the update dialog the main action is a filled button, and the less common choices on Android (Open Downloads, the browser download, the file's checksum) sit under "Other ways to update".
- Support has Check for updates, and the control is the same in Settings, Support and About.

## 0.23.0 (2026-11-23)

### Fixed
- **Files in other encodings are no longer corrupted.** A file that isn't valid UTF-8 (Windows-1252, Latin-1, UTF-16) used to open with replacement characters, and saving wrote them back. ArkMD now offers to open a correctly decoded copy and leaves the original alone.
- **Saves are atomic on Windows and Linux.** A crash or a full disk during a save can no longer leave a truncated file. On Android the text is prepared before the file is opened for writing.
- Files over 20 MB and binary files are refused instead of freezing the editor.

### Security
- Android cloud backup and device-to-device transfer are disabled for the app's data, which includes recent-file previews, file history and drafts.
- The Android bridge accepts only `content:` document addresses, and the desktop app no longer grants the page a general permission to write text files; saves go through one command that checks the file was chosen in ArkMD.

## 0.22.3 (2026-11-23)

### Changed
- **Support has its own entry in the More menu.** It gathers Copy diagnostic information, Open the log folder, the user guide, a link to report a bug or suggest a feature, the Ko-fi and Buy Me a Coffee links and the page on contributing on GitHub. The Troubleshooting rows are no longer in Settings, and About links to Support.

## 0.22.2 (2026-11-23)

### Fixed
- **Open the log folder, Copy diagnostic information and links on Linux.** Open the log folder did nothing when ArkMD ran as an AppImage, because the AppImage's own libraries were passed on to the file manager; links to web pages could fail the same way. ArkMD now starts the system's opener with a clean environment, and copies text to the clipboard itself, since the web view on Linux doesn't allow it. Only http, https and mailto addresses are opened.

### Added
- **About > Contribute and support** opens a page with links to support the project on Ko-fi and Buy Me a Coffee and to report a bug, suggest a feature or contribute code on GitHub.

## 0.22.1 (2026-11-23)

### Changed
- The Outline opens from the right edge, matching the swipe-left gesture that opens it, while Recent files stays on the left. On a wide window the find bar moves aside while the outline is open.

## 0.22.0 (2026-11-23)

### Added
- **Spell check, autocorrect and sentence capitals** in the editor, on by default; Settings > Spell check and suggestions turns them off.
- **Match system light/dark.** Settings > Match system light/dark follows the device setting, using the dark and light themes you pick.
- **Remote images setting.** Pictures from the web are hidden until you tap Load images, so opening a file no longer tells the picture's host your address. Settings > Remote images offers Ask first (default), Always load and Never load.
- Privacy page in the documentation.

### Changed
- The Tests workflow checks the Rust and npm dependencies against public advisory databases, and a failed release run removes the tag it created so the version can be released again.

## 0.21.0 (2026-11-23)

### Added
- **Swipe gestures on phones.** Swipe right to open the Recent files list and left to open the Outline; the opposite swipe closes whichever is open. Swipes that start on something that scrolls sideways (the tab strip, the formatting bar, wide tables and code) scroll as usual.

## 0.20.0 (2026-11-23)

### Changed
- **Simpler top bar on phones and narrow windows.** The bar now holds the Recent files button, the tabs, +, Save (when there are changes) and More, so tabs have room and are easy to tap and scroll.
- Find and replace, Outline, Theme and the formatting-bar switch moved into More, below a new list of the open tabs. Undo and Redo moved to the start of the formatting bar.

## 0.19.0 (2026-11-23)

### Added
- **Pinned files.** A pinned file stays at the top of the Recent files flyout, on the home screen and in the + menu, in its own Pinned group, and is never dropped from the list. Stars in the flyout are always visible, and an All / Pinned switch shows only pinned files.
- Pin or unpin the file in the current tab with Ctrl+D or More > Pin to recent files. Pinned files show a star on their tab.

## 0.18.0 (2026-11-23)

### Added
- **Recent files flyout.** The clock button at the top left (Ctrl+Shift+R) lists the files you've opened or saved, newest first and grouped by Today, Yesterday and so on, as cards with the title, file name and folder, a two-line preview, when it was last used and its word count. Search narrows the list, a star pins a file to the top, and the ✕ removes it from the list without touching the file. Open… and New are at the top, and arrow keys and Enter work. Files that are open in a tab are marked.
- The list now remembers up to 200 files (plus pinned ones) instead of 20. The home screen shows the newest six with a See all link, and the + menu the newest five with All recent files….
- **Settings > History and recovery > Remember recent files** turns the list off and clears it. Titles and previews are stored only on the device.

## 0.17.0 (2026-11-23)

### Added
- **Open file location** in the More menu (Windows and Linux; Show in File Explorer on Windows, Reveal in Finder on macOS): shows the open file in the system file manager, selected where the system supports it and otherwise by opening its folder. It's available for saved files only and isn't offered on Android.

### Changed
- The README screenshots show five different themes (Nordic, Gruvbox Dark, Basic Light, Catppuccin Mocha, Everforest Dark) and the welcome tour.

## 0.16.0 (2026-11-23)

### Added
- **Basic Light and Basic Dark**, two plain themes without bright colors, in the style of a word processor or a basic Markdown editor: a white or near-black page, navy and slate headings, one muted blue accent, and bold and italic without color. Both meet WCAG AA contrast.

## 0.15.3 (2026-11-23)

### Fixed
- **Pasting a picture on Linux.** When the web view delivers an empty paste for a picture, ArkMD now reads the picture from the system clipboard (X11, and Wayland compositors with the data-control protocol), saves it as a PNG in the document's `images` folder and links it. Pasting text is unchanged.

## 0.15.2 (2026-11-23)

### Changed
- **Faster documents with diagrams.** A diagram is drawn when it comes near the screen instead of all at once, and drawn diagrams are remembered, so opening or switching back to a document no longer redraws them. Switching to the welcome tour took about half a second of diagram drawing each time on a desktop; it now takes a few milliseconds. Print and Export as HTML still draw every diagram first.
- **Scroll bars** are themed through the standard `scrollbar-color` and `scrollbar-width` properties only. WebKit's `::-webkit-scrollbar` styling is no longer used, because it can scroll less smoothly; a web view too old to know the standard properties shows its normal scroll bars.

## 0.15.1 (2026-11-23)

### Changed
- **Android updates.** Settings > Check for updates now > Download the update downloads the new version with Android's Download Manager instead of handing the link to the browser, which could stall on its download screen. The dialog shows the progress; when the download finishes it shows what to tap next and opens Downloads. Open Downloads and Open the download in the browser remain as fallbacks. ArkMD still doesn't install anything itself or ask for the permission to install apps.
- **Android, installed from a store app.** When ArkMD was installed from F-Droid, Neo Store, Droid-ify, Obtainium or Google Play, the update dialog offers Update in that app, which opens it at ArkMD's page. The manifest lists those apps under queries so ArkMD can see and open them.

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
- **Insert pictures** (Windows and Linux). The image button in the formatting panel (Ctrl+Shift+I), pasting a picture, or dropping image files copies them into an `images` folder next to the document and links them at the cursor as their own paragraph. Pasting from the clipboard works where the web view passes pictures to the page (Windows); 0.15.3 added a fallback for Linux.
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
