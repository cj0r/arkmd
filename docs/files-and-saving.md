# Files and saving

## Opening

- **Open with** from your file manager, **+** > **Open file…** (Ctrl+O), a recent file, or on Android **Share** > ArkMD for a piece of text. Every file opens in a tab.
- If a file is already open, ArkMD switches to its tab instead of opening it twice. On Android a file reached through a different folder or picker view can have a different internal address, so ArkMD also treats a file as already open when a tab has the same name and the same saved text.
- ArkMD lists your 20 most recent files under **+** and on the home screen, which has **Clear**. The list holds file names and addresses, not contents. On Android a recent file opens again only while the system still allows ArkMD to read it.
- Text shared from another app opens as `Untitled.md`, `Untitled 2.md` and so on, with no file behind it until you save.

## Saving

- **Save** (the button in the top bar, or Ctrl+S) writes the document over the file it came from. There is no autosave and ArkMD keeps no backup copy or history: once saved, the previous contents are gone. Keep your own backups.
- **Save as…** (**More** menu, or Ctrl+Shift+S) writes the document to a new file you choose. The tab then belongs to the new file. A new, untitled document always uses Save as the first time.
- A dot on a tab means it has changes that aren't saved. Closing a tab, or the window, with unsaved changes asks first.
- Saving rewrites the whole file. If the app, the device or the connection to a synced or network folder fails in the middle, the file can be left incomplete.
- Some places can't be written, for example a read-only folder or a document provider that only allows reading. ArkMD then says "Could not save"; use **Save as…** to write a copy somewhere else.

## What ArkMD changes in a file

- Files are read and saved as **UTF-8**. A file in another encoding, such as Latin-1, can be damaged when saved. A byte-order mark at the start is dropped.
- A file's **line endings are kept**: a file that uses Windows line endings (CRLF) stays that way, and so does one that uses Unix endings (LF). A file that mixes the two is saved with Unix endings.
- ArkMD doesn't otherwise rewrite your text: what you see in the editor is what is saved.
