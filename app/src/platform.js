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
  pickImage: null, importImage: null, savePastedImage: null,                  // inserting pictures is desktop only for now
  onFileDrop() {},
  openLinked: null,                                                          // files next to a document aren't reachable through the system picker
  readLinkedImage: null,
  setTitle() {},
  onCloseRequested() {},
  onBack(handler) { window.arkBack = () => handler(); },                    // returns true if handled
  onLaunch(handler) { window.arkAndroidLaunch = () => handler(); },          // new Open with / Share while running
  onOpenRequest() {},
  window: null,                                                              // no window chrome on a phone
  /** Updates: the bridge reads android.json; a newer release is downloaded through the browser, never installed by ArkMD itself. */
  update: {
    async check() {
      const reply = await call("updateManifest", ANDROID_MANIFEST_URL);
      const release = androidRelease(JSON.parse(reply.manifest), reply.abis);
      if (!release || !isNewer(release.version, await version())) return null;
      return { version: release.version, notes: release.notes, downloadUrl: release.url, sha256: release.sha256 };
    },
    /** Download the APK with the system Download Manager; resolves the download's id. */
    async download(url, fileName) { return (await call("downloadUpdate", url, fileName)).id; },
    /** { status, done, total, reason } of a download started above. */
    async downloadStatus(id) { return call("downloadStatus", String(id)); },
    openDownloads() { android.openDownloads(); },
    /** The app store or updater app that installed ArkMD ({ id, name }), or null (for example when installed from a file). */
    async source() { try { const r = await call("installSource"); return r.name ? { id: r.package, name: r.name } : null; } catch { return null; } },
    /** Open that app at ArkMD's page, where its own Update button installs the new version. */
    async openStore() { return !!(await call("openStore")).opened; },
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
  /** Choose a picture to insert; resolves { ref, name } or null. */
  async pickImage() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const ref = await open({ multiple: false, directory: false, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"] }] });
    return ref ? { ref, name: baseName(ref) } : null;
  },
  /** Copy a picture into the images folder next to the document; resolves its relative path ("images/name.png"). */
  async importImage(base, source) { return invoke("import_image", { base, source }); },
  /** Save clipboard picture data (an ArrayBuffer) the same way. */
  async savePastedImage(base, ext, stem, bytes) {
    return invoke("save_pasted_image", bytes, { headers: { "x-base": encodeURIComponent(base), "x-ext": ext, "x-stem": encodeURIComponent(stem) } });
  },
  /** Files dropped onto the window: handler({ type: "enter" | "leave" | "drop", paths }). */
  async onFileDrop(handler) {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    await getCurrentWebview().onDragDropEvent((e) => {
      const t = e.payload.type;
      handler({ type: t === "drop" ? "drop" : t === "leave" ? "leave" : "enter", paths: e.payload.paths || [] });
    });
  },
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
