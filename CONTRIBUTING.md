# Contributing

Thanks for helping out. Bug reports, ideas and pull requests are all welcome.

## Reporting a bug or asking for a feature

Open an issue with the matching form. For a bug, include the ArkMD version (**More > About**), your platform and its version, and the steps that trigger it; a small Markdown file that shows the problem helps most.

Security problems go through [SECURITY.md](SECURITY.md), not an issue.

## Working on the code

ArkMD is one Tauri 2 app for Android, Linux and Windows: a Rust shell in `app/src-tauri/`, a plain JavaScript front end in `app/src/` (CodeMirror 6 for editing), and a reader page, themes and fonts in `shared/web/`.

```bash
cd app
npm ci
npm test                 # unit tests (node --test)
npx tauri dev            # run the desktop app with live reload
```

Linux needs `webkit2gtk-4.1`, `libsoup3`, `gtk3`, `librsvg` and `openssl`. Android builds also need JDK 17, the Android SDK and NDK, and the Rust Android targets (`rustup target add aarch64-linux-android`); see the README.

- **Themes** are generated: edit `tools/gen_themes.py` and run `python3 tools/gen_themes.py`; don't edit `shared/web/themes.json` by hand.
- **Fonts** are built by `tools/build_fonts.py` from their official sources.
- Formatting operations live in `app/src/format.js` and the tab model in `app/src/tabs.js`; both have tests.

Run `npm test` from `app/` before opening a pull request.

## Pull requests

- Keep each pull request to one change, with a test for new behavior or a fixed bug.
- Write messages and docs in plain words for someone who isn't a developer.
- When behavior changes, update the matching page in `docs/`.
- Add a line to `CHANGELOG.md` under the next version.
- Say what changes for a user and why. Short and factual is best.

By contributing you agree your work is released under the project's license, GPL-3.0.
