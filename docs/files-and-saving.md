# Files and saving

## Opening

- **Open with** from your file manager, **+** > **Open file…** (Ctrl+O), a recent file, or on Android **Share** > ArkMD for a piece of text. Every file opens in a tab.
- If a file is already open, ArkMD switches to its tab instead of opening it twice. On Android a file reached through a different folder or picker view can have a different internal address, so ArkMD also treats a file as already open when a tab has the same name and the same saved text.
- ArkMD lists your 20 most recent files under **+** and on the home screen, which has **Clear**. The list holds file names and addresses, not contents. On Android a recent file opens again only while the system still allows ArkMD to read it.
- Text shared from another app opens as `Untitled.md`, `Untitled 2.md` and so on, with no file behind it until you save.

## Saving

- **Save** (the button in the top bar, or Ctrl+S) writes the document over the file it came from. There is no autosave. ArkMD keeps the text being replaced as an earlier version (see [History and recovery](#history-and-recovery)), but that is not a backup, so keep your own.
- **Save as…** (**More** menu, or Ctrl+Shift+S) writes the document to a new file you choose. The tab then belongs to the new file. A new, untitled document always uses Save as the first time.
- A dot on a tab means it has changes that aren't saved. Closing a tab, or the window, with unsaved changes asks first.
- Saving rewrites the whole file. If the app, the device or the connection to a synced or network folder fails in the middle, the file can be left incomplete.
- Some places can't be written, for example a read-only folder or a document provider that only allows reading. ArkMD then says "Could not save"; use **Save as…** to write a copy somewhere else.

## What ArkMD changes in a file

- Files are read and saved as **UTF-8**. A file in another encoding, such as Latin-1, can be damaged when saved. A byte-order mark at the start is dropped.
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
