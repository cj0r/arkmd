# Privacy

ArkMD has no accounts, no analytics and no advertising, and it does not send your documents anywhere. This page is the short version; [Security](security.md) has the detail.

## What stays on your device

- Your files stay where you saved them. ArkMD accesses only the files and folders you choose, and reads an added folder only when you expand it.
- ArkMD keeps its own copies on the device: settings, the folders you added and which of them are expanded, the Recent files list (names, titles, a short preview and word count), file history and unsaved-work drafts, and on Windows and Linux a small log of errors that holds no document text. None of it is sent anywhere, and each can be switched off or cleared in **Settings**. Uninstalling the app or clearing its data removes all of it.

## What ArkMD sends

- **Update checks.** When you choose Check for updates, or once a day if you turn on automatic checks (off by default), ArkMD asks GitHub for the latest release information. If you turn on **Settings** > **Updates** > **Include beta versions** (off by default), the check also asks for test versions published before a release. GitHub sees the request as it sees any download: your IP address and the app version.
- **Web pictures in a document.** ArkMD hides them until you tap Load images, because the site that hosts a picture learns your IP address and that the document was opened. You can set this to always or never load in **Settings** > **Privacy and history** > **Remote images**.
- Links open in your browser only when you tap them.

Nothing else is sent. ArkMD does not read your contacts, location or other apps' data, and on Android it asks for no storage permission.

## Questions

Open an issue at <https://github.com/cj0r/arkmd/issues>, or report a security problem as described in [SECURITY.md](../SECURITY.md).
