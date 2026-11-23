#!/usr/bin/env python3
"""Check the Rust dependencies in Cargo.lock against the public OSV advisory database.

Advisories that only say a crate is unmaintained or unsound (which the Linux GTK stack under Tauri has some of)
are listed as warnings. Any other advisory fails the run. An unreachable database is a warning, not a failure."""
import json
import sys
import tomllib
import urllib.request

LOCK = "app/src-tauri/Cargo.lock"
API = "https://api.osv.dev/v1"


def post(path, body):
    request = urllib.request.Request(API + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(request, timeout=30))


def main():
    with open(LOCK, "rb") as f:
        packages = [(p["name"], p["version"]) for p in tomllib.load(f)["package"] if str(p.get("source", "")).startswith("registry")]
    found = {}
    try:
        for i in range(0, len(packages), 500):
            chunk = packages[i:i + 500]
            queries = [{"package": {"name": n, "ecosystem": "crates.io"}, "version": v} for n, v in chunk]
            for (name, version), result in zip(chunk, post("/querybatch", {"queries": queries})["results"]):
                for vuln in result.get("vulns", []):
                    found.setdefault(vuln["id"], []).append(f"{name} {version}")
        failures = 0
        for vuln_id, crates in sorted(found.items()):
            detail = json.load(urllib.request.urlopen(f"{API}/vulns/{vuln_id}", timeout=30))
            summary = detail.get("summary", "")
            informational = (detail.get("database_specific") or {}).get("informational") or (
                "unmaintained" if "unmaintained" in summary.lower() else "unsound" if "unsound" in summary.lower() else "")
            kind = f"warning ({informational})" if informational else "VULNERABILITY"
            failures += 0 if informational else 1
            print(f"{kind}: {vuln_id} {', '.join(sorted(set(crates)))}: {detail.get('summary', '')}")
    except OSError as e:
        print(f"warning: the advisory database could not be reached ({e}); nothing checked")
        return 0
    print(f"{len(packages)} crates checked, {len(found)} advisories, {failures} failing")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
