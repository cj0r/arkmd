# Reading and editing

## Reading and editing modes

Each tab is either reading or editing. The reader draws the document with colored headings, callouts, tables and highlighted code. The editor shows the Markdown source with live coloring: headings are larger and colored, and the markup characters (`#`, `**`, `>`) are dimmed. Code inside fenced blocks is colored in the editor too.

The round button at the bottom right, or Ctrl+E, switches the current tab and keeps your scroll position. Each tab remembers its own mode.

## Find and replace

The magnifier in the top bar, or **Ctrl+F**, opens the find bar. Type to see every match, step through them with **Enter** and **Shift+Enter** (or the arrows, or F3), and use the buttons for **Aa** (match case), **ab** (whole word) and **.\*** (regular expression). The bar works in reading mode, where matches are highlighted in the page, and in the editor.

**Ctrl+H**, or the arrow at the left of the find bar, adds a replace row in the editor. **Replace** changes the current match and moves to the next; **Replace all** changes every match as one step you can undo. With regular expressions on, `$1` to `$9` in the replacement stand for the groups of the match and `$&` for the whole match. Reading mode has no replace: Ctrl+H switches to the editor first. In reading mode a match must sit inside one piece of formatting, so text split across bold or a link may not be found there; the editor finds it.

## Pictures (Windows and Linux)

Add a picture while editing in any of three ways: the image button in the formatting panel (or **Ctrl+Shift+I**), pasting a picture from the clipboard, or dragging an image file onto the window. ArkMD copies the file into an `images` folder next to your Markdown file, giving it a safe name (letters, digits, dashes and underscores; a number is added if the name is taken), and inserts `![name](images/name.png)` at the cursor as its own paragraph, with the description selected so you can retype it. The picture is a copy, so the original stays where it was, and your Markdown file and its `images` folder can be moved or synced together.

- The document has to be saved first, because the folder goes next to it. An untitled document asks you to save it.
- PNG, JPEG, GIF, WebP, AVIF, BMP and SVG files up to 25 MB are accepted.
- Pasting works when the clipboard holds a picture and no text (a screenshot, say). It is saved as `pasted-` and the date and time. Where the web view doesn't hand the picture to ArkMD (as on some Linux setups), ArkMD reads it from the system clipboard itself; this reads the clipboard only at the moment you paste into the editor.
- Dropping several images inserts them all, one paragraph each. Dropping a Markdown file on the window opens it as a tab.
- Android doesn't have this yet.

## Task lists

In reading mode, tap or click a task's checkbox to tick or untick it. The change is made in the file's text like any edit: the file is marked as changed, Undo works in the editor, and Save writes it.

## Outline

The list button in the top bar (Ctrl+Shift+O) opens a flyout on the right with the headings of the document, indented by level. Choose one to jump to it: the reader scrolls to the heading, and the editor puts the cursor at the start of its line. The section you are in is marked. Headings inside code blocks and front matter are not listed. Esc or a click outside closes the flyout. At the bottom it shows the word and character count of the document and an estimated reading time.

![The outline flyout, in Catppuccin Mocha](screenshots/outline-catppuccin-mocha.png)

## Code in the editor

Fenced code blocks are colored in the editor with the same colors as in the reader. The editor knows these languages: JavaScript, TypeScript, Python, Rust, Java, Kotlin, C and C++, C#, Go, JSON, YAML, TOML, HTML and XML, CSS, SQL, shell, PowerShell, Lua, Ruby, diff and Dockerfile. Put the language after the opening fence (` ```python `); other languages are shown as plain code.

## Right-click menus (Windows and Linux)

Right-click replaces the web engine's own menu with ArkMD's:

- **In the editor:** a Document section (Save when there are changes, Find and replace, Outline, Switch to reading, Undo, Redo, Cut, Copy, Paste, Select all), then every command of the formatting panel (styles, headings, lists, quote, callout, code block, table, divider and, where supported, Image). A tall menu scrolls in a short window. Heading and Callout open a second list with a Back entry. The formatting applies to the selection or the cursor, and a callout type changes the callout you are in.
- **In the reader:** Copy (with text selected), Select all, Edit this document, Find, Outline, Print and Export as HTML.
- **On a tab:** Close, Close other tabs, Close tabs to the right, Save as, Pin to recent files (or Unpin from recent files), Copy file path, Show in File Explorer (Open file location on Linux), Rename file, Move to Recycle Bin (Move to Trash on Linux) and, once a tab has been closed, Reopen closed tab. A tab with unsaved changes still asks before it closes.
- **On a file in the recent files pane** (the recent list or a folder tree): the same file entries as a tab, in the same order: Pin to recent files (or Unpin from recent files), Copy file path, Show in File Explorer (Open file location on Linux), Rename file and Move to Recycle Bin (Move to Trash on Linux). Open comes first, and the recent list adds Remove from recent files at the end. It works whether or not the file is open; moving an open file to the bin closes its tab after asking.
- **On the title bar and the home screen:** New file, Open file, Recent files, Reopen closed tab, Settings, Keyboard shortcuts and About.

Text fields (the find bar, dialogs) keep the system menu. On Android, press and hold works as before.

## Tabs

- Every open file is a tab in the top bar. Tap or click a tab to switch to it.
- Close a tab with its **✕**, by middle-clicking it, with Ctrl+W, or with the Android back button. A tab with unsaved changes shows a dot and asks before it closes.
- **Ctrl+Tab** and **Ctrl+Shift+Tab** (or Ctrl+PageDown and Ctrl+PageUp) move to the next and previous tab. With a tab focused, the left and right arrow keys move between tabs, Home and End jump to the first and last, and Delete closes it.
- Drag a tab sideways to change the order, or press **Ctrl+Shift+PageUp** and **Ctrl+Shift+PageDown** to move the current tab.
- Each tab keeps its own text, undo history, cursor and scroll position while you work in another.
- On a phone or a narrow window the top bar shows only the Recent files button, the tabs, **+**, Save (when there are changes) and **⋮**. **⋮** lists the open tabs, then Find and replace, Outline, the formatting-bar switch and Theme. Undo and Redo are at the start of the formatting bar.
- **Swipes (phone).** Swipe right to open the Recent files list, swipe left to open the Outline. The opposite swipe closes the one that's open. Swiping along the tab strip, the formatting bar, a wide table or a code block scrolls it instead. Android's own back gesture from the screen edge is unaffected: start the swipe a little further in.
- **Spell check.** The editor underlines misspelled words and lets the keyboard suggest and capitalize as you type. **Settings** > **Spell check and suggestions** turns this off, which suits code.
- **Status bar.** **Settings** > **Status bar** shows a bar along the bottom with the line and column of the cursor (in the editor), the word and character counts and the size of the document. With text selected, the counts are for the selection.
- **Line numbers.** **Settings** > **Line numbers** shows the number of each line beside it in the editor.
- **Closing brackets in code.** Typing `(`, `[`, `{` or a quote inside a fenced code block that names a language, such as ```` ```js ````, adds the closing one; typing the closing character steps over it, and Backspace removes an empty pair. Ordinary text, inline code and fences without a language are not affected. **Settings** > **Close brackets in code** turns it off.
- **Closing tags in code.** Typing `<div>` inside a fenced code block that names a language, such as ```` ```html ````, adds `</div>`, and typing `</` completes the closing tag. Ordinary text, inline code and fences without a language are not affected. **Settings** > **Close tags in code** turns it off.
- **⋮ (More)** holds Settings, **Support** (troubleshooting, the user guide, bug reports, ways to support and contribute to the project) and About, as well as the commands for the open file.
- **+** opens a menu with **New file**, **Open file…** and your newest files. The clock button to its left opens the Recent files list (Ctrl+Shift+R).
- On Linux and Windows, opening another file from your file manager adds it as a tab in the window that is already open.

## Folders in the recent files list

On all platforms, you can add commonly used folders to the Recent files flyout (**Ctrl+Shift+R**) and browse their Markdown files in an expandable tree without opening the system file picker each time.

- **Add a folder:** open the Recent files flyout and choose **Add a folder**. You can keep up to 20 folders; adding the same folder again does nothing.
- **Expand and open:** click a folder row or its arrow to expand or collapse it in place. Subfolders appear first, followed by Markdown files (`.md`, `.markdown`, `.mdown`, `.mkd`, `.txt`), sorted by name with hidden entries (starting with `.`) skipped. Subfolders expand the same way to any depth, and clicking a file opens it as a tab and marks it in the tree. Expanded folders are remembered across restarts.
- **Keyboard navigation:** tab into the folder tree and use **Up** / **Down** to move between visible rows, **Right** to expand a folder or move to its first child, **Left** to collapse a folder or move to its parent, **Home** / **End** to jump to the top or bottom, and **Enter** or **Space** to toggle a folder or open a file.
- **On Android:** **Add a folder** opens the system folder picker, and ArkMD keeps the access you give it until you remove the folder. Rows are larger for touch, and keyboard navigation doesn't apply.
- **Keep the pane open (Windows and Linux):** the pin button in the pane's header (or **Settings** > **Recent files** > **Keep the recent files pane open**) docks the pane beside the document instead of floating over it, and it stays open when you open a file, press Escape or click in the document. A pinned pane is open from the start; the **Recent files** button in the top bar or **Ctrl+Shift+R** hides and shows it. In a window narrower than 760 pixels there is no room beside the document, so the pane floats and closes as usual. Press the pin again to unpin it.
- **Delete a file:** on Windows and Linux, the bin button on a file in the recent files list or in a folder tree, the **Delete** key on a focused file in a tree, or Move to Recycle Bin / Trash in a right-click menu ([see above](#right-click-menus-windows-and-linux)), asks first and then moves the file to the Recycle Bin (Windows) or Trash (Linux). Nothing is erased permanently: if the system can't move the file, it stays where it is and ArkMD says so. If the file is open in a tab, the tab closes, and unsaved changes in it are lost; the confirmation says so. Only Markdown files ArkMD opened or found in a folder you added can be moved. On Android, a file in a folder you added can be deleted after a confirmation that says it cannot be undone, because Android has no trash; a file you picked with the file picker has no delete.
- **Remove a folder:** choose the **✕** button on a top-level folder's row. Removing a folder forgets it from ArkMD (and releases the folder access permission on Android); nothing on disk is changed.
- **Restricted access, nothing indexed:** ArkMD can list and read only inside the folders you explicitly add. Folders are read one level at a time only when you expand them or reopen the flyout with them expanded; nothing is indexed, watched or scanned in the background.

## The formatting panel

While you edit, a floating bar offers the most-used Markdown formatting, so you don't need to remember the syntax. The formatting button (**Tт**) in the top bar shows or hides it.

| Button | What it does |
|---|---|
| Heading | A menu of heading 1 to 6, or normal text |
| Bold, Italic, Strikethrough, Highlight, Inline code | Wraps the selection (`**`, `*`, `~~`, `==`, `` ` ``), or inserts an empty pair at the cursor |
| Link | Turns the selection into `[text](https://)` with the address selected |
| Bulleted list, Numbered list, Task | Applies to every selected line; switches between list types |
| Quote | Prefixes every selected line with `>` |
| Callout | A menu of callout types (note, tip, info, warning, danger, question, example, quote). With the cursor inside an existing callout, choosing a type changes that callout's type (and its title, if it still has the old type's default title) instead of adding a new one |
| Code block | Wraps the selection in a fenced block |
| Image (Windows and Linux) | Choose a picture to copy next to the document and link (see [Pictures](#pictures-windows-and-linux)) |
| Table, Divider | Insert a table or a horizontal rule on its own lines |

In a table, **Tab** moves to the next cell and selects its text, **Shift+Tab** to the previous one, and Tab in the last cell adds a row.

Apply a format again to remove it: bold text becomes plain, a bulleted line becomes plain. Every formatting step can be undone.

## Keyboard shortcuts

**F1** (or **More** > **Settings** > **Keyboard shortcuts**, on desktop) lists them in the app. On macOS, Cmd works in place of Ctrl.

**Files and view**

| Keys | Action |
|---|---|
| Ctrl+O | Open a file |
| Ctrl+N or Ctrl+T | New file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as |
| Ctrl+W | Close the current tab |
| Ctrl+Tab, Ctrl+Shift+Tab | Next, previous tab (also Ctrl+PageDown, Ctrl+PageUp) |
| Ctrl+E | Switch between reading and editing |
| Ctrl+Shift+O | Outline of the document |
| Ctrl+Shift+R | Recent files |
| Ctrl+D | Pin or unpin the file in this tab |
| Ctrl+F | Find |
| Ctrl+H | Find and replace (in the editor) |
| Enter, Shift+Enter, F3 | Next, previous match while the find bar is open |
| Ctrl+P | Print (desktop) |
| Ctrl+Shift+PageUp, Ctrl+Shift+PageDown | Move the current tab left, right |
| Ctrl+, | Settings |
| F1 | Keyboard shortcuts |
| Esc | Close a menu; in a dialog, go back one page (for example from Keyboard shortcuts to Settings), or close it from its first page |
| Ctrl + and Ctrl − | Make the whole window larger or smaller (desktop) |

**Clipboard**

| Keys | Action |
|---|---|
| Ctrl+C or Ctrl+Shift+C | Copy (in the editor, the reader and text fields) |
| Ctrl+V or Ctrl+Shift+V | Paste into the editor (Ctrl+Shift+V pastes as plain text, which for Markdown is the same) |
| Ctrl+X | Cut (while editing) |

**Formatting, while editing**

| Keys | Action |
|---|---|
| Ctrl+1 to Ctrl+6 | Heading level 1 to 6 (press again to turn the line back into text) |
| Ctrl+0 | Normal text |
| Ctrl+B, Ctrl+I | Bold, italic |
| Ctrl+Shift+X | Strikethrough |
| Ctrl+Shift+H | Highlight |
| Ctrl+` | Inline code |
| Ctrl+K | Link |
| Ctrl+Shift+8 | Bulleted list |
| Ctrl+Shift+7 | Numbered list |
| Ctrl+Shift+9 | Task list |
| Ctrl+Shift+Q | Quote |
| Ctrl+Shift+K | Code block |
| Ctrl+Shift+I | Insert a picture (Windows and Linux) |
| Ctrl+Z; Ctrl+Y or Ctrl+Shift+Z | Undo; redo |

Each list and style shortcut works on the selected lines or text, and pressing it again removes the formatting. With nothing selected, a style shortcut such as Ctrl+B opens a pair of marks; press it again after typing to step out past the closing marks.

**Writing flow**

- **Heading:** press Ctrl+2 on a line, or type `## `. With the cursor on a heading line, **Tab** makes it one level deeper (`##` becomes `###`) and **Shift+Tab** one level shallower, so you can step through the outline without retyping the marks.
- **Lists:** **Enter** continues a list with the next bullet, number or task; **Enter** on an empty item ends the list. **Tab** nests the current item one level (by the width of the marker of the item above it, so the nesting stays valid) and **Shift+Tab** moves it one level out. A nested numbered list starts again at 1, and an item moved out continues the outer list. This works on several selected items too. When you insert or delete a numbered item, the numbers of the list are corrected (1, 2, 3 …); a list that uses the same number on every line (all `1.`) is left as it is. Nested numbered lists are shown as 1. 2. 3., then a. b. c., then i. ii. iii., and the pattern repeats; the file itself keeps ordinary numbers, and the reader shows the same markers.
- **Tables:** **Tab** and **Shift+Tab** move between cells, and Tab in the last cell adds a row.
- **Anywhere else**, Tab indents and Shift+Tab un-indents as usual.

Menus and dialogs work with the arrow keys and Esc, and Tab stays inside an open dialog, and the focus ring always shows where you are. In a dialog, Esc (and Back on Android) goes back one page when you got there from another one, and closes the dialog only from its first page. To close everything at once, use Close or Done, or tap outside the dialog.

## Known limits

- On the phone, the keyboard does not add `)` after a first `(` typed right after pressing Enter.
- Two ArkMD windows can edit the same file. ArkMD warns when a window opens a file that another window has open, and it asks before saving over changes made elsewhere, but it does not stop you from editing in both.
- Closing of brackets and tags (Settings > Editing and saving) does nothing in a fenced block without a language and in inline code.
- A document over 4 MB is shown in parts in the reading view: the first 2 MB, then a bar with **Show the next part**. The outline and Find in the reading view cover the parts shown so far; the editor shows and searches the whole file. A document over 8 MB opens in the editor.
- Local images next to a document are not loaded on Android.
- macOS builds are experimental and unsupported, and screen reader support is best effort (checked with automated accessibility tests only). See [Support and stability](../SUPPORT.md).
