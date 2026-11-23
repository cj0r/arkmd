# Troubleshooting

## Android

**Google Play Protect says "Harmful app blocked" (versions 0.6.0 to 0.14.0).** Those versions asked for the permission to install apps, which Play Protect treats as risky for software that isn't from Google Play. Version 0.14.1 and later don't ask for it. Uninstall the old version (its settings are removed), install the current release, and update by downloading each new version or with Obtainium.

**A new version isn't in F-Droid yet.** F-Droid and similar apps refresh a repository only now and then. To check right away, open the app's **Settings**, then **Repositories**, tap the ArkMD repository and use its refresh button (or swipe down on the Latest screen). The new version appears under ArkMD's Versions once the refresh finishes.

**"App not installed" when updating.** A build signed with a different key can't be installed over a release. This happens with an APK you built yourself without the release key. Uninstall the old version first (its settings are removed), then install the new one.

**"Could not save".** The place the file lives may be read-only, or its document provider may allow reading only. Use **More** > **Save as…** to write a copy somewhere else.

**A recent file won't open.** The file may have been moved or deleted; ArkMD then says it couldn't open it and removes it from the list. On Android, the system lets ArkMD read a file only while it keeps that permission: open the file again with **+** > **Open file…**.

**The text is too small or too large.** ArkMD follows the font size in Android's system settings, and **More** > **Settings** > **Text size** adjusts it further.

## Windows

**SmartScreen warns about the installer.** The installers aren't code-signed. Choose **More info**, then **Run anyway**, after checking the download against `SHA256SUMS.txt` (see [Security](security.md)).

## Linux

**The window has no title bar.** ArkMD draws its own minimize, maximize and close buttons at the top right of the tab bar. Drag an empty part of the bar to move the window, and drag the window's edges to resize it. Tiling window managers place and size the window themselves.

**The AppImage doesn't start.** AppImages need FUSE 2. Install it, or run `./ArkMD_<version>_amd64.AppImage --appimage-extract-and-run`.

**ArkMD isn't in "Open with" for Markdown files.** The `.deb` and `.rpm` packages register it. An AppImage doesn't install anything, so choose **+** > **Open file…** inside ArkMD, or use a tool such as AppImageLauncher to add it to your menu.

**The package won't install: WebKitGTK missing.** ArkMD needs WebKitGTK 4.1 (`libwebkit2gtk-4.1`); the package manager installs it as a dependency. On a distribution without it, use the AppImage.

## Everywhere

**Colors look different from the official theme.** The contrast mode adjusts colors that are hard to read. Switch it off in **More** > **Settings** > **Contrast (WCAG AA)** to see the official colors.

**Pasting a picture does nothing.** Save the document first, because the picture is stored in an `images` folder next to it, and paste while the editor is showing. On Linux, ArkMD reads the picture from the system clipboard, which needs an X11 session or a Wayland compositor that supports the data-control protocol. If your desktop doesn't, use the image button in the formatting panel (Ctrl+Shift+I) or drag the image file onto the window.

**A local image doesn't show.** Images next to the document load on Windows and Linux, from a saved file, with a relative path such as `images/photo.png`. A document that hasn't been saved yet, an absolute path, an unsupported type or a file over 25 MB shows "Image not found". On Android they never load.

**A web image doesn't show.** The device needs a connection to the image's server, and some sites block loading their images in other apps. 

**Finding out what went wrong.** **More** > **Settings** > **Troubleshooting** has **Copy diagnostic information**, which puts the version, system, settings and the end of the log on the clipboard to paste into a bug report. On Windows and Linux, **Open the log folder** shows `arkmd.log`, a plain text file of errors and crashes (about 1 MB at most, older entries move to `arkmd.log.1`). It never holds document text, shows your home folder as `~`, and stays on the device, but an error message can name a file, so read it before you share it. On Android, the system log (logcat) has ArkMD's errors.

**Something else.** [Open an issue](https://github.com/cj0r/arkmd/issues) with your ArkMD version (**More** > **About**), your platform and what you did. Security problems go through [SECURITY.md](../SECURITY.md).
