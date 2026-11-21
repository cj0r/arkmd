#!/usr/bin/env python3
"""Write the update manifests for a release.

    python3 tools/make_update_manifest.py --files files --version 0.6.0 --notes notes.md --repo cj0r/arkmd

`latest.json` is what Tauri's updater reads on Windows and Linux: one entry per package type, with the signature
that `tauri build` wrote next to each package. `android.json` is what the Android updater reads: the APK's URL and
SHA-256. Both go into the release next to the files they describe.
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import sys
import urllib.parse

# manifest key -> file name suffix (Tauri looks up {os}-{arch}-{installer}, then {os}-{arch})
DESKTOP = {
    "linux-x86_64-appimage": ".AppImage",
    "linux-x86_64-deb": ".deb",
    "linux-x86_64-rpm": ".rpm",
    "windows-x86_64-nsis": "-setup.exe",
    "windows-x86_64-msi": ".msi",
}
FALLBACK = {"linux-x86_64": "linux-x86_64-appimage", "windows-x86_64": "windows-x86_64-nsis"}
REQUIRED = ("linux-x86_64-appimage", "windows-x86_64-nsis")
ANDROID_SUFFIX = "-android-arm64.apk"


def release_url(repo, version, name):
    return f"https://github.com/{repo}/releases/download/v{version}/{urllib.parse.quote(name)}"


def find(files, suffix):
    hits = sorted(p for p in files.iterdir() if p.is_file() and p.name.endswith(suffix) and not p.name.endswith(".sig"))
    if len(hits) > 1:
        raise SystemExit(f"more than one file ends with {suffix}: {[p.name for p in hits]}")
    return hits[0] if hits else None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build(files, version, notes, repo, date=None):
    """Return (latest, android) manifest dicts for the release files in `files`."""
    files = pathlib.Path(files)
    date = date or datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    platforms = {}
    for key, suffix in DESKTOP.items():
        package = find(files, suffix)
        if package is None:
            continue
        sig = package.with_name(package.name + ".sig")
        if not sig.exists():
            if key in REQUIRED:
                raise SystemExit(f"{package.name} has no signature file ({sig.name})")
            print(f"skipping {package.name}: no signature file", file=sys.stderr)
            continue
        signature = sig.read_text().strip()
        if not signature:
            raise SystemExit(f"{sig.name} is empty")
        platforms[key] = {"signature": signature, "url": release_url(repo, version, package.name)}
    missing = [k for k in REQUIRED if k not in platforms]
    if missing:
        raise SystemExit(f"no signed package for: {', '.join(missing)}")
    for generic, specific in FALLBACK.items():
        platforms[generic] = platforms[specific]
    latest = {"version": version, "notes": notes.strip(), "pub_date": date, "platforms": dict(sorted(platforms.items()))}

    apk = find(files, ANDROID_SUFFIX)
    if apk is None:
        raise SystemExit("no Android APK")
    android = {
        "version": version,
        "notes": notes.strip(),
        "pub_date": date,
        "platforms": {"android-aarch64": {"url": release_url(repo, version, apk.name), "sha256": sha256(apk)}},
    }
    return latest, android


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--files", required=True, help="folder with the release files and their .sig files")
    ap.add_argument("--version", required=True, help="X.Y.Z")
    ap.add_argument("--notes", required=True, help="file with the release notes")
    ap.add_argument("--repo", required=True, help="owner/name on GitHub")
    ap.add_argument("--out", help="where to write the manifests (default: --files)")
    a = ap.parse_args()
    latest, android = build(a.files, a.version, pathlib.Path(a.notes).read_text(), a.repo)
    out = pathlib.Path(a.out or a.files)
    for name, data in (("latest.json", latest), ("android.json", android)):
        (out / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        print(f"wrote {out / name}")


if __name__ == "__main__":
    sys.exit(main())
