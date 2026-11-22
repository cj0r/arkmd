#!/usr/bin/env python3
"""Write the landing page for the ArkMD F-Droid repository: the address to add, the signing fingerprint to check, and the
files it serves.

    python3 tools/fdroid_page.py REPO_DIR OUT_HTML
"""
import hashlib
import html
import json
import os
import subprocess
import sys
import tempfile
import zipfile

BASE = "https://cj0r.github.io/arkmd/fdroid/repo"


def fingerprint(repo):
    """SHA-256 of the certificate that signs the repository index (what F-Droid shows and checks)."""
    with zipfile.ZipFile(os.path.join(repo, "index-v1.jar")) as z:
        sig = next(n for n in z.namelist() if n.upper().startswith("META-INF/") and n.upper().endswith((".RSA", ".DSA", ".EC")))
        with tempfile.NamedTemporaryFile(suffix=".der") as f:
            f.write(z.read(sig))
            f.flush()
            pem = subprocess.run(["openssl", "pkcs7", "-inform", "DER", "-in", f.name, "-print_certs"],
                                 check=True, capture_output=True, text=True).stdout
    der = subprocess.run(["openssl", "x509", "-outform", "DER"], input=pem.encode(), check=True, capture_output=True).stdout
    return hashlib.sha256(der).hexdigest().upper()


def main(repo, out):
    index = json.load(open(os.path.join(repo, "index-v1.json")))
    fp = fingerprint(repo)
    pkgs = sorted(index.get("packages", {}).get("app.arkmd", []), key=lambda p: -p["versionCode"])
    rows = "\n".join(
        f'<tr><td>{html.escape(p["versionName"])}</td><td>{p["size"] / 1048576:.1f} MB</td><td><code>{p["hash"]}</code></td></tr>'
        for p in pkgs)
    link = f"{BASE}?fingerprint={fp}"
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ArkMD F-Droid repository</title>
<style>
:root {{ color-scheme: light dark; --bg:#fff; --fg:#1f2328; --muted:#59636e; --line:#d1d9e0; --accent:#0969da; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0d1117; --fg:#e6edf3; --muted:#9198a1; --line:#30363d; --accent:#4493f8; }} }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 system-ui, sans-serif; }}
main {{ max-width:42rem; margin:0 auto; padding:2rem 1rem 4rem; }}
code {{ font:0.9em ui-monospace, monospace; word-break:break-all; }}
a {{ color:var(--accent); }} table {{ border-collapse:collapse; width:100%; }}
td, th {{ border-bottom:1px solid var(--line); padding:.4rem .5rem; text-align:left; vertical-align:top; }}
.muted {{ color:var(--muted); }}
</style></head><body><main>
<h1>ArkMD F-Droid repository</h1>
<p>ArkMD is a lightweight Markdown viewer and editor. This repository serves the same signed Android APKs that are attached to the
<a href="https://github.com/cj0r/arkmd/releases">GitHub releases</a>, so F-Droid, Droid-ify or Neo Store can keep ArkMD up to date.</p>
<h2>Add the repository</h2>
<p>On the phone, open <a href="{link}">this link</a> with your F-Droid client, or add this address by hand:</p>
<p><code>{BASE}</code></p>
<p>Check that the client shows this signing fingerprint (SHA-256) before you accept it:</p>
<p><code>{fp}</code></p>
<h2>Files</h2>
<table><tr><th>Version</th><th>Size</th><th>SHA-256</th></tr>
{rows}
</table>
<p class="muted">ArkMD is free software under the GPL-3.0 and is developed with the help of AI coding tools; see the
<a href="https://github.com/cj0r/arkmd">project page</a> for the disclaimer and source.</p>
</main></body></html>
"""
    with open(out, "w") as f:
        f.write(page)
    print(f"wrote {out} (fingerprint {fp})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
