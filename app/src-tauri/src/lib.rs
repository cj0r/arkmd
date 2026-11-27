//! ArkMD desktop shell. Everything platform-neutral lives in the web frontend; this file only wires
//! up plugins and hands the frontend files it was asked to open: the one the app was launched with
//! (file manager "Open with", file association, command line) and, while it is running, files from
//! any later launch, which arrive as a "arkmd-open" event and become tabs. Uses only plugins that
//! also exist on iOS/Android, except single-instance and persisted-scope (desktop only).

#[cfg(target_os = "linux")]
mod host;
mod save;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

/// Path passed on the command line / by a file association, consumed once by the frontend.
struct LaunchFile(Mutex<Option<String>>);

// ---- Log file -------------------------------------------------------------------------------------------
// A plain text log in the app's log folder, for troubleshooting crashes and errors. It holds the app version,
// errors the front end reports and panics, never document text. The home folder is shown as "~". At 512 KB the
// file is renamed to arkmd.log.1 (replacing the older one), so the log never grows past about 1 MB.
struct LogFile(PathBuf);
const LOG_LIMIT: u64 = 512 * 1024;

/// "2026-11-22 14:03:09 UTC" from the system clock, without a date library.
fn timestamp() -> String {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let (days, rem) = ((secs / 86_400) as i64, secs % 86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + if month <= 2 { 1 } else { 0 };
    format!("{year:04}-{month:02}-{day:02} {:02}:{:02}:{:02} UTC", rem / 3600, rem % 3600 / 60, rem % 60)
}

fn redact(text: &str) -> String {
    let mut out = text.to_string();
    for var in ["HOME", "USERPROFILE"] {
        if let Ok(home) = std::env::var(var) {
            if home.len() > 3 {
                out = out.replace(&home, "~");
            }
        }
    }
    out
}

fn append_log(path: &Path, level: &str, message: &str) {
    if std::fs::metadata(path).map(|m| m.len() > LOG_LIMIT).unwrap_or(false) {
        let _ = std::fs::rename(path, path.with_extension("log.1"));
    }
    let message: String = redact(message).chars().take(4000).collect();
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} {:<5} {}", timestamp(), level.to_uppercase(), message.replace('\n', " | "));
    }
}

/// An error or note from the front end.
#[tauri::command]
fn log_event(state: tauri::State<LogFile>, level: String, message: String) {
    let level = if ["error", "warn", "info"].contains(&level.as_str()) { level } else { "info".into() };
    append_log(&state.0, &level, &message);
}

/// The end of the log, for the diagnostics the user copies.
#[tauri::command]
fn log_tail(state: tauri::State<LogFile>) -> String {
    let text = std::fs::read_to_string(&state.0).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    lines[lines.len().saturating_sub(60)..].join("\n")
}

/// Show a file in the system file manager (selected in its folder where the platform can, otherwise just its folder).
/// Only files ArkMD already has access to, so a page can't use it to probe other paths.
#[tauri::command]
fn reveal_in_folder(app: tauri::AppHandle, log: tauri::State<LogFile>, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let file = PathBuf::from(&path);
    if !app.fs_scope().is_allowed(&file) {
        return Err("the file is not open in ArkMD".into());
    }
    if !file.exists() {
        return Err("the file no longer exists".into());
    }
    match app.opener().reveal_item_in_dir(&file) {
        Ok(()) => Ok(()),
        Err(first) => {
            // No file manager that can select the file (or no D-Bus service for it): open its folder instead.
            append_log(&log.0, "info", &format!("reveal failed ({first}); opening the folder"));
            let folder = file.parent().ok_or("the file has no folder")?.to_string_lossy().into_owned();
            open_folder(&app, folder)
        }
    }
}

/// Whether `name` can be a single file name on every system ArkMD runs on.
fn valid_file_name(name: &str) -> bool {
    let bad = |c: char| c.is_control() || "<>:\"/\\|?*".contains(c);
    let reserved = {
        let stem = name.split('.').next().unwrap_or("").to_ascii_lowercase();
        matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
            || ((stem.starts_with("com") || stem.starts_with("lpt")) && stem.len() == 4 && stem.as_bytes()[3].is_ascii_digit() && stem.as_bytes()[3] != b'0')
    };
    !name.trim().is_empty()
        && name.len() <= 255
        && !name.chars().any(bad)
        && !name.chars().all(|c| c == '.')
        && !name.ends_with(['.', ' '])
        && !reserved
}

/// Rename `file` inside its own folder. An existing file is never replaced; a name that differs only in case is
/// allowed. Returns the new path.
fn rename_in_place(file: &std::path::Path, name: &str) -> Result<PathBuf, String> {
    if !valid_file_name(name) {
        return Err("that is not a valid file name".into());
    }
    let dest = file.parent().ok_or("the file has no folder")?.join(name);
    if dest != file && dest.exists() {
        let same = matches!((file.canonicalize(), dest.canonicalize()), (Ok(a), Ok(b)) if a == b);
        if !same {
            return Err("a file with that name already exists".into());
        }
    }
    std::fs::rename(file, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

/// Rename a file ArkMD has access to and give the app access to the new path.
#[tauri::command]
fn rename_file(app: tauri::AppHandle, path: String, name: String) -> Result<String, String> {
    let file = PathBuf::from(&path);
    if !app.fs_scope().is_allowed(&file) {
        return Err("the file was not chosen in ArkMD".into());
    }
    // a folder (an added folder is in scope, with everything below it) is not renamed from here
    if std::fs::symlink_metadata(&file).map(|m| m.is_dir()).unwrap_or(false) {
        return Err("not a file".into());
    }
    let dest = rename_in_place(&file, &name)?;
    app.fs_scope().allow_file(&dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Show the log folder in the system file manager.
#[tauri::command]
fn open_log_folder(app: tauri::AppHandle, state: tauri::State<LogFile>) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = state.0.parent().ok_or("no log folder")?.to_string_lossy().into_owned();
    open_folder(&app, dir)
}

/// Show a folder in the file manager. On Linux through the host's own xdg-open with the AppImage's environment removed
/// (see host.rs); elsewhere through the opener plugin.
fn open_folder(app: &tauri::AppHandle, folder: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let _ = app;
        host::open_target(&folder)
    }
    #[cfg(not(target_os = "linux"))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener().open_path(folder, None::<&str>).map_err(|e| e.to_string())
    }
}

/// Open a web or mail link in the system's default program. Only http, https and mailto addresses.
#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if url.len() > 4096 || url.chars().any(|c| c.is_control()) || !(lower.starts_with("https://") || lower.starts_with("http://") || lower.starts_with("mailto:")) {
        return Err("only web and mail addresses can be opened".into());
    }
    #[cfg(target_os = "linux")]
    {
        let _ = app;
        host::open_target(&url)
    }
    #[cfg(not(target_os = "linux"))]
    {
        use tauri_plugin_opener::OpenerExt;
        app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
    }
}

/// Put text on the system clipboard. The web view on Linux doesn't give the page clipboard access, so Copy diagnostic
/// information asks for it here. The clipboard handle stays alive between calls: on Linux the copied text is served by the
/// process that owns it.
#[cfg(desktop)]
struct ClipboardHandle(Mutex<Option<arboard::Clipboard>>);
#[cfg(not(desktop))]
struct ClipboardHandle;

#[tauri::command]
fn copy_text(state: tauri::State<ClipboardHandle>, log: tauri::State<LogFile>, text: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let mut slot = state.0.lock().map_err(|_| "the clipboard is busy".to_string())?;
        if slot.is_none() {
            *slot = Some(arboard::Clipboard::new().map_err(|e| { append_log(&log.0, "warn", &format!("clipboard not available: {e}")); e.to_string() })?);
        }
        slot.as_mut().unwrap().set_text(text).map_err(|e| { append_log(&log.0, "warn", &format!("clipboard text not set: {e}")); e.to_string() })
    }
    #[cfg(not(desktop))]
    {
        let _ = (state, log, text);
        Err("not supported on this platform".into())
    }
}

#[tauri::command]
fn take_launch_file(state: tauri::State<LaunchFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}

/// First existing file among the arguments, canonicalised. Ignores flags (e.g. ones a launcher adds).
fn file_arg<I: IntoIterator<Item = PathBuf>>(args: I) -> Option<PathBuf> {
    args.into_iter()
        .filter(|p| !p.to_string_lossy().starts_with('-'))
        .find(|p| p.is_file())
        .and_then(|p| p.canonicalize().ok())
        .map(|p| without_verbatim_prefix(&p))     // the same address the file dialogs give, so a file opened by double-click is the same file as one opened from the list
}

const MARKDOWN_EXT: [&str; 5] = ["md", "markdown", "mdown", "mkd", "txt"];
const IMAGE_EXT: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"];
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;

/// `[[note]]` should find `Note.md`: look for the file name in its folder ignoring case.
fn find_ignoring_case(wanted: &std::path::Path) -> std::io::Result<PathBuf> {
    let (dir, name) = match (wanted.parent(), wanted.file_name().and_then(|n| n.to_str())) {
        (Some(d), Some(n)) => (d.canonicalize()?, n.to_ascii_lowercase()),
        _ => return Err(std::io::ErrorKind::NotFound.into()),
    };
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        if entry.file_name().to_string_lossy().to_ascii_lowercase() == name {
            return entry.path().canonicalize();
        }
    }
    Err(std::io::ErrorKind::NotFound.into())
}

/// Whether `rel` stays relative to the document's folder. A rooted path, a drive letter or a network share (`\\\\host\\share`,
/// `//host/share`) would make `join` drop the document's folder, so they are refused here whatever the page checked.
fn is_relative_link(rel: &str) -> bool {
    use std::path::Component;
    let bytes = rel.as_bytes();
    let drive = bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';
    !(rel.starts_with('/') || rel.starts_with('\\') || drive)
        && Path::new(rel).components().all(|c| !matches!(c, Component::Prefix(_) | Component::RootDir))
}

/// A file next to an open document: `rel` resolved against the folder of `base`, which must be a file ArkMD was
/// already given access to. Only files of the listed types are allowed, so a document can't reach other data.
fn resolve_linked(app: &tauri::AppHandle, base: &str, rel: &str, exts: &[&str]) -> Result<PathBuf, String> {
    let base = PathBuf::from(base);
    if !app.fs_scope().is_allowed(&base) {
        return Err("the document is not open in ArkMD".into());
    }
    if !is_relative_link(rel) {
        return Err("only files next to the document can be opened".into());
    }
    let dir = base.parent().ok_or("the document has no folder")?;
    let wanted = dir.join(rel);
    let target = wanted
        .canonicalize()
        .or_else(|_| find_ignoring_case(&wanted))
        .map_err(|_| "file not found".to_string())?;
    let ext = target.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).unwrap_or_default();
    if !target.is_file() || !exts.contains(&ext.as_str()) {
        return Err("unsupported file".into());
    }
    Ok(without_verbatim_prefix(&target))
}

/// Windows canonical paths carry a verbatim prefix (`\\?\C:\`); drop it so the path matches what the file dialogs produce.
fn without_verbatim_prefix(path: &std::path::Path) -> PathBuf {
    let text = path.to_string_lossy().into_owned();
    // a network share is \\?\UNC\server\share\...: it becomes \\server\share\..., not UNC\server\...
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    PathBuf::from(text.strip_prefix(r"\\?\").unwrap_or(&text))
}

// ---- Inserting images ---------------------------------------------------------------------------------
// Images go into an "images" folder next to the document, so a Markdown file and its pictures stay together.

/// A file name that is safe and has no spaces: letters, digits, dot, dash and underscore only.
fn safe_stem(name: &str) -> String {
    let stem = name.rsplit_once('.').map(|(s, _)| s).unwrap_or(name);
    let cleaned: String = stem
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(60)
        .collect();
    if cleaned.is_empty() { "image".into() } else { cleaned }
}

/// The folder for new images next to `base` (created if needed), with the checks every image command shares.
fn images_folder(app: &tauri::AppHandle, base: &str) -> Result<PathBuf, String> {
    let base = PathBuf::from(base);
    if !app.fs_scope().is_allowed(&base) {
        return Err("the document is not open in ArkMD".into());
    }
    let dir = base.parent().ok_or("the document has no folder")?.join("images");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn image_ext(ext: &str) -> Result<String, String> {
    let ext = ext.trim_start_matches('.').to_ascii_lowercase();
    if IMAGE_EXT.contains(&ext.as_str()) { Ok(ext) } else { Err("unsupported image type".into()) }
}

/// A path in `dir` that doesn't exist yet: stem.ext, then stem-2.ext, stem-3.ext...
fn free_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let mut path = dir.join(format!("{stem}.{ext}"));
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("{stem}-{n}.{ext}"));
        n += 1;
    }
    path
}

/// Copy a picture the user chose into the document's images folder; returns "images/name.ext".
#[tauri::command]
fn import_image(app: tauri::AppHandle, base: String, source: String) -> Result<String, String> {
    let source = PathBuf::from(source);
    if !app.fs_scope().is_allowed(&source) {
        return Err("the picture was not chosen in ArkMD".into());
    }
    let ext = image_ext(source.extension().and_then(|e| e.to_str()).unwrap_or(""))?;
    if std::fs::metadata(&source).map_err(|e| e.to_string())?.len() > MAX_IMAGE_BYTES {
        return Err("image too large".into());
    }
    let dir = images_folder(&app, &base)?;
    let stem = safe_stem(source.file_name().and_then(|n| n.to_str()).unwrap_or("image"));
    let dest = free_path(&dir, &stem, &ext);
    std::fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    Ok(format!("images/{}", dest.file_name().and_then(|n| n.to_str()).unwrap_or("image")))
}

/// A picture on the system clipboard, saved into the images folder next to `base` as `<stem>.png`; resolves
/// "images/name.png", or None when the clipboard holds no picture. The web view on Linux gives the page no clipboard
/// pictures, so the editor asks for it here when a paste arrives empty.
#[tauri::command]
fn paste_clipboard_image(app: tauri::AppHandle, log: tauri::State<LogFile>, base: String, stem: String) -> Result<Option<String>, String> {
    #[cfg(desktop)]
    {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| { append_log(&log.0, "warn", &format!("clipboard not available: {e}")); e.to_string() })?;
        let image = match clipboard.get_image() {
            Ok(image) => image,
            Err(arboard::Error::ContentNotAvailable) => { append_log(&log.0, "info", "paste: no picture on the clipboard"); return Ok(None) }
            Err(e) => { append_log(&log.0, "warn", &format!("clipboard picture not read: {e}")); return Err(e.to_string()) }
        };
        let (width, height) = (image.width as u32, image.height as u32);
        if (width as u64) * (height as u64) > 100_000_000 {
            return Err("image too large".into());
        }
        let mut data = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut data, width, height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
            writer.write_image_data(&image.bytes).map_err(|e| e.to_string())?;
        }
        if data.len() as u64 > MAX_IMAGE_BYTES {
            return Err("image too large".into());
        }
        let dir = images_folder(&app, &base)?;
        let dest = free_path(&dir, &safe_stem(&stem), "png");
        std::fs::write(&dest, data).map_err(|e| e.to_string())?;
        Ok(Some(format!("images/{}", dest.file_name().and_then(|n| n.to_str()).unwrap_or("image.png"))))
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, log, base, stem);
        Err("not supported on this platform".into())
    }
}

/// Decode %XX escapes (the front end sends file paths in a header, which must be plain ASCII).
fn percent_decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&text[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Save picture data from the clipboard into the images folder; returns "images/name.ext".
/// The body is the raw image; the document path, extension and name come in headers.
#[tauri::command]
fn save_pasted_image(app: tauri::AppHandle, request: tauri::ipc::Request) -> Result<String, String> {
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok()).unwrap_or("").to_string();
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("no image data".into()) };
    if bytes.is_empty() || bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err("image too large or empty".into());
    }
    let ext = image_ext(&header("x-ext"))?;
    let dir = images_folder(&app, &percent_decode(&header("x-base")))?;
    let dest = free_path(&dir, &safe_stem(&percent_decode(&header("x-stem"))), &ext);
    std::fs::write(&dest, bytes).map_err(|e| e.to_string())?;
    Ok(format!("images/{}", dest.file_name().and_then(|n| n.to_str()).unwrap_or("image")))
}

/// Save text to a file the user chose, as one atomic replace (see save.rs). Only files already in the fs scope: the
/// ones picked in a dialog, launched with, or opened through a link.
#[tauri::command]
fn save_text_file(app: tauri::AppHandle, path: String, text: String) -> Result<(), String> {
    let file = PathBuf::from(&path);
    if !app.fs_scope().is_allowed(&file) {
        return Err("the file was not chosen in ArkMD".into());
    }
    save::write_atomic(&file, text.as_bytes()).map_err(|e| e.to_string())
}

/// Whether `target` lies inside the folder of the document `base` (or one below it).
fn within_document_folder(base: &str, target: &std::path::Path) -> bool {
    let Some(dir) = std::path::Path::new(base).parent() else { return false };
    let dir = without_verbatim_prefix(&dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf()));
    target.starts_with(dir)
}

/// Give the app access to the Markdown file `rel` next to `base` and return its path. A file outside the
/// document's folder is refused with `outside:<path>` unless `outside` is set, which the frontend does only
/// after the user confirmed it.
#[tauri::command]
fn open_linked(app: tauri::AppHandle, base: String, rel: String, outside: Option<bool>) -> Result<String, String> {
    let target = resolve_linked(&app, &base, &rel, &MARKDOWN_EXT)?;
    if outside != Some(true) && !within_document_folder(&base, &target) {
        return Err(format!("outside:{}", target.to_string_lossy()));
    }
    app.fs_scope().allow_file(&target).map_err(|e| e.to_string())?;
    Ok(target.to_string_lossy().into_owned())
}

/// The bytes of the image `rel` next to `base`.
#[tauri::command]
fn read_linked_image(app: tauri::AppHandle, base: String, rel: String) -> Result<tauri::ipc::Response, String> {
    let target = resolve_linked(&app, &base, &rel, &IMAGE_EXT)?;
    let len = std::fs::metadata(&target).map_err(|e| e.to_string())?.len();
    if len > MAX_IMAGE_BYTES {
        return Err("image too large".into());
    }
    std::fs::read(&target).map(tauri::ipc::Response::new).map_err(|e| e.to_string())
}

// ---- Added folders in the recent files flyout -----------------------------------------------------------
// Folders are picked via tauri-plugin-dialog `open({ directory: true, recursive: true })`. In
// tauri-plugin-dialog 2.8.4 that calls `fs_scope.allow_directory(&path, true)`, allowing both `path` itself
// and `path/**`, and tauri-plugin-persisted-scope 2.4.3 saves and restores `path/**` across restarts, so
// opening any Markdown file inside an added folder works through the normal read/save path without a second
// grant command.

const MAX_FOLDER_ENTRIES: usize = 5000;

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
struct FolderEntry {
    name: String,
    is_dir: bool,
}

#[derive(Debug, PartialEq, Eq, serde::Serialize)]
struct FolderListing {
    entries: Vec<FolderEntry>,
    truncated: bool,
}

/// Whether `rel` stays strictly within an added folder root (empty for the root itself, otherwise relative
/// with no rooted/drive/UNC prefixes and no `..` segments under either `/` or `\`).
fn is_safe_folder_rel(rel: &str) -> bool {
    use std::path::Component;
    if rel.is_empty() {
        return true;
    }
    if rel.contains('\0') || !is_relative_link(rel) {
        return false;
    }
    if Path::new(rel)
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
    {
        return false;
    }
    !rel.split(['/', '\\']).any(|seg| seg == "..")
}

/// List one level of `root/rel`, keeping only subfolders and Markdown files, skipping hidden entries and
/// symlinks whose target escapes `canon_root`, and capping at `max_entries`.
fn list_folder_inner(root: &Path, rel: &str, max_entries: usize) -> Result<FolderListing, String> {
    if !is_safe_folder_rel(rel) {
        return Err("only subfolders inside the added folder can be listed".into());
    }
    let canon_root = root.canonicalize().map_err(|_| "folder not found".to_string())?;
    if !canon_root.is_dir() {
        return Err("not a folder".into());
    }
    let mut target_raw = canon_root.clone();
    if !rel.is_empty() {
        for seg in rel.split(['/', '\\']) {
            if !seg.is_empty() && seg != "." {
                target_raw.push(seg);
            }
        }
    }
    let canon_target = target_raw.canonicalize().map_err(|_| "folder not found".to_string())?;
    if !canon_target.starts_with(&canon_root) {
        return Err("folder is outside the added folder".into());
    }
    if !canon_target.is_dir() {
        return Err("not a folder".into());
    }

    let mut entries = Vec::new();
    let mut truncated = false;
    for item in std::fs::read_dir(&canon_target).map_err(|e| e.to_string())? {
        let Ok(entry) = item else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        let is_dir = if ft.is_symlink() {
            // Never follow or expose a symlink pointing outside the added folder root.
            let Ok(resolved) = entry.path().canonicalize() else { continue };
            if !resolved.starts_with(&canon_root) {
                continue;
            }
            if resolved.is_dir() {
                true
            } else if resolved.is_file() {
                false
            } else {
                continue;
            }
        } else if ft.is_dir() {
            true
        } else if ft.is_file() {
            false
        } else {
            continue;
        };

        if !is_dir {
            let ext = Path::new(&name)
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_ascii_lowercase())
                .unwrap_or_default();
            if !MARKDOWN_EXT.contains(&ext.as_str()) {
                continue;
            }
        }

        if entries.len() >= max_entries {
            truncated = true;
            break;
        }
        entries.push(FolderEntry { name, is_dir });
    }
    Ok(FolderListing { entries, truncated })
}

/// List one level of a folder the user added to the recent files flyout (desktop only).
#[tauri::command]
fn list_folder(app: tauri::AppHandle, root: String, rel: String) -> Result<FolderListing, String> {
    let root_path = PathBuf::from(&root);
    if !app.fs_scope().is_allowed(&root_path) {
        return Err("the folder was not added in ArkMD".into());
    }
    list_folder_inner(&root_path, &rel, MAX_FOLDER_ENTRIES)
}

/// Files this window has claimed (see claim_file), each held open with an exclusive lock.
#[cfg(desktop)]
struct FileClaims(Mutex<std::collections::HashMap<String, std::fs::File>>);

/// Most files one window claims at a time (more tabs than this open without a claim).
#[cfg(desktop)]
const MAX_CLAIMS: usize = 256;

/// Remove lock files nobody holds any more (a window held them; the system dropped the lock when it exited).
#[cfg(desktop)]
fn clean_stale_claims(app: &tauri::AppHandle) {
    let Ok(dir) = app.path().app_data_dir().map(|d| d.join("open-files")) else { return };
    let Ok(entries) = std::fs::read_dir(&dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("lock") { continue; }
        if let Ok(file) = std::fs::OpenOptions::new().write(true).open(&path) {
            if file.try_lock().is_ok() { drop(file); let _ = std::fs::remove_file(&path); }
        }
    }
}

/// A stable name for a file's lock: the same file gives the same name in every ArkMD process.
#[cfg(desktop)]
fn claim_name(path: &str) -> String {
    let key = if cfg!(windows) {
        without_verbatim_prefix(std::path::Path::new(path)).to_string_lossy().replace('/', "\\").to_lowercase()
    } else { path.to_string() };
    let mut h: u64 = 0xcbf29ce484222325;          // FNV-1a
    for b in key.bytes() { h ^= b as u64; h = h.wrapping_mul(0x100000001b3); }
    format!("{h:016x}.lock")
}

/// Claim a file this window has open, so another ArkMD window can tell. Returns false when another window already has
/// it claimed, true otherwise (also when claiming is not possible: then nothing is warned). The claim is an exclusive
/// lock on a small file in the app's data folder; the system drops it when the app exits, however it exits.
#[cfg(desktop)]
#[tauri::command]
fn claim_file(app: tauri::AppHandle, claims: tauri::State<FileClaims>, path: String) -> bool {
    let mut held = claims.0.lock().unwrap_or_else(|e| e.into_inner());
    if held.contains_key(&path) { return true; }
    if held.len() >= MAX_CLAIMS { return true; }          // a page cannot make this window hold unlimited files
    let Ok(dir) = app.path().app_data_dir().map(|d| d.join("open-files")) else { return true };
    if std::fs::create_dir_all(&dir).is_err() { return true; }
    let Ok(file) = std::fs::OpenOptions::new().create(true).write(true).truncate(false).open(dir.join(claim_name(&path))) else { return true };
    match file.try_lock() {
        Ok(()) => { held.insert(path, file); true }
        Err(std::fs::TryLockError::WouldBlock) => false,
        Err(_) => true,
    }
}

/// Give a claimed file back (its tab closed or it was renamed).
#[cfg(desktop)]
#[tauri::command]
fn release_file(claims: tauri::State<FileClaims>, path: String) {
    claims.0.lock().unwrap_or_else(|e| e.into_inner()).remove(&path);
}

#[cfg(not(desktop))]
#[tauri::command]
fn claim_file() -> bool { true }

#[cfg(not(desktop))]
#[tauri::command]
fn release_file() {}

/// Whether a path names a file type ArkMD deletes on request: the Markdown types it opens, nothing else.
fn is_trashable_name(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).map(|e| MARKDOWN_EXT.contains(&e.to_ascii_lowercase().as_str())).unwrap_or(false)
}

/// Whether the file is somewhere that has a Recycle Bin or Trash. On Windows only a fixed local drive has a Recycle
/// Bin: on a network share or a removable drive the system deletes for good instead, so those are refused.
#[cfg(windows)]
fn on_recyclable_volume(p: &Path) -> bool {
    let s = p.to_string_lossy();
    let b = s.as_bytes();
    if b.len() < 3 || !b[0].is_ascii_alphabetic() || b[1] != b':' { return false; }   // a \\server\share or \\?\ path
    let root: Vec<u16> = format!("{}:\\", b[0] as char).encode_utf16().chain(std::iter::once(0)).collect();
    // 3 is DRIVE_FIXED
    unsafe { windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(root.as_ptr()) == 3 }
}
#[cfg(all(desktop, not(windows)))]
fn on_recyclable_volume(_p: &Path) -> bool { true }

/// How many entries in the Recycle Bin were deleted from this path (None if the bin can't be listed). Windows only:
/// on Linux the library moves a file to a trash folder or fails, and the listing leaves out some mounts.
#[cfg(windows)]
fn trashed_count(p: &Path) -> Option<usize> {
    let items = trash::os_limited::list().ok()?;
    let want = p.to_string_lossy().to_lowercase();
    Some(items.iter().filter(|i| i.original_path().to_string_lossy().to_lowercase() == want).count())
}

/// Largest file that is held in memory while it is moved, so that it can be put back if the system erased it instead.
#[cfg(windows)]
const MAX_TRASH_BYTES: u64 = 64 * 1024 * 1024;

/// Move a Markdown file to the Recycle Bin or Trash (desktop only), from the recent files list or a folder tree.
/// It never loses the file: a location without a bin is refused, and after the move the bin is checked for the file;
/// if the system erased it instead (a bin switched off, a file too big for the bin), the file is written back and the
/// call fails. Only a file ArkMD was given access to (opened in a dialog, with Open with, or inside an added folder)
/// can be moved; a symbolic link is removed, not the file it points to.
#[cfg(desktop)]
#[tauri::command]
fn trash_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.is_absolute() { return Err("not a full path".into()); }
    if !is_trashable_name(&p) { return Err("only Markdown files can be deleted here".into()); }
    if !app.fs_scope().is_allowed(&p) { return Err("this file was not opened or added in ArkMD".into()); }
    let meta = std::fs::symlink_metadata(&p).map_err(|e| e.to_string())?;
    if meta.is_dir() { return Err("not a file".into()); }
    if !on_recyclable_volume(&p) { return Err("this location has no Recycle Bin or Trash".into()); }
    #[cfg(windows)]
    {
        // The Windows shell erases a file for good when it cannot recycle it (a bin switched off, a file too big for the
        // bin), so the file is held in memory, the bin is checked for it afterwards, and it is written back if missing.
        if meta.len() > MAX_TRASH_BYTES { return Err("the file is too large to delete safely from ArkMD".into()); }
        let backup = if meta.file_type().is_symlink() { None } else { Some(std::fs::read(&p).map_err(|e| e.to_string())?) };
        let before = trashed_count(&p);
        trash::delete(&p).map_err(|e| e.to_string())?;
        if let (Some(before), Some(bytes)) = (before, backup) {
            if trashed_count(&p).map_or(false, |after| after <= before) && !p.exists() {
                std::fs::write(&p, bytes).map_err(|e| format!("the file was erased and could not be restored: {e}"))?;
                return Err("the system did not move the file to the Recycle Bin, so it was put back".into());
            }
        }
    }
    #[cfg(not(windows))]
    trash::delete(&p).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
fn trash_file(_path: String) -> Result<(), String> { Err("not available on this platform".into()) }

/// The beta update address: the configured stable one with "latest" swapped for the rolling "beta" release, which holds
/// the manifest of the newest build (stable or beta). None for an address that isn't a GitHub "latest" download, so a
/// test build with a placeholder update address has no beta channel.
fn beta_url(stable: &str) -> Option<String> {
    const LATEST: &str = "/releases/latest/download/";
    stable.contains(LATEST).then(|| stable.replacen(LATEST, "/releases/download/beta/", 1))
}

#[cfg(desktop)]
struct PendingBeta(Mutex<Option<tauri_plugin_updater::Update>>);

#[cfg(desktop)]
#[derive(serde::Serialize)]
struct BetaFound { version: String, notes: String }

#[cfg(desktop)]
#[derive(Clone, serde::Serialize)]
struct BetaProgress { done: u64, total: Option<u64> }

/// Check the beta channel (Windows and Linux). The JS updater can't change its address, so this does the check;
/// the found update is kept for install_beta_update. Signatures are verified exactly as for a stable update.
#[cfg(desktop)]
#[tauri::command]
async fn check_beta_update(app: tauri::AppHandle) -> Result<Option<BetaFound>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let stable = app.config().plugins.0.get("updater")
        .and_then(|u| u.get("endpoints")).and_then(|e| e.get(0)).and_then(|e| e.as_str())
        .map(str::to_owned).ok_or("no update address is configured")?;
    let url: tauri::Url = beta_url(&stable).ok_or("this build has no beta channel")?
        .parse().map_err(|_| "the beta update address is not valid")?;
    let updater = app.updater_builder()
        .endpoints(vec![url]).map_err(|e| e.to_string())?
        .timeout(std::time::Duration::from_secs(15))
        .build().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| e.to_string())?;
    let out = found.as_ref().map(|u| BetaFound { version: u.version.clone(), notes: u.body.clone().unwrap_or_default() });
    *app.state::<PendingBeta>().0.lock().unwrap_or_else(|e| e.into_inner()) = found;
    Ok(out)
}

/// Download and install the update found by check_beta_update, reporting progress; the page restarts the app after.
#[cfg(desktop)]
#[tauri::command]
async fn install_beta_update(app: tauri::AppHandle, on_progress: tauri::ipc::Channel<BetaProgress>) -> Result<(), String> {
    let update = app.state::<PendingBeta>().0.lock().unwrap_or_else(|e| e.into_inner()).take()
        .ok_or("The update is no longer available")?;
    let mut done = 0u64;
    update.download_and_install(|chunk, total| {
        done += chunk as u64;
        let _ = on_progress.send(BetaProgress { done, total });
    }, || {}).await.map_err(|e| e.to_string())
}

#[cfg(not(desktop))]
#[tauri::command]
fn check_beta_update() -> Result<Option<String>, String> { Err("not available on this platform".into()) }

#[cfg(not(desktop))]
#[tauri::command]
fn install_beta_update() -> Result<(), String> { Err("not available on this platform".into()) }

/// The size in tauri.conf.json is for a large screen; on a smaller one (a 1080p screen with a taskbar, a laptop) it
/// would run off the bottom. Shrink the window to fit the screen it opens on, and centre it.
#[cfg(desktop)]
fn fit_window_to_screen(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else { return };
    // the window is created hidden (tauri.conf.json), so it is sized and placed before anyone sees it
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let scale = monitor.scale_factor();
        let (screen_w, screen_h) = (monitor.size().width as f64 / scale, monitor.size().height as f64 / scale);
        let width = (screen_w * 0.9).clamp(360.0, 920.0);
        let height = (screen_h * 0.82).clamp(480.0, 1000.0);
        let _ = window.set_size(tauri::LogicalSize::new(width, height));
        // placed by hand: centre() would use the size from before the resize has been applied
        let _ = window.set_position(tauri::LogicalPosition::new(((screen_w - width) / 2.0).max(0.0), ((screen_h - height) / 3.0).max(0.0)));
    }
    let _ = window.show();
}

/// The marker file that records "allow multiple windows": it lives in the app config folder, which Tauri names
/// after the identifier, and is looked up here by hand because it is needed before the app exists.
#[cfg(desktop)]
fn multiple_instances_marker() -> Option<PathBuf> {
    let base = if cfg!(target_os = "windows") {
        std::env::var_os("APPDATA").map(PathBuf::from)
    } else if cfg!(target_os = "macos") {
        std::env::var_os("HOME").map(|h| PathBuf::from(h).join("Library").join("Application Support"))
    } else {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
    };
    base.map(|b| b.join("app.arkmd").join("multiple-instances"))
}

#[cfg(desktop)]
fn multiple_instances_allowed() -> bool {
    multiple_instances_marker().is_some_and(|p| p.exists())
}

/// Settings > Allow multiple windows: takes effect the next time ArkMD starts.
#[cfg(desktop)]
#[tauri::command]
fn set_multiple_instances(allow: bool) -> Result<(), String> {
    let path = multiple_instances_marker().ok_or("No settings folder")?;
    if allow {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(&path, b"").map_err(|e| e.to_string())
    } else {
        match std::fs::remove_file(&path) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
            _ => Ok(()),
        }
    }
}

#[cfg(not(desktop))]
#[tauri::command]
fn set_multiple_instances(_allow: bool) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Must be the first plugin: a second launch sends its arguments here and exits.
    // Skipped when Settings > Allow multiple windows is on (read from a marker file, since plugins load before the page).
    #[cfg(desktop)]
    let builder = if multiple_instances_allowed() {
        builder
    } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = file_arg(argv.into_iter().skip(1).map(PathBuf::from)) {
                let _ = app.fs_scope().allow_file(&path);
                let _ = app.emit("arkmd-open", path.to_string_lossy().into_owned());
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
    };
    let builder = builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_persisted_scope::init());
    // In-app updates (Windows and Linux): the updater checks the release's latest.json and verifies each download
    // against the public key in tauri.conf.json; the process plugin restarts the app afterwards.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PendingBeta(Mutex::new(None)))
        .manage(FileClaims(Mutex::new(std::collections::HashMap::new())));
    builder
        .setup(|app| {
            #[cfg(desktop)]
            clean_stale_claims(app.handle());
            let mut launch = None;
            if let Some(path) = file_arg(std::env::args_os().skip(1).map(PathBuf::from)) {
                // Files chosen in the dialog are added to the fs scope automatically; a file the app was
                // launched with is allowed here so the frontend can read and save it.
                let _ = app.fs_scope().allow_file(&path);
                launch = Some(path.to_string_lossy().into_owned());
            }
            app.manage(LaunchFile(Mutex::new(launch)));
            #[cfg(desktop)]
            app.manage(ClipboardHandle(Mutex::new(None)));
            #[cfg(not(desktop))]
            app.manage(ClipboardHandle);
            #[cfg(desktop)]
            fit_window_to_screen(app);

            let dir = app.path().app_log_dir().unwrap_or_else(|_| std::env::temp_dir().join("arkmd"));
            let _ = std::fs::create_dir_all(&dir);
            let log = dir.join("arkmd.log");
            append_log(&log, "info", &format!("ArkMD {} started on {}", env!("CARGO_PKG_VERSION"), std::env::consts::OS));
            let panic_log = log.clone();
            let previous = std::panic::take_hook();
            std::panic::set_hook(Box::new(move |info| {
                append_log(&panic_log, "panic", &info.to_string());
                previous(info);
            }));
            app.manage(LogFile(log));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![take_launch_file, save_text_file, open_external, copy_text, open_linked, read_linked_image, import_image, save_pasted_image, paste_clipboard_image, log_event, log_tail, open_log_folder, reveal_in_folder, rename_file, set_multiple_instances, list_folder, check_beta_update, install_beta_update, trash_file, claim_file, release_file])
        .run(tauri::generate_context!())
        .expect("error while running ArkMD");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_checked() {
        for ok in ["a.md", "my notes (2).md", "日本語.md", ".hidden.md", "console.md"] {
            assert!(valid_file_name(ok), "{ok}");
        }
        for bad in ["", " ", ".", "..", "a/b", "a\\b", "a:b", "a*", "end.", "end ", "CON.md", "nul", "lpt1.txt", "tab\t.md"] {
            assert!(!valid_file_name(bad), "{bad}");
        }
        assert!(!valid_file_name(&"x".repeat(256)));
    }

    #[test]
    fn renaming_stays_in_the_folder_and_never_replaces() {
        let dir = std::env::temp_dir().join(format!("arkmd-rename-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let a = dir.join("a.md");
        std::fs::write(&a, "one").unwrap();
        std::fs::write(dir.join("b.md"), "two").unwrap();
        assert!(rename_in_place(&a, "b.md").unwrap_err().contains("already exists"));
        assert!(rename_in_place(&a, "../c.md").is_err());
        let c = rename_in_place(&a, "c.md").unwrap();
        assert_eq!(c, dir.join("c.md"));
        assert!(!a.exists());
        assert_eq!(std::fs::read_to_string(&c).unwrap(), "one");
        assert_eq!(std::fs::read_to_string(dir.join("b.md")).unwrap(), "two");
        let up = rename_in_place(&c, "C.md").unwrap();
        assert_eq!(std::fs::read_to_string(up).unwrap(), "one");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn linked_paths_must_be_relative() {
        for ok in ["a.md", "images/a.png", "../shared/a.png", "./a.md", "sub dir/a b.md"] {
            assert!(is_relative_link(ok), "{ok}");
        }
        for bad in ["/etc/a.png", "//server/share/a.png", "\\\\server\\share\\a.png", "\\a.png", "C:\\a.png", "c:/a.png", "C:a.png", "a:b/c.md"] {
            assert!(!is_relative_link(bad), "{bad}");
        }
    }

    #[test]
    fn links_stay_within_the_document_folder() {
        let dir = std::env::temp_dir().join(format!("arkmd-scope-{}", std::process::id()));
        for d in ["notes/sub", "notes-x"] {
            std::fs::create_dir_all(dir.join(d)).unwrap();
        }
        for f in ["notes/a.md", "notes/sub/b.md", "notes/c.md", "other.md", "notes-x/d.md"] {
            std::fs::write(dir.join(f), "x").unwrap();
        }
        // links are resolved to canonical paths before the check, so the test does the same
        let canon = |f: &str| without_verbatim_prefix(&dir.join(f).canonicalize().unwrap());
        let doc = dir.join("notes/a.md").to_string_lossy().into_owned();
        assert!(within_document_folder(&doc, &canon("notes/sub/b.md")));
        assert!(within_document_folder(&doc, &canon("notes/c.md")));
        assert!(!within_document_folder(&doc, &canon("other.md")));
        assert!(!within_document_folder(&doc, &canon("notes-x/d.md")));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_folder_reads_inside_root_and_skips_hidden_and_non_markdown() {
        let dir = std::env::temp_dir().join(format!("arkmd-list-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("sub/deep")).unwrap();
        std::fs::create_dir_all(dir.join(".hidden-dir")).unwrap();
        std::fs::write(dir.join("note.md"), "# hi").unwrap();
        std::fs::write(dir.join("README.TXT"), "hi").unwrap();
        std::fs::write(dir.join("photo.png"), "x").unwrap();
        std::fs::write(dir.join(".secret.md"), "no").unwrap();
        std::fs::write(dir.join("sub/nested.markdown"), "ok").unwrap();
        std::fs::write(dir.join("sub/.dot.md"), "no").unwrap();

        let top = list_folder_inner(&dir, "", 5000).unwrap();
        assert!(!top.truncated);
        let mut names: Vec<(String, bool)> = top.entries.into_iter().map(|e| (e.name, e.is_dir)).collect();
        names.sort();
        assert_eq!(
            names,
            vec![
                ("README.TXT".to_string(), false),
                ("note.md".to_string(), false),
                ("sub".to_string(), true),
            ]
        );

        let sub = list_folder_inner(&dir, "sub", 5000).unwrap();
        assert!(!sub.truncated);
        let mut sub_names: Vec<(String, bool)> = sub.entries.into_iter().map(|e| (e.name, e.is_dir)).collect();
        sub_names.sort();
        assert_eq!(
            sub_names,
            vec![("deep".to_string(), true), ("nested.markdown".to_string(), false)]
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_folder_rejects_parent_and_absolute_rel() {
        let dir = std::env::temp_dir().join(format!("arkmd-list-bad-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        for bad in [
            "..",
            "../other",
            "sub/..",
            "sub/../sub",
            "sub\\..\\sub",
            "/etc",
            "\\windows",
            "//server/share",
            "\\\\server\\share",
            "C:\\Windows",
            "c:/Users",
        ] {
            assert!(list_folder_inner(&dir, bad, 5000).is_err(), "expected err for {bad}");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn list_folder_refuses_symlinks_outside_root() {
        use std::os::unix::fs::symlink;
        let base = std::env::temp_dir().join(format!("arkmd-list-sym-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let root = base.join("root");
        let outside = base.join("outside");
        std::fs::create_dir_all(root.join("inner")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::write(outside.join("secret.md"), "nope").unwrap();
        std::fs::write(root.join("inner/ok.md"), "yes").unwrap();
        symlink(&outside, root.join("escape-dir")).unwrap();
        symlink(outside.join("secret.md"), root.join("escape-file.md")).unwrap();
        symlink(root.join("inner"), root.join("inner-link")).unwrap();

        let listed = list_folder_inner(&root, "", 5000).unwrap();
        let mut names: Vec<String> = listed.entries.into_iter().map(|e| e.name).collect();
        names.sort();
        assert_eq!(names, vec!["inner".to_string(), "inner-link".to_string()]);
        assert!(list_folder_inner(&root, "escape-dir", 5000).is_err());

        let _ = std::fs::remove_dir_all(&base);
    }

        #[test]
    fn only_markdown_types_can_be_trashed() {
        for ok in ["/a/b.md", "/a/b.MD", "/a/b.markdown", "/a/b.txt", "C:\\a\\b.mkd"] { assert!(is_trashable_name(Path::new(ok)), "{ok}"); }
        for no in ["/a/b.png", "/a/b", "/a/.md", "/a/b.md.exe", "/a/b.sh"] { assert!(!is_trashable_name(Path::new(no)), "{no}"); }
    }

    #[test]
    #[cfg(desktop)]
    fn a_file_claim_is_exclusive_across_handles_and_named_the_same_for_the_same_path() {
        assert_eq!(claim_name("/a/b.md"), claim_name("/a/b.md"));
        if cfg!(windows) { assert_eq!(claim_name(r"\\?\C:\a\b.md"), claim_name(r"c:/A/b.md")); }
        assert_ne!(claim_name("/a/b.md"), claim_name("/a/c.md"));
        let dir = std::env::temp_dir().join(format!("arkmd-claim-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(claim_name("/a/b.md"));
        let open = || std::fs::OpenOptions::new().create(true).write(true).truncate(false).open(&path).unwrap();
        let first = open();
        assert!(first.try_lock().is_ok());
        let second = open();
        assert!(matches!(second.try_lock(), Err(std::fs::TryLockError::WouldBlock)), "a second holder must be refused");
        drop(first);
        assert!(second.try_lock().is_ok(), "the lock is free once the first holder is gone");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn verbatim_prefixes_are_removed_like_the_file_dialogs_give_paths() {
        let p = |s: &str| without_verbatim_prefix(std::path::Path::new(s)).to_string_lossy().into_owned();
        assert_eq!(p(r"\\?\C:\Users\me\a.md"), r"C:\Users\me\a.md");
        assert_eq!(p(r"\\?\UNC\server\share\a.md"), r"\\server\share\a.md");
        assert_eq!(p(r"C:\Users\me\a.md"), r"C:\Users\me\a.md");
        assert_eq!(p("/home/x/a.md"), "/home/x/a.md");
    }

    #[test]
    fn beta_url_swaps_the_latest_download_for_the_beta_release() {
        assert_eq!(beta_url("https://github.com/o/r/releases/latest/download/latest.json").as_deref(),
            Some("https://github.com/o/r/releases/download/beta/latest.json"));
        assert_eq!(beta_url("https://example.invalid/latest.json"), None);
    }


#[test]
    fn list_folder_caps_entries_and_reports_truncation() {
        let dir = std::env::temp_dir().join(format!("arkmd-list-cap-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for i in 0..3 {
            std::fs::write(dir.join(format!("f{i}.md")), "x").unwrap();
        }
        let exact = list_folder_inner(&dir, "", 3).unwrap();
        assert_eq!(exact.entries.len(), 3);
        assert!(!exact.truncated);

        std::fs::write(dir.join("f3.md"), "x").unwrap();
        let capped = list_folder_inner(&dir, "", 3).unwrap();
        assert_eq!(capped.entries.len(), 3);
        assert!(capped.truncated);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
