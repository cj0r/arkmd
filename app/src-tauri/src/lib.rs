//! ArkMD desktop shell. Everything platform-neutral lives in the web frontend; this file only wires
//! up plugins and hands the frontend files it was asked to open: the one the app was launched with
//! (file manager "Open with", file association, command line) and, while it is running, files from
//! any later launch, which arrive as a "arkmd-open" event and become tabs. Uses only plugins that
//! also exist on iOS/Android, except single-instance and persisted-scope (desktop only).

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

/// Path passed on the command line / by a file association, consumed once by the frontend.
struct LaunchFile(Mutex<Option<String>>);

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![take_launch_file, open_linked, read_linked_image])
        .run(tauri::generate_context!())
        .expect("error while running ArkMD");
}
