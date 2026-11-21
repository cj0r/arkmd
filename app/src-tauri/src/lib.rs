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
        .invoke_handler(tauri::generate_handler![take_launch_file])
        .run(tauri::generate_context!())
        .expect("error while running ArkMD");
}
