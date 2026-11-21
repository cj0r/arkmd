# Supported Markdown

The reader renders CommonMark and the usual GitHub extensions, plus several features from Obsidian. `samples/feature-tour.md` in the repository is a document that uses every feature below; open it in ArkMD to see them.

## Standard Markdown

- Headings 1 to 6, each in its own theme color.
- **Bold**, *italic*, ~~strikethrough~~ and `inline code`; links and bare web addresses (which become links); block quotes; bulleted, numbered and nested lists; horizontal rules.
- Tables, with column alignment.
- Task lists (`- [ ]` and `- [x]`). The reader shows the checkboxes but they aren't clickable; change them in the editor.
- Footnotes (`[^1]`).
- Fenced code blocks. Put the language after the opening fence (` ```python `); blocks without one are detected automatically. The reader colors them with highlight.js and the editor colors the languages listed under [Reading and editing](reading-and-editing.md#code-in-the-editor).
- Front matter, the `---` block at the top of a file, is shown as a box and isn't interpreted.
- Typographic quotes and dashes are applied when reading; the file itself is not changed.

## From Obsidian

- **Callouts:** a block quote that starts with `[!type]` and an optional title becomes a colored callout. Types are `note`, `abstract` (`summary`, `tldr`), `info`, `todo`, `tip` (`hint`, `important`), `success` (`check`, `done`), `question` (`help`, `faq`), `warning` (`caution`, `attention`), `failure` (`fail`, `missing`), `danger` (`error`), `bug`, `example` and `quote` (`cite`). Add `-` after the type for a callout that starts collapsed, or `+` for a foldable one that starts open: `> [!info]- Details`.
- **Highlights:** `==text==`.
- **Wikilinks:** `[[Note]]` and `[[Note|shown text]]` are drawn as links with a dashed underline. ArkMD has no vault, so they don't open anything.
- **Tags:** `#tag` and nested tags such as `#project/ideas` are drawn as chips. A tag needs at least one letter.

## Not supported

Raw HTML (it's shown as text, not run), math, diagrams such as Mermaid, note embeds (`![[Note]]`), comments (`%%`), block references and plugins.

## Images

Images from the web (`![](https://example.com/picture.png)`) are shown, which means ArkMD loads them from that server, as any browser would. Images by file path, such as `![](picture.png)`, aren't loaded.
