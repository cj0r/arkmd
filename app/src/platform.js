// Platform layer: everything that touches files, dialogs or the window goes through here, so the UI
// (main.js) is identical on every platform. Implementations:
//   desktop  Tauri plugins (dialog, fs, opener) + window API
//   android  window.ArkAndroid, a small Kotlin bridge in the generated Android project (content:// URIs,
//            Open with / Share intents, Storage Access Framework)
// An iOS implementation would be a third object with the same shape.
//
// A file "ref" is an opaque string: a filesystem path on desktop, a content:// URI on Android.

import { invoke } from "@tauri-apps/api/core";
import { androidRelease, isNewer, ANDROID_MANIFEST_URL } from "./updates.js";

const android = typeof window !== "undefined" && window.ArkAndroid;

// ---------------------------------------------------------------- Android
// The bridge answers async requests by calling window.arkAndroidResult(id, json).
let nextId = 1;
const pending = new Map();
if (android) {
  window.arkAndroidResult = (id, json) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    const r = JSON.parse(json);
    r.error ? p.reject(new Error(r.error)) : p.resolve(r.value ?? null);
  };
}
function call(method, ...args) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    android[method](id, ...args);
  });
}

const androidImpl = {
  name: "android",
  mobile: true,
  async openFile() { return call("openDocument"); },                       // -> {ref, name} | null
  async openThemeFile() { return call("openCss"); },                        // -> {ref, name} | null
  async readFile(ref) { return call("read", ref); },                        // -> text
  async writeFile(ref, text) { await call("write", ref, text); },
  async saveAs(name, text) { return call("createDocument", name, text); },  // -> {ref, name} | null
  async launchFile() { return call("takeLaunch"); },                        // -> {ref, name, text} | null
  async confirm(message, title) { return call("confirm", title, message); },
  async openUrl(url) { android.openUrl(url); },
  logEvent(level, message) { (level === "error" ? console.error : console.log)("ArkMD", message); },   // Android keeps no file: the system log has it
  async logTail() { return ""; },
  openLogFolder: null,
  openLinked: null,                                                          // files next to a document aren't reachable through the system picker
  readLinkedImage: null,
  setTitle() {},
  onCloseRequested() {},
  onBack(handler) { window.arkBack = () => handler(); },                    // returns true if handled
  onLaunch(handler) { window.arkAndroidLaunch = () => handler(); },          // new Open with / Share while running
  onOpenRequest() {},
  window: null,                                                              // no window chrome on a phone
  /** Updates: the bridge fetches android.json and downloads the APK; the system installer does the install. */
  update: {
    async check() {
      const reply = await call("updateManifest", ANDROID_MANIFEST_URL);
      const release = androidRelease(JSON.parse(reply.manifest), reply.abis);
      if (!release || !isNewer(release.version, await version())) return null;
      this._release = release;
      return { version: release.version, notes: release.notes };
    },
    /** onProgress(done, total). Resolves { needsPermission } when Android first has to allow installs from ArkMD. */
    async install(onProgress) {
      window.arkUpdateProgress = (done, total) => onProgress(done, total > 0 ? total : null);
      const r = await call("updateInstall", this._release.url, this._release.sha256);
      return { needsPermission: !!r.needsPermission };
    },
  },
  setChrome(bg, dark) { android.setChrome(bg, !!dark); },
  ready() { android.requestInsets(); },
  displayName: (ref, name) => name || "Untitled.md",
};

// ---------------------------------------------------------------- desktop (Tauri plugins)
const desktopImpl = {
  name: "desktop",
  mobile: false,
  filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "txt"] }],
  async openFile() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const ref = await open({ multiple: false, directory: false, filters: this.filters });
    return ref ? { ref, name: baseName(ref) } : null;
  },
  async openThemeFile() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const ref = await open({ multiple: false, directory: false, filters: [{ name: "CSS theme", extensions: ["css"] }] });
    return ref ? { ref, name: baseName(ref) } : null;
  },
  async readFile(ref) {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return readTextFile(ref);
  },
  async writeFile(ref, text) {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(ref, text);
  },
  async saveAs(name, text, filters = this.filters) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const ref = await save({ defaultPath: name, filters });
    if (!ref) return null;
    await this.writeFile(ref, text);
    return { ref, name: baseName(ref) };
  },
  async launchFile() {
    const ref = await invoke("take_launch_file");
    return ref ? { ref, name: baseName(ref), text: await this.readFile(ref) } : null;
  },
  async confirm(message, title) {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return ask(message, { title, kind: "warning", okLabel: "Discard", cancelLabel: "Cancel" });
  },
  async openUrl(url) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  },
  /** Troubleshooting log (a file in the app's log folder). Failures to log are ignored. */
  logEvent(level, message) { invoke("log_event", { level, message: String(message) }).catch(() => {}); },
  async logTail() { try { return await invoke("log_tail"); } catch { return ""; } },
  async openLogFolder() { return invoke("open_log_folder"); },
  /** A Markdown file next to the open document: gives the app access to it and returns its path. */
  async openLinked(base, rel) { return invoke("open_linked", { base, rel }); },
  /** The bytes (an ArrayBuffer) of an image next to the open document. */
  async readLinkedImage(base, rel) { return invoke("read_linked_image", { base, rel }); },
  async setTitle(title) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    getCurrentWindow().setTitle(title);
  },
  async onCloseRequested(handler) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    getCurrentWindow().onCloseRequested(async (event) => { if (!(await handler())) event.preventDefault(); });
  },
  onBack() {},
  onLaunch() {},
  setChrome() {},
  ready() {},
  /** A second launch of the app (Open with, command line) sends its file to this window. */
  async onOpenRequest(handler) {
    const { listen } = await import("@tauri-apps/api/event");
    await listen("arkmd-open", (e) => handler(e.payload));
  },
  /** Window controls for platforms that draw no frame of their own (Linux). */
  window: {
    async _w() { return (await import("@tauri-apps/api/window")).getCurrentWindow(); },
    async isDecorated() { return (await this._w()).isDecorated(); },
    async isMaximized() { return (await this._w()).isMaximized(); },
    async minimize() { return (await this._w()).minimize(); },
    async toggleMaximize() { return (await this._w()).toggleMaximize(); },
    async close() { return (await this._w()).close(); },
    async startResize(direction) { return (await this._w()).startResizeDragging(direction); },
    async onResized(handler) { return (await this._w()).onResized(handler); },
  },
  /** Updates: Tauri's updater checks latest.json, verifies the signature, installs, and the app restarts. */
  update: {
    async check() {
      const { check } = await import("@tauri-apps/plugin-updater");
      const found = await check({ timeout: 15000 });
      if (!found) return null;
      this._found = found;
      return { version: found.version, notes: found.body || "" };
    },
    async install(onProgress) {
      let total = null, done = 0;
      await this._found.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? null;
        if (e.event === "Progress") { done += e.data.chunkLength; onProgress(done, total); }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
      return { needsPermission: false };
    },
  },
  displayName: (ref) => baseName(ref),
};

/** The app version from the Tauri config (works on every platform). */
async function version() {
  try { return await (await import("@tauri-apps/api/app")).getVersion(); } catch { return ""; }
}

export const baseName = (p) => p.split(/[\\/]/).pop();
export const platform = { ...(android ? androidImpl : desktopImpl), version };
