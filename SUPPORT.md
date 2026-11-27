# Support and Stability

## Support scope

ArkMD is maintained on a best-effort basis with no guaranteed response times or fix schedules. Support applies to the latest stable release only; older releases do not receive backports or security patches.

## Versioning

Starting with 1.0.0, ArkMD follows [semantic versioning](https://semver.org) (`major.minor.patch`):

- **Patch** (`1.0.x`): bug fixes, security fixes, and documentation updates only.
- **Minor** (`1.x.0`): new features and settings that remain compatible with existing files and settings.
- **Major** (`x.0.0`): breaking changes to behavior, stored settings, or supported platforms.

## Release channels

- **Stable releases:** published as normal releases on GitHub and in the F-Droid repository. Default for all users.
- **Beta and release-candidate pre-releases:** numbered `1.0.0-1`, `1.0.0-2`, and so on, published as GitHub pre-releases. They are offered in-app only when **Settings > Updates > Include beta versions** is switched on (off by default). They never appear as the latest release or in the F-Droid repository. On Android, returning from a beta to an older stable release requires uninstalling ArkMD first.

## Release workflow

Every change reaches a release the same way:

1. **Branch.** The change is made on its own branch, with automated tests (unit tests, the browser smoke test, which includes accessibility checks, and the Rust tests) where the code can be tested.
2. **Release candidate.** The branch is published as a pre-release numbered after the version it leads to (`1.0.1-1`, `1.0.1-2`, `1.1.0-1` ...). It reaches only people who switched on **Include beta versions**; nobody else is offered it.
3. **Check.** The candidate is installed and tried on Windows (virtual machine), Linux (container) and Android (phone), including updating from the previous version.
4. **Review.** The maintainer reviews the result before anything is published as a release.
5. **Release.** The change is merged to the main branch and published as the next patch (`1.0.1`, fixes only) or minor (`1.1.0`, new features) version, with release notes in [CHANGELOG.md](CHANGELOG.md). A release has all its files, checksums and update manifests; the F-Droid repository follows it.
6. **After the release.** The published files and the update paths are checked once more. A problem found after a release is fixed by a new patch release, never by changing the published files.

A feature freeze can be declared before a major or minor release: then only fixes, tests and documentation are accepted until it ships.

## Platforms and testing limits

- **Windows and Linux:** supported platforms. Windows builds are tested in a virtual machine and Linux builds in a container; hardware-specific desktop behavior has limited testing.
- **Android:** supported on Android 7.0 and newer, on 64-bit ARM (arm64) devices.
- **macOS:** experimental and unsupported. Builds are not signed, not notarized, have no in-app updater, and have not been run on a Mac by the maintainer.
- **Screen readers:** best effort. Markup, labels, focus handling, and contrast are verified with automated accessibility tests only; manual testing with screen readers (TalkBack on Android, Orca on Linux, NVDA on Windows) has not been performed.

## Your files and backups

ArkMD opens, edits, and saves Markdown files in place. Saving overwrites the original file, and optional autosave does the same when enabled.

ArkMD stores settings, recent-file metadata, added folder lists, file history (up to 30 versions per file within about 50 MB, excluding files over 2 MB), and unsaved-work drafts locally on the device. Uninstalling the app or clearing its data removes all of it. File history and drafts are a convenience on one device, not a backup. Keep independent backups of any files you cannot afford to lose.

## Reporting bugs

- **Bugs and regressions:** open an issue at <https://github.com/cj0r/arkmd/issues>. Include your ArkMD version (**More > About**), platform, steps to reproduce, and diagnostic information (**More > Support > Copy diagnostic information**) after reviewing it for any file paths you prefer not to share.
- **Security issues:** report privately as described in [SECURITY.md](SECURITY.md) rather than in a public issue.
