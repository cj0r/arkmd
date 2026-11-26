# Security

How to report a problem is in [SECURITY.md](../SECURITY.md). This page covers what ArkMD does with your files and your device, and how to check a download.

## What ArkMD does

- **No account, no tracking.** ArkMD collects no data and sends no documents or usage information anywhere.
- **Local copies.** File history and unsaved-work drafts keep copies of your documents in ArkMD's own storage on the device (up to about 50 MB). They are never sent anywhere and aren't encrypted beyond what the device itself provides. Switch them off, or clear them, in **Settings** > **History and recovery**; uninstalling or clearing the app's data removes them.
- **Files:** it reads and writes only files you open, save or choose in a file picker. On Windows and Linux, a document can also show images and open Markdown files from the folder of the file you opened (relative links only, and only image and Markdown file types); nothing else next to it is reachable. A link to a Markdown file outside that folder asks for confirmation first, so a document can't widen the files ArkMD may touch without you seeing it. Inserting a picture copies a file you chose, pasted or dropped into an `images` folder next to the document, and nothing else is written outside the files you save. ArkMD reads the system clipboard only when you paste into the editor, and only to look for a picture. On Android it uses the system file and folder pickers, so it asks for no storage permission; a folder you add stays readable until you remove it, and only inside that folder. The desktop apps may read and write only the files you pick or open with ArkMD.
- **Network:** ArkMD makes no requests of its own, with two exceptions. Check for updates (**More** > **Support**, **Settings** or **About**) asks GitHub for the latest release; it runs only when you choose it, or once a day if you turn on **Check for updates automatically**, which is off by default. And a document that points to an image on the web: by default ArkMD hides it and shows a bar with **Load images**, because loading a picture tells the server that hosts it your address and that the document was opened. **Settings** > **Appearance** > **Remote images** switches this to always load or never load. Windows and Linux updates are verified against a public key built into the app before they install. On Android, ArkMD only reads the release information and opens the download in your browser; Android's installer checks that the new version carries the same signing certificate as the installed one, and the update dialog shows the file's SHA-256 so you can compare it with `SHA256SUMS.txt`. Links open in your system browser, and only `http`, `https` and `mailto` links are followed.
- **Diagrams** are drawn by the bundled Mermaid library at its strict security level (no scripts, no click actions), from the text in the document; nothing is fetched.
- **Raw HTML is off,** so a document can't run scripts or embed active content in the reader. As a second layer, the app's content security policy allows scripts only from ArkMD's own files: no inline scripts, no plug-ins.
- **Log file (Windows and Linux):** errors and crashes are written to a text file in the app's log folder, up to about 1 MB. It holds no document text, is never sent anywhere, and you can delete it at any time.
- **Backups (Android):** ArkMD turns off Android's cloud backup and device-to-device transfer for its own data, so recent-file previews, file history and drafts never leave the device that way.
- **What it stores:** the version number, release notes and download address of an update found by a check (until you install it), your settings (theme, fonts, text size) and the list of recent files (file names and addresses, plus each file's title, its first lines as a short preview and its word count, so the list can show them), in the app's own storage on your device. **Settings** > **Files** > **Remember recent files** switches the list off and clears it.

## The F-Droid repository

The repository at `https://cj0r.github.io/arkmd/fdroid/repo` is built by GitHub Actions from the APKs attached to the releases (0.14.1 and later); each APK keeps the ArkMD release signature, and the build stops if one carries any other. The repository's index is signed with a separate key, whose SHA-256 fingerprint is `6B:BB:C5:DB:95:A4:2C:2B:E7:5D:58:28:42:03:23:64:AB:E7:D0:11:F3:7B:64:09:3B:2C:B6:DC:7A:0A:2C:72`. Your client should show this fingerprint when you add the repository. Android installs an update only if it is signed with the same key as the installed app.

## Check a download

Every release lists a SHA-256 checksum for each file in `SHA256SUMS.txt`, and releases are built from the tagged source by GitHub Actions (see `.github/workflows/release.yml`).

- **Linux:** in the folder with the download, `sha256sum -c --ignore-missing SHA256SUMS.txt`.
- **Windows:** `Get-FileHash .\ArkMD_<version>_x64-setup.exe -Algorithm SHA256` in PowerShell, and compare the value with the one in `SHA256SUMS.txt`.
- **Android:** besides the checksum, the APK carries the release signing certificate. Its SHA-256 fingerprint is
  `1e18cf4304250b1adea255481f9f91c85a1765cf6ce4ec8a4c2f53461fd9ec90`. With the Android SDK's build tools, `apksigner verify --print-certs ArkMD-<version>-android-arm64.apk` prints it. Android installs a new version over the old one only if both are signed with the same key.

The Windows installers aren't code-signed, so SmartScreen warns about them; the checksum is how you confirm you have the file from the release.

## Permissions

- **Android:** network access (update checks and web images you choose to load) only. ArkMD doesn't ask to install apps; no storage, contacts or location permissions either.
- **Windows and Linux:** no special permissions; ArkMD runs as your user. Updating a .deb or .rpm install asks for administrator rights through the system prompt.
