# Reading and editing

## Reading and editing modes

Each tab is either reading or editing. The reader draws the document with colored headings, callouts, tables and highlighted code. The editor shows the Markdown source with live coloring: headings are larger and colored, and the markup characters (`#`, `**`, `>`) are dimmed. Code inside fenced blocks is colored in the editor too.

The round button at the bottom right, or Ctrl+E, switches the current tab and keeps your scroll position. Each tab remembers its own mode.

## Code in the editor

Fenced code blocks are colored in the editor with the same colors as in the reader. The editor knows these languages: JavaScript, TypeScript, Python, Rust, Java, Kotlin, C and C++, C#, Go, JSON, YAML, TOML, HTML and XML, CSS, SQL, shell, PowerShell, Lua, Ruby, diff and Dockerfile. Put the language after the opening fence (` ```python `); other languages are shown as plain code.

## Tabs

- Every open file is a tab in the top bar. Tap or click a tab to switch to it.
- Close a tab with its **✕**, by middle-clicking it, with Ctrl+W, or with the Android back button. A tab with unsaved changes shows a dot and asks before it closes.
- **Ctrl+Tab** and **Ctrl+Shift+Tab** (or Ctrl+PageDown and Ctrl+PageUp) move to the next and previous tab. With a tab focused, the left and right arrow keys move between tabs, Home and End jump to the first and last, and Delete closes it.
- Each tab keeps its own text, undo history, cursor and scroll position while you work in another.
- **+** opens a menu with **New file**, **Open file…** and your recent files.
- On Linux and Windows, opening another file from your file manager adds it as a tab in the window that is already open.

## The formatting panel

While you edit, a floating bar offers the most-used Markdown formatting, so you don't need to remember the syntax. The formatting button (**Tт**) in the top bar shows or hides it.

| Button | What it does |
|---|---|
| Heading | A menu of heading 1 to 6, or normal text |
| Bold, Italic, Strikethrough, Highlight, Inline code | Wraps the selection (`**`, `*`, `~~`, `==`, `` ` ``), or inserts an empty pair at the cursor |
| Link | Turns the selection into `[text](https://)` with the address selected |
| Bulleted list, Numbered list, Task | Applies to every selected line; switches between list types |
| Quote | Prefixes every selected line with `>` |
| Callout | A menu of callout types (note, tip, info, warning, danger, question, example, quote) |
| Code block | Wraps the selection in a fenced block |
| Table, Divider | Insert a table or a horizontal rule on its own lines |

Apply a format again to remove it: bold text becomes plain, a bulleted line becomes plain. Every formatting step can be undone.

## Keyboard shortcuts

**F1** (or **More** > **Settings** > **Keyboard shortcuts**) lists them in the app. On macOS, Cmd works in place of Ctrl.

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
| Ctrl+, | Settings |
| F1 | Keyboard shortcuts |
| Esc | Close a menu or dialog |
| Ctrl + and Ctrl − | Make the whole window larger or smaller (desktop) |

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
| Ctrl+Z, Ctrl+Shift+Z | Undo, redo |

Each list and style shortcut works on the selected lines or text, and pressing it again removes the formatting. With nothing selected, a style shortcut such as Ctrl+B opens a pair of marks; press it again after typing to step out past the closing marks.

**Writing flow**

- **Heading:** press Ctrl+2 on a line, or type `## `. With the cursor on a heading line, **Tab** makes it one level deeper (`##` becomes `###`) and **Shift+Tab** one level shallower, so you can step through the outline without retyping the marks.
- **Lists:** **Enter** continues a list with the next bullet, number or task; **Enter** on an empty item ends the list. **Tab** nests the current item (a numbered item moves in by three spaces so the nesting stays valid) and **Shift+Tab** moves it back out. This works on several selected items too.
- **Anywhere else**, Tab indents and Shift+Tab un-indents as usual.

Menus and dialogs work with the arrow keys and Esc, and the focus ring always shows where you are.
