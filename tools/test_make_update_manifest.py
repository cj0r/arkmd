import hashlib
import json
import pathlib
import tempfile
import unittest

import make_update_manifest as m

V = "0.6.0"
REPO = "cj0r/arkmd"


def release_dir(skip=(), unsigned=()):
    d = pathlib.Path(tempfile.mkdtemp())
    names = {
        f"ArkMD_{V}_amd64.AppImage": b"appimage", f"ArkMD_{V}_amd64.deb": b"deb", f"ArkMD-{V}-1.x86_64.rpm": b"rpm",
        f"ArkMD_{V}_x64-setup.exe": b"exe", f"ArkMD_{V}_x64_en-US.msi": b"msi", f"ArkMD-{V}-android-arm64.apk": b"apk bytes",
    }
    for name, data in names.items():
        if name in skip:
            continue
        (d / name).write_bytes(data)
        if not name.endswith(".apk") and name not in unsigned:
            (d / (name + ".sig")).write_text(f"signature of {name}\n")
    return d


class Manifest(unittest.TestCase):
    def test_desktop_entries_carry_url_and_signature(self):
        latest, _ = m.build(release_dir(), V, "notes", REPO, date="2026-01-01T00:00:00Z")
        entry = latest["platforms"]["linux-x86_64-appimage"]
        self.assertEqual(entry["url"], f"https://github.com/{REPO}/releases/download/v{V}/ArkMD_{V}_amd64.AppImage")
        self.assertEqual(entry["signature"], f"signature of ArkMD_{V}_amd64.AppImage")
        self.assertEqual(latest["version"], V)
        self.assertEqual(latest["pub_date"], "2026-01-01T00:00:00Z")
        for key in ("linux-x86_64-deb", "linux-x86_64-rpm", "windows-x86_64-nsis", "windows-x86_64-msi"):
            self.assertIn(key, latest["platforms"])

    def test_generic_keys_fall_back_to_appimage_and_nsis(self):
        latest, _ = m.build(release_dir(), V, "n", REPO)
        p = latest["platforms"]
        self.assertEqual(p["linux-x86_64"], p["linux-x86_64-appimage"])
        self.assertEqual(p["windows-x86_64"], p["windows-x86_64-nsis"])

    def test_urls_are_percent_encoded(self):
        latest, _ = m.build(release_dir(), V, "n", REPO)
        self.assertIn(f"ArkMD_{V}_x64_en-US.msi", latest["platforms"]["windows-x86_64-msi"]["url"])
        for entry in latest["platforms"].values():
            self.assertNotIn(" ", entry["url"])
        self.assertEqual(m.release_url(REPO, V, "a b.apk").rsplit("/", 1)[1], "a%20b.apk")

    def test_android_manifest_has_the_apk_checksum(self):
        _, android = m.build(release_dir(), V, "n", REPO)
        entry = android["platforms"]["android-aarch64"]
        self.assertEqual(entry["sha256"], hashlib.sha256(b"apk bytes").hexdigest())
        self.assertTrue(entry["url"].endswith(f"ArkMD-{V}-android-arm64.apk"))
        self.assertTrue(entry["url"].startswith("https://"))

    def test_the_android_manifest_has_no_desktop_entries(self):
        _, android = m.build(release_dir(), V, "n", REPO)
        self.assertEqual(list(android["platforms"]), ["android-aarch64"])

    def test_a_required_package_without_a_signature_stops_the_release(self):
        with self.assertRaises(SystemExit) as e:
            m.build(release_dir(unsigned=(f"ArkMD_{V}_amd64.AppImage",)), V, "n", REPO)
        self.assertIn("no signature", str(e.exception))

    def test_an_optional_package_without_a_signature_is_left_out(self):
        latest, _ = m.build(release_dir(unsigned=(f"ArkMD_{V}_amd64.deb",)), V, "n", REPO)
        self.assertNotIn("linux-x86_64-deb", latest["platforms"])
        self.assertIn("linux-x86_64-appimage", latest["platforms"])

    def test_an_empty_signature_stops_the_release(self):
        d = release_dir()
        (d / f"ArkMD_{V}_amd64.AppImage.sig").write_text("  \n")
        with self.assertRaises(SystemExit):
            m.build(d, V, "n", REPO)

    def test_missing_required_packages_stop_the_release(self):
        with self.assertRaises(SystemExit) as e:
            m.build(release_dir(skip=(f"ArkMD_{V}_x64-setup.exe",)), V, "n", REPO)
        self.assertIn("windows-x86_64-nsis", str(e.exception))

    def test_optional_packages_may_be_missing(self):
        latest, _ = m.build(release_dir(skip=(f"ArkMD_{V}_x64_en-US.msi", f"ArkMD-{V}-1.x86_64.rpm")), V, "n", REPO)
        self.assertNotIn("windows-x86_64-msi", latest["platforms"])
        self.assertNotIn("linux-x86_64-rpm", latest["platforms"])

    def test_missing_apk_stops_the_release(self):
        with self.assertRaises(SystemExit):
            m.build(release_dir(skip=(f"ArkMD-{V}-android-arm64.apk",)), V, "n", REPO)

    def test_notes_are_trimmed(self):
        latest, android = m.build(release_dir(), V, "\n  First release.\n\n", REPO)
        self.assertEqual(latest["notes"], "First release.")
        self.assertEqual(android["notes"], "First release.")


if __name__ == "__main__":
    unittest.main()
