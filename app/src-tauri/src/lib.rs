//! ArkMD desktop shell. Everything platform-neutral lives in the web frontend; this file only wires
//! up plugins and hands the frontend files it was asked to open: the one the app was launched with
//! (file manager "Open with", file association, command line) and, while it is running, files from
//! any later launch, which arrive as a "arkmd-open" event and become tabs. Uses only plugins that
//! also exist on iOS/Android, except single-instance and persisted-scope (desktop only).

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
            app.opener().open_path(folder, None::<&str>).map_err(|e| e.to_string())
        }
    }
}

/// Show the log folder in the system file manager.
#[tauri::command]
fn open_log_folder(app: tauri::AppHandle, state: tauri::State<LogFile>) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let dir = state.0.parent().ok_or("no log folder")?.to_string_lossy().into_owned();
    app.opener().open_path(dir, None::<&str>).map_err(|e| e.to_string())
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

/// A file next to an open document: `rel` resolved against the folder of `base`, which must be a file ArkMD was
/// already given access to. Only files of the listed types are allowed, so a document can't reach other data.
fn resolve_linked(app: &tauri::AppHandle, base: &str, rel: &str, exts: &[&str]) -> Result<PathBuf, String> {
    let base = PathBuf::from(base);
    if !app.fs_scope().is_allowed(&base) {
        return Err("the document is not open in ArkMD".into());
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
    // Windows canonical paths carry a verbatim prefix; drop it so the path matches what the file dialogs produce.
    let text = target.to_string_lossy().into_owned();
    Ok(PathBuf::from(text.strip_prefix(r"\\?\").unwrap_or(&text)))
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

/// Give the app access to the Markdown file `rel` next to `base` and return its path.
#[tauri::command]
fn open_linked(app: tauri::AppHandle, base: String, rel: String) -> Result<String, String> {
    let target = resolve_linked(&app, &base, &rel, &MARKDOWN_EXT)?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Must be the first plugin: a second launch sends its arguments here and exits.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if let Some(path) = file_arg(argv.into_iter().skip(1).map(PathBuf::from)) {
            let _ = app.fs_scope().allow_file(&path);
            let _ = app.emit("arkmd-open", path.to_string_lossy().into_owned());
        }
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));
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
        .plugin(tauri_plugin_process::init());
    builder
        .setup(|app| {
            let mut launch = None;
            if let Some(path) = file_arg(std::env::args_os().skip(1).map(PathBuf::from)) {
                // Files chosen in the dialog are added to the fs scope automatically; a file the app was
                // launched with is allowed here so the frontend can read and save it.
                let _ = app.fs_scope().allow_file(&path);
                launch = Some(path.to_string_lossy().into_owned());
            }
            app.manage(LaunchFile(Mutex::new(launch)));

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
        .invoke_handler(tauri::generate_handler![take_launch_file, open_linked, read_linked_image, import_image, save_pasted_image, paste_clipboard_image, log_event, log_tail, open_log_folder, reveal_in_folder])
        .run(tauri::generate_context!())
        .expect("error while running ArkMD");
}
