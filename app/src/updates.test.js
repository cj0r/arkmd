import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVersion, compareVersions, isNewer, androidRelease, shouldAutoCheck, summarizeNotes, describeDownload, DAY_MS } from "./updates.js";

test("parseVersion reads plain and v-prefixed versions", () => {
  assert.deepEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.deepEqual(parseVersion("v0.10.0"), [0, 10, 0]);
  assert.deepEqual(parseVersion(" 2.0.1 "), [2, 0, 1]);
  assert.deepEqual(parseVersion("1.2.3-beta.1"), [1, 2, 3]);
});

test("parseVersion rejects things that are not versions", () => {
  for (const v of ["", "1.2", "latest", "1.2.x", null, undefined, "a.b.c"]) assert.equal(parseVersion(v), null, String(v));
});

test("versions compare numerically, not as text", () => {
  assert.equal(compareVersions("0.5.1", "0.5.1"), 0);
  assert.equal(compareVersions("0.5.2", "0.5.1"), 1);
  assert.equal(compareVersions("0.5.1", "0.6.0"), -1);
  assert.equal(compareVersions("0.10.0", "0.9.0"), 1);       // as text "0.10" < "0.9"
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareVersions("nope", "1.0.0"), null);
});

test("isNewer is true only for a newer readable version", () => {
  assert.equal(isNewer("0.5.2", "0.5.1"), true);
  assert.equal(isNewer("0.5.1", "0.5.1"), false);
  assert.equal(isNewer("0.5.0", "0.5.1"), false);
  assert.equal(isNewer("garbage", "0.5.1"), false);
  assert.equal(isNewer("0.5.2", ""), false);
});

const SHA = "a".repeat(64);
const manifest = (platforms) => ({ version: "0.6.0", notes: "n", platforms });

test("androidRelease picks the entry for the device's preferred ABI", () => {
  const m = manifest({
    "android-aarch64": { url: "https://example.com/a.apk", sha256: SHA },
    "android-x86_64": { url: "https://example.com/x.apk", sha256: "b".repeat(64) },
  });
  assert.equal(androidRelease(m, ["arm64-v8a", "armeabi-v7a"]).key, "android-aarch64");
  assert.equal(androidRelease(m, ["x86_64", "x86"]).url, "https://example.com/x.apk");
  assert.equal(androidRelease(m, ["armeabi-v7a"]), null);
  assert.equal(androidRelease(m, []), null);
  assert.equal(androidRelease(m, undefined), null);
});

test("androidRelease ignores entries that are not safe to install", () => {
  const abis = ["arm64-v8a"];
  assert.equal(androidRelease(manifest({ "android-aarch64": { url: "http://example.com/a.apk", sha256: SHA } }), abis), null);   // not https
  assert.equal(androidRelease(manifest({ "android-aarch64": { url: "https://example.com/a.apk" } }), abis), null);               // no checksum
  assert.equal(androidRelease(manifest({ "android-aarch64": { url: "https://example.com/a.apk", sha256: "xyz" } }), abis), null); // bad checksum
  assert.equal(androidRelease({ version: "soon", platforms: {} }, abis), null);
  assert.equal(androidRelease(null, abis), null);
});

test("androidRelease normalises the checksum and keeps the notes", () => {
  const r = androidRelease({ version: "1.0.0", notes: "Fixed it", platforms: { "android-aarch64": { url: "https://e.com/a.apk", sha256: "A".repeat(64) } } }, ["arm64-v8a"]);
  assert.equal(r.sha256, "a".repeat(64));
  assert.equal(r.notes, "Fixed it");
  assert.equal(r.version, "1.0.0");
});

test("the automatic check needs the setting and runs once a day", () => {
  const now = 10 * DAY_MS;
  assert.equal(shouldAutoCheck(false, 0, now), false);                    // switched off
  assert.equal(shouldAutoCheck(true, 0, now), true);                      // never checked
  assert.equal(shouldAutoCheck(true, NaN, now), true);
  assert.equal(shouldAutoCheck(true, now - 1000, now), false);            // just checked
  assert.equal(shouldAutoCheck(true, now - DAY_MS + 1, now), false);
  assert.equal(shouldAutoCheck(true, now - DAY_MS, now), true);
  assert.equal(shouldAutoCheck(true, now + DAY_MS, now), true);           // clock moved back
});

test("summarizeNotes trims markdown and caps the length", () => {
  const notes = "\nFirst public release.\n\n### Added\n- **Reader** with callouts\n- Tabs\n";
  assert.equal(summarizeNotes(notes), "First public release.\nAdded\n• Reader with callouts\n• Tabs");
  const long = Array.from({ length: 12 }, (_, i) => `- item ${i}`).join("\n");
  const s = summarizeNotes(long, 3);
  assert.equal(s.split("\n").length, 4);
  assert.ok(s.endsWith("…"));
  assert.equal(summarizeNotes(""), "");
  assert.equal(summarizeNotes(undefined), "");
});

test("describeDownload explains each Download Manager state", () => {
  assert.equal(describeDownload({ status: "running", done: 4_000_000, total: 8_000_000 }).text, "Downloading… 50%");
  assert.equal(describeDownload({ status: "running", done: 1, total: 0 }).text, "Downloading…");
  assert.equal(describeDownload({ status: "running", done: 9, total: 3 }).text, "Downloading… 100%");
  assert.equal(describeDownload({ status: "pending" }).state, "waiting");
  assert.equal(describeDownload({ status: "paused" }).state, "waiting");
  assert.equal(describeDownload({ status: "done" }).state, "done");
  assert.match(describeDownload({ status: "done" }).text, /Open Downloads/);
  assert.equal(describeDownload({ status: "failed", reason: 1008 }).text.includes("1008"), true);
  assert.equal(describeDownload({ status: "gone" }).state, "failed");
  assert.equal(describeDownload(undefined).state, "running");
});

import { restorePending } from "./updates.js";
test("restorePending keeps a saved update only while it is newer than the running version", () => {
  const saved = { version: "0.24.0", notes: "Fixed things", downloadUrl: "https://github.com/x/y.apk", sha256: "abc", junk: 1 };
  assert.deepEqual(restorePending(saved, "0.23.2"), { version: "0.24.0", notes: "Fixed things", downloadUrl: "https://github.com/x/y.apk", sha256: "abc" });
  assert.equal(restorePending(saved, "0.24.0"), null);       // installed since
  assert.equal(restorePending(saved, "0.25.1"), null);       // superseded
});

test("restorePending rejects malformed or unsafe saved data", () => {
  assert.equal(restorePending(null, "0.1.0"), null);
  assert.equal(restorePending({ version: 5 }, "0.1.0"), null);
  assert.equal(restorePending({ version: "0.2.0" }, ""), null);
  assert.equal(restorePending({ version: "0.2.0", downloadUrl: "http://evil.example/x.apk" }, "0.1.0").downloadUrl, undefined);
  assert.equal(restorePending({ version: "0.2.0", downloadUrl: "javascript:alert(1)" }, "0.1.0").downloadUrl, undefined);
});
