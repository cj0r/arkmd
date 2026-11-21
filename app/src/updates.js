// Update checks: version comparison, the Android update manifest and when to check automatically.
// Pure logic with no DOM or Tauri calls, so it can be unit-tested (updates.test.js).
//
// Desktop updates use Tauri's updater with latest.json (see tools/make_update_manifest.py). Android has no Tauri
// updater, so the Kotlin bridge reads android.json, downloads the APK and hands it to the system installer.

/** [major, minor, patch] from "1.2.3" or "v1.2.3" (a pre-release suffix is ignored), or null. */
export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** -1, 0 or 1 like a comparator; null when either version can't be read. */
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return null;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** True only when `remote` is a readable version newer than `local`. */
export function isNewer(remote, local) {
  return compareVersions(remote, local) === 1;
}

/** Where the Android updater reads the release (the desktop updater's endpoint is in tauri.conf.json). */
export const ANDROID_MANIFEST_URL =
  import.meta.env?.VITE_ANDROID_UPDATE_URL || "https://github.com/cj0r/arkmd/releases/latest/download/android.json";

/** Only test builds (VITE_ALLOW_INSECURE_UPDATES=1) may read an update from plain http; releases never do. */
const URL_PATTERN = import.meta.env?.VITE_ALLOW_INSECURE_UPDATES === "1" ? /^https?:\/\// : /^https:\/\//;

const ANDROID_KEYS = { "arm64-v8a": "android-aarch64", "x86_64": "android-x86_64" };

/**
 * The Android release for this device from android.json: { version, notes, url, sha256, key } or null.
 * `abis` is Build.SUPPORTED_ABIS in order of preference. Entries without an https URL or a SHA-256 are ignored.
 */
export function androidRelease(manifest, abis) {
  if (!manifest || typeof manifest !== "object" || !parseVersion(manifest.version)) return null;
  for (const abi of abis || []) {
    const key = ANDROID_KEYS[abi];
    const entry = key && manifest.platforms?.[key];
    if (entry && URL_PATTERN.test(entry.url ?? "") && /^[0-9a-f]{64}$/i.test(entry.sha256 ?? "")) {
      return { version: manifest.version, notes: String(manifest.notes ?? ""), url: entry.url, sha256: entry.sha256.toLowerCase(), key };
    }
  }
  return null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The automatic check runs at most once a day, and only when the user has switched it on. */
export function shouldAutoCheck(enabled, lastCheckedMs, nowMs) {
  if (!enabled) return false;
  if (!Number.isFinite(lastCheckedMs) || lastCheckedMs <= 0) return true;
  return nowMs - lastCheckedMs >= DAY_MS || nowMs < lastCheckedMs;   // a clock set back counts as due
}

/** The first lines of the release notes for the update dialog (markdown markers trimmed, blank lines dropped). */
export function summarizeNotes(notes, maxLines = 8) {
  const lines = String(notes ?? "").split(/\r?\n/).map((l) => l.replace(/^#+\s*/, "").replace(/^[-*]\s+/, "• ").replace(/\*\*/g, "").trim()).filter(Boolean);
  return lines.slice(0, maxLines).join("\n") + (lines.length > maxLines ? "\n…" : "");
}
