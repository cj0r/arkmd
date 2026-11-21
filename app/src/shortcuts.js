// The keyboard shortcuts shown in Settings > Keyboard shortcuts. The bindings themselves are in main.js (global keys)
// and in the editor's keymap; keep this list in step with them and with docs/reading-and-editing.md.
export const SHORTCUTS = [
  ["Files and tabs", [
    ["Ctrl+O", "Open a file"], ["Ctrl+N, Ctrl+T", "New file"], ["Ctrl+S", "Save"], ["Ctrl+Shift+S", "Save as"],
    ["Ctrl+W", "Close the current tab"], ["Ctrl+Shift+T", "Reopen the last closed tab"], ["Ctrl+Tab, Ctrl+Shift+Tab", "Next, previous tab"],
  ]],
  ["View", [
    ["Ctrl+E", "Switch between reading and editing"], ["Ctrl+,", "Settings"], ["F1", "This list"],
    ["Ctrl + and Ctrl −", "Larger, smaller window content"], ["Esc", "Close a menu or dialog"],
  ]],
  ["Headings (while editing)", [
    ["Ctrl+1 … Ctrl+6", "Heading 1 to 6; again to turn it back into text"], ["Ctrl+0", "Normal text"],
    ["Tab, Shift+Tab", "On a heading line: one level deeper, one level up"],
  ]],
  ["Text style (while editing)", [
    ["Ctrl+B", "Bold"], ["Ctrl+I", "Italic"], ["Ctrl+Shift+X", "Strikethrough"], ["Ctrl+Shift+H", "Highlight"],
    ["Ctrl+`", "Inline code"], ["Ctrl+K", "Link"],
  ]],
  ["Lists and blocks (while editing)", [
    ["Ctrl+Shift+8", "Bulleted list"], ["Ctrl+Shift+7", "Numbered list"], ["Ctrl+Shift+9", "Task list"],
    ["Ctrl+Shift+Q", "Quote"], ["Ctrl+Shift+K", "Code block"],
    ["Enter", "Continue the list; on an empty item, end it"], ["Tab, Shift+Tab", "On a list item: nest, un-nest"],
    ["Ctrl+Z, Ctrl+Shift+Z", "Undo, redo (also buttons in the top bar)"],
  ]],
];
