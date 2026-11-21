# Troubleshooting

## Android

**"App not installed" when updating.** A build signed with a different key can't be installed over a release. This happens with an APK you built yourself without the release key. Uninstall the old version first (its settings are removed), then install the new one.

**"Could not save".** The place the file lives may be read-only, or its document provider may allow reading only. Use **More** > **Save as…** to write a copy somewhere else.

**A recent file won't open.** Android lets ArkMD read a file only while the system keeps that permission. Open the file again with **+** > **Open file…**.

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

**A web image doesn't show.** The device needs a connection to the image's server, and some sites block loading their images in other apps. Images by file path aren't loaded.

**Something else.** [Open an issue](https://github.com/cj0r/arkmd/issues) with your ArkMD version (**More** > **About**), your platform and what you did. Security problems go through [SECURITY.md](../SECURITY.md).
