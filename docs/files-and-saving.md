# Files and saving

## Opening

- **Open with** from your file manager, **+** > **Open file…** (Ctrl+O), a recent file, or on Android **Share** > ArkMD for a piece of text. Every file opens in a tab.
- If a file is already open, ArkMD switches to its tab instead of opening it twice. On Android a file reached through a different folder or picker view can have a different internal address, so ArkMD also treats a file as already open when a tab has the same name and the same saved text.
- ArkMD remembers the files you open or save in a **Recent files** list: see the next section. The home screen shows the newest few, and the **+** menu the newest five.
- Text shared from another app opens as `Untitled.md`, `Untitled 2.md` and so on, with no file behind it until you save.

## Recent files

The clock button at the top left (or **Ctrl+Shift+R**) opens the Recent files flyout, the way back to notes you've already used without searching your folders.

- **Cards with a preview.** Each file shows its title (its first heading, or its first line), its file name and folder, the first lines of its text, when you last opened or saved it, and its word count. Files that are open in a tab are marked **Open**.
- **Newest first,** grouped as Today, Yesterday, the previous 7 and 30 days, and Older.
- **Search.** Type in the search box to narrow the list. Every word you type has to appear in the title, file name, folder or preview.
- **Pin your favorites.** The star on a card pins it to a **Pinned** group at the top of the list, which stays put however long ago you used the file. Pinned files also appear first on the home screen and in the **+** menu, and show a star on their tab. The **All / Pinned** switch above the search box shows only pinned files. To pin the note you're in, press **Ctrl+D** or choose **⋮** > **Pin to recent files**. Only saved files can be pinned, and a pinned file is never dropped from the list.
- **Remove.** The ✕ on a card removes it from the list only; the file isn't touched. **Clear recent files** at the bottom empties the list.
- **Open… and New** at the top are the same as in the **+** menu. Arrow keys move through the list and Enter opens a file; Esc closes the flyout.
- **How many.** The list keeps the 200 most recently used files, plus any you've pinned.
- **Privacy.** The list, with the titles and previews, is kept only in ArkMD's own storage on the device, like the rest of your settings. **Settings** > **History and recovery** > **Remember recent files** switches it off and clears it.
- Files whose preview isn't known yet (from before this list existed) fill in the first time you open the flyout, where ArkMD can read them. A file that has since been moved or deleted stays in the list until you open it, and ArkMD then says it couldn't open it and removes it.

## Saving

- **Save** (the button in the top bar, or Ctrl+S) writes the document over the file it came from. Nothing is saved automatically unless you turn on Autosave (below). ArkMD keeps the text being replaced as an earlier version (see [History and recovery](#history-and-recovery)), but that is not a backup, so keep your own.
- **Open file location** (**More** menu, Windows and Linux; **Show in File Explorer** on Windows, **Reveal in Finder** on macOS) shows the saved file in your file manager, selected in its folder where the system supports it, and otherwise opens the folder. It's hidden for a document with no file behind it yet, such as a new one or the welcome tour, and on Android, where documents have no folder to show.
- **Save as…** (**More** menu, or Ctrl+Shift+S) writes the document to a new file you choose. The tab then belongs to the new file. A new, untitled document always uses Save as the first time. On Windows and Linux, **Settings** > **Folder for new files** makes that first Save dialog start in a folder you choose; the dialog still lets you pick any other place.
- A dot on a tab means it has changes that aren't saved. Closing a tab, or the window, with unsaved changes asks first.
- **Autosave** is off by default. **Settings** > **Autosave** saves a file a few seconds after you stop typing. It only applies to files that already exist (a new, untitled document still needs Save as), and it keeps an earlier version at most every few minutes so the file history isn't flooded.
- Saving rewrites the whole file. If the app, the device or the connection to a synced or network folder fails in the middle, the file can be left incomplete.
- Some places can't be written, for example a read-only folder or a document provider that only allows reading. ArkMD then says "Could not save"; use **Save as…** to write a copy somewhere else.

## Pictures

Pictures you insert are copied into an `images` folder next to the document. They aren't part of the Markdown file, so move or share the folder with it. File history keeps earlier versions of the text only, not of the pictures.

## When a file changes outside ArkMD

ArkMD checks when you return to its window or to a tab. If the file was changed by another program and you have no unsaved changes in it, ArkMD reloads it and says so. If you do have unsaved changes, it leaves your text alone and warns you; **Save** then asks whether to replace the changed file, save a copy instead, or cancel, and autosave holds off until you decide. The check compares the file's text with what ArkMD last read or wrote, so a program that saves the same text again goes unnoticed.

## Renaming a file

**More** > **Rename file…** gives the open file a new name in its own folder. The extension stays unless you type another. ArkMD does not replace a file that already exists under the new name, and a name that Windows would refuse (for example one with `:` or `*`) is refused everywhere. The tab, the Recent files entry (and its pin) and the file history follow the file. On Android, renaming works only where the document provider allows it; otherwise ArkMD says so.

## Printing and exporting

On desktop, 
**More** > **Print…** (Ctrl+P) prints the rendered document in a light, ink-friendly style, and the print dialog can write a PDF. **More** > **Export as HTML…** saves a single page with your theme's colors, its text, tables and any local images embedded; links stay links, and it contains no scripts.

On Android, **More** > **Print or save as PDF…** opens the system print dialog, which can also write a PDF, and **More** > **Share…** sends the document's text to another app (a very large document is too big to share this way; use Save as instead).

## What ArkMD changes in a file

- Files are read and saved as **UTF-8**. A byte-order mark at the start is dropped.
- **Other encodings.** A file that isn't valid UTF-8 (Windows-1252 or Latin-1, UTF-16) is never opened for editing in place, because saving it as UTF-8 would change its characters. ArkMD says so and offers **Open a copy**: the text, decoded correctly, in a new unsaved tab named `… (copy).md`. **Save as** keeps it as UTF-8. The original file isn't changed.
- **Size and type.** ArkMD opens files up to 20 MB and refuses ones that look like binary data, which would freeze the editor. A file over about 8 MB opens in the editor instead of the reading view, because drawing that much text takes many seconds (about 20 seconds for 20 MB on a desktop computer); switch to reading when you want it drawn. Between 1 and 8 MB the reading view skips drawing the parts that are off screen until you scroll to them.
- **Saving is atomic** on Windows and Linux: the text goes to a temporary file in the same folder and replaces the original in one step, so a crash or a full disk during a save leaves the old file, never a half-written one. On Android, the system file provider does the write, and ArkMD builds the text before it opens the file, so a failure doesn't empty it.
- A file's **line endings are kept**: a file that uses Windows line endings (CRLF) stays that way, and so does one that uses Unix endings (LF). A file that mixes the two is saved with Unix endings.
- ArkMD doesn't otherwise rewrite your text: what you see in the editor is what is saved.

## Cloud storage

ArkMD has no sign-in of its own for Google Drive, OneDrive or similar services; it opens files the way your system does.

- **Android:** the file picker is the system one, so it lists the storage apps installed on the phone, such as Google Drive or OneDrive. Open a file from there and ArkMD saves it back in place when the provider allows writing. Some providers only allow reading, and ArkMD then says "Could not save"; use **Save as…** to write a copy elsewhere. Saving to a cloud provider depends on the connection, so keep the limits under [Saving](#saving) in mind.
- **Windows and Linux:** use the service's desktop app, which keeps a normal folder in sync. Open and save files in that folder like any other. The sync app handles uploads and conflicts; ArkMD doesn't know the folder is synced.
- **File history** is kept on each device, not in the cloud, so it doesn't follow the file between devices.

## History and recovery

- **File history.** Each time you save a file, ArkMD keeps the text it replaces as an earlier version. **More** > **File history…** lists them, shows a preview and either loads one into the editor or opens it as a new tab. Loading it is an ordinary edit: Undo goes back, and nothing changes on disk until you save. Everything from the last day is kept, older versions are thinned to one a day, and each file keeps up to 30 versions, within about 50 MB in total. Documents over 2 MB aren't versioned.
- **Where it lives.** In ArkMD's own storage on the device, never in your folders, so it doesn't clutter synced folders or vaults and doesn't travel to other devices. It is lost if you clear the app's data or uninstall it. **Settings** > **History and recovery** switches it off and clears it.
- **Unsaved work.** While you edit, ArkMD saves a draft of unsaved changes every few seconds. After a crash, a power failure or the system closing the app, it offers to restore them. If you close the window and choose to discard changes, the drafts are deleted.
- **Undo and Redo.** The arrows in the top bar and Ctrl+Z / Ctrl+Shift+Z step through the edits of the open file; each tab has its own history. **Ctrl+Shift+T** (or the **+** menu) reopens the last closed tab with its text and undo history, including unsaved changes you discarded, until you quit ArkMD.
- **Limits.** History records saves made in ArkMD, so it doesn't cover changes made by other programs. It's not a backup or version control: there are no names or branches, and each device keeps its own.
