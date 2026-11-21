#!/usr/bin/env python3
"""The app version lives in five files; this keeps them in step.

    python3 tools/version.py            print the version, fail if the files disagree
    python3 tools/version.py set 0.6.0  set all of them
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONF = ROOT / "app/src-tauri/tauri.conf.json"
PKG = ROOT / "app/package.json"
LOCK = ROOT / "app/package-lock.json"
CARGO = ROOT / "app/src-tauri/Cargo.toml"
CARGO_LOCK = ROOT / "app/src-tauri/Cargo.lock"
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def read():
    lock = json.loads(LOCK.read_text())
    cargo = re.search(r'^version = "([^"]+)"', CARGO.read_text(), re.M).group(1)
    cargo_lock = re.search(r'name = "arkmd"\nversion = "([^"]+)"', CARGO_LOCK.read_text()).group(1)
    return {
        "app/src-tauri/tauri.conf.json": json.loads(CONF.read_text())["version"],
        "app/package.json": json.loads(PKG.read_text())["version"],
        "app/package-lock.json": lock["version"],
        "app/src-tauri/Cargo.toml": cargo,
        "app/src-tauri/Cargo.lock": cargo_lock,
    }


def write(v):
    for path in (CONF, PKG):
        d = json.loads(path.read_text())
        d["version"] = v
        path.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    lock = json.loads(LOCK.read_text())
    lock["version"] = v
    lock["packages"][""]["version"] = v
    LOCK.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n")
    CARGO.write_text(re.sub(r'^version = "[^"]+"', f'version = "{v}"', CARGO.read_text(), count=1, flags=re.M))
    CARGO_LOCK.write_text(re.sub(r'(name = "arkmd"\nversion = )"[^"]+"', rf'\1"{v}"', CARGO_LOCK.read_text()))


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "set":
        if not SEMVER.match(sys.argv[2]):
            sys.exit(f"not a version: {sys.argv[2]}")
        write(sys.argv[2])
    found = read()
    if len(set(found.values())) != 1:
        for name, v in found.items():
            print(f"{v:10} {name}", file=sys.stderr)
        sys.exit("The version differs between files")
    version = next(iter(found.values()))
    if not SEMVER.match(version):
        sys.exit(f"not a plain X.Y.Z version: {version}")
    print(version)
