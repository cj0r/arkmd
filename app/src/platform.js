// Platform layer: everything that touches files, dialogs or the window goes through here, so the UI
// (main.js) is identical on every platform. Implementations:
//   desktop  Tauri plugins (dialog, fs, opener) + window API
//   android  window.ArkAndroid, a small Kotlin bridge in the generated Android project (content:// URIs,
//            Open with / Share intents, Storage Access Framework)
// An iOS implementation would be a third object with the same shape.
//
// A file "ref" is an opaque string: a filesystem path on desktop, a content:// URI on Android.

import { invoke } from "@tauri-apps/api/core";
import { decodeBytes, notUtf8Error, NotTextError } from "./encoding.js";
import { androidRelease, isNewer, betaManifestUrl, ANDROID_MANIFEST_URL } from "./updates.js";

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
  async readFile(ref) {                                                      // -> text; throws for a file that is not UTF-8 or not text
    let v;
    try { v = await call("read", ref); } catch (e) {
      if (/^NOTTEXT:/.test(e.message)) throw new NotTextError(e.message.slice(8));
      throw e;
    }
    if (v && typeof v === "object") throw notUtf8Error(v);                   // { text, encoding }: decoded as another encoding
    return v;
  },
  async writeFile(ref, text) { await call("write", ref, text); },
  async saveAs(name, text) { return call("createDocument", name, text); },  // -> {ref, name} | null
  async launchFile() { return call("takeLaunch"); },                        // -> {ref, name, text} | null
  async confirm(message, title) { return call("confirm", title, message); },
  async openUrl(url) { android.openUrl(url); },
  async copyText(text) { await navigator.clipboard.writeText(text); },
  logEvent(level, message) { (level === "error" ? console.error : console.log)("ArkMD", message); },   // Android keeps no file: the system log has it
  async logTail() { return ""; },
  openLogFolder: null,
  revealFile: null,                                                          // content:// documents have no folder to show
  async renameFile(ref, name) { const r = await call("rename", ref, name); return r; },
  async shareText(name, text) { await call("shareText", name, text); },
  async printHtml(html, name) { await call("printHtml", name, html); },
  pickImage: null, importImage: null, savePastedImage: null, pasteClipboardImage: null,                  // inserting pictures is desktop only for now
  onFileDrop() {},
  openLinked: null,                                                          // files next to a document aren't reachable through the system picker
  readLinkedImage: null,
  /** Added folders: the system folder picker keeps its access across restarts. Paths are content:// tree addresses and
   *  the listing gives each Markdown file its own document address ({ entries: [{ name, is_dir, ref }], truncated }). */
  async pickTree() { return call("pickFolder"); },                           // -> tree address | null (not pickFolder: that one means "Folder for new files", desktop only)
  async listFolder(root, rel = "") { return call("listFolder", root, rel); },
  async forgetFolder(root) { await call("forgetFolder", root); },
  setTitle() {},
  onCloseRequested() {},
  onBack(handler) { window.arkBack = () => handler(); },                    // returns true if handled
  onLaunch(handler) { window.arkAndroidLaunch = () => handler(); },          // new Open with / Share while running
  onOpenRequest() {},
  window: null,                                                              // no window chrome on a phone
  /** Updates: the bridge reads android.json; a newer release is downloaded through the browser, never installed by ArkMD itself. */
  update: {
    async check({ beta = false } = {}) {
      const url = beta ? betaManifestUrl(ANDROID_MANIFEST_URL) : ANDROID_MANIFEST_URL;
      if (!url) throw new Error("This build has no beta channel");
      const reply = await call("updateManifest", url);
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
    // The fs plugin's own readTextFile decodes leniently (invalid bytes become U+FFFD, and saving would write that back),
    // so read the bytes through the same command and decode them here.
    const raw = await invoke("plugin:fs|read_text_file", { path: ref });
    const result = decodeBytes(raw instanceof ArrayBuffer ? new Uint8Array(raw) : Uint8Array.from(raw));
    if (result.encoding !== "utf-8") throw notUtf8Error(result);
    return result.text;
  },
  async writeFile(ref, text) {
    await invoke("save_text_file", { path: ref, text });        // atomic: a temp file renamed over the original
  },
  /** Settings > Allow multiple windows: recorded for the next start, since the single-instance check runs before the page. */
  async setMultipleInstances(allow) { await invoke("set_multiple_instances", { allow }); },
  /** Choose a folder (Settings > Folder for new files, or Add a folder in the recent files flyout).
   *  When recursive is true, tauri-plugin-dialog 2.8.4 grants fs_scope.allow_directory(path, true), which
   *  tauri-plugin-persisted-scope 2.4.3 restores across restarts so files inside the folder open normally. */
  async pickFolder(recursive = false) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const ref = await open({ multiple: false, directory: true, recursive });
    return ref || null;
  },
  /** List one level of a folder the user added ({ entries: [{ name, is_dir }], truncated }). */
  async listFolder(root, rel = "") {
    return invoke("list_folder", { root, rel });
  },
  async saveAs(name, text, filters = this.filters, folder = "") {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const sep = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
    const ref = await save({ defaultPath: folder ? folder.replace(/[\\/]+$/, "") + sep + name : name, filters });
    if (!ref) return null;
    await this.writeFile(ref, text);
    return { ref, name: baseName(ref) };
  },
  async launchFile() {
    const ref = await invoke("take_launch_file");
    if (!ref) return null;
    try { return { ref, name: baseName(ref), text: await this.readFile(ref) }; }
    catch (e) {
      if (e.notUtf8) return { ref, name: baseName(ref), text: e.notUtf8.text, notUtf8: e.notUtf8.encoding };   // main.js offers a copy
      throw e;
    }
  },
  async confirm(message, title, okLabel = "Discard") {
    const { ask } = await import("@tauri-apps/plugin-dialog");
    return ask(message, { title, kind: "warning", okLabel, cancelLabel: "Cancel" });
  },
  /** Move a Markdown file to the Recycle Bin or Trash (it is never erased; see trash_file in lib.rs). */
  async trashFile(path) { await invoke("trash_file", { path }); },
  async openUrl(url) { await invoke("open_external", { url }); },     // the host's own opener; see host.rs
  async copyText(text) {
    // The web view on Linux gives the page no clipboard access, so the system clipboard is set natively first.
    try { await invoke("copy_text", { text }); } catch { await navigator.clipboard.writeText(text); }
  },

  /** Show a saved file in the system file manager (its location). */
  async revealFile(ref) { return invoke("reveal_in_folder", { path: ref }); },
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
  /** A picture on the system clipboard, saved next to the document: resolves "images/name.png", or null when there is none. */
  async pasteClipboardImage(base, stem) { return invoke("paste_clipboard_image", { base, stem }); },
  /** Files dropped onto the window: handler({ type: "enter" | "leave" | "drop", paths }). */
  async onFileDrop(handler) {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    await getCurrentWebview().onDragDropEvent((e) => {
      const t = e.payload.type;
      handler({ type: t === "drop" ? "drop" : t === "leave" ? "leave" : "enter", paths: e.payload.paths || [] });
    });
  },
  /** Rename a file in its own folder; resolves { ref, name } of the renamed file. */
  async renameFile(ref, name) { const path = await invoke("rename_file", { path: ref, name }); return { ref: path, name: baseName(path) }; },
  /** A Markdown file next to the open document: gives the app access to it and returns its path. */
  async openLinked(base, rel, outside = false) { return invoke("open_linked", { base, rel, outside }); },
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
    async check({ beta = false } = {}) {
      this._beta = beta;
      this._found = null;
      if (beta) { const f = (await invoke("check_beta_update")) || null; this._betaFound = !!f; return f; }   // the address is built in Rust: see check_beta_update
      const { check } = await import("@tauri-apps/plugin-updater");
      const found = await check({ timeout: 15000 });
      if (!found) return null;
      this._found = found;
      return { version: found.version, notes: found.body || "" };
    },
    async install(onProgress, { beta = false } = {}) {
      if (this._beta || beta) {
        if (!this._betaFound) {           // after a restart the update is known only from what was saved: find it again
          if (!(await invoke("check_beta_update"))) throw new Error("The update is no longer available");
          this._betaFound = true;
        }
        const { Channel } = await import("@tauri-apps/api/core");
        const progress = new Channel();
        progress.onmessage = (p) => onProgress(p.done, p.total ?? null);
        await invoke("install_beta_update", { onProgress: progress });
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
        return { needsPermission: false };
      }
      // After a restart the update is known only from what was saved, so fetch the handle that installs it.
      if (!this._found) await this.check();
      if (!this._found) throw new Error("The update is no longer available");
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

/** macOS: shortcuts use Cmd, and the in-app updater isn't offered (macOS builds are experimental and unsigned; new
 *  versions are downloaded from the releases page). */
export const isMac = !android && /Mac/i.test(navigator.platform || navigator.userAgent);
if (isMac) platform.update = null;
/** A shortcut as the system names its keys: Cmd for Ctrl on macOS. */
export const keyLabel = (text) => (isMac ? String(text).replace(/Ctrl/g, "Cmd") : text);
