# Security

## Reporting a problem

Please don't open a public issue for a security problem. Report it privately through GitHub instead: on the repository's **Security** tab, choose **Report a vulnerability**. Say what you found, how to reproduce it, and which version and platform you're running (**More > About** shows the version).

You'll get an answer within a week. Once a fix is out, the release notes credit you unless you'd rather they didn't.

## Supported versions

Only the latest release gets security fixes. Install the newest release over the old one; your settings carry over.

## What ArkMD protects

- ArkMD has no account and collects no data: it sends neither your documents nor any usage data anywhere. It reads and writes only the files you open or save. It contacts GitHub only when you choose Check for updates (or turn on the daily automatic check, which is off by default). Updates for Windows and Linux are verified against a public key built into the app; Android updates are checked against a SHA-256 from the release and must carry the same signing certificate as the installed app. A document that points to an image on the web makes ArkMD load that image from its server, as any Markdown viewer or browser would.
- Markdown is rendered with raw HTML turned off, so a document can't run scripts or embed active content. Links open in your system browser, not inside the app, and only `http`, `https` and `mailto` links are followed.
- On Android, files are opened and saved through the system file picker; the app asks for no storage permission.
- The desktop apps limit file access to the files you pick or open with ArkMD, and the app's web content is restricted by a content security policy.
- Release builds are produced from the tagged source by GitHub Actions and listed with SHA-256 checksums. Android builds are signed with the same key for every release, so an update installs only over a genuine ArkMD.

Problems in Android, your operating system's web view, or other software ArkMD uses belong with those projects.
